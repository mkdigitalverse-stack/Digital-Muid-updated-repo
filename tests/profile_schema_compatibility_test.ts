/**
 * DIGITALMUID V4.3 — PROFILE SCHEMA COMPATIBILITY REGRESSION TEST SUITE
 *
 * Strictly isolated local test suite (zero external network or production calls).
 * Simulates the verified live Supabase `public.profiles` schema (8 columns only:
 * id, full_name, avatar_url, phone, headline, bio, created_at, updated_at) and
 * fails closed if any code sends or selects undeployed V4.3 columns
 * (student_id, state, billing_address).
 */

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import express from "express";

// Configure isolated test environment BEFORE importing safety-gated server modules
process.env.NODE_ENV = "test";
process.env.APP_ENV = "test";
process.env.FORCE_DEV_SAFETY = "true";
process.env.SUPABASE_URL = "https://isolated-test-sandbox.supabase.co";
process.env.VITE_SUPABASE_URL = "https://isolated-test-sandbox.supabase.co";
process.env.ALLOW_STAGING_TEST_WRITES = "true";
process.env.RAZORPAY_KEY_ID = "rzp_test_profile_compat_123";
process.env.RAZORPAY_KEY_SECRET = "rzp_test_secret_at_least_32_bytes_long_99999";
process.env.RAZORPAY_WEBHOOK_SECRET = "whsec_test_profile_compat_987654321";
process.env.INVOICE_TOKEN_HMAC_SECRET = "inv_hmac_test_secret_entropy_32_bytes_minimum_ok!";

const LIVE_PROFILE_COLUMNS = new Set([
  "id",
  "full_name",
  "avatar_url",
  "phone",
  "headline",
  "bio",
  "created_at",
  "updated_at"
]);

const { profileService, buildProfileUpdatePayload, mapProfileFromDb } = await import("../src/services/profileService.ts");
const { default: paymentRoutes, resetPaymentRateLimits } = await import("../server/paymentRoutes.js");
const { setMockSupabaseServerClient } = await import("../server/supabaseServer.js");
const { setMockRazorpayClient } = await import("../server/razorpay.js");
const { determinePlaceOfSupply } = await import("../server/invoiceService.js");

/**
 * Creates a strict Supabase-like mock client for public.profiles that enforces
 * PostgREST PGRST204 behavior when any undeployed column is queried or written.
 */
function createLiveSchemaProfileClient(initialRow: Record<string, any>) {
  const row = { ...initialRow };
  const observedUpdatePayloads: Record<string, any>[] = [];
  const observedSelectColumns: string[] = [];

  return {
    row,
    observedUpdatePayloads,
    observedSelectColumns,
    from(table: string) {
      assert.strictEqual(table, "profiles");
      let updatePayload: Record<string, any> | null = null;
      let targetId: string | null = null;

      const builder: any = {
        update(payload: Record<string, any>) {
          observedUpdatePayloads.push({ ...payload });
          for (const key of Object.keys(payload)) {
            if (!LIVE_PROFILE_COLUMNS.has(key)) {
              return {
                eq: () => ({
                  select: () => ({
                    single: async () => ({
                      data: null,
                      error: {
                        code: "PGRST204",
                        message: `Could not find the '${key}' column of 'profiles' in the schema cache`
                      }
                    })
                  })
                })
              };
            }
          }
          updatePayload = payload;
          return builder;
        },
        eq(col: string, val: string) {
          if (col === "id") targetId = val;
          return builder;
        },
        select(cols: string) {
          observedSelectColumns.push(cols);
          if (cols !== "*") {
            const requested = cols.split(",").map((s) => s.trim()).filter(Boolean);
            for (const c of requested) {
              if (!LIVE_PROFILE_COLUMNS.has(c)) {
                return {
                  eq: () => ({
                    maybeSingle: async () => ({
                      data: null,
                      error: {
                        code: "PGRST204",
                        message: `Could not find the '${c}' column of 'profiles' in the schema cache`
                      }
                    })
                  }),
                  maybeSingle: async () => ({
                    data: null,
                    error: {
                      code: "PGRST204",
                      message: `Could not find the '${c}' column of 'profiles' in the schema cache`
                    }
                  }),
                  single: async () => ({
                    data: null,
                    error: {
                      code: "PGRST204",
                      message: `Could not find the '${c}' column of 'profiles' in the schema cache`
                    }
                  })
                };
              }
            }
          }
          return builder;
        },
        async single() {
          if (updatePayload && targetId === row.id) {
            Object.assign(row, updatePayload);
          }
          return { data: { ...row }, error: null };
        },
        async maybeSingle() {
          if (targetId !== row.id) return { data: null, error: null };
          return { data: { ...row }, error: null };
        }
      };

      return builder;
    }
  };
}

