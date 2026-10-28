/**
 * DIGITAL MUID — DEVELOPMENT SAFETY GATE & PRODUCTION MUTATION INTERCEPTOR
 *
 * Enforces fail-closed protection in non-production environments:
 * 1. Blocks database mutations (POST/PUT/PATCH/DELETE) when running in development/test
 *    and configured with the known production Supabase project (kpuxtsworzkueyffjaaz).
 * 2. Blocks payment operations (POST /api/payments/*) when configured with live Razorpay keys (rzp_live_*).
 * 3. Blocks split-brain configuration where server and client URLs point to different hosts.
 * 4. Ensures ALLOW_STAGING_TEST_WRITES=true NEVER overrides production-host detection.
 * 5. Redacts all secrets and keys in error responses and log outputs.
 * 6. Preserves 100% of production traffic when NODE_ENV === 'production' in deployed environments.
 */

export const KNOWN_PRODUCTION_PROJECT_ID = "kpuxtsworzkueyffjaaz";
export const KNOWN_PRODUCTION_HOST = "kpuxtsworzkueyffjaaz.supabase.co";

/**
 * Safely redacts credentials and API keys.
 * Displays only the first 4 and last 2 characters if long enough; otherwise masks completely.
 *
 * @param {string} [secret]
 * @returns {string}
 */
export function redactSecret(secret) {
  if (!secret || typeof secret !== "string") return "[NOT_SET]";
  const clean = secret.trim();
  if (clean.length <= 8) return "[REDACTED]";
  return `${clean.slice(0, 4)}...${clean.slice(-2)} (len: ${clean.length})`;
}

/**
 * Parses and sanitizes a candidate Supabase URL.
 * Handles URL decoding, whitespace stripping, and RFC-compliant URL parsing.
 *
 * @param {string} raw
 * @returns {{ valid: boolean, parsed?: URL, hostname?: string, projectRef?: string, error?: string }}
 */
