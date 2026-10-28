/**
 * DIGITAL MUID — STAGING READINESS AUDITOR & PRE-FLIGHT VERIFICATION
 *
 * Verifies that a candidate staging environment configuration meets all safety requirements:
 * 1. Dedicated, isolated Supabase project (strictly rejects kpuxtsworzkueyffjaaz).
 * 2. URL parity between client (VITE_SUPABASE_URL) and server (SUPABASE_URL).
 * 3. Key parity between client (VITE_RAZORPAY_KEY_ID) and server (RAZORPAY_KEY_ID).
 * 4. Razorpay test-mode credentials only (rzp_test_*; strictly rejects rzp_live_*).
 * 5. Explicit ALLOW_STAGING_TEST_WRITES=true authorization flag.
 * 6. Safe email sender configuration.
 *
 * Never prints secrets, API keys, or customer information.
 */

import { parseAndAnalyzeSupabaseUrl, redactSecret, KNOWN_PRODUCTION_PROJECT_ID, KNOWN_PRODUCTION_HOST } from "./safetyGuard.js";
import { evaluateDevelopmentSafety } from "../server/developmentSafetyGate.js";

/**
 * Runs a comprehensive pre-flight audit on a target environment object.
 *
 * @param {object} env - Map of environment variables to validate
 * @returns {{
 *   isReady: boolean,
 *   checks: Array<{ name: string, passed: boolean, message: string }>,
 *   errors: string[]
 * }}
 */
