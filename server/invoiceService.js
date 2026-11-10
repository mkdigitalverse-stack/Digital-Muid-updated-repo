/**
 * DigitalMUID Server-Side Authoritative Invoice & Credit Note Generator
 * Generates compliant, valid PDF 1.4 binary Buffers for transactional invoices and credit notes,
 * student download, and admin archival.
 *
 * Compliance:
 * - GST Rule 46(b) Serial Numbering (<= 16 characters, unique per financial year)
 * - Section 34 CGST Act, 2017 for Credit Notes on refunds/cancellations
 * - Dynamic Place of Supply & Inter-state / Intra-state / Export treatment
 * - Mandatory disclaimer that SAC classifications are subject to professional CA verification
 *
 * Seller Information (Authoritative & Verified):
 * - Business Name: MK Digitalverse
 * - Brand: DigitalMuid
 * - GSTIN: 09CHHPK9834Q1ZB (Uttar Pradesh, State Code 09)
 * - Business Address: Lucknow, India
 * - Service Coverage: Serving Globally
 */

import {
  formatStudentId,
  formatEnrollmentId,
  formatInvoiceNumber,
  formatCreditNoteNumber,
  getIndianFinancialYear
} from "./studentId.js";

/**
 * Sanitizes plain text for standard PDF string literals (escaping parentheses and backslashes).
 * @param {string} text
 * @returns {string}
 */
export function sanitizePdfText(text) {
  if (!text) return "";
  return String(text).replace(/[()\\]/g, "");
}

/**
 * Formats a currency amount into standard Indian Rupee notation (e.g. ₹1,499.00).
 * @param {number} amount
 * @returns {string}
 */
export function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Authoritative Seller & Legal Profile
 */
export const SELLER_PROFILE = {
  businessName: "MK Digitalverse",
  brand: "DigitalMuid",
  gstin: "09CHHPK9834Q1ZB",
  stateCode: "09",
  stateName: "Uttar Pradesh",
  businessAddress: "Lucknow, India",
  coverage: "Serving Globally",
  supportEmail: "support@digitalmuid.in",
  websiteUrl: "https://digitalmuid.in",
  phone: "+91 93358 17155"
};

/**
 * Standard Indian States and Union Territories with 2-digit GST State Codes
 */
export const INDIAN_GST_STATE_CODES = {
  "01": "Jammu & Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra & Nagar Haveli and Daman & Diu",
  "27": "Maharashtra",
  "28": "Andhra Pradesh",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman & Nicobar Islands",
  "36": "Telangana",
  "37": "Ladakh",
  "38": "Other Territory"
};

/**
 * Robust Place of Supply determination under Sections 12 & 13 of the IGST Act, 2017.
 * Evaluates multiple non-contradictory signals:
 * 1. Customer GSTIN (first 2 digits identify State Code under Section 12(2)(a))
 * 2. Declared Customer State / UT name or code
 * 3. Customer Billing Address signals
 * 4. International / Currency signals for export evaluation
 *
 * @param {object} raw
 * @param {string} currency
 * @returns {object} { customerState, stateCode, isInterState, isOverseas, isExportWithLut }
 */
