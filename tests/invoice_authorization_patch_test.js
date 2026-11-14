// ==============================================================================
// DIGITALMUID V4.3 — INVOICE AUTHORIZATION SECURITY PATCH VERIFICATION SUITE
// Automated verification covering all 14 scenarios (A through N):
// A. Appointment confirmed + payment pending = invoice rejected.
// B. Appointment completed + payment missing = invoice rejected.
// C. Appointment confirmed + Razorpay captured = invoice allowed after all transaction checks.
// D. Paid course with verified capture = invoice allowed.
// E. Verified resource purchase = invoice allowed.
// F. Guest resource purchase with verified capture = invoice allowed.
// G. Failed Razorpay payment = invoice rejected.
// H. Pending Razorpay payment = invoice rejected.
// I. Invalid order ID = invoice rejected.
// J. Incorrect payment amount = invoice rejected.
// K. Incorrect currency = invoice rejected.
// L. Unauthorized user requesting another user's invoice = rejected.
// M. Missing HMAC secret = fail closed.
// N. Tampered invoice token = rejected.
// ==============================================================================
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  verifyInvoicePaymentAuthorization,
  evaluateInvoiceAccessAuthorization,
  generateSignedInvoiceToken,
  verifySignedInvoiceToken,
  getInvoiceTokenHmacSecret
} from "../server/paymentRoutes.js";

console.log("==================================================================");
console.log("DIGITALMUID V4.3 — INVOICE AUTHORIZATION SECURITY PATCH TEST SUITE");
console.log("Testing All 14 Audit Scenarios (A through N)");
console.log("==================================================================");

let testsPassed = 0;
let testsTotal = 0;

