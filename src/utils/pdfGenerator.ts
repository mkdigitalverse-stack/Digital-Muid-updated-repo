/**
 * Generates a clean, valid PDF 1.4 binary Blob for any Digital Muid resource.
 * This guarantees visitors always receive a real, downloadable, openable PDF file
 * even if third-party storage buckets are not configured or offline.
 */
export function generateResourcePdfBlob(resource: {
  title?: string;
  name?: string;
  author?: string;
  category?: string;
  resourceType?: string;
  description?: string;
  readingTimeMinutes?: number;
  previewPoints?: string[];
  whatIsIncluded?: string[];
}): Blob {
  const title = (resource.title || resource.name || 'Digital Muid Resource Guide').replace(/[()\\]/g, '');
  const author = (resource.author || 'Digital Muid').replace(/[()\\]/g, '');
  const category = (resource.category || 'Digital Growth Strategy').replace(/[()\\]/g, '');
  const type = (resource.resourceType || 'Executive Toolkit').replace(/[()\\]/g, '');
  const desc = (resource.description || 'Actionable frameworks and blueprints for modern business growth.').replace(/[()\\]/g, '');

  const points = (resource.previewPoints && resource.previewPoints.length > 0
    ? resource.previewPoints
    : [
        'Strategic Architecture: High-impact roadmap for scalable digital acquisition.',
        'Execution Matrix: Weekly sprint cadence and milestone tracking.',
        'Optimization Levers: Key conversion rate and retention benchmarks.',
        'Tooling & Automation: Tech stack recommendations for lean teams.'
      ]
  ).map((p) => p.replace(/[()\\]/g, ''));

  // Simple, compliant PDF 1.4 document stream
  const contentStream = `
BT
/F1 22 Tf
50 740 Td
(${title}) Tj
ET

BT
/F1 12 Tf
50 710 Td
(${type} | Category: ${category} | Author: ${author}) Tj
ET

BT
/F2 10 Tf
50 675 Td
(Published by Digital Muid - Strategic Digital Growth & AI Advisory) Tj
ET

BT
/F1 14 Tf
50 630 Td
(Executive Overview) Tj
ET

BT
/F2 10 Tf
50 605 Td
(${desc.substring(0, 100)}) Tj
ET

BT
/F1 14 Tf
50 560 Td
(What is Included in this Asset:) Tj
ET

${points
  .slice(0, 5)
  .map((pt, idx) => {
    const y = 530 - idx * 28;
    return `
BT
/F2 10 Tf
50 ${y} Td
([*] ${pt.substring(0, 95)}) Tj
ET`;
  })
  .join('\n')}

BT
/F2 9 Tf
50 120 Td
(Access verified via Digital Muid Lead Magnet System - https://digitalmuid.in) Tj
50 105 Td
(Confidential & Proprietary - For registered recipient use only.) Tj
ET
`;

  const streamLength = typeof TextEncoder !== 'undefined'
    ? new TextEncoder().encode(contentStream).length
    : (typeof Buffer !== 'undefined' ? Buffer.byteLength(contentStream, 'utf8') : contentStream.length);

  const pdfBody = `%PDF-1.4
%âãÏÓ
1 0 obj
<<
  /Type /Catalog
  /Pages 2 0 R
>>
endobj

2 0 obj
<<
  /Type /Pages
  /Kids [3 0 R]
  /Count 1
>>
endobj

3 0 obj
<<
  /Type /Page
  /Parent 2 0 R
  /MediaBox [0 0 595 842]
  /Contents 4 0 R
  /Resources <<
    /Font <<
      /F1 <<
        /Type /Font
        /Subtype /Type1
        /BaseFont /Helvetica-Bold
      >>
      /F2 <<
        /Type /Font
        /Subtype /Type1
        /BaseFont /Helvetica
      >>
    >>
  >>
>>
endobj

4 0 obj
<<
  /Length ${streamLength}
>>
stream
${contentStream}
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000015 00000 n 
0000000068 00000 n 
0000000125 00000 n 
0000000340 00000 n 
trailer
<<
  /Size 5
  /Root 1 0 R
>>
startxref
${450 + streamLength}
%%EOF`;

  return new Blob([pdfBody], { type: 'application/pdf' });
}

export interface CertificatePdfData {
  certificateNumber: string;
  recipientName: string;
  courseTitle: string;
  issuedAt: string;
  verificationHash: string;
  instructorName?: string;
  courseDuration?: string;
  verificationUrl?: string;
}