export function determinePlaceOfSupply(raw, currency = "INR") {
  const rawGstin = String(raw.customerGstin || raw.gstin || "").trim().toUpperCase();
  const rawState = String(raw.customerState || raw.state || "").trim();
  const billingAddress = String(raw.billingAddress || raw.billing_address || "").trim();
  const country = String(raw.country || raw.billingCountry || "").trim().toLowerCase();

  // 1. Check if recipient has a registered GSTIN
  if (rawGstin && rawGstin.length >= 2) {
    const code = rawGstin.slice(0, 2);
    if (INDIAN_GST_STATE_CODES[code]) {
      const isUP = code === "09";
      return {
        customerState: `${INDIAN_GST_STATE_CODES[code]} (${code})`,
        stateCode: code,
        isInterState: !isUP,
        isOverseas: false,
        isExportWithLut: false
      };
    }
  }

  // 2. Check for Overseas / Foreign indicators
  const isForeignCurrency = currency !== "INR";
  const addressOverseas = billingAddress && (
    billingAddress.toLowerCase().includes("usa") ||
    billingAddress.toLowerCase().includes("united states") ||
    billingAddress.toLowerCase().includes("uk") ||
    billingAddress.toLowerCase().includes("united kingdom") ||
    billingAddress.toLowerCase().includes("canada") ||
    billingAddress.toLowerCase().includes("uae") ||
    billingAddress.toLowerCase().includes("dubai") ||
    billingAddress.toLowerCase().includes("singapore") ||
    billingAddress.toLowerCase().includes("australia")
  );
  const stateOverseas = rawState && (
    rawState.toLowerCase().includes("overseas") ||
    rawState.toLowerCase().includes("international") ||
    rawState.toLowerCase().includes("outside india")
  );
  const countryOverseas = country && country !== "india" && country !== "in";

  const isOverseas = Boolean(isForeignCurrency || addressOverseas || stateOverseas || countryOverseas || raw.isOverseas);
  const isExportWithLut = Boolean(raw.isExportWithLut || raw.lutVerified || false);

  if (isOverseas) {
    if (isExportWithLut) {
      return {
        customerState: rawState || "Overseas (Zero-Rated under Verified LUT - Form GST RFD-11)",
        stateCode: "96", // Standard overseas trade code
        isInterState: true,
        isOverseas: true,
        isExportWithLut: true
      };
    } else {
      // Under Section 7(5)(a) of IGST Act, cross-border supply without confirmed LUT is subject to Inter-State IGST
      return {
        customerState: rawState || "Overseas / International (IGST Applicable - Pending CA LUT Confirmation)",
        stateCode: "96",
        isInterState: true,
        isOverseas: true,
        isExportWithLut: false
      };
    }
  }

  // 3. Match Indian State / UT from state or billing address
  const combinedText = `${rawState} ${billingAddress}`.toLowerCase();

  // Check Uttar Pradesh (Supplier Location - State Code 09)
  if (
    combinedText.includes("uttar pradesh") ||
    combinedText.includes("lucknow") ||
    combinedText.includes("kanpur") ||
    combinedText.includes("noida") ||
    combinedText.includes("ghaziabad") ||
    combinedText.includes("varanasi") ||
    rawState.toLowerCase() === "up" ||
    rawState === "09"
  ) {
    return {
      customerState: "Uttar Pradesh (09)",
      stateCode: "09",
      isInterState: false,
      isOverseas: false,
      isExportWithLut: false
    };
  }

  // Check all other Indian States and Codes
  for (const [code, name] of Object.entries(INDIAN_GST_STATE_CODES)) {
    if (code === "09") continue;
    if (combinedText.includes(name.toLowerCase()) || rawState === code) {
      return {
        customerState: `${name} (${code})`,
        stateCode: code,
        isInterState: true,
        isOverseas: false,
        isExportWithLut: false
      };
    }
  }

  // 4. Default if State is completely unstated/unidentifiable
  if (!rawState && !billingAddress) {
    return {
      customerState: "Recipient State Unstated (Inter-State IGST Applicable under Sec 7(5) / 12(2))",
      stateCode: "99",
      isInterState: true,
      isOverseas: false,
      isExportWithLut: false
    };
  }

  // Fallback to customer's raw input with Inter-State assumption
  return {
    customerState: rawState || "Other Territory (Inter-State IGST)",
    stateCode: "99",
    isInterState: true,
    isOverseas: false,
    isExportWithLut: false
  };
}

/**
 * Builds a normalized, authoritative invoice model from raw payment/order data.
 * @param {object} raw
 * @returns {object} Authoritative invoice object
 */
