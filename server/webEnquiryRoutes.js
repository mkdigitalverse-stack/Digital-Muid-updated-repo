import express from "express";
import {
  verifySupabaseToken,
  getSupabaseServerClient,
  checkIsAdmin,
  isValidUUID
} from "./supabaseServer.js";

const router = express.Router();

// Helper to generate readable inquiry reference ID
function generateWebReferenceId() {
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `WEB-${year}-${rand}`;
}

// In-memory rate limiting map: IP -> array of timestamps
const submissionRateMap = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxSubmissions = 10; // Max 10 submissions per 15 minutes per IP

  const history = submissionRateMap.get(ip) || [];
  const recent = history.filter((ts) => now - ts < windowMs);
  if (recent.length >= maxSubmissions) {
    submissionRateMap.set(ip, recent);
    return false;
  }
  recent.push(now);
  submissionRateMap.set(ip, recent);
  return true;
}

/**
 * POST /api/web-enquiries/submit
 *
 * Public endpoint for submitting website project enquiries from /web.
 * Validates, sanitizes, enforces idempotent submission, and saves into Supabase crm_leads table
 * with source = 'Web Enquiry'.
 */
router.post("/submit", async (req, res) => {
  try {
    const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "client";
    if (!checkRateLimit(clientIp)) {
      return res.status(429).json({
        success: false,
        error: "Too many enquiries submitted from your network. Please wait a few minutes before trying again."
      });
    }

    const {
      projectType,
      businessName,
      businessStage,
      goals,
      features,
      contentReadiness,
      existingWebsiteUrl,
      referenceUrls,
      timeline,
      readiness,
      decisionMaker,
      additionalRequirements,
      fullName,
      email,
      phone,
      consentAgreed,
      idempotencyKey
    } = req.body || {};

    // 1. Validation & sanitization
    const cleanName = String(fullName || "").trim();
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanPhone = String(phone || "").trim();
    const cleanBusiness = String(businessName || "").trim();
    const cleanProjectType = String(projectType || "").trim();
    const cleanBusinessStage = String(businessStage || "").trim();
    const cleanContentReadiness = String(contentReadiness || "").trim();
    const cleanTimeline = String(timeline || "").trim();
    const cleanReadiness = String(readiness || "").trim();
    const cleanDecisionMaker = String(decisionMaker || "").trim();

    if (!cleanName || cleanName.length < 2) {
      return res.status(400).json({ success: false, error: "Please enter your full name." });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      return res.status(400).json({ success: false, error: "Please enter a valid business email address." });
    }

    if (!cleanPhone || cleanPhone.length < 7) {
      return res.status(400).json({ success: false, error: "Please provide a valid phone or WhatsApp number." });
    }

    if (!cleanBusiness) {
      return res.status(400).json({ success: false, error: "Please provide your business or project name." });
    }

    if (!cleanProjectType) {
      return res.status(400).json({ success: false, error: "Please select the project type." });
    }

    const supabaseServer = getSupabaseServerClient();
    if (!supabaseServer) {
      return res.status(503).json({
        success: false,
        error: "Database service is temporarily unavailable. Please try again shortly."
      });
    }

    // 2. Structured details object
    const structuredDetails = {
      projectType: cleanProjectType,
      businessName: cleanBusiness,
      businessStage: cleanBusinessStage,
      goals: Array.isArray(goals) ? goals.map((g) => String(g).trim()).filter(Boolean) : [],
      features: Array.isArray(features) ? features.map((f) => String(f).trim()).filter(Boolean) : [],
      contentReadiness: cleanContentReadiness,
      existingWebsiteUrl: existingWebsiteUrl ? String(existingWebsiteUrl).trim().slice(0, 500) : undefined,
      referenceUrls: referenceUrls ? String(referenceUrls).trim().slice(0, 500) : undefined,
      timeline: cleanTimeline,
      readiness: cleanReadiness,
      decisionMaker: cleanDecisionMaker,
      additionalRequirements: additionalRequirements ? String(additionalRequirements).trim().slice(0, 2000) : undefined,
      consentAgreed: Boolean(consentAgreed),
      webStatus: "New",
      internalNotes: "",
      assignedTo: "",
      followUpDate: "",
      contactAttempts: 0
    };

    const referenceId = generateWebReferenceId();
    const notesJson = JSON.stringify(structuredDetails);

    // 3. Idempotency Check: check if identical submission occurred in last 60 seconds
    const sixtySecondsAgo = new Date(Date.now() - 60000).toISOString();
    const { data: recentDuplicate } = await supabaseServer
      .from("crm_leads")
      .select("id, created_at, notes")
      .eq("source", "Web Enquiry")
      .eq("email", cleanEmail)
      .gte("created_at", sixtySecondsAgo)
      .maybeSingle();

    if (recentDuplicate) {
      return res.json({
        success: true,
        referenceId,
        alreadySubmitted: true,
        message: "Your enquiry has been received and logged. Our team will contact you shortly."
      });
    }

    // 4. Insert into crm_leads with source = 'Web Enquiry'
    const { data: inserted, error: insertError } = await supabaseServer
      .from("crm_leads")
      .insert({
        name: cleanName.slice(0, 200),
        email: cleanEmail.slice(0, 200),
        phone: cleanPhone.slice(0, 50),
        source: "Web Enquiry",
        interest: `Website: ${cleanProjectType}`.slice(0, 200),
        notes: notesJson,
        status: "New"
      })
      .select()
      .single();

    if (insertError) {
      console.error("[Web Enquiry] Insert error:", insertError);
      return res.status(500).json({
        success: false,
        error: "Failed to record your enquiry in the database. Please try again."
      });
    }

    return res.json({
      success: true,
      referenceId,
      id: inserted.id,
      message: "Thank you! Your website project enquiry has been submitted successfully."
    });
  } catch (err) {
    console.error("[Web Enquiry] Unexpected submission error:", err);
    return res.status(500).json({
      success: false,
      error: "An unexpected server error occurred while submitting your enquiry."
    });
  }
});

