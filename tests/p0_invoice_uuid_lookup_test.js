/**
 * DIGITAL MUID V4.3 — P0-2 INVOICE & CREDIT-NOTE UUID/TYPE-SAFE LOOKUP TEST SUITE
 *
 * Verifies:
 * 1. Zero PostgREST `.or(...)` calls remain in `server/paymentRoutes.js`.
 * 2. Razorpay `pay_...` identifiers NEVER query PostgreSQL UUID columns (`payments.id`, `resource_purchases.id`).
 * 3. Canonical UUID lookup works for `payments.id`, `resource_purchases.id`, and `bookings.id`.
 * 4. All valid booking lookup paths work (`bookings.payment_id`, `bookings.razorpay_order_id`, `bookings.id`).
 * 5. Pre-trim strict validation rejects whitespace, control chars, and PostgREST syntax injection with 400 BEFORE trimming.
 * 6. Guest signed invoice tokens, authenticated owners, and cross-account 403 rejections are preserved.
 * 7. DB lookup errors fail closed (503) when no valid record is established, while optional secondary lookup
 *    failures do NOT turn an already-established authorized record into a 503.
 * 8. Both `/api/payments/invoice/:paymentId` and `/api/payments/credit-note/:paymentId` are verified.
 */

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import express from "express";

// Isolated offline HMAC secrets BEFORE importing server modules
process.env.NODE_ENV = "test";
process.env.ASSET_TOKEN_HMAC_SECRET = "p02-test-asset-secret-min-32-chars-xxxxxxxx";
process.env.RESOURCE_TOKEN_HMAC_SECRET = "p02-test-resource-secret-min-32-chars-xxxxxx";
process.env.INVOICE_TOKEN_HMAC_SECRET = "p02-test-invoice-secret-min-32-chars-xxxxxxx";
process.env.RAZORPAY_KEY_ID = "";
process.env.RAZORPAY_KEY_SECRET = "";
process.env.SUPABASE_URL = "";
process.env.SUPABASE_SERVICE_ROLE_KEY = "";

import {
  setMockSupabaseServerClient,
} from "../server/supabaseServer.js";
import { setMockRazorpayClient } from "../server/razorpay.js";
import paymentRoutes, {
  generateSignedInvoiceToken,
  validateInvoiceLookupIdentifier,
} from "../server/paymentRoutes.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Schema-enforcing UUID columns matching actual PostgreSQL migrations
const UUID_COLUMNS = new Set([
  "payments.id",
  "resource_purchases.id",
]);

let passed = 0;
let failed = 0;