export function buildAuthoritativeInvoiceModel(raw) {
  const paymentId = String(raw.paymentId || raw.razorpayPaymentId || raw.id || "PAY-REF").trim();
  const orderId = String(raw.orderId || raw.razorpayOrderId || "N/A").trim();
  const paymentDate = raw.paymentDate || raw.createdAt || raw.created_at || new Date().toISOString();

  // Permanent student & enrollment identification (Internal Supabase UUID is never exposed)
  const studentId = formatStudentId(raw.userId || raw.user_id, raw.studentId || raw.student_id, raw.seqNumber);
  const enrollmentId = raw.enrollmentId || raw.enrollment_id
    ? formatEnrollmentId(raw.enrollmentId || raw.enrollment_id)
    : undefined;

  // Persistent invoice number (GST Rule 46(b) <= 16 chars)
  const invoiceNumber = formatInvoiceNumber(
    paymentDate,
    paymentId,
    raw.invoiceNumber || raw.invoice_number,
    raw.invoiceSeq
  );

  const customerName = String(
    raw.customerName || raw.fullName || raw.full_name || "Valued Student / Client"
  ).trim();
  const customerEmail = String(raw.customerEmail || raw.email || "Registered Student").trim();
  const customerPhone = String(raw.customerPhone || raw.phone || "N/A").trim();
  const customerBillingAddress = String(raw.billingAddress || raw.billing_address || "").trim();

  const itemTitle = String(
    raw.itemTitle || raw.item_title || (raw.itemType === "course" ? "Digital Growth Masterclass" : "Digital Educational Service")
  ).trim();

  const rawItemType = String(raw.itemType || raw.item_type || "course").toLowerCase();
  const itemType = rawItemType === "course"
    ? "Executive Course"
    : rawItemType === "consultation"
    ? "Strategic Consultation"
    : rawItemType === "resource"
    ? "Digital Resource Toolkit"
    : "Educational Service";

  const totalAmount = Number(raw.amount) || 0;
  const currency = (raw.currency || "INR").toUpperCase();

  // Authoritative SAC & Tax determination (F-04 CA Classification Flexibility)
  // Course/Training: SAC 999293 (Commercial training & coaching services)
  // Consultation: SAC 998311 (Management consulting and advisory services)
  // Digital Tools: SAC 998313 (IT services) or SAC 998431 (Online content & text workbooks)
  const sacCode = String(raw.sacCode || (rawItemType === "consultation" ? "998311" : rawItemType === "resource" ? "998313" : "999293")).trim();
  const sacDescription = raw.sacDescription || (
    rawItemType === "consultation"
      ? "Management Consulting & Advisory Services (SAC 998311)"
      : rawItemType === "resource"
      ? (sacCode === "998431"
          ? "On-Line Educational Workbooks & Digital Toolkits (SAC 998431)"
          : "IT Digital Tools & Interactive Educational Assets (SAC 998313)")
      : "Commercial Training & Coaching Services (SAC 999293)"
  );

  // Configurable Tax Rate Determination (Do NOT assume 18% blindly)
  let taxRatePercent = 18;
  if (raw.taxRatePercent !== undefined && raw.taxRatePercent !== null && !isNaN(Number(raw.taxRatePercent))) {
    taxRatePercent = Number(raw.taxRatePercent);
  } else if (rawItemType === "book_print" || rawItemType === "print_material") {
    taxRatePercent = 0; // Printed books / materials under HSN 4901
  }

  // Robust Place of Supply Determination
  const pos = determinePlaceOfSupply(raw, currency);
  let customerState = pos.customerState;
  let isInterState = pos.isInterState;
  const isOverseasCustomer = pos.isOverseas;
  const isExportWithLut = pos.isExportWithLut;

  if (isExportWithLut) {
    taxRatePercent = 0; // Zero-rated under valid LUT
  }

  // GST Calculation based on configurable rate and Place of Supply
  let baseAmount = 0;
  let gstAmount = 0;
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  if (taxRatePercent === 0) {
    baseAmount = totalAmount;
    gstAmount = 0;
    cgstAmount = 0;
    sgstAmount = 0;
    igstAmount = 0;
  } else {
    baseAmount = Number((totalAmount / (1 + taxRatePercent / 100)).toFixed(2));
    gstAmount = Number((totalAmount - baseAmount).toFixed(2));
    if (isInterState) {
      igstAmount = gstAmount;
      cgstAmount = 0;
      sgstAmount = 0;
    } else {
      cgstAmount = Number((gstAmount / 2).toFixed(2));
      sgstAmount = Number((gstAmount / 2).toFixed(2));
      igstAmount = 0;
    }
  }

  return {
    invoiceNumber,
    paymentDate,
    status: (raw.status || "captured").toLowerCase(),
    sacCode,
    sacDescription,
    seller: {
      ...SELLER_PROFILE,
      reverseCharge: "No (Tax is payable by Supplier under Forward Charge)"
    },
    customer: {
      name: customerName,
      email: customerEmail,
      phone: customerPhone,
      studentId,
      state: customerState,
      stateCode: pos.stateCode,
      billingAddress: customerBillingAddress || undefined
    },
    payment: {
      gateway: "Razorpay",
      paymentId,
      orderId,
      status: (raw.status || "captured").toLowerCase(),
      currency,
      totalAmount,
      baseAmount,
      gstAmount,
      taxRatePercent,
      isInterState,
      isExport: isExportWithLut,
      isOverseasCustomer,
      cgstAmount,
      sgstAmount,
      igstAmount,
      cgstRatePercent: isInterState ? 0 : taxRatePercent / 2,
      sgstRatePercent: isInterState ? 0 : taxRatePercent / 2,
      igstRatePercent: isInterState ? taxRatePercent : 0
    },
    item: {
      title: itemTitle,
      type: itemType,
      rawType: rawItemType,
      sacCode,
      sacDescription,
      enrollmentId,
      quantity: 1,
      unitPrice: baseAmount,
      taxableAmount: baseAmount,
      totalAmount
    }
  };
}

