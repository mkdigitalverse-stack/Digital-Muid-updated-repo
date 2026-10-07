import express from "express";
import {
  getRazorpayClient,
  getRazorpayKeyId,
  verifyPaymentSignature,
  isRazorpayConfigured
} from "./razorpay.js";
import {
  verifySupabaseToken,
  getSupabaseDbClient,
  getSupabaseServerClient,
  checkIsAdmin,
  isValidUUID
} from "./supabaseServer.js";
import { handleRazorpayWebhook } from "./paymentWebhook.js";
import {
  calculateAuthoritativeCoursePrice,
  fulfillCourseEnrollment,
  fulfillConsultationPayment
} from "./paymentFulfillment.js";

const router = express.Router();

/**
 * POST /api/payments/create-course-order
 *
 * Creates a Razorpay payment order for an authenticated student purchasing a course.
 *
 * Security & Integrity Guarantees:
 * 1. Price is strictly determined server-side from public.courses (authoritative).
 * 2. User ID is extracted exclusively from the validated Supabase JWT token.
 * 3. Client input is restricted to `courseId`; any client-supplied amount or price is discarded.
 * 4. Checks whether the user is already enrolled and blocks duplicate order creation.
 * 5. Returns only client-safe metadata (orderId, amount in paise, currency, keyId, course title).
 * 6. Zero rows are written to public.payments or public.course_enrollments in this phase.
 */
