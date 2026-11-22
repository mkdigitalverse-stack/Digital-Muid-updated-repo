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
const P03_INTEGRATION_SQL = fs.readFileSync(
  path.resolve("supabase/tests/p0_3_postgres_integration_test.sql"),
  "utf8"
);
const P03_CONCURRENCY_JS = fs.readFileSync(
  path.resolve("supabase/tests/p0_3_postgres_concurrency_test.mjs"),
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

test("package-lock.json stays synchronized with package.json (including devDependencies.pg) for npm ci", () => {
  const pkg = JSON.parse(fs.readFileSync(path.resolve("package.json"), "utf8"));
  const lock = JSON.parse(fs.readFileSync(path.resolve("package-lock.json"), "utf8"));

  assert.ok(pkg.devDependencies && pkg.devDependencies.pg, "package.json must declare devDependencies.pg");
  assert.ok(lock.packages && lock.packages[""], "package-lock.json must contain root package entry");
  assert.deepStrictEqual(
    lock.packages[""].dependencies,
    pkg.dependencies,
    "package-lock.json root dependencies must match package.json"
  );
  assert.deepStrictEqual(
    lock.packages[""].devDependencies,
    pkg.devDependencies,
    "package-lock.json root devDependencies (including pg) must match package.json"
  );
  assert.ok(
    lock.packages["node_modules/pg"] && lock.packages["node_modules/pg"].version,
    "package-lock.json must contain resolved packages['node_modules/pg'] entry"
  );
});

function findSqlParamCountMismatches(jsSource) {
  const mismatches = [];

  function skipQuoted(src, start, quote) {
    let i = start + 1;
    while (i < src.length) {
      const ch = src[i];
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (quote === "`" && ch === "$" && src[i + 1] === "{") {
        i += 2;
        let braceDepth = 1;
        while (i < src.length && braceDepth > 0) {
          if (src[i] === "'" || src[i] === '"' || src[i] === "`") {
            i = skipQuoted(src, i, src[i]);
            continue;
          }
          if (src[i] === "{") braceDepth += 1;
          else if (src[i] === "}") braceDepth -= 1;
          i += 1;
        }
        continue;
      }
      if (ch === quote) return i + 1;
      i += 1;
    }
    return src.length;
  }

  function splitTopLevelArgs(argsSrc) {
    const args = [];
    let start = 0;
    let depth = 0;
    let i = 0;
    while (i < argsSrc.length) {
      const ch = argsSrc[i];
      if (ch === "'" || ch === '"' || ch === "`") {
        i = skipQuoted(argsSrc, i, ch);
        continue;
      }
      if (ch === "(" || ch === "[" || ch === "{") depth += 1;
      else if (ch === ")" || ch === "]" || ch === "}") depth -= 1;
      else if (ch === "," && depth === 0) {
        args.push(argsSrc.slice(start, i).trim());
        start = i + 1;
      }
      i += 1;
    }
    const last = argsSrc.slice(start).trim();
    if (last) args.push(last);
    return args;
  }

  const headRegex = /(?:execAsServiceRole|\.query)\s*\(/g;
  let m;
  while ((m = headRegex.exec(jsSource)) !== null) {
    const isExecHelper = m[0].startsWith("execAsServiceRole");
    let i = m.index + m[0].length;
    let depth = 1;
    const argsStart = i;
    while (i < jsSource.length && depth > 0) {
      const ch = jsSource[i];
      if (ch === "'" || ch === '"' || ch === "`") {
        i = skipQuoted(jsSource, i, ch);
        continue;
      }
      if (ch === "(") depth += 1;
      else if (ch === ")") depth -= 1;
      i += 1;
    }
    if (depth !== 0) continue;
    const args = splitTopLevelArgs(jsSource.slice(argsStart, i - 1));
    const sqlArg = isExecHelper ? args[1] : args[0];
    const paramsArg = isExecHelper ? args[2] : args[1];
    if (!sqlArg || !paramsArg || !paramsArg.startsWith("[") || !paramsArg.endsWith("]")) continue;

    const sql =
      (sqlArg.startsWith("`") && sqlArg.endsWith("`")) ||
      (sqlArg.startsWith('"') && sqlArg.endsWith('"')) ||
      (sqlArg.startsWith("'") && sqlArg.endsWith("'"))
        ? sqlArg.slice(1, -1)
        : sqlArg;
    const paramsInner = paramsArg.slice(1, -1).trim();
    const suppliedCount = paramsInner ? splitTopLevelArgs(paramsInner).length : 0;
    const withoutStrings = sql.replace(/'(?:''|[^'])*'/g, "''");
    const placeholderNums = [...withoutStrings.matchAll(/\$(\d+)\b/g)].map((x) => Number(x[1]));
    const uniqueSorted = [...new Set(placeholderNums)].sort((a, b) => a - b);
    const expectedCount = uniqueSorted.length > 0 ? uniqueSorted[uniqueSorted.length - 1] : 0;

    if (uniqueSorted.length !== expectedCount || suppliedCount !== expectedCount) {
      mismatches.push({ sql: sql.trim(), expectedCount, suppliedCount, placeholders: uniqueSorted });
    }
  }
  return mismatches;
}

test("Concurrency parameter-count detector catches legacy 9-placeholder / 10-param fulfill_resource_purchase mismatch", () => {
  const legacyBuggySnippet = `
    await execAsServiceRole(
      c,
      \`SELECT public.fulfill_resource_purchase($1::uuid, $2::uuid, $3::numeric, 'INR', $4, $5, $6, $7, $8, $9) AS res\`,
      ["u1", "r1", 588.82, "INR", "ord1", "pay1", "Name", "e@x.test", "9111111111", "Title"]
    );
  `;
  const hits = findSqlParamCountMismatches(legacyBuggySnippet);
  assert.strictEqual(hits.length, 1);
  assert.strictEqual(hits[0].expectedCount, 9);
  assert.strictEqual(hits[0].suppliedCount, 10);
});

test("Every parameterized SQL call in v4_3_postgres_concurrency_test.mjs matches $1..$N count and enforces runtime guard", () => {
  const mismatches = findSqlParamCountMismatches(CONCURRENCY_JS);
  assert.deepStrictEqual(
    mismatches,
    [],
    `SQL placeholder vs parameter array mismatch found: ${JSON.stringify(mismatches)}`
  );
  const resourceCalls = CONCURRENCY_JS.match(/public\.fulfill_resource_purchase\([^)]+\)/g) || [];
  assert.strictEqual(resourceCalls.length, 2, "Expected both C4 fulfill_resource_purchase calls");
  for (const call of resourceCalls) {
    assert.match(call, /\$10\)/, `Expected $1..$10 binding on fulfill_resource_purchase, got: ${call}`);
  }
  assert.match(CONCURRENCY_JS, /function assertParamBindingMatch\(/);
});

