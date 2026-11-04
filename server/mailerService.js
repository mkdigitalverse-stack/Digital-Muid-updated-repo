/**
 * DigitalMUID Server-Side Transactional Email Service
 * Powered by Resend API (https://resend.com)
 *
 * Responsibilities:
 * 1. Dispatches cryptographically verified purchase confirmation emails.
 * 2. Attaches authoritative PDF tax receipts and standards-compliant .ics calendar invites.
 * 3. Enforces strict idempotency and deduplication across webhooks and browser verification calls.
 * 4. Logs all delivery attempts, provider message IDs, and failure reasons to public.email_logs.
 * 5. Fails gracefully without throwing uncaught exceptions or breaking payment responses.
 */

import { Resend } from "resend";
import { getSupabaseServerClient } from "./supabaseServer.js";
import { generateAuthoritativeInvoicePdf } from "./invoiceService.js";
import { generateConsultationIcsBuffer } from "./calendarService.js";
import { assertSideEffectAllowed } from "./developmentSafetyGate.js";

// In-memory deduplication set to block concurrent duplicate requests (e.g. concurrent webhook + client verify)
const inMemorySentCache = new Map();

/**
 * Checks whether Resend credentials are configured.
 * @returns {boolean}
 */
export function isMailerConfigured() {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  return Boolean(apiKey && !apiKey.includes("placeholder") && apiKey.startsWith("re_"));
}

/**
 * Returns the configured transactional sender address.
 * Resend requires emails to be sent from a domain verified in the Resend dashboard.
 * @returns {string}
 */
export function getSenderEmail() {
  const explicit = (process.env.TRANSACTIONAL_SENDER_EMAIL || process.env.SENDER_EMAIL || "").trim();
  if (explicit && !explicit.includes("placeholder")) {
    return explicit;
  }
  // Standard production verified sender format
  return "DigitalMuid Support <support@digitalmuid.in>";
}

/**
 * Lazy initializer for Resend client.
 * Returns null if unconfigured or if running in development without safe staging isolation.
 * @returns {Resend | null}
 */
function getResendClient() {
  if (!isMailerConfigured()) {
    return null;
  }

  const sideEffectCheck = assertSideEffectAllowed("email_dispatch");
  if (!sideEffectCheck.allowed) {
    console.warn(`[SAFETY GUARD] Blocked Resend email dispatch in development: ${sideEffectCheck.code}`);
    return null;
  }

  try {
    return new Resend(process.env.RESEND_API_KEY.trim());
  } catch (err) {
    console.error("[Mailer Service] Failed to initialize Resend client:", err?.message || err);
    return null;
  }
}

/**
 * Checks if an email has already been dispatched for this payment and template type.
 *
 * @param {string} paymentId
 * @param {string} templateType
 * @returns {Promise<boolean>}
 */
