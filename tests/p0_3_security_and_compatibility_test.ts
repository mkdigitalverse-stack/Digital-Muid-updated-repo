/**
 * DIGITALMUID V4.3 — P0-3 SECURITY, RACE-CONDITION, PROXY TRUST & COMPATIBILITY TEST SUITE
 *
 * Strictly offline & local (zero external network, zero Supabase/PostgreSQL/Razorpay/Resend calls).
 * Uses ONLY synthetic fixture UUIDs (never references real DigitalMuid production paid resource UUIDs).
 */

import assert from "node:assert";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import express from "express";

// Configure isolated offline environment BEFORE importing server modules
process.env.NODE_ENV = "test";
process.env.APP_ENV = "test";
process.env.FORCE_DEV_SAFETY = "true";
process.env.SUPABASE_URL = "https://p03-isolated-offline-test.supabase.co";
process.env.VITE_SUPABASE_URL = "https://p03-isolated-offline-test.supabase.co";
process.env.VITE_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.p03_anon_placeholder.sig";
process.env.ALLOW_STAGING_TEST_WRITES = "true";
process.env.RAZORPAY_KEY_ID = "rzp_test_p03_offline_only";
process.env.RAZORPAY_KEY_SECRET = "rzp_test_p03_offline_secret_32_bytes_min!!";
process.env.RAZORPAY_WEBHOOK_SECRET = "whsec_test_p03_offline_secret_32_bytes!!";
process.env.ASSET_TOKEN_HMAC_SECRET = "p03_asset_hmac_secret_minimum_32_chars_ok!";
process.env.INVOICE_TOKEN_HMAC_SECRET = "p03_invoice_hmac_secret_min_32_chars_ok!!";
process.env.RESOURCE_TOKEN_HMAC_SECRET = "p03_resource_hmac_secret_min_32_chars_ok!";
process.env.DOWNLOAD_RATE_LIMIT_HMAC_SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
process.env.TRUST_PROXY_HOPS = "0";

const {
  createResourceRoutes,
  resolveTrustProxyConfig,
  extractTrustedClientIp,
  computeDownloadClientHash,
  getDownloadRateLimitHmacSecret,
  isDownloadRateLimitSecretConfigured
} = await import("../server/resourceRoutes.js");

const {
  checkIsAdmin,
  isEmailConfirmed,
  setMockSupabaseServerClient
} = await import("../server/supabaseServer.js");

const {
  getAuthoritativeResourcePricing,
  isZeroPriceStrict
} = await import("../server/paymentFulfillment.js");

const {
  default: paymentRoutes,
  resetPaymentRateLimits,
  getClientIp,
  parseProtectedStorageUrl,
  isProtectedResourceUrl,
  isDisallowedFreeExternalHost,
  validatePublicFreeResourceUrl,
  resolveAllowlistedProtectedFilename,
  resolveConfinedProtectedAssetPath,
  openConfinedProtectedAssetFd,
  setTestProtectedAssetConfig,
  getAssetHmacSecret,
  isAssetTokenSecretConfigured,
  ASSET_TOKEN_TTL_MS,
  ASSET_TOKEN_MAX_TTL_MS,
  generateAssetAccessToken,
  verifyAssetAccessToken,
  generateGuestResourceToken,
  BUNDLE_RESOURCE_ID,
  BUNDLE_ITEMS
} = await import("../server/paymentRoutes.js");

const { createApp } = await import("../server.ts");
const { authService } = await import("../src/services/authService.ts");
const { mapDbRowToResource } = await import("../src/services/resourceService.ts");

// Synthetic fixture UUIDs ONLY (never real production resource IDs)
const SYNTH_FREE_PDF_ID = "90000000-0000-4000-8000-000000000001";
const SYNTH_FREE_XLSX_ID = "90000000-0000-4000-8000-000000000002";
const SYNTH_PAID_RES_ID = "90000000-0000-4000-8000-000000000003";
const SYNTH_OTHER_PAID_ID = "90000000-0000-4000-8000-000000000004";
const SYNTH_DRAFT_FREE_ID = "90000000-0000-4000-8000-000000000005";
const SYNTH_ARCHIVED_FREE_ID = "90000000-0000-4000-8000-000000000006";
const SYNTH_MISCONFIG_FREE_PRICE_ID = "90000000-0000-4000-8000-000000000007";
const SYNTH_MISSING_ID = "90000000-0000-4000-8000-000000000099";

const SYNTH_BUYER_A = "91000000-0000-4000-8000-000000000001";
const SYNTH_BUYER_B = "91000000-0000-4000-8000-000000000002";
const SYNTH_UNCONFIRMED_USER = "91000000-0000-4000-8000-000000000003";
const SYNTH_CONFIRMED_ADMIN = "91000000-0000-4000-8000-000000000009";
const SYNTH_UNCONFIRMED_ADMIN = "91000000-0000-4000-8000-000000000010";

let passed = 0;
let failed = 0;

async function runTest(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed += 1;
    console.log(`  [PASS] ${name}`);
  } catch (err: any) {
    failed += 1;
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err?.stack || err}`);
  }
}

function startEphemeralServer(app: express.Express): Promise<{ server: http.Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const addr = server.address() as { port: number };
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

function stopServer(server: http.Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

/**
 * Faithful offline JS mirror of SQL `public.is_protected_resource_url(TEXT)`
 * and `public.public_resources` view redaction logic (verified alongside SQL AST checks).
 */
const PAID_SLUGS = new Set([
  "meta-ads-campaign-planner-workbook",
  "the-ad-budget-break-even-calculator",
  "the-ad-budget-breat-even-calculate",
  "10-high-converting-meta-ads-copy-frameworks",
  "pre-launch-tracking-audit-checklist",
  "meta-ads-campaign-planner-bundle"
]);

function isProtectedResourceUrlMirror(url: string | null | undefined): boolean {
  if (url === null || url === undefined) return false;
  const trimmed = String(url).trim();
  if (!trimmed) return false;
  const patterns = [
    /^supabase:\/\//i,
    /\/storage\/v1\/object\//i,
    /(^|\/)protected_downloads(\/|$)/i,
    /(^|\/)paid-resources(\/|$)/i,
    /(^|\/)paid(\/|$)/i,
    /(^|\/)private(\/|$)/i,
    /\/api\/payments\/download-paid-asset/i,
    /(meta-ads-campaign-planner-workbook|the-ad-budget-break-even-calculator|the-ad-budget-breat-even-calculate|10-high-converting-meta-ads-copy-frameworks|pre-launch-tracking-audit-checklist|meta-ads-campaign-planner-bundle)/i
  ];
  return patterns.some((re) => re.test(trimmed));
}

function projectPublicResourcesRow(row: any) {
  if (row.status !== "published") return null;
  const eligibleBase =
    row.access_type === "free" &&
    Number(row.price ?? 0) === 0 &&
    !PAID_SLUGS.has(row.slug);

  return {
    ...row,
    file_url:
      eligibleBase && row.file_url !== null && !isProtectedResourceUrlMirror(row.file_url)
        ? row.file_url
        : null,
    external_url:
      eligibleBase && row.external_url !== null && !isProtectedResourceUrlMirror(row.external_url)
        ? row.external_url
        : null
  };
}

/**
 * Faithful serialized simulator of PostgreSQL `record_free_resource_download()`
 * including row-level `FOR UPDATE` mutex, subtransaction rollback on ROW_COUNT=0,
 * and persistent rate-limit bucket state.
 */
function createFreeDownloadDbSimulator() {
  const resources = new Map<string, any>([
    [SYNTH_FREE_PDF_ID, { id: SYNTH_FREE_PDF_ID, status: "published", access_type: "free", price: 0, download_count: 5 }],
    [SYNTH_FREE_XLSX_ID, { id: SYNTH_FREE_XLSX_ID, status: "published", access_type: "free", price: 0, download_count: 0 }],
    [SYNTH_PAID_RES_ID, { id: SYNTH_PAID_RES_ID, status: "published", access_type: "paid", price: 299, download_count: 12 }],
    [SYNTH_DRAFT_FREE_ID, { id: SYNTH_DRAFT_FREE_ID, status: "draft", access_type: "free", price: 0, download_count: 0 }],
    [SYNTH_ARCHIVED_FREE_ID, { id: SYNTH_ARCHIVED_FREE_ID, status: "archived", access_type: "free", price: 0, download_count: 3 }],
    [SYNTH_MISCONFIG_FREE_PRICE_ID, { id: SYNTH_MISCONFIG_FREE_PRICE_ID, status: "published", access_type: "free", price: 99, download_count: 1 }]
  ]);

  const rateLimits = new Map<string, number>();
  let lockChain = Promise.resolve();
  let simulateRpcFailure = false;
  let simulateZeroRowsUpdated = false;
  let onBeforeUpdateHook: ((res: any) => void) | null = null;
  const rpcCalls: any[] = [];

  const withRowLock = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = lockChain.then(fn, fn);
    lockChain = next.then(() => undefined, () => undefined);
    return next;
  };

  const client = {
    async rpc(fnName: string, params: any) {
      rpcCalls.push({ fnName, params });
      if (simulateRpcFailure) {
        return { data: null, error: { code: "08006", message: "Simulated PostgreSQL connection failure" } };
      }
      if (fnName !== "record_free_resource_download") {
        return { data: null, error: { message: `Unexpected RPC ${fnName}` } };
      }

      return withRowLock(async () => {
        const { p_resource_id, p_client_hash, p_window_seconds = 900, p_max_hits = 10 } = params;
        if (!/^[0-9a-f]{64}$/.test(String(p_client_hash || ""))) {
          return { data: { allowed: false, incremented: false, code: "INVALID_CLIENT_HASH" }, error: null };
        }
        const row = resources.get(p_resource_id);
        if (!row) {
          return { data: { allowed: false, incremented: false, code: "NOT_FOUND" }, error: null };
        }
        if (row.status !== "published" || row.access_type !== "free" || Number(row.price ?? 0) !== 0) {
          return {
            data: { allowed: false, incremented: false, code: "NOT_ELIGIBLE", download_count: row.download_count },
            error: null
          };
        }

        const nowSec = Math.floor(Date.now() / 1000);
        const windowStart = Math.floor(nowSec / p_window_seconds) * p_window_seconds;
        const retryAfter = Math.max(1, windowStart + p_window_seconds - nowSec);
        const bucketKey = `${p_resource_id}:${p_client_hash}:${windowStart}`;

        // Subtransaction snapshot for rollback on ROW_COUNT <> 1
        const prevHitCount = rateLimits.get(bucketKey);
        const nextHitCount = Math.min((prevHitCount || 0) + 1, p_max_hits + 1);
        rateLimits.set(bucketKey, nextHitCount);

        if (nextHitCount > p_max_hits) {
          return {
            data: {
              allowed: false,
              incremented: false,
              code: "RATE_LIMITED",
              retry_after_seconds: retryAfter,
              remaining: 0,
              download_count: row.download_count
            },
            error: null
          };
        }

        if (onBeforeUpdateHook) {
          onBeforeUpdateHook(row);
        }

        const matchesDefensiveUpdate =
          !simulateZeroRowsUpdated &&
          row.status === "published" &&
          row.access_type === "free" &&
          Number(row.price ?? 0) === 0;

        if (!matchesDefensiveUpdate) {
          // Subtransaction rollback: restore rate-limit state so zero phantom hit persists
          if (prevHitCount === undefined) rateLimits.delete(bucketKey);
          else rateLimits.set(bucketKey, prevHitCount);

          return {
            data: {
              allowed: false,
              incremented: false,
              code: "UPDATE_AFFECTED_ZERO_ROWS",
              download_count: row.download_count
            },
            error: null
          };
        }

        row.download_count += 1;
        return {
          data: {
            allowed: true,
            incremented: true,
            code: "OK",
            download_count: row.download_count,
            remaining: Math.max(0, p_max_hits - nextHitCount),
            retry_after_seconds: 0
          },
          error: null
        };
      });
    }
  };

  return {
    client,
    resources,
    rateLimits,
    rpcCalls,
    setRpcFailure: (v: boolean) => { simulateRpcFailure = v; },
    setZeroRowsUpdated: (v: boolean) => { simulateZeroRowsUpdated = v; },
    setOnBeforeUpdateHook: (fn: ((res: any) => void) | null) => { onBeforeUpdateHook = fn; }
  };
}

/**
 * Strict filter-recording Supabase mock for SERVER-1 `get-resource-download-url` verification.
 * Evaluates EVERY `.eq()` and `.in()` filter accurately and records all executed queries for assertions.
 */
function createStrictServer1Mock({ signError = null }: { signError?: any } = {}) {
  const queryLog: Array<{ table: string; filters: Array<{ op: string; col: string; val: any }> }> = [];
  const signCalls: Array<{ bucket: string; path: string; expiresIn: number }> = [];

  const tokens: Record<string, any> = {
    "tok-buyer-a": {
      id: SYNTH_BUYER_A,
      email: "buyera@example.test",
      email_confirmed_at: "2026-01-01T00:00:00Z",
      app_metadata: {},
      user_metadata: {}
    },
    "tok-buyer-b": {
      id: SYNTH_BUYER_B,
      email: "buyerb@example.test",
      email_confirmed_at: "2026-01-01T00:00:00Z",
      app_metadata: {},
      user_metadata: {}
    },
    "tok-unconfirmed": {
      id: SYNTH_UNCONFIRMED_USER,
      email: "unconfirmed@example.test",
      email_confirmed_at: null,
      app_metadata: {},
      user_metadata: {}
    }
  };

  const tables: Record<string, any[]> = {
    resources: [
      {
        id: SYNTH_PAID_RES_ID,
        slug: "p03-synthetic-paid-playbook",
        title: "Synthetic Paid Playbook",
        status: "published",
        access_type: "paid",
        price: 299,
        currency: "INR",
        file_url: "supabase://paid-resources/synthetic/p03-paid-playbook.pdf",
        external_url: null
      },
      {
        id: SYNTH_OTHER_PAID_ID,
        slug: "p03-synthetic-other-paid",
        title: "Synthetic Other Paid Kit",
        status: "published",
        access_type: "paid",
        price: 199,
        currency: "INR",
        file_url: "supabase://paid-resources/synthetic/p03-other-paid.pdf",
        external_url: null
      }
    ],
    payments: [],
    resource_purchases: []
  };

  const client = {
    auth: {
      async getUser(token: string) {
        const u = tokens[token];
        if (!u) return { data: { user: null }, error: new Error("Invalid token") };
        return { data: { user: u }, error: null };
      }
    },
    storage: {
      from(bucket: string) {
        return {
          async createSignedUrl(objectPath: string, expiresIn: number) {
            signCalls.push({ bucket, path: objectPath, expiresIn });
            if (signError) {
              return { data: null, error: signError };
            }
            return {
              data: { signedUrl: `https://signed.offline.test/storage/v1/object/sign/${bucket}/${objectPath}?token=verified_sig` },
              error: null
            };
          }
        };
      }
    },
    from(table: string) {
      const filters: Array<{ op: string; col: string; val: any }> = [];
      const exec = async (singleMode: "maybeSingle" | "single" | null) => {
        queryLog.push({ table, filters: [...filters] });
        const rows = (tables[table] || []).filter((row) => {
          return filters.every((f) => {
            if (f.op === "eq") return row[f.col] === f.val;
            if (f.op === "in") return Array.isArray(f.val) && f.val.includes(row[f.col]);
            return true;
          });
        });
        if (singleMode === "maybeSingle") return { data: rows[0] || null, error: null };
        if (singleMode === "single") return { data: rows[0] || null, error: rows[0] ? null : { message: "Not found" } };
        return { data: rows, error: null };
      };
      const builder: any = {
        select() { return builder; },
        eq(col: string, val: any) { filters.push({ op: "eq", col, val }); return builder; },
        in(col: string, val: any) { filters.push({ op: "in", col, val }); return builder; },
        maybeSingle() { return exec("maybeSingle"); },
        single() { return exec("single"); },
        then(resolve: any, reject: any) { return exec(null).then(resolve, reject); }
      };
      return builder;
    }
  };

  return { client, tables, queryLog, signCalls };
}

