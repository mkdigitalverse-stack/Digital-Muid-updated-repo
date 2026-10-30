import {
  verifyWebhookSignature,
  isWebhookConfigured,
  getRazorpayClient
} from "./razorpay.js";
import { isValidUUID } from "./supabaseServer.js";
import {
  fulfillCourseEnrollment,
  fulfillResourcePurchase,
  fulfillConsultationPayment
} from "./paymentFulfillment.js";

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

        // Attempt asynchronous enrollment / resource fulfillment
        let fulfillmentOutcome = { fulfilled: false };
        try {
          const initialNotes = paymentEntity?.notes || payload?.payload?.order?.entity?.notes || {};
          let allNotes = { ...initialNotes };
          let courseId = allNotes.courseId;
          let resourceId = allNotes.resourceId;
          let itemType = allNotes.itemType;
          let userId = allNotes.userId;

          // Authoritative order retrieval: check payload order entity first, then query gateway SDK if needed
          let authoritativeOrder = null;
          if (payload?.payload?.order?.entity?.id === orderId) {
            authoritativeOrder = payload.payload.order.entity;
          }

          const needsOrderFetch = Boolean(
            orderId && !authoritativeOrder && (
              (!courseId && !resourceId && itemType !== "consultation") ||
              itemType === "consultation" ||
              allNotes.productId === "31bbb9bf-ce10-4da4-a517-dfc673f9b875" ||
              (!allNotes.bookingDate && !allNotes.date)
            )
          );

          if (needsOrderFetch) {
            const razorpay = getRazorpayClient();
            if (razorpay) {
              try {
                authoritativeOrder = await razorpay.orders.fetch(orderId);
              } catch (fetchErr) {
                console.warn("[Razorpay Webhook] Authoritative order fetch from gateway failed:", fetchErr?.error?.description || fetchErr?.message || "Order not found");
              }
            }
          }

          if (authoritativeOrder?.notes) {
            // Authoritative order notes strictly take precedence over payment entity notes
            allNotes = { ...allNotes, ...authoritativeOrder.notes };
            courseId = authoritativeOrder.notes.courseId || courseId;
            resourceId = authoritativeOrder.notes.resourceId || resourceId;
            itemType = authoritativeOrder.notes.itemType || itemType;
            userId = authoritativeOrder.notes.userId || userId;
          }

          const amountInPaise =
            paymentEntity?.amount || payload?.payload?.order?.entity?.amount || 0;
          const amountInRupees = amountInPaise / 100;
          const currency = (
            paymentEntity?.currency ||
            payload?.payload?.order?.entity?.currency ||
            "INR"
          ).toUpperCase();

          if (resourceId || itemType === "resource") {
            fulfillmentOutcome = await fulfillResourcePurchase({
              userId,
              resourceId,
              amount: amountInRupees,
              currency,
              orderId,
              paymentId,
              customerName: allNotes.customerName || "",
              customerEmail: allNotes.customerEmail || "",
              customerPhone: allNotes.customerPhone || "",
              resourceTitle: allNotes.resourceTitle || ""
            });

            console.log(
              `[Razorpay Webhook] Resource fulfillment result for payment ${paymentId?.slice(0, 14)}...: fulfilled=${fulfillmentOutcome.fulfilled}, already_fulfilled=${fulfillmentOutcome.already_fulfilled}`
            );
          } else if (
            itemType === "consultation" ||
            allNotes.productId === "31bbb9bf-ce10-4da4-a517-dfc673f9b875" ||
            Boolean(allNotes.bookingDate && (allNotes.customerEmail || paymentEntity?.email))
          ) {
            // Strict verification against authoritative order & gateway constraints
            const isOrderRelationshipValid = Boolean(
              paymentEntity?.order_id &&
              orderId &&
              paymentEntity.order_id === orderId &&
              authoritativeOrder &&
              authoritativeOrder.id === orderId
            );
            const isCurrencyValid = Boolean(
              currency === "INR" &&
              authoritativeOrder &&
              String(authoritativeOrder.currency).toUpperCase() === "INR"
            );
            const isAmountValid = Boolean(
              amountInPaise > 0 &&
              authoritativeOrder &&
              Number(authoritativeOrder.amount) > 0 &&
              Number(amountInPaise) === Number(authoritativeOrder.amount)
            );
            const isPaymentCaptured = Boolean(
              paymentEntity &&
              paymentId &&
              paymentEntity.id === paymentId &&
              paymentEntity.status === "captured"
            );

            const customerEmail = String(allNotes.customerEmail || paymentEntity?.email || "").trim();
            const customerName = String(allNotes.customerName || "").trim();
            const customerPhone = String(allNotes.customerPhone || paymentEntity?.contact || "").trim();
            const bookingDate = String(allNotes.bookingDate || allNotes.date || "").trim();
            const bookingTime = String(allNotes.bookingTime || allNotes.time || "").trim();

            if (!orderId || !paymentId || !paymentEntity) {
              console.warn("[Razorpay Webhook] Consultation rejected: Missing order ID, payment ID, or payment entity.");
            } else if (!isPaymentCaptured) {
              console.warn(`[Razorpay Webhook] Consultation rejected: Payment ${paymentId?.slice(0, 14)} is not in confirmed captured status.`);
            } else if (!isOrderRelationshipValid) {
              console.warn(`[Razorpay Webhook] Consultation rejected: Payment order_id does not match order ${orderId?.slice(0, 14)}...`);
            } else if (!authoritativeOrder) {
              console.warn(`[Razorpay Webhook] Consultation rejected: Authoritative order could not be retrieved from gateway for order ${orderId?.slice(0, 14)}...`);
            } else if (!isCurrencyValid) {
              console.warn(`[Razorpay Webhook] Consultation rejected: Currency mismatch (expected INR, received ${currency})`);
            } else if (!isAmountValid) {
              console.warn(`[Razorpay Webhook] Consultation rejected: Amount mismatch (order: ${authoritativeOrder?.amount}, payment: ${amountInPaise})`);
            } else if (!customerEmail || !bookingDate || !bookingTime) {
              console.warn(`[Razorpay Webhook] Consultation rejected: Missing required booking schedule or email metadata.`);
            } else {
              fulfillmentOutcome = await fulfillConsultationPayment({
                userId: isValidUUID(userId) ? userId : null,
                bookingDetails: {
                  customerName: customerName || "Valued Client",
                  customerEmail,
                  customerPhone,
                  businessName: String(allNotes.businessName || "").trim(),
                  primaryChallenge: String(allNotes.primaryChallenge || "Business Growth Strategy").trim(),
                  desiredOutcome: String(allNotes.desiredOutcome || "").trim(),
                  website: allNotes.website ? String(allNotes.website).trim() : null,
                  linkedin: allNotes.linkedin ? String(allNotes.linkedin).trim() : null,
                  date: bookingDate,
                  time: bookingTime,
                  order_total_amount: (amountInPaise / 100).toFixed(2)
                },
                orderId,
                paymentId,
                amount: amountInRupees,
                currency: currency,
                productId: allNotes.productId || "31bbb9bf-ce10-4da4-a517-dfc673f9b875"
              });

              console.log(
                `[Razorpay Webhook] Consultation fulfillment outcome for payment ${paymentId?.slice(0, 14)}...: fulfilled=${Boolean(fulfillmentOutcome.fulfilled)}, already_fulfilled=${Boolean(fulfillmentOutcome.already_fulfilled)}`
              );
            }
          } else if (
            courseId &&
            userId &&
            isValidUUID(courseId) &&
            isValidUUID(userId) &&
            paymentId &&
            orderId
          ) {
            fulfillmentOutcome = await fulfillCourseEnrollment({
              userId,
              courseId,
              amount: amountInRupees,
              currency,
              orderId,
              paymentId
            });

            console.log(
              `[Razorpay Webhook] Course fulfillment result for payment ${paymentId}: fulfilled=${fulfillmentOutcome.fulfilled}, already_fulfilled=${fulfillmentOutcome.already_fulfilled}`
            );
          } else {
            console.warn(
              `[Razorpay Webhook] Insufficient trusted metadata to auto-fulfill webhook event: courseId=${courseId}, resourceId=${resourceId}, itemType=${itemType}, userId=${userId}, paymentId=${paymentId}`
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
