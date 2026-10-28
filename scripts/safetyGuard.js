/**
 * DIGITAL MUID — STAGING SAFETY GUARD & PRODUCTION PROTECTION ENGINE
 *
 * Enforces strict, fail-closed isolation between production services and test / script execution:
 * 1. Validates Supabase project URL and permanently rejects known production project (kpuxtsworzkueyffjaaz).
 * 2. Requires explicitly configured staging Supabase URL and rejects missing, empty, or malformed URLs.
 * 3. Requires explicit ALLOW_STAGING_TEST_WRITES=true authorization flag.
 * 4. Permanently rejects live Razorpay credentials (rzp_live_...) in payment tests.
 * 5. Requires valid test Razorpay keys (rzp_test_...) when payment processing is tested.
 * 6. Never reveals secrets or API keys in error outputs (strict redaction).
 */

import "dotenv/config";

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
export function parseAndAnalyzeSupabaseUrl(raw) {
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
    projectRef
  };
}

/**
 * Validates whether the given environment configuration qualifies as a safe, isolated staging environment.
 * Pure verification function: does NOT call process.exit or throw errors directly.
 *
 * @param {object} [options]
 * @param {boolean} [options.requireTestRazorpay=true] - Require valid rzp_test_ key and reject rzp_live_
 * @param {boolean} [options.requireStagingDatabase=true] - Require isolated non-production Supabase project
 * @param {boolean} [options.requireStagingWritesFlag=true] - Require ALLOW_STAGING_TEST_WRITES === 'true'
 * @param {boolean} [options.requireBundleUploadFlag=false] - Require ALLOW_BUNDLE_ASSET_UPLOAD === 'true'
 * @param {object} [customEnv] - Optional environment map (defaults to process.env)
 * @returns {{ isSafe: boolean, error?: string, code?: string, details: object }}
 */