/**
 * Generates an official, elegant, high-contrast PDF 1.4 binary Blob for
 * Digital Muid Course Certificates of Completion (Landscape A4: 842 x 595).
 */
export function generateCertificatePdfBlob(cert: CertificatePdfData): Blob {
  const sanitize = (text: string) => (text || '').replace(/[()\\]/g, '');

  const recipient = sanitize(cert.recipientName || 'Valued Student');
  const course = sanitize(cert.courseTitle || 'Masterclass');
  const certNumber = sanitize(cert.certificateNumber || 'DM-CERT-2026');
  const verifyCode = sanitize(cert.verificationHash || '');
  const instructor = sanitize(cert.instructorName || 'Digital Muid');

  // Format date nicely
  let formattedDate = 'September 2026';
  try {
    const d = new Date(cert.issuedAt);
    if (!isNaN(d.getTime())) {
      formattedDate = d.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
    }
  } catch {
    formattedDate = sanitize(cert.issuedAt);
  }

  // Landscape A4 content stream
  const contentStream = `
% Outer Decorative Border
0.1 0.15 0.25 RG
2.5 w
35 30 772 535 re S

% Inner Gold Frame
0.75 0.6 0.2 RG
1.0 w
42 37 758 521 re S

% Corner Accent Blocks
0.75 0.6 0.2 rg
42 548 10 10 re f
790 548 10 10 re f
42 37 10 10 re f
790 37 10 10 re f

% Academy Header
BT
/F1 12 Tf
0.75 0.6 0.2 rg
290 515 Td
(DIGITAL MUID ACADEMY) Tj
ET

% Certificate Title
BT
/F1 28 Tf
0.05 0.1 0.2 rg
195 465 Td
(CERTIFICATE OF COMPLETION) Tj
ET

% Subtitle
BT
/F2 11 Tf
0.35 0.4 0.45 rg
255 435 Td
(EXECUTIVE MASTERCLASS & STRATEGIC ADVISORY) Tj
ET

% Divider line
0.75 0.6 0.2 RG
1.5 w
300 415 m 542 415 l S

% Presentation Text
BT
/F2 12 Tf
0.3 0.35 0.4 rg
320 385 Td
(This certifies that) Tj
ET

% Recipient Name
BT
/F1 24 Tf
0.05 0.1 0.2 rg
220 340 Td
(${recipient}) Tj
ET

% Body Confirmation Text
BT
/F2 12 Tf
0.3 0.35 0.4 rg
140 295 Td
(has successfully satisfied all rigorous curriculum requirements and projects for:) Tj
ET

% Course Title
BT
/F1 20 Tf
0.1 0.4 0.25 rg
160 255 Td
(${course}) Tj
ET

% Bottom Info Row
BT
/F1 10 Tf
0.1 0.15 0.25 rg
70 140 Td
(DATE OF ISSUANCE:) Tj
ET

BT
/F2 10 Tf
0.3 0.35 0.4 rg
70 120 Td
(${formattedDate}) Tj
ET

BT
/F1 10 Tf
0.1 0.15 0.25 rg
290 140 Td
(CREDENTIAL ID:) Tj
ET

BT
/F2 10 Tf
0.3 0.35 0.4 rg
290 120 Td
(${certNumber}) Tj
ET

BT
/F1 10 Tf
0.1 0.15 0.25 rg
490 140 Td
(VERIFICATION CODE:) Tj
ET

BT
/F2 10 Tf
0.3 0.35 0.4 rg
490 120 Td
(${verifyCode}) Tj
ET

% Signatory Signature Area
0.75 0.6 0.2 RG
1.0 w
640 135 m 770 135 l S

BT
/F1 11 Tf
0.05 0.1 0.2 rg
665 118 Td
(${instructor}) Tj
ET

BT
/F2 9 Tf
0.4 0.45 0.5 rg
640 102 Td
(Founder & Lead Instructor) Tj
ET

% Official Verification Notice
BT
/F2 8 Tf
0.45 0.5 0.55 rg
230 65 Td
(Verified authentic credential. Authenticity can be verified at digitalmuid.com/verify) Tj
ET
`;

  const streamLength = contentStream.length;

  const pdfBody = `%PDF-1.4
1 0 obj
<<
  /Type /Catalog
  /Pages 2 0 R
>>
endobj

2 0 obj
<<
  /Type /Pages
  /Kids [3 0 R]
  /Count 1
>>
endobj

3 0 obj
<<
  /Type /Page
  /Parent 2 0 R
  /MediaBox [0 0 842 595]
  /Contents 4 0 R
  /Resources <<
    /Font <<
      /F1 <<
        /Type /Font
        /Subtype /Type1
        /BaseFont /Helvetica-Bold
      >>
      /F2 <<
        /Type /Font
        /Subtype /Type1
        /BaseFont /Helvetica
      >>
    >>
  >>
>>
endobj

4 0 obj
<<
  /Length ${streamLength}
>>
stream
${contentStream}
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000015 00000 n 
0000000068 00000 n 
0000000125 00000 n 
0000000340 00000 n 
trailer
<<
  /Size 5
  /Root 1 0 R
>>
startxref
${450 + streamLength}
%%EOF`;

  return new Blob([pdfBody], { type: 'application/pdf' });
}

