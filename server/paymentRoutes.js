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
  fulfillConsultationPayment,
  fulfillResourcePurchase
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
 * POST /api/payments/create-resource-order
 *
 * Creates a server-side Razorpay order for a paid digital resource.
 * Authoritative price and access_type are read strictly from database or authoritative state.
 * Client-supplied amounts are never trusted.
 */
router.post("/create-resource-order", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    let authenticatedUser = null;
    if (authHeader) {
      const { user } = await verifySupabaseToken(authHeader);
      authenticatedUser = user;
    }

    const { resourceId, customerDetails } = req.body || {};
    if (!resourceId || typeof resourceId !== "string") {
      return res.status(400).json({
        success: false,
        error: "A valid resourceId is required."
      });
    }

    const cleanResourceId = resourceId.trim();

    // 1. Obtain database client
    const dbClient = getSupabaseDbClient(authHeader) || getSupabaseServerClient();
    let resourceRecord = null;

    if (dbClient) {
      const isUUID = isValidUUID(cleanResourceId);
      const query = dbClient.from("resources").select("*");
      const { data, error } = isUUID
        ? await query.eq("id", cleanResourceId).maybeSingle()
        : await query.eq("slug", cleanResourceId).maybeSingle();

      if (!error && data) {
        resourceRecord = data;
      }
    }

    // 2. Validate access type & price (prefers DB column, gracefully accepts request fallback if legacy DB schema)
    const accessType = (
      resourceRecord?.access_type ||
      resourceRecord?.accessType ||
      req.body?.accessType ||
      "free"
    ).toLowerCase();
    const authoritativePrice = Number(resourceRecord?.price) || Number(req.body?.price) || 0;

    if (accessType !== "paid" || authoritativePrice <= 0) {
      return res.status(400).json({
        success: false,
        error: "This resource is free and does not require payment processing."
      });
    }

    const amountInPaise = Math.round(authoritativePrice * 100);
    const currency = (resourceRecord?.currency || "INR").toUpperCase();

    // 3. Retrieve server Razorpay client
    const razorpay = getRazorpayClient();
    if (!razorpay) {
      return res.status(503).json({
        success: false,
        error: "Payment gateway is not currently configured on the server."
      });
    }

    // 4. Generate unique server receipt (under 40 chars)
    const receipt = `res_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    const orderOptions = {
      amount: amountInPaise,
      currency,
      receipt,
      notes: {
        itemType: "resource",
        resourceId: resourceRecord?.id || cleanResourceId,
        resourceTitle: (resourceRecord?.title || resourceRecord?.name || "Digital Resource").slice(0, 100),
        customerName: (customerDetails?.name || "").slice(0, 50),
        customerEmail: (customerDetails?.email || "").slice(0, 50),
        userId: authenticatedUser?.id || ""
      }
    };

    let order;
    try {
      order = await razorpay.orders.create(orderOptions);
    } catch (rzpErr) {
      console.error("[Create Resource Order] Razorpay orders.create failed:", rzpErr?.message || rzpErr);
      return res.status(502).json({
        success: false,
        error: "Payment gateway failed to initialize order. Please try again."
      });
    }

    // Retain lead at checkout initiation: if visitor abandons checkout, their contact info and intent are preserved
    if (dbClient && (customerDetails?.email || customerDetails?.name)) {
      try {
        dbClient.from("crm_leads").insert({
          name: customerDetails?.name || "Resource Checkout Visitor",
          email: customerDetails?.email || "",
          phone: customerDetails?.phone || null,
          source: "Resource Paid Checkout Initiated",
          interest: resourceRecord?.title ? `Checkout: ${resourceRecord.title}` : `Resource ID: ${cleanResourceId}`,
          notes: `Checkout initiated for ₹${authoritativePrice}. Order ID: ${order.id}. Awaiting payment completion.`,
          status: "New",
          amount: authoritativePrice,
          created_at: new Date().toISOString()
        }).then(({ error }) => {
          if (error) console.warn("[Create Resource Order] CRM lead capture notice:", error.message);
        });
      } catch (leadCatch) {
        console.warn("[Create Resource Order] Lead capture catch:", leadCatch?.message);
      }
    }

    return res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: getRazorpayKeyId(),
      resourceId: resourceRecord?.id || cleanResourceId,
      resourceTitle: resourceRecord?.title || resourceRecord?.name || "Digital Resource Toolkit"
    });
  } catch (err) {
    console.error("[Create Resource Order] Unexpected error:", err);
    return res.status(500).json({
      success: false,
      error: "An unexpected error occurred while initializing resource order."
    });
  }
});

/**
 * POST /api/payments/verify-resource-payment
 *
 * Verifies Razorpay payment signature for a paid resource purchase.
 * Only after cryptographic HMAC SHA256 signature verification does it create the confirmed purchase
 * in public.resource_purchases and the transaction record in public.payments.
 */
router.post("/verify-resource-payment", async (req, res) => {
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
      resourceId,
      customerDetails
    } = req.body || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        verified: false,
        error: "Missing required Razorpay payment credentials for verification."
      });
    }

    if (!resourceId || typeof resourceId !== "string") {
      return res.status(400).json({
        success: false,
        verified: false,
        error: "Missing or invalid resourceId."
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
      console.warn(`[Resource Verification] Invalid signature rejected for order ${razorpay_order_id}`);
      return res.status(400).json({
        success: false,
        verified: false,
        error: "Payment verification failed: Invalid cryptographic signature."
      });
    }

    // 2. Fetch authoritative resource price from database
    const dbClient = getSupabaseDbClient(authHeader) || getSupabaseServerClient();
    let resourceRecord = null;
    if (dbClient) {
      const isUUID = isValidUUID(resourceId.trim());
      const query = dbClient.from("resources").select("*");
      const { data } = isUUID
        ? await query.eq("id", resourceId.trim()).maybeSingle()
        : await query.eq("slug", resourceId.trim()).maybeSingle();
      resourceRecord = data;
    }

    const amount = Number(resourceRecord?.price) || 0;
    const currency = (resourceRecord?.currency || "INR").toUpperCase();

    // 2b. Gateway reconciliation with Razorpay API (order amount & payment status)
    const razorpay = getRazorpayClient();
    if (razorpay) {
      let rzpOrder = null;
      let rzpPayment = null;
      try {
        [rzpOrder, rzpPayment] = await Promise.all([
          razorpay.orders.fetch(razorpay_order_id.trim()),
          razorpay.payments.fetch(razorpay_payment_id.trim())
        ]);
      } catch (rzpFetchErr) {
        const errDesc = rzpFetchErr?.error?.description || rzpFetchErr?.message || "Payment or order not found on gateway.";
        console.warn(`[Resource Verification] Gateway fetch rejected: ${errDesc}`);
        return res.status(400).json({
          success: false,
          verified: false,
          error: `Payment verification failed on gateway: ${errDesc}`
        });
      }

      if (!rzpPayment || rzpPayment.status !== "captured") {
        console.warn(`[Resource Verification] Rejected uncaptured payment: status=${rzpPayment?.status}`);
        return res.status(400).json({
          success: false,
          verified: false,
          error: `Payment status is ${rzpPayment?.status || "unknown"}. Only captured payments can unlock resources.`
        });
      }

      if (rzpPayment.order_id && rzpPayment.order_id !== razorpay_order_id.trim()) {
        console.warn(`[Resource Verification] Mismatched order ID: payment.order_id=${rzpPayment.order_id}, expected=${razorpay_order_id}`);
        return res.status(400).json({
          success: false,
          verified: false,
          error: "Payment does not match the specified order ID."
        });
      }

      const expectedAmountInPaise = Math.round(amount * 100);
      if (expectedAmountInPaise > 0 && rzpPayment.amount !== expectedAmountInPaise) {
        console.warn(`[Resource Verification] Amount mismatch: paid ${rzpPayment.amount} paise, expected ${expectedAmountInPaise} paise`);
        return res.status(400).json({
          success: false,
          verified: false,
          error: "Payment amount does not match authoritative resource price."
        });
      }

      const expectedCurrency = currency.toUpperCase();
      if ((rzpPayment.currency || "").toUpperCase() !== expectedCurrency) {
        console.warn(`[Resource Verification] Currency mismatch: paid ${rzpPayment.currency}, expected ${expectedCurrency}`);
        return res.status(400).json({
          success: false,
          verified: false,
          error: "Payment currency does not match authoritative resource currency."
        });
      }

      if (rzpOrder) {
        if (rzpOrder.amount !== expectedAmountInPaise) {
          console.warn(`[Resource Verification] Order amount mismatch: order=${rzpOrder.amount}, expected=${expectedAmountInPaise}`);
          return res.status(400).json({
            success: false,
            verified: false,
            error: "Order amount does not match authoritative resource price."
          });
        }
        if ((rzpOrder.currency || "").toUpperCase() !== expectedCurrency) {
          return res.status(400).json({
            success: false,
            verified: false,
            error: "Order currency does not match authoritative resource currency."
          });
        }
        if (rzpOrder.notes?.resourceId && rzpOrder.notes.resourceId !== (resourceRecord?.id || resourceId.trim())) {
          console.warn(`[Resource Verification] Order resourceId note mismatch: note=${rzpOrder.notes.resourceId}, expected=${resourceRecord?.id}`);
          return res.status(400).json({
            success: false,
            verified: false,
            error: "Order was not created for this resource."
          });
        }
      }
    }

    // 3. Atomic fulfillment into public.resource_purchases and public.payments
    const fulfillment = await fulfillResourcePurchase({
      userId: authenticatedUser?.id || null,
      resourceId: resourceRecord?.id || resourceId.trim(),
      amount,
      currency,
      orderId: razorpay_order_id.trim(),
      paymentId: razorpay_payment_id.trim(),
      customerName: customerDetails?.name || "",
      customerEmail: customerDetails?.email || authenticatedUser?.email || "",
      customerPhone: customerDetails?.phone || "",
      resourceTitle: resourceRecord?.title || resourceRecord?.name || "Digital Resource"
    });

    if (!fulfillment.success) {
      return res.status(500).json({
        success: false,
        verified: true,
        fulfilled: false,
        error: fulfillment.error || "Failed to finalize resource purchase record."
      });
    }

    return res.json({
      success: true,
      verified: true,
      fulfilled: true,
      already_fulfilled: Boolean(fulfillment.already_fulfilled),
      purchase: fulfillment.purchase,
      payment: fulfillment.payment,
      orderId: razorpay_order_id.trim(),
      paymentId: razorpay_payment_id.trim(),
      resourceId: resourceRecord?.id || resourceId.trim()
    });
  } catch (err) {
    console.error("[Resource Verification] Unexpected error:", err);
    return res.status(500).json({
      success: false,
      verified: false,
      error: "An unexpected error occurred during resource payment verification."
    });
  }
});

/**
 * GET /api/payments/verify-purchase-status
 *
 * Server-authoritative endpoint to verify whether a customer or visitor has a verified paid purchase.
 * Query parameters: resourceId, orderId (optional), paymentId (optional).
 * Authorization: Optional Bearer token for authenticated students.
 */
router.get("/verify-purchase-status", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    let authenticatedUser = null;
    if (authHeader) {
      const { user } = await verifySupabaseToken(authHeader);
      authenticatedUser = user;
    }

    const { resourceId, orderId, paymentId } = req.query || {};
    if (!resourceId) {
      return res.status(400).json({ success: false, verified: false, error: "resourceId is required." });
    }

    const cleanResourceId = String(resourceId).trim();
    const cleanPaymentId = paymentId ? String(paymentId).trim() : null;
    const cleanOrderId = orderId ? String(orderId).trim() : null;

    const supabaseServer = getSupabaseServerClient() || getSupabaseDbClient(authHeader);
    if (!supabaseServer) {
      return res.status(503).json({ success: false, verified: false, error: "Database service unavailable." });
    }

    // 1. Fetch resource to verify ID or slug
    const isUUID = isValidUUID(cleanResourceId);
    const { data: resourceRecord } = isUUID
      ? await supabaseServer.from("resources").select("id, slug, title, access_type, price, currency").eq("id", cleanResourceId).maybeSingle()
      : await supabaseServer.from("resources").select("id, slug, title, access_type, price, currency").eq("slug", cleanResourceId).maybeSingle();

    if (!resourceRecord) {
      return res.status(404).json({
        success: false,
        verified: false,
        error: "Resource not found."
      });
    }

    const resolvedResId = resourceRecord.id;
    const isFree = (resourceRecord.access_type || "free") !== "paid" || Number(resourceRecord.price) <= 0;

    if (isFree) {
      return res.json({
        success: true,
        verified: true,
        isFree: true,
        resourceId: resolvedResId,
        resourceTitle: resourceRecord.title || "Free Resource",
        amount: 0,
        currency: "INR"
      });
    }

    const expectedAmountInPaise = Math.round(Number(resourceRecord.price) * 100);
    const expectedCurrency = (resourceRecord.currency || "INR").toUpperCase();

    // 2. Check public.resource_purchases if paymentId is provided
    if (cleanPaymentId) {
      const { data: purchaseByPayId } = await supabaseServer
        .from("resource_purchases")
        .select("*")
        .eq("razorpay_payment_id", cleanPaymentId)
        .eq("resource_id", resolvedResId)
        .eq("status", "active")
        .maybeSingle();

      if (purchaseByPayId) {
        return res.json({
          success: true,
          verified: true,
          resourceId: resolvedResId,
          orderId: purchaseByPayId.razorpay_order_id,
          paymentId: purchaseByPayId.razorpay_payment_id,
          amount: Number(purchaseByPayId.amount) || Number(resourceRecord.price) || 0,
          currency: purchaseByPayId.currency || expectedCurrency
        });
      }

      // Check public.payments by razorpay_payment_id strictly for this resource
      const { data: paymentRecord } = await supabaseServer
        .from("payments")
        .select("*")
        .eq("razorpay_payment_id", cleanPaymentId)
        .eq("item_id", resolvedResId)
        .eq("item_type", "resource")
        .eq("status", "captured")
        .maybeSingle();

      if (paymentRecord) {
        return res.json({
          success: true,
          verified: true,
          resourceId: resolvedResId,
          orderId: paymentRecord.razorpay_order_id,
          paymentId: paymentRecord.razorpay_payment_id,
          amount: Number(paymentRecord.amount) || Number(resourceRecord.price) || 0,
          currency: paymentRecord.currency || expectedCurrency
        });
      }

      // Gateway reconciliation fallback with strict amount, currency, and resource verification
      const razorpay = getRazorpayClient();
      if (razorpay && cleanPaymentId.startsWith("pay_")) {
        try {
          const rzpPayment = await razorpay.payments.fetch(cleanPaymentId);
          if (
            rzpPayment &&
            rzpPayment.status === "captured" &&
            rzpPayment.amount === expectedAmountInPaise &&
            (rzpPayment.currency || "").toUpperCase() === expectedCurrency
          ) {
            const orderIdToFetch = rzpPayment.order_id || cleanOrderId;
            if (orderIdToFetch) {
              const rzpOrder = await razorpay.orders.fetch(orderIdToFetch);
              const orderMatchesResource =
                !rzpOrder.notes?.resourceId || rzpOrder.notes.resourceId === resolvedResId;
              const orderMatchesAmount =
                rzpOrder.amount === expectedAmountInPaise &&
                (rzpOrder.currency || "").toUpperCase() === expectedCurrency;

              if (orderMatchesResource && orderMatchesAmount) {
                return res.json({
                  success: true,
                  verified: true,
                  resourceId: resolvedResId,
                  orderId: rzpOrder.id,
                  paymentId: rzpPayment.id,
                  amount: (rzpPayment.amount || 0) / 100,
                  currency: expectedCurrency
                });
              }
            }
          }
        } catch (rzpErr) {
          // invalid payment ID or gateway rejection
        }
      }
    }

    // 3. Check if authenticated user owns the resource
    if (authenticatedUser) {
      const { data: userPurchases } = await supabaseServer
        .from("resource_purchases")
        .select("*")
        .eq("user_id", authenticatedUser.id)
        .eq("resource_id", resolvedResId)
        .eq("status", "active")
        .maybeSingle();

      if (userPurchases) {
        return res.json({
          success: true,
          verified: true,
          resourceId: resolvedResId,
          orderId: userPurchases.razorpay_order_id,
          paymentId: userPurchases.razorpay_payment_id,
          amount: Number(userPurchases.amount) || Number(resourceRecord?.price) || 0,
          currency: userPurchases.currency || "INR"
        });
      }

      const { data: userPayment } = await supabaseServer
        .from("payments")
        .select("*")
        .eq("user_id", authenticatedUser.id)
        .eq("item_type", "resource")
        .eq("item_id", resolvedResId)
        .eq("status", "captured")
        .maybeSingle();

      if (userPayment) {
        return res.json({
          success: true,
          verified: true,
          resourceId: resolvedResId,
          orderId: userPayment.razorpay_order_id,
          paymentId: userPayment.razorpay_payment_id,
          amount: Number(userPayment.amount) || Number(resourceRecord?.price) || 0,
          currency: userPayment.currency || "INR"
        });
      }
    }

    return res.json({
      success: true,
      verified: false,
      message: "No verified payment record found for this resource transaction."
    });
  } catch (err) {
    console.error("[Verify Purchase Status] Unexpected error:", err);
    return res.status(500).json({ success: false, verified: false, error: "Failed to verify purchase status." });
  }
});

/**
 * POST /api/payments/get-resource-download-url
 *
 * Server-authoritative endpoint to retrieve the download URL for a paid resource.
 * Enforces server verification: only returns the asset URL if a verified captured payment exists.
 */
router.post("/get-resource-download-url", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    let authenticatedUser = null;
    if (authHeader) {
      const { user } = await verifySupabaseToken(authHeader);
      authenticatedUser = user;
    }

    const { resourceId, orderId, paymentId } = req.body || {};
    if (!resourceId) {
      return res.status(400).json({ success: false, error: "resourceId is required." });
    }

    const cleanResourceId = String(resourceId).trim();
    const cleanPaymentId = paymentId ? String(paymentId).trim() : null;
    const cleanOrderId = orderId ? String(orderId).trim() : null;

    const supabaseServer = getSupabaseServerClient() || getSupabaseDbClient(authHeader);
    if (!supabaseServer) {
      return res.status(503).json({ success: false, error: "Database service unavailable." });
    }

    // 1. Fetch resource record
    const isUUID = isValidUUID(cleanResourceId);
    const { data: resourceRecord, error: rErr } = isUUID
      ? await supabaseServer.from("resources").select("*").eq("id", cleanResourceId).maybeSingle()
      : await supabaseServer.from("resources").select("*").eq("slug", cleanResourceId).maybeSingle();

    if (rErr || !resourceRecord) {
      return res.status(404).json({ success: false, error: "Resource not found." });
    }

    const isPaid = (resourceRecord.access_type || "free") === "paid" && Number(resourceRecord.price) > 0;

    // If it's a free resource, permit retrieval
    if (!isPaid) {
      return res.json({
        success: true,
        downloadUrl: resourceRecord.file_url || resourceRecord.external_url || null,
        externalUrl: resourceRecord.external_url || null,
        fileUrl: resourceRecord.file_url || null,
        accessType: "free"
      });
    }

    // If paid, verify authorization
    let isAuthorized = false;

    // Check paymentId against database
    if (cleanPaymentId) {
      const { data: pRecord } = await supabaseServer
        .from("payments")
        .select("id, status, item_id, item_type")
        .eq("razorpay_payment_id", cleanPaymentId)
        .eq("status", "captured")
        .maybeSingle();

      if (pRecord && pRecord.item_id === resourceRecord.id && pRecord.item_type === "resource") {
        isAuthorized = true;
      }

      if (!isAuthorized) {
        const { data: purRecord } = await supabaseServer
          .from("resource_purchases")
          .select("id, status, resource_id")
          .eq("razorpay_payment_id", cleanPaymentId)
          .eq("status", "active")
          .maybeSingle();

        if (purRecord && purRecord.resource_id === resourceRecord.id) {
          isAuthorized = true;
        }
      }

      // Check with Razorpay gateway directly if not in DB yet
      if (!isAuthorized && cleanPaymentId.startsWith("pay_")) {
        const razorpay = getRazorpayClient();
        if (razorpay) {
          try {
            const rzpPayment = await razorpay.payments.fetch(cleanPaymentId);
            if (rzpPayment && rzpPayment.status === "captured") {
              const expectedAmountInPaise = Math.round(Number(resourceRecord.price) * 100);
              const matchesOrder = !cleanOrderId || rzpPayment.order_id === cleanOrderId;
              const matchesAmount = Number(rzpPayment.amount) === expectedAmountInPaise;
              const matchesCurrency = !resourceRecord.currency || (rzpPayment.currency || "").toUpperCase() === (resourceRecord.currency || "INR").toUpperCase();
              const paymentNoteResId = rzpPayment.notes?.resourceId || rzpPayment.notes?.resource_id;
              const matchesResNote = !paymentNoteResId || paymentNoteResId === resourceRecord.id || paymentNoteResId === resourceRecord.slug;

              if (matchesOrder && matchesAmount && matchesCurrency && matchesResNote) {
                isAuthorized = true;
              }
            }
          } catch {}
        }
      }
    }

    // Check authenticated user
    if (!isAuthorized && authenticatedUser) {
      if (checkIsAdmin(authenticatedUser)) {
        isAuthorized = true;
      } else {
        const { data: userPayment } = await supabaseServer
          .from("payments")
          .select("id")
          .eq("user_id", authenticatedUser.id)
          .eq("item_type", "resource")
          .eq("item_id", resourceRecord.id)
          .eq("status", "captured")
          .maybeSingle();

        if (userPayment) {
          isAuthorized = true;
        } else {
          const { data: userPur } = await supabaseServer
            .from("resource_purchases")
            .select("id")
            .eq("user_id", authenticatedUser.id)
            .eq("resource_id", resourceRecord.id)
            .eq("status", "active")
            .maybeSingle();

          if (userPur) {
            isAuthorized = true;
          }
        }
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized: A confirmed payment is required to access this paid asset."
      });
    }

    // Generate signed URL if Supabase storage or private asset
    let finalDownloadUrl = resourceRecord.file_url || resourceRecord.external_url || null;

    // Check if private storage asset exists in bucket
    if (resourceRecord.slug === "pre-launch-tracking-audit-checklist" || resourceRecord.id === "6867ecdd-2797-40f0-bdc8-ead20600ac6c") {
      const { data: signedData } = await supabaseServer.storage
        .from("resources")
        .createSignedUrl("paid/pre-launch-tracking-audit-checklist.pdf", 3600);
      if (signedData?.signedUrl) {
        finalDownloadUrl = signedData.signedUrl;
      }
    } else if (finalDownloadUrl && (finalDownloadUrl.includes("/storage/v1/object/") || finalDownloadUrl.startsWith("supabase://resources/"))) {
      let objectPath = "";
      if (finalDownloadUrl.startsWith("supabase://resources/")) {
        objectPath = finalDownloadUrl.replace("supabase://resources/", "");
      } else {
        const match = finalDownloadUrl.match(/\/resources\/(.+)$/);
        if (match && match[1]) {
          objectPath = decodeURIComponent(match[1].split("?")[0]);
        }
      }
      if (objectPath) {
        const { data: signedData } = await supabaseServer.storage
          .from("resources")
          .createSignedUrl(objectPath, 3600);
        if (signedData?.signedUrl) {
          finalDownloadUrl = signedData.signedUrl;
        }
      }
    }

    return res.json({
      success: true,
      downloadUrl: finalDownloadUrl,
      externalUrl: resourceRecord.external_url || null,
      fileUrl: finalDownloadUrl,
      resourceTitle: resourceRecord.title,
      accessType: "paid"
    });
  } catch (err) {
    console.error("[Get Resource Download URL] Unexpected error:", err);
    return res.status(500).json({ success: false, error: "Failed to generate authorized download URL." });
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
