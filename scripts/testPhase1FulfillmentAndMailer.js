/**
 * Automated Verification Script for Phase 1:
 * Transactional Email, Invoice Generation, Calendar Invites & Deduplication
 */

import { generateAuthoritativeInvoicePdf } from "../server/invoiceService.js";
import { generateConsultationIcsBuffer } from "../server/calendarService.js";
import {
  isMailerConfigured,
  getSenderEmail,
  sendCourseAccessEmail,
  sendConsultationConfirmationEmail,
  sendResourceDeliveryEmail
} from "../server/mailerService.js";

async function runTests() {
  console.log("=== STARTING PHASE 1 VERIFICATION TESTS ===\n");
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // --- TEST 1: Invoice PDF Generation ---
  console.log("--- 1. Testing Authoritative Invoice PDF Generation ---");
  try {
    const courseInvoice = generateAuthoritativeInvoicePdf({
      paymentId: "pay_testCourse123",
      orderId: "order_testCourse123",
      customerName: "Aman Sharma",
      customerEmail: "aman@example.com",
      itemTitle: "Complete Digital Marketing Masterclass",
      itemType: "course",
      amount: 4999,
      currency: "INR"
    });

    assert(Buffer.isBuffer(courseInvoice), "Course invoice outputs a valid Buffer");
    assert(courseInvoice.toString("utf8", 0, 8).startsWith("%PDF-1.4"), "Invoice contains valid PDF-1.4 header");
    assert(courseInvoice.length > 500, `Invoice PDF has expected size (${courseInvoice.length} bytes)`);

    const consultationInvoice = generateAuthoritativeInvoicePdf({
      paymentId: "pay_testConsult123",
      orderId: "order_testConsult123",
      customerName: "Pooja Verma",
      customerEmail: "pooja@example.com",
      itemTitle: "Strategic Business Growth & Scaling Consultation",
      itemType: "consultation",
      amount: 588.82,
      currency: "INR",
      baseAmount: 499,
      gstAmount: 89.82
    });

    assert(Buffer.isBuffer(consultationInvoice), "Consultation invoice outputs a valid Buffer");
    const consultContent = consultationInvoice.toString("utf8");
    assert(consultContent.includes("SAC 998311"), "Consultation invoice includes SAC 998311 tax classification");
    assert(consultContent.includes("CGST") && consultContent.includes("SGST"), "Consultation invoice includes GST itemized breakdown");
  } catch (err) {
    assert(false, `Invoice generation threw error: ${err.message}`);
  }

  // --- TEST 2: Calendar .ICS Generation ---
  console.log("\n--- 2. Testing Calendar .ICS Invite Generation ---");
  try {
    const icsBuffer = generateConsultationIcsBuffer({
      bookingCode: "DM-2026-9999",
      bookingDate: "2026-11-15",
      bookingTime: "14:30",
      durationMinutes: 30,
      customerName: "Rahul Kapoor",
      customerEmail: "rahul@example.com",
      meetUrl: "https://meet.google.com/abc-defg-hij",
      primaryChallenge: "Meta Ads scaling & CAC reduction"
    });

    assert(Buffer.isBuffer(icsBuffer), ".ICS outputs a valid Buffer");
    const icsText = icsBuffer.toString("utf8");
    assert(icsText.includes("BEGIN:VCALENDAR"), "Contains BEGIN:VCALENDAR");
    assert(icsText.includes("BEGIN:VEVENT"), "Contains BEGIN:VEVENT");
    assert(icsText.includes("DM-2026-9999"), "Contains unique booking reference");
    assert(icsText.includes("https://meet.google.com/abc-defg-hij"), "Contains Google Meet room URL");
    assert(icsText.includes("END:VCALENDAR"), "Contains END:VCALENDAR");
  } catch (err) {
    assert(false, `.ICS generation threw error: ${err.message}`);
  }

  // --- TEST 3: Mailer Configuration & Graceful Fallback ---
  console.log("\n--- 3. Testing Mailer Configuration & Error Resilience ---");
  const sender = getSenderEmail();
  assert(sender.includes("support@digitalmuid.in"), `Sender email matches official verified domain: ${sender}`);

  // Test missing recipient email handling
  const missingEmailRes = await sendCourseAccessEmail({
    to: "",
    courseTitle: "SEO Mastery",
    amount: 1999,
    paymentId: "pay_invalid_1"
  });
  assert(missingEmailRes.success === false, "Rejects empty recipient address safely");

  const malformedEmailRes = await sendCourseAccessEmail({
    to: "not-an-email",
    courseTitle: "SEO Mastery",
    amount: 1999,
    paymentId: "pay_invalid_2"
  });
  assert(malformedEmailRes.success === false, "Rejects malformed recipient address safely");

  // --- TEST 4: Graceful Mock/Skipped Delivery when unconfigured ---
  console.log("\n--- 4. Testing Unconfigured / Fallback Behavior ---");
  const testPayId = `pay_test_${Date.now()}`;
  const unconfiguredRes = await sendCourseAccessEmail({
    to: "student@example.com",
    studentName: "Test Student",
    courseTitle: "Growth Strategy Pro",
    courseSlug: "growth-strategy-pro",
    amount: 2999,
    orderId: "order_test_99",
    paymentId: testPayId
  });

  if (!isMailerConfigured()) {
    assert(
      unconfiguredRes.skipped === true && unconfiguredRes.reason === "PROVIDER_NOT_CONFIGURED",
      "Skips delivery safely without throwing when RESEND_API_KEY is not configured"
    );
  }

  // --- TEST 5: Deduplication & Idempotency ---
  console.log("\n--- 5. Testing Idempotency & Deduplication Guard ---");
  const dedupPayId = `pay_dedup_${Date.now()}`;

  // First consultation call
  await sendConsultationConfirmationEmail({
    to: "client@example.com",
    customerName: "Dedup Client",
    bookingCode: "DM-2026-0001",
    bookingDate: "2026-11-20",
    bookingTime: "11:00",
    amount: 588.82,
    orderId: "order_dedup_01",
    paymentId: dedupPayId
  });

  // Rapid duplicate call (simulating concurrent webhook or client retry)
  const duplicateRes = await sendConsultationConfirmationEmail({
    to: "client@example.com",
    customerName: "Dedup Client",
    bookingCode: "DM-2026-0001",
    bookingDate: "2026-11-20",
    bookingTime: "11:00",
    amount: 588.82,
    orderId: "order_dedup_01",
    paymentId: dedupPayId
  });

  // Note: If skipped due to unconfigured provider, the cache records it; if already sent, returns skipped: ALREADY_SENT
  assert(
    duplicateRes.skipped === true,
    `Duplicate payment attempt correctly skipped (reason: ${duplicateRes.reason})`
  );

  console.log(`\n=== TEST RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
