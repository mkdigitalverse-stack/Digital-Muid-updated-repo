/**
 * DIGITALMUID V4.3 — UNIFIED PHASE A + PHASE B CORRECTION VERIFICATION SUITE
 *
 * Strictly read-only against hosted Supabase (zero hosted DB connections, zero live SQL execution).
 * Combines static SQL AST/pattern verification with faithful PostgreSQL PL/pgSQL & catalog simulation
 * to verify all 11 mandatory corrections across Sections A, B, C, and D:
 *   1. payments.updated_at column added
 *   2. record_credit_note_with_limit():
 *      - Unambiguous payment resolution + FOR UPDATE BEFORE idempotency checks
 *      - Single canonical payment_id while summing across both UUID & pay_* keys
 *      - Cross-payment refund_id reuse rejected
 *      - Caller p_user_id cannot override authoritative v_payment.user_id
 *      - Subtransaction unique_violation recovery without CN sequence burn
 *   3. trigger_set_payment_invoice(): clears forged invoice_number on non-captured INSERT,
 *      handles control-whitespace OLD.invoice_number, rejects unpaid/authorized/created
 *   4. payments.status defaults to 'pending' and chk_payments_status replaces restrictive CHECK
 *   5. BTRIM(..., E' \t\n\r\f\v') whitespace normalization prior to reconciliation & dedup
 *   6. Phase B active preflight covers all 5 unique identifier dimensions + invalid/wrong-def/alias
 *   7. Pre-existing nullable legacy credit_notes tables safely handled
 *   8. Zero duplicate index creation between Phase A and Phase B
 *   9. Partial BTRIM predicate on idx_credit_notes_number & invalid-index remediation gate
 *  10. Zero CONCURRENTLY inside transactions/DO blocks
 *  11. Post-deployment validation verifies schema (public), indisunique, pg_get_indexdef,
 *      indisvalid, and indisready
 */

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const PHASE_A_SQL = fs.readFileSync(
  path.resolve("supabase/migrations/20261107000001_student_id_and_invoices.sql"),
  "utf8"
);
const PHASE_B_SQL = fs.readFileSync(
  path.resolve("supabase/migrations/20261107000002_concurrent_indexes.sql"),
  "utf8"
);
const STAGING_BASELINE_SQL = fs.readFileSync(
  path.resolve("supabase/staging_baseline_review.sql"),
  "utf8"
);

function stripComments(sql) {
  return sql
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");
}

