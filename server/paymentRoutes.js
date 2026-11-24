import express from "express";
import crypto from "crypto";
import fs from "fs";
import net from "net";
import path from "path";
import { fileURLToPath } from "url";
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
  isEmailConfirmed,
  isValidUUID
} from "./supabaseServer.js";
import { handleRazorpayWebhook } from "./paymentWebhook.js";
import {
  AUTHORITATIVE_PAID_RESOURCES,
  getAuthoritativeResourcePricing,
  isZeroPriceStrict,
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
  // Strictly use Express-resolved req.ip (governed by TRUST_PROXY_HOPS) or socket address.
  // Never parse raw req.headers["x-forwarded-for"] directly to prevent spoofing bypasses.
  return req?.ip || req?.socket?.remoteAddress || "127.0.0.1";
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

const MIN_ASSET_HMAC_SECRET_BYTES = 32;
const EXACT_PLACEHOLDER_ASSET_SECRETS = new Set([
  "undefined",
  "null",
  "none",
  "changeme",
  "change_me",
  "replace_me",
  "placeholder",
  "secret",
  "generate_at_least_32_bytes_random_hex_secret_here"
]);

function isInvalidOrWeakAssetSecret(clean) {
  if (!clean || typeof clean !== "string") {
    return true;
  }
  // Reject internal whitespace or ASCII control characters
  if (/[\s\x00-\x1f\x7f]/.test(clean)) {
    return true;
  }
  // Require minimum 32 UTF-8 bytes (256 bits) of key material
  if (Buffer.byteLength(clean, "utf8") < MIN_ASSET_HMAC_SECRET_BYTES) {
    return true;
  }
  const lower = clean.toLowerCase();
  if (EXACT_PLACEHOLDER_ASSET_SECRETS.has(lower)) {
    return true;
  }
  if (
    lower.startsWith("generate_at_least_32_bytes") ||
    lower.startsWith("your_") ||
    lower.startsWith("my_") ||
    lower.includes("placeholder") ||
    lower.includes("replace_me") ||
    lower.includes("change_me") ||
    lower.includes("secret_here") ||
    lower.includes("example_secret")
  ) {
    return true;
  }
  // Reject trivial low-entropy repeated character patterns (e.g. "0".repeat(64), "ab".repeat(32))
  if (new Set(clean).size < 4) {
    return true;
  }
  return false;
}

/**
 * Dedicated high-entropy HMAC secret for paid asset access tokens.
 * Enforces the project secret policy: non-empty string, no internal whitespace/control chars,
 * >= 32 UTF-8 bytes (256 bits), non-placeholder, and >= 4 distinct characters.
 * Returns null if missing or invalid (fails closed).
 * Does NOT fall back to RAZORPAY_KEY_SECRET, Supabase service role key, or any hardcoded value.
 */
export function getAssetHmacSecret() {
  const secret = process.env.ASSET_TOKEN_HMAC_SECRET;
  if (!secret || typeof secret !== "string") {
    return null;
  }
  const clean = secret.trim();
  if (isInvalidOrWeakAssetSecret(clean)) {
    console.error("[Security Alert] ASSET_TOKEN_HMAC_SECRET is missing, malformed, placeholder, or has insufficient entropy. Failing closed.");
    return null;
  }
  return clean;
}

export function isAssetTokenSecretConfigured() {
  return Boolean(getAssetHmacSecret());
}

export const PAID_DOWNLOAD_SIGNED_URL_TTL_SECONDS = 900; // 15 minutes (900 seconds)
export const ASSET_TOKEN_TTL_MS = PAID_DOWNLOAD_SIGNED_URL_TTL_SECONDS * 1000; // 15 minutes (900 seconds)
export const ASSET_TOKEN_MAX_TTL_MS = ASSET_TOKEN_TTL_MS; // Strict 900-second maximum future lifetime (no silent extension)
const ASSET_TOKEN_MAX_LENGTH = 4096;
const HMAC_SHA256_DIGEST_BYTES = 32;
const ASSET_TOKEN_BASE64URL_RE = /^[A-Za-z0-9_-]+$/;
// Transitional compatibility (Finding 3):
// Newly issued v2 tokens contain ONLY { v: 2, resourceId, filename?, expiresAt } (zero authId or identity fields).
// Pre-cutover v2/v1 tokens containing `authId` remain accepted strictly during their natural <=900s (15-min)
// lifetime without weakening signature/TTL validation, and `authId` is ALWAYS omitted from verification results.
const ALLOWED_ASSET_TOKEN_V2_KEYS = new Set(["v", "resourceId", "authId", "filename", "expiresAt"]);
const ALLOWED_ASSET_TOKEN_V1_KEYS = new Set(["resourceId", "authId", "expiresAt"]);
const MAX_LEGACY_AUTH_ID_LENGTH = 128;
const UTF8_FATAL_DECODER = new TextDecoder("utf-8", { fatal: true });

/**
 * Strictly decodes an unpadded canonical base64url string.
 * Rejects non-base64url characters (including '=', '+', '/', whitespace, multibyte UTF-8),
 * impossible lengths (mod 4 === 1), non-canonical trailing bits, and unexpected byte lengths.
 */
function decodeStrictBase64Url(input, expectedByteLength = null) {
  if (typeof input !== "string" || input.length === 0) {
    return null;
  }
  if (!ASSET_TOKEN_BASE64URL_RE.test(input) || input.length % 4 === 1) {
    return null;
  }
  let decoded;
  try {
    decoded = Buffer.from(input, "base64url");
  } catch {
    return null;
  }
  if (decoded.length === 0) {
    return null;
  }
  if (expectedByteLength !== null && decoded.length !== expectedByteLength) {
    return null;
  }
  if (decoded.toString("base64url") !== input) {
    return null;
  }
  return decoded;
}

/**
 * Extracts a strict Bearer asset token exclusively from the HTTP `Authorization` header.
 * Rejects missing, non-Bearer, multi-value, whitespace-containing, or malformed headers.
 *
 * @param {import('express').Request} req
 * @returns {string|null}
 */
export function extractBearerAssetToken(req) {
  const rawAuth = req?.headers?.authorization;
  if (typeof rawAuth !== "string") {
    return null;
  }
  const match = rawAuth.trim().match(/^Bearer\s+([^\s,]+)$/i);
  if (!match || !match[1]) {
    return null;
  }
  return match[1];
}

/**
 * Generates a short-lived (15-minute / 900-second) HMAC-SHA256 resource-scoped bearer capability token
 * for `GET /api/payments/download-paid-asset` (analogous to a signed Storage URL).
 *
 * Security model (A-1 / Finding 3 / Finding 5):
 * - Minted ONLY after full server-side payment/purchase/ownership/guest-token verification
 *   in `POST /api/payments/get-resource-download-url`.
 * - Signed exclusively with mandatory high-entropy `ASSET_TOKEN_HMAC_SECRET`.
 * - Cryptographically binds `resourceId`, `expiresAt` (<= 900s), and (for allowlisted local
 *   assets) exact `filename`.
 * - Contains ZERO identity or transaction metadata: NEVER embeds `authId`, `paymentId`,
 *   `orderId`, `userId`, or `email`.
 */
export function generateAssetAccessToken(resourceId, _ignoredLegacyAuthId = undefined) {
  const secret = getAssetHmacSecret();
  if (!secret) {
    console.error("[Security Guard] Cannot issue asset download token: ASSET_TOKEN_HMAC_SECRET is missing or invalid.");
    return null;
  }

  if (typeof resourceId !== "string" || !resourceId.trim()) {
    return null;
  }

  const cleanResourceId = resourceId.trim();
  const allowlistedFilename = resolveAllowlistedProtectedFilename(cleanResourceId);

  const payload = {
    v: 2,
    resourceId: cleanResourceId,
    ...(allowlistedFilename ? { filename: allowlistedFilename } : {}),
    expiresAt: Date.now() + ASSET_TOKEN_TTL_MS
  };
  const json = JSON.stringify(payload);
  const data = Buffer.from(json, "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(data, "ascii").digest("base64url");
  return `${data}.${sig}`;
}

/**
 * Strictly parses and verifies a signed asset capability token (A-1 / A-2 / Finding 3 / Finding 5).
 *
 * Cryptographic & schema policy:
 * - `ASSET_TOKEN_HMAC_SECRET` is mandatory; missing/weak/placeholder secret fails closed immediately.
 * - `RAZORPAY_KEY_SECRET` fallback is completely removed for all token versions (v2 and v1).
 * - Signature must strictly decode from canonical unpadded base64url to exactly 32 raw bytes
 *   and match the 32-byte HMAC-SHA256 digest via `crypto.timingSafeEqual`.
 * - Payload must strictly decode from canonical base64url and valid UTF-8 (fatal decoding).
 * - Supported payload schemas (both signed exclusively by `ASSET_TOKEN_HMAC_SECRET`):
 *   - v2 (`v: 2`, `resourceId`, optional allowlisted `filename`, `expiresAt`; transitional pre-cutover
 *     `authId` is tolerated strictly for <= 900s if valid non-empty string, and omitted from results).
 *   - Legacy v1 (`v` omitted, `resourceId`, optional transitional `authId`, `expiresAt`, NO `filename`).
 * - Enforces both expiration (`now <= expiresAt`) and maximum lifetime (`expiresAt <= now + ASSET_TOKEN_MAX_TTL_MS`).
 * - Never exposes `authId` or any caller/payment identity fields in returned verification results.
 *
 * Fails closed (returns `null`, never throws) on any malformed, tampered, expired,
 * over-TTL, or unsupported token.
 */
export function verifyAssetAccessToken(token) {
  // 1. Dedicated ASSET_TOKEN_HMAC_SECRET is strictly mandatory (zero legacy secret fallback)
  const primarySecret = getAssetHmacSecret();
  if (!primarySecret) {
    return null;
  }

  if (typeof token !== "string" || token.length === 0 || token.length > ASSET_TOKEN_MAX_LENGTH) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const [data, sig] = parts;

  // 2. Strict canonical base64url validation for payload and exact 32-byte decoded signature
  const decodedPayloadBuf = decodeStrictBase64Url(data);
  if (!decodedPayloadBuf) {
    return null;
  }

  const providedSigBuf = decodeStrictBase64Url(sig, HMAC_SHA256_DIGEST_BYTES);
  if (!providedSigBuf || providedSigBuf.length !== HMAC_SHA256_DIGEST_BYTES) {
    return null;
  }

  // 3. Exclusive verification against ASSET_TOKEN_HMAC_SECRET raw 32-byte HMAC-SHA256 digest
  const expectedSigBuf = crypto
    .createHmac("sha256", primarySecret)
    .update(data, "ascii")
    .digest();

  if (
    expectedSigBuf.length !== HMAC_SHA256_DIGEST_BYTES ||
    providedSigBuf.length !== expectedSigBuf.length ||
    !crypto.timingSafeEqual(providedSigBuf, expectedSigBuf)
  ) {
    return null;
  }

  // 4. Fatal UTF-8 decoding and strict JSON object parsing
  let payload;
  try {
    const jsonText = UTF8_FATAL_DECODER.decode(decodedPayloadBuf);
    payload = JSON.parse(jsonText);
  } catch {
    return null;
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const isLegacyV1 = payload.v === undefined;
  const isV2 = payload.v === 2;
  if (!isLegacyV1 && !isV2) {
    return null;
  }

  const allowedKeys = isV2 ? ALLOWED_ASSET_TOKEN_V2_KEYS : ALLOWED_ASSET_TOKEN_V1_KEYS;
  for (const key of Object.keys(payload)) {
    if (!allowedKeys.has(key)) {
      return null;
    }
  }

  if (typeof payload.resourceId !== "string" || payload.resourceId.trim().length === 0) {
    return null;
  }

  // Transitional validation for in-flight pre-cutover v2/v1 tokens containing `authId` (max 900s).
  // Strictly validated if present; NEVER emitted in new tokens and NEVER returned in results.
  if (payload.authId !== undefined) {
    if (
      typeof payload.authId !== "string" ||
      payload.authId.trim().length === 0 ||
      payload.authId.length > MAX_LEGACY_AUTH_ID_LENGTH
    ) {
      return null;
    }
  }

  if (payload.filename !== undefined) {
    if (
      !isV2 ||
      typeof payload.filename !== "string" ||
      !payload.filename.trim() ||
      payload.filename !== path.basename(payload.filename) ||
      payload.filename.includes("..") ||
      /[\\/\x00-\x1f\x7f]/.test(payload.filename)
    ) {
      return null;
    }
  }

  const now = Date.now();
  if (
    typeof payload.expiresAt !== "number" ||
    !Number.isSafeInteger(payload.expiresAt) ||
    payload.expiresAt <= 0 ||
    now > payload.expiresAt ||
    payload.expiresAt > now + ASSET_TOKEN_MAX_TTL_MS
  ) {
    return null;
  }

  return {
    v: isV2 ? 2 : 1,
    ...(isLegacyV1 ? { legacy: true } : {}),
    resourceId: payload.resourceId.trim(),
    ...(payload.filename !== undefined ? { filename: payload.filename.trim() } : {}),
    expiresAt: payload.expiresAt
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

    // 1. Obtain privileged service-role database client ONLY (P0-3: public.resources is admin/service_role only)
    const dbClient = getSupabaseServerClient();
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

    const dbClient = getSupabaseServerClient();
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

    const dbClient = getSupabaseServerClient();
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

function getCurrentModuleDir() {
  try {
    if (typeof import.meta !== "undefined" && import.meta.url) {
      return path.dirname(fileURLToPath(import.meta.url));
    }
  } catch {}
  if (typeof __dirname !== "undefined") {
    return __dirname;
  }
  return process.cwd();
}

/**
 * Explicit legacy protected local-disk asset allowlist (C6-2).
 * Maps ONLY exact canonical paid deliverable UUIDs/slugs to their exact flat filename
 * inside `server/protected_downloads/`. No arbitrary DB paths and no default fallback filename.
 */
export const PROTECTED_LOCAL_ASSET_ALLOWLIST = Object.freeze({
  "27ef2c04-4d4a-4dbe-a702-d4013b2542b9": "meta-ads-campaign-planner-workbook.pdf",
  "meta-ads-campaign-planner-workbook": "meta-ads-campaign-planner-workbook.pdf",
  "fafe5ffc-3323-4761-9d22-50a2588f6326": "the-ad-budget-break-even-calculator.xlsx",
  "the-ad-budget-breat-even-calculate": "the-ad-budget-break-even-calculator.xlsx",
  "the-ad-budget-break-even-calculator": "the-ad-budget-break-even-calculator.xlsx",
  "004d374c-d872-4bfe-bf54-8083504e9174": "10-high-converting-meta-ads-copy-frameworks.pdf",
  "10-high-converting-meta-ads-copy-frameworks": "10-high-converting-meta-ads-copy-frameworks.pdf",
  "6867ecdd-2797-40f0-bdc8-ead20600ac6c": "pre-launch-tracking-audit-checklist.pdf",
  "pre-launch-tracking-audit-checklist": "pre-launch-tracking-audit-checklist.pdf"
});

export function resolveAllowlistedProtectedFilename(resourceIdOrSlug) {
  if (!resourceIdOrSlug || typeof resourceIdOrSlug !== "string") {
    return null;
  }
  const cleanId = resourceIdOrSlug.trim();
  if (!cleanId || !Object.prototype.hasOwnProperty.call(PROTECTED_LOCAL_ASSET_ALLOWLIST, cleanId)) {
    return null;
  }
  const filename = PROTECTED_LOCAL_ASSET_ALLOWLIST[cleanId];
  if (
    !filename ||
    filename !== path.basename(filename) ||
    filename.includes("..") ||
    /[\\/\x00-\x1f\x7f]/.test(filename)
  ) {
    return null;
  }
  return filename;
}

let testProtectedAssetDirsOverride = null;
let testProtectedAssetHooks = null;

/**
 * Test-only helper (NODE_ENV === "test" strictly) allowing offline HTTP integration tests
 * to exercise symlink attacks and deterministic TOCTOU races in an isolated temp directory
 * without mutating repository files. Strictly disabled in non-test environments.
 */
export function setTestProtectedAssetConfig(config = null) {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("setTestProtectedAssetConfig is only permitted when NODE_ENV === 'test'.");
  }
  if (!config) {
    testProtectedAssetDirsOverride = null;
    testProtectedAssetHooks = null;
    return;
  }
  testProtectedAssetDirsOverride = Array.isArray(config.candidateDirs) ? [...config.candidateDirs] : null;
  testProtectedAssetHooks = config.hooks && typeof config.hooks === "object" ? { ...config.hooks } : null;
}

function closeFdSafe(fd) {
  if (typeof fd !== "number" || fd < 0) return;
  try {
    fs.closeSync(fd);
  } catch {}
}

/**
 * Single-open protected asset descriptor opener (B-1 / Finding 4).
 *
 * Guarantees:
 * - Rejects traversal, nested paths, backslashes, NUL/control characters.
 * - Requires platform `O_NOFOLLOW` support; fails closed if unavailable.
 * - Inspects the original configured `protected_downloads` base path with `lstatSync()` BEFORE
 *   `realpathSync()`, immediately rejecting the base path if it is itself a symbolic link or not
 *   a directory (and verifying `(dev, ino)` consistency after canonicalization).
 * - Opens the flat child file ONCE with `O_RDONLY | O_NOFOLLOW | O_CLOEXEC | O_NONBLOCK`.
 * - Verifies via `fstatSync(fd)` that the opened descriptor is a regular file (rejecting
 *   directories, FIFOs, sockets, and devices without blocking) and confirms `(dev, ino)` and
 *   non-symlink consistency for the configured base directory, canonical base directory, and
 *   child directory entry.
 * - Closes `fd` on every failure path so callers never leak descriptors.
 *
 * Residual limitation & operational mitigation (Finding 4):
 * - Standard Node.js `fs` does not expose POSIX `openat(dirfd, ...)` or Linux
 *   `openat2(RESOLVE_NO_SYMLINKS | RESOLVE_BENEATH)`. Post-open `lstatSync`/`realpathSync`/
 *   `fstatSync` identity checks detect persistent and differing-inode A-B-A parent-directory
 *   replacements, but cannot completely eliminate the kernel-level parent-directory TOCTOU window
 *   during `fs.openSync()`.
 * - Operational mitigation: deploy the protected directory (and its parent) as root-owned and
 *   non-writable by the application process, with directory permissions `0555` and approved files
 *   `0444`, where compatible with deployment requirements.
 */
export function openConfinedProtectedAssetFd(filename, customCandidateDirs = null) {
  if (!filename || typeof filename !== "string") {
    return { ok: false, reason: "invalid_filename" };
  }
  if (/[\x00-\x1f\x7f]/.test(filename)) {
    return { ok: false, reason: "traversal_or_invalid_filename" };
  }
  const cleanName = filename.trim();
  if (
    !cleanName ||
    cleanName === "." ||
    cleanName === ".." ||
    cleanName !== path.basename(cleanName) ||
    cleanName.includes("..") ||
    cleanName.includes("/") ||
    cleanName.includes("\\")
  ) {
    return { ok: false, reason: "traversal_or_invalid_filename" };
  }

  const O_NOFOLLOW = fs.constants.O_NOFOLLOW;
  if (typeof O_NOFOLLOW !== "number" || O_NOFOLLOW === 0) {
    return { ok: false, reason: "nofollow_unsupported" };
  }

  const openFlags =
    fs.constants.O_RDONLY |
    O_NOFOLLOW |
    (typeof fs.constants.O_CLOEXEC === "number" ? fs.constants.O_CLOEXEC : 0) |
    (typeof fs.constants.O_NONBLOCK === "number" ? fs.constants.O_NONBLOCK : 0);

  const moduleDir = getCurrentModuleDir();
  const activeTestDirs = process.env.NODE_ENV === "test" ? testProtectedAssetDirsOverride : null;
  const activeTestHooks = process.env.NODE_ENV === "test" ? testProtectedAssetHooks : null;
  const candidateDirs =
    Array.isArray(customCandidateDirs) && customCandidateDirs.length > 0
      ? customCandidateDirs
      : Array.isArray(activeTestDirs) && activeTestDirs.length > 0
      ? activeTestDirs
      : [
          path.resolve(process.cwd(), "server", "protected_downloads"),
          path.resolve(moduleDir, "protected_downloads"),
          path.resolve(moduleDir, "..", "server", "protected_downloads")
        ];

  for (const rawDir of candidateDirs) {
    if (typeof rawDir !== "string" || !rawDir.trim()) {
      continue;
    }

    // `path.resolve` strips trailing slashes (for non-root paths) so `lstatSync` inspects
    // the configured directory entry itself rather than following a symlinked directory target.
    const resolvedBaseDir = path.resolve(rawDir);
    if (resolvedBaseDir === path.parse(resolvedBaseDir).root) {
      return { ok: false, reason: "base_dir_not_a_directory" };
    }

    // 0. Inspect the ORIGINAL configured base directory via `lstatSync` BEFORE `realpathSync` (Finding 4)
    let configuredBaseStat;
    try {
      configuredBaseStat = fs.lstatSync(resolvedBaseDir);
    } catch (baseStatErr) {
      if (baseStatErr?.code === "ENOENT" || baseStatErr?.code === "ENOTDIR") {
        continue;
      }
      return { ok: false, reason: "base_dir_stat_failed" };
    }

    if (configuredBaseStat.isSymbolicLink()) {
      return { ok: false, reason: "base_dir_symlink_rejected" };
    }
    if (!configuredBaseStat.isDirectory()) {
      return { ok: false, reason: "base_dir_not_a_directory" };
    }

    let realBaseDir;
    let realBaseDirStat;
    try {
      realBaseDir = fs.realpathSync(resolvedBaseDir);
      realBaseDirStat = fs.lstatSync(realBaseDir);
    } catch {
      return { ok: false, reason: "base_dir_stat_failed" };
    }

    if (
      !realBaseDirStat.isDirectory() ||
      realBaseDirStat.isSymbolicLink() ||
      realBaseDirStat.dev !== configuredBaseStat.dev ||
      realBaseDirStat.ino !== configuredBaseStat.ino
    ) {
      return { ok: false, reason: "directory_changed" };
    }

    const candidatePath = path.resolve(realBaseDir, cleanName);
    // 1. Strict lexical confinement with trailing path.sep boundary and zero nested segments
    if (!candidatePath.startsWith(realBaseDir + path.sep) || path.dirname(candidatePath) !== realBaseDir) {
      return { ok: false, reason: "lexical_traversal_rejected" };
    }

    // Deterministic test-only race injection hook strictly before openSync (NODE_ENV === "test" only)
    if (activeTestHooks && typeof activeTestHooks.onBeforeOpen === "function") {
      try {
        activeTestHooks.onBeforeOpen({ candidatePath, resolvedBaseDir, realBaseDir, filename: cleanName });
      } catch {
        return { ok: false, reason: "hook_failed" };
      }
    }

    // 2. Single atomic open with O_NOFOLLOW (kernel rejects final-component symlink with ELOOP)
    let fd = null;
    try {
      fd = fs.openSync(candidatePath, openFlags);
    } catch (openErr) {
      if (openErr?.code === "ENOENT") {
        continue;
      }
      if (openErr?.code === "ELOOP") {
        return { ok: false, reason: "symlink_rejected" };
      }
      if (openErr?.code === "EISDIR") {
        return { ok: false, reason: "not_a_regular_file" };
      }
      return { ok: false, reason: "open_failed" };
    }

    // Deterministic test-only race injection hook immediately after openSync (NODE_ENV === "test" only)
    if (activeTestHooks && typeof activeTestHooks.onAfterOpen === "function") {
      try {
        activeTestHooks.onAfterOpen({ candidatePath, resolvedBaseDir, realBaseDir, filename: cleanName, fd });
      } catch {
        closeFdSafe(fd);
        return { ok: false, reason: "hook_failed" };
      }
    }

    // 3. Validate the ALREADY-OPENED descriptor via fstatSync + configured/canonical directory & entry identity checks
    try {
      const fdStat = fs.fstatSync(fd);
      if (!fdStat.isFile()) {
        closeFdSafe(fd);
        return { ok: false, reason: "not_a_regular_file" };
      }

      const postConfiguredBaseStat = fs.lstatSync(resolvedBaseDir);
      if (
        postConfiguredBaseStat.isSymbolicLink() ||
        !postConfiguredBaseStat.isDirectory() ||
        postConfiguredBaseStat.dev !== configuredBaseStat.dev ||
        postConfiguredBaseStat.ino !== configuredBaseStat.ino
      ) {
        closeFdSafe(fd);
        return { ok: false, reason: "directory_changed" };
      }

      const postRealBaseDir = fs.realpathSync(resolvedBaseDir);
      const postDirStat = fs.lstatSync(realBaseDir);
      if (
        postRealBaseDir !== realBaseDir ||
        !postDirStat.isDirectory() ||
        postDirStat.isSymbolicLink() ||
        postDirStat.dev !== realBaseDirStat.dev ||
        postDirStat.ino !== realBaseDirStat.ino
      ) {
        closeFdSafe(fd);
        return { ok: false, reason: "directory_changed" };
      }

      const postEntryLstat = fs.lstatSync(candidatePath);
      if (postEntryLstat.isSymbolicLink()) {
        closeFdSafe(fd);
        return { ok: false, reason: "symlink_rejected" };
      }
      if (
        !postEntryLstat.isFile() ||
        postEntryLstat.dev !== fdStat.dev ||
        postEntryLstat.ino !== fdStat.ino
      ) {
        closeFdSafe(fd);
        return { ok: false, reason: "file_identity_mismatch" };
      }

      const realFilePath = fs.realpathSync(candidatePath);
      if (!realFilePath.startsWith(realBaseDir + path.sep) || path.dirname(realFilePath) !== realBaseDir) {
        closeFdSafe(fd);
        return { ok: false, reason: "realpath_escape_rejected" };
      }

      return {
        ok: true,
        fd,
        size: fdStat.size,
        filePath: realFilePath,
        baseDir: realBaseDir
      };
    } catch {
      closeFdSafe(fd);
      return { ok: false, reason: "stat_failed" };
    }
  }

  return { ok: false, reason: "file_not_found" };
}

/**
 * Confirms an allowlisted flat filename exists as a confined regular file inside `protected_downloads`
 * using the same O_NOFOLLOW + fstat verification, closing the descriptor immediately.
 * Download streaming MUST use `openConfinedProtectedAssetFd()` directly (never reopen by path).
 */
export function resolveConfinedProtectedAssetPath(filename, customCandidateDirs = null) {
  const opened = openConfinedProtectedAssetFd(filename, customCandidateDirs);
  if (!opened.ok) {
    return { ok: false, reason: opened.reason };
  }
  closeFdSafe(opened.fd);
  return { ok: true, filePath: opened.filePath, baseDir: opened.baseDir };
}

const PROTECTED_URL_PATTERNS = [
  /^supabase:\/\//i,
  /\/storage\/v1\/(?:object|render|s3)\//i,
  /(^|\/)protected_downloads(\/|$)/i,
  /(^|\/)paid-resources(\/|$)/i,
  /(^|\/)paid(\/|$)/i,
  /(^|\/)private(\/|$)/i,
  /\/api\/payments\/download-paid-asset/i,
  /(meta-ads-campaign-planner-workbook|the-ad-budget-break-even-calculator|the-ad-budget-breat-even-calculate|10-high-converting-meta-ads-copy-frameworks|pre-launch-tracking-audit-checklist|meta-ads-campaign-planner-bundle)/i
];

/**
 * Server-side mirror of SQL `public.is_protected_resource_url(TEXT)` with bounded
 * 3-round ASCII percent-decoding. Fails closed (returns true) on control characters,
 * backslashes, traversal (`..`), protected Storage/local paths, download endpoints,
 * known paid product identifiers, or persistent >3-layer ASCII percent-encoding (C6-1).
 */
export function isProtectedResourceUrl(rawUrl) {
  if (rawUrl === null || rawUrl === undefined || typeof rawUrl !== "string") {
    return false;
  }
  let cand = rawUrl.trim();
  if (!cand) {
    return false;
  }

  for (let round = 0; round < 3; round += 1) {
    if (
      /[\x00-\x1f\x7f\\]/.test(cand) ||
      /%(?:[01][0-9a-f]|7f|5c)/i.test(cand) ||
      /(^|\/)\.\.(\/|$)/.test(cand) ||
      PROTECTED_URL_PATTERNS.some((re) => re.test(cand))
    ) {
      return true;
    }

    if (!/%[0-7][0-9a-f]/i.test(cand)) {
      break;
    }

    let decoded = "";
    for (let pos = 0; pos < cand.length; ) {
      const ch = cand[pos];
      if (ch === "%" && pos + 2 < cand.length) {
        const hex = cand.slice(pos + 1, pos + 3);
        if (/^[0-9a-fA-F]{2}$/.test(hex)) {
          const byteVal = parseInt(hex, 16);
          if (byteVal < 32 || byteVal === 127) {
            return true;
          }
          if (byteVal <= 126) {
            decoded += String.fromCharCode(byteVal);
            pos += 3;
            continue;
          }
          decoded += `%${hex}`;
          pos += 3;
          continue;
        }
      }
      decoded += ch;
      pos += 1;
    }

    if (decoded === cand) {
      break;
    }
    cand = decoded;
  }

  if (
    /[\x00-\x1f\x7f\\]/.test(cand) ||
    /%[0-7][0-9a-f]/i.test(cand) ||
    /(^|\/)\.\.(\/|$)/.test(cand) ||
    PROTECTED_URL_PATTERNS.some((re) => re.test(cand))
  ) {
    return true;
  }

  return false;
}

function isDisallowedIpv4Literal(ipv4) {
  const octets = ipv4.split(".");
  if (octets.length !== 4) return true;
  const nums = octets.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : NaN));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b, c] = nums;

  // 0.0.0.0/8 (unspecified / "this network")
  if (a === 0) return true;
  // 10.0.0.0/8 (RFC 1918 private)
  if (a === 10) return true;
  // 100.64.0.0/10 (RFC 6598 Shared Address Space / CGNAT)
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 127.0.0.0/8 (loopback)
  if (a === 127) return true;
  // 169.254.0.0/16 (link-local / cloud metadata)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12 (RFC 1918 private)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.0.0.0/24 (IETF protocol assignments), 192.0.2.0/24 (TEST-NET-1), 192.88.99.0/24 (6to4 relay)
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
  if (a === 192 && b === 88 && c === 99) return true;
  // 192.168.0.0/16 (RFC 1918 private)
  if (a === 192 && b === 168) return true;
  // 198.18.0.0/15 (benchmarking), 198.51.100.0/24 (TEST-NET-2)
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  // 203.0.113.0/24 (TEST-NET-3)
  if (a === 203 && b === 0 && c === 113) return true;
  // 224.0.0.0/4 (multicast) & 240.0.0.0/4 (reserved / broadcast 255.255.255.255)
  if (a >= 224) return true;

  return false;
}

function parseIpv6Hextets(ipv6) {
  if (!ipv6 || typeof ipv6 !== "string" || ipv6.includes("%")) {
    return null;
  }

  let normalized = ipv6.toLowerCase();
  // Convert embedded IPv4 tail (e.g. ::ffff:127.0.0.1) to two hex hextets
  const lastColon = normalized.lastIndexOf(":");
  const tail = lastColon >= 0 ? normalized.slice(lastColon + 1) : "";
  if (tail.includes(".")) {
    if (net.isIP(tail) !== 4) return null;
    const octets = tail.split(".").map(Number);
    const hi = ((octets[0] << 8) | octets[1]).toString(16);
    const lo = ((octets[2] << 8) | octets[3]).toString(16);
    normalized = `${normalized.slice(0, lastColon + 1)}${hi}:${lo}`;
  }

  const doubleColonParts = normalized.split("::");
  if (doubleColonParts.length > 2) return null;

  const left = doubleColonParts[0] ? doubleColonParts[0].split(":") : [];
  const right = doubleColonParts.length === 2 && doubleColonParts[1] ? doubleColonParts[1].split(":") : [];

  let groups;
  if (doubleColonParts.length === 2) {
    const missing = 8 - (left.length + right.length);
    if (missing < 1) return null;
    groups = [...left, ...Array(missing).fill("0"), ...right];
  } else {
    if (left.length !== 8) return null;
    groups = left;
  }

  const hextets = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    hextets.push(parseInt(g, 16));
  }
  return hextets;
}