/**
 * Creates a full mock DB for Express payment/invoice routes whose `profiles` table
 * enforces the strict 8-column live schema (no student_id, state, billing_address).
 */
function createInvoiceMockDb({ bookingState = "" }: { bookingState?: string } = {}) {
  const userId = "10000000-0000-4000-8000-000000000001";
  const otherUserId = "10000000-0000-4000-8000-000000000002";

  const db = {
    profiles: [
      {
        id: userId,
        full_name: "Arjun Mehta",
        avatar_url: "https://example.com/arjun.png",
        phone: "+919876543210",
        headline: "Marketing Lead",
        bio: "Performance marketer",
        created_at: "2026-10-01T10:00:00Z",
        updated_at: "2026-10-01T10:00:00Z"
      }
    ],
    payments: [
      {
        id: "20000000-0000-4000-8000-000000000001",
        user_id: userId,
        item_type: "consultation",
        item_id: "31bbb9bf-ce10-4da4-a517-dfc673f9b875",
        item_title: "Business Growth Strategy Consultation",
        amount: 1180,
        currency: "INR",
        razorpay_order_id: "order_live_schema_01",
        razorpay_payment_id: "pay_live_schema_01",
        invoice_number: "DM/26-27/0101",
        status: "captured",
        created_at: "2026-11-10T10:00:00Z",
        updated_at: "2026-11-10T10:00:00Z"
      },
      {
        id: "20000000-0000-4000-8000-000000000002",
        user_id: userId,
        item_type: "course",
        item_id: "11111111-1111-4111-8111-111111111111",
        item_title: "Meta Ads Mastery",
        amount: 1180,
        currency: "INR",
        razorpay_order_id: "order_live_refund_02",
        razorpay_payment_id: "pay_live_refund_02",
        invoice_number: "DM/26-27/0102",
        credit_note_number: "CN/26-27/0010",
        refund_id: "rfnd_live_schema_02",
        status: "refunded",
        created_at: "2026-11-10T10:00:00Z",
        updated_at: "2026-11-12T10:00:00Z"
      }
    ],
    bookings: bookingState
      ? [
          {
            id: "30000000-0000-4000-8000-000000000001",
            user_id: userId,
            payment_id: "pay_live_schema_01",
            razorpay_order_id: "order_live_schema_01",
            payment_status: "captured",
            customer_email: "owner@example.com",
            customer_state: bookingState,
            total_amount: 1180,
            currency: "INR",
            created_at: "2026-11-10T10:00:00Z"
          }
        ]
      : [],
    resource_purchases: [],
    credit_notes: [
      {
        id: "40000000-0000-4000-8000-000000000001",
        payment_id: "pay_live_refund_02",
        refund_id: "rfnd_live_schema_02",
        amount: 1180,
        credit_note_number: "CN/26-27/0010",
        reason: "Course withdrawal refund",
        created_at: "2026-11-12T10:00:00Z"
      }
    ],
    course_enrollments: []
  };

  const tokens: Record<string, any> = {
    "token-owner-1": {
      id: userId,
      email: "owner@example.com",
      email_confirmed_at: "2026-01-01T00:00:00Z",
      user_metadata: {},
      app_metadata: {}
    },
    "token-other-2": {
      id: otherUserId,
      email: "other@example.com",
      email_confirmed_at: "2026-01-01T00:00:00Z",
      user_metadata: {},
      app_metadata: {}
    }
  };

  const profileQueries: string[] = [];

  function makeQueryBuilder(table: keyof typeof db) {
    const filters: Array<{ type: string; col: string; val: any }> = [];
    let orClause: string | null = null;
    let selectedCols = "*";

    const matchRow = (r: Record<string, any>) => {
      for (const f of filters) {
        if (f.type === "eq" && r[f.col] !== f.val) return false;
      }
      if (orClause) {
        const clauses = orClause.split(",").map((s) => s.trim());
        const matched = clauses.some((c) => {
          const m = c.match(/^([^.]+)\.eq\.(.+)$/);
          return m ? String(r[m[1]] ?? "") === String(m[2]) : false;
        });
        if (!matched) return false;
      }
      return true;
    };

    const validateColumns = () => {
      if (table === "profiles" && selectedCols !== "*") {
        const cols = selectedCols.split(",").map((s) => s.trim()).filter(Boolean);
        for (const c of cols) {
          if (!LIVE_PROFILE_COLUMNS.has(c)) {
            return {
              code: "PGRST204",
              message: `Could not find the '${c}' column of 'profiles' in the schema cache`
            };
          }
        }
      }
      return null;
    };

    const builder: any = {
      select(cols = "*") {
        selectedCols = cols;
        if (table === "profiles") profileQueries.push(cols);
        return builder;
      },
      eq(col: string, val: any) {
        filters.push({ type: "eq", col, val });
        return builder;
      },
      or(clause: string) {
        orClause = clause;
        return builder;
      },
      async maybeSingle() {
        const colErr = validateColumns();
        if (colErr) return { data: null, error: colErr };
        const matched = (db[table] as any[]).filter(matchRow);
        return { data: matched[0] || null, error: null };
      },
      async single() {
        const colErr = validateColumns();
        if (colErr) return { data: null, error: colErr };
        const matched = (db[table] as any[]).filter(matchRow);
        return { data: matched[0] || null, error: matched[0] ? null : { message: "Not found" } };
      },
      then(resolve: any) {
        const colErr = validateColumns();
        if (colErr) return Promise.resolve({ data: null, error: colErr }).then(resolve);
        const matched = (db[table] as any[]).filter(matchRow);
        return Promise.resolve({ data: matched, error: null }).then(resolve);
      }
    };

    return builder;
  }

  return {
    profileQueries,
    client: {
      auth: {
        async getUser(jwt: string) {
          const user = tokens[jwt];
          return user ? { data: { user }, error: null } : { data: { user: null }, error: { message: "Invalid JWT" } };
        }
      },
      from(table: keyof typeof db) {
        return makeQueryBuilder(table);
      },
      async rpc() {
        return { data: null, error: { message: "Not expected in invoice read test" } };
      }
    }
  };
}