export async function hasAlreadySent(paymentId, templateType) {
  if (!paymentId) return false;

  const cacheKey = `${paymentId}_${templateType}`;
  if (inMemorySentCache.has(cacheKey)) {
    return true;
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return false;

  try {
    const { data } = await supabase
      .from("email_logs")
      .select("id, status")
      .eq("payment_id", paymentId)
      .eq("template_type", templateType)
      .eq("status", "sent")
      .maybeSingle();

    if (data && data.status === "sent") {
      inMemorySentCache.set(cacheKey, { timestamp: Date.now(), id: data.id });
      return true;
    }
  } catch (dbErr) {
    // If table doesn't exist yet, fallback gracefully
    if (dbErr?.code !== "PGRST205") {
      console.warn("[Mailer Service] Notice checking email_logs:", dbErr?.message);
    }
  }

  return false;
}

/**
 * Records an email delivery attempt into public.email_logs.
 *
 * @param {object} params
 * @param {string} params.paymentId
 * @param {string} [params.orderId]
 * @param {string} params.recipientEmail
 * @param {string} params.templateType
 * @param {'sent' | 'failed' | 'skipped' | 'pending'} params.status
 * @param {string} [params.providerMessageId]
 * @param {string} [params.errorMessage]
 * @param {object} [params.metadata]
 */
async function recordEmailLog({
  paymentId,
  orderId,
  recipientEmail,
  templateType,
  status,
  providerMessageId = null,
  errorMessage = null,
  metadata = {}
}) {
  const cacheKey = `${paymentId}_${templateType}`;
  if (status === "sent") {
    inMemorySentCache.set(cacheKey, {
      timestamp: Date.now(),
      providerMessageId
    });
  }

  const sideEffectCheck = assertSideEffectAllowed("database_mutation");
  if (!sideEffectCheck.allowed) {
    console.warn(`[SAFETY GUARD] Skipped email_logs write in development: ${sideEffectCheck.code}`);
    return;
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  try {
    const logPayload = {
      payment_id: paymentId || null,
      order_id: orderId || null,
      recipient_email: String(recipientEmail || "").trim().toLowerCase(),
      template_type: templateType,
      status,
      provider: "resend",
      provider_message_id: providerMessageId,
      error_message: errorMessage ? String(errorMessage).slice(0, 1000) : null,
      metadata: metadata || {},
      updated_at: new Date().toISOString()
    };

    // Upsert on unique payment_id + template_type conflict
    await supabase.from("email_logs").upsert(logPayload, {
      onConflict: "payment_id,template_type"
    });
  } catch (err) {
    // Do not crash application if migration is pending
    if (err?.code !== "PGRST205") {
      console.warn("[Mailer Service] Notice persisting email log:", err?.message || err);
    }
  }
}

/**
 * Dispatches a Course Access & Payment Confirmation Email.
 *
 * @param {object} params
 * @param {string} params.to - Student email address
 * @param {string} [params.studentName] - Student full name
 * @param {string} params.courseTitle - Course title
 * @param {string} [params.courseSlug] - Course slug
 * @param {number} params.amount - Amount paid in Rupees
 * @param {string} [params.currency] - Currency (e.g. INR)
 * @param {string} params.orderId - Razorpay order ID
 * @param {string} params.paymentId - Razorpay payment ID
 * @returns {Promise<{ success: boolean, skipped?: boolean, messageId?: string, error?: string }>}
 */
export async function sendCourseAccessEmail({
  to,
  studentName = "Student Member",
  courseTitle,
  courseSlug = "",
  amount,
  currency = "INR",
  orderId,
  paymentId
}) {
  const templateType = "course_access";
  const recipient = (to || "").trim();

  if (!recipient || !recipient.includes("@")) {
    console.warn(`[Mailer Service] Skipped course email: Invalid recipient address "${recipient}".`);
    await recordEmailLog({
      paymentId,
      orderId,
      recipientEmail: recipient || "unknown",
      templateType,
      status: "failed",
      errorMessage: "Recipient email is missing or malformed."
    });
    return { success: false, error: "Invalid recipient email address." };
  }

  // Idempotency Check
  if (await hasAlreadySent(paymentId, templateType)) {
    console.log(`[Mailer Service] Deduplicated: Course access email already sent for payment ${paymentId}.`);
    return { success: true, skipped: true, reason: "ALREADY_SENT" };
  }

  // Generate authoritative tax invoice PDF buffer
  let invoiceBuffer = null;
  try {
    invoiceBuffer = generateAuthoritativeInvoicePdf({
      paymentId,
      orderId,
      customerName: studentName,
      customerEmail: recipient,
      itemTitle: courseTitle,
      itemType: "course",
      amount,
      currency
    });
  } catch (pdfErr) {
    console.error("[Mailer Service] Failed to generate invoice PDF buffer:", pdfErr);
  }

  const courseUrl = courseSlug
    ? `https://digitalmuid.in/learn/${encodeURIComponent(courseSlug)}`
    : "https://digitalmuid.in/dashboard";
  const dashboardUrl = "https://digitalmuid.in/dashboard";

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Course Access Confirmed</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="background-color: #0b132b; padding: 32px; text-align: left; border-bottom: 3px solid #ff6b00;">
              <span style="color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">DIGITAL<span style="color: #ff6b00;">MUID</span></span>
              <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Powered by MK Digitalverse</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 36px 32px;">
              <div style="display: inline-block; padding: 4px 12px; background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 9999px; color: #047857; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 16px;">
                Payment Confirmed · Masterclass Unlocked
              </div>
              <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 800; color: #0f172a; line-height: 1.3;">
                Welcome to DigitalMUID Academy, ${studentName}!
              </h1>
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #475569;">
                Your enrollment in <strong>${courseTitle}</strong> has been successfully processed and verified. Lifetime curriculum access has been provisioned to your account.
              </p>

              <!-- Transaction Summary Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 28px; padding: 16px;">
                <tr>
                  <td style="padding: 8px 12px; font-size: 13px; color: #64748b;">Course:</td>
                  <td style="padding: 8px 12px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right;">${courseTitle}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 12px; font-size: 13px; color: #64748b;">Total Paid:</td>
                  <td style="padding: 8px 12px; font-size: 14px; font-weight: 800; color: #059669; text-align: right;">₹${amount} ${currency}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 12px; font-size: 13px; color: #64748b;">Payment ID:</td>
                  <td style="padding: 8px 12px; font-size: 12px; font-family: monospace; color: #334155; text-align: right;">${paymentId}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 12px; font-size: 13px; color: #64748b;">Order Reference:</td>
                  <td style="padding: 8px 12px; font-size: 12px; font-family: monospace; color: #334155; text-align: right;">${orderId}</td>
                </tr>
              </table>

              <!-- Action CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <a href="${courseUrl}" style="display: inline-block; padding: 14px 32px; background-color: #ff6b00; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(255,107,0,0.3);">
                      Start Learning Now &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Instructions -->
              <h3 style="margin: 0 0 12px 0; font-size: 15px; font-weight: 700; color: #0f172a;">How to access your course anytime:</h3>
              <ol style="margin: 0 0 24px 0; padding-left: 20px; font-size: 14px; line-height: 1.6; color: #475569;">
                <li style="margin-bottom: 6px;">Sign in at <a href="${dashboardUrl}" style="color: #1877f2; text-decoration: none;">digitalmuid.in/dashboard</a> using this email address: <strong>${recipient}</strong>.</li>
                <li style="margin-bottom: 6px;">Track your lesson progress, download frameworks, and bookmark key modules.</li>
                <li style="margin-bottom: 6px;">Upon completing all modules, your verifiable completion certificate will be generated automatically.</li>
              </ol>

              <div style="background-color: #f1f5f9; border-radius: 8px; padding: 14px 16px; font-size: 13px; color: #64748b; line-height: 1.5;">
                <strong>Attached:</strong> Your official tax invoice and payment receipt (PDF) is attached to this email for your accounting records.
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 32px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
              <p style="margin: 0 0 6px 0;">Need learning support? Reply directly to this email or reach us at <a href="mailto:support@digitalmuid.in" style="color: #ff6b00; text-decoration: none;">support@digitalmuid.in</a> / +91 93358 17155.</p>
              <p style="margin: 0;">&copy; ${new Date().getFullYear()} DigitalMUID (Powered by MK Digitalverse). All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  const attachments = [];
  if (invoiceBuffer) {
    attachments.push({
      filename: `DigitalMUID-Invoice-${(paymentId || "receipt").slice(-8)}.pdf`,
      content: invoiceBuffer
    });
  }

  const resend = getResendClient();
  if (!resend) {
    console.warn(
      `[Mailer Service] RESEND_API_KEY is not configured. Course access email prepared for ${recipient} but delivery skipped.`
    );
    await recordEmailLog({
      paymentId,
      orderId,
      recipientEmail: recipient,
      templateType,
      status: "skipped",
      errorMessage: "RESEND_API_KEY is not configured on the server.",
      metadata: { courseTitle, amount, currency }
    });
    return { success: true, skipped: true, reason: "PROVIDER_NOT_CONFIGURED" };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: getSenderEmail(),
      to: [recipient],
      subject: `Confirmed: Your Access to ${courseTitle} — DigitalMUID Academy`,
      html: emailHtml,
      attachments
    });

    if (error) {
      console.error("[Mailer Service] Resend API rejected course email:", error);
      await recordEmailLog({
        paymentId,
        orderId,
        recipientEmail: recipient,
        templateType,
        status: "failed",
        errorMessage: error.message || JSON.stringify(error),
        metadata: { courseTitle, amount }
      });
      return { success: false, error: error.message };
    }

    console.log(`[Mailer Service] Course access email successfully dispatched to ${recipient} (id: ${data?.id})`);
    await recordEmailLog({
      paymentId,
      orderId,
      recipientEmail: recipient,
      templateType,
      status: "sent",
      providerMessageId: data?.id,
      metadata: { courseTitle, amount, currency }
    });

    return { success: true, messageId: data?.id };
  } catch (err) {
    console.error("[Mailer Service] Unexpected exception sending course email:", err);
    await recordEmailLog({
      paymentId,
      orderId,
      recipientEmail: recipient,
      templateType,
      status: "failed",
      errorMessage: err?.message || "Unexpected exception during send.",
      metadata: { courseTitle }
    });
    return { success: false, error: err?.message };
  }
}