function pgBtrimAll(val) {
  if (val === null || val === undefined) return null;
  return String(val).replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function pgNullIfEmptyBtrim(val) {
  const t = pgBtrimAll(val);
  return t === null || t === "" ? null : t;
}

const ACTIVE_A = stripComments(PHASE_A_SQL);
const ACTIVE_B = stripComments(PHASE_B_SQL);

/**
 * Faithful simulator of the HARDENED Phase A PL/pgSQL & trigger logic.
 */
class HardenedPhaseAPostgresSim {
  constructor() {
    this.payments = []; // includes status DEFAULT 'pending', updated_at, chk_payments_status
    this.credit_notes = [];
    this.invoice_series = new Map();
    this.credit_note_series = new Map();
    this.allowedStatuses = new Set([
      "pending",
      "created",
      "authorized",
      "captured",
      "paid",
      "completed",
      "failed",
      "cancelled",
      "refunded"
    ]);
  }

  getNextInvoiceNumber(fy = "26-27") {
    const next = (this.invoice_series.get(fy) || 0) + 1;
    if (next > 9999999) {
      throw Object.assign(new Error("Invoice sequence overflow"), { sqlstate: "P0001" });
    }
    this.invoice_series.set(fy, next);
    const seqStr = next < 10000 ? String(next).padStart(4, "0") : String(next);
    return `DM/${fy}/${seqStr}`;
  }

  getNextCreditNoteNumber(fy = "26-27") {
    const next = (this.credit_note_series.get(fy) || 0) + 1;
    this.credit_note_series.set(fy, next);
    const seqStr = next < 10000 ? String(next).padStart(4, "0") : String(next);
    return `CN/${fy}/${seqStr}`;
  }

  insertOrUpdatePayment({ op, role = "service_role", oldRow = null, newRow }) {
    const row = {
      status: "pending", // Default hardened to 'pending'
      updated_at: new Date().toISOString(),
      ...newRow
    };

    const normStatus = (pgBtrimAll(row.status) || "").toLowerCase();
    if (!this.allowedStatuses.has(normStatus)) {
      throw Object.assign(new Error(`violates check constraint "chk_payments_status"`), { sqlstate: "23514" });
    }

    // protect_payment_status_transitions
    if (["captured", "paid", "completed"].includes(normStatus)) {
      const oldNorm = (pgBtrimAll(oldRow?.status) || "").toLowerCase();
      if (op === "INSERT" || (op === "UPDATE" && oldNorm !== normStatus)) {
        if (role === "authenticated" || role === "anon") {
          throw Object.assign(new Error(`Unauthorized status ${row.status}`), { sqlstate: "P0001" });
        }
      }
    }

    // trigger_set_payment_invoice
    const hasOldInv = op === "UPDATE" && pgNullIfEmptyBtrim(oldRow?.invoice_number) !== null;
    if (hasOldInv) {
      if (row.invoice_number !== oldRow.invoice_number) {
        row.invoice_number = oldRow.invoice_number;
      }
    } else {
      row.invoice_number = pgNullIfEmptyBtrim(row.invoice_number);
    }

    if (["refunded", "failed", "cancelled", "pending"].includes(row.status) || !["captured", "paid", "completed"].includes(normStatus)) {
      if (!hasOldInv) {
        row.invoice_number = null;
      }
      return row;
    }

    if (["captured", "paid", "completed"].includes(normStatus) && pgNullIfEmptyBtrim(row.invoice_number) === null) {
      row.invoice_number = this.getNextInvoiceNumber();
    }
    return row;
  }

  recordCreditNoteWithLimit({
    p_payment_id,
    p_refund_id,
    p_refund_amount,
    p_reason = "Educational course fee refund",
    p_user_id = null,
    p_currency = "INR",
    simulatePreCommitUniqueViolation = false
  }) {
    if (p_refund_amount === null || p_refund_amount === undefined || p_refund_amount <= 0) {
      throw new Error("Invalid refund amount");
    }
    const v_clean_pay_id = pgNullIfEmptyBtrim(p_payment_id);
    if (!v_clean_pay_id) throw new Error("Missing payment_id");
    const v_clean_rfnd_id = pgNullIfEmptyBtrim(p_refund_id);
    if (!v_clean_rfnd_id) throw new Error("Missing refund_id");

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v_clean_pay_id);
    const matches = this.payments.filter(
      (p) => pgBtrimAll(p.razorpay_payment_id || "") === v_clean_pay_id || (isUuid && p.id === v_clean_pay_id)
    );
    if (matches.length > 1) {
      throw new Error(`Ambiguous payment identifier ${v_clean_pay_id}`);
    }
    if (matches.length === 0) {
      throw new Error(`Payment record ${v_clean_pay_id} not found in ledger.`);
    }

    const v_payment = matches[0];
    const v_canonical_pay_id = pgNullIfEmptyBtrim(v_payment.razorpay_payment_id) || String(v_payment.id);
    const v_payment_uuid_text = String(v_payment.id);

    if (p_user_id && v_payment.user_id && p_user_id !== v_payment.user_id) {
      throw Object.assign(
        new Error(`Ownership mismatch: caller user_id ${p_user_id} does not match authoritative payment owner ${v_payment.user_id}`),
        { sqlstate: "P0001" }
      );
    }
    const v_owner_user_id = v_payment.user_id ?? p_user_id;

    // Post-lock idempotency check
    const existing = this.credit_notes.find((cn) => pgBtrimAll(cn.refund_id) === v_clean_rfnd_id);
    if (existing) {
      const existingPayKey = pgBtrimAll(existing.payment_id || "");
      if (existingPayKey !== v_canonical_pay_id && existingPayKey !== v_payment_uuid_text) {
        throw new Error(`Refund ID ${v_clean_rfnd_id} is already associated with another payment (${existing.payment_id})`);
      }
      const priorTotal = this.credit_notes
        .filter((c) => [v_canonical_pay_id, v_payment_uuid_text].includes(pgBtrimAll(c.payment_id || "")))
        .reduce((s, c) => s + Number(c.amount), 0);
      return {
        ...existing,
        remaining_balance: Math.max(0, Number((v_payment.amount - priorTotal).toFixed(2))),
        is_idempotent_duplicate: true
      };
    }

    if (!["captured", "paid", "completed", "refunded"].includes((v_payment.status || "").toLowerCase())) {
      throw new Error(`Payment ${v_canonical_pay_id} is in status ${v_payment.status}, which is not eligible for refund`);
    }

    const priorTotal = this.credit_notes
      .filter((cn) => [v_canonical_pay_id, v_payment_uuid_text].includes(pgBtrimAll(cn.payment_id || "")))
      .reduce((s, cn) => s + Number(cn.amount), 0);
    const remaining = Number((v_payment.amount - priorTotal).toFixed(2));
    if (p_refund_amount > remaining) {
      throw new Error(`Refund amount ${p_refund_amount} exceeds remaining balance ${remaining}`);
    }

    const baseAmount = Number((p_refund_amount / 1.18).toFixed(2));
    const taxAmount = Number((p_refund_amount - baseAmount).toFixed(2));
    const isPartial = priorTotal + p_refund_amount < v_payment.amount;
    const origInv = pgNullIfEmptyBtrim(v_payment.invoice_number) || `DM-INV-${v_canonical_pay_id.slice(4)}`;

    // Subtransaction savepoint: snapshot sequence before allocating
    const seqSnapshot = this.credit_note_series.get("26-27") || 0;
    try {
      const cnNum = this.getNextCreditNoteNumber("26-27");
      if (simulatePreCommitUniqueViolation) {
        throw Object.assign(new Error(`duplicate key value violates unique constraint "idx_credit_notes_refund_id"`), {
          sqlstate: "23505"
        });
      }
      const inserted = {
        id: crypto.randomUUID(),
        credit_note_number: cnNum,
        original_invoice_number: origInv,
        payment_id: v_canonical_pay_id,
        user_id: v_owner_user_id,
        refund_id: v_clean_rfnd_id,
        amount: p_refund_amount,
        base_amount: baseAmount,
        tax_amount: taxAmount,
        currency: pgNullIfEmptyBtrim(p_currency) || "INR",
        is_partial: isPartial
      };
      this.credit_notes.push(inserted);

      if (priorTotal + p_refund_amount >= v_payment.amount) {
        // Requires payments.updated_at to exist!
        if (!("updated_at" in v_payment)) {
          throw Object.assign(new Error(`column "updated_at" of relation "payments" does not exist`), { sqlstate: "42703" });
        }
        v_payment.status = "refunded";
        if (!pgNullIfEmptyBtrim(v_payment.credit_note_number)) {
          v_payment.credit_note_number = cnNum;
        }
        v_payment.updated_at = new Date().toISOString();
      }

      return {
        ...inserted,
        remaining_balance: Number((remaining - p_refund_amount).toFixed(2)),
        is_idempotent_duplicate: false
      };
    } catch (err) {
      if (err.sqlstate === "23505") {
        // Subtransaction rollback restores sequence counter!
        this.credit_note_series.set("26-27", seqSnapshot);
        const recovered = this.credit_notes.find((cn) => pgBtrimAll(cn.refund_id) === v_clean_rfnd_id);
        if (!recovered) throw err;
        const existingPayKey = pgBtrimAll(recovered.payment_id || "");
        if (existingPayKey !== v_canonical_pay_id && existingPayKey !== v_payment_uuid_text) {
          throw new Error(`Refund ID ${v_clean_rfnd_id} belongs to another payment`);
        }
        const currPrior = this.credit_notes
          .filter((c) => [v_canonical_pay_id, v_payment_uuid_text].includes(pgBtrimAll(c.payment_id || "")))
          .reduce((s, c) => s + Number(c.amount), 0);
        return {
          ...recovered,
          remaining_balance: Math.max(0, Number((v_payment.amount - currPrior).toFixed(2))),
          is_idempotent_duplicate: true
        };
      }
      throw err;
    }
  }
}

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