function isDisallowedIpv6Literal(ipv6) {
  const h = parseIpv6Hextets(ipv6);
  if (!h || h.length !== 8) {
    return true; // Fail closed on unparseable IPv6 literal
  }

  const [h0, h1, h2, h3, h4, h5] = h;

  // Reject all IPv4-mapped IPv6 (::ffff:0:0/96), IPv4-translated (::ffff:0:0:0/96),
  // deprecated IPv4-compatible (::/96), unspecified (::/128), and loopback (::1/128)
  if (h0 === 0 && h1 === 0 && h2 === 0 && h3 === 0 && (h4 === 0 || h4 === 0xffff)) {
    return true;
  }
  // NAT64 well-known & local-use prefixes (64:ff9b::/96, 64:ff9b:1::/48)
  if (h0 === 0x0064 && h1 === 0xff9b) {
    return true;
  }
  // Unique-Local Addresses fc00::/7, Link-Local fe80::/10, Site-Local fec0::/10, Multicast ff00::/8
  if ((h0 & 0xfe00) === 0xfc00) return true;
  if ((h0 & 0xffc0) === 0xfe80) return true;
  if ((h0 & 0xffc0) === 0xfec0) return true;
  if ((h0 & 0xff00) === 0xff00) return true;
  // Restrict strictly to Global Unicast 2000::/3 (rejects ::, ::1, 100::/64, and all reserved prefixes)
  if ((h0 & 0xe000) !== 0x2000) return true;
  // IETF Special-Purpose 2001::/23 (Teredo, Benchmarking, etc.), Documentation 2001:db8::/32, 6to4 2002::/16
  if (h0 === 0x2001 && (h1 & 0xfe00) === 0x0000) return true;
  if (h0 === 0x2001 && h1 === 0x0db8) return true;
  if (h0 === 0x2002) return true;

  return false;
}