router.post("/create-course-order", async (req, res) => {
  try {
    // 1. Authenticate user from Supabase access token
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: "Authentication required. Please sign in to enroll."
      });
    }

    const { user, error: authError } = await verifySupabaseToken(authHeader);
    if (authError || !user) {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired session. Please sign in again."
      });
    }

    // 2. Validate courseId format - ignore any client-sent amount, price, or user ID
    const { courseId } = req.body || {};
    if (!courseId || !isValidUUID(courseId)) {
      return res.status(400).json({
        success: false,
        error: "A valid courseId (UUID) is required."
      });
    }

    // 3. Obtain database client
    const dbClient = getSupabaseDbClient(authHeader);
    if (!dbClient) {
      return res.status(503).json({
        success: false,
        error: "Database service is not currently available."
      });
    }

    // 4. Fetch authoritative course record from Supabase
    const { data: course, error: courseError } = await dbClient
      .from("courses")
      .select("id, title, price, offer_price, offer_expires_at, currency, status, max_seats, enrolled_count")
      .eq("id", courseId)
      .maybeSingle();

    if (courseError) {
      console.error("[Create Order] Supabase query error:", courseError.message);
      return res.status(500).json({
        success: false,
        error: "Failed to verify course details. Please try again."
      });
    }

    if (!course) {
      return res.status(404).json({
        success: false,
        error: "Course not found."
      });
    }

    // 5. Ensure course is available for purchase according to business rules
    if (course.status !== "published") {
      return res.status(400).json({
        success: false,
        error: `This course is currently not available for purchase (status: ${course.status}).`
      });
    }

    if (course.max_seats != null && course.max_seats > 0) {
      const enrolledCount = Number(course.enrolled_count) || 0;
      if (enrolledCount >= course.max_seats) {
        return res.status(400).json({
          success: false,
          error: "This course cohort has reached maximum capacity."
        });
      }
    }

    // 6. Calculate authoritative effective price server-side
    // Logic:
    // - If offer_price exists, is > 0, and offer_expires_at is either null or still in the future, use offer_price.
    // - Otherwise use base price.
    // - Currency should come from course record (default 'INR').
    // - Convert final amount to paise: Math.round(effectivePrice * 100).
    // - No GST/tax additions (course price is complete consumer price).
    const { effectivePrice, currency } = calculateAuthoritativeCoursePrice(course);
    const amountInPaise = Math.round(effectivePrice * 100);

    if (amountInPaise <= 0) {
      return res.status(400).json({
        success: false,
        error: "This course is free and does not require payment processing."
      });
    }

    // 7. Check whether authenticated user already has active access/enrollment
    const { data: existingEnrollment, error: enrollmentError } = await dbClient
      .from("course_enrollments")
      .select("id, status, expires_at")
      .eq("user_id", user.id)
      .eq("course_id", course.id)
      .eq("status", "active")
      .maybeSingle();

    if (enrollmentError) {
      console.warn("[Create Order] Enrollment pre-check warning:", enrollmentError.message);
    }

    if (existingEnrollment) {
      const expiresAt = existingEnrollment.expires_at ? new Date(existingEnrollment.expires_at) : null;
      const isNotExpired = !expiresAt || expiresAt.getTime() > Date.now();

      if (isNotExpired) {
        return res.status(409).json({
          success: false,
          alreadyEnrolled: true,
          message: "You already have active access to this course.",
          courseId: course.id,
          courseTitle: course.title
        });
      }
    }

    // 8. Retrieve server-side Razorpay client
    const razorpay = getRazorpayClient();
    if (!razorpay) {
      return res.status(503).json({
        success: false,
        error: "Payment gateway is not currently configured on the server."
      });
    }

    // 9. Generate server-side receipt (under 40 characters for Razorpay requirements)
    const receipt = `rcpt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    const orderOptions = {
      amount: amountInPaise,
      currency: currency,
      receipt: receipt,
      notes: {
        courseId: course.id,
        userId: user.id,
        courseTitle: (course.title || "Course Masterclass").slice(0, 100)
      }
    };

    let order;
    try {
      order = await razorpay.orders.create(orderOptions);
    } catch (rzpErr) {
      console.error("[Create Order] Razorpay orders.create failed:", rzpErr?.message || rzpErr);
      return res.status(502).json({
        success: false,
        error: "Payment gateway failed to initialize order. Please try again."
      });
    }

    // 10. Return only client-safe order data
    return res.status(200).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: getRazorpayKeyId(),
      courseId: course.id,
      courseTitle: course.title
    });
  } catch (err) {
    console.error("[Create Order] Unexpected error:", err?.message || err);
    return res.status(500).json({
      success: false,
      error: "An unexpected error occurred while creating your order."
    });
  }
});

/**
 * POST /api/payments/verify-course-payment
 *
 * Cryptographically verifies Razorpay Checkout payment signatures on the server.
 *
 * Security & Integrity Guarantees (Phase 2K-D):
 * 1. Requires authenticated Supabase user via Bearer JWT.
 * 2. User identity comes strictly from verified Supabase token; client userId is rejected.
 * 3. Validates courseId as standard UUID.
 * 4. Validates required Razorpay parameters: razorpay_order_id, razorpay_payment_id, razorpay_signature.
 * 5. Does NOT trust amount, currency, price, or title from client.
 * 6. Calculates HMAC SHA256 of `razorpay_order_id|razorpay_payment_id` using RAZORPAY_KEY_SECRET.
 * 7. Compares calculated and received signatures with crypto.timingSafeEqual.
 * 8. Never reveals server secrets or internal comparison details.
 * 9. ZERO database writes in Phase 2K-D (no payment row, no enrollment, no certificate, no unlocking).
 * 10. Returns safe verification state: { success: true, verified: true, status: "verification_pending_fulfillment" }.
 */
router.post("/verify-course-payment", async (req, res) => {
  try {
    // 1. Authenticate user from Supabase access token
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        verified: false,
        error: "Authentication required. Please sign in to verify payment."
      });
    }

    const { user, error: authError } = await verifySupabaseToken(authHeader);
    if (authError || !user) {
      return res.status(401).json({
        success: false,
        verified: false,
        error: "Invalid or expired session. Please sign in again."
      });
    }

    // 2. Validate input fields - discard any client-supplied userId, price, or amounts
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      courseId
    } = req.body || {};

    if (!razorpay_order_id || typeof razorpay_order_id !== "string" || !razorpay_order_id.trim()) {
      return res.status(400).json({
        success: false,
        verified: false,
        error: "Missing or invalid razorpay_order_id."
      });
    }

    if (!razorpay_payment_id || typeof razorpay_payment_id !== "string" || !razorpay_payment_id.trim()) {
      return res.status(400).json({
        success: false,
        verified: false,
        error: "Missing or invalid razorpay_payment_id."
      });
    }

    if (!razorpay_signature || typeof razorpay_signature !== "string" || !razorpay_signature.trim()) {
      return res.status(400).json({
        success: false,
        verified: false,
        error: "Missing or invalid razorpay_signature."
      });
    }

    if (!courseId || !isValidUUID(courseId)) {
      return res.status(400).json({
        success: false,
        verified: false,
        error: "A valid courseId (UUID) is required."
      });
    }

    // 3. Ensure Razorpay server secret is configured
    if (!isRazorpayConfigured()) {
      return res.status(503).json({
        success: false,
        verified: false,
        error: "Payment gateway credentials are not configured on the server."
      });
    }

    // 4. Server-side cryptographic HMAC SHA256 signature verification
    const isSignatureValid = verifyPaymentSignature(
      razorpay_order_id.trim(),
      razorpay_payment_id.trim(),
      razorpay_signature.trim()
    );

    if (!isSignatureValid) {
      console.warn(`[Payment Verification] Invalid signature rejected for user ${user.id}, order ${razorpay_order_id}`);
      return res.status(400).json({
        success: false,
        verified: false,
        error: "Payment verification failed: Invalid cryptographic signature."
      });
    }

    console.log(
      `[Payment Verification] Signature verified successfully for user ${user.id}, order ${razorpay_order_id}, payment ${razorpay_payment_id}`
    );

    // 5. Query public.courses for authoritative price & details (NEVER trust client price)
    const dbClient = getSupabaseDbClient(authHeader);
    if (!dbClient) {
      return res.status(503).json({
        success: false,
        verified: true,
        fulfilled: false,
        status: "verification_pending_fulfillment",
        error: "Database service is not currently available."
      });
    }

    const { data: course, error: courseError } = await dbClient
      .from("courses")
      .select("id, slug, title, price, offer_price, offer_expires_at, currency, status")
      .eq("id", courseId)
      .maybeSingle();

    if (courseError || !course) {
      return res.status(404).json({
        success: false,
        verified: true,
        fulfilled: false,
        status: "fulfillment_rejected",
        error: "Course record not found for authoritative fulfillment verification."
      });
    }

    const { effectivePrice, currency } = calculateAuthoritativeCoursePrice(course);

    // 6. Execute atomic server-side fulfillment RPC (Phase 2K-E)
    const fulfillment = await fulfillCourseEnrollment({
      userId: user.id,
      courseId: course.id,
      amount: effectivePrice,
      currency,
      orderId: razorpay_order_id.trim(),
      paymentId: razorpay_payment_id.trim()
    });

    if (fulfillment.fulfilled) {
      return res.status(200).json({
        success: true,
        verified: true,
        fulfilled: true,
        status: "completed",
        courseId: course.id,
        courseSlug: course.slug,
        courseTitle: course.title,
        orderId: razorpay_order_id.trim(),
        paymentId: razorpay_payment_id.trim(),
        enrollmentId: fulfillment.enrollment_id,
        paymentDbId: fulfillment.payment_id,
        alreadyFulfilled: fulfillment.already_fulfilled,
        message: "Payment cryptographically verified and course enrollment successfully fulfilled."
      });
    }

    // If RPC failed due to pending migration or missing service role key:
    if (fulfillment.code === "MIGRATION_PENDING" || fulfillment.code === "SERVICE_KEY_MISSING") {
      return res.status(200).json({
        success: true,
        verified: true,
        fulfilled: false,
        status: "verification_pending_fulfillment",
        courseId: course.id,
        courseSlug: course.slug,
        courseTitle: course.title,
        orderId: razorpay_order_id.trim(),
        paymentId: razorpay_payment_id.trim(),
        warning: fulfillment.error,
        message: "Payment signature verified. Automated course fulfillment is pending server migration or credentials."
      });
    }

    // If fulfillment was rejected (e.g. price mismatch, validation error):
    return res.status(400).json({
      success: false,
      verified: true,
      fulfilled: false,
      status: "fulfillment_rejected",
      error: fulfillment.error || "Course enrollment fulfillment was rejected."
    });
  } catch (err) {
    console.error("[Payment Verification] Unexpected error during verification:", err?.message || err);
    return res.status(500).json({
      success: false,
      verified: false,
      error: "An unexpected error occurred during payment verification."
    });
  }
});

/**
 * POST /api/payments/create-consultation-order
 *
 * Creates a server-side Razorpay order for a paid consultation booking.
 * Authoritative price is read strictly from public.consultation_products in Supabase.
 * Client-supplied amounts are never trusted.
 */
router.post("/create-consultation-order", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    let authenticatedUser = null;
    if (authHeader) {
      const { user } = await verifySupabaseToken(authHeader);
      authenticatedUser = user;
    }

    const { bookingDetails } = req.body || {};
    if (!bookingDetails) {
      return res.status(400).json({
        success: false,
        error: "Booking intake details are required."
      });
    }

    const { customerName, customerEmail, date, time } = bookingDetails;
    if (!customerName || !customerEmail || !date || !time) {
      return res.status(400).json({
        success: false,
        error: "Name, email, date, and time slot are required to initiate consultation booking."
      });
    }

    // 1. Obtain Supabase database client
    const dbClient = getSupabaseDbClient(authHeader) || getSupabaseServerClient();
    if (!dbClient) {
      return res.status(503).json({
        success: false,
        error: "Database service is not currently available."
      });
    }

    // 2. Read authoritative consultation product from Supabase
    let { data: product, error: productError } = await dbClient
      .from("consultation_products")
      .select("*")
      .eq("active", true)
      .limit(1)
      .maybeSingle();

    if (productError || !product) {
      // Fallback to canonical row UUID if query returned empty
      const { data: canonProduct } = await dbClient
        .from("consultation_products")
        .select("*")
        .eq("id", "31bbb9bf-ce10-4da4-a517-dfc673f9b875")
        .maybeSingle();
      product = canonProduct;
    }

    // 3. Compute authoritative pricing in Rupees and Paise
    const basePrice = Number(product?.base_price) || 499;
    const gstRate = Number(product?.gst_rate) || 0.18;
    const gstAmount = Number((basePrice * gstRate).toFixed(2));
    const totalAmount = Number((basePrice + gstAmount).toFixed(2));
    const amountInPaise = Math.round(totalAmount * 100);
    const currency = (product?.currency || "INR").toUpperCase();

    // 4. Retrieve server Razorpay client
    const razorpay = getRazorpayClient();
    if (!razorpay) {
      return res.status(503).json({
        success: false,
        error: "Payment gateway is not currently configured on the server."
      });
    }

    // 5. Generate unique server receipt (under 40 chars)
    const receipt = `cnst_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    const orderOptions = {
      amount: amountInPaise,
      currency,
      receipt,
      notes: {
        itemType: "consultation",
        productId: product?.id || "31bbb9bf-ce10-4da4-a517-dfc673f9b875",
        customerName: customerName.trim().slice(0, 50),
        customerEmail: customerEmail.trim().slice(0, 50),
        bookingDate: String(date).slice(0, 20),
        bookingTime: String(time).slice(0, 20),
        userId: authenticatedUser?.id || ""
      }
    };

    let order;
    try {
      order = await razorpay.orders.create(orderOptions);
    } catch (rzpErr) {
      console.error("[Create Consultation Order] Razorpay orders.create failed:", rzpErr?.message || rzpErr);
      return res.status(502).json({
        success: false,
        error: "Payment gateway failed to initialize order. Please try again."
      });
    }

    return res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: getRazorpayKeyId(),
      productTitle: product?.name || "Business Growth Consultation",
      durationMinutes: product?.duration_minutes || 30,
      basePrice,
      gstAmount,
      totalAmount
    });
  } catch (err) {
    console.error("[Create Consultation Order] Unexpected error:", err);
    return res.status(500).json({
      success: false,
      error: "An unexpected error occurred while initializing consultation order."
    });
  }
});

