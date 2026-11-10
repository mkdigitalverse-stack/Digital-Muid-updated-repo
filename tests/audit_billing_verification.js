/**
 * Comprehensive Automated Verification Suite
 * Tests all 10 priority audit and security requirements for DigitalMuid Student Billing System
 */

import assert from "node:assert";
import fs from "node:fs";
import {
  formatInvoiceNumber,
  formatCreditNoteNumber,
  formatStudentId,
  formatEnrollmentId,
  getIndianFinancialYear
} from "../server/studentId.js";
import {
  determinePlaceOfSupply,
  buildAuthoritativeInvoiceModel,
  buildAuthoritativeCreditNoteModel,
  generateAuthoritativeInvoicePdf,
  generateAuthoritativeCreditNotePdf,
  INDIAN_GST_STATE_CODES
} from "../server/invoiceService.js";

console.log("==================================================================");
console.log("RUNNING FINAL PRE-DEPLOYMENT SECURITY & BILLING AUDIT TEST SUITE");
console.log("==================================================================");

let testsPassed = 0;
let testsTotal = 0;

function runTest(name, fn) {
  testsTotal++;
  try {
    fn();
    testsPassed++;
    console.log(`[PASS] ${name}`);
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    throw err;
  }
}

// -----------------------------------------------------------------------------
// Test 1: Financial Year & 16-Character Serial Constraint
// -----------------------------------------------------------------------------
runTest("Financial Year calculation matches Indian Fiscal Year (April-March)", () => {
  assert.strictEqual(getIndianFinancialYear("2026-04-01"), "26-27");
  assert.strictEqual(getIndianFinancialYear("2026-11-08"), "26-27");
  assert.strictEqual(getIndianFinancialYear("2027-01-15"), "26-27");
  assert.strictEqual(getIndianFinancialYear("2027-03-31"), "26-27");
  assert.strictEqual(getIndianFinancialYear("2027-04-01"), "27-28");
});

// -----------------------------------------------------------------------------
// Test 2: Sequence Boundaries, LPAD Fix, and Overflow Protection (GST Rule 46)
// -----------------------------------------------------------------------------
runTest("Invoice number sequence boundaries and non-truncation up to 9,999,999", () => {
  const d = "2026-11-08";
  
  // Seq 1 (4 digits with zero-padding) -> 13 chars
  const inv1 = formatInvoiceNumber(d, "pay_1", null, 1);
  assert.strictEqual(inv1, "DM/26-27/0001");
  assert.strictEqual(inv1.length, 13);
  assert.ok(inv1.length <= 16);

  // Seq 9999 -> 13 chars
  const inv9999 = formatInvoiceNumber(d, "pay_1", null, 9999);
  assert.strictEqual(inv9999, "DM/26-27/9999");
  assert.strictEqual(inv9999.length, 13);
  assert.ok(inv9999.length <= 16);

  // Seq 10000 (no truncation to 1000!) -> 14 chars
  const inv10000 = formatInvoiceNumber(d, "pay_1", null, 10000);
  assert.strictEqual(inv10000, "DM/26-27/10000");
  assert.strictEqual(inv10000.length, 14);
  assert.ok(inv10000.length <= 16);

  // Seq 999999 -> 15 chars
  const inv999999 = formatInvoiceNumber(d, "pay_1", null, 999999);
  assert.strictEqual(inv999999, "DM/26-27/999999");
  assert.strictEqual(inv999999.length, 15);
  assert.ok(inv999999.length <= 16);

  // Seq 9999999 (Maximum permissible within 16-char limit: 3 + 5 + 1 + 7 = 16)
  const invMax = formatInvoiceNumber(d, "pay_1", null, 9999999);
  assert.strictEqual(invMax, "DM/26-27/9999999");
  assert.strictEqual(invMax.length, 16);
  assert.ok(invMax.length <= 16);

  // Sequence overflow: sequence 10,000,000 would be 17 chars and must throw
  assert.throws(() => {
    formatInvoiceNumber(d, "pay_1", null, 10000000);
  }, /sequence 10000000 exceeds 16-character limit/);
});