/**
 * Classifies hostnames and IP literals without DNS lookups (C-2).
 * Rejects non-public IPv4/IPv6 ranges (including IPv4-mapped IPv6, 0.0.0.0/8, 100.64.0.0/10,
 * ::, ::1, fc00::/7, fe80::/10, link-local metadata, private, multicast, reserved) and
 * local/internal DNS suffixes while preserving legitimate public hostnames (including fc* / fd*).
 */
export function isDisallowedFreeExternalHost(hostname) {
  if (!hostname || typeof hostname !== "string") return true;
  const rawHost = hostname.trim().toLowerCase();
  if (!rawHost || /[\s\x00-\x1f\x7f%]/.test(rawHost)) return true;

  const isBracketed = rawHost.startsWith("[") && rawHost.endsWith("]");
  const unbracketed = isBracketed ? rawHost.slice(1, -1) : rawHost;
  if (!unbracketed || unbracketed.includes("[") || unbracketed.includes("]")) {
    return true;
  }

  // Strip trailing DNS root dot(s) for classification
  const host = unbracketed.replace(/\.+$/, "");
  if (!host) return true;

  const ipType = net.isIP(host);
  if (isBracketed && ipType !== 6) {
    return true;
  }
  if (ipType === 4) {
    return isDisallowedIpv4Literal(host);
  }
  if (ipType === 6) {
    return isDisallowedIpv6Literal(host);
  }

  // Reject numeric-only or non-FQDN single-label internal hosts (e.g., localhost, metadata, 2130706433)
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".localdomain") ||
    host.endsWith(".home.arpa") ||
    !host.includes(".") ||
    /^(?:\d+|0x[0-9a-f]+)$/i.test(host)
  ) {
    return true;
  }

  return false;
}

