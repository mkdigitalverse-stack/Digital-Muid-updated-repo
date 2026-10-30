import crypto from "crypto";
import { getSupabaseServerClient, isValidUUID } from "./supabaseServer.js";
import {
  sendCourseAccessEmail,
  sendConsultationConfirmationEmail,
  sendResourceDeliveryEmail
} from "./mailerService.js";
import { assertSideEffectAllowed } from "./developmentSafetyGate.js";

/**
 * Calculates the authoritative effective course price according to standard business logic:
 * - If offer_price exists, > 0, and offer_expires_at is null or future, use offer_price.
 * - Otherwise use base price.
 *
 * @param {object} course - Row from public.courses
 * @returns {{ effectivePrice: number, currency: string, isOfferValid: boolean }}
 */
export function calculateAuthoritativeCoursePrice(course) {
  const basePrice = Number(course?.price) || 0;
  const offerPrice = course?.offer_price != null ? Number(course.offer_price) : null;
  const offerExpiresAt = course?.offer_expires_at ? new Date(course.offer_expires_at) : null;

  const isOfferValid =
    offerPrice != null &&
    offerPrice > 0 &&
    (!offerExpiresAt || offerExpiresAt.getTime() > Date.now());

  const effectivePrice = isOfferValid ? offerPrice : basePrice;
  const currency = (course?.currency || "INR").toUpperCase();

  return {
    effectivePrice,
    currency,
    isOfferValid
  };
}

/**
 * Executes the secure PostgreSQL SECURITY DEFINER RPC public.fulfill_course_enrollment()
 * to atomically:
 * 1. Insert/confirm payment in public.payments with authoritative price and currency.
 * 2. Create or reactivate enrollment in public.course_enrollments.
 * 3. Create student notification in public.notifications.
 * 4. Remove fulfilled course from student wishlist in public.student_course_wishlist (Phase 4B).
 *
 * Security & Idempotency:
 * - Requires SUPABASE_SERVICE_ROLE_KEY to invoke the RPC (which is revoked from PUBLIC/anon/authenticated).
 * - Guaranteed idempotent: subsequent calls with identical razorpay_payment_id return existing records.
 *
 * @param {object} params
 * @param {string} params.userId - UUID of authenticated student
 * @param {string} params.courseId - UUID of course
 * @param {number} params.amount - Authoritative price in Rupees (not paise)
 * @param {string} params.currency - Authoritative currency (e.g. 'INR')
 * @param {string} params.orderId - Razorpay order ID (e.g. 'order_...')
 * @param {string} params.paymentId - Razorpay payment ID (e.g. 'pay_...')
 * @returns {Promise<{ success: boolean, fulfilled?: boolean, already_fulfilled?: boolean, payment_id?: string, enrollment_id?: string, course_slug?: string, course_title?: string, error?: string, code?: string }>}
 */