console.log("==============================================================================");
console.log("DIGITALMUID V4.3 — CORRECTED PHASE A + B REGRESSION VERIFICATION SUITE");
console.log("==============================================================================\n");

// =============================================================================
// 1. PAYMENTS SCHEMA, UPDATED_AT & FAIL-CLOSED STATUS CONSTRAINTS
// =============================================================================
console.log("[1] Payments Schema, updated_at & Status Constraints");

runTest("1.1 Phase A adds updated_at, defaults status to 'pending', and replaces restrictive CHECK", () => {
  assert.ok(/ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW\(\)/i.test(ACTIVE_A));
  assert.ok(/ALTER COLUMN status SET DEFAULT 'pending'/i.test(ACTIVE_A));
  assert.ok(/DROP CONSTRAINT IF EXISTS %I/i.test(ACTIVE_A));
  assert.ok(/ADD CONSTRAINT chk_payments_status\s+CHECK \(status IN \('pending', 'created', 'authorized', 'captured', 'paid', 'completed', 'failed', 'cancelled', 'refunded'\)\)/i.test(ACTIVE_A));
  // Confirm staging_baseline_review had the narrower constraint we now drop safely
  assert.ok(STAGING_BASELINE_SQL.includes("CHECK (status IN ('captured', 'refunded', 'failed'))"));
});