/**
 * Dispatches a Consultation Booking Confirmation Email with .ICS invite and PDF invoice.
 *
 * @param {object} params
 * @param {string} params.to - Customer email address
 * @param {string} params.customerName - Customer name
 * @param {string} params.bookingCode - Unique booking code (e.g. DM-2026-1234)
 * @param {string} params.bookingDate - Booking date (YYYY-MM-DD)
 * @param {string} params.bookingTime - Booking time slot (HH:MM IST)
 * @param {number} [params.durationMinutes] - Session duration in minutes
 * @param {string} [params.meetUrl] - Google Meet link
 * @param {string} [params.primaryChallenge] - Primary challenge / focus area
 * @param {number} params.amount - Total amount paid
 * @param {string} [params.currency] - Currency
 * @param {number} [params.baseAmount] - Base amount
 * @param {number} [params.gstAmount] - GST amount
 * @param {string} params.orderId - Razorpay order ID
 * @param {string} params.paymentId - Razorpay payment ID
 * @returns {Promise<{ success: boolean, skipped?: boolean, messageId?: string, error?: string }>}
 */
export async function sendConsultationConfirmationEmail({
  to,
  customerName = "Valued Client",
  bookingCode,
  bookingDate,
  bookingTime,
  durationMinutes = 30,
  meetUrl = "https://meet.google.com",
  primaryChallenge = "Business Growth Strategy",
  amount,
  currency = "INR",
  baseAmount,
  gstAmount,
  orderId,
  paymentId
}) {
  const templateType = "consultation_confirmation";
  const recipient = (to || "").trim();

  if (!recipient || !recipient.includes("@")) {
    console.warn(`[Mailer Service] Skipped consultation email: Invalid recipient address "${recipient}".`);
    await recordEmailLog({
      paymentId,
      orderId,
      recipientEmail: recipient || "unknown",
      templateType,
      status: "failed",
      errorMessage: "Recipient email is missing or malformed."
    });
    return { success: false, error: "Invalid recipient email address." };
  }

  // Idempotency Check
  if (await hasAlreadySent(paymentId, templateType)) {
    console.log(`[Mailer Service] Deduplicated: Consultation confirmation already sent for payment ${paymentId}.`);
    return { success: true, skipped: true, reason: "ALREADY_SENT" };
  }

  // Generate authoritative attachments: PDF Invoice & Calendar .ICS file
  let invoiceBuffer = null;
  let icsBuffer = null;

  try {
    invoiceBuffer = generateAuthoritativeInvoicePdf({
      paymentId,
      orderId,
      customerName,
      customerEmail: recipient,
      itemTitle: "Strategic Business Growth & Scaling Consultation",
      itemType: "consultation",
      amount,
      currency,
      baseAmount,
      gstAmount
    });
  } catch (pdfErr) {
    console.error("[Mailer Service] Failed to generate consultation invoice PDF:", pdfErr);
  }

  try {
    icsBuffer = generateConsultationIcsBuffer({
      bookingCode,
      bookingDate,
      bookingTime,
      durationMinutes,
      customerName,
      customerEmail: recipient,
      meetUrl,
      primaryChallenge
    });
  } catch (icsErr) {
    console.error("[Mailer Service] Failed to generate consultation .ics calendar buffer:", icsErr);
  }

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Consultation Booking Confirmed</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="background-color: #0b132b; padding: 32px; text-align: left; border-bottom: 3px solid #ff6b00;">
              <span style="color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">DIGITAL<span style="color: #ff6b00;">MUID</span></span>
              <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Strategic Growth Advisory · Powered by MK Digitalverse</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 36px 32px;">
              <div style="display: inline-block; padding: 4px 12px; background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 9999px; color: #047857; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 16px;">
                Payment Verified · Booking Confirmed
              </div>
              <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 800; color: #0f172a; line-height: 1.3;">
                Your Consultation is Confirmed, ${customerName}!
              </h1>
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #475569;">
                Your 1-on-1 strategic growth session has been locked into our calendar. An official calendar invitation (.ics) and tax receipt are attached to this email.
              </p>

              <!-- Appointment Schedule Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 28px; padding: 20px;">
                <tr>
                  <td style="padding: 8px 12px; font-size: 13px; color: #64748b;">Booking Reference:</td>
                  <td style="padding: 8px 12px; font-size: 14px; font-weight: 800; color: #ff6b00; text-align: right; font-family: monospace;">${bookingCode}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 12px; font-size: 13px; color: #64748b;">Date:</td>
                  <td style="padding: 8px 12px; font-size: 14px; font-weight: 700; color: #0f172a; text-align: right;">${bookingDate}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 12px; font-size: 13px; color: #64748b;">Time:</td>
                  <td style="padding: 8px 12px; font-size: 14px; font-weight: 700; color: #0f172a; text-align: right;">${bookingTime} IST (${durationMinutes} Minutes)</td>
                </tr>
                <tr>
                  <td style="padding: 8px 12px; font-size: 13px; color: #64748b;">Platform:</td>
                  <td style="padding: 8px 12px; font-size: 13px; font-weight: 700; color: #1877f2; text-align: right;">Google Meet HD</td>
                </tr>
                <tr>
                  <td style="padding: 8px 12px; font-size: 13px; color: #64748b;">Total Paid (incl. 18% GST):</td>
                  <td style="padding: 8px 12px; font-size: 14px; font-weight: 800; color: #059669; text-align: right;">₹${amount} ${currency}</td>
                </tr>
              </table>

              <!-- Google Meet CTA -->
              ${meetUrl ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <a href="${meetUrl}" style="display: inline-block; padding: 14px 32px; background-color: #1877f2; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(24,119,242,0.3);">
                      Open Google Meet Room &rarr;
                    </a>
                  </td>
                </tr>
              </table>
              ` : ""}

              <!-- Preparation Checklist -->
              <h3 style="margin: 0 0 12px 0; font-size: 15px; font-weight: 700; color: #0f172a;">How to prepare for your session:</h3>
              <ul style="margin: 0 0 24px 0; padding-left: 20px; font-size: 14px; line-height: 1.6; color: #475569;">
                <li style="margin-bottom: 6px;"><strong>Add to Calendar:</strong> Open the attached <code>.ics</code> file to immediately sync this meeting with Google Calendar, Outlook, or Apple Calendar.</li>
                <li style="margin-bottom: 6px;"><strong>Primary Focus:</strong> We will be reviewing: <em>"${primaryChallenge}"</em>.</li>
                <li style="margin-bottom: 6px;"><strong>Metrics Ready:</strong> Please have your current ad accounts, website analytics, or funnel metrics accessible if you would like a live audit during the call.</li>
              </ul>

              <div style="background-color: #f1f5f9; border-radius: 8px; padding: 14px 16px; font-size: 13px; color: #64748b; line-height: 1.5;">
                <strong>Attached:</strong> Official Tax Invoice / Payment Receipt (PDF) and Calendar Invitation (.ics).
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 32px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
              <p style="margin: 0 0 6px 0;">Need to reschedule? Please email <a href="mailto:support@digitalmuid.in" style="color: #ff6b00; text-decoration: none;">support@digitalmuid.in</a> at least 24 hours prior to your scheduled time.</p>
              <p style="margin: 0;">&copy; ${new Date().getFullYear()} DigitalMUID (Powered by MK Digitalverse). All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  const attachments = [];
  if (invoiceBuffer) {
    attachments.push({
      filename: `DigitalMUID-Tax-Invoice-${bookingCode}.pdf`,
      content: invoiceBuffer
    });
  }
  if (icsBuffer) {
    attachments.push({
      filename: `DigitalMUID-Consultation-${bookingCode}.ics`,
      content: icsBuffer
    });
  }

  const resend = getResendClient();
  if (!resend) {
    console.warn(
      `[Mailer Service] RESEND_API_KEY is not configured. Consultation confirmation prepared for ${recipient} but delivery skipped.`
    );
    await recordEmailLog({
      paymentId,
      orderId,
      recipientEmail: recipient,
      templateType,
      status: "skipped",
      errorMessage: "RESEND_API_KEY is not configured on the server.",
      metadata: { bookingCode, bookingDate, bookingTime, amount }
    });
    return { success: true, skipped: true, reason: "PROVIDER_NOT_CONFIGURED" };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: getSenderEmail(),
      to: [recipient],
      subject: `Confirmed: Consultation on ${bookingDate} at ${bookingTime} IST [Ref: ${bookingCode}]`,
      html: emailHtml,
      attachments
    });

    if (error) {
      console.error("[Mailer Service] Resend API rejected consultation confirmation:", error);
      await recordEmailLog({
        paymentId,
        orderId,
        recipientEmail: recipient,
        templateType,
        status: "failed",
        errorMessage: error.message || JSON.stringify(error),
        metadata: { bookingCode, amount }
      });
      return { success: false, error: error.message };
    }

    console.log(`[Mailer Service] Consultation confirmation successfully dispatched to ${recipient} (id: ${data?.id})`);
    await recordEmailLog({
      paymentId,
      orderId,
      recipientEmail: recipient,
      templateType,
      status: "sent",
      providerMessageId: data?.id,
      metadata: { bookingCode, amount, currency }
    });

    return { success: true, messageId: data?.id };
  } catch (err) {
    console.error("[Mailer Service] Unexpected exception sending consultation confirmation:", err);
    await recordEmailLog({
      paymentId,
      orderId,
      recipientEmail: recipient,
      templateType,
      status: "failed",
      errorMessage: err?.message || "Unexpected exception during send.",
      metadata: { bookingCode }
    });
    return { success: false, error: err?.message };
  }
}

/**
 * Dispatches a Paid Resource Delivery Email with download link and PDF invoice.
 *
 * @param {object} params
 * @param {string} params.to - Customer email
 * @param {string} [params.customerName] - Customer name
 * @param {string} params.resourceTitle - Resource title
 * @param {string} params.resourceId - Resource UUID or slug
 * @param {number} params.amount - Amount paid
 * @param {string} [params.currency] - Currency
 * @param {string} params.orderId - Razorpay order ID
 * @param {string} params.paymentId - Razorpay payment ID
 * @returns {Promise<{ success: boolean, skipped?: boolean, messageId?: string, error?: string }>}
 */
export async function sendResourceDeliveryEmail({
  to,
  customerName = "Valued Customer",
  resourceTitle,
  resourceId,
  amount,
  currency = "INR",
  orderId,
  paymentId
}) {
  const templateType = "resource_delivery";
  const recipient = (to || "").trim();

  if (!recipient || !recipient.includes("@")) {
    console.warn(`[Mailer Service] Skipped resource email: Invalid recipient address "${recipient}".`);
    await recordEmailLog({
      paymentId,
      orderId,
      recipientEmail: recipient || "unknown",
      templateType,
      status: "failed",
      errorMessage: "Recipient email is missing or malformed."
    });
    return { success: false, error: "Invalid recipient email address." };
  }

  // Idempotency Check
  if (await hasAlreadySent(paymentId, templateType)) {
    console.log(`[Mailer Service] Deduplicated: Resource delivery email already sent for payment ${paymentId}.`);
    return { success: true, skipped: true, reason: "ALREADY_SENT" };
  }

  // Generate authoritative tax invoice PDF buffer
  let invoiceBuffer = null;
  try {
    invoiceBuffer = generateAuthoritativeInvoicePdf({
      paymentId,
      orderId,
      customerName,
      customerEmail: recipient,
      itemTitle: resourceTitle,
      itemType: "resource",
      amount,
      currency
    });
  } catch (pdfErr) {
    console.error("[Mailer Service] Failed to generate resource invoice PDF:", pdfErr);
  }

  const accessUrl = `https://digitalmuid.in/resources/thank-you?resourceId=${encodeURIComponent(resourceId)}&orderId=${encodeURIComponent(orderId)}&paymentId=${encodeURIComponent(paymentId)}`;
  const dashboardUrl = "https://digitalmuid.in/dashboard";

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Resource Access Link & Receipt</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="background-color: #0b132b; padding: 32px; text-align: left; border-bottom: 3px solid #ff6b00;">
              <span style="color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">DIGITAL<span style="color: #ff6b00;">MUID</span></span>
              <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Digital Growth Assets · Powered by MK Digitalverse</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 36px 32px;">
              <div style="display: inline-block; padding: 4px 12px; background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 9999px; color: #047857; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 16px;">
                Payment Verified · Asset Ready
              </div>
              <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 800; color: #0f172a; line-height: 1.3;">
                Here is your access link, ${customerName}!
              </h1>
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #475569;">
                Thank you for purchasing <strong>${resourceTitle}</strong>. Your payment has been confirmed, and your license is permanently active.
              </p>

              <!-- Transaction Summary Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 28px; padding: 16px;">
                <tr>
                  <td style="padding: 8px 12px; font-size: 13px; color: #64748b;">Asset Title:</td>
                  <td style="padding: 8px 12px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right;">${resourceTitle}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 12px; font-size: 13px; color: #64748b;">Amount Paid:</td>
                  <td style="padding: 8px 12px; font-size: 14px; font-weight: 800; color: #059669; text-align: right;">₹${amount} ${currency}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 12px; font-size: 13px; color: #64748b;">Payment ID:</td>
                  <td style="padding: 8px 12px; font-size: 12px; font-family: monospace; color: #334155; text-align: right;">${paymentId}</td>
                </tr>
              </table>

              <!-- Action CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <a href="${accessUrl}" style="display: inline-block; padding: 14px 32px; background-color: #ff6b00; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(255,107,0,0.3);">
                      Download Resource Assets Now &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                You can also re-download this resource anytime by logging into your student dashboard at <a href="${dashboardUrl}" style="color: #1877f2; text-decoration: none;">digitalmuid.in/dashboard</a> with this email address.
              </p>

              <div style="background-color: #f1f5f9; border-radius: 8px; padding: 14px 16px; font-size: 13px; color: #64748b; line-height: 1.5;">
                <strong>Attached:</strong> Your official tax invoice and payment receipt (PDF) is attached to this email.
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 32px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
              <p style="margin: 0 0 6px 0;">Questions about your toolkit? Reach out to <a href="mailto:support@digitalmuid.in" style="color: #ff6b00; text-decoration: none;">support@digitalmuid.in</a>.</p>
              <p style="margin: 0;">&copy; ${new Date().getFullYear()} DigitalMUID (Powered by MK Digitalverse). All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  const attachments = [];
  if (invoiceBuffer) {
    attachments.push({
      filename: `DigitalMUID-Receipt-${(paymentId || "resource").slice(-8)}.pdf`,
      content: invoiceBuffer
    });
  }

  const resend = getResendClient();
  if (!resend) {
    console.warn(
      `[Mailer Service] RESEND_API_KEY is not configured. Resource delivery email prepared for ${recipient} but delivery skipped.`
    );
    await recordEmailLog({
      paymentId,
      orderId,
      recipientEmail: recipient,
      templateType,
      status: "skipped",
      errorMessage: "RESEND_API_KEY is not configured on the server.",
      metadata: { resourceTitle, amount }
    });
    return { success: true, skipped: true, reason: "PROVIDER_NOT_CONFIGURED" };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: getSenderEmail(),
      to: [recipient],
      subject: `Receipt & Access Link: ${resourceTitle} — DigitalMUID Toolkit`,
      html: emailHtml,
      attachments
    });

    if (error) {
      console.error("[Mailer Service] Resend API rejected resource email:", error);
      await recordEmailLog({
        paymentId,
        orderId,
        recipientEmail: recipient,
        templateType,
        status: "failed",
        errorMessage: error.message || JSON.stringify(error),
        metadata: { resourceTitle, amount }
      });
      return { success: false, error: error.message };
    }

    console.log(`[Mailer Service] Resource delivery email successfully dispatched to ${recipient} (id: ${data?.id})`);
    await recordEmailLog({
      paymentId,
      orderId,
      recipientEmail: recipient,
      templateType,
      status: "sent",
      providerMessageId: data?.id,
      metadata: { resourceTitle, amount, currency }
    });

    return { success: true, messageId: data?.id };
  } catch (err) {
    console.error("[Mailer Service] Unexpected exception sending resource email:", err);
    await recordEmailLog({
      paymentId,
      orderId,
      recipientEmail: recipient,
      templateType,
      status: "failed",
      errorMessage: err?.message || "Unexpected exception during send.",
      metadata: { resourceTitle }
    });
    return { success: false, error: err?.message };
  }
}

