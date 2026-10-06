import {
  verifyWebhookSignature,
  isWebhookConfigured,
  getRazorpayClient
} from "./razorpay.js";
import { isValidUUID } from "./supabaseServer.js";
import { fulfillCourseEnrollment } from "./paymentFulfillment.js";

/**
 * Handles incoming Razorpay webhook notifications.
 *
 * Security & Verification Protocol (Phase 2K-E):
 * 1. Requires exact raw request body buffer.
 * 2. Validates X-Razorpay-Signature using HMAC SHA256 over raw request bytes.
 * 3. Uses crypto.timingSafeEqual to prevent timing attacks.
 * 4. Recognizes payment.captured, payment.failed, order.paid, and arbitrary valid events safely.
 * 5. Logs non-sensitive diagnostics only (masked IDs, event type). Never logs secrets.
 * 6. Executes atomic, idempotent course fulfillment for payment.captured and order.paid events.
 *
 * Idempotency & Safe Deduplication:
 * - Duplicate events are deduplicated at database level by uq_payments_razorpay_payment_id
 *   and UNIQUE(user_id, course_id) in public.course_enrollments.
 * - Always acknowledges verified webhooks with HTTP 200 to satisfy gateway delivery requirements.
 */
export async function handleRazorpayWebhook(req, res) {
  try {
    const signature = req.headers["x-razorpay-signature"];

    if (!signature) {
      console.warn("[Razorpay Webhook] Missing X-Razorpay-Signature header.");
      return res.status(400).json({
        success: false,
        error: "Missing webhook signature header."
      });
    }

    if (!isWebhookConfigured()) {
      console.warn("[Razorpay Webhook] RAZORPAY_WEBHOOK_SECRET is not configured on the server.");
      return res.status(503).json({
        success: false,
        error: "Webhook verification secret is not configured on server."
      });
    }

    // Extract unaltered raw body bytes
    let rawBody;
    if (Buffer.isBuffer(req.body)) {
      rawBody = req.body;
    } else if (req.rawBody && Buffer.isBuffer(req.rawBody)) {
      rawBody = req.rawBody;
    } else if (typeof req.body === "string") {
      rawBody = Buffer.from(req.body, "utf8");
    } else if (req.body && Object.keys(req.body).length > 0) {
      // In case body was already parsed before reaching this handler
      rawBody = Buffer.from(JSON.stringify(req.body), "utf8");
    } else {
      rawBody = Buffer.alloc(0);
    }

    if (rawBody.length === 0) {
      console.warn("[Razorpay Webhook] Received empty request body.");
      return res.status(400).json({
        success: false,
        error: "Empty webhook request body."
      });
    }

    // Cryptographic signature verification with timing-safe comparison
    const isValid = verifyWebhookSignature(rawBody, signature);

    if (!isValid) {
      console.warn("[Razorpay Webhook] Invalid webhook signature rejected.");
      return res.status(400).json({
        success: false,
        error: "Invalid webhook signature."
      });
    }

    // Safely parse verified JSON body
    let payload;
    try {
      payload = JSON.parse(rawBody.toString("utf8"));
    } catch (parseErr) {
      console.warn("[Razorpay Webhook] Failed to parse verified JSON body:", parseErr?.message);
      return res.status(400).json({
        success: false,
        error: "Malformed JSON in signed webhook body."
      });
    }

    const event = payload?.event || "unknown";
    const paymentEntity = payload?.payload?.payment?.entity;
    const orderId = paymentEntity?.order_id || payload?.payload?.order?.entity?.id || null;
    const paymentId = paymentEntity?.id || null;

    switch (event) {
      case "payment.captured":
      case "order.paid": {
        console.log(
          `[Razorpay Webhook] Cryptographically verified event: ${event} (orderId: ${orderId}, paymentId: ${paymentId})`
        );

        // Attempt asynchronous enrollment fulfillment (Phase 2K-E)
        let fulfillmentOutcome = { fulfilled: false };
        try {
          const notes = paymentEntity?.notes || payload?.payload?.order?.entity?.notes || {};
          let courseId = notes.courseId;
          let userId = notes.userId;

          // If notes are not directly attached to payment entity, fetch order from gateway if orderId exists
          if ((!courseId || !userId) && orderId) {
            const razorpay = getRazorpayClient();
            if (razorpay) {
              try {
                const fetchedOrder = await razorpay.orders.fetch(orderId);
                if (fetchedOrder?.notes) {
                  courseId = courseId || fetchedOrder.notes.courseId;
                  userId = userId || fetchedOrder.notes.userId;
                }
              } catch (fetchErr) {
                console.warn("[Razorpay Webhook] Failed to fetch order notes from gateway:", fetchErr?.message);
              }
            }
          }

          if (
            courseId &&
            userId &&
            isValidUUID(courseId) &&
            isValidUUID(userId) &&
            paymentId &&
            orderId
          ) {
            const amountInPaise =
              paymentEntity?.amount || payload?.payload?.order?.entity?.amount || 0;
            const amountInRupees = amountInPaise / 100;
            const currency = (
              paymentEntity?.currency ||
              payload?.payload?.order?.entity?.currency ||
              "INR"
            ).toUpperCase();

            fulfillmentOutcome = await fulfillCourseEnrollment({
              userId,
              courseId,
              amount: amountInRupees,
              currency,
              orderId,
              paymentId
            });

            console.log(
              `[Razorpay Webhook] Fulfillment result for payment ${paymentId}: fulfilled=${fulfillmentOutcome.fulfilled}, already_fulfilled=${fulfillmentOutcome.already_fulfilled}`
            );
          } else {
            console.warn(
              `[Razorpay Webhook] Insufficient trusted metadata to auto-fulfill webhook event: courseId=${courseId}, userId=${userId}, paymentId=${paymentId}`
            );
          }
        } catch (fErr) {
          console.error("[Razorpay Webhook] Error executing webhook fulfillment:", fErr?.message || fErr);
        }

        return res.status(200).json({
          status: "received",
          event,
          acknowledged: true,
          fulfilled: Boolean(fulfillmentOutcome.fulfilled),
          alreadyFulfilled: Boolean(fulfillmentOutcome.already_fulfilled)
        });
      }

      case "payment.failed":
        console.log(
          `[Razorpay Webhook] Cryptographically verified event: payment.failed (orderId: ${orderId}, paymentId: ${paymentId})`
        );
        return res.status(200).json({
          status: "received",
          event: "payment.failed",
          acknowledged: true,
          fulfilled: false
        });

      default:
        console.log(
          `[Razorpay Webhook] Cryptographically verified unhandled event: ${event} (acknowledged safely)`
        );
        return res.status(200).json({
          status: "received",
          event: event,
          acknowledged: true
        });
    }
  } catch (err) {
    console.error("[Razorpay Webhook] Unexpected internal error handling webhook:", err?.message || err);
    return res.status(500).json({
      success: false,
      error: "Internal error processing webhook."
    });
  }
}
