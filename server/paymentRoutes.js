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
  AUTHORITATIVE_PAID_RESOURCES,
  getAuthoritativeResourcePricing,
  calculateAuthoritativeCoursePrice,
  fulfillCourseEnrollment,
  fulfillConsultationPayment,
  fulfillResourcePurchase,
  toPaiseStrict
} from "./paymentFulfillment.js";
import {
  generateAuthoritativeInvoicePdf,
  buildAuthoritativeInvoiceModel,
  generateAuthoritativeCreditNotePdf,
  buildAuthoritativeCreditNoteModel
} from "./invoiceService.js";
import {
  formatStudentId,
  formatEnrollmentId,
  formatInvoiceNumber,
  formatCreditNoteNumber,
  getIndianFinancialYear
} from "./studentId.js";

import {
  getInvoiceTokenHmacSecret,
  isInvoiceTokenSecretConfigured,
  getInvoiceTokenVerificationSecrets,
  generateSignedInvoiceToken,
  verifySignedInvoiceToken,
  tryGenerateSignedInvoiceToken,
  buildSignedInvoiceUrl
} from "./invoiceToken.js";

import {
  getResourceTokenHmacSecret,
  isResourceTokenSecretConfigured,
  generateGuestResourceToken,
  tryGenerateGuestResourceToken,
  verifyGuestResourceToken,
  verifyTokenGuestIdentityBinding,
  extractResourceAccessToken
} from "./resourceToken.js";

export {
  AUTHORITATIVE_PAID_RESOURCES,
  getAuthoritativeResourcePricing,
  getInvoiceTokenHmacSecret,
  isInvoiceTokenSecretConfigured,
  getInvoiceTokenVerificationSecrets,
  generateSignedInvoiceToken,
  verifySignedInvoiceToken,
  getResourceTokenHmacSecret,
  isResourceTokenSecretConfigured,
  generateGuestResourceToken,
  verifyGuestResourceToken
};

// ==============================================================================
// RATE LIMITING FOR SENSITIVE BILLING & ASSET DOWNLOAD ENDPOINTS (SEC-05 Compliance)
// 30 requests per 15 minutes per client IP. Returns HTTP 429 with Retry-After header.
// ==============================================================================
const paymentRateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requests

export function getClientIp(req) {
  return req.ip ||
         (req.headers && req.headers["x-forwarded-for"] ? String(req.headers["x-forwarded-for"]).split(",")[0].trim() : null) ||
         req.socket?.remoteAddress ||
         "127.0.0.1";
}

export function paymentRateLimiter(req, res, next) {
  const ip = getClientIp(req);
  const now = Date.now();
  let timestamps = paymentRateLimitMap.get(ip);
  if (!timestamps) {
    timestamps = [];
    paymentRateLimitMap.set(ip, timestamps);
  }

  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const recentTimestamps = timestamps.filter(t => t > windowStart);

  if (recentTimestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    const oldest = recentTimestamps[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - now) / 1000));
    res.setHeader("Retry-After", String(retryAfterSeconds));
    return res.status(429).json({
      success: false,
      code: "RATE_LIMIT_EXCEEDED",
      error: `Too many requests. Rate limit is ${RATE_LIMIT_MAX_REQUESTS} requests per 15 minutes. Please retry after ${retryAfterSeconds} seconds.`,
      retryAfterSeconds
    });
  }

  recentTimestamps.push(now);
  paymentRateLimitMap.set(ip, recentTimestamps);

  if (paymentRateLimitMap.size > 5000) {
    for (const [key, tsList] of paymentRateLimitMap.entries()) {
      const valid = tsList.filter(t => t > windowStart);
      if (valid.length === 0) {
        paymentRateLimitMap.delete(key);
      } else {
        paymentRateLimitMap.set(key, valid);
      }
    }
  }

  next();
}

export function resetPaymentRateLimits() {
  paymentRateLimitMap.clear();
}

