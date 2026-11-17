/**
 * DIGITALMUID V4.3 — STATIC CI HARNESS & GUARD REGRESSION TESTS
 * File: tests/ci_harness_regression_test.js
 *
 * Strictly static & isolated (ZERO PostgreSQL / Supabase connections, ZERO external secrets).
 * Fails if:
 *   1. Any negative exception test in `supabase/tests/v4_3_postgres_integration_test.sql`
 *      reintroduces the self-catching `BEGIN ... RAISE EXCEPTION ... EXCEPTION WHEN` pattern
 *      or omits post-block boolean/SQLSTATE/message assertions (specifically Tests 1, 5A, 5D, 5F).
 *   2. `supabase/tests/ci_bootstrap_prerequisites.sql` weakens DB name, PostgreSQL 17,
 *      Supabase/project blocklists, private container-network bridge allowance, or public-IP rejection.
 *   3. `.github/workflows/postgres-v4-3-migration-tests.yml` or `v4_3_postgres_concurrency_test.mjs`
 *      weakens `PGHOST=127.0.0.1` / loopback runner restrictions or omits DB cleanup.
 */

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

const BOOTSTRAP_SQL = fs.readFileSync(
  path.resolve("supabase/tests/ci_bootstrap_prerequisites.sql"),
  "utf8"
);
const INTEGRATION_SQL = fs.readFileSync(
  path.resolve("supabase/tests/v4_3_postgres_integration_test.sql"),
  "utf8"
);
const CONCURRENCY_JS = fs.readFileSync(
  path.resolve("supabase/tests/v4_3_postgres_concurrency_test.mjs"),
  "utf8"
);
const WORKFLOW_YML = fs.readFileSync(
  path.resolve(".github/workflows/postgres-v4-3-migration-tests.yml"),
  "utf8"
);
const MANIFEST_TXT = fs.readFileSync(
  path.resolve("supabase/tests/ci_migration_manifest.txt"),
  "utf8"
);

let passed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passed += 1;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}\n    ${err.message}`);
    process.exitCode = 1;
  }
}

console.log("=== STATIC CI HARNESS REGRESSION TESTS ===");

/**
 * Detects whether any `BEGIN ... EXCEPTION WHEN ... END;` subblock contains `RAISE EXCEPTION`
 * inside its try body (before `EXCEPTION WHEN`), which would silently catch its own assertion failure.
 */
function findSelfCatchingExceptionBlocks(sqlText) {
  const lines = sqlText.split("\n");
  const stack = [];
  const findings = [];
  let insideDoBody = false;

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("--")) continue;

    if (/^DO\s+\$\$/i.test(trimmed)) {
      insideDoBody = false;
      continue;
    }
    if (/^END\s+\$\$;/i.test(trimmed)) {
      stack.length = 0;
      insideDoBody = false;
      continue;
    }
    if (/^BEGIN$/i.test(trimmed)) {
      if (!insideDoBody) {
        insideDoBody = true; // outer DO body BEGIN
        stack.push({ isOuterDo: true, startLine: i + 1, hasException: false, tryLines: [] });
      } else {
        stack.push({ isOuterDo: false, startLine: i + 1, hasException: false, tryLines: [] });
      }
      continue;
    }
    if (/^EXCEPTION\s+WHEN\b/i.test(trimmed)) {
      if (stack.length > 0) {
        stack[stack.length - 1].hasException = true;
      }
      continue;
    }
    if (/^END\s*;$/i.test(trimmed)) {
      const frame = stack.pop();
      if (frame && frame.hasException) {
        for (const entry of frame.tryLines) {
          if (/\bRAISE\s+EXCEPTION\b/i.test(entry.text)) {
            findings.push({
              beginLine: frame.startLine,
              raiseLine: entry.line,
              text: entry.text
            });
          }
        }
      }
      continue;
    }

    if (stack.length > 0) {
      const top = stack[stack.length - 1];
      if (!top.hasException) {
        top.tryLines.push({ line: i + 1, text: trimmed });
      }
    }
  }
  return findings;
}

// [1] Guard against reintroduction of self-catching exception anti-pattern in SQL tests
test("Detector catches legacy self-catching 5A/5D BEGIN...RAISE EXCEPTION...EXCEPTION WHEN pattern", () => {
  const legacyBuggySnippet = `
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.record_credit_note_with_limit('p1', 'r1', 588.824, 'bad');
    RAISE EXCEPTION 'FAILED [5A]: Expected 588.824 to raise.';
  EXCEPTION WHEN raise_exception THEN
    NULL;
  END;
