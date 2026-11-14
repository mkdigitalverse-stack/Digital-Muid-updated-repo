/**
 * DIGITALMUID V4.3 — UNIFIED PHASE A + PHASE B CORRECTION VERIFICATION SUITE
 *
 * Strictly read-only against hosted Supabase (zero hosted DB connections, zero live SQL execution).
 * Combines static SQL AST/pattern verification with faithful PostgreSQL PL/pgSQL & catalog simulation
 * to verify all Phase A Final & Phase B mandatory corrections:
 *   1. Payment status constraint ordering (inspect pg_constraint -> drop approved status-only CHECKs ->
 *      normalize statuses / halt on unknown -> ADD CONSTRAINT NOT VALID -> VALIDATE CONSTRAINT)
 *   2. Fail-closed historical credit-note reconciliation (migration + runtime halt on NULL/blank,
 *      NaN/invalid amounts, orphan/ambiguous payments, currency mismatch, or over-refunds)
 *   3. Hardened refund amount & currency validation (>2 decimals, NaN, <=0, overflow, positive
 *      payment amount, INR policy, payment currency match, retry amount + currency parity)
 *   4. Sequence synchronization inspecting both last_value and is_called without rewinding
 *   5. Invoice & status triggers across all 9 statuses (role checks, immutability, no gateway claim)
 *   6. SECURITY DEFINER hardening (search_path, schema qualification, REVOKE/GRANT, OWNER TO postgres)
 *   7. Legacy table compatibility inspection (information_schema.columns types, precision, defaults, NOT NULL)
 *   8. Phase A -> Phase B pg_catalog.pg_index deployment gate inside record_credit_note_with_limit()
 *   9. Accurate locking, SET LOCAL lock_timeout, and post-COMMIT rollback disclosures
 *  10. Phase B concurrent index preflight, non-transactional execution, and postflight validation
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

function isValidTwoDecimalMoney(val) {
  if (val === null || val === undefined || typeof val === "string" && val.toUpperCase() === "NAN") {
    return false;
  }
  const num = Number(val);
  if (!Number.isFinite(num) || num <= 0 || num > 99999999.99) return false;
  // Compare against rounded 2-decimal representation cleanly
  const rounded = Number(num.toFixed(2));
  return Math.abs(num - rounded) < 1e-9;
}

function isValidNonNegTwoDecimalMoney(val) {
  if (val === null || val === undefined || typeof val === "string" && val.toUpperCase() === "NAN") {
    return false;
  }
  const num = Number(val);
  if (!Number.isFinite(num) || num < 0 || num > 99999999.99) return false;
  const rounded = Number(num.toFixed(2));
  return Math.abs(num - rounded) < 1e-9;
}

const ACTIVE_A = stripComments(PHASE_A_SQL);
const ACTIVE_B = stripComments(PHASE_B_SQL);

/**
 * Faithful simulator of the HARDENED Phase A Final PL/pgSQL, catalog & trigger logic.
 */