test("CI workflow uses Node.js 22 LTS compatible with @supabase/supabase-js >=22.0.0", () => {
  assert.match(WORKFLOW_YML, /node-version:\s*'22'/);
});

test("P0-3 PostgreSQL integration & multi-connection concurrency suites are wired into CI with strict safety guards", () => {
  assert.match(WORKFLOW_YML, /replay all 29 migrations chronologically/);
  assert.match(WORKFLOW_YML, /supabase\/tests\/p0_3_postgres_integration_test\.sql/);
  assert.match(WORKFLOW_YML, /node supabase\/tests\/p0_3_postgres_concurrency_test\.mjs/);

  const p03SelfCatchHits = findSelfCatchingExceptionBlocks(P03_INTEGRATION_SQL);
  assert.deepStrictEqual(p03SelfCatchHits, [], "P0-3 integration SQL must not contain self-catching exception blocks");
  assert.match(P03_INTEGRATION_SQL, /admin@digitalmuid\.com/);
  assert.match(P03_INTEGRATION_SQL, /%70rotected_downloads/);
  assert.match(P03_INTEGRATION_SQL, /Bounded LIMIT 50 prune/);

  assert.match(P03_CONCURRENCY_JS, /\["127\.0\.0\.1", "localhost", "::1"\]\.includes\(host\)/);
  assert.match(P03_CONCURRENCY_JS, /ver_num >= 170000[\s\S]*ver_num < 180000/);
  assert.match(P03_CONCURRENCY_JS, /pg_stat_activity/);
  assert.match(P03_CONCURRENCY_JS, /wait_event_type === "Lock"/);
  assert.match(P03_CONCURRENCY_JS, /function assertParamBindingMatch\(/);

  const p03ParamMismatches = findSqlParamCountMismatches(P03_CONCURRENCY_JS);
  assert.deepStrictEqual(
    p03ParamMismatches,
    [],
    `SQL placeholder vs parameter mismatch in p0_3_postgres_concurrency_test.mjs: ${JSON.stringify(p03ParamMismatches)}`
  );
});

console.log(`=== SUMMARY: ${passed} PASSED, ${process.exitCode ? 1 : 0} FAILED ===`);