runTest("Credit note sequence boundaries and non-truncation up to 9,999,999", () => {
  const d = "2026-11-08";
  const cn1 = formatCreditNoteNumber(d, null, 1);
  assert.strictEqual(cn1, "CN/26-27/0001");
  assert.strictEqual(cn1.length, 13);
  assert.ok(cn1.length <= 16);

  const cn10000 = formatCreditNoteNumber(d, null, 10000);
  assert.strictEqual(cn10000, "CN/26-27/10000");
  assert.strictEqual(cn10000.length, 14);
  assert.ok(cn10000.length <= 16);

  const cnMax = formatCreditNoteNumber(d, null, 9999999);
  assert.strictEqual(cnMax, "CN/26-27/9999999");
  assert.strictEqual(cnMax.length, 16);

  assert.throws(() => {
    formatCreditNoteNumber(d, null, 10000000);
  }, /sequence 10000000 exceeds 16-character limit/);
});

// -----------------------------------------------------------------------------
// Test 3: Preservation of Pre-Existing Historical Invoice Numbers
// -----------------------------------------------------------------------------
runTest("Never regenerates or overwrites existing invoice numbers", () => {
  const legacyInv = "DM-INV-202611-00042";
  const formatted = formatInvoiceNumber("2026-11-08", "pay_xyz", legacyInv, 99);
  assert.strictEqual(formatted, legacyInv);

  const existingStandard = "DM/26-27/0005";
  const formattedStandard = formatInvoiceNumber("2026-11-08", "pay_xyz", existingStandard, 100);
  assert.strictEqual(formattedStandard, existingStandard);
});

// -----------------------------------------------------------------------------
// Test 4: Student ID & Enrolment ID Generation (No UUID Exposure)
// -----------------------------------------------------------------------------
runTest("Student ID and Enrolment ID generate 13-character human-friendly strings", () => {
  const rawUuid = "e0b1c2d3-4e5f-6a7b-8c9d-0e1f2a3b4c5d";
  const studentIdSeq = formatStudentId(rawUuid, null, 10042);
  assert.strictEqual(studentIdSeq, "DM-STU-010042");
  assert.strictEqual(studentIdSeq.length, 13);
  assert.ok(!studentIdSeq.includes(rawUuid));

  const enrollmentIdSeq = formatEnrollmentId(rawUuid, null, 10042);
  assert.strictEqual(enrollmentIdSeq, "DM-ENR-010042");
  assert.strictEqual(enrollmentIdSeq.length, 13);
  assert.ok(!enrollmentIdSeq.includes(rawUuid));

  // Fallback hex slice (high entropy, preserves existing valid IDs)
  const studentIdHex = formatStudentId(rawUuid, null, null);
  assert.strictEqual(studentIdHex, "DM-STU-3B4C5D");
  assert.strictEqual(studentIdHex.length, 13);
});