export function auditStagingEnvironment(env = process.env) {
  const checks = [];
  const errors = [];

  function record(name, passed, message) {
    checks.push({ name, passed, message });
    if (!passed) {
      errors.push(`[${name}] ${message}`);
    }
  }

  // 1. SUPABASE URL PRESENCE & FORMAT
  const serverUrl = (env.SUPABASE_URL || "").trim();
  const clientUrl = (env.VITE_SUPABASE_URL || "").trim();

  if (!serverUrl && !clientUrl) {
    record("Supabase URL Presence", false, "Both SUPABASE_URL and VITE_SUPABASE_URL are missing.");
  } else {
    record("Supabase URL Presence", true, "Supabase project URL variables are configured.");
  }

  const serverAnalysis = serverUrl ? parseAndAnalyzeSupabaseUrl(serverUrl) : null;
  const clientAnalysis = clientUrl ? parseAndAnalyzeSupabaseUrl(clientUrl) : null;

  if (serverUrl && !serverAnalysis?.valid) {
    record("Server Supabase URL Format", false, `SUPABASE_URL is malformed: ${serverAnalysis?.error}`);
  } else if (serverUrl) {
    record("Server Supabase URL Format", true, `Valid HTTPS URL (Host: ${serverAnalysis.hostname})`);
  }

  if (clientUrl && !clientAnalysis?.valid) {
    record("Client Supabase URL Format", false, `VITE_SUPABASE_URL is malformed: ${clientAnalysis?.error}`);
  } else if (clientUrl) {
    record("Client Supabase URL Format", true, `Valid HTTPS URL (Host: ${clientAnalysis.hostname})`);
  }

  // 2. SUPABASE URL PARITY (SPLIT-BRAIN CHECK)
  if (serverAnalysis?.valid && clientAnalysis?.valid) {
    const matches = serverAnalysis.hostname === clientAnalysis.hostname;
    record(
      "Supabase URL Agreement",
      matches,
      matches
        ? `Client and server URLs agree (${serverAnalysis.hostname})`
        : `Split-brain detected: Server is '${serverAnalysis.hostname}', Client is '${clientAnalysis.hostname}'`
    );
  }

  // 3. PRODUCTION ISOLATION CHECK
  const activeAnalysis = serverAnalysis?.valid ? serverAnalysis : clientAnalysis;
  if (activeAnalysis?.valid) {
    const isProd =
      activeAnalysis.hostname === KNOWN_PRODUCTION_HOST ||
      activeAnalysis.projectRef === KNOWN_PRODUCTION_PROJECT_ID ||
      (serverUrl && serverUrl.includes(KNOWN_PRODUCTION_PROJECT_ID)) ||
      (clientUrl && clientUrl.includes(KNOWN_PRODUCTION_PROJECT_ID));

    record(
      "Production Host Isolation",
      !isProd,
      !isProd
        ? `Target project is isolated from production (Target: ${activeAnalysis.hostname})`
        : `CRITICAL SAFETY VIOLATION: Target project is known PRODUCTION instance (${KNOWN_PRODUCTION_HOST})`
    );
  }

  // 4. SUPABASE CREDENTIALS PRESENCE
  const anonKey = (env.VITE_SUPABASE_ANON_KEY || "").trim();
  const serviceKey = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  record(
    "Supabase Anon Key",
    Boolean(anonKey && anonKey.length > 20 && !anonKey.includes("placeholder")),
    anonKey ? `Configured (${redactSecret(anonKey)})` : "Missing or placeholder anon key"
  );

  record(
    "Supabase Service Role Key",
    Boolean(serviceKey && serviceKey.length > 20 && !serviceKey.includes("placeholder")),
    serviceKey ? `Configured (${redactSecret(serviceKey)})` : "Missing or placeholder service_role key"
  );

  // 5. RAZORPAY TEST MODE CREDENTIALS
  const serverRzpKey = (env.RAZORPAY_KEY_ID || "").trim();
  const clientRzpKey = (env.VITE_RAZORPAY_KEY_ID || "").trim();
  const rzpSecret = (env.RAZORPAY_KEY_SECRET || "").trim();
  const webhookSecret = (env.RAZORPAY_WEBHOOK_SECRET || "").trim();

  const isServerKeyLive = serverRzpKey.startsWith("rzp_live_");
  const isClientKeyLive = clientRzpKey.startsWith("rzp_live_");
  const isServerKeyTest = serverRzpKey.startsWith("rzp_test_");
  const isClientKeyTest = clientRzpKey.startsWith("rzp_test_");

  record(
    "Razorpay Non-Live Key Verification",
    !isServerKeyLive && !isClientKeyLive,
    (!isServerKeyLive && !isClientKeyLive)
      ? "No live Razorpay keys detected (rzp_live_* absent)"
      : "CRITICAL: Live Razorpay key (rzp_live_*) detected in staging configuration"
  );

  record(
    "Razorpay Test Key Verification",
    isServerKeyTest || isClientKeyTest,
    (isServerKeyTest || isClientKeyTest)
      ? `Valid test key configured (${redactSecret(serverRzpKey || clientRzpKey)})`
      : "Razorpay key must begin with 'rzp_test_' for staging"
  );

  if (serverRzpKey && clientRzpKey) {
    const keysMatch = serverRzpKey === clientRzpKey;
    record(
      "Razorpay Key Agreement",
      keysMatch,
      keysMatch
        ? "Client and server Razorpay key IDs match"
        : "Client (VITE_RAZORPAY_KEY_ID) and Server (RAZORPAY_KEY_ID) key IDs do not match"
    );
  }

  record(
    "Razorpay Key Secret",
    Boolean(rzpSecret && !rzpSecret.includes("placeholder") && rzpSecret.length > 8),
    rzpSecret ? `Configured (${redactSecret(rzpSecret)})` : "Missing or placeholder Razorpay secret"
  );

  record(
    "Razorpay Webhook Secret",
    Boolean(webhookSecret && !webhookSecret.includes("placeholder")),
    webhookSecret ? `Configured (${redactSecret(webhookSecret)})` : "Missing or placeholder webhook secret"
  );

  // 6. STAGING WRITE AUTHORIZATION FLAG
  const stagingFlag = (env.ALLOW_STAGING_TEST_WRITES || "").trim();
  record(
    "Staging Mutation Authorization",
    stagingFlag === "true",
    stagingFlag === "true"
      ? "ALLOW_STAGING_TEST_WRITES is explicitly set to 'true'"
      : "ALLOW_STAGING_TEST_WRITES must be set to 'true' to permit staging test mutations"
  );

  // 7. EMAIL CONFIGURATION & TEST SINK
  const senderEmail = (env.TRANSACTIONAL_SENDER_EMAIL || env.SENDER_EMAIL || "").trim();
  const resendKey = (env.RESEND_API_KEY || "").trim();

  const isSafeEmail =
    !senderEmail.includes("support@digitalmuid.in") ||
    senderEmail.toLowerCase().includes("staging") ||
    senderEmail.toLowerCase().includes("test") ||
    !resendKey;

  record(
    "Safe Transactional Email Sink",
    isSafeEmail,
    isSafeEmail
      ? `Email sink safe (${senderEmail || "Resend unconfigured - delivery disabled"})`
      : "WARNING: Transactional sender is using the live production support address (support@digitalmuid.in)"
  );

  // 8. COMBINED SAFETY ENGINE EVALUATION
  const gateEvaluation = evaluateDevelopmentSafety(env);
  record(
    "Safety Gate Engine Approval",
    gateEvaluation.isIsolatedStagingAuthorized,
    gateEvaluation.isIsolatedStagingAuthorized
      ? "All automated safety gate criteria satisfied (mutations authorized)"
      : `Safety gate rejected configuration: ${gateEvaluation.violationCode || "UNAUTHORIZED"}`
  );

  const isReady = checks.every((c) => c.passed);

  return {
    isReady,
    checks,
    errors
  };
}

/**
 * Self-test suite to prove the readiness auditor behaves with 100% precision.
 */
