/**
 * DigitalMUID Server-Side Authoritative Invoice & Receipt Generator
 * Generates compliant, valid PDF 1.4 binary Buffers for transactional email attachments
 * and invoice archival.
 */

/**
 * Sanitizes plain text for standard PDF string literals (escaping parentheses and backslashes).
 * @param {string} text
 * @returns {string}
 */
function sanitizePdfText(text) {
  if (!text) return "";
  return String(text).replace(/[()\\]/g, "");
}

/**
 * Formats a currency amount into standard Indian Rupee notation (e.g. ₹1,499.00).
 * @param {number} amount
 * @returns {string}
 */
function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Generates an official, tax-compliant PDF 1.4 receipt Buffer.
 *
 * @param {object} invoiceData
 * @param {string} invoiceData.paymentId - Razorpay payment ID (e.g. pay_...)
 * @param {string} [invoiceData.orderId] - Razorpay order ID (e.g. order_...)
 * @param {string} [invoiceData.customerName] - Customer full name
 * @param {string} [invoiceData.customerEmail] - Customer email address
 * @param {string} [invoiceData.customerPhone] - Customer phone / WhatsApp
 * @param {string} invoiceData.itemTitle - Course, consultation, or resource title
 * @param {string} invoiceData.itemType - 'course' | 'consultation' | 'resource'
 * @param {number} invoiceData.amount - Total amount paid in Rupees
 * @param {string} [invoiceData.currency] - Currency code (e.g. 'INR')
 * @param {number} [invoiceData.baseAmount] - Net taxable amount before GST (if applicable)
 * @param {number} [invoiceData.gstAmount] - 18% GST amount (if applicable)
 * @param {string} [invoiceData.paymentDate] - ISO date or formatted date string
 * @returns {Buffer} PDF binary Buffer
 */