// -----------------------------------------------------------------------------
// Test 5: Multi-Signal Place of Supply Evaluation (Sections 12 & 13 IGST Act)
// -----------------------------------------------------------------------------
runTest("Place of Supply accurately distinguishes Intra-state, Inter-state, and Export", () => {
  // Scenario A: Recipient in Uttar Pradesh (Intra-state Supply: CGST 9% + SGST 9%)
  const posUP = determinePlaceOfSupply({ state: "Uttar Pradesh", billingAddress: "Hazratganj, Lucknow" });
  assert.strictEqual(posUP.stateCode, "09");
  assert.strictEqual(posUP.isInterState, false);

  const invoiceUP = buildAuthoritativeInvoiceModel({
    amount: 1180,
    customerState: "Uttar Pradesh",
    billingAddress: "Lucknow, UP"
  });
  assert.strictEqual(invoiceUP.payment.isInterState, false);
  assert.strictEqual(invoiceUP.payment.cgstAmount, 90);
  assert.strictEqual(invoiceUP.payment.sgstAmount, 90);
  assert.strictEqual(invoiceUP.payment.igstAmount, 0);
  assert.strictEqual(invoiceUP.payment.baseAmount, 1000);

  // Scenario B: Recipient in Maharashtra (Inter-state Supply: IGST 18%)
  const posMH = determinePlaceOfSupply({ state: "Maharashtra", billingAddress: "Andheri, Mumbai" });
  assert.strictEqual(posMH.stateCode, "27");
  assert.strictEqual(posMH.isInterState, true);

  const invoiceMH = buildAuthoritativeInvoiceModel({
    amount: 1180,
    customerState: "Maharashtra",
    billingAddress: "Mumbai, MH"
  });
  assert.strictEqual(invoiceMH.payment.isInterState, true);
  assert.strictEqual(invoiceMH.payment.cgstAmount, 0);
  assert.strictEqual(invoiceMH.payment.sgstAmount, 0);
  assert.strictEqual(invoiceMH.payment.igstAmount, 180);
  assert.strictEqual(invoiceMH.payment.baseAmount, 1000);

  // Scenario C: B2B Registered GSTIN from Karnataka (29ABCDE1234F1Z5)
  const posB2B = determinePlaceOfSupply({ customerGstin: "29ABCDE1234F1Z5" });
  assert.strictEqual(posB2B.stateCode, "29");
  assert.strictEqual(posB2B.isInterState, true);

  // Scenario D: Overseas without verified LUT -> Subject to 18% IGST under Section 7(5)(a)
  const posOverseasNoLut = determinePlaceOfSupply({ country: "United States", currency: "USD", isExportWithLut: false }, "USD");
  assert.strictEqual(posOverseasNoLut.isOverseas, true);
  assert.strictEqual(posOverseasNoLut.isExportWithLut, false);
  assert.strictEqual(posOverseasNoLut.isInterState, true);

  const invoiceOverseasNoLut = buildAuthoritativeInvoiceModel({
    amount: 118,
    currency: "USD",
    country: "USA",
    isExportWithLut: false
  });
  assert.strictEqual(invoiceOverseasNoLut.payment.igstAmount, 18);
  assert.strictEqual(invoiceOverseasNoLut.payment.baseAmount, 100);

  // Scenario E: Overseas with verified LUT (Form GST RFD-11) -> 0% GST
  const posOverseasLut = determinePlaceOfSupply({ country: "USA", currency: "USD", isExportWithLut: true }, "USD");
  assert.strictEqual(posOverseasLut.isOverseas, true);
  assert.strictEqual(posOverseasLut.isExportWithLut, true);

  const invoiceOverseasLut = buildAuthoritativeInvoiceModel({
    amount: 100,
    currency: "USD",
    country: "USA",
    isExportWithLut: true
  });
  assert.strictEqual(invoiceOverseasLut.payment.gstAmount, 0);
  assert.strictEqual(invoiceOverseasLut.payment.baseAmount, 100);

  // Scenario F: Recipient State completely unstated
  const posUnstated = determinePlaceOfSupply({});
  assert.strictEqual(posUnstated.isInterState, true);
  assert.strictEqual(posUnstated.stateCode, "99");
});

// -----------------------------------------------------------------------------
// Test 6: Section 34 CGST Act Credit Notes (Refund Tax Adjustments)
// -----------------------------------------------------------------------------
runTest("Credit note accurately calculates tax adjustments mirroring original invoice", () => {
  // Refund for an Intra-state UP transaction
  const cnUP = buildAuthoritativeCreditNoteModel({
    amount: 1180,
    customerState: "Uttar Pradesh",
    invoiceNumber: "DM/26-27/0001",
    creditNoteNumber: "CN/26-27/0001",
    refundId: "rfnd_test123"
  });
  assert.strictEqual(cnUP.creditNoteNumber, "CN/26-27/0001");
  assert.strictEqual(cnUP.originalInvoiceNumber, "DM/26-27/0001");
  assert.strictEqual(cnUP.refundAmount, 1180);
  assert.strictEqual(cnUP.baseRefundAmount, 1000);
  assert.strictEqual(cnUP.cgstAdjustmentAmount, 90);
  assert.strictEqual(cnUP.sgstAdjustmentAmount, 90);
  assert.strictEqual(cnUP.igstAdjustmentAmount, 0);

  // Refund for an Inter-state transaction
  const cnInterState = buildAuthoritativeCreditNoteModel({
    amount: 1180,
    customerState: "Maharashtra",
    invoiceNumber: "DM/26-27/0002",
    creditNoteNumber: "CN/26-27/0002",
    refundId: "rfnd_test456"
  });
  assert.strictEqual(cnInterState.cgstAdjustmentAmount, 0);
  assert.strictEqual(cnInterState.sgstAdjustmentAmount, 0);
  assert.strictEqual(cnInterState.igstAdjustmentAmount, 180);
});