/**
 * Triggers a direct browser download of the certificate PDF.
 */
export function downloadCertificatePdf(cert: CertificatePdfData, fileName?: string): void {
  const blob = generateCertificatePdfBlob(cert);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeName = (fileName || `DigitalMuid-Certificate-${cert.certificateNumber || 'Verified'}`).replace(/[^a-zA-Z0-9_-]/g, '_');
  link.download = `${safeName}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

import { formatStudentId, formatEnrollmentId, formatInvoiceNumber, formatCreditNoteNumber } from './studentId';

export interface InvoicePdfData {
  paymentId: string;
  orderId?: string | null;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerState?: string;
  userId?: string;
  studentId?: string;
  enrollmentId?: string;
  itemTitle: string;
  itemType: 'course' | 'consultation' | 'subscription' | 'resource' | string;
  amount: number;
  currency: string;
  paymentDate: string;
  status: string;
  invoiceNumber?: string;
  invoiceUrl?: string | null;
}

export interface CreditNotePdfData {
  creditNoteNumber?: string;
  originalInvoiceNumber: string;
  creditNoteDate: string;
  reason?: string;
  refundId?: string | null;
  paymentId: string;
  customerName?: string;
  customerEmail?: string;
  studentId?: string;
  refundAmount: number;
  currency: string;
}

/**
 * Generates an official, clean, tax-compliant PDF 1.4 binary Blob for
 * DigitalMuid / MK Digitalverse Invoices (Portrait A4: 595 x 842).
 * Strictly renders verified seller data and student ID (internal UUID is never exposed).
 */
export function generateInvoicePdfBlob(data: InvoicePdfData): Blob {
  const sanitize = (text: string) => (text || '').replace(/[()\\]/g, '');

  const paymentId = sanitize(data.paymentId || 'PAY-REF');
  const orderId = sanitize(data.orderId || 'N/A');
  const customerName = sanitize(data.customerName || 'Valued Student');
  const customerEmail = sanitize(data.customerEmail || 'Registered Account');
  const customerPhone = sanitize(data.customerPhone || 'N/A');
  const studentId = sanitize(formatStudentId(data.userId, data.studentId));
  const enrollmentId = data.enrollmentId ? sanitize(formatEnrollmentId(data.enrollmentId)) : '';
  const itemTitle = sanitize(data.itemTitle || 'Digital Educational Service');
  const itemType = sanitize(
    data.itemType === 'course'
      ? 'Executive Masterclass'
      : data.itemType === 'consultation'
      ? 'Strategic Consultation'
      : data.itemType === 'resource'
      ? 'Digital Resource Toolkit'
      : data.itemType
  );
  const currency = sanitize(data.currency || 'INR');
  const status = sanitize((data.status || 'captured').toUpperCase());

  const sacCode = data.itemType === 'consultation' ? '998311' : '999293';

  // Format currency amount safely
  const totalAmount = data.amount || 0;
  const baseAmount = Number((totalAmount / 1.18).toFixed(2));
  const gstAmount = Number((totalAmount - baseAmount).toFixed(2));
  const halfGst = Number((gstAmount / 2).toFixed(2));

  let formattedTotal = '0.00';
  let formattedBase = '0.00';
  let formattedGst = '0.00';
  try {
    formattedTotal = totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    formattedBase = baseAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    formattedGst = halfGst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } catch {
    formattedTotal = String(totalAmount);
    formattedBase = String(baseAmount);
    formattedGst = String(halfGst);
  }

  // Format payment date safely
  let formattedDate = 'Recent';
  try {
    const d = new Date(data.paymentDate);
    if (!isNaN(d.getTime())) {
      formattedDate = d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    }
  } catch {
    formattedDate = sanitize(data.paymentDate);
  }

  const invoiceNumber = sanitize(formatInvoiceNumber(data.paymentDate, data.paymentId, data.invoiceNumber));

  // Portrait A4 (595 x 842) content stream
  const contentStream = `
% Top Accent Header Bar
0.05 0.08 0.15 rg
0 732 595 110 re f

% Orange Brand Accent Line
1.0 0.42 0.0 RG
3.0 w
0 732 595 0 m 595 732 l S

% Header Branding (Verified Seller Details)
BT
/F1 18 Tf
1 1 1 rg
45 802 Td
(MK DIGITALVERSE) Tj
ET

BT
/F2 9.5 Tf
0.9 0.92 0.96 rg
45 786 Td
(Brand: DigitalMuid  |  GSTIN: 09CHHPK9834Q1ZB) Tj
ET

BT
/F2 8.5 Tf
0.75 0.8 0.88 rg
45 772 Td
(Business Address: Lucknow, India  |  Coverage: Serving Globally) Tj
ET

BT
/F2 8.5 Tf
0.75 0.8 0.88 rg
45 758 Td
(https://digitalmuid.in  |  support@digitalmuid.in) Tj
ET

% Invoice Title on Right
BT
/F1 15 Tf
1.0 0.42 0.0 rg
390 802 Td
(TAX INVOICE) Tj
ET

BT
/F1 9 Tf
1 1 1 rg
390 786 Td
(Invoice No: ${invoiceNumber}) Tj
ET

BT
/F2 8.5 Tf
0.8 0.85 0.9 rg
390 772 Td
(Date: ${formattedDate}) Tj
ET

BT
/F2 8.5 Tf
0.8 0.85 0.9 rg
390 758 Td
(Payment Status: ${status}) Tj
ET

% Billed To & Reference Box
0.97 0.98 0.99 rg
45 628 505 88 re f
0.85 0.88 0.92 RG
0.8 w
45 628 505 88 re S

BT
/F1 9.5 Tf
0.1 0.15 0.25 rg
60 698 Td
(BILLED TO (STUDENT):) Tj
ET

BT
/F1 11 Tf
0.05 0.1 0.2 rg
60 682 Td
(${customerName.substring(0, 36)}) Tj
ET

BT
/F1 9 Tf
0.14 0.34 0.84 rg
60 666 Td
(Student ID: ${studentId}) Tj
ET

BT
/F2 8.5 Tf
0.35 0.4 0.45 rg
60 650 Td
(Email: ${customerEmail}  |  Phone: ${customerPhone}) Tj
ET

% Reference Details
BT
/F1 9.5 Tf
0.1 0.15 0.25 rg
330 698 Td
(TRANSACTION REFERENCE:) Tj
ET

BT
/F2 8.5 Tf
0.3 0.35 0.45 rg
330 682 Td
(Gateway: Razorpay Electronic Settlement) Tj
330 666 Td
(Payment ID: ${paymentId.substring(0, 24)}) Tj
330 650 Td
(Order ID: ${orderId.substring(0, 24)}) Tj
ET

% Itemized Table Header
0.1 0.15 0.25 rg
45 588 505 24 re f

BT
/F1 8.5 Tf
1 1 1 rg
55 596 Td
(DESCRIPTION) Tj
260 596 Td
(SAC / HSN) Tj
345 596 Td
(CATEGORY) Tj
415 596 Td
(QTY) Tj
475 596 Td
(AMOUNT) Tj
ET

% Item Row
0.99 0.99 1.0 rg
45 532 505 56 re f
0.88 0.9 0.94 RG
0.5 w
45 532 505 56 re S

BT
/F1 9.5 Tf
0.1 0.15 0.25 rg
55 568 Td
(${itemTitle.substring(0, 40)}) Tj
ET

${enrollmentId ? `
BT
/F1 8 Tf
1.0 0.42 0.0 rg
55 554 Td
(Enrolment ID: ${enrollmentId}) Tj
ET
` : `
BT
/F2 8 Tf
0.4 0.45 0.5 rg
55 554 Td
(Verified Student Digital Access Activated) Tj
ET
`}

BT
/F2 8.5 Tf
0.25 0.3 0.4 rg
260 560 Td
(${sacCode}) Tj
345 560 Td
(${itemType.substring(0, 16)}) Tj
420 560 Td
(1) Tj
ET

BT
/F1 10 Tf
0.1 0.15 0.25 rg
470 560 Td
(${currency} ${formattedBase}) Tj
ET

% Summary Box on Right
0.96 0.97 0.98 rg
310 395 240 122 re f
0.85 0.88 0.92 RG
0.8 w
310 395 240 122 re S

BT
/F2 8.5 Tf
0.35 0.4 0.45 rg
325 496 Td
(Taxable Base Value:) Tj
325 478 Td
(Central GST (CGST 9%):) Tj
325 460 Td
(State GST (SGST 9%):) Tj
ET

BT
/F2 8.5 Tf
0.15 0.2 0.3 rg
465 496 Td
(${currency} ${formattedBase}) Tj
465 478 Td
(${currency} ${formattedGst}) Tj
465 460 Td
(${currency} ${formattedGst}) Tj
ET

% Total Line
1.0 0.42 0.0 RG
1.0 w
320 445 220 0 m 540 445 l S

BT
/F1 10.5 Tf
0.05 0.08 0.15 rg
325 422 Td
(Total Paid (Net):) Tj
ET

BT
/F1 12 Tf
0.05 0.55 0.3 rg
455 422 Td
(${currency} ${formattedTotal}) Tj
ET

BT
/F2 7.5 Tf
0.4 0.45 0.5 rg
325 404 Td
((Inclusive of 18% GST taxes)) Tj
ET

% Left Verification Badge
0.93 0.97 0.94 rg
45 395 250 122 re f
0.3 0.7 0.4 RG
0.8 w
45 395 250 122 re S

BT
/F1 9.5 Tf
0.05 0.5 0.25 rg
60 496 Td
([VERIFIED AUTHORITATIVE INVOICE]) Tj
ET

BT
/F2 8 Tf
0.15 0.3 0.2 rg
60 478 Td
(Issued by: MK Digitalverse (Brand: DigitalMuid)) Tj
60 462 Td
(GSTIN: 09CHHPK9834Q1ZB | State: UP (09)) Tj
60 446 Td
(Place of Supply: Lucknow, Uttar Pradesh, India) Tj
60 430 Td
(Student ID: ${studentId}) Tj
60 414 Td
(Electronic Gateway: Razorpay Verified) Tj
ET

% Bottom Footer
0.05 0.08 0.15 rg
0 0 595 48 re f

BT
/F2 8 Tf
0.75 0.8 0.85 rg
45 26 Td
(MK Digitalverse  |  DigitalMuid  |  GSTIN: 09CHHPK9834Q1ZB  |  Lucknow, India) Tj
45 13 Td
(Serving Globally  |  https://digitalmuid.in  |  support@digitalmuid.in) Tj
ET

BT
/F1 8 Tf
1.0 0.42 0.0 rg
455 20 Td
(PAGE 1 OF 1  |  OFFICIAL) Tj
ET
`;

  const streamLength = contentStream.length;

  const pdfBody = `%PDF-1.4
1 0 obj
<<
  /Type /Catalog
  /Pages 2 0 R
>>
endobj

2 0 obj
<<
  /Type /Pages
  /Kids [3 0 R]
  /Count 1
>>
endobj

3 0 obj
<<
  /Type /Page
  /Parent 2 0 R
  /MediaBox [0 0 595 842]
  /Contents 4 0 R
  /Resources <<
    /Font <<
      /F1 <<
        /Type /Font
        /Subtype /Type1
        /BaseFont /Helvetica-Bold
      >>
      /F2 <<
        /Type /Font
        /Subtype /Type1
        /BaseFont /Helvetica
      >>
    >>
  >>
>>
endobj

4 0 obj
<<
  /Length ${streamLength}
>>
stream
${contentStream}
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000015 00000 n 
0000000068 00000 n 
0000000125 00000 n 
0000000340 00000 n 
trailer
<<
  /Size 5
  /Root 1 0 R
>>
startxref
${450 + streamLength}
%%EOF`;

  return new Blob([pdfBody], { type: 'application/pdf' });
}

/**
 * Triggers a direct browser download of the payment invoice PDF.
 */
export function downloadInvoicePdf(data: InvoicePdfData, fileName?: string): void {
  const blob = generateInvoicePdfBlob(data);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const invoiceNum = formatInvoiceNumber(data.paymentDate, data.paymentId, data.invoiceNumber);
  const safeName = (fileName || `DigitalMuid-Invoice-${invoiceNum}`).replace(/[^a-zA-Z0-9_-]/g, '_');
  link.download = `${safeName}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * Generates an official, compliant PDF 1.4 binary Blob for Credit Notes (Section 34 CGST Act).
 */
export function generateCreditNotePdfBlob(data: CreditNotePdfData): Blob {
  const sanitize = (text: string) => (text || '').replace(/[()\\]/g, '');

  const creditNoteNum = sanitize(formatCreditNoteNumber(data.creditNoteDate, data.creditNoteNumber));
  const originalInvoiceNum = sanitize(data.originalInvoiceNumber || 'DM/26-27/0001');
  const recipient = sanitize(data.customerName || 'Valued Student');
  const studentId = sanitize(data.studentId || 'DM-STU-GUEST');
  const email = sanitize(data.customerEmail || '');
  const refundId = sanitize(data.refundId || 'RFND-DIRECT');
  const paymentId = sanitize(data.paymentId || 'PAY-REF');
  const reason = sanitize(data.reason || 'Course enrollment cancellation and refund');
  const currency = sanitize(data.currency || 'INR');

  const refundAmount = data.refundAmount || 0;
  const baseRefund = Number((refundAmount / 1.18).toFixed(2));
  const taxAdjustment = Number((refundAmount - baseRefund).toFixed(2));

  let formattedDate = 'Recent';
  try {
    const d = new Date(data.creditNoteDate);
    if (!isNaN(d.getTime())) {
      formattedDate = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }
  } catch {
    formattedDate = sanitize(data.creditNoteDate);
  }

  const contentStream = `
0.15 0.05 0.05 rg
0 732 595 110 re f

0.85 0.2 0.2 RG
3.0 w
0 732 595 0 m 595 732 l S

BT
/F1 18 Tf
1 1 1 rg
45 802 Td
(MK DIGITALVERSE) Tj
ET

BT
/F2 9.5 Tf
0.96 0.9 0.9 rg
45 786 Td
(Brand: DigitalMuid  |  GSTIN: 09CHHPK9834Q1ZB) Tj
ET

BT
/F2 8.5 Tf
0.88 0.75 0.75 rg
45 772 Td
(Business Address: Lucknow, India  |  Coverage: Serving Globally) Tj
ET

BT
/F1 15 Tf
0.95 0.25 0.25 rg
370 802 Td
(CREDIT NOTE) Tj
ET

BT
/F1 9 Tf
1 1 1 rg
370 786 Td
(Credit Note No: ${creditNoteNum}) Tj
ET

BT
/F2 8.5 Tf
0.9 0.85 0.85 rg
370 772 Td
(Date: ${formattedDate}) Tj
ET

0.99 0.97 0.97 rg
45 624 505 92 re f
0.9 0.8 0.8 RG
0.8 w
45 624 505 92 re S

BT
/F1 9.5 Tf
0.25 0.1 0.1 rg
60 698 Td
(ISSUED TO (STUDENT):) Tj
ET

BT
/F1 11 Tf
0.2 0.05 0.05 rg
60 682 Td
(${recipient.substring(0, 36)}) Tj
ET

BT
/F1 9 Tf
0.8 0.15 0.15 rg
60 666 Td
(Student ID: ${studentId}) Tj
ET

BT
/F2 8.5 Tf
0.45 0.35 0.35 rg
60 650 Td
(Email: ${email}) Tj
60 636 Td
(Original Tax Invoice: ${originalInvoiceNum}) Tj
ET

BT
/F1 9.5 Tf
0.25 0.1 0.1 rg
330 698 Td
(REFUND & AUDIT DETAILS:) Tj
ET

BT
/F2 8.5 Tf
0.4 0.3 0.3 rg
330 682 Td
(Payment ID: ${paymentId.substring(0, 24)}) Tj
330 666 Td
(Refund ID: ${refundId.substring(0, 24)}) Tj
330 650 Td
(Reason: ${reason.substring(0, 30)}) Tj
330 636 Td
(Statutory Section: Section 34 CGST Act, 2017) Tj
ET

0.2 0.05 0.05 rg
45 588 505 24 re f

BT
/F1 8.5 Tf
1 1 1 rg
55 596 Td
(DESCRIPTION OF ADJUSTMENT) Tj
320 596 Td
(ORIGINAL INVOICE) Tj
450 596 Td
(ADJUSTED VALUE) Tj
ET

0.99 0.98 0.98 rg
45 528 505 60 re f
0.9 0.85 0.85 RG
0.5 w
45 528 505 60 re S

BT
/F1 9.5 Tf
0.2 0.05 0.05 rg
55 566 Td
(Reversal of Course Access & Tax Liability) Tj
ET

BT
/F2 8.5 Tf
0.45 0.35 0.35 rg
55 550 Td
(Original Invoice Reference: ${originalInvoiceNum}) Tj
55 536 Td
(Reason: ${reason.substring(0, 48)}) Tj
ET

BT
/F1 9 Tf
0.2 0.1 0.1 rg
320 554 Td
(${originalInvoiceNum}) Tj
ET

BT
/F1 10.5 Tf
0.8 0.1 0.1 rg
450 554 Td
(-${currency} ${refundAmount.toFixed(2)}) Tj
ET

0.98 0.96 0.96 rg
310 395 240 115 re f
0.9 0.8 0.8 RG
0.8 w
310 395 240 115 re S

BT
/F2 8.5 Tf
0.4 0.3 0.3 rg
325 488 Td
(Base Value Adjusted:) Tj
325 468 Td
(GST Tax Reversed (18%):) Tj
ET

BT
/F2 8.5 Tf
0.2 0.05 0.05 rg
465 488 Td
(-${currency} ${baseRefund.toFixed(2)}) Tj
465 468 Td
(-${currency} ${taxAdjustment.toFixed(2)}) Tj
ET

0.85 0.2 0.2 RG
1.0 w
320 448 220 0 m 540 448 l S

BT
/F1 10.5 Tf
0.2 0.05 0.05 rg
325 425 Td
(Net Refund Issued:) Tj
ET

BT
/F1 12 Tf
0.8 0.1 0.1 rg
455 425 Td
(${currency} ${refundAmount.toFixed(2)}) Tj
ET

0.15 0.05 0.05 rg
0 0 595 48 re f

BT
/F2 8 Tf
0.9 0.8 0.8 rg
45 26 Td
(MK Digitalverse  |  DigitalMuid  |  GSTIN: 09CHHPK9834Q1ZB  |  Lucknow, India) Tj
45 13 Td
(Statutory Credit Note  |  support@digitalmuid.in  |  https://digitalmuid.in) Tj
ET

BT
/F1 8 Tf
0.95 0.3 0.3 rg
455 20 Td
(CREDIT NOTE  |  OFFICIAL) Tj
ET
`;

  const streamLength = contentStream.length;

  const pdfBody = `%PDF-1.4
1 0 obj
<<
  /Type /Catalog
  /Pages 2 0 R
>>
endobj

2 0 obj
<<
  /Type /Pages
  /Kids [3 0 R]
  /Count 1
>>
endobj

3 0 obj
<<
  /Type /Page
  /Parent 2 0 R
  /MediaBox [0 0 595 842]
  /Contents 4 0 R
  /Resources <<
    /Font <<
      /F1 <<
        /Type /Font
        /Subtype /Type1
        /BaseFont /Helvetica-Bold
      >>
      /F2 <<
        /Type /Font
        /Subtype /Type1
        /BaseFont /Helvetica
      >>
    >>
  >>
>>
endobj

4 0 obj
<<
  /Length ${streamLength}
>>
stream
${contentStream}
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000015 00000 n 
0000000068 00000 n 
0000000125 00000 n 
0000000340 00000 n 
trailer
<<
  /Size 5
  /Root 1 0 R
>>
startxref
${450 + streamLength}
%%EOF`;

  return new Blob([pdfBody], { type: 'application/pdf' });
}

/**
 * Triggers a direct browser download of the Credit Note PDF.
 */
export function downloadCreditNotePdf(data: CreditNotePdfData, fileName?: string): void {
  const blob = generateCreditNotePdfBlob(data);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const noteNum = formatCreditNoteNumber(data.creditNoteDate, data.creditNoteNumber);
  const safeName = (fileName || `DigitalMuid-CreditNote-${noteNum}`).replace(/[^a-zA-Z0-9_-]/g, '_');
  link.download = `${safeName}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}