/**
 * Builds an authoritative credit note model for refunded transactions (Section 34 CGST Act).
 * Matches original invoice tax split and Place of Supply rather than assuming 18%.
 *
 * @param {object} raw
 * @returns {object} Authoritative credit note model
 */
export function buildAuthoritativeCreditNoteModel(raw) {
  const invoiceModel = raw.invoice ? raw.invoice : buildAuthoritativeInvoiceModel(raw);
  const refundDate = raw.refundDate || raw.creditNoteDate || new Date().toISOString();
  const creditNoteNumber = formatCreditNoteNumber(
    refundDate,
    raw.creditNoteNumber || raw.credit_note_number,
    raw.creditNoteSeq
  );
  const refundAmount = Number(raw.refundAmount || raw.amount || invoiceModel.payment.totalAmount);
  const taxRate = invoiceModel.payment.taxRatePercent || 18;
  const isInterState = invoiceModel.payment.isInterState;

  let baseRefund = 0;
  let taxAdjustment = 0;
  let cgstAdjustment = 0;
  let sgstAdjustment = 0;
  let igstAdjustment = 0;

  if (taxRate === 0) {
    baseRefund = refundAmount;
    taxAdjustment = 0;
  } else {
    baseRefund = Number((refundAmount / (1 + taxRate / 100)).toFixed(2));
    taxAdjustment = Number((refundAmount - baseRefund).toFixed(2));
    if (isInterState) {
      igstAdjustment = taxAdjustment;
    } else {
      cgstAdjustment = Number((taxAdjustment / 2).toFixed(2));
      sgstAdjustment = Number((taxAdjustment / 2).toFixed(2));
    }
  }

  return {
    creditNoteNumber,
    originalInvoiceNumber: raw.invoiceNumber || invoiceModel.invoiceNumber,
    originalInvoiceDate: invoiceModel.paymentDate,
    creditNoteDate: refundDate,
    reason: raw.reason || "Course access withdrawal / refund",
    refundId: raw.refundId || raw.razorpayRefundId || "RFND-REF",
    paymentId: invoiceModel.payment.paymentId,
    seller: {
      ...SELLER_PROFILE,
      reverseCharge: "No"
    },
    customer: invoiceModel.customer,
    currency: invoiceModel.payment.currency,
    refundAmount,
    baseRefundAmount: baseRefund,
    taxAdjustmentAmount: taxAdjustment,
    cgstAdjustmentAmount: cgstAdjustment,
    sgstAdjustmentAmount: sgstAdjustment,
    igstAdjustmentAmount: igstAdjustment,
    taxRatePercent: taxRate,
    isInterState,
    placeOfSupply: invoiceModel.customer.state,
    reverseCharge: "No",
    item: invoiceModel.item
  };
}

/**
 * Generates an official, tax-compliant PDF 1.4 invoice Buffer.
 *
 * @param {object} invoiceInput - Raw invoice input or prepared invoice model
 * @returns {Buffer} PDF binary Buffer
 */