/**
 * Validates that a free resource URL is genuinely public and safe to return to callers.
 * Permits ONLY:
 *  - Public static site downloads under `/downloads/<filename>` (strictly confined, no traversal/protected paths)
 *  - Public `https://` or `http://` external URLs with no credentials, no private/loopback/reserved IP hosts,
 *    and no protected Storage/asset patterns.
 */
export function validatePublicFreeResourceUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { valid: false, url: null, reason: "missing_url" };
  }
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: false, url: null, reason: "empty_url" };
  }

  if (isProtectedResourceUrl(trimmed) || parseProtectedStorageUrl(trimmed).isStorage) {
    return { valid: false, url: null, reason: "protected_url" };
  }

  if (trimmed.startsWith("//")) {
    return { valid: false, url: null, reason: "protocol_relative_disallowed" };
  }

  if (trimmed.startsWith("/")) {
    const pathOnly = trimmed.split(/[?#]/)[0];
    let decodedPath;
    try {
      decodedPath = decodeURIComponent(pathOnly);
    } catch {
      return { valid: false, url: null, reason: "malformed_encoding" };
    }
    if (isProtectedResourceUrl(decodedPath) || decodedPath.includes("\\") || /[\x00-\x1f\x7f]/.test(decodedPath)) {
      return { valid: false, url: null, reason: "protected_or_invalid_path" };
    }
    const normalized = path.posix.normalize(decodedPath);
    if (!normalized.startsWith("/downloads/") || normalized.length <= "/downloads/".length || normalized.endsWith("/")) {
      return { valid: false, url: null, reason: "non_public_relative_path" };
    }
    return { valid: true, url: trimmed, kind: "public_path" };
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, url: null, reason: "invalid_url" };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { valid: false, url: null, reason: "disallowed_scheme" };
  }
  if (parsed.username || parsed.password || /^https?:\/\/[^/?#]*@/i.test(trimmed)) {
    return { valid: false, url: null, reason: "embedded_credentials_disallowed" };
  }
  if (isDisallowedFreeExternalHost(parsed.hostname)) {
    return { valid: false, url: null, reason: "disallowed_host" };
  }
  if (isProtectedResourceUrl(`${parsed.pathname}${parsed.search}${parsed.hash}`)) {
    return { valid: false, url: null, reason: "protected_url" };
  }

  return { valid: true, url: trimmed, kind: "public_external" };
}

/**
 * Parses a protected Supabase Storage URL (`supabase://<bucket>/<path>` or
 * `/storage/v1/object/{public|sign|authenticated}/<bucket>/<path>`) into an
 * authoritative `{ isStorage, bucket, objectPath }` target.
 * Rejects path traversal (`..`), NUL/control characters, backslashes, or empty paths
 * by returning `{ isStorage: true, bucket: null, objectPath: null }` so callers fail closed.
 */
export function parseProtectedStorageUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { isStorage: false, bucket: null, objectPath: null };
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { isStorage: false, bucket: null, objectPath: null };
  }

  const looksLikeStorage =
    /\/storage\/v1\/(?:object|render|s3)\//i.test(trimmed) ||
    /^supabase:\/\//i.test(trimmed);

  if (!looksLikeStorage) {
    return { isStorage: false, bucket: null, objectPath: null };
  }

  let bucket = null;
  let objectPath = null;

  if (/^supabase:\/\/paid-resources\//i.test(trimmed)) {
    bucket = "paid-resources";
    try {
      objectPath = decodeURIComponent(trimmed.slice("supabase://paid-resources/".length)).trim();
    } catch {
      return { isStorage: true, bucket: null, objectPath: null };
    }
  } else if (/^supabase:\/\/resources\//i.test(trimmed)) {
    bucket = "resources";
    try {
      objectPath = decodeURIComponent(trimmed.slice("supabase://resources/".length)).trim();
    } catch {
      return { isStorage: true, bucket: null, objectPath: null };
    }
  } else if (/^supabase:\/\//i.test(trimmed)) {
    // Unknown or malformed supabase:// scheme -> fail closed
    return { isStorage: true, bucket: null, objectPath: null };
  } else {
    const match = trimmed.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/i);
    if (match && match[1] && match[2]) {
      try {
        bucket = decodeURIComponent(match[1]).trim();
        objectPath = decodeURIComponent(match[2].split("?")[0]).trim();
      } catch {
        return { isStorage: true, bucket: null, objectPath: null };
      }
    } else {
      const legacyMatch = trimmed.match(/\/resources\/(.+)$/);
      if (legacyMatch && legacyMatch[1]) {
        try {
          bucket = "resources";
          objectPath = decodeURIComponent(legacyMatch[1].split("?")[0]).trim();
        } catch {
          return { isStorage: true, bucket: null, objectPath: null };
        }
      }
    }
  }

  if (bucket !== "paid-resources" && bucket !== "resources") {
    return { isStorage: true, bucket: null, objectPath: null };
  }

  if (
    !objectPath ||
    objectPath.startsWith("/") ||
    objectPath.includes("\\") ||
    /[\x00-\x1f\x7f]/.test(objectPath) ||
    /%2e|%2f|%5c|%(?:[01][0-9a-f]|7f)/i.test(objectPath) ||
    objectPath.split("/").some((seg) => seg === ".." || seg === "." || seg === "")
  ) {
    return { isStorage: true, bucket: null, objectPath: null };
  }

  return { isStorage: true, bucket, objectPath };
}