/**
 * Dispatches a Free Resource Lead Magnet Confirmation Email.
 *
 * @param {object} params
 * @param {string} params.to - Recipient email address
 * @param {string} [params.customerName] - Recipient name
 * @param {string} params.resourceTitle - Title of the resource unlocked
 * @param {string} [params.downloadUrl] - Direct download / thank you link
 * @param {string} [params.leadId] - Lead ID
 * @returns {Promise<{ success: boolean, skipped?: boolean, messageId?: string, error?: string }>}
 */
export async function sendFreeResourceLeadEmail({
  to,
  customerName = "Professional Colleague",
  resourceTitle,
  downloadUrl = "https://digitalmuid.in/resources",
  leadId = ""
}) {
  const templateType = "free_resource_lead";
  const recipient = (to || "").trim();

  if (!recipient || !recipient.includes("@")) {
    console.warn(`[Mailer Service] Skipped free resource email: Invalid recipient address "${recipient}".`);
    return { success: false, error: "Invalid recipient email address." };
  }

  const resend = getResendClient();
  if (!resend) {
    console.warn(
      `[Mailer Service] RESEND_API_KEY is not configured or gated. Free resource email prepared for ${recipient} but delivery skipped.`
    );
    await recordEmailLog({
      paymentId: leadId || `lead_${Date.now()}`,
      orderId: "free_lead",
      recipientEmail: recipient,
      templateType,
      status: "skipped",
      errorMessage: "RESEND_API_KEY is not configured or in development guard.",
      metadata: { resourceTitle, leadId }
    });
    return { success: true, skipped: true, reason: "PROVIDER_NOT_CONFIGURED" };
  }

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Free Resource Access Link</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <tr>
            <td style="background-color: #0b132b; padding: 32px; text-align: left; border-bottom: 3px solid #ff6b00;">
              <span style="color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">DIGITAL<span style="color: #ff6b00;">MUID</span></span>
              <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Powered by MK Digitalverse</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 36px 32px;">
              <div style="display: inline-block; padding: 4px 12px; background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 9999px; color: #1d4ed8; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 16px;">
                Toolkit Unlocked · Direct Access
              </div>
              <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 800; color: #0f172a; line-height: 1.3;">
                Here is your toolkit, ${customerName}!
              </h1>
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #475569;">
                Thank you for requesting <strong>${resourceTitle}</strong>. Your instant access link is ready below.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <a href="${downloadUrl}" style="display: inline-block; background-color: #ff6b00; color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(255, 107, 0, 0.3);">
                      DOWNLOAD YOUR TOOLKIT NOW &rarr;
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.6;">
                If you have any questions or need custom advisory, reply to this email or reach us at <a href="mailto:support@digitalmuid.in" style="color: #ff6b00; text-decoration: none; font-weight: 600;">support@digitalmuid.in</a>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f1f5f9; padding: 20px 32px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
              &copy; ${new Date().getFullYear()} DigitalMUID &bull; Powered by MK Digitalverse &bull; All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    const { data, error } = await resend.emails.send({
      from: getSenderEmail(),
      to: [recipient],
      subject: `Your Toolkit: ${resourceTitle} — DigitalMuid Support`,
      html: emailHtml
    });

    if (error) {
      console.error("[Mailer Service] Resend rejected free resource email:", error);
      return { success: false, error: error.message };
    }

    await recordEmailLog({
      paymentId: leadId || `lead_${Date.now()}`,
      orderId: "free_lead",
      recipientEmail: recipient,
      templateType,
      status: "sent",
      providerMessageId: data?.id,
      metadata: { resourceTitle, leadId }
    });

    return { success: true, messageId: data?.id };
  } catch (err) {
    console.error("[Mailer Service] Unexpected exception sending free resource email:", err);
    return { success: false, error: err?.message };
  }
}