async function main() {
  console.log("==================================================================");
  console.log("DIGITALMUID V4.3 — P0-3 SECURITY & COMPATIBILITY TEST SUITE");
  console.log("==================================================================");

  // =========================================================================
  // GROUP 1: SQL MIGRATION & OPERATIONAL STORAGE SEPARATION CHECKS
  // =========================================================================
  console.log("\n[Group 1] Static SQL, Manifest & Step A / Step B Separation Invariants");

  const stepAPath = path.resolve("supabase/migrations/20261121000001_p0_3a_harden_resources_and_free_downloads.sql");
  const stepBPath = path.resolve("supabase/operations/p0_3b_private_paid_resources_storage.sql");
  const manifestPath = path.resolve("supabase/tests/ci_migration_manifest.txt");
  const bootstrapPath = path.resolve("supabase/tests/ci_bootstrap_prerequisites.sql");

  const stepASql = fs.readFileSync(stepAPath, "utf8");
  const stepBSql = fs.readFileSync(stepBPath, "utf8");
  const manifestText = fs.readFileSync(manifestPath, "utf8");
  const bootstrapSql = fs.readFileSync(bootstrapPath, "utf8");

  await runTest("1.1 Step A SQL has fail-closed policy inventory (allowlist only, no blind DROP loop)", () => {
    assert.ok(stepASql.includes("'Public Read Published Resources'"));
    assert.ok(stepASql.includes("'Admin All Resources'"));
    assert.ok(stepASql.includes("P0-3A FAIL-CLOSED ABORT: Unexpected RLS policies detected"));
    assert.ok(!/FOR\s+\w+\s+IN\s+SELECT[\s\S]*?DROP\s+POLICY/i.test(stepASql), "Must NEVER use dynamic loop to blindly drop unknown policies");
    assert.ok(stepASql.includes("REVOKE ALL ON TABLE public.resources FROM PUBLIC, anon;"));
    assert.ok(stepASql.includes("DROP FUNCTION IF EXISTS public.increment_resource_downloads(UUID);"));
  });

  await runTest("1.2 Step A SQL hardens public.is_admin() with search_path + email_confirmed_at + anon short-circuit", () => {
    const stepANoComments = stepASql.replace(/--.*$/gm, "");
    assert.ok(stepANoComments.includes("SET search_path = pg_catalog, pg_temp"));
    assert.ok(stepANoComments.includes("IF auth.role() IS DISTINCT FROM 'authenticated' THEN"));
    assert.ok(stepANoComments.includes("IF v_email_confirmed_at IS NULL THEN"));
    assert.ok(!stepANoComments.includes("raw_user_meta_data"), "public.is_admin() executable SQL must NEVER read user-writable raw_user_meta_data");
    assert.ok(stepANoComments.includes("GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role, postgres;"));
  });

  await runTest("1.3 Step A SQL defines complete 28-column public.public_resources view with security_barrier=true, security_invoker=false", () => {
    assert.ok(stepASql.includes("WITH (security_barrier = true, security_invoker = false)"));
    assert.ok(stepASql.includes("ALTER VIEW public.public_resources OWNER TO postgres;"));
    assert.ok(stepASql.includes("REVOKE ALL ON public.public_resources FROM PUBLIC, anon, authenticated;"));
    assert.ok(stepASql.includes("GRANT SELECT ON public.public_resources TO anon, authenticated, service_role, postgres;"));

    const expected28Cols = [
      "r.id", "r.title", "r.slug", "r.description", "r.resource_type", "r.category",
      "AS file_url", "AS external_url", "r.thumbnail_url", "r.author", "r.file_type",
      "r.file_size", "r.reading_time_minutes", "r.tags", "r.status", "r.is_featured",
      "r.published_at", "r.download_count", "r.preview_points", "r.what_is_included",
      "r.lead_capture_required", "r.seo_title", "r.seo_description", "r.access_type",
      "r.price", "r.currency", "r.created_at", "r.updated_at"
    ];
    for (const col of expected28Cols) {
      assert.ok(stepASql.includes(col), `public_resources view missing column projection: ${col}`);
    }
  });

  await runTest("1.4 Step A SQL verifies resource_download_rate_limits schema fail-closed and uses FOR UPDATE + ROW_COUNT + rollback", () => {
    assert.ok(stepASql.includes("CREATE TABLE IF NOT EXISTS public.resource_download_rate_limits"));
    assert.ok(stepASql.includes("ALTER TABLE public.resource_download_rate_limits FORCE ROW LEVEL SECURITY;"));
    assert.ok(stepASql.includes("pg_catalog.has_table_privilege('anon', 'public.resource_download_rate_limits'"));
    assert.ok(stepASql.includes("FOR UPDATE;"));
    assert.ok(stepASql.includes("GET DIAGNOSTICS v_rows_updated = ROW_COUNT;"));
    assert.ok(stepASql.includes("IF v_rows_updated IS DISTINCT FROM 1 THEN"));
    assert.ok(stepASql.includes("'UPDATE_AFFECTED_ZERO_ROWS'"));
    assert.ok(stepASql.includes("GRANT EXECUTE ON FUNCTION public.record_free_resource_download(UUID, TEXT, INTEGER, INTEGER) TO service_role, postgres;"));
  });

  await runTest("1.5 Step B Storage SQL is strictly separated outside supabase/migrations/ with preflight ownership guard", () => {
    assert.ok(!stepASql.includes("storage.objects") && !stepASql.includes("storage.buckets"), "Step A migration must NEVER mutate storage schema");
    assert.ok(stepBSql.includes("P0-3B PREFLIGHT ABORT"));
    assert.ok(stepBSql.includes("'paid-resources'"));
    assert.ok(stepBSql.includes("TO service_role"));
    assert.ok(!stepBSql.includes("2d50e5e3-711d-4461-a70d-0ed54dd29f17"), "Must not embed real production paid UUID in Step B");
    assert.ok(!fs.existsSync(path.resolve("supabase/migrations/p0_3b_private_paid_resources_storage.sql")));
  });

  await runTest("1.6 CI migration manifest and CI bootstrap prerequisites stay strictly synchronized", () => {
    const manifestLines = manifestText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const actualMigrations = fs
      .readdirSync(path.resolve("supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .map((f) => `supabase/migrations/${f}`);
    assert.deepStrictEqual(manifestLines, actualMigrations, "ci_migration_manifest.txt must match supabase/migrations/*.sql exactly");
    assert.strictEqual(
      manifestLines[manifestLines.length - 1],
      "supabase/migrations/20261121000001_p0_3a_harden_resources_and_free_downloads.sql"
    );
    assert.ok(bootstrapSql.includes("email_confirmed_at TIMESTAMPTZ"), "ci_bootstrap_prerequisites.sql must include auth.users.email_confirmed_at");
  });

  // =========================================================================
  // GROUP 2: ADMIN AUTHORIZATION ALIGNMENT
  // =========================================================================
  console.log("\n[Group 2] Admin Authorization Alignment (email_confirmed_at across ALL paths)");

  await runTest("2.1 Backend checkIsAdmin enforces email_confirmed_at for BOTH app_metadata.role and email allowlist", () => {
    const makeUser = (overrides: Record<string, any>): any => ({
      aud: "authenticated",
      created_at: "2026-01-01T00:00:00Z",
      app_metadata: {},
      user_metadata: {},
      ...overrides
    });

    assert.strictEqual(
      checkIsAdmin(makeUser({ id: SYNTH_CONFIRMED_ADMIN, email: "admin@digitalmuid.com", email_confirmed_at: "2026-01-01T00:00:00Z" })),
      true
    );
    assert.strictEqual(
      checkIsAdmin(makeUser({ id: SYNTH_CONFIRMED_ADMIN, email: "ops@example.test", email_confirmed_at: "2026-01-01T00:00:00Z", app_metadata: { role: "admin" } })),
      true
    );
    assert.strictEqual(
      checkIsAdmin(makeUser({ id: SYNTH_UNCONFIRMED_ADMIN, email: "admin@digitalmuid.com", email_confirmed_at: null })),
      false
    );
    assert.strictEqual(
      checkIsAdmin(makeUser({ id: SYNTH_UNCONFIRMED_ADMIN, email: "ops@example.test", email_confirmed_at: null, app_metadata: { role: "admin" } })),
      false
    );
    assert.strictEqual(
      checkIsAdmin(makeUser({ id: SYNTH_BUYER_A, email: "student@example.test", email_confirmed_at: "2026-01-01T00:00:00Z", user_metadata: { role: "admin" } })),
      false
    );
    assert.strictEqual(checkIsAdmin(null), false);
  });

  // =========================================================================
  // GROUP 3: public_resources VIEW REDACTION (POSITIVE & NEGATIVE)
  // =========================================================================
  console.log("\n[Group 3] public_resources URL Redaction (Free Preserved vs Paid/Protected Redacted)");

  await runTest("3.1 Positive: Legitimate published free PDF and XLSX under /downloads/ retain public file_url", () => {
    const freePdf = projectPublicResourcesRow({
      id: SYNTH_FREE_PDF_ID,
      slug: "p03-synthetic-free-guide",
      status: "published",
      access_type: "free",
      price: 0,
      file_url: "/downloads/p03-synthetic-free.pdf",
      external_url: "https://example.test/public-free-companion"
    });
    assert.strictEqual(freePdf?.file_url, "/downloads/p03-synthetic-free.pdf");
    assert.strictEqual(freePdf?.external_url, "https://example.test/public-free-companion");

    const freeXlsx = projectPublicResourcesRow({
      id: SYNTH_FREE_XLSX_ID,
      slug: "p03-synthetic-free-sheet",
      status: "published",
      access_type: "free",
      price: 0,
      file_url: "/downloads/thought-leadership-os.xlsx",
      external_url: null
    });
    assert.strictEqual(freeXlsx?.file_url, "/downloads/thought-leadership-os.xlsx");
  });

  await runTest("3.2 Negative: Paid, nonzero-price free, storage/protected URLs, paid identifiers, draft & archived rows redacted/hidden", () => {
    // Paid row redacts BOTH file_url and external_url
    const paidRow = projectPublicResourcesRow({
      id: SYNTH_PAID_RES_ID,
      slug: "p03-synthetic-paid-playbook",
      status: "published",
      access_type: "paid",
      price: 299,
      file_url: "supabase://paid-resources/synthetic/paid.pdf",
      external_url: "https://cdn.example.test/paid-mirror.pdf"
    });
    assert.strictEqual(paidRow?.file_url, null);
    assert.strictEqual(paidRow?.external_url, null);

    // Free row with price > 0 redacts BOTH URLs
    const misconfigFree = projectPublicResourcesRow({
      id: SYNTH_MISCONFIG_FREE_PRICE_ID,
      slug: "p03-misconfig-free",
      status: "published",
      access_type: "free",
      price: 99,
      file_url: "/downloads/p03-synthetic-free.pdf",
      external_url: "https://example.test/leak"
    });
    assert.strictEqual(misconfigFree?.file_url, null);
    assert.strictEqual(misconfigFree?.external_url, null);

    // Free row pointing to protected/storage/paid paths gets redacted
    for (const badUrl of [
      "supabase://paid-resources/x.pdf",
      "https://proj.supabase.co/storage/v1/object/public/resources/paid/x.pdf",
      "/protected_downloads/secret.pdf",
      "/downloads/meta-ads-campaign-planner-workbook.pdf",
      "/api/payments/download-paid-asset?token=abc",
      "https://example.test/paid/file.pdf"
    ]) {
      const row = projectPublicResourcesRow({
        id: SYNTH_FREE_PDF_ID,
        slug: "p03-free-bad-url",
        status: "published",
        access_type: "free",
        price: 0,
        file_url: badUrl,
        external_url: badUrl
      });
      assert.strictEqual(row?.file_url, null, `Expected file_url redacted for ${badUrl}`);
      assert.strictEqual(row?.external_url, null, `Expected external_url redacted for ${badUrl}`);
    }

    // Paid slug marked free still redacts URLs
    const slugSpoof = projectPublicResourcesRow({
      id: SYNTH_FREE_PDF_ID,
      slug: "meta-ads-campaign-planner-bundle",
      status: "published",
      access_type: "free",
      price: 0,
      file_url: "/downloads/safe-looking.pdf",
      external_url: "https://example.test/safe"
    });
    assert.strictEqual(slugSpoof?.file_url, null);
    assert.strictEqual(slugSpoof?.external_url, null);

    // Draft & archived excluded completely
    assert.strictEqual(
      projectPublicResourcesRow({ id: SYNTH_DRAFT_FREE_ID, slug: "d", status: "draft", access_type: "free", price: 0, file_url: "/downloads/d.pdf" }),
      null
    );
    assert.strictEqual(
      projectPublicResourcesRow({ id: SYNTH_ARCHIVED_FREE_ID, slug: "a", status: "archived", access_type: "free", price: 0, file_url: "/downloads/a.pdf" }),
      null
    );
  });

  // =========================================================================
  // GROUP 4: POST /api/resources/:id/record-download (RATE LIMIT, RACES, FAIL-CLOSED)
  // =========================================================================
  console.log("\n[Group 4] Persistent Free-Download Counter Endpoint (Rate Limit, Concurrency, Fail-Closed)");

  {
    const sim = createFreeDownloadDbSimulator();
    setMockSupabaseServerClient(sim.client);

    const app = express();
    app.set("trust proxy", false);
    app.use("/api/resources", createResourceRoutes({ isProduction: false }));
    const { server, baseUrl } = await startEphemeralServer(app);

    try {
      await runTest("4.1 Valid published free resource allows hits 1..10 and blocks hit 11 with HTTP 429 + Retry-After", async () => {
        for (let i = 1; i <= 10; i++) {
          const res = await fetch(`${baseUrl}/api/resources/${SYNTH_FREE_PDF_ID}/record-download`, { method: "POST" });
          assert.strictEqual(res.status, 200, `Expected 200 on hit ${i}, got ${res.status}`);
          const body = await res.json();
          assert.strictEqual(body.success, true);
          assert.strictEqual(body.allowed, true);
          assert.strictEqual(body.incremented, true);
          assert.strictEqual(body.downloadCount, 5 + i);
        }

        const res11 = await fetch(`${baseUrl}/api/resources/${SYNTH_FREE_PDF_ID}/record-download`, { method: "POST" });
        assert.strictEqual(res11.status, 429);
        assert.ok(Number(res11.headers.get("retry-after")) >= 1, "429 must include positive Retry-After header");
        const body11 = await res11.json();
        assert.strictEqual(body11.allowed, false);
        assert.strictEqual(body11.incremented, false);
        assert.strictEqual(body11.code, "RATE_LIMITED");
        assert.strictEqual(sim.resources.get(SYNTH_FREE_PDF_ID).download_count, 15, "Counter must not change on 429");
      });

      await runTest("4.2 Rejects paid (403), draft (403), archived (403), nonzero-price free (403), missing (404), and invalid UUID (400)", async () => {
        for (const id of [SYNTH_PAID_RES_ID, SYNTH_DRAFT_FREE_ID, SYNTH_ARCHIVED_FREE_ID, SYNTH_MISCONFIG_FREE_PRICE_ID]) {
          const before = sim.resources.get(id).download_count;
          const res = await fetch(`${baseUrl}/api/resources/${id}/record-download`, { method: "POST" });
          assert.strictEqual(res.status, 403, `Expected 403 for ineligible resource ${id}, got ${res.status}`);
          const body = await res.json();
          assert.strictEqual(body.incremented, false);
          assert.strictEqual(sim.resources.get(id).download_count, before);
        }

        const missingRes = await fetch(`${baseUrl}/api/resources/${SYNTH_MISSING_ID}/record-download`, { method: "POST" });
        assert.strictEqual(missingRes.status, 404);

        const badIdRes = await fetch(`${baseUrl}/api/resources/not-a-valid-uuid/record-download`, { method: "POST" });
        assert.strictEqual(badIdRes.status, 400);
      });

      await runTest("4.3 Concurrent admin free->paid & published->archived transitions return 409/403 with zero phantom rate-limit hit", async () => {
        const resRecord = sim.resources.get(SYNTH_FREE_XLSX_ID);
        resRecord.status = "published";
        resRecord.access_type = "free";
        resRecord.price = 0;
        resRecord.download_count = 0;
        sim.rateLimits.clear();

        // Simulate concurrent admin transition free -> paid right before defensive UPDATE
        sim.setOnBeforeUpdateHook((r) => {
          r.access_type = "paid";
          r.price = 199;
        });

        const raceRes1 = await fetch(`${baseUrl}/api/resources/${SYNTH_FREE_XLSX_ID}/record-download`, { method: "POST" });
        assert.strictEqual(raceRes1.status, 409);
        const raceBody1 = await raceRes1.json();
        assert.strictEqual(raceBody1.allowed, false);
        assert.strictEqual(raceBody1.incremented, false);
        assert.strictEqual(raceBody1.code, "UPDATE_AFFECTED_ZERO_ROWS");
        assert.strictEqual(resRecord.download_count, 0, "Counter must stay 0");
        assert.strictEqual(sim.rateLimits.size, 0, "Subtransaction rollback must leave zero phantom rate-limit hits");

        // Subsequent request sees paid state immediately under FOR UPDATE -> 403
        sim.setOnBeforeUpdateHook(null);
        const afterPaid = await fetch(`${baseUrl}/api/resources/${SYNTH_FREE_XLSX_ID}/record-download`, { method: "POST" });
        assert.strictEqual(afterPaid.status, 403);

        // Reset to published free, simulate concurrent published -> archived transition
        resRecord.access_type = "free";
        resRecord.price = 0;
        resRecord.status = "published";
        sim.setOnBeforeUpdateHook((r) => {
          r.status = "archived";
        });
        const raceRes2 = await fetch(`${baseUrl}/api/resources/${SYNTH_FREE_XLSX_ID}/record-download`, { method: "POST" });
        assert.strictEqual(raceRes2.status, 409);
        assert.strictEqual(resRecord.download_count, 0);
        assert.strictEqual(sim.rateLimits.size, 0);
        sim.setOnBeforeUpdateHook(null);

        const afterArchived = await fetch(`${baseUrl}/api/resources/${SYNTH_FREE_XLSX_ID}/record-download`, { method: "POST" });
        assert.strictEqual(afterArchived.status, 403);
      });

      await runTest("4.4 Parallel 15-request burst serializes cleanly: exactly 10 increments (200) and 5 rate-limited (429)", async () => {
        const resRecord = sim.resources.get(SYNTH_FREE_XLSX_ID);
        resRecord.status = "published";
        resRecord.access_type = "free";
        resRecord.price = 0;
        resRecord.download_count = 0;
        sim.rateLimits.clear();

        const responses = await Promise.all(
          Array.from({ length: 15 }, () =>
            fetch(`${baseUrl}/api/resources/${SYNTH_FREE_XLSX_ID}/record-download`, { method: "POST" })
          )
        );
        const statuses = responses.map((r) => r.status);
        assert.strictEqual(statuses.filter((s) => s === 200).length, 10);
        assert.strictEqual(statuses.filter((s) => s === 429).length, 5);
        assert.strictEqual(resRecord.download_count, 10);
      });

      await runTest("4.5 Fail-closed HTTP 503 when RPC errors, service-role client missing, or HMAC secret missing/short", async () => {
        // DB RPC error -> 503 (never falls back to in-memory limiter)
        sim.setRpcFailure(true);
        const rpcErrRes = await fetch(`${baseUrl}/api/resources/${SYNTH_FREE_XLSX_ID}/record-download`, { method: "POST" });
        assert.strictEqual(rpcErrRes.status, 503);
        assert.strictEqual((await rpcErrRes.json()).code, "RATE_LIMIT_STORAGE_UNAVAILABLE");
        sim.setRpcFailure(false);

        // Missing service-role client -> 503
        setMockSupabaseServerClient(null);
        const origServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;
        const noClientRes = await fetch(`${baseUrl}/api/resources/${SYNTH_FREE_XLSX_ID}/record-download`, { method: "POST" });
        assert.strictEqual(noClientRes.status, 503);
        assert.strictEqual((await noClientRes.json()).code, "SERVICE_ROLE_UNAVAILABLE");
        if (origServiceKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = origServiceKey;
        setMockSupabaseServerClient(sim.client);

        // Missing / short DOWNLOAD_RATE_LIMIT_HMAC_SECRET -> 503
        const origSecret = process.env.DOWNLOAD_RATE_LIMIT_HMAC_SECRET;
        process.env.DOWNLOAD_RATE_LIMIT_HMAC_SECRET = "too-short";
        assert.strictEqual(isDownloadRateLimitSecretConfigured(), false);
        const shortSecretRes = await fetch(`${baseUrl}/api/resources/${SYNTH_FREE_XLSX_ID}/record-download`, { method: "POST" });
        assert.strictEqual(shortSecretRes.status, 503);
        assert.strictEqual((await shortSecretRes.json()).code, "RATE_LIMIT_SECRET_UNCONFIGURED");
        process.env.DOWNLOAD_RATE_LIMIT_HMAC_SECRET = origSecret;
      });
    } finally {
      await stopServer(server);
      setMockSupabaseServerClient(null);
    }
  }

  // =========================================================================
  // GROUP 5: REVERSE PROXY TRUST (TRUST_PROXY_HOPS) & SPOOFING RESISTANCE
  // =========================================================================
  console.log("\n[Group 5] Reverse Proxy Trust (TRUST_PROXY_HOPS) & X-Forwarded-For Spoofing Resistance");

  await runTest("5.1 resolveTrustProxyConfig validates 0..5, fails closed on unset in production or invalid anywhere", () => {
    assert.deepStrictEqual(resolveTrustProxyConfig({}, false), {
      configured: false,
      valid: true,
      hops: 0,
      expressValue: false,
      reason: "TRUST_PROXY_HOPS is not explicitly configured"
    });
    assert.strictEqual(resolveTrustProxyConfig({}, true).valid, false, "Unset TRUST_PROXY_HOPS must fail closed in production");
    assert.strictEqual(resolveTrustProxyConfig({ TRUST_PROXY_HOPS: "0" }, true).expressValue, false);
    assert.strictEqual(resolveTrustProxyConfig({ TRUST_PROXY_HOPS: "0" }, true).valid, true);
    assert.strictEqual(resolveTrustProxyConfig({ TRUST_PROXY_HOPS: "2" }, true).expressValue, 2);
    for (const bad of ["true", "-1", "6", "1.5", "abc"]) {
      assert.strictEqual(resolveTrustProxyConfig({ TRUST_PROXY_HOPS: bad }, false).valid, false, `Invalid value ${bad} must fail closed`);
    }
  });

  await runTest("5.2 Production endpoint returns HTTP 503 when TRUST_PROXY_HOPS is unset", async () => {
    const sim = createFreeDownloadDbSimulator();
    setMockSupabaseServerClient(sim.client);
    const origHops = process.env.TRUST_PROXY_HOPS;
    delete process.env.TRUST_PROXY_HOPS;

    const prodApp = express();
    prodApp.set("trust proxy", resolveTrustProxyConfig(process.env, true).expressValue);
    prodApp.use("/api/resources", createResourceRoutes({ isProduction: true }));
    const { server, baseUrl } = await startEphemeralServer(prodApp);

    try {
      const res = await fetch(`${baseUrl}/api/resources/${SYNTH_FREE_PDF_ID}/record-download`, { method: "POST" });
      assert.strictEqual(res.status, 503);
      assert.strictEqual((await res.json()).code, "PROXY_TRUST_UNCONFIGURED");
    } finally {
      await stopServer(server);
      process.env.TRUST_PROXY_HOPS = origHops;
      setMockSupabaseServerClient(null);
    }
  });

  await runTest("5.3 TRUST_PROXY_HOPS=0 ignores spoofed X-Forwarded-For; TRUST_PROXY_HOPS=1 uses rightmost trusted hop only", async () => {
    // 0 hops: attacker rotates X-Forwarded-For on every request -> still hashed to 127.0.0.1 and blocked on #11
    const sim0 = createFreeDownloadDbSimulator();
    setMockSupabaseServerClient(sim0.client);
    process.env.TRUST_PROXY_HOPS = "0";
    const app0 = express();
    app0.set("trust proxy", false);
    app0.use("/api/resources", createResourceRoutes({ isProduction: true }));
    const srv0 = await startEphemeralServer(app0);
    try {
      for (let i = 1; i <= 10; i++) {
        const res = await fetch(`${srv0.baseUrl}/api/resources/${SYNTH_FREE_PDF_ID}/record-download`, {
          method: "POST",
          headers: { "X-Forwarded-For": `203.0.113.${i}` }
        });
        assert.strictEqual(res.status, 200);
      }
      const res11 = await fetch(`${srv0.baseUrl}/api/resources/${SYNTH_FREE_PDF_ID}/record-download`, {
        method: "POST",
        headers: { "X-Forwarded-For": "203.0.113.250" }
      });
      assert.strictEqual(res11.status, 429, "Spoofed X-Forwarded-For must NOT bypass rate limit when TRUST_PROXY_HOPS=0");
      const expectedLoopbackHash = computeDownloadClientHash("127.0.0.1", process.env.DOWNLOAD_RATE_LIMIT_HMAC_SECRET!);
      assert.strictEqual(sim0.rpcCalls[0].params.p_client_hash, expectedLoopbackHash);
    } finally {
      await stopServer(srv0.server);
    }

    // 1 hop: attacker prepends fake leftmost IP -> Express takes rightmost hop (198.51.100.10) consistently
    const sim1 = createFreeDownloadDbSimulator();
    setMockSupabaseServerClient(sim1.client);
    process.env.TRUST_PROXY_HOPS = "1";
    const app1 = express();
    app1.set("trust proxy", 1);
    app1.use("/api/resources", createResourceRoutes({ isProduction: true }));
    const srv1 = await startEphemeralServer(app1);
    try {
      const r1 = await fetch(`${srv1.baseUrl}/api/resources/${SYNTH_FREE_PDF_ID}/record-download`, {
        method: "POST",
        headers: { "X-Forwarded-For": "198.51.100.1, 198.51.100.10" }
      });
      const r2 = await fetch(`${srv1.baseUrl}/api/resources/${SYNTH_FREE_PDF_ID}/record-download`, {
        method: "POST",
        headers: { "X-Forwarded-For": "203.0.113.99, 198.51.100.10" }
      });
      assert.strictEqual(r1.status, 200);
      assert.strictEqual(r2.status, 200);
      const expectedTrustedHash = computeDownloadClientHash("198.51.100.10", process.env.DOWNLOAD_RATE_LIMIT_HMAC_SECRET!);
      assert.strictEqual(sim1.rpcCalls[0].params.p_client_hash, expectedTrustedHash);
      assert.strictEqual(sim1.rpcCalls[1].params.p_client_hash, expectedTrustedHash);
    } finally {
      await stopServer(srv1.server);
      process.env.TRUST_PROXY_HOPS = "0";
      setMockSupabaseServerClient(null);
    }

    // Verify extractTrustedClientIp & getClientIp ignore raw x-forwarded-for
    assert.strictEqual(
      extractTrustedClientIp({ socket: { remoteAddress: "::ffff:127.0.0.1" }, headers: { "x-forwarded-for": "1.2.3.4" } } as any),
      "127.0.0.1"
    );
    assert.strictEqual(
      getClientIp({ socket: { remoteAddress: "127.0.0.1" }, headers: { "x-forwarded-for": "1.2.3.4" } }),
      "127.0.0.1"
    );
  });

  // =========================================================================
  // GROUP 6: SERVER-1 & ALL 6 SERVICE-ROLE-ONLY RESOURCE ROUTES
  // =========================================================================
  console.log("\n[Group 6] SERVER-1 Strict Query Filters & All 6 Service-Role-Only Resource Routes");

  {
    const payApp = express();
    payApp.use(express.json());
    payApp.use("/api/payments", paymentRoutes);
    const { server, baseUrl } = await startEphemeralServer(payApp);

    try {
      await runTest("6.1 All 6 resource routes fail closed with HTTP 503 when service-role client is unavailable (even with anon key + Bearer token)", async () => {
        resetPaymentRateLimits();
        setMockSupabaseServerClient(null);
        const origKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;

        const validSig = crypto
          .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
          .update("order_p03_503|pay_p03_503")
          .digest("hex");

        const authHeaders = {
          "Content-Type": "application/json",
          Authorization: "Bearer fake-user-jwt-token"
        };

        try {
          const r1 = await fetch(`${baseUrl}/api/payments/create-resource-order`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ resourceId: SYNTH_PAID_RES_ID, customerDetails: { name: "Test", email: "t@example.test", phone: "+919876543210" } })
          });
          assert.strictEqual(r1.status, 503, `create-resource-order expected 503, got ${r1.status}`);

          const r2 = await fetch(`${baseUrl}/api/payments/verify-resource-payment`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
              razorpay_order_id: "order_p03_503",
              razorpay_payment_id: "pay_p03_503",
              razorpay_signature: validSig,
              resourceId: SYNTH_PAID_RES_ID
            })
          });
          assert.strictEqual(r2.status, 503, `verify-resource-payment expected 503, got ${r2.status}`);

          const r3 = await fetch(`${baseUrl}/api/payments/recover-lead`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ orderId: "order_p03_503", paymentId: "pay_p03_503", resourceId: SYNTH_PAID_RES_ID })
          });
          assert.strictEqual(r3.status, 503, `recover-lead expected 503, got ${r3.status}`);

          const r4 = await fetch(`${baseUrl}/api/payments/verify-purchase-status?resourceId=${SYNTH_PAID_RES_ID}`, {
            headers: { Authorization: "Bearer fake-user-jwt-token" }
          });
          assert.strictEqual(r4.status, 503, `verify-purchase-status expected 503, got ${r4.status}`);

          const r5 = await fetch(`${baseUrl}/api/payments/get-resource-download-url`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ resourceId: SYNTH_PAID_RES_ID })
          });
          assert.strictEqual(r5.status, 503, `get-resource-download-url expected 503, got ${r5.status}`);

          const r6a = await fetch(`${baseUrl}/api/payments/bundle-files`, {
            headers: { Authorization: "Bearer fake-user-jwt-token" }
          });
          assert.strictEqual(r6a.status, 503, `GET bundle-files expected 503, got ${r6a.status}`);

          const r6b = await fetch(`${baseUrl}/api/payments/get-bundle-files`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({})
          });
          assert.strictEqual(r6b.status, 503, `POST get-bundle-files expected 503, got ${r6b.status}`);
        } finally {
          if (origKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = origKey;
        }
      });

      await runTest("6.2 SERVER-1: Unauthenticated, unconfirmed, cross-user, wrong-resource, pending/failed, amount & currency mismatches all rejected; valid buyer gets signed URL; query filters verified", async () => {
        resetPaymentRateLimits();
        const mock = createStrictServer1Mock();
        setMockSupabaseServerClient(mock.client);

        // Seed Buyer A captured payment for SYNTH_PAID_RES_ID (exact INR 299)
        mock.tables.payments.push(
          {
            id: "pay-row-valid-a",
            user_id: SYNTH_BUYER_A,
            item_type: "resource",
            item_id: SYNTH_PAID_RES_ID,
            status: "captured",
            amount: 299,
            currency: "INR",
            razorpay_order_id: "order_valid_a",
            razorpay_payment_id: "pay_valid_a"
          },
          // Unconfirmed user has a captured payment row -> MUST STILL BE REJECTED
          {
            id: "pay-row-unconfirmed",
            user_id: SYNTH_UNCONFIRMED_USER,
            item_type: "resource",
            item_id: SYNTH_PAID_RES_ID,
            status: "captured",
            amount: 299,
            currency: "INR",
            razorpay_order_id: "order_unconf",
            razorpay_payment_id: "pay_unconf"
          },
          // Buyer B has a payment for DIFFERENT resource, a PENDING payment, an AMOUNT mismatch, and a USD currency payment
          {
            id: "pay-row-b-other-res",
            user_id: SYNTH_BUYER_B,
            item_type: "resource",
            item_id: SYNTH_OTHER_PAID_ID,
            status: "captured",
            amount: 199,
            currency: "INR",
            razorpay_order_id: "order_b_other",
            razorpay_payment_id: "pay_b_other"
          },
          {
            id: "pay-row-b-pending",
            user_id: SYNTH_BUYER_B,
            item_type: "resource",
            item_id: SYNTH_PAID_RES_ID,
            status: "pending",
            amount: 299,
            currency: "INR",
            razorpay_order_id: "order_b_pending",
            razorpay_payment_id: "pay_b_pending"
          },
          {
            id: "pay-row-b-failed",
            user_id: SYNTH_BUYER_B,
            item_type: "resource",
            item_id: SYNTH_PAID_RES_ID,
            status: "failed",
            amount: 299,
            currency: "INR",
            razorpay_order_id: "order_b_failed",
            razorpay_payment_id: "pay_b_failed"
          },
          {
            id: "pay-row-b-amount-mismatch",
            user_id: SYNTH_BUYER_B,
            item_type: "resource",
            item_id: SYNTH_PAID_RES_ID,
            status: "captured",
            amount: 298,
            currency: "INR",
            razorpay_order_id: "order_b_amt",
            razorpay_payment_id: "pay_b_amt"
          },
          {
            id: "pay-row-b-currency-mismatch",
            user_id: SYNTH_BUYER_B,
            item_type: "resource",
            item_id: SYNTH_PAID_RES_ID,
            status: "captured",
            amount: 299,
            currency: "USD",
            razorpay_order_id: "order_b_usd",
            razorpay_payment_id: "pay_b_usd"
          }
        );

        // 1. Unauthenticated rejected (403)
        const unauthRes = await fetch(`${baseUrl}/api/payments/get-resource-download-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resourceId: SYNTH_PAID_RES_ID })
        });
        assert.strictEqual(unauthRes.status, 403);

        // 2. Unconfirmed user rejected (403)
        const unconfRes = await fetch(`${baseUrl}/api/payments/get-resource-download-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer tok-unconfirmed" },
          body: JSON.stringify({ resourceId: SYNTH_PAID_RES_ID })
        });
        assert.strictEqual(unconfRes.status, 403);

        // 3. Buyer B cannot access Buyer A's payment (even passing Buyer A's orderId/paymentId) -> 403
        const crossUserRes = await fetch(`${baseUrl}/api/payments/get-resource-download-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer tok-buyer-b" },
          body: JSON.stringify({ resourceId: SYNTH_PAID_RES_ID, orderId: "order_valid_a", paymentId: "pay_valid_a" })
        });
        assert.strictEqual(crossUserRes.status, 403);

        // 4. Buyer B with wrong resource, pending, failed, amount mismatch, currency mismatch -> 403
        const buyerBReject = await fetch(`${baseUrl}/api/payments/get-resource-download-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer tok-buyer-b" },
          body: JSON.stringify({ resourceId: SYNTH_PAID_RES_ID })
        });
        assert.strictEqual(buyerBReject.status, 403);

        // 5. Valid confirmed Buyer A receives signed URL from `paid-resources` bucket (200)
        mock.queryLog.length = 0;
        mock.signCalls.length = 0;
        const okRes = await fetch(`${baseUrl}/api/payments/get-resource-download-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer tok-buyer-a" },
          body: JSON.stringify({ resourceId: SYNTH_PAID_RES_ID })
        });
        assert.strictEqual(okRes.status, 200);
        const okBody = await okRes.json();
        assert.strictEqual(okBody.success, true);
        assert.ok(String(okBody.downloadUrl).includes("/paid-resources/synthetic/p03-paid-playbook.pdf?token=verified_sig"));
        assert.strictEqual(okBody.externalUrl, null);

        // Verify actual query filters recorded on `payments`
        const payQuery = mock.queryLog.find((q) => q.table === "payments");
        assert.ok(payQuery, "Must execute payments query");
        assert.ok(payQuery!.filters.some((f) => f.op === "eq" && f.col === "user_id" && f.val === SYNTH_BUYER_A));
        assert.ok(payQuery!.filters.some((f) => f.op === "eq" && f.col === "item_type" && f.val === "resource"));
        assert.ok(payQuery!.filters.some((f) => f.op === "in" && f.col === "item_id" && Array.isArray(f.val) && f.val.includes(SYNTH_PAID_RES_ID)));
        assert.ok(payQuery!.filters.some((f) => f.op === "eq" && f.col === "status" && f.val === "captured"));
        assert.ok(payQuery!.filters.some((f) => f.op === "eq" && f.col === "currency" && f.val === "INR"));
        assert.strictEqual(mock.signCalls[0].bucket, "paid-resources");
      });

      await runTest("6.3 SERVER-1: Signing error fails closed (HTTP 503) and NEVER returns raw or public Storage URL", async () => {
        resetPaymentRateLimits();
        const mockErr = createStrictServer1Mock({ signError: { message: "Storage signing outage" } });
        mockErr.tables.payments.push({
          id: "pay-row-valid-a",
          user_id: SYNTH_BUYER_A,
          item_type: "resource",
          item_id: SYNTH_PAID_RES_ID,
          status: "captured",
          amount: 299,
          currency: "INR",
          razorpay_order_id: "order_valid_a",
          razorpay_payment_id: "pay_valid_a"
        });
        setMockSupabaseServerClient(mockErr.client);

        const res = await fetch(`${baseUrl}/api/payments/get-resource-download-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer tok-buyer-a" },
          body: JSON.stringify({ resourceId: SYNTH_PAID_RES_ID })
        });
        assert.strictEqual(res.status, 503, `Expected fail-closed 503 on signing error, got ${res.status}`);
        const text = await res.text();
        assert.ok(!text.includes("supabase://"), "Must never leak raw supabase:// URL on signing failure");
        assert.ok(!text.includes("/storage/v1/object/public/"), "Must never fall back to public storage URL");
        assert.ok(!text.includes("downloadUrl"), "Must not return any downloadUrl on signing failure");
      });
    } finally {
      await stopServer(server);
      setMockSupabaseServerClient(null);
    }
  }

  // =========================================================================
  // GROUP 7: FRONTEND COMPATIBILITY & SOURCE GUARDS
  // =========================================================================
  console.log("\n[Group 7] Frontend Service & AppContext Compatibility Guards");

  await runTest("7.1 authService.ts, resourceService.ts, and AppContext.tsx implement exact P0-3 frontend hardening", () => {
    const authSrc = fs.readFileSync(path.resolve("src/services/authService.ts"), "utf8");
    const resSrc = fs.readFileSync(path.resolve("src/services/resourceService.ts"), "utf8");
    const ctxSrc = fs.readFileSync(path.resolve("src/context/AppContext.tsx"), "utf8");

    // authService.ts requires email confirmation on fallback
    assert.ok(authSrc.includes("email_confirmed_at"), "authService.ts must enforce email_confirmed_at in fallback");

    // resourceService.ts uses public_resources for catalog/slug, keeps resources for admin CRUD, calls server endpoint
    const pubFnIdx = resSrc.indexOf("async fetchPublishedResources()");
    const allFnIdx = resSrc.indexOf("async fetchAllResources()");
    const slugFnIdx = resSrc.indexOf("async fetchResourceBySlug(");
    const insertFnIdx = resSrc.indexOf("async insertResource(");
    assert.ok(resSrc.slice(pubFnIdx, allFnIdx).includes(".from('public_resources')"), "fetchPublishedResources must query public_resources");
    assert.ok(resSrc.slice(allFnIdx, slugFnIdx).includes(".from('resources')"), "fetchAllResources must query public.resources for confirmed Admin CMS");
    assert.ok(resSrc.slice(slugFnIdx, insertFnIdx).includes(".from('public_resources')"), "fetchResourceBySlug must query public_resources");
    assert.ok(resSrc.includes("/api/resources/${encodeURIComponent(cleanId)}/record-download"), "incrementDownloadCount must call server endpoint");
    assert.ok(!resSrc.includes("increment_resource_downloads"), "resourceService.ts must not call removed client RPC");
    assert.ok(!resSrc.includes(".update({ download_count:"), "resourceService.ts must not attempt direct resources table update");

    // AppContext.tsx uses authService.checkIsAdmin(session.user) and guards paid purchases from free counter
    const refreshIdx = ctxSrc.indexOf("const refreshResources = useCallback");
    const addResIdx = ctxSrc.indexOf("const addResource = async");
    const refreshBlock = ctxSrc.slice(refreshIdx, addResIdx);
    assert.ok(refreshBlock.includes("await authService.checkIsAdmin(session.user)"), "refreshResources must verify admin via authService.checkIsAdmin");
    assert.ok(!refreshBlock.includes("Boolean(session && session.user)"), "refreshResources must not treat any authenticated session as admin");

    const purchaseIdx = ctxSrc.indexOf("const purchaseResource =");
    const refreshCoursesIdx = ctxSrc.indexOf("const refreshCourses = useCallback");
    const purchaseBlock = ctxSrc.slice(purchaseIdx, refreshCoursesIdx);
    assert.ok(purchaseBlock.includes("isAuthoritativePaidResource"), "purchaseResource must use isAuthoritativePaidResource");
    assert.ok(purchaseBlock.includes("isStrictlyFreePurchase"), "purchaseResource must guard free-download counter with isStrictlyFreePurchase");

    // E-9: Admin CMS retains paid URLs via __allow_paid_urls: true while deliverResource skips redundant client signing
    assert.ok(resSrc.slice(allFnIdx, slugFnIdx).includes("__allow_paid_urls: true"), "fetchAllResources must pass __allow_paid_urls: true for Admin CMS");
    assert.ok(resSrc.includes("isAlreadySignedStorageUrl"), "deliverResource must skip redundant client createSignedUrl on already-signed URLs");
    assert.ok(!/\.confirmed_at\b/.test(authSrc), "authService.ts must not fall back to user.confirmed_at");
    assert.ok(!/\bconfirmed_at\b/.test(authSrc.replace(/email_confirmed_at/g, "")), "authService.ts must not reference standalone confirmed_at");
  });

  // =========================================================================
  // GROUP 8: E-1 THROUGH E-10 REMEDIATION VERIFICATION TESTS
  // =========================================================================
  console.log("\n[Group 8] E-1 through E-10 Remediation Direct Verification");

  await runTest("8.1 (E-2) getDownloadRateLimitHmacSecret validates decoded byte length, rejects invalid hex & placeholders, never leaks secret", () => {
    const valid32ByteHex = crypto.randomBytes(32).toString("hex"); // 64 hex chars = 32 bytes
    const short31ByteHex = crypto.randomBytes(31).toString("hex"); // 62 hex chars = 31 bytes
    const odd63Hex = valid32ByteHex.slice(0, 63);
    const valid32ByteRaw = "AbCdEfGhIjKlMnOpQrStUvWxYz012345"; // 32 ASCII bytes
    const short31ByteRaw = "AbCdEfGhIjKlMnOpQrStUvWxYz01234"; // 31 ASCII bytes
    const valid32ByteB64 = `base64:${crypto.randomBytes(32).toString("base64")}`;
    const short31ByteB64 = `base64:${crypto.randomBytes(31).toString("base64")}`;
    const valid32ByteB64Url = `base64url:${crypto.randomBytes(32).toString("base64url")}`;
    const short31ByteB64Url = `base64url:${crypto.randomBytes(31).toString("base64url")}`;

    // Accept valid 32-byte secrets
    assert.strictEqual(getDownloadRateLimitHmacSecret({ DOWNLOAD_RATE_LIMIT_HMAC_SECRET: valid32ByteHex }), valid32ByteHex);
    assert.strictEqual(getDownloadRateLimitHmacSecret({ DOWNLOAD_RATE_LIMIT_HMAC_SECRET: `hex:${valid32ByteHex}` }), `hex:${valid32ByteHex}`);
    assert.strictEqual(getDownloadRateLimitHmacSecret({ DOWNLOAD_RATE_LIMIT_HMAC_SECRET: `0x${valid32ByteHex}` }), `0x${valid32ByteHex}`);
    assert.strictEqual(getDownloadRateLimitHmacSecret({ DOWNLOAD_RATE_LIMIT_HMAC_SECRET: valid32ByteRaw }), valid32ByteRaw);
    assert.strictEqual(getDownloadRateLimitHmacSecret({ DOWNLOAD_RATE_LIMIT_HMAC_SECRET: valid32ByteB64 }), valid32ByteB64);
    assert.strictEqual(getDownloadRateLimitHmacSecret({ DOWNLOAD_RATE_LIMIT_HMAC_SECRET: valid32ByteB64Url }), valid32ByteB64Url);
    assert.strictEqual(isDownloadRateLimitSecretConfigured({ DOWNLOAD_RATE_LIMIT_HMAC_SECRET: valid32ByteHex }), true);

    // Reject 31-byte secrets across all encodings (including 62-char hex = 31 bytes!)
    assert.strictEqual(getDownloadRateLimitHmacSecret({ DOWNLOAD_RATE_LIMIT_HMAC_SECRET: short31ByteHex }), null, "62-char hex (31 bytes) must be rejected");
    assert.strictEqual(getDownloadRateLimitHmacSecret({ DOWNLOAD_RATE_LIMIT_HMAC_SECRET: `hex:${short31ByteHex}` }), null);
    assert.strictEqual(getDownloadRateLimitHmacSecret({ DOWNLOAD_RATE_LIMIT_HMAC_SECRET: `0x${short31ByteHex}` }), null);
    assert.strictEqual(getDownloadRateLimitHmacSecret({ DOWNLOAD_RATE_LIMIT_HMAC_SECRET: short31ByteRaw }), null, "31-byte raw secret must be rejected");
    assert.strictEqual(getDownloadRateLimitHmacSecret({ DOWNLOAD_RATE_LIMIT_HMAC_SECRET: short31ByteB64 }), null);
    assert.strictEqual(getDownloadRateLimitHmacSecret({ DOWNLOAD_RATE_LIMIT_HMAC_SECRET: short31ByteB64Url }), null);

    // Reject invalid hexadecimal
    assert.strictEqual(getDownloadRateLimitHmacSecret({ DOWNLOAD_RATE_LIMIT_HMAC_SECRET: odd63Hex }), null, "Odd-length hex must be rejected");
    assert.strictEqual(getDownloadRateLimitHmacSecret({ DOWNLOAD_RATE_LIMIT_HMAC_SECRET: "a1b2c3d4e5f60718293a4b5c6d7e8f90" }), null, "32-char hex (16 bytes) must be rejected");
    assert.strictEqual(getDownloadRateLimitHmacSecret({ DOWNLOAD_RATE_LIMIT_HMAC_SECRET: `hex:${"z".repeat(64)}` }), null, "Non-hex under hex: must be rejected");
    assert.strictEqual(getDownloadRateLimitHmacSecret({ DOWNLOAD_RATE_LIMIT_HMAC_SECRET: `0x${valid32ByteHex.slice(0, 62)}zz` }), null, "Invalid hex chars under 0x must be rejected");
    assert.strictEqual(getDownloadRateLimitHmacSecret({ DOWNLOAD_RATE_LIMIT_HMAC_SECRET: `hex:${odd63Hex}` }), null);

    // Reject exact .env.example placeholder, undefined, null, empty, repeated low-entropy, whitespace
    const envExampleText = fs.readFileSync(path.resolve(".env.example"), "utf8");
    const envMatch = envExampleText.match(/DOWNLOAD_RATE_LIMIT_HMAC_SECRET="([^"]+)"/);
    assert.ok(envMatch && envMatch[1], ".env.example must define DOWNLOAD_RATE_LIMIT_HMAC_SECRET placeholder");
    const badValues: Array<string | undefined> = [
      undefined,
      "",
      "   ",
      "undefined",
      "null",
      "none",
      "changeme",
      envMatch![1],
      "generate_at_least_32_bytes_custom_placeholder",
      "your_super_long_placeholder_secret_value_123456",
      "a".repeat(64),
      "0".repeat(64),
      "ab".repeat(32),
      `${valid32ByteRaw} with spaces`
    ];
    for (const bad of badValues) {
      assert.strictEqual(
        getDownloadRateLimitHmacSecret({ DOWNLOAD_RATE_LIMIT_HMAC_SECRET: bad }),
        null,
        `Invalid/placeholder secret must be rejected`
      );
      assert.strictEqual(isDownloadRateLimitSecretConfigured({ DOWNLOAD_RATE_LIMIT_HMAC_SECRET: bad }), false);
    }
  });

  await runTest("8.2 (E-4 & E-8) Runtime checkIsAdmin & authService.checkIsAdmin require email_confirmed_at and reject confirmed_at-only", async () => {
    // Server-side isEmailConfirmed & checkIsAdmin
    assert.strictEqual(isEmailConfirmed({ id: "u1", email_confirmed_at: "2026-01-01T00:00:00Z" } as any), true);
    assert.strictEqual(isEmailConfirmed({ id: "u1", email_confirmed_at: null, confirmed_at: "2026-01-01T00:00:00Z" } as any), false);
    assert.strictEqual(isEmailConfirmed({ id: "u1", email_confirmed_at: "" } as any), false);

    // Email-allowlisted admins
    assert.strictEqual(checkIsAdmin({ id: "a1", email: "admin@digitalmuid.com", email_confirmed_at: null, app_metadata: {} } as any), false);
    assert.strictEqual(checkIsAdmin({ id: "a1", email: "admin@digitalmuid.com", email_confirmed_at: null, confirmed_at: "2026-01-01T00:00:00Z", app_metadata: {} } as any), false);
    assert.strictEqual(checkIsAdmin({ id: "a1", email: "admin@digitalmuid.com", email_confirmed_at: "2026-01-01T00:00:00Z", app_metadata: {} } as any), true);
    assert.strictEqual(checkIsAdmin({ id: "a2", email: "mkdigitalverse@gmail.com", email_confirmed_at: "2026-01-01T00:00:00Z", app_metadata: {} } as any), true);

    // app_metadata admins
    assert.strictEqual(checkIsAdmin({ id: "a3", email: "ops@example.test", email_confirmed_at: null, confirmed_at: "2026-01-01T00:00:00Z", app_metadata: { role: "admin" } } as any), false);
    assert.strictEqual(checkIsAdmin({ id: "a3", email: "ops@example.test", email_confirmed_at: "2026-01-01T00:00:00Z", app_metadata: { role: "admin" } } as any), true);

    // Frontend authService.checkIsAdmin runtime fallback execution (Supabase unconfigured/RPC unavailable offline)
    const origViteUrl = process.env.VITE_SUPABASE_URL;
    const origViteKey = process.env.VITE_SUPABASE_ANON_KEY;
    try {
      process.env.VITE_SUPABASE_URL = "";
      process.env.VITE_SUPABASE_ANON_KEY = "";

      assert.strictEqual(
        await authService.checkIsAdmin({ id: "fa1", email: "admin@digitalmuid.com", email_confirmed_at: null, confirmed_at: "2026-01-01T00:00:00Z", app_metadata: {}, user_metadata: {}, aud: "authenticated", created_at: "" } as any),
        false,
        "authService.checkIsAdmin must reject confirmed_at-only allowlisted admin"
      );
      assert.strictEqual(
        await authService.checkIsAdmin({ id: "fa2", email: "admin@digitalmuid.com", email_confirmed_at: "2026-01-01T00:00:00Z", app_metadata: {}, user_metadata: {}, aud: "authenticated", created_at: "" } as any),
        true,
        "authService.checkIsAdmin must allow confirmed email-allowlisted admin"
      );
      assert.strictEqual(
        await authService.checkIsAdmin({ id: "fa3", email: "ops@example.test", email_confirmed_at: null, app_metadata: { role: "admin" }, user_metadata: {}, aud: "authenticated", created_at: "" } as any),
        false,
        "authService.checkIsAdmin must reject unconfirmed app_metadata admin"
      );
      assert.strictEqual(
        await authService.checkIsAdmin({ id: "fa4", email: "ops@example.test", email_confirmed_at: "2026-01-01T00:00:00Z", app_metadata: { role: "admin" }, user_metadata: {}, aud: "authenticated", created_at: "" } as any),
        true,
        "authService.checkIsAdmin must allow confirmed app_metadata admin"
      );
      assert.strictEqual(
        await authService.checkIsAdmin({ id: "fs1", email: "student@example.test", email_confirmed_at: "2026-01-01T00:00:00Z", app_metadata: {}, user_metadata: { role: "admin" }, aud: "authenticated", created_at: "" } as any),
        false,
        "authService.checkIsAdmin must reject student with spoofed user_metadata.role=admin"
      );
    } finally {
      process.env.VITE_SUPABASE_URL = origViteUrl;
      process.env.VITE_SUPABASE_ANON_KEY = origViteKey;
    }
  });

  // Direct HTTP tests for E-1 (handleBundleFilesRequest), E-3 (get-resource-download-url), E-4 (buyer confirmation), and E-10 (/healthz)
  {
    const app = express();
    app.use(express.json());
    app.use("/api/payments", paymentRoutes);
    const { server, baseUrl } = await startEphemeralServer(app);

    const createBundleAndDownloadMock = (opts: {
      bundleFileUrl?: string | null;
      childFileUrls?: Record<string, string | null>;
      extraResources?: Array<Record<string, any>>;
      signErrorForPath?: string | null;
      returnNullSignedUrlForPath?: string | null;
      omitStorage?: boolean;
      buyerConfirmed?: boolean;
      buyerPhoneConfirmedOnly?: boolean;
    } = {}) => {
      const signCalls: Array<{ bucket: string; path: string }> = [];
      const buyerId = "99000000-0000-4000-8000-00000000a001";
      const tokens: Record<string, any> = {
        "tok-buyer-confirmed": {
          id: buyerId,
          email: "buyer.e1@example.test",
          email_confirmed_at: "2026-01-01T00:00:00Z",
          app_metadata: {}
        },
        "tok-buyer-unconfirmed": {
          id: buyerId,
          email: "buyer.e1@example.test",
          email_confirmed_at: null,
          confirmed_at: opts.buyerPhoneConfirmedOnly ? "2026-01-01T00:00:00Z" : null,
          app_metadata: {}
        }
      };

      const resourcesTable: Array<Record<string, any>> = [
        {
          id: BUNDLE_RESOURCE_ID,
          slug: "meta-ads-campaign-planner-bundle",
          title: "Meta Ads Campaign Planner Bundle",
          status: "published",
          access_type: "paid",
          price: 299,
          currency: "INR",
          file_url: opts.bundleFileUrl !== undefined ? opts.bundleFileUrl : "supabase://paid-resources/paid/bundle-master.zip",
          external_url: "https://evil-raw-external.example.test/bundle"
        },
        ...BUNDLE_ITEMS.map((item) => ({
          id: item.id,
          slug: item.slug,
          title: item.title,
          status: "published",
          access_type: "paid",
          price: 79,
          currency: "INR",
          file_url: opts.childFileUrls && Object.prototype.hasOwnProperty.call(opts.childFileUrls, item.id)
            ? opts.childFileUrls[item.id]
            : `supabase://paid-resources/${item.storagePath}`,
          external_url: "https://evil-raw-external.example.test/child"
        })),
        ...(opts.extraResources || [])
      ];

      const paymentsTable: Array<Record<string, any>> = [
        {
          id: "pay-e1-bundle",
          user_id: buyerId,
          item_type: "resource",
          item_id: BUNDLE_RESOURCE_ID,
          status: "captured",
          amount: 299,
          currency: "INR",
          razorpay_order_id: "order_e1_bundle",
          razorpay_payment_id: "pay_e1_bundle"
        },
        ...(opts.extraResources || []).map((r, idx) => ({
          id: `pay-e3-extra-${idx}`,
          user_id: buyerId,
          item_type: "resource",
          item_id: r.id,
          status: "captured",
          amount: r.price || 199,
          currency: "INR",
          razorpay_order_id: `order_e3_extra_${idx}`,
          razorpay_payment_id: `pay_e3_extra_${idx}`
        }))
      ];

      const tables: Record<string, Array<Record<string, any>>> = {
        resources: resourcesTable,
        payments: paymentsTable,
        resource_purchases: []
      };

      const makeBuilder = (table: string) => {
        const filters: Array<{ op: string; col: string; val: any }> = [];
        const execute = async (mode: "all" | "maybeSingle" | "single") => {
          const rows = (tables[table] || []).filter((row) =>
            filters.every((f) => {
              if (f.op === "eq") return row[f.col] === f.val;
              if (f.op === "in") return Array.isArray(f.val) && f.val.includes(row[f.col]);
              return true;
            })
          );
          if (mode === "maybeSingle") return { data: rows[0] || null, error: null };
          if (mode === "single") return { data: rows[0] || null, error: rows[0] ? null : { message: "Not found" } };
          return { data: rows, error: null };
        };
        const b: any = {
          select() { return b; },
          eq(col: string, val: any) { filters.push({ op: "eq", col, val }); return b; },
          in(col: string, val: any) { filters.push({ op: "in", col, val }); return b; },
          maybeSingle() { return execute("maybeSingle"); },
          single() { return execute("single"); },
          then(resolve: any, reject: any) { return execute("all").then(resolve, reject); }
        };
        return b;
      };

      const client: any = {
        auth: {
          async getUser(tok: string) {
            const u = tokens[tok];
            return u ? { data: { user: u }, error: null } : { data: { user: null }, error: new Error("Invalid") };
          }
        },
        from(table: string) {
          return makeBuilder(table);
        },
        ...(opts.omitStorage
          ? {}
          : {
              storage: {
                from(bucket: string) {
                  return {
                    async createSignedUrl(objectPath: string) {
                      signCalls.push({ bucket, path: objectPath });
                      if (opts.signErrorForPath && (opts.signErrorForPath === "*" || opts.signErrorForPath === objectPath)) {
                        return { data: null, error: { message: "Object not found / signing failed" } };
                      }
                      if (opts.returnNullSignedUrlForPath && (opts.returnNullSignedUrlForPath === "*" || opts.returnNullSignedUrlForPath === objectPath)) {
                        return { data: { signedUrl: null }, error: null };
                      }
                      return {
                        data: { signedUrl: `https://signed.p03.test/storage/v1/object/sign/${bucket}/${objectPath}?token=ok` },
                        error: null
                      };
                    }
                  };
                }
              }
            })
      };

      return { client, signCalls };
    };

    try {
      await runTest("8.3 (E-1) handleBundleFilesRequest resolves private `paid-resources` bucket, preserves custom/legacy records, and fails closed 503 on error/missing file/missing client", async () => {
        // Case 1: Success against private `paid-resources` bucket (including custom child storage path)
        resetPaymentRateLimits();
        const customChildPath = "paid/v2/custom-workbook-2026.pdf";
        const okMock = createBundleAndDownloadMock({
          childFileUrls: {
            [BUNDLE_ITEMS[0].id]: `supabase://paid-resources/${customChildPath}`,
            [BUNDLE_ITEMS[1].id]: "supabase://resources/paid/legacy-calculator.xlsx"
          }
        });
        setMockSupabaseServerClient(okMock.client);

        const okRes = await fetch(`${baseUrl}/api/payments/get-bundle-files`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer tok-buyer-confirmed" },
          body: JSON.stringify({ bundleId: BUNDLE_RESOURCE_ID })
        });
        assert.strictEqual(okRes.status, 200);
        const okBody = await okRes.json();
        assert.strictEqual(okBody.authorized, true);
        assert.strictEqual(okBody.files.length, 4);
        assert.deepStrictEqual(okMock.signCalls[0], { bucket: "paid-resources", path: customChildPath });
        assert.deepStrictEqual(okMock.signCalls[1], { bucket: "resources", path: "paid/legacy-calculator.xlsx" });
        assert.strictEqual(okMock.signCalls[2].bucket, "paid-resources");
        assert.strictEqual(okMock.signCalls[3].bucket, "paid-resources");

        // Case 2: Storage signing error -> HTTP 503 (zero silent fallback to download-paid-asset)
        resetPaymentRateLimits();
        const errMock = createBundleAndDownloadMock({ signErrorForPath: BUNDLE_ITEMS[2].storagePath });
        setMockSupabaseServerClient(errMock.client);
        const errRes = await fetch(`${baseUrl}/api/payments/bundle-files?bundleId=${BUNDLE_RESOURCE_ID}`, {
          headers: { Authorization: "Bearer tok-buyer-confirmed" }
        });
        assert.strictEqual(errRes.status, 503, `Expected 503 on bundle signing error, got ${errRes.status}`);
        const errText = await errRes.text();
        assert.ok(!errText.includes("download-paid-asset"), "Must NEVER silently fall back to download-paid-asset on signing error");

        // Case 3: Missing file / null signedUrl -> HTTP 503 (zero silent fallback)
        resetPaymentRateLimits();
        const nullUrlMock = createBundleAndDownloadMock({ returnNullSignedUrlForPath: BUNDLE_ITEMS[0].storagePath });
        setMockSupabaseServerClient(nullUrlMock.client);
        const nullUrlRes = await fetch(`${baseUrl}/api/payments/get-bundle-files`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer tok-buyer-confirmed" },
          body: JSON.stringify({ bundleId: BUNDLE_RESOURCE_ID })
        });
        assert.strictEqual(nullUrlRes.status, 503, `Expected 503 on missing signedUrl, got ${nullUrlRes.status}`);
        const nullUrlText = await nullUrlRes.text();
        assert.ok(!nullUrlText.includes("download-paid-asset"), "Must NEVER silently fall back on null signedUrl");

        // Case 4: Missing storage client -> HTTP 503
        resetPaymentRateLimits();
        const noStorageMock = createBundleAndDownloadMock({ omitStorage: true });
        setMockSupabaseServerClient(noStorageMock.client);
        const noStorageRes = await fetch(`${baseUrl}/api/payments/get-bundle-files`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer tok-buyer-confirmed" },
          body: JSON.stringify({ bundleId: BUNDLE_RESOURCE_ID })
        });
        assert.strictEqual(noStorageRes.status, 503);

        // Case 5: Missing service-role client -> HTTP 503
        resetPaymentRateLimits();
        setMockSupabaseServerClient(null);
        const noSvcRes = await fetch(`${baseUrl}/api/payments/bundle-files?bundleId=${BUNDLE_RESOURCE_ID}`, {
          headers: { Authorization: "Bearer tok-buyer-confirmed" }
        });
        assert.strictEqual(noSvcRes.status, 503);
      });

      await runTest("8.4 (E-3) get-resource-download-url resolves exact bundle-child path, fails closed 503 on missing signedUrl, and NEVER returns raw external URL", async () => {
        const extOnlyPaidId = "99000000-0000-4000-8000-00000000e301";
        const rawHttpsFilePaidId = "99000000-0000-4000-8000-00000000e302";
        const customChildPath = "paid/custom-override/workbook-v3.pdf";

        // Case 1: Bundle child with custom path under paid-resources signs exact custom path
        resetPaymentRateLimits();
        const m1 = createBundleAndDownloadMock({
          childFileUrls: { [BUNDLE_ITEMS[0].id]: `supabase://paid-resources/${customChildPath}` },
          extraResources: [
            {
              id: extOnlyPaidId,
              slug: "p03-synth-paid-ext-only",
              title: "Paid External Only",
              status: "published",
              access_type: "paid",
              price: 199,
              currency: "INR",
              file_url: null,
              external_url: "https://drive.google.com/file/d/leaked-secret/view"
            },
            {
              id: rawHttpsFilePaidId,
              slug: "p03-synth-paid-raw-https",
              title: "Paid Raw HTTPS",
              status: "published",
              access_type: "paid",
              price: 199,
              currency: "INR",
              file_url: "https://cdn.external.example.test/raw-paid.pdf",
              external_url: null
            }
          ]
        });
        setMockSupabaseServerClient(m1.client);

        const childOk = await fetch(`${baseUrl}/api/payments/get-resource-download-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer tok-buyer-confirmed" },
          body: JSON.stringify({ resourceId: BUNDLE_ITEMS[0].id })
        });
        assert.strictEqual(childOk.status, 200);
        const childOkBody = await childOk.json();
        assert.deepStrictEqual(m1.signCalls[0], { bucket: "paid-resources", path: customChildPath });
        assert.strictEqual(childOkBody.externalUrl, null);
        assert.ok(childOkBody.downloadUrl.includes(customChildPath));

        // Case 2: Paid resource with ONLY external_url -> HTTP 503, NEVER leaks external_url
        resetPaymentRateLimits();
        const extRes = await fetch(`${baseUrl}/api/payments/get-resource-download-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer tok-buyer-confirmed" },
          body: JSON.stringify({ resourceId: extOnlyPaidId })
        });
        assert.strictEqual(extRes.status, 503, `Paid external-only resource must return 503, got ${extRes.status}`);
        const extText = await extRes.text();
        assert.ok(!extText.includes("drive.google.com"), "Must NEVER return raw external URL for paid resource");

        // Case 3: Paid resource with non-Storage raw https file_url -> HTTP 503
        resetPaymentRateLimits();
        const rawHttpsRes = await fetch(`${baseUrl}/api/payments/get-resource-download-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer tok-buyer-confirmed" },
          body: JSON.stringify({ resourceId: rawHttpsFilePaidId })
        });
        assert.strictEqual(rawHttpsRes.status, 503);
        const rawHttpsText = await rawHttpsRes.text();
        assert.ok(!rawHttpsText.includes("cdn.external.example.test"), "Must NEVER return raw external file_url for paid resource");

        // Case 4: Bundle child returns null signedUrl without error -> HTTP 503 (never falls through to download-paid-asset)
        resetPaymentRateLimits();
        const mNull = createBundleAndDownloadMock({
          returnNullSignedUrlForPath: BUNDLE_ITEMS[0].storagePath
        });
        setMockSupabaseServerClient(mNull.client);
        const nullSignRes = await fetch(`${baseUrl}/api/payments/get-resource-download-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer tok-buyer-confirmed" },
          body: JSON.stringify({ resourceId: BUNDLE_ITEMS[0].id })
        });
        assert.strictEqual(nullSignRes.status, 503);
        const nullSignText = await nullSignRes.text();
        assert.ok(!nullSignText.includes("download-paid-asset"));

        // Case 5: parseProtectedStorageUrl rejects traversal
        assert.deepStrictEqual(parseProtectedStorageUrl("supabase://paid-resources/../secret.pdf"), {
          isStorage: true,
          bucket: null,
          objectPath: null
        });
      });

      await runTest("8.5 (E-4) Unconfirmed authenticated buyer (including confirmed_at-only) is denied across download branch 2/3, bundle-files, and verify-purchase-status", async () => {
        resetPaymentRateLimits();
        const m = createBundleAndDownloadMock({ buyerPhoneConfirmedOnly: true });
        setMockSupabaseServerClient(m.client);

        // Branch 2 (orderId + paymentId supplied) on get-resource-download-url -> 403
        const dlBranch2 = await fetch(`${baseUrl}/api/payments/get-resource-download-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer tok-buyer-unconfirmed" },
          body: JSON.stringify({
            resourceId: BUNDLE_ITEMS[0].id,
            orderId: "order_e1_bundle",
            paymentId: "pay_e1_bundle"
          })
        });
        assert.strictEqual(dlBranch2.status, 403, "Unconfirmed buyer must be denied in get-resource-download-url branch 2");

        // Branch 3 (session only) on get-resource-download-url -> 403
        const dlBranch3 = await fetch(`${baseUrl}/api/payments/get-resource-download-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer tok-buyer-unconfirmed" },
          body: JSON.stringify({ resourceId: BUNDLE_ITEMS[0].id })
        });
        assert.strictEqual(dlBranch3.status, 403, "Unconfirmed buyer must be denied in get-resource-download-url branch 3");

        // handleBundleFilesRequest (both branch 2 & branch 3) -> 403
        const bndBranch2 = await fetch(`${baseUrl}/api/payments/get-bundle-files`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer tok-buyer-unconfirmed" },
          body: JSON.stringify({
            bundleId: BUNDLE_RESOURCE_ID,
            orderId: "order_e1_bundle",
            paymentId: "pay_e1_bundle"
          })
        });
        assert.strictEqual(bndBranch2.status, 403, "Unconfirmed buyer must be denied in handleBundleFilesRequest branch 2");

        const bndBranch3 = await fetch(`${baseUrl}/api/payments/get-bundle-files`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer tok-buyer-unconfirmed" },
          body: JSON.stringify({ bundleId: BUNDLE_RESOURCE_ID })
        });
        assert.strictEqual(bndBranch3.status, 403, "Unconfirmed buyer must be denied in handleBundleFilesRequest branch 3");

        // verify-purchase-status (branch 3 session lookup) -> verified: false
        const statusBranch3 = await fetch(
          `${baseUrl}/api/payments/verify-purchase-status?resourceId=${BUNDLE_RESOURCE_ID}`,
          { headers: { Authorization: "Bearer tok-buyer-unconfirmed" } }
        );
        const statusBody = await statusBranch3.json();
        assert.strictEqual(statusBody.verified, false, "Unconfirmed buyer must not receive verified=true in verify-purchase-status");
      });
    } finally {
      await stopServer(server);
      setMockSupabaseServerClient(null);
    }
  }

  await runTest("8.6 (E-9) Admin CMS mapper preserves paid URLs with __allow_paid_urls while public mapper redacts them", () => {
    const paidRow = {
      id: "27ef2c04-4d4a-4dbe-a702-d4013b2542b9",
      title: "Meta Ads Workbook",
      slug: "meta-ads-campaign-planner-workbook",
      status: "published",
      access_type: "paid",
      price: 99,
      currency: "INR",
      file_url: "supabase://paid-resources/paid/meta-ads-campaign-planner-workbook.pdf",
      external_url: "https://internal.example.test/edit-ref"
    };

    const publicMapped = mapDbRowToResource(paidRow);
    assert.strictEqual(publicMapped.fileUrl, undefined, "Public catalog mapping must redact paid fileUrl");
    assert.strictEqual(publicMapped.externalUrl, undefined, "Public catalog mapping must redact paid externalUrl");

    const adminMapped = mapDbRowToResource({ ...paidRow, __allow_paid_urls: true });
    assert.strictEqual(adminMapped.fileUrl, paidRow.file_url, "Admin CMS mapping must preserve paid fileUrl for editing");
    assert.strictEqual(adminMapped.externalUrl, paidRow.external_url, "Admin CMS mapping must preserve paid externalUrl for editing");
  });

  await runTest("8.7 (E-7 & E-10) Static SQL checks for percent-decoding, BYPASSRLS guard, bounded pruning, blanket storage policy detection, and /healthz accuracy", async () => {
    const stepASql = fs.readFileSync(
      path.resolve("supabase/migrations/20261121000001_p0_3a_harden_resources_and_free_downloads.sql"),
      "utf8"
    );
    const stepBSql = fs.readFileSync(
      path.resolve("supabase/operations/p0_3b_private_paid_resources_storage.sql"),
      "utf8"
    );

    // E-7 static SQL assertions
    assert.ok(stepASql.includes("FOR v_round IN 1..3 LOOP"), "is_protected_resource_url must implement bounded 3-round percent decoding");
    assert.ok(stepASql.includes("pg_catalog.get_byte(pg_catalog.decode(v_hex, 'hex'), 0)"), "Must decode hex escapes via pg_catalog");
    assert.ok(stepASql.includes("r.rolsuper, r.rolbypassrls"), "Migration must inspect postgres rolsuper/rolbypassrls instead of assuming");
    assert.ok(stepASql.includes("LIMIT 50") && stepASql.includes("FOR UPDATE SKIP LOCKED"), "Rate-limit cleanup must be bounded and indexed with SKIP LOCKED");

    // E-10 static Storage SQL assertions
    assert.ok(stepBSql.includes("\\bbucket_id\\b"), "Step B must detect blanket storage.objects policies missing bucket_id filter");

    // E-10 live /healthz accuracy check (no secret value leaked)
    const app = await createApp({ isProduction: true, distDir: path.resolve("dist") });
    const { server, baseUrl } = await startEphemeralServer(app);
    const origDlSecret = process.env.DOWNLOAD_RATE_LIMIT_HMAC_SECRET;
    try {
      // Placeholder secret -> downloadRateLimitSecretConfigured: false
      process.env.DOWNLOAD_RATE_LIMIT_HMAC_SECRET = "generate_at_least_32_bytes_random_hex_secret_here";
      const r1 = await fetch(`${baseUrl}/healthz`);
      const b1 = await r1.json();
      assert.strictEqual(b1.gateway.downloadRateLimitSecretConfigured, false);
      assert.strictEqual(b1.gateway.downloadCounterReady, false);

      // 31-byte hex -> false
      process.env.DOWNLOAD_RATE_LIMIT_HMAC_SECRET = crypto.randomBytes(31).toString("hex");
      const r2 = await fetch(`${baseUrl}/healthz`);
      const b2 = await r2.json();
      assert.strictEqual(b2.gateway.downloadRateLimitSecretConfigured, false);

      // Valid 32-byte hex -> true, never leaked in body
      const validHex = crypto.randomBytes(32).toString("hex");
      process.env.DOWNLOAD_RATE_LIMIT_HMAC_SECRET = validHex;
      const r3 = await fetch(`${baseUrl}/healthz`);
      const text3 = await r3.text();
      const b3 = JSON.parse(text3);
      assert.strictEqual(b3.gateway.downloadRateLimitSecretConfigured, true);
      assert.strictEqual(b3.gateway.downloadCounterReady, true);
      assert.strictEqual(text3.includes(validHex), false, "/healthz must never print the HMAC secret");
    } finally {
      process.env.DOWNLOAD_RATE_LIMIT_HMAC_SECRET = origDlSecret;
      await stopServer(server);
    }
  });

  // =========================================================================
  // 9. C6-1 & C6-2 REMEDIATION REGRESSION TESTS (HTTP STATUS & BODY VERIFIED)
  // =========================================================================
  console.log("\n[9] C6-1 Free URL Exposure & C6-2 Protected Local Asset Remediation");

  await runTest("9.1 (C6-1) getAuthoritativeResourcePricing requires BOTH access_type='free' AND strict numeric price=0", () => {
    // Valid free cases
    assert.strictEqual(
      getAuthoritativeResourcePricing("free-ok-1", { id: "free-ok-1", status: "published", access_type: "free", price: 0, currency: "INR" }).accessType,
      "free"
    );
    assert.strictEqual(
      getAuthoritativeResourcePricing("free-ok-2", { id: "free-ok-2", status: "published", access_type: "free", price: "0.00", currency: "INR" }).accessType,
      "free"
    );

    // Inconsistent free records MUST fail closed as "unverified"
    assert.strictEqual(
      getAuthoritativeResourcePricing("free-bad-pos", { id: "free-bad-pos", status: "published", access_type: "free", price: 99, currency: "INR" }).accessType,
      "unverified"
    );
    assert.strictEqual(
      getAuthoritativeResourcePricing("free-bad-neg", { id: "free-bad-neg", status: "published", access_type: "free", price: -10, currency: "INR" }).accessType,
      "unverified"
    );
    assert.strictEqual(
      getAuthoritativeResourcePricing("free-bad-null", { id: "free-bad-null", status: "published", access_type: "free", price: null, currency: "INR" }).accessType,
      "unverified"
    );
    assert.strictEqual(
      getAuthoritativeResourcePricing("free-bad-empty", { id: "free-bad-empty", status: "published", access_type: "free", price: "", currency: "INR" }).accessType,
      "unverified"
    );
    assert.strictEqual(
      getAuthoritativeResourcePricing("free-missing-type", { id: "free-missing-type", status: "published", access_type: null, price: 0, currency: "INR" }).accessType,
      "unverified"
    );
    assert.strictEqual(isZeroPriceStrict(0), true);
    assert.strictEqual(isZeroPriceStrict("0.00"), true);
    assert.strictEqual(isZeroPriceStrict(null), false);
    assert.strictEqual(isZeroPriceStrict(""), false);
    assert.strictEqual(isZeroPriceStrict(false), false);
    assert.strictEqual(isZeroPriceStrict(0.01), false);
  });

  {
    const c6App = express();
    c6App.use(express.json());
    c6App.use("/api/payments", paymentRoutes);
    const { server: c6Server, baseUrl: c6BaseUrl } = await startEphemeralServer(c6App);

    const FREE_PUBLIC_LOCAL_ID = "99100000-0000-4000-8000-000000000001";
    const FREE_PUBLIC_HTTPS_ID = "99100000-0000-4000-8000-000000000002";
    const FREE_MISSING_URL_ID = "99100000-0000-4000-8000-000000000003";
    const FREE_PRICE_POS_ID = "99100000-0000-4000-8000-000000000004";
    const FREE_STORAGE_SCHEME_ID = "99100000-0000-4000-8000-000000000005";
    const FREE_STORAGE_HTTP_ID = "99100000-0000-4000-8000-000000000006";
    const FREE_PROTECTED_LOCAL_ID = "99100000-0000-4000-8000-000000000007";
    const FREE_PCT_ENCODED_ID = "99100000-0000-4000-8000-000000000008";
    const FREE_TRAVERSAL_ID = "99100000-0000-4000-8000-000000000009";
    const FREE_EXT_PROTECTED_ID = "99100000-0000-4000-8000-000000000010";
    const FREE_ARBITRARY_LOCAL_ID = "99100000-0000-4000-8000-000000000011";
    const PAID_PRIVATE_STORAGE_ID = "99100000-0000-4000-8000-000000000020";
    const PAID_SECOND_STORAGE_ID = "99100000-0000-4000-8000-000000000021";
    const PAID_UNMAPPED_DOWNLOADS_ID = "99100000-0000-4000-8000-000000000022";
    const PAID_UNMAPPED_PROTECTED_ID = "99100000-0000-4000-8000-000000000023";
    const PAID_TRAVERSAL_STORAGE_ID = "99100000-0000-4000-8000-000000000024";
    const PAID_TRAVERSAL_LOCAL_ID = "99100000-0000-4000-8000-000000000025";
    const UNKNOWN_STANDALONE_ID = "99100000-0000-4000-8000-000000000099";

    const BUYER_C6_ID = "99200000-0000-4000-8000-000000000001";
    const ADMIN_C6_ID = "99200000-0000-4000-8000-000000000009";

    const createC6MockDb = (opts: {
      signErrorForPath?: string | null;
      nullUrlForPath?: string | null;
      overrideWorkbookFileUrl?: string | null;
    } = {}) => {
      const signCalls: Array<{ bucket: string; path: string }> = [];
      const tokens: Record<string, any> = {
        "tok-c6-buyer": {
          id: BUYER_C6_ID,
          email: "buyer.c6@example.test",
          email_confirmed_at: "2026-01-01T00:00:00Z",
          app_metadata: {}
        },
        "tok-c6-admin": {
          id: ADMIN_C6_ID,
          email: "admin@digitalmuid.com",
          email_confirmed_at: "2026-01-01T00:00:00Z",
          app_metadata: { role: "admin" }
        }
      };

      const resourcesRows: Array<Record<string, any>> = [
        {
          id: FREE_PUBLIC_LOCAL_ID,
          slug: "c6-free-public-local",
          title: "Free Public Local PDF",
          status: "published",
          access_type: "free",
          price: 0,
          currency: "INR",
          file_url: "/downloads/ai-growth-prompts.pdf",
          external_url: null
        },
        {
          id: FREE_PUBLIC_HTTPS_ID,
          slug: "c6-free-public-https",
          title: "Free Public External Guide",
          status: "published",
          access_type: "free",
          price: 0,
          currency: "INR",
          file_url: null,
          external_url: "https://cdn.example.test/public/free-growth-guide.pdf"
        },
        {
          id: FREE_MISSING_URL_ID,
          slug: "c6-free-missing-url",
          title: "Free Missing URL",
          status: "published",
          access_type: "free",
          price: 0,
          currency: "INR",
          file_url: null,
          external_url: null
        },
        {
          id: FREE_PRICE_POS_ID,
          slug: "c6-free-price-pos",
          title: "Inconsistent Free With Positive Price",
          status: "published",
          access_type: "free",
          price: 199,
          currency: "INR",
          file_url: "/downloads/should-never-disclose-inconsistent.pdf",
          external_url: "https://cdn.example.test/should-never-disclose.pdf"
        },
        {
          id: FREE_STORAGE_SCHEME_ID,
          slug: "c6-free-storage-scheme",
          title: "Free With Paid Storage Scheme",
          status: "published",
          access_type: "free",
          price: 0,
          currency: "INR",
          file_url: "supabase://paid-resources/paid/secret-workbook.pdf",
          external_url: null
        },
        {
          id: FREE_STORAGE_HTTP_ID,
          slug: "c6-free-storage-http",
          title: "Free With Storage Object URL",
          status: "published",
          access_type: "free",
          price: 0,
          currency: "INR",
          file_url: "https://proj.supabase.co/storage/v1/object/public/paid-resources/secret.pdf",
          external_url: null
        },
        {
          id: FREE_PROTECTED_LOCAL_ID,
          slug: "c6-free-protected-local",
          title: "Free With Protected Local Path",
          status: "published",
          access_type: "free",
          price: 0,
          currency: "INR",
          file_url: "/protected_downloads/meta-ads-campaign-planner-workbook.pdf",
          external_url: null
        },
        {
          id: FREE_PCT_ENCODED_ID,
          slug: "c6-free-pct-encoded",
          title: "Free With Percent Encoded Protected Path",
          status: "published",
          access_type: "free",
          price: 0,
          currency: "INR",
          file_url: "/%70rotected_downloads/secret.pdf",
          external_url: null
        },
        {
          id: FREE_TRAVERSAL_ID,
          slug: "c6-free-traversal",
          title: "Free With Path Traversal",
          status: "published",
          access_type: "free",
          price: 0,
          currency: "INR",
          file_url: "/downloads/../protected_downloads/secret.pdf",
          external_url: null
        },
        {
          id: FREE_EXT_PROTECTED_ID,
          slug: "c6-free-ext-protected",
          title: "Free With Protected External URL",
          status: "published",
          access_type: "free",
          price: 0,
          currency: "INR",
          file_url: null,
          external_url: "supabase://paid-resources/paid/secret-via-external.pdf"
        },
        {
          id: FREE_ARBITRARY_LOCAL_ID,
          slug: "c6-free-arbitrary-local",
          title: "Free With Arbitrary Local Path",
          status: "published",
          access_type: "free",
          price: 0,
          currency: "INR",
          file_url: "/etc/passwd",
          external_url: null
        },
        {
          id: PAID_PRIVATE_STORAGE_ID,
          slug: "c6-paid-private-storage",
          title: "Paid Standalone Storage Asset A",
          status: "published",
          access_type: "paid",
          price: 249,
          currency: "INR",
          file_url: "supabase://paid-resources/paid/standalone-asset-a.pdf",
          external_url: "https://secret.example.test/raw-paid-a.pdf"
        },
        {
          id: PAID_SECOND_STORAGE_ID,
          slug: "c6-paid-second-storage",
          title: "Paid Standalone Storage Asset B",
          status: "published",
          access_type: "paid",
          price: 249,
          currency: "INR",
          file_url: "supabase://paid-resources/paid/standalone-asset-b.pdf",
          external_url: "https://secret.example.test/raw-paid-b.pdf"
        },
        {
          id: PAID_UNMAPPED_DOWNLOADS_ID,
          slug: "c6-paid-unmapped-downloads",
          title: "Paid Standalone Arbitrary Downloads Path",
          status: "published",
          access_type: "paid",
          price: 149,
          currency: "INR",
          file_url: "/downloads/unmapped-paid-ebook.pdf",
          external_url: null
        },
        {
          id: PAID_UNMAPPED_PROTECTED_ID,
          slug: "c6-paid-unmapped-protected",
          title: "Paid Standalone Unmapped Protected Path",
          status: "published",
          access_type: "paid",
          price: 149,
          currency: "INR",
          file_url: "/protected_downloads/meta-ads-campaign-planner-workbook.pdf",
          external_url: null
        },
        {
          id: PAID_TRAVERSAL_STORAGE_ID,
          slug: "c6-paid-traversal-storage",
          title: "Paid Traversal Storage Path",
          status: "published",
          access_type: "paid",
          price: 149,
          currency: "INR",
          file_url: "supabase://paid-resources/paid/%2e%2e/secret.pdf",
          external_url: null
        },
        {
          id: PAID_TRAVERSAL_LOCAL_ID,
          slug: "c6-paid-traversal-local",
          title: "Paid Traversal Local Path",
          status: "published",
          access_type: "paid",
          price: 149,
          currency: "INR",
          file_url: "/protected_downloads/../../package.json",
          external_url: null
        },
        {
          id: BUNDLE_ITEMS[0].id,
          slug: BUNDLE_ITEMS[0].slug,
          title: BUNDLE_ITEMS[0].title,
          status: "published",
          access_type: "paid",
          price: 129,
          currency: "INR",
          file_url: opts.overrideWorkbookFileUrl !== undefined
            ? opts.overrideWorkbookFileUrl
            : "/protected_downloads/meta-ads-campaign-planner-workbook.pdf",
          external_url: null
        },
        {
          id: BUNDLE_ITEMS[1].id,
          slug: BUNDLE_ITEMS[1].slug,
          title: BUNDLE_ITEMS[1].title,
          status: "published",
          access_type: "paid",
          price: 79,
          currency: "INR",
          file_url: "/protected_downloads/the-ad-budget-break-even-calculator.xlsx",
          external_url: null
        }
      ];

      const paymentsRows: Array<Record<string, any>> = [
        // Authenticated buyer owns PAID_PRIVATE_STORAGE_ID, PAID_UNMAPPED_*, PAID_TRAVERSAL_*, and BUNDLE_ITEMS[0] (NOT PAID_SECOND_STORAGE_ID or BUNDLE_ITEMS[1])
        { id: "p-c6-1", user_id: BUYER_C6_ID, item_type: "resource", item_id: PAID_PRIVATE_STORAGE_ID, status: "captured", amount: 249, currency: "INR", razorpay_order_id: "order_c6_a", razorpay_payment_id: "pay_c6_a" },
        { id: "p-c6-2", user_id: BUYER_C6_ID, item_type: "resource", item_id: PAID_UNMAPPED_DOWNLOADS_ID, status: "captured", amount: 149, currency: "INR", razorpay_order_id: "order_c6_u1", razorpay_payment_id: "pay_c6_u1" },
        { id: "p-c6-3", user_id: BUYER_C6_ID, item_type: "resource", item_id: PAID_UNMAPPED_PROTECTED_ID, status: "captured", amount: 149, currency: "INR", razorpay_order_id: "order_c6_u2", razorpay_payment_id: "pay_c6_u2" },
        { id: "p-c6-4", user_id: BUYER_C6_ID, item_type: "resource", item_id: PAID_TRAVERSAL_STORAGE_ID, status: "captured", amount: 149, currency: "INR", razorpay_order_id: "order_c6_t1", razorpay_payment_id: "pay_c6_t1" },
        { id: "p-c6-5", user_id: BUYER_C6_ID, item_type: "resource", item_id: PAID_TRAVERSAL_LOCAL_ID, status: "captured", amount: 149, currency: "INR", razorpay_order_id: "order_c6_t2", razorpay_payment_id: "pay_c6_t2" },
        { id: "p-c6-6", user_id: BUYER_C6_ID, item_type: "resource", item_id: BUNDLE_ITEMS[0].id, status: "captured", amount: 129, currency: "INR", razorpay_order_id: "order_c6_wb", razorpay_payment_id: "pay_c6_wb" },
        // Guest purchase for PAID_PRIVATE_STORAGE_ID only
        { id: "p-c6-guest", user_id: null, item_type: "resource", item_id: PAID_PRIVATE_STORAGE_ID, status: "captured", amount: 249, currency: "INR", razorpay_order_id: "order_c6_guest_a", razorpay_payment_id: "pay_c6_guest_a", customer_email: "guest.c6@example.test" }
      ];

      const purchasesRows: Array<Record<string, any>> = [
        {
          id: "rp-c6-guest",
          user_id: null,
          resource_id: PAID_PRIVATE_STORAGE_ID,
          status: "active",
          amount: 249,
          currency: "INR",
          razorpay_order_id: "order_c6_guest_a",
          razorpay_payment_id: "pay_c6_guest_a",
          customer_email: "guest.c6@example.test",
          customer_phone: "+919999000001"
        }
      ];

      const tables: Record<string, Array<Record<string, any>>> = {
        resources: resourcesRows,
        payments: paymentsRows,
        resource_purchases: purchasesRows
      };

      const makeBuilder = (table: string) => {
        const filters: Array<{ op: string; col: string; val: any }> = [];
        const execute = async (mode: "all" | "maybeSingle" | "single") => {
          const rows = (tables[table] || []).filter((row) =>
            filters.every((f) => {
              if (f.op === "eq") return row[f.col] === f.val;
              if (f.op === "in") return Array.isArray(f.val) && f.val.includes(row[f.col]);
              return true;
            })
          );
          if (mode === "maybeSingle") return { data: rows[0] || null, error: null };
          if (mode === "single") return { data: rows[0] || null, error: rows[0] ? null : { message: "Not found" } };
          return { data: rows, error: null };
        };
        const b: any = {
          select() { return b; },
          eq(col: string, val: any) { filters.push({ op: "eq", col, val }); return b; },
          in(col: string, val: any) { filters.push({ op: "in", col, val }); return b; },
          maybeSingle() { return execute("maybeSingle"); },
          single() { return execute("single"); },
          then(resolve: any, reject: any) { return execute("all").then(resolve, reject); }
        };
        return b;
      };

      const client: any = {
        auth: {
          async getUser(tok: string) {
            const u = tokens[tok];
            return u ? { data: { user: u }, error: null } : { data: { user: null }, error: new Error("Invalid") };
          }
        },
        from(table: string) {
          return makeBuilder(table);
        },
        storage: {
          from(bucket: string) {
            return {
              async createSignedUrl(objectPath: string) {
                signCalls.push({ bucket, path: objectPath });
                if (opts.signErrorForPath && (opts.signErrorForPath === "*" || opts.signErrorForPath === objectPath)) {
                  return { data: null, error: { message: "Simulated storage signing error" } };
                }
                if (opts.nullUrlForPath && (opts.nullUrlForPath === "*" || opts.nullUrlForPath === objectPath)) {
                  return { data: { signedUrl: null }, error: null };
                }
                return {
                  data: { signedUrl: `https://signed.c6.test/storage/v1/object/sign/${bucket}/${objectPath}?token=valid` },
                  error: null
                };
              }
            };
          }
        }
      };

      return { client, signCalls };
    };

    try {
      await runTest("9.2 (C6-1) Legitimate free resource (access_type='free', price=0, public URL) succeeds; missing URL fails closed 503 with NO /downloads/META.pdf fallback", async () => {
        resetPaymentRateLimits();
        const mock = createC6MockDb();
        setMockSupabaseServerClient(mock.client);

        // 1. Public local /downloads/ path -> 200
        const rLocal = await fetch(`${c6BaseUrl}/api/payments/get-resource-download-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resourceId: FREE_PUBLIC_LOCAL_ID })
        });
        assert.strictEqual(rLocal.status, 200);
        const bLocal = await rLocal.json();
        assert.strictEqual(bLocal.success, true);
        assert.strictEqual(bLocal.accessType, "free");
        assert.strictEqual(bLocal.downloadUrl, "/downloads/ai-growth-prompts.pdf");
        assert.strictEqual(bLocal.fileUrl, "/downloads/ai-growth-prompts.pdf");
        assert.strictEqual(bLocal.externalUrl, null);

        // 2. Public https external_url -> 200
        const rHttps = await fetch(`${c6BaseUrl}/api/payments/get-resource-download-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resourceId: FREE_PUBLIC_HTTPS_ID })
        });
        assert.strictEqual(rHttps.status, 200);
        const bHttps = await rHttps.json();
        assert.strictEqual(bHttps.success, true);
        assert.strictEqual(bHttps.downloadUrl, "https://cdn.example.test/public/free-growth-guide.pdf");

        // 3. Missing URL -> 503 fail closed (NEVER falls back to /downloads/META.pdf)
        const rMissing = await fetch(`${c6BaseUrl}/api/payments/get-resource-download-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resourceId: FREE_MISSING_URL_ID })
        });
        assert.strictEqual(rMissing.status, 503);
        const tMissing = await rMissing.text();
        const bMissing = JSON.parse(tMissing);
        assert.strictEqual(bMissing.success, false);
        assert.strictEqual(bMissing.code, "FREE_RESOURCE_URL_MISSING");
        assert.ok(!tMissing.includes("META.pdf"), "Must NEVER fall back to /downloads/META.pdf");
      });

      await runTest("9.3 (C6-1) Inconsistent free record (access_type='free', price>0) and paid record fail closed with ZERO raw URL disclosure", async () => {
        resetPaymentRateLimits();
        const mock = createC6MockDb();
        setMockSupabaseServerClient(mock.client);

        // Unauthenticated request on access_type='free', price=199 -> 403, zero URL leaked
        const rGuest = await fetch(`${c6BaseUrl}/api/payments/get-resource-download-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resourceId: FREE_PRICE_POS_ID })
        });
        assert.strictEqual(rGuest.status, 403);
        const tGuest = await rGuest.text();
        assert.ok(!tGuest.includes("should-never-disclose"), "Must NEVER disclose file_url or external_url on inconsistent free record");
        assert.strictEqual(JSON.parse(tGuest).success, false);

        // Even confirmed admin on inconsistent access_type='free', price=199 fails closed (no raw URL leak)
        const rAdmin = await fetch(`${c6BaseUrl}/api/payments/get-resource-download-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer tok-c6-admin" },
          body: JSON.stringify({ resourceId: FREE_PRICE_POS_ID })
        });
        assert.strictEqual(rAdmin.status, 403);
        const tAdmin = await rAdmin.text();
        assert.ok(!tAdmin.includes("should-never-disclose"));

        // verify-purchase-status must NOT report isFree:true or verified:true on access_type='free', price=199
        const rVerify = await fetch(`${c6BaseUrl}/api/payments/verify-purchase-status?resourceId=${FREE_PRICE_POS_ID}`);
        assert.strictEqual(rVerify.status, 200);
        const bVerify = await rVerify.json();
        assert.strictEqual(bVerify.verified, false);
        assert.notStrictEqual(bVerify.isFree, true);

        // Unauthenticated request on access_type='paid' -> 403, zero raw URL leaked
        const rPaidUnauth = await fetch(`${c6BaseUrl}/api/payments/get-resource-download-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resourceId: PAID_PRIVATE_STORAGE_ID })
        });
        assert.strictEqual(rPaidUnauth.status, 403);
        const tPaidUnauth = await rPaidUnauth.text();
        assert.ok(!tPaidUnauth.includes("standalone-asset-a.pdf"));
        assert.ok(!tPaidUnauth.includes("raw-paid-a.pdf"));
        assert.ok(!tPaidUnauth.includes("supabase://"));
      });

      await runTest("9.4 (C6-1) Free resources pointing to paid-resources Storage, protected local paths, percent-encoded paths, traversal, or arbitrary local paths fail closed 503 with ZERO URL disclosure", async () => {
        resetPaymentRateLimits();
        const mock = createC6MockDb();
        setMockSupabaseServerClient(mock.client);

        const protectedFreeCases = [
          { id: FREE_STORAGE_SCHEME_ID, forbidden: ["supabase://", "paid-resources", "secret-workbook.pdf"] },
          { id: FREE_STORAGE_HTTP_ID, forbidden: ["/storage/v1/object", "paid-resources", "secret.pdf"] },
          { id: FREE_PROTECTED_LOCAL_ID, forbidden: ["protected_downloads", "meta-ads-campaign-planner-workbook.pdf"] },
          { id: FREE_PCT_ENCODED_ID, forbidden: ["%70rotected_downloads", "secret.pdf"] },
          { id: FREE_TRAVERSAL_ID, forbidden: ["..", "protected_downloads", "secret.pdf"] },
          { id: FREE_EXT_PROTECTED_ID, forbidden: ["supabase://", "secret-via-external.pdf"] },
          { id: FREE_ARBITRARY_LOCAL_ID, forbidden: ["/etc/passwd"] }
        ];

        for (const tc of protectedFreeCases) {
          const res = await fetch(`${c6BaseUrl}/api/payments/get-resource-download-url`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ resourceId: tc.id })
          });
          assert.strictEqual(res.status, 503, `Expected 503 for protected/invalid free resource ${tc.id}, got ${res.status}`);
          const text = await res.text();
          const body = JSON.parse(text);
          assert.strictEqual(body.success, false);
          assert.strictEqual(body.downloadUrl, undefined);
          assert.strictEqual(body.fileUrl, undefined);
          for (const secretFrag of tc.forbidden) {
            assert.ok(!text.includes(secretFrag), `Response for ${tc.id} leaked forbidden fragment: ${secretFrag}`);
          }
          assert.ok(!text.includes("META.pdf"), `Response for ${tc.id} must never fall back to META.pdf`);
        }

        // Direct unit checks on validatePublicFreeResourceUrl / isProtectedResourceUrl
        assert.strictEqual(isProtectedResourceUrl("supabase://paid-resources/paid/x.pdf"), true);
        assert.strictEqual(isProtectedResourceUrl("/%70rotected_downloads/x.pdf"), true);
        assert.strictEqual(validatePublicFreeResourceUrl("javascript:alert(1)").valid, false);
        assert.strictEqual(validatePublicFreeResourceUrl("//evil.example/file.pdf").valid, false);
        assert.strictEqual(validatePublicFreeResourceUrl("http://127.0.0.1:3000/secret").valid, false);
        assert.strictEqual(validatePublicFreeResourceUrl("/downloads/ai-growth-prompts.pdf").valid, true);
      });

      await runTest("9.5 (C6-1/C6-2) Paid Storage signing error & null signedUrl fail closed 503; authorized guest & authenticated buyer get exact signed Storage URL only; cross-resource rejected 403", async () => {
        // 1. Storage signing error -> 503, zero fallback
        resetPaymentRateLimits();
        const errMock = createC6MockDb({ signErrorForPath: "paid/standalone-asset-a.pdf" });
        setMockSupabaseServerClient(errMock.client);
        const rSignErr = await fetch(`${c6BaseUrl}/api/payments/get-resource-download-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer tok-c6-buyer" },
          body: JSON.stringify({ resourceId: PAID_PRIVATE_STORAGE_ID })
        });
        assert.strictEqual(rSignErr.status, 503);
        const tSignErr = await rSignErr.text();
        assert.ok(!tSignErr.includes("download-paid-asset"));
        assert.ok(!tSignErr.includes("raw-paid-a.pdf"));

        // 2. Storage signing returns null signedUrl -> 503, zero fallback
        resetPaymentRateLimits();
        const nullMock = createC6MockDb({ nullUrlForPath: "paid/standalone-asset-a.pdf" });
        setMockSupabaseServerClient(nullMock.client);
        const rSignNull = await fetch(`${c6BaseUrl}/api/payments/get-resource-download-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer tok-c6-buyer" },
          body: JSON.stringify({ resourceId: PAID_PRIVATE_STORAGE_ID })
        });
        assert.strictEqual(rSignNull.status, 503);
        const tSignNull = await rSignNull.text();
        assert.ok(!tSignNull.includes("download-paid-asset"));
        assert.ok(!tSignNull.includes("raw-paid-a.pdf"));

        // 3. Valid authorized authenticated buyer gets exact private Storage URL for owned asset A, and 403 for unowned asset B
        resetPaymentRateLimits();
        const okMock = createC6MockDb();
        setMockSupabaseServerClient(okMock.client);
        const rOwned = await fetch(`${c6BaseUrl}/api/payments/get-resource-download-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer tok-c6-buyer" },
          body: JSON.stringify({ resourceId: PAID_PRIVATE_STORAGE_ID })
        });
        assert.strictEqual(rOwned.status, 200);
        const bOwned = await rOwned.json();
        assert.strictEqual(bOwned.success, true);
        assert.strictEqual(bOwned.externalUrl, null);
        assert.ok(bOwned.downloadUrl.includes("paid-resources/paid/standalone-asset-a.pdf"));

        const rUnowned = await fetch(`${c6BaseUrl}/api/payments/get-resource-download-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer tok-c6-buyer" },
          body: JSON.stringify({ resourceId: PAID_SECOND_STORAGE_ID })
        });
        assert.strictEqual(rUnowned.status, 403);

        // 4. Valid guest resource token works for purchased asset A and is REJECTED (403) when used for asset B
        const guestTokA = generateGuestResourceToken({
          orderId: "order_c6_guest_a",
          paymentId: "pay_c6_guest_a",
          resourceId: PAID_PRIVATE_STORAGE_ID,
          email: "guest.c6@example.test"
        });
        const rGuestOk = await fetch(`${c6BaseUrl}/api/payments/get-resource-download-url`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-resource-access-token": guestTokA
          },
          body: JSON.stringify({
            resourceId: PAID_PRIVATE_STORAGE_ID,
            orderId: "order_c6_guest_a",
            paymentId: "pay_c6_guest_a",
            email: "guest.c6@example.test"
          })
        });
        assert.strictEqual(rGuestOk.status, 200);
        const bGuestOk = await rGuestOk.json();
        assert.ok(bGuestOk.downloadUrl.includes("paid-resources/paid/standalone-asset-a.pdf"));

        const rGuestCross = await fetch(`${c6BaseUrl}/api/payments/get-resource-download-url`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-resource-access-token": guestTokA
          },
          body: JSON.stringify({
            resourceId: PAID_SECOND_STORAGE_ID,
            orderId: "order_c6_guest_a",
            paymentId: "pay_c6_guest_a",
            email: "guest.c6@example.test"
          })
        });
        assert.strictEqual(rGuestCross.status, 403);
      });

      await runTest("9.6 (C6-2) Unknown paid resource ID returns 404 (NEVER workbook default); arbitrary local/traversal paths rejected 503; valid token cannot retrieve another resource's file", async () => {
        resetPaymentRateLimits();
        const mock = createC6MockDb();
        setMockSupabaseServerClient(mock.client);

        // 1. Direct GET /api/payments/download-paid-asset with valid HMAC token for unknown standalone resource -> 404 (NEVER meta-ads-campaign-planner-workbook.pdf)
        const unknownTok = generateAssetAccessToken(UNKNOWN_STANDALONE_ID, "pay_c6_unknown");
        assert.ok(unknownTok, "Expected valid HMAC token for test");
        const rUnknown = await fetch(`${c6BaseUrl}/api/payments/download-paid-asset?token=${encodeURIComponent(unknownTok!)}`);
        assert.strictEqual(rUnknown.status, 404, `Unknown resource ID must return 404, got ${rUnknown.status}`);
        const tUnknown = await rUnknown.text();
        const bUnknown = JSON.parse(tUnknown);
        assert.strictEqual(bUnknown.success, false);
        assert.strictEqual(bUnknown.code, "UNMAPPED_PROTECTED_ASSET");
        assert.ok(!tUnknown.includes("meta-ads-campaign-planner-workbook.pdf"));
        assert.ok(!tUnknown.startsWith("%PDF-"), "Must NEVER stream fallback PDF bytes for unknown resource ID");

        // 2. Valid HMAC token for traversal payload as resourceId -> 404
        const travTok = generateAssetAccessToken("../../etc/passwd", "pay_c6_trav");
        const rTravTok = await fetch(`${c6BaseUrl}/api/payments/download-paid-asset?token=${encodeURIComponent(travTok!)}`);
        assert.strictEqual(rTravTok.status, 404);

        // 3. Valid HMAC token for allowlisted workbook -> serves ONLY workbook PDF; query override for another resource/file -> 403
        const wbResp = await fetch(`${c6BaseUrl}/api/payments/get-resource-download-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer tok-c6-buyer" },
          body: JSON.stringify({ resourceId: BUNDLE_ITEMS[0].id })
        });
        assert.strictEqual(wbResp.status, 200);
        const wbBody = await wbResp.json();
        assert.ok(wbBody.downloadUrl.startsWith("/api/payments/download-paid-asset?token="));

        const rWbFile = await fetch(`${c6BaseUrl}${wbBody.downloadUrl}`);
        assert.strictEqual(rWbFile.status, 200);
        assert.strictEqual(
          rWbFile.headers.get("content-disposition"),
          'attachment; filename="meta-ads-campaign-planner-workbook.pdf"'
        );
        const wbBytes = Buffer.from(await rWbFile.arrayBuffer());
        const expectedWbBytes = fs.readFileSync(path.resolve("server/protected_downloads/meta-ads-campaign-planner-workbook.pdf"));
        assert.ok(wbBytes.equals(expectedWbBytes), "Allowlisted download must stream exact workbook bytes");

        // Cross-resource query tamper on valid workbook token -> 403
        const rCrossResId = await fetch(`${c6BaseUrl}${wbBody.downloadUrl}&resourceId=${BUNDLE_ITEMS[1].id}`);
        assert.strictEqual(rCrossResId.status, 403);
        assert.strictEqual((await rCrossResId.json()).code, "TOKEN_RESOURCE_MISMATCH");

        const rCrossFile = await fetch(`${c6BaseUrl}${wbBody.downloadUrl}&file=the-ad-budget-break-even-calculator.xlsx`);
        assert.strictEqual(rCrossFile.status, 403);
        assert.strictEqual((await rCrossFile.json()).code, "TOKEN_FILE_MISMATCH");

        // Token for calculator streams ONLY calculator bytes (never workbook)
        const calcTok = generateAssetAccessToken(BUNDLE_ITEMS[1].id, "pay_c6_calc");
        const rCalcFile = await fetch(`${c6BaseUrl}/api/payments/download-paid-asset?token=${encodeURIComponent(calcTok!)}`);
        assert.strictEqual(rCalcFile.status, 200);
        assert.strictEqual(
          rCalcFile.headers.get("content-disposition"),
          'attachment; filename="the-ad-budget-break-even-calculator.xlsx"'
        );
        const calcBytes = Buffer.from(await rCalcFile.arrayBuffer());
        const expectedCalcBytes = fs.readFileSync(path.resolve("server/protected_downloads/the-ad-budget-break-even-calculator.xlsx"));
        assert.ok(calcBytes.equals(expectedCalcBytes));

        // 4. Paid standalone resources with arbitrary /downloads/*, unmapped /protected_downloads/*, or traversal -> 503 (never mint token)
        for (const badPaidId of [
          PAID_UNMAPPED_DOWNLOADS_ID,
          PAID_UNMAPPED_PROTECTED_ID,
          PAID_TRAVERSAL_STORAGE_ID,
          PAID_TRAVERSAL_LOCAL_ID
        ]) {
          const rBad = await fetch(`${c6BaseUrl}/api/payments/get-resource-download-url`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer tok-c6-buyer" },
            body: JSON.stringify({ resourceId: badPaidId })
          });
          assert.strictEqual(rBad.status, 503, `Expected 503 for unmapped/traversal paid resource ${badPaidId}, got ${rBad.status}`);
          const tBad = await rBad.text();
          assert.ok(!tBad.includes("download-paid-asset"), `Must NOT mint download-paid-asset link for ${badPaidId}`);
        }

        // 5. Canonical allowlisted ID whose DB file_url was tampered to a different file or /downloads/* -> 503
        for (const tamperedPath of [
          "/downloads/meta-ads-campaign-planner-workbook.pdf",
          "/protected_downloads/the-ad-budget-break-even-calculator.xlsx",
          "/protected_downloads/../package.json"
        ]) {
          resetPaymentRateLimits();
          const mTamper = createC6MockDb({ overrideWorkbookFileUrl: tamperedPath });
          setMockSupabaseServerClient(mTamper.client);
          const rTamper = await fetch(`${c6BaseUrl}/api/payments/get-resource-download-url`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer tok-c6-buyer" },
            body: JSON.stringify({ resourceId: BUNDLE_ITEMS[0].id })
          });
          assert.strictEqual(rTamper.status, 503, `Tampered path ${tamperedPath} on allowlisted resource must fail closed 503`);
        }
      });

      await runTest("9.7 (C6-2) resolveAllowlistedProtectedFilename & resolveConfinedProtectedAssetPath reject unmapped IDs, traversal, and symlink escape", () => {
        assert.strictEqual(resolveAllowlistedProtectedFilename(UNKNOWN_STANDALONE_ID), null);
        assert.strictEqual(resolveAllowlistedProtectedFilename(BUNDLE_RESOURCE_ID), null);
        assert.strictEqual(resolveAllowlistedProtectedFilename("../../etc/passwd"), null);
        assert.strictEqual(resolveAllowlistedProtectedFilename(BUNDLE_ITEMS[0].id), "meta-ads-campaign-planner-workbook.pdf");

        const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "p03-c6-confinement-"));
        const safeDir = path.join(tmpRoot, "protected_downloads");
        const outsideSecret = path.join(tmpRoot, "outside-secret.txt");
        const regularAsset = path.join(safeDir, "legit.pdf");
        const symlinkEscape = path.join(safeDir, "escape.pdf");
        try {
          fs.mkdirSync(safeDir, { recursive: true });
          fs.writeFileSync(outsideSecret, "TOP_SECRET");
          fs.writeFileSync(regularAsset, "%PDF-1.4 legit");
          fs.symlinkSync(outsideSecret, symlinkEscape);

          // Valid regular file inside base dir -> ok
          const okRes = resolveConfinedProtectedAssetPath("legit.pdf", [safeDir]);
          assert.strictEqual(okRes.ok, true);
          assert.strictEqual(okRes.filePath, fs.realpathSync(regularAsset));

          // Traversal attempts -> rejected
          assert.strictEqual(resolveConfinedProtectedAssetPath("../outside-secret.txt", [safeDir]).ok, false);
          assert.strictEqual(resolveConfinedProtectedAssetPath("sub/legit.pdf", [safeDir]).ok, false);
          assert.strictEqual(resolveConfinedProtectedAssetPath("..\\outside-secret.txt", [safeDir]).ok, false);
          assert.strictEqual(resolveConfinedProtectedAssetPath("legit.pdf\0.png", [safeDir]).ok, false);

          // Symlink escape pointing outside base dir -> rejected
          const symRes = resolveConfinedProtectedAssetPath("escape.pdf", [safeDir]);
          assert.strictEqual(symRes.ok, false);
          assert.strictEqual(symRes.reason, "symlink_rejected");
        } finally {
          fs.rmSync(tmpRoot, { recursive: true, force: true });
        }
      });
    } finally {
      await stopServer(c6Server);
      setMockSupabaseServerClient(null);
    }
  }

  // =========================================================================
  // 10. POST-REMEDIATION SECURITY TESTS (A-1, A-2, B-1, C-1, C-2, D-1)
  //     All endpoint security properties verified via actual HTTP requests.
  // =========================================================================
  console.log("\n[10] Post-Remediation Security Coverage (A-1, A-2, B-1, C-1, C-2, D-1)");

  // 10.1 (C-1) Helper/unit test for strict primitive numeric zero
  await runTest("10.1 (C-1 Unit) isZeroPriceStrict accepts only primitive 0 / decimal zero strings and rejects arrays, objects, booleans, null, empty, NaN, Infinity, non-zero", () => {
    // Accepted primitive numeric zero representations
    assert.strictEqual(isZeroPriceStrict(0), true);
    assert.strictEqual(isZeroPriceStrict(0.0), true);
    assert.strictEqual(isZeroPriceStrict("0"), true);
    assert.strictEqual(isZeroPriceStrict("0.0"), true);
    assert.strictEqual(isZeroPriceStrict("0.00"), true);
    assert.strictEqual(isZeroPriceStrict(" 0.00 "), true);

    // Rejected non-primitives, booleans, nulls, invalid strings, non-finite & non-zero numbers
    const rejected: unknown[] = [
      [],
      [0],
      ["0"],
      {},
      { valueOf: () => 0 },
      new Number(0),
      new String("0"),
      false,
      true,
      null,
      undefined,
      "",
      "   ",
      "-0",
      "+0",
      "0x0",
      "0b0",
      "0o0",
      "0e0",
      "abc",
      NaN,
      Infinity,
      -Infinity,
      -1,
      -0.01,
      0.01,
      1,
      "0.01",
      "-10"
    ];
    for (const val of rejected) {
      assert.strictEqual(isZeroPriceStrict(val as any), false, `Expected isZeroPriceStrict(${String(val)}) === false`);
      const pricing = getAuthoritativeResourcePricing("unit-zero-check", {
        id: "unit-zero-check",
        status: "published",
        access_type: "free",
        price: val,
        currency: "INR"
      });
      assert.strictEqual(pricing.accessType, "unverified", `Expected unverified pricing for price=${String(val)}`);
    }

    // Helper check for IPv4/IPv6 host classifier (C-2)
    assert.strictEqual(isDisallowedFreeExternalHost("[::ffff:127.0.0.1]"), true);
    assert.strictEqual(isDisallowedFreeExternalHost("[::ffff:7f00:1]"), true);
    assert.strictEqual(isDisallowedFreeExternalHost("[::ffff:169.254.169.254]"), true);
    assert.strictEqual(isDisallowedFreeExternalHost("[::]"), true);
    assert.strictEqual(isDisallowedFreeExternalHost("0.1.2.3"), true);
    assert.strictEqual(isDisallowedFreeExternalHost("100.64.0.1"), true);
    assert.strictEqual(isDisallowedFreeExternalHost("fc-assets.example.test"), false);
    assert.strictEqual(isDisallowedFreeExternalHost("fdocs.example.test"), false);
  });

  {
    const secApp = express();
    secApp.use(express.json());
    secApp.use("/api/payments", paymentRoutes);
    const { server: secServer, baseUrl: secBaseUrl } = await startEphemeralServer(secApp);

    const signRawToken = (rawData: string, secret: string) => {
      const sig = crypto.createHmac("sha256", secret).update(rawData).digest("base64url");
      return `${rawData}.${sig}`;
    };

    const signJsonPayload = (payloadObj: unknown, secret: string) => {
      const data = Buffer.from(JSON.stringify(payloadObj), "utf8").toString("base64url");
      return signRawToken(data, secret);
    };

    const createSecMockDb = (resourcesRows: Array<Record<string, any>>, paymentsRows: Array<Record<string, any>> = [], purchasesRows: Array<Record<string, any>> = []) => {
      const tokens: Record<string, any> = {
        "tok-sec-buyer": {
          id: "99500000-0000-4000-8000-000000000001",
          email: "buyer.sec@example.test",
          email_confirmed_at: "2026-01-01T00:00:00Z",
          app_metadata: {}
        }
      };

      const tables: Record<string, Array<Record<string, any>>> = {
        resources: resourcesRows,
        payments: paymentsRows,
        resource_purchases: purchasesRows
      };

      const makeBuilder = (table: string) => {
        const filters: Array<{ op: string; col: string; val: any }> = [];
        const execute = async (mode: "all" | "maybeSingle" | "single") => {
          const rows = (tables[table] || []).filter((row) =>
            filters.every((f) => {
              if (f.op === "eq") return row[f.col] === f.val;
              if (f.op === "in") return Array.isArray(f.val) && f.val.includes(row[f.col]);
              return true;
            })
          );
          if (mode === "maybeSingle") return { data: rows[0] || null, error: null };
          if (mode === "single") return { data: rows[0] || null, error: rows[0] ? null : { message: "Not found" } };
          return { data: rows, error: null };
        };
        const b: any = {
          select() { return b; },
          eq(col: string, val: any) { filters.push({ op: "eq", col, val }); return b; },
          in(col: string, val: any) { filters.push({ op: "in", col, val }); return b; },
          maybeSingle() { return execute("maybeSingle"); },
          single() { return execute("single"); },
          then(resolve: any, reject: any) { return execute("all").then(resolve, reject); }
        };
        return b;
      };

      return {
        auth: {
          async getUser(tok: string) {
            const u = tokens[tok];
            return u ? { data: { user: u }, error: null } : { data: { user: null }, error: new Error("Invalid") };
          }
        },
        from(table: string) {
          return makeBuilder(table);
        },
        storage: {
          from(bucket: string) {
            return {
              async createSignedUrl(objectPath: string) {
                return {
                  data: { signedUrl: `https://signed.sec.test/storage/v1/object/sign/${bucket}/${objectPath}?token=ok` },
                  error: null
                };
              }
            };
          }
        }
      };
    };

    try {
      // 10.2 (C-1) Actual HTTP tests on POST /api/payments/get-resource-download-url for invalid pricing records
      await runTest("10.2 (C-1 HTTP) POST /api/payments/get-resource-download-url fails closed 403 on null, empty, boolean, array, object, negative, NaN, Infinity prices and null access_type", async () => {
        const invalidPriceCases: Array<{ id: string; access_type: any; price: any }> = [
          { id: "99600000-0000-4000-8000-000000000001", access_type: "free", price: null },
          { id: "99600000-0000-4000-8000-000000000002", access_type: "free", price: "" },
          { id: "99600000-0000-4000-8000-000000000003", access_type: "free", price: false },
          { id: "99600000-0000-4000-8000-000000000004", access_type: "free", price: -10 },
          { id: "99600000-0000-4000-8000-000000000005", access_type: "free", price: NaN },
          { id: "99600000-0000-4000-8000-000000000006", access_type: "free", price: Infinity },
          { id: "99600000-0000-4000-8000-000000000007", access_type: "free", price: [] },
          { id: "99600000-0000-4000-8000-000000000008", access_type: "free", price: [0] },
          { id: "99600000-0000-4000-8000-000000000009", access_type: "free", price: {} },
          { id: "99600000-0000-4000-8000-000000000010", access_type: null, price: 0 }
        ];

        const rows = invalidPriceCases.map((tc, idx) => ({
          id: tc.id,
          slug: `c1-bad-price-${idx}`,
          title: `Bad Price Resource ${idx}`,
          status: "published",
          access_type: tc.access_type,
          price: tc.price,
          currency: "INR",
          file_url: `/downloads/secret-never-leak-${idx}.pdf`,
          external_url: `https://cdn.example.test/never-leak-${idx}.pdf`
        }));

        setMockSupabaseServerClient(createSecMockDb(rows));

        for (const tc of invalidPriceCases) {
          resetPaymentRateLimits();
          const res = await fetch(`${secBaseUrl}/api/payments/get-resource-download-url`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ resourceId: tc.id })
          });
          assert.strictEqual(res.status, 403, `Expected HTTP 403 for invalid price record ${tc.id} (price=${String(tc.price)}), got ${res.status}`);
          const text = await res.text();
          const body = JSON.parse(text);
          assert.strictEqual(body.success, false);
          assert.strictEqual(body.code, "RESOURCE_ACCESS_UNVERIFIED");
          assert.strictEqual(body.downloadUrl, undefined);
          assert.ok(!text.includes("never-leak"), `Response leaked raw URL for invalid price record ${tc.id}`);
        }
      });

      // 10.3 (C-2) Actual HTTP tests on POST /api/payments/get-resource-download-url for host/scheme/credential classification
      await runTest("10.3 (C-2 HTTP) POST /api/payments/get-resource-download-url rejects non-public IPv4/IPv6, mapped IPv6, credentials, and unsafe schemes (503) while allowing public fc*/fd* DNS hosts (200)", async () => {
        const blockedUrls: Array<{ id: string; url: string; label: string }> = [
          { id: "99700000-0000-4000-8000-000000000001", url: "http://[::ffff:127.0.0.1]/secret.pdf", label: "IPv4-mapped IPv6 loopback" },
          { id: "99700000-0000-4000-8000-000000000002", url: "http://[::ffff:169.254.169.254]/latest/meta-data", label: "IPv4-mapped IPv6 metadata" },
          { id: "99700000-0000-4000-8000-000000000003", url: "http://[::]/secret.pdf", label: "IPv6 unspecified ::" },
          { id: "99700000-0000-4000-8000-000000000004", url: "http://[::1]/secret.pdf", label: "IPv6 loopback ::1" },
          { id: "99700000-0000-4000-8000-000000000005", url: "http://[fc00::1]/secret.pdf", label: "IPv6 ULA fc00::/7" },
          { id: "99700000-0000-4000-8000-000000000006", url: "http://[fe80::1]/secret.pdf", label: "IPv6 link-local fe80::/10" },
          { id: "99700000-0000-4000-8000-000000000007", url: "http://0.1.2.3/secret.pdf", label: "IPv4 0.0.0.0/8" },
          { id: "99700000-0000-4000-8000-000000000008", url: "http://169.254.169.254/latest/meta-data", label: "IPv4 link-local metadata" },
          { id: "99700000-0000-4000-8000-000000000009", url: "http://10.0.0.1/internal.pdf", label: "IPv4 private 10.0.0.0/8" },
          { id: "99700000-0000-4000-8000-000000000010", url: "http://100.64.0.1/cgnat.pdf", label: "IPv4 CGNAT 100.64.0.0/10" },
          { id: "99700000-0000-4000-8000-000000000011", url: "https://user:pass@cdn.example.test/free.pdf", label: "embedded user:pass credentials" },
          { id: "99700000-0000-4000-8000-000000000012", url: "https://@cdn.example.test/free.pdf", label: "empty embedded @ authority" },
          { id: "99700000-0000-4000-8000-000000000013", url: "javascript:alert(1)", label: "javascript: scheme" },
          { id: "99700000-0000-4000-8000-000000000014", url: "data:text/plain;base64,SGVsbG8=", label: "data: scheme" },
          { id: "99700000-0000-4000-8000-000000000015", url: "file:///etc/passwd", label: "file: scheme" },
          { id: "99700000-0000-4000-8000-000000000016", url: "//evil.example.test/free.pdf", label: "protocol-relative URL" }
        ];

        const allowedPublicUrls: Array<{ id: string; url: string; label: string }> = [
          { id: "99700000-0000-4000-8000-000000000021", url: "https://fc-assets.example.test/guides/free-meta-guide.pdf", label: "public fc* DNS host" },
          { id: "99700000-0000-4000-8000-000000000022", url: "https://fdocs.example.test/guides/free-checklist.pdf", label: "public fd* DNS host" }
        ];

        const rows = [
          ...blockedUrls.map((tc, i) => ({
            id: tc.id,
            slug: `c2-blocked-${i}`,
            title: tc.label,
            status: "published",
            access_type: "free",
            price: 0,
            currency: "INR",
            file_url: null,
            external_url: tc.url
          })),
          ...allowedPublicUrls.map((tc, i) => ({
            id: tc.id,
            slug: `c2-allowed-${i}`,
            title: tc.label,
            status: "published",
            access_type: "free",
            price: 0,
            currency: "INR",
            file_url: null,
            external_url: tc.url
          }))
        ];

        setMockSupabaseServerClient(createSecMockDb(rows));

        for (const tc of blockedUrls) {
          resetPaymentRateLimits();
          const res = await fetch(`${secBaseUrl}/api/payments/get-resource-download-url`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ resourceId: tc.id })
          });
          assert.strictEqual(res.status, 503, `Expected HTTP 503 for blocked free URL (${tc.label}: ${tc.url}), got ${res.status}`);
          const text = await res.text();
          const body = JSON.parse(text);
          assert.strictEqual(body.success, false);
          assert.strictEqual(body.downloadUrl, undefined);
          assert.ok(!text.includes(tc.url), `Response leaked blocked URL for ${tc.label}`);
        }

        for (const tc of allowedPublicUrls) {
          resetPaymentRateLimits();
          const res = await fetch(`${secBaseUrl}/api/payments/get-resource-download-url`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ resourceId: tc.id })
          });
          assert.strictEqual(res.status, 200, `Expected HTTP 200 for legitimate public URL (${tc.label}: ${tc.url}), got ${res.status}`);
          const body = await res.json();
          assert.strictEqual(body.success, true);
          assert.strictEqual(body.accessType, "free");
          assert.strictEqual(body.downloadUrl, tc.url);
        }
      });

      // 10.4 (A-2) Actual HTTP tests on GET /api/payments/download-paid-asset for strict token parsing & verification
      await runTest("10.4 (A-2 HTTP) GET /api/payments/download-paid-asset rejects missing, duplicate, 3-segment, tampered, multibyte UTF-8 sig, invalid payload, missing resourceId, invalid/expired expiry, and unsupported fields with 403 (never 500)", async () => {
        const primarySecret = process.env.ASSET_TOKEN_HMAC_SECRET!;
        const validTok = generateAssetAccessToken(BUNDLE_ITEMS[0].id, "pay_a2_valid")!;
        assert.ok(validTok);
        const [validData, validSig] = validTok.split(".");
        assert.strictEqual(validSig.length, 43, "Expected 43-char base64url HMAC-SHA256 signature");

        // Multibyte UTF-8 signature with identical UTF-16 .length (43) as valid base64url HMAC, but 86 UTF-8 bytes
        const multibyteSig = "é".repeat(validSig.length);
        assert.strictEqual(multibyteSig.length, validSig.length);
        assert.notStrictEqual(Buffer.byteLength(multibyteSig, "utf8"), Buffer.byteLength(validSig, "utf8"));

        const malformedCases: Array<{ label: string; query: string }> = [
          { label: "missing token", query: "" },
          { label: "empty token", query: "?token=" },
          { label: "duplicate token query params", query: `?token=${encodeURIComponent(validTok)}&token=${encodeURIComponent(validTok)}` },
          { label: "single-segment token", query: `?token=${encodeURIComponent(validData)}` },
          { label: "three-segment token", query: `?token=${encodeURIComponent(`${validData}.${validSig}.extra`)}` },
          { label: "tampered signature", query: `?token=${encodeURIComponent(`${validData}.${validSig.slice(0, -1)}${validSig.endsWith("A") ? "B" : "A"}`)}` },
          { label: "multibyte UTF-8 signature (no RangeError 500)", query: `?token=${encodeURIComponent(`${validData}.${multibyteSig}`)}` },
          { label: "invalid base64url payload data", query: `?token=${encodeURIComponent(signRawToken("!!!not_base64url!!!", primarySecret))}` },
          { label: "valid HMAC over non-JSON payload", query: `?token=${encodeURIComponent(signRawToken(Buffer.from("{not-json", "utf8").toString("base64url"), primarySecret))}` },
          { label: "valid HMAC over null payload", query: `?token=${encodeURIComponent(signJsonPayload(null, primarySecret))}` },
          { label: "valid HMAC over array payload", query: `?token=${encodeURIComponent(signJsonPayload([BUNDLE_ITEMS[0].id], primarySecret))}` },
          { label: "valid HMAC over empty object", query: `?token=${encodeURIComponent(signJsonPayload({}, primarySecret))}` },
          { label: "valid HMAC over missing resourceId", query: `?token=${encodeURIComponent(signJsonPayload({ v: 2, authId: "a", expiresAt: Date.now() + 60_000 }, primarySecret))}` },
          { label: "valid HMAC over whitespace resourceId", query: `?token=${encodeURIComponent(signJsonPayload({ v: 2, resourceId: "   ", authId: "a", expiresAt: Date.now() + 60_000 }, primarySecret))}` },
          { label: "valid HMAC over string expiresAt", query: `?token=${encodeURIComponent(signJsonPayload({ v: 2, resourceId: BUNDLE_ITEMS[0].id, authId: "a", expiresAt: String(Date.now() + 60_000) }, primarySecret))}` },
          { label: "valid HMAC over zero expiresAt", query: `?token=${encodeURIComponent(signJsonPayload({ v: 2, resourceId: BUNDLE_ITEMS[0].id, authId: "a", expiresAt: 0 }, primarySecret))}` },
          { label: "valid HMAC over expired token", query: `?token=${encodeURIComponent(signJsonPayload({ v: 2, resourceId: BUNDLE_ITEMS[0].id, authId: "a", expiresAt: Date.now() - 5_000 }, primarySecret))}` },
          { label: "valid HMAC over unsupported version v:99", query: `?token=${encodeURIComponent(signJsonPayload({ v: 99, resourceId: BUNDLE_ITEMS[0].id, authId: "a", expiresAt: Date.now() + 60_000 }, primarySecret))}` },
          { label: "valid HMAC over unsupported/unvalidated metadata field", query: `?token=${encodeURIComponent(signJsonPayload({ resourceId: BUNDLE_ITEMS[0].id, authId: "a", paymentId: "pay_unverified", expiresAt: Date.now() + 60_000 }, primarySecret))}` }
        ];

        for (const tc of malformedCases) {
          resetPaymentRateLimits();
          const res = await fetch(`${secBaseUrl}/api/payments/download-paid-asset${tc.query}`);
          assert.strictEqual(res.status, 403, `Expected HTTP 403 for ${tc.label}, got ${res.status}`);
          assert.ok(String(res.headers.get("cache-control") || "").includes("no-store"), `Missing no-store Cache-Control for ${tc.label}`);
          const body = await res.json();
          assert.strictEqual(body.success, false);
          assert.strictEqual(body.code, "INVALID_DOWNLOAD_TOKEN");
        }
      });

      // 10.5 (A-1) Actual HTTP tests for bearer-capability semantics, guest download preservation, conflicting metadata rejection, and explicit legacy v1 support
      await runTest("10.5 (A-1 HTTP) Capability token omits unused identity fields, preserves guest/buyer downloads, rejects metadata/file/resource overrides (403), and explicitly supports legacy v1 tokens", async () => {
        const workbookRow = {
          id: BUNDLE_ITEMS[0].id,
          slug: BUNDLE_ITEMS[0].slug,
          title: BUNDLE_ITEMS[0].title,
          status: "published",
          access_type: "paid",
          price: 129,
          currency: "INR",
          file_url: "/protected_downloads/meta-ads-campaign-planner-workbook.pdf",
          external_url: null
        };
        const guestPayRow = {
          id: "p-a1-guest",
          user_id: null,
          item_type: "resource",
          item_id: BUNDLE_ITEMS[0].id,
          status: "captured",
          amount: 129,
          currency: "INR",
          razorpay_order_id: "order_a1_guest",
          razorpay_payment_id: "pay_a1_guest",
          customer_email: "guest.a1@example.test"
        };
        const guestPurRow = {
          id: "rp-a1-guest",
          user_id: null,
          resource_id: BUNDLE_ITEMS[0].id,
          status: "active",
          amount: 129,
          currency: "INR",
          razorpay_order_id: "order_a1_guest",
          razorpay_payment_id: "pay_a1_guest",
          customer_email: "guest.a1@example.test",
          customer_phone: "+919999000011"
        };

        setMockSupabaseServerClient(createSecMockDb([workbookRow], [guestPayRow], [guestPurRow]));
        resetPaymentRateLimits();

        // 1. Guest buyer end-to-end: POST /get-resource-download-url -> GET /download-paid-asset
        const guestAccessTok = generateGuestResourceToken({
          orderId: "order_a1_guest",
          paymentId: "pay_a1_guest",
          resourceId: BUNDLE_ITEMS[0].id,
          email: "guest.a1@example.test"
        });
        const rMint = await fetch(`${secBaseUrl}/api/payments/get-resource-download-url`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-resource-access-token": guestAccessTok
          },
          body: JSON.stringify({
            resourceId: BUNDLE_ITEMS[0].id,
            orderId: "order_a1_guest",
            paymentId: "pay_a1_guest",
            email: "guest.a1@example.test"
          })
        });
        assert.strictEqual(rMint.status, 200);
        const mintBody = await rMint.json();
        assert.ok(mintBody.downloadUrl.startsWith("/api/payments/download-paid-asset?token="));
        const issuedToken = new URL(mintBody.downloadUrl, "https://example.test").searchParams.get("token")!;
        const decodedIssued = verifyAssetAccessToken(issuedToken);
        assert.ok(decodedIssued);
        assert.strictEqual(decodedIssued!.v, 2);
        assert.strictEqual(decodedIssued!.resourceId, BUNDLE_ITEMS[0].id);
        assert.strictEqual(decodedIssued!.filename, "meta-ads-campaign-planner-workbook.pdf");
        // Verify unused/unvalidated identity fields are NOT embedded
        assert.strictEqual((decodedIssued as any).paymentId, undefined);
        assert.strictEqual((decodedIssued as any).orderId, undefined);
        assert.strictEqual((decodedIssued as any).userId, undefined);
        assert.strictEqual((decodedIssued as any).email, undefined);

        // Download succeeds for guest without Authorization header
        const expectedPdf = fs.readFileSync(path.resolve("server/protected_downloads/meta-ads-campaign-planner-workbook.pdf"));
        const rGuestDl = await fetch(`${secBaseUrl}${mintBody.downloadUrl}`);
        assert.strictEqual(rGuestDl.status, 200);
        assert.ok(String(rGuestDl.headers.get("cache-control") || "").includes("no-store"));
        assert.strictEqual(rGuestDl.headers.get("content-type"), "application/pdf");
        assert.strictEqual(
          rGuestDl.headers.get("content-disposition"),
          'attachment; filename="meta-ads-campaign-planner-workbook.pdf"'
        );
        assert.ok(Buffer.from(await rGuestDl.arrayBuffer()).equals(expectedPdf));

        // 2. Conflicting/override metadata & cross-resource query params rejected 403
        const overrideQueries = [
          { qs: `&resourceId=${BUNDLE_ITEMS[1].id}`, code: "TOKEN_RESOURCE_MISMATCH" },
          { qs: `&file=the-ad-budget-break-even-calculator.xlsx`, code: "TOKEN_FILE_MISMATCH" },
          { qs: `&filename=the-ad-budget-break-even-calculator.xlsx`, code: "TOKEN_FILE_MISMATCH" },
          { qs: `&paymentId=pay_other_attacker`, code: "TOKEN_METADATA_OVERRIDE_REJECTED" },
          { qs: `&orderId=order_other_attacker`, code: "TOKEN_METADATA_OVERRIDE_REJECTED" },
          { qs: `&userId=99900000-0000-4000-8000-000000000999`, code: "TOKEN_METADATA_OVERRIDE_REJECTED" },
          { qs: `&email=attacker@example.test`, code: "TOKEN_METADATA_OVERRIDE_REJECTED" },
          { qs: `&authId=pay_other`, code: "TOKEN_METADATA_OVERRIDE_REJECTED" }
        ];
        for (const oq of overrideQueries) {
          resetPaymentRateLimits();
          const rOv = await fetch(`${secBaseUrl}${mintBody.downloadUrl}${oq.qs}`);
          assert.strictEqual(rOv.status, 403, `Expected 403 for override ${oq.qs}, got ${rOv.status}`);
          const bOv = await rOv.json();
          assert.strictEqual(bOv.success, false);
          assert.strictEqual(bOv.code, oq.code);
        }

        // 3. v2 token with mismatched cryptographically bound filename -> 403 TOKEN_FILE_MISMATCH
        const forgedMismatchFileTok = signJsonPayload(
          {
            v: 2,
            resourceId: BUNDLE_ITEMS[0].id,
            authId: "pay_a1_forged",
            filename: "the-ad-budget-break-even-calculator.xlsx",
            expiresAt: Date.now() + 60_000
          },
          process.env.ASSET_TOKEN_HMAC_SECRET!
        );
        resetPaymentRateLimits();
        const rForgedFile = await fetch(`${secBaseUrl}/api/payments/download-paid-asset?token=${encodeURIComponent(forgedMismatchFileTok)}`);
        assert.strictEqual(rForgedFile.status, 403);
        assert.strictEqual((await rForgedFile.json()).code, "TOKEN_FILE_MISMATCH");

        // 4. Explicit legacy 2-arg v1 token: accepted ONLY when signed by dedicated ASSET_TOKEN_HMAC_SECRET (RAZORPAY_KEY_SECRET rejected)
        const legacyDedicatedV1Tok = signJsonPayload(
          {
            resourceId: BUNDLE_ITEMS[0].id,
            authId: "pay_legacy_v1_dedicated",
            expiresAt: Date.now() + 60_000
          },
          process.env.ASSET_TOKEN_HMAC_SECRET!
        );
        const decodedV1 = verifyAssetAccessToken(legacyDedicatedV1Tok);
        assert.strictEqual(decodedV1?.v, 1, "Expected v:1 for legacy v1 signed by ASSET_TOKEN_HMAC_SECRET");
        assert.strictEqual((decodedV1 as any)?.legacy, true, "Expected legacy:true for legacy v1 signed by ASSET_TOKEN_HMAC_SECRET");

        resetPaymentRateLimits();
        const rLegacyOk = await fetch(`${secBaseUrl}/api/payments/download-paid-asset?token=${encodeURIComponent(legacyDedicatedV1Tok)}`);
        assert.strictEqual(rLegacyOk.status, 200, `Expected HTTP 200 for legacy v1 signed by ASSET_TOKEN_HMAC_SECRET, got ${rLegacyOk.status}`);
        assert.ok(Buffer.from(await rLegacyOk.arrayBuffer()).equals(expectedPdf));

        const legacyRzpV1Tok = signJsonPayload(
          {
            resourceId: BUNDLE_ITEMS[0].id,
            authId: "pay_legacy_v1_rzp",
            expiresAt: Date.now() + 60_000
          },
          process.env.RAZORPAY_KEY_SECRET!
        );
        assert.strictEqual(verifyAssetAccessToken(legacyRzpV1Tok), null, "Legacy v1 signed by RAZORPAY_KEY_SECRET must be rejected");
        resetPaymentRateLimits();
        const rLegacyRzp = await fetch(`${secBaseUrl}/api/payments/download-paid-asset?token=${encodeURIComponent(legacyRzpV1Tok)}`);
        assert.strictEqual(rLegacyRzp.status, 403, `Expected HTTP 403 for legacy v1 signed by RAZORPAY_KEY_SECRET, got ${rLegacyRzp.status}`);
        assert.strictEqual((await rLegacyRzp.json()).code, "INVALID_DOWNLOAD_TOKEN");
      });

      // 10.6 (B-1) Actual HTTP tests for symlink attack, non-regular file rejection, and deterministic TOCTOU filesystem race simulation
      await runTest("10.6 (B-1 HTTP) GET /api/payments/download-paid-asset blocks symlink attack, rejects non-regular files, detects post-open swap, and streams strictly from validated fd without reopening pathname", async () => {
        const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "p03-b1-http-race-"));
        const safeDir = path.join(tmpRoot, "protected_downloads");
        const outsideSecret = path.join(tmpRoot, "outside-secret.txt");
        const targetName = "meta-ads-campaign-planner-workbook.pdf";
        const targetPath = path.join(safeDir, targetName);
        const wbToken = generateAssetAccessToken(BUNDLE_ITEMS[0].id, "pay_b1_race")!;
        assert.ok(wbToken);

        try {
          fs.mkdirSync(safeDir, { recursive: true });
          fs.writeFileSync(outsideSecret, "OUTSIDE_TOP_SECRET_DO_NOT_LEAK");

          // Case 1: Real symlink attack over actual HTTP route -> HTTP 404, zero secret or path leakage
          fs.symlinkSync(outsideSecret, targetPath);
          setTestProtectedAssetConfig({ candidateDirs: [safeDir] });
          resetPaymentRateLimits();

          const rSymlink = await fetch(`${secBaseUrl}/api/payments/download-paid-asset?token=${encodeURIComponent(wbToken)}`);
          assert.strictEqual(rSymlink.status, 404, `Expected HTTP 404 for symlink attack, got ${rSymlink.status}`);
          assert.ok(String(rSymlink.headers.get("cache-control") || "").includes("no-store"));
          const symText = await rSymlink.text();
          const symBody = JSON.parse(symText);
          assert.strictEqual(symBody.success, false);
          assert.strictEqual(symBody.code, "PROTECTED_ASSET_UNAVAILABLE");
          assert.ok(!symText.includes("OUTSIDE_TOP_SECRET"), "Symlink attack must NEVER leak outside file contents");
          assert.ok(!symText.includes(tmpRoot), "Error response must NEVER leak filesystem paths");
          assert.ok(!symText.includes("Error:"), "Error response must NEVER leak stack traces");

          // Case 2: Non-regular file (directory at target filename) over actual HTTP route -> HTTP 404
          fs.unlinkSync(targetPath);
          fs.mkdirSync(targetPath);
          resetPaymentRateLimits();

          const rDir = await fetch(`${secBaseUrl}/api/payments/download-paid-asset?token=${encodeURIComponent(wbToken)}`);
          assert.strictEqual(rDir.status, 404, `Expected HTTP 404 for directory entry, got ${rDir.status}`);
          const dirText = await rDir.text();
          assert.strictEqual(JSON.parse(dirText).code, "PROTECTED_ASSET_UNAVAILABLE");
          assert.ok(!dirText.includes(tmpRoot));

          // Case 3: Deterministic TOCTOU race #1 — pathname swapped to symlink AFTER openSync, BEFORE post-open identity verification
          fs.rmdirSync(targetPath);
          fs.writeFileSync(targetPath, "%PDF-1.4 ORIGINAL_BEFORE_SWAP");
          let race1Triggered = false;
          setTestProtectedAssetConfig({
            candidateDirs: [safeDir],
            hooks: {
              onAfterOpen: ({ candidatePath }: { candidatePath: string }) => {
                race1Triggered = true;
                fs.unlinkSync(candidatePath);
                fs.symlinkSync(outsideSecret, candidatePath);
              }
            }
          });
          resetPaymentRateLimits();

          const rRace1 = await fetch(`${secBaseUrl}/api/payments/download-paid-asset?token=${encodeURIComponent(wbToken)}`);
          assert.strictEqual(race1Triggered, true, "Expected deterministic onAfterOpen race hook to execute");
          assert.strictEqual(rRace1.status, 404, `Expected HTTP 404 when entry swapped to symlink after open, got ${rRace1.status}`);
          const race1Text = await rRace1.text();
          assert.strictEqual(JSON.parse(race1Text).code, "PROTECTED_ASSET_UNAVAILABLE");
          assert.ok(!race1Text.includes("OUTSIDE_TOP_SECRET"));

          // Case 4: Deterministic TOCTOU race #2 — pathname swapped to symlink AFTER fd validation, BEFORE stream reads
          // Because the route streams directly from the already-opened validated fd (NEVER reopening by path),
          // the attacker's symlink is completely ignored and ONLY the original regular file's bytes are delivered.
          fs.unlinkSync(targetPath);
          const originalBytes = Buffer.from("%PDF-1.4 ORIGINAL_VALIDATED_FD_BYTES");
          fs.writeFileSync(targetPath, originalBytes);
          let race2Triggered = false;
          setTestProtectedAssetConfig({
            candidateDirs: [safeDir],
            hooks: {
              onBeforeStream: ({ filePath }: { filePath: string }) => {
                race2Triggered = true;
                fs.unlinkSync(filePath);
                fs.symlinkSync(outsideSecret, filePath);
              }
            }
          });
          resetPaymentRateLimits();

          const rRace2 = await fetch(`${secBaseUrl}/api/payments/download-paid-asset?token=${encodeURIComponent(wbToken)}`);
          assert.strictEqual(race2Triggered, true, "Expected deterministic onBeforeStream race hook to execute");
          assert.strictEqual(rRace2.status, 200, `Expected HTTP 200 streaming original validated fd, got ${rRace2.status}`);
          assert.ok(String(rRace2.headers.get("cache-control") || "").includes("no-store"));
          const streamedBytes = Buffer.from(await rRace2.arrayBuffer());
          assert.ok(streamedBytes.equals(originalBytes), "Must stream exact bytes of the originally opened validated fd");
          assert.ok(!streamedBytes.toString("utf8").includes("OUTSIDE_TOP_SECRET"), "Must NEVER reopen swapped symlink by pathname");

          // Verify direct helper openConfinedProtectedAssetFd closes fd cleanly on failure and opens regular file cleanly
          fs.unlinkSync(targetPath);
          fs.writeFileSync(targetPath, originalBytes);
          setTestProtectedAssetConfig(null);
          const directOpened = openConfinedProtectedAssetFd(targetName, [safeDir]);
          assert.strictEqual(directOpened.ok, true);
          assert.strictEqual(typeof directOpened.fd, "number");
          fs.closeSync(directOpened.fd!);
        } finally {
          setTestProtectedAssetConfig(null);
          fs.rmSync(tmpRoot, { recursive: true, force: true });
        }
      });

      // =========================================================================
      // 11. FINDING 5 — MANDATORY DEDICATED SECRET, RAZORPAY FALLBACK REMOVAL,
      //     STRICT 32-BYTE DECODED HMAC SIGNATURE & MAX TOKEN LIFETIME
      // =========================================================================
      console.log("\n[11] Finding 5 Asset Token Verification Hardening (Unit + HTTP)");

      // Helper to flip non-canonical trailing 2 bits of a valid 43-char base64url 32-byte signature
      const makeNonCanonical43CharSig = (canonicalSig: string): string => {
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
        assert.strictEqual(canonicalSig.length, 43);
        const lastChar = canonicalSig[42];
        const idx = alphabet.indexOf(lastChar);
        assert.ok(idx >= 0);
        // Flip the lowest bit (one of the 2 unused padding bits in a 43-char base64url encoding of 32 bytes)
        const mutatedLastChar = alphabet[idx ^ 1];
        const mutated = canonicalSig.slice(0, 42) + mutatedLastChar;
        // Node's permissive Buffer.from(..., 'base64url') decodes both to identical 32 bytes,
        // proving our strict round-trip check is what rejects the non-canonical encoding
        assert.ok(Buffer.from(mutated, "base64url").equals(Buffer.from(canonicalSig, "base64url")));
        assert.notStrictEqual(mutated, canonicalSig);
        return mutated;
      };

      const signRawBytesPayload = (rawPayloadBytes: Buffer, secret: string): string => {
        const data = rawPayloadBytes.toString("base64url");
        const sig = crypto.createHmac("sha256", secret).update(data, "ascii").digest("base64url");
        return `${data}.${sig}`;
      };

      // 11.1 (Finding 5 Unit) Secret policy, exclusivity, 32-byte decoded sig, base64url/UTF-8 & max TTL helpers
      await runTest("11.1 (Finding 5 Unit) Mandatory ASSET_TOKEN_HMAC_SECRET policy, zero Razorpay fallback, strict 32-byte decoded sig, fatal UTF-8, and strict 3,600s max TTL", () => {
        const origAssetSecret = process.env.ASSET_TOKEN_HMAC_SECRET;
        const origRzpSecret = process.env.RAZORPAY_KEY_SECRET;
        const dedicatedSecret = "f5_unit_dedicated_asset_secret_32_bytes_high_entropy_9!";
        const rzpSecret = "f5_unit_razorpay_secret_32_bytes_high_entropy_8!";

        try {
          assert.strictEqual(ASSET_TOKEN_TTL_MS, 3_600_000);
          assert.strictEqual(ASSET_TOKEN_MAX_TTL_MS, 3_600_000);

          process.env.ASSET_TOKEN_HMAC_SECRET = dedicatedSecret;
          process.env.RAZORPAY_KEY_SECRET = rzpSecret;

          // 1. Valid v2 signed by dedicated asset secret has exact 32-byte decoded HMAC-SHA256 signature and is accepted
          const validV2 = generateAssetAccessToken(BUNDLE_ITEMS[0].id, "pay_f5_unit_ok")!;
          assert.ok(validV2);
          const [v2Data, v2Sig] = validV2.split(".");
          assert.strictEqual(v2Sig.length, 43);
          assert.strictEqual(Buffer.from(v2Sig, "base64url").length, 32);
          const verifiedV2 = verifyAssetAccessToken(validV2);
          assert.ok(verifiedV2);
          assert.strictEqual(verifiedV2!.v, 2);
          assert.strictEqual(verifiedV2!.resourceId, BUNDLE_ITEMS[0].id);
          assert.strictEqual(verifiedV2!.filename, "meta-ads-campaign-planner-workbook.pdf");
          assert.ok(verifiedV2!.expiresAt <= Date.now() + ASSET_TOKEN_MAX_TTL_MS);

          // 2. v2 signed by RAZORPAY_KEY_SECRET -> rejected
          const v2WithRzp = signJsonPayload(
            {
              v: 2,
              resourceId: BUNDLE_ITEMS[0].id,
              authId: "pay_f5_rzp_v2",
              filename: "meta-ads-campaign-planner-workbook.pdf",
              expiresAt: Date.now() + 60_000
            },
            rzpSecret
          );
          assert.strictEqual(verifyAssetAccessToken(v2WithRzp), null);

          // 3. Legacy v1 signed by RAZORPAY_KEY_SECRET -> rejected
          const v1WithRzp = signJsonPayload(
            {
              resourceId: BUNDLE_ITEMS[0].id,
              authId: "pay_f5_rzp_v1",
              expiresAt: Date.now() + 60_000
            },
            rzpSecret
          );
          assert.strictEqual(verifyAssetAccessToken(v1WithRzp), null);

          // 4. Legacy v1 signed by dedicated ASSET_TOKEN_HMAC_SECRET -> accepted ONLY for exact v1 schema within max TTL
          const v1WithDedicated = signJsonPayload(
            {
              resourceId: BUNDLE_ITEMS[0].id,
              authId: "pay_f5_ded_v1",
              expiresAt: Date.now() + 60_000
            },
            dedicatedSecret
          );
          const decodedV1 = verifyAssetAccessToken(v1WithDedicated);
          assert.strictEqual(decodedV1?.v, 1);
          assert.strictEqual((decodedV1 as any)?.legacy, true);
          assert.strictEqual(decodedV1?.resourceId, BUNDLE_ITEMS[0].id);

          // Legacy v1 with filename field or unknown key -> rejected
          const v1WithFilename = signJsonPayload(
            {
              resourceId: BUNDLE_ITEMS[0].id,
              authId: "pay_f5_ded_v1",
              filename: "meta-ads-campaign-planner-workbook.pdf",
              expiresAt: Date.now() + 60_000
            },
            dedicatedSecret
          );
          assert.strictEqual(verifyAssetAccessToken(v1WithFilename), null);

          // 5. Missing ASSET_TOKEN_HMAC_SECRET fails closed even when RAZORPAY_KEY_SECRET is valid
          delete process.env.ASSET_TOKEN_HMAC_SECRET;
          assert.strictEqual(getAssetHmacSecret(), null);
          assert.strictEqual(isAssetTokenSecretConfigured(), false);
          assert.strictEqual(generateAssetAccessToken(BUNDLE_ITEMS[0].id, "pay_missing"), null);
          assert.strictEqual(verifyAssetAccessToken(validV2), null);
          assert.strictEqual(verifyAssetAccessToken(v1WithRzp), null);
          assert.strictEqual(verifyAssetAccessToken(v2WithRzp), null);

          // 6. Weak / invalid / placeholder ASSET_TOKEN_HMAC_SECRET fails closed per project secret policy
          const weakSecrets = [
            "",
            "   \t\n ",
            "undefined",
            "null",
            "short_31_byte_secret_1234567890", // 31 bytes
            "generate_at_least_32_bytes_random_hex_secret_here",
            "your_production_asset_token_secret_32_bytes_long",
            "my_asset_hmac_secret_value_at_least_32_bytes_long",
            "test_placeholder_secret_value_32_bytes_minimum_ok",
            "please_replace_me_before_deploy_32_bytes_minimum!",
            "internal whitespace secret value 32 bytes long!!",
            "control_char_secret_value_32_bytes\x1b_minimum_ok!",
            "0".repeat(64),
            "a".repeat(32),
            "ab".repeat(32)
          ];
          for (const weak of weakSecrets) {
            process.env.ASSET_TOKEN_HMAC_SECRET = weak;
            assert.strictEqual(getAssetHmacSecret(), null, `Weak secret should be rejected: ${JSON.stringify(weak)}`);
            assert.strictEqual(isAssetTokenSecretConfigured(), false);
            assert.strictEqual(generateAssetAccessToken(BUNDLE_ITEMS[0].id, "pay_weak"), null);
            const tokWithWeak = signJsonPayload(
              {
                v: 2,
                resourceId: BUNDLE_ITEMS[0].id,
                authId: "pay_weak",
                expiresAt: Date.now() + 60_000
              },
              weak.trim() || "x"
            );
            assert.strictEqual(verifyAssetAccessToken(tokWithWeak), null);
          }

          // Restore valid dedicated secret for encoding, signature-length, UTF-8, schema, and TTL checks
          process.env.ASSET_TOKEN_HMAC_SECRET = dedicatedSecret;

          // 7. Wrong decoded signature lengths (16, 31, 33, 64 bytes), padded '=', standard base64 '+/', non-canonical trailing bits
          const wrongLenSigs = [
            crypto.randomBytes(16).toString("base64url"),
            crypto.randomBytes(31).toString("base64url"),
            crypto.randomBytes(33).toString("base64url"),
            crypto.randomBytes(64).toString("base64url"),
            `${v2Sig}=`,
            `${v2Sig.slice(0, 42)}+`,
            `${v2Sig.slice(0, 42)}/`,
            "a".repeat(41), // length % 4 === 1
            makeNonCanonical43CharSig(v2Sig)
          ];
          for (const badSig of wrongLenSigs) {
            assert.strictEqual(verifyAssetAccessToken(`${v2Data}.${badSig}`), null, `Bad signature should fail: ${badSig}`);
          }

          // 8. Invalid UTF-8 bytes inside signed payload (raw invalid UTF-8 & invalid UTF-8 inside JSON string)
          const rawInvalidUtf8 = Buffer.from([0xff, 0xfe, 0xfd]);
          assert.strictEqual(verifyAssetAccessToken(signRawBytesPayload(rawInvalidUtf8, dedicatedSecret)), null);
          const jsonWithInvalidUtf8 = Buffer.concat([
            Buffer.from(`{"v":2,"resourceId":"${BUNDLE_ITEMS[0].id}","authId":"bad`, "utf8"),
            Buffer.from([0xff, 0xfe]),
            Buffer.from(`","expiresAt":${Date.now() + 60_000}}`, "utf8")
          ]);
          assert.strictEqual(verifyAssetAccessToken(signRawBytesPayload(jsonWithInvalidUtf8, dedicatedSecret)), null);

          // 9. Excessive future expiry & non-integer expiry rejected (both v2 and legacy v1)
          const badExpiries = [
            Date.now() - 1_000,
            Date.now() + ASSET_TOKEN_MAX_TTL_MS + 5_000,
            Date.now() + 2 * ASSET_TOKEN_MAX_TTL_MS,
            Date.now() + 365 * 24 * 60 * 60 * 1000,
            Date.now() + 60_000.5
          ];
          for (const exp of badExpiries) {
            const v2BadExp = signJsonPayload(
              { v: 2, resourceId: BUNDLE_ITEMS[0].id, authId: "a", expiresAt: exp },
              dedicatedSecret
            );
            const v1BadExp = signJsonPayload(
              { resourceId: BUNDLE_ITEMS[0].id, authId: "a", expiresAt: exp },
              dedicatedSecret
            );
            assert.strictEqual(verifyAssetAccessToken(v2BadExp), null, `v2 expiry=${exp} should fail`);
            assert.strictEqual(verifyAssetAccessToken(v1BadExp), null, `v1 expiry=${exp} should fail`);
          }

          // 10. Unsupported versions and unknown/__proto__ keys rejected
          for (const badVersion of [0, 1, 3, "2", null, true]) {
            const badVerTok = signJsonPayload(
              { v: badVersion, resourceId: BUNDLE_ITEMS[0].id, authId: "a", expiresAt: Date.now() + 60_000 },
              dedicatedSecret
            );
            assert.strictEqual(verifyAssetAccessToken(badVerTok), null, `Unsupported version ${String(badVersion)} should fail`);
          }
          const protoJsonBuf = Buffer.from(
            `{"v":2,"resourceId":"${BUNDLE_ITEMS[0].id}","authId":"a","__proto__":{"admin":true},"expiresAt":${Date.now() + 60_000}}`,
            "utf8"
          );
          assert.strictEqual(verifyAssetAccessToken(signRawBytesPayload(protoJsonBuf, dedicatedSecret)), null);
        } finally {
          if (origAssetSecret !== undefined) process.env.ASSET_TOKEN_HMAC_SECRET = origAssetSecret;
          else delete process.env.ASSET_TOKEN_HMAC_SECRET;
          if (origRzpSecret !== undefined) process.env.RAZORPAY_KEY_SECRET = origRzpSecret;
          else delete process.env.RAZORPAY_KEY_SECRET;
        }
      });

      // 11.2 (Finding 5 HTTP) Dedicated secret mandatory, weak secret rejection, v2/v1 Razorpay rejection, valid v2 & v1 dedicated acceptance
      await runTest("11.2 (Finding 5 HTTP) GET /api/payments/download-paid-asset enforces mandatory ASSET_TOKEN_HMAC_SECRET, rejects weak/missing secret & Razorpay-signed v2/v1 tokens with 403, accepts valid dedicated v2 & v1", async () => {
        const origAssetSecret = process.env.ASSET_TOKEN_HMAC_SECRET;
        const origRzpSecret = process.env.RAZORPAY_KEY_SECRET;
        const dedicatedSecret = "f5_http_dedicated_asset_secret_32_bytes_high_entropy_7!";
        const rzpSecret = "f5_http_razorpay_secret_32_bytes_high_entropy_6!";
        const expectedPdf = fs.readFileSync(path.resolve("server/protected_downloads/meta-ads-campaign-planner-workbook.pdf"));

        const assertClean403 = async (res: Response, label: string, forbiddenSubstrings: string[]) => {
          assert.strictEqual(res.status, 403, `Expected HTTP 403 for ${label}, got ${res.status}`);
          assert.ok(String(res.headers.get("cache-control") || "").includes("no-store"), `Missing no-store header for ${label}`);
          const text = await res.text();
          const body = JSON.parse(text);
          assert.strictEqual(body.success, false);
          assert.strictEqual(body.code, "INVALID_DOWNLOAD_TOKEN");
          assert.ok(!text.includes("protected_downloads"), `Path leaked in ${label}`);
          assert.ok(!text.includes("/app/"), `Filesystem path leaked in ${label}`);
          assert.ok(!text.includes("Error:") && !text.includes("at "), `Stack trace leaked in ${label}`);
          for (const secretStr of forbiddenSubstrings) {
            if (secretStr && secretStr.length >= 6) {
              assert.ok(!text.includes(secretStr), `Secret leaked in ${label}`);
            }
          }
        };

        try {
          process.env.ASSET_TOKEN_HMAC_SECRET = dedicatedSecret;
          process.env.RAZORPAY_KEY_SECRET = rzpSecret;

          const validV2 = generateAssetAccessToken(BUNDLE_ITEMS[0].id, "pay_f5_http_v2")!;
          const v2Rzp = signJsonPayload(
            {
              v: 2,
              resourceId: BUNDLE_ITEMS[0].id,
              authId: "pay_f5_http_rzp_v2",
              filename: "meta-ads-campaign-planner-workbook.pdf",
              expiresAt: Date.now() + 60_000
            },
            rzpSecret
          );
          const v1Rzp = signJsonPayload(
            {
              resourceId: BUNDLE_ITEMS[0].id,
              authId: "pay_f5_http_rzp_v1",
              expiresAt: Date.now() + 60_000
            },
            rzpSecret
          );
          const v1DedicatedOk = signJsonPayload(
            {
              resourceId: BUNDLE_ITEMS[0].id,
              authId: "pay_f5_http_ded_v1",
              expiresAt: Date.now() + 60_000
            },
            dedicatedSecret
          );
          const v1DedicatedBadField = signJsonPayload(
            {
              resourceId: BUNDLE_ITEMS[0].id,
              authId: "pay_f5_http_ded_v1",
              filename: "meta-ads-campaign-planner-workbook.pdf",
              expiresAt: Date.now() + 60_000
            },
            dedicatedSecret
          );

          // 1. Valid v2 signed by dedicated asset secret -> HTTP 200
          resetPaymentRateLimits();
          const rV2Ok = await fetch(`${secBaseUrl}/api/payments/download-paid-asset?token=${encodeURIComponent(validV2)}`);
          assert.strictEqual(rV2Ok.status, 200);
          assert.ok(Buffer.from(await rV2Ok.arrayBuffer()).equals(expectedPdf));

          // 2. Valid legacy v1 signed by dedicated asset secret -> HTTP 200
          resetPaymentRateLimits();
          const rV1Ok = await fetch(`${secBaseUrl}/api/payments/download-paid-asset?token=${encodeURIComponent(v1DedicatedOk)}`);
          assert.strictEqual(rV1Ok.status, 200);
          assert.ok(Buffer.from(await rV1Ok.arrayBuffer()).equals(expectedPdf));

          // 3. v2 signed by RAZORPAY_KEY_SECRET, v1 signed by RAZORPAY_KEY_SECRET, and v1 with disallowed filename -> HTTP 403
          for (const [label, tok] of [
            ["v2 signed by RAZORPAY_KEY_SECRET", v2Rzp],
            ["legacy v1 signed by RAZORPAY_KEY_SECRET", v1Rzp],
            ["legacy v1 with disallowed filename key", v1DedicatedBadField]
          ]) {
            resetPaymentRateLimits();
            const res = await fetch(`${secBaseUrl}/api/payments/download-paid-asset?token=${encodeURIComponent(tok)}`);
            await assertClean403(res, label, [dedicatedSecret, rzpSecret]);
          }

          // 4. Dedicated secret missing -> reject ALL tokens (including previously valid v2 and Razorpay-signed v1) with HTTP 403
          delete process.env.ASSET_TOKEN_HMAC_SECRET;
          for (const [label, tok] of [
            ["missing secret with dedicated v2 token", validV2],
            ["missing secret with Razorpay v1 token", v1Rzp],
            ["missing secret with Razorpay v2 token", v2Rzp]
          ]) {
            resetPaymentRateLimits();
            const res = await fetch(`${secBaseUrl}/api/payments/download-paid-asset?token=${encodeURIComponent(tok)}`);
            await assertClean403(res, label, [dedicatedSecret, rzpSecret]);
          }

          // 5. Dedicated secret invalid/weak -> reject with HTTP 403 (never 500, no secret leakage)
          for (const [label, weakVal] of [
            ["short 31-byte secret", "short_weak_secret_31_bytes_1234"],
            ["placeholder secret", "generate_at_least_32_bytes_random_hex_secret_here"],
            ["low-entropy repeated secret", "0".repeat(64)],
            ["secret with internal space", "weak secret with internal spaces 32 bytes long!"]
          ]) {
            process.env.ASSET_TOKEN_HMAC_SECRET = weakVal;
            const weakSigned = signJsonPayload(
              { v: 2, resourceId: BUNDLE_ITEMS[0].id, authId: "a", expiresAt: Date.now() + 60_000 },
              weakVal
            );
            resetPaymentRateLimits();
            const res = await fetch(`${secBaseUrl}/api/payments/download-paid-asset?token=${encodeURIComponent(weakSigned)}`);
            await assertClean403(res, `weak secret (${label})`, [weakVal, dedicatedSecret, rzpSecret]);
          }
        } finally {
          if (origAssetSecret !== undefined) process.env.ASSET_TOKEN_HMAC_SECRET = origAssetSecret;
          else delete process.env.ASSET_TOKEN_HMAC_SECRET;
          if (origRzpSecret !== undefined) process.env.RAZORPAY_KEY_SECRET = origRzpSecret;
          else delete process.env.RAZORPAY_KEY_SECRET;
        }
      });

      // 11.3 (Finding 5 HTTP) Wrong decoded sig lengths, strict base64url, malformed UTF-8, excessive future expiry, __proto__, unsupported versions -> HTTP 403 (never 500)
      await runTest("11.3 (Finding 5 HTTP) GET /api/payments/download-paid-asset rejects wrong decoded sig lengths, non-canonical base64url, malformed UTF-8, excessive future expiry, __proto__, and unsupported versions with 403 and zero leakage", async () => {
        const dedicatedSecret = process.env.ASSET_TOKEN_HMAC_SECRET!;
        const validV2 = generateAssetAccessToken(BUNDLE_ITEMS[0].id, "pay_f5_http_11_3")!;
        const [v2Data, v2Sig] = validV2.split(".");

        const invalidUtf8Json = Buffer.concat([
          Buffer.from(`{"v":2,"resourceId":"${BUNDLE_ITEMS[0].id}","authId":"bad`, "utf8"),
          Buffer.from([0xff, 0xfe]),
          Buffer.from(`","expiresAt":${Date.now() + 60_000}}`, "utf8")
        ]);
        const protoJson = Buffer.from(
          `{"v":2,"resourceId":"${BUNDLE_ITEMS[0].id}","authId":"a","__proto__":{"polluted":true},"expiresAt":${Date.now() + 60_000}}`,
          "utf8"
        );

        const cases: Array<{ label: string; token: string }> = [
          { label: "16-byte decoded signature", token: `${v2Data}.${crypto.randomBytes(16).toString("base64url")}` },
          { label: "31-byte decoded signature", token: `${v2Data}.${crypto.randomBytes(31).toString("base64url")}` },
          { label: "33-byte decoded signature", token: `${v2Data}.${crypto.randomBytes(33).toString("base64url")}` },
          { label: "64-byte decoded signature", token: `${v2Data}.${crypto.randomBytes(64).toString("base64url")}` },
          { label: "padded base64url signature (=)", token: `${v2Data}.${v2Sig}=` },
          { label: "standard base64 signature (+)", token: `${v2Data}.${v2Sig.slice(0, 42)}+` },
          { label: "standard base64 signature (/)", token: `${v2Data}.${v2Sig.slice(0, 42)}/` },
          { label: "non-canonical 43-char trailing bits signature", token: `${v2Data}.${makeNonCanonical43CharSig(v2Sig)}` },
          { label: "four-segment token", token: `${v2Data}.${v2Sig}.extra.segment` },
          { label: "tampered payload with original signature", token: `${Buffer.from(JSON.stringify({ v: 2, resourceId: BUNDLE_ITEMS[1].id, authId: "tamper", expiresAt: Date.now() + 60_000 }), "utf8").toString("base64url")}.${v2Sig}` },
          { label: "malformed raw UTF-8 signed payload", token: signRawBytesPayload(Buffer.from([0xff, 0xfe, 0xc0, 0xaf]), dedicatedSecret) },
          { label: "malformed UTF-8 inside signed JSON string", token: signRawBytesPayload(invalidUtf8Json, dedicatedSecret) },
          { label: "excessive future expiry (+1h + 5s)", token: signJsonPayload({ v: 2, resourceId: BUNDLE_ITEMS[0].id, authId: "a", expiresAt: Date.now() + ASSET_TOKEN_MAX_TTL_MS + 5_000 }, dedicatedSecret) },
          { label: "excessive future expiry (+2h)", token: signJsonPayload({ v: 2, resourceId: BUNDLE_ITEMS[0].id, authId: "a", expiresAt: Date.now() + 2 * ASSET_TOKEN_MAX_TTL_MS }, dedicatedSecret) },
          { label: "excessive future expiry (+1y)", token: signJsonPayload({ v: 2, resourceId: BUNDLE_ITEMS[0].id, authId: "a", expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000 }, dedicatedSecret) },
          { label: "legacy v1 excessive future expiry (+2h)", token: signJsonPayload({ resourceId: BUNDLE_ITEMS[0].id, authId: "a", expiresAt: Date.now() + 2 * ASSET_TOKEN_MAX_TTL_MS }, dedicatedSecret) },
          { label: "non-integer float expiresAt", token: signJsonPayload({ v: 2, resourceId: BUNDLE_ITEMS[0].id, authId: "a", expiresAt: Date.now() + 60_000.5 }, dedicatedSecret) },
          { label: "unknown __proto__ payload key", token: signRawBytesPayload(protoJson, dedicatedSecret) },
          { label: "unsupported version v:0", token: signJsonPayload({ v: 0, resourceId: BUNDLE_ITEMS[0].id, authId: "a", expiresAt: Date.now() + 60_000 }, dedicatedSecret) },
          { label: "unsupported version v:1 explicit", token: signJsonPayload({ v: 1, resourceId: BUNDLE_ITEMS[0].id, authId: "a", expiresAt: Date.now() + 60_000 }, dedicatedSecret) },
          { label: "unsupported version v:3", token: signJsonPayload({ v: 3, resourceId: BUNDLE_ITEMS[0].id, authId: "a", expiresAt: Date.now() + 60_000 }, dedicatedSecret) },
          { label: "unsupported version v:'2'", token: signJsonPayload({ v: "2", resourceId: BUNDLE_ITEMS[0].id, authId: "a", expiresAt: Date.now() + 60_000 }, dedicatedSecret) }
        ];

        for (const tc of cases) {
          resetPaymentRateLimits();
          const res = await fetch(`${secBaseUrl}/api/payments/download-paid-asset?token=${encodeURIComponent(tc.token)}`);
          assert.strictEqual(res.status, 403, `Expected HTTP 403 for ${tc.label}, got ${res.status}`);
          assert.ok(String(res.headers.get("cache-control") || "").includes("no-store"), `Missing no-store header for ${tc.label}`);
          const text = await res.text();
          const body = JSON.parse(text);
          assert.strictEqual(body.success, false);
          assert.strictEqual(body.code, "INVALID_DOWNLOAD_TOKEN");
          assert.ok(!text.includes(dedicatedSecret), `Secret leaked in ${tc.label}`);
          assert.ok(!text.includes("protected_downloads"), `Path leaked in ${tc.label}`);
          assert.ok(!text.includes("Error:") && !text.includes("at "), `Stack trace leaked in ${tc.label}`);
        }
      });
    } finally {
      setTestProtectedAssetConfig(null);
      await stopServer(secServer);
      setMockSupabaseServerClient(null);
    }
  }

  console.log("\n==================================================================");
  console.log(`P0-3 TEST SUMMARY: ${passed} passed, ${failed} failed (total ${passed + failed})`);
  console.log("==================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal P0-3 test error:", err);
  process.exit(1);
});