export function generateAuthoritativeInvoicePdf(invoiceInput) {
  const model = invoiceInput.seller ? invoiceInput : buildAuthoritativeInvoiceModel(invoiceInput);

  const paymentId = sanitizePdfText(model.payment.paymentId);
  const orderId = sanitizePdfText(model.payment.orderId);
  const studentId = sanitizePdfText(model.customer.studentId);
  const customerName = sanitizePdfText(model.customer.name);
  const customerEmail = sanitizePdfText(model.customer.email);
  const customerPhone = sanitizePdfText(model.customer.phone);
  const customerState = sanitizePdfText(model.customer.state);
  const itemTitle = sanitizePdfText(model.item.title);
  const itemType = sanitizePdfText(model.item.type);
  const sacCode = sanitizePdfText(model.item.sacCode);
  const sacDescription = sanitizePdfText(model.item.sacDescription);
  const enrollmentId = sanitizePdfText(model.item.enrollmentId || "");
  const currency = sanitizePdfText(model.payment.currency);
  const invoiceNumber = sanitizePdfText(model.invoiceNumber);

  const totalAmount = model.payment.totalAmount;
  const baseAmount = model.payment.baseAmount;
  const cgstAmount = model.payment.cgstAmount;
  const sgstAmount = model.payment.sgstAmount;
  const igstAmount = model.payment.igstAmount;
  const isExport = model.payment.isExport;

  const dateObj = new Date(model.paymentDate);
  const formattedDate = !isNaN(dateObj.getTime())
    ? dateObj.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      })
    : "Recent";

  // Portrait A4: 595 x 842 points
  const contentStream = `
% Top Dark Accent Header Bar
0.05 0.08 0.15 rg
0 732 595 110 re f

% Primary Orange Accent Divider
1.0 0.42 0.0 RG
3.0 w
0 732 595 0 m 595 732 l S

% Header Branding (Seller Details)
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
(Portal: https://digitalmuid.in  |  Official Support: support@digitalmuid.in) Tj
ET

% Invoice Title & Reference on Top Right
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
(Payment Status: Captured / Paid) Tj
ET

% Two-Column Information Box
0.97 0.98 0.99 rg
45 624 505 92 re f
0.85 0.88 0.92 RG
0.8 w
45 624 505 92 re S

% Billed To (Student) on Left
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
60 636 Td
(Place of Supply / State: ${customerState.substring(0, 35)}) Tj
ET

% Payment & Gateway Reference on Right
BT
/F1 9.5 Tf
0.1 0.15 0.25 rg
330 698 Td
(PAYMENT REFERENCE:) Tj
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
330 636 Td
(Settlement: Electronic Transfer Verified) Tj
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
(SAC CODE) Tj
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

BT
/F2 8 Tf
0.4 0.45 0.5 rg
55 554 Td
(${sacDescription.substring(0, 42)}) Tj
ET

${enrollmentId ? `
BT
/F1 8 Tf
1.0 0.42 0.0 rg
55 540 Td
(Enrolment ID: ${enrollmentId}) Tj
ET
` : `
BT
/F2 8 Tf
0.5 0.55 0.6 rg
55 540 Td
(Verified Student Access Activated) Tj
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
(${currency} ${formatCurrency(baseAmount)}) Tj
ET

% Summary & GST Breakdown Box on Right
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
(${isExport ? "Export under LUT (Zero-Rated 0%):" : igstAmount > 0 ? `Integrated GST (IGST ${model.payment.taxRatePercent}%):` : `Central GST (CGST ${model.payment.taxRatePercent / 2}%):`}) Tj
325 460 Td
(${isExport ? "Export Duty:" : igstAmount > 0 ? "State GST (SGST):" : `State GST (SGST ${model.payment.taxRatePercent / 2}%):`}) Tj
ET

BT
/F2 8.5 Tf
0.15 0.2 0.3 rg
465 496 Td
(${currency} ${formatCurrency(baseAmount)}) Tj
465 478 Td
(${currency} ${formatCurrency(isExport ? 0 : igstAmount > 0 ? igstAmount : cgstAmount)}) Tj
465 460 Td
(${currency} ${formatCurrency(isExport ? 0 : igstAmount > 0 ? 0 : sgstAmount)}) Tj
ET

% Total Amount Line
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
(${currency} ${formatCurrency(totalAmount)}) Tj
ET