export async function fulfillCourseEnrollment({
  userId,
  courseId,
  amount,
  currency,
  orderId,
  paymentId
}) {
  try {
    // 0. Development safety check: prevent database mutations in non-production targeting prod
    const sideEffectCheck = assertSideEffectAllowed("database_mutation");
    if (!sideEffectCheck.allowed) {
      return {
        success: false,
        fulfilled: false,
        code: sideEffectCheck.code,
        error: `CRITICAL SAFETY VIOLATION: Course fulfillment blocked in development: ${sideEffectCheck.reason}`
      };
    }

    // 1. Parameter validations
    if (!userId || !isValidUUID(userId)) {
      return {
        success: false,
        error: "A valid student userId (UUID) is required for fulfillment.",
        code: "INVALID_USER_ID"
      };
    }

    if (!courseId || !isValidUUID(courseId)) {
      return {
        success: false,
        error: "A valid courseId (UUID) is required for fulfillment.",
        code: "INVALID_COURSE_ID"
      };
    }

    if (!orderId || typeof orderId !== "string" || !orderId.trim()) {
      return {
        success: false,
        error: "A valid Razorpay orderId is required for fulfillment.",
        code: "INVALID_ORDER_ID"
      };
    }

    if (!paymentId || typeof paymentId !== "string" || !paymentId.trim()) {
      return {
        success: false,
        error: "A valid Razorpay paymentId is required for fulfillment.",
        code: "INVALID_PAYMENT_ID"
      };
    }

    if (typeof amount !== "number" || isNaN(amount) || amount <= 0) {
      return {
        success: false,
        error: "A valid positive numeric amount is required for fulfillment.",
        code: "INVALID_AMOUNT"
      };
    }

    if (!currency || typeof currency !== "string") {
      return {
        success: false,
        error: "A valid currency code is required for fulfillment.",
        code: "INVALID_CURRENCY"
      };
    }

    // 2. Obtain privileged Supabase Service Role client
    const supabaseServer = getSupabaseServerClient();
    if (!supabaseServer) {
      console.warn(
        "[Payment Fulfillment] SUPABASE_SERVICE_ROLE_KEY is not configured on the server. Database fulfillment requires server role credentials."
      );
      return {
        success: false,
        fulfilled: false,
        error: "Server-side Supabase Service Role key is not configured.",
        code: "SERVICE_KEY_MISSING"
      };
    }

    // 3. Invoke atomic PostgreSQL RPC
    const { data, error } = await supabaseServer.rpc("fulfill_course_enrollment", {
      p_user_id: userId.trim(),
      p_course_id: courseId.trim(),
      p_amount: amount,
      p_currency: currency.trim().toUpperCase(),
      p_order_id: orderId.trim(),
      p_payment_id: paymentId.trim()
    });

    if (error) {
      console.error("[Payment Fulfillment] RPC fulfill_course_enrollment error:", error);

      // Detect if RPC function is missing because migration is pending
      if (
        error.code === "PGRST202" ||
        error.message?.includes("function") ||
        error.message?.includes("does not exist")
      ) {
        return {
          success: false,
          fulfilled: false,
          error:
            "Fulfillment RPC function does not exist in database. Migration 20260921000001_atomic_course_payment_fulfillment.sql must be applied.",
          code: "MIGRATION_PENDING"
        };
      }

      return {
        success: false,
        fulfilled: false,
        error: error.message || "Database RPC execution failed.",
        code: error.code || "RPC_ERROR"
      };
    }

    if (!data || data.success !== true) {
      console.warn("[Payment Fulfillment] RPC returned non-success result:", data);
      return {
        success: false,
        fulfilled: false,
        error: data?.error || "Fulfillment could not be completed.",
        code: "FULFILLMENT_REJECTED"
      };
    }

    console.log(
      `[Payment Fulfillment] Success: payment_id=${data.payment_id}, enrollment_id=${data.enrollment_id}, user=${userId}, course=${courseId}, already_fulfilled=${data.already_fulfilled}`
    );

    // Asynchronously dispatch course access and authoritative PDF invoice email
    (async () => {
      try {
        let studentEmail = null;
        let studentName = "Student Member";

        if (supabaseServer) {
          const [userRes, profileRes] = await Promise.allSettled([
            supabaseServer.auth.admin.getUserById(userId),
            supabaseServer.from("profiles").select("full_name").eq("id", userId).maybeSingle()
          ]);

          if (userRes.status === "fulfilled" && userRes.value?.data?.user?.email) {
            studentEmail = userRes.value.data.user.email;
          }
          if (profileRes.status === "fulfilled" && profileRes.value?.data?.full_name) {
            studentName = profileRes.value.data.full_name;
          } else if (userRes.status === "fulfilled" && userRes.value?.data?.user?.user_metadata?.full_name) {
            studentName = userRes.value.data.user.user_metadata.full_name;
          }
        }

        if (studentEmail) {
          await sendCourseAccessEmail({
            to: studentEmail,
            studentName,
            courseTitle: data.course_title || "Course Masterclass",
            courseSlug: data.course_slug || "",
            amount: Number(data.amount) || amount,
            currency: data.currency || currency,
            orderId: orderId.trim(),
            paymentId: paymentId.trim()
          });
        }
      } catch (mailErr) {
        console.warn("[Payment Fulfillment] Notice dispatching course access email:", mailErr?.message || mailErr);
      }
    })();

    return {
      success: true,
      fulfilled: true,
      already_fulfilled: Boolean(data.already_fulfilled),
      payment_id: data.payment_id,
      enrollment_id: data.enrollment_id,
      course_slug: data.course_slug,
      course_title: data.course_title,
      amount: data.amount,
      currency: data.currency,
      message: data.message
    };
  } catch (err) {
    console.error("[Payment Fulfillment] Unexpected error during fulfillment:", err);
    return {
      success: false,
      fulfilled: false,
      error: err?.message || "An unexpected error occurred during fulfillment.",
      code: "UNEXPECTED_ERROR"
    };
  }
}

/**
 * Fulfills a verified consultation booking payment:
 * 1. Checks if a payment record with this razorpay_payment_id already exists in public.payments (idempotency check).
 * 2. Checks if a booking with this payment_id or razorpay_order_id already exists in public.bookings.
 * 3. If already fulfilled, returns the existing booking and payment records without duplicating.
 * 4. Inserts a confirmed booking in public.bookings with real payment_id and razorpay_order_id.
 * 5. Inserts a payment ledger record in public.payments with item_type='consultation'.
 * 6. Inserts a corresponding CRM Lead in public.leads.
 *
 * @param {object} params
 * @param {string|null} params.userId - UUID of authenticated student if signed in
 * @param {object} params.bookingDetails - Consultation intake brief data
 * @param {string} params.orderId - Razorpay order ID (e.g. 'order_...')
 * @param {string} params.paymentId - Razorpay payment ID (e.g. 'pay_...')
 * @returns {Promise<{ success: boolean, fulfilled?: boolean, already_fulfilled?: boolean, booking?: object, payment?: object, error?: string }>}
 */