/**
 * Dispatches a Web Project Enquiry Confirmation Email.
 *
 * @param {object} params
 * @param {string} params.to - Recipient email
 * @param {string} [params.customerName] - Recipient name
 * @param {string} [params.projectType] - Type of project
 * @param {string} [params.businessName] - Client business name
 * @param {string} params.referenceId - Tracking reference code
 * @returns {Promise<{ success: boolean, skipped?: boolean, messageId?: string, error?: string }>}
 */
export async function sendWebEnquiryConfirmationEmail({
  to,
  customerName = "Valued Client",
  projectType = "Website & Digital Platform",
  businessName = "Your Project",
  referenceId
}) {
  const templateType = "web_enquiry_confirmation";
  const recipient = (to || "").trim();

  if (!recipient || !recipient.includes("@")) {
    console.warn(`[Mailer Service] Skipped web enquiry email: Invalid recipient address "${recipient}".`);
    return { success: false, error: "Invalid recipient email address." };
  }

  const resend = getResendClient();
  if (!resend) {
    console.warn(
      `[Mailer Service] RESEND_API_KEY is not configured or gated. Web enquiry confirmation skipped for ${recipient}.`
    );
    await recordEmailLog({
      paymentId: referenceId || `enquiry_${Date.now()}`,
      orderId: referenceId || "web_enquiry",
      recipientEmail: recipient,
      templateType,
      status: "skipped",
      errorMessage: "RESEND_API_KEY is not configured or in development guard.",
      metadata: { projectType, businessName, referenceId }
    });
    return { success: true, skipped: true, reason: "PROVIDER_NOT_CONFIGURED" };
  }

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>We Received Your Website Project Enquiry</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <tr>
            <td style="background-color: #0b132b; padding: 32px; text-align: left; border-bottom: 3px solid #ff6b00;">
              <span style="color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">DIGITAL<span style="color: #ff6b00;">MUID</span></span>
              <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Web Development & Performance Engineering</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 36px 32px;">
              <div style="display: inline-block; padding: 4px 12px; background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 9999px; color: #047857; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 16px;">
                Enquiry Received · Reference: ${referenceId}
              </div>
              <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 800; color: #0f172a; line-height: 1.3;">
                Thank you, ${customerName}!
              </h1>
              <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #475569;">
                We have received your project enquiry for <strong>${businessName}</strong> (${projectType}). Our engineering and strategy team is reviewing your requirements and will reach out within 24 business hours.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 24px; padding: 16px;">
                <tr>
                  <td style="padding: 6px 12px; font-size: 13px; color: #64748b;">Project Scope:</td>
                  <td style="padding: 6px 12px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right;">${projectType}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 12px; font-size: 13px; color: #64748b;">Business:</td>
                  <td style="padding: 6px 12px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right;">${businessName}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 12px; font-size: 13px; color: #64748b;">Tracking Reference:</td>
                  <td style="padding: 6px 12px; font-size: 12px; font-family: monospace; font-weight: 700; color: #ff6b00; text-align: right;">${referenceId}</td>
                </tr>
              </table>
              <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.6;">
                If you have immediate questions or want to provide additional specification files, reply directly to this email or write to <a href="mailto:support@digitalmuid.in" style="color: #ff6b00; text-decoration: none; font-weight: 600;">support@digitalmuid.in</a>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f1f5f9; padding: 20px 32px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
              &copy; ${new Date().getFullYear()} DigitalMUID &bull; Powered by MK Digitalverse &bull; All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    const { data, error } = await resend.emails.send({
      from: getSenderEmail(),
      to: [recipient],
      subject: `Project Enquiry Received: ${referenceId} — DigitalMuid Support`,
      html: emailHtml
    });

    if (error) {
      console.error("[Mailer Service] Resend rejected web enquiry email:", error);
      return { success: false, error: error.message };
    }

    await recordEmailLog({
      paymentId: referenceId,
      orderId: referenceId,
      recipientEmail: recipient,
      templateType,
      status: "sent",
      providerMessageId: data?.id,
      metadata: { projectType, businessName, referenceId }
    });

    return { success: true, messageId: data?.id };
  } catch (err) {
    console.error("[Mailer Service] Unexpected exception sending web enquiry email:", err);
    return { success: false, error: err?.message };
  }
}

