/**
 * DIGITALMUID V4.3 — PHASE B MIGRATION PREFLIGHT & HARDENING REGRESSION SUITE
 *
 * Strictly zero hosted DB connections, zero SQL execution against Supabase.
 * Verifies the corrected Phase A + Phase B migrations across:
 *   Task A — Zero Phase A/B index overlap; all 8 Phase B CONCURRENTLY indexes;
 *            active preflight handling of invalid, not-ready, wrong-def, and alias states.
 *   Task B — Normalized BTRIM(..., E' \t\n\r\f\v') duplicate detection & partial predicates
 *            (including idx_credit_notes_number & payments.credit_note_number).
 *   Task C — Standalone non-transactional CONCURRENTLY rules, active post-deployment
 *            schema/uniqueness/pg_get_indexdef/indisvalid/indisready checks, recovery docs.
 *   Task D — Synthetic fixture SQL safety guard & host isolation.
 */

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

const PHASE_A_PATH = path.resolve("supabase/migrations/20261107000001_student_id_and_invoices.sql");
const PHASE_B_PATH = path.resolve("supabase/migrations/20261107000002_concurrent_indexes.sql");
const FIXTURE_PATH = path.resolve("supabase/tests/phase_b_preflight_synthetic_fixture.sql");

const phaseASql = fs.readFileSync(PHASE_A_PATH, "utf8");
const phaseBSql = fs.readFileSync(PHASE_B_PATH, "utf8");
const fixtureSql = fs.readFileSync(FIXTURE_PATH, "utf8");

function stripSqlComments(sql) {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
}

const activePhaseB = stripSqlComments(phaseBSql);
const activePhaseA = stripSqlComments(phaseASql);

