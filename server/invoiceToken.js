import crypto from "crypto";

// ==============================================================================
// GUEST INVOICE TOKEN CRYPTOGRAPHIC HARDENING (SEC-03 Compliance)
// High-entropy HMAC-SHA256 tokens protect guest invoices from sequential enumeration.
// Supports dedicated INVOICE_TOKEN_HMAC_SECRET or falls back to server payment/asset secrets.
// Fails closed if HMAC secret is missing or has < 32 bytes of entropy.
// ==============================================================================
export function getInvoiceTokenHmacSecret() {
  const candidates = [
    process.env.INVOICE_TOKEN_HMAC_SECRET,
    process.env.PAYMENT_VERIFICATION_SECRET,
    process.env.ASSET_TOKEN_HMAC_SECRET,
    process.env.RAZORPAY_KEY_SECRET
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === "string") {
      const clean = candidate.trim();
      if (clean !== "undefined" && clean !== "null" && Buffer.byteLength(clean, "utf8") >= 32) {
        return clean;
      }
    }
  }

  return null;
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
  const [expStr, sig] = token.split(".");
  const exp = Number(expStr);
  if (!exp || isNaN(exp) || Date.now() > exp) return false;

  const secret = getInvoiceTokenHmacSecret();
  if (!secret) return false;

  try {
    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${paymentId}:${exp}`)
      .digest("hex");
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
