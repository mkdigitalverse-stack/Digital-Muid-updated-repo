import express from "express";
import {
  verifySupabaseToken,
  getSupabaseServerClient,
  isValidUUID,
  checkIsAdmin
} from "./supabaseServer.js";
import { sendWelcomeRegistrationEmail, hasAlreadySent } from "./mailerService.js";

const router = express.Router();

/**
 * POST /api/auth/send-welcome
 * Safely dispatches an official Welcome Registration Email for a verified newly registered user.
 *
 * Security & Verification:
 * 1. Checks Bearer token if provided, verifying the caller matches the account.
 * 2. If session token is not present yet (e.g. email confirmation pending), verifies that the
 *    claimed userId and email genuinely exist in the database (public.profiles or auth.users).
 * 3. Never accepts or processes passwords.
 * 4. Strictly deduplicated by tracking key `welcome_${email}` to prevent repeated welcome emails.
 */
router.post("/send-welcome", async (req, res) => {
  try {
    const rawEmail = String(req.body?.email || "").trim().toLowerCase();
    const rawUserId = String(req.body?.userId || "").trim();
    const rawName = String(req.body?.fullName || "").trim();

    if (!rawEmail || !rawEmail.includes("@")) {
      return res.status(400).json({ success: false, error: "A valid email address is required." });
    }

    // 1. Session token verification if provided
    const authHeader = req.headers.authorization;
    let isCallerVerified = false;

    if (authHeader) {
      const { user, error: authError } = await verifySupabaseToken(authHeader);
      if (!authError && user) {
        const tokenEmail = (user.email || "").toLowerCase().trim();
        const tokenUserId = user.id;

        if (
          tokenEmail === rawEmail ||
          tokenUserId === rawUserId ||
          checkIsAdmin(user)
        ) {
          isCallerVerified = true;
        }
      }
    }

    // 2. Database verification fallback if token was not provided (e.g. unconfirmed session)
    if (!isCallerVerified && rawUserId && isValidUUID(rawUserId)) {
      const supabaseServer = getSupabaseServerClient();
      if (supabaseServer) {
        try {
          // Check public.profiles for matching record
          const { data: profile } = await supabaseServer
            .from("profiles")
            .select("id, email, full_name")
            .eq("id", rawUserId)
            .maybeSingle();

          if (profile) {
            if (!profile.email || profile.email.toLowerCase().trim() === rawEmail) {
              isCallerVerified = true;
            }
          }

          // Also check auth.users via admin if profiles did not match
          if (!isCallerVerified && supabaseServer.auth?.admin?.getUserById) {
            const { data: authUser } = await supabaseServer.auth.admin.getUserById(rawUserId);
            if (authUser?.user && authUser.user.email?.toLowerCase().trim() === rawEmail) {
              isCallerVerified = true;
            }
          }
        } catch (dbErr) {
          console.warn("[Auth Routes] Notice verifying user in database:", dbErr?.message);
        }
      }
    }

    if (!isCallerVerified) {
      return res.status(403).json({
        success: false,
        error: "Verification failed. Welcome email requires an authenticated session or verified user registration record."
      });
    }

    // 3. Deduplication check
    const trackingKey = `welcome_${rawEmail}`;
    if (await hasAlreadySent(trackingKey, "welcome_registration")) {
      return res.status(200).json({
        success: true,
        skipped: true,
        message: "Welcome registration email was already dispatched to this address."
      });
    }

    // 4. Dispatch welcome email
    const outcome = await sendWelcomeRegistrationEmail({
      to: rawEmail,
      customerName: rawName || "Member",
      loginUrl: "https://digitalmuid.in/login"
    });

    return res.status(200).json({
      success: true,
      delivered: Boolean(outcome.success),
      skipped: Boolean(outcome.skipped),
      message: outcome.skipped
        ? "Welcome email skipped (provider unconfigured or already sent)."
        : "Welcome registration email successfully dispatched."
    });
  } catch (err) {
    console.error("[Auth Routes] Unexpected error in /send-welcome:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error dispatching welcome email."
    });
  }
});

export default router;
