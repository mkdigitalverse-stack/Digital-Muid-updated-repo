/**
 * DIGITALMUID V4.3 — PHASE B MIGRATION PREFLIGHT STATIC TEST HARNESS
 *
 * Strictly zero hosted DB connections, zero SQL DDL/DML mutations,
 * and zero modifications to migrations or source code.
 *
 * Verifies:
 *   Task A — All 8 Phase B index definitions, Phase A overlaps, and PostgreSQL
 *            CREATE INDEX CONCURRENTLY IF NOT EXISTS catalog behavior across
 *            valid, invalid, mismatched-definition, and alias-index states.
 *   Task B — Duplicate detection edge cases (NULL, '', ASCII spaces, tabs/newlines,
 *            leading/trailing whitespace, case sensitivity, payments.credit_note_number).
 *   Task C — Interrupted concurrent build recovery, transaction restrictions,
 *            cleanup prerequisites, and validation query coverage.
 *   Task D — Synthetic fixture SQL integrity & safety guard checks.
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
    hasPartialTrimPredicate: false,
    createdInPhaseA: false
  },
  {
    name: "idx_credit_notes_refund_id",
    table: "public.credit_notes",
    unique: true,
    columns: ["refund_id"],
    hasPartialTrimPredicate: true,
    createdInPhaseA: false
  },
  {
    name: "idx_credit_notes_payment_id",
    table: "public.credit_notes",
    unique: false,
    columns: ["payment_id"],
    hasPartialTrimPredicate: false,
    createdInPhaseA: true
  },
  {
    name: "idx_credit_notes_user_id",
    table: "public.credit_notes",
    unique: false,
    columns: ["user_id"],
    hasPartialTrimPredicate: false,
    createdInPhaseA: true
  },
  {
    name: "idx_profiles_student_id",
    table: "public.profiles",
    unique: true,
    columns: ["student_id"],
    hasPartialTrimPredicate: true,
    createdInPhaseA: false
  },
  {
    name: "idx_course_enrollments_enrollment_id",
    table: "public.course_enrollments",
    unique: true,
    columns: ["enrollment_id"],
    hasPartialTrimPredicate: true,
    createdInPhaseA: false
  },
  {
    name: "idx_payments_invoice_number",
    table: "public.payments",
    unique: true,
    columns: ["invoice_number"],
    hasPartialTrimPredicate: true,
    createdInPhaseA: false
  },
  {
    name: "idx_payments_credit_note_number",
    table: "public.payments",
    unique: true,
    columns: ["credit_note_number"],
    hasPartialTrimPredicate: true,
    createdInPhaseA: false
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
 * Simulates PostgreSQL CREATE [UNIQUE] INDEX CONCURRENTLY IF NOT EXISTS
 * metadata semantics against an in-memory catalog snapshot.
 */
function simulatePostgresCreateIndexConcurrently(catalog, spec) {
  const existingByName = catalog.find(
    (idx) => idx.schema === "public" && idx.relname === spec.name
  );

  // PostgreSQL IF NOT EXISTS checks ONLY pg_class.(relnamespace, relname),
  // NOT indisvalid, NOT indisunique, NOT columns/predicate!
  if (existingByName) {
    return {
      action: "SKIPPED_NOTICE",
      reason: `relation "${spec.name}" already exists`,
      resultingCatalogEntry: existingByName
    };
  }

  const created = {
    schema: "public",
    relname: spec.name,
    table: spec.table,
    indisunique: spec.unique,
    columns: spec.columns,
    predicate: spec.hasPartialTrimPredicate ? "IS NOT NULL AND TRIM != ''" : null,
    indisvalid: true,
    indisready: true
  };
  catalog.push(created);
  return {
    action: "CREATED",
    resultingCatalogEntry: created
  };
}

/**
 * Simulates PostgreSQL TRIM(x) (ASCII space 0x20 only) vs hardened BTRIM(x, E' \t\n\r\f\v').
 */
function pgAsciiTrim(val) {
  if (val === null || val === undefined) return null;
  return String(val).replace(/^ +| +$/g, "");
}

