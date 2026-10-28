import { enforceStagingSafety } from './safetyGuard.js';

// ==============================================================================
// FAIL-CLOSED SAFETY GUARD: PRODUCTION REJECTION & ISOLATED STAGING ENFORCEMENT
// ==============================================================================
enforceStagingSafety({
  requireTestRazorpay: false, // Live email test focuses on email sink/sandbox
  requireStagingDatabase: true,
  requireStagingWritesFlag: true
});
// ==============================================================================

/**
 * Live Email Delivery Test for Phase 1
 * Sends a real test transaction confirmation to the verified user email (mkdigitalverse@gmail.com).
 * Captures real Resend API response, provider message ID, or exact domain verification error.
 * NEVER logs API secrets.
 */

import {
  isMailerConfigured,
  getSenderEmail,
  sendCourseAccessEmail,
  sendConsultationConfirmationEmail,
  sendResourceDeliveryEmail
} from "../server/mailerService.js";

async function testLiveDelivery() {
  console.log("=== EXECUTING LIVE TRANSACTIONAL EMAIL TEST ===\n");

  const testRecipient = "mkdigitalverse@gmail.com";
  console.log(`Target Recipient: ${testRecipient}`);
  console.log(`Configured Sender: ${getSenderEmail()}`);
  console.log(`Mailer Configured: ${isMailerConfigured()}`);

  if (!isMailerConfigured()) {
    console.error("ERROR: RESEND_API_KEY is not configured or invalid.");
    process.exit(1);
  }

  const timestamp = Date.now();
  const testOrderId = `order_live_test_${timestamp}`;
  const testPaymentId = `pay_live_test_${timestamp}`;

  console.log("\n1. Testing Live Course Access Email (with authoritative PDF Tax Invoice attachment)...");
  try {
    const courseResult = await sendCourseAccessEmail({
      to: testRecipient,
      studentName: "MK Digitalverse (Admin Test)",
      courseTitle: "Executive Digital Marketing Masterclass [Test Verification]",
      courseSlug: "complete-digital-marketing-masterclass",
      amount: 4999,
      currency: "INR",
      orderId: testOrderId,
      paymentId: testPaymentId
    });

    console.log("Course Email Dispatch Result:", courseResult);
  } catch (err) {
    console.error("Course Email Exception:", err.message);
  }

  console.log("\n2. Testing Live Consultation Booking Confirmation Email (with .ICS & PDF Invoice)...");
  try {
    const consultResult = await sendConsultationConfirmationEmail({
      to: testRecipient,
      customerName: "MK Digitalverse (Client Test)",
      bookingCode: `DM-${new Date().getFullYear()}-TEST`,
      bookingDate: "2026-11-05",
      bookingTime: "15:00",
      durationMinutes: 30,
      meetUrl: "https://meet.google.com/test-live-delivery",
      primaryChallenge: "Ad spend optimization & automated sales funnel audit",
      amount: 588.82,
      currency: "INR",
      baseAmount: 499,
      gstAmount: 89.82,
      orderId: `order_consult_${timestamp}`,
      paymentId: `pay_consult_${timestamp}`
    });

    console.log("Consultation Email Dispatch Result:", consultResult);
  } catch (err) {
    console.error("Consultation Email Exception:", err.message);
  }

  console.log("\n3. Testing Live Resource Delivery Email (with PDF Invoice)...");
  try {
    const resourceResult = await sendResourceDeliveryEmail({
      to: testRecipient,
      customerName: "MK Digitalverse (Buyer Test)",
      resourceTitle: "Meta Ads 50+ High-Converting Copy Templates & Blueprint [Test]",
      resourceId: "2d50e5e3-711d-4461-a70d-0ed54dd29f17",
      amount: 499,
      currency: "INR",
      orderId: `order_res_${timestamp}`,
      paymentId: `pay_res_${timestamp}`
    });

    console.log("Resource Email Dispatch Result:", resourceResult);
  } catch (err) {
    console.error("Resource Email Exception:", err.message);
  }

  console.log("\n=== TEST COMPLETED ===");
}

testLiveDelivery().catch((err) => {
  console.error("Fatal test error:", err);
});