export function runAuditorSelfTests() {
  console.log("=======================================================");
  console.log("RUNNING STAGING READINESS AUDITOR SELF-TESTS");
  console.log("=======================================================\n");

  let passed = 0;
  let total = 0;

  function assertTest(condition, desc) {
    total++;
    if (!condition) {
      console.error(`  FAIL: ${desc}`);
      throw new Error(`Self-test failed: ${desc}`);
    }
    passed++;
    console.log(`  PASS: ${desc}`);
  }

  // Scenario A: Valid isolated staging environment
  {
    const validStagingEnv = {
      APP_ENV: "staging",
      NODE_ENV: "development",
      SUPABASE_URL: "https://dm-staging-project.supabase.co",
      VITE_SUPABASE_URL: "https://dm-staging-project.supabase.co",
      VITE_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.valid_staging_anon_key_mock",
      SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.valid_staging_service_key_mock",
      RAZORPAY_KEY_ID: "rzp_test_stagingkey123",
      VITE_RAZORPAY_KEY_ID: "rzp_test_stagingkey123",
      RAZORPAY_KEY_SECRET: "staging_rzp_secret_9999",
      RAZORPAY_WEBHOOK_SECRET: "staging_webhook_secret_8888",
      ALLOW_STAGING_TEST_WRITES: "true",
      TRANSACTIONAL_SENDER_EMAIL: "DigitalMUID Staging <staging-tests@digitalmuid.in>"
    };

    const result = auditStagingEnvironment(validStagingEnv);
    assertTest(result.isReady === true, "Valid staging configuration passes all readiness checks");
    assertTest(result.errors.length === 0, "Zero errors reported for valid staging configuration");
  }

  // Scenario B: Staging pointed to production Supabase
  {
    const prodTargetEnv = {
      SUPABASE_URL: "https://kpuxtsworzkueyffjaaz.supabase.co",
      VITE_SUPABASE_URL: "https://kpuxtsworzkueyffjaaz.supabase.co",
      RAZORPAY_KEY_ID: "rzp_test_mock",
      ALLOW_STAGING_TEST_WRITES: "true"
    };

    const result = auditStagingEnvironment(prodTargetEnv);
    assertTest(result.isReady === false, "Fails readiness when pointing to production Supabase");
    assertTest(result.errors.some((e) => e.includes("PRODUCTION")), "Identifies production host violation");
  }

  // Scenario C: Live Razorpay key
  {
    const liveRzpEnv = {
      SUPABASE_URL: "https://dm-staging-project.supabase.co",
      VITE_SUPABASE_URL: "https://dm-staging-project.supabase.co",
      RAZORPAY_KEY_ID: "rzp_live_realsecretkey123",
      ALLOW_STAGING_TEST_WRITES: "true"
    };

    const result = auditStagingEnvironment(liveRzpEnv);
    assertTest(result.isReady === false, "Fails readiness when Razorpay key is live");
    assertTest(result.errors.some((e) => e.includes("Live Razorpay")), "Identifies live Razorpay violation");
  }

  // Scenario D: Split-brain Supabase URLs
  {
    const splitBrainEnv = {
      SUPABASE_URL: "https://dm-staging-server.supabase.co",
      VITE_SUPABASE_URL: "https://dm-staging-client.supabase.co",
      RAZORPAY_KEY_ID: "rzp_test_key",
      ALLOW_STAGING_TEST_WRITES: "true"
    };

    const result = auditStagingEnvironment(splitBrainEnv);
    assertTest(result.isReady === false, "Fails readiness on split-brain Supabase URLs");
    assertTest(result.errors.some((e) => e.includes("Split-brain")), "Identifies split-brain violation");
  }

  // Scenario E: Missing ALLOW_STAGING_TEST_WRITES
  {
    const missingFlagEnv = {
      SUPABASE_URL: "https://dm-staging-project.supabase.co",
      VITE_SUPABASE_URL: "https://dm-staging-project.supabase.co",
      RAZORPAY_KEY_ID: "rzp_test_key"
    };

    const result = auditStagingEnvironment(missingFlagEnv);
    assertTest(result.isReady === false, "Fails readiness when ALLOW_STAGING_TEST_WRITES is missing");
  }

  console.log(`\nAll ${passed}/${total} self-tests PASSED successfully.\n`);
  return { passed, total };
}

// If executed directly from CLI:
if (process.argv[1] && process.argv[1].endsWith("verifyStagingReadiness.js")) {
  const isTestFlag = process.argv.includes("--test");

  if (isTestFlag) {
    runAuditorSelfTests();
  } else {
    console.log("=======================================================");
    console.log("DIGITAL MUID — CURRENT ENVIRONMENT STAGING AUDIT");
    console.log("=======================================================\n");

    const audit = auditStagingEnvironment(process.env);
    console.log("CHECK RESULTS:");
    for (const c of audit.checks) {
      const mark = c.passed ? "✓ PASS" : "✗ FAIL";
      console.log(`  ${mark} [${c.name}]: ${c.message}`);
    }

    console.log("\n=======================================================");
    if (audit.isReady) {
      console.log("STAGING READINESS STATUS: READY FOR ISOLATED TESTING");
    } else {
      console.log("STAGING READINESS STATUS: NOT READY (BLOCKED)");
      console.log(`Found ${audit.errors.length} unresolved blocker(s):`);
      for (const err of audit.errors) {
        console.log(`  - ${err}`);
      }
    }
    console.log("=======================================================\n");
  }
}