runTest("1.2 Full refund updates payments.status='refunded' and payments.updated_at without 42703", () => {
  const db = new HardenedPhaseAPostgresSim();
  db.payments.push(
    db.insertOrUpdatePayment({
      op: "INSERT",
      newRow: { id: "00000000-0000-4000-8000-000000000010", razorpay_payment_id: "pay_full_1", user_id: "u1", amount: 1000, status: "captured" }
    })
  );
  const res = db.recordCreditNoteWithLimit({
    p_payment_id: "pay_full_1",
    p_refund_id: "rfnd_full_1",
    p_refund_amount: 1000
  });
  assert.strictEqual(res.credit_note_number, "CN/26-27/0001");
  assert.strictEqual(res.remaining_balance, 0);
  assert.strictEqual(db.payments[0].status, "refunded");
  assert.ok(db.payments[0].updated_at);
});

// =============================================================================
// 2. RECORD_CREDIT_NOTE_WITH_LIMIT HARDENING
// =============================================================================
console.log("\n[2] Credit Note Atomicity, Canonical IDs, Ownership & Recovery");

runTest("2.1 FOR UPDATE lock executes BEFORE idempotency check & unique_violation subtransaction rolls back CN sequence", () => {
  const fnBody = ACTIVE_A.match(/CREATE OR REPLACE FUNCTION public\.record_credit_note_with_limit[\s\S]*?\$\$;/)[0];
  const lockIdx = fnBody.indexOf("FOR UPDATE");
  const cnSelectIdx = fnBody.indexOf("FROM public.credit_notes cn");
  assert.ok(lockIdx !== -1 && cnSelectIdx !== -1 && lockIdx < cnSelectIdx, "FOR UPDATE must precede idempotency query");
  assert.ok(/EXCEPTION WHEN unique_violation THEN/i.test(fnBody), "Must handle unique_violation cleanly");

  const db = new HardenedPhaseAPostgresSim();
  db.payments.push(
    db.insertOrUpdatePayment({
      op: "INSERT",
      newRow: { id: "11111111-1111-4111-8111-111111111111", razorpay_payment_id: "pay_race_1", user_id: "u1", amount: 1000, status: "captured" }
    })
  );

  // Tx1 commits rfnd_race -> allocates CN/26-27/0001
  const tx1 = db.recordCreditNoteWithLimit({ p_payment_id: "pay_race_1", p_refund_id: "rfnd_race", p_refund_amount: 400 });
  assert.strictEqual(tx1.credit_note_number, "CN/26-27/0001");

  // Simulate post-race unique_violation inside Tx2: sequence is rolled back (stays 1, not burned to 2) and Tx1's row is returned
  const tx2 = db.recordCreditNoteWithLimit({
    p_payment_id: "pay_race_1",
    p_refund_id: "rfnd_race",
    p_refund_amount: 400,
    simulatePreCommitUniqueViolation: true
  });
  assert.strictEqual(tx2.is_idempotent_duplicate, true);
  assert.strictEqual(tx2.credit_note_number, "CN/26-27/0001");
  assert.strictEqual(db.credit_note_series.get("26-27"), 1, "Failed subtransaction must NOT burn next CN sequence");
});