async function runTest(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ PASS: ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err?.stack || err?.message || err}`);
  }
}

/**
 * Strict PostgreSQL schema-enforcing mock Supabase client:
 * - Throws immediately if `.or(...)` is ever called.
 * - Returns PostgreSQL `22P02` error if a non-UUID value is compared against a UUID column.
 * - Logs every `.eq(col, val)` lookup for strict assertion.
 * - Supports per-table/column error injection (returned error or thrown exception).
 */
function createSchemaStrictMockDb(initialData = {}, options = {}) {
  const tables = {
    payments: [...(initialData.payments || [])],
    bookings: [...(initialData.bookings || [])],
    resource_purchases: [...(initialData.resource_purchases || [])],
    credit_notes: [...(initialData.credit_notes || [])],
    profiles: [...(initialData.profiles || [])],
    course_enrollments: [...(initialData.course_enrollments || [])],
  };

  const queryLog = [];
  const tableErrors = options.tableErrors || {}; // { tableName: { code, message } | Error | { throw: Error } }
  const usersByToken = options.usersByToken || {};

  const client = {
    auth: {
      async getUser(token) {
        const u = usersByToken[token] || null;
        if (!u) return { data: { user: null }, error: new Error("Invalid token") };
        return { data: { user: u }, error: null };
      },
    },
    async rpc(fnName) {
      if (fnName === "get_next_invoice_number") {
        return { data: "DM/2026-27/0001", error: null };
      }
      return { data: null, error: null };
    },
    from(table) {
      const filters = [];
      let updatePayload = null;
      let upsertPayload = null;

      const execute = async (mode) => {
        const op = upsertPayload ? "upsert" : (updatePayload ? "update" : "select");
        // Record every eq filter executed
        for (const f of filters) {
          queryLog.push({ op, table, column: f.col, value: f.val });

          // Enforce PostgreSQL UUID column type strictly!
          const fqCol = `${table}.${f.col}`;
          if (UUID_COLUMNS.has(fqCol) && !UUID_REGEX.test(String(f.val ?? ""))) {
            return {
              data: null,
              error: {
                code: "22P02",
                message: `invalid input syntax for type uuid: "${f.val}"`,
              },
            };
          }
        }

        // Inject simulated DB error if configured for this table
        if (tableErrors[table]) {
          const errSpec = tableErrors[table];
          if (errSpec && errSpec.throw) {
            throw errSpec.throw;
          }
          return { data: null, error: errSpec };
        }

        const rows = tables[table] || [];

        if (upsertPayload) {
          const row = { id: "99999999-9999-4999-8999-999999999999", ...upsertPayload };
          rows.push(row);
          return { data: mode === "many" ? [row] : row, error: null };
        }

        const matched = rows.filter((row) =>
          filters.every((f) => String(row[f.col] ?? "") === String(f.val ?? ""))
        );

        if (updatePayload) {
          if (matched.length > 0) {
            Object.assign(matched[0], updatePayload);
          }
          return { data: matched[0] || null, error: null };
        }

        if (mode === "maybeSingle") {
          return { data: matched[0] || null, error: null };
        }
        if (mode === "single") {
          return { data: matched[0] || null, error: matched[0] ? null : { message: "Not found" } };
        }
        return { data: matched, error: null };
      };

      const builder = {
        select() {
          return builder;
        },
        eq(col, val) {
          filters.push({ col, val });
          return builder;
        },
        or(clause) {
          throw new Error(`FORBIDDEN PostgREST .or() called on ${table}: ${clause}`);
        },
        update(payload) {
          updatePayload = payload;
          return builder;
        },
        upsert(payload) {
          upsertPayload = payload;
          return builder;
        },
        maybeSingle() {
          return execute("maybeSingle");
        },
        single() {
          return execute("single");
        },
        then(resolve, reject) {
          return execute("many").then(resolve, reject);
        },
      };

      return builder;
    },
  };

  return { client, queryLog };
}

let reqIpCounter = 1;
function rawRequest(port, rawPath, headers = {}) {
  const ip = `10.99.${Math.floor(reqIpCounter / 250)}.${(reqIpCounter % 250) + 1}`;
  reqIpCounter += 1;
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        method: "GET",
        path: rawPath,
        headers: {
          "X-Forwarded-For": ip,
          ...headers,
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          const text = buf.toString("utf8");
          let json = null;
          try {
            json = JSON.parse(text);
          } catch {}
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            buffer: buf,
            text,
            json,
          });
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

async function main() {
  console.log("=================================================================");
  console.log("DIGITAL MUID V4.3 — P0-2 INVOICE & CREDIT-NOTE LOOKUP TEST SUITE");
  console.log("=================================================================\n");

  // 1. Static source check: ZERO `.or(` calls remain in server/paymentRoutes.js executable code
  await runTest("Static check: server/paymentRoutes.js contains ZERO PostgREST .or() calls", () => {
    const src = fs.readFileSync(path.resolve(process.cwd(), "server/paymentRoutes.js"), "utf8");
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    const matches = codeOnly.match(/\.or\s*\(/g) || [];
    assert.strictEqual(matches.length, 0, `Expected 0 .or() calls in paymentRoutes.js, found ${matches.length}`);
  });

  // 2. Unit tests for pre-trim validateInvoiceLookupIdentifier
  await runTest("validateInvoiceLookupIdentifier rejects leading/trailing whitespace BEFORE trimming", () => {
    for (const bad of [
      "",
      " ",
      " pay_abc123",
      "pay_abc123 ",
      "\tpay_abc123",
      "pay_abc123\n",
      "pay_abc 123",
      "pay_abc,id.eq.1",
      "pay_abc)",
      "pay_abc*",
      "pay_abc.eq.1",
      "../etc/passwd",
      "a".repeat(129),
    ]) {
      const res = validateInvoiceLookupIdentifier(bad);
      assert.strictEqual(res.valid, false, `Expected invalid for ${JSON.stringify(bad)}`);
    }
  });

  await runTest("validateInvoiceLookupIdentifier classifies UUID, pay_, order_, bkg_, and legacy IDs", () => {
    assert.strictEqual(validateInvoiceLookupIdentifier("pay_Q1a2B3c4D5e6F7").kind, "razorpay_payment_id");
    assert.strictEqual(validateInvoiceLookupIdentifier("pay_Q1a2B3c4D5e6F7").isUuid, false);
    assert.strictEqual(validateInvoiceLookupIdentifier("order_Q1a2B3c4D5e6F7").kind, "razorpay_order_id");
    assert.strictEqual(validateInvoiceLookupIdentifier("550e8400-e29b-41d4-a716-446655440000").kind, "uuid");
    assert.strictEqual(validateInvoiceLookupIdentifier("550e8400-e29b-41d4-a716-446655440000").isUuid, true);
    assert.strictEqual(validateInvoiceLookupIdentifier("bkg_550e8400-e29b-41d4-a716-446655440000").kind, "booking_id");
    assert.strictEqual(validateInvoiceLookupIdentifier("BKG-2026-0099").kind, "booking_text_id");
  });

  // Mount real Express router (trust proxy enabled as in server.ts)
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use("/api/payments", paymentRoutes);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  // Common fixture identities
  const OWNER_USER = { id: "user-owner-111", email: "owner@example.com", user_metadata: { full_name: "Owner User" } };
  const OTHER_USER = { id: "user-other-222", email: "attacker@example.com", user_metadata: { full_name: "Other User" } };
  const USERS_BY_TOKEN = {
    "tok-owner": OWNER_USER,
    "tok-other": OTHER_USER,
  };

  const PAYMENT_UUID = "11111111-2222-4333-8444-555555555555";
  const REFUNDED_PAYMENT_UUID = "22222222-3333-4444-8555-666666666666";
  const RESOURCE_UUID = "33333333-4444-4555-8666-777777777777";
  const BOOKING_UUID = "44444444-5555-4666-8777-888888888888";
  const BOOKING_BKG_ID = "bkg_55555555-6666-4777-8888-999999999999";
  const BOOKING_LEGACY_ID = "BKG-2026-0099";

  const BASE_FIXTURES = {
    payments: [
      {
        id: PAYMENT_UUID,
        user_id: OWNER_USER.id,
        customer_email: OWNER_USER.email,
        razorpay_payment_id: "pay_LiveRzp0001",
        razorpay_order_id: "order_LiveRzp0001",
        item_type: "resource",
        item_id: "meta-ads-campaign-planner-bundle",
        item_title: "Meta Ads Campaign Planner Bundle",
        amount: 999,
        currency: "INR",
        status: "captured",
        invoice_number: "DM/2026-27/0101",
        created_at: "2026-05-01T10:00:00.000Z",
      },
      {
        id: REFUNDED_PAYMENT_UUID,
        user_id: OWNER_USER.id,
        customer_email: OWNER_USER.email,
        razorpay_payment_id: "pay_Refunded0002",
        razorpay_order_id: "order_Refunded0002",
        item_type: "course",
        item_id: "meta-ads-mastery",
        item_title: "Meta Ads Mastery",
        amount: 4999,
        currency: "INR",
        status: "refunded",
        refund_id: "rfnd_RealRefund0002",
        invoice_number: "DM/2026-27/0102",
        credit_note_number: "CN/2026-27/0002",
        created_at: "2026-05-02T10:00:00.000Z",
      },
    ],
    credit_notes: [
      {
        id: "77777777-8888-4999-8aaa-bbbbbbbbbbbb",
        payment_id: "pay_Refunded0002",
        refund_id: "rfnd_RealRefund0002",
        amount: 4999,
        credit_note_number: "CN/2026-27/0002",
        created_at: "2026-05-03T10:00:00.000Z",
      },
    ],
    resource_purchases: [
      {
        id: RESOURCE_UUID,
        user_id: OWNER_USER.id,
        customer_email: OWNER_USER.email,
        customer_name: "Owner User",
        resource_id: "meta-ads-campaign-planner-bundle",
        razorpay_payment_id: "pay_LiveRzp0001",
        razorpay_order_id: "order_LiveRzp0001",
        amount: 999,
        currency: "INR",
        created_at: "2026-05-01T10:00:00.000Z",
      },
    ],
    bookings: [
      {
        id: BOOKING_UUID,
        user_id: OWNER_USER.id,
        customer_email: OWNER_USER.email,
        customer_name: "Owner User",
        payment_id: "pay_BookingUuid01",
        razorpay_order_id: "order_BookingUuid01",
        payment_status: "captured",
        total_amount: 1999,
        currency: "INR",
        invoice_number: "DM/2026-27/0201",
        created_at: "2026-05-04T10:00:00.000Z",
      },
      {
        id: BOOKING_BKG_ID,
        user_id: OWNER_USER.id,
        customer_email: OWNER_USER.email,
        customer_name: "Owner User",
        payment_id: "pay_BookingBkg02",
        razorpay_order_id: "order_BookingBkg02",
        payment_status: "captured",
        total_amount: 2499,
        currency: "INR",
        invoice_number: "DM/2026-27/0202",
        created_at: "2026-05-05T10:00:00.000Z",
      },
      {
        id: BOOKING_LEGACY_ID,
        user_id: OWNER_USER.id,
        customer_email: OWNER_USER.email,
        customer_name: "Owner User",
        payment_id: "pay_BookingLegacy03",
        razorpay_order_id: "order_BookingLegacy03",
        payment_status: "paid",
        total_amount: 1499,
        currency: "INR",
        invoice_number: "DM/2026-27/0203",
        created_at: "2026-05-06T10:00:00.000Z",
      },
    ],
  };

  function installMock(fixtures = BASE_FIXTURES, tableErrors = {}) {
    const mock = createSchemaStrictMockDb(fixtures, { usersByToken: USERS_BY_TOKEN, tableErrors });
    setMockSupabaseServerClient(mock.client);
    setMockRazorpayClient(null);
    return mock;
  }

  try {
    // 3. Razorpay pay_... lookup on invoice (authenticated owner & guest signed token)
    await runTest("Invoice lookup by Razorpay pay_... succeeds for owner and NEVER queries UUID columns for lookup", async () => {
      const mock = installMock();
      const res = await rawRequest(port, "/api/payments/invoice/pay_LiveRzp0001?format=json", {
        Authorization: "Bearer tok-owner",
      });
      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}: ${res.text}`);
      assert.strictEqual(res.json.success, true);
      assert.strictEqual(res.json.invoice.invoiceNumber, "DM/2026-27/0101");

      // Confirm ZERO SELECT queries touched UUID columns and ZERO queries ever passed a non-UUID to a UUID column
      const uuidSelectQueries = mock.queryLog.filter(
        (q) => q.op === "select" && UUID_COLUMNS.has(`${q.table}.${q.column}`)
      );
      assert.strictEqual(uuidSelectQueries.length, 0, `Expected 0 UUID SELECT queries for pay_..., got ${JSON.stringify(uuidSelectQueries)}`);
      const invalidUuidQueries = mock.queryLog.filter(
        (q) => UUID_COLUMNS.has(`${q.table}.${q.column}`) && !UUID_REGEX.test(String(q.value ?? ""))
      );
      assert.strictEqual(invalidUuidQueries.length, 0, `Non-UUID queried on UUID column: ${JSON.stringify(invalidUuidQueries)}`);
    });

    await runTest("Invoice lookup by Razorpay pay_... succeeds with valid guest signed token (JSON & PDF)", async () => {
      installMock();
      const token = generateSignedInvoiceToken("pay_LiveRzp0001");
      const jsonRes = await rawRequest(
        port,
        `/api/payments/invoice/pay_LiveRzp0001?format=json&token=${encodeURIComponent(token)}`
      );
      assert.strictEqual(jsonRes.status, 200, `Expected 200 JSON, got ${jsonRes.status}: ${jsonRes.text}`);
      assert.strictEqual(jsonRes.json.invoice.invoiceNumber, "DM/2026-27/0101");

      const pdfRes = await rawRequest(
        port,
        `/api/payments/invoice/pay_LiveRzp0001?token=${encodeURIComponent(token)}`
      );
      assert.strictEqual(pdfRes.status, 200, `Expected 200 PDF, got ${pdfRes.status}`);
      assert.strictEqual(pdfRes.buffer.subarray(0, 4).toString("ascii"), "%PDF");
    });

    // 4. Credit-note lookup by Razorpay pay_... AND canonical UUID payments.id
    await runTest("Credit-note lookup by Razorpay pay_... succeeds without querying UUID columns", async () => {
      const mock = installMock();
      const res = await rawRequest(port, "/api/payments/credit-note/pay_Refunded0002?format=json", {
        Authorization: "Bearer tok-owner",
      });
      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}: ${res.text}`);
      assert.strictEqual(res.json.success, true);
      assert.strictEqual(res.json.creditNote.creditNoteNumber, "CN/2026-27/0002");

      const uuidSelectQueries = mock.queryLog.filter(
        (q) => q.op === "select" && UUID_COLUMNS.has(`${q.table}.${q.column}`)
      );
      assert.strictEqual(uuidSelectQueries.length, 0);
    });

    await runTest("Credit-note lookup by canonical UUID payments.id succeeds", async () => {
      const mock = installMock();
      const res = await rawRequest(port, `/api/payments/credit-note/${REFUNDED_PAYMENT_UUID}?format=json`, {
        Authorization: "Bearer tok-owner",
      });
      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}: ${res.text}`);
      assert.strictEqual(res.json.creditNote.creditNoteNumber, "CN/2026-27/0002");
      assert.ok(mock.queryLog.some((q) => q.table === "payments" && q.column === "id" && q.value === REFUNDED_PAYMENT_UUID));
    });

    // 5. Canonical UUID lookups (payments.id and resource_purchases.id)
    await runTest("Invoice lookup by canonical UUID payments.id succeeds", async () => {
      const mock = installMock();
      const res = await rawRequest(port, `/api/payments/invoice/${PAYMENT_UUID}?format=json`, {
        Authorization: "Bearer tok-owner",
      });
      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}: ${res.text}`);
      assert.strictEqual(res.json.invoice.invoiceNumber, "DM/2026-27/0101");
      assert.ok(mock.queryLog.some((q) => q.table === "payments" && q.column === "id" && q.value === PAYMENT_UUID));
    });

    await runTest("Invoice lookup by canonical UUID resource_purchases.id enriches payments ledger and succeeds", async () => {
      const mock = installMock();
      const res = await rawRequest(port, `/api/payments/invoice/${RESOURCE_UUID}?format=json`, {
        Authorization: "Bearer tok-owner",
      });
      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}: ${res.text}`);
      assert.strictEqual(res.json.invoice.invoiceNumber, "DM/2026-27/0101");
      assert.ok(mock.queryLog.some((q) => q.table === "resource_purchases" && q.column === "id" && q.value === RESOURCE_UUID));
    });

    // 6. All valid booking lookup paths (payment_id, razorpay_order_id, UUID id, bkg_ id, legacy text id)
    await runTest("Booking lookup by bookings.payment_id (pay_...) succeeds without UUID queries", async () => {
      const mock = installMock();
      const res = await rawRequest(port, "/api/payments/invoice/pay_BookingUuid01?format=json", {
        Authorization: "Bearer tok-owner",
      });
      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}: ${res.text}`);
      assert.strictEqual(res.json.invoice.invoiceNumber, "DM/2026-27/0201");
      assert.strictEqual(mock.queryLog.filter((q) => UUID_COLUMNS.has(`${q.table}.${q.column}`)).length, 0);
    });

    await runTest("Booking lookup by bookings.razorpay_order_id (order_...) succeeds without UUID queries", async () => {
      const mock = installMock();
      const res = await rawRequest(port, "/api/payments/invoice/order_BookingBkg02?format=json", {
        Authorization: "Bearer tok-owner",
      });
      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}: ${res.text}`);
      assert.strictEqual(res.json.invoice.invoiceNumber, "DM/2026-27/0202");
      assert.strictEqual(mock.queryLog.filter((q) => UUID_COLUMNS.has(`${q.table}.${q.column}`)).length, 0);
    });

    await runTest("Booking lookup by UUID bookings.id succeeds", async () => {
      installMock();
      const res = await rawRequest(port, `/api/payments/invoice/${BOOKING_UUID}?format=json`, {
        Authorization: "Bearer tok-owner",
      });
      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}: ${res.text}`);
      assert.strictEqual(res.json.invoice.invoiceNumber, "DM/2026-27/0201");
    });

    await runTest("Booking lookup by bkg_<uuid> bookings.id succeeds without touching UUID columns", async () => {
      const mock = installMock();
      const res = await rawRequest(port, `/api/payments/invoice/${BOOKING_BKG_ID}?format=json`, {
        Authorization: "Bearer tok-owner",
      });
      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}: ${res.text}`);
      assert.strictEqual(res.json.invoice.invoiceNumber, "DM/2026-27/0202");
      assert.strictEqual(mock.queryLog.filter((q) => UUID_COLUMNS.has(`${q.table}.${q.column}`)).length, 0);
    });

    await runTest("Booking lookup by legacy text bookings.id succeeds without touching UUID columns", async () => {
      const mock = installMock();
      const res = await rawRequest(port, `/api/payments/invoice/${BOOKING_LEGACY_ID}?format=json`, {
        Authorization: "Bearer tok-owner",
      });
      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}: ${res.text}`);
      assert.strictEqual(res.json.invoice.invoiceNumber, "DM/2026-27/0203");
      assert.strictEqual(mock.queryLog.filter((q) => UUID_COLUMNS.has(`${q.table}.${q.column}`)).length, 0);
    });

    // 7. Pre-trim strict validation rejects malformed/untrimmed/PostgREST-injection inputs with 400 (0 DB queries)
    const invalidEncodedParams = [
      "%20pay_LiveRzp0001",
      "pay_LiveRzp0001%20",
      "pay_LiveRzp%200001",
      "pay_LiveRzp0001,id.eq.11111111-2222-4333-8444-555555555555",
      "pay_LiveRzp0001)",
      "pay_LiveRzp0001*",
      "pay_LiveRzp0001%0a",
      "a".repeat(129),
    ];

    for (const badParam of invalidEncodedParams) {
      await runTest(`Rejects invalid paymentId before trimming (400, 0 DB queries): ${badParam.slice(0, 40)}`, async () => {
        const mock = installMock();
        const invRes = await rawRequest(port, `/api/payments/invoice/${badParam}?format=json`, {
          Authorization: "Bearer tok-owner",
        });
        assert.strictEqual(invRes.status, 400, `Expected 400 on invoice for ${badParam}, got ${invRes.status}`);
        assert.strictEqual(invRes.json?.code, "INVALID_PAYMENT_REFERENCE");

        const cnRes = await rawRequest(port, `/api/payments/credit-note/${badParam}?format=json`, {
          Authorization: "Bearer tok-owner",
        });
        assert.strictEqual(cnRes.status, 400, `Expected 400 on credit-note for ${badParam}, got ${cnRes.status}`);
        assert.strictEqual(mock.queryLog.length, 0, "Invalid paymentId must be rejected BEFORE issuing any DB query");
      });
    }

    // 8. Authorization & cross-account rejection preserved on BOTH invoice and credit-note
    await runTest("Unauthenticated request rejected (401) on invoice and credit-note", async () => {
      installMock();
      const invRes = await rawRequest(port, "/api/payments/invoice/pay_LiveRzp0001?format=json");
      assert.strictEqual(invRes.status, 401);
      const cnRes = await rawRequest(port, "/api/payments/credit-note/pay_Refunded0002?format=json");
      assert.strictEqual(cnRes.status, 401);
    });

    await runTest("Tampered or mismatched guest token rejected (401)", async () => {
      installMock();
      const wrongPayToken = generateSignedInvoiceToken("pay_OtherPayment");
      const r1 = await rawRequest(
        port,
        `/api/payments/invoice/pay_LiveRzp0001?format=json&token=${encodeURIComponent(wrongPayToken)}`
      );
      assert.strictEqual(r1.status, 401);

      const validToken = generateSignedInvoiceToken("pay_LiveRzp0001");
      const r2 = await rawRequest(
        port,
        `/api/payments/invoice/pay_LiveRzp0001?format=json&token=${encodeURIComponent(validToken + "x")}`
      );
      assert.strictEqual(r2.status, 401);
    });

    await runTest("Test A: Expired signed invoice token rejected (401) on both invoice and credit-note endpoints with no document generated", async () => {
      const mock = installMock();

      // Generate genuinely HMAC-signed tokens with expiry timestamps in the past (-60s)
      const expiredInvoiceToken = generateSignedInvoiceToken("pay_LiveRzp0001", -60_000);
      const expiredCreditNoteToken = generateSignedInvoiceToken("pay_Refunded0002", -60_000);

      const [invExpStr] = expiredInvoiceToken.split(".");
      const [cnExpStr] = expiredCreditNoteToken.split(".");
      assert.ok(Number(invExpStr) < Date.now(), "Invoice token expiry must be in the past");
      assert.ok(Number(cnExpStr) < Date.now(), "Credit-note token expiry must be in the past");

      // 1. Invoice endpoint (JSON & PDF) without Bearer auth -> 401, no invoice generated
      const invJsonRes = await rawRequest(
        port,
        `/api/payments/invoice/pay_LiveRzp0001?format=json&token=${encodeURIComponent(expiredInvoiceToken)}`
      );
      assert.strictEqual(invJsonRes.status, 401, `Expected 401 for expired invoice token (JSON), got ${invJsonRes.status}`);
      assert.strictEqual(invJsonRes.json?.success, false);
      assert.strictEqual(invJsonRes.json?.invoice, undefined, "No invoice JSON payload may be returned");

      const invPdfRes = await rawRequest(
        port,
        `/api/payments/invoice/pay_LiveRzp0001?token=${encodeURIComponent(expiredInvoiceToken)}`
      );
      assert.strictEqual(invPdfRes.status, 401, `Expected 401 for expired invoice token (PDF), got ${invPdfRes.status}`);
      assert.notStrictEqual(invPdfRes.buffer.subarray(0, 4).toString("ascii"), "%PDF", "No invoice PDF may be generated");

      // 2. Credit-note endpoint (JSON & PDF) without Bearer auth -> 401, no credit note generated
      const cnJsonRes = await rawRequest(
        port,
        `/api/payments/credit-note/pay_Refunded0002?format=json&token=${encodeURIComponent(expiredCreditNoteToken)}`
      );
      assert.strictEqual(cnJsonRes.status, 401, `Expected 401 for expired credit-note token (JSON), got ${cnJsonRes.status}`);
      assert.strictEqual(cnJsonRes.json?.success, false);
      assert.strictEqual(cnJsonRes.json?.creditNote, undefined, "No credit-note JSON payload may be returned");

      const cnPdfRes = await rawRequest(
        port,
        `/api/payments/credit-note/pay_Refunded0002?token=${encodeURIComponent(expiredCreditNoteToken)}`
      );
      assert.strictEqual(cnPdfRes.status, 401, `Expected 401 for expired credit-note token (PDF), got ${cnPdfRes.status}`);
      assert.notStrictEqual(cnPdfRes.buffer.subarray(0, 4).toString("ascii"), "%PDF", "No credit-note PDF may be generated");

      // Auth fails closed before touching the database
      assert.strictEqual(mock.queryLog.length, 0, "Expired unauthenticated token must be rejected before any DB query");
    });

    await runTest("Cross-account user rejected (403) across pay_, UUID, resource UUID, booking ID, and credit-note", async () => {
      installMock();
      const crossPaths = [
        "/api/payments/invoice/pay_LiveRzp0001?format=json",
        `/api/payments/invoice/${PAYMENT_UUID}?format=json`,
        `/api/payments/invoice/${RESOURCE_UUID}?format=json`,
        `/api/payments/invoice/${BOOKING_BKG_ID}?format=json`,
        "/api/payments/credit-note/pay_Refunded0002?format=json",
        `/api/payments/credit-note/${REFUNDED_PAYMENT_UUID}?format=json`,
      ];
      for (const p of crossPaths) {
        const res = await rawRequest(port, p, { Authorization: "Bearer tok-other" });
        assert.strictEqual(res.status, 403, `Expected 403 cross-account rejection for ${p}, got ${res.status}`);
      }
    });

    // 9. Fail-closed DB error handling (503) when no valid record is established
    await runTest("Primary DB error with no established record fails closed with 503 on invoice & credit-note", async () => {
      installMock(
        { payments: [], bookings: [], resource_purchases: [] },
        { payments: { code: "08006", message: "connection failure" } }
      );
      const invRes = await rawRequest(port, "/api/payments/invoice/pay_MissingBecauseDbDown?format=json", {
        Authorization: "Bearer tok-owner",
      });
      assert.strictEqual(invRes.status, 503, `Expected 503 fail-closed, got ${invRes.status}: ${invRes.text}`);
      assert.strictEqual(invRes.json?.code, "DATABASE_LOOKUP_FAILED");

      const cnRes = await rawRequest(port, "/api/payments/credit-note/pay_MissingBecauseDbDown?format=json", {
        Authorization: "Bearer tok-owner",
      });
      assert.strictEqual(cnRes.status, 503, `Expected 503 on credit-note, got ${cnRes.status}: ${cnRes.text}`);
      assert.strictEqual(cnRes.json?.code, "DATABASE_LOOKUP_FAILED");
    });

    await runTest("Thrown DB exception with no established record fails closed with 503", async () => {
      installMock(
        { payments: [], bookings: [], resource_purchases: [] },
        { bookings: { throw: new Error("ECONNRESET") } }
      );
      const res = await rawRequest(port, `/api/payments/invoice/${BOOKING_BKG_ID}?format=json`, {
        Authorization: "Bearer tok-owner",
      });
      assert.strictEqual(res.status, 503, `Expected 503 on thrown DB error, got ${res.status}: ${res.text}`);
      assert.strictEqual(res.json?.code, "DATABASE_LOOKUP_FAILED");
    });

    // 10. Optional secondary lookup failure MUST NOT turn an established authorized record into 503
    await runTest("Optional secondary table failure does NOT break established authorized payment record (200 on invoice)", async () => {
      installMock(BASE_FIXTURES, {
        bookings: { code: "57014", message: "statement timeout on bookings" },
        resource_purchases: { throw: new Error("transient resource_purchases timeout") },
      });
      const res = await rawRequest(port, "/api/payments/invoice/pay_LiveRzp0001?format=json", {
        Authorization: "Bearer tok-owner",
      });
      assert.strictEqual(res.status, 200, `Expected 200 when payments record is established, got ${res.status}: ${res.text}`);
      assert.strictEqual(res.json.invoice.invoiceNumber, "DM/2026-27/0101");
    });

    await runTest("Optional secondary table failure does NOT break established authorized credit-note record (200)", async () => {
      installMock(BASE_FIXTURES, {
        bookings: { code: "57014", message: "bookings unavailable" },
        resource_purchases: { code: "57014", message: "resource_purchases unavailable" },
      });
      const res = await rawRequest(port, "/api/payments/credit-note/pay_Refunded0002?format=json", {
        Authorization: "Bearer tok-owner",
      });
      assert.strictEqual(res.status, 200, `Expected 200 on credit-note, got ${res.status}: ${res.text}`);
      assert.strictEqual(res.json.creditNote.creditNoteNumber, "CN/2026-27/0002");
    });

    await runTest("Optional secondary enrichment failure does NOT break UUID payments.id or bkg_ booking lookup (200)", async () => {
      installMock(BASE_FIXTURES, {
        bookings: { code: "57014", message: "bookings timeout" },
        resource_purchases: { code: "57014", message: "resource_purchases timeout" },
      });
      const uuidRes = await rawRequest(port, `/api/payments/invoice/${PAYMENT_UUID}?format=json`, {
        Authorization: "Bearer tok-owner",
      });
      assert.strictEqual(uuidRes.status, 200, `Expected 200 for UUID payments.id, got ${uuidRes.status}`);

      installMock(BASE_FIXTURES, {
        payments: { code: "57014", message: "payments timeout during optional enrichment" },
      });
      const bkgRes = await rawRequest(port, `/api/payments/invoice/${BOOKING_BKG_ID}?format=json`, {
        Authorization: "Bearer tok-owner",
      });
      assert.strictEqual(bkgRes.status, 200, `Expected 200 for established captured booking, got ${bkgRes.status}: ${bkgRes.text}`);
      assert.strictEqual(bkgRes.json.invoice.invoiceNumber, "DM/2026-27/0202");
    });

    await runTest("Resource record found while payments ledger errors fails closed with 503 (cannot verify capture)", async () => {
      installMock(BASE_FIXTURES, {
        payments: { code: "08006", message: "payments DB unavailable" },
      });
      const res = await rawRequest(port, `/api/payments/invoice/${RESOURCE_UUID}?format=json`, {
        Authorization: "Bearer tok-owner",
      });
      assert.strictEqual(res.status, 503, `Expected 503 when capture verification DB failed, got ${res.status}: ${res.text}`);
      assert.strictEqual(res.json?.code, "DATABASE_LOOKUP_FAILED");
    });

    await runTest("Non-existent valid identifier with zero DB errors cleanly returns 404", async () => {
      installMock();
      const res = await rawRequest(port, "/api/payments/invoice/pay_DoesNotExist999?format=json", {
        Authorization: "Bearer tok-owner",
      });
      assert.strictEqual(res.status, 404);
    });
  } finally {
    setMockSupabaseServerClient(null);
    setMockRazorpayClient(null);
    await new Promise((resolve) => server.close(resolve));
  }

  console.log(`\nSummary: ${passed} passed, ${failed} failed (total ${passed + failed})`);
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal P0-2 test error:", err);
  process.exit(1);
});