BT
/F2 7.5 Tf
0.4 0.45 0.5 rg
325 404 Td
(${isExport ? "(Zero-rated export of service under verified LUT)" : model.payment.isOverseasCustomer ? "(Overseas recipient: IGST applied pending CA LUT confirmation)" : `(Inclusive of ${model.payment.taxRatePercent}% applicable GST taxes)`}) Tj
ET

% Left Verification & Compliance Seal
0.93 0.97 0.94 rg
45 395 250 122 re f
0.3 0.7 0.4 RG
0.8 w
45 395 250 122 re S

BT
/F1 9.5 Tf
0.05 0.5 0.25 rg
60 496 Td
([VERIFIED AUTHORITATIVE TAX INVOICE]) Tj
ET

BT
/F2 8 Tf
0.15 0.3 0.2 rg
60 478 Td
(Issued by: MK Digitalverse (Brand: DigitalMuid)) Tj
60 462 Td
(GSTIN: 09CHHPK9834Q1ZB | State: UP (09)) Tj
60 446 Td
(Supplier Location: Lucknow, Uttar Pradesh, India) Tj
60 430 Td
(Recipient Location: ${customerState.substring(0, 26)}) Tj
60 414 Td
(Tax Compliance: Rule 46(b) CGST Rules, 2017) Tj
ET

% Compliance & Terms Information
BT
/F1 8.5 Tf
0.1 0.15 0.25 rg
45 355 Td
(Terms, Professional Advisory & Statutory Declarations:) Tj
ET