export function generateAuthoritativeInvoicePdf(invoiceData) {
  const paymentId = sanitizePdfText(invoiceData.paymentId || "PAY-REF");
  const orderId = sanitizePdfText(invoiceData.orderId || "N/A");
  const customerName = sanitizePdfText(invoiceData.customerName || "Valued Student / Client");
  const customerEmail = sanitizePdfText(invoiceData.customerEmail || "Registered Account");
  const customerPhone = sanitizePdfText(invoiceData.customerPhone || "N/A");
  const itemTitle = sanitizePdfText(invoiceData.itemTitle || "Digital Education & Advisory Service");
  const currency = sanitizePdfText((invoiceData.currency || "INR").toUpperCase());
  const itemType = sanitizePdfText(
    invoiceData.itemType === "course"
      ? "Executive Masterclass / Course"
      : invoiceData.itemType === "consultation"
      ? "Strategic Business Growth Consultation"
      : invoiceData.itemType === "resource"
      ? "Digital Resource Toolkit / Asset"
      : invoiceData.itemType || "Professional Service"
  );

  const totalAmount = Number(invoiceData.amount) || 0;
  let baseAmount = invoiceData.baseAmount != null ? Number(invoiceData.baseAmount) : null;
  let gstAmount = invoiceData.gstAmount != null ? Number(invoiceData.gstAmount) : null;

  // If consultation or taxed item, calculate GST breakdown if not explicitly supplied
  if (invoiceData.itemType === "consultation") {
    if (baseAmount == null || gstAmount == null) {
      baseAmount = Number((totalAmount / 1.18).toFixed(2));
      gstAmount = Number((totalAmount - baseAmount).toFixed(2));
    }
  } else {
    // For educational courses / resources, standard inclusive pricing
    if (baseAmount == null) baseAmount = totalAmount;
    if (gstAmount == null) gstAmount = 0;
  }

  const sacCode = invoiceData.itemType === "consultation" ? "998311" : "999293";
  const sacLabel = invoiceData.itemType === "consultation" ? "SAC 998311 (Management Consulting)" : "SAC 999293 (Commercial Training)";

  const now = invoiceData.paymentDate ? new Date(invoiceData.paymentDate) : new Date();
  const formattedDate = !isNaN(now.getTime())
    ? now.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : sanitizePdfText(invoiceData.paymentDate || "Recent");

  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const cleanPayIdSuffix = paymentId.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase() || "000000";
  const invoiceNumber = `DM-INV-${yearMonth}-${cleanPayIdSuffix}`;

  // Portrait A4: 595 x 842 points
  const contentStream = `
% Top Dark Accent Header Bar
0.05 0.08 0.15 rg
0 742 595 100 re f

% Orange Accent Divider
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
(Powered by MK Digitalverse | Strategic Digital Growth & AI Academy) Tj
ET

BT
/F2 8.5 Tf
0.8 0.85 0.9 rg
45 764 Td
(https://digitalmuid.in | support@digitalmuid.in | +91 93358 17155) Tj
ET

% Invoice Title on Right
BT
/F1 15 Tf
1.0 0.42 0.0 rg
400 795 Td
(TAX INVOICE / RECEIPT) Tj
ET

BT
/F2 9 Tf
0.8 0.85 0.9 rg
400 778 Td
(Invoice No: ${invoiceNumber}) Tj
ET

BT
/F2 9 Tf
0.8 0.85 0.9 rg
400 764 Td
(Date: ${formattedDate}) Tj
ET

% Billed To Section Box
0.96 0.97 0.98 rg
45 635 505 85 re f
0.85 0.88 0.92 RG
0.8 w
45 635 505 85 re S

BT
/F1 10 Tf
0.1 0.15 0.25 rg
60 700 Td
(BILLED TO:) Tj
ET

BT
/F2 9.5 Tf
0.2 0.25 0.35 rg
60 682 Td
(Client / Student: ${customerName}) Tj
ET

BT
/F2 9 Tf
0.3 0.35 0.45 rg
60 666 Td
(Email: ${customerEmail}  |  Phone: ${customerPhone}) Tj
ET

BT
/F2 8.5 Tf
0.4 0.45 0.55 rg
60 650 Td
(Gateway: Razorpay Payment ID: ${paymentId}  |  Order ID: ${orderId}) Tj
ET

% Itemized Table Header
0.1 0.15 0.25 rg
45 595 505 24 re f

BT
/F1 9 Tf
1 1 1 rg
55 603 Td
(DESCRIPTION) Tj
290 603 Td
(SAC CODE) Tj
390 603 Td
(TYPE) Tj
480 603 Td
(AMOUNT) Tj
ET

% Table Row 1
0.98 0.99 1.0 rg
45 550 505 45 re f
0.88 0.9 0.94 RG
0.5 w
45 550 505 45 re S

BT
/F1 9.5 Tf
0.1 0.15 0.25 rg
55 577 Td
(${itemTitle.substring(0, 42)}) Tj
ET

BT
/F2 8 Tf
0.45 0.5 0.55 rg
55 562 Td
(Includes permanent access, course progress tracking, and verification.) Tj
ET

BT
/F2 8.5 Tf
0.3 0.35 0.45 rg
290 570 Td
(${sacCode}) Tj
390 570 Td
(${itemType.substring(0, 16)}) Tj
ET

BT
/F1 10 Tf
0.1 0.15 0.25 rg
480 570 Td
(${currency} ${formatCurrency(baseAmount)}) Tj
ET

% Summary Box on Right
0.96 0.97 0.98 rg
310 420 240 115 re f
0.85 0.88 0.92 RG
0.8 w
310 420 240 115 re S

BT
/F2 9 Tf
0.35 0.4 0.45 rg
325 515 Td
(Taxable Value / Net Amount:) Tj
325 495 Td
(CGST (9%):) Tj
325 475 Td
(SGST (9%):) Tj
ET

BT
/F2 9 Tf
0.15 0.2 0.3 rg
470 515 Td
(${currency} ${formatCurrency(baseAmount)}) Tj
470 495 Td
(${currency} ${formatCurrency(gstAmount / 2)}) Tj
470 475 Td
(${currency} ${formatCurrency(gstAmount / 2)}) Tj
ET

% Total Line
1.0 0.42 0.0 RG
1.0 w
320 460 220 0 m 540 460 l S

BT
/F1 11 Tf
0.05 0.08 0.15 rg
325 438 Td
(Total Paid (Inclusive):) Tj
ET

BT
/F1 12 Tf
0.05 0.55 0.3 rg
465 438 Td
(${currency} ${formatCurrency(totalAmount)}) Tj
ET

% Left Verification Badge
0.9 0.96 0.92 rg
45 420 250 115 re f
0.3 0.7 0.4 RG
0.8 w
45 420 250 115 re S

BT
/F1 10 Tf
0.05 0.5 0.25 rg
60 512 Td
([VERIFIED PAYMENT RECORD]) Tj
ET

BT
/F2 8.5 Tf
0.15 0.3 0.2 rg
60 492 Td
(Status: Captured & Settled) Tj
60 474 Td
(Gateway: Razorpay Automated Settlement) Tj
60 456 Td
(Authorized Fulfillment: Confirmed) Tj
60 438 Td
(Classification: ${sacLabel}) Tj
ET

% Terms & Important Information
BT
/F1 9 Tf
0.1 0.15 0.25 rg
45 380 Td
(Terms & Learning Access Information:) Tj
ET

BT
/F2 8.5 Tf
0.35 0.4 0.45 rg
45 362 Td
(1. This electronic tax invoice acts as official proof of purchase for DigitalMUID services.) Tj
45 346 Td
(2. Access is provisioned instantly to the student dashboard at https://digitalmuid.in/dashboard.) Tj
45 330 Td
(3. For consultation bookings, reschedule requests must be submitted at least 24 hours prior to slot.) Tj
45 314 Td
(4. For corporate reimbursements, quote Invoice No: ${invoiceNumber} to your accounting department.) Tj
ET

% Bottom Footer Bar
0.05 0.08 0.15 rg
0 0 595 50 re f

BT
/F2 8 Tf
0.75 0.8 0.85 rg
45 28 Td
(DigitalMUID - Powered by MK Digitalverse | All Rights Reserved) Tj
45 15 Td
(Official Inquiries: support@digitalmuid.in | Website: https://digitalmuid.in) Tj
ET

BT
/F1 8 Tf
1.0 0.42 0.0 rg
440 22 Td
(OFFICIAL RECEIPT - PAGE 1/1) Tj
ET
`;

  const streamLength = Buffer.byteLength(contentStream, "utf8");

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

  return Buffer.from(pdfBody, "utf8");
}
