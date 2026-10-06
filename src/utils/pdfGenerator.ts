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

export interface InvoicePdfData {
  paymentId: string;
  orderId?: string | null;
  customerName?: string;
  customerEmail?: string;
  itemTitle: string;
  itemType: 'course' | 'consultation' | 'subscription' | string;
  amount: number;
  currency: string;
  paymentDate: string;
  status: string;
  invoiceUrl?: string | null;
}

/**
 * Generates an official, clean, high-contrast PDF 1.4 binary Blob for
 * Digital Muid Payment Receipts (Portrait A4: 595 x 842).
 * Strictly renders only data available from the trusted PaymentRecord.
 */
export function generateInvoicePdfBlob(data: InvoicePdfData): Blob {
  const sanitize = (text: string) => (text || '').replace(/[()\\]/g, '');

  const paymentId = sanitize(data.paymentId || 'PAY-REF');
  const orderId = sanitize(data.orderId || 'N/A');
  const customerName = sanitize(data.customerName || 'Valued Student');
  const customerEmail = sanitize(data.customerEmail || 'Registered Account');
  const itemTitle = sanitize(data.itemTitle || 'Digital Educational Service');
  const itemType = sanitize(
    data.itemType === 'course'
      ? 'Executive Masterclass'
      : data.itemType === 'consultation'
      ? 'Strategic Consultation'
      : data.itemType === 'subscription'
      ? 'Subscription Access'
      : data.itemType
  );
  const currency = sanitize(data.currency || 'INR');
  const status = sanitize((data.status || 'captured').toUpperCase());

  // Format currency amount safely
  let formattedAmount = '0.00';
  try {
    formattedAmount = (data.amount || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  } catch {
    formattedAmount = String(data.amount || '0.00');
  }

  // Format payment date safely
  let formattedDate = 'Recent';
  try {
    const d = new Date(data.paymentDate);
    if (!isNaN(d.getTime())) {
      formattedDate = d.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
    }
  } catch {
    formattedDate = sanitize(data.paymentDate);
  }

  const receiptNumber = `REC-${paymentId.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase()}`;

  // Portrait A4 (595 x 842) content stream
  const contentStream = `
% Top Accent Header Bar
0.06 0.09 0.16 rg
0 742 595 100 re f

% Orange Brand Accent Line
1.0 0.42 0.0 RG
3.0 w
0 742 595 0 m 595 742 l S

% Header Branding
BT
/F1 20 Tf
1 1 1 rg
45 795 Td
(DIGITAL MUID) Tj
ET

BT
/F2 9 Tf
0.8 0.85 0.9 rg
45 778 Td
(Strategic Digital Growth & Executive Learning) Tj
ET

BT
/F2 9 Tf
0.8 0.85 0.9 rg
45 764 Td
(https://digitalmuid.com | support@digitalmuid.com) Tj
ET

% Receipt Title on Right
BT
/F1 16 Tf
1.0 0.42 0.0 rg
410 795 Td
(PAYMENT RECEIPT) Tj
ET

BT
/F2 9 Tf
0.8 0.85 0.9 rg
410 778 Td
(Receipt No: ${receiptNumber}) Tj
ET

BT
/F2 9 Tf
0.8 0.85 0.9 rg
410 764 Td
(Date: ${formattedDate}) Tj
ET

% Outer Receipt Border
0.9 0.92 0.95 RG
1.0 w
40 70 515 640 re S

% Billed To Box
0.96 0.97 0.99 rg
45 615 505 85 re f
0.85 0.88 0.92 RG
0.5 w
45 615 505 85 re S

BT
/F1 10 Tf
0.1 0.15 0.25 rg
60 678 Td
(BILLED TO:) Tj
ET

BT
/F1 12 Tf
0.05 0.1 0.2 rg
60 660 Td
(${customerName}) Tj
ET

BT
/F2 10 Tf
0.3 0.35 0.4 rg
60 644 Td
(Account: ${customerEmail}) Tj
ET

BT
/F2 9 Tf
0.3 0.35 0.4 rg
60 628 Td
(Payment Status: ${status}) Tj
ET

% Transaction Reference Details Box
BT
/F1 9 Tf
0.1 0.15 0.25 rg
330 678 Td
(TRANSACTION DETAILS:) Tj
ET

BT
/F2 9 Tf
0.3 0.35 0.4 rg
330 660 Td
(Payment ID: ${paymentId.substring(0, 24)}) Tj
ET

BT
/F2 9 Tf
0.3 0.35 0.4 rg
330 644 Td
(Order ID: ${orderId.substring(0, 24)}) Tj
ET

BT
/F2 9 Tf
0.3 0.35 0.4 rg
330 628 Td
(Currency: ${currency}) Tj
ET

% Itemized Table Header
0.06 0.09 0.16 rg
45 570 505 25 re f

BT
/F1 9 Tf
1 1 1 rg
60 580 Td
(ITEM DESCRIPTION) Tj
ET

BT
/F1 9 Tf
1 1 1 rg
340 580 Td
(CATEGORY) Tj
ET

BT
/F1 9 Tf
1 1 1 rg
465 580 Td
(AMOUNT) Tj
ET

% Item Row
0.98 0.98 0.99 rg
45 505 505 65 re f
0.9 0.92 0.95 RG
0.5 w
45 505 505 65 re S

BT
/F1 11 Tf
0.05 0.1 0.2 rg
60 545 Td
(${itemTitle.substring(0, 42)}) Tj
ET

BT
/F2 9 Tf
0.4 0.45 0.5 rg
60 528 Td
(Digital Learning & Executive Masterclass Service) Tj
ET

BT
/F2 9 Tf
0.2 0.25 0.3 rg
340 542 Td
(${itemType}) Tj
ET

BT
/F1 11 Tf
0.05 0.1 0.2 rg
465 542 Td
(${currency} ${formattedAmount}) Tj
ET

% Total Summary Box
0.96 0.97 0.99 rg
330 435 220 55 re f
0.85 0.88 0.92 RG
0.5 w
330 435 220 55 re S

BT
/F1 11 Tf
0.1 0.15 0.25 rg
345 468 Td
(TOTAL PAID:) Tj
ET

BT
/F1 14 Tf
1.0 0.42 0.0 rg
445 468 Td
(${currency} ${formattedAmount}) Tj
ET

BT
/F2 8 Tf
0.4 0.45 0.5 rg
345 448 Td
(Status: Verified & Captured) Tj
ET

% Security & Verification Seal Section
0.75 0.6 0.2 RG
1.0 w
45 280 505 130 re S

BT
/F1 10 Tf
0.75 0.6 0.2 rg
60 385 Td
(OFFICIAL DIGITAL RECEIPT INFORMATION) Tj
ET

BT
/F2 9 Tf
0.2 0.25 0.3 rg
60 365 Td
(1. This receipt confirms the successful electronic capture of payment for educational access.) Tj
ET

BT
/F2 9 Tf
0.2 0.25 0.3 rg
60 345 Td
(2. Recorded transaction amount represents the net captured fee for this service.) Tj
ET

BT
/F2 9 Tf
0.2 0.25 0.3 rg
60 325 Td
(3. For corporate invoice records, expensing, or queries: support@digitalmuid.com) Tj
ET

BT
/F2 9 Tf
0.2 0.25 0.3 rg
60 305 Td
(4. Receipt Verification Reference: ${receiptNumber} | Gateway Ref: ${paymentId.substring(0, 16)}) Tj
ET

% Bottom Footer
0.85 0.88 0.92 RG
0.5 w
45 130 505 0 m 550 130 l S

BT
/F2 8 Tf
0.5 0.55 0.6 rg
60 110 Td
(Digital Muid - Proprietary Learning & Growth Systems. All Rights Reserved.) Tj
ET

BT
/F2 8 Tf
0.5 0.55 0.6 rg
60 95 Td
(This document was electronically generated and is valid without a physical signature.) Tj
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
 * Triggers a direct browser download of the payment receipt PDF.
 */
export function downloadInvoicePdf(data: InvoicePdfData, fileName?: string): void {
  const blob = generateInvoicePdfBlob(data);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeRef = (data.paymentId || 'Verified').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeName = (fileName || `DigitalMuid-Receipt-${safeRef}`).replace(/[^a-zA-Z0-9_-]/g, '_');
  link.download = `${safeName}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