function pgAllWhitespaceTrim(val) {
  if (val === null || val === undefined) return null;
  return String(val).replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function evaluatePhaseBUniqueIndexInclusion(rows, col, { partialTrim = true, rawKey = true } = {}) {
  const indexed = [];
  for (const row of rows) {
    const v = row[col];
    if (partialTrim) {
      if (v === null || v === undefined || pgAsciiTrim(v) === "") {
        continue; // Excluded by WHERE col IS NOT NULL AND TRIM(col) != ''
      }
    } else {
      // Full unique index (idx_credit_notes_number): NULLs are distinct in PG,
      // but empty/whitespace strings ARE indexed!
      if (v === null || v === undefined) continue;
    }
    indexed.push({ id: row.id, key: rawKey ? v : pgAllWhitespaceTrim(v) });
  }

  const seen = new Map();
  const collisions = [];
  for (const item of indexed) {
    if (seen.has(item.key)) {
      collisions.push({ key: item.key, rows: [seen.get(item.key), item.id] });
    } else {
      seen.set(item.key, item.id);
    }
  }
  return { indexedCount: indexed.length, collisions };
}

console.log("==============================================================================");
console.log("DIGITALMUID V4.3 — PHASE B MIGRATION PREFLIGHT STATIC TEST HARNESS");
console.log("(Static Analysis & Synthetic PostgreSQL Behavior Simulation — Zero DB Calls)");
console.log("==============================================================================\n");

// ------------------------------------------------------------------------------
// TASK A: EXISTING INDEX INSPECTION
// ------------------------------------------------------------------------------
console.log("[Task A] Existing Index Inspection & Catalog State Semantics");

runTest("A.1 All 8 intended indexes are defined in Phase B with CONCURRENTLY IF NOT EXISTS", () => {
  for (const idx of INTENDED_INDEXES) {
    const kind = idx.unique ? "UNIQUE\\s+INDEX" : "INDEX";
    const re = new RegExp(`CREATE\\s+${kind}\\s+CONCURRENTLY\\s+IF\\s+NOT\\s+EXISTS\\s+${idx.name}\\b`, "i");
    assert.ok(re.test(activePhaseB), `Missing expected concurrent definition for ${idx.name}`);
  }
});

runTest("A.2 Phase A already creates idx_credit_notes_payment_id & idx_credit_notes_user_id non-concurrently", () => {
  for (const idx of INTENDED_INDEXES) {
    const re = new RegExp(`CREATE\\s+(?:UNIQUE\\s+)?INDEX\\s+IF\\s+NOT\\s+EXISTS\\s+${idx.name}\\b`, "i");
    assert.strictEqual(
      re.test(activePhaseA),
      idx.createdInPhaseA,
      `Phase A presence mismatch for ${idx.name}`
    );
  }
});

runTest("A.3 Simulation: Existing valid, existing invalid, wrong-def, and alias index behaviors", () => {
  for (const idx of INTENDED_INDEXES) {
    // 1. Existing valid index -> skipped safely
    const validRes = simulatePostgresCreateIndexConcurrently(
      [{ schema: "public", relname: idx.name, table: idx.table, indisunique: idx.unique, columns: idx.columns, indisvalid: true, indisready: true }],
      idx
    );
    assert.strictEqual(validRes.action, "SKIPPED_NOTICE");
    assert.strictEqual(validRes.resultingCatalogEntry.indisvalid, true);

    // 2. Existing INVALID index -> IF NOT EXISTS skips silently and leaves indisvalid=false!
    const invalidRes = simulatePostgresCreateIndexConcurrently(
      [{ schema: "public", relname: idx.name, table: idx.table, indisunique: idx.unique, columns: idx.columns, indisvalid: false, indisready: true }],
      idx
    );
    assert.strictEqual(invalidRes.action, "SKIPPED_NOTICE");
    assert.strictEqual(invalidRes.resultingCatalogEntry.indisvalid, false);

    // 3. Correct name, incorrect definition (e.g. non-unique instead of unique or wrong column) -> IF NOT EXISTS skips!
    const wrongDefRes = simulatePostgresCreateIndexConcurrently(
      [{ schema: "public", relname: idx.name, table: idx.table, indisunique: !idx.unique, columns: ["wrong_col"], indisvalid: true, indisready: true }],
      idx
    );
    assert.strictEqual(wrongDefRes.action, "SKIPPED_NOTICE");
    assert.deepStrictEqual(wrongDefRes.resultingCatalogEntry.columns, ["wrong_col"]);

    // 4. Different name, equivalent definition -> creates redundant duplicate index!
    const aliasCatalog = [
      { schema: "public", relname: `legacy_alias_${idx.name}`, table: idx.table, indisunique: idx.unique, columns: idx.columns, indisvalid: true, indisready: true }
    ];
    const aliasRes = simulatePostgresCreateIndexConcurrently(aliasCatalog, idx);
    assert.strictEqual(aliasRes.action, "CREATED");
    assert.strictEqual(aliasCatalog.length, 2);
  }
});

// ------------------------------------------------------------------------------
// TASK B: DUPLICATE DETECTION & WHITESPACE EDGE CASES
// ------------------------------------------------------------------------------
console.log("\n[Task B] Duplicate Detection & Whitespace Normalization Edge Cases");

runTest("B.1 Partial unique indexes exclude NULL, '', and ASCII spaces, but fail on duplicate control chars (\\t/\\n)", () => {
  const rows = [
    { id: 1, student_id: null },
    { id: 2, student_id: null },
    { id: 3, student_id: "" },
    { id: 4, student_id: "" },
    { id: 5, student_id: "   " },
    { id: 6, student_id: "   " },
    { id: 7, student_id: "\t\n" },
    { id: 8, student_id: "\t\n" }
  ];

  const sim = evaluatePhaseBUniqueIndexInclusion(rows, "student_id", { partialTrim: true, rawKey: true });
  // NULL, '', '   ' are excluded (6 rows ignored); '\t\n' passes TRIM() != '' and collides!
  assert.strictEqual(sim.indexedCount, 2);
  assert.strictEqual(sim.collisions.length, 1);
  assert.strictEqual(sim.collisions[0].key, "\t\n");
});

runTest("B.2 Untrimmed index key allows duplicate normalized values ('DM-STU-010001' vs ' DM-STU-010001 ')", () => {
  const rows = [
    { id: 1, student_id: "DM-STU-010001" },
    { id: 2, student_id: " DM-STU-010001 " }
  ];

  // Current Phase B raw column key sees NO collision
  const rawSim = evaluatePhaseBUniqueIndexInclusion(rows, "student_id", { partialTrim: true, rawKey: true });
  assert.strictEqual(rawSim.collisions.length, 0);

  // Normalized key reveals the hidden logical duplicate
  const normSim = evaluatePhaseBUniqueIndexInclusion(rows, "student_id", { partialTrim: true, rawKey: false });
  assert.strictEqual(normSim.collisions.length, 1);
  assert.strictEqual(normSim.collisions[0].key, "DM-STU-010001");
});

runTest("B.3 idx_credit_notes_number has NO WHERE clause: empty/whitespace strings collide & NULL audit query false-positives", () => {
  assert.ok(
    /CREATE\s+UNIQUE\s+INDEX\s+CONCURRENTLY\s+IF\s+NOT\s+EXISTS\s+idx_credit_notes_number\s+ON\s+public\.credit_notes\s*\(credit_note_number\)\s*;/i.test(activePhaseB),
    "Expected idx_credit_notes_number to have no WHERE clause in unmodified Phase B"
  );

  // Empty strings in two legacy rows collide under full unique index
  const rows = [
    { id: 1, credit_note_number: null },
    { id: 2, credit_note_number: null },
    { id: 3, credit_note_number: "" },
    { id: 4, credit_note_number: "" }
  ];
  const sim = evaluatePhaseBUniqueIndexInclusion(rows, "credit_note_number", { partialTrim: false, rawKey: true });
  assert.strictEqual(sim.collisions.length, 1);
  assert.strictEqual(sim.collisions[0].key, "");

  // Also confirm Phase B's commented credit_note_number audit query lacks a WHERE IS NOT NULL filter
  assert.ok(
    /-- SELECT credit_note_number, COUNT\(\*\) AS duplicate_count\s*\n-- FROM public\.credit_notes\s*\n-- GROUP BY credit_note_number/i.test(phaseBSql),
    "Expected Phase B audit query for credit_note_number to lack WHERE IS NOT NULL filter"
  );
});

runTest("B.4 Phase B Section 1 omits pre-index duplicate audit query for public.payments.credit_note_number", () => {
  const section1Match = phaseBSql.match(/-- 1\. PRE-INDEX DUPLICATE DETECTION AUDIT([\s\S]*?)-- 2\. CONCURRENT UNIQUE INDEX CREATION/);
  assert.ok(section1Match, "Section 1 header must exist");
  const section1 = section1Match[1];

  assert.ok(section1.includes("FROM public.profiles"), "Audits profiles.student_id");
  assert.ok(section1.includes("FROM public.course_enrollments"), "Audits course_enrollments.enrollment_id");
  assert.ok(section1.includes("FROM public.payments") && section1.includes("invoice_number"), "Audits payments.invoice_number");
  assert.ok(section1.includes("FROM public.credit_notes") && section1.includes("refund_id"), "Audits credit_notes.refund_id");

  // Confirm payments.credit_note_number audit is missing in Section 1
  const auditsPaymentsCreditNote = /FROM\s+public\.payments[\s\S]{0,120}credit_note_number/i.test(section1);
  assert.strictEqual(auditsPaymentsCreditNote, false, "Gap confirmed: Section 1 omits payments.credit_note_number duplicate check");
});

runTest("B.5 Phase A Section 7 deduplicates student_id & enrollment_id but NOT invoice_number/credit_note_number/refund_id", () => {
  assert.ok(activePhaseA.includes("UPDATE public.profiles SET student_id = public.generate_student_id()"));
  assert.ok(activePhaseA.includes("UPDATE public.course_enrollments SET enrollment_id = public.generate_enrollment_id()"));
  assert.strictEqual(activePhaseA.includes("SELECT invoice_number, COUNT(*)"), false);
  assert.strictEqual(activePhaseA.includes("SELECT refund_id, COUNT(*)"), false);
});

// ------------------------------------------------------------------------------
// TASK C & D: TRANSACTION RESTRICTIONS, RECOVERY & FIXTURE VALIDATION
// ------------------------------------------------------------------------------
console.log("\n[Task C & D] Concurrent Recovery, Transaction Rules & Synthetic Fixture Integrity");

runTest("C.1 Phase B has no BEGIN/COMMIT or DO $$ transaction wrappers around CONCURRENTLY statements", () => {
  assert.strictEqual(/\bBEGIN\s*;/i.test(activePhaseB), false, "Phase B must not execute BEGIN;");
  assert.strictEqual(/\bCOMMIT\s*;/i.test(activePhaseB), false, "Phase B must not execute COMMIT;");
  assert.strictEqual(/\bDO\s+\$\$/i.test(activePhaseB), false, "Phase B must not wrap CONCURRENTLY in DO $$ blocks");
});

runTest("C.2 Phase B documents invalid index detection (indisvalid & indisready) and DROP INDEX CONCURRENTLY for all 8 indexes", () => {
  assert.ok(phaseBSql.includes("i.indisvalid = false OR i.indisready = false"));
  for (const idx of INTENDED_INDEXES) {
    assert.ok(
      phaseBSql.includes(`DROP INDEX CONCURRENTLY IF EXISTS public.${idx.name};`),
      `Missing recovery statement for ${idx.name}`
    );
  }
  // Confirm Sections 1, 3, and 4 are currently commented-out manual steps
  assert.strictEqual(/^\s*SELECT\s+/im.test(activePhaseB), false, "Active SQL contains no executable SELECT validation gates");
  assert.strictEqual(/^\s*DROP\s+INDEX/im.test(activePhaseB), false, "Active SQL contains no automatic invalid-index cleanup");
});

runTest("D.1 Synthetic PostgreSQL fixture script is isolated to phase_b_preflight_test and blocks hosted Supabase", () => {
  const activeFixture = stripSqlComments(fixtureSql);
  assert.ok(activeFixture.includes("CREATE SCHEMA phase_b_preflight_test;"));
  assert.ok(activeFixture.includes("DROP SCHEMA IF EXISTS phase_b_preflight_test CASCADE;"));
  assert.ok(activeFixture.includes("nspname = 'supabase_migrations'"), "Fixture must fail-closed if run on hosted Supabase");
  assert.strictEqual(activeFixture.includes("kpuxtsworzkueyffjaaz"), false, "Fixture must never target production project ID");
  assert.strictEqual(/(?:CREATE|DROP)\s+(?:UNIQUE\s+)?INDEX[\s\S]{0,80}\bpublic\./i.test(activeFixture), false, "Fixture must never run index DDL on public schema");
  for (const idx of INTENDED_INDEXES) {
    assert.ok(fixtureSql.includes(idx.name), `Fixture must exercise ${idx.name}`);
  }
});

console.log("\n==============================================================================");
console.log(`PHASE B PREFLIGHT STATIC HARNESS SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log("==============================================================================");

if (failed > 0) {
  process.exit(1);
}