/**
 * GET /api/web-enquiries/admin/all
 *
 * Secure CRM endpoint: Retrieves all enquiries where source = 'Web Enquiry'.
 * Strictly protected: requires verified admin session JWT.
 */
router.get("/admin/all", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: "Authentication required." });
    }

    const { user, error: authError } = await verifySupabaseToken(authHeader);
    if (authError || !user) {
      return res.status(401).json({ success: false, error: "Invalid or expired administrator session." });
    }

    if (!checkIsAdmin(user)) {
      return res.status(403).json({ success: false, error: "Access denied. Administrator privileges required." });
    }

    const supabaseServer = getSupabaseServerClient();
    if (!supabaseServer) {
      return res.status(503).json({ success: false, error: "Database service unavailable." });
    }

    const { data, error } = await supabaseServer
      .from("crm_leads")
      .select("*")
      .eq("source", "Web Enquiry")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Web Enquiry Admin] Fetch error:", error);
      return res.status(500).json({ success: false, error: "Failed to retrieve web enquiries." });
    }

    return res.json({
      success: true,
      enquiries: data || []
    });
  } catch (err) {
    console.error("[Web Enquiry Admin] Unexpected fetch error:", err);
    return res.status(500).json({ success: false, error: "Internal server error fetching web enquiries." });
  }
});

/**
 * PATCH /api/web-enquiries/admin/:id
 *
 * Updates status, internal notes, follow-up date, or assigned team member for a web enquiry.
 * Strictly protected: requires verified admin session JWT.
 */