class HardenedPhaseAPostgresSim {
  constructor() {
    this.payments = [];
    this.credit_notes = [];
    this.invoice_series = new Map();
    this.credit_note_series = new Map();
    this.pg_index = {
      idx_credit_notes_number: {
        schema: "public",
        tableSchema: "public",
        table: "credit_notes",
        columns: ["credit_note_number"],
        isExpression: false,
        indisunique: true,
        indisvalid: true,
        indisready: true,
        partialExpr: "((credit_note_number IS NOT NULL) AND (btrim(credit_note_number, E' \\t\\n\\r\\f\\v'::text) <> ''::text))"
      },
      idx_credit_notes_refund_id: {
        schema: "public",
        tableSchema: "public",
        table: "credit_notes",
        columns: ["refund_id"],
        isExpression: false,
        indisunique: true,
        indisvalid: true,
        indisready: true,
        partialExpr: "((refund_id IS NOT NULL) AND (btrim(refund_id, E' \\t\\n\\r\\f\\v'::text) <> ''::text))"
      }
    };
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

  /**
   * Simulates Step 1A/1B/1C payment status constraint migration ordering.
   */
  migratePaymentStatusConstraints(constraints, paymentRows) {
    const remainingConstraints = [];
    const statusAttnum = 4; // mock attnum for 'status'
    const enumDefRegex = /^\s*CHECK\s*\(\s*\(*\s*status(\)::text)?\s*(?:IN\s*\(|=\s*ANY\s*\(|=\s*')/i;

    // Step 1A: Drop only explicitly approved constraints referencing status ONLY
    for (const c of constraints) {
      const touchesStatus = c.conkey.includes(statusAttnum);
      const isSingleStatus = c.conkey.length === 1 && c.conkey[0] === statusAttnum;

      if ((c.conname === "payments_status_check" || c.conname === "chk_payments_status") && isSingleStatus) {
        continue; // dropped
      } else if (isSingleStatus && enumDefRegex.test(c.def)) {
        continue; // dropped
      } else if (touchesStatus) {
        throw Object.assign(
          new Error(`Migration halt: Unapproved CHECK constraint ${c.conname} (${c.def}) references public.payments.status`),
          { sqlstate: "P0001" }
        );
      } else {
        remainingConstraints.push(c); // unrelated constraint preserved untouched
      }
    }

    // Step 1B: Normalize statuses AFTER incompatible constraints removed, validate against enum BEFORE adding CHECK
    const normalizedRows = paymentRows.map((r) => {
      let s = r.status === null || r.status === undefined ? "pending" : pgBtrimAll(r.status).toLowerCase();
      if (s === "canceled") s = "cancelled";
      if (!this.allowedStatuses.has(s)) {
        throw Object.assign(new Error(`Migration halt: unrecognized status '${r.status}'`), { sqlstate: "P0001" });
      }
      return { ...r, status: s };
    });

    // Step 1C: Add NOT VALID + VALIDATE CONSTRAINT chk_payments_status
    remainingConstraints.push({
      conname: "chk_payments_status",
      conkey: [statusAttnum],
      validated: true,
      def: "CHECK (status IN ('pending', 'created', 'authorized', 'captured', 'paid', 'completed', 'failed', 'cancelled', 'refunded'))"
    });

    return { constraints: remainingConstraints, rows: normalizedRows };
  }

  /**
   * Simulates Section 4 sequence sync inspecting both last_value and is_called.
   */
  syncSequence(existingValues, prefix, seqState) {
    const regex = new RegExp(`^${prefix}-0*([0-9]+)$`);
    let v_max_id = 10000;
    for (const raw of existingValues) {
      const trimmed = pgBtrimAll(raw);
      const m = trimmed && trimmed.match(regex);
      if (m) {
        const val = Number(m[1]);
        if (val > v_max_id) v_max_id = val;
      }
    }

    if (v_max_id > seqState.last_value) {
      seqState.last_value = v_max_id;
      seqState.is_called = true;
    } else if (v_max_id === seqState.last_value && !seqState.is_called) {
      seqState.last_value = v_max_id;
      seqState.is_called = true;
    }
    return seqState;
  }

  nextSeqVal(seqState) {
    if (!seqState.is_called) {
      seqState.is_called = true;
      return seqState.last_value;
    }
    seqState.last_value += 1;
    return seqState.last_value;
  }

  /**
   * Simulates Section 6 fail-closed historical credit_notes audit.
   */
  runHistoricalCreditNoteAudit(paymentRows, creditNoteRows) {
    const normalizedCNs = creditNoteRows.map((cn) => ({
      ...cn,
      payment_id: cn.payment_id === null || cn.payment_id === undefined ? cn.payment_id : pgBtrimAll(cn.payment_id),
      refund_id: cn.refund_id === null || cn.refund_id === undefined ? cn.refund_id : pgBtrimAll(cn.refund_id),
      credit_note_number: cn.credit_note_number === null || cn.credit_note_number === undefined ? cn.credit_note_number : pgBtrimAll(cn.credit_note_number),
      original_invoice_number: cn.original_invoice_number === null || cn.original_invoice_number === undefined ? cn.original_invoice_number : pgBtrimAll(cn.original_invoice_number),
      currency: cn.currency === null || cn.currency === undefined ? cn.currency : pgBtrimAll(cn.currency).toUpperCase()
    }));

    for (const cn of normalizedCNs) {
      if (!cn.payment_id || !cn.refund_id || !cn.credit_note_number || !cn.original_invoice_number || !cn.currency) {
        throw new Error("Migration halt (fail-closed historical audit): NULL or blank required credit_notes field");
      }
      if (!isValidTwoDecimalMoney(cn.amount) || !isValidNonNegTwoDecimalMoney(cn.base_amount) || !isValidNonNegTwoDecimalMoney(cn.tax_amount)) {
        throw new Error("Migration halt (fail-closed historical audit): invalid amount/base_amount/tax_amount");
      }
      const matches = paymentRows.filter(
        (p) => pgBtrimAll(p.razorpay_payment_id || "") === cn.payment_id || String(p.id) === cn.payment_id
      );
      if (matches.length !== 1) {
        throw new Error(`Migration halt (fail-closed historical audit): orphan or ambiguously linked credit_note (${matches.length} matches)`);
      }
    }

    for (const p of paymentRows) {
      const linked = normalizedCNs.filter(
        (cn) => pgBtrimAll(p.razorpay_payment_id || "") === cn.payment_id || String(p.id) === cn.payment_id
      );
      if (linked.length === 0) continue;
      if (!isValidTwoDecimalMoney(p.amount)) {
        throw new Error("Migration halt (fail-closed historical audit): invalid payment amount on refunded payment");
      }
      const total = linked.reduce((s, c) => s + Number(c.amount), 0);
      if (total > Number(p.amount)) {
        throw new Error("Migration halt (fail-closed historical audit): historical credit_notes exceed payment amount");
      }
      const payCurr = pgBtrimAll(p.currency || "").toUpperCase();
      if (linked.some((c) => c.currency !== payCurr)) {
        throw new Error("Migration halt (fail-closed historical audit): currency mismatch between payment and credit note");
      }
    }

    return normalizedCNs;
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
      status: "pending",
      currency: "INR",
      updated_at: new Date().toISOString(),
      ...newRow
    };

    const normStatus = (pgBtrimAll(row.status) || "").toLowerCase();
    if (!this.allowedStatuses.has(normStatus)) {
      throw Object.assign(new Error(`Invalid payment status ${row.status}`), { sqlstate: "P0001" });
    }
    row.status = normStatus;

    // protect_payment_status_transitions
    if (["captured", "paid", "completed", "refunded"].includes(normStatus)) {
      const oldNorm = (pgBtrimAll(oldRow?.status) || "").toLowerCase();
      if (op === "INSERT" || (op === "UPDATE" && oldNorm !== normStatus)) {
        if (role === "authenticated" || role === "anon" || (role !== null && !["service_role", "supabase_admin"].includes(role))) {
          throw Object.assign(new Error(`Unauthorized status ${row.status}`), { sqlstate: "P0001" });
        }
      }
    }

    // trigger_set_payment_invoice
    const hasOldInv = op === "UPDATE" && pgNullIfEmptyBtrim(oldRow?.invoice_number) !== null;
    const cleanNewInv = pgNullIfEmptyBtrim(row.invoice_number);

    if (role === "authenticated" || role === "anon" || (role !== null && !["service_role", "supabase_admin"].includes(role))) {
      if (hasOldInv && cleanNewInv !== pgBtrimAll(oldRow.invoice_number)) {
        throw Object.assign(new Error(`Unauthorized: Issued invoice_number cannot be cleared or replaced by role ${role}`), { sqlstate: "P0001" });
      }
      if (op === "INSERT" && cleanNewInv !== null) {
        throw Object.assign(new Error(`Unauthorized: invoice_number cannot be supplied directly on INSERT by role ${role}`), { sqlstate: "P0001" });
      }
    }

    if (hasOldInv) {
      row.invoice_number = oldRow.invoice_number;
    } else {
      row.invoice_number = cleanNewInv;
    }

    if (["refunded", "failed", "cancelled", "pending", "created", "authorized"].includes(normStatus)) {
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
    // 0. Phase B pg_index + pg_attribute + pg_get_expr gate
    const gateSpecs = [
      { name: "idx_credit_notes_number", col: "credit_note_number" },
      { name: "idx_credit_notes_refund_id", col: "refund_id" }
    ];
    for (const spec of gateSpecs) {
      const idx = this.pg_index[spec.name];
      if (!idx || idx.schema !== "public") {
        throw new Error(`Credit note processing halted: Required Phase B unique index public.${spec.name} is missing.`);
      }
      if (idx.tableSchema !== "public" || idx.table !== "credit_notes") {
        throw new Error(`Credit note processing halted: Index public.${spec.name} targets ${idx.tableSchema}.${idx.table} instead of public.credit_notes.`);
      }
      if (!idx.indisunique) {
        throw new Error(`Credit note processing halted: Index public.${spec.name} is NOT unique.`);
      }
      if (!idx.indisvalid || !idx.indisready) {
        throw new Error(`Credit note processing halted: Required Phase B unique index public.${spec.name} is invalid or not ready.`);
      }
      if (idx.isExpression || JSON.stringify(idx.columns) !== JSON.stringify([spec.col])) {
        throw new Error(`Credit note processing halted: Index public.${spec.name} does not exclusively index column public.credit_notes.(${spec.col}).`);
      }
      const predRegex = new RegExp(
        `^\\s*\\(*\\s*${spec.col}\\s+IS\\s+NOT\\s+NULL\\s*\\)*\\s+AND\\s+\\(*\\s*(?:pg_catalog\\.)?btrim\\(\\s*\\(*\\s*${spec.col}(?:\\)*(?:::text)?)\\s*,\\s*E?' (?:\\t|\\\\t|\\\\x09|\\\\011)(?:\\n|\\\\n|\\\\x0a|\\\\012)(?:\\r|\\\\r|\\\\x0d|\\\\015)(?:\\f|\\\\f|\\\\x0c|\\\\014)(?:\\v|\\\\v|\\\\x0b|\\\\013)'(?:::text)?\\s*\\)\\s*(?:<>|!=)\\s*''(?:::text)?\\s*\\)*\\s*$`,
        "i"
      );
      if (!idx.partialExpr || !predRegex.test(idx.partialExpr)) {
        throw new Error(`Credit note processing halted: Index public.${spec.name} has missing or incorrect partial predicate (${idx.partialExpr || "<none>"}).`);
      }
    }

    // 1. Validate inputs (NULL, NaN, <=0, >99999999.99, >2 decimals)
    if (!isValidTwoDecimalMoney(p_refund_amount)) {
      throw new Error(`Invalid refund amount ${p_refund_amount}: Amount must be a finite positive number with at most two decimal places.`);
    }
    const v_refund_amount = Number(Number(p_refund_amount).toFixed(2));

    const v_clean_pay_id = pgNullIfEmptyBtrim(p_payment_id);
    if (!v_clean_pay_id) throw new Error("Missing payment_id");
    const v_clean_rfnd_id = pgNullIfEmptyBtrim(p_refund_id);
    if (!v_clean_rfnd_id) throw new Error("Missing refund_id");

    const v_caller_currency = pgNullIfEmptyBtrim(p_currency)?.toUpperCase() || null;
    if (!v_caller_currency || v_caller_currency !== "INR") {
      throw new Error(`Unsupported or missing currency ${p_currency}: DigitalMuid credit notes strictly require supported currency INR.`);
    }

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

    if (!isValidTwoDecimalMoney(v_payment.amount)) {
      throw new Error(`Invalid payment amount ${v_payment.amount} on payment ${v_canonical_pay_id}`);
    }
    const v_payment_amount = Number(Number(v_payment.amount).toFixed(2));

    const v_payment_currency = pgNullIfEmptyBtrim(v_payment.currency || "")?.toUpperCase() || null;
    if (!v_payment_currency || v_payment_currency !== "INR") {
      throw new Error(`Unsupported or missing payment currency ${v_payment.currency} on payment ${v_canonical_pay_id}.`);
    }
    if (v_caller_currency !== v_payment_currency) {
      throw new Error(`Currency mismatch: requested refund currency ${v_caller_currency} does not match authoritative payment currency ${v_payment_currency}`);
    }
    const v_effective_currency = v_payment_currency;

    if (p_user_id && v_payment.user_id && p_user_id !== v_payment.user_id) {
      throw Object.assign(
        new Error(`Ownership mismatch: caller user_id ${p_user_id} does not match authoritative payment owner ${v_payment.user_id}`),
        { sqlstate: "P0001" }
      );
    }
    const v_owner_user_id = v_payment.user_id ?? p_user_id;

    // Fail-closed runtime check against corrupt/unlinked historical credit_notes rows
    const unreliable = this.credit_notes.filter((cn) => {
      const pid = pgNullIfEmptyBtrim(cn.payment_id);
      if (!pid) return true;
      if (pid === v_canonical_pay_id || pid === v_payment_uuid_text) {
        return (
          !isValidTwoDecimalMoney(cn.amount) ||
          !pgNullIfEmptyBtrim(cn.refund_id) ||
          (pgNullIfEmptyBtrim(cn.currency || "")?.toUpperCase() || null) !== v_effective_currency
        );
      }
      return false;
    });
    if (unreliable.length > 0) {
      throw new Error(`Refund processing halted: Found ${unreliable.length} corrupt or unassociated historical credit_notes row(s)`);
    }

    // Post-lock idempotency check (checks payment_id, amount, AND currency)
    const existing = this.credit_notes.find((cn) => pgBtrimAll(cn.refund_id) === v_clean_rfnd_id);
    if (existing) {
      const existingPayKey = pgBtrimAll(existing.payment_id || "");
      if (existingPayKey !== v_canonical_pay_id && existingPayKey !== v_payment_uuid_text) {
        throw new Error(`Refund ID ${v_clean_rfnd_id} is already associated with another payment (${existing.payment_id})`);
      }
      if (Number(existing.amount) !== v_refund_amount) {
        throw new Error(`Idempotent retry mismatch for refund_id ${v_clean_rfnd_id}: original amount ${existing.amount} differs from requested amount ${v_refund_amount}`);
      }
      if ((pgBtrimAll(existing.currency || "").toUpperCase()) !== v_effective_currency) {
        throw new Error(`Idempotent retry mismatch for refund_id ${v_clean_rfnd_id}: original currency ${existing.currency} differs from requested currency ${v_effective_currency}`);
      }
      const priorTotal = this.credit_notes
        .filter((c) => [v_canonical_pay_id, v_payment_uuid_text].includes(pgBtrimAll(c.payment_id || "")))
        .reduce((s, c) => s + Number(c.amount), 0);
      return {
        ...existing,
        remaining_balance: Math.max(0, Number((v_payment_amount - priorTotal).toFixed(2))),
        is_idempotent_duplicate: true
      };
    }

    if (!["captured", "paid", "completed", "refunded"].includes((v_payment.status || "").toLowerCase())) {
      throw new Error(`Payment ${v_canonical_pay_id} is in status ${v_payment.status}, which is not eligible for refund`);
    }

    const priorTotal = this.credit_notes
      .filter((cn) => [v_canonical_pay_id, v_payment_uuid_text].includes(pgBtrimAll(cn.payment_id || "")))
      .reduce((s, cn) => s + Number(cn.amount), 0);
    const remaining = Number((v_payment_amount - priorTotal).toFixed(2));
    if (v_refund_amount > remaining) {
      throw new Error(`Refund amount ${v_refund_amount} exceeds remaining balance ${remaining}`);
    }

    const baseAmount = Number((v_refund_amount / 1.18).toFixed(2));
    const taxAmount = Number((v_refund_amount - baseAmount).toFixed(2));
    const isPartial = priorTotal + v_refund_amount < v_payment_amount;
    const origInv = pgNullIfEmptyBtrim(v_payment.invoice_number) || `DM-INV-${v_canonical_pay_id.slice(4)}`;

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
        amount: v_refund_amount,
        base_amount: baseAmount,
        tax_amount: taxAmount,
        currency: v_effective_currency,
        is_partial: isPartial
      };
      this.credit_notes.push(inserted);

      if (priorTotal + v_refund_amount >= v_payment_amount) {
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
        remaining_balance: Number((remaining - v_refund_amount).toFixed(2)),
        is_idempotent_duplicate: false
      };
    } catch (err) {
      if (err.sqlstate === "23505") {
        this.credit_note_series.set("26-27", seqSnapshot);
        const recovered = this.credit_notes.find((cn) => pgBtrimAll(cn.refund_id) === v_clean_rfnd_id);
        if (!recovered) throw err;
        const existingPayKey = pgBtrimAll(recovered.payment_id || "");
        if (existingPayKey !== v_canonical_pay_id && existingPayKey !== v_payment_uuid_text) {
          throw new Error(`Refund ID ${v_clean_rfnd_id} belongs to another payment`);
        }
        if (Number(recovered.amount) !== v_refund_amount) {
          throw new Error(`Idempotent retry mismatch for refund_id ${v_clean_rfnd_id}: original amount ${recovered.amount} differs from requested amount ${v_refund_amount}`);
        }
        if ((pgBtrimAll(recovered.currency || "").toUpperCase()) !== v_effective_currency) {
          throw new Error(`Idempotent retry mismatch for refund_id ${v_clean_rfnd_id}: original currency ${recovered.currency} differs from requested currency ${v_effective_currency}`);
        }
        const currPrior = this.credit_notes
          .filter((c) => [v_canonical_pay_id, v_payment_uuid_text].includes(pgBtrimAll(c.payment_id || "")))
          .reduce((s, c) => s + Number(c.amount), 0);
        return {
          ...recovered,
          remaining_balance: Math.max(0, Number((v_payment_amount - currPrior).toFixed(2))),
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
console.log("DIGITALMUID V4.3 — PHASE A FINAL + PHASE B REGRESSION VERIFICATION SUITE");
console.log("==============================================================================\n");

// =============================================================================
// 1. PAYMENTS SCHEMA, STATUS CONSTRAINT ORDERING & LOCKING
// =============================================================================
console.log("[1] Payment Status Constraint Ordering, updated_at & Locking");

runTest("1.1 Phase A drops ONLY approved status constraints BEFORE normalization, validates NOT VALID -> VALIDATE CONSTRAINT, and does not drop unrelated CHECKs", () => {
  assert.ok(/ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW\(\)/i.test(ACTIVE_A));
  assert.ok(/ALTER COLUMN status SET DEFAULT 'pending'/i.test(ACTIVE_A));
  assert.ok(/DROP CONSTRAINT IF EXISTS %I/i.test(ACTIVE_A));
  assert.ok(/FROM pg_catalog\.pg_constraint c/i.test(ACTIVE_A));
  assert.ok(/Unapproved CHECK constraint % \(%\) references public\.payments\.status/i.test(ACTIVE_A));
  assert.ok(/ADD CONSTRAINT chk_payments_status\s+CHECK \(status IN \('pending', 'created', 'authorized', 'captured', 'paid', 'completed', 'failed', 'cancelled', 'refunded'\)\)\s+NOT VALID;/i.test(ACTIVE_A));
  assert.ok(/ALTER TABLE public\.payments\s+VALIDATE CONSTRAINT chk_payments_status;/i.test(ACTIVE_A));

  // Verify ordering in SQL: Step 1A drop < Step 1B normalize < Step 1C add & validate
  const dropIdx = ACTIVE_A.indexOf("ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS");
  const normIdx = ACTIVE_A.indexOf("SET status = 'cancelled'");
  const addIdx = ACTIVE_A.indexOf("ADD CONSTRAINT chk_payments_status");
  const valIdx = ACTIVE_A.indexOf("VALIDATE CONSTRAINT chk_payments_status");
  assert.ok(dropIdx > 0 && normIdx > dropIdx && addIdx > normIdx && valIdx > addIdx);

  // Confirm staging_baseline_review had the narrower constraint
  assert.ok(STAGING_BASELINE_SQL.includes("CHECK (status IN ('captured', 'refunded', 'failed'))"));

  // Simulator verification: preserves unrelated constraint, drops approved status constraint, rejects unapproved constraint & unknown status
  const db = new HardenedPhaseAPostgresSim();
  const simOut = db.migratePaymentStatusConstraints(
    [
      { conname: "payments_status_check", conkey: [4], def: "CHECK ((status = ANY (ARRAY['captured'::text, 'refunded'::text, 'failed'::text])))" },
      { conname: "payments_amount_positive", conkey: [3], def: "CHECK (amount > 0)" }
    ],
    [{ id: "p1", status: null }, { id: "p2", status: "  CANCELED  " }, { id: "p3", status: "CAPTURED" }]
  );
  assert.strictEqual(simOut.rows[0].status, "pending");
  assert.strictEqual(simOut.rows[1].status, "cancelled");
  assert.strictEqual(simOut.rows[2].status, "captured");
  assert.ok(simOut.constraints.some((c) => c.conname === "payments_amount_positive"));
  assert.ok(simOut.constraints.some((c) => c.conname === "chk_payments_status" && c.validated === true));

  assert.throws(
    () =>
      db.migratePaymentStatusConstraints(
        [{ conname: "custom_multi_rule", conkey: [4, 5], def: "CHECK (status <> 'captured' OR amount > 0)" }],
        [{ id: "p1", status: "captured" }]
      ),
    /Unapproved CHECK constraint/i
  );

  assert.throws(
    () => db.migratePaymentStatusConstraints([], [{ id: "p1", status: "bogus_state" }]),
    /unrecognized status/i
  );
});

runTest("1.2 Full refund qualifies UPDATE public.payments AS pay (no 42702 OUT-var ambiguity) and updates updated_at without 42703", () => {
  const fnBody = ACTIVE_A.match(/CREATE OR REPLACE FUNCTION public\.record_credit_note_with_limit[\s\S]*?\$\$;/)[0];
  const updateBlockMatch = fnBody.match(/UPDATE public\.payments AS pay[\s\S]*?WHERE[\s\S]*?;/i);
  assert.ok(updateBlockMatch, "Expected full-refund UPDATE public.payments AS pay statement");
  const updateBlock = updateBlockMatch[0];
  assert.ok(updateBlock.includes("pay.credit_note_number"), "UPDATE must qualify pay.credit_note_number");
  assert.ok(updateBlock.includes("WHERE pay.id = v_payment.id;"), "UPDATE WHERE must qualify pay.id");
  assert.strictEqual(/\bbtrim\(\s*credit_note_number\b/i.test(updateBlock), false, "Unqualified credit_note_number in UPDATE triggers SQLSTATE 42702");
  assert.strictEqual(/\bWHERE\s+id\s*=/i.test(updateBlock), false, "Unqualified id in UPDATE WHERE triggers SQLSTATE 42702");

  // Also ensure RETURNING clause qualifies credit_notes.id (not bare id OUT variable)
  assert.ok(/RETURNING credit_notes\.id INTO v_new_id;/i.test(fnBody), "INSERT RETURNING must qualify credit_notes.id");

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
// 2. FAIL-CLOSED HISTORICAL AUDIT & LEGACY COMPATIBILITY
// =============================================================================
console.log("\n[2] Fail-Closed Historical Credit-Note Audit & Legacy Compatibility");

runTest("2.1 Phase A inspects legacy column types/defaults and enforces fail-closed historical audit before SET NOT NULL", () => {
  assert.ok(/FROM information_schema\.columns[\s\S]*table_name = 'credit_notes'/i.test(ACTIVE_A));
  assert.ok(/FROM information_schema\.columns[\s\S]*table_name = 'payments'/i.test(ACTIVE_A));
  assert.ok(/ALTER COLUMN reason SET DEFAULT/i.test(ACTIVE_A));
  assert.ok(/fail-closed historical audit/i.test(ACTIVE_A));
  assert.ok(/ALTER TABLE public\.credit_notes[\s\S]*ALTER COLUMN credit_note_number SET NOT NULL/i.test(ACTIVE_A));
  // Never invent missing financial numbers/payment references
  assert.strictEqual(/COALESCE\([^)]*0\.00/.test(ACTIVE_A.slice(ACTIVE_A.indexOf("fail-closed historical audit"), ACTIVE_A.indexOf("ALTER COLUMN credit_note_number SET NOT NULL"))), false);

  const db = new HardenedPhaseAPostgresSim();
  const validPayment = { id: "p-uuid-1", razorpay_payment_id: "pay_ok_1", amount: 1000, currency: "INR" };

  // Orphan credit note halts
  assert.throws(
    () =>
      db.runHistoricalCreditNoteAudit([validPayment], [
        { payment_id: "pay_missing", refund_id: "rf1", credit_note_number: "CN/26-27/0001", original_invoice_number: "DM/26-27/0001", currency: "INR", amount: 100, base_amount: 84.75, tax_amount: 15.25 }
      ]),
    /orphan or ambiguously linked/i
  );

  // Blank payment_id halts
  assert.throws(
    () =>
      db.runHistoricalCreditNoteAudit([validPayment], [
        { payment_id: "  \t ", refund_id: "rf1", credit_note_number: "CN/26-27/0001", original_invoice_number: "DM/26-27/0001", currency: "INR", amount: 100, base_amount: 84.75, tax_amount: 15.25 }
      ]),
    /NULL or blank required/i
  );

  // Over-refund halts
  assert.throws(
    () =>
      db.runHistoricalCreditNoteAudit([validPayment], [
        { payment_id: "pay_ok_1", refund_id: "rf1", credit_note_number: "CN/26-27/0001", original_invoice_number: "DM/26-27/0001", currency: "INR", amount: 700, base_amount: 593.22, tax_amount: 106.78 },
        { payment_id: "p-uuid-1", refund_id: "rf2", credit_note_number: "CN/26-27/0002", original_invoice_number: "DM/26-27/0001", currency: "INR", amount: 400, base_amount: 338.98, tax_amount: 61.02 }
      ]),
    /exceed payment amount/i
  );

  // Clean history passes and normalizes whitespace
  const clean = db.runHistoricalCreditNoteAudit([validPayment], [
    { payment_id: " pay_ok_1 ", refund_id: " rf1 ", credit_note_number: " CN/26-27/0001 ", original_invoice_number: " DM/26-27/0001 ", currency: " inr ", amount: 400, base_amount: 338.98, tax_amount: 61.02 }
  ]);
  assert.strictEqual(clean[0].payment_id, "pay_ok_1");
  assert.strictEqual(clean[0].currency, "INR");
});

// =============================================================================
// 3. RECORD_CREDIT_NOTE_WITH_LIMIT HARDENING & DEPLOYMENT GATE
// =============================================================================
console.log("\n[3] Credit Note Atomicity, Amount/Currency Policy, Ownership & Phase B Gate");

runTest("3.1 Phase B pg_index gate blocks missing/invalid/unready/wrong-table/wrong-column/non-unique/wrong-predicate indexes", () => {
  const fnBody = ACTIVE_A.match(/CREATE OR REPLACE FUNCTION public\.record_credit_note_with_limit[\s\S]*?\$\$;/)[0];
  assert.ok(fnBody.includes("pg_catalog.pg_attribute"), "Phase A gate must inspect pg_attribute");
  assert.ok(fnBody.includes("pg_catalog.pg_get_expr(i.indpred, i.indrelid)"), "Phase A gate must inspect pg_get_expr(i.indpred, i.indrelid)");
  assert.ok(fnBody.includes("v_gate_idx.indkey::SMALLINT[] IS DISTINCT FROM ARRAY[v_gate_attnum]"), "Phase A gate must verify exact single column attnum");
  assert.ok(fnBody.includes("i.indexprs IS NOT NULL") || fnBody.includes("v_gate_idx.indexprs IS NOT NULL"), "Phase A gate must reject expression indexes");
  assert.ok(fnBody.includes("v_gate_idx.table_name IS DISTINCT FROM 'credit_notes'"), "Phase A gate must verify target table public.credit_notes");

  const makeValidDb = () => {
    const db = new HardenedPhaseAPostgresSim();
    db.payments.push(
      db.insertOrUpdatePayment({ op: "INSERT", newRow: { id: "00000000-0000-4000-8000-000000000021", razorpay_payment_id: "pay_gate", user_id: "u1", amount: 1000, status: "captured" } })
    );
    return db;
  };

  // Every defect class must halt fail-closed
  const defectMutations = [
    { label: "indisvalid=false", mutate: (d) => { d.pg_index.idx_credit_notes_refund_id.indisvalid = false; } },
    { label: "indisready=false", mutate: (d) => { d.pg_index.idx_credit_notes_number.indisready = false; } },
    { label: "wrong table (payments)", mutate: (d) => { d.pg_index.idx_credit_notes_refund_id.table = "payments"; } },
    { label: "wrong schema", mutate: (d) => { d.pg_index.idx_credit_notes_refund_id.tableSchema = "other_schema"; } },
    { label: "wrong column (user_id)", mutate: (d) => { d.pg_index.idx_credit_notes_number.columns = ["user_id"]; } },
    { label: "multi-column index", mutate: (d) => { d.pg_index.idx_credit_notes_refund_id.columns = ["refund_id", "payment_id"]; } },
    { label: "expression index", mutate: (d) => { d.pg_index.idx_credit_notes_refund_id.isExpression = true; } },
    { label: "non-unique index", mutate: (d) => { d.pg_index.idx_credit_notes_refund_id.indisunique = false; } },
    { label: "non-partial index (indpred NULL)", mutate: (d) => { d.pg_index.idx_credit_notes_refund_id.partialExpr = null; } },
    { label: "weak predicate (IS NOT NULL only)", mutate: (d) => { d.pg_index.idx_credit_notes_refund_id.partialExpr = "(refund_id IS NOT NULL)"; } },
    { label: "wrong-column predicate", mutate: (d) => { d.pg_index.idx_credit_notes_refund_id.partialExpr = "((payment_id IS NOT NULL) AND (btrim(payment_id, E' \\t\\n\\r\\f\\v'::text) <> ''::text))"; } }
  ];

  for (const dm of defectMutations) {
    const d = makeValidDb();
    dm.mutate(d);
    assert.throws(
      () => d.recordCreditNoteWithLimit({ p_payment_id: "pay_gate", p_refund_id: `rfnd_${dm.label}`, p_refund_amount: 100 }),
      /Credit note processing halted/i,
      `Gate failed to reject ${dm.label}`
    );
  }

  // Valid catalog succeeds
  const cleanDb = makeValidDb();
  const ok = cleanDb.recordCreditNoteWithLimit({ p_payment_id: "pay_gate", p_refund_id: "rfnd_g1", p_refund_amount: 100 });
  assert.strictEqual(ok.amount, 100);
});

runTest("3.2 Rejects NaN, >2 decimal places, unsupported currencies, currency mismatches, and runtime corrupt credit_notes", () => {
  const db = new HardenedPhaseAPostgresSim();
  db.payments.push(
    db.insertOrUpdatePayment({ op: "INSERT", newRow: { id: "00000000-0000-4000-8000-000000000022", razorpay_payment_id: "pay_num", user_id: "u1", amount: 1000, currency: "INR", status: "captured" } })
  );

  for (const badAmt of [null, "NaN", 0, -50, 100.123, 100000000]) {
    assert.throws(
      () => db.recordCreditNoteWithLimit({ p_payment_id: "pay_num", p_refund_id: "rf_bad_amt", p_refund_amount: badAmt }),
      /Invalid refund amount/i
    );
  }
  for (const badCurr of ["", null, "USD", "EUR"]) {
    assert.throws(
      () => db.recordCreditNoteWithLimit({ p_payment_id: "pay_num", p_refund_id: "rf_bad_curr", p_refund_amount: 100, p_currency: badCurr }),
      /Unsupported or missing currency/i
    );
  }

  // Runtime halt when corrupt/unlinked credit_note exists in table
  db.credit_notes.push({ id: "cn-orphan", payment_id: "  ", refund_id: "rf_old", amount: 50, currency: "INR" });
  assert.throws(
    () => db.recordCreditNoteWithLimit({ p_payment_id: "pay_num", p_refund_id: "rf_ok", p_refund_amount: 100 }),
    /corrupt or unassociated historical credit_notes/i
  );
});

runTest("3.3 Idempotent retry validates BOTH original amount AND currency (post-lock & 23505 recovery)", () => {
  const db = new HardenedPhaseAPostgresSim();
  db.payments.push(
    db.insertOrUpdatePayment({
      op: "INSERT",
      newRow: { id: "11111111-1111-4111-8111-111111111111", razorpay_payment_id: "pay_race_1", user_id: "u1", amount: 1000, currency: "INR", status: "captured" }
    })
  );

  const tx1 = db.recordCreditNoteWithLimit({ p_payment_id: "pay_race_1", p_refund_id: "rfnd_race", p_refund_amount: 400, p_currency: "INR" });
  assert.strictEqual(tx1.credit_note_number, "CN/26-27/0001");

  // Retry with DIFFERENT amount fails closed both post-lock and on unique_violation
  assert.throws(
    () => db.recordCreditNoteWithLimit({ p_payment_id: "pay_race_1", p_refund_id: "rfnd_race", p_refund_amount: 450, p_currency: "INR" }),
    /Idempotent retry mismatch[\s\S]*original amount 400 differs from requested amount 450/i
  );
  assert.throws(
    () => db.recordCreditNoteWithLimit({ p_payment_id: "pay_race_1", p_refund_id: "rfnd_race", p_refund_amount: 450, p_currency: "INR", simulatePreCommitUniqueViolation: true }),
    /Idempotent retry mismatch/i
  );
  assert.strictEqual(db.credit_note_series.get("26-27"), 1, "Failed subtransaction must NOT burn next CN sequence");

  // Exact retry succeeds cleanly
  const tx2 = db.recordCreditNoteWithLimit({ p_payment_id: "pay_race_1", p_refund_id: "rfnd_race", p_refund_amount: 400, p_currency: "INR", simulatePreCommitUniqueViolation: true });
  assert.strictEqual(tx2.is_idempotent_duplicate, true);
  assert.strictEqual(tx2.credit_note_number, "CN/26-27/0001");
  assert.strictEqual(db.credit_note_series.get("26-27"), 1);
});

runTest("3.4 FOR UPDATE lock executes BEFORE idempotency check, canonicalizes payment_id, blocks cross-payment reuse & caller p_user_id hijack", () => {
  const fnBody = ACTIVE_A.match(/CREATE OR REPLACE FUNCTION public\.record_credit_note_with_limit[\s\S]*?\$\$;/)[0];
  const lockIdx = fnBody.indexOf("FOR UPDATE");
  const cnSelectIdx = fnBody.indexOf("FROM public.credit_notes cn");
  assert.ok(lockIdx !== -1 && cnSelectIdx !== -1 && lockIdx < cnSelectIdx);
  assert.strictEqual(ACTIVE_A.includes("COALESCE(p_user_id, v_payment.user_id)"), false);
  assert.ok(ACTIVE_A.includes("COALESCE(v_payment.user_id, p_user_id)"));

  const db = new HardenedPhaseAPostgresSim();
  const uuid = "22222222-2222-4222-8222-222222222222";
  db.payments.push(
    db.insertOrUpdatePayment({ op: "INSERT", newRow: { id: uuid, razorpay_payment_id: "pay_A", user_id: "owner-A", amount: 1000, status: "captured" } }),
    db.insertOrUpdatePayment({ op: "INSERT", newRow: { id: "33333333-3333-4333-8333-333333333332", razorpay_payment_id: "pay_B", user_id: "owner-B", amount: 1000, status: "captured" } })
  );

  const r1 = db.recordCreditNoteWithLimit({ p_payment_id: uuid, p_refund_id: "rfnd_m1", p_refund_amount: 700 });
  assert.strictEqual(r1.payment_id, "pay_A");

  assert.throws(
    () => db.recordCreditNoteWithLimit({ p_payment_id: "pay_B", p_refund_id: "rfnd_m1", p_refund_amount: 100 }),
    /already associated with another payment/i
  );
  assert.throws(
    () => db.recordCreditNoteWithLimit({ p_payment_id: "pay_A", p_refund_id: "rfnd_hijack", p_refund_amount: 100, p_user_id: "attacker" }),
    /Ownership mismatch/i
  );
});

// =============================================================================
// 4. SEQUENCE SYNC, TRIGGERS & SECURITY DEFINER HARDENING
// =============================================================================
console.log("\n[4] Sequences (last_value + is_called), Triggers & SECURITY DEFINER Hardening");

runTest("4.1 Sequence sync handles last_value=10001 with is_called=false without colliding or rewinding", () => {
  assert.ok(/SELECT last_value, is_called INTO v_curr_val, v_is_called FROM public\.student_id_seq;/i.test(ACTIVE_A));
  assert.ok(/ELSIF v_max_id = v_curr_val AND NOT v_is_called THEN/i.test(ACTIVE_A));

  const db = new HardenedPhaseAPostgresSim();
  // Case A: Existing row is DM-STU-010001 while fresh sequence is (10001, false) -> must mark is_called=true so nextval=10002
  const seqA = db.syncSequence(["DM-STU-010001"], "DM-STU", { last_value: 10001, is_called: false });
  assert.strictEqual(seqA.last_value, 10001);
  assert.strictEqual(seqA.is_called, true);
  assert.strictEqual(db.nextSeqVal(seqA), 10002);

  // Case B: Sequence already higher (10050, true) must NEVER rewind
  const seqB = db.syncSequence(["DM-STU-010010"], "DM-STU", { last_value: 10050, is_called: true });
  assert.strictEqual(seqB.last_value, 10050);
  assert.strictEqual(db.nextSeqVal(seqB), 10051);
});

runTest("4.2 Invoice lifecycle triggers cover all 9 statuses, reject invalid statuses, protect OLD.invoice_number, and make NO gateway-capture claim", () => {
  const db = new HardenedPhaseAPostgresSim();
  for (const status of ["pending", "created", "authorized", "failed", "cancelled", "refunded"]) {
    const inserted = db.insertOrUpdatePayment({
      op: "INSERT",
      role: "service_role",
      newRow: { id: `p-${status}`, status, invoice_number: "DM/26-27/FORGED" }
    });
    assert.strictEqual(inserted.invoice_number, null, `Forged invoice_number must be cleared for status='${status}'`);
  }

  for (const capStatus of ["captured", "paid", "completed"]) {
    const inserted = db.insertOrUpdatePayment({
      op: "INSERT",
      role: "service_role",
      newRow: { id: `p-${capStatus}`, status: ` ${capStatus.toUpperCase()} ` }
    });
    assert.strictEqual(inserted.status, capStatus);
    assert.ok(/^DM\/26-27\/\d{4}$/.test(inserted.invoice_number));
  }

  // Client role blocked on forged INSERT invoice_number even on pending, and on captured/refunded status
  assert.throws(
    () => db.insertOrUpdatePayment({ op: "INSERT", role: "authenticated", newRow: { id: "p-cli-inv", status: "pending", invoice_number: "DM/26-27/FAKE" } }),
    /Unauthorized/i
  );
  assert.throws(
    () => db.insertOrUpdatePayment({ op: "INSERT", role: "authenticated", newRow: { id: "p-cli-cap", status: "captured" } }),
    /Unauthorized/i
  );

  // Issued invoice_number preserved immutably across captured -> refunded UPDATE
  const captured = db.insertOrUpdatePayment({ op: "INSERT", role: "service_role", newRow: { id: "p-cap", status: "captured" } });
  const refunded = db.insertOrUpdatePayment({
    op: "UPDATE",
    role: "service_role",
    oldRow: captured,
    newRow: { ...captured, status: "refunded", invoice_number: "DM/99-00/TAMPER" }
  });
  assert.strictEqual(refunded.invoice_number, captured.invoice_number);

  // Confirm no false claim that triggers prove Razorpay gateway capture
  assert.ok(/Triggers CANNOT prove Razorpay gateway capture/i.test(PHASE_A_SQL));
});

runTest("4.3 All 9 SECURITY DEFINER functions enforce search_path, schema qualification, REVOKE/GRANT, and postgres ownership", () => {
  const fnNames = [
    "generate_student_id\\(\\)",
    "generate_enrollment_id\\(\\)",
    "get_next_invoice_number\\(TIMESTAMPTZ\\)",
    "get_next_credit_note_number\\(TIMESTAMPTZ\\)",
    "record_credit_note_with_limit\\(TEXT, TEXT, NUMERIC, TEXT, UUID, TEXT, TIMESTAMPTZ\\)",
    "trigger_set_student_id\\(\\)",
    "trigger_set_enrollment_id\\(\\)",
    "trigger_set_payment_invoice\\(\\)",
    "protect_payment_status_transitions\\(\\)"
  ];
  for (const fn of fnNames) {
    assert.ok(new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn} FROM PUBLIC, anon, authenticated;`, "i").test(ACTIVE_A), `Missing REVOKE on ${fn}`);
    assert.ok(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn} TO (service_role, postgres|postgres, service_role);`, "i").test(ACTIVE_A), `Missing GRANT on ${fn}`);
    assert.ok(new RegExp(`ALTER FUNCTION public\\.${fn} OWNER TO postgres;`, "i").test(ACTIVE_A), `Missing OWNER TO postgres on ${fn}`);
  }
});

// =============================================================================
// 5. LOCKING DISCLOSURE, ROLLBACK WARNINGS & PHASE A/B SEPARATION
// =============================================================================
console.log("\n[5] Locking Disclosures, Rollback Warnings & Phase A/B Separation");

runTest("5.1 Phase A discloses AccessExclusiveLock, large UPDATEs, lock_timeout, irreversible post-COMMIT state, and zero active index DDL", () => {
  assert.ok(/SET LOCAL lock_timeout = '5s';/i.test(ACTIVE_A));
  assert.ok(/AccessExclusiveLock/i.test(PHASE_A_SQL));
  assert.ok(/Irreversible Data Changes Post-COMMIT/i.test(PHASE_A_SQL));
  assert.ok(/pg_dump/i.test(PHASE_A_SQL));
  assert.ok(/Pre-Phase-B Financial Duplicate Safety Check/i.test(PHASE_A_SQL));
  assert.strictEqual(/\bCREATE\s+(?:UNIQUE\s+)?INDEX\b/i.test(ACTIVE_A), false, "Phase A must contain ZERO active CREATE INDEX statements");
});

runTest("5.2 Phase B has zero BEGIN/COMMIT, uses CONCURRENTLY cleanly, and validates table/column/predicate for all 8 indexes", () => {
  assert.strictEqual(PHASE_B_SQL.includes("BEGIN;"), false);
  assert.strictEqual(PHASE_B_SQL.includes("COMMIT;"), false);
  assert.ok(/idx_credit_notes_number[\s\S]*WHERE credit_note_number IS NOT NULL AND BTRIM\(credit_note_number/i.test(ACTIVE_B));
  assert.ok(ACTIVE_B.includes("pg_get_indexdef(c.oid)"));
  assert.ok(ACTIVE_B.includes("pg_catalog.pg_attribute"));
  assert.ok(ACTIVE_B.includes("pg_catalog.pg_get_expr(i.indpred, i.indrelid)"));
  assert.ok(ACTIVE_B.includes("indkey::SMALLINT[] IS DISTINCT FROM ARRAY[v_attnum]"));
  assert.ok(ACTIVE_B.includes("IF v_verified <> 8 THEN"));
});

console.log("\n==============================================================================");
console.log(`PHASE A FINAL + PHASE B VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log("==============================================================================");

if (failed > 0) {
  process.exit(1);
}