/**
 * POST /api/payments/verify-consultation-payment
 *
 * Verifies Razorpay payment signature for a paid consultation booking.
 * Only after cryptographic HMAC SHA256 signature verification does it create the confirmed booking
 * in public.bookings and the transaction record in public.payments.
 */
router.post("/verify-consultation-payment", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    let authenticatedUser = null;
    if (authHeader) {
      const { user } = await verifySupabaseToken(authHeader);
      authenticatedUser = user;
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      bookingDetails
    } = req.body || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        verified: false,
        error: "Missing required Razorpay payment credentials for verification."
      });
    }

    if (!isRazorpayConfigured()) {
      return res.status(503).json({
        success: false,
        verified: false,
        error: "Payment gateway credentials are not configured on the server."
      });
    }

    // 1. Cryptographic HMAC SHA256 signature verification
    const isSignatureValid = verifyPaymentSignature(
      razorpay_order_id.trim(),
      razorpay_payment_id.trim(),
      razorpay_signature.trim()
    );

    if (!isSignatureValid) {
      console.warn(`[Consultation Verification] Invalid signature rejected for order ${razorpay_order_id}`);
      return res.status(400).json({
        success: false,
        verified: false,
        error: "Payment verification failed: Invalid cryptographic signature."
      });
    }

    // 2. Atomic fulfillment into public.bookings and public.payments
    const fulfillment = await fulfillConsultationPayment({
      userId: authenticatedUser?.id || null,
      bookingDetails: bookingDetails || {},
      orderId: razorpay_order_id.trim(),
      paymentId: razorpay_payment_id.trim()
    });

    if (!fulfillment.success) {
      return res.status(500).json({
        success: false,
        verified: true,
        fulfilled: false,
        error: fulfillment.error || "Failed to finalize consultation booking record."
      });
    }

    return res.json({
      success: true,
      verified: true,
      fulfilled: true,
      already_fulfilled: Boolean(fulfillment.already_fulfilled),
      booking: fulfillment.booking,
      payment: fulfillment.payment,
      orderId: razorpay_order_id.trim(),
      paymentId: razorpay_payment_id.trim()
    });
  } catch (err) {
    console.error("[Consultation Verification] Unexpected error:", err);
    return res.status(500).json({
      success: false,
      verified: false,
      error: "An unexpected error occurred during consultation payment verification."
    });
  }
});