/**
 * Dispatches an Account Welcome Registration Email.
 *
 * @param {object} params
 * @param {string} params.to - New user email
 * @param {string} [params.customerName] - User display name
 * @param {string} [params.loginUrl] - Portal login URL
 * @returns {Promise<{ success: boolean, skipped?: boolean, messageId?: string, error?: string }>}
 */
export async function sendWelcomeRegistrationEmail({
  to,
  customerName = "Member",
  loginUrl = "https://digitalmuid.in/login"
}) {
  const templateType = "welcome_registration";
  const recipient = (to || "").trim();

  if (!recipient || !recipient.includes("@")) {
    console.warn(`[Mailer Service] Skipped welcome email: Invalid recipient address "${recipient}".`);
    return { success: false, error: "Invalid recipient email address." };
  }

  const trackingKey = `welcome_${recipient.toLowerCase()}`;

  // Idempotency check: prevent duplicate welcome emails
  if (await hasAlreadySent(trackingKey, templateType)) {
    console.log(`[Mailer Service] Deduplicated: Welcome email already sent to ${recipient}.`);
    return { success: true, skipped: true, reason: "ALREADY_SENT" };
  }

  const resend = getResendClient();
  if (!resend) {
    console.warn(
      `[Mailer Service] RESEND_API_KEY is not configured or gated. Welcome email skipped for ${recipient}.`
    );
    await recordEmailLog({
      paymentId: trackingKey,
      recipientEmail: recipient,
      templateType,
      status: "skipped",
      errorMessage: "RESEND_API_KEY is not configured or gated on the server.",
      metadata: { customerName }
    });
    return { success: true, skipped: true, reason: "PROVIDER_NOT_CONFIGURED" };
  }

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to DigitalMUID</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <tr>
            <td style="background-color: #0b132b; padding: 32px; text-align: left; border-bottom: 3px solid #ff6b00;">
              <span style="color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">DIGITAL<span style="color: #ff6b00;">MUID</span></span>
              <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Powered by MK Digitalverse</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 36px 32px;">
              <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 800; color: #0f172a; line-height: 1.3;">
                Welcome to DigitalMUID, ${customerName}!
              </h1>
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #475569;">
                Your account is ready. Access the academy, track your course progress, explore toolkits, and manage your advisory appointments all from your unified dashboard.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <a href="${loginUrl}" style="display: inline-block; background-color: #0b132b; color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 10px;">
                      GO TO YOUR DASHBOARD &rarr;
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.6;">
                Need help? Contact our support team any time at <a href="mailto:support@digitalmuid.in" style="color: #ff6b00; text-decoration: none; font-weight: 600;">support@digitalmuid.in</a>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f1f5f9; padding: 20px 32px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
              &copy; ${new Date().getFullYear()} DigitalMUID &bull; Powered by MK Digitalverse &bull; All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    const { data, error } = await resend.emails.send({
      from: getSenderEmail(),
      to: [recipient],
      subject: `Welcome to DigitalMUID — DigitalMuid Support`,
      html: emailHtml
    });

    if (error) {
      console.error("[Mailer Service] Resend rejected welcome email:", error);
      await recordEmailLog({
        paymentId: trackingKey,
        recipientEmail: recipient,
        templateType,
        status: "failed",
        errorMessage: error.message || JSON.stringify(error),
        metadata: { customerName }
      });
      return { success: false, error: error.message };
    }

    console.log(`[Mailer Service] Welcome registration email dispatched to ${recipient} (id: ${data?.id})`);
    await recordEmailLog({
      paymentId: trackingKey,
      recipientEmail: recipient,
      templateType,
      status: "sent",
      providerMessageId: data?.id,
      metadata: { customerName }
    });

    return { success: true, messageId: data?.id };
  } catch (err) {
    console.error("[Mailer Service] Unexpected exception sending welcome email:", err);
    await recordEmailLog({
      paymentId: trackingKey,
      recipientEmail: recipient,
      templateType,
      status: "failed",
      errorMessage: err?.message || "Unexpected exception during send.",
      metadata: { customerName }
    });
    return { success: false, error: err?.message };
  }
}