export async function fulfillConsultationPayment({
  userId,
  bookingDetails,
  orderId,
  paymentId,
  productId,
  amount,
  currency
}) {
  try {
    // 0. Development safety check: prevent database mutations in non-production targeting prod
    const sideEffectCheck = assertSideEffectAllowed("database_mutation");
    if (!sideEffectCheck.allowed) {
      return {
        success: false,
        fulfilled: false,
        code: sideEffectCheck.code,
        error: `CRITICAL SAFETY VIOLATION: Consultation fulfillment blocked in development: ${sideEffectCheck.reason}`
      };
    }

    const supabaseServer = getSupabaseServerClient();
    if (!supabaseServer) {
      return {
        success: false,
        fulfilled: false,
        error: "Server-side Supabase Service Role client is not configured.",
        code: "SERVICE_KEY_MISSING"
      };
    }

    const cleanPaymentId = String(paymentId || "").trim();
    const cleanOrderId = String(orderId || "").trim();
    const targetProductId = isValidUUID(productId) ? productId : "31bbb9bf-ce10-4da4-a517-dfc673f9b875";

    // 1. Resolve authoritative product pricing strictly (fail closed if missing/inactive)
    const { data: product } = await supabaseServer
      .from("consultation_products")
      .select("*")
      .eq("id", targetProductId)
      .eq("active", true)
      .maybeSingle();

    if (!product) {
      return {
        success: false,
        fulfilled: false,
        error: `Consultation product (${targetProductId}) is inactive or not found. Fulfillment rejected.`,
        code: "PRODUCT_UNAVAILABLE"
      };
    }

    const baseAmount = Number(product?.base_price) || 499;
    const gstRate = Number(product?.gst_rate) || 0.18;
    const gstAmount = Number((baseAmount * gstRate).toFixed(2));
    const totalAmount = Number((baseAmount + gstAmount).toFixed(2));
    const effectiveCurrency = String(currency || product?.currency || "").trim().toUpperCase();

    if (!effectiveCurrency || effectiveCurrency !== "INR") {
      return {
        success: false,
        fulfilled: false,
        error: "Invalid or missing currency: Consultation transactions must be denominated in INR.",
        code: "INVALID_CURRENCY"
      };
    }

    const effectiveAmount = (typeof amount === "number" && !isNaN(amount) && amount > 0)
      ? Number(amount.toFixed(2))
      : totalAmount;
    const durationMinutes = Number(product?.duration_minutes) || 30;

    // 2. Resolve user_id: If authenticated student, use userId; else check profiles by email
    let resolvedUserId = isValidUUID(userId) ? userId : null;
    if (!resolvedUserId && bookingDetails?.customerEmail) {
      try {
        const { data: profile } = await supabaseServer
          .from("profiles")
          .select("id")
          .eq("email", bookingDetails.customerEmail.trim().toLowerCase())
          .maybeSingle();
        if (profile?.id && isValidUUID(profile.id)) {
          resolvedUserId = profile.id;
        }
      } catch {}
    }

    // 3. Prepare intake brief payload
    const bookingCode = `DM-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    // Genuine Google Meet URL requires Google Calendar API provisioning. Mark as pending if not provided.
    const meetUrl = bookingDetails?.meetUrl || "PENDING_CALENDAR_PROVISIONING";

    const intakeDetails = {
      customerName: String(bookingDetails?.customerName || "").trim(),
      customerEmail: String(bookingDetails?.customerEmail || "").trim(),
      customerPhone: String(bookingDetails?.customerPhone || "").trim(),
      businessName: String(bookingDetails?.businessName || "").trim(),
      primaryChallenge: String(bookingDetails?.primaryChallenge || "").trim(),
      desiredOutcome: String(bookingDetails?.desiredOutcome || "").trim(),
      website: bookingDetails?.website ? String(bookingDetails.website).trim() : null,
      linkedin: bookingDetails?.linkedin ? String(bookingDetails.linkedin).trim() : null,
      date: bookingDetails?.date || bookingDetails?.bookingDate || "",
      time: bookingDetails?.time || bookingDetails?.bookingTime || "",
      booking_code: bookingCode,
      meet_url: meetUrl,
      order_total_amount: bookingDetails?.order_total_amount || effectiveAmount.toFixed(2)
    };

    // 4. ATOMIC DATABASE TRANSACTION VIA RPC
    // Tries to execute PostgreSQL atomic RPC fulfill_consultation_payment
    let rpcSuccess = false;
    let rpcData = null;
    try {
      const { data, error: rpcErr } = await supabaseServer.rpc("fulfill_consultation_payment", {
        p_user_id: resolvedUserId,
        p_order_id: cleanOrderId,
        p_payment_id: cleanPaymentId,
        p_amount: effectiveAmount,
        p_currency: effectiveCurrency,
        p_booking_details: intakeDetails,
        p_product_id: product?.id || "31bbb9bf-ce10-4da4-a517-dfc673f9b875"
      });

      if (!rpcErr && data && typeof data === "object") {
        rpcData = data;
        if (data.success === false) {
          console.error("[Consultation Fulfillment] Atomic RPC rejected fulfillment:", data.error);
          return {
            success: false,
            fulfilled: false,
            error: data.error || "Payment fulfillment rejected by database transaction guard."
          };
        }
        rpcSuccess = true;
      } else if (rpcErr) {
        // If the RPC failed due to application constraint (not missing function), fail closed
        if (rpcErr.code && rpcErr.code !== "PGRST202" && rpcErr.code !== "42883") {
          console.error("[Consultation Fulfillment] Atomic RPC error:", rpcErr.message || rpcErr);
          return {
            success: false,
            fulfilled: false,
            error: rpcErr.message || "Database transaction error during consultation fulfillment."
          };
        }
        // PGRST202 / 42883: Function not present in active schema yet; proceed to hardened fallback
        console.warn("[Consultation Fulfillment] fulfill_consultation_payment RPC not found in schema. Utilizing hardened server-side transactional fallback.");
      }
    } catch (rpcCallErr) {
      console.warn("[Consultation Fulfillment] Notice calling RPC, executing hardened fallback:", rpcCallErr?.message);
    }

    if (rpcSuccess && rpcData) {
      // Dispatches confirmation email only after verified durable database persistence
      if (!rpcData.already_fulfilled || rpcData.healed_ledger) {
        (async () => {
          try {
            if (intakeDetails.customerEmail) {
              await sendConsultationConfirmationEmail({
                to: intakeDetails.customerEmail,
                customerName: intakeDetails.customerName || "Valued Client",
                bookingCode: rpcData.booking?.booking_code || bookingCode,
                bookingDate: rpcData.booking?.booking_date || intakeDetails.date,
                bookingTime: rpcData.booking?.booking_time || intakeDetails.time,
                durationMinutes,
                meetUrl: rpcData.booking?.meet_url || meetUrl,
                primaryChallenge: intakeDetails.primaryChallenge || "Business Growth Strategy",
                amount: totalAmount,
                currency,
                baseAmount,
                gstAmount,
                orderId: cleanOrderId,
                paymentId: cleanPaymentId
              });
            }
          } catch (mailErr) {
            console.warn("[Consultation Fulfillment] Notice dispatching consultation email:", mailErr?.message || mailErr);
          }
        })();
      }

      return {
        success: true,
        fulfilled: true,
        already_fulfilled: Boolean(rpcData.already_fulfilled),
        healed_ledger: Boolean(rpcData.healed_ledger),
        booking: rpcData.booking,
        payment: rpcData.payment,
        orderId: cleanOrderId,
        paymentId: cleanPaymentId
      };
    }

    // --------------------------------------------------------------------------
    // 5. HARDENED SERVER-SIDE DUAL-WRITE FALLBACK
    // Used when RPC is pending migration deployment.
    // --------------------------------------------------------------------------

    // 5A. Check existing payment and booking records
    const { data: existingPayment } = await supabaseServer
      .from("payments")
      .select("*")
      .eq("razorpay_payment_id", cleanPaymentId)
      .maybeSingle();

    const { data: existingBooking } = await supabaseServer
      .from("bookings")
      .select("*")
      .or(`payment_id.eq.${cleanPaymentId},razorpay_order_id.eq.${cleanOrderId}`)
      .maybeSingle();

    // Security cross-check: Confirm existing payment belongs to the exact same order
    if (existingPayment && existingPayment.razorpay_order_id !== cleanOrderId) {
      console.error(`[Consultation Fulfillment] Security rejection: Payment ${cleanPaymentId} belongs to order ${existingPayment.razorpay_order_id}, not ${cleanOrderId}`);
      return {
        success: false,
        fulfilled: false,
        error: "Security violation: payment ID is associated with a different order."
      };
    }

    // 5B. Heal Incomplete State: Booking exists, but Payment Ledger is missing
    if (existingBooking && !existingPayment) {
      console.log(`[Consultation Fulfillment] Healing incomplete state: Booking exists for order ${cleanOrderId}, writing missing payment ledger.`);
      const { data: healedPayment, error: healErr } = await supabaseServer
        .from("payments")
        .insert({
          user_id: resolvedUserId || null,
          item_type: "consultation",
          item_id: product?.id || "31bbb9bf-ce10-4da4-a517-dfc673f9b875",
          item_title: product?.name || "Business Growth & Scaling Consultation",
          amount: totalAmount,
          currency,
          razorpay_order_id: cleanOrderId,
          razorpay_payment_id: cleanPaymentId,
          status: "captured",
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (healErr) {
        console.error("[Consultation Fulfillment] Failed to heal payment ledger record:", healErr);
      }

      return {
        success: true,
        fulfilled: true,
        already_fulfilled: true,
        healed_ledger: true,
        booking: existingBooking,
        payment: healedPayment || null,
        orderId: cleanOrderId,
        paymentId: cleanPaymentId
      };
    }

    // 5C. Fully fulfilled already
    if (existingPayment && existingBooking) {
      console.log(`[Consultation Fulfillment] Payment ${cleanPaymentId} already processed. Returning existing record without duplicate email.`);
      return {
        success: true,
        fulfilled: true,
        already_fulfilled: true,
        booking: existingBooking,
        payment: existingPayment,
        orderId: cleanOrderId,
        paymentId: cleanPaymentId
      };
    }

    // 5D. Fresh dual-write
    const bookingPayload = {
      booking_code: bookingCode,
      customer_name: intakeDetails.customerName,
      customer_email: intakeDetails.customerEmail,
      customer_phone: intakeDetails.customerPhone,
      business_name: intakeDetails.businessName,
      primary_challenge: intakeDetails.primaryChallenge,
      desired_outcome: intakeDetails.desiredOutcome,
      website: intakeDetails.website,
      linkedin: intakeDetails.linkedin,
      booking_date: intakeDetails.date,
      booking_time: intakeDetails.time,
      duration_minutes: durationMinutes,
      base_amount: baseAmount,
      gst_rate: gstRate,
      gst_amount: gstAmount,
      total_amount: effectiveAmount,
      currency: effectiveCurrency,
      payment_id: cleanPaymentId,
      razorpay_order_id: cleanOrderId,
      payment_status: "paid",
      calendar_event_id: null,
      meet_url: meetUrl,
      status: "confirmed",
      user_id: resolvedUserId || null,
      notes: "Booked online with verified Razorpay payment.",
      created_at: new Date().toISOString()
    };

    let newBooking = null;
    const { data: bData, error: bookingError } = await supabaseServer
      .from("bookings")
      .insert(bookingPayload)
      .select()
      .single();

    if (bookingError) {
      // Concurrency race: check if another thread inserted it simultaneously
      if (bookingError.code === "23505") {
        const { data: racedBooking } = await supabaseServer
          .from("bookings")
          .select("*")
          .or(`payment_id.eq.${cleanPaymentId},razorpay_order_id.eq.${cleanOrderId}`)
          .maybeSingle();

        if (racedBooking) {
          newBooking = racedBooking;
        } else {
          // Active slot conflict: time slot taken by concurrent transaction.
          // Captured funds must never be dropped: persist with status 'reschedule_pending' (fits VARCHAR(20) and bypasses active slot index).
          const conflictPayload = {
            ...bookingPayload,
            status: "reschedule_pending",
            notes: `Slot conflict: Time slot was taken by concurrent checkout. Payment captured (Razorpay ${cleanPaymentId}). Priority reschedule required.`
          };
          const { data: conflictBooking, error: conflictErr } = await supabaseServer
            .from("bookings")
            .insert(conflictPayload)
            .select()
            .single();

          if (conflictErr) {
            console.error("[Consultation Fulfillment] Error inserting conflicted booking:", conflictErr);
            return {
              success: false,
              fulfilled: false,
              error: "This time slot or booking reference conflicts with an existing booking."
            };
          }
          newBooking = conflictBooking;
        }
      } else {
        console.error("[Consultation Fulfillment] Error inserting booking:", bookingError);
        return {
          success: false,
          fulfilled: false,
          error: bookingError.message || "Failed to record consultation booking."
        };
      }
    } else {
      newBooking = bData;
    }

    // Insert Payment Ledger (supports guest user_id = null)
    let paymentRecord = null;
    const paymentPayload = {
      user_id: resolvedUserId || null,
      item_type: "consultation",
      item_id: product?.id || "31bbb9bf-ce10-4da4-a517-dfc673f9b875",
      item_title: product?.name || "Business Growth & Scaling Consultation",
      amount: effectiveAmount,
      currency: effectiveCurrency,
      razorpay_order_id: cleanOrderId,
      razorpay_payment_id: cleanPaymentId,
      status: "captured",
      created_at: new Date().toISOString()
    };

    const { data: pData, error: paymentError } = await supabaseServer
      .from("payments")
      .insert(paymentPayload)
      .select()
      .single();

    if (paymentError) {
      if (paymentError.code === "23505") {
        const { data: racedPayment } = await supabaseServer
          .from("payments")
          .select("*")
          .eq("razorpay_payment_id", cleanPaymentId)
          .maybeSingle();
        paymentRecord = racedPayment;
      } else {
        console.warn("[Consultation Fulfillment] Notice inserting payment ledger:", paymentError.message);
      }
    } else {
      paymentRecord = pData;
    }

    // Verify durable ledger record was persisted
    if (!newBooking && !paymentRecord) {
      return {
        success: false,
        fulfilled: false,
        error: "Failed to persist consultation booking records to database ledger."
      };
    }

    // Record CRM Lead in public.crm_leads in background (non-blocking)
    try {
      await supabaseServer.from("crm_leads").insert({
        name: bookingPayload.customer_name,
        email: bookingPayload.customer_email,
        phone: bookingPayload.customer_phone,
        source: "Consultation Intake (Paid)",
        interest: "1-on-1 Business Growth Consultation",
        notes: `Booking Code: ${bookingCode}, Date: ${bookingPayload.booking_date} at ${bookingPayload.booking_time}. Challenge: ${bookingPayload.primary_challenge}`,
        status: "New",
        amount: totalAmount,
        created_at: new Date().toISOString()
      });
    } catch (leadErr) {
      console.warn("[Consultation Fulfillment] CRM lead record notice:", leadErr?.message);
    }

    // Asynchronously dispatch confirmation email only after verified durable persistence
    (async () => {
      try {
        if (bookingPayload.customer_email) {
          await sendConsultationConfirmationEmail({
            to: bookingPayload.customer_email,
            customerName: bookingPayload.customer_name || "Valued Client",
            bookingCode: newBooking?.booking_code || bookingCode,
            bookingDate: newBooking?.booking_date || bookingPayload.booking_date,
            bookingTime: newBooking?.booking_time || bookingPayload.booking_time,
            durationMinutes,
            meetUrl: newBooking?.meet_url || meetUrl,
            primaryChallenge: bookingPayload.primary_challenge || "Business Growth Strategy",
            amount: totalAmount,
            currency,
            baseAmount,
            gstAmount,
            orderId: cleanOrderId,
            paymentId: cleanPaymentId
          });
        }
      } catch (mailErr) {
        console.warn("[Consultation Fulfillment] Notice dispatching consultation email:", mailErr?.message || mailErr);
      }
    })();

    return {
      success: true,
      fulfilled: true,
      already_fulfilled: false,
      booking: newBooking,
      payment: paymentRecord,
      orderId: cleanOrderId,
      paymentId: cleanPaymentId
    };
  } catch (err) {
    console.error("[Consultation Fulfillment] Unexpected error:", err);
    return {
      success: false,
      fulfilled: false,
      error: err?.message || "An unexpected error occurred during consultation fulfillment."
    };
  }
}

/**
 * Fulfills a verified resource purchase:
 * 1. Checks if a payment record with this razorpay_payment_id already exists in public.payments (idempotency check).
 * 2. Checks if a purchase with this razorpay_payment_id already exists in public.resource_purchases.
 * 3. If already fulfilled, returns the existing purchase and payment records without duplicating.
 * 4. Inserts a verified purchase record in public.resource_purchases.
 * 5. Inserts a payment ledger record in public.payments with item_type='resource'.
 * 6. Inserts a corresponding CRM Lead in public.leads.
 *
 * @param {object} params
 * @param {string|null} params.userId - UUID of authenticated student if signed in
 * @param {string} params.resourceId - Resource ID/UUID
 * @param {number} params.amount - Authoritative price in Rupees
 * @param {string} params.currency - Authoritative currency
 * @param {string} params.orderId - Razorpay order ID (e.g. 'order_...')
 * @param {string} params.paymentId - Razorpay payment ID (e.g. 'pay_...')
 * @param {string} [params.customerName] - Customer full name
 * @param {string} [params.customerEmail] - Customer email address
 * @param {string} [params.customerPhone] - Customer phone / WhatsApp
 * @param {string} [params.resourceTitle] - Resource title snapshot
 * @returns {Promise<{ success: boolean, fulfilled?: boolean, already_fulfilled?: boolean, purchase?: object, payment?: object, error?: string }>}
 */
export async function fulfillResourcePurchase({
  userId,
  resourceId,
  amount,
  currency,
  orderId,
  paymentId,
  customerName,
  customerEmail,
  customerPhone,
  resourceTitle
}) {
  try {
    // 0. Development safety check: prevent database mutations in non-production targeting prod
    const sideEffectCheck = assertSideEffectAllowed("database_mutation");
    if (!sideEffectCheck.allowed) {
      return {
        success: false,
        fulfilled: false,
        code: sideEffectCheck.code,
        error: `CRITICAL SAFETY VIOLATION: Resource fulfillment blocked in development: ${sideEffectCheck.reason}`
      };
    }

    const supabaseServer = getSupabaseServerClient();
    const cleanPaymentId = String(paymentId || "").trim();
    const cleanOrderId = String(orderId || "").trim();
    const cleanResourceId = String(resourceId || "").trim();
    const numericAmount = Number(amount) || 0;
    const finalCurrency = (currency || "INR").toUpperCase();

    // 1. Idempotency Check: Look for existing record with this razorpay_payment_id
    if (supabaseServer) {
      const { data: existingPurchase } = await supabaseServer
        .from("resource_purchases")
        .select("*")
        .eq("razorpay_payment_id", cleanPaymentId)
        .maybeSingle();

      const { data: existingPayment } = await supabaseServer
        .from("payments")
        .select("*")
        .eq("razorpay_payment_id", cleanPaymentId)
        .maybeSingle();

      if (existingPurchase || existingPayment) {
        console.log(`[Resource Fulfillment] Payment ${cleanPaymentId} already processed. Returning existing record without duplicate email.`);

        return {
          success: true,
          fulfilled: true,
          already_fulfilled: true,
          purchase: existingPurchase || null,
          payment: existingPayment || null,
          lead_status: "already_exists",
          orderId: cleanOrderId,
          paymentId: cleanPaymentId
        };
      }
    }

    // 2. Resolve user_id: If authenticated student, use userId; else search auth.users by email or auto-provision
    let resolvedUserId = isValidUUID(userId) ? userId : null;
    if (!resolvedUserId && customerEmail && supabaseServer) {
      try {
        const { data: usersData } = await supabaseServer.auth.admin.listUsers();
        const match = usersData?.users?.find(
          (u) => u.email?.toLowerCase() === customerEmail.trim().toLowerCase()
        );
        if (match?.id && isValidUUID(match.id)) {
          resolvedUserId = match.id;
        } else {
          // Provision authenticated account for buyer so their purchases are permanently bound to student dashboard
          const tempPassword = `DM_${Math.random().toString(36).slice(2, 10)}!${Date.now()}`;
          const { data: newUser, error: createErr } = await supabaseServer.auth.admin.createUser({
            email: customerEmail.trim().toLowerCase(),
            password: tempPassword,
            email_confirm: true,
            user_metadata: {
              full_name: customerName || "Student Member",
              phone: customerPhone || null
            }
          });
          if (!createErr && newUser?.user?.id) {
            resolvedUserId = newUser.user.id;
          } else {
            // If user already exists or creation failed, re-query user
            const { data: retryUsers } = await supabaseServer.auth.admin.listUsers();
            const retryMatch = retryUsers?.users?.find(
              (u) => u.email?.toLowerCase() === customerEmail.trim().toLowerCase()
            );
            if (retryMatch?.id && isValidUUID(retryMatch.id)) {
              resolvedUserId = retryMatch.id;
            }
          }
        }
      } catch (userErr) {
        console.warn("[Resource Fulfillment] Notice resolving student account:", userErr?.message);
      }
    }

    // 3. Insert purchase in public.resource_purchases (if table exists)
    let purchaseRecord = null;
    if (supabaseServer && isValidUUID(cleanResourceId)) {
      const purchasePayload = {
        user_id: resolvedUserId || null,
        customer_email: customerEmail ? customerEmail.trim().toLowerCase() : null,
        customer_phone: customerPhone || null,
        resource_id: cleanResourceId,
        razorpay_order_id: cleanOrderId,
        razorpay_payment_id: cleanPaymentId,
        amount: numericAmount,
        currency: finalCurrency,
        status: "active",
        purchased_at: new Date().toISOString()
      };

      try {
        const { data: newPurchase, error: purchaseError } = await supabaseServer
          .from("resource_purchases")
          .upsert(purchasePayload, { onConflict: "razorpay_payment_id" })
          .select()
          .maybeSingle();

        if (!purchaseError && newPurchase) {
          purchaseRecord = newPurchase;
        } else if (purchaseError && purchaseError.code !== "PGRST205") {
          console.warn("[Resource Fulfillment] Notice saving resource_purchases row:", purchaseError.message);
        }
      } catch (tableErr) {
        console.warn("[Resource Fulfillment] Notice table resource_purchases check:", tableErr?.message);
      }
    }

    // 4. Create payment ledger record in public.payments (authoritative ledger)
    let paymentRecord = null;
    if (supabaseServer && resolvedUserId) {
      const paymentPayload = {
        user_id: resolvedUserId,
        item_type: "resource",
        item_id: cleanResourceId,
        item_title: resourceTitle || "Digital Resource Toolkit",
        amount: numericAmount,
        currency: finalCurrency,
        razorpay_order_id: cleanOrderId,
        razorpay_payment_id: cleanPaymentId,
        status: "captured",
        created_at: new Date().toISOString()
      };

      try {
        const { data: newPayment, error: paymentError } = await supabaseServer
          .from("payments")
          .insert(paymentPayload)
          .select()
          .maybeSingle();

        if (!paymentError && newPayment) {
          paymentRecord = newPayment;
        } else if (paymentError) {
          console.warn("[Resource Fulfillment] Notice inserting payment ledger:", paymentError.message);
        }
      } catch (pErr) {
        console.warn("[Resource Fulfillment] Payments insert error:", pErr?.message);
      }
    }

    // 5. Record CRM Lead in public.crm_leads as Converted buyer (decoupled, idempotent with valid UUID)
    let leadStatus = "skipped";
    let leadId = null;

    if (supabaseServer && (customerEmail || customerName)) {
      try {
        const cleanEmail = (customerEmail || "").trim().toLowerCase();

        // Idempotency check: see if a lead was already registered with this payment ID
        const { data: existingLeads } = await supabaseServer
          .from("crm_leads")
          .select("id, status")
          .ilike("notes", `%${cleanPaymentId}%`)
          .limit(1);

        if (existingLeads && existingLeads.length > 0) {
          leadStatus = "already_exists";
          leadId = existingLeads[0].id;
        } else {
          const generatedLeadId = crypto.randomUUID();
          const { data: insertedLead, error: leadErr } = await supabaseServer
            .from("crm_leads")
            .insert({
              id: generatedLeadId,
              name: customerName || "Resource Buyer",
              email: cleanEmail,
              phone: customerPhone || null,
              source: "Resource Purchase (Paid)",
              interest: resourceTitle ? `Purchased: ${resourceTitle}` : `Resource ID: ${cleanResourceId}`,
              notes: `Paid ₹${numericAmount}. Order: ${cleanOrderId}, Payment: ${cleanPaymentId}`,
              status: "Converted",
              amount: numericAmount,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select()
            .maybeSingle();

          if (leadErr) {
            console.warn("[Resource Fulfillment] CRM lead record notice (fulfillment unaffected):", leadErr.message);
            leadStatus = "failed";
          } else {
            leadStatus = "saved";
            leadId = insertedLead?.id || generatedLeadId;
          }
        }
      } catch (leadErr) {
        console.warn("[Resource Fulfillment] CRM lead record error caught (fulfillment unaffected):", leadErr?.message);
        leadStatus = "failed";
      }
    }

    // Verify that at least one durable ledger record was persisted
    if (!paymentRecord && !purchaseRecord) {
      console.error("[Resource Fulfillment] Database transaction failed: Neither payments nor resource_purchases was persisted.");
      return {
        success: false,
        fulfilled: false,
        error: "Failed to persist purchase record to database ledger. Please retry payment verification.",
        code: "DATABASE_WRITE_FAILED"
      };
    }

    // Asynchronously dispatch resource delivery & receipt email
    (async () => {
      try {
        if (customerEmail) {
          await sendResourceDeliveryEmail({
            to: customerEmail,
            customerName: customerName || "Valued Customer",
            resourceTitle: resourceTitle || "Digital Resource Toolkit",
            resourceId: cleanResourceId,
            amount: numericAmount,
            currency: finalCurrency,
            orderId: cleanOrderId,
            paymentId: cleanPaymentId
          });
        }
      } catch (mailErr) {
        console.warn("[Resource Fulfillment] Notice dispatching resource email:", mailErr?.message || mailErr);
      }
    })();

    return {
      success: true,
      fulfilled: true,
      already_fulfilled: false,
      purchase: purchaseRecord || {
        id: `res_pur_${Date.now()}`,
        userId: resolvedUserId || "guest",
        resourceId: cleanResourceId,
        razorpayOrderId: cleanOrderId,
        razorpayPaymentId: cleanPaymentId,
        amount: numericAmount,
        currency: finalCurrency,
        status: "active",
        purchasedAt: new Date().toISOString()
      },
      payment: paymentRecord,
      lead_status: leadStatus,
      lead_id: leadId,
      resourceId: cleanResourceId,
      orderId: cleanOrderId,
      paymentId: cleanPaymentId,
      resolvedUserId
    };
  } catch (err) {
    console.error("[Resource Fulfillment] Unexpected error:", err);
    return {
      success: false,
      fulfilled: false,
      error: err?.message || "An unexpected error occurred during resource fulfillment."
    };
  }
}