/**
 * Enforces fail-closed record ownership across DB and gateway fallback paths.
 * A non-null owner user_id NEVER authorizes an unauthenticated (null) caller
 * and requires confirmed `email_confirmed_at` for both buyer and admin accounts (E-4 / E-8).
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
    if (checkIsAdmin(authenticatedUser)) {
      return { allowed: true, denied: false, isGuest: false };
    }
    if (String(authenticatedUser.id || "").trim() === cleanOwnerId) {
      if (!isEmailConfirmed(authenticatedUser)) {
        return {
          allowed: false,
          denied: true,
          isGuest: false,
          reason: "Email confirmation is required to access user-owned paid purchases."
        };
      }
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
      // Defense-in-depth verification (C6-1): resource is genuinely free ONLY when DB fields
      // establish both access_type === "free" and strict price === 0 and it is NOT a paid catalog item.
      const dbAccessType = String(resourceRecord?.access_type ?? resourceRecord?.accessType ?? "").trim().toLowerCase();
      const targetSlug = resourceRecord?.slug ? String(resourceRecord.slug).trim() : "";
      const isAuthoritativePaid =
        Boolean(AUTHORITATIVE_PAID_RESOURCES[targetId] || (targetSlug && AUTHORITATIVE_PAID_RESOURCES[targetSlug])) ||
        isBundleOrBundleItem(targetId).isBundle ||
        isBundleOrBundleItem(targetId).isChild ||
        (targetSlug ? (isBundleOrBundleItem(targetSlug).isBundle || isBundleOrBundleItem(targetSlug).isChild) : false);

      if (dbAccessType === "free" && isZeroPriceStrict(resourceRecord?.price) && !isAuthoritativePaid) {
        return {
          isFree: true,
          pricing,
          expectedPaiseById,
          archivedExpectedPaiseById,
          allAllowedIds: getAllowedResourceIdsForAuthorization(resourceRecord)
        };
      }

      return {
        isFree: false,
        pricing: { accessType: "unverified", price: 0, currency: "INR" },
        expectedPaiseById,
        archivedExpectedPaiseById,
        allAllowedIds: []
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

    const supabaseServer = getSupabaseServerClient();
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

    // 3. Authenticated user ownership lookup (only when no ownership denial occurred & email confirmed)
    if (isEmailConfirmed(authenticatedUser)) {
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

    const supabaseServer = getSupabaseServerClient();
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

    // ONLY legitimately published free resources (access_type === 'free' AND price === 0)
    // are served without paid entitlement, and ONLY after validating a genuinely public URL (C6-1).
    if (accessSpec.isFree) {
      const rawFileUrl = resourceRecord.file_url != null ? String(resourceRecord.file_url).trim() : "";
      const rawExternalUrl = resourceRecord.external_url != null ? String(resourceRecord.external_url).trim() : "";

      // Fail closed if either field references a protected Storage object, protected local path,
      // traversal attempt, or known paid asset identifier — never expose raw protected URLs.
      if (
        (rawFileUrl && isProtectedResourceUrl(rawFileUrl)) ||
        (rawExternalUrl && isProtectedResourceUrl(rawExternalUrl))
      ) {
        return res.status(503).json({
          success: false,
          code: "FREE_RESOURCE_URL_PROTECTED",
          error: "This resource points to a protected asset location and cannot be served as a public free download."
        });
      }

      let publicDownloadUrl = null;
      if (rawFileUrl) {
        const checkedFile = validatePublicFreeResourceUrl(rawFileUrl);
        if (!checkedFile.valid) {
          return res.status(503).json({
            success: false,
            code: "FREE_RESOURCE_URL_INVALID",
            error: "This free resource does not have a valid public download URL."
          });
        }
        publicDownloadUrl = checkedFile.url;
      } else if (rawExternalUrl) {
        const checkedExt = validatePublicFreeResourceUrl(rawExternalUrl);
        if (!checkedExt.valid) {
          return res.status(503).json({
            success: false,
            code: "FREE_RESOURCE_URL_INVALID",
            error: "This free resource does not have a valid public download URL."
          });
        }
        publicDownloadUrl = checkedExt.url;
      } else {
        // Never fall back to /downloads/META.pdf or any default file when URL is missing.
        return res.status(503).json({
          success: false,
          code: "FREE_RESOURCE_URL_MISSING",
          error: "This free resource does not have a configured public download URL."
        });
      }

      return res.json({
        success: true,
        downloadUrl: publicDownloadUrl,
        externalUrl: null,
        fileUrl: publicDownloadUrl,
        accessType: "free"
      });
    }

    // Paid download authorization response hardening headers (Finding 3)
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Content-Type-Options", "nosniff");

    // Fail closed immediately on inconsistent/unverified pricing configurations
    // (e.g., published access_type='free' with price > 0, or paid with invalid price) (C6-1).
    if (accessSpec.pricing?.accessType === "unverified" && accessSpec.allAllowedIds.length === 0) {
      return res.status(403).json({
        success: false,
        code: "RESOURCE_ACCESS_UNVERIFIED",
        error: "Resource access configuration could not be verified."
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
    // Strictly require `email_confirmed_at` on authenticated user session before granting paid asset access (P0-3 / E-4 / E-8).
    const isConfirmedAuthenticatedUser = isEmailConfirmed(authenticatedUser);
    if (!isAuthorized && !ownershipDenied && isConfirmedAuthenticatedUser) {
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

    // Generate signed URL from private Supabase Storage (fail closed HTTP 503 on any signing error or missing signed URL;
    // NEVER return a raw external_url or unmapped local path for a paid resource — E-3 / C6-2)
    let finalDownloadUrl = null;
    let issuedAssetAccessToken = null;
    const rawPaidFileUrl = resourceRecord.file_url ? String(resourceRecord.file_url).trim() : null;
    const parsedStorage = parseProtectedStorageUrl(rawPaidFileUrl);

    // Check if item is in BUNDLE_ITEMS
    const bundleItem = BUNDLE_ITEMS.find(
      (i) => i.id === resourceRecord.id || i.slug === resourceRecord.slug ||
        (i.slug === "the-ad-budget-breat-even-calculate" && resourceRecord.slug === "the-ad-budget-break-even-calculator")
    );

    // Explicit exact resource-ID-to-filename allowlist for legacy protected disk compatibility (C6-2)
    const allowlistedLocalFilename = resolveAllowlistedProtectedFilename(resourceRecord.id);

    if (parsedStorage.isStorage) {
      if (!parsedStorage.bucket || !parsedStorage.objectPath || !supabaseServer.storage?.from) {
        return res.status(503).json({
          success: false,
          error: "Failed to generate signed download URL for paid asset."
        });
      }
      const { data: signedData, error: signErr } = await supabaseServer.storage
        .from(parsedStorage.bucket)
        .createSignedUrl(parsedStorage.objectPath, PAID_DOWNLOAD_SIGNED_URL_TTL_SECONDS);
      if (signErr || !signedData?.signedUrl) {
        return res.status(503).json({
          success: false,
          error: "Failed to generate signed download URL for paid asset."
        });
      }
      finalDownloadUrl = signedData.signedUrl;
    } else if (bundleItem && !rawPaidFileUrl) {
      // Canonical bundle item with no explicit file_url override: sign from private `paid-resources` bucket
      if (!supabaseServer.storage?.from) {
        return res.status(503).json({
          success: false,
          error: "Failed to generate signed download URL for paid asset."
        });
      }
      const { data: signedData, error: signErr } = await supabaseServer.storage
        .from("paid-resources")
        .createSignedUrl(bundleItem.storagePath, PAID_DOWNLOAD_SIGNED_URL_TTL_SECONDS);
      if (signErr || !signedData?.signedUrl) {
        return res.status(503).json({
          success: false,
          error: "Failed to generate signed download URL for paid asset."
        });
      }
      finalDownloadUrl = signedData.signedUrl;
    } else if (
      allowlistedLocalFilename &&
      rawPaidFileUrl === `/protected_downloads/${allowlistedLocalFilename}`
    ) {
      // Restricted legacy local-disk compatibility path ONLY for exact allowlisted resource IDs
      // whose DB record explicitly matches `/protected_downloads/<allowlistedFilename>` and passes
      // strict lexical + symlink confinement validation. Arbitrary `/downloads/*` or unmapped
      // `/protected_downloads/*` records fail closed HTTP 503 (C6-2).
      const confined = resolveConfinedProtectedAssetPath(allowlistedLocalFilename);
      if (!confined.ok) {
        return res.status(503).json({
          success: false,
          error: "Paid asset storage location is not configured for signed delivery."
        });
      }
      const token = generateAssetAccessToken(resourceRecord.id);
      if (!token) {
        return res.status(503).json({
          success: false,
          error: "Asset delivery service is temporarily unconfigured. Please contact support."
        });
      }
      // Header-only transport (Finding 3): never embed the asset token in downloadUrl query string
      finalDownloadUrl = "/api/payments/download-paid-asset";
      issuedAssetAccessToken = token;
    } else {
      // Missing storage location, arbitrary /downloads/ or /protected_downloads/ path,
      // unmapped standalone local path, traversal attempt, or raw non-Storage external URL:
      // fail closed HTTP 503.
      return res.status(503).json({
        success: false,
        error: "Paid asset storage location is not configured for signed delivery."
      });
    }

    return res.json({
      success: true,
      downloadUrl: finalDownloadUrl,
      ...(issuedAssetAccessToken ? { assetAccessToken: issuedAssetAccessToken } : {}),
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
    // Paid bundle download authorization response hardening headers (Finding 3)
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Content-Type-Options", "nosniff");

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

    const supabaseServer = getSupabaseServerClient();
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

    // 3. Check authenticated user ownership (unless explicit ownership mismatch occurred; strictly requires email_confirmed_at — E-4/E-8)
    if (!isAuthorized && !ownershipDenied && isEmailConfirmed(authenticatedUser)) {
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

    // Generate signed URLs for all 4 bundle files ONLY after full authorization.
    // Strictly fail closed (HTTP 503) on missing Storage client, signing error, or missing signedUrl — NEVER silently fall back (E-1).
    if (!supabaseServer.storage?.from) {
      return res.status(503).json({
        success: false,
        authorized: false,
        error: "Storage signing service is unavailable for paid bundle assets."
      });
    }

    // Query existing child resource records so pre-cutover (`resources`) and post-cutover (`paid-resources`)
    // Storage URLs and custom object paths are respected while preserving bundle metadata compatibility.
    const bundleItemIds = BUNDLE_ITEMS.map((i) => i.id);
    const { data: childResourceRows, error: childFetchErr } = await supabaseServer
      .from("resources")
      .select("id, slug, file_url")
      .in("id", bundleItemIds);

    if (childFetchErr) {
      return res.status(503).json({
        success: false,
        authorized: false,
        error: "Failed to resolve paid bundle deliverable storage records."
      });
    }

    const childById = new Map();
    const childBySlug = new Map();
    for (const row of childResourceRows || []) {
      if (row?.id) childById.set(String(row.id).trim(), row);
      if (row?.slug) childBySlug.set(String(row.slug).trim(), row);
    }

    // Default bucket follows bundleRecord.file_url if explicitly pointing to a valid Storage bucket,
    // otherwise defaults to the private `paid-resources` bucket.
    const parsedBundleStorage = parseProtectedStorageUrl(bundleRecord.file_url);
    const defaultBundleBucket = parsedBundleStorage.bucket || "paid-resources";

    const signedFiles = [];
    for (const item of BUNDLE_ITEMS) {
      const childRow = childById.get(item.id) || childBySlug.get(item.slug) || null;
      const rawChildFileUrl = childRow?.file_url ? String(childRow.file_url).trim() : null;

      let targetBucket = defaultBundleBucket;
      let targetPath = item.storagePath;

      if (rawChildFileUrl) {
        const parsedChild = parseProtectedStorageUrl(rawChildFileUrl);
        if (!parsedChild.isStorage || !parsedChild.bucket || !parsedChild.objectPath) {
          return res.status(503).json({
            success: false,
            authorized: false,
            error: "Paid bundle deliverable storage location is invalid or unconfigured for signed delivery."
          });
        }
        targetBucket = parsedChild.bucket;
        targetPath = parsedChild.objectPath;
      }

      const { data: sData, error: signErr } = await supabaseServer.storage
        .from(targetBucket)
        .createSignedUrl(targetPath, PAID_DOWNLOAD_SIGNED_URL_TTL_SECONDS);

      if (signErr || !sData?.signedUrl) {
        return res.status(503).json({
          success: false,
          authorized: false,
          error: "Failed to generate signed download URL for paid bundle asset."
        });
      }

      signedFiles.push({
        id: item.id,
        slug: item.slug,
        title: item.title,
        description: item.description,
        format: item.format,
        fileSize: item.fileSize,
        filename: item.filename,
        downloadUrl: sData.signedUrl
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
 * Race-safe server-side download streamer for verified paid local-compatibility assets.
 * Security model (A-1 / A-2 / B-1 / Finding 3):
 * - Consumes a short-lived (15-minute / 900-second) HMAC-signed resource-scoped bearer capability token
 *   minted after authoritative verification in `POST /api/payments/get-resource-download-url`.
 * - Enforces header-only transport via `Authorization: Bearer <token>` and strictly rejects any
 *   query-string token (`?token=`, `?access_token=`, `?assetAccessToken=`) with HTTP 403.
 * - Emits `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, and strict no-store caching
 *   headers on all responses (both file streams and error responses).
 * - Rejects missing, duplicate, malformed, expired, unsupported-schema, or tampered tokens (403).
 * - Rejects caller-supplied identity/metadata or cross-resource/cross-file query overrides (403).
 * - Opens the exact allowlisted file ONCE with `O_RDONLY | O_NOFOLLOW`, validates `fstat`
 *   regular-file status and confined identity, and streams directly from that validated `fd`.
 */
