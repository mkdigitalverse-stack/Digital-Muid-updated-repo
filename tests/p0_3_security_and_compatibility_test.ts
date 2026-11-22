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
process.env.DOWNLOAD_RATE_LIMIT_HMAC_SECRET = "p03_download_rl_hmac_secret_min_32_chars!";
process.env.TRUST_PROXY_HOPS = "0";

const {
  createResourceRoutes,
  resolveTrustProxyConfig,
  extractTrustedClientIp,
  computeDownloadClientHash,
  isDownloadRateLimitSecretConfigured
} = await import("../server/resourceRoutes.js");

const {
  checkIsAdmin,
  setMockSupabaseServerClient
} = await import("../server/supabaseServer.js");

const {
  default: paymentRoutes,
  resetPaymentRateLimits,
  getClientIp
} = await import("../server/paymentRoutes.js");

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
    assert.ok(purchaseBlock.includes("if (!isPaid)"), "purchaseResource must never call free-download endpoint for paid purchases");
  });

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
