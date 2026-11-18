import crypto from "crypto";

// ==============================================================================
// GUEST INVOICE TOKEN CRYPTOGRAPHIC HARDENING (SEC-03 Compliance)
// High-entropy HMAC-SHA256 tokens protect guest invoices from sequential enumeration.
// New tokens are minted EXCLUSIVELY with dedicated INVOICE_TOKEN_HMAC_SECRET (>= 32 bytes).
// Verification tries INVOICE_TOKEN_HMAC_SECRET first, then legacy fallback candidates
// (PAYMENT_VERIFICATION_SECRET, ASSET_TOKEN_HMAC_SECRET, RAZORPAY_KEY_SECRET) in original
// priority order (each required to meet >= 32 UTF-8 bytes) so existing customer links remain valid.
// ==============================================================================
function normalizeValidHmacSecret(candidate) {
  if (!candidate || typeof candidate !== "string") {
    return null;
  }
  const clean = candidate.trim();
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

export function getInvoiceTokenHmacSecret() {
  return normalizeValidHmacSecret(process.env.INVOICE_TOKEN_HMAC_SECRET);
}

export function isInvoiceTokenSecretConfigured() {
  return Boolean(getInvoiceTokenHmacSecret());
}

export function getInvoiceTokenVerificationSecrets() {
  const candidates = [
    process.env.INVOICE_TOKEN_HMAC_SECRET,
    process.env.PAYMENT_VERIFICATION_SECRET,
    process.env.ASSET_TOKEN_HMAC_SECRET,
    process.env.RAZORPAY_KEY_SECRET
  ];

  const validSecrets = [];
  const seen = new Set();
  for (const candidate of candidates) {
    const valid = normalizeValidHmacSecret(candidate);
    if (valid && !seen.has(valid)) {
      seen.add(valid);
      validSecrets.push(valid);
    }
  }
  return validSecrets;
}

export function generateSignedInvoiceToken(paymentId, expiresInMs = 24 * 60 * 60 * 1000) {
  if (!paymentId) throw new Error("Payment ID is required to generate signed invoice token");
  const secret = getInvoiceTokenHmacSecret();
  if (!secret) {
    throw new Error("Invoice HMAC secret missing or insufficient entropy (requires >= 32 bytes). Server configuration error.");
  }
  const exp = Date.now() + expiresInMs;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${paymentId}:${exp}`)
    .digest("hex");
  return `${exp}.${signature}`;
}

/**
 * Safely generates a signed invoice token if and only if a compliant HMAC secret is configured.
 * Fails closed by returning null when unconfigured (never mints weak/unauthenticated tokens).
 */
export function tryGenerateSignedInvoiceToken(paymentId, expiresInMs = 24 * 60 * 60 * 1000) {
  if (!paymentId || typeof paymentId !== "string" || !paymentId.trim()) return null;
  try {
    return generateSignedInvoiceToken(paymentId.trim(), expiresInMs);
  } catch (err) {
    console.warn("[Invoice Token] Signed guest invoice token unavailable:", err?.message || err);
    return null;
  }
}

export function buildSignedInvoiceUrl(paymentId, token, baseUrl = "") {
  if (!paymentId || !token) return null;
  const cleanId = encodeURIComponent(String(paymentId).trim());
  const cleanToken = encodeURIComponent(String(token).trim());
  return `${baseUrl}/api/payments/invoice/${cleanId}?token=${cleanToken}`;
}

export function verifySignedInvoiceToken(paymentId, token) {
  if (!paymentId || !token || typeof token !== "string" || !token.includes(".")) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [expStr, sig] = parts;
  if (!expStr || !sig || !/^[0-9]+$/.test(expStr) || !/^[0-9a-f]+$/i.test(sig)) return false;

  const exp = Number(expStr);
  if (!exp || !Number.isFinite(exp) || Date.now() > exp) return false;

  const secrets = getInvoiceTokenVerificationSecrets();
  if (secrets.length === 0) return false;

  const providedSig = Buffer.from(sig, "hex");
  for (const secret of secrets) {
    try {
      const expected = crypto
        .createHmac("sha256", secret)
        .update(`${paymentId}:${exp}`)
        .digest("hex");
      const expectedSig = Buffer.from(expected, "hex");
      if (providedSig.length === expectedSig.length && crypto.timingSafeEqual(providedSig, expectedSig)) {
        return true;
      }
    } catch {
      // Continue to next candidate on error
    }
  }

  return false;
}