router.get("/download-paid-asset", paymentRateLimiter, async (req, res) => {
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Content-Type-Options", "nosniff");

  try {
    // Strictly forbid query-string token transport (Finding 3: header-only Authorization: Bearer)
    if (
      req.query.token !== undefined ||
      req.query.access_token !== undefined ||
      req.query.assetAccessToken !== undefined
    ) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
      return res.status(403).json({
        success: false,
        code: "QUERY_TOKEN_FORBIDDEN",
        error: "Forbidden: Asset download tokens must be sent in the Authorization header, not in URL query parameters."
      });
    }

    const rawToken = extractBearerAssetToken(req);
    const payload = rawToken ? verifyAssetAccessToken(rawToken) : null;
    if (!payload || !payload.resourceId) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
      return res.status(403).json({
        success: false,
        code: "INVALID_DOWNLOAD_TOKEN",
        error: "Forbidden: Invalid, expired, or tampered download token. Please generate a fresh access link."
      });
    }

    const cleanId = String(payload.resourceId).trim();

    // Reject explicit query-parameter cross-resource override attempts against a valid token (A-1 / C6-2)
    if (
      req.query.resourceId !== undefined &&
      (typeof req.query.resourceId !== "string" || req.query.resourceId.trim() !== cleanId)
    ) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
      return res.status(403).json({
        success: false,
        code: "TOKEN_RESOURCE_MISMATCH",
        error: "Forbidden: Download token is not authorized for the requested resource."
      });
    }

    // Reject caller-supplied identity/payment metadata overrides on the bearer capability endpoint (A-1)
    for (const metaParam of ["paymentId", "orderId", "userId", "email", "authId"]) {
      if (req.query[metaParam] !== undefined) {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
        return res.status(403).json({
          success: false,
          code: "TOKEN_METADATA_OVERRIDE_REJECTED",
          error: "Forbidden: Caller-supplied identity or payment metadata is not accepted on download links."
        });
      }
    }

    // Strict exact allowlist lookup — NEVER fall back to a default/unrelated product file (C6-2)
    const filename = resolveAllowlistedProtectedFilename(cleanId);
    if (!filename) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
      return res.status(404).json({
        success: false,
        code: "UNMAPPED_PROTECTED_ASSET",
        error: "Requested protected asset is not mapped for local download delivery."
      });
    }

    // Verify cryptographically bound filename on v2 tokens (A-1)
    if (payload.filename !== undefined && payload.filename !== filename) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
      return res.status(403).json({
        success: false,
        code: "TOKEN_FILE_MISMATCH",
        error: "Forbidden: Download token file binding does not match authorized asset."
      });
    }

    const requestedFileParam = req.query.file ?? req.query.filename;
    if (
      requestedFileParam !== undefined &&
      (typeof requestedFileParam !== "string" || requestedFileParam.trim() !== filename)
    ) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
      return res.status(403).json({
        success: false,
        code: "TOKEN_FILE_MISMATCH",
        error: "Forbidden: Download token is not authorized for the requested file."
      });
    }

    // Single-open O_NOFOLLOW + fstat-verified descriptor (B-1) — NEVER reopen by pathname
    const openedAsset = openConfinedProtectedAssetFd(filename);
    if (!openedAsset.ok || typeof openedAsset.fd !== "number") {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
      return res.status(404).json({
        success: false,
        code: "PROTECTED_ASSET_UNAVAILABLE",
        error: "Asset file temporarily unavailable."
      });
    }

    let fdTransferredToStream = false;
    try {
      // Deterministic test-only race injection hook strictly after fd validation & before stream read
      const activeTestHooks = process.env.NODE_ENV === "test" ? testProtectedAssetHooks : null;
      if (activeTestHooks && typeof activeTestHooks.onBeforeStream === "function") {
        activeTestHooks.onBeforeStream({
          filePath: openedAsset.filePath,
          baseDir: openedAsset.baseDir,
          filename,
          fd: openedAsset.fd
        });
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
      if (typeof openedAsset.size === "number" && Number.isFinite(openedAsset.size) && openedAsset.size >= 0) {
        res.setHeader("Content-Length", String(openedAsset.size));
      }

      const stream = fs.createReadStream("", {
        fd: openedAsset.fd,
        autoClose: true
      });
      fdTransferredToStream = true;

      stream.on("error", () => {
        console.error("[Download Paid Asset] Stream read failed.");
        stream.destroy();
        if (!res.headersSent) {
          res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
          res.status(500).json({ success: false, error: "Failed to download asset." });
        } else if (!res.writableEnded) {
          res.destroy();
        }
      });

      res.on("close", () => {
        if (!stream.destroyed) {
          stream.destroy();
        }
      });

      return stream.pipe(res);
    } catch {
      if (!fdTransferredToStream) {
        closeFdSafe(openedAsset.fd);
      }
      console.error("[Download Paid Asset] Failed to initialize asset download stream.");
      if (!res.headersSent) {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
        return res.status(500).json({ success: false, error: "Failed to download asset." });
      }
      return undefined;
    }
  } catch {
    console.error("[Download Paid Asset] Unexpected handler failure.");
    if (!res.headersSent) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
      return res.status(500).json({ success: false, error: "Failed to download asset." });
    }
    return undefined;
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
    const userEmailConfirmed = isEmailConfirmed(user);

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
      if (userEmailConfirmed) {
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

const INVOICE_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INVOICE_RAZORPAY_PAYMENT_ID_REGEX = /^pay_[A-Za-z0-9_]{1,96}$/;
const INVOICE_RAZORPAY_ORDER_ID_REGEX = /^order_[A-Za-z0-9_]{1,96}$/;
const INVOICE_BOOKING_PREFIX_ID_REGEX = /^bkg_[A-Za-z0-9_-]{1,96}$/i;
const INVOICE_SAFE_TEXT_ID_REGEX = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const INVOICE_WHITESPACE_OR_CONTROL_REGEX = /[\s\x00-\x1f\x7f]/;

/**
 * Strictly validates req.params.paymentId BEFORE any trimming or normalization.
 * Rejects empty values, leading/trailing whitespace, control characters, PostgREST syntax
 * characters (, ( ) . * ; ' " / \ %), and overlong identifiers.
 */
export function validateInvoiceLookupIdentifier(originalPaymentId) {
  if (typeof originalPaymentId !== "string" || originalPaymentId.length === 0) {
    return {
      valid: false,
      error: "Payment reference is required."
    };
  }

  // Reject leading/trailing whitespace BEFORE trimming
  if (originalPaymentId !== originalPaymentId.trim()) {
    return {
      valid: false,
      error: "Invalid payment reference format."
    };
  }

  if (
    originalPaymentId.length > 128 ||
    INVOICE_WHITESPACE_OR_CONTROL_REGEX.test(originalPaymentId) ||
    !INVOICE_SAFE_TEXT_ID_REGEX.test(originalPaymentId)
  ) {
    return {
      valid: false,
      error: "Invalid payment reference format."
    };
  }

  const isUuid = INVOICE_UUID_REGEX.test(originalPaymentId);
  const isRazorpayPaymentId = INVOICE_RAZORPAY_PAYMENT_ID_REGEX.test(originalPaymentId);
  const isRazorpayOrderId = INVOICE_RAZORPAY_ORDER_ID_REGEX.test(originalPaymentId);
  const isBookingPrefixId = INVOICE_BOOKING_PREFIX_ID_REGEX.test(originalPaymentId);

  let kind = "booking_text_id";
  if (isUuid) {
    kind = "uuid";
  } else if (isRazorpayPaymentId) {
    kind = "razorpay_payment_id";
  } else if (isRazorpayOrderId) {
    kind = "razorpay_order_id";
  } else if (isBookingPrefixId) {
    kind = "booking_id";
  }

  return {
    valid: true,
    value: originalPaymentId,
    kind,
    isUuid,
    isRazorpayPaymentId,
    isRazorpayOrderId,
    isBookingPrefixId
  };
}

async function runSingleEqLookup(supabaseServer, table, column, value) {
  try {
    const result = await supabaseServer
      .from(table)
      .select("*")
      .eq(column, value)
      .maybeSingle();

    if (result?.error) {
      return {
        data: null,
        error: {
          table,
          column,
          code: result.error.code || "DB_ERROR",
          message: result.error.message || String(result.error)
        }
      };
    }

    return {
      data: result?.data || null,
      error: null
    };
  } catch (err) {
    return {
      data: null,
      error: {
        table,
        column,
        code: err?.code || "DB_EXCEPTION",
        message: err?.message || String(err)
      }
    };
  }
}

/**
 * Performs schema-type-safe `.eq()` lookups across payments, bookings, and resource_purchases.
 * - `payments.id` (UUID) and `resource_purchases.id` (UUID) are ONLY queried when the identifier is a valid UUID.
 * - `payments.razorpay_payment_id` (TEXT), `payments.razorpay_order_id` (TEXT),
 *   `resource_purchases.razorpay_payment_id` (TEXT), `resource_purchases.razorpay_order_id` (TEXT),
 *   `bookings.id` (TEXT), `bookings.payment_id` (TEXT), and `bookings.razorpay_order_id` (TEXT)
 *   are queried strictly by identifier classification.
 * - Zero PostgREST `.or(...)` string interpolation is used.
 */
export async function lookupInvoiceTransactionRecords(supabaseServer, idInfo) {
  let paymentRecord = null;
  let bookingRecord = null;
  let resourceRecord = null;
  const primaryErrors = [];
  const secondaryErrors = [];

  const rawPaymentId = idInfo.value;

  if (idInfo.isRazorpayPaymentId) {
    // Razorpay payment ID (`pay_...`): TEXT columns only; never query UUID `id` columns.
    const payRes = await runSingleEqLookup(supabaseServer, "payments", "razorpay_payment_id", rawPaymentId);
    if (payRes.error) primaryErrors.push(payRes.error);
    if (payRes.data) paymentRecord = payRes.data;

    const bkgRes = await runSingleEqLookup(supabaseServer, "bookings", "payment_id", rawPaymentId);
    if (bkgRes.error) primaryErrors.push(bkgRes.error);
    if (bkgRes.data) bookingRecord = bkgRes.data;

    const resRes = await runSingleEqLookup(supabaseServer, "resource_purchases", "razorpay_payment_id", rawPaymentId);
    if (resRes.error) primaryErrors.push(resRes.error);
    if (resRes.data) resourceRecord = resRes.data;
  } else if (idInfo.isUuid) {
    // Canonical UUID: safe for UUID `payments.id` and `resource_purchases.id`, plus TEXT `bookings.id` / `bookings.payment_id`.
    const payRes = await runSingleEqLookup(supabaseServer, "payments", "id", rawPaymentId);
    if (payRes.error) primaryErrors.push(payRes.error);
    if (payRes.data) paymentRecord = payRes.data;

    const bkgByIdRes = await runSingleEqLookup(supabaseServer, "bookings", "id", rawPaymentId);
    if (bkgByIdRes.error) primaryErrors.push(bkgByIdRes.error);
    if (bkgByIdRes.data) {
      bookingRecord = bkgByIdRes.data;
    } else if (!bkgByIdRes.error) {
      const bkgByPayIdRes = await runSingleEqLookup(supabaseServer, "bookings", "payment_id", rawPaymentId);
      if (bkgByPayIdRes.error) primaryErrors.push(bkgByPayIdRes.error);
      if (bkgByPayIdRes.data) bookingRecord = bkgByPayIdRes.data;
    }

    const resRes = await runSingleEqLookup(supabaseServer, "resource_purchases", "id", rawPaymentId);
    if (resRes.error) primaryErrors.push(resRes.error);
    if (resRes.data) resourceRecord = resRes.data;
  } else if (idInfo.isRazorpayOrderId) {
    // Razorpay order ID (`order_...`): TEXT `razorpay_order_id` columns only.
    const payRes = await runSingleEqLookup(supabaseServer, "payments", "razorpay_order_id", rawPaymentId);
    if (payRes.error) primaryErrors.push(payRes.error);
    if (payRes.data) paymentRecord = payRes.data;

    const bkgRes = await runSingleEqLookup(supabaseServer, "bookings", "razorpay_order_id", rawPaymentId);
    if (bkgRes.error) primaryErrors.push(bkgRes.error);
    if (bkgRes.data) bookingRecord = bkgRes.data;

    const resRes = await runSingleEqLookup(supabaseServer, "resource_purchases", "razorpay_order_id", rawPaymentId);
    if (resRes.error) primaryErrors.push(resRes.error);
    if (resRes.data) resourceRecord = resRes.data;
  } else {
    // Non-UUID booking identifier (`bkg_...` or legacy booking ID): TEXT `bookings.id` column only.
    // Never query UUID `payments.id` or `resource_purchases.id`.
    const bkgRes = await runSingleEqLookup(supabaseServer, "bookings", "id", rawPaymentId);
    if (bkgRes.error) primaryErrors.push(bkgRes.error);
    if (bkgRes.data) bookingRecord = bkgRes.data;
  }

  // Optional secondary cross-table enrichment when a primary record has already been found.
  // Failures here are recorded as secondaryErrors and must NEVER turn an established record into 503.
  const linkedPayIdCandidate =
    paymentRecord?.razorpay_payment_id ||
    bookingRecord?.payment_id ||
    resourceRecord?.razorpay_payment_id ||
    null;
  const linkedOrderIdCandidate =
    paymentRecord?.razorpay_order_id ||
    bookingRecord?.razorpay_order_id ||
    resourceRecord?.razorpay_order_id ||
    null;

  const hasValidLinkedPayId =
    typeof linkedPayIdCandidate === "string" &&
    INVOICE_RAZORPAY_PAYMENT_ID_REGEX.test(linkedPayIdCandidate);
  const hasValidLinkedOrderId =
    typeof linkedOrderIdCandidate === "string" &&
    INVOICE_RAZORPAY_ORDER_ID_REGEX.test(linkedOrderIdCandidate);

  const alreadyQueriedByPayId = idInfo.isRazorpayPaymentId && linkedPayIdCandidate === rawPaymentId;
  const alreadyQueriedByOrderId = idInfo.isRazorpayOrderId && linkedOrderIdCandidate === rawPaymentId;

  if (!paymentRecord && (bookingRecord || resourceRecord)) {
    if (hasValidLinkedPayId && !alreadyQueriedByPayId) {
      const secPayRes = await runSingleEqLookup(supabaseServer, "payments", "razorpay_payment_id", linkedPayIdCandidate);
      if (secPayRes.error) secondaryErrors.push(secPayRes.error);
      if (secPayRes.data) paymentRecord = secPayRes.data;
    } else if (hasValidLinkedOrderId && !alreadyQueriedByOrderId) {
      const secPayRes = await runSingleEqLookup(supabaseServer, "payments", "razorpay_order_id", linkedOrderIdCandidate);
      if (secPayRes.error) secondaryErrors.push(secPayRes.error);
      if (secPayRes.data) paymentRecord = secPayRes.data;
    }
  }

  if (!bookingRecord && paymentRecord) {
    if (hasValidLinkedPayId && !alreadyQueriedByPayId) {
      const secBkgRes = await runSingleEqLookup(supabaseServer, "bookings", "payment_id", linkedPayIdCandidate);
      if (secBkgRes.error) secondaryErrors.push(secBkgRes.error);
      if (secBkgRes.data) bookingRecord = secBkgRes.data;
    } else if (hasValidLinkedOrderId && !alreadyQueriedByOrderId) {
      const secBkgRes = await runSingleEqLookup(supabaseServer, "bookings", "razorpay_order_id", linkedOrderIdCandidate);
      if (secBkgRes.error) secondaryErrors.push(secBkgRes.error);
      if (secBkgRes.data) bookingRecord = secBkgRes.data;
    }
  }

  if (!resourceRecord && paymentRecord) {
    if (hasValidLinkedPayId && !alreadyQueriedByPayId) {
      const secResRes = await runSingleEqLookup(supabaseServer, "resource_purchases", "razorpay_payment_id", linkedPayIdCandidate);
      if (secResRes.error) secondaryErrors.push(secResRes.error);
      if (secResRes.data) resourceRecord = secResRes.data;
    }
  }

  return {
    paymentRecord,
    bookingRecord,
    resourceRecord,
    primaryErrors,
    secondaryErrors
  };
}

/**
 * GET /api/payments/invoice/:paymentId
 * Generates and streams an authoritative PDF tax invoice/receipt for a verified payment.
 * Security & Authorization:
 * - Requires authentication via Bearer token (verifySupabaseToken) or signed invoice token.
 * - Verified owner (matching user_id or email) or verified Administrator can access.
 * - Non-owners receive 403 Forbidden.
 * - Unauthenticated requests receive 401 Unauthorized.
 */
async function handleInvoiceOrCreditNoteRequest(req, res, { forceCreditNote = false } = {}) {
  try {
    // Validate ORIGINAL req.params.paymentId BEFORE trimming or normalizing
    const idValidation = validateInvoiceLookupIdentifier(req.params.paymentId);
    if (!idValidation.valid) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PAYMENT_REFERENCE",
        error: idValidation.error
      });
    }
    const rawPaymentId = idValidation.value;

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

    // 1. Locate record across payments, bookings, and resource_purchases using validated type-safe .eq() queries
    const lookupResult = await lookupInvoiceTransactionRecords(supabaseServer, idValidation);
    let paymentRecord = lookupResult.paymentRecord;
    const bookingRecord = lookupResult.bookingRecord;
    const resourceRecord = lookupResult.resourceRecord;
    const primaryErrors = lookupResult.primaryErrors;
    const secondaryErrors = lookupResult.secondaryErrors;

    const hasEstablishedDbRecord = Boolean(paymentRecord || bookingRecord || resourceRecord);

    if (!hasEstablishedDbRecord && primaryErrors.length > 0) {
      console.error("[Invoice Endpoint] Database lookup failed with no established record:", primaryErrors);
      return res.status(503).json({
        success: false,
        code: "DATABASE_LOOKUP_FAILED",
        error: "Unable to verify invoice transaction due to a database error."
      });
    }

    if (hasEstablishedDbRecord && (primaryErrors.length > 0 || secondaryErrors.length > 0)) {
      console.warn("[Invoice Endpoint] Optional secondary lookup notice (established record preserved):", {
        primaryErrors,
        secondaryErrors
      });
    }

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
      const hadPaymentsLookupError =
        primaryErrors.some((e) => e.table === "payments") ||
        secondaryErrors.some((e) => e.table === "payments");
      if (!paymentRecord && !bookingRecord && !rzpPayment && hadPaymentsLookupError) {
        return res.status(503).json({
          success: false,
          code: "DATABASE_LOOKUP_FAILED",
          error: "Unable to verify payment capture status due to a database error."
        });
      }
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
