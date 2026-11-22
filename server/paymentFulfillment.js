import { getSupabaseServerClient, isValidUUID } from "./supabaseServer.js";
import {
  sendCourseAccessEmail,
  sendConsultationConfirmationEmail,
  sendResourceDeliveryEmail,
  hasAlreadySent
} from "./mailerService.js";
import { assertSideEffectAllowed } from "./developmentSafetyGate.js";

/**
 * Strictly converts a rupee amount into integer paise.
 * Rejects null/undefined/boolean/empty strings, non-finite values, zero/negative values,
 * sub-paise precision (> 2 decimal places), and unsafe integer overflow.
 *
 * @param {number|string|null|undefined} amount
 * @returns {number|null}
 */
export function toPaiseStrict(amount) {
  if (amount === null || amount === undefined || typeof amount === "boolean" || String(amount).trim() === "") {
    return null;
  }
  const num = Number(amount);
  if (!Number.isFinite(num) || num <= 0) {
    return null;
  }
  const scaled = num * 100;
  const rounded = Math.round(scaled);
  if (!Number.isSafeInteger(rounded) || rounded <= 0 || Math.abs(scaled - rounded) > 1e-6) {
    return null;
  }
  return rounded;
}

/**
 * Strictly classifies PostgreSQL / PostgREST RPC failures without conflating
 * missing-function migrations with overload ambiguity, transient unavailability,
 * or constraint violations.
 */
export function classifyRpcExecutionFailure(err, expectedRpcName, migrationHint, wasThrown = false) {
  const code = String(err?.code || "").trim();
  const msg = String(err?.message || err?.error?.description || "").trim();
  const status = Number(err?.status || err?.statusCode || 0);

  if (msg.startsWith(`Unknown RPC: ${expectedRpcName}`)) {
    return {
      success: false,
      fulfilled: false,
      retryable: true,
      code: "MIGRATION_PENDING",
      error: `Fulfillment RPC '${expectedRpcName}' does not exist in database. Migration ${migrationHint} must be applied.`
    };
  }

  if (code === "42883") {
    return {
      success: false,
      fulfilled: false,
      retryable: true,
      code: "MIGRATION_PENDING",
      error: `Fulfillment RPC '${expectedRpcName}' is missing (SQLSTATE 42883). Migration ${migrationHint} must be applied.`
    };
  }

  if (code === "PGRST202") {
    if (/candidate|ambiguous|overload/i.test(msg)) {
      return {
        success: false,
        fulfilled: false,
        retryable: false,
        code: "RPC_SCHEMA_ERROR",
        error: msg || `Ambiguous RPC overload schema error calling '${expectedRpcName}'.`
      };
    }
    return {
      success: false,
      fulfilled: false,
      retryable: true,
      code: "MIGRATION_PENDING",
      error: `Fulfillment RPC '${expectedRpcName}' is not present in schema cache (PGRST202). Migration ${migrationHint} must be applied.`
    };
  }

  const isTransientTransport =
    wasThrown ||
    status >= 500 ||
    /^(08|57P01|57P03|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN)/i.test(code) ||
    /fetch failed|network|timeout|timed out|econnrefused|econnreset|etimedout|socket hang up|service unavailable|bad gateway|gateway timeout/i.test(msg);

  if (isTransientTransport) {
    return {
      success: false,
      fulfilled: false,
      retryable: true,
      code: "RPC_UNAVAILABLE",
      error: msg || `Transient database/network unavailability calling '${expectedRpcName}'.`
    };
  }

  return {
    success: false,
    fulfilled: false,
    retryable: false,
    code: code || "RPC_ERROR",
    error: msg || `Database RPC execution failed for '${expectedRpcName}'.`
  };
}

