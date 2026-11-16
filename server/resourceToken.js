import crypto from "crypto";

// ==============================================================================
// DEDICATED GUEST RESOURCE ACCESS TOKEN (HMAC SHA-256)
// Protects unauthenticated guest resource purchases (download, bundle files,
// status check, lead recovery) without accepting orderId + paymentId alone.
//
// Security Properties:
// 1. Dedicated RESOURCE_TOKEN_HMAC_SECRET (>= 32 bytes UTF-8 required).
//    Fails closed when missing, short, or placeholder — zero secret fallback.
// 2. Cryptographically bound to verified paymentId, orderId, resourceId,
//    guest identity (gid), and explicit expiration timestamp (exp).
// 3. Verified with crypto.timingSafeEqual against decoded HMAC digest.
// ==============================================================================

const DEFAULT_GUEST_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_GUEST_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

export function getResourceTokenHmacSecret() {
  const raw = process.env.RESOURCE_TOKEN_HMAC_SECRET;
  if (!raw || typeof raw !== "string") return null;

  const clean = raw.trim();
  if (
    !clean ||
    clean === "undefined" ||
    clean === "null" ||
    clean.startsWith("generate_at_least_32_bytes") ||
    Buffer.byteLength(clean, "utf8") < 32
  ) {
    return null;
  }

  return clean;
}

export function normalizeGuestEmail(email) {
  if (!email || typeof email !== "string") return "";
  return email.trim().toLowerCase();
}

export function normalizeGuestPhone(phone) {
  if (!phone || typeof phone !== "string") return "";
  return phone.replace(/\D+/g, "").slice(-15);
}

/**
 * Derives a deterministic guest identity fingerprint from verified buyer details.
 * Precedence: normalized email -> normalized phone digits -> tx hash(orderId|paymentId).
 */
export function deriveGuestIdentity({ email = "", phone = "", orderId = "", paymentId = "" } = {}) {
  const normEmail = normalizeGuestEmail(email);
  if (normEmail) {
    return `email:${normEmail}`;
  }
  const normPhone = normalizeGuestPhone(phone);
  if (normPhone) {
    return `phone:${normPhone}`;
  }
  const oid = String(orderId || "").trim();
  const pid = String(paymentId || "").trim();
  const digest = crypto.createHash("sha256").update(`${oid}|${pid}`).digest("hex").slice(0, 24);
  return `tx:${digest}`;
}

function toBase64Url(input) {
  return Buffer.from(input).toString("base64url");
}

function fromBase64Url(str) {
  return Buffer.from(str, "base64url");
}

/**
 * Mints a cryptographically signed guest resource access token.
 * Throws if RESOURCE_TOKEN_HMAC_SECRET is missing/<32 bytes or required fields are absent.
 */
export function generateGuestResourceToken({
  paymentId,
  orderId,
  resourceId,
  email = "",
  phone = "",
  expiresInMs = DEFAULT_GUEST_TOKEN_TTL_MS,
  nowMs = Date.now()
}) {
  const secret = getResourceTokenHmacSecret();
  if (!secret) {
    throw new Error(
      "RESOURCE_TOKEN_HMAC_SECRET is missing or insufficient entropy (requires >= 32 bytes UTF-8)."
    );
  }

  const pid = String(paymentId || "").trim();
  const oid = String(orderId || "").trim();
  const rid = String(resourceId || "").trim();
  if (!pid || !oid || !rid) {
    throw new Error("paymentId, orderId, and resourceId are required to mint guest resource access token.");
  }

  const ttlMs = Number(expiresInMs);
  if (!Number.isFinite(ttlMs) || ttlMs <= 0 || ttlMs > MAX_GUEST_TOKEN_TTL_MS) {
    throw new Error("Invalid guest resource access token TTL.");
  }

  const gid = deriveGuestIdentity({ email, phone, orderId: oid, paymentId: pid });
  const iat = Math.floor(nowMs);
  const exp = iat + Math.floor(ttlMs);

  const payload = {
    v: 1,
    typ: "guest_resource_access",
    pid,
    oid,
    rid,
    gid,
    iat,
    exp
  };

  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const sigBuffer = crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest();

  return `${encodedPayload}.${toBase64Url(sigBuffer)}`;
}

/**
 * Safely attempts to mint a guest resource access token, failing closed when unconfigured.
 */
