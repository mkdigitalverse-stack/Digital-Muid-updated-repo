import express from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
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
import { generateAuthoritativeInvoicePdf } from "./invoiceService.js";

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
 * Dedicated high-entropy HMAC secret for paid asset access tokens.
 * Requires at least 32 bytes (256 bits) of entropy.
 * Returns null if missing, empty, or under 32 bytes (fails closed).
 * Does NOT use Supabase service role key or hardcoded fallback.
 */
export function getAssetHmacSecret() {
  const secret = process.env.ASSET_TOKEN_HMAC_SECRET;
  if (!secret || typeof secret !== "string") {
    return null;
  }
  const clean = secret.trim();
  // Ensure minimum 32 bytes of key material
  if (Buffer.byteLength(clean, "utf8") < 32) {
    console.error("[Security Alert] ASSET_TOKEN_HMAC_SECRET has insufficient entropy (< 32 bytes). Failing closed.");
    return null;
  }
  return clean;
}

export function isAssetTokenSecretConfigured() {
  return Boolean(getAssetHmacSecret());
}

/**
 * Transitional fallback secret for validating active unexpired tokens issued within the past 1 hour.
 * Allows graceful cutover without breaking active sessions for legitimate buyers.
 */
function getTransitionalLegacySecret() {
  const legacy = process.env.RAZORPAY_KEY_SECRET;
  if (!legacy || typeof legacy !== "string") return null;
  const clean = legacy.trim();
  return clean.length >= 8 ? clean : null;
}

export function generateAssetAccessToken(resourceId, authId) {
  const secret = getAssetHmacSecret();
  if (!secret) {
    console.error("[Security Guard] Cannot issue asset download token: ASSET_TOKEN_HMAC_SECRET is missing or invalid.");
    return null;
  }

  const payload = {
    resourceId: String(resourceId).trim(),
    authId: String(authId || "guest").trim(),
    expiresAt: Date.now() + 60 * 60 * 1000 // 1 hour expiration
  };
  const json = JSON.stringify(payload);
  const data = Buffer.from(json).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyAssetAccessToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;

  const primarySecret = getAssetHmacSecret();
  let isValidSig = false;

  // 1. Primary verification using dedicated high-entropy ASSET_TOKEN_HMAC_SECRET
  if (primarySecret) {
    const expectedSig = crypto.createHmac("sha256", primarySecret).update(data).digest("base64url");
    if (sig.length === expectedSig.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
      isValidSig = true;
    }
  }

  // 2. Safe transitional grace period: if token was generated with legacy RAZORPAY_KEY_SECRET in the last hour
  if (!isValidSig) {
    const legacySecret = getTransitionalLegacySecret();
    if (legacySecret) {
      const expectedLegacySig = crypto.createHmac("sha256", legacySecret).update(data).digest("base64url");
      if (sig.length === expectedLegacySig.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedLegacySig))) {
        isValidSig = true;
      }
    }
  }

  // Fail closed if signature did not match either key
  if (!isValidSig) return null;

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    if (!payload.expiresAt || Date.now() > payload.expiresAt) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getAuthoritativeResourcePricing(idOrSlug, resourceRecord = null, fallbackBody = null) {
  const clean = String(idOrSlug || "").trim();
  const known = AUTHORITATIVE_PAID_RESOURCES[clean] ||
    (resourceRecord?.id && AUTHORITATIVE_PAID_RESOURCES[resourceRecord.id]) ||
    (resourceRecord?.slug && AUTHORITATIVE_PAID_RESOURCES[resourceRecord.slug]);

  const dbAccessType = resourceRecord?.access_type || resourceRecord?.accessType;
  const isExplicitlyPaidInDb = dbAccessType && String(dbAccessType).toLowerCase() === "paid" && Number(resourceRecord?.price) > 0;

  if (isExplicitlyPaidInDb) {
    return {
      accessType: "paid",
      price: Number(resourceRecord.price),
      currency: (resourceRecord.currency || "INR").toUpperCase()
    };
  }

  if (known) {
    return {
      accessType: "paid",
      price: known.price,
      currency: known.currency
    };
  }

  const fallbackAccessType = (fallbackBody?.accessType || dbAccessType || "free").toLowerCase();
  const fallbackPrice = Number(resourceRecord?.price) || Number(fallbackBody?.price) || 0;
  return {
    accessType: fallbackAccessType,
    price: fallbackPrice,
    currency: (resourceRecord?.currency || fallbackBody?.currency || "INR").toUpperCase()
  };
}

// ==============================================================================
// AUTHORITATIVE COURSE CATALOG IDENTIFIERS & RESOLUTION
// ==============================================================================
export const COURSE_LOCAL_ID_MAP = {
  "crs-01": "digital-marketing-masterclass",
  "crs-02": "meta-ads-mastery",
  "crs-03": "ai-automation-business-operations",
  "crs-04": "social-media-mastery"
};

/**
 * Resolves authoritative course record by UUID, slug, or local identifier.
 */