// ==============================================================================
// AUTHORITATIVE PAID RESOURCES CATALOG & PRICING
// Guarantees authoritative fail-closed pricing even if DB schema cache lacks columns
// ==============================================================================
export const AUTHORITATIVE_PAID_RESOURCES = {
  // Bundle (All 4 tools)
  "2d50e5e3-711d-4461-a70d-0ed54dd29f17": { price: 299, accessType: "paid", currency: "INR" },
  "meta-ads-campaign-planner-bundle": { price: 299, accessType: "paid", currency: "INR" },
  // Deliverable 1: The Meta Ads Campaign Planner Workbook
  "27ef2c04-4d4a-4dbe-a702-d4013b2542b9": { price: 129, accessType: "paid", currency: "INR" },
  "meta-ads-campaign-planner-workbook": { price: 129, accessType: "paid", currency: "INR" },
  // Deliverable 2: Interactive Ad Budget & Break-Even Calculator
  "fafe5ffc-3323-4761-9d22-50a2588f6326": { price: 79, accessType: "paid", currency: "INR" },
  "the-ad-budget-breat-even-calculate": { price: 79, accessType: "paid", currency: "INR" },
  "the-ad-budget-break-even-calculator": { price: 79, accessType: "paid", currency: "INR" },
  // Deliverable 3: 10 High-Converting Meta Ads Copy Frameworks
  "004d374c-d872-4bfe-bf54-8083504e9174": { price: 79, accessType: "paid", currency: "INR" },
  "10-high-converting-meta-ads-copy-frameworks": { price: 79, accessType: "paid", currency: "INR" },
  // Deliverable 4: Pre-Launch & Tracking Audit Checklist
  "6867ecdd-2797-40f0-bdc8-ead20600ac6c": { price: 79, accessType: "paid", currency: "INR" },
  "pre-launch-tracking-audit-checklist": { price: 79, accessType: "paid", currency: "INR" }
};

/**
 * Strictly validates that a database price value represents primitive numeric zero (0, "0", "0.00").
 * Rejects non-primitive values (arrays, objects, boxed Number/String), null, undefined, booleans,
 * empty/whitespace strings, hex/scientific/signed strings, NaN, Infinity, negative, and positive values.
 */
export function isZeroPriceStrict(amount) {
  if (typeof amount === "number") {
    return Number.isFinite(amount) && amount === 0;
  }
  if (typeof amount === "string") {
    const trimmed = amount.trim();
    if (!trimmed || !/^0+(?:\.0+)?$/.test(trimmed)) {
      return false;
    }
    const num = Number(trimmed);
    return Number.isFinite(num) && num === 0;
  }
  return false;
}

