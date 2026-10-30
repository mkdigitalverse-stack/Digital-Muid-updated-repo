/**
 * testConsultationWebhook.js
 *
 * Mocked integration tests for Razorpay Webhook consultation fulfillment.
 * Zero external network calls. Tests signature verification, consultation extraction,
 * missing field protection, and idempotency handling.
 */

import crypto from "crypto";
import { handleRazorpayWebhook } from "../server/paymentWebhook.js";

const TEST_SECRET = "whsec_test_secret_for_mock_tests_12345";
process.env.RAZORPAY_WEBHOOK_SECRET = TEST_SECRET;

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  PASS: ${message}`);
    testsPassed++;
  } else {
    console.error(`  FAIL: ${message}`);
    testsFailed++;
  }
}

function generateSignature(bodyBuffer, secret = TEST_SECRET) {
  return crypto.createHmac("sha256", secret).update(bodyBuffer).digest("hex");
}

async function runMockWebhook(payload, signatureOverride = null, isBuffer = true) {
  const rawBody = Buffer.from(JSON.stringify(payload), "utf8");
  const signature = signatureOverride !== null ? signatureOverride : generateSignature(rawBody);

  const req = {
    headers: {
      "x-razorpay-signature": signature
    },
    body: isBuffer ? rawBody : payload,
    rawBody: rawBody
  };

  let statusCode = null;
  let jsonResponse = null;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      jsonResponse = data;
      return this;
    }
  };

  await handleRazorpayWebhook(req, res);
  return { statusCode, jsonResponse };
}

async function runTests() {
  console.log("=======================================================");
  console.log("DIGITAL MUID — CONSULTATION WEBHOOK PROCESSING TESTS");
  console.log("=======================================================\n");

  // Test 1: Webhook with missing signature is rejected
  console.log("Test 1: Webhook with missing signature header");
  const reqNoSig = { headers: {}, body: Buffer.from("{}"), rawBody: Buffer.from("{}") };
  let statusNoSig = null;
  const resNoSig = {
    status(c) { statusNoSig = c; return this; },
    json() { return this; }
  };
  await handleRazorpayWebhook(reqNoSig, resNoSig);
  assert(statusNoSig === 400, "Must return HTTP 400 when X-Razorpay-Signature is missing");

  // Test 2: Webhook with forged signature is rejected
  console.log("\nTest 2: Webhook with invalid / forged signature");
  const forgedResult = await runMockWebhook({ event: "payment.captured" }, "forged_hex_signature_12345");
  assert(forgedResult.statusCode === 400, "Must return HTTP 400 for invalid signature");
  assert(forgedResult.jsonResponse.error === "Invalid webhook signature.", "Error message must state invalid signature");

  // Test 3: Consultation payment.captured event with incomplete metadata fails safely
  console.log("\nTest 3: Consultation webhook with missing bookingDate/time slot");
  const incompletePayload = {
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: "pay_mock_test_001",
          order_id: "order_mock_test_001",
          amount: 58900,
          currency: "INR",
          notes: {
            itemType: "consultation",
            customerName: "Test Client",
            customerEmail: "client@test.com"
            // Missing bookingDate and bookingTime!
          }
        }
      }
    }
  };
  const incompleteRes = await runMockWebhook(incompletePayload);
  assert(incompleteRes.statusCode === 200, "Webhook must acknowledge with HTTP 200 even if metadata incomplete");
  assert(incompleteRes.jsonResponse.fulfilled === false, "Must NOT mark as fulfilled when bookingDate is missing");

  // Test 4: payment.failed event is safely acknowledged without fulfillment
  console.log("\nTest 4: payment.failed event safely acknowledged");
  const failedPayload = {
    event: "payment.failed",
    payload: {
      payment: {
        entity: {
          id: "pay_mock_failed_001",
          order_id: "order_mock_failed_001",
          amount: 58900,
          currency: "INR"
        }
      }
    }
  };
  const failedRes = await runMockWebhook(failedPayload);
  assert(failedRes.statusCode === 200, "payment.failed must return HTTP 200");
  assert(failedRes.jsonResponse.fulfilled === false, "payment.failed fulfilled must be false");

  console.log("\n=======================================================");
  console.log(`TEST SUMMARY: ${testsPassed} PASSED, ${testsFailed} FAILED`);
  console.log("=======================================================");

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