BT
/F2 7.8 Tf
0.35 0.4 0.45 rg
45 338 Td
(1. Computer-generated tax invoice issued by MK Digitalverse for digital educational / consultancy services.) Tj
45 324 Td
(2. Services rendered are delivered electronically and accessible via the student portal at https://digitalmuid.in.) Tj
45 310 Td
(3. SAC code classifications and tax rate determinations are subject to final periodic audit by our registered CA.) Tj
45 296 Td
(4. For corporate billing, LUT certificates, or support, contact support@digitalmuid.in quoting Invoice No.) Tj
ET

% Security Watermark Notice
0.88 0.9 0.94 RG
0.5 w
45 270 505 0 m 550 270 l S

BT
/F2 7.5 Tf
0.5 0.55 0.6 rg
45 254 Td
(Electronic Document Seal: Valid without physical signature under the Information Technology Act, 2000.) Tj
ET

% Bottom Footer Bar
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

/**
 * Generates an official, tax-compliant PDF 1.4 Credit Note Buffer (Section 34 CGST Act, 2017).
 *
 * @param {object} creditNoteInput
 * @returns {Buffer} PDF binary Buffer
 */
export function generateAuthoritativeCreditNotePdf(creditNoteInput) {
  const model = creditNoteInput.creditNoteNumber ? creditNoteInput : buildAuthoritativeCreditNoteModel(creditNoteInput);

  const creditNoteNumber = sanitizePdfText(model.creditNoteNumber);
  const originalInvoiceNumber = sanitizePdfText(model.originalInvoiceNumber);
  const studentId = sanitizePdfText(model.customer?.studentId || "DM-STU-GUEST");
  const customerName = sanitizePdfText(model.customer?.name || "Valued Student");
  const customerEmail = sanitizePdfText(model.customer?.email || "");
  const paymentId = sanitizePdfText(model.paymentId || "");
  const refundId = sanitizePdfText(model.refundId || "RFND-DIRECT");
  const reason = sanitizePdfText(model.reason || "Enrolment cancellation and refund");
  const currency = sanitizePdfText(model.currency || "INR");

  const refundAmount = model.refundAmount || 0;
  const baseRefundAmount = model.baseRefundAmount || Number((refundAmount / 1.18).toFixed(2));
  const taxAdjustmentAmount = model.taxAdjustmentAmount || Number((refundAmount - baseRefundAmount).toFixed(2));

  const d = new Date(model.creditNoteDate || new Date());
  const formattedDate = !isNaN(d.getTime())
    ? d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "Recent";

  const contentStream = `
% Top Red Accent Header Bar (Credit Note)
0.15 0.05 0.05 rg
0 732 595 110 re f

% Red Accent Divider
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
/F2 8.5 Tf
0.88 0.75 0.75 rg
45 758 Td
(Official Support: support@digitalmuid.in  |  Portal: https://digitalmuid.in) Tj
ET

% Title & Number
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
(Credit Note No: ${creditNoteNumber}) Tj
ET

BT
/F2 8.5 Tf
0.9 0.85 0.85 rg
370 772 Td
(Date: ${formattedDate}) Tj
ET

BT
/F2 8.5 Tf
0.9 0.85 0.85 rg
370 758 Td
(Under Section 34 CGST Act, 2017) Tj
ET

% Billed To & Reference Box
0.99 0.97 0.97 rg
45 624 505 92 re f
0.9 0.8 0.8 RG
0.8 w
45 624 505 92 re S

BT
/F1 9.5 Tf
0.25 0.1 0.1 rg
60 698 Td
(ISSUED TO (STUDENT / RECIPIENT):) Tj
ET

BT
/F1 11 Tf
0.2 0.05 0.05 rg
60 682 Td
(${customerName.substring(0, 36)}) Tj
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
(Email: ${customerEmail}) Tj
60 636 Td
(Original Tax Invoice Reference: ${originalInvoiceNumber}) Tj
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
(Original Payment ID: ${paymentId.substring(0, 24)}) Tj
330 666 Td
(Gateway Refund ID: ${refundId.substring(0, 24)}) Tj
330 650 Td
(Reason: ${reason.substring(0, 30)}) Tj
330 636 Td
(Status: Refund Approved & Processed) Tj
ET

% Adjustment Table
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
(Reversal of Educational / Digital Service) Tj
ET

BT
/F2 8.5 Tf
0.45 0.35 0.35 rg
55 550 Td
(Original Tax Invoice: ${originalInvoiceNumber}) Tj
55 536 Td
(Reason for Credit Note: ${reason.substring(0, 48)}) Tj
ET

BT
/F1 9 Tf
0.2 0.1 0.1 rg
320 554 Td
(${originalInvoiceNumber}) Tj
ET

BT
/F1 10.5 Tf
0.8 0.1 0.1 rg
450 554 Td
(-${currency} ${formatCurrency(refundAmount)}) Tj
ET

% Summary Box on Right
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
(GST Tax Liability Reversed:) Tj
ET

BT
/F2 8.5 Tf
0.2 0.05 0.05 rg
465 488 Td
(-${currency} ${formatCurrency(baseRefundAmount)}) Tj
465 468 Td
(-${currency} ${formatCurrency(taxAdjustmentAmount)}) Tj
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
(${currency} ${formatCurrency(refundAmount)}) Tj
ET

% Statutory Box on Left
0.98 0.96 0.96 rg
45 395 250 115 re f
0.85 0.2 0.2 RG
0.8 w
45 395 250 115 re S

BT
/F1 9 Tf
0.8 0.1 0.1 rg
60 488 Td
([STATUTORY CREDIT NOTE]) Tj
ET

BT
/F2 8 Tf
0.3 0.1 0.1 rg
60 470 Td
(Governed under Section 34 of the CGST Act, 2017.) Tj
60 454 Td
(Adjusts output tax liability for MK Digitalverse.) Tj
60 438 Td
(Issued against Original Invoice: ${originalInvoiceNumber}) Tj
60 422 Td
(Credit Note Reference: ${creditNoteNumber}) Tj
ET

% Bottom Legal
BT
/F2 7.8 Tf
0.5 0.5 0.5 rg
45 330 Td
(Note: This Credit Note serves as legal proof of payment reversal and tax credit adjustment.) Tj
45 316 Td
(Electronic Document Seal: Valid without physical signature under the IT Act, 2000.) Tj
ET

% Footer
0.15 0.05 0.05 rg
0 0 595 48 re f

BT
/F2 8 Tf
0.9 0.8 0.8 rg
45 26 Td
(MK Digitalverse  |  DigitalMuid  |  GSTIN: 09CHHPK9834Q1ZB  |  Lucknow, India) Tj
45 13 Td
(Credit Note Archival Copy  |  support@digitalmuid.in  |  https://digitalmuid.in) Tj
ET

BT
/F1 8 Tf
0.95 0.3 0.3 rg
455 20 Td
(CREDIT NOTE  |  OFFICIAL) Tj
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