let passed = 0;
let failed = 0;

async function runTest(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed++;
    console.log(`[PASS] ${name}`);
  } catch (err: any) {
    failed++;
    console.error(`[FAIL] ${name}:`, err?.stack || err?.message || err);
  }
}

async function main() {
  console.log("==============================================================================");
  console.log("DIGITALMUID V4.3 — CONTROLLED PROFILE SCHEMA COMPATIBILITY REGRESSION SUITE");
  console.log("==============================================================================");

  const baseProfileRow = {
    id: "10000000-0000-4000-8000-000000000001",
    full_name: "Initial Name",
    avatar_url: null,
    phone: null,
    headline: null,
    bio: null,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z"
  };

  // Test 1
  await runTest("1. Student updates full name successfully", async () => {
    const mock = createLiveSchemaProfileClient(baseProfileRow);
    const res = await profileService.updateProfile(baseProfileRow.id, { fullName: "  Muid Khan  " }, mock);
    assert.strictEqual(res.error, null);
    assert.strictEqual(res.data?.fullName, "Muid Khan");
    assert.strictEqual(mock.observedUpdatePayloads[0].full_name, "Muid Khan");
  });

  // Test 2
  await runTest("2. Student updates phone successfully", async () => {
    const mock = createLiveSchemaProfileClient(baseProfileRow);
    const res = await profileService.updateProfile(baseProfileRow.id, { phone: "+91 98765 43210" }, mock);
    assert.strictEqual(res.error, null);
    assert.strictEqual(res.data?.phone, "+91 98765 43210");
  });

  // Test 3
  await runTest("3. Student updates headline successfully", async () => {
    const mock = createLiveSchemaProfileClient(baseProfileRow);
    const res = await profileService.updateProfile(baseProfileRow.id, { headline: "Head of Marketing" }, mock);
    assert.strictEqual(res.error, null);
    assert.strictEqual(res.data?.headline, "Head of Marketing");
  });

  // Test 4
  await runTest("4. Student updates bio successfully", async () => {
    const mock = createLiveSchemaProfileClient(baseProfileRow);
    const res = await profileService.updateProfile(baseProfileRow.id, { bio: "Building scalable funnels." }, mock);
    assert.strictEqual(res.error, null);
    assert.strictEqual(res.data?.bio, "Building scalable funnels.");
  });

  // Test 5
  await runTest("5. Student updates avatar successfully", async () => {
    const mock = createLiveSchemaProfileClient(baseProfileRow);
    const res = await profileService.updateProfile(baseProfileRow.id, { avatarUrl: "https://example.com/photo.jpg" }, mock);
    assert.strictEqual(res.error, null);
    assert.strictEqual(res.data?.avatarUrl, "https://example.com/photo.jpg");
  });

  // Test 6
  await runTest("6. Empty optional values are handled correctly (cleared to null without schema error; blank fullName rejected)", async () => {
    const populatedRow = {
      ...baseProfileRow,
      full_name: "Muid Khan",
      phone: "+919999999999",
      headline: "Old Headline",
      bio: "Old Bio",
      avatar_url: "https://example.com/old.jpg"
    };
    const mock = createLiveSchemaProfileClient(populatedRow);
    const res = await profileService.updateProfile(
      populatedRow.id,
      { fullName: "Muid Khan", phone: "   ", headline: "", bio: null, avatarUrl: " " },
      mock
    );
    assert.strictEqual(res.error, null);
    assert.strictEqual(res.data?.phone, null);
    assert.strictEqual(res.data?.headline, null);
    assert.strictEqual(res.data?.bio, null);
    assert.strictEqual(res.data?.avatarUrl, null);

    // Omitted fields are not overwritten when only one field is passed
    const partialMock = createLiveSchemaProfileClient(populatedRow);
    const partialRes = await profileService.updateProfile(populatedRow.id, { fullName: "Updated Only Name" }, partialMock);
    assert.strictEqual(partialRes.error, null);
    assert.strictEqual(partialRes.data?.phone, "+919999999999");
    assert.strictEqual("phone" in partialMock.observedUpdatePayloads[0], false);

    // Blank fullName fails safely before touching DB
    const blankRes = await profileService.updateProfile(populatedRow.id, { fullName: "   " }, partialMock);
    assert.strictEqual(blankRes.data, null);
    assert.ok(blankRes.error);
  });

  // Test 7
  await runTest("7. No unsupported profile columns (state, billing_address, student_id) are sent", async () => {
    const mock = createLiveSchemaProfileClient(baseProfileRow);
    const dirtyInput = {
      fullName: "Muid Khan",
      phone: "+91 9876543210",
      state: "Uttar Pradesh",
      billingAddress: "Hazratganj, Lucknow",
      billing_address: "Hazratganj, Lucknow",
      studentId: "DM-STU-999999",
      student_id: "DM-STU-999999"
    } as any;

    const built = buildProfileUpdatePayload(dirtyInput);
    for (const k of Object.keys(built)) {
      assert.ok(LIVE_PROFILE_COLUMNS.has(k), `Unexpected column '${k}' in update payload`);
    }
    assert.strictEqual("state" in built, false);
    assert.strictEqual("billing_address" in built, false);
    assert.strictEqual("student_id" in built, false);

    const res = await profileService.updateProfile(baseProfileRow.id, dirtyInput, mock);
    assert.strictEqual(res.error, null);
    assert.ok(mock.observedUpdatePayloads.length === 1);
    for (const k of Object.keys(mock.observedUpdatePayloads[0])) {
      assert.ok(LIVE_PROFILE_COLUMNS.has(k), `Disallowed column '${k}' sent to Supabase`);
    }

    // Also verify AppContext and AccountPage contain no unsupported field writes
    const appCtxSrc = fs.readFileSync(path.resolve("src/context/AppContext.tsx"), "utf8");
    const acctSrc = fs.readFileSync(path.resolve("src/pages/AccountPage.tsx"), "utf8");
    assert.strictEqual(appCtxSrc.includes("allowedUpdates.billingAddress"), false);
    assert.strictEqual(appCtxSrc.includes("allowedUpdates.state"), false);
    assert.strictEqual(acctSrc.includes("setBillingAddress"), false);
    assert.strictEqual(acctSrc.includes("setBillingState"), false);
  });

  // Start local HTTP server for Tests 8, 9, 10, 11
  const app = express();
  app.use(express.json());
  app.use("/api/payments", paymentRoutes);
  const server = await new Promise<import("node:http").Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const addr = server.address() as import("node:net").AddressInfo;
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    setMockRazorpayClient({
      payments: {
        async fetch(id: string) {
          return {
            id,
            order_id: id.includes("refund") ? "order_live_refund_02" : "order_live_schema_01",
            status: id.includes("refund") ? "refunded" : "captured",
            amount: 118000,
            currency: "INR",
            email: "owner@example.com"
          };
        }
      }
    });

    // Test 8
    await runTest("8. Invoice lookup retrieves full_name and phone using the existing 8-column live schema", async () => {
      resetPaymentRateLimits();
      const mockDb = createInvoiceMockDb();
      setMockSupabaseServerClient(mockDb.client);

      const res = await fetch(`${baseUrl}/api/payments/invoice/pay_live_schema_01?format=json`, {
        headers: { Authorization: "Bearer token-owner-1" }
      });
      const body = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.invoice.customer.name, "Arjun Mehta");
      assert.strictEqual(body.invoice.customer.phone, "+919876543210");
      assert.ok(body.invoice.customer.studentId.startsWith("DM-STU-"));
      assert.ok(mockDb.profileQueries.includes("full_name, phone"));
      assert.strictEqual(
        mockDb.profileQueries.some((q) => q.includes("billing_address") || q.includes("student_id") || q.includes("state")),
        false
      );
    });

    // Test 9
    await runTest("9. Invoice generation retains existing GST, GSTIN, booking/payment state, and place-of-supply fallback", async () => {
      resetPaymentRateLimits();

      // A. Booking/payment state = Uttar Pradesh => CGST + SGST (Intra-state)
      const upDb = createInvoiceMockDb({ bookingState: "Uttar Pradesh" });
      setMockSupabaseServerClient(upDb.client);
      const upRes = await fetch(`${baseUrl}/api/payments/invoice/pay_live_schema_01?format=json`, {
        headers: { Authorization: "Bearer token-owner-1" }
      });
      const upBody = await upRes.json();
      assert.strictEqual(upRes.status, 200);
      assert.strictEqual(upBody.invoice.payment.isInterState, false);
      assert.strictEqual(upBody.invoice.payment.cgstAmount, 90);
      assert.strictEqual(upBody.invoice.payment.sgstAmount, 90);
      assert.strictEqual(upBody.invoice.payment.igstAmount, 0);

      // B. Unstated fallback => Inter-state IGST under Sec 7(5) / 12(2)
      const unstatedDb = createInvoiceMockDb({ bookingState: "" });
      setMockSupabaseServerClient(unstatedDb.client);
      const unstatedRes = await fetch(`${baseUrl}/api/payments/invoice/pay_live_schema_01?format=json`, {
        headers: { Authorization: "Bearer token-owner-1" }
      });
      const unstatedBody = await unstatedRes.json();
      assert.strictEqual(unstatedRes.status, 200);
      assert.strictEqual(unstatedBody.invoice.payment.isInterState, true);
      assert.strictEqual(unstatedBody.invoice.payment.igstAmount, 180);
      assert.strictEqual(unstatedBody.invoice.customer.stateCode, "99");

      // C. Existing GSTIN state determination preserved
      const b2bPos = determinePlaceOfSupply({ customerGstin: "29ABCDE1234F1Z5" });
      assert.strictEqual(b2bPos.stateCode, "29");
      assert.strictEqual(b2bPos.isInterState, true);
    });

    // Test 10
    await runTest("10. Credit-note generation remains unaffected and preserves profile identity", async () => {
      resetPaymentRateLimits();
      const mockDb = createInvoiceMockDb();
      setMockSupabaseServerClient(mockDb.client);

      const jsonRes = await fetch(`${baseUrl}/api/payments/invoice/pay_live_refund_02?format=json`, {
        headers: { Authorization: "Bearer token-owner-1" }
      });
      const jsonBody = await jsonRes.json();
      assert.strictEqual(jsonRes.status, 200);
      assert.strictEqual(jsonBody.success, true);
      assert.strictEqual(jsonBody.isCreditNote, true);
      assert.strictEqual(jsonBody.creditNote.creditNoteNumber, "CN/26-27/0010");
      assert.strictEqual(jsonBody.creditNote.customer.name, "Arjun Mehta");
      assert.strictEqual(jsonBody.creditNote.customer.phone, "+919876543210");

      const pdfRes = await fetch(`${baseUrl}/api/payments/credit-note/pay_live_refund_02`, {
        headers: { Authorization: "Bearer token-owner-1" }
      });
      assert.strictEqual(pdfRes.status, 200);
      assert.strictEqual(pdfRes.headers.get("content-type"), "application/pdf");
      const pdfBytes = Buffer.from(await pdfRes.arrayBuffer());
      assert.ok(pdfBytes.toString("utf8").startsWith("%PDF-1.4"));
    });

    // Test 11
    await runTest("11. Authorization checks & dashboard/profile compatibility remain intact", async () => {
      resetPaymentRateLimits();
      const mockDb = createInvoiceMockDb();
      setMockSupabaseServerClient(mockDb.client);

      const unauthRes = await fetch(`${baseUrl}/api/payments/invoice/pay_live_schema_01?format=json`);
      assert.strictEqual(unauthRes.status, 401);

      const otherRes = await fetch(`${baseUrl}/api/payments/invoice/pay_live_schema_01?format=json`, {
        headers: { Authorization: "Bearer token-other-2" }
      });
      assert.strictEqual(otherRes.status, 403);

      // mapProfileFromDb still handles live 8-column rows cleanly for dashboard & account pages
      const mapped = mapProfileFromDb(baseProfileRow);
      assert.strictEqual(mapped.id, baseProfileRow.id);
      assert.ok(mapped.studentId?.startsWith("DM-STU-"));
      assert.strictEqual(mapped.state, null);
    });
  } finally {
    setMockSupabaseServerClient(null);
    setMockRazorpayClient(null);
    server.close();
  }

  console.log("\n==============================================================================");
  console.log(`PROFILE SCHEMA COMPATIBILITY REGRESSION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==============================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