export function getAuthoritativeResourcePricing(idOrSlug, resourceRecord = null) {
  const clean = String(idOrSlug || "").trim();
  const known = AUTHORITATIVE_PAID_RESOURCES[clean] ||
    (resourceRecord?.id && AUTHORITATIVE_PAID_RESOURCES[resourceRecord.id]) ||
    (resourceRecord?.slug && AUTHORITATIVE_PAID_RESOURCES[resourceRecord.slug]);

  if (!resourceRecord) {
    return {
      accessType: "unverified",
      price: 0,
      currency: "INR"
    };
  }

  const recordStatus = String(resourceRecord.status || "").trim().toLowerCase();
  if (recordStatus !== "published") {
    return {
      accessType: "unavailable",
      price: 0,
      currency: "INR"
    };
  }

  const dbAccessType = resourceRecord?.access_type ?? resourceRecord?.accessType;
  const normalizedDbAccessType = dbAccessType != null ? String(dbAccessType).trim().toLowerCase() : null;
  const rawDbPrice = resourceRecord?.price;
  const strictDbPaise = normalizedDbAccessType === "paid" ? toPaiseStrict(rawDbPrice) : null;

  if (normalizedDbAccessType === "paid") {
    if (!strictDbPaise) {
      return {
        accessType: "unverified",
        price: 0,
        currency: "INR"
      };
    }
    return {
      accessType: "paid",
      price: strictDbPaise / 100,
      currency: String(resourceRecord.currency || "INR").trim().toUpperCase()
    };
  }

  if (known) {
    return {
      accessType: "paid",
      price: known.price,
      currency: known.currency
    };
  }

  // Strictly require BOTH authoritative access_type === "free" AND explicit numeric price === 0.
  // Inconsistent records (e.g., access_type="free" with price > 0, null price, or missing access_type)
  // fail closed as "unverified" (C6-1).
  if (normalizedDbAccessType === "free" && isZeroPriceStrict(rawDbPrice)) {
    return {
      accessType: "free",
      price: 0,
      currency: String(resourceRecord?.currency || "INR").trim().toUpperCase()
    };
  }

  return {
    accessType: "unverified",
    price: 0,
    currency: "INR"
  };
}

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
  paymentId,
  studentEmail: directStudentEmail = null,
  studentName: directStudentName = null
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

    const strictAmountPaise = toPaiseStrict(amount);
    if (!strictAmountPaise) {
      return {
        success: false,
        fulfilled: false,
        retryable: false,
        error: "A valid positive numeric INR amount (max 2 decimals) is required for fulfillment.",
        code: "INVALID_AMOUNT"
      };
    }

    if (!currency || typeof currency !== "string") {
      return {
        success: false,
        fulfilled: false,
        retryable: false,
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
        retryable: true,
        error: "Server-side Supabase Service Role key is not configured.",
        code: "SERVICE_KEY_MISSING"
      };
    }

    // 3. Invoke atomic PostgreSQL RPC (fail closed on any RPC failure)
    let rpcResult;
    try {
      rpcResult = await supabaseServer.rpc("fulfill_course_enrollment", {
        p_user_id: userId.trim(),
        p_course_id: courseId.trim(),
        p_amount: strictAmountPaise / 100,
        p_currency: currency.trim().toUpperCase(),
        p_order_id: orderId.trim(),
        p_payment_id: paymentId.trim()
      });
    } catch (rpcCallErr) {
      const classified = classifyRpcExecutionFailure(
        rpcCallErr,
        "fulfill_course_enrollment",
        "20260921000001_atomic_course_payment_fulfillment.sql",
        true
      );
      console.error("[Payment Fulfillment] RPC fulfill_course_enrollment threw:", classified);
      return classified;
    }

    const { data, error } = rpcResult || {};

    if (error) {
      const classified = classifyRpcExecutionFailure(
        error,
        "fulfill_course_enrollment",
        "20260921000001_atomic_course_payment_fulfillment.sql",
        false
      );
      console.error("[Payment Fulfillment] RPC fulfill_course_enrollment error:", classified);
      return classified;
    }

    if (!data || typeof data !== "object" || data.success !== true) {
      console.warn("[Payment Fulfillment] RPC returned non-success result:", data);
      return {
        success: false,
        fulfilled: false,
        retryable: false,
        error: data?.error || "Fulfillment could not be completed.",
        code: data?.code || "FULFILLMENT_REJECTED"
      };
    }

    console.log(
      `[Payment Fulfillment] Success: payment_id=${data.payment_id}, enrollment_id=${data.enrollment_id}, user=${userId}, course=${courseId}, already_fulfilled=${data.already_fulfilled}`
    );

    // Asynchronously dispatch course access and authoritative PDF invoice email
    (async () => {
      try {
        const cleanPaymentId = paymentId.trim();
        // Check if already sent to prevent duplicate email dispatches
        if (await hasAlreadySent(cleanPaymentId, "course_access")) {
          console.log(`[Payment Fulfillment] Course confirmation email already sent for payment ${cleanPaymentId}, skipping.`);
          return;
        }

        let studentEmail = directStudentEmail && typeof directStudentEmail === "string" && directStudentEmail.includes("@")
          ? directStudentEmail.trim().toLowerCase()
          : null;
        let studentName = directStudentName && typeof directStudentName === "string" && directStudentName.trim()
          ? directStudentName.trim()
          : "Student Member";

        if (!studentEmail && supabaseServer) {
          const [userRes, profileRes] = await Promise.allSettled([
            supabaseServer.auth.admin.getUserById(userId),
            supabaseServer.from("profiles").select("full_name").eq("id", userId).maybeSingle()
          ]);

          if (userRes.status === "fulfilled" && userRes.value?.data?.user?.email) {
            studentEmail = userRes.value.data.user.email;
          }
          if (studentName === "Student Member") {
            if (profileRes.status === "fulfilled" && profileRes.value?.data?.full_name) {
              studentName = profileRes.value.data.full_name;
            } else if (userRes.status === "fulfilled" && userRes.value?.data?.user?.user_metadata?.full_name) {
              studentName = userRes.value.data.user.user_metadata.full_name;
            }
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
            paymentId: cleanPaymentId
          });
        } else {
          console.warn(`[Payment Fulfillment] Could not resolve student email for user ${userId}; course access email skipped.`);
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
      retryable: true,
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
        retryable: true,
        error: "Server-side Supabase Service Role client is not configured.",
        code: "SERVICE_KEY_MISSING"
      };
    }

    const cleanPaymentId = String(paymentId || "").trim();
    const cleanOrderId = String(orderId || "").trim();

    if (!cleanOrderId || !cleanPaymentId) {
      return {
        success: false,
        fulfilled: false,
        retryable: false,
        error: "Both orderId and paymentId are required for consultation fulfillment.",
        code: "MISSING_IDENTIFIERS"
      };
    }

    const hasExplicitProductId = productId !== undefined && productId !== null && String(productId).trim() !== "";
    if (hasExplicitProductId && !isValidUUID(String(productId).trim())) {
      return {
        success: false,
        fulfilled: false,
        retryable: false,
        error: "Invalid consultation product ID format.",
        code: "INVALID_PRODUCT_ID"
      };
    }

    const targetProductId = hasExplicitProductId
      ? String(productId).trim()
      : "31bbb9bf-ce10-4da4-a517-dfc673f9b875";

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
        retryable: false,
        error: `Consultation product (${targetProductId}) is inactive or not found. Fulfillment rejected.`,
        code: "PRODUCT_UNAVAILABLE"
      };
    }

    const basePaise = toPaiseStrict(product?.base_price);
    const gstRate = product?.gst_rate != null ? Number(product.gst_rate) : 0.18;
    if (!basePaise || !Number.isFinite(gstRate) || gstRate < 0 || gstRate > 1) {
      return {
        success: false,
        fulfilled: false,
        retryable: false,
        error: "Invalid consultation product pricing configuration. Fulfillment rejected.",
        code: "INVALID_PRODUCT_PRICING"
      };
    }

    const gstPaise = Math.round(basePaise * gstRate);
    const totalAmountInPaise = basePaise + gstPaise;
    if (!Number.isSafeInteger(gstPaise) || !Number.isSafeInteger(totalAmountInPaise) || totalAmountInPaise <= 0) {
      return {
        success: false,
        fulfilled: false,
        retryable: false,
        error: "Consultation pricing calculation overflow. Fulfillment rejected.",
        code: "INVALID_PRODUCT_PRICING"
      };
    }

    const baseAmount = basePaise / 100;
    const gstAmount = gstPaise / 100;
    const totalAmount = totalAmountInPaise / 100;
    const providedAmountInPaise = toPaiseStrict(amount);
    const effectiveCurrency = String(currency || product?.currency || "").trim().toUpperCase();

    if (!effectiveCurrency || effectiveCurrency !== "INR") {
      return {
        success: false,
        fulfilled: false,
        retryable: false,
        error: "Invalid or missing currency: Consultation transactions must be denominated in INR.",
        code: "INVALID_CURRENCY"
      };
    }

    if (!providedAmountInPaise || providedAmountInPaise !== totalAmountInPaise) {
      return {
        success: false,
        fulfilled: false,
        retryable: false,
        error: `Amount mismatch: payment amount (${amount}) does not equal authoritative consultation total (${totalAmount}).`,
        code: "AMOUNT_MISMATCH"
      };
    }

    const effectiveAmount = totalAmount;
    const durationMinutes = Number(product?.duration_minutes) || 30;

    // 2. Validate mandatory intake brief parameters before RPC execution
    const normalizedCustomerEmail = String(
      bookingDetails?.customerEmail || bookingDetails?.customer_email || ""
    ).trim().toLowerCase();
    const rawBookingDate = String(
      bookingDetails?.date || bookingDetails?.bookingDate || bookingDetails?.booking_date || ""
    ).trim();
    const normalizedBookingTime = String(
      bookingDetails?.time || bookingDetails?.bookingTime || bookingDetails?.booking_time || ""
    ).trim();
    const isValidBookingDate = Boolean(rawBookingDate) && !Number.isNaN(Date.parse(rawBookingDate));

    if (!normalizedCustomerEmail || !isValidBookingDate || !normalizedBookingTime) {
      return {
        success: false,
        fulfilled: false,
        retryable: false,
        error: "Missing or invalid required intake brief data: customerEmail, valid date, and time slot are mandatory.",
        code: "INVALID_INTAKE"
      };
    }

    // 3. Resolve user_id strictly from explicit authenticated user or matching profile
    let resolvedUserId = isValidUUID(userId) ? userId : null;
    if (!resolvedUserId && normalizedCustomerEmail) {
      try {
        const { data: profile } = await supabaseServer
          .from("profiles")
          .select("id")
          .eq("email", normalizedCustomerEmail)
          .maybeSingle();
        if (profile?.id && isValidUUID(profile.id)) {
          resolvedUserId = profile.id;
        }
      } catch {}
    }

    // 4. Prepare intake brief payload (NEVER embed order_total_amount client/gateway snapshot)
    const bookingCode = `DM-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const meetUrl = bookingDetails?.meetUrl || "PENDING_CALENDAR_PROVISIONING";

    const intakeDetails = {
      customerName: String(bookingDetails?.customerName || bookingDetails?.customer_name || "").trim(),
      customerEmail: normalizedCustomerEmail,
      customerPhone: String(bookingDetails?.customerPhone || bookingDetails?.customer_phone || "").trim(),
      businessName: String(bookingDetails?.businessName || bookingDetails?.business_name || "").trim(),
      primaryChallenge: String(bookingDetails?.primaryChallenge || bookingDetails?.primary_challenge || "").trim(),
      desiredOutcome: String(bookingDetails?.desiredOutcome || bookingDetails?.desired_outcome || "").trim(),
      website: bookingDetails?.website ? String(bookingDetails.website).trim() : null,
      linkedin: bookingDetails?.linkedin ? String(bookingDetails.linkedin).trim() : null,
      date: rawBookingDate,
      time: normalizedBookingTime,
      booking_code: bookingCode,
      meet_url: meetUrl
    };

    // 5. ATOMIC DATABASE TRANSACTION VIA RPC ONLY — FAIL CLOSED (NO JS DUAL-WRITE FALLBACK)
    let rpcResult;
    try {
      rpcResult = await supabaseServer.rpc("fulfill_consultation_payment", {
        p_user_id: resolvedUserId,
        p_order_id: cleanOrderId,
        p_payment_id: cleanPaymentId,
        p_amount: effectiveAmount,
        p_currency: effectiveCurrency,
        p_booking_details: intakeDetails,
        p_product_id: product.id
      });
    } catch (rpcCallErr) {
      const classified = classifyRpcExecutionFailure(
        rpcCallErr,
        "fulfill_consultation_payment",
        "20261116000001_harden_consultation_rpc_amount_validation.sql",
        true
      );
      console.error("[Consultation Fulfillment] Atomic RPC threw (failing closed):", classified);
      return classified;
    }

    const { data: rpcData, error: rpcErr } = rpcResult || {};

    if (rpcErr) {
      const classified = classifyRpcExecutionFailure(
        rpcErr,
        "fulfill_consultation_payment",
        "20261116000001_harden_consultation_rpc_amount_validation.sql",
        false
      );
      console.error("[Consultation Fulfillment] Atomic RPC failed (failing closed):", classified);
      return classified;
    }

    if (!rpcData || typeof rpcData !== "object" || rpcData.success !== true) {
      console.error("[Consultation Fulfillment] Atomic RPC rejected fulfillment:", rpcData?.error);
      return {
        success: false,
        fulfilled: false,
        retryable: false,
        code: rpcData?.code || "FULFILLMENT_REJECTED",
        error: rpcData?.error || "Payment fulfillment rejected by database transaction guard."
      };
    }

    // Dispatches confirmation email if not already sent, even if booking was previously recorded
    (async () => {
      try {
        if (await hasAlreadySent(cleanPaymentId, "consultation_confirmation")) {
          console.log(`[Consultation Fulfillment] Consultation confirmation already sent for ${cleanPaymentId}, skipping.`);
          return;
        }

        if (intakeDetails.customerEmail) {
          await sendConsultationConfirmationEmail({
            to: intakeDetails.customerEmail,
            customerName: intakeDetails.customerName || "Valued Client",
            bookingCode: rpcData.booking?.booking_code || bookingCode,
            bookingDate: rpcData.booking?.booking_date || intakeDetails.date,
            bookingTime: rpcData.booking?.booking_time || intakeDetails.time,
            durationMinutes,
            meetUrl: rpcData.booking?.meeting_link || rpcData.booking?.meet_url || meetUrl,
            primaryChallenge: intakeDetails.primaryChallenge || "Business Growth Strategy",
            amount: totalAmount,
            currency: effectiveCurrency,
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
      already_fulfilled: Boolean(rpcData.already_fulfilled),
      healed_ledger: Boolean(rpcData.healed_ledger),
      healed_booking: Boolean(rpcData.healed_booking),
      slot_conflict: Boolean(rpcData.slot_conflict),
      booking: rpcData.booking,
      payment: rpcData.payment,
      orderId: cleanOrderId,
      paymentId: cleanPaymentId
    };
  } catch (err) {
    console.error("[Consultation Fulfillment] Unexpected error:", err);
    return {
      success: false,
      fulfilled: false,
      retryable: true,
      code: "UNEXPECTED_ERROR",
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
    if (!supabaseServer) {
      return {
        success: false,
        fulfilled: false,
        retryable: true,
        code: "SERVICE_KEY_MISSING",
        error: "Server-side Supabase Service Role key is not configured."
      };
    }

    const cleanPaymentId = String(paymentId || "").trim();
    const cleanOrderId = String(orderId || "").trim();
    const cleanResourceId = String(resourceId || "").trim();
    const finalCurrency = String(currency || "").trim().toUpperCase();

    if (!cleanOrderId || !cleanPaymentId || !cleanResourceId) {
      return {
        success: false,
        fulfilled: false,
        retryable: false,
        code: "INVALID_PARAMETERS",
        error: "Valid orderId, paymentId, and resourceId are required for resource fulfillment."
      };
    }

    if (finalCurrency !== "INR") {
      return {
        success: false,
        fulfilled: false,
        retryable: false,
        code: "INVALID_CURRENCY",
        error: `Unsupported currency '${finalCurrency || "missing"}'. Only INR resource payments are accepted.`
      };
    }

    const providedAmountInPaise = toPaiseStrict(amount);
    if (!providedAmountInPaise) {
      return {
        success: false,
        fulfilled: false,
        retryable: false,
        code: "INVALID_AMOUNT",
        error: "A positive INR payment amount (max 2 decimals) is required for resource fulfillment."
      };
    }

    const hasExplicitUserId = userId !== undefined && userId !== null && String(userId).trim() !== "";
    if (hasExplicitUserId && !isValidUUID(String(userId).trim())) {
      return {
        success: false,
        fulfilled: false,
        retryable: false,
        code: "INVALID_USER_ID",
        error: "Invalid userId UUID format."
      };
    }
    const providedUserId = hasExplicitUserId ? String(userId).trim() : null;

    // 1. Authoritative resource catalog, published status, and pricing verification
    const resourceQuery = supabaseServer.from("resources").select("*");
    const { data: resourceRecord, error: resourceError } = isValidUUID(cleanResourceId)
      ? await resourceQuery.eq("id", cleanResourceId).maybeSingle()
      : await resourceQuery.eq("slug", cleanResourceId).maybeSingle();

    if (resourceError) {
      return {
        success: false,
        fulfilled: false,
        retryable: true,
        code: "DATABASE_ERROR",
        error: resourceError.message || "Failed to query authoritative resource catalog record."
      };
    }

    if (!resourceRecord) {
      return {
        success: false,
        fulfilled: false,
        code: "RESOURCE_NOT_FOUND",
        error: "Resource record was not found in authoritative catalog."
      };
    }

    if (String(resourceRecord.status || "").trim().toLowerCase() !== "published") {
      return {
        success: false,
        fulfilled: false,
        code: "RESOURCE_UNAVAILABLE",
        error: "Resource is not published and cannot be fulfilled."
      };
    }

    const canonicalResourceId = String(resourceRecord.id || "").trim();
    if (!isValidUUID(canonicalResourceId)) {
      return {
        success: false,
        fulfilled: false,
        code: "INVALID_RESOURCE_ID",
        error: "Authoritative resource record does not contain a valid UUID."
      };
    }

    const pricing = getAuthoritativeResourcePricing(canonicalResourceId, resourceRecord);
    const authoritativeAmountInPaise = toPaiseStrict(pricing.price);
    if (
      pricing.accessType !== "paid" ||
      !authoritativeAmountInPaise ||
      String(pricing.currency || "").toUpperCase() !== "INR"
    ) {
      return {
        success: false,
        fulfilled: false,
        code: "INVALID_RESOURCE_PRICING",
        error: "Resource is not configured as an active paid INR product."
      };
    }

    const authoritativeAmount = authoritativeAmountInPaise / 100;
    if (providedAmountInPaise !== authoritativeAmountInPaise) {
      return {
        success: false,
        fulfilled: false,
        code: "AMOUNT_MISMATCH",
        error: `Amount mismatch: expected ₹${authoritativeAmount} INR (${authoritativeAmountInPaise} paise), received ${providedAmountInPaise} paise.`
      };
    }

    const effectiveResourceTitle = resourceTitle || resourceRecord.title || resourceRecord.name || "Digital Resource Toolkit";
    const resolvedUserId = providedUserId; // Never mutate guest user_id: null into arbitrary auth users during fulfillment

    const normalizedCustomerEmail = customerEmail ? String(customerEmail).trim().toLowerCase() : null;
    const cleanedCustomerName = customerName ? String(customerName).trim() : null;
    const cleanedCustomerPhone = customerPhone ? String(customerPhone).trim() : null;

    const dispatchResourceDeliveryEmail = (targetPurchase, targetPayment) => {
      (async () => {
        try {
          if (await hasAlreadySent(cleanPaymentId, "resource_delivery")) {
            console.log(`[Resource Fulfillment] Delivery email already sent for ${cleanPaymentId}, skipping.`);
            return;
          }
          const toEmail = normalizedCustomerEmail || targetPurchase?.customer_email || null;
          const toPhone = cleanedCustomerPhone || targetPurchase?.customer_phone || "";
          const effectiveUserId = resolvedUserId || targetPurchase?.user_id || targetPayment?.user_id || null;
          if (toEmail) {
            await sendResourceDeliveryEmail({
              to: toEmail,
              customerName: cleanedCustomerName || targetPurchase?.customer_name || "Valued Customer",
              customerPhone: toPhone,
              resourceTitle: targetPayment?.item_title || effectiveResourceTitle,
              resourceId: canonicalResourceId,
              resourceSlug: resourceRecord?.slug || null,
              userId: effectiveUserId,
              isGuest: !effectiveUserId,
              amount: authoritativeAmount,
              currency: "INR",
              orderId: cleanOrderId,
              paymentId: cleanPaymentId
            });
          }
        } catch (mailErr) {
          console.warn("[Resource Fulfillment] Notice dispatching resource email:", mailErr?.message || mailErr);
        }
      })();
    };

    // 2. Atomic PostgreSQL RPC execution ONLY — FAIL CLOSED (NO JS DUAL-WRITE FALLBACK)
    let rpcResult;
    try {
      rpcResult = await supabaseServer.rpc("fulfill_resource_purchase", {
        p_user_id: resolvedUserId,
        p_resource_id: canonicalResourceId,
        p_amount: authoritativeAmount,
        p_currency: "INR",
        p_order_id: cleanOrderId,
        p_payment_id: cleanPaymentId,
        p_customer_name: cleanedCustomerName,
        p_customer_email: normalizedCustomerEmail,
        p_customer_phone: cleanedCustomerPhone,
        p_resource_title: effectiveResourceTitle
      });
    } catch (rpcCallErr) {
      const classified = classifyRpcExecutionFailure(
        rpcCallErr,
        "fulfill_resource_purchase",
        "20261116000003_atomic_resource_payment_fulfillment.sql",
        true
      );
      console.error("[Resource Fulfillment] Atomic RPC threw (failing closed):", classified);
      return classified;
    }

    const { data: rpcData, error: rpcErr } = rpcResult || {};

    if (rpcErr) {
      const classified = classifyRpcExecutionFailure(
        rpcErr,
        "fulfill_resource_purchase",
        "20261116000003_atomic_resource_payment_fulfillment.sql",
        false
      );
      console.error("[Resource Fulfillment] Atomic RPC failed (failing closed):", classified);
      return classified;
    }

    if (!rpcData || typeof rpcData !== "object" || rpcData.success !== true) {
      console.error("[Resource Fulfillment] Atomic RPC rejected fulfillment:", rpcData?.error);
      return {
        success: false,
        fulfilled: false,
        retryable: false,
        code: rpcData?.code || "FULFILLMENT_REJECTED",
        error: rpcData?.error || "Resource purchase fulfillment rejected by database transaction guard."
      };
    }

    dispatchResourceDeliveryEmail(rpcData.purchase, rpcData.payment);
    return {
      success: true,
      fulfilled: true,
      already_fulfilled: Boolean(rpcData.already_fulfilled),
      healed_ledger: Boolean(rpcData.healed_ledger),
      healed_purchase: Boolean(rpcData.healed_purchase),
      purchase: rpcData.purchase || null,
      payment: rpcData.payment || null,
      lead_status: rpcData.lead_status || (rpcData.already_fulfilled ? "already_exists" : "saved"),
      lead_id: rpcData.lead_id || null,
      resourceId: canonicalResourceId,
      orderId: cleanOrderId,
      paymentId: cleanPaymentId,
      resolvedUserId
    };
  } catch (err) {
    console.error("[Resource Fulfillment] Unexpected error:", err);
    return {
      success: false,
      fulfilled: false,
      retryable: true,
      code: "UNEXPECTED_ERROR",
      error: err?.message || "An unexpected error occurred during resource fulfillment."
    };
  }
}