export function tryGenerateGuestResourceToken(params) {
  try {
    const token = generateGuestResourceToken(params);
    return { ok: true, token, error: null };
  } catch (err) {
    return { ok: false, token: null, error: err?.message || "Failed to generate guest resource access token." };
  }
}

/**
 * Verifies a signed guest resource access token and checks binding invariants.
 * Returns { valid: true, payload } or { valid: false, code, reason }.
 */
export function verifyGuestResourceToken(token, expected = {}) {
  const secret = getResourceTokenHmacSecret();
  if (!secret) {
    return {
      valid: false,
      code: "RESOURCE_TOKEN_SECRET_MISSING",
      reason: "Guest resource access signing secret is not configured."
    };
  }

  if (!token || typeof token !== "string") {
    return {
      valid: false,
      code: "MISSING_GUEST_TOKEN",
      reason: "Signed guest resource access token is required."
    };
  }

  const trimmed = token.trim();
  const parts = trimmed.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return {
      valid: false,
      code: "MALFORMED_GUEST_TOKEN",
      reason: "Malformed guest resource access token."
    };
  }

  const [encodedPayload, encodedSig] = parts;

  let providedSig;
  try {
    providedSig = fromBase64Url(encodedSig);
  } catch {
    return {
      valid: false,
      code: "MALFORMED_GUEST_TOKEN",
      reason: "Invalid token signature encoding."
    };
  }

  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest();

  if (providedSig.length !== expectedSig.length || !crypto.timingSafeEqual(providedSig, expectedSig)) {
    return {
      valid: false,
      code: "INVALID_GUEST_TOKEN_SIGNATURE",
      reason: "Invalid guest resource access token signature."
    };
  }

  let payload;
  try {
    payload = JSON.parse(fromBase64Url(encodedPayload).toString("utf8"));
  } catch {
    return {
      valid: false,
      code: "MALFORMED_GUEST_TOKEN",
      reason: "Corrupt guest resource access token payload."
    };
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    payload.v !== 1 ||
    payload.typ !== "guest_resource_access" ||
    !payload.pid ||
    !payload.oid ||
    !payload.rid ||
    !payload.gid ||
    typeof payload.exp !== "number" ||
    !Number.isFinite(payload.exp)
  ) {
    return {
      valid: false,
      code: "INVALID_GUEST_TOKEN_CLAIMS",
      reason: "Invalid guest resource access token claims."
    };
  }

  const nowMs = typeof expected.nowMs === "number" ? expected.nowMs : Date.now();
  if (nowMs > payload.exp) {
    return {
      valid: false,
      code: "EXPIRED_GUEST_TOKEN",
      reason: "Guest resource access token has expired."
    };
  }

  if (expected.paymentId && payload.pid !== String(expected.paymentId).trim()) {
    return {
      valid: false,
      code: "GUEST_TOKEN_PAYMENT_MISMATCH",
      reason: "Guest resource access token does not match paymentId."
    };
  }

  if (expected.orderId && payload.oid !== String(expected.orderId).trim()) {
    return {
      valid: false,
      code: "GUEST_TOKEN_ORDER_MISMATCH",
      reason: "Guest resource access token does not match orderId."
    };
  }

  if (Array.isArray(expected.allowedResourceIds)) {
    if (!expected.allowedResourceIds.includes(payload.rid)) {
      return {
        valid: false,
        code: "GUEST_TOKEN_RESOURCE_MISMATCH",
        reason: "Guest resource access token does not authorize this resource."
      };
    }
  } else if (expected.resourceId && payload.rid !== String(expected.resourceId).trim()) {
    return {
      valid: false,
      code: "GUEST_TOKEN_RESOURCE_MISMATCH",
      reason: "Guest resource access token does not match resourceId."
    };
  }

  return {
    valid: true,
    payload
  };
}

/**
 * Validates that the token's guest identity claim (gid) matches any authoritative
 * buyer identity fields (from DB record or verified Razorpay order/payment) and
 * any caller-supplied email/phone filter.
 */
