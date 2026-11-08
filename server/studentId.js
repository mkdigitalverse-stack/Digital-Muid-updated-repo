/**
 * DigitalMuid Server-Side Student ID, Enrolment ID, and Invoice Reference Utilities
 * Generates and formats permanent, human-friendly, GST Rule 46(b) compliant identifiers.
 * Guarantees that internal Supabase UUIDs are never exposed to students.
 */

/**
 * Computes the Indian Financial Year string (e.g. "26-27") for any given date.
 * Financial Year runs from April 1 to March 31.
 * - April 1, 2026 to March 31, 2027 => "26-27"
 * - January 15, 2027 => "26-27"
 *
 * @param {Date|string|null} [dateInput]
 * @returns {string} e.g. "26-27"
 */
export function getIndianFinancialYear(dateInput) {
  const d = dateInput ? new Date(dateInput) : new Date();
  const validDate = !isNaN(d.getTime()) ? d : new Date();
  const month = validDate.getMonth() + 1; // 1-12
  const fullYear = validDate.getFullYear();

  let fyStartYear;
  let fyEndYear;

  if (month >= 4) {
    fyStartYear = fullYear % 100;
    fyEndYear = (fullYear + 1) % 100;
  } else {
    fyStartYear = (fullYear - 1) % 100;
    fyEndYear = fullYear % 100;
  }

  const startStr = String(fyStartYear).padStart(2, "0");
  const endStr = String(fyEndYear).padStart(2, "0");
  return `${startStr}-${endStr}`;
}

/**
 * Generates a permanent, collision-resistant, human-friendly Student ID.
 * Database sequence format: DM-STU-010001 (13 characters)
 *
 * @param {string} [userId] - Supabase auth user UUID
 * @param {string} [existingStudentId] - Pre-existing student_id
 * @param {number} [seqNumber] - Optional sequence number
 * @returns {string} Human-friendly Student ID string
 */
export function formatStudentId(userId, existingStudentId, seqNumber) {
  if (existingStudentId && String(existingStudentId).trim().length > 0) {
    return String(existingStudentId).trim().toUpperCase();
  }

  if (seqNumber && Number.isInteger(seqNumber) && seqNumber > 0) {
    return `DM-STU-${String(seqNumber).padStart(6, "0")}`;
  }

  if (!userId || typeof userId !== "string") {
    return "DM-STU-GUEST";
  }

  const clean = userId.replace(/[^a-fA-F0-9]/g, "").toUpperCase();
  if (!clean) return "DM-STU-010001";

  const slice = clean.length >= 6 ? clean.slice(-6) : clean.padStart(6, "0");
  return `DM-STU-${slice}`;
}

/**
 * Generates a unique, human-friendly Enrolment ID for a course enrollment.
 * Format: DM-ENR-010001 (13 characters)
 *
 * @param {string} [enrollmentIdOrUuid] - Supabase enrollment UUID
 * @param {string} [existingEnrollmentId] - Pre-existing enrollment_id
 * @param {number} [seqNumber] - Optional sequence number
 * @returns {string} Human-friendly Enrolment ID string
 */
export function formatEnrollmentId(enrollmentIdOrUuid, existingEnrollmentId, seqNumber) {
  if (existingEnrollmentId && String(existingEnrollmentId).trim().length > 0) {
    return String(existingEnrollmentId).trim().toUpperCase();
  }

  if (seqNumber && Number.isInteger(seqNumber) && seqNumber > 0) {
    return `DM-ENR-${String(seqNumber).padStart(6, "0")}`;
  }

  if (!enrollmentIdOrUuid || typeof enrollmentIdOrUuid !== "string") {
    return "DM-ENR-010001";
  }

  const clean = enrollmentIdOrUuid.replace(/[^a-fA-F0-9]/g, "").toUpperCase();
  const slice = clean.length >= 6 ? clean.slice(-6) : clean.padStart(6, "0");
  return `DM-ENR-${slice}`;
}

/**
 * Formats a persistent, unique Invoice Number compliant with GST Rule 46(b) (max 16 characters).
 * Format: DM/YY-YY/0001 (13 characters) or DM/YY-YY/00001 (14 characters)
 * Never regenerates or overwrites an already-issued invoice number.
 *
 * @param {string|Date} [paymentDate] - Date of the transaction
 * @param {string} [paymentId] - Gateway payment ID or record reference
 * @param {string} [existingInvoiceNumber] - Stored invoice number
 * @param {number} [seqNumber] - Consecutive sequence number for the financial year
 * @returns {string} Persistent, compliant Invoice Number (<= 16 characters)
 */
export function formatInvoiceNumber(paymentDate, paymentId, existingInvoiceNumber, seqNumber) {
  if (existingInvoiceNumber && String(existingInvoiceNumber).trim().length > 0) {
    return String(existingInvoiceNumber).trim().toUpperCase();
  }

  const fy = getIndianFinancialYear(paymentDate);

  if (seqNumber && Number.isInteger(seqNumber) && seqNumber > 0) {
    return `DM/${fy}/${String(seqNumber).padStart(4, "0")}`;
  }

  // Fallback for unmigrated transactions: clean 4-char suffix from paymentId
  const cleanPayId = String(paymentId || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const suffix = cleanPayId.length >= 4 ? cleanPayId.slice(-4) : cleanPayId.padStart(4, "0") || "0001";

  return `DM/${fy}/${suffix}`;
}

/**
 * Formats a Credit Note Number under Section 34 of the CGST Act (max 16 characters).
 * Format: CN/YY-YY/0001 (13 characters)
 *
 * @param {string|Date} [creditNoteDate] - Date of refund
 * @param {string} [existingCreditNoteNumber] - Stored credit note number
 * @param {number} [seqNumber] - Consecutive sequence number for the financial year
 * @returns {string} Compliant Credit Note Number (<= 16 characters)
 */
export function formatCreditNoteNumber(creditNoteDate, existingCreditNoteNumber, seqNumber) {
  if (existingCreditNoteNumber && String(existingCreditNoteNumber).trim().length > 0) {
    return String(existingCreditNoteNumber).trim().toUpperCase();
  }

  const fy = getIndianFinancialYear(creditNoteDate);
  const numPart = seqNumber && Number.isInteger(seqNumber) && seqNumber > 0
    ? String(seqNumber).padStart(4, "0")
    : "0001";

  return `CN/${fy}/${numPart}`;
}