// -----------------------------------------------------------------------------
// Test 7: PDF Generation (Valid Headers, Footers, and Size)
// -----------------------------------------------------------------------------
runTest("PDF invoice and credit note generation returns valid PDF 1.4 Buffers", () => {
  const invModel = buildAuthoritativeInvoiceModel({
    amount: 1499,
    customerName: "Mohd Muid",
    customerEmail: "student@example.com",
    customerPhone: "+91 93358 17155",
    customerState: "Uttar Pradesh",
    itemTitle: "Digital Marketing Mastery Course",
    paymentId: "pay_TEST12345",
    invoiceNumber: "DM/26-27/0001"
  });

  const invPdf = generateAuthoritativeInvoicePdf(invModel);
  assert.ok(Buffer.isBuffer(invPdf));
  assert.ok(invPdf.length > 1000);
  const invHeader = invPdf.subarray(0, 8).toString("utf8");
  assert.ok(invHeader.startsWith("%PDF-1.4"));

  const cnModel = buildAuthoritativeCreditNoteModel({
    amount: 1499,
    customerName: "Mohd Muid",
    customerEmail: "student@example.com",
    invoiceNumber: "DM/26-27/0001",
    creditNoteNumber: "CN/26-27/0001"
  });

  const cnPdf = generateAuthoritativeCreditNotePdf(cnModel);
  assert.ok(Buffer.isBuffer(cnPdf));
  assert.ok(cnPdf.length > 1000);
  const cnHeader = cnPdf.subarray(0, 8).toString("utf8");
  assert.ok(cnHeader.startsWith("%PDF-1.4"));
});

// -----------------------------------------------------------------------------
// Test 8: SQL Migration File Security & Structural Audit
// -----------------------------------------------------------------------------
runTest("SQL migration contains all mandatory security and integrity protections", () => {
  const migrationPath = "supabase/migrations/20261107000001_student_id_and_invoices.sql";
  assert.ok(fs.existsSync(migrationPath), "Migration file must exist");
  const sql = fs.readFileSync(migrationPath, "utf8");

  // 1. Transaction wrapping
  assert.ok(sql.includes("BEGIN;"), "Must be wrapped in transaction BEGIN");
  assert.ok(sql.includes("COMMIT;"), "Must be wrapped in transaction COMMIT");

  // 2. SECURITY DEFINER with fixed search_path
  assert.ok(sql.includes("SECURITY DEFINER"), "Functions must declare SECURITY DEFINER");
  assert.ok(sql.includes("SET search_path = public, pg_temp"), "Must enforce search_path = public, pg_temp");

  // 3. Revoke permissions from PUBLIC, anon, authenticated
  assert.ok(sql.includes("REVOKE ALL ON FUNCTION public.get_next_invoice_number(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;"), "Must revoke invoice function from public");
  assert.ok(sql.includes("REVOKE ALL ON FUNCTION public.get_next_credit_note_number(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;"), "Must revoke credit note function from public");
  assert.ok(sql.includes("GRANT EXECUTE ON FUNCTION public.get_next_invoice_number(TIMESTAMPTZ) TO service_role, postgres;"), "Must grant invoice function to service_role");

  // 4. LPAD truncation bug fix
  assert.ok(sql.includes("IF v_seq < 10000 THEN"), "Must handle 4-digit padding without truncating sequences >= 10000");
  assert.ok(sql.includes("v_seq_str := v_seq::TEXT;"), "Must use raw text for sequences >= 10000");

  // 5. Sequence exhaustion boundary check
  assert.ok(sql.includes("IF v_seq > 9999999 THEN"), "Must protect against sequence overflow beyond 16 chars");

  // 6. Historical invoice reconciliation
  assert.ok(sql.includes("SUBSTRING(invoice_number FROM '^DM/([0-9]{2}-[0-9]{2})/[0-9]+$')"), "Must inspect historical invoice sequences");
  assert.ok(sql.includes("GREATEST(public.invoice_series.last_sequence, r.max_seq)"), "Must align series to max existing sequence");

  // 7. Deduplication before unique index
  assert.ok(sql.includes("GROUP BY student_id HAVING COUNT(*) > 1"), "Must deduplicate profiles before index");
  assert.ok(sql.includes("CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_student_id"), "Must create safe unique index for student_id");

  // 8. Payment trigger guards
  assert.ok(sql.includes("IF NEW.status IN ('refunded', 'failed', 'cancelled', 'pending') THEN"), "Must block invoices for refunded/unverified payments");
  assert.ok(sql.includes("NEW.invoice_number := OLD.invoice_number;"), "Must permanently lock pre-existing invoice numbers");
});

console.log("==================================================================");
console.log(`ALL ${testsPassed}/${testsTotal} AUDIT TESTS PASSED SUCCESSFULLY!`);
console.log("==================================================================");