export function verifyTokenGuestIdentityBinding(
  tokenPayload,
  {
    orderId = "",
    paymentId = "",
    authoritativeEmails = [],
    authoritativePhones = [],
    suppliedEmail = "",
    suppliedPhone = ""
  } = {}
) {
  if (!tokenPayload || typeof tokenPayload.gid !== "string") {
    return { valid: false, code: "INVALID_GUEST_IDENTITY", reason: "Missing guest identity claim in token." };
  }

  const gid = tokenPayload.gid;
  const cleanAuthEmails = [...new Set((authoritativeEmails || []).map(normalizeGuestEmail).filter(Boolean))];
  const cleanAuthPhones = [...new Set((authoritativePhones || []).map(normalizeGuestPhone).filter(Boolean))];
  const normSuppliedEmail = normalizeGuestEmail(suppliedEmail);
  const normSuppliedPhone = normalizeGuestPhone(suppliedPhone);

  if (gid.startsWith("email:")) {
    const tokenEmail = gid.slice("email:".length);
    if (!tokenEmail) {
      return { valid: false, code: "INVALID_GUEST_IDENTITY", reason: "Empty email identity in token." };
    }
    if (normSuppliedEmail && normSuppliedEmail !== tokenEmail) {
      return {
        valid: false,
        code: "GUEST_IDENTITY_MISMATCH",
        reason: "Guest resource access token does not match the supplied email identity."
      };
    }
    if (cleanAuthEmails.length > 0 && !cleanAuthEmails.includes(tokenEmail)) {
      // Allow prefix match ONLY if all authoritative sources were truncated at Razorpay's 50-char note limit
      const allNotesTruncatedMatch = cleanAuthEmails.every(
        (e) => e.length === 50 && tokenEmail.startsWith(e)
      );
      if (!allNotesTruncatedMatch) {
        return {
          valid: false,
          code: "GUEST_IDENTITY_MISMATCH",
          reason: "Guest resource access token does not match the purchase email identity."
        };
      }
    }
    return { valid: true };
  }

  if (gid.startsWith("phone:")) {
    const tokenPhone = gid.slice("phone:".length);
    if (!tokenPhone) {
      return { valid: false, code: "INVALID_GUEST_IDENTITY", reason: "Empty phone identity in token." };
    }
    if (normSuppliedEmail && cleanAuthEmails.length > 0 && !cleanAuthEmails.includes(normSuppliedEmail)) {
      return {
        valid: false,
        code: "GUEST_IDENTITY_MISMATCH",
        reason: "Guest email does not match purchase record."
      };
    }
    if (normSuppliedPhone && normSuppliedPhone !== tokenPhone) {
      return {
        valid: false,
        code: "GUEST_IDENTITY_MISMATCH",
        reason: "Guest resource access token does not match supplied phone identity."
      };
    }
    if (cleanAuthPhones.length > 0 && !cleanAuthPhones.includes(tokenPhone)) {
      return {
        valid: false,
        code: "GUEST_IDENTITY_MISMATCH",
        reason: "Guest resource access token does not match purchase phone identity."
      };
    }
    return { valid: true };
  }

  if (gid.startsWith("tx:")) {
    const expectedTxGid = deriveGuestIdentity({ orderId, paymentId });
    if (gid !== expectedTxGid) {
      return {
        valid: false,
        code: "GUEST_IDENTITY_MISMATCH",
        reason: "Guest transaction identity mismatch."
      };
    }
    if (normSuppliedEmail && cleanAuthEmails.length > 0 && !cleanAuthEmails.includes(normSuppliedEmail)) {
      return {
        valid: false,
        code: "GUEST_IDENTITY_MISMATCH",
        reason: "Supplied email does not match purchase email."
      };
    }
    return { valid: true };
  }

  return { valid: false, code: "INVALID_GUEST_IDENTITY", reason: "Unrecognized guest identity claim." };
}

/**
 * Extracts guest resource access token from dedicated header, request body, or query parameter.
 * Intentionally avoids Authorization: Bearer, which is reserved for Supabase JWTs.
 */
export function extractResourceAccessToken(req) {
  const headerToken = req?.headers?.["x-resource-access-token"];
  if (typeof headerToken === "string" && headerToken.trim()) {
    return headerToken.trim();
  }
  if (Array.isArray(headerToken) && typeof headerToken[0] === "string" && headerToken[0].trim()) {
    return headerToken[0].trim();
  }
  const bodyToken = req?.body?.resourceAccessToken;
  if (typeof bodyToken === "string" && bodyToken.trim()) {
    return bodyToken.trim();
  }
  const queryToken = req?.query?.resourceAccessToken;
  if (typeof queryToken === "string" && queryToken.trim()) {
    return queryToken.trim();
  }
  return null;
}