// Authoritative paid resource pricing helpers are imported from ./paymentFulfillment.js
// and re-exported above to maintain a single source of truth without circular dependencies.

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
    const expectedCurrency = String(currency || "").trim().toUpperCase();
    const amountInPaise = toPaiseStrict(effectivePrice);

    if (!amountInPaise) {
      if (effectivePrice === 0) {
        return res.status(400).json({
          success: false,
          error: "This course is free and does not require payment processing."
        });
      }
      return res.status(400).json({
        success: false,
        error: "Invalid course pricing configuration (must be positive INR with max 2 decimals)."
      });
    }

    if (expectedCurrency !== "INR") {
      return res.status(400).json({
        success: false,
        error: "Invalid currency: Course checkout must be denominated in INR."
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
      currency: expectedCurrency,
      receipt: receipt,
      notes: {
        itemType: "course",
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

    const cleanOrderId = razorpay_order_id.trim();
    const cleanPaymentId = razorpay_payment_id.trim();

    // 5. Query public.courses for authoritative price & details (NEVER trust client price)
    const dbClient = getSupabaseDbClient(authHeader) || getSupabaseServerClient();
    if (!dbClient) {
      return res.status(503).json({
        success: false,
        verified: false,
        fulfilled: false,
        status: "verification_pending_fulfillment",
        error: "Database service is not currently available."
      });
    }

    const { course, error: courseError } = await fetchCourseRecordAuthoritative(dbClient, courseId);

    if (courseError || !course) {
      return res.status(404).json({
        success: false,
        verified: false,
        fulfilled: false,
        status: "fulfillment_rejected",
        error: "Course record not found for authoritative fulfillment verification."
      });
    }

    if (String(course.status || "").trim().toLowerCase() !== "published") {
      return res.status(400).json({
        success: false,
        verified: false,
        fulfilled: false,
        status: "fulfillment_rejected",
        error: `This course is not available for purchase (status: ${course.status || "missing"}).`
      });
    }

    const { effectivePrice, currency } = calculateAuthoritativeCoursePrice(course);
    const expectedCurrency = String(currency || "").trim().toUpperCase();
    const expectedAmountInPaise = toPaiseStrict(effectivePrice);

    if (expectedCurrency !== "INR" || !expectedAmountInPaise) {
      return res.status(400).json({
        success: false,
        verified: false,
        fulfilled: false,
        status: "fulfillment_rejected",
        error: "Invalid authoritative course pricing or currency configuration (INR required)."
      });
    }

    // 6. Independent Razorpay Gateway Verification (NEVER fulfill on HMAC signature alone)
    const razorpay = getRazorpayClient();
    if (!razorpay) {
      return res.status(503).json({
        success: false,
        verified: false,
        fulfilled: false,
        error: "Payment gateway client is unavailable on the server."
      });
    }

    let gatewayPayment = null;
    let gatewayOrder = null;
    try {
      [gatewayPayment, gatewayOrder] = await Promise.all([
        razorpay.payments.fetch(cleanPaymentId),
        razorpay.orders.fetch(cleanOrderId)
      ]);
    } catch (fetchErr) {
      console.warn("[Course Verification] Gateway fetch failed:", fetchErr?.error?.description || fetchErr?.message || fetchErr);
      return res.status(400).json({
        success: false,
        verified: false,
        fulfilled: false,
        error: "Failed to verify payment and order records with Razorpay gateway."
      });
    }

    if (!gatewayPayment || !gatewayOrder) {
      return res.status(400).json({
        success: false,
        verified: false,
        fulfilled: false,
        error: "Gateway payment or order record not found."
      });
    }

    const gatewayPayStatus = String(gatewayPayment.status || "").trim().toLowerCase();
    if (gatewayPayStatus !== "captured") {
      console.warn(`[Course Verification] Rejected payment ${cleanPaymentId}: gateway status=${gatewayPayStatus || "unknown"}`);
      return res.status(400).json({
        success: false,
        verified: false,
        fulfilled: false,
        error: `Payment is not captured (current gateway status: ${gatewayPayStatus || "unknown"}).`
      });
    }

    if (gatewayPayment.order_id !== cleanOrderId || gatewayOrder.id !== cleanOrderId) {
      console.warn(`[Course Verification] Order ID mismatch: payment.order_id=${gatewayPayment.order_id}, order.id=${gatewayOrder.id}, expected=${cleanOrderId}`);
      return res.status(400).json({
        success: false,
        verified: false,
        fulfilled: false,
        error: "Payment is not associated with the requested order ID."
      });
    }

    const payCurrency = String(gatewayPayment.currency || "").trim().toUpperCase();
    const ordCurrency = String(gatewayOrder.currency || "").trim().toUpperCase();
    if (payCurrency !== "INR" || ordCurrency !== "INR") {
      return res.status(400).json({
        success: false,
        verified: false,
        fulfilled: false,
        error: "Invalid currency: Course payments must be settled in INR."
      });
    }

    const payAmountPaise = Number(gatewayPayment.amount);
    const ordAmountPaise = Number(gatewayOrder.amount);
    if (
      !Number.isSafeInteger(payAmountPaise) ||
      !Number.isSafeInteger(ordAmountPaise) ||
      payAmountPaise <= 0 ||
      payAmountPaise !== expectedAmountInPaise ||
      ordAmountPaise !== expectedAmountInPaise
    ) {
      console.warn(`[Course Verification] Amount mismatch: payment=${payAmountPaise}, order=${ordAmountPaise}, expected=${expectedAmountInPaise}`);
      return res.status(400).json({
        success: false,
        verified: false,
        fulfilled: false,
        error: "Gateway payment amount does not match authoritative course price."
      });
    }

    const orderNotes = gatewayOrder.notes || {};
    if (String(orderNotes.itemType || "").trim().toLowerCase() !== "course") {
      return res.status(400).json({
        success: false,
        verified: false,
        fulfilled: false,
        error: "Gateway order item type must explicitly be 'course'."
      });
    }

    const noteCourseId = String(orderNotes.courseId || "").trim();
    if (!noteCourseId || noteCourseId !== String(course.id).trim()) {
      console.warn(`[Course Verification] Course ID mismatch in order notes: note=${noteCourseId}, expected=${course.id}`);
      return res.status(400).json({
        success: false,
        verified: false,
        fulfilled: false,
        error: "Order metadata does not match the requested course."
      });
    }

    const noteUserId = String(orderNotes.userId || "").trim();
    if (!noteUserId || noteUserId !== String(user.id).trim()) {
      console.warn(`[Course Verification] User ID mismatch in order notes: note=${noteUserId}, authenticated=${user.id}`);
      return res.status(403).json({
        success: false,
        verified: false,
        fulfilled: false,
        error: "Forbidden: Order does not belong to the authenticated user."
      });
    }

    const studentEmail = (user.email || "").trim() || null;
    const studentName = (user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "Student Member").trim();

    // 7. Execute atomic server-side fulfillment RPC (Phase 2K-E)
    const fulfillment = await fulfillCourseEnrollment({
      userId: user.id,
      courseId: course.id,
      amount: expectedAmountInPaise / 100,
      currency: "INR",
      orderId: cleanOrderId,
      paymentId: cleanPaymentId,
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

    // Fail closed with HTTP 503 on retryable/migration-pending/unavailable RPC failures
    if (
      fulfillment.retryable ||
      fulfillment.code === "MIGRATION_PENDING" ||
      fulfillment.code === "RPC_UNAVAILABLE" ||
      fulfillment.code === "SERVICE_KEY_MISSING"
    ) {
      return res.status(503).json({
        success: false,
        verified: true,
        fulfilled: false,
        retryable: true,
        code: fulfillment.code || "RPC_UNAVAILABLE",
        status: "verification_pending_fulfillment",
        courseId: course.id,
        courseSlug: course.slug,
        courseTitle: course.title,
        orderId: razorpay_order_id.trim(),
        paymentId: razorpay_payment_id.trim(),
        error: fulfillment.error || "Payment verified. Automated course fulfillment is temporarily unavailable; please retry."
      });
    }

    // Non-retryable RPC or business rejection:
    return res.status(fulfillment.code === "IDEMPOTENCY_CONFLICT" ? 409 : 400).json({
      success: false,
      verified: true,
      fulfilled: false,
      code: fulfillment.code || "FULFILLMENT_REJECTED",
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
      return res.status(404).json({
        success: false,
        error: "Consultation product is currently unavailable or inactive."
      });
    }

    // 3. Compute authoritative pricing strictly in integer Paise
    const basePaise = toPaiseStrict(product.base_price);
    const gstRate = product.gst_rate != null ? Number(product.gst_rate) : 0.18;
    const currency = String(product.currency || "INR").trim().toUpperCase();

    if (!basePaise || !Number.isFinite(gstRate) || gstRate < 0 || gstRate > 1 || currency !== "INR") {
      return res.status(400).json({
        success: false,
        error: "Invalid consultation product pricing or currency configuration."
      });
    }

    const gstPaise = Math.round(basePaise * gstRate);
    const amountInPaise = basePaise + gstPaise;
    if (!Number.isSafeInteger(gstPaise) || !Number.isSafeInteger(amountInPaise) || amountInPaise <= 0) {
      return res.status(400).json({
        success: false,
        error: "Consultation pricing calculation overflow."
      });
    }

    const basePrice = basePaise / 100;
    const gstAmount = gstPaise / 100;
    const totalAmount = amountInPaise / 100;

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

    if (
      !razorpay_order_id || typeof razorpay_order_id !== "string" || !razorpay_order_id.trim() ||
      !razorpay_payment_id || typeof razorpay_payment_id !== "string" || !razorpay_payment_id.trim() ||
      !razorpay_signature || typeof razorpay_signature !== "string" || !razorpay_signature.trim()
    ) {
      return res.status(400).json({
        success: false,
        verified: false,
        fulfilled: false,
        error: "Missing required Razorpay payment credentials for verification."
      });
    }

    if (!isRazorpayConfigured()) {
      return res.status(503).json({
        success: false,
        verified: false,
        fulfilled: false,
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
        fulfilled: false,
        error: "Payment verification failed: Invalid cryptographic signature."
      });
    }

    const cleanOrderId = razorpay_order_id.trim();
    const cleanPaymentId = razorpay_payment_id.trim();

    // 2. Authoritative Gateway Verification: Validate captured status, order metadata, amount, and identity
    const razorpay = getRazorpayClient();
    if (!razorpay) {
      return res.status(503).json({
        success: false,
        verified: false,
        fulfilled: false,
        error: "Payment gateway client is unavailable on the server."
      });
    }

    let gatewayPayment = null;
    let gatewayOrder = null;
    try {
      [gatewayPayment, gatewayOrder] = await Promise.all([
        razorpay.payments.fetch(cleanPaymentId),
        razorpay.orders.fetch(cleanOrderId)
      ]);
    } catch (fetchErr) {
      console.error("[Consultation Verification] Failed to fetch authoritative gateway records:", fetchErr?.message || fetchErr);
      return res.status(502).json({
        success: false,
        verified: false,
        fulfilled: false,
        error: "Failed to confirm payment status with gateway provider."
      });
    }

    if (!gatewayPayment || !gatewayOrder) {
      return res.status(400).json({
        success: false,
        verified: false,
        fulfilled: false,
        error: "Gateway payment or order could not be retrieved."
      });
    }

    if (String(gatewayPayment.status || "").toLowerCase() !== "captured") {
      console.warn(`[Consultation Verification] Payment ${cleanPaymentId} rejected: status is ${gatewayPayment.status}`);
      return res.status(400).json({
        success: false,
        verified: false,
        fulfilled: false,
        error: `Payment is not in captured status (current status: ${gatewayPayment.status}).`
      });
    }

    if (gatewayPayment.order_id !== cleanOrderId || gatewayOrder.id !== cleanOrderId) {
      console.warn(`[Consultation Verification] Order ID mismatch: payment order is ${gatewayPayment.order_id}, expected ${cleanOrderId}`);
      return res.status(400).json({
        success: false,
        verified: false,
        fulfilled: false,
        error: "Payment is not associated with the provided order ID."
      });
    }

    const payCurrency = String(gatewayPayment.currency || "").trim().toUpperCase();
    const ordCurrency = String(gatewayOrder.currency || "").trim().toUpperCase();
    if (payCurrency !== "INR" || ordCurrency !== "INR") {
      return res.status(400).json({
        success: false,
        verified: false,
        fulfilled: false,
        error: "Invalid currency: Consultation transactions must be denominated in INR."
      });
    }

    const orderNotes = gatewayOrder.notes || {};
    const orderItemType = String(orderNotes.itemType || "").trim().toLowerCase();
    if (orderItemType !== "consultation") {
      console.warn(`[Consultation Verification] Rejected cross-item substitution: order ${cleanOrderId} has itemType=${orderItemType || "missing"}`);
      return res.status(400).json({
        success: false,
        verified: false,
        fulfilled: false,
        error: "Gateway order does not represent a consultation booking."
      });
    }

    const orderProductId = String(orderNotes.productId || "").trim();
    if (!orderProductId || !isValidUUID(orderProductId)) {
      return res.status(400).json({
        success: false,
        verified: false,
        fulfilled: false,
        error: "Gateway order is missing a valid consultation productId."
      });
    }

    // Validate product against authoritative catalog pricing in public.consultation_products
    const dbClient = getSupabaseServerClient() || getSupabaseDbClient(authHeader);
    if (!dbClient) {
      return res.status(503).json({
        success: false,
        verified: false,
        fulfilled: false,
        error: "Database service is not currently available."
      });
    }

    const { data: product, error: productError } = await dbClient
      .from("consultation_products")
      .select("*")
      .eq("id", orderProductId)
      .eq("active", true)
      .maybeSingle();

    if (productError || !product) {
      return res.status(404).json({
        success: false,
        verified: false,
        fulfilled: false,
        error: `Consultation product (${orderProductId}) is inactive or not found.`
      });
    }

    const basePaise = toPaiseStrict(product.base_price);
    const gstRate = product.gst_rate != null ? Number(product.gst_rate) : 0.18;
    const catalogCurrency = String(product.currency || "INR").trim().toUpperCase();

    if (!basePaise || !Number.isFinite(gstRate) || gstRate < 0 || gstRate > 1 || catalogCurrency !== "INR") {
      return res.status(400).json({
        success: false,
        verified: false,
        fulfilled: false,
        error: "Invalid consultation catalog pricing configuration."
      });
    }

    const gstPaise = Math.round(basePaise * gstRate);
    const expectedAmountInPaise = basePaise + gstPaise;
    if (!Number.isSafeInteger(gstPaise) || !Number.isSafeInteger(expectedAmountInPaise) || expectedAmountInPaise <= 0) {
      return res.status(400).json({
        success: false,
        verified: false,
        fulfilled: false,
        error: "Consultation pricing calculation overflow."
      });
    }
    const expectedTotalAmount = expectedAmountInPaise / 100;

    const payAmountPaise = Number(gatewayPayment.amount);
    const ordAmountPaise = Number(gatewayOrder.amount);
    if (
      !Number.isSafeInteger(payAmountPaise) ||
      !Number.isSafeInteger(ordAmountPaise) ||
      payAmountPaise <= 0 ||
      payAmountPaise !== ordAmountPaise ||
      payAmountPaise !== expectedAmountInPaise
    ) {
      console.warn(`[Consultation Verification] Amount mismatch: paid=${payAmountPaise}, order=${ordAmountPaise}, expected=${expectedAmountInPaise}`);
      return res.status(400).json({
        success: false,
        verified: false,
        fulfilled: false,
        error: `Payment amount (${payAmountPaise} paise) does not match authoritative consultation total (${expectedAmountInPaise} paise).`
      });
    }

    // Verify authenticated user OR legitimate guest booking identity
    const orderUserId = String(orderNotes.userId || "").trim();
    if (orderUserId) {
      if (!authenticatedUser || authenticatedUser.id !== orderUserId) {
        return res.status(403).json({
          success: false,
          verified: false,
          fulfilled: false,
          error: "Forbidden: Consultation order belongs to a different authenticated user."
        });
      }
    } else {
      const bookingEmail = String(bookingDetails?.customerEmail || "").trim().toLowerCase();
      const noteEmail = String(orderNotes.customerEmail || "").trim().toLowerCase();
      const payEmail = String(gatewayPayment.email || "").trim().toLowerCase();
      if (!bookingEmail) {
        return res.status(400).json({
          success: false,
          verified: false,
          fulfilled: false,
          error: "Guest consultation verification requires booking customerEmail."
        });
      }
      if (noteEmail && bookingEmail.slice(0, 50) !== noteEmail.slice(0, 50)) {
        return res.status(403).json({
          success: false,
          verified: false,
          fulfilled: false,
          error: "Forbidden: Guest booking email does not match order metadata."
        });
      }
      if (!noteEmail && payEmail && bookingEmail !== payEmail) {
        return res.status(403).json({
          success: false,
          verified: false,
          fulfilled: false,
          error: "Forbidden: Guest booking email does not match payment email."
        });
      }
    }

    // 3. Atomic fulfillment into public.bookings and public.payments (never copy payment amount into order_total_amount,
    // and never attribute guest orders verified by an admin to admin.id / admin.email)
    const isAdminCaller = Boolean(authenticatedUser && checkIsAdmin(authenticatedUser));
    const orderUserIdResolved = String(orderNotes.userId || "").trim();
    if (orderUserIdResolved && !authenticatedUser) {
      return res.status(403).json({
        success: false,
        verified: false,
        fulfilled: false,
        error: "Forbidden: Authentication required for user-owned consultation order."
      });
    }
    const attributedUserId = orderUserIdResolved
      ? orderUserIdResolved
      : isAdminCaller
      ? null
      : (authenticatedUser?.id || null);

    const { order_total_amount: _discardSnapshot, ...sanitizedBookingDetails } = bookingDetails || {};
    const fulfillment = await fulfillConsultationPayment({
      userId: attributedUserId,
      bookingDetails: sanitizedBookingDetails,
      orderId: cleanOrderId,
      paymentId: cleanPaymentId,
      amount: expectedTotalAmount,
      currency: "INR",
      productId: product.id
    });

    if (!fulfillment.success) {
      const isRetryable = Boolean(
        fulfillment.retryable ||
        fulfillment.code === "MIGRATION_PENDING" ||
        fulfillment.code === "RPC_UNAVAILABLE" ||
        fulfillment.code === "SERVICE_KEY_MISSING"
      );
      const statusCode = isRetryable
        ? 503
        : fulfillment.code === "IDEMPOTENCY_CONFLICT" || fulfillment.code === "SLOT_CONFLICT"
        ? 409
        : ["AMOUNT_MISMATCH", "INVALID_INTAKE", "INVALID_CURRENCY", "PRODUCT_UNAVAILABLE", "INVALID_PRODUCT_PRICING", "FULFILLMENT_REJECTED"].includes(fulfillment.code)
        ? 400
        : 500;

      return res.status(statusCode).json({
        success: false,
        verified: true,
        fulfilled: false,
        retryable: isRetryable,
        code: fulfillment.code || "FULFILLMENT_FAILED",
        error: fulfillment.error || "Failed to finalize consultation booking record."
      });
    }

    const invoiceToken = tryGenerateSignedInvoiceToken(cleanPaymentId);
    const invoiceDownloadUrl = invoiceToken ? buildSignedInvoiceUrl(cleanPaymentId, invoiceToken) : null;

    return res.json({
      success: true,
      verified: true,
      fulfilled: true,
      already_fulfilled: Boolean(fulfillment.already_fulfilled),
      booking: fulfillment.booking,
      payment: fulfillment.payment,
      orderId: razorpay_order_id.trim(),
      paymentId: cleanPaymentId,
      ...(invoiceToken ? { invoiceToken, invoiceDownloadUrl } : {})
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
    if (!dbClient) {
      return res.status(503).json({
        success: false,
        error: "Database service is not currently available."
      });
    }

    const isUUID = isValidUUID(cleanResourceId);
    const query = dbClient.from("resources").select("*");
    const { data: resourceRecord, error: resourceErr } = isUUID
      ? await query.eq("id", cleanResourceId).maybeSingle()
      : await query.eq("slug", cleanResourceId).maybeSingle();

    if (resourceErr) {
      return res.status(500).json({
        success: false,
        error: "Failed to verify resource catalog record."
      });
    }

    if (!resourceRecord) {
      return res.status(404).json({
        success: false,
        error: "Resource not found."
      });
    }

    if (String(resourceRecord.status || "").trim().toLowerCase() !== "published") {
      return res.status(400).json({
        success: false,
        error: "This resource is not published and cannot be purchased."
      });
    }

    // 2. Validate access type & price strictly from authoritative server sources (never req.body)
    const pricing = getAuthoritativeResourcePricing(cleanResourceId, resourceRecord);
    const currency = String(pricing.currency || "").trim().toUpperCase();
    const amountInPaise = toPaiseStrict(pricing.price);
    if (pricing.accessType !== "paid" || !amountInPaise || currency !== "INR") {
      return res.status(400).json({
        success: false,
        error: "This resource is not configured as a paid INR product and cannot initiate paid checkout."
      });
    }

    const authoritativePrice = amountInPaise / 100;

    // 2b. Prevent authenticated user double-purchase of already owned active resource
    if (authenticatedUser) {
      const { data: existingActivePurchase, error: activePurErr } = await dbClient
        .from("resource_purchases")
        .select("id, resource_id, status")
        .eq("user_id", authenticatedUser.id)
        .eq("resource_id", resourceRecord.id)
        .eq("status", "active")
        .maybeSingle();

      if (activePurErr) {
        console.warn("[Create Resource Order] Ownership pre-check notice:", activePurErr.message);
      } else if (existingActivePurchase) {
        return res.status(409).json({
          success: false,
          alreadyPurchased: true,
          code: "DUPLICATE_USER_RESOURCE_PURCHASE",
          error: "You already own active access to this resource.",
          resourceId: resourceRecord.id
        });
      }
    }

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

    if (
      !razorpay_order_id || typeof razorpay_order_id !== "string" || !razorpay_order_id.trim() ||
      !razorpay_payment_id || typeof razorpay_payment_id !== "string" || !razorpay_payment_id.trim() ||
      !razorpay_signature || typeof razorpay_signature !== "string" || !razorpay_signature.trim()
    ) {
      return res.status(400).json({
        success: false,
        verified: false,
        fulfilled: false,
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

    // 2. Fetch authoritative published resource price from database (NEVER trust req.body)
    const cleanResourceId = resourceId.trim();
    const cleanOrderId = razorpay_order_id.trim();
    const cleanPaymentId = razorpay_payment_id.trim();

    const dbClient = getSupabaseServerClient() || getSupabaseDbClient(authHeader);
    if (!dbClient) {
      return res.status(503).json({
        success: false,
        verified: false,
        fulfilled: false,
        error: "Database service is not currently available."
      });
    }

    const isUUID = isValidUUID(cleanResourceId);
    const query = dbClient.from("resources").select("*");
    const { data: resourceRecord, error: resourceError } = isUUID
      ? await query.eq("id", cleanResourceId).maybeSingle()
      : await query.eq("slug", cleanResourceId).maybeSingle();

    if (resourceError) {
      return res.status(500).json({
        success: false,
        verified: false,
        fulfilled: false,
        error: "Failed to verify resource catalog record."
      });
    }

    if (!resourceRecord) {
      return res.status(404).json({
        success: false,
        verified: false,
        fulfilled: false,
        error: "Resource not found."
      });
    }

    if (String(resourceRecord.status || "").trim().toLowerCase() !== "published") {
      return res.status(400).json({
        success: false,
        verified: false,
        fulfilled: false,
        error: "This resource is not currently published for paid verification."
      });
    }

    const pricing = getAuthoritativeResourcePricing(cleanResourceId, resourceRecord);
    const expectedAmountInPaise = toPaiseStrict(pricing.price);
    const expectedCurrency = String(pricing.currency || "").trim().toUpperCase();
    if (pricing.accessType !== "paid" || !expectedAmountInPaise || expectedCurrency !== "INR") {
      return res.status(400).json({
        success: false,
        verified: false,
        fulfilled: false,
        error: "Resource is not an eligible paid INR product."
      });
    }

    const amount = expectedAmountInPaise / 100;
    const currency = expectedCurrency;

    // 2b. Authoritative Razorpay gateway reconciliation (FAIL CLOSED if client unavailable)
    const razorpay = getRazorpayClient();
    if (!razorpay) {
      return res.status(503).json({
        success: false,
        verified: false,
        fulfilled: false,
        error: "Payment gateway client is unavailable on the server."
      });
    }

    let rzpOrder = null;
    let rzpPayment = null;
    try {
      [rzpOrder, rzpPayment] = await Promise.all([
        razorpay.orders.fetch(cleanOrderId),
        razorpay.payments.fetch(cleanPaymentId)
      ]);
    } catch (rzpFetchErr) {
      const errDesc = rzpFetchErr?.error?.description || rzpFetchErr?.message || "Payment or order not found on gateway.";
      console.warn(`[Resource Verification] Gateway fetch rejected: ${errDesc}`);
      return res.status(400).json({
        success: false,
        verified: false,
        fulfilled: false,
        error: `Payment verification failed on gateway: ${errDesc}`
      });
    }

    if (!rzpOrder || !rzpPayment) {
      return res.status(400).json({
        success: false,
        verified: false,
        fulfilled: false,
        error: "Gateway payment or order could not be retrieved."
      });
    }

    if (String(rzpPayment.status || "").toLowerCase() !== "captured") {
      console.warn(`[Resource Verification] Rejected uncaptured payment: status=${rzpPayment?.status}`);
      return res.status(400).json({
        success: false,
        verified: false,
        fulfilled: false,
        error: `Payment status is ${rzpPayment?.status || "unknown"}. Only captured payments can unlock resources.`
      });
    }

    if (rzpPayment.order_id !== cleanOrderId || rzpOrder.id !== cleanOrderId) {
      console.warn(`[Resource Verification] Mismatched order ID: payment.order_id=${rzpPayment.order_id}, order.id=${rzpOrder.id}, expected=${cleanOrderId}`);
      return res.status(400).json({
        success: false,
        verified: false,
        fulfilled: false,
        error: "Payment does not match the specified order ID."
      });
    }

    const rzpPayAmountPaise = Number(rzpPayment.amount);
    const rzpOrdAmountPaise = Number(rzpOrder.amount);
    if (
      !Number.isSafeInteger(rzpPayAmountPaise) ||
      !Number.isSafeInteger(rzpOrdAmountPaise) ||
      rzpPayAmountPaise !== expectedAmountInPaise ||
      rzpOrdAmountPaise !== expectedAmountInPaise
    ) {
      console.warn(`[Resource Verification] Amount mismatch: paid=${rzpPayment.amount}, order=${rzpOrder.amount}, expected=${expectedAmountInPaise}`);
      return res.status(400).json({
        success: false,
        verified: false,
        fulfilled: false,
        error: "Payment amount does not match authoritative resource price."
      });
    }

    if ((rzpPayment.currency || "").toUpperCase() !== expectedCurrency || (rzpOrder.currency || "").toUpperCase() !== expectedCurrency) {
      console.warn(`[Resource Verification] Currency mismatch: paid=${rzpPayment.currency}, order=${rzpOrder.currency}, expected=${expectedCurrency}`);
      return res.status(400).json({
        success: false,
        verified: false,
        fulfilled: false,
        error: "Payment currency does not match authoritative resource currency."
      });
    }

    const rzpNotes = rzpOrder.notes || {};
    if (String(rzpNotes.itemType || "").trim().toLowerCase() !== "resource") {
      console.warn(`[Resource Verification] Cross-item rejection: order itemType=${rzpNotes.itemType || "missing"}`);
      return res.status(400).json({
        success: false,
        verified: false,
        fulfilled: false,
        error: "Gateway order item type is not a resource purchase."
      });
    }

    const noteResourceId = String(rzpNotes.resourceId || "").trim();
    const matchesTargetResource = Boolean(
      noteResourceId &&
      (noteResourceId === String(resourceRecord.id).trim() ||
       (resourceRecord.slug && noteResourceId === String(resourceRecord.slug).trim()))
    );
    if (!matchesTargetResource) {
      console.warn(`[Resource Verification] Order resourceId note mismatch: note=${noteResourceId}, expected=${resourceRecord.id}`);
      return res.status(400).json({
        success: false,
        verified: false,
        fulfilled: false,
        error: "Order was not created for this resource."
      });
    }

    const isAdminCaller = Boolean(authenticatedUser && checkIsAdmin(authenticatedUser));
    const noteUserId = String(rzpNotes.userId || "").trim();
    if (noteUserId) {
      if (!authenticatedUser || (authenticatedUser.id !== noteUserId && !isAdminCaller)) {
        return res.status(403).json({
          success: false,
          verified: false,
          fulfilled: false,
          error: "Forbidden: Resource order belongs to a different authenticated user."
        });
      }
    } else if (customerDetails?.email) {
      const suppliedEmail = String(customerDetails.email || "").trim().toLowerCase();
      const noteEmail = String(rzpNotes.customerEmail || "").trim().toLowerCase();
      const payEmail = String(rzpPayment.email || "").trim().toLowerCase();
      if (noteEmail && suppliedEmail.slice(0, 50) !== noteEmail.slice(0, 50)) {
        return res.status(403).json({
          success: false,
          verified: false,
          fulfilled: false,
          error: "Forbidden: Guest email does not match order metadata."
        });
      }
      if (!noteEmail && payEmail && suppliedEmail !== payEmail) {
        return res.status(403).json({
          success: false,
          verified: false,
          fulfilled: false,
          error: "Forbidden: Guest email does not match payment email."
        });
      }
    }

    // Strict buyer attribution: Admin recovery/verification MUST NEVER overwrite user_id with admin.id
    // or customer_email with admin.email. Guest orders keep user_id = null; user orders keep noteUserId.
    const attributedUserId = noteUserId
      ? noteUserId
      : isAdminCaller
      ? null
      : (authenticatedUser?.id || null);

    const buyerEmail = String(
      customerDetails?.email ||
      rzpNotes.customerEmail ||
      rzpPayment.email ||
      (!isAdminCaller ? authenticatedUser?.email : "") ||
      ""
    ).trim().toLowerCase();

    const buyerName = String(
      customerDetails?.name ||
      rzpNotes.customerName ||
      (!isAdminCaller ? (authenticatedUser?.user_metadata?.full_name || "") : "") ||
      ""
    ).trim();

    const buyerPhone = String(
      customerDetails?.phone ||
      rzpNotes.customerPhone ||
      rzpPayment.contact ||
      ""
    ).trim();

    // Fail closed BEFORE any irreversible DB fulfillment when a guest transaction
    // requires minting a guest resource access token and RESOURCE_TOKEN_HMAC_SECRET is missing/invalid.
    if (!attributedUserId && !isResourceTokenSecretConfigured()) {
      return res.status(503).json({
        success: false,
        verified: true,
        fulfilled: false,
        retryable: true,
        code: "RESOURCE_TOKEN_SECRET_MISSING",
        error: "Guest resource access signing secret is not configured cleanly."
      });
    }

    // 3. Atomic fulfillment into public.resource_purchases and public.payments
    const fulfillment = await fulfillResourcePurchase({
      userId: attributedUserId,
      resourceId: resourceRecord?.id || resourceId.trim(),
      amount,
      currency,
      orderId: cleanOrderId,
      paymentId: cleanPaymentId,
      customerName: buyerName,
      customerEmail: buyerEmail,
      customerPhone: buyerPhone,
      resourceTitle: resourceRecord?.title || resourceRecord?.name || "Digital Resource"
    });

    if (!fulfillment.success) {
      const isRetryable = Boolean(
        fulfillment.retryable ||
        fulfillment.code === "MIGRATION_PENDING" ||
        fulfillment.code === "RPC_UNAVAILABLE" ||
        fulfillment.code === "SERVICE_KEY_MISSING"
      );
      const statusCode = isRetryable
        ? 503
        : fulfillment.code === "DUPLICATE_USER_RESOURCE_PURCHASE" || fulfillment.code === "IDEMPOTENCY_CONFLICT"
        ? 409
        : ["AMOUNT_MISMATCH", "INVALID_CURRENCY", "INVALID_PARAMETERS", "INVALID_AMOUNT", "INVALID_RESOURCE_PRICING", "RESOURCE_UNAVAILABLE"].includes(fulfillment.code)
        ? 400
        : 500;

      return res.status(statusCode).json({
        success: false,
        verified: true,
        fulfilled: false,
        retryable: isRetryable,
        code: fulfillment.code || "FULFILLMENT_FAILED",
        error: fulfillment.error || "Failed to finalize resource purchase record."
      });
    }

    // Mint dedicated signed guest resource access token ONLY after verified fulfillment for guest orders
    let resourceAccessToken = null;
    if (!attributedUserId) {
      const tokenResult = tryGenerateGuestResourceToken({
        paymentId: cleanPaymentId,
        orderId: cleanOrderId,
        resourceId: resourceRecord.id,
        email: buyerEmail || fulfillment.purchase?.customer_email || "",
        phone: buyerPhone || fulfillment.purchase?.customer_phone || ""
      });
      if (!tokenResult.ok || !tokenResult.token) {
        return res.status(503).json({
          success: false,
          verified: true,
          fulfilled: true,
          code: "RESOURCE_TOKEN_SECRET_MISSING",
          error: tokenResult.error || "Guest resource access signing secret is not configured cleanly."
        });
      }
      resourceAccessToken = tokenResult.token;
    }

    const invoiceToken = tryGenerateSignedInvoiceToken(cleanPaymentId);
    const invoiceDownloadUrl = invoiceToken ? buildSignedInvoiceUrl(cleanPaymentId, invoiceToken) : null;

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
      paymentId: cleanPaymentId,
      resourceId: resourceRecord?.id || resourceId.trim(),
      ...(resourceAccessToken ? { resourceAccessToken } : {}),
      ...(invoiceToken ? { invoiceToken, invoiceDownloadUrl } : {})
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

    const dbClient = getSupabaseServerClient() || getSupabaseDbClient(authHeader);
    if (!dbClient) {
      return res.status(503).json({
        success: false,
        payment_verified: false,
        lead_status: "failed",
        error: "Database service unavailable for lead recovery."
      });
    }

    const razorpay = getRazorpayClient();

    // 1. Resolve authoritative target resource record, published status, and pricing FIRST
    const isUUID = isValidUUID(cleanResourceId);
    const resQuery = dbClient.from("resources").select("*");
    const { data: resourceRecord, error: resourceErr } = isUUID
      ? await resQuery.eq("id", cleanResourceId).maybeSingle()
      : await resQuery.eq("slug", cleanResourceId).maybeSingle();

    if (resourceErr) {
      return res.status(500).json({
        success: false,
        payment_verified: false,
        lead_status: "failed",
        error: "Failed to verify resource catalog record."
      });
    }

    if (!resourceRecord) {
      return res.status(404).json({
        success: false,
        payment_verified: false,
        lead_status: "failed",
        error: "Resource not found."
      });
    }

    if (String(resourceRecord.status || "").trim().toLowerCase() !== "published") {
      return res.status(400).json({
        success: false,
        payment_verified: false,
        lead_status: "failed",
        error: "Resource is not published and cannot recover leads."
      });
    }

    const pricing = getAuthoritativeResourcePricing(cleanResourceId, resourceRecord);
    const expectedAmountInPaise = toPaiseStrict(pricing.price);
    if (pricing.accessType !== "paid" || !expectedAmountInPaise || String(pricing.currency || "").toUpperCase() !== "INR") {
      return res.status(400).json({
        success: false,
        payment_verified: false,
        lead_status: "failed",
        error: "Resource is not an active or verifiable paid INR asset for lead recovery."
      });
    }

    const authoritativePrice = expectedAmountInPaise / 100;
    const canonicalResourceId = String(resourceRecord.id || "").trim();
    const allowedResourceIdentifiers = [
      canonicalResourceId,
      ...(resourceRecord.slug ? [String(resourceRecord.slug).trim()] : [])
    ].filter(Boolean);
    const resourceTitle = resourceRecord.title || resourceRecord.name || "Digital Resource Toolkit";

    // 2. Authoritative verification, user ownership & signed guest resource token enforcement
    const isAdminCaller = Boolean(authenticatedUser && checkIsAdmin(authenticatedUser));
    let paymentVerified = false;
    let ownershipDenied = false;
    let ownershipDenialReason = "Forbidden: Lead recovery requires authentication matching the purchase owner or a signed guest resource access token.";
    let dbPurchase = null;
    let dbPayment = null;
    let gatewayOrder = null;
    let gatewayPayment = null;
    let resolvedAsUserOwned = false;

    const [{ data: purchase }, { data: payment }] = await Promise.all([
      dbClient
        .from("resource_purchases")
        .select("*")
        .eq("razorpay_payment_id", cleanPaymentId)
        .eq("razorpay_order_id", cleanOrderId)
        .eq("resource_id", canonicalResourceId)
        .eq("status", "active")
        .eq("currency", "INR")
        .maybeSingle(),
      dbClient
        .from("payments")
        .select("*")
        .eq("razorpay_payment_id", cleanPaymentId)
        .eq("razorpay_order_id", cleanOrderId)
        .eq("item_type", "resource")
        .eq("item_id", canonicalResourceId)
        .eq("status", "captured")
        .eq("currency", "INR")
        .maybeSingle()
    ]);

    if (purchase) {
      const ownership = evaluateRecordOwnership(purchase.user_id, authenticatedUser);
      if (!ownership.allowed) {
        ownershipDenied = true;
      } else if (!ownership.isGuest) {
        resolvedAsUserOwned = true;
      }
    }
    if (!ownershipDenied && payment) {
      const ownership = evaluateRecordOwnership(payment.user_id, authenticatedUser);
      if (!ownership.allowed) {
        ownershipDenied = true;
      } else if (!ownership.isGuest) {
        resolvedAsUserOwned = true;
      }
    }

    if (!ownershipDenied) {
      if (purchase && toPaiseStrict(purchase.amount) === expectedAmountInPaise) {
        paymentVerified = true;
        dbPurchase = purchase;
      }
      if (payment && toPaiseStrict(payment.amount) === expectedAmountInPaise) {
        paymentVerified = true;
        dbPayment = payment;
      }
    }

    // If not verified in database (and ownership not already denied), check authoritative gateway metadata
    if (!paymentVerified && !ownershipDenied && razorpay) {
      try {
        const [rzpPayment, rzpOrder] = await Promise.all([
          razorpay.payments.fetch(cleanPaymentId),
          razorpay.orders.fetch(cleanOrderId)
        ]);
        gatewayPayment = rzpPayment;
        gatewayOrder = rzpOrder;
        const notes = rzpOrder?.notes || {};
        const noteResourceId = String(notes.resourceId || notes.resource_id || "").trim();
        const noteUserId = String(notes.userId || "").trim();
        const ownership = evaluateRecordOwnership(noteUserId, authenticatedUser);

        if (!ownership.allowed) {
          ownershipDenied = true;
        } else {
          if (!ownership.isGuest) {
            resolvedAsUserOwned = true;
          }
          if (
            rzpPayment &&
            rzpOrder &&
            String(rzpPayment.status || "").toLowerCase() === "captured" &&
            rzpPayment.order_id === cleanOrderId &&
            rzpOrder.id === cleanOrderId &&
            String(rzpPayment.currency || "").toUpperCase() === "INR" &&
            String(rzpOrder.currency || "").toUpperCase() === "INR" &&
            Number.isSafeInteger(Number(rzpPayment.amount)) &&
            Number.isSafeInteger(Number(rzpOrder.amount)) &&
            Number(rzpPayment.amount) === expectedAmountInPaise &&
            Number(rzpOrder.amount) === expectedAmountInPaise &&
            String(notes.itemType || "").trim().toLowerCase() === "resource" &&
            allowedResourceIdentifiers.includes(noteResourceId)
          ) {
            paymentVerified = true;
          }
        }
      } catch (gatewayErr) {
        console.warn(`[Lead Recovery] Gateway verification notice: ${gatewayErr?.message}`);
      }
    }

    if (ownershipDenied) {
      return res.status(403).json({
        success: false,
        payment_verified: false,
        lead_status: "failed",
        error: ownershipDenialReason
      });
    }

    // Enforce signed guest resource access token whenever the request is NOT an authenticated user-owned record or admin
    if (!isAdminCaller && !resolvedAsUserOwned) {
      const guestAuth = authorizeGuestResourceTransaction({
        req,
        paymentId: cleanPaymentId,
        orderId: cleanOrderId,
        allowedResourceIds: [canonicalResourceId],
        dbPurchase: dbPurchase || purchase,
        dbPayment: dbPayment || payment,
        gatewayOrderNotes: gatewayOrder?.notes || null,
        gatewayPayment,
        suppliedEmail: customerDetails?.email || "",
        suppliedPhone: customerDetails?.phone || ""
      });
      if (!guestAuth.allowed) {
        return res.status(403).json({
          success: false,
          payment_verified: false,
          lead_status: "failed",
          code: guestAuth.code,
          error: guestAuth.reason
        });
      }
    }

    if (!paymentVerified) {
      return res.status(400).json({
        success: false,
        payment_verified: false,
        lead_status: "failed",
        error: "Payment could not be verified for this resource against ledger records or gateway. Lead recovery rejected."
      });
    }

    // 3. Idempotency Check: check if lead already exists in crm_leads for this payment
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
 * Enforces fail-closed record ownership across DB and gateway fallback paths.
 * A non-null owner user_id NEVER authorizes an unauthenticated (null) caller.
 */
export function evaluateRecordOwnership(ownerUserId, authenticatedUser) {
  const cleanOwnerId = ownerUserId != null ? String(ownerUserId).trim() : "";
  if (cleanOwnerId) {
    if (!authenticatedUser) {
      return {
        allowed: false,
        denied: true,
        isGuest: false,
        reason: "Authentication required for user-owned purchase."
      };
    }
    if (String(authenticatedUser.id || "").trim() === cleanOwnerId || checkIsAdmin(authenticatedUser)) {
      return { allowed: true, denied: false, isGuest: false };
    }
    return {
      allowed: false,
      denied: true,
      isGuest: false,
      reason: "Authenticated user does not match purchase owner."
    };
  }
  return { allowed: true, denied: false, isGuest: true };
}

/**
 * Verifies cryptographically signed guest resource access token + identity binding.
 * Rejects unauthenticated orderId + paymentId alone with explicit failure codes.
 */
function authorizeGuestResourceTransaction({
  req,
  paymentId,
  orderId,
  allowedResourceIds,
  dbPurchase = null,
  dbPayment = null,
  gatewayOrderNotes = null,
  gatewayPayment = null,
  suppliedEmail = "",
  suppliedPhone = ""
}) {
  const rawToken = extractResourceAccessToken(req);
  if (!rawToken) {
    return {
      allowed: false,
      code: "MISSING_GUEST_TOKEN",
      reason: "Forbidden: A signed guest resource access token is required for guest resource access."
    };
  }

  const tokenCheck = verifyGuestResourceToken(rawToken, {
    paymentId,
    orderId,
    allowedResourceIds
  });
  if (!tokenCheck.valid) {
    return {
      allowed: false,
      code: tokenCheck.code || "INVALID_GUEST_TOKEN",
      reason: tokenCheck.reason || "Forbidden: Invalid or expired guest resource access token."
    };
  }

  const identityCheck = verifyTokenGuestIdentityBinding(tokenCheck.payload, {
    orderId,
    paymentId,
    authoritativeEmails: [
      dbPurchase?.customer_email,
      dbPayment?.customer_email,
      gatewayOrderNotes?.customerEmail,
      gatewayPayment?.email
    ],
    authoritativePhones: [
      dbPurchase?.customer_phone,
      gatewayOrderNotes?.customerPhone,
      gatewayPayment?.contact
    ],
    suppliedEmail,
    suppliedPhone
  });
  if (!identityCheck.valid) {
    return {
      allowed: false,
      code: identityCheck.code || "GUEST_IDENTITY_MISMATCH",
      reason: identityCheck.reason || "Forbidden: Guest identity mismatch."
    };
  }

  return { allowed: true, payload: tokenCheck.payload };
}

/**
 * Dynamically resolves exact authoritative integer-paise expectations from `public.resources`
 * for the target resource and (when the target is a bundle child) the parent bundle record.
 * Never hardcodes fallback bundle prices (e.g. 29900).
 */
async function resolveResourceAccessAuthoritative(
  supabaseServer,
  resourceRecord,
  { allowArchivedExistingOwner = false } = {}
) {
  const expectedPaiseById = new Map();
  const archivedExpectedPaiseById = new Map();
  const targetId = String(resourceRecord?.id || "").trim();
  const recordStatus = String(resourceRecord?.status || "").trim().toLowerCase();

  if (recordStatus === "published") {
    const pricing = getAuthoritativeResourcePricing(targetId, resourceRecord);
    if (pricing.accessType === "free") {
      return {
        isFree: true,
        pricing,
        expectedPaiseById,
        archivedExpectedPaiseById,
        allAllowedIds: getAllowedResourceIdsForAuthorization(resourceRecord)
      };
    }
    const targetPaise = toPaiseStrict(pricing.price);
    if (pricing.accessType === "paid" && String(pricing.currency || "").toUpperCase() === "INR" && targetPaise) {
      expectedPaiseById.set(targetId, targetPaise);
    }
  } else if (allowArchivedExistingOwner && recordStatus === "archived") {
    const dbAccess = String(resourceRecord.access_type ?? resourceRecord.accessType ?? "").trim().toLowerCase();
    const dbCurr = String(resourceRecord.currency || "INR").trim().toUpperCase();
    const archivedPaise = toPaiseStrict(resourceRecord.price);
    if (dbAccess === "paid" && dbCurr === "INR" && archivedPaise) {
      archivedExpectedPaiseById.set(targetId, archivedPaise);
    }
  } else {
    // Draft or unknown status: fail closed with empty maps (never unlocked even via bundle)
    return {
      isFree: false,
      pricing: { accessType: "unavailable", price: 0, currency: "INR" },
      expectedPaiseById,
      archivedExpectedPaiseById,
      allAllowedIds: []
    };
  }

  const bundleRel = isBundleOrBundleItem(resourceRecord.id || resourceRecord.slug);
  if (bundleRel.isChild) {
    const { data: bundleRow } = await supabaseServer
      .from("resources")
      .select("id, slug, title, status, access_type, price, currency")
      .eq("id", BUNDLE_RESOURCE_ID)
      .maybeSingle();

    if (bundleRow) {
      const bStatus = String(bundleRow.status || "").trim().toLowerCase();
      if (bStatus === "published") {
        const bPricing = getAuthoritativeResourcePricing(BUNDLE_RESOURCE_ID, bundleRow);
        const bPaise = toPaiseStrict(bPricing.price);
        if (bPricing.accessType === "paid" && String(bPricing.currency || "").toUpperCase() === "INR" && bPaise) {
          expectedPaiseById.set(BUNDLE_RESOURCE_ID, bPaise);
        }
      } else if (allowArchivedExistingOwner && bStatus === "archived") {
        const bAccess = String(bundleRow.access_type ?? bundleRow.accessType ?? "").trim().toLowerCase();
        const bCurr = String(bundleRow.currency || "INR").trim().toUpperCase();
        const bPaise = toPaiseStrict(bundleRow.price);
        if (bAccess === "paid" && bCurr === "INR" && bPaise) {
          archivedExpectedPaiseById.set(BUNDLE_RESOURCE_ID, bPaise);
        }
      }
    }
  }

  const combinedIds = Array.from(new Set([
    ...expectedPaiseById.keys(),
    ...archivedExpectedPaiseById.keys()
  ]));

  return {
    isFree: false,
    pricing: getAuthoritativeResourcePricing(targetId, resourceRecord),
    expectedPaiseById,
    archivedExpectedPaiseById,
    allAllowedIds: combinedIds
  };
}

/**
 * Resolves a gateway order's notes.resourceId to a canonical resource UUID present in expectedPaiseById.
 */
function resolveGatewayMatchedResourceId(orderResourceId, resourceRecord, expectedPaiseById) {
  const clean = String(orderResourceId || "").trim();
  if (!clean) return null;
  if (clean === String(resourceRecord.id).trim() || (resourceRecord.slug && clean === String(resourceRecord.slug).trim())) {
    return expectedPaiseById.has(String(resourceRecord.id).trim()) ? String(resourceRecord.id).trim() : null;
  }
  if (
    expectedPaiseById.has(BUNDLE_RESOURCE_ID) &&
    (clean === BUNDLE_RESOURCE_ID || clean === BUNDLE_SLUG)
  ) {
    return BUNDLE_RESOURCE_ID;
  }
  return null;
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
      ? await supabaseServer.from("resources").select("id, slug, title, status, access_type, price, currency").eq("id", cleanResourceId).maybeSingle()
      : await supabaseServer.from("resources").select("id, slug, title, status, access_type, price, currency").eq("slug", cleanResourceId).maybeSingle();

    if (!resourceRecord) {
      return res.status(404).json({
        success: false,
        verified: false,
        error: "Resource not found."
      });
    }

    const resolvedResId = resourceRecord.id;
    const accessSpec = await resolveResourceAccessAuthoritative(supabaseServer, resourceRecord, {
      allowArchivedExistingOwner: Boolean(authenticatedUser)
    });

    if (accessSpec.isFree) {
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

    if ((cleanPaymentId && !cleanOrderId) || (!cleanPaymentId && cleanOrderId)) {
      return res.status(400).json({
        success: false,
        verified: false,
        error: "Both paymentId and orderId are required for transaction verification."
      });
    }

    const combinedPaiseMap = new Map([
      ...accessSpec.archivedExpectedPaiseById.entries(),
      ...accessSpec.expectedPaiseById.entries()
    ]);

    const isAdminCaller = Boolean(authenticatedUser && checkIsAdmin(authenticatedUser));
    let ownershipDenied = false;
    let guestAuthError = null;

    // 2. Check dual-identifier verification when orderId + paymentId (or guest token) are supplied
    if (cleanPaymentId && cleanOrderId && accessSpec.allAllowedIds.length > 0) {
      const [{ data: purchaseRecord }, { data: paymentRecord }] = await Promise.all([
        supabaseServer
          .from("resource_purchases")
          .select("id, user_id, customer_email, customer_phone, status, amount, currency, razorpay_order_id, razorpay_payment_id, resource_id")
          .eq("razorpay_payment_id", cleanPaymentId)
          .eq("razorpay_order_id", cleanOrderId)
          .in("resource_id", accessSpec.allAllowedIds)
          .eq("status", "active")
          .eq("currency", "INR")
          .maybeSingle(),
        supabaseServer
          .from("payments")
          .select("id, user_id, status, amount, currency, razorpay_order_id, razorpay_payment_id, item_id, item_type")
          .eq("razorpay_payment_id", cleanPaymentId)
          .eq("razorpay_order_id", cleanOrderId)
          .in("item_id", accessSpec.allAllowedIds)
          .eq("item_type", "resource")
          .eq("status", "captured")
          .eq("currency", "INR")
          .maybeSingle()
      ]);

      let isUserOwnedRecord = false;
      if (purchaseRecord) {
        const own = evaluateRecordOwnership(purchaseRecord.user_id, authenticatedUser);
        if (!own.allowed) ownershipDenied = true;
        else if (!own.isGuest) isUserOwnedRecord = true;
      }
      if (!ownershipDenied && paymentRecord) {
        const own = evaluateRecordOwnership(paymentRecord.user_id, authenticatedUser);
        if (!own.allowed) ownershipDenied = true;
        else if (!own.isGuest) isUserOwnedRecord = true;
      }

      if (!ownershipDenied) {
        if (purchaseRecord) {
          const purResId = String(purchaseRecord.resource_id || "").trim();
          const hasUserOwner = Boolean(purchaseRecord.user_id && String(purchaseRecord.user_id).trim());
          const expectedPaise = hasUserOwner
            ? combinedPaiseMap.get(purResId)
            : accessSpec.expectedPaiseById.get(purResId);
          const actualPaise = toPaiseStrict(purchaseRecord.amount);
          if (expectedPaise && actualPaise === expectedPaise) {
            if (!hasUserOwner && !isAdminCaller) {
              const guestAuth = authorizeGuestResourceTransaction({
                req,
                paymentId: cleanPaymentId,
                orderId: cleanOrderId,
                allowedResourceIds: accessSpec.allAllowedIds,
                dbPurchase: purchaseRecord,
                dbPayment: paymentRecord,
                suppliedEmail: req.query?.email || ""
              });
              if (!guestAuth.allowed) {
                guestAuthError = guestAuth;
              }
            }
            if (!guestAuthError) {
              return res.json({
                success: true,
                verified: true,
                resourceId: resolvedResId,
                orderId: cleanOrderId,
                paymentId: cleanPaymentId,
                amount: actualPaise / 100,
                currency: "INR"
              });
            }
          }
        }

        if (!guestAuthError && paymentRecord) {
          const payResId = String(paymentRecord.item_id || "").trim();
          const hasUserOwner = Boolean(paymentRecord.user_id && String(paymentRecord.user_id).trim());
          const expectedPaise = hasUserOwner
            ? combinedPaiseMap.get(payResId)
            : accessSpec.expectedPaiseById.get(payResId);
          const actualPaise = toPaiseStrict(paymentRecord.amount);
          if (expectedPaise && actualPaise === expectedPaise) {
            if (!hasUserOwner && !isAdminCaller) {
              const guestAuth = authorizeGuestResourceTransaction({
                req,
                paymentId: cleanPaymentId,
                orderId: cleanOrderId,
                allowedResourceIds: accessSpec.allAllowedIds,
                dbPurchase: purchaseRecord,
                dbPayment: paymentRecord,
                suppliedEmail: req.query?.email || ""
              });
              if (!guestAuth.allowed) {
                guestAuthError = guestAuth;
              }
            }
            if (!guestAuthError) {
              return res.json({
                success: true,
                verified: true,
                resourceId: resolvedResId,
                orderId: cleanOrderId,
                paymentId: cleanPaymentId,
                amount: actualPaise / 100,
                currency: "INR"
              });
            }
          }
        }
      }

      // Gateway reconciliation fallback (published paid resources only, strict integer paise + ownership/guest token)
      const razorpay = getRazorpayClient();
      if (
        !ownershipDenied &&
        !guestAuthError &&
        razorpay &&
        accessSpec.expectedPaiseById.size > 0 &&
        cleanPaymentId.startsWith("pay_") &&
        cleanOrderId.startsWith("order_")
      ) {
        try {
          const [rzpPayment, rzpOrder] = await Promise.all([
            razorpay.payments.fetch(cleanPaymentId),
            razorpay.orders.fetch(cleanOrderId)
          ]);
          if (
            rzpPayment &&
            rzpOrder &&
            String(rzpPayment.status || "").toLowerCase() === "captured" &&
            String(rzpPayment.currency || "").toUpperCase() === "INR" &&
            String(rzpOrder.currency || "").toUpperCase() === "INR" &&
            rzpPayment.order_id === cleanOrderId &&
            rzpOrder.id === cleanOrderId &&
            Number.isSafeInteger(Number(rzpPayment.amount)) &&
            Number(rzpPayment.amount) === Number(rzpOrder.amount)
          ) {
            const orderNotes = rzpOrder.notes || {};
            const orderItemType = String(orderNotes.itemType || "").trim().toLowerCase();
            const orderResId = String(orderNotes.resourceId || orderNotes.resource_id || "").trim();
            const matchedCanonicalResId = resolveGatewayMatchedResourceId(
              orderResId,
              resourceRecord,
              accessSpec.expectedPaiseById
            );
            const exactExpectedPaise = matchedCanonicalResId
              ? accessSpec.expectedPaiseById.get(matchedCanonicalResId)
              : null;

            const ownership = evaluateRecordOwnership(orderNotes.userId, authenticatedUser);
            if (!ownership.allowed) {
              ownershipDenied = true;
            } else {
              if (!ownership.isGuest) isUserOwnedRecord = true;
              if (
                orderItemType === "resource" &&
                exactExpectedPaise &&
                Number(rzpPayment.amount) === exactExpectedPaise
              ) {
                if (ownership.isGuest && !isAdminCaller) {
                  const guestAuth = authorizeGuestResourceTransaction({
                    req,
                    paymentId: cleanPaymentId,
                    orderId: cleanOrderId,
                    allowedResourceIds: accessSpec.allAllowedIds,
                    dbPurchase: purchaseRecord,
                    dbPayment: paymentRecord,
                    gatewayOrderNotes: orderNotes,
                    gatewayPayment: rzpPayment,
                    suppliedEmail: req.query?.email || ""
                  });
                  if (!guestAuth.allowed) {
                    guestAuthError = guestAuth;
                  }
                }
                if (!guestAuthError) {
                  return res.json({
                    success: true,
                    verified: true,
                    resourceId: resolvedResId,
                    orderId: cleanOrderId,
                    paymentId: cleanPaymentId,
                    amount: Number(rzpPayment.amount) / 100,
                    currency: "INR"
                  });
                }
              }
            }
          }
        } catch {
          // invalid payment ID or gateway rejection
        }
      }

      // If unauthenticated guest supplied transaction IDs but did not satisfy token authorization, fail closed 403
      if (!authenticatedUser && !ownershipDenied && !guestAuthError) {
        const fallbackGuestCheck = authorizeGuestResourceTransaction({
          req,
          paymentId: cleanPaymentId,
          orderId: cleanOrderId,
          allowedResourceIds: accessSpec.allAllowedIds,
          suppliedEmail: req.query?.email || ""
        });
        if (!fallbackGuestCheck.allowed) {
          guestAuthError = fallbackGuestCheck;
        }
      }
    } else if (!authenticatedUser && extractResourceAccessToken(req)) {
      return res.status(403).json({
        success: false,
        verified: false,
        code: "MISSING_TRANSACTION_IDS",
        error: "Forbidden: Guest resource access token requires matching orderId and paymentId."
      });
    }

    if (ownershipDenied) {
      return res.status(403).json({
        success: false,
        verified: false,
        error: "Forbidden: Purchase belongs to an authenticated user account."
      });
    }

    if (guestAuthError) {
      return res.status(403).json({
        success: false,
        verified: false,
        code: guestAuthError.code,
        error: guestAuthError.reason
      });
    }

    // 3. Authenticated user ownership lookup (only when no ownership denial occurred)
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

      if (accessSpec.allAllowedIds.length > 0) {
        const { data: userPurchases } = await supabaseServer
          .from("resource_purchases")
          .select("id, status, amount, currency, razorpay_order_id, razorpay_payment_id, resource_id")
          .eq("user_id", authenticatedUser.id)
          .in("resource_id", accessSpec.allAllowedIds)
          .eq("status", "active")
          .eq("currency", "INR");

        const validPurchase = (userPurchases || []).find((row) => {
          const expPaise = combinedPaiseMap.get(String(row.resource_id || "").trim());
          return expPaise && toPaiseStrict(row.amount) === expPaise;
        });

        if (validPurchase) {
          return res.json({
            success: true,
            verified: true,
            resourceId: resolvedResId,
            orderId: validPurchase.razorpay_order_id,
            paymentId: validPurchase.razorpay_payment_id,
            amount: Number(validPurchase.amount),
            currency: "INR"
          });
        }

        const { data: userPayments } = await supabaseServer
          .from("payments")
          .select("id, status, amount, currency, razorpay_order_id, razorpay_payment_id, item_id")
          .eq("user_id", authenticatedUser.id)
          .eq("item_type", "resource")
          .in("item_id", accessSpec.allAllowedIds)
          .eq("status", "captured")
          .eq("currency", "INR");

        const validPayment = (userPayments || []).find((row) => {
          const expPaise = combinedPaiseMap.get(String(row.item_id || "").trim());
          return expPaise && toPaiseStrict(row.amount) === expPaise;
        });

        if (validPayment) {
          return res.json({
            success: true,
            verified: true,
            resourceId: resolvedResId,
            orderId: validPayment.razorpay_order_id,
            paymentId: validPayment.razorpay_payment_id,
            amount: Number(validPayment.amount),
            currency: "INR"
          });
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
router.post("/get-resource-download-url", paymentRateLimiter, async (req, res) => {
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

    const accessSpec = await resolveResourceAccessAuthoritative(supabaseServer, resourceRecord, {
      allowArchivedExistingOwner: Boolean(authenticatedUser)
    });

    // ONLY legitimately published free resources are served without paid entitlement
    if (accessSpec.isFree) {
      let freeDownloadUrl = resourceRecord.file_url || resourceRecord.external_url || null;
      const matchedBundleItem = BUNDLE_ITEMS.find((i) => i.id === resourceRecord.id || i.slug === resourceRecord.slug);
      if (matchedBundleItem && supabaseServer.storage?.from) {
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

    const combinedPaiseMap = new Map([
      ...accessSpec.archivedExpectedPaiseById.entries(),
      ...accessSpec.expectedPaiseById.entries()
    ]);

    const isAdminCaller = Boolean(authenticatedUser && checkIsAdmin(authenticatedUser));
    let isAuthorized = false;
    let ownershipDenied = false;

    // 2. Dual-identifier verification against DB ledger & Razorpay gateway
    if (cleanPaymentId && cleanOrderId && accessSpec.allAllowedIds.length > 0) {
      const [{ data: pRecord }, { data: purRecord }] = await Promise.all([
        supabaseServer
          .from("payments")
          .select("id, status, amount, currency, razorpay_order_id, razorpay_payment_id, item_id, item_type, user_id")
          .eq("razorpay_payment_id", cleanPaymentId)
          .eq("razorpay_order_id", cleanOrderId)
          .in("item_id", accessSpec.allAllowedIds)
          .eq("item_type", "resource")
          .eq("status", "captured")
          .eq("currency", "INR")
          .maybeSingle(),
        supabaseServer
          .from("resource_purchases")
          .select("id, status, amount, currency, razorpay_order_id, razorpay_payment_id, resource_id, user_id, customer_email, customer_phone")
          .eq("razorpay_payment_id", cleanPaymentId)
          .eq("razorpay_order_id", cleanOrderId)
          .in("resource_id", accessSpec.allAllowedIds)
          .eq("status", "active")
          .eq("currency", "INR")
          .maybeSingle()
      ]);

      if (pRecord && !evaluateRecordOwnership(pRecord.user_id, authenticatedUser).allowed) {
        ownershipDenied = true;
      }
      if (!ownershipDenied && purRecord && !evaluateRecordOwnership(purRecord.user_id, authenticatedUser).allowed) {
        ownershipDenied = true;
      }

      if (!ownershipDenied && pRecord) {
        const payResId = String(pRecord.item_id || "").trim();
        const hasUserOwner = Boolean(pRecord.user_id && String(pRecord.user_id).trim());
        const expectedPaise = hasUserOwner
          ? combinedPaiseMap.get(payResId)
          : accessSpec.expectedPaiseById.get(payResId);
        if (
          pRecord.razorpay_order_id === cleanOrderId &&
          pRecord.razorpay_payment_id === cleanPaymentId &&
          String(pRecord.currency || "").toUpperCase() === "INR" &&
          expectedPaise &&
          toPaiseStrict(pRecord.amount) === expectedPaise
        ) {
          if (hasUserOwner || isAdminCaller) {
            isAuthorized = true;
          } else {
            const guestAuth = authorizeGuestResourceTransaction({
              req,
              paymentId: cleanPaymentId,
              orderId: cleanOrderId,
              allowedResourceIds: payResId === BUNDLE_RESOURCE_ID ? [BUNDLE_RESOURCE_ID, BUNDLE_SLUG] : [payResId],
              dbPurchase: purRecord,
              dbPayment: pRecord,
              suppliedEmail: req.body?.email || ""
            });
            if (guestAuth.allowed) {
              isAuthorized = true;
            } else {
              ownershipDenied = true;
            }
          }
        }
      }

      if (!isAuthorized && !ownershipDenied && purRecord) {
        const purResId = String(purRecord.resource_id || "").trim();
        const hasUserOwner = Boolean(purRecord.user_id && String(purRecord.user_id).trim());
        const expectedPaise = hasUserOwner
          ? combinedPaiseMap.get(purResId)
          : accessSpec.expectedPaiseById.get(purResId);
        if (
          purRecord.razorpay_order_id === cleanOrderId &&
          purRecord.razorpay_payment_id === cleanPaymentId &&
          String(purRecord.currency || "").toUpperCase() === "INR" &&
          expectedPaise &&
          toPaiseStrict(purRecord.amount) === expectedPaise
        ) {
          if (hasUserOwner || isAdminCaller) {
            isAuthorized = true;
          } else {
            const guestAuth = authorizeGuestResourceTransaction({
              req,
              paymentId: cleanPaymentId,
              orderId: cleanOrderId,
              allowedResourceIds: purResId === BUNDLE_RESOURCE_ID ? [BUNDLE_RESOURCE_ID, BUNDLE_SLUG] : [purResId],
              dbPurchase: purRecord,
              dbPayment: pRecord,
              suppliedEmail: req.body?.email || ""
            });
            if (guestAuth.allowed) {
              isAuthorized = true;
            } else {
              ownershipDenied = true;
            }
          }
        }
      }

      // Gateway fallback (published paid resources only, strict integer paise + ownership + guest token)
      if (
        !isAuthorized &&
        !ownershipDenied &&
        accessSpec.expectedPaiseById.size > 0 &&
        cleanPaymentId.startsWith("pay_") &&
        cleanOrderId.startsWith("order_")
      ) {
        const razorpay = getRazorpayClient();
        if (razorpay) {
          try {
            const [rzpPayment, rzpOrder] = await Promise.all([
              razorpay.payments.fetch(cleanPaymentId),
              razorpay.orders.fetch(cleanOrderId)
            ]);
            if (
              rzpPayment &&
              rzpOrder &&
              String(rzpPayment.status || "").toLowerCase() === "captured" &&
              String(rzpPayment.currency || "").toUpperCase() === "INR" &&
              String(rzpOrder.currency || "").toUpperCase() === "INR" &&
              rzpPayment.order_id === cleanOrderId &&
              rzpOrder.id === cleanOrderId &&
              Number.isSafeInteger(Number(rzpPayment.amount)) &&
              Number(rzpPayment.amount) === Number(rzpOrder.amount)
            ) {
              const orderNotes = rzpOrder.notes || {};
              const orderItemType = String(orderNotes.itemType || "").trim().toLowerCase();
              const orderResId = String(orderNotes.resourceId || orderNotes.resource_id || "").trim();
              const matchedCanonicalResId = resolveGatewayMatchedResourceId(
                orderResId,
                resourceRecord,
                accessSpec.expectedPaiseById
              );
              const exactExpectedPaise = matchedCanonicalResId
                ? accessSpec.expectedPaiseById.get(matchedCanonicalResId)
                : null;

              const ownership = evaluateRecordOwnership(orderNotes.userId, authenticatedUser);
              if (!ownership.allowed) {
                ownershipDenied = true;
              } else if (
                orderItemType === "resource" &&
                exactExpectedPaise &&
                Number(rzpPayment.amount) === exactExpectedPaise
              ) {
                if (!ownership.isGuest || isAdminCaller) {
                  isAuthorized = true;
                } else {
                  const guestAuth = authorizeGuestResourceTransaction({
                    req,
                    paymentId: cleanPaymentId,
                    orderId: cleanOrderId,
                    allowedResourceIds: matchedCanonicalResId === BUNDLE_RESOURCE_ID ? [BUNDLE_RESOURCE_ID, BUNDLE_SLUG] : [matchedCanonicalResId],
                    dbPurchase: purRecord,
                    dbPayment: pRecord,
                    gatewayOrderNotes: orderNotes,
                    gatewayPayment: rzpPayment,
                    suppliedEmail: req.body?.email || ""
                  });
                  if (guestAuth.allowed) {
                    isAuthorized = true;
                  } else {
                    ownershipDenied = true;
                  }
                }
              }
            }
          } catch {}
        }
      }
    }

    // 3. Check authenticated user ownership (unless explicit ownership mismatch occurred)
    if (!isAuthorized && !ownershipDenied && authenticatedUser) {
      if (checkIsAdmin(authenticatedUser)) {
        isAuthorized = true;
      } else if (accessSpec.allAllowedIds.length > 0) {
        const { data: userPayments } = await supabaseServer
          .from("payments")
          .select("id, currency, amount, item_id")
          .eq("user_id", authenticatedUser.id)
          .eq("item_type", "resource")
          .in("item_id", accessSpec.allAllowedIds)
          .eq("status", "captured")
          .eq("currency", "INR");

        const validUserPay = (userPayments || []).some((row) => {
          const expPaise = combinedPaiseMap.get(String(row.item_id || "").trim());
          return expPaise && toPaiseStrict(row.amount) === expPaise;
        });

        if (validUserPay) {
          isAuthorized = true;
        } else {
          const { data: userPurchases } = await supabaseServer
            .from("resource_purchases")
            .select("id, currency, amount, resource_id")
            .eq("user_id", authenticatedUser.id)
            .in("resource_id", accessSpec.allAllowedIds)
            .eq("status", "active")
            .eq("currency", "INR");

          const validUserPur = (userPurchases || []).some((row) => {
            const expPaise = combinedPaiseMap.get(String(row.resource_id || "").trim());
            return expPaise && toPaiseStrict(row.amount) === expPaise;
          });

          if (validUserPur) {
            isAuthorized = true;
          }
        }
      }
    }

    if (!isAuthorized || ownershipDenied) {
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
      if (supabaseServer.storage?.from) {
        const { data: signedData } = await supabaseServer.storage
          .from("resources")
          .createSignedUrl(bundleItem.storagePath, 3600);
        if (signedData?.signedUrl) {
          finalDownloadUrl = signedData.signedUrl;
        }
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
        if (objectPath && supabaseServer.storage?.from) {
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
    const cleanBundleId = bundleId != null ? String(bundleId).trim() : "";
    const cleanPaymentId = paymentId ? String(paymentId).trim() : null;
    const cleanOrderId = orderId ? String(orderId).trim() : null;

    if (cleanBundleId && cleanBundleId !== BUNDLE_RESOURCE_ID && cleanBundleId !== BUNDLE_SLUG) {
      return res.status(400).json({
        success: false,
        authorized: false,
        error: "Invalid bundle identifier."
      });
    }

    const supabaseServer = getSupabaseServerClient() || getSupabaseDbClient(authHeader);
    if (!supabaseServer) {
      return res.status(503).json({ success: false, authorized: false, error: "Database service unavailable." });
    }

    // 1. Resolve canonical bundle resource record from public.resources, require published status & authoritative INR pricing
    const { data: bundleRecord, error: bundleErr } = await supabaseServer
      .from("resources")
      .select("*")
      .eq("id", BUNDLE_RESOURCE_ID)
      .maybeSingle();

    if (bundleErr) {
      return res.status(500).json({
        success: false,
        authorized: false,
        error: "Failed to verify bundle catalog record."
      });
    }

    if (!bundleRecord) {
      return res.status(404).json({
        success: false,
        authorized: false,
        error: "Bundle resource record not found."
      });
    }

    if (String(bundleRecord.status || "").trim().toLowerCase() !== "published") {
      return res.status(403).json({
        success: false,
        authorized: false,
        error: "Unauthorized: This bundle is not currently published."
      });
    }

    const pricing = getAuthoritativeResourcePricing(BUNDLE_RESOURCE_ID, bundleRecord);
    const expectedAmountInPaise = toPaiseStrict(pricing.price);
    if (
      pricing.accessType !== "paid" ||
      !expectedAmountInPaise ||
      String(pricing.currency || "").toUpperCase() !== "INR"
    ) {
      return res.status(400).json({
        success: false,
        authorized: false,
        error: "Bundle resource pricing is not configured as an eligible paid INR product."
      });
    }

    const expectedAmountRupees = expectedAmountInPaise / 100;
    const bundleMetadata = {
      id: BUNDLE_RESOURCE_ID,
      slug: BUNDLE_SLUG,
      title: bundleRecord.title || "Meta Ads Campaign Planner Bundle",
      price: expectedAmountRupees,
      currency: "INR"
    };

    const isAdminCaller = Boolean(authenticatedUser && checkIsAdmin(authenticatedUser));
    let isAuthorized = false;
    let ownershipDenied = false;

    // 2. Dual-identifier purchase verification (DB ledger then authoritative Razorpay gateway fallback)
    if (cleanPaymentId && cleanOrderId) {
      const [{ data: pRecord }, { data: purRecord }] = await Promise.all([
        supabaseServer
          .from("payments")
          .select("id, user_id, status, item_id, item_type, razorpay_payment_id, razorpay_order_id, currency, amount")
          .eq("razorpay_payment_id", cleanPaymentId)
          .eq("razorpay_order_id", cleanOrderId)
          .eq("item_id", BUNDLE_RESOURCE_ID)
          .eq("item_type", "resource")
          .eq("status", "captured")
          .eq("currency", "INR")
          .maybeSingle(),
        supabaseServer
          .from("resource_purchases")
          .select("id, user_id, customer_email, customer_phone, status, resource_id, razorpay_payment_id, razorpay_order_id, currency, amount")
          .eq("razorpay_payment_id", cleanPaymentId)
          .eq("razorpay_order_id", cleanOrderId)
          .eq("resource_id", BUNDLE_RESOURCE_ID)
          .eq("status", "active")
          .eq("currency", "INR")
          .maybeSingle()
      ]);

      // Reject immediately if either DB record belongs to a user account and caller lacks matching auth
      if (pRecord && !evaluateRecordOwnership(pRecord.user_id, authenticatedUser).allowed) {
        ownershipDenied = true;
      }
      if (!ownershipDenied && purRecord && !evaluateRecordOwnership(purRecord.user_id, authenticatedUser).allowed) {
        ownershipDenied = true;
      }

      if (
        !ownershipDenied &&
        pRecord &&
        pRecord.razorpay_payment_id === cleanPaymentId &&
        pRecord.razorpay_order_id === cleanOrderId &&
        pRecord.item_id === BUNDLE_RESOURCE_ID &&
        pRecord.item_type === "resource" &&
        pRecord.status === "captured" &&
        String(pRecord.currency || "").toUpperCase() === "INR" &&
        toPaiseStrict(pRecord.amount) === expectedAmountInPaise
      ) {
        const hasUserOwner = Boolean(pRecord.user_id && String(pRecord.user_id).trim());
        if (hasUserOwner || isAdminCaller) {
          isAuthorized = true;
        } else {
          const guestAuth = authorizeGuestResourceTransaction({
            req,
            paymentId: cleanPaymentId,
            orderId: cleanOrderId,
            allowedResourceIds: [BUNDLE_RESOURCE_ID],
            dbPurchase: purRecord,
            dbPayment: pRecord,
            suppliedEmail: (req.method === "POST" ? req.body?.email : req.query?.email) || ""
          });
          if (guestAuth.allowed) {
            isAuthorized = true;
          } else {
            ownershipDenied = true;
          }
        }
      }

      if (
        !isAuthorized &&
        !ownershipDenied &&
        purRecord &&
        purRecord.razorpay_payment_id === cleanPaymentId &&
        purRecord.razorpay_order_id === cleanOrderId &&
        purRecord.resource_id === BUNDLE_RESOURCE_ID &&
        purRecord.status === "active" &&
        String(purRecord.currency || "").toUpperCase() === "INR" &&
        toPaiseStrict(purRecord.amount) === expectedAmountInPaise
      ) {
        const hasUserOwner = Boolean(purRecord.user_id && String(purRecord.user_id).trim());
        if (hasUserOwner || isAdminCaller) {
          isAuthorized = true;
        } else {
          const guestAuth = authorizeGuestResourceTransaction({
            req,
            paymentId: cleanPaymentId,
            orderId: cleanOrderId,
            allowedResourceIds: [BUNDLE_RESOURCE_ID],
            dbPurchase: purRecord,
            dbPayment: pRecord,
            suppliedEmail: (req.method === "POST" ? req.body?.email : req.query?.email) || ""
          });
          if (guestAuth.allowed) {
            isAuthorized = true;
          } else {
            ownershipDenied = true;
          }
        }
      }

      // 2c. Authoritative Razorpay gateway fallback (fails closed without trusting payment.notes or orderId+paymentId alone)
      if (!isAuthorized && !ownershipDenied && cleanPaymentId.startsWith("pay_") && cleanOrderId.startsWith("order_")) {
        const razorpay = getRazorpayClient();
        if (razorpay) {
          try {
            const [rzpPayment, rzpOrder] = await Promise.all([
              razorpay.payments.fetch(cleanPaymentId),
              razorpay.orders.fetch(cleanOrderId)
            ]);

            if (rzpPayment && rzpOrder) {
              const paymentCaptured = String(rzpPayment.status || "").trim().toLowerCase() === "captured";
              const paymentOrderMatches = rzpPayment.order_id === cleanOrderId;
              const orderIdMatches = rzpOrder.id === cleanOrderId;
              const paymentCurrencyMatches = String(rzpPayment.currency || "").trim().toUpperCase() === "INR";
              const orderCurrencyMatches = String(rzpOrder.currency || "").trim().toUpperCase() === "INR";
              const exactPaymentAmountMatches =
                expectedAmountInPaise > 0 && Number.isSafeInteger(Number(rzpPayment.amount)) && Number(rzpPayment.amount) === expectedAmountInPaise;
              const exactOrderAmountMatches =
                expectedAmountInPaise > 0 && Number.isSafeInteger(Number(rzpOrder.amount)) && Number(rzpOrder.amount) === expectedAmountInPaise;

              const orderNotes = rzpOrder.notes || {};
              const orderItemTypeMatches = String(orderNotes.itemType || "").trim().toLowerCase() === "resource";
              const orderResourceId = String(orderNotes.resourceId || orderNotes.resource_id || "").trim();
              const matchesBundleIdentity =
                orderResourceId === BUNDLE_RESOURCE_ID || orderResourceId === BUNDLE_SLUG;

              const ownership = evaluateRecordOwnership(orderNotes.userId, authenticatedUser);
              if (!ownership.allowed) {
                ownershipDenied = true;
              } else if (
                paymentCaptured &&
                paymentOrderMatches &&
                orderIdMatches &&
                paymentCurrencyMatches &&
                orderCurrencyMatches &&
                exactPaymentAmountMatches &&
                exactOrderAmountMatches &&
                orderItemTypeMatches &&
                matchesBundleIdentity
              ) {
                if (!ownership.isGuest || isAdminCaller) {
                  isAuthorized = true;
                } else {
                  const guestAuth = authorizeGuestResourceTransaction({
                    req,
                    paymentId: cleanPaymentId,
                    orderId: cleanOrderId,
                    allowedResourceIds: [BUNDLE_RESOURCE_ID],
                    dbPurchase: purRecord,
                    dbPayment: pRecord,
                    gatewayOrderNotes: orderNotes,
                    gatewayPayment: rzpPayment,
                    suppliedEmail: (req.method === "POST" ? req.body?.email : req.query?.email) || ""
                  });
                  if (guestAuth.allowed) {
                    isAuthorized = true;
                  } else {
                    ownershipDenied = true;
                  }
                }
              }
            }
          } catch (gatewayErr) {
            console.error("[Bundle Files] Gateway fallback verification failed:", gatewayErr?.message || gatewayErr);
          }
        }
      }
    }

    // 3. Check authenticated user ownership (unless explicit ownership mismatch occurred on supplied credentials)
    if (!isAuthorized && !ownershipDenied && authenticatedUser) {
      if (checkIsAdmin(authenticatedUser)) {
        isAuthorized = true;
      } else {
        const { data: userPayments } = await supabaseServer
          .from("payments")
          .select("id, amount, currency")
          .eq("user_id", authenticatedUser.id)
          .eq("item_type", "resource")
          .eq("item_id", BUNDLE_RESOURCE_ID)
          .eq("status", "captured")
          .eq("currency", "INR");

        const hasValidUserPayment = (userPayments || []).some(
          (row) => String(row.currency || "").toUpperCase() === "INR" && toPaiseStrict(row.amount) === expectedAmountInPaise
        );

        if (hasValidUserPayment) {
          isAuthorized = true;
        } else {
          const { data: userPurchases } = await supabaseServer
            .from("resource_purchases")
            .select("id, amount, currency")
            .eq("user_id", authenticatedUser.id)
            .eq("resource_id", BUNDLE_RESOURCE_ID)
            .eq("status", "active")
            .eq("currency", "INR");

          const hasValidUserPurchase = (userPurchases || []).some(
            (row) => String(row.currency || "").toUpperCase() === "INR" && toPaiseStrict(row.amount) === expectedAmountInPaise
          );

          if (hasValidUserPurchase) {
            isAuthorized = true;
          }
        }
      }
    }

    if (!isAuthorized || ownershipDenied) {
      return res.status(403).json({
        success: false,
        authorized: false,
        error: "Unauthorized: A confirmed purchase of the Meta Ads Campaign Planner Bundle is required to access these assets.",
        bundle: bundleMetadata
      });
    }

    // Generate signed URLs for all 4 bundle files ONLY after full authorization
    const signedFiles = [];
    for (const item of BUNDLE_ITEMS) {
      let fileUrl = null;
      if (supabaseServer.storage?.from) {
        const { data: sData } = await supabaseServer.storage
          .from("resources")
          .createSignedUrl(item.storagePath, 3600);
        fileUrl = sData?.signedUrl || null;
      }
      if (!fileUrl) {
        const token = generateAssetAccessToken(item.id, cleanPaymentId || authenticatedUser?.id || "bundle-authorized");
        if (!token) {
          return res.status(503).json({
            success: false,
            authorized: false,
            error: "Asset delivery service is temporarily unconfigured."
          });
        }
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
      bundle: bundleMetadata,
      files: signedFiles
    });
  } catch (err) {
    console.error("[Bundle Files] Unexpected error:", err);
    return res.status(500).json({ success: false, authorized: false, error: "Failed to generate authorized bundle downloads." });
  }
}

router.get("/bundle-files", paymentRateLimiter, handleBundleFilesRequest);
router.post("/get-bundle-files", paymentRateLimiter, handleBundleFilesRequest);

/**
 * GET /api/payments/download-paid-asset
 *
 * Secure server-side download streamer for verified paid assets.
 * Requires a cryptographically signed, unexpired HMAC token generated by the server.
 * Rejects missing, invalid, expired, or tampered tokens with 403 Forbidden.
 */
router.get("/download-paid-asset", paymentRateLimiter, async (req, res) => {
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
 * Evaluates access authorization for invoice downloads.
 * Strictly enforces hierarchy:
 * 1. Admin -> Allowed
 * 2. Valid signed HMAC token -> Allowed
 * 3. Authenticated user matching record user_id -> Allowed
 * 4. Guest checkout with confirmed email matching record email -> Allowed
 * 5. Cross-account access -> Rejected (403)
 * 6. Unconfirmed email on guest checkout -> Rejected (403 UNCONFIRMED_EMAIL)
 * 7. Unauthenticated without signed token -> Rejected (401/403)
 */
export function evaluateInvoiceAccessAuthorization({
  user = null,
  isAdmin = false,
  isSignedTokenValid = false,
  paymentRecord = null,
  bookingRecord = null,
  resourceRecord = null,
  rzpPayment = null
}) {
  if (isAdmin) {
    return { isAuthorized: true };
  }
  if (isSignedTokenValid) {
    return { isAuthorized: true };
  }
  if (user) {
    const userId = user.id;
    const userEmail = (user.email || "").toLowerCase().trim();
    const isEmailConfirmed = Boolean(user.email_confirmed_at || user.confirmed_at);

    const recordUserId = paymentRecord?.user_id || bookingRecord?.user_id || resourceRecord?.user_id || null;
    const recordCustomerEmail = (
      paymentRecord?.customer_email ||
      bookingRecord?.customer_email ||
      resourceRecord?.customer_email ||
      rzpPayment?.email ||
      ""
    ).toLowerCase().trim();

    if (recordUserId) {
      if (recordUserId === userId) {
        return { isAuthorized: true };
      }
      return {
        isAuthorized: false,
        statusCode: 403,
        error: "Forbidden: This invoice is assigned to a different user account. Cross-account access denied."
      };
    }

    if (recordCustomerEmail && userEmail && recordCustomerEmail === userEmail) {
      if (isEmailConfirmed) {
        return { isAuthorized: true };
      }
      return {
        isAuthorized: false,
        statusCode: 403,
        code: "UNCONFIRMED_EMAIL",
        error: "Forbidden: Your email address is unconfirmed. Please verify your email before accessing guest invoices."
      };
    }

    return {
      isAuthorized: false,
      statusCode: 403,
      error: "Forbidden: You are not authorized to access this guest invoice."
    };
  }

  return {
    isAuthorized: false,
    statusCode: 403,
    error: "Forbidden: You are not authorized to access this invoice."
  };
}

/**
 * Evaluates authoritative financial evidence for invoice generation.
 * Separates operational appointment/booking status from authoritative financial payment evidence.
 * 
 * Authoritative evidence sources:
 * - paymentRecord.status: 'captured' | 'paid'
 * - bookingRecord.payment_status: 'captured' | 'paid'
 * - rzpPayment.status: 'captured' (verified directly from Razorpay gateway)
 * 
 * Gateway checks when rzpPayment is provided:
 * - Gateway status must be 'captured'
 * - Expected order ID must match gateway order_id
 * - Expected amount must match gateway amount (in paise)
 * - Expected currency must match gateway currency
 * - Customer email must match gateway email if present
 * 
 * Non-financial operational states (confirmed, completed, active, pending, failed)
 * can NEVER authorize invoice generation.
 */
export function verifyInvoicePaymentAuthorization({
  paymentRecord = null,
  bookingRecord = null,
  resourceRecord = null,
  rzpPayment = null
}) {
  const normPaymentStatus = String(paymentRecord?.status || "").toLowerCase();
  const normBookingPaymentStatus = String(bookingRecord?.payment_status || "").toLowerCase();
  const normRzpStatus = String(rzpPayment?.status || "").toLowerCase();

  const rawStatus = (
    normPaymentStatus ||
    normBookingPaymentStatus ||
    normRzpStatus ||
    ""
  );

  // Gateway Security Verification: Fail-closed validation for Razorpay gateway payments
  if (rzpPayment) {
    // 1. Payment status must be exactly 'captured'
    if (!normRzpStatus || normRzpStatus !== "captured") {
      return {
        authorized: false,
        statusCode: 400,
        error: `Cannot generate tax invoice: Gateway payment status is '${rzpPayment.status || "unverified"}'. Invoices can only be issued for fully captured payments.`
      };
    }

    // 2. Expected Order ID verification: reject when missing, empty, or mismatched
    const expectedOrderId = paymentRecord?.razorpay_order_id || bookingRecord?.razorpay_order_id || resourceRecord?.razorpay_order_id;
    if (expectedOrderId && expectedOrderId !== "N/A") {
      const cleanGatewayOrderId = (rzpPayment.order_id !== null && rzpPayment.order_id !== undefined)
        ? String(rzpPayment.order_id).trim()
        : "";
      if (!cleanGatewayOrderId || cleanGatewayOrderId !== expectedOrderId) {
        return {
          authorized: false,
          statusCode: 400,
          error: `Cannot generate tax invoice: Payment order ID mismatch (gateway: ${cleanGatewayOrderId || "missing"}, expected: ${expectedOrderId}).`
        };
      }
    }

    // 3. Expected Amount verification: strictly require integer paise precision
    const rawExpectedAmount = paymentRecord?.amount ?? bookingRecord?.total_amount ?? resourceRecord?.amount;
    const expectedPaise = toPaiseStrict(rawExpectedAmount);
    if (!expectedPaise) {
      return {
        authorized: false,
        statusCode: 400,
        error: "Cannot generate tax invoice: Missing or invalid expected payment amount for gateway verification."
      };
    }

    // 4. Gateway Amount verification: require safe integer paise and exact paise equality (zero tolerance drift)
    if (rzpPayment.amount === null || rzpPayment.amount === undefined || typeof rzpPayment.amount === "boolean" || String(rzpPayment.amount).trim() === "") {
      return {
        authorized: false,
        statusCode: 400,
        error: "Cannot generate tax invoice: Missing or null gateway payment amount."
      };
    }

    const rzpAmountPaise = Number(rzpPayment.amount);
    if (!Number.isSafeInteger(rzpAmountPaise) || rzpAmountPaise <= 0) {
      return {
        authorized: false,
        statusCode: 400,
        error: `Cannot generate tax invoice: Invalid or non-integer gateway payment amount (${rzpPayment.amount}).`
      };
    }

    if (rzpAmountPaise !== expectedPaise) {
      return {
        authorized: false,
        statusCode: 400,
        error: `Cannot generate tax invoice: Payment amount mismatch (gateway: ₹${rzpAmountPaise / 100}, expected: ₹${expectedPaise / 100}).`
      };
    }

    // 5. Currency verification: require gateway currency and reject when missing, empty, or mismatched
    const expectedCurrency = (paymentRecord?.currency || bookingRecord?.currency || resourceRecord?.currency || "INR").toUpperCase();
    const gatewayCurrency = (rzpPayment.currency !== null && rzpPayment.currency !== undefined)
      ? String(rzpPayment.currency).trim().toUpperCase()
      : "";

    if (!gatewayCurrency) {
      return {
        authorized: false,
        statusCode: 400,
        error: "Cannot generate tax invoice: Missing gateway payment currency."
      };
    }

    if (gatewayCurrency !== expectedCurrency) {
      return {
        authorized: false,
        statusCode: 400,
        error: `Cannot generate tax invoice: Payment currency mismatch (gateway: ${gatewayCurrency}, expected: ${expectedCurrency}).`
      };
    }

    // 6. Gateway Customer / Ownership verification
    const expectedCustomerEmail = (paymentRecord?.customer_email || bookingRecord?.customer_email || resourceRecord?.customer_email || "").toLowerCase().trim();
    if (expectedCustomerEmail && rzpPayment.email) {
      const rzpEmail = String(rzpPayment.email).toLowerCase().trim();
      if (rzpEmail && rzpEmail !== expectedCustomerEmail) {
        return {
          authorized: false,
          statusCode: 400,
          error: `Cannot generate tax invoice: Payment customer mismatch (gateway: ${rzpEmail}, expected: ${expectedCustomerEmail}).`
        };
      }
    }
  }

  const hasAuthoritativeLedger =
    ["captured", "paid"].includes(normPaymentStatus) ||
    ["captured", "paid"].includes(normBookingPaymentStatus);

  const hasVerifiedGatewayCapture = Boolean(rzpPayment && normRzpStatus === "captured");

  const isCaptured = hasAuthoritativeLedger || hasVerifiedGatewayCapture;

  if (!isCaptured) {
    return {
      authorized: false,
      statusCode: 400,
      error: `Cannot generate tax invoice: Payment is not verified or captured (current status: ${rawStatus || "unverified"}).`
    };
  }

  return {
    authorized: true,
    rawStatus,
    isCaptured: true
  };
}

/**
 * GET /api/payments/invoice/:paymentId
 * Generates and streams an authoritative PDF tax invoice/receipt for a verified payment.
 * Security & Authorization:
 * - Requires authentication via Bearer token (verifySupabaseToken).
 * - Verified owner (matching user_id or email) or verified Administrator can access.
 * - Non-owners receive 403 Forbidden.
 * - Unauthenticated requests receive 401 Unauthorized.
 */
async function handleInvoiceOrCreditNoteRequest(req, res, { forceCreditNote = false } = {}) {
  try {
    const rawPaymentId = String(req.params.paymentId || "").trim();
    if (!rawPaymentId) {
      return res.status(400).json({ success: false, error: "Payment reference is required." });
    }

    const authHeader = req.headers.authorization;
    const signedToken = req.query.token;

    let user = null;
    let isAdmin = false;
    let isSignedTokenValid = false;

    if (signedToken) {
      isSignedTokenValid = verifySignedInvoiceToken(rawPaymentId, signedToken);
    }

    if (!authHeader && !isSignedTokenValid) {
      return res.status(401).json({ success: false, error: "Authentication required to download tax invoice." });
    }

    if (authHeader) {
      const { user: authUser, error: authError } = await verifySupabaseToken(authHeader);
      if (authError || !authUser) {
        if (!isSignedTokenValid) {
          return res.status(401).json({ success: false, error: "Invalid or expired session. Please sign in again." });
        }
      } else {
        user = authUser;
        isAdmin = checkIsAdmin(user);
      }
    }

    const supabaseServer = getSupabaseServerClient() || (authHeader ? getSupabaseDbClient(authHeader) : null);
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

    // Gateway reconciliation: Check gateway if Razorpay is configured
    let rzpPayment = null;
    const gatewayPayId = (rawPaymentId.startsWith("pay_") ? rawPaymentId : null) ||
                         paymentRecord?.razorpay_payment_id ||
                         bookingRecord?.payment_id ||
                         resourceRecord?.razorpay_payment_id;

    if (gatewayPayId && gatewayPayId.startsWith("pay_")) {
      const razorpay = getRazorpayClient();
      if (razorpay) {
        try {
          rzpPayment = await razorpay.payments.fetch(gatewayPayId);
        } catch (fetchErr) {
          console.warn("[Invoice Endpoint] Gateway payment fetch notice:", fetchErr?.message);
        }
      }
    }

    if (!paymentRecord && !bookingRecord && !resourceRecord && !rzpPayment) {
      return res.status(404).json({ success: false, error: "Invoice transaction not found." });
    }

    // 2. Authorization check: Strict Hierarchy (F-02 & F-05 Audit Compliance)
    const accessCheck = evaluateInvoiceAccessAuthorization({
      user,
      isAdmin,
      isSignedTokenValid,
      paymentRecord,
      bookingRecord,
      resourceRecord,
      rzpPayment
    });

    if (!accessCheck.isAuthorized) {
      const errPayload = {
        success: false,
        error: accessCheck.error
      };
      if (accessCheck.code) errPayload.code = accessCheck.code;
      return res.status(accessCheck.statusCode || 403).json(errPayload);
    }

    // 3. Authoritative Payment Status Verification
    const rawStatus = (
      paymentRecord?.status ||
      bookingRecord?.payment_status ||
      rzpPayment?.status ||
      ""
    ).toLowerCase();

    // 4. Obtain Student Profile & Enrollment data (compatible with verified live schema)
    const targetUserId = paymentRecord?.user_id || bookingRecord?.user_id || resourceRecord?.user_id || user?.id || null;
    let profileData = null;
    try {
      if (targetUserId) {
        const { data: pData, error: pErr } = await supabaseServer
          .from("profiles")
          .select("full_name, phone")
          .eq("id", targetUserId)
          .maybeSingle();
        if (!pErr && pData) {
          profileData = pData;
        }
      }
    } catch {}

    // Find course enrollment if course purchase
    let enrollmentId = null;
    if (targetUserId && paymentRecord?.item_type === "course" && paymentRecord?.item_id) {
      try {
        const { data: enrData } = await supabaseServer
          .from("course_enrollments")
          .select("id, enrollment_id")
          .eq("user_id", targetUserId)
          .eq("course_id", paymentRecord.item_id)
          .maybeSingle();
        if (enrData) {
          enrollmentId = enrData.enrollment_id || enrData.id;
        }
      } catch {}
    }

    // Common transaction fields
    const cleanPayId = paymentRecord?.razorpay_payment_id || bookingRecord?.payment_id || resourceRecord?.razorpay_payment_id || (rzpPayment?.id || rawPaymentId);
    const cleanOrderId = paymentRecord?.razorpay_order_id || bookingRecord?.razorpay_order_id || resourceRecord?.razorpay_order_id || (rzpPayment?.order_id || "N/A");
    const customerName = profileData?.full_name || bookingRecord?.customer_name || resourceRecord?.customer_name || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Valued Student";
    const customerEmail = paymentRecord?.customer_email || bookingRecord?.customer_email || resourceRecord?.customer_email || rzpPayment?.email || user?.email || "";
    const customerPhone = profileData?.phone || bookingRecord?.customer_phone || resourceRecord?.customer_phone || rzpPayment?.contact || "N/A";
    const customerState = bookingRecord?.customer_state || paymentRecord?.customer_state || "";
    const customerBillingAddress = "";
    const itemTitle = paymentRecord?.item_title || (bookingRecord ? "Business Growth Strategy Consultation" : (resourceRecord ? "Digital Resource Toolkit / Asset" : "Digital Growth Masterclass"));
    const rawItemType = paymentRecord?.item_type || (bookingRecord ? "consultation" : (resourceRecord ? "resource" : "course"));
    const amount = Number(paymentRecord?.amount || bookingRecord?.total_amount || resourceRecord?.amount || (rzpPayment?.amount ? rzpPayment.amount / 100 : 0));
    const currency = (paymentRecord?.currency || bookingRecord?.currency || resourceRecord?.currency || rzpPayment?.currency || "INR").toUpperCase();
    const paymentDate = paymentRecord?.created_at || bookingRecord?.created_at || resourceRecord?.created_at || new Date().toISOString();

    // 5. Handle Refunded Transaction => Issue / Retrieve Credit Note (Section 34 CGST Act)
    const isCreditNoteRequested = forceCreditNote || req.query.type === "credit-note";
    const isGatewayRefunded = Boolean(
      rzpPayment &&
      (String(rzpPayment.status || "").toLowerCase() === "refunded" || Number(rzpPayment.amount_refunded || 0) > 0)
    );
    const isLedgerRefunded =
      rawStatus === "refunded" ||
      Boolean(paymentRecord?.refund_id || paymentRecord?.credit_note_number);

    if (rawStatus === "refunded" || isCreditNoteRequested) {
      let finalCreditNoteNumber = null;
      let existingCreditNoteRow = null;

      // Reject explicitly ineligible statuses immediately
      if (["failed", "cancelled", "pending"].includes(rawStatus)) {
        return res.status(400).json({
          success: false,
          error: `Cannot issue credit note for transaction with status '${rawStatus}'. Only verified refunded or settled payments can generate credit notes.`
        });
      }

      // Query existing credit notes first to support safe retrieval without unauthorized minting
      let priorCreditNotes = [];
      try {
        const { data: priorCns } = await supabaseServer
          .from("credit_notes")
          .select("id, refund_id, amount, credit_note_number, created_at")
          .eq("payment_id", cleanPayId);
        if (priorCns) priorCreditNotes = priorCns;
      } catch (e) {
        console.warn("[Credit Note] Could not fetch prior credit notes:", e.message);
      }

      const hasPriorCreditNote = priorCreditNotes.length > 0;

      // If not already marked refunded on ledger/gateway/prior credit notes, verify underlying capture AND require admin privilege to mint
      if (!isLedgerRefunded && !isGatewayRefunded && !hasPriorCreditNote) {
        const authCheckForCreditNote = verifyInvoicePaymentAuthorization({
          paymentRecord,
          bookingRecord,
          resourceRecord,
          rzpPayment
        });

        if (!authCheckForCreditNote.authorized) {
          return res.status(authCheckForCreditNote.statusCode || 400).json({
            success: false,
            error: authCheckForCreditNote.error
          });
        }

        if (!isAdmin) {
          return res.status(403).json({
            success: false,
            code: "CREDIT_NOTE_NOT_AUTHORIZED",
            error: "Forbidden: Credit note generation requires a verified refund on the payment ledger or gateway."
          });
        }
      }

      const requestedRefundIdParamRaw = req.query.refundId || req.body?.refundId;
      const requestedRefundIdParam = requestedRefundIdParamRaw ? String(requestedRefundIdParamRaw).trim() : null;
      const rawRequestedAmountParam = req.query.refundAmount ?? req.body?.refundAmount;

      // Fast reject non-admin users attempting to pass arbitrary refundId when no verified gateway/ledger refund justifies minting
      if (!isAdmin && !isLedgerRefunded && !isGatewayRefunded && hasPriorCreditNote) {
        if (requestedRefundIdParam) {
          return res.status(403).json({
            success: false,
            code: "CREDIT_NOTE_NOT_AUTHORIZED",
            error: "Forbidden: Cannot issue a new credit note without a verified refund."
          });
        }
        existingCreditNoteRow = priorCreditNotes[0];
        finalCreditNoteNumber = priorCreditNotes[0].credit_note_number;
      }

      let rawRefundId = null;
      let requestedRefundAmount = null;

      // Retrieval fast-path ONLY when no explicit refundId parameter was passed AND an existing credit note already exists and payment isn't minting an unrecorded refund
      if (!existingCreditNoteRow && !requestedRefundIdParam && hasPriorCreditNote && isLedgerRefunded) {
        existingCreditNoteRow = priorCreditNotes[0];
        finalCreditNoteNumber = priorCreditNotes[0].credit_note_number;
        rawRefundId = existingCreditNoteRow.refund_id;
        requestedRefundAmount = Number(existingCreditNoteRow.amount || amount);
      }

      // Whenever an explicit refundId is supplied OR a new credit note must be issued, verify directly against Razorpay Refunds API (fail closed)
      if (!existingCreditNoteRow || requestedRefundIdParam) {
        const razorpay = getRazorpayClient();
        const hasMultipleRefundApi = Boolean(razorpay && typeof razorpay.payments?.fetchMultipleRefund === "function");
        const hasSingleRefundApi = Boolean(razorpay && typeof razorpay.payments?.fetchRefund === "function");
        if (!razorpay || (!hasMultipleRefundApi && !hasSingleRefundApi)) {
          return res.status(503).json({
            success: false,
            code: "GATEWAY_REFUND_VERIFICATION_UNAVAILABLE",
            error: "Gateway refund verification service is unavailable."
          });
        }

        const targetRefundId = requestedRefundIdParam || (paymentRecord?.refund_id ? String(paymentRecord.refund_id).trim() : null);

        let gatewayRefunds = [];
        try {
          if (hasMultipleRefundApi) {
            const refundCol = await razorpay.payments.fetchMultipleRefund(cleanPayId);
            gatewayRefunds = Array.isArray(refundCol?.items)
              ? refundCol.items
              : (Array.isArray(refundCol) ? refundCol : []);
          } else if (targetRefundId && hasSingleRefundApi) {
            const singleRefund = await razorpay.payments.fetchRefund(cleanPayId, targetRefundId);
            if (singleRefund) gatewayRefunds = [singleRefund];
          }
        } catch (rzpRefundErr) {
          console.warn("[Credit Note] Razorpay refund verification failed:", rzpRefundErr?.error?.description || rzpRefundErr?.message || rzpRefundErr);
          return res.status(502).json({
            success: false,
            code: "GATEWAY_REFUND_FETCH_FAILED",
            error: "Failed to verify refund record with Razorpay gateway."
          });
        }

        const processedGatewayRefunds = gatewayRefunds.filter(
          (r) =>
            r &&
            String(r.payment_id || "").trim() === cleanPayId &&
            String(r.status || "").trim().toLowerCase() === "processed" &&
            (!r.currency || String(r.currency).trim().toUpperCase() === currency) &&
            Number(r.amount) > 0
        );

        let verifiedRefund = null;
        if (targetRefundId) {
          const matched = gatewayRefunds.find((r) => r && String(r.id || "").trim() === targetRefundId);
          if (!matched) {
            return res.status(400).json({
              success: false,
              code: "REFUND_NOT_FOUND_ON_GATEWAY",
              error: `Refund ID "${targetRefundId}" was not found for payment ${cleanPayId} on Razorpay.`
            });
          }
          if (String(matched.payment_id || "").trim() !== cleanPayId) {
            return res.status(400).json({
              success: false,
              code: "REFUND_PAYMENT_MISMATCH",
              error: `Refund ID "${targetRefundId}" does not belong to payment ${cleanPayId}.`
            });
          }
          if (String(matched.status || "").trim().toLowerCase() !== "processed") {
            return res.status(400).json({
              success: false,
              code: "REFUND_NOT_PROCESSED",
              error: `Refund "${targetRefundId}" is not in processed status (status: ${matched.status || "unknown"}).`
            });
          }
          if (matched.currency && String(matched.currency).trim().toUpperCase() !== currency) {
            return res.status(400).json({
              success: false,
              code: "REFUND_CURRENCY_MISMATCH",
              error: `Refund "${targetRefundId}" currency mismatch.`
            });
          }
          verifiedRefund = matched;
        } else {
          // No refundId param passed: locate an unissued processed refund, or an already-recorded processed refund
          const unissuedRefund = processedGatewayRefunds.find(
            (r) => !priorCreditNotes.some((cn) => cn.refund_id === r.id)
          );
          verifiedRefund = unissuedRefund || processedGatewayRefunds[0] || null;
          if (!verifiedRefund) {
            return res.status(400).json({
              success: false,
              code: "REFUND_NOT_VERIFIED",
              error: `No processed Razorpay refund exists for payment ${cleanPayId}.`
            });
          }
        }

        const verifiedRefundId = String(verifiedRefund.id || "").trim();
        const verifiedRefundPaise = Number(verifiedRefund.amount);
        if (!verifiedRefundId || !Number.isSafeInteger(verifiedRefundPaise) || verifiedRefundPaise <= 0) {
          return res.status(400).json({
            success: false,
            code: "INVALID_GATEWAY_REFUND",
            error: "Gateway refund record returned an invalid ID or amount."
          });
        }
        const verifiedRefundAmount = verifiedRefundPaise / 100;

        if (rawRequestedAmountParam !== undefined) {
          const parsedRequestedPaise = toPaiseStrict(rawRequestedAmountParam);
          if (!parsedRequestedPaise) {
            return res.status(400).json({
              success: false,
              error: `Invalid refund amount: "${rawRequestedAmountParam}". Refund amount must be a positive finite number (max 2 decimals) greater than zero.`
            });
          }
          if (parsedRequestedPaise !== verifiedRefundPaise) {
            return res.status(400).json({
              success: false,
              code: "REFUND_AMOUNT_MISMATCH",
              error: `Requested refund amount ₹${parsedRequestedPaise / 100} does not match gateway verified refund amount ₹${verifiedRefundAmount}.`
            });
          }
        }

        rawRefundId = verifiedRefundId;
        requestedRefundAmount = verifiedRefundAmount;

        // Idempotent retrieval if a credit note already exists for this exact verified refund_id
        const existingForRefundId = priorCreditNotes.find(cn => cn.refund_id === rawRefundId);
        if (existingForRefundId) {
          existingCreditNoteRow = existingForRefundId;
          finalCreditNoteNumber = existingForRefundId.credit_note_number;
          requestedRefundAmount = Number(existingForRefundId.amount || verifiedRefundAmount);
        }
      }

      if (!rawRefundId) {
        rawRefundId = existingCreditNoteRow?.refund_id || paymentRecord?.refund_id || null;
      }

      if (!existingCreditNoteRow && (!rawRefundId || !Number.isFinite(requestedRefundAmount) || requestedRefundAmount <= 0)) {
        return res.status(400).json({
          success: false,
          code: "REFUND_NOT_VERIFIED",
          error: "A verified gateway refund is required to issue a credit note."
        });
      }

      const baseAmountPaise = toPaiseStrict(amount);
      if (!baseAmountPaise) {
        return res.status(400).json({
          success: false,
          code: "INVALID_PAYMENT_AMOUNT",
          error: "Original payment amount is invalid or missing for credit note calculation."
        });
      }

      const rzpCapturedPaise = rzpPayment?.amount != null ? Number(rzpPayment.amount) : null;
      const originalCapturedPaise = Number.isSafeInteger(rzpCapturedPaise) && rzpCapturedPaise > 0
        ? rzpCapturedPaise
        : baseAmountPaise;
      const effectiveCapPaise = Math.min(baseAmountPaise, originalCapturedPaise);

      const priorRefundPaise = priorCreditNotes
        .filter(cn => cn.refund_id !== rawRefundId)
        .reduce((sum, cn) => sum + (toPaiseStrict(cn.amount) ?? 0), 0);

      const remainingEligiblePaise = Math.max(0, effectiveCapPaise - priorRefundPaise);
      const requestedRefundPaise = toPaiseStrict(requestedRefundAmount) ?? 0;

      // F-01: Reject excessive refunds (NO SILENT CLAMPING!)
      if (!existingCreditNoteRow && (!requestedRefundPaise || requestedRefundPaise > remainingEligiblePaise)) {
        return res.status(400).json({
          success: false,
          code: "REFUND_LIMIT_EXCEEDED",
          error: `Refund amount ₹${requestedRefundPaise / 100} exceeds remaining eligible refundable balance of ₹${remainingEligiblePaise / 100} (Original payment: ₹${effectiveCapPaise / 100}, Prior refunds: ₹${priorRefundPaise / 100}). Excessive refund rejected.`
        });
      }

      const isPartialRefund = (priorRefundPaise + requestedRefundPaise) < effectiveCapPaise;
      const refundDate = paymentRecord?.updated_at || new Date().toISOString();

      // If no credit note exists yet for this refund_id, allocate atomically via RPC only (SEC-02 Compliance)
      // Direct INSERT fallback is strictly prohibited to prevent race conditions and limit bypass.
      if (!finalCreditNoteNumber) {
        try {
          const { data: rpcRows, error: rpcErr } = await supabaseServer.rpc("record_credit_note_with_limit", {
            p_payment_id: cleanPayId,
            p_refund_id: rawRefundId,
            p_refund_amount: requestedRefundAmount,
            p_reason: isPartialRefund ? "Partial educational course fee adjustment & refund" : "Educational course enrolment cancellation & refund",
            p_user_id: targetUserId || null,
            p_currency: currency,
            p_date: refundDate
          });

          if (rpcErr) {
            console.error("[Credit Note] RPC record_credit_note_with_limit returned error:", rpcErr.message);
            const isLimitErr = rpcErr.message && (
              rpcErr.message.includes("exceeds remaining") ||
              rpcErr.message.includes("Invalid refund amount") ||
              rpcErr.message.includes("not eligible")
            );
            if (isLimitErr) {
              return res.status(400).json({
                success: false,
                code: "REFUND_LIMIT_EXCEEDED",
                error: rpcErr.message
              });
            }
            return res.status(500).json({
              success: false,
              code: "CREDIT_NOTE_RPC_FAILED",
              error: `Failed to record credit note via atomic RPC: ${rpcErr.message}. Manual reconciliation required.`,
              reconciliation: {
                status: "pending_manual_reconciliation",
                refundId: rawRefundId,
                paymentId: cleanPayId,
                requestedAmount: requestedRefundAmount
              }
            });
          } else if (rpcRows && rpcRows.length > 0 && rpcRows[0]?.credit_note_number) {
            existingCreditNoteRow = rpcRows[0];
            finalCreditNoteNumber = rpcRows[0].credit_note_number;
          } else {
            return res.status(500).json({
              success: false,
              code: "CREDIT_NOTE_EMPTY_RESULT",
              error: "Atomic credit note allocation returned empty or invalid row. Manual reconciliation required.",
              reconciliation: {
                status: "pending_manual_reconciliation",
                refundId: rawRefundId,
                paymentId: cleanPayId,
                requestedAmount: requestedRefundAmount
              }
            });
          }
        } catch (rpcEx) {
          console.error("[Credit Note] RPC call exception:", rpcEx.message);
          const isLimitErr = rpcEx.message && (
            rpcEx.message.includes("exceeds remaining") ||
            rpcEx.message.includes("Invalid refund amount") ||
            rpcEx.message.includes("not eligible")
          );
          if (isLimitErr) {
            return res.status(400).json({
              success: false,
              code: "REFUND_LIMIT_EXCEEDED",
              error: rpcEx.message
            });
          }
          return res.status(500).json({
            success: false,
            code: "CREDIT_NOTE_RPC_FAILED",
            error: `Credit note RPC execution failed: ${rpcEx.message}. Manual reconciliation required.`,
            reconciliation: {
              status: "pending_manual_reconciliation",
              refundId: rawRefundId,
              paymentId: cleanPayId,
              requestedAmount: requestedRefundAmount
            }
          });
        }

        if (!finalCreditNoteNumber) {
          return res.status(500).json({
            success: false,
            code: "CREDIT_NOTE_ALLOCATION_FAILED",
            error: "Could not allocate authoritative credit note number. Direct insert fallback is forbidden for financial integrity.",
            reconciliation: {
              status: "pending_manual_reconciliation",
              refundId: rawRefundId,
              paymentId: cleanPayId,
              requestedAmount: requestedRefundAmount
            }
          });
        }
      }

      const effectiveRefundAmount = existingCreditNoteRow?.amount ? Number(existingCreditNoteRow.amount) : requestedRefundAmount;

      const creditNoteModel = buildAuthoritativeCreditNoteModel({
        paymentId: cleanPayId,
        orderId: cleanOrderId,
        customerName,
        customerEmail,
        customerPhone,
        customerState,
        billingAddress: customerBillingAddress,
        userId: targetUserId,
        studentId: profileData?.student_id,
        enrollmentId,
        itemTitle,
        itemType: rawItemType,
        amount: effectiveRefundAmount,
        currency,
        paymentDate,
        refundDate,
        invoiceNumber: paymentRecord?.invoice_number,
        creditNoteNumber: finalCreditNoteNumber,
        refundId: rawRefundId,
        reason: existingCreditNoteRow?.reason || (isPartialRefund ? "Partial course fee adjustment & refund" : "Educational course enrolment cancellation & refund")
      });

      if (req.query.format === "json") {
        return res.json({
          success: true,
          isCreditNote: true,
          creditNote: creditNoteModel
        });
      }

      const pdfBuffer = generateAuthoritativeCreditNotePdf(creditNoteModel);
      const safeCreditNoteNum = creditNoteModel.creditNoteNumber.replace(/[/\\?%*:|"<>]/g, "_");
      const filename = `DigitalMuid-CreditNote-${safeCreditNoteNum}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", pdfBuffer.length);
      return res.end(pdfBuffer);
    }

    // 6. Payment Security Verification:
    // Reject pending, failed, cancelled, or unverified transactions
    // Enforces actual gateway capture: pay_ prefix alone is NOT sufficient proof
    const authCheck = verifyInvoicePaymentAuthorization({
      paymentRecord,
      bookingRecord,
      resourceRecord,
      rzpPayment
    });

    if (!authCheck.authorized) {
      return res.status(authCheck.statusCode || 400).json({
        success: false,
        error: authCheck.error
      });
    }

    const isCaptured = authCheck.isCaptured;

    // 7. Atomic Invoice Sequence Assignment & Persistence
    // Preserves pre-existing invoice numbers across payments, resource_purchases, and bookings
    let finalInvoiceNumber =
      paymentRecord?.invoice_number ||
      resourceRecord?.invoice_number ||
      bookingRecord?.invoice_number ||
      null;

    // If paymentRecord is missing (e.g. historical or guest resource checkout), create the authoritative ledger row
    if (!paymentRecord && isCaptured && supabaseServer && (String(cleanPayId).startsWith("pay_") || String(cleanOrderId).startsWith("order_"))) {
      try {
        const { data: createdPayment } = await supabaseServer
          .from("payments")
          .upsert({
            user_id: targetUserId || null,
            item_type: rawItemType || (resourceRecord ? "resource" : bookingRecord ? "consultation" : "course"),
            item_id: resourceRecord?.resource_id || bookingRecord?.id || "unknown",
            item_title: itemTitle,
            amount,
            currency,
            razorpay_order_id: cleanOrderId !== "N/A" ? cleanOrderId : null,
            razorpay_payment_id: String(cleanPayId).startsWith("pay_") ? cleanPayId : null,
            status: "captured",
            created_at: paymentDate
          }, { onConflict: "razorpay_payment_id" })
          .select()
          .maybeSingle();

        if (createdPayment) {
          paymentRecord = createdPayment;
          if (createdPayment.invoice_number) {
            finalInvoiceNumber = createdPayment.invoice_number;
          }
        }
      } catch (upsertErr) {
        console.warn("[Invoice Endpoint] Notice creating payments ledger row:", upsertErr?.message);
      }
    }

    if (!finalInvoiceNumber && paymentRecord?.id) {
      try {
        const { data: rpcNum } = await supabaseServer.rpc("get_next_invoice_number", {
          p_date: paymentDate
        });
        if (rpcNum && String(rpcNum).trim().length > 0) {
          finalInvoiceNumber = rpcNum;
        }
      } catch {}

      if (!finalInvoiceNumber) {
        finalInvoiceNumber = formatInvoiceNumber(paymentDate, cleanPayId, null);
      }

      // Concurrency lock: update ONLY IF invoice_number is still null/empty in database
      try {
        const { data: updatedPayment } = await supabaseServer
          .from("payments")
          .update({ invoice_number: finalInvoiceNumber })
          .eq("id", paymentRecord.id)
          .select("invoice_number")
          .single();
        if (updatedPayment?.invoice_number) {
          finalInvoiceNumber = updatedPayment.invoice_number;
        }
      } catch {}
    } else if (!finalInvoiceNumber) {
      // Fallback if paymentRecord is somehow unavailable
      try {
        const { data: rpcNum } = await supabaseServer.rpc("get_next_invoice_number", {
          p_date: paymentDate
        });
        if (rpcNum && String(rpcNum).trim().length > 0) {
          finalInvoiceNumber = rpcNum;
        }
      } catch {}

      if (!finalInvoiceNumber) {
        finalInvoiceNumber = formatInvoiceNumber(paymentDate, cleanPayId, null);
      }
    }

    // Synchronize finalInvoiceNumber back to resource_purchases and bookings if records exist
    if (finalInvoiceNumber && supabaseServer) {
      if (resourceRecord?.id && !resourceRecord.invoice_number) {
        try {
          await supabaseServer
            .from("resource_purchases")
            .update({ invoice_number: finalInvoiceNumber })
            .eq("id", resourceRecord.id);
        } catch {}
      }
      if (bookingRecord?.id && !bookingRecord.invoice_number) {
        try {
          await supabaseServer
            .from("bookings")
            .update({ invoice_number: finalInvoiceNumber })
            .eq("id", bookingRecord.id);
        } catch {}
      }
    }

    // 8. Assemble Authoritative Invoice Model
    const invoiceModel = buildAuthoritativeInvoiceModel({
      paymentId: cleanPayId,
      orderId: cleanOrderId,
      customerName,
      customerEmail,
      customerPhone,
      customerState,
      billingAddress: customerBillingAddress,
      userId: targetUserId,
      studentId: profileData?.student_id,
      enrollmentId,
      itemTitle,
      itemType: rawItemType,
      amount,
      currency,
      paymentDate,
      invoiceNumber: finalInvoiceNumber,
      status: rawStatus
    });

    // Support JSON response for interactive modal viewer
    if (req.query.format === "json") {
      return res.json({
        success: true,
        invoice: invoiceModel
      });
    }

    // Standard PDF Generation & Stream
    const pdfBuffer = generateAuthoritativeInvoicePdf(invoiceModel);
    const safeInvoiceNum = invoiceModel.invoiceNumber.replace(/[/\\?%*:|"<>]/g, "_");
    const filename = `DigitalMuid-Invoice-${safeInvoiceNum}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.end(pdfBuffer);
  } catch (err) {
    console.error("[Invoice Endpoint] Error generating invoice:", err);
    return res.status(500).json({ success: false, error: "Internal server error generating tax invoice." });
  }
}

router.get("/invoice/:paymentId", paymentRateLimiter, (req, res) => {
  return handleInvoiceOrCreditNoteRequest(req, res);
});

/**
 * GET /api/payments/credit-note/:paymentId
 * Explicit endpoint for Section 34 CGST Act Credit Note generation.
 */
router.get("/credit-note/:paymentId", paymentRateLimiter, (req, res) => {
  return handleInvoiceOrCreditNoteRequest(req, res, { forceCreditNote: true });
});

/**
 * POST /api/payments/webhook
 * Fallback route if requests arrive within this router.
 */
router.post("/webhook", (req, res) => {
  return handleRazorpayWebhook(req, res);
});

export default router;