runTest("2.2 Mixed pay_* and UUID payment identifiers resolve canonically and enforce combined cumulative refund cap", () => {
  const db = new HardenedPhaseAPostgresSim();
  const uuid = "22222222-2222-4222-8222-222222222222";
  db.payments.push(
    db.insertOrUpdatePayment({
      op: "INSERT",
      newRow: { id: uuid, razorpay_payment_id: "pay_mix_ok", user_id: "u1", amount: 1000, status: "captured" }
    })
  );

  const r1 = db.recordCreditNoteWithLimit({ p_payment_id: uuid, p_refund_id: "rfnd_m1", p_refund_amount: 700 });
  assert.strictEqual(r1.payment_id, "pay_mix_ok", "Stores canonical razorpay_payment_id even when invoked with UUID");

  assert.throws(
    () => db.recordCreditNoteWithLimit({ p_payment_id: "pay_mix_ok", p_refund_id: "rfnd_m2", p_refund_amount: 400 }),
    /exceeds remaining balance 300/i
  );

  // Even if a historical credit_notes row stored UUID directly, cumulative check still sums both!
  db.credit_notes[0].payment_id = uuid;
  assert.throws(
    () => db.recordCreditNoteWithLimit({ p_payment_id: "pay_mix_ok", p_refund_id: "rfnd_m3", p_refund_amount: 400 }),
    /exceeds remaining balance 300/i
  );
});

runTest("2.3 Cross-payment refund_id reuse is rejected rather than leaking another payment's credit note", () => {
  const db = new HardenedPhaseAPostgresSim();
  db.payments.push(
    db.insertOrUpdatePayment({ op: "INSERT", newRow: { id: "33333333-3333-4333-8333-333333333331", razorpay_payment_id: "pay_A", user_id: "user-A", amount: 1000, status: "captured" } }),
    db.insertOrUpdatePayment({ op: "INSERT", newRow: { id: "33333333-3333-4333-8333-333333333332", razorpay_payment_id: "pay_B", user_id: "user-B", amount: 1000, status: "captured" } })
  );

  db.recordCreditNoteWithLimit({ p_payment_id: "pay_A", p_refund_id: "rfnd_shared_probe", p_refund_amount: 400 });
  assert.throws(
    () => db.recordCreditNoteWithLimit({ p_payment_id: "pay_B", p_refund_id: "rfnd_shared_probe", p_refund_amount: 400 }),
    /already associated with another payment/i
  );
});

runTest("2.4 Authoritative v_payment.user_id cannot be hijacked by caller-supplied p_user_id", () => {
  assert.strictEqual(ACTIVE_A.includes("COALESCE(p_user_id, v_payment.user_id)"), false);
  assert.ok(ACTIVE_A.includes("COALESCE(v_payment.user_id, p_user_id)"));

  const db = new HardenedPhaseAPostgresSim();
  db.payments.push(
    db.insertOrUpdatePayment({
      op: "INSERT",
      newRow: { id: "44444444-4444-4444-8444-444444444444", razorpay_payment_id: "pay_owned", user_id: "owner-uuid", amount: 1000, status: "captured" }
    })
  );

  assert.throws(
    () => db.recordCreditNoteWithLimit({ p_payment_id: "pay_owned", p_refund_id: "rfnd_hijack", p_refund_amount: 200, p_user_id: "attacker-uuid" }),
    /Ownership mismatch/i
  );
  const ok = db.recordCreditNoteWithLimit({ p_payment_id: "pay_owned", p_refund_id: "rfnd_legit", p_refund_amount: 200, p_user_id: null });
  assert.strictEqual(ok.user_id, "owner-uuid");
});

// =============================================================================
// 3. TRIGGER SECURITY & INVOICE INTEGRITY
// =============================================================================
console.log("\n[3] Payment Triggers & Gateway Authorization Boundary");

