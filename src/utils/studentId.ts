/**
 * DigitalMuid Student ID, Enrolment ID, and Invoice Reference Utilities
 * Generates and formats permanent, human-friendly, GST Rule 46(b) compliant identifiers.
 * Guarantees that internal Supabase UUIDs are never exposed to students.
 */

/**
 * Computes the Indian Financial Year string (e.g. "26-27") for any given date.
 * Financial Year runs from April 1 to March 31.
 * - April 1, 2026 to March 31, 2027 => "26-27"
 * - January 15, 2027 => "26-27"
 */
export function getIndianFinancialYear(dateInput?: Date | string | null): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  const validDate = !isNaN(d.getTime()) ? d : new Date();

  // Explicitly evaluate date in Asia/Kolkata (IST - UTC+05:30)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  });

  const parts = formatter.formatToParts(validDate);
  const partMap: Record<string, string> = {};
  for (const part of parts) {
    partMap[part.type] = part.value;
  }

  const month = parseInt(partMap.month, 10);
  const fullYear = parseInt(partMap.year, 10);

  let fyStartYear: number;
  let fyEndYear: number;

  if (month >= 4) {
    fyStartYear = fullYear % 100;
    fyEndYear = (fullYear + 1) % 100;
  } else {
    fyStartYear = (fullYear - 1) % 100;
    fyEndYear = fullYear % 100;
  }

  const startStr = String(fyStartYear).padStart(2, '0');
  const endStr = String(fyEndYear).padStart(2, '0');
  return `${startStr}-${endStr}`;
}

/**
 * Generates a permanent, collision-resistant, human-friendly Student ID.
 * Database sequence format: DM-STU-010001 (13 characters)
 *
 * @param userId - Supabase auth user UUID
 * @param existingStudentId - Optional pre-existing student_id from profiles table
 * @param seqNumber - Optional sequence number from DB
 * @returns Human-friendly Student ID string
 */
export function formatStudentId(
  userId?: string | null,
  existingStudentId?: string | null,
  seqNumber?: number | null
): string {
  if (existingStudentId && String(existingStudentId).trim().length > 0) {
    return String(existingStudentId).trim().toUpperCase();
  }

  if (seqNumber && Number.isInteger(seqNumber) && seqNumber > 0) {
    const numPart = seqNumber < 1000000 ? String(seqNumber).padStart(6, '0') : String(seqNumber);
    return `DM-STU-${numPart}`;
  }

  if (!userId || typeof userId !== 'string') {
    return 'DM-STU-GUEST';
  }

  const clean = userId.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
  if (!clean) return 'DM-STU-010001';

  // High-entropy 6-character hex slice (16.7 million combinations)
  // Replaces the legacy 5-digit 90,000 modulo generator to prevent collisions
  const slice = clean.length >= 6 ? clean.slice(-6) : clean.padStart(6, '0');
  return `DM-STU-${slice}`;
}

/**
 * Generates a unique, human-friendly Enrolment ID for a course enrollment.
 * Format: DM-ENR-010001 (13 characters)
 *
 * @param enrollmentIdOrUuid - Supabase enrollment UUID
 * @param existingEnrollmentId - Optional pre-existing enrollment_id
 * @param seqNumber - Optional sequence number
 * @returns Human-friendly Enrolment ID string
 */
export function formatEnrollmentId(
  enrollmentIdOrUuid?: string | null,
  existingEnrollmentId?: string | null,
  seqNumber?: number | null
): string {
  if (existingEnrollmentId && String(existingEnrollmentId).trim().length > 0) {
    return String(existingEnrollmentId).trim().toUpperCase();
  }

  if (seqNumber && Number.isInteger(seqNumber) && seqNumber > 0) {
    const numPart = seqNumber < 1000000 ? String(seqNumber).padStart(6, '0') : String(seqNumber);
    return `DM-ENR-${numPart}`;
  }

  if (!enrollmentIdOrUuid || typeof enrollmentIdOrUuid !== 'string') {
    return 'DM-ENR-010001';
  }

  const clean = enrollmentIdOrUuid.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
  const slice = clean.length >= 6 ? clean.slice(-6) : clean.padStart(6, '0');
  return `DM-ENR-${slice}`;
}

/**
 * Formats a persistent, unique Invoice Number compliant with GST Rule 46(b) (max 16 characters).
 * Format: DM/YY-YY/0001 (13 characters) or DM/YY-YY/00001 (14 characters)
 * Never regenerates or overwrites an already-issued invoice number.
 *
 * @param paymentDate - Date of the transaction
 * @param paymentId - Gateway payment ID or record reference
 * @param existingInvoiceNumber - Stored invoice number if present
 * @param seqNumber - Consecutive sequence number for the financial year
 * @returns Persistent, compliant Invoice Number (<= 16 characters)
 */
export function formatInvoiceNumber(
  paymentDate?: string | Date | null,
  paymentId?: string | null,
  existingInvoiceNumber?: string | null,
  seqNumber?: number | null
): string {
  if (existingInvoiceNumber && String(existingInvoiceNumber).trim().length > 0) {
    return String(existingInvoiceNumber).trim().toUpperCase();
  }

  const fy = getIndianFinancialYear(paymentDate);

  if (seqNumber && Number.isInteger(seqNumber) && seqNumber > 0) {
    if (seqNumber > 9999999) {
      throw new Error(`Invoice sequence overflow for financial year ${fy}: sequence ${seqNumber} exceeds 16-character limit`);
    }
    const numPart = seqNumber < 10000 ? String(seqNumber).padStart(4, '0') : String(seqNumber);
    return `DM/${fy}/${numPart}`;
  }

  // Fallback for unmigrated transactions: clean 4-char suffix from paymentId
  const cleanPayId = String(paymentId || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const suffix = cleanPayId.length >= 4 ? cleanPayId.slice(-4) : cleanPayId.padStart(4, '0') || '0001';

  return `DM/${fy}/${suffix}`;
}

/**
 * Formats a Credit Note Number under Section 34 of the CGST Act (max 16 characters).
 * Format: CN/YY-YY/0001 (13 characters) up to CN/YY-YY/9999999 (16 characters)
 *
 * @param creditNoteDate - Date of refund / credit note
 * @param existingCreditNoteNumber - Stored credit note number
 * @param seqNumber - Consecutive sequence number for the financial year
 * @returns Compliant Credit Note Number (<= 16 characters)
 */
export function formatCreditNoteNumber(
  creditNoteDate?: string | Date | null,
  existingCreditNoteNumber?: string | null,
  seqNumber?: number | null
): string {
  if (existingCreditNoteNumber && String(existingCreditNoteNumber).trim().length > 0) {
    return String(existingCreditNoteNumber).trim().toUpperCase();
  }

  const fy = getIndianFinancialYear(creditNoteDate);
  if (seqNumber && Number.isInteger(seqNumber) && seqNumber > 0) {
    if (seqNumber > 9999999) {
      throw new Error(`Credit note sequence overflow for financial year ${fy}: sequence ${seqNumber} exceeds 16-character limit`);
    }
    const numPart = seqNumber < 10000 ? String(seqNumber).padStart(4, '0') : String(seqNumber);
    return `CN/${fy}/${numPart}`;
  }

  return `CN/${fy}/0001`;
}