router.patch("/admin/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !isValidUUID(id)) {
      return res.status(400).json({ success: false, error: "Invalid enquiry ID format." });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: "Authentication required." });
    }

    const { user, error: authError } = await verifySupabaseToken(authHeader);
    if (authError || !user) {
      return res.status(401).json({ success: false, error: "Invalid or expired administrator session." });
    }

    if (!checkIsAdmin(user)) {
      return res.status(403).json({ success: false, error: "Access denied. Administrator privileges required." });
    }

    const supabaseServer = getSupabaseServerClient();
    if (!supabaseServer) {
      return res.status(503).json({ success: false, error: "Database service unavailable." });
    }

    // Retrieve existing lead
    const { data: existing, error: fetchError } = await supabaseServer
      .from("crm_leads")
      .select("*")
      .eq("id", id)
      .eq("source", "Web Enquiry")
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({ success: false, error: "Web enquiry record not found." });
    }

    let parsedNotes = {};
    try {
      parsedNotes = existing.notes ? JSON.parse(existing.notes) : {};
    } catch {
      parsedNotes = { rawNotes: existing.notes };
    }

    const { status, internalNotes, assignedTo, followUpDate, contactAttempts } = req.body || {};

    if (status !== undefined) {
      parsedNotes.webStatus = status;
    }
    if (internalNotes !== undefined) {
      parsedNotes.internalNotes = String(internalNotes);
    }
    if (assignedTo !== undefined) {
      parsedNotes.assignedTo = String(assignedTo);
    }
    if (followUpDate !== undefined) {
      parsedNotes.followUpDate = String(followUpDate);
    }
    if (contactAttempts !== undefined) {
      parsedNotes.contactAttempts = Number(contactAttempts);
    }

    // Map web status to the closest valid crm_leads status constraint ('New' | 'Contacted' | 'Qualified' | 'Converted' | 'Lost')
    let crmLeadStatus = "New";
    if (status === "Contacted") crmLeadStatus = "Contacted";
    else if (status === "Qualified" || status === "Proposal Sent") crmLeadStatus = "Qualified";
    else if (status === "Won") crmLeadStatus = "Converted";
    else if (status === "Lost") crmLeadStatus = "Lost";

    const { data: updated, error: updateError } = await supabaseServer
      .from("crm_leads")
      .update({
        notes: JSON.stringify(parsedNotes),
        status: crmLeadStatus,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("[Web Enquiry Admin] Update error:", updateError);
      return res.status(500).json({ success: false, error: "Failed to update web enquiry in database." });
    }

    return res.json({
      success: true,
      enquiry: updated
    });
  } catch (err) {
    console.error("[Web Enquiry Admin] Unexpected update error:", err);
    return res.status(500).json({ success: false, error: "Internal server error updating web enquiry." });
  }
});

/**
 * DELETE /api/web-enquiries/admin/:id
 *
 * Removes a web enquiry record from the database.
 * Strictly protected: requires verified admin session JWT.
 */
router.delete("/admin/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !isValidUUID(id)) {
      return res.status(400).json({ success: false, error: "Invalid enquiry ID format." });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: "Authentication required." });
    }

    const { user, error: authError } = await verifySupabaseToken(authHeader);
    if (authError || !user) {
      return res.status(401).json({ success: false, error: "Invalid or expired administrator session." });
    }

    if (!checkIsAdmin(user)) {
      return res.status(403).json({ success: false, error: "Access denied. Administrator privileges required." });
    }

    const supabaseServer = getSupabaseServerClient();
    if (!supabaseServer) {
      return res.status(503).json({ success: false, error: "Database service unavailable." });
    }

    const { error: deleteError } = await supabaseServer
      .from("crm_leads")
      .delete()
      .eq("id", id)
      .eq("source", "Web Enquiry");

    if (deleteError) {
      console.error("[Web Enquiry Admin] Delete error:", deleteError);
      return res.status(500).json({ success: false, error: "Failed to delete web enquiry." });
    }

    return res.json({ success: true, message: "Enquiry deleted successfully." });
  } catch (err) {
    console.error("[Web Enquiry Admin] Unexpected delete error:", err);
    return res.status(500).json({ success: false, error: "Internal server error deleting web enquiry." });
  }
});

export default router;
