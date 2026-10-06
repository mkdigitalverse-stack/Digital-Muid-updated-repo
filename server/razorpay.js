import Razorpay from "razorpay";
import crypto from "crypto";

/**
 * Cached singleton instance of the Razorpay client.
 */
let razorpayInstance = null;

/**
 * Returns the public Razorpay Key ID if configured.
 * @returns {string|null}
 */
export function getRazorpayKeyId() {
  return process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || null;
}

/**
 * Checks whether Razorpay server credentials (key_id and key_secret) are configured.
 * @returns {boolean}
 */
export function isRazorpayConfigured() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  return Boolean(keyId && keySecret);
}

/**
 * Checks whether the Razorpay webhook secret is configured.
 * @returns {boolean}
 */
export function isWebhookConfigured() {
  return Boolean(process.env.RAZORPAY_WEBHOOK_SECRET);
}

/**
 * Lazily retrieves or initializes the Razorpay SDK instance.
 * Returns null if credentials are not configured, preventing startup crashes.
 * @returns {Razorpay|null}
 */
export function getRazorpayClient() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    return null;
  }

  if (!razorpayInstance) {
    razorpayInstance = new Razorpay({
      key_id,
      key_secret,
    });
  }

  return razorpayInstance;
}

/**
 * Cryptographically verifies a Razorpay webhook signature against the raw request body.
 *
 * @param {string|Buffer} rawBody - The unparsed raw request body
 * @param {string} signature - The X-Razorpay-Signature header value
 * @returns {boolean}
 */
export function verifyWebhookSignature(rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature || !rawBody) {
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    const sigBuffer = Buffer.from(signature, "utf8");
    const expBuffer = Buffer.from(expectedSignature, "utf8");

    if (sigBuffer.length !== expBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(sigBuffer, expBuffer);
  } catch (err) {
    console.error("[Razorpay Security] Error verifying webhook signature:", err);
    return false;
  }
}

/**
 * Cryptographically verifies a Razorpay payment signature from client checkout.
 *
 * @param {string} orderId - The razorpay_order_id
 * @param {string} paymentId - The razorpay_payment_id
 * @param {string} signature - The razorpay_signature returned from checkout
 * @returns {boolean}
 */
export function verifyPaymentSignature(orderId, paymentId, signature) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret || !orderId || !paymentId || !signature) {
    return false;
  }

  try {
    const payload = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    const sigBuffer = Buffer.from(signature, "utf8");
    const expBuffer = Buffer.from(expectedSignature, "utf8");

    if (sigBuffer.length !== expBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(sigBuffer, expBuffer);
  } catch (err) {
    console.error("[Razorpay Security] Error verifying payment signature:", err);
    return false;
  }
}