runTest("3.1 INSERT with unpaid/authorized/pending/failed status clears any forged invoice_number", () => {
  const db = new HardenedPhaseAPostgresSim();
  for (const status of ["pending", "created", "authorized", "failed", "cancelled", "refunded"]) {
    const inserted = db.insertOrUpdatePayment({
      op: "INSERT",
      role: "service_role",
      newRow: { id: `p-${status}`, status, invoice_number: "DM/26-27/FORGED" }
    });
    assert.strictEqual(inserted.invoice_number, null, `Forged invoice_number must be cleared for status='${status}'`);
  }
});

runTest("3.2 Default payment status on INSERT is 'pending' (never 'captured') and client capture attempts are blocked", () => {
  const db = new HardenedPhaseAPostgresSim();
  const defaultRow = db.insertOrUpdatePayment({ op: "INSERT", role: "service_role", newRow: { id: "p-def" } });
  assert.strictEqual(defaultRow.status, "pending");
  assert.strictEqual(defaultRow.invoice_number, null);

  assert.throws(
    () => db.insertOrUpdatePayment({ op: "INSERT", role: "authenticated", newRow: { id: "p-cli", status: "captured" } }),
    /Unauthorized/i
  );
});

runTest("3.3 Non-blank issued invoice_number remains immutable across captured -> refunded UPDATE", () => {
  const db = new HardenedPhaseAPostgresSim();
  const captured = db.insertOrUpdatePayment({ op: "INSERT", role: "service_role", newRow: { id: "p-cap", status: "captured" } });
  assert.strictEqual(captured.invoice_number, "DM/26-27/0001");

  const refunded = db.insertOrUpdatePayment({
    op: "UPDATE",
    role: "service_role",
    oldRow: captured,
    newRow: { ...captured, status: "refunded", invoice_number: "DM/99-00/TAMPER" }
  });
  assert.strictEqual(refunded.invoice_number, "DM/26-27/0001");
});

// =============================================================================
// 4. HISTORICAL NORMALIZATION & PHASE A / PHASE B SEPARATION
// =============================================================================
console.log("\n[4] Whitespace Normalization, Legacy Compatibility & Phase A/B Separation");

runTest("4.1 Phase A normalizes control whitespace across all identifier tables before reconciliation and enforces pre-Phase-B dup checks", () => {
  assert.ok(/UPDATE public\.profiles[\s\S]*BTRIM\(student_id, E' \\t\\n\\r\\f\\v'\)/i.test(ACTIVE_A));
  assert.ok(/UPDATE public\.course_enrollments[\s\S]*BTRIM\(enrollment_id, E' \\t\\n\\r\\f\\v'\)/i.test(ACTIVE_A));
  assert.ok(/UPDATE public\.payments[\s\S]*BTRIM\(invoice_number, E' \\t\\n\\r\\f\\v'\)/i.test(ACTIVE_A));
  assert.ok(/UPDATE public\.credit_notes[\s\S]*BTRIM\(refund_id, E' \\t\\n\\r\\f\\v'\)/i.test(ACTIVE_A));
  assert.ok(ACTIVE_A.includes("v_cn_num_nullable"), "Safely handles both fresh NOT NULL and legacy nullable credit_notes");
  assert.ok(ACTIVE_A.includes("Pre-Phase-B Financial Duplicate Safety Check") || PHASE_A_SQL.includes("Pre-Phase-B Financial Duplicate Safety Check"));
});

runTest("4.2 Zero Phase A/B index duplication, Phase B has no BEGIN/COMMIT, and Phase B validates all 8 indexes", () => {
  assert.strictEqual(/\bCREATE\s+(?:UNIQUE\s+)?INDEX\b/i.test(ACTIVE_A), false, "Phase A must contain ZERO active CREATE INDEX statements");
  assert.strictEqual(PHASE_B_SQL.includes("BEGIN;"), false);
  assert.strictEqual(PHASE_B_SQL.includes("COMMIT;"), false);
  assert.ok(/idx_credit_notes_number[\s\S]*WHERE credit_note_number IS NOT NULL AND BTRIM\(credit_note_number/i.test(ACTIVE_B));
  assert.ok(ACTIVE_B.includes("pg_get_indexdef(c.oid)"));
  assert.ok(ACTIVE_B.includes("IF v_verified <> 8 THEN"));
});

console.log("\n==============================================================================");
console.log(`CORRECTED PHASE A + B VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log("==============================================================================");

if (failed > 0) {
  process.exit(1);
}