function runTest(name, fn) {
  testsTotal++;
  try {
    fn();
    testsPassed++;
    console.log(`  ✓ PASS: [Scenario ${name}]`);
  } catch (err) {
    console.error(`  ✗ FAIL: [Scenario ${name}]`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

// ------------------------------------------------------------------------------
// Scenario A: Appointment confirmed + payment pending = invoice rejected
// ------------------------------------------------------------------------------
runTest("A: Appointment confirmed + payment pending = invoice rejected", () => {
  const result = verifyInvoicePaymentAuthorization({
    bookingRecord: {
      id: "booking_a_001",
      status: "confirmed", // Operational appointment lifecycle status
      payment_status: "pending", // Authoritative financial status
      total_amount: 1500,
      currency: "INR"
    },
    paymentRecord: null,
    resourceRecord: null,
    rzpPayment: null
  });

  assert.strictEqual(result.authorized, false, "Invoice generation must be rejected when payment is pending");
  assert.strictEqual(result.statusCode, 400);
  assert.ok(
    result.error.includes("not verified or captured"),
    `Error message must indicate payment is not verified or captured. Got: ${result.error}`
  );
});

// ------------------------------------------------------------------------------
// Scenario B: Appointment completed + payment missing = invoice rejected
// ------------------------------------------------------------------------------
runTest("B: Appointment completed + payment missing = invoice rejected", () => {
  const result = verifyInvoicePaymentAuthorization({
    bookingRecord: {
      id: "booking_b_001",
      status: "completed", // Operational appointment lifecycle status
      payment_status: null, // No financial payment status
      total_amount: 1500,
      currency: "INR"
    },
    paymentRecord: null,
    resourceRecord: null,
    rzpPayment: null
  });

  assert.strictEqual(result.authorized, false, "Invoice generation must be rejected when payment is missing");
  assert.strictEqual(result.statusCode, 400);
  assert.ok(
    result.error.includes("not verified or captured"),
    `Error message must indicate payment is not verified or captured. Got: ${result.error}`
  );
});

// ------------------------------------------------------------------------------
// Scenario C: Appointment confirmed + Razorpay captured = invoice allowed after all transaction checks
// ------------------------------------------------------------------------------
runTest("C: Appointment confirmed + Razorpay captured = invoice allowed after all transaction checks", () => {
  const result = verifyInvoicePaymentAuthorization({
    bookingRecord: {
      id: "booking_c_001",
      status: "confirmed",
      payment_status: "pending", // Even if local booking says pending, verified gateway capture proves payment
      total_amount: 1500,
      currency: "INR",
      razorpay_order_id: "order_c_001",
      customer_email: "student@digitalmuid.in"
    },
    paymentRecord: null,
    resourceRecord: null,
    rzpPayment: {
      id: "pay_c_001",
      status: "captured", // Authoritative gateway state
      order_id: "order_c_001", // Order ID matches
      amount: 150000, // 150000 paise = ₹1500 matches
      currency: "INR", // Currency matches
      email: "student@digitalmuid.in" // Customer matches
    }
  });

  assert.strictEqual(result.authorized, true, "Invoice generation must be allowed with verified gateway capture");
  assert.strictEqual(result.isCaptured, true);
});

// ------------------------------------------------------------------------------
// Scenario D: Paid course with verified capture = invoice allowed
// ------------------------------------------------------------------------------
runTest("D: Paid course with verified capture = invoice allowed", () => {
  const result = verifyInvoicePaymentAuthorization({
    paymentRecord: {
      id: "pay_rec_d_001",
      item_type: "course",
      item_id: "course_meta_ads_pro",
      amount: 4999,
      currency: "INR",
      status: "captured", // Authoritative ledger status
      razorpay_payment_id: "pay_d_001",
      razorpay_order_id: "order_d_001"
    },
    bookingRecord: null,
    resourceRecord: null,
    rzpPayment: null
  });

  assert.strictEqual(result.authorized, true, "Captured course payment in authoritative ledger must be allowed");
  assert.strictEqual(result.isCaptured, true);
});

// ------------------------------------------------------------------------------
// Scenario E: Verified resource purchase = invoice allowed
// ------------------------------------------------------------------------------
runTest("E: Verified resource purchase = invoice allowed; active status alone rejected", () => {
  // Test E.1: Verified resource purchase with authoritative captured paymentRecord -> ALLOWED
  const verifiedResult = verifyInvoicePaymentAuthorization({
    paymentRecord: {
      id: "pay_rec_e_001",
      item_type: "resource",
      item_id: "2d50e5e3-711d-4461-a70d-0ed54dd29f17",
      amount: 299,
      currency: "INR",
      status: "captured",
      razorpay_payment_id: "pay_e_001",
      razorpay_order_id: "order_e_001"
    },
    resourceRecord: {
      id: "purchase_e_001",
      resource_id: "2d50e5e3-711d-4461-a70d-0ed54dd29f17",
      status: "active",
      amount: 299,
      currency: "INR"
    },
    bookingRecord: null,
    rzpPayment: null
  });

  assert.strictEqual(verifiedResult.authorized, true, "Verified captured resource purchase must be allowed");
  assert.strictEqual(verifiedResult.isCaptured, true);

  // Test E.2: 'active' resource status ALONE without captured paymentRecord or gateway capture -> MUST BE REJECTED!
  const unverifiedResult = verifyInvoicePaymentAuthorization({
    paymentRecord: null,
    resourceRecord: {
      id: "purchase_e_unverified",
      resource_id: "2d50e5e3-711d-4461-a70d-0ed54dd29f17",
      status: "active", // Access status alone cannot authorize invoice
      amount: 299,
      currency: "INR"
    },
    bookingRecord: null,
    rzpPayment: null
  });

  assert.strictEqual(unverifiedResult.authorized, false, "Resource access status 'active' alone must NOT authorize invoice");
  assert.strictEqual(unverifiedResult.statusCode, 400);
});

// ------------------------------------------------------------------------------
// Scenario F: Guest resource purchase with verified capture = invoice allowed
// ------------------------------------------------------------------------------
runTest("F: Guest resource purchase with verified capture = invoice allowed", () => {
  const resourceRecord = {
    id: "purchase_f_guest",
    user_id: null, // Guest checkout
    customer_email: "guest@example.com",
    resource_id: "2d50e5e3-711d-4461-a70d-0ed54dd29f17",
    amount: 299,
    currency: "INR",
    razorpay_order_id: "order_guest_f_001",
    razorpay_payment_id: "pay_guest_f_001"
  };

  const rzpPayment = {
    id: "pay_guest_f_001",
    status: "captured",
    order_id: "order_guest_f_001",
    amount: 29900,
    currency: "INR",
    email: "guest@example.com"
  };

  // 1. Authoritative payment authorization
  const authResult = verifyInvoicePaymentAuthorization({
    paymentRecord: null,
    bookingRecord: null,
    resourceRecord,
    rzpPayment
  });

  assert.strictEqual(authResult.authorized, true, "Guest purchase with captured gateway payment must be authorized");
  assert.strictEqual(authResult.isCaptured, true);

  // 2. Authoritative access authorization via signed HMAC token
  const accessResult = evaluateInvoiceAccessAuthorization({
    user: null,
    isAdmin: false,
    isSignedTokenValid: true, // HMAC token presented
    paymentRecord: null,
    bookingRecord: null,
    resourceRecord,
    rzpPayment
  });

  assert.strictEqual(accessResult.isAuthorized, true, "Guest with valid signed token must be granted access");
});

// ------------------------------------------------------------------------------
// Scenario G: Failed Razorpay payment = invoice rejected
// ------------------------------------------------------------------------------
runTest("G: Failed Razorpay payment = invoice rejected", () => {
  const result = verifyInvoicePaymentAuthorization({
    bookingRecord: {
      id: "booking_g_001",
      razorpay_order_id: "order_g_001",
      total_amount: 1500,
      currency: "INR"
    },
    paymentRecord: null,
    resourceRecord: null,
    rzpPayment: {
      id: "pay_g_001",
      status: "failed", // Failed gateway payment
      order_id: "order_g_001",
      amount: 150000,
      currency: "INR"
    }
  });

  assert.strictEqual(result.authorized, false, "Failed Razorpay payment must be rejected");
  assert.strictEqual(result.statusCode, 400);
  assert.ok(result.error.includes("status is 'failed'"), `Error must mention status is 'failed'. Got: ${result.error}`);
});

// ------------------------------------------------------------------------------
// Scenario H: Pending Razorpay payment = invoice rejected
// ------------------------------------------------------------------------------
runTest("H: Pending Razorpay payment = invoice rejected", () => {
  const result = verifyInvoicePaymentAuthorization({
    bookingRecord: {
      id: "booking_h_001",
      razorpay_order_id: "order_h_001",
      total_amount: 1500,
      currency: "INR"
    },
    paymentRecord: null,
    resourceRecord: null,
    rzpPayment: {
      id: "pay_h_001",
      status: "pending", // Pending gateway payment
      order_id: "order_h_001",
      amount: 150000,
      currency: "INR"
    }
  });

  assert.strictEqual(result.authorized, false, "Pending Razorpay payment must be rejected");
  assert.strictEqual(result.statusCode, 400);
  assert.ok(result.error.includes("status is 'pending'"), `Error must mention status is 'pending'. Got: ${result.error}`);
});

// ------------------------------------------------------------------------------
// Scenario I: Invalid order ID = invoice rejected
// ------------------------------------------------------------------------------
runTest("I: Invalid order ID = invoice rejected", () => {
  const result = verifyInvoicePaymentAuthorization({
    paymentRecord: {
      id: "pay_rec_i_001",
      razorpay_order_id: "order_expected_12345", // Authoritative order in DB
      amount: 1500,
      currency: "INR"
    },
    bookingRecord: null,
    resourceRecord: null,
    rzpPayment: {
      id: "pay_i_001",
      status: "captured",
      order_id: "order_tampered_99999", // Mismatched order on gateway
      amount: 150000,
      currency: "INR"
    }
  });

  assert.strictEqual(result.authorized, false, "Order ID mismatch must be rejected");
  assert.strictEqual(result.statusCode, 400);
  assert.ok(
    result.error.includes("Payment order ID mismatch"),
    `Error must mention order ID mismatch. Got: ${result.error}`
  );
});

// ------------------------------------------------------------------------------
// Scenario J: Incorrect payment amount = invoice rejected
// ------------------------------------------------------------------------------
runTest("J: Incorrect payment amount = invoice rejected", () => {
  const result = verifyInvoicePaymentAuthorization({
    paymentRecord: {
      id: "pay_rec_j_001",
      razorpay_order_id: "order_j_001",
      amount: 1500, // Expected ₹1500 (150000 paise)
      currency: "INR"
    },
    bookingRecord: null,
    resourceRecord: null,
    rzpPayment: {
      id: "pay_j_001",
      status: "captured",
      order_id: "order_j_001",
      amount: 10000, // Only ₹100 paid on gateway!
      currency: "INR"
    }
  });

  assert.strictEqual(result.authorized, false, "Amount mismatch must be rejected");
  assert.strictEqual(result.statusCode, 400);
  assert.ok(
    result.error.includes("Payment amount mismatch"),
    `Error must mention payment amount mismatch. Got: ${result.error}`
  );
});

// ------------------------------------------------------------------------------
// Scenario K: Incorrect currency = invoice rejected
// ------------------------------------------------------------------------------
runTest("K: Incorrect currency = invoice rejected", () => {
  const result = verifyInvoicePaymentAuthorization({
    paymentRecord: {
      id: "pay_rec_k_001",
      razorpay_order_id: "order_k_001",
      amount: 1500,
      currency: "INR" // Expected INR
    },
    bookingRecord: null,
    resourceRecord: null,
    rzpPayment: {
      id: "pay_k_001",
      status: "captured",
      order_id: "order_k_001",
      amount: 150000,
      currency: "USD" // Gateway says USD!
    }
  });

  assert.strictEqual(result.authorized, false, "Currency mismatch must be rejected");
  assert.strictEqual(result.statusCode, 400);
  assert.ok(
    result.error.includes("Payment currency mismatch"),
    `Error must mention payment currency mismatch. Got: ${result.error}`
  );
});

// ------------------------------------------------------------------------------
// Scenario L: Unauthorized user requesting another user's invoice = rejected
// ------------------------------------------------------------------------------
runTest("L: Unauthorized user requesting another user's invoice = rejected (403)", () => {
  const result = evaluateInvoiceAccessAuthorization({
    user: {
      id: "user_attacker_001",
      email: "attacker@malicious.com",
      email_confirmed_at: "2026-11-01T00:00:00Z"
    },
    isAdmin: false,
    isSignedTokenValid: false,
    paymentRecord: {
      id: "pm_victim_001",
      user_id: "user_victim_999", // Belongs to different account
      customer_email: "victim@example.com"
    },
    bookingRecord: null,
    resourceRecord: null,
    rzpPayment: null
  });

  assert.strictEqual(result.isAuthorized, false, "Cross-account access must be rejected");
  assert.strictEqual(result.statusCode, 403);
  assert.ok(
    result.error.includes("different user account") && result.error.includes("Cross-account access denied"),
    `Error must state cross-account access denied. Got: ${result.error}`
  );
});

// ------------------------------------------------------------------------------
// Scenario M: Missing HMAC secret = fail closed
// ------------------------------------------------------------------------------
runTest("M: Missing HMAC secret = fail closed", () => {
  // Save environment
  const savedInvoiceSecret = process.env.INVOICE_TOKEN_HMAC_SECRET;
  const savedPaymentSecret = process.env.PAYMENT_VERIFICATION_SECRET;
  const savedAssetSecret = process.env.ASSET_TOKEN_HMAC_SECRET;
  const savedRazorpaySecret = process.env.RAZORPAY_KEY_SECRET;

  try {
    delete process.env.INVOICE_TOKEN_HMAC_SECRET;
    delete process.env.PAYMENT_VERIFICATION_SECRET;
    delete process.env.ASSET_TOKEN_HMAC_SECRET;
    delete process.env.RAZORPAY_KEY_SECRET;

    // 1. Secret resolution returns null
    const secret = getInvoiceTokenHmacSecret();
    assert.strictEqual(secret, null, "HMAC secret must be null when unconfigured");

    // 2. Token generation throws error (fails closed)
    assert.throws(
      () => generateSignedInvoiceToken("pay_test_missing_secret"),
      /Invoice HMAC secret missing or insufficient entropy/,
      "Must throw error on token generation without secret"
    );

    // 3. Verification returns false (fails closed)
    const isValid = verifySignedInvoiceToken("pay_test_missing_secret", "12345.abcdef");
    assert.strictEqual(isValid, false, "Verification must return false when secret is missing");
  } finally {
    // Restore environment
    if (savedInvoiceSecret) process.env.INVOICE_TOKEN_HMAC_SECRET = savedInvoiceSecret;
    if (savedPaymentSecret) process.env.PAYMENT_VERIFICATION_SECRET = savedPaymentSecret;
    if (savedAssetSecret) process.env.ASSET_TOKEN_HMAC_SECRET = savedAssetSecret;
    if (savedRazorpaySecret) process.env.RAZORPAY_KEY_SECRET = savedRazorpaySecret;
  }
});

// ------------------------------------------------------------------------------
// Scenario N: Tampered invoice token = rejected
// ------------------------------------------------------------------------------
runTest("N: Tampered invoice token = rejected", () => {
  const originalSecret = process.env.INVOICE_TOKEN_HMAC_SECRET;
  const testSecret = "digitalmuid_super_secret_hmac_test_key_32_bytes_long";
  process.env.INVOICE_TOKEN_HMAC_SECRET = testSecret;

  try {
    const paymentId = "pay_authentic_test_12345";
    const validToken = generateSignedInvoiceToken(paymentId, 60000); // 1 minute expiry

    // 1. Valid token passes
    assert.strictEqual(
      verifySignedInvoiceToken(paymentId, validToken),
      true,
      "Untampered valid token must verify successfully"
    );

    // 2. Tampered signature bytes fail
    const [expStr, sig] = validToken.split(".");
    const tamperedSig = sig.slice(0, -2) + (sig.endsWith("a") ? "b" : "a");
    const tamperedToken = `${expStr}.${tamperedSig}`;
    assert.strictEqual(
      verifySignedInvoiceToken(paymentId, tamperedToken),
      false,
      "Token with tampered signature must be rejected"
    );

    // 3. Tampered payment ID fails
    assert.strictEqual(
      verifySignedInvoiceToken("pay_tampered_different_id", validToken),
      false,
      "Token used with different payment ID must be rejected"
    );

    // 4. Expired token fails
    const expiredTimestamp = Date.now() - 5000;
    const expiredSig = crypto
      .createHmac("sha256", testSecret)
      .update(`${paymentId}:${expiredTimestamp}`)
      .digest("hex");
    const expiredToken = `${expiredTimestamp}.${expiredSig}`;
    assert.strictEqual(
      verifySignedInvoiceToken(paymentId, expiredToken),
      false,
      "Expired token must be rejected"
    );

    // 5. Access check fails when token is invalid
    const accessResult = evaluateInvoiceAccessAuthorization({
      user: null,
      isAdmin: false,
      isSignedTokenValid: false,
      paymentRecord: { id: "pm_1", user_id: null, customer_email: "guest@example.com" },
      bookingRecord: null,
      resourceRecord: null,
      rzpPayment: null
    });

    assert.strictEqual(accessResult.isAuthorized, false, "Unauthenticated request with invalid token must be rejected");
    assert.strictEqual(accessResult.statusCode, 403);
  } finally {
    if (originalSecret) {
      process.env.INVOICE_TOKEN_HMAC_SECRET = originalSecret;
    } else {
      delete process.env.INVOICE_TOKEN_HMAC_SECRET;
    }
  }
});

// ------------------------------------------------------------------------------
// Gateway Fail-Closed Negative Unit Tests (Requirements 1-10)
// ------------------------------------------------------------------------------
runTest("Negative 1: Missing gateway order_id is rejected when expectedOrderId is configured", () => {
  const result = verifyInvoicePaymentAuthorization({
    paymentRecord: { razorpay_order_id: "order_req_001", amount: 1500, currency: "INR" },
    rzpPayment: { status: "captured", amount: 150000, currency: "INR" } // order_id missing
  });
  assert.strictEqual(result.authorized, false, "Must reject missing gateway order_id");
  assert.strictEqual(result.statusCode, 400);
  assert.ok(result.error.includes("Payment order ID mismatch"));
});

runTest("Negative 2: Null gateway order_id is rejected when expectedOrderId is configured", () => {
  const result = verifyInvoicePaymentAuthorization({
    paymentRecord: { razorpay_order_id: "order_req_002", amount: 1500, currency: "INR" },
    rzpPayment: { status: "captured", order_id: null, amount: 150000, currency: "INR" }
  });
  assert.strictEqual(result.authorized, false, "Must reject null gateway order_id");
  assert.strictEqual(result.statusCode, 400);
  assert.ok(result.error.includes("Payment order ID mismatch"));
});

runTest("Negative 3: Missing gateway amount is rejected", () => {
  const result = verifyInvoicePaymentAuthorization({
    paymentRecord: { razorpay_order_id: "order_req_003", amount: 1500, currency: "INR" },
    rzpPayment: { status: "captured", order_id: "order_req_003", currency: "INR" } // amount missing
  });
  assert.strictEqual(result.authorized, false, "Must reject missing gateway amount");
  assert.strictEqual(result.statusCode, 400);
  assert.ok(result.error.includes("Missing or null gateway payment amount"));
});

runTest("Negative 4: Null gateway amount is rejected", () => {
  const result = verifyInvoicePaymentAuthorization({
    paymentRecord: { razorpay_order_id: "order_req_004", amount: 1500, currency: "INR" },
    rzpPayment: { status: "captured", order_id: "order_req_004", amount: null, currency: "INR" }
  });
  assert.strictEqual(result.authorized, false, "Must reject null gateway amount");
  assert.strictEqual(result.statusCode, 400);
  assert.ok(result.error.includes("Missing or null gateway payment amount"));
});

runTest("Negative 5: Invalid or non-numeric gateway amount is rejected", () => {
  const result = verifyInvoicePaymentAuthorization({
    paymentRecord: { razorpay_order_id: "order_req_005", amount: 1500, currency: "INR" },
    rzpPayment: { status: "captured", order_id: "order_req_005", amount: "not_a_valid_amount", currency: "INR" }
  });
  assert.strictEqual(result.authorized, false, "Must reject non-numeric gateway amount");
  assert.strictEqual(result.statusCode, 400);
  assert.ok(result.error.includes("Invalid or non-numeric gateway payment amount"));
});

runTest("Negative 6: Missing gateway currency is rejected", () => {
  const result = verifyInvoicePaymentAuthorization({
    paymentRecord: { razorpay_order_id: "order_req_006", amount: 1500, currency: "INR" },
    rzpPayment: { status: "captured", order_id: "order_req_006", amount: 150000 } // currency missing
  });
  assert.strictEqual(result.authorized, false, "Must reject missing gateway currency");
  assert.strictEqual(result.statusCode, 400);
  assert.ok(result.error.includes("Missing gateway payment currency"));
});

runTest("Negative 7: Null gateway currency is rejected", () => {
  const result = verifyInvoicePaymentAuthorization({
    paymentRecord: { razorpay_order_id: "order_req_007", amount: 1500, currency: "INR" },
    rzpPayment: { status: "captured", order_id: "order_req_007", amount: 150000, currency: null }
  });
  assert.strictEqual(result.authorized, false, "Must reject null gateway currency");
  assert.strictEqual(result.statusCode, 400);
  assert.ok(result.error.includes("Missing gateway payment currency"));
});

runTest("Negative 8: Mismatched gateway currency is rejected", () => {
  const result = verifyInvoicePaymentAuthorization({
    paymentRecord: { razorpay_order_id: "order_req_008", amount: 1500, currency: "INR" },
    rzpPayment: { status: "captured", order_id: "order_req_008", amount: 150000, currency: "EUR" }
  });
  assert.strictEqual(result.authorized, false, "Must reject mismatched gateway currency");
  assert.strictEqual(result.statusCode, 400);
  assert.ok(result.error.includes("Payment currency mismatch"));
});

runTest("Negative 9: Missing or invalid expected amount for gateway authorization is rejected", () => {
  const result = verifyInvoicePaymentAuthorization({
    paymentRecord: { razorpay_order_id: "order_req_009", amount: null, currency: "INR" }, // expected amount missing
    rzpPayment: { status: "captured", order_id: "order_req_009", amount: 150000, currency: "INR" }
  });
  assert.strictEqual(result.authorized, false, "Must reject when expected amount is missing");
  assert.strictEqual(result.statusCode, 400);
  assert.ok(result.error.includes("Missing or invalid expected payment amount"));
});

runTest("Negative 10: Mismatched order ID and amount is rejected", () => {
  const result = verifyInvoicePaymentAuthorization({
    paymentRecord: { razorpay_order_id: "order_expected_010", amount: 1500, currency: "INR" },
    rzpPayment: { status: "captured", order_id: "order_mismatch_999", amount: 99900, currency: "INR" }
  });
  assert.strictEqual(result.authorized, false, "Must reject mismatched order ID and amount");
  assert.strictEqual(result.statusCode, 400);
  assert.ok(result.error.includes("Payment order ID mismatch") || result.error.includes("Payment amount mismatch"));
});

// ------------------------------------------------------------------------------
// Source Code Architectural Integrity Check
// ------------------------------------------------------------------------------
runTest("Architecture: server/paymentRoutes.js strictly separates booking status from payment evidence", () => {
  const routesPath = path.resolve("server/paymentRoutes.js");
  const code = fs.readFileSync(routesPath, "utf8");

  // 1. bookingRecord.status must NOT be in rawStatus or isCaptured
  assert.ok(
    !code.includes("bookingRecord?.status"),
    "server/paymentRoutes.js must NOT reference bookingRecord?.status in invoice evaluation"
  );

  // 2. resourceRecord.status must NOT be in rawStatus or isCaptured
  assert.ok(
    !code.includes("resourceRecord?.status"),
    "server/paymentRoutes.js must NOT reference resourceRecord?.status in invoice evaluation"
  );

  // 3. rawStatus === 'confirmed' and rawStatus === 'completed' must NOT authorize invoices
  assert.ok(
    !code.includes('rawStatus === "confirmed"'),
    "server/paymentRoutes.js must NOT allow rawStatus === 'confirmed' to authorize invoices"
  );
  assert.ok(
    !code.includes('rawStatus === "completed"'),
    "server/paymentRoutes.js must NOT allow rawStatus === 'completed' to authorize invoices"
  );

  // 4. Nonexistent column payment_verified on resourceRecord must NOT be referenced
  assert.ok(
    !code.includes("resourceRecord.payment_verified") && !code.includes("resourceRecord?.payment_verified"),
    "server/paymentRoutes.js must NOT reference nonexistent database column 'resourceRecord.payment_verified'"
  );

  // 5. verifyInvoicePaymentAuthorization and evaluateInvoiceAccessAuthorization must be exported
  assert.ok(
    code.includes("export function verifyInvoicePaymentAuthorization"),
    "server/paymentRoutes.js must export verifyInvoicePaymentAuthorization"
  );
  assert.ok(
    code.includes("export function evaluateInvoiceAccessAuthorization"),
    "server/paymentRoutes.js must export evaluateInvoiceAccessAuthorization"
  );
});

console.log("\n==================================================================");
console.log(`ALL ${testsPassed}/${testsTotal} DIGITALMUID V4.3 INVOICE AUTHORIZATION TESTS PASSED!`);
console.log("==================================================================");
