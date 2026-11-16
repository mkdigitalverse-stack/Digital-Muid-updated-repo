import {
  verifyWebhookSignature,
  isWebhookConfigured,
  getRazorpayClient
} from "./razorpay.js";
import { getSupabaseServerClient, isValidUUID } from "./supabaseServer.js";
import {
  calculateAuthoritativeCoursePrice,
  fulfillCourseEnrollment,
  fulfillResourcePurchase,
  fulfillConsultationPayment,
  toPaiseStrict
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
          // Authoritative order retrieval: check signed payload order entity first, then query gateway SDK if needed
          let authoritativeOrder = null;
          let orderEntityMismatch = false;
          const payloadOrderEntity = payload?.payload?.order?.entity;
          if (payloadOrderEntity?.id) {
            if (orderId && payloadOrderEntity.id === orderId) {
              authoritativeOrder = payloadOrderEntity;
            } else {
              orderEntityMismatch = true;
            }
          }

          const razorpay = getRazorpayClient();
          const needsOrderFetch = Boolean(orderId && !authoritativeOrder && !orderEntityMismatch);

          if (needsOrderFetch && razorpay) {
            try {
              authoritativeOrder = await razorpay.orders.fetch(orderId);
            } catch (fetchErr) {
              console.warn("[Razorpay Webhook] Authoritative order fetch from gateway failed:", fetchErr?.error?.description || fetchErr?.message || "Order not found");
            }
          }

          // Fail closed whenever Razorpay client is unavailable or authoritative order cannot be retrieved/verified
          const hasAuthoritativeOrder = Boolean(razorpay && authoritativeOrder && !orderEntityMismatch);
          const trustedNotes = hasAuthoritativeOrder ? (authoritativeOrder?.notes || {}) : {};

          const courseId = trustedNotes.courseId;
          const resourceId = trustedNotes.resourceId;
          const itemType = trustedNotes.itemType;
          const normalizedItemType = String(itemType || "").trim().toLowerCase();
          const userId = trustedNotes.userId;

          const rawPaymentAmount = paymentEntity?.amount;
          const amountInPaise =
            (typeof rawPaymentAmount === "number" ||
              (typeof rawPaymentAmount === "string" && rawPaymentAmount.trim() !== ""))
              ? Number(rawPaymentAmount)
              : NaN;
          const rawOrderAmount = authoritativeOrder?.amount;
          const orderAmountInPaise =
            (typeof rawOrderAmount === "number" ||
              (typeof rawOrderAmount === "string" && rawOrderAmount.trim() !== ""))
              ? Number(rawOrderAmount)
              : NaN;
          const amountInRupees = Number.isSafeInteger(amountInPaise) ? amountInPaise / 100 : NaN;
          const currency = String(paymentEntity?.currency || "").trim().toUpperCase();

          const isPaymentCaptured = Boolean(
            paymentEntity &&
            paymentId &&
            paymentEntity.id === paymentId &&
            String(paymentEntity.status || "").toLowerCase() === "captured"
          );
          const isOrderRelationshipValid = Boolean(
            paymentEntity?.order_id &&
            orderId &&
            paymentEntity.order_id === orderId &&
            !orderEntityMismatch &&
            authoritativeOrder &&
            authoritativeOrder.id === orderId
          );
          const isCurrencyValid = Boolean(
            currency === "INR" &&
            authoritativeOrder &&
            String(authoritativeOrder.currency || "").toUpperCase() === "INR"
          );
          const isAmountValid = Boolean(
            Number.isSafeInteger(amountInPaise) &&
            amountInPaise > 0 &&
            Number.isSafeInteger(orderAmountInPaise) &&
            orderAmountInPaise > 0 &&
            amountInPaise === orderAmountInPaise
          );

          if (!hasAuthoritativeOrder) {
            console.warn(
              `[Razorpay Webhook] Rejected fulfillment for ${event} (order ${orderId?.slice(0, 14) || "missing"}): Authoritative order or Razorpay client unavailable.`
            );
          } else if (normalizedItemType === "resource") {
            if (!orderId || !paymentId || !paymentEntity) {
              console.warn("[Razorpay Webhook] Resource rejected: Missing order ID, payment ID, or payment entity.");
            } else if (!isPaymentCaptured) {
              console.warn(`[Razorpay Webhook] Resource rejected: Payment ${paymentId?.slice(0, 14)} is not in confirmed captured status (status=${paymentEntity?.status}).`);
            } else if (!isOrderRelationshipValid) {
              console.warn(`[Razorpay Webhook] Resource rejected: Payment order_id mismatch for order ${orderId?.slice(0, 14)}...`);
            } else if (!isCurrencyValid) {
              console.warn(`[Razorpay Webhook] Resource rejected: Currency mismatch (expected INR, received ${currency}).`);
            } else if (!isAmountValid) {
              console.warn(`[Razorpay Webhook] Resource rejected: Amount mismatch (order: ${authoritativeOrder?.amount}, payment: ${amountInPaise}).`);
            } else if (!resourceId || typeof resourceId !== "string" || !resourceId.trim()) {
              console.warn("[Razorpay Webhook] Resource rejected: Missing resourceId in authoritative order notes.");
            } else {
              fulfillmentOutcome = await fulfillResourcePurchase({
                userId: isValidUUID(userId) ? String(userId).trim() : null,
                resourceId: resourceId.trim(),
                amount: amountInRupees,
                currency,
                orderId,
                paymentId,
                customerName: trustedNotes.customerName || "",
                customerEmail: trustedNotes.customerEmail || paymentEntity?.email || "",
                customerPhone: trustedNotes.customerPhone || paymentEntity?.contact || "",
                resourceTitle: trustedNotes.resourceTitle || ""
              });

              console.log(
                `[Razorpay Webhook] Resource fulfillment result for payment ${paymentId?.slice(0, 14)}...: fulfilled=${Boolean(fulfillmentOutcome.fulfilled)}, already_fulfilled=${Boolean(fulfillmentOutcome.already_fulfilled)}`
              );
            }
          } else if (normalizedItemType === "consultation") {
            const customerEmail = String(trustedNotes.customerEmail || paymentEntity?.email || "").trim();
            const customerName = String(trustedNotes.customerName || "").trim();
            const customerPhone = String(trustedNotes.customerPhone || paymentEntity?.contact || "").trim();
            const bookingDate = String(trustedNotes.bookingDate || trustedNotes.date || "").trim();
            const bookingTime = String(trustedNotes.bookingTime || trustedNotes.time || "").trim();

            if (!orderId || !paymentId || !paymentEntity) {
              console.warn("[Razorpay Webhook] Consultation rejected: Missing order ID, payment ID, or payment entity.");
            } else if (!isPaymentCaptured) {
              console.warn(`[Razorpay Webhook] Consultation rejected: Payment ${paymentId?.slice(0, 14)} is not in confirmed captured status.`);
            } else if (!isOrderRelationshipValid) {
              console.warn(`[Razorpay Webhook] Consultation rejected: Payment order_id does not match order ${orderId?.slice(0, 14)}...`);
            } else if (!isCurrencyValid) {
              console.warn(`[Razorpay Webhook] Consultation rejected: Currency mismatch (expected INR, received ${currency})`);
            } else if (!isAmountValid) {
              console.warn(`[Razorpay Webhook] Consultation rejected: Amount mismatch (order: ${authoritativeOrder?.amount}, payment: ${amountInPaise})`);
            } else if (!customerEmail || !bookingDate || !bookingTime) {
              console.warn(`[Razorpay Webhook] Consultation rejected: Missing required booking schedule or email metadata.`);
            } else {
              fulfillmentOutcome = await fulfillConsultationPayment({
                userId: isValidUUID(userId) ? String(userId).trim() : null,
                bookingDetails: {
                  customerName: customerName || "Valued Client",
                  customerEmail,
                  customerPhone,
                  businessName: String(trustedNotes.businessName || "").trim(),
                  primaryChallenge: String(trustedNotes.primaryChallenge || "Business Growth Strategy").trim(),
                  desiredOutcome: String(trustedNotes.desiredOutcome || "").trim(),
                  website: trustedNotes.website ? String(trustedNotes.website).trim() : null,
                  linkedin: trustedNotes.linkedin ? String(trustedNotes.linkedin).trim() : null,
                  date: bookingDate,
                  time: bookingTime
                },
                orderId,
                paymentId,
                amount: amountInRupees,
                currency: currency,
                productId: trustedNotes.productId || "31bbb9bf-ce10-4da4-a517-dfc673f9b875"
              });

              console.log(
                `[Razorpay Webhook] Consultation fulfillment outcome for payment ${paymentId?.slice(0, 14)}...: fulfilled=${Boolean(fulfillmentOutcome.fulfilled)}, already_fulfilled=${Boolean(fulfillmentOutcome.already_fulfilled)}`
              );
            }
          } else if (normalizedItemType === "course") {
            if (!courseId || !userId || !isValidUUID(courseId) || !isValidUUID(userId) || !paymentId || !orderId) {
              console.warn(`[Razorpay Webhook] Course rejected: Missing or invalid courseId/userId/orderId/paymentId.`);
            } else if (!paymentEntity || !isPaymentCaptured) {
              console.warn(`[Razorpay Webhook] Course rejected: Payment ${paymentId?.slice(0, 14)} is not in confirmed captured status (status=${paymentEntity?.status}).`);
            } else if (!isOrderRelationshipValid) {
              console.warn(`[Razorpay Webhook] Course rejected: Payment order_id mismatch for order ${orderId?.slice(0, 14)}...`);
            } else if (!isCurrencyValid) {
              console.warn(`[Razorpay Webhook] Course rejected: Currency mismatch (expected INR, received ${currency}).`);
            } else if (!isAmountValid) {
              console.warn(`[Razorpay Webhook] Course rejected: Amount mismatch (order: ${authoritativeOrder?.amount}, payment: ${amountInPaise}).`);
            } else {
              const supabaseServer = getSupabaseServerClient();
              if (!supabaseServer) {
                console.warn("[Razorpay Webhook] Course rejected: Database service client is unavailable.");
              } else {
                const { data: courseRecord, error: courseErr } = await supabaseServer
                  .from("courses")
                  .select("id, slug, title, price, offer_price, offer_expires_at, currency, status")
                  .eq("id", courseId)
                  .maybeSingle();

                const courseStatus = String(courseRecord?.status || "").trim().toLowerCase();
                if (courseErr || !courseRecord || courseStatus !== "published") {
                  console.warn(`[Razorpay Webhook] Course rejected: Course ${courseId} is not found or not published (status=${courseStatus || "missing"}).`);
                } else {
                  const { effectivePrice, currency: courseCurrency } = calculateAuthoritativeCoursePrice(courseRecord);
                  const expectedCoursePaise = toPaiseStrict(effectivePrice);
                  if (
                    !expectedCoursePaise ||
                    currency !== courseCurrency ||
                    amountInPaise !== expectedCoursePaise
                  ) {
                    console.warn(
                      `[Razorpay Webhook] Course rejected: Price/currency mismatch (expected ${courseCurrency} ${expectedCoursePaise} paise, got ${currency} ${amountInPaise} paise).`
                    );
                  } else {
                    const studentEmail = String(trustedNotes.customerEmail || paymentEntity?.email || "").trim() || null;
                    const studentName = String(trustedNotes.customerName || "").trim() || null;

                    fulfillmentOutcome = await fulfillCourseEnrollment({
                      userId: String(userId).trim(),
                      courseId: String(courseId).trim(),
                      amount: expectedCoursePaise / 100,
                      currency,
                      orderId,
                      paymentId,
                      studentEmail,
                      studentName
                    });

                    console.log(
                      `[Razorpay Webhook] Course fulfillment result for payment ${paymentId}: fulfilled=${Boolean(fulfillmentOutcome.fulfilled)}, already_fulfilled=${Boolean(fulfillmentOutcome.already_fulfilled)}`
                    );
                  }
                }
              }
            }
          } else {
            console.warn(
              `[Razorpay Webhook] Rejected webhook event due to missing or unrecognized authoritative order itemType='${itemType || "missing"}': courseId=${courseId}, resourceId=${resourceId}, userId=${userId}, paymentId=${paymentId}`
            );
          }
        } catch (fErr) {
          console.error("[Razorpay Webhook] Error executing webhook fulfillment:", fErr?.message || fErr);
          fulfillmentOutcome = {
            fulfilled: false,
            retryable: true,
            code: "RPC_UNAVAILABLE",
            error: fErr?.message || "Unexpected error executing webhook fulfillment."
          };
        }

        if (fulfillmentOutcome?.retryable === true) {
          return res.status(503).json({
            status: "retry_required",
            event,
            acknowledged: false,
            fulfilled: false,
            retryable: true,
            code: fulfillmentOutcome.code || "RPC_UNAVAILABLE",
            error: fulfillmentOutcome.error || "Fulfillment service temporarily unavailable."
          });
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
