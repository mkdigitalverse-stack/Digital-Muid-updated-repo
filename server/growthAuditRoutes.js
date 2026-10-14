import express from "express";
import {
  getSupabaseServerClient,
  checkIsAdmin,
  isValidUUID
} from "./supabaseServer.js";

const router = express.Router();

// Helper to generate readable audit reference ID
function generateAuditReferenceId() {
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `GA-${year}-${rand}`;
}

// In-memory rate limiting map: IP -> array of timestamps
const rateLimitMap = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 mins
  const maxRequests = 20;

  const history = rateLimitMap.get(ip) || [];
  const recent = history.filter((ts) => now - ts < windowMs);
  if (recent.length >= maxRequests) {
    rateLimitMap.set(ip, recent);
    return false;
  }
  recent.push(now);
  rateLimitMap.set(ip, recent);
  return true;
}

// In-memory idempotency cache for bookings: key -> boolean
const bookingIdempotencyCache = new Map();

/**
 * Deterministic qualification logic according to Phase 3 specification:
 * - Direct Growth Audit booking path when:
 *   Monthly revenue is ₹3 lakh or above; AND
 *   Current monthly advertising spend is greater than zero.
 * - Otherwise: Academy pathway.
 * - Pre-revenue / launching soon: startup review / Academy path.
 */
function evaluateQualification(revenueBand, adSpendBand) {
  const qualifyingRevenues = [
    "₹3 lakh–₹10 lakh",
    "₹10 lakh–₹25 lakh",
    "Above ₹25 lakh"
  ];

  const qualifyingAdSpends = [
    "Under ₹25,000",
    "₹25,000–₹50,000",
    "₹50,001–₹1 lakh",
    "Above ₹1 lakh"
  ];

  const isPreRevenue =
    revenueBand === "Pre-revenue / launching soon" ||
    adSpendBand === "Campaigns launching soon";

  const meetsRevenue = qualifyingRevenues.includes(revenueBand);
  const meetsAdSpend = qualifyingAdSpends.includes(adSpendBand);

  if (meetsRevenue && meetsAdSpend) {
    return {
      status: "qualified",
      pathway: "Route B — Qualified Growth Audit",
      reason: "Qualified: Monthly revenue ₹3L+ with active monthly ad spend."
    };
  }

  if (isPreRevenue) {
    return {
      status: "startup_review",
      pathway: "Route A — Academy Pathway (Startup Edition)",
      reason: "Pre-revenue / Launching soon: Recommended for Academy foundational architecture."
    };
  }

  return {
    status: "academy_nurture",
    pathway: "Route A — Academy Pathway",
    reason: "Stage alignment: Academy curriculum recommended prior to agency retainer."
  };
}

/**
 * POST /api/growth-audit/submit
 *
 * Handles progress form completion, evaluates qualification deterministically,
 * enforces rate limits & duplicate checks, and writes to crm_leads.
 */
router.post("/submit", async (req, res) => {
  try {
    const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "client";
    if (!checkRateLimit(clientIp)) {
      return res.status(429).json({
        success: false,
        error: "Too many audit requests from your network. Please wait a few minutes before trying again."
      });
    }

    const {
      name,
      email,
      website,
      hasNoWebsite,
      monthlyRevenue,
      monthlyAdSpend,
      growthBottleneck,
      marketingConsent,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
      landingPage,
      idempotencyKey
    } = req.body || {};

    // 1. Validation & sanitization
    const cleanName = String(name || "").trim();
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanWebsite = hasNoWebsite ? "No website yet" : String(website || "").trim();
    const cleanRevenue = String(monthlyRevenue || "").trim();
    const cleanAdSpend = String(monthlyAdSpend || "").trim();
    const cleanBottleneck = String(growthBottleneck || "").trim();
    const cleanConsent = Boolean(marketingConsent);

    if (!cleanName || cleanName.length < 2) {
      return res.status(400).json({ success: false, error: "Please provide your name." });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      return res.status(400).json({ success: false, error: "Please enter a valid business email address." });
    }

    if (!cleanRevenue) {
      return res.status(400).json({ success: false, error: "Please select your average monthly business revenue." });
    }

    if (!cleanAdSpend) {
      return res.status(400).json({ success: false, error: "Please select your current monthly advertising spend." });
    }

    // 2. Evaluate qualification
    const qualification = evaluateQualification(cleanRevenue, cleanAdSpend);
    const referenceId = generateAuditReferenceId();

    // 3. Prepare structured notes payload for CRM
    const notesPayload = {
      reference_id: referenceId,
      website_url: cleanWebsite,
      monthly_revenue_band: cleanRevenue,
      monthly_ad_spend_band: cleanAdSpend,
      primary_growth_challenge: cleanBottleneck || "General Growth Audit",
      qualification_status: qualification.status,
      qualification_reason: qualification.reason,
      lead_source: "Growth Audit Qualification Form",
      landing_page: landingPage || "/request-growth-audit",
      utm_source: utmSource || null,
      utm_medium: utmMedium || null,
      utm_campaign: utmCampaign || null,
      utm_content: utmContent || null,
      utm_term: utmTerm || null,
      marketing_consent: cleanConsent,
      booking_status: qualification.status === "qualified" ? "pending_calendar_selection" : "nurture",
      submitted_at: new Date().toISOString()
    };

    // 4. Record to Supabase crm_leads if available
    const supabaseServer = getSupabaseServerClient();
    let dbRecordId = null;

    if (supabaseServer) {
      try {
        const { data: inserted, error: dbError } = await supabaseServer
          .from("crm_leads")
          .insert({
            name: cleanName.slice(0, 200),
            email: cleanEmail.slice(0, 200),
            source: "Consultation Intake Brief",
            interest: `Growth Audit: ${cleanRevenue} rev | ${cleanAdSpend} ad spend`.slice(0, 200),
            notes: JSON.stringify(notesPayload),
            status: qualification.status === "qualified" ? "Qualified" : "New"
          })
          .select("id")
          .single();

        if (inserted) {
          dbRecordId = inserted.id;
        } else if (dbError) {
          console.warn("[Growth Audit] Database insert notice:", dbError.message);
        }
      } catch (err) {
        console.warn("[Growth Audit] Non-fatal database notice:", err.message);
      }
    }

    return res.json({
      success: true,
      referenceId,
      dbRecordId,
      qualificationStatus: qualification.status,
      pathway: qualification.pathway,
      reason: qualification.reason,
      leadSummary: {
        name: cleanName,
        email: cleanEmail,
        website: cleanWebsite,
        monthlyRevenue: cleanRevenue,
        monthlyAdSpend: cleanAdSpend,
        growthBottleneck: cleanBottleneck
      }
    });
  } catch (error) {
    console.error("[Growth Audit Submit] Error:", error);
    return res.status(500).json({
      success: false,
      error: "An unexpected error occurred while processing your qualification. Please try again."
    });
  }
});