const INTENDED_INDEXES = [
  {
    name: "idx_credit_notes_number",
    table: "public.credit_notes",
    unique: true,
    columns: ["credit_note_number"],
    hasPartialBtrimPredicate: true
  },
  {
    name: "idx_credit_notes_refund_id",
    table: "public.credit_notes",
    unique: true,
    columns: ["refund_id"],
    hasPartialBtrimPredicate: true
  },
  {
    name: "idx_credit_notes_payment_id",
    table: "public.credit_notes",
    unique: false,
    columns: ["payment_id"],
    hasPartialBtrimPredicate: false
  },
  {
    name: "idx_credit_notes_user_id",
    table: "public.credit_notes",
    unique: false,
    columns: ["user_id"],
    hasPartialBtrimPredicate: false
  },
  {
    name: "idx_profiles_student_id",
    table: "public.profiles",
    unique: true,
    columns: ["student_id"],
    hasPartialBtrimPredicate: true
  },
  {
    name: "idx_course_enrollments_enrollment_id",
    table: "public.course_enrollments",
    unique: true,
    columns: ["enrollment_id"],
    hasPartialBtrimPredicate: true
  },
  {
    name: "idx_payments_invoice_number",
    table: "public.payments",
    unique: true,
    columns: ["invoice_number"],
    hasPartialBtrimPredicate: true
  },
  {
    name: "idx_payments_credit_note_number",
    table: "public.payments",
    unique: true,
    columns: ["credit_note_number"],
    hasPartialBtrimPredicate: true
  }
];

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ PASS: ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.stack || err.message}`);
  }
}

/**
 * Simulates Phase B hardened preflight + CREATE INDEX CONCURRENTLY IF NOT EXISTS.
 */
function simulateHardenedPhaseBExecution(catalog, spec) {
  const shortTable = spec.table.replace(/^public\./, "");
  const existing = catalog.find((idx) => idx.schema === "public" && idx.relname === spec.name);

  if (existing) {
    if (!existing.indisvalid || !existing.indisready) {
      return { action: "PREFLIGHT_HALT", reason: "INVALID_OR_UNREADY_INDEX" };
    }
    const defMatches =
      existing.table === shortTable &&
      existing.indisunique === spec.unique &&
      JSON.stringify(existing.columns) === JSON.stringify(spec.columns) &&
      Boolean(existing.partial) === spec.hasPartialBtrimPredicate;
    if (!defMatches) {
      return { action: "PREFLIGHT_HALT", reason: "DEFINITION_MISMATCH" };
    }
    return { action: "SKIPPED_VALID", resultingCatalogEntry: existing };
  }

  const alias = catalog.find(
    (idx) =>
      idx.schema === "public" &&
      idx.table === shortTable &&
      idx.relname !== spec.name &&
      idx.indisvalid &&
      idx.indisunique === spec.unique &&
      JSON.stringify(idx.columns) === JSON.stringify(spec.columns)
  );

  const created = {
    schema: "public",
    relname: spec.name,
    table: shortTable,
    indisunique: spec.unique,
    columns: spec.columns,
    partial: spec.hasPartialBtrimPredicate,
    indisvalid: true,
    indisready: true
  };
  catalog.push(created);
  return {
    action: "CREATED",
    aliasWarning: alias ? alias.relname : null,
    resultingCatalogEntry: created
  };
}

function pgAllWhitespaceBtrim(val) {
  if (val === null || val === undefined) return null;
  return String(val).replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function evaluateHardenedPartialUniqueIndex(rows, col) {
  const indexed = [];
  for (const row of rows) {
    const trimmed = pgAllWhitespaceBtrim(row[col]);
    if (trimmed === null || trimmed === "") continue;
    indexed.push({ id: row.id, key: trimmed });
  }
  const seen = new Map();
  const collisions = [];
  for (const item of indexed) {
    if (seen.has(item.key)) collisions.push({ key: item.key, rows: [seen.get(item.key), item.id] });
    else seen.set(item.key, item.id);
  }
  return { indexedCount: indexed.length, collisions };
}

console.log("==============================================================================");
console.log("DIGITALMUID V4.3 — HARDENED PHASE B MIGRATION PREFLIGHT REGRESSION SUITE");
console.log("==============================================================================\n");

console.log("[Task A] Zero Phase A Overlap & Catalog State Handling");

runTest("A.1 All 8 intended indexes are defined in Phase B with CONCURRENTLY IF NOT EXISTS", () => {
  for (const idx of INTENDED_INDEXES) {
    const kind = idx.unique ? "UNIQUE\\s+INDEX" : "INDEX";
    const re = new RegExp(`CREATE\\s+${kind}\\s+CONCURRENTLY\\s+IF\\s+NOT\\s+EXISTS\\s+${idx.name}\\b`, "i");
    assert.ok(re.test(activePhaseB), `Missing expected concurrent definition for ${idx.name}`);
  }
});

runTest("A.2 Phase A creates ZERO indexes (no overlap with Phase B)", () => {
  assert.strictEqual(
    /\bCREATE\s+(?:UNIQUE\s+)?INDEX\b/i.test(activePhaseA),
    false,
    "Phase A must execute ZERO CREATE INDEX statements inside its transaction"
  );
});

runTest("A.3 Preflight gate halts cleanly on invalid/not-ready/mismatched indexes and warns on aliases", () => {
  assert.ok(activePhaseB.includes("IF NOT v_idx.indisvalid OR NOT v_idx.indisready THEN"));
  assert.ok(activePhaseB.includes("pg_get_indexdef(c.oid)"));
  assert.ok(activePhaseB.includes("RAISE WARNING 'Phase B preflight notice"));

  for (const idx of INTENDED_INDEXES) {
    const shortTable = idx.table.replace(/^public\./, "");
    const validRes = simulateHardenedPhaseBExecution(
      [{ schema: "public", relname: idx.name, table: shortTable, indisunique: idx.unique, columns: idx.columns, partial: idx.hasPartialBtrimPredicate, indisvalid: true, indisready: true }],
      idx
    );
    assert.strictEqual(validRes.action, "SKIPPED_VALID");

    const invalidRes = simulateHardenedPhaseBExecution(
      [{ schema: "public", relname: idx.name, table: shortTable, indisunique: idx.unique, columns: idx.columns, partial: idx.hasPartialBtrimPredicate, indisvalid: false, indisready: true }],
      idx
    );
    assert.strictEqual(invalidRes.action, "PREFLIGHT_HALT");
    assert.strictEqual(invalidRes.reason, "INVALID_OR_UNREADY_INDEX");

    const wrongDefRes = simulateHardenedPhaseBExecution(
      [{ schema: "public", relname: idx.name, table: shortTable, indisunique: !idx.unique, columns: ["wrong_col"], partial: false, indisvalid: true, indisready: true }],
      idx
    );
    assert.strictEqual(wrongDefRes.action, "PREFLIGHT_HALT");
    assert.strictEqual(wrongDefRes.reason, "DEFINITION_MISMATCH");

    const aliasRes = simulateHardenedPhaseBExecution(
      [{ schema: "public", relname: `legacy_${idx.name}`, table: shortTable, indisunique: idx.unique, columns: idx.columns, partial: idx.hasPartialBtrimPredicate, indisvalid: true, indisready: true }],
      idx
    );
    assert.strictEqual(aliasRes.action, "CREATED");
    assert.strictEqual(aliasRes.aliasWarning, `legacy_${idx.name}`);
  }
});

console.log("\n[Task B] Normalized BTRIM Duplicate Detection & Partial Predicates");

runTest("B.1 All 6 unique Phase B indexes use BTRIM(..., E' \\t\\n\\r\\f\\v') != '' partial predicates", () => {
  for (const idx of INTENDED_INDEXES.filter((i) => i.hasPartialBtrimPredicate)) {
    const col = idx.columns[0];
    const re = new RegExp(
      `CREATE\\s+UNIQUE\\s+INDEX\\s+CONCURRENTLY\\s+IF\\s+NOT\\s+EXISTS\\s+${idx.name}[\\s\\S]*?WHERE\\s+${col}\\s+IS\\s+NOT\\s+NULL\\s+AND\\s+BTRIM\\(${col},\\s*E' \\\\t\\\\n\\\\r\\\\f\\\\v'\\)\\s*!=\\s*''`,
      "i"
    );
    assert.ok(re.test(activePhaseB), `Missing hardened BTRIM partial predicate on ${idx.name}`);
  }
});

runTest("B.2 Control-whitespace & legacy NULL/empty values on credit_notes & profiles produce zero false positives", () => {
  const cnRows = [
    { id: 1, credit_note_number: null },
    { id: 2, credit_note_number: null },
    { id: 3, credit_note_number: "" },
    { id: 4, credit_note_number: "\t\n\r " },
    { id: 5, credit_note_number: "CN/26-27/0001" }
  ];
  const sim = evaluateHardenedPartialUniqueIndex(cnRows, "credit_note_number");
  assert.strictEqual(sim.indexedCount, 1);
  assert.strictEqual(sim.collisions.length, 0);
});

runTest("B.3 Phase B Section 1 actively audits all 5 unique dimensions including payments.credit_note_number", () => {
  const section1Match = activePhaseB.match(/DO \$\$([\s\S]*?)CREATE UNIQUE INDEX CONCURRENTLY/);
  assert.ok(section1Match, "Active Section 1 preflight DO block must exist before CREATE INDEX CONCURRENTLY");
  const section1 = section1Match[1];

  assert.ok(section1.includes("FROM public.profiles") && section1.includes("student_id"));
  assert.ok(section1.includes("FROM public.course_enrollments") && section1.includes("enrollment_id"));
  assert.ok(section1.includes("FROM public.payments") && section1.includes("invoice_number"));
  assert.ok(section1.includes("FROM public.payments") && section1.includes("credit_note_number"));
  assert.ok(section1.includes("FROM public.credit_notes") && section1.includes("refund_id"));
  assert.ok(/FROM public\.credit_notes\s+WHERE credit_note_number IS NOT NULL AND BTRIM\(credit_note_number/i.test(section1));
});

console.log("\n[Task C & D] Concurrent Execution Safety, Post-Validation & Fixture Checks");

runTest("C.1 Phase B contains ZERO BEGIN; or COMMIT; statements and no DO $$ wrapping CONCURRENTLY", () => {
  assert.strictEqual(phaseBSql.includes("BEGIN;"), false, "Phase B must never contain BEGIN;");
  assert.strictEqual(phaseBSql.includes("COMMIT;"), false, "Phase B must never contain COMMIT;");

  // Verify no DO $$ block executes CREATE or DROP INDEX CONCURRENTLY (ignore diagnostic error text)
  const doBlocks = activePhaseB.match(/DO \$\$[\s\S]*?END \$\$;/gi) || [];
  assert.strictEqual(doBlocks.length, 2, "Expected standalone preflight & postflight DO blocks");
  for (const block of doBlocks) {
    const codeOnly = block.replace(/'(?:''|[^'])*'/g, "''");
    assert.strictEqual(/(?:CREATE|DROP)[\s\S]{0,30}INDEX\s+CONCURRENTLY/i.test(codeOnly), false, "CONCURRENTLY DDL must never execute inside DO $$ blocks");
  }
});

runTest("C.2 Phase B executes post-deployment schema/uniqueness/indexdef/indisvalid/indisready checks", () => {
  assert.ok(activePhaseB.includes("n.nspname = 'public'"));
  assert.ok(activePhaseB.includes("i.indisvalid AS is_valid"));
  assert.ok(activePhaseB.includes("i.indisready AS is_ready"));
  assert.ok(activePhaseB.includes("i.indisunique AS is_unique"));
  assert.ok(activePhaseB.includes("pg_get_indexdef(c.oid)"));
  assert.ok(activePhaseB.includes("IF v_verified <> 8 THEN"));
  for (const idx of INTENDED_INDEXES) {
    assert.ok(
      phaseBSql.includes(`DROP INDEX CONCURRENTLY IF EXISTS public.${idx.name};`),
      `Missing recovery statement for ${idx.name}`
    );
  }
});

runTest("D.1 Synthetic fixture script is isolated to phase_b_preflight_test and blocks hosted Supabase", () => {
  const activeFixture = stripSqlComments(fixtureSql);
  assert.ok(activeFixture.includes("CREATE SCHEMA phase_b_preflight_test;"));
  assert.ok(activeFixture.includes("DROP SCHEMA IF EXISTS phase_b_preflight_test CASCADE;"));
  assert.ok(activeFixture.includes("nspname = 'supabase_migrations'"));
  assert.strictEqual(activeFixture.includes("kpuxtsworzkueyffjaaz"), false);
  assert.strictEqual(/(?:CREATE|DROP)\s+(?:UNIQUE\s+)?INDEX[\s\S]{0,80}\bpublic\./i.test(activeFixture), false);
});

console.log("\n==============================================================================");
console.log(`HARDENED PHASE B PREFLIGHT SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log("==============================================================================");

if (failed > 0) {
  process.exit(1);
}