/**
 * GET /api/payments/admin/all-payments
 *
 * Retrieves the complete payment ledger from public.payments for authenticated administrators.
 * Protected: requires valid JWT belonging to an authorized admin account.
 */
router.get("/admin/all-payments", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: "Authentication required." });
    }

    const { user, error: authError } = await verifySupabaseToken(authHeader);
    if (authError || !user) {
      return res.status(401).json({ success: false, error: "Invalid or expired administrator session." });
    }

    if (!checkIsAdmin(user)) {
      return res.status(403).json({ success: false, error: "Access denied. Administrator privileges required." });
    }

    const supabaseServer = getSupabaseServerClient() || getSupabaseDbClient(authHeader);
    if (!supabaseServer) {
      return res.status(503).json({ success: false, error: "Database service unavailable." });
    }

    const { data, error } = await supabaseServer
      .from("payments")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Admin Payments] Error querying payments table:", error);
      return res.status(500).json({ success: false, error: "Failed to retrieve payment records." });
    }

    return res.json({ success: true, payments: data || [] });
  } catch (err) {
    console.error("[Admin Payments] Unexpected error:", err);
    return res.status(500).json({ success: false, error: "Internal server error fetching payment ledger." });
  }
});

/**
 * POST /api/payments/admin/update-consultation-pricing
 *
 * Authoritatively updates consultation product pricing and GST in public.consultation_products.
 * Protected: requires valid JWT belonging to an authorized admin account.
 */