export function parseSupabaseUrl(raw) {
  if (!raw || typeof raw !== "string" || !raw.trim()) {
    return { valid: false, error: "URL is empty or undefined" };
  }

  let decoded = raw.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {}

  const match = decoded.match(/https?:\/\/[^\s\n\r"'\\]+/i);
  if (!match) {
    return { valid: false, error: "No HTTP/HTTPS protocol scheme detected in URL" };
  }

  let parsed;
  try {
    parsed = new URL(match[0]);
  } catch (err) {
    return { valid: false, error: `Invalid URL format: ${err.message}` };
  }

  const hostname = parsed.hostname.toLowerCase();
  const parts = hostname.split(".");
  const projectRef = parts[0] || "";

  return {
    valid: true,
    parsed,
    hostname,
    projectRef,
  };
}

/**
 * Determines whether the current process is running in a live production environment.
 * Strict definition: NODE_ENV === "production" AND NOT running inside a development container.
 *
 * @param {object} [env=process.env]
 * @returns {boolean}
 */
export function isProductionEnvironment(env = process.env) {
  if (env.FORCE_DEV_SAFETY === "true") {
    return false;
  }

  const isDevContainer = Boolean(
    env.NGINX_PORT ||
    env.DEFAULT_APP_PORT ||
    env.CONTROL_PLANE_PORT ||
    (env.K_SERVICE && env.K_SERVICE.startsWith("ais-dev-"))
  );

  if (isDevContainer) {
    return false;
  }

  if (env.APP_ENV === "development" || env.APP_ENV === "test") {
    return false;
  }

  return env.NODE_ENV === "production";
}

/**
 * Evaluates whether development/test execution is safe or violates production isolation rules.
 *
 * @param {object} [env=process.env]
 * @returns {{
 *   isSafeForDevelopmentMutations: boolean,
 *   isIsolatedStagingAuthorized: boolean,
 *   isProductionSupabase: boolean,
 *   isLiveRazorpay: boolean,
 *   isSplitBrain: boolean,
 *   isMalformed: boolean,
 *   isConfigMissing: boolean,
 *   hasStagingWritesFlag: boolean,
 *   violationCode: string | null,
 *   violationMessage: string | null,
 *   supabaseHost: string
 * }}
 */
export function evaluateDevelopmentSafety(env = process.env) {
  const serverUrlRaw = (env.SUPABASE_URL || "").trim();
  const clientUrlRaw = (env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const rzpKeyRaw = (env.RAZORPAY_KEY_ID || env.VITE_RAZORPAY_KEY_ID || "").trim();
  const stagingWritesFlag = (env.ALLOW_STAGING_TEST_WRITES || "").trim() === "true";

  const serverAnalysis = serverUrlRaw ? parseSupabaseUrl(serverUrlRaw) : null;
  const clientAnalysis = clientUrlRaw ? parseSupabaseUrl(clientUrlRaw) : null;

  let isProductionSupabase = false;
  let isLiveRazorpay = false;
  let isSplitBrain = false;
  let isConfigMissing = false;
  let isMalformed = false;
  let violationCode = null;
  let violationMessage = null;

  // 1. Check if URLs are malformed
  if (serverUrlRaw && !serverAnalysis?.valid) {
    isMalformed = true;
    violationCode = "SUPABASE_URL_MALFORMED";
    violationMessage = `Server Supabase URL is malformed: ${serverAnalysis?.error || "unknown error"}`;
  } else if (clientUrlRaw && !clientAnalysis?.valid) {
    isMalformed = true;
    violationCode = "SUPABASE_URL_MALFORMED";
    violationMessage = `Client Supabase URL is malformed: ${clientAnalysis?.error || "unknown error"}`;
  } else if (!serverUrlRaw && !clientUrlRaw) {
    isConfigMissing = true;
    violationCode = "SUPABASE_URL_MISSING";
    violationMessage = "Supabase project URL is missing or empty. An isolated staging URL is required for development mutations.";
  }

  // 2. Check for split-brain configuration
  if (!violationCode && serverAnalysis?.valid && clientAnalysis?.valid) {
    if (serverAnalysis.hostname !== clientAnalysis.hostname) {
      isSplitBrain = true;
      violationCode = "SUPABASE_SPLIT_BRAIN_DETECTED";
      violationMessage = `Split-brain Supabase configuration detected: SUPABASE_URL (${serverAnalysis.hostname}) does not match VITE_SUPABASE_URL (${clientAnalysis.hostname}).`;
    }
  }

  // 3. Check for production Supabase targeting
  const activeAnalysis = serverAnalysis?.valid ? serverAnalysis : clientAnalysis;
  if (activeAnalysis?.valid) {
    const host = activeAnalysis.hostname;
    const ref = activeAnalysis.projectRef;
    if (
      host === KNOWN_PRODUCTION_HOST ||
      ref === KNOWN_PRODUCTION_PROJECT_ID ||
      (serverUrlRaw && serverUrlRaw.includes(KNOWN_PRODUCTION_PROJECT_ID)) ||
      (clientUrlRaw && clientUrlRaw.includes(KNOWN_PRODUCTION_PROJECT_ID))
    ) {
      isProductionSupabase = true;
      violationCode = "DEV_PRODUCTION_MUTATION_BLOCKED";
      violationMessage = `CRITICAL SAFETY VIOLATION: Target project is known PRODUCTION Supabase instance (${KNOWN_PRODUCTION_HOST}). Mutations are prohibited from non-production environments to protect production data.`;
    }
  }

  // 4. Check for live Razorpay key
  if (rzpKeyRaw.startsWith("rzp_live_")) {
    isLiveRazorpay = true;
    if (!violationCode) {
      violationCode = "DEV_LIVE_PAYMENT_BLOCKED";
      violationMessage = `CRITICAL SAFETY VIOLATION: LIVE Razorpay credentials detected in development/test environment (${redactSecret(rzpKeyRaw)}). Use test mode credentials (rzp_test_*) for staging.`;
    }
  }

  // 5. Determine if isolated staging is safely authorized
  // STRICT RULE: ALLOW_STAGING_TEST_WRITES=true can ONLY authorize non-production targets with test credentials
  const isIsolatedStagingAuthorized = Boolean(
    stagingWritesFlag &&
    !isProductionSupabase &&
    !isLiveRazorpay &&
    !isSplitBrain &&
    !isMalformed &&
    !isConfigMissing
  );

  // If no specific violation code yet, but staging authorization is missing
  if (!violationCode && !isIsolatedStagingAuthorized) {
    violationCode = "DEV_STAGING_WRITES_UNAUTHORIZED";
    violationMessage = "Development mutations require an isolated staging database and explicit ALLOW_STAGING_TEST_WRITES=true authorization.";
  }

  return {
    isSafeForDevelopmentMutations: isIsolatedStagingAuthorized,
    isIsolatedStagingAuthorized,
    isProductionSupabase,
    isLiveRazorpay,
    isSplitBrain,
    isMalformed,
    isConfigMissing,
    hasStagingWritesFlag: stagingWritesFlag,
    violationCode: isIsolatedStagingAuthorized ? null : violationCode,
    violationMessage: isIsolatedStagingAuthorized ? null : violationMessage,
    supabaseHost: activeAnalysis?.valid ? activeAnalysis.hostname : "[NONE]",
  };
}

/**
 * Creates an Express middleware to enforce development safety rules on incoming requests.
 *
 * @param {object} [customEnv=null]
 * @returns {import('express').RequestHandler}
 */
export function createDevelopmentSafetyMiddleware(customEnv = null) {
  return function developmentSafetyMiddleware(req, res, next) {
    const env = customEnv || process.env;

    // In production, allow all legitimate traffic to proceed untouched
    if (isProductionEnvironment(env)) {
      return next();
    }

    // Read-only HTTP methods (GET, HEAD, OPTIONS) are permitted
    const method = (req.method || "").toUpperCase();
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
      return next();
    }

    // Mutation methods (POST, PUT, PATCH, DELETE) require strict safety validation
    const evaluation = evaluateDevelopmentSafety(env);

    if (evaluation.isIsolatedStagingAuthorized) {
      return next();
    }

    // Block mutation request with safe 403 Forbidden
    return res.status(403).json({
      success: false,
      code: evaluation.violationCode,
      error: evaluation.violationMessage,
      environment: "development",
      blockedMethod: method,
      blockedPath: req.path || req.originalUrl || "",
    });
  };
}

/**
 * Default singleton development safety middleware for Express.
 */
export const developmentSafetyMiddleware = createDevelopmentSafetyMiddleware();

/**
 * Checks whether an internal side-effect (e.g. database write, payment fulfillment, email dispatch)
 * is permitted in the current runtime environment.
 *
 * @param {string} actionType - 'database_mutation' | 'payment_order' | 'email_dispatch' | 'storage_upload'
 * @param {object} [env=process.env]
 * @returns {{ allowed: boolean, code?: string, reason?: string, details?: object }}
 */
export function assertSideEffectAllowed(actionType, env = process.env) {
  if (isProductionEnvironment(env)) {
    return { allowed: true };
  }

  const evaluation = evaluateDevelopmentSafety(env);
  if (evaluation.isIsolatedStagingAuthorized) {
    return { allowed: true };
  }

  return {
    allowed: false,
    code: evaluation.violationCode || "DEV_SIDE_EFFECT_BLOCKED",
    reason: evaluation.violationMessage || `Action '${actionType}' is blocked in development environment.`,
    details: {
      actionType,
      isProductionSupabase: evaluation.isProductionSupabase,
      isLiveRazorpay: evaluation.isLiveRazorpay,
    },
  };
}
