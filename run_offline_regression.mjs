import assert from "node:assert";
import crypto from "crypto";
import { verifyWebhookSignature } from "./server/razorpay.js";
import {
  generateGuestResourceToken,
  verifyGuestResourceToken
} from "./server/resourceToken.js";

async function runRegressionSuite() {
  console.log("=== STARTING EXECUTABLE OFFLINE SECURITY REGRESSION SUITE ===");

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}:`, err.message);
    }
  }

  // Set test environment secrets
  process.env.RAZORPAY_WEBHOOK_SECRET = "webhook_secret_test_32_bytes_entropy_abc123";
  process.env.RESOURCE_TOKEN_HMAC_SECRET = "resource_token_hmac_secret_32_bytes_entropy_xyz789";

  console.log("\n--- PHASE 2: PAYMENT WEBHOOK SECURITY ---");

  test("Webhook: Correct HMAC signature", () => {
    const rawBody = Buffer.from(JSON.stringify({ event: "payment.captured" }));
    const sig = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest("hex");
    const valid = verifyWebhookSignature(rawBody, sig);
    assert.strictEqual(valid, true);
  });

  test("Webhook: Incorrect HMAC signature", () => {
    const rawBody = Buffer.from(JSON.stringify({ event: "payment.captured" }));
    const valid = verifyWebhookSignature(rawBody, "invalidsignature000000000000000000000000");
    assert.strictEqual(valid, false);
  });

  test("Webhook: Missing signature", () => {
    const rawBody = Buffer.from(JSON.stringify({ event: "payment.captured" }));
    const valid = verifyWebhookSignature(rawBody, null);
    assert.strictEqual(valid, false);
  });

  test("Webhook: Modified raw request body", () => {
    const rawBody = Buffer.from(JSON.stringify({ event: "payment.captured" }));
    const sig = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest("hex");
    const tamperedBody = Buffer.from(JSON.stringify({ event: "payment.captured", hacked: true }));
    const valid = verifyWebhookSignature(tamperedBody, sig);
    assert.strictEqual(valid, false);
  });

  test("Webhook: Empty webhook secret", () => {
    const oldSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    process.env.RAZORPAY_WEBHOOK_SECRET = "";
    const rawBody = Buffer.from(JSON.stringify({ event: "payment.captured" }));
    const sig = crypto.createHmac("sha256", "some_secret").update(rawBody).digest("hex");
    const valid = verifyWebhookSignature(rawBody, sig);
    process.env.RAZORPAY_WEBHOOK_SECRET = oldSecret;
    assert.strictEqual(valid, false);
  });

  console.log("\n--- PHASE 3: RESOURCE TOKEN SECURITY ---");

  const testPaymentId = "pay_synthetic_123456";
  const testOrderId = "order_synthetic_789012";
  const testResourceId = "res_synthetic_abc123";

  test("Token: Valid resource token mint and verify", () => {
    const token = generateGuestResourceToken({
      paymentId: testPaymentId,
      orderId: testOrderId,
      resourceId: testResourceId,
      email: "buyer@example.test"
    });
    const result = verifyGuestResourceToken(token, {
      paymentId: testPaymentId,
      orderId: testOrderId,
      resourceId: testResourceId
    });
    assert.strictEqual(result.valid, true);
  });

  test("Token: Expired token rejection", () => {
    const token = generateGuestResourceToken({
      paymentId: testPaymentId,
      orderId: testOrderId,
      resourceId: testResourceId,
      expiresInMs: -1000 // already expired
    });
    const result = verifyGuestResourceToken(token, {
      paymentId: testPaymentId,
      orderId: testOrderId,
      resourceId: testResourceId
    });
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.code, "EXPIRED_GUEST_TOKEN");
  });

  test("Token: Tampered signature rejection", () => {
    const token = generateGuestResourceToken({
      paymentId: testPaymentId,
      orderId: testOrderId,
      resourceId: testResourceId
    });
    const [payloadPart] = token.split(".");
    const tamperedToken = `${payloadPart}.tampered_signature_string`;
    const result = verifyGuestResourceToken(tamperedToken, {
      paymentId: testPaymentId,
      orderId: testOrderId,
      resourceId: testResourceId
    });
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.code, "INVALID_GUEST_TOKEN_SIGNATURE");
  });

  test("Token: Wrong resource ID rejection", () => {
    const token = generateGuestResourceToken({
      paymentId: testPaymentId,
      orderId: testOrderId,
      resourceId: testResourceId
    });
    const result = verifyGuestResourceToken(token, {
      paymentId: testPaymentId,
      orderId: testOrderId,
      resourceId: "res_wrong_resource_999"
    });
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.code, "GUEST_TOKEN_RESOURCE_MISMATCH");
  });

  test("Token: Missing token rejection", () => {
    const result = verifyGuestResourceToken(null, {
      paymentId: testPaymentId,
      orderId: testOrderId,
      resourceId: testResourceId
    });
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.code, "MISSING_GUEST_TOKEN");
  });

  test("Token: Malformed token rejection", () => {
    const result = verifyGuestResourceToken("malformed.token.format.extra", {
      paymentId: testPaymentId,
      orderId: testOrderId,
      resourceId: testResourceId
    });
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.code, "MALFORMED_GUEST_TOKEN");
  });

  console.log(`\n=== REGRESSION SUITE COMPLETE: ${passed}/${total} TESTS PASSED ===`);
  if (passed !== total) {
    process.exit(1);
  }
}

runRegressionSuite().catch((err) => {
  console.error("Regression Suite Execution Error:", err);
  process.exit(1);
});