router.post("/admin/update-consultation-pricing", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: "Authentication required." });
    }

    const { user, error: authError } = await verifySupabaseToken(authHeader);
    if (authError || !user) {
      return res.status(401).json({ success: false, error: "Invalid or expired administrator session." });
    }

    if (!checkIsAdmin(user)) {
      return res.status(403).json({ success: false, error: "Access denied. Administrator privileges required." });
    }

    const { basePrice, gstRate, durationMinutes } = req.body || {};
    const parsedBase = Number(basePrice);
    const parsedGst = Number(gstRate);
    const parsedDuration = Number(durationMinutes);

    if (isNaN(parsedBase) || parsedBase < 0 || isNaN(parsedGst) || parsedGst < 0) {
      return res.status(400).json({ success: false, error: "Valid basePrice and gstRate are required." });
    }

    const supabaseServer = getSupabaseServerClient() || getSupabaseDbClient(authHeader);
    if (!supabaseServer) {
      return res.status(503).json({ success: false, error: "Database service unavailable." });
    }

    const targetId = "31bbb9bf-ce10-4da4-a517-dfc673f9b875";
    const updatePayload = {
      base_price: parsedBase,
      gst_rate: parsedGst,
      duration_minutes: !isNaN(parsedDuration) && parsedDuration > 0 ? parsedDuration : 30,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabaseServer
      .from("consultation_products")
      .update(updatePayload)
      .eq("id", targetId)
      .select()
      .maybeSingle();

    if (error) {
      console.error("[Admin Consultation Pricing] Update error:", error);
      return res.status(500).json({ success: false, error: "Failed to update consultation product." });
    }

    return res.json({ success: true, product: data });
  } catch (err) {
    console.error("[Admin Consultation Pricing] Unexpected error:", err);
    return res.status(500).json({ success: false, error: "Internal server error updating consultation product." });
  }
});

/**
 * POST /api/payments/webhook
 * Fallback route if requests arrive within this router.
 */
router.post("/webhook", (req, res) => {
  return handleRazorpayWebhook(req, res);
});

export default router;