export function validateStagingSafety(options = {}, customEnv = null) {
  const env = customEnv || process.env || {};

  const {
    requireTestRazorpay = true,
    requireStagingDatabase = true,
    requireStagingWritesFlag = true,
    requireBundleUploadFlag = false
  } = options;

  const rawSupabaseUrl = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").trim();
  const rawRzpKey = (env.RAZORPAY_KEY_ID || env.VITE_RAZORPAY_KEY_ID || "").trim();
  const stagingWritesFlag = (env.ALLOW_STAGING_TEST_WRITES || "").trim();
  const bundleUploadFlag = (env.ALLOW_BUNDLE_ASSET_UPLOAD || "").trim();

  const details = {
    supabaseHost: "[NONE]",
    isProductionSupabase: false,
    hasStagingWritesFlag: stagingWritesFlag === "true",
    razorpayKeyType: "[NONE]"
  };

  // 1. SUPABASE DATABASE VALIDATION
  if (requireStagingDatabase) {
    // Check both server-side and client-side URL variables
    const serverUrlRaw = (env.SUPABASE_URL || "").trim();
    const clientUrlRaw = (env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "").trim();

    if (!serverUrlRaw && !clientUrlRaw) {
      return {
        isSafe: false,
        code: "SUPABASE_URL_MISSING",
        error: "Supabase project URL is missing or empty. A dedicated staging database URL is required.",
        details
      };
    }

    // Inspect server URL if provided
    let serverAnalysis = null;
    if (serverUrlRaw) {
      serverAnalysis = parseAndAnalyzeSupabaseUrl(serverUrlRaw);
      if (!serverAnalysis.valid) {
        return {
          isSafe: false,
          code: "SUPABASE_URL_MALFORMED",
          error: `Server Supabase URL is malformed: "${serverUrlRaw.slice(0, 30)}...". ${serverAnalysis.error}`,
          details
        };
      }
    }

    // Inspect client URL if provided
    let clientAnalysis = null;
    if (clientUrlRaw) {
      clientAnalysis = parseAndAnalyzeSupabaseUrl(clientUrlRaw);
      if (!clientAnalysis.valid) {
        return {
          isSafe: false,
          code: "SUPABASE_URL_MALFORMED",
          error: `Client Supabase URL is malformed: "${clientUrlRaw.slice(0, 30)}...". ${clientAnalysis.error}`,
          details
        };
      }
    }

    // Detect split-brain configuration (one pointing to staging, the other pointing elsewhere)
    if (serverAnalysis && clientAnalysis && serverAnalysis.hostname !== clientAnalysis.hostname) {
      return {
        isSafe: false,
        code: "SUPABASE_SPLIT_BRAIN_DETECTED",
        error: `Split-brain Supabase configuration detected: SUPABASE_URL (${serverAnalysis.hostname}) does not match VITE_SUPABASE_URL (${clientAnalysis.hostname}).`,
        details
      };
    }

    const primaryAnalysis = serverAnalysis || clientAnalysis;
    const hostname = primaryAnalysis.hostname;
    const projectRef = primaryAnalysis.projectRef;
    details.supabaseHost = hostname;

    // Check against known production project ID and hostname
    if (
      hostname === KNOWN_PRODUCTION_HOST ||
      projectRef === KNOWN_PRODUCTION_PROJECT_ID ||
      (serverUrlRaw && serverUrlRaw.includes(KNOWN_PRODUCTION_PROJECT_ID)) ||
      (clientUrlRaw && clientUrlRaw.includes(KNOWN_PRODUCTION_PROJECT_ID))
    ) {
      details.isProductionSupabase = true;
      return {
        isSafe: false,
        code: "PRODUCTION_SUPABASE_DETECTED",
        error: `CRITICAL SAFETY VIOLATION: Target project is known PRODUCTION Supabase instance (${KNOWN_PRODUCTION_HOST}). Execution is permanently blocked.`,
        details
      };
    }

    // Must be a valid *.supabase.co staging project or localhost
    if (!hostname.endsWith(".supabase.co") && hostname !== "localhost" && hostname !== "127.0.0.1") {
      return {
        isSafe: false,
        code: "SUPABASE_HOST_UNRECOGNIZED",
        error: `Unrecognized Supabase host "${hostname}". Must be a valid *.supabase.co staging project or localhost.`,
        details
      };
    }
  }

  // Check both server and client Razorpay keys
  const serverRzpKey = (env.RAZORPAY_KEY_ID || "").trim();
  const clientRzpKey = (env.VITE_RAZORPAY_KEY_ID || "").trim();
  const rzpKeysToCheck = [
    { source: "RAZORPAY_KEY_ID", key: serverRzpKey },
    { source: "VITE_RAZORPAY_KEY_ID", key: clientRzpKey }
  ].filter((item) => item.key.length > 0);

  for (const item of rzpKeysToCheck) {
    const lower = item.key.toLowerCase();
    if (lower.startsWith("rzp_live")) {
      details.razorpayKeyType = "LIVE";
      return {
        isSafe: false,
        code: "LIVE_RAZORPAY_DETECTED",
        error: `CRITICAL SAFETY VIOLATION: Live Razorpay credentials detected in ${item.source} (${redactSecret(item.key)}). Tests must never run with live keys.`,
        details
      };
    }
  }

  // 2. EXPLICIT STAGING WRITES AUTHORIZATION FLAG
  if (requireStagingWritesFlag) {
    if (stagingWritesFlag !== "true") {
      return {
        isSafe: false,
        code: "STAGING_FLAG_MISSING",
        error: "Staging write authorization is absent. Execution requires ALLOW_STAGING_TEST_WRITES=true in an isolated staging environment.",
        details
      };
    }
  }

  // 3. RAZORPAY GATEWAY VALIDATION
  if (rawRzpKey) {
    const lowerKey = rawRzpKey.toLowerCase();
    if (lowerKey.startsWith("rzp_live")) {
      details.razorpayKeyType = "LIVE";
      return {
        isSafe: false,
        code: "LIVE_RAZORPAY_DETECTED",
        error: `CRITICAL SAFETY VIOLATION: Live Razorpay credentials detected (${redactSecret(rawRzpKey)}). Tests must never run with live keys.`,
        details
      };
    } else if (lowerKey.startsWith("rzp_test")) {
      details.razorpayKeyType = "TEST";
    } else {
      details.razorpayKeyType = "UNKNOWN";
    }
  }

  if (requireTestRazorpay) {
    if (!rawRzpKey) {
      return {
        isSafe: false,
        code: "RAZORPAY_KEY_MISSING",
        error: "Razorpay test key is missing. Tests require an active rzp_test_ key.",
        details
      };
    }

    if (!rawRzpKey.toLowerCase().startsWith("rzp_test")) {
      return {
        isSafe: false,
        code: "INVALID_RAZORPAY_KEY",
        error: `Invalid Razorpay key format (${redactSecret(rawRzpKey)}). Must start with "rzp_test_".`,
        details
      };
    }
  }

  // 4. STORAGE / ASSET GENERATOR UPLOAD AUTHORIZATION
  if (requireBundleUploadFlag) {
    if (bundleUploadFlag !== "true") {
      return {
        isSafe: false,
        code: "BUNDLE_UPLOAD_FLAG_MISSING",
        error: "Bundle asset storage upload is not authorized. Uploads require ALLOW_BUNDLE_ASSET_UPLOAD=true to target staging storage.",
        details
      };
    }
  }

  return {
    isSafe: true,
    details
  };
}

/**
 * Enforces safety assertion: terminates process immediately if environment is not verified safe.
 *
 * @param {object} [options]
 * @param {boolean} [options.throwOnError=false] - Throw Error instead of calling process.exit (useful for testing)
 */
export function enforceStagingSafety(options = {}) {
  const result = validateStagingSafety(options, process.env);

  if (!result.isSafe) {
    const errorBox = [
      "================================================================================",
      "⛔ CRITICAL SAFETY HALT: EXECUTION FORBIDDEN IN THIS ENVIRONMENT",
      "================================================================================",
      `Failure Code : ${result.code}`,
      `Reason       : ${result.error}`,
      `Supabase Host: ${result.details?.supabaseHost || "[UNKNOWN]"}`,
      `Razorpay Key : ${result.details?.razorpayKeyType || "[UNKNOWN]"}`,
      "--------------------------------------------------------------------------------",
      "Protection Enforcement:",
      "1. Execution against production database (kpuxtsworzkueyffjaaz) is strictly blocked.",
      "2. Execution with live Razorpay credentials (rzp_live_*) is strictly blocked.",
      "3. Setting ALLOW_STAGING_TEST_WRITES=true alone is insufficient without a verified staging URL.",
      "================================================================================"
    ].join("\n");

    console.error(errorBox);

    if (options.throwOnError) {
      const err = new Error(result.error);
      err.code = result.code;
      throw err;
    }

    process.exit(1);
  }
}