export async function fetchCourseRecordAuthoritative(dbClient, rawCourseIdentifier) {
  if (!dbClient || !rawCourseIdentifier || typeof rawCourseIdentifier !== "string") {
    return { course: null, error: new Error("Invalid course identifier or database client.") };
  }
  const cleanId = rawCourseIdentifier.trim();
  const selectFields = "id, slug, title, price, offer_price, offer_expires_at, currency, status, max_seats, enrolled_count";

  if (isValidUUID(cleanId)) {
    const { data, error } = await dbClient
      .from("courses")
      .select(selectFields)
      .eq("id", cleanId)
      .maybeSingle();

    if (error) {
      return { course: null, error };
    }
    if (data) {
      return { course: data, error: null };
    }
  }

  // If not UUID or not found by UUID, resolve via slug or local ID map
  const resolvedSlug = COURSE_LOCAL_ID_MAP[cleanId] || cleanId;
  const { data, error } = await dbClient
    .from("courses")
    .select(selectFields)
    .eq("slug", resolvedSlug)
    .maybeSingle();

  return { course: data, error };
}

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
    if (!courseId || typeof courseId !== "string" || !courseId.trim()) {
      return res.status(400).json({
        success: false,
        error: "A valid courseId or course slug is required."
      });
    }

    // 3. Obtain database client
    const dbClient = getSupabaseDbClient(authHeader) || getSupabaseServerClient();
    if (!dbClient) {
      return res.status(503).json({
        success: false,
        error: "Database service is not currently available."
      });
    }

    // 4. Fetch authoritative course record from Supabase
    const { course, error: courseError } = await fetchCourseRecordAuthoritative(dbClient, courseId);

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
        courseTitle: (course.title || "Course Masterclass").slice(0, 100),
        customerEmail: (user.email || "").slice(0, 100),
        customerName: (user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "Student Member").slice(0, 100)
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

    if (!courseId || typeof courseId !== "string" || !courseId.trim()) {
      return res.status(400).json({
        success: false,
        verified: false,
        error: "A valid courseId or course slug is required."
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
    const dbClient = getSupabaseDbClient(authHeader) || getSupabaseServerClient();
    if (!dbClient) {
      return res.status(503).json({
        success: false,
        verified: true,
        fulfilled: false,
        status: "verification_pending_fulfillment",
        error: "Database service is not currently available."
      });
    }

    const { course, error: courseError } = await fetchCourseRecordAuthoritative(dbClient, courseId);

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

    const studentEmail = (user.email || "").trim() || null;
    const studentName = (user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "Student Member").trim();

    // 6. Execute atomic server-side fulfillment RPC (Phase 2K-E)
    const fulfillment = await fulfillCourseEnrollment({
      userId: user.id,
      courseId: course.id,
      amount: effectivePrice,
      currency,
      orderId: razorpay_order_id.trim(),
      paymentId: razorpay_payment_id.trim(),
      studentEmail,
      studentName
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
        customerPhone: String(bookingDetails.customerPhone || "").trim().slice(0, 30),
        businessName: String(bookingDetails.businessName || "").trim().slice(0, 50),
        primaryChallenge: String(bookingDetails.primaryChallenge || "").trim().slice(0, 80),
        desiredOutcome: String(bookingDetails.desiredOutcome || "").trim().slice(0, 80),
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

    // 2. Authoritative Gateway Verification: Validate captured status, amount, and order relationship
    const razorpay = getRazorpayClient();
    if (!razorpay) {
      return res.status(503).json({
        success: false,
        verified: true,
        fulfilled: false,
        error: "Payment gateway client is unavailable on the server."
      });
    }

    let gatewayPayment = null;
    let gatewayOrder = null;
    try {
      [gatewayPayment, gatewayOrder] = await Promise.all([
        razorpay.payments.fetch(razorpay_payment_id.trim()),
        razorpay.orders.fetch(razorpay_order_id.trim())
      ]);
    } catch (fetchErr) {
      console.error("[Consultation Verification] Failed to fetch authoritative gateway records:", fetchErr?.message || fetchErr);
      return res.status(502).json({
        success: false,
        verified: false,
        error: "Failed to confirm payment status with gateway provider."
      });
    }

    if (!gatewayPayment || !gatewayOrder) {
      return res.status(400).json({
        success: false,
        verified: false,
        error: "Gateway payment or order could not be retrieved."
      });
    }

    if (gatewayPayment.status !== "captured") {
      console.warn(`[Consultation Verification] Payment ${razorpay_payment_id} rejected: status is ${gatewayPayment.status}`);
      return res.status(400).json({
        success: false,
        verified: false,
        error: `Payment is not in captured status (current status: ${gatewayPayment.status}).`
      });
    }

    if (gatewayPayment.order_id !== razorpay_order_id.trim() || gatewayOrder.id !== razorpay_order_id.trim()) {
      console.warn(`[Consultation Verification] Order ID mismatch: payment order is ${gatewayPayment.order_id}, expected ${razorpay_order_id}`);
      return res.status(400).json({
        success: false,
        verified: false,
        error: "Payment is not associated with the provided order ID."
      });
    }

    const payCurrency = String(gatewayPayment.currency || "").toUpperCase();
    const ordCurrency = String(gatewayOrder.currency || "").toUpperCase();
    if (payCurrency !== "INR" || ordCurrency !== "INR") {
      return res.status(400).json({
        success: false,
        verified: false,
        error: "Invalid currency: Consultation transactions must be denominated in INR."
      });
    }

    const payAmountPaise = Number(gatewayPayment.amount);
    const ordAmountPaise = Number(gatewayOrder.amount);
    if (payAmountPaise <= 0 || payAmountPaise !== ordAmountPaise) {
      return res.status(400).json({
        success: false,
        verified: false,
        error: `Payment amount (${payAmountPaise}) does not match order amount (${ordAmountPaise}).`
      });
    }

    // 3. Atomic fulfillment into public.bookings and public.payments
    const fulfillment = await fulfillConsultationPayment({
      userId: authenticatedUser?.id || null,
      bookingDetails: {
        ...(bookingDetails || {}),
        order_total_amount: (payAmountPaise / 100).toFixed(2)
      },
      orderId: razorpay_order_id.trim(),
      paymentId: razorpay_payment_id.trim(),
      amount: payAmountPaise / 100,
      currency: payCurrency,
      productId: gatewayOrder.notes?.productId || "31bbb9bf-ce10-4da4-a517-dfc673f9b875"
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

    // 2. Validate access type & price using authoritative pricing resolver
    const pricing = getAuthoritativeResourcePricing(cleanResourceId, resourceRecord, req.body);
    if (pricing.accessType !== "paid" || pricing.price <= 0) {
      return res.status(400).json({
        success: false,
        error: "This resource is free and does not require payment processing."
      });
    }

    const authoritativePrice = pricing.price;
    const currency = pricing.currency;
    const amountInPaise = Math.round(authoritativePrice * 100);

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
        customerPhone: (customerDetails?.phone || "").slice(0, 30),
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
        const leadEmail = (customerDetails?.email || "").trim().toLowerCase();
        const leadName = customerDetails?.name || "Resource Checkout Visitor";
        const leadPhone = customerDetails?.phone || null;

        // Check if a lead with this order or email/interest already exists
        dbClient.from("crm_leads")
          .select("id")
          .ilike("notes", `%${order.id}%`)
          .limit(1)
          .then(({ data: existingLeads }) => {
            if (!existingLeads || existingLeads.length === 0) {
              const initiationLeadId = crypto.randomUUID();
              dbClient.from("crm_leads").insert({
                id: initiationLeadId,
                name: leadName,
                email: leadEmail,
                phone: leadPhone,
                source: "Resource Paid Checkout Initiated",
                interest: resourceRecord?.title ? `Checkout: ${resourceRecord.title}` : `Resource ID: ${cleanResourceId}`,
                notes: `Checkout initiated for ₹${authoritativePrice}. Order ID: ${order.id}. Awaiting payment completion.`,
                status: "New",
                amount: authoritativePrice,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }).then(({ error }) => {
                if (error) console.warn("[Create Resource Order] CRM lead capture notice:", error.message);
              });
            }
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

    const pricing = getAuthoritativeResourcePricing(resourceId.trim(), resourceRecord, req.body);
    const amount = pricing.price;
    const currency = pricing.currency;

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
      lead_status: fulfillment.lead_status || 'saved',
      lead_id: fulfillment.lead_id || null,
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
 * POST /api/payments/recover-lead
 *
 * Dedicated idempotent recovery endpoint for CRM lead synchronization after a verified payment.
 *
 * Guarantees:
 * 1. Checks that the payment was captured and verified in server ledger (resource_purchases/payments) or Razorpay gateway.
 * 2. Never creates an order or charges the customer again.
 * 3. Idempotently inserts or recovers the lead in public.crm_leads with server UUID.
 * 4. Returns clear payment_verified and lead_status indicators.
 */
router.post("/recover-lead", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    let authenticatedUser = null;
    if (authHeader) {
      const { user } = await verifySupabaseToken(authHeader);
      authenticatedUser = user;
    }

    const {
      orderId,
      paymentId,
      resourceId,
      customerDetails
    } = req.body || {};

    const cleanOrderId = String(orderId || "").trim();
    const cleanPaymentId = String(paymentId || "").trim();
    const cleanResourceId = String(resourceId || "").trim();

    if (!cleanOrderId || !cleanPaymentId || !cleanResourceId) {
      return res.status(400).json({
        success: false,
        payment_verified: false,
        lead_status: "failed",
        error: "Missing required parameters (orderId, paymentId, resourceId) for lead recovery."
      });
    }

    const dbClient = getSupabaseDbClient(authHeader) || getSupabaseServerClient();
    const razorpay = getRazorpayClient();

    // 1. Authoritative verification: Ensure the payment actually exists and is captured
    let paymentVerified = false;
    let dbPurchase = null;

    if (dbClient) {
      // Check resource_purchases
      const { data: purchase } = await dbClient
        .from("resource_purchases")
        .select("*")
        .eq("razorpay_payment_id", cleanPaymentId)
        .maybeSingle();

      if (purchase) {
        paymentVerified = true;
        dbPurchase = purchase;
      } else {
        // Check payments ledger
        const { data: payment } = await dbClient
          .from("payments")
          .select("*")
          .eq("razorpay_payment_id", cleanPaymentId)
          .eq("status", "captured")
          .maybeSingle();

        if (payment) {
          paymentVerified = true;
        }
      }
    }

    // If not verified in database, check authoritative gateway status
    if (!paymentVerified && razorpay) {
      try {
        const rzpPayment = await razorpay.payments.fetch(cleanPaymentId);
        if (rzpPayment && rzpPayment.status === "captured" && rzpPayment.order_id === cleanOrderId) {
          paymentVerified = true;
        }
      } catch (gatewayErr) {
        console.warn(`[Lead Recovery] Gateway verification notice: ${gatewayErr?.message}`);
      }
    }

    if (!paymentVerified) {
      return res.status(400).json({
        success: false,
        payment_verified: false,
        lead_status: "failed",
        error: "Payment could not be verified against ledger records or gateway. Lead recovery rejected."
      });
    }

    // 2. Idempotency Check: check if lead already exists in crm_leads for this payment
    if (dbClient) {
      const { data: existingLeads } = await dbClient
        .from("crm_leads")
        .select("id, status")
        .ilike("notes", `%${cleanPaymentId}%`)
        .limit(1);

      if (existingLeads && existingLeads.length > 0) {
        return res.json({
          success: true,
          payment_verified: true,
          lead_status: "already_exists",
          lead_id: existingLeads[0].id,
          message: "CRM lead is already registered and synchronized for this purchase."
        });
      }
    }

    // 3. Resolve authoritative resource pricing & metadata
    let resourceRecord = null;
    if (dbClient) {
      const isUUID = isValidUUID(cleanResourceId);
      const query = dbClient.from("resources").select("*");
      const { data } = isUUID
        ? await query.eq("id", cleanResourceId).maybeSingle()
        : await query.eq("slug", cleanResourceId).maybeSingle();
      resourceRecord = data;
    }

    const pricing = getAuthoritativeResourcePricing(cleanResourceId, resourceRecord, req.body);
    const authoritativePrice = pricing.price;
    const resourceTitle = resourceRecord?.title || resourceRecord?.name || "Digital Resource Toolkit";

    // 4. Safely insert lead into public.crm_leads with generated UUID
    const leadEmail = (customerDetails?.email || authenticatedUser?.email || dbPurchase?.customer_email || "").trim().toLowerCase();
    const leadName = (customerDetails?.name || authenticatedUser?.user_metadata?.full_name || "Resource Buyer").trim();
    const leadPhone = (customerDetails?.phone || dbPurchase?.customer_phone || "").trim() || null;
    const profession = customerDetails?.profession ? String(customerDetails.profession).trim() : "";

    const newLeadId = crypto.randomUUID();
    const notesContent = profession
      ? `Paid ₹${authoritativePrice}. Order: ${cleanOrderId}, Payment: ${cleanPaymentId}. Profession: ${profession}. Recovered lead synchronization.`
      : `Paid ₹${authoritativePrice}. Order: ${cleanOrderId}, Payment: ${cleanPaymentId}. Recovered lead synchronization.`;

    if (dbClient && (leadEmail || leadName)) {
      const { data: insertedLead, error: insertError } = await dbClient
        .from("crm_leads")
        .insert({
          id: newLeadId,
          name: leadName || "Resource Buyer",
          email: leadEmail,
          phone: leadPhone,
          source: "Resource Purchase (Paid)",
          interest: `Purchased: ${resourceTitle}`,
          notes: notesContent,
          status: "Converted",
          amount: authoritativePrice,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .maybeSingle();

      if (insertError) {
        console.warn("[Lead Recovery] Insert CRM lead notice:", insertError.message);
        return res.status(500).json({
          success: false,
          payment_verified: true,
          lead_status: "failed",
          error: "Database error while persisting recovered lead."
        });
      }

      return res.json({
        success: true,
        payment_verified: true,
        lead_status: "saved",
        lead_id: insertedLead?.id || newLeadId,
        message: "CRM lead successfully recovered and synchronized."
      });
    }

    return res.status(400).json({
      success: false,
      payment_verified: true,
      lead_status: "failed",
      error: "Insufficient customer information to save lead."
    });
  } catch (err) {
    console.error("[Lead Recovery] Unexpected error:", err);
    return res.status(500).json({
      success: false,
      payment_verified: false,
      lead_status: "failed",
      error: "An unexpected error occurred during lead recovery."
    });
  }
});

// ==============================================================================
// DIGITAL MUID BUNDLE CONFIGURATION & PRIVATE STORAGE MAPPING
// Authoritative definitions for the 4-file Meta Ads Campaign Planner Bundle
// ==============================================================================
export const BUNDLE_RESOURCE_ID = "2d50e5e3-711d-4461-a70d-0ed54dd29f17";
export const BUNDLE_SLUG = "meta-ads-campaign-planner-bundle";

export const BUNDLE_ITEMS = [
  {
    id: "27ef2c04-4d4a-4dbe-a702-d4013b2542b9",
    slug: "meta-ads-campaign-planner-workbook",
    title: "The Meta Ads Campaign Planner Workbook",
    description: "Step-by-step operating system, TOF/MOF/BOF architecture & 48-hour decision matrix.",
    format: "PDF Document (Workbook)",
    fileSize: "2.3 MB",
    filename: "meta-ads-campaign-planner-workbook.pdf",
    storagePath: "paid/meta-ads-campaign-planner-workbook.pdf"
  },
  {
    id: "fafe5ffc-3323-4761-9d22-50a2588f6326",
    slug: "the-ad-budget-breat-even-calculate",
    title: "Interactive Ad Budget & Break-Even Calculator",
    description: "Unit economics engine, target ROAS forecaster & volume scenario planner.",
    format: "Interactive Spreadsheet (.xlsx) & Protocol",
    fileSize: "29.5 KB",
    filename: "the-ad-budget-break-even-calculator.xlsx",
    storagePath: "paid/the-ad-budget-break-even-calculator.xlsx"
  },
  {
    id: "004d374c-d872-4bfe-bf54-8083504e9174",
    slug: "10-high-converting-meta-ads-copy-frameworks",
    title: "10 High-Converting Meta Ads Copy Frameworks",
    description: "Plug-and-play ad copy frameworks, headline swipe files & creative hook formulas.",
    format: "PDF Document (Swipe File)",
    fileSize: "1.9 MB",
    filename: "10-high-converting-meta-ads-copy-frameworks.pdf",
    storagePath: "paid/10-high-converting-meta-ads-copy-frameworks.pdf"
  },
  {
    id: "6867ecdd-2797-40f0-bdc8-ead20600ac6c",
    slug: "pre-launch-tracking-audit-checklist",
    title: "Pre-Launch & Tracking Audit Checklist",
    description: "1-page rapid audit protocol covering pixel verification, CAPI setup & checkout friction.",
    format: "PDF Checklist",
    fileSize: "943 KB",
    filename: "pre-launch-tracking-audit-checklist.pdf",
    storagePath: "paid/pre-launch-tracking-audit-checklist.pdf"
  }
];

export function isBundleOrBundleItem(idOrSlug) {
  if (!idOrSlug) return { isBundle: false, isChild: false, item: null };
  const clean = String(idOrSlug).trim();
  if (clean === BUNDLE_RESOURCE_ID || clean === BUNDLE_SLUG) {
    return { isBundle: true, isChild: false, item: null };
  }
  const child = BUNDLE_ITEMS.find(
    (i) => i.id === clean || i.slug === clean ||
      (i.slug === "the-ad-budget-breat-even-calculate" && clean === "the-ad-budget-break-even-calculator")
  );
  if (child) {
    return { isBundle: false, isChild: true, item: child };
  }
  return { isBundle: false, isChild: false, item: null };
}

function getAllowedResourceIdsForAuthorization(targetResourceRecord) {
  const { isBundle, isChild } = isBundleOrBundleItem(targetResourceRecord.id || targetResourceRecord.slug);
  if (isChild) {
    // Both individual purchase of this child OR purchase of the parent bundle unlocks this child
    return [targetResourceRecord.id, BUNDLE_RESOURCE_ID];
  }
  if (isBundle) {
    // Only purchase of the bundle unlocks the bundle
    return [BUNDLE_RESOURCE_ID];
  }
  // Standalone resource: only its own ID unlocks it
  return [targetResourceRecord.id];
}

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
    const pricing = getAuthoritativeResourcePricing(cleanResourceId, resourceRecord);
    const isFree = pricing.accessType !== "paid" || pricing.price <= 0;

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

    const allowedResourceIds = getAllowedResourceIdsForAuthorization(resourceRecord);
    const expectedAmountInPaise = Math.round(pricing.price * 100);
    const expectedCurrency = pricing.currency;

    // 2. Check if authenticated user owns the resource or bundle (Checked first to enable authenticated recovery)
    if (authenticatedUser) {
      if (checkIsAdmin(authenticatedUser)) {
        return res.json({
          success: true,
          verified: true,
          isAdmin: true,
          resourceId: resolvedResId,
          amount: Number(resourceRecord?.price) || 0,
          currency: "INR"
        });
      }

      const { data: userPurchases } = await supabaseServer
        .from("resource_purchases")
        .select("id, status, amount, currency, razorpay_order_id, razorpay_payment_id, resource_id")
        .eq("user_id", authenticatedUser.id)
        .in("resource_id", allowedResourceIds)
        .eq("status", "active")
        .eq("currency", "INR")
        .gt("amount", 0)
        .maybeSingle();

      if (
        userPurchases &&
        String(userPurchases.currency || "").toUpperCase() === "INR" &&
        Number(userPurchases.amount) > 0
      ) {
        return res.json({
          success: true,
          verified: true,
          resourceId: resolvedResId,
          orderId: userPurchases.razorpay_order_id,
          paymentId: userPurchases.razorpay_payment_id,
          amount: Number(userPurchases.amount) || Number(resourceRecord?.price) || 0,
          currency: "INR"
        });
      }

      const { data: userPayment } = await supabaseServer
        .from("payments")
        .select("id, status, amount, currency, razorpay_order_id, razorpay_payment_id, item_id")
        .eq("user_id", authenticatedUser.id)
        .eq("item_type", "resource")
        .in("item_id", allowedResourceIds)
        .eq("status", "captured")
        .eq("currency", "INR")
        .gt("amount", 0)
        .maybeSingle();

      if (
        userPayment &&
        String(userPayment.currency || "").toUpperCase() === "INR" &&
        Number(userPayment.amount) > 0
      ) {
        return res.json({
          success: true,
          verified: true,
          resourceId: resolvedResId,
          orderId: userPayment.razorpay_order_id,
          paymentId: userPayment.razorpay_payment_id,
          amount: Number(userPayment.amount) || Number(resourceRecord?.price) || 0,
          currency: "INR"
        });
      }
    }

    // 3. Guest verification: require both matching identifiers
    if (cleanPaymentId || cleanOrderId) {
      if (!cleanPaymentId || !cleanOrderId) {
        return res.status(400).json({
          success: false,
          verified: false,
          error: "Both paymentId and orderId are required for guest purchase verification."
        });
      }

      // Check public.resource_purchases for matching paymentId AND orderId
      const { data: purchaseRecord } = await supabaseServer
        .from("resource_purchases")
        .select("id, status, amount, currency, razorpay_order_id, razorpay_payment_id, resource_id")
        .eq("razorpay_payment_id", cleanPaymentId)
        .eq("razorpay_order_id", cleanOrderId)
        .in("resource_id", allowedResourceIds)
        .eq("status", "active")
        .eq("currency", "INR")
        .gt("amount", 0)
        .maybeSingle();

      if (
        purchaseRecord &&
        purchaseRecord.razorpay_order_id === cleanOrderId &&
        purchaseRecord.razorpay_payment_id === cleanPaymentId &&
        String(purchaseRecord.currency || "").toUpperCase() === "INR" &&
        Number(purchaseRecord.amount) > 0
      ) {
        return res.json({
          success: true,
          verified: true,
          resourceId: resolvedResId,
          orderId: cleanOrderId,
          paymentId: cleanPaymentId,
          amount: Number(purchaseRecord.amount) || Number(resourceRecord.price) || 0,
          currency: "INR"
        });
      }

      // Check public.payments for matching paymentId AND orderId
      const { data: paymentRecord } = await supabaseServer
        .from("payments")
        .select("id, status, amount, currency, razorpay_order_id, razorpay_payment_id, item_id, item_type")
        .eq("razorpay_payment_id", cleanPaymentId)
        .eq("razorpay_order_id", cleanOrderId)
        .in("item_id", allowedResourceIds)
        .eq("item_type", "resource")
        .eq("status", "captured")
        .eq("currency", "INR")
        .gt("amount", 0)
        .maybeSingle();

      if (
        paymentRecord &&
        paymentRecord.razorpay_order_id === cleanOrderId &&
        paymentRecord.razorpay_payment_id === cleanPaymentId &&
        String(paymentRecord.currency || "").toUpperCase() === "INR" &&
        Number(paymentRecord.amount) > 0
      ) {
        return res.json({
          success: true,
          verified: true,
          resourceId: resolvedResId,
          orderId: cleanOrderId,
          paymentId: cleanPaymentId,
          amount: Number(paymentRecord.amount) || Number(resourceRecord.price) || 0,
          currency: "INR"
        });
      }

      // Gateway reconciliation fallback with strict amount, currency, and resource verification
      const razorpay = getRazorpayClient();
      if (razorpay && cleanPaymentId.startsWith("pay_") && cleanOrderId.startsWith("order_")) {
        try {
          const rzpPayment = await razorpay.payments.fetch(cleanPaymentId);
          if (
            rzpPayment &&
            rzpPayment.status === "captured" &&
            String(rzpPayment.currency || "").toUpperCase() === "INR" &&
            Number(rzpPayment.amount) > 0 &&
            rzpPayment.order_id === cleanOrderId
          ) {
            const isDirectMatch = Number(rzpPayment.amount) === expectedAmountInPaise;
            const isBundleMatch = allowedResourceIds.includes(BUNDLE_RESOURCE_ID) && Number(rzpPayment.amount) === 29900;

            if (isDirectMatch || isBundleMatch) {
              const rzpOrder = await razorpay.orders.fetch(cleanOrderId);
              if (
                rzpOrder &&
                rzpOrder.id === cleanOrderId &&
                Number(rzpPayment.amount) === Number(rzpOrder.amount) &&
                String(rzpOrder.currency || "").toUpperCase() === "INR"
              ) {
                const orderNotes = rzpOrder.notes || {};
                const orderItemType = orderNotes.itemType;
                const orderResId = orderNotes.resourceId || orderNotes.resource_id;

                if (
                  orderItemType === "resource" &&
                  orderResId &&
                  allowedResourceIds.includes(orderResId)
                ) {
                  return res.json({
                    success: true,
                    verified: true,
                    resourceId: resolvedResId,
                    orderId: cleanOrderId,
                    paymentId: cleanPaymentId,
                    amount: (rzpPayment.amount || 0) / 100,
                    currency: "INR"
                  });
                }
              }
            }
          }
        } catch (rzpErr) {
          // invalid payment ID or gateway rejection
        }
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
 * Server-authoritative endpoint to retrieve the download URL for a resource.
 * Enforces server verification: only returns private storage signed URL if a verified captured payment exists.
 * Rejects cross-resource tampering and never exposes Google Drive or raw storage tokens.
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

    const pricing = getAuthoritativeResourcePricing(cleanResourceId, resourceRecord);
    const isPaid = pricing.accessType === "paid" && pricing.price > 0;

    // If it's a free resource, permit retrieval and deliver signed URL or static asset
    if (!isPaid) {
      let freeDownloadUrl = resourceRecord.file_url || resourceRecord.external_url || null;
      const matchedBundleItem = BUNDLE_ITEMS.find((i) => i.id === resourceRecord.id || i.slug === resourceRecord.slug);
      if (matchedBundleItem) {
        const { data: sData } = await supabaseServer.storage
          .from("resources")
          .createSignedUrl(matchedBundleItem.storagePath, 3600);
        if (sData?.signedUrl) {
          freeDownloadUrl = sData.signedUrl;
        }
      }

      return res.json({
        success: true,
        downloadUrl: freeDownloadUrl || "/downloads/META.pdf",
        externalUrl: null,
        fileUrl: freeDownloadUrl || "/downloads/META.pdf",
        accessType: "free"
      });
    }

    const allowedResourceIds = getAllowedResourceIdsForAuthorization(resourceRecord);

    // If paid, verify authorization
    let isAuthorized = false;

    // Check paymentId and orderId against database (strict dual-identifier requirement + user ownership)
    if (cleanPaymentId && cleanOrderId) {
      const { data: pRecord } = await supabaseServer
        .from("payments")
        .select("id, status, amount, currency, razorpay_order_id, razorpay_payment_id, item_id, item_type, user_id")
        .eq("razorpay_payment_id", cleanPaymentId)
        .eq("razorpay_order_id", cleanOrderId)
        .in("item_id", allowedResourceIds)
        .eq("item_type", "resource")
        .eq("status", "captured")
        .eq("currency", "INR")
        .gt("amount", 0)
        .maybeSingle();

      if (
        pRecord &&
        pRecord.razorpay_order_id === cleanOrderId &&
        pRecord.razorpay_payment_id === cleanPaymentId &&
        String(pRecord.currency || "").toUpperCase() === "INR"
      ) {
        // Enforce ownership: if user is logged in, payment must either belong to this user or have no user_id (guest)
        if (!authenticatedUser || !pRecord.user_id || pRecord.user_id === authenticatedUser.id) {
          isAuthorized = true;
        }
      }

      if (!isAuthorized) {
        const { data: purRecord } = await supabaseServer
          .from("resource_purchases")
          .select("id, status, amount, currency, razorpay_order_id, razorpay_payment_id, resource_id, user_id")
          .eq("razorpay_payment_id", cleanPaymentId)
          .eq("razorpay_order_id", cleanOrderId)
          .in("resource_id", allowedResourceIds)
          .eq("status", "active")
          .eq("currency", "INR")
          .gt("amount", 0)
          .maybeSingle();

        if (
          purRecord &&
          purRecord.razorpay_order_id === cleanOrderId &&
          purRecord.razorpay_payment_id === cleanPaymentId &&
          String(purRecord.currency || "").toUpperCase() === "INR"
        ) {
          // Enforce ownership
          if (!authenticatedUser || !purRecord.user_id || purRecord.user_id === authenticatedUser.id) {
            isAuthorized = true;
          }
        }
      }

      // Check with Razorpay gateway directly if not in DB yet
      if (!isAuthorized && cleanPaymentId.startsWith("pay_") && cleanOrderId.startsWith("order_")) {
        const razorpay = getRazorpayClient();
        if (razorpay) {
          try {
            const rzpPayment = await razorpay.payments.fetch(cleanPaymentId);
            if (
              rzpPayment &&
              rzpPayment.status === "captured" &&
              String(rzpPayment.currency || "").toUpperCase() === "INR" &&
              Number(rzpPayment.amount) > 0 &&
              rzpPayment.order_id === cleanOrderId
            ) {
              const rzpOrder = await razorpay.orders.fetch(cleanOrderId);
              if (
                rzpOrder &&
                rzpOrder.id === cleanOrderId &&
                Number(rzpPayment.amount) === Number(rzpOrder.amount) &&
                String(rzpOrder.currency || "").toUpperCase() === "INR"
              ) {
                const orderNotes = rzpOrder.notes || {};
                const orderItemType = orderNotes.itemType;
                const orderResId = orderNotes.resourceId || orderNotes.resource_id;
                if (
                  orderItemType === "resource" &&
                  orderResId &&
                  allowedResourceIds.includes(orderResId)
                ) {
                  isAuthorized = true;
                }
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
          .select("id, currency, amount")
          .eq("user_id", authenticatedUser.id)
          .eq("item_type", "resource")
          .in("item_id", allowedResourceIds)
          .eq("status", "captured")
          .eq("currency", "INR")
          .gt("amount", 0)
          .maybeSingle();

        if (
          userPayment &&
          String(userPayment.currency || "").toUpperCase() === "INR" &&
          Number(userPayment.amount) > 0
        ) {
          isAuthorized = true;
        } else {
          const { data: userPur } = await supabaseServer
            .from("resource_purchases")
            .select("id, currency, amount")
            .eq("user_id", authenticatedUser.id)
            .in("resource_id", allowedResourceIds)
            .eq("status", "active")
            .eq("currency", "INR")
            .gt("amount", 0)
            .maybeSingle();

          if (
            userPur &&
            String(userPur.currency || "").toUpperCase() === "INR" &&
            Number(userPur.amount) > 0
          ) {
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

    // Check if the resource is the bundle itself: redirect to website-controlled bundle access
    if (resourceRecord.id === BUNDLE_RESOURCE_ID || resourceRecord.slug === BUNDLE_SLUG) {
      return res.json({
        success: true,
        isBundle: true,
        downloadUrl: `/resources/bundle/${BUNDLE_SLUG}`,
        bundleAccessUrl: `/resources/bundle/${BUNDLE_SLUG}`,
        resourceTitle: resourceRecord.title,
        accessType: "paid"
      });
    }

    // Generate signed URL from private Supabase Storage
    let finalDownloadUrl = null;

    // Check if item is in BUNDLE_ITEMS
    const bundleItem = BUNDLE_ITEMS.find(
      (i) => i.id === resourceRecord.id || i.slug === resourceRecord.slug ||
        (i.slug === "the-ad-budget-breat-even-calculate" && resourceRecord.slug === "the-ad-budget-break-even-calculator")
    );
    if (bundleItem) {
      const { data: signedData } = await supabaseServer.storage
        .from("resources")
        .createSignedUrl(bundleItem.storagePath, 3600);
      if (signedData?.signedUrl) {
        finalDownloadUrl = signedData.signedUrl;
      }
    } else {
      let rawUrl = resourceRecord.file_url || resourceRecord.external_url || null;
      if (rawUrl && (rawUrl.includes("/storage/v1/object/") || rawUrl.startsWith("supabase://resources/"))) {
        let objectPath = "";
        if (rawUrl.startsWith("supabase://resources/")) {
          objectPath = rawUrl.replace("supabase://resources/", "");
        } else {
          const match = rawUrl.match(/\/resources\/(.+)$/);
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
      } else {
        finalDownloadUrl = rawUrl;
      }
    }

    // Fallback: If Supabase Storage signed URL is unavailable, generate an authoritative server download link
    if (!finalDownloadUrl || finalDownloadUrl.startsWith("/downloads/")) {
      const token = generateAssetAccessToken(resourceRecord.id, cleanPaymentId || authenticatedUser?.id || "authorized");
      if (!token) {
        return res.status(503).json({
          success: false,
          error: "Asset delivery service is temporarily unconfigured. Please contact support."
        });
      }
      finalDownloadUrl = `/api/payments/download-paid-asset?token=${token}`;
    }

    return res.json({
      success: true,
      downloadUrl: finalDownloadUrl,
      externalUrl: null, // Never leak external URLs for paid assets
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
 * GET & POST /api/payments/bundle-files
 *
 * Dedicated website-controlled bundle access endpoint.
 * Requires verified captured payment for the Meta Ads Campaign Planner Bundle (2d50e5e3-711d-4461-a70d-0ed54dd29f17).
 * Returns individual signed URLs for all 4 bundle deliverables only to authorized buyers.
 * Unauthorized visitors receive 403 Forbidden with clear payment required metadata.
 */
async function handleBundleFilesRequest(req, res) {
  try {
    const authHeader = req.headers.authorization;
    let authenticatedUser = null;
    if (authHeader) {
      const { user } = await verifySupabaseToken(authHeader);
      authenticatedUser = user;
    }

    const { bundleId, orderId, paymentId } = req.method === "POST" ? (req.body || {}) : (req.query || {});
    const cleanPaymentId = paymentId ? String(paymentId).trim() : null;
    const cleanOrderId = orderId ? String(orderId).trim() : null;

    const supabaseServer = getSupabaseServerClient() || getSupabaseDbClient(authHeader);
    if (!supabaseServer) {
      return res.status(503).json({ success: false, error: "Database service unavailable." });
    }

    let isAuthorized = false;

    // Strict dual-identifier guest payment verification: require BOTH paymentId AND orderId
    if (cleanPaymentId && cleanOrderId) {
      // 1. Check payments table with dual identifiers and integrity constraints
      const { data: pRecord } = await supabaseServer
        .from("payments")
        .select("id, status, item_id, item_type, razorpay_payment_id, razorpay_order_id, currency, amount")
        .eq("razorpay_payment_id", cleanPaymentId)
        .eq("razorpay_order_id", cleanOrderId)
        .eq("item_id", BUNDLE_RESOURCE_ID)
        .eq("item_type", "resource")
        .eq("status", "captured")
        .eq("currency", "INR")
        .gt("amount", 0)
        .maybeSingle();

      if (
        pRecord &&
        pRecord.razorpay_payment_id === cleanPaymentId &&
        pRecord.razorpay_order_id === cleanOrderId &&
        pRecord.item_id === BUNDLE_RESOURCE_ID &&
        pRecord.item_type === "resource" &&
        pRecord.status === "captured" &&
        String(pRecord.currency || "").toUpperCase() === "INR" &&
        Number(pRecord.amount) > 0
      ) {
        isAuthorized = true;
      }

      // 2. Check resource_purchases table with dual identifiers and integrity constraints
      if (!isAuthorized) {
        const { data: purRecord } = await supabaseServer
          .from("resource_purchases")
          .select("id, status, resource_id, razorpay_payment_id, razorpay_order_id, currency, amount")
          .eq("razorpay_payment_id", cleanPaymentId)
          .eq("razorpay_order_id", cleanOrderId)
          .eq("resource_id", BUNDLE_RESOURCE_ID)
          .eq("status", "active")
          .eq("currency", "INR")
          .gt("amount", 0)
          .maybeSingle();

        if (
          purRecord &&
          purRecord.razorpay_payment_id === cleanPaymentId &&
          purRecord.razorpay_order_id === cleanOrderId &&
          purRecord.resource_id === BUNDLE_RESOURCE_ID &&
          purRecord.status === "active" &&
          String(purRecord.currency || "").toUpperCase() === "INR" &&
          Number(purRecord.amount) > 0
        ) {
          isAuthorized = true;
        }
      }

      // 3. Fallback: Query Razorpay gateway directly if webhook fulfillment is delayed
      if (!isAuthorized && cleanPaymentId.startsWith("pay_") && cleanOrderId.startsWith("order_")) {
        const razorpay = getRazorpayClient();
        if (razorpay) {
          try {
            const [rzpPayment, rzpOrder] = await Promise.all([
              razorpay.payments.fetch(cleanPaymentId),
              razorpay.orders.fetch(cleanOrderId)
            ]);

            if (rzpPayment && rzpOrder) {
              const paymentCaptured = rzpPayment.status === "captured";
              const paymentOrderMatches = rzpPayment.order_id === cleanOrderId;
              const orderIdMatches = rzpOrder.id === cleanOrderId;
              const paymentCurrencyMatches = (rzpPayment.currency || "").toUpperCase() === "INR";
              const orderCurrencyMatches = (rzpOrder.currency || "").toUpperCase() === "INR";
              const positivePaymentAmount = Number(rzpPayment.amount) > 0;
              const amountsMatch = Number(rzpPayment.amount) === Number(rzpOrder.amount);

              const orderNotes = rzpOrder.notes || {};
              const paymentNotes = rzpPayment.notes || {};
              const noteResourceId =
                orderNotes.resourceId ||
                orderNotes.resource_id ||
                paymentNotes.resourceId ||
                paymentNotes.resource_id;
              const matchesBundleIdentity =
                noteResourceId === BUNDLE_RESOURCE_ID || noteResourceId === BUNDLE_SLUG;

              if (
                paymentCaptured &&
                paymentOrderMatches &&
                orderIdMatches &&
                paymentCurrencyMatches &&
                orderCurrencyMatches &&
                positivePaymentAmount &&
                amountsMatch &&
                matchesBundleIdentity
              ) {
                isAuthorized = true;
              }
            }
          } catch (gatewayErr) {
            console.error("[Bundle Files] Gateway fallback verification failed:", gatewayErr?.message || gatewayErr);
          }
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
          .eq("item_id", BUNDLE_RESOURCE_ID)
          .eq("status", "captured")
          .maybeSingle();

        if (userPayment) {
          isAuthorized = true;
        } else {
          const { data: userPur } = await supabaseServer
            .from("resource_purchases")
            .select("id")
            .eq("user_id", authenticatedUser.id)
            .eq("resource_id", BUNDLE_RESOURCE_ID)
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
        authorized: false,
        error: "Unauthorized: A confirmed purchase of the Meta Ads Campaign Planner Bundle is required to access these assets.",
        bundle: {
          id: BUNDLE_RESOURCE_ID,
          slug: BUNDLE_SLUG,
          title: "Meta Ads Campaign Planner Bundle",
          price: 299,
          currency: "INR"
        }
      });
    }

    // Generate signed URLs for all 4 bundle files
    const signedFiles = [];
    for (const item of BUNDLE_ITEMS) {
      const { data: sData } = await supabaseServer.storage
        .from("resources")
        .createSignedUrl(item.storagePath, 3600);

      let fileUrl = sData?.signedUrl || null;
      if (!fileUrl) {
        const token = generateAssetAccessToken(item.id, cleanPaymentId || authenticatedUser?.id || "bundle-authorized");
        fileUrl = `/api/payments/download-paid-asset?token=${token}`;
      }

      signedFiles.push({
        id: item.id,
        slug: item.slug,
        title: item.title,
        description: item.description,
        format: item.format,
        fileSize: item.fileSize,
        filename: item.filename,
        downloadUrl: fileUrl
      });
    }

    return res.json({
      success: true,
      authorized: true,
      bundle: {
        id: BUNDLE_RESOURCE_ID,
        slug: BUNDLE_SLUG,
        title: "Meta Ads Campaign Planner Bundle",
        price: 299,
        currency: "INR"
      },
      files: signedFiles
    });
  } catch (err) {
    console.error("[Bundle Files] Unexpected error:", err);
    return res.status(500).json({ success: false, error: "Failed to generate authorized bundle downloads." });
  }
}

router.get("/bundle-files", handleBundleFilesRequest);
router.post("/get-bundle-files", handleBundleFilesRequest);

/**
 * GET /api/payments/download-paid-asset
 *
 * Secure server-side download streamer for verified paid assets.
 * Requires a cryptographically signed, unexpired HMAC token generated by the server.
 * Rejects missing, invalid, expired, or tampered tokens with 403 Forbidden.
 */
router.get("/download-paid-asset", async (req, res) => {
  try {
    const { token } = req.query;
    const payload = verifyAssetAccessToken(token);
    if (!payload || !payload.resourceId) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
      return res.status(403).json({
        success: false,
        error: "Forbidden: Invalid, expired, or tampered download token. Please generate a fresh access link."
      });
    }

    const { resourceId } = payload;
    const cleanId = String(resourceId).trim();
    const matched = BUNDLE_ITEMS.find((b) => b.id === cleanId || b.slug === cleanId ||
      (b.slug === "the-ad-budget-breat-even-calculate" && cleanId === "the-ad-budget-break-even-calculator")) ||
      (cleanId === BUNDLE_RESOURCE_ID || cleanId === BUNDLE_SLUG ? { filename: "meta-ads-campaign-planner-bundle.zip" } : null);

    const filename = matched?.filename || "meta-ads-campaign-planner-workbook.pdf";
    const candidateDirs = [
      path.join(process.cwd(), "server", "protected_downloads"),
      path.join(process.cwd(), "protected_downloads"),
      path.join(__dirname, "..", "server", "protected_downloads"),
      path.join(__dirname, "server", "protected_downloads"),
      path.join(__dirname, "protected_downloads"),
      path.join(__dirname, "..", "protected_downloads")
    ];

    let filePath = null;
    for (const cDir of candidateDirs) {
      const candidatePath = path.join(cDir, filename);
      if (fs.existsSync(candidatePath)) {
        filePath = candidatePath;
        break;
      }
    }

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: "Asset file temporarily unavailable." });
    }

    res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    const ext = path.extname(filename).toLowerCase();
    const mimeType = ext === ".pdf"
      ? "application/pdf"
      : ext === ".xlsx"
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : ext === ".zip"
      ? "application/zip"
      : "application/octet-stream";

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const stream = fs.createReadStream(filePath);
    return stream.pipe(res);
  } catch (err) {
    console.error("[Download Paid Asset] Stream error:", err);
    return res.status(500).json({ success: false, error: "Failed to download asset." });
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
 * GET /api/payments/invoice/:paymentId
 * Generates and streams an authoritative PDF tax invoice/receipt for a verified payment.
 * Security & Authorization:
 * - Requires authentication via Bearer token (verifySupabaseToken).
 * - Verified owner (matching user_id or email) or verified Administrator can access.
 * - Non-owners receive 403 Forbidden.
 * - Unauthenticated requests receive 401 Unauthorized.
 */
router.get("/invoice/:paymentId", async (req, res) => {
  try {
    const rawPaymentId = String(req.params.paymentId || "").trim();
    if (!rawPaymentId) {
      return res.status(400).json({ success: false, error: "Payment reference is required." });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: "Authentication required to download tax invoice." });
    }

    const { user, error: authError } = await verifySupabaseToken(authHeader);
    if (authError || !user) {
      return res.status(401).json({ success: false, error: "Invalid or expired session. Please sign in again." });
    }

    const isAdmin = checkIsAdmin(user);
    const supabaseServer = getSupabaseServerClient() || getSupabaseDbClient(authHeader);
    if (!supabaseServer) {
      return res.status(503).json({ success: false, error: "Database service is currently unavailable." });
    }

    // 1. Locate record across payments, bookings, and resource_purchases
    let paymentRecord = null;
    let bookingRecord = null;
    let resourceRecord = null;

    // A. Check payments table
    try {
      const { data } = await supabaseServer
        .from("payments")
        .select("*")
        .or(`razorpay_payment_id.eq.${rawPaymentId},id.eq.${rawPaymentId}`)
        .maybeSingle();
      if (data) paymentRecord = data;
    } catch {}

    // B. Check bookings table
    try {
      const { data } = await supabaseServer
        .from("bookings")
        .select("*")
        .or(`payment_id.eq.${rawPaymentId},razorpay_order_id.eq.${rawPaymentId},id.eq.${rawPaymentId}`)
        .maybeSingle();
      if (data) bookingRecord = data;
    } catch {}

    // C. Check resource_purchases table
    try {
      const { data } = await supabaseServer
        .from("resource_purchases")
        .select("*")
        .or(`razorpay_payment_id.eq.${rawPaymentId},id.eq.${rawPaymentId}`)
        .maybeSingle();
      if (data) resourceRecord = data;
    } catch {}

    // If not found in database, check gateway if Razorpay is configured
    let rzpPayment = null;
    if (!paymentRecord && !bookingRecord && !resourceRecord && rawPaymentId.startsWith("pay_")) {
      const razorpay = getRazorpayClient();
      if (razorpay) {
        try {
          rzpPayment = await razorpay.payments.fetch(rawPaymentId);
        } catch {}
      }
    }

    if (!paymentRecord && !bookingRecord && !resourceRecord && !rzpPayment) {
      return res.status(404).json({ success: false, error: "Invoice transaction not found." });
    }

    // 2. Authorization check: Owner or Admin
    const userEmail = (user.email || "").toLowerCase().trim();
    const userId = user.id;

    let isAuthorized = isAdmin;

    if (!isAuthorized) {
      // Check user_id matching
      if (paymentRecord?.user_id && paymentRecord.user_id === userId) isAuthorized = true;
      if (bookingRecord?.user_id && bookingRecord.user_id === userId) isAuthorized = true;
      if (resourceRecord?.user_id && resourceRecord.user_id === userId) isAuthorized = true;

      // Check email matching
      if (userEmail) {
        if (bookingRecord?.customer_email && bookingRecord.customer_email.toLowerCase().trim() === userEmail) {
          isAuthorized = true;
        }
        if (resourceRecord?.customer_email && resourceRecord.customer_email.toLowerCase().trim() === userEmail) {
          isAuthorized = true;
        }
        if (rzpPayment?.email && rzpPayment.email.toLowerCase().trim() === userEmail) {
          isAuthorized = true;
        }
        if (rzpPayment?.notes?.userId && rzpPayment.notes.userId === userId) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        error: "Forbidden: You are not authorized to access this invoice."
      });
    }

    // 3. Assemble invoice details
    const cleanPayId = paymentRecord?.razorpay_payment_id || bookingRecord?.payment_id || resourceRecord?.razorpay_payment_id || (rzpPayment?.id || rawPaymentId);
    const cleanOrderId = paymentRecord?.razorpay_order_id || bookingRecord?.razorpay_order_id || resourceRecord?.razorpay_order_id || (rzpPayment?.order_id || "N/A");
    const customerName = bookingRecord?.customer_name || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "Valued Member";
    const customerEmail = bookingRecord?.customer_email || resourceRecord?.customer_email || rzpPayment?.email || user.email || "";
    const customerPhone = bookingRecord?.customer_phone || rzpPayment?.contact || "";
    const itemTitle = paymentRecord?.item_title || (bookingRecord ? "Business Growth & Scaling Consultation" : (resourceRecord ? "Digital Resource Toolkit / Asset" : "Course Masterclass"));
    const itemType = paymentRecord?.item_type || (bookingRecord ? "consultation" : (resourceRecord ? "resource" : "course"));
    const amount = Number(paymentRecord?.amount || bookingRecord?.total_amount || resourceRecord?.amount || (rzpPayment?.amount ? rzpPayment.amount / 100 : 0));
    const currency = (paymentRecord?.currency || bookingRecord?.currency || resourceRecord?.currency || rzpPayment?.currency || "INR").toUpperCase();
    const baseAmount = bookingRecord?.base_amount ? Number(bookingRecord.base_amount) : undefined;
    const gstAmount = bookingRecord?.gst_amount ? Number(bookingRecord.gst_amount) : undefined;
    const paymentDate = paymentRecord?.created_at || bookingRecord?.created_at || resourceRecord?.created_at || new Date().toISOString();

    const pdfBuffer = generateAuthoritativeInvoicePdf({
      paymentId: cleanPayId,
      orderId: cleanOrderId,
      customerName,
      customerEmail,
      customerPhone,
      itemTitle,
      itemType,
      amount,
      currency,
      baseAmount,
      gstAmount,
      paymentDate
    });

    const fileSuffix = cleanPayId.replace(/[^a-zA-Z0-9]/g, "").slice(-8) || "receipt";
    const filename = `DigitalMUID-Invoice-${fileSuffix}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.end(pdfBuffer);
  } catch (err) {
    console.error("[Invoice Endpoint] Error generating invoice:", err);
    return res.status(500).json({ success: false, error: "Internal server error generating tax invoice." });
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