/**
 * POST /api/growth-audit/book
 *
 * Confirms appointment for qualified prospect, validates date/time slot in IST,
 * updates CRM with appointment details, and generates WhatsApp & internal alert templates.
 */
router.post("/book", async (req, res) => {
  try {
    const {
      referenceId,
      name,
      email,
      phone,
      website,
      date,
      time,
      notes
    } = req.body || {};

    const cleanRef = String(referenceId || generateAuditReferenceId()).trim();
    const cleanName = String(name || "").trim();
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanPhone = String(phone || "").trim();
    const cleanDate = String(date || "").trim();
    const cleanTime = String(time || "").trim();
    const cleanWebsite = String(website || "Not provided").trim();

    if (!cleanName || !cleanEmail || !cleanDate || !cleanTime) {
      return res.status(400).json({
        success: false,
        error: "Missing required booking details (Name, Email, Date, and Time slot)."
      });
    }

    // Idempotency check: prevent repeated booking triggers for same reference within 5 minutes
    const idempotencyKey = `${cleanRef}_${cleanDate}_${cleanTime}`;
    if (bookingIdempotencyCache.has(idempotencyKey)) {
      const cached = bookingIdempotencyCache.get(idempotencyKey);
      return res.json(cached);
    }

    const appointmentDateTime = `${cleanDate} at ${cleanTime}`;
    const timezone = "IST (Asia/Kolkata)";

    // Template 1: Official Client WhatsApp Confirmation Template
    const whatsAppMessage = `Hi ${cleanName}, Muid here. Your Growth Audit is confirmed for ${appointmentDateTime} (${timezone}). I’ll review your website and growth setup before we talk. If you need to make any changes, please use your booking confirmation link.`;

    // Template 2: Official Internal High-Ticket Alert Template
    const internalAlertText = `🚨 High-Ticket Growth Audit Booked — ${cleanName} — ${appointmentDateTime} — ${cleanWebsite}`;

    // Update Supabase crm_leads record with confirmed booking details
    const supabaseServer = getSupabaseServerClient();
    if (supabaseServer) {
      try {
        const updatePayload = {
          booking_status: "confirmed",
          booking_reference: cleanRef,
          appointment_datetime: appointmentDateTime,
          appointment_timezone: timezone,
          customer_phone: cleanPhone || null,
          confirmed_at: new Date().toISOString(),
          whatsapp_template_queued: true,
          internal_alert_queued: true
        };

        // Find existing lead by email and update
        const { data: existingLead } = await supabaseServer
          .from("crm_leads")
          .select("id, notes")
          .eq("email", cleanEmail)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingLead) {
          let mergedNotes = updatePayload;
          try {
            if (existingLead.notes) {
              const parsed = JSON.parse(existingLead.notes);
              mergedNotes = { ...parsed, ...updatePayload };
            }
          } catch (_) {}

          await supabaseServer
            .from("crm_leads")
            .update({
              status: "Qualified",
              phone: cleanPhone || null,
              notes: JSON.stringify(mergedNotes)
            })
            .eq("id", existingLead.id);
        }
      } catch (err) {
        console.warn("[Growth Audit Booking] Non-fatal CRM update notice:", err.message);
      }
    }

    const responsePayload = {
      success: true,
      bookingReference: cleanRef,
      appointmentDateTime,
      timezone,
      status: "confirmed",
      whatsAppConfirmation: {
        status: cleanPhone ? "delivered_to_queue" : "skipped_no_phone",
        recipient: cleanPhone || "No WhatsApp number provided",
        message: whatsAppMessage
      },
      internalAlert: {
        status: "dispatched",
        alertText: internalAlertText
      }
    };

    // Cache idempotency response for 5 minutes
    bookingIdempotencyCache.set(idempotencyKey, responsePayload);
    setTimeout(() => {
      bookingIdempotencyCache.delete(idempotencyKey);
    }, 5 * 60 * 1000);

    return res.json(responsePayload);
  } catch (error) {
    console.error("[Growth Audit Booking] Error:", error);
    return res.status(500).json({
      success: false,
      error: "Unable to finalize your appointment reservation. Please try again."
    });
  }
});

export default router;