END $$;
`;
  const hits = findSelfCatchingExceptionBlocks(legacyBuggySnippet);
  assert.strictEqual(hits.length, 1, "Detector must catch legacy self-catching exception pattern");
});

test("Integration SQL never places RAISE EXCEPTION inside any BEGIN...EXCEPTION...END try block", () => {
  const hits = findSelfCatchingExceptionBlocks(INTEGRATION_SQL);
  assert.deepStrictEqual(
    hits,
    [],
    `Self-catching exception pattern detected in integration SQL: ${JSON.stringify(hits)}`
  );
});

test("Tests 5A and 5D set boolean flags inside EXCEPTION and assert P0001 + error message outside the inner block", () => {
  assert.doesNotMatch(
    INTEGRATION_SQL,
    /EXCEPTION\s+WHEN\s+raise_exception\s+THEN\s+(?:NULL|RESET\s+ROLE)\s*;/i,
    "Forbidden bare `EXCEPTION WHEN raise_exception THEN NULL/RESET ROLE;` handler detected"
  );

  // Test 5A checks
  assert.match(INTEGRATION_SQL, /v_rejected_3dec\s*:=\s*false;/);
  assert.match(INTEGRATION_SQL, /588\.824/);
  assert.match(INTEGRATION_SQL, /v_rejected_3dec\s*:=\s*true;/);
  assert.match(
    INTEGRATION_SQL,
    /IF\s+NOT\s+v_rejected_3dec[\s\S]*?v_err_state\s+IS\s+DISTINCT\s+FROM\s+'P0001'[\s\S]*?Invalid refund amount%at most two decimal places/i
  );

  // Test 5D checks
  assert.match(INTEGRATION_SQL, /v_rejected_over\s*:=\s*false;/);
  assert.match(INTEGRATION_SQL, /388\.83/);
  assert.match(INTEGRATION_SQL, /v_rejected_over\s*:=\s*true;/);
  assert.match(
    INTEGRATION_SQL,
    /IF\s+NOT\s+v_rejected_over[\s\S]*?v_err_state\s+IS\s+DISTINCT\s+FROM\s+'P0001'[\s\S]*?exceeds remaining eligible refundable balance/i
  );
});

test("Test 1 privilege matrix & Test 5F direct payment insert test assert flags + SQLSTATE outside EXCEPTION blocks", () => {
  const rejectedFlagSets = INTEGRATION_SQL.match(/v_rejected\s*:=\s*true;/g) || [];
  assert.strictEqual(rejectedFlagSets.length, 4, "Expected all 4 role-privilege negative tests in Test 1 to use v_rejected flag");
  assert.match(INTEGRATION_SQL, /v_rejected_auth_pay\s*:=\s*false;/);
  assert.match(INTEGRATION_SQL, /v_rejected_auth_pay\s*:=\s*true;/);
  assert.match(INTEGRATION_SQL, /IF\s+NOT\s+v_rejected_auth_pay\s+OR\s+v_err_state\s+NOT\s+IN\s*\('42501',\s*'P0001'\)/);
});

test("Integration & concurrency suites explicitly validate canonical seeded consultation_products fixture & DB states", () => {
  assert.match(INTEGRATION_SQL, /FIXTURE DIAGNOSTIC FAILURE:.*consultation_products/);
  assert.match(INTEGRATION_SQL, /PRODUCT_NOT_FOUND/);
  assert.match(CONCURRENCY_JS, /FIXTURE ERROR: Missing seeded default consultation_products row/);
  assert.match(CONCURRENCY_JS, /pg_stat_activity/);
  assert.match(CONCURRENCY_JS, /wait_event_type === "Lock"/);
});

// [2] Guard Finding 1 network/version/database protections
test("CI bootstrap guard enforces DB name, PG major version 17, Supabase blocklist, private container bridge allowance, and public/metadata rejection", () => {
  assert.match(BOOTSTRAP_SQL, /v_db_name IS DISTINCT FROM 'digitalmuid_ci_chronological_replay'/);
  assert.match(BOOTSTRAP_SQL, /server_version_num/);
  assert.match(BOOTSTRAP_SQL, /PostgreSQL 17/);
  assert.match(BOOTSTRAP_SQL, /v_srv_ver_num < 170000[\s\S]*v_srv_ver_num >= 180000/);
  assert.match(BOOTSTRAP_SQL, /kpuxtsworzkueyffjaaz\|supabase/);
  // Private Docker/GHA bridge ranges allowed alongside loopback & Unix socket
  assert.match(BOOTSTRAP_SQL, /10\.0\.0\.0\/8/);
  assert.match(BOOTSTRAP_SQL, /172\.16\.0\.0\/12/);
  assert.match(BOOTSTRAP_SQL, /192\.168\.0\.0\/16/);
  assert.match(BOOTSTRAP_SQL, /fc00::\/7/);
  // Cloud metadata / CGNAT / link-local explicitly excluded even if unroutable
  assert.match(BOOTSTRAP_SQL, /169\.254\.0\.0\/16/);
  assert.match(BOOTSTRAP_SQL, /fe80::\/10/);
  assert.match(BOOTSTRAP_SQL, /100\.64\.0\.0\/10/);
});

test("Workflow keeps PGHOST=127.0.0.1 & contents:read, Node runner enforces loopback + PG17, manifest matches migrations", () => {
  assert.match(WORKFLOW_YML, /permissions:\s*\n\s*contents:\s*read/);
  assert.doesNotMatch(WORKFLOW_YML, /pull_request_target/);
  assert.match(WORKFLOW_YML, /PGHOST:\s*127\.0\.0\.1/);
  assert.match(WORKFLOW_YML, /image:\s*postgres:17/);
  assert.match(WORKFLOW_YML, /if:\s*always\(\)/);
  assert.match(WORKFLOW_YML, /node tests\/ci_harness_regression_test\.js/);

  assert.match(CONCURRENCY_JS, /\["127\.0\.0\.1", "localhost", "::1"\]\.includes\(host\)/);
  assert.match(CONCURRENCY_JS, /ver_num >= 170000[\s\S]*ver_num < 180000/);

  const actualMigrations = fs
    .readdirSync(path.resolve("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => `supabase/migrations/${f}`);
  const manifestMigrations = MANIFEST_TXT.split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  assert.deepStrictEqual(manifestMigrations, actualMigrations, "ci_migration_manifest.txt must match supabase/migrations/*.sql");
});

console.log(`=== SUMMARY: ${passed} PASSED, ${process.exitCode ? 1 : 0} FAILED ===`);
