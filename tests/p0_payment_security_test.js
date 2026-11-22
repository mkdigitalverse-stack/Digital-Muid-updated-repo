/**
 * DIGITALMUID V4.3 — P0 PAYMENT SECURITY REMEDIATION TEST SUITE
 *
 * Strictly isolated local HTTP & unit test suite (zero external network, zero SQL execution, zero prod calls).
 * Verifies all P0-1, P0-2, P0-3, and P0-4 security fixes plus regression preservation.
 */

import assert from "node:assert";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import express from "express";

// Configure isolated test environment BEFORE importing safety-gated modules
process.env.NODE_ENV = "test";
process.env.APP_ENV = "test";
process.env.FORCE_DEV_SAFETY = "true";
process.env.SUPABASE_URL = "https://isolated-test-sandbox.supabase.co";
process.env.VITE_SUPABASE_URL = "https://isolated-test-sandbox.supabase.co";
process.env.ALLOW_STAGING_TEST_WRITES = "true";
process.env.RAZORPAY_KEY_ID = "rzp_test_p0_security_12345";
process.env.RAZORPAY_KEY_SECRET = "rzp_test_p0_secret_at_least_32_bytes_long!";
process.env.RAZORPAY_WEBHOOK_SECRET = "whsec_test_p0_security_secret_987654321";
process.env.INVOICE_TOKEN_HMAC_SECRET = "inv_hmac_test_p0_secret_32_bytes_minimum_ok!";
process.env.RESOURCE_TOKEN_HMAC_SECRET = "res_hmac_test_p0_secret_32_bytes_minimum_ok!";

const {
  default: paymentRoutes,
  resetPaymentRateLimits,
  getAuthoritativeResourcePricing,
  evaluateRecordOwnership,
  verifyInvoicePaymentAuthorization
} = await import("../server/paymentRoutes.js");
const { fulfillCourseEnrollment, fulfillConsultationPayment, fulfillResourcePurchase, toPaiseStrict } = await import("../server/paymentFulfillment.js");
const { handleRazorpayWebhook } = await import("../server/paymentWebhook.js");
const { setMockSupabaseServerClient } = await import("../server/supabaseServer.js");
const { setMockRazorpayClient } = await import("../server/razorpay.js");
const { generateGuestResourceToken, verifyGuestResourceToken } = await import("../server/resourceToken.js");

const COURSE_UUID = "11111111-1111-4111-8111-111111111111";
const CONSULTATION_PRODUCT_UUID = "31bbb9bf-ce10-4da4-a517-dfc673f9b875";
const BUNDLE_UUID = "2d50e5e3-711d-4461-a70d-0ed54dd29f17";
const CHEAP_RES_UUID = "fafe5ffc-3323-4761-9d22-50a2588f6326";
const FREE_RES_UUID = "44444444-4444-4444-8444-444444444444";
const DRAFT_RES_UUID = "55555555-5555-4555-8555-555555555555";
const ARCHIVED_RES_UUID = "66666666-6666-4666-8666-666666666666";

const USER_1_ID = "10000000-0000-4000-8000-000000000001";
const USER_2_ID = "10000000-0000-4000-8000-000000000002";
const ADMIN_ID = "10000000-0000-4000-8000-000000000009";

function signRazorpayCheckout(orderId, paymentId) {
  return crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
}

function signRazorpayWebhook(rawBodyBuffer) {
  return crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBodyBuffer)
    .digest("hex");
}

// NOTE: In-memory mock DB does NOT enforce PostgreSQL UNIQUE constraints, row-level FOR UPDATE
// locks, or pg_advisory_xact_lock. Concurrent mock runs test Node/process serialization and
// handler branching ONLY — never PostgreSQL database atomicity.
function createStatefulMockDb({
  simulateMissingConsultationRpc = false,
  simulateMissingResourceRpc = false,
  consultationRpcOverride = null,
  resourceRpcOverride = null,
  courseRpcOverride = null
} = {}) {
  const state = {
    payments: [],
    bookings: [],
    resource_purchases: [],
    credit_notes: [],
    course_enrollments: [],
    profiles: [
      { id: USER_1_ID, full_name: "Arjun Mehta", phone: "+919876543210", email: "owner@example.com" },
      { id: USER_2_ID, full_name: "Neha Kapoor", phone: "+919876500000", email: "other@example.com" }
    ],
    courses: [
      { id: COURSE_UUID, slug: "meta-ads-mastery", title: "Meta Ads Mastery", price: 4999, currency: "INR", status: "published" }
    ],
    resources: [
      { id: BUNDLE_UUID, slug: "meta-ads-campaign-planner-bundle", title: "Meta Ads Campaign Bundle", status: "published", access_type: "paid", price: 299, currency: "INR", file_url: "supabase://resources/paid/bundle.pdf" },
      { id: CHEAP_RES_UUID, slug: "the-ad-budget-breat-even-calculate", title: "Break-Even Calculator", status: "published", access_type: "paid", price: 79, currency: "INR", file_url: "supabase://resources/paid/calc.xlsx" },
      { id: FREE_RES_UUID, slug: "free-meta-checklist", title: "Free Meta Checklist", status: "published", access_type: "free", price: 0, currency: "INR", file_url: "/downloads/META.pdf" },
      { id: DRAFT_RES_UUID, slug: "draft-paid-playbook", title: "Draft Paid Playbook", status: "draft", access_type: "paid", price: 999, currency: "INR", file_url: "supabase://resources/paid/draft.pdf" },
      { id: ARCHIVED_RES_UUID, slug: "archived-paid-kit", title: "Archived Paid Kit", status: "archived", access_type: "paid", price: 499, currency: "INR", file_url: "supabase://resources/paid/archived.pdf" }
    ],
    consultation_products: [
      { id: CONSULTATION_PRODUCT_UUID, name: "Business Growth Consultation", base_price: 499, gst_rate: 0.18, currency: "INR", duration_minutes: 30, active: true }
    ],
    crm_leads: [],
    email_logs: [],
    rpcCalls: [],
    authCreateUserCalls: 0,
    authListUsersCalls: 0,
    failNextInsertTables: [],
    cnSeq: 20,
    invSeq: 900
  };

  const tokens = {
    "token-owner-1": { id: USER_1_ID, email: "owner@example.com", email_confirmed_at: "2026-01-01T00:00:00Z", user_metadata: { full_name: "Arjun Mehta" }, app_metadata: {} },
    "token-other-2": { id: USER_2_ID, email: "other@example.com", email_confirmed_at: "2026-01-01T00:00:00Z", user_metadata: { full_name: "Neha Kapoor" }, app_metadata: {} },
    "token-admin": { id: ADMIN_ID, email: "admin@digitalmuid.com", email_confirmed_at: "2026-01-01T00:00:00Z", user_metadata: {}, app_metadata: { role: "admin" } }
  };

  function makeQueryBuilder(table) {
    let filters = [];
    let orClause = null;
    let op = "select";
    let payload = null;
    let upsertConflict = null;
    let limitCount = null;

    const matchRow = (row) => {
      for (const f of filters) {
        if (f.type === "eq" && row[f.col] !== f.val) return false;
        if (f.type === "in" && (!Array.isArray(f.val) || !f.val.includes(row[f.col]))) return false;
        if (f.type === "gt" && !(Number(row[f.col]) > Number(f.val))) return false;
        if (f.type === "ilike" && !String(row[f.col] || "").toLowerCase().includes(String(f.val).replace(/%/g, "").toLowerCase())) return false;
      }
      if (orClause) {
        const clauses = orClause.split(",").map((s) => s.trim());
        const anyMatch = clauses.some((c) => {
          const m = c.match(/^([^.]+)\.eq\.(.+)$/);
          return m ? String(row[m[1]] ?? "") === String(m[2]) : false;
        });
        if (!anyMatch) return false;
      }
      return true;
    };

    const execute = async (singleMode = null) => {
      const rows = state[table] || [];
      if (op === "select") {
        let matched = rows.filter(matchRow);
        if (typeof limitCount === "number" && limitCount >= 0) {
          matched = matched.slice(0, limitCount);
        }
        if (singleMode === "maybeSingle") return { data: matched[0] || null, error: null };
        if (singleMode === "single") return { data: matched[0] || null, error: matched[0] ? null : { message: "Not found" } };
        return { data: matched, error: null };
      }
      if (op === "insert") {
        const failIdx = state.failNextInsertTables.indexOf(table);
        if (failIdx >= 0) {
          state.failNextInsertTables.splice(failIdx, 1);
          return { data: null, error: { code: "23514", message: `Injected insert failure on ${table}` } };
        }
        const items = Array.isArray(payload) ? payload : [payload];
        const inserted = items.map((item) => {
          const rec = { id: item.id || crypto.randomUUID(), ...item };
          rows.push(rec);
          return rec;
        });
        if (singleMode) return { data: inserted[0] || null, error: null };
        return { data: inserted, error: null };
      }
      if (op === "upsert") {
        const rec = { id: payload.id || crypto.randomUUID(), ...payload };
        if (upsertConflict) {
          const idx = rows.findIndex((r) => r[upsertConflict] === rec[upsertConflict]);
          if (idx >= 0) {
            rows[idx] = { ...rows[idx], ...rec };
            return { data: singleMode ? rows[idx] : [rows[idx]], error: null };
          }
        }
        rows.push(rec);
        return { data: singleMode ? rec : [rec], error: null };
      }
      if (op === "update") {
        const updated = [];
        for (let i = 0; i < rows.length; i++) {
          if (matchRow(rows[i])) {
            rows[i] = { ...rows[i], ...payload };
            updated.push(rows[i]);
          }
        }
        return { data: singleMode ? (updated[0] || null) : updated, error: null };
      }
      return { data: null, error: null };
    };

    const builder = {
      select() { return builder; },
      insert(data) { op = "insert"; payload = data; return builder; },
      upsert(data, opts) { op = "upsert"; payload = data; upsertConflict = opts?.onConflict; return builder; },
      update(data) { op = "update"; payload = data; return builder; },
      eq(col, val) { filters.push({ type: "eq", col, val }); return builder; },
      in(col, val) { filters.push({ type: "in", col, val }); return builder; },
      gt(col, val) { filters.push({ type: "gt", col, val }); return builder; },
      ilike(col, val) { filters.push({ type: "ilike", col, val }); return builder; },
      or(clause) { orClause = clause; return builder; },
      limit(n) { limitCount = n; return builder; },
      maybeSingle() { return execute("maybeSingle"); },
      single() { return execute("single"); },
      then(resolve, reject) { return execute(null).then(resolve, reject); }
    };
    return builder;
  }

  const client = {
    auth: {
      async getUser(token) {
        const u = tokens[token];
        if (!u) return { data: { user: null }, error: new Error("Invalid token") };
        return { data: { user: u }, error: null };
      },
      admin: {
        async listUsers() {
          state.authListUsersCalls += 1;
          return { data: { users: Object.values(tokens) }, error: null };
        },
        async getUserById(id) {
          const u = Object.values(tokens).find((t) => t.id === id) || null;
          return { data: { user: u }, error: null };
        },
        async createUser({ email, user_metadata }) {
          state.authCreateUserCalls += 1;
          const u = { id: crypto.randomUUID(), email, email_confirmed_at: new Date().toISOString(), user_metadata };
          return { data: { user: u }, error: null };
        }
      }
    },
    storage: {
      from() {
        return {
          async createSignedUrl(objectPath) {
            return { data: { signedUrl: `https://signed.example.local/${objectPath}?token=mock` }, error: null };
          }
        };
      }
    },
    from(table) {
      return makeQueryBuilder(table);
    },
    async rpc(fnName, params) {
      state.rpcCalls.push({ fnName, params });
      if (fnName === "get_next_invoice_number") {
        state.invSeq += 1;
        return { data: `DM/26-27/${String(state.invSeq).padStart(4, "0")}`, error: null };
      }
      if (fnName === "record_credit_note_with_limit") {
        const payment = state.payments.find((p) => p.razorpay_payment_id === params.p_payment_id);
        const existing = state.credit_notes.find((cn) => cn.refund_id === params.p_refund_id);
        if (existing) return { data: [existing], error: null };
        const priorTotal = state.credit_notes
          .filter((cn) => cn.payment_id === params.p_payment_id)
          .reduce((s, c) => s + Number(c.amount), 0);
        const origAmount = Number(payment?.amount || 0);
        if (params.p_refund_amount <= 0 || params.p_refund_amount > origAmount - priorTotal) {
          return { data: null, error: { message: `Refund amount ${params.p_refund_amount} exceeds remaining eligible balance` } };
        }
        state.cnSeq += 1;
        const cn = {
          id: crypto.randomUUID(),
          payment_id: params.p_payment_id,
          refund_id: params.p_refund_id,
          amount: params.p_refund_amount,
          reason: params.p_reason,
          credit_note_number: `CN/26-27/${String(state.cnSeq).padStart(4, "0")}`,
          created_at: new Date().toISOString()
        };
        state.credit_notes.push(cn);
        return { data: [cn], error: null };
      }
      if (fnName === "fulfill_course_enrollment") {
        if (typeof courseRpcOverride === "function") {
          return await courseRpcOverride(params, state);
        }
        const course = state.courses.find((c) => c.id === params.p_course_id);
        if (!course) {
          return { data: { success: false, error: "Course not found" }, error: null };
        }
        if (String(course.status || "").trim().toLowerCase() !== "published") {
          return { data: { success: false, error: "Course is not published" }, error: null };
        }
        const effectiveCoursePrice =
          course.offer_price != null && Number(course.offer_price) > 0 && (!course.offer_expires_at || new Date(course.offer_expires_at).getTime() > Date.now())
            ? Number(course.offer_price)
            : Number(course.price);
        const expectedCurrency = String(course.currency || "INR").toUpperCase();
        if (String(params.p_currency || "").toUpperCase() !== expectedCurrency) {
          return { data: { success: false, error: `Currency mismatch: expected ${expectedCurrency}` }, error: null };
        }
        if (toPaiseStrict(params.p_amount) !== toPaiseStrict(effectiveCoursePrice)) {
          return { data: { success: false, error: `Authoritative price mismatch: expected ${effectiveCoursePrice}, got ${params.p_amount}` }, error: null };
        }
        const existing = state.payments.find((p) => p.razorpay_payment_id === params.p_payment_id);
        if (existing) {
          if (
            existing.user_id !== params.p_user_id ||
            existing.item_id !== params.p_course_id ||
            existing.razorpay_order_id !== params.p_order_id ||
            toPaiseStrict(existing.amount) !== toPaiseStrict(effectiveCoursePrice)
          ) {
            return { data: { success: false, error: "Payment transaction details conflict with existing record" }, error: null };
          }
          return {
            data: {
              success: true,
              already_fulfilled: true,
              payment_id: existing.id,
              enrollment_id: "DM-ENR-EXISTING",
              course_title: course.title,
              course_slug: course.slug,
              amount: existing.amount,
              currency: existing.currency
            },
            error: null
          };
        }
        const payRow = {
          id: crypto.randomUUID(),
          user_id: params.p_user_id,
          item_type: "course",
          item_id: params.p_course_id,
          item_title: course.title,
          amount: effectiveCoursePrice,
          currency: expectedCurrency,
          razorpay_order_id: params.p_order_id,
          razorpay_payment_id: params.p_payment_id,
          status: "captured",
          created_at: new Date().toISOString()
        };
        state.payments.push(payRow);
        state.course_enrollments.push({
          id: crypto.randomUUID(),
          user_id: params.p_user_id,
          course_id: params.p_course_id,
          status: "active"
        });
        return {
          data: {
            success: true,
            already_fulfilled: false,
            payment_id: payRow.id,
            enrollment_id: "DM-ENR-NEW",
            course_title: course.title,
            course_slug: course.slug,
            amount: effectiveCoursePrice,
            currency: expectedCurrency
          },
          error: null
        };
      }
      if (fnName === "fulfill_consultation_payment") {
        if (typeof consultationRpcOverride === "function") {
          return await consultationRpcOverride(params, state);
        }
        if (simulateMissingConsultationRpc) {
          return { data: null, error: { code: "PGRST202", message: "Function not found" } };
        }
        const product = state.consultation_products.find((cp) => cp.id === params.p_product_id && cp.active);
        if (!product) {
          return { data: { success: false, code: "PRODUCT_NOT_FOUND", error: "Consultation product not found" }, error: null };
        }
        const basePaise = toPaiseStrict(product.base_price);
        const gstRate = product.gst_rate != null ? Number(product.gst_rate) : 0.18;
        const gstPaise = Math.round(basePaise * gstRate);
        const expectedPaise = basePaise + gstPaise;
        const expected = expectedPaise / 100;
        if (toPaiseStrict(params.p_amount) !== expectedPaise) {
          return { data: { success: false, code: "AMOUNT_MISMATCH", error: `Amount mismatch: expected ${expected}, got ${params.p_amount}` }, error: null };
        }
        const normEmail = String(params.p_booking_details?.customerEmail || "").trim().toLowerCase();
        const existingPay = state.payments.find(
          (p) => p.razorpay_payment_id === params.p_payment_id || p.razorpay_order_id === params.p_order_id
        );
        const existingBkg = state.bookings.find(
          (b) => b.payment_id === params.p_payment_id || b.razorpay_order_id === params.p_order_id
        );
        const reqUser = params.p_user_id || null;
        if (existingPay) {
          if (
            existingPay.razorpay_order_id !== params.p_order_id ||
            existingPay.razorpay_payment_id !== params.p_payment_id ||
            existingPay.item_type !== "consultation" ||
            existingPay.item_id !== params.p_product_id ||
            toPaiseStrict(existingPay.amount) !== expectedPaise ||
            (existingPay.user_id || null) !== reqUser
          ) {
            return { data: { success: false, code: "IDEMPOTENCY_CONFLICT", error: "Existing payment record conflicts with consultation invariants or user ownership." }, error: null };
          }
        }
        if (existingBkg) {
          if (
            existingBkg.razorpay_order_id !== params.p_order_id ||
            existingBkg.payment_id !== params.p_payment_id ||
            toPaiseStrict(existingBkg.total_amount) !== expectedPaise ||
            String(existingBkg.customer_email || "").trim().toLowerCase() !== normEmail ||
            (existingBkg.user_id || null) !== reqUser
          ) {
            return { data: { success: false, code: "IDEMPOTENCY_CONFLICT", error: "Existing booking record conflicts with consultation invariants or user ownership." }, error: null };
          }
        }
        if (existingPay && existingBkg) {
          return { data: { success: true, fulfilled: true, already_fulfilled: true, booking: existingBkg, payment: existingPay }, error: null };
        }
        if (existingPay && !existingBkg) {
          const healedBkg = {
            id: `bkg_${crypto.randomUUID()}`,
            booking_code: params.p_booking_details.booking_code,
            customer_email: normEmail,
            customer_name: params.p_booking_details.customerName,
            booking_date: params.p_booking_details.date,
            booking_time: params.p_booking_details.time,
            base_amount: basePaise / 100,
            gst_rate: gstRate,
            gst_amount: gstPaise / 100,
            total_amount: expected,
            currency: params.p_currency,
            payment_id: params.p_payment_id,
            razorpay_order_id: params.p_order_id,
            meeting_link: null,
            status: "confirmed",
            user_id: reqUser
          };
          state.bookings.push(healedBkg);
          return { data: { success: true, fulfilled: true, already_fulfilled: true, healed_booking: true, booking: healedBkg, payment: existingPay }, error: null };
        }
        const bkg = {
          id: `bkg_${crypto.randomUUID()}`,
          booking_code: params.p_booking_details.booking_code,
          customer_email: normEmail,
          customer_name: params.p_booking_details.customerName,
          booking_date: params.p_booking_details.date,
          booking_time: params.p_booking_details.time,
          base_amount: basePaise / 100,
          gst_rate: gstRate,
          gst_amount: gstPaise / 100,
          total_amount: expected,
          currency: params.p_currency,
          payment_id: params.p_payment_id,
          razorpay_order_id: params.p_order_id,
          meeting_link: null,
          status: "confirmed",
          user_id: reqUser
        };
        const pay = {
          id: crypto.randomUUID(),
          user_id: reqUser,
          customer_email: normEmail,
          item_type: "consultation",
          item_id: params.p_product_id,
          amount: expected,
          currency: params.p_currency,
          razorpay_order_id: params.p_order_id,
          razorpay_payment_id: params.p_payment_id,
          status: "captured"
        };
        state.bookings.push(bkg);
        state.payments.push(pay);
        if (!state.crm_leads.some((l) => String(l.notes || "").includes(params.p_payment_id))) {
          state.crm_leads.push({
            id: crypto.randomUUID(),
            name: params.p_booking_details.customerName || "Valued Client",
            email: normEmail,
            source: "Consultation Intake (Paid)",
            notes: `Payment: ${params.p_payment_id}`,
            status: "New",
            amount: expected
          });
        }
        return { data: { success: true, fulfilled: true, already_fulfilled: false, booking: bkg, payment: pay }, error: null };
      }
      if (fnName === "fulfill_resource_purchase") {
        if (typeof resourceRpcOverride === "function") {
          return await resourceRpcOverride(params, state);
        }
        if (simulateMissingResourceRpc) {
          return { data: null, error: { code: "PGRST202", message: "Function fulfill_resource_purchase not found" } };
        }
        const resRec = state.resources.find((r) => r.id === params.p_resource_id);
        if (!resRec || String(resRec.status || "").toLowerCase() !== "published") {
          return { data: { success: false, code: "RESOURCE_UNAVAILABLE", error: "Resource unavailable" }, error: null };
        }
        const expectedPaise = toPaiseStrict(resRec.price);
        if (!expectedPaise || toPaiseStrict(params.p_amount) !== expectedPaise) {
          return { data: { success: false, code: "AMOUNT_MISMATCH", error: "Amount mismatch" }, error: null };
        }
        const expectedPrice = expectedPaise / 100;
        const reqUser = params.p_user_id || null;
        const existingPur = state.resource_purchases.find(
          (rp) => rp.razorpay_payment_id === params.p_payment_id || rp.razorpay_order_id === params.p_order_id
        );
        const existingPay = state.payments.find(
          (p) => p.razorpay_payment_id === params.p_payment_id || p.razorpay_order_id === params.p_order_id
        );
        if (existingPur) {
          if (
            existingPur.razorpay_order_id !== params.p_order_id ||
            existingPur.razorpay_payment_id !== params.p_payment_id ||
            existingPur.resource_id !== resRec.id ||
            toPaiseStrict(existingPur.amount) !== expectedPaise ||
            String(existingPur.currency || "").toUpperCase() !== "INR" ||
            String(existingPur.status || "").toLowerCase() !== "active" ||
            (existingPur.user_id || null) !== reqUser
          ) {
            return { data: { success: false, code: "IDEMPOTENCY_CONFLICT", error: "Existing resource_purchases record conflicts with invariants." }, error: null };
          }
        }
        if (existingPay) {
          if (
            existingPay.razorpay_order_id !== params.p_order_id ||
            existingPay.razorpay_payment_id !== params.p_payment_id ||
            existingPay.item_type !== "resource" ||
            existingPay.item_id !== resRec.id ||
            toPaiseStrict(existingPay.amount) !== expectedPaise ||
            String(existingPay.currency || "").toUpperCase() !== "INR" ||
            !["captured", "paid"].includes(String(existingPay.status || "").toLowerCase()) ||
            (existingPay.user_id || null) !== reqUser
          ) {
            return { data: { success: false, code: "IDEMPOTENCY_CONFLICT", error: "Existing payment ledger record conflicts with invariants." }, error: null };
          }
        }
        if (!existingPur && reqUser) {
          const dupUserPur = state.resource_purchases.find(
            (rp) => rp.user_id === reqUser && rp.resource_id === resRec.id && (rp.razorpay_order_id !== params.p_order_id || rp.razorpay_payment_id !== params.p_payment_id)
          );
          if (dupUserPur) {
            return { data: { success: false, code: "DUPLICATE_USER_RESOURCE_PURCHASE", error: "Authenticated user already owns this resource under another order." }, error: null };
          }
        }
        if (existingPur && existingPay) {
          return {
            data: {
              success: true,
              fulfilled: true,
              already_fulfilled: true,
              purchase: existingPur,
              payment: existingPay,
              lead_status: "already_exists"
            },
            error: null
          };
        }
        if (existingPay && !existingPur) {
          const pur = {
            id: crypto.randomUUID(),
            user_id: reqUser,
            customer_email: params.p_customer_email || null,
            customer_phone: params.p_customer_phone || null,
            resource_id: params.p_resource_id,
            razorpay_order_id: params.p_order_id,
            razorpay_payment_id: params.p_payment_id,
            amount: expectedPrice,
            currency: params.p_currency,
            status: "active"
          };
          state.resource_purchases.push(pur);
          return {
            data: { success: true, fulfilled: true, already_fulfilled: true, healed_purchase: true, purchase: pur, payment: existingPay, lead_status: "already_exists" },
            error: null
          };
        }
        if (existingPur && !existingPay) {
          const pay = {
            id: crypto.randomUUID(),
            user_id: reqUser,
            customer_email: params.p_customer_email || null,
            item_type: "resource",
            item_id: params.p_resource_id,
            item_title: params.p_resource_title,
            amount: expectedPrice,
            currency: params.p_currency,
            razorpay_order_id: params.p_order_id,
            razorpay_payment_id: params.p_payment_id,
            status: "captured"
          };
          state.payments.push(pay);
          return {
            data: { success: true, fulfilled: true, already_fulfilled: true, healed_ledger: true, purchase: existingPur, payment: pay, lead_status: "already_exists" },
            error: null
          };
        }
        const newPur = {
          id: crypto.randomUUID(),
          user_id: reqUser,
          customer_email: params.p_customer_email || null,
          customer_phone: params.p_customer_phone || null,
          resource_id: params.p_resource_id,
          razorpay_order_id: params.p_order_id,
          razorpay_payment_id: params.p_payment_id,
          amount: expectedPrice,
          currency: params.p_currency,
          status: "active"
        };
        const newPay = {
          id: crypto.randomUUID(),
          user_id: reqUser,
          customer_email: params.p_customer_email || null,
          item_type: "resource",
          item_id: params.p_resource_id,
          item_title: params.p_resource_title,
          amount: expectedPrice,
          currency: params.p_currency,
          razorpay_order_id: params.p_order_id,
          razorpay_payment_id: params.p_payment_id,
          status: "captured"
        };
        state.resource_purchases.push(newPur);
        state.payments.push(newPay);
        if ((params.p_customer_email || params.p_customer_name) && !state.crm_leads.some((l) => String(l.notes || "").includes(params.p_payment_id))) {
          state.crm_leads.push({
            id: crypto.randomUUID(),
            name: params.p_customer_name || "Resource Buyer",
            email: params.p_customer_email || "",
            source: "Resource Purchase (Paid)",
            notes: `Payment: ${params.p_payment_id}`,
            status: "Converted",
            amount: expectedPrice
          });
        }
        return {
          data: {
            success: true,
            fulfilled: true,
            already_fulfilled: false,
            purchase: newPur,
            payment: newPay,
            lead_status: "saved"
          },
          error: null
        };
      }
      return { data: null, error: new Error(`Unknown RPC: ${fnName}`) };
    }
  };

  return { client, state };
}

function createMockRazorpay() {
  const gatewayPayments = new Map();
  const gatewayOrders = new Map();
  const gatewayRefunds = new Map();
  let captureCallCount = 0;
  let orderCounter = 1;

  return {
    gatewayPayments,
    gatewayOrders,
    gatewayRefunds,
    getCaptureCallCount: () => captureCallCount,
    reset() {
      gatewayPayments.clear();
      gatewayOrders.clear();
      gatewayRefunds.clear();
      captureCallCount = 0;
    },
    client: {
      payments: {
        async fetch(id) {
          const p = gatewayPayments.get(id);
          if (!p) throw { error: { description: "Payment not found" } };
          return p;
        },
        async capture() {
          captureCallCount += 1;
          throw new Error("payments.capture must NEVER be invoked automatically!");
        },
        async fetchMultipleRefund(paymentId) {
          const items = gatewayRefunds.get(paymentId) || [];
          return { entity: "collection", count: items.length, items };
        },
        async fetchRefund(paymentId, refundId) {
          const items = gatewayRefunds.get(paymentId) || [];
          const found = items.find((r) => r.id === refundId);
          if (!found) throw { error: { description: "Refund not found" } };
          return found;
        }
      },
      orders: {
        async create(opts) {
          const id = `order_created_${orderCounter++}`;
          const ord = { id, amount: opts.amount, currency: opts.currency, receipt: opts.receipt, notes: opts.notes || {} };
          gatewayOrders.set(id, ord);
          return ord;
        },
        async fetch(id) {
          const o = gatewayOrders.get(id);
          if (!o) throw { error: { description: "Order not found" } };
          return o;
        }
      }
    }
  };
}

let passed = 0;
let failed = 0;

const categoryStats = {
  UNIT: { passed: 0, failed: 0 },
  "ISOLATED HTTP": { passed: 0, failed: 0 },
  "SQL/RPC STATIC": { passed: 0, failed: 0 },
  "CONCURRENCY HARNESS": { passed: 0, failed: 0 }
};

function detectCategory(name) {
  const m = String(name).match(/^\[(UNIT|ISOLATED HTTP|SQL\/RPC STATIC|CONCURRENCY HARNESS)\]/);
  if (m) return m[1];
  return "ISOLATED HTTP";
}

async function runTest(name, fn) {
  resetPaymentRateLimits();
  const cat = detectCategory(name);
  try {
    await fn();
    passed++;
    categoryStats[cat].passed++;
    console.log(`  ✓ PASS: ${name}`);
  } catch (err) {
    failed++;
    categoryStats[cat].failed++;
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.stack || err.message}`);
  }
}

async function main() {
  console.log("==============================================================================");
  console.log("DIGITALMUID V4.3 — P0 PAYMENT SECURITY REMEDIATION TEST SUITE");
  console.log("==============================================================================\n");

  const mockRzp = createMockRazorpay();
  setMockRazorpayClient(mockRzp.client);

  const app = express();
  app.post("/api/payments/webhook", express.raw({ type: "application/json" }), (req, res) => {
    return handleRazorpayWebhook(req, res);
  });
  app.use(express.json());
  app.use("/api/payments", paymentRoutes);

  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    // =========================================================================
    // P0-1: COURSE PAYMENT VERIFICATION
    // =========================================================================
    console.log("[P0-1] Course Payment Gateway Verification");

    await runTest("1.1 Course verification rejects 'authorized' payment even with valid HMAC (and never calls capture)", async () => {
      mockRzp.reset();
      const { client, state } = createStatefulMockDb();
      setMockSupabaseServerClient(client);
      setMockRazorpayClient(mockRzp.client);

      const orderId = "order_crs_auth_only";
      const payId = "pay_crs_auth_only";
      mockRzp.gatewayOrders.set(orderId, {
        id: orderId,
        amount: 499900,
        currency: "INR",
        notes: { itemType: "course", courseId: COURSE_UUID, userId: USER_1_ID }
      });
      mockRzp.gatewayPayments.set(payId, {
        id: payId,
        order_id: orderId,
        amount: 499900,
        currency: "INR",
        status: "authorized"
      });

      const res = await fetch(`${baseUrl}/api/payments/verify-course-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer token-owner-1" },
        body: JSON.stringify({
          razorpay_order_id: orderId,
          razorpay_payment_id: payId,
          razorpay_signature: signRazorpayCheckout(orderId, payId),
          courseId: COURSE_UUID
        })
      });
      const body = await res.json();
      assert.strictEqual(res.status, 400);
      assert.strictEqual(body.fulfilled, false);
      assert.strictEqual(state.course_enrollments.length, 0);
      assert.strictEqual(state.payments.length, 0);
      assert.strictEqual(mockRzp.getCaptureCallCount(), 0);
    });

    await runTest("1.2 Course verification rejects failed payment, order_id mismatch, underpayment, non-INR, and cross-course/cross-user orders", async () => {
      mockRzp.reset();
      const { client, state } = createStatefulMockDb();
      setMockSupabaseServerClient(client);
      setMockRazorpayClient(mockRzp.client);

      const cases = [
        {
          label: "failed status",
          expectedStatus: 400,
          order: { id: "order_c_fail", amount: 499900, currency: "INR", notes: { itemType: "course", courseId: COURSE_UUID, userId: USER_1_ID } },
          payment: { id: "pay_c_fail", order_id: "order_c_fail", amount: 499900, currency: "INR", status: "failed" }
        },
        {
          label: "mismatched payment.order_id",
          expectedStatus: 400,
          order: { id: "order_c_mismatch", amount: 499900, currency: "INR", notes: { itemType: "course", courseId: COURSE_UUID, userId: USER_1_ID } },
          payment: { id: "pay_c_mismatch", order_id: "order_other_999", amount: 499900, currency: "INR", status: "captured" }
        },
        {
          label: "wrong amount",
          expectedStatus: 400,
          order: { id: "order_c_amt", amount: 100, currency: "INR", notes: { itemType: "course", courseId: COURSE_UUID, userId: USER_1_ID } },
          payment: { id: "pay_c_amt", order_id: "order_c_amt", amount: 100, currency: "INR", status: "captured" }
        },
        {
          label: "non-INR currency",
          expectedStatus: 400,
          order: { id: "order_c_usd", amount: 499900, currency: "USD", notes: { itemType: "course", courseId: COURSE_UUID, userId: USER_1_ID } },
          payment: { id: "pay_c_usd", order_id: "order_c_usd", amount: 499900, currency: "USD", status: "captured" }
        },
        {
          label: "cross-course metadata",
          expectedStatus: 400,
          order: { id: "order_c_xres", amount: 499900, currency: "INR", notes: { itemType: "course", courseId: "99999999-9999-4999-8999-999999999999", userId: USER_1_ID } },
          payment: { id: "pay_c_xres", order_id: "order_c_xres", amount: 499900, currency: "INR", status: "captured" }
        },
        {
          label: "cross-user order notes.userId",
          expectedStatus: 403,
          order: { id: "order_c_xusr", amount: 499900, currency: "INR", notes: { itemType: "course", courseId: COURSE_UUID, userId: USER_2_ID } },
          payment: { id: "pay_c_xusr", order_id: "order_c_xusr", amount: 499900, currency: "INR", status: "captured" }
        }
      ];

      for (const tc of cases) {
        mockRzp.gatewayOrders.set(tc.order.id, tc.order);
        mockRzp.gatewayPayments.set(tc.payment.id, tc.payment);
        const res = await fetch(`${baseUrl}/api/payments/verify-course-payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer token-owner-1" },
          body: JSON.stringify({
            razorpay_order_id: tc.order.id,
            razorpay_payment_id: tc.payment.id,
            razorpay_signature: signRazorpayCheckout(tc.order.id, tc.payment.id),
            courseId: COURSE_UUID
          })
        });
        assert.strictEqual(res.status, tc.expectedStatus, `Expected ${tc.expectedStatus} for ${tc.label}, got ${res.status}`);
      }
      assert.strictEqual(state.course_enrollments.length, 0);
      assert.strictEqual(state.payments.length, 0);
    });

    await runTest("1.3 Course verification fails closed (503) when Razorpay gateway client is unavailable", async () => {
      const { client, state } = createStatefulMockDb();
      setMockSupabaseServerClient(client);
      const savedKeyId = process.env.RAZORPAY_KEY_ID;
      process.env.RAZORPAY_KEY_ID = "rzp_live_blocked_in_test";
      setMockRazorpayClient(null);

      try {
        const orderId = "order_crs_noclient";
        const payId = "pay_crs_noclient";
        const res = await fetch(`${baseUrl}/api/payments/verify-course-payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer token-owner-1" },
          body: JSON.stringify({
            razorpay_order_id: orderId,
            razorpay_payment_id: payId,
            razorpay_signature: signRazorpayCheckout(orderId, payId),
            courseId: COURSE_UUID
          })
        });
        assert.strictEqual(res.status, 503);
        assert.strictEqual(state.course_enrollments.length, 0);
      } finally {
        process.env.RAZORPAY_KEY_ID = savedKeyId;
        setMockRazorpayClient(mockRzp.client);
      }
    });

    await runTest("1.4 Legitimate captured course payment fulfills enrollment once (200)", async () => {
      mockRzp.reset();
      const { client, state } = createStatefulMockDb();
      setMockSupabaseServerClient(client);
      setMockRazorpayClient(mockRzp.client);

      const orderId = "order_crs_legit";
      const payId = "pay_crs_legit";
      mockRzp.gatewayOrders.set(orderId, {
        id: orderId,
        amount: 499900,
        currency: "INR",
        notes: { itemType: "course", courseId: COURSE_UUID, userId: USER_1_ID }
      });
      mockRzp.gatewayPayments.set(payId, {
        id: payId,
        order_id: orderId,
        amount: 499900,
        currency: "INR",
        status: "captured"
      });

      const res = await fetch(`${baseUrl}/api/payments/verify-course-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer token-owner-1" },
        body: JSON.stringify({
          razorpay_order_id: orderId,
          razorpay_payment_id: payId,
          razorpay_signature: signRazorpayCheckout(orderId, payId),
          courseId: COURSE_UUID
        })
      });
      const body = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(body.fulfilled, true);
      assert.strictEqual(state.course_enrollments.length, 1);
      assert.strictEqual(state.payments.length, 1);
    });

    // =========================================================================
    // P0-2: CONSULTATION CROSS-ITEM & PRICE BYPASS
    // =========================================================================
    console.log("\n[P0-2] Consultation Cross-Item & Price Bypass Remediation");

    await runTest("2.1 Replaying a ₹79 resource order/payment into verify-consultation-payment is REJECTED (400)", async () => {
      mockRzp.reset();
      const { client, state } = createStatefulMockDb();
      setMockSupabaseServerClient(client);
      setMockRazorpayClient(mockRzp.client);

      const orderId = "order_res_79_replay";
      const payId = "pay_res_79_replay";
      mockRzp.gatewayOrders.set(orderId, {
        id: orderId,
        amount: 7900,
        currency: "INR",
        notes: { itemType: "resource", resourceId: CHEAP_RES_UUID, customerEmail: "attacker@example.com" }
      });
      mockRzp.gatewayPayments.set(payId, {
        id: payId,
        order_id: orderId,
        amount: 7900,
        currency: "INR",
        status: "captured",
        email: "attacker@example.com"
      });

      const res = await fetch(`${baseUrl}/api/payments/verify-consultation-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpay_order_id: orderId,
          razorpay_payment_id: payId,
          razorpay_signature: signRazorpayCheckout(orderId, payId),
          bookingDetails: {
            customerName: "Attacker",
            customerEmail: "attacker@example.com",
            date: "2026-12-10",
            time: "10:00 AM",
            order_total_amount: "79.00"
          }
        })
      });
      const body = await res.json();
      assert.strictEqual(res.status, 400);
      assert.strictEqual(body.fulfilled, false);
      assert.strictEqual(state.bookings.length, 0);
      assert.strictEqual(state.payments.length, 0);
    });

    await runTest("2.2 Consultation verification rejects underpaid order, uncaptured status, missing client, cross-user, and guest email mismatch", async () => {
      mockRzp.reset();
      const { client, state } = createStatefulMockDb();
      setMockSupabaseServerClient(client);
      setMockRazorpayClient(mockRzp.client);

      // Case A: underpaid consultation order (₹79 vs ₹588.82) -> 400
      mockRzp.gatewayOrders.set("order_con_underpaid", {
        id: "order_con_underpaid",
        amount: 7900,
        currency: "INR",
        notes: { itemType: "consultation", productId: CONSULTATION_PRODUCT_UUID, customerEmail: "guest@example.com" }
      });
      mockRzp.gatewayPayments.set("pay_con_underpaid", {
        id: "pay_con_underpaid",
        order_id: "order_con_underpaid",
        amount: 7900,
        currency: "INR",
        status: "captured",
        email: "guest@example.com"
      });

      const underpaidRes = await fetch(`${baseUrl}/api/payments/verify-consultation-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpay_order_id: "order_con_underpaid",
          razorpay_payment_id: "pay_con_underpaid",
          razorpay_signature: signRazorpayCheckout("order_con_underpaid", "pay_con_underpaid"),
          bookingDetails: { customerName: "Guest", customerEmail: "guest@example.com", date: "2026-12-11", time: "11:00 AM" }
        })
      });
      assert.strictEqual(underpaidRes.status, 400);

      // Case B: uncaptured status ('authorized' and 'failed') -> 400 (never captures)
      for (const badStatus of ["authorized", "failed"]) {
        const ordId = `order_con_${badStatus}`;
        const pId = `pay_con_${badStatus}`;
        mockRzp.gatewayOrders.set(ordId, {
          id: ordId,
          amount: 58882,
          currency: "INR",
          notes: { itemType: "consultation", productId: CONSULTATION_PRODUCT_UUID, customerEmail: "guest@example.com" }
        });
        mockRzp.gatewayPayments.set(pId, {
          id: pId,
          order_id: ordId,
          amount: 58882,
          currency: "INR",
          status: badStatus,
          email: "guest@example.com"
        });
        const stRes = await fetch(`${baseUrl}/api/payments/verify-consultation-payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            razorpay_order_id: ordId,
            razorpay_payment_id: pId,
            razorpay_signature: signRazorpayCheckout(ordId, pId),
            bookingDetails: { customerName: "Guest", customerEmail: "guest@example.com", date: "2026-12-11", time: "11:00 AM" }
          })
        });
        assert.strictEqual(stRes.status, 400, `Expected 400 for consultation status=${badStatus}`);
      }
      assert.strictEqual(mockRzp.getCaptureCallCount(), 0);

      // Case C: authenticated cross-user order notes.userId -> 403
      mockRzp.gatewayOrders.set("order_con_xusr", {
        id: "order_con_xusr",
        amount: 58882,
        currency: "INR",
        notes: { itemType: "consultation", productId: CONSULTATION_PRODUCT_UUID, userId: USER_2_ID }
      });
      mockRzp.gatewayPayments.set("pay_con_xusr", {
        id: "pay_con_xusr",
        order_id: "order_con_xusr",
        amount: 58882,
        currency: "INR",
        status: "captured",
        email: "other@example.com"
      });

      const xusrRes = await fetch(`${baseUrl}/api/payments/verify-consultation-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer token-owner-1" },
        body: JSON.stringify({
          razorpay_order_id: "order_con_xusr",
          razorpay_payment_id: "pay_con_xusr",
          razorpay_signature: signRazorpayCheckout("order_con_xusr", "pay_con_xusr"),
          bookingDetails: { customerName: "Arjun", customerEmail: "owner@example.com", date: "2026-12-12", time: "12:00 PM" }
        })
      });
      assert.strictEqual(xusrRes.status, 403);

      // Case D: guest email mismatch -> 403
      mockRzp.gatewayOrders.set("order_con_email_mismatch", {
        id: "order_con_email_mismatch",
        amount: 58882,
        currency: "INR",
        notes: { itemType: "consultation", productId: CONSULTATION_PRODUCT_UUID, customerEmail: "realbuyer@example.com" }
      });
      mockRzp.gatewayPayments.set("pay_con_email_mismatch", {
        id: "pay_con_email_mismatch",
        order_id: "order_con_email_mismatch",
        amount: 58882,
        currency: "INR",
        status: "captured",
        email: "realbuyer@example.com"
      });
      const emailMismatchRes = await fetch(`${baseUrl}/api/payments/verify-consultation-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpay_order_id: "order_con_email_mismatch",
          razorpay_payment_id: "pay_con_email_mismatch",
          razorpay_signature: signRazorpayCheckout("order_con_email_mismatch", "pay_con_email_mismatch"),
          bookingDetails: { customerName: "Attacker", customerEmail: "attacker@example.com", date: "2026-12-12", time: "01:00 PM" }
        })
      });
      assert.strictEqual(emailMismatchRes.status, 403);

      // Case E: missing Razorpay client -> 503
      const savedKeyId = process.env.RAZORPAY_KEY_ID;
      process.env.RAZORPAY_KEY_ID = "rzp_live_blocked_in_test";
      setMockRazorpayClient(null);
      try {
        const noClientRes = await fetch(`${baseUrl}/api/payments/verify-consultation-payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            razorpay_order_id: "order_con_noclient",
            razorpay_payment_id: "pay_con_noclient",
            razorpay_signature: signRazorpayCheckout("order_con_noclient", "pay_con_noclient"),
            bookingDetails: { customerName: "Guest", customerEmail: "guest@example.com", date: "2026-12-13", time: "02:00 PM" }
          })
        });
        assert.strictEqual(noClientRes.status, 503);
      } finally {
        process.env.RAZORPAY_KEY_ID = savedKeyId;
        setMockRazorpayClient(mockRzp.client);
      }

      assert.strictEqual(state.bookings.length, 0);
      assert.strictEqual(state.payments.length, 0);
    });

    await runTest("2.3 fulfillConsultationPayment rejects ₹79 amount, strips order_total_amount, and fails closed when RPC is missing", async () => {
      {
        const { client, state } = createStatefulMockDb({ simulateMissingConsultationRpc: false });
        setMockSupabaseServerClient(client);

        const rejected = await fulfillConsultationPayment({
          userId: null,
          bookingDetails: {
            customerName: "Attacker",
            customerEmail: "attacker@example.com",
            date: "2026-12-15",
            time: "10:00 AM",
            order_total_amount: "79.00"
          },
          orderId: "order_direct_underpay",
          paymentId: "pay_direct_underpay",
          productId: CONSULTATION_PRODUCT_UUID,
          amount: 79,
          currency: "INR"
        });

        assert.strictEqual(rejected.success, false);
        assert.strictEqual(rejected.code, "AMOUNT_MISMATCH");
        assert.strictEqual(state.bookings.length, 0);
        assert.strictEqual(state.payments.length, 0);

        const ok = await fulfillConsultationPayment({
          userId: null,
          bookingDetails: {
            customerName: "Valid Guest",
            customerEmail: "valid@example.com",
            date: "2026-12-16",
            time: "10:00 AM",
            order_total_amount: "79.00" // Attempted spoof alongside exact amount: must be stripped!
          },
          orderId: "order_direct_ok_rpc",
          paymentId: "pay_direct_ok_rpc",
          productId: CONSULTATION_PRODUCT_UUID,
          amount: 588.82,
          currency: "INR"
        });
        assert.strictEqual(ok.success, true);
        assert.strictEqual(ok.booking.total_amount, 588.82);
        const rpcCall = state.rpcCalls.find((c) => c.fnName === "fulfill_consultation_payment");
        assert.ok(rpcCall);
        assert.strictEqual("order_total_amount" in rpcCall.params.p_booking_details, false);
      }

      // Missing RPC MUST fail closed (MIGRATION_PENDING, zero JS writes)
      {
        const { client, state } = createStatefulMockDb({ simulateMissingConsultationRpc: true });
        setMockSupabaseServerClient(client);
        const missingRpcRes = await fulfillConsultationPayment({
          userId: null,
          bookingDetails: { customerName: "Valid Guest", customerEmail: "valid@example.com", date: "2026-12-16", time: "10:00 AM" },
          orderId: "order_missing_rpc",
          paymentId: "pay_missing_rpc",
          productId: CONSULTATION_PRODUCT_UUID,
          amount: 588.82,
          currency: "INR"
        });
        assert.strictEqual(missingRpcRes.success, false);
        assert.strictEqual(missingRpcRes.fulfilled, false);
        assert.strictEqual(missingRpcRes.retryable, true);
        assert.strictEqual(missingRpcRes.code, "MIGRATION_PENDING");
        assert.strictEqual(state.bookings.length, 0);
        assert.strictEqual(state.payments.length, 0);
      }
    });

    await runTest("2.4 Consultation fulfillment enforces invalid productId, zero GST rate, and existing-record ownership conflicts", async () => {
      const { client, state } = createStatefulMockDb({ simulateMissingConsultationRpc: false });
      setMockSupabaseServerClient(client);

      const badProd = await fulfillConsultationPayment({
        userId: null,
        bookingDetails: { customerEmail: "a@example.com", date: "2026-12-20", time: "10:00 AM" },
        orderId: "order_bad_pid",
        paymentId: "pay_bad_pid",
        productId: "not-a-uuid",
        amount: 588.82,
        currency: "INR"
      });
      assert.strictEqual(badProd.success, false);
      assert.strictEqual(badProd.code, "INVALID_PRODUCT_ID");

      // Zero GST product should NOT fall back to 0.18!
      const zeroGstUuid = "31bbb9bf-ce10-4da4-a517-dfc673f99999";
      state.consultation_products.push({
        id: zeroGstUuid,
        name: "Zero GST Consult",
        base_price: 500,
        gst_rate: 0,
        currency: "INR",
        duration_minutes: 30,
        active: true
      });
      const zeroGstOk = await fulfillConsultationPayment({
        userId: USER_1_ID,
        bookingDetails: { customerName: "Arjun", customerEmail: "owner@example.com", date: "2026-12-21", time: "10:00 AM" },
        orderId: "order_zero_gst",
        paymentId: "pay_zero_gst",
        productId: zeroGstUuid,
        amount: 500,
        currency: "INR"
      });
      assert.strictEqual(zeroGstOk.success, true);
      assert.strictEqual(zeroGstOk.booking.gst_amount, 0);
      assert.strictEqual(zeroGstOk.booking.total_amount, 500);

      // Existing booking belonging to USER_1 cannot be claimed by USER_2
      const crossUserClaim = await fulfillConsultationPayment({
        userId: USER_2_ID,
        bookingDetails: { customerName: "Neha", customerEmail: "owner@example.com", date: "2026-12-21", time: "10:00 AM" },
        orderId: "order_zero_gst",
        paymentId: "pay_zero_gst",
        productId: zeroGstUuid,
        amount: 500,
        currency: "INR"
      });
      assert.strictEqual(crossUserClaim.success, false);
      assert.strictEqual(crossUserClaim.code, "IDEMPOTENCY_CONFLICT");
    });

    await runTest("2.5 Consultation order & webhook enforce ₹588.82 total and additive SQL migration removes snapshot bypass", async () => {
      mockRzp.reset();
      const { client, state } = createStatefulMockDb();
      setMockSupabaseServerClient(client);
      setMockRazorpayClient(mockRzp.client);

      const orderRes = await fetch(`${baseUrl}/api/payments/create-consultation-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingDetails: {
            customerName: "Priya",
            customerEmail: "priya@example.com",
            date: "2026-12-22",
            time: "03:00 PM"
          }
        })
      });
      const orderBody = await orderRes.json();
      assert.strictEqual(orderRes.status, 200);
      assert.strictEqual(orderBody.amount, 58882);
      assert.strictEqual(orderBody.totalAmount, 588.82);

      // Webhook ₹79 consultation underpayment must NOT fulfill
      mockRzp.gatewayOrders.set("order_wh_con_under", {
        id: "order_wh_con_under",
        amount: 7900,
        currency: "INR",
        notes: { itemType: "consultation", productId: CONSULTATION_PRODUCT_UUID, customerEmail: "cheat@example.com", bookingDate: "2026-12-22", bookingTime: "04:00 PM" }
      });
      const whPayload = Buffer.from(JSON.stringify({
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "pay_wh_con_under",
              order_id: "order_wh_con_under",
              amount: 7900,
              currency: "INR",
              status: "captured",
              email: "cheat@example.com"
            }
          }
        }
      }), "utf8");
      const whRes = await fetch(`${baseUrl}/api/payments/webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-razorpay-signature": signRazorpayWebhook(whPayload) },
        body: whPayload
      });
      const whBody = await whRes.json();
      assert.strictEqual(whRes.status, 200);
      assert.strictEqual(whBody.fulfilled, false);
      assert.strictEqual(state.bookings.length, 0);

      // Static audit of additive SQL migration proposal
      const proposalSql = fs.readFileSync(
        path.resolve("supabase/migrations/20261116000001_harden_consultation_rpc_amount_validation.sql"),
        "utf8"
      );
      assert.strictEqual(proposalSql.includes("v_order_snapshot_amount"), false);
      assert.ok(proposalSql.includes("p_amount = 'NaN'::NUMERIC"));
      assert.ok(proposalSql.includes("pg_catalog.round(p_amount, 2) IS DISTINCT FROM p_amount"));
      assert.ok(proposalSql.includes("p_amount IS DISTINCT FROM v_expected_total"));
      assert.ok(proposalSql.includes("SECURITY DEFINER"));
      assert.ok(proposalSql.includes("SET search_path = pg_catalog, pg_temp"));
      assert.ok(proposalSql.includes("REVOKE ALL ON FUNCTION public.fulfill_consultation_payment(UUID, TEXT, TEXT, NUMERIC, TEXT, JSONB, UUID) FROM PUBLIC, anon, authenticated"));
    });

    // =========================================================================
    // P0-3: RESOURCE PRICE, STATUS, AND CROSS-RESOURCE SECURITY
    // =========================================================================
    console.log("\n[P0-3] Resource Pricing, Draft Gating & Cross-Resource Security");

    await runTest("3.1 create-resource-order rejects unknown, free, and draft resources and ignores tampered client price", async () => {
      mockRzp.reset();
      const { client } = createStatefulMockDb();
      setMockSupabaseServerClient(client);
      setMockRazorpayClient(mockRzp.client);

      assert.strictEqual(getAuthoritativeResourcePricing("unknown-id", null).accessType, "unverified");
      assert.strictEqual(getAuthoritativeResourcePricing(DRAFT_RES_UUID, { id: DRAFT_RES_UUID, status: "draft", access_type: "paid", price: 999 }).accessType, "unavailable");

      // Unknown resource -> 404
      const unknownRes = await fetch(`${baseUrl}/api/payments/create-resource-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId: "does-not-exist", price: 1, accessType: "paid" })
      });
      assert.strictEqual(unknownRes.status, 404);

      // Free resource -> 400
      const freeRes = await fetch(`${baseUrl}/api/payments/create-resource-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId: FREE_RES_UUID, price: 1, accessType: "paid" })
      });
      assert.strictEqual(freeRes.status, 400);

      // Draft resource -> 400
      const draftRes = await fetch(`${baseUrl}/api/payments/create-resource-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId: DRAFT_RES_UUID })
      });
      assert.strictEqual(draftRes.status, 400);

      // Paid resource ignores client price=1 and creates order for 29900 paise
      const paidRes = await fetch(`${baseUrl}/api/payments/create-resource-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId: BUNDLE_UUID, price: 1, accessType: "free" })
      });
      const paidBody = await paidRes.json();
      assert.strictEqual(paidRes.status, 200);
      assert.strictEqual(paidBody.amount, 29900);
    });

    await runTest("3.2 verify-resource-payment rejects cross-resource/course/draft orders and fails closed without Razorpay client", async () => {
      mockRzp.reset();
      const { client, state } = createStatefulMockDb();
      setMockSupabaseServerClient(client);
      setMockRazorpayClient(mockRzp.client);

      // Cross-resource substitution (₹79 calculator order replayed for ₹299 bundle OR even same-price other resource)
      const orderOther = "order_res_cross";
      const payOther = "pay_res_cross";
      mockRzp.gatewayOrders.set(orderOther, {
        id: orderOther,
        amount: 29900,
        currency: "INR",
        notes: { itemType: "resource", resourceId: CHEAP_RES_UUID }
      });
      mockRzp.gatewayPayments.set(payOther, {
        id: payOther,
        order_id: orderOther,
        amount: 29900,
        currency: "INR",
        status: "captured"
      });
      const crossRes = await fetch(`${baseUrl}/api/payments/verify-resource-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpay_order_id: orderOther,
          razorpay_payment_id: payOther,
          razorpay_signature: signRazorpayCheckout(orderOther, payOther),
          resourceId: BUNDLE_UUID
        })
      });
      assert.strictEqual(crossRes.status, 400);
      assert.strictEqual(state.resource_purchases.length, 0);

      // Fail closed (503) when Razorpay gateway client is unavailable
      const savedKeyId = process.env.RAZORPAY_KEY_ID;
      process.env.RAZORPAY_KEY_ID = "rzp_live_blocked_in_test";
      setMockRazorpayClient(null);
      try {
        const orderNoClient = "order_res_noclient";
        const payNoClient = "pay_res_noclient";
        const noClientRes = await fetch(`${baseUrl}/api/payments/verify-resource-payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            razorpay_order_id: orderNoClient,
            razorpay_payment_id: payNoClient,
            razorpay_signature: signRazorpayCheckout(orderNoClient, payNoClient),
            resourceId: BUNDLE_UUID
          })
        });
        assert.strictEqual(noClientRes.status, 503);
        assert.strictEqual(state.resource_purchases.length, 0);
      } finally {
        process.env.RAZORPAY_KEY_ID = savedKeyId;
        setMockRazorpayClient(mockRzp.client);
      }
    });

    await runTest("3.3 Draft/archived paid resources cannot be accessed free, while free resources and existing paid entitlements remain intact", async () => {
      mockRzp.reset();
      const { client, state } = createStatefulMockDb();
      setMockSupabaseServerClient(client);
      setMockRazorpayClient(mockRzp.client);

      // Unpurchased caller checking draft paid resource must NOT get isFree=true or download URL
      const draftStatusRes = await fetch(`${baseUrl}/api/payments/verify-purchase-status?resourceId=${DRAFT_RES_UUID}`);
      const draftStatusBody = await draftStatusRes.json();
      assert.strictEqual(draftStatusRes.status, 200);
      assert.strictEqual(draftStatusBody.verified, false);
      assert.notStrictEqual(draftStatusBody.isFree, true);

      const draftDlRes = await fetch(`${baseUrl}/api/payments/get-resource-download-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId: DRAFT_RES_UUID })
      });
      assert.strictEqual(draftDlRes.status, 403);

      // Legitimate published free resource remains accessible
      const freeDlRes = await fetch(`${baseUrl}/api/payments/get-resource-download-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId: FREE_RES_UUID })
      });
      const freeDlBody = await freeDlRes.json();
      assert.strictEqual(freeDlRes.status, 200);
      assert.strictEqual(freeDlBody.accessType, "free");

      // Existing paid buyer retains entitlement even if resource was later archived
      state.resource_purchases.push({
        id: "rp_archived_buyer",
        user_id: USER_1_ID,
        resource_id: ARCHIVED_RES_UUID,
        razorpay_order_id: "order_arch_1",
        razorpay_payment_id: "pay_arch_1",
        amount: 499,
        currency: "INR",
        status: "active"
      });
      const archivedEntitledRes = await fetch(`${baseUrl}/api/payments/get-resource-download-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer token-owner-1" },
        body: JSON.stringify({ resourceId: ARCHIVED_RES_UUID })
      });
      assert.strictEqual(archivedEntitledRes.status, 200);
    });

    // =========================================================================
    // P0-4: CREDIT NOTE & REFUND GATEWAY VERIFICATION
    // =========================================================================
    console.log("\n[P0-4] Credit Note & Refund Gateway Verification");

    await runTest("4.1 Forged refundId, pending/failed refund, mismatched payment_id, and mismatched refundAmount are REJECTED", async () => {
      mockRzp.reset();
      const { client, state } = createStatefulMockDb();
      setMockSupabaseServerClient(client);
      setMockRazorpayClient(mockRzp.client);

      const payId = "pay_cn_sec_1";
      const orderId = "order_cn_sec_1";
      state.payments.push({
        id: "pm_cn_sec_1",
        user_id: USER_1_ID,
        item_type: "course",
        item_id: COURSE_UUID,
        amount: 4999,
        currency: "INR",
        razorpay_order_id: orderId,
        razorpay_payment_id: payId,
        status: "captured",
        created_at: new Date().toISOString()
      });
      mockRzp.gatewayPayments.set(payId, { id: payId, order_id: orderId, amount: 499900, currency: "INR", status: "captured" });
      mockRzp.gatewayRefunds.set(payId, [
        { id: "rfnd_pending_1", payment_id: payId, amount: 100000, currency: "INR", status: "pending" },
        { id: "rfnd_wrong_pay", payment_id: "pay_someone_else", amount: 100000, currency: "INR", status: "processed" },
        { id: "rfnd_real_1000", payment_id: payId, amount: 100000, currency: "INR", status: "processed" }
      ]);

      // Admin trying nonexistent refundId -> 400
      const fakeIdRes = await fetch(`${baseUrl}/api/payments/credit-note/${payId}?refundId=rfnd_does_not_exist&format=json`, {
        headers: { Authorization: "Bearer token-admin" }
      });
      assert.strictEqual(fakeIdRes.status, 400);

      // Admin trying pending refund -> 400
      const pendingRes = await fetch(`${baseUrl}/api/payments/credit-note/${payId}?refundId=rfnd_pending_1&format=json`, {
        headers: { Authorization: "Bearer token-admin" }
      });
      assert.strictEqual(pendingRes.status, 400);

      // Admin trying refund linked to another payment_id -> 400
      const wrongPayRes = await fetch(`${baseUrl}/api/payments/credit-note/${payId}?refundId=rfnd_wrong_pay&format=json`, {
        headers: { Authorization: "Bearer token-admin" }
      });
      assert.strictEqual(wrongPayRes.status, 400);

      // Admin trying spoofed refundAmount != gateway refund (500 vs 1000) -> 400
      const wrongAmtRes = await fetch(`${baseUrl}/api/payments/credit-note/${payId}?refundId=rfnd_real_1000&refundAmount=500&format=json`, {
        headers: { Authorization: "Bearer token-admin" }
      });
      assert.strictEqual(wrongAmtRes.status, 400);
      assert.strictEqual(state.credit_notes.length, 0);
    });

    await runTest("4.2 Legitimate partial refund issues one credit note, deduplicates replay by refund_id, and fails closed without Razorpay client", async () => {
      mockRzp.reset();
      const { client, state } = createStatefulMockDb();
      setMockSupabaseServerClient(client);
      setMockRazorpayClient(mockRzp.client);

      const payId = "pay_cn_legit_part";
      const orderId = "order_cn_legit_part";
      state.payments.push({
        id: "pm_cn_legit",
        user_id: USER_1_ID,
        item_type: "course",
        item_id: COURSE_UUID,
        amount: 2000,
        currency: "INR",
        razorpay_order_id: orderId,
        razorpay_payment_id: payId,
        status: "captured",
        created_at: new Date().toISOString()
      });
      mockRzp.gatewayPayments.set(payId, { id: payId, order_id: orderId, amount: 200000, amount_refunded: 80000, currency: "INR", status: "captured" });
      mockRzp.gatewayRefunds.set(payId, [
        { id: "rfnd_part_800", payment_id: payId, amount: 80000, currency: "INR", status: "processed" }
      ]);

      // Fail closed (503) if gateway refund verification API is unavailable (even for admin)
      setMockRazorpayClient({
        payments: {
          async fetch(id) {
            return mockRzp.gatewayPayments.get(id);
          }
        },
        orders: mockRzp.client.orders
      });
      const noRefundApiCn = await fetch(`${baseUrl}/api/payments/credit-note/${payId}?refundId=rfnd_part_800&format=json`, {
        headers: { Authorization: "Bearer token-admin" }
      });
      assert.strictEqual(noRefundApiCn.status, 503);
      assert.strictEqual(state.credit_notes.length, 0);

      // Fail closed (503) for owner even if gateway client returns null during refund verification
      const savedKeyId = process.env.RAZORPAY_KEY_ID;
      process.env.RAZORPAY_KEY_ID = "rzp_live_blocked_in_test";
      setMockRazorpayClient(null);
      try {
        const noClientOwnerCn = await fetch(`${baseUrl}/api/payments/credit-note/${payId}?refundId=rfnd_part_800&format=json`, {
          headers: { Authorization: "Bearer token-owner-1" }
        });
        assert.ok([403, 503].includes(noClientOwnerCn.status));
        assert.strictEqual(state.credit_notes.length, 0);
      } finally {
        process.env.RAZORPAY_KEY_ID = savedKeyId;
      }

      // Owner can generate credit note for processed gateway partial refund
      setMockRazorpayClient(mockRzp.client);
      const firstRes = await fetch(`${baseUrl}/api/payments/credit-note/${payId}?refundId=rfnd_part_800&format=json`, {
        headers: { Authorization: "Bearer token-owner-1" }
      });
      const firstBody = await firstRes.json();
      assert.strictEqual(firstRes.status, 200);
      assert.strictEqual(firstBody.isCreditNote, true);
      assert.strictEqual(firstBody.creditNote.refundAmount, 800);
      assert.strictEqual(firstBody.creditNote.refundId, "rfnd_part_800");
      assert.strictEqual(state.credit_notes.length, 1);

      // Replay with same refundId is idempotent (no duplicate credit note row, no extra RPC mutation)
      const replayRes = await fetch(`${baseUrl}/api/payments/credit-note/${payId}?refundId=rfnd_part_800&format=json`, {
        headers: { Authorization: "Bearer token-owner-1" }
      });
      const replayBody = await replayRes.json();
      assert.strictEqual(replayRes.status, 200);
      assert.strictEqual(replayBody.creditNote.creditNoteNumber, firstBody.creditNote.creditNoteNumber);
      assert.strictEqual(state.credit_notes.length, 1);

      // Second gateway refund exceeding remaining refundable balance (800 + 1500 > 2000) is rejected (400)
      mockRzp.gatewayRefunds.set(payId, [
        { id: "rfnd_part_800", payment_id: payId, amount: 80000, currency: "INR", status: "processed" },
        { id: "rfnd_excess_1500", payment_id: payId, amount: 150000, currency: "INR", status: "processed" }
      ]);
      const excessRes = await fetch(`${baseUrl}/api/payments/credit-note/${payId}?refundId=rfnd_excess_1500&format=json`, {
        headers: { Authorization: "Bearer token-owner-1" }
      });
      assert.strictEqual(excessRes.status, 400);
      assert.strictEqual(state.credit_notes.length, 1);
    });

    // =========================================================================
    // P1-5: BUNDLE PAYMENT, WEBHOOK FAIL-CLOSED, RECOVER-LEAD & FULFILLMENT HARDENING
    // =========================================================================
    console.log("\n[P1-5] Bundle Payment, Webhook Fail-Closed, Recover-Lead & Resource Fulfillment Security");

    await runTest("5.1 Bundle download rejects ₹1 underpayment on both GET /bundle-files and POST /get-bundle-files (and allows exact ₹299)", async () => {
      mockRzp.reset();
      const { client, state } = createStatefulMockDb();
      setMockSupabaseServerClient(client);
      setMockRazorpayClient(mockRzp.client);

      const underOrder = "order_bundle_1rs";
      const underPay = "pay_bundle_1rs";
      mockRzp.gatewayOrders.set(underOrder, {
        id: underOrder,
        amount: 100,
        currency: "INR",
        notes: { itemType: "resource", resourceId: BUNDLE_UUID }
      });
      mockRzp.gatewayPayments.set(underPay, {
        id: underPay,
        order_id: underOrder,
        amount: 100,
        currency: "INR",
        status: "captured"
      });

      const getUnder = await fetch(`${baseUrl}/api/payments/bundle-files?bundleId=${BUNDLE_UUID}&orderId=${underOrder}&paymentId=${underPay}`);
      const getUnderBody = await getUnder.json();
      assert.strictEqual(getUnder.status, 403);
      assert.strictEqual(getUnderBody.authorized, false);
      assert.strictEqual(getUnderBody.files, undefined);

      const postUnder = await fetch(`${baseUrl}/api/payments/get-bundle-files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bundleId: BUNDLE_UUID, orderId: underOrder, paymentId: underPay })
      });
      const postUnderBody = await postUnder.json();
      assert.strictEqual(postUnder.status, 403);
      assert.strictEqual(postUnderBody.authorized, false);
      assert.strictEqual(postUnderBody.files, undefined);

      // Guest ₹299 bundle order WITHOUT signed guest token is REJECTED (403)
      const okOrder = "order_bundle_299";
      const okPay = "pay_bundle_299";
      mockRzp.gatewayOrders.set(okOrder, {
        id: okOrder,
        amount: 29900,
        currency: "INR",
        notes: { itemType: "resource", resourceId: BUNDLE_UUID }
      });
      mockRzp.gatewayPayments.set(okPay, {
        id: okPay,
        order_id: okOrder,
        amount: 29900,
        currency: "INR",
        status: "captured"
      });
      const noTokenRes = await fetch(`${baseUrl}/api/payments/bundle-files?bundleId=${BUNDLE_UUID}&orderId=${okOrder}&paymentId=${okPay}`);
      assert.strictEqual(noTokenRes.status, 403);

      // Verify guest checkout to mint signed guest resourceAccessToken -> unlocks bundle-files (200)
      const verifyGuest = await fetch(`${baseUrl}/api/payments/verify-resource-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpay_order_id: okOrder,
          razorpay_payment_id: okPay,
          razorpay_signature: signRazorpayCheckout(okOrder, okPay),
          resourceId: BUNDLE_UUID,
          customerDetails: { name: "Guest Bundle", email: "guestbundle@example.com" }
        })
      });
      const verifyGuestBody = await verifyGuest.json();
      assert.strictEqual(verifyGuest.status, 200);
      assert.ok(verifyGuestBody.resourceAccessToken);

      const getOk = await fetch(`${baseUrl}/api/payments/bundle-files?bundleId=${BUNDLE_UUID}&orderId=${okOrder}&paymentId=${okPay}`, {
        headers: { "x-resource-access-token": verifyGuestBody.resourceAccessToken }
      });
      const getOkBody = await getOk.json();
      assert.strictEqual(getOk.status, 200);
      assert.strictEqual(getOkBody.authorized, true);
      assert.strictEqual(getOkBody.files.length, 4);

      // Unpublished bundle status fails closed even with valid token & ₹299 order
      state.resources[0].status = "draft";
      const draftBundleRes = await fetch(`${baseUrl}/api/payments/bundle-files?bundleId=${BUNDLE_UUID}&orderId=${okOrder}&paymentId=${okPay}`, {
        headers: { "x-resource-access-token": verifyGuestBody.resourceAccessToken }
      });
      assert.strictEqual(draftBundleRes.status, 403);
    });

    await runTest("5.2 Bundle download rejects wrong itemType, spoofed paymentNotes.resourceId, and cross-user ownership", async () => {
      mockRzp.reset();
      const { client, state } = createStatefulMockDb();
      setMockSupabaseServerClient(client);
      setMockRazorpayClient(mockRzp.client);

      // Case A: wrong itemType ('course')
      mockRzp.gatewayOrders.set("order_bnd_badtype", {
        id: "order_bnd_badtype",
        amount: 29900,
        currency: "INR",
        notes: { itemType: "course", resourceId: BUNDLE_UUID }
      });
      mockRzp.gatewayPayments.set("pay_bnd_badtype", {
        id: "pay_bnd_badtype",
        order_id: "order_bnd_badtype",
        amount: 29900,
        currency: "INR",
        status: "captured"
      });
      const badTypeRes = await fetch(`${baseUrl}/api/payments/bundle-files?bundleId=${BUNDLE_UUID}&orderId=order_bnd_badtype&paymentId=pay_bnd_badtype`);
      const badTypeBody = await badTypeRes.json();
      assert.strictEqual(badTypeRes.status, 403);
      assert.strictEqual(badTypeBody.files, undefined);

      // Case B1: orderNotes lack resourceId completely, while paymentNotes attempt to spoof BUNDLE_UUID
      mockRzp.gatewayOrders.set("order_bnd_no_ores", {
        id: "order_bnd_no_ores",
        amount: 29900,
        currency: "INR",
        notes: { itemType: "resource" }
      });
      mockRzp.gatewayPayments.set("pay_bnd_no_ores", {
        id: "pay_bnd_no_ores",
        order_id: "order_bnd_no_ores",
        amount: 29900,
        currency: "INR",
        status: "captured",
        notes: { resourceId: BUNDLE_UUID, resource_id: BUNDLE_UUID }
      });
      const noOresRes = await fetch(`${baseUrl}/api/payments/bundle-files?bundleId=${BUNDLE_UUID}&orderId=order_bnd_no_ores&paymentId=pay_bnd_no_ores`);
      const noOresBody = await noOresRes.json();
      assert.strictEqual(noOresRes.status, 403);
      assert.strictEqual(noOresBody.files, undefined);

      // Case B2: orderNotes point to CHEAP_RES_UUID, while paymentNotes attempt to spoof BUNDLE_UUID
      mockRzp.gatewayOrders.set("order_bnd_spoof_pnote", {
        id: "order_bnd_spoof_pnote",
        amount: 29900,
        currency: "INR",
        notes: { itemType: "resource", resourceId: CHEAP_RES_UUID }
      });
      mockRzp.gatewayPayments.set("pay_bnd_spoof_pnote", {
        id: "pay_bnd_spoof_pnote",
        order_id: "order_bnd_spoof_pnote",
        amount: 29900,
        currency: "INR",
        status: "captured",
        notes: { resourceId: BUNDLE_UUID, resource_id: BUNDLE_UUID }
      });
      const spoofRes = await fetch(`${baseUrl}/api/payments/get-bundle-files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bundleId: BUNDLE_UUID, orderId: "order_bnd_spoof_pnote", paymentId: "pay_bnd_spoof_pnote" })
      });
      const spoofBody = await spoofRes.json();
      assert.strictEqual(spoofRes.status, 403);
      assert.strictEqual(spoofBody.files, undefined);

      // Case C: cross-user bundle download (order belongs to USER_2_ID; rejected for USER_1 and unauthenticated)
      mockRzp.gatewayOrders.set("order_bnd_user2", {
        id: "order_bnd_user2",
        amount: 29900,
        currency: "INR",
        notes: { itemType: "resource", resourceId: BUNDLE_UUID, userId: USER_2_ID }
      });
      mockRzp.gatewayPayments.set("pay_bnd_user2", {
        id: "pay_bnd_user2",
        order_id: "order_bnd_user2",
        amount: 29900,
        currency: "INR",
        status: "captured"
      });
      const xusrAuthRes = await fetch(`${baseUrl}/api/payments/bundle-files?bundleId=${BUNDLE_UUID}&orderId=order_bnd_user2&paymentId=pay_bnd_user2`, {
        headers: { Authorization: "Bearer token-owner-1" }
      });
      assert.strictEqual(xusrAuthRes.status, 403);

      const xusrAnonRes = await fetch(`${baseUrl}/api/payments/bundle-files?bundleId=${BUNDLE_UUID}&orderId=order_bnd_user2&paymentId=pay_bnd_user2`);
      assert.strictEqual(xusrAnonRes.status, 403);

      // And DB-persisted bundle purchase owned by USER_2_ID cannot be downloaded by USER_1_ID
      state.resource_purchases.push({
        id: "rp_bnd_user2",
        user_id: USER_2_ID,
        resource_id: BUNDLE_UUID,
        razorpay_order_id: "order_bnd_user2",
        razorpay_payment_id: "pay_bnd_user2",
        amount: 299,
        currency: "INR",
        status: "active"
      });
      const xusrDbRes = await fetch(`${baseUrl}/api/payments/get-bundle-files`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer token-owner-1" },
        body: JSON.stringify({ bundleId: BUNDLE_UUID, orderId: "order_bnd_user2", paymentId: "pay_bnd_user2" })
      });
      const xusrDbBody = await xusrDbRes.json();
      assert.strictEqual(xusrDbRes.status, 403);
      assert.strictEqual(xusrDbBody.files, undefined);
    });

    await runTest("5.3 Missing Razorpay client during payment.captured webhook fails closed for course, resource, and consultation", async () => {
      const { client, state } = createStatefulMockDb();
      setMockSupabaseServerClient(client);
      const savedKeyId = process.env.RAZORPAY_KEY_ID;
      process.env.RAZORPAY_KEY_ID = "rzp_live_blocked_in_test";
      setMockRazorpayClient(null);

      try {
        const events = [
          {
            label: "course",
            payment: {
              id: "pay_wh_noclient_crs",
              order_id: "order_wh_noclient_crs",
              amount: 499900,
              currency: "INR",
              status: "captured",
              notes: { itemType: "course", courseId: COURSE_UUID, userId: USER_1_ID }
            }
          },
          {
            label: "resource",
            payment: {
              id: "pay_wh_noclient_res",
              order_id: "order_wh_noclient_res",
              amount: 29900,
              currency: "INR",
              status: "captured",
              email: "guest@example.com",
              notes: { itemType: "resource", resourceId: BUNDLE_UUID }
            }
          },
          {
            label: "consultation",
            payment: {
              id: "pay_wh_noclient_con",
              order_id: "order_wh_noclient_con",
              amount: 58882,
              currency: "INR",
              status: "captured",
              email: "guest@example.com",
              notes: { itemType: "consultation", productId: CONSULTATION_PRODUCT_UUID, bookingDate: "2026-12-25", bookingTime: "10:00 AM", customerEmail: "guest@example.com" }
            }
          }
        ];

        for (const ev of events) {
          const raw = Buffer.from(JSON.stringify({ event: "payment.captured", payload: { payment: { entity: ev.payment } } }), "utf8");
          const whRes = await fetch(`${baseUrl}/api/payments/webhook`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-razorpay-signature": signRazorpayWebhook(raw) },
            body: raw
          });
          const whBody = await whRes.json();
          assert.strictEqual(whRes.status, 200);
          assert.strictEqual(whBody.fulfilled, false, `Expected fulfilled=false for ${ev.label} when Razorpay client missing`);
        }

        assert.strictEqual(state.payments.length, 0);
        assert.strictEqual(state.course_enrollments.length, 0);
        assert.strictEqual(state.resource_purchases.length, 0);
        assert.strictEqual(state.bookings.length, 0);
        assert.strictEqual(state.crm_leads.length, 0);
      } finally {
        process.env.RAZORPAY_KEY_ID = savedKeyId;
        setMockRazorpayClient(mockRzp.client);
      }
    });

    await runTest("5.4 Resource and Course webhooks reject underpayment and unpublished resources with zero DB mutations", async () => {
      mockRzp.reset();
      const { client, state } = createStatefulMockDb();
      setMockSupabaseServerClient(client);
      setMockRazorpayClient(mockRzp.client);

      // A: Resource webhook underpayment (₹79 order for ₹299 bundle)
      mockRzp.gatewayOrders.set("order_wh_res_underpay", {
        id: "order_wh_res_underpay",
        amount: 7900,
        currency: "INR",
        notes: { itemType: "resource", resourceId: BUNDLE_UUID, customerEmail: "cheat@example.com" }
      });
      const resUnderRaw = Buffer.from(JSON.stringify({
        event: "payment.captured",
        payload: {
          payment: {
            entity: { id: "pay_wh_res_underpay", order_id: "order_wh_res_underpay", amount: 7900, currency: "INR", status: "captured", email: "cheat@example.com" }
          }
        }
      }), "utf8");
      const resUnderResp = await fetch(`${baseUrl}/api/payments/webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-razorpay-signature": signRazorpayWebhook(resUnderRaw) },
        body: resUnderRaw
      });
      const resUnderBody = await resUnderResp.json();
      assert.strictEqual(resUnderResp.status, 200);
      assert.strictEqual(resUnderBody.fulfilled, false);

      // B: Resource webhook for unpublished (draft) resource
      mockRzp.gatewayOrders.set("order_wh_res_draft", {
        id: "order_wh_res_draft",
        amount: 99900,
        currency: "INR",
        notes: { itemType: "resource", resourceId: DRAFT_RES_UUID, customerEmail: "buyer@example.com" }
      });
      const resDraftRaw = Buffer.from(JSON.stringify({
        event: "payment.captured",
        payload: {
          payment: {
            entity: { id: "pay_wh_res_draft", order_id: "order_wh_res_draft", amount: 99900, currency: "INR", status: "captured", email: "buyer@example.com" }
          }
        }
      }), "utf8");
      const resDraftResp = await fetch(`${baseUrl}/api/payments/webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-razorpay-signature": signRazorpayWebhook(resDraftRaw) },
        body: resDraftRaw
      });
      const resDraftBody = await resDraftResp.json();
      assert.strictEqual(resDraftResp.status, 200);
      assert.strictEqual(resDraftBody.fulfilled, false);

      // C: Course webhook underpayment (₹1 for ₹4999 course)
      mockRzp.gatewayOrders.set("order_wh_crs_underpay", {
        id: "order_wh_crs_underpay",
        amount: 100,
        currency: "INR",
        notes: { itemType: "course", courseId: COURSE_UUID, userId: USER_1_ID }
      });
      const crsUnderRaw = Buffer.from(JSON.stringify({
        event: "payment.captured",
        payload: {
          payment: {
            entity: { id: "pay_wh_crs_underpay", order_id: "order_wh_crs_underpay", amount: 100, currency: "INR", status: "captured" }
          }
        }
      }), "utf8");
      const crsUnderResp = await fetch(`${baseUrl}/api/payments/webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-razorpay-signature": signRazorpayWebhook(crsUnderRaw) },
        body: crsUnderRaw
      });
      const crsUnderBody = await crsUnderResp.json();
      assert.strictEqual(crsUnderResp.status, 200);
      assert.strictEqual(crsUnderBody.fulfilled, false);

      assert.strictEqual(state.payments.length, 0);
      assert.strictEqual(state.resource_purchases.length, 0);
      assert.strictEqual(state.course_enrollments.length, 0);
      assert.strictEqual(state.crm_leads.length, 0);
    });

    await runTest("5.5 verify-resource-payment rejects non-INR currency (USD) and underpayment (100 paise vs 29900 paise)", async () => {
      mockRzp.reset();
      const { client, state } = createStatefulMockDb();
      setMockSupabaseServerClient(client);
      setMockRazorpayClient(mockRzp.client);

      const badCases = [
        {
          label: "USD currency",
          order: { id: "order_res_usd", amount: 29900, currency: "USD", notes: { itemType: "resource", resourceId: BUNDLE_UUID } },
          payment: { id: "pay_res_usd", order_id: "order_res_usd", amount: 29900, currency: "USD", status: "captured" }
        },
        {
          label: "underpaid 100 paise",
          order: { id: "order_res_1rs", amount: 100, currency: "INR", notes: { itemType: "resource", resourceId: BUNDLE_UUID } },
          payment: { id: "pay_res_1rs", order_id: "order_res_1rs", amount: 100, currency: "INR", status: "captured" }
        }
      ];

      for (const tc of badCases) {
        mockRzp.gatewayOrders.set(tc.order.id, tc.order);
        mockRzp.gatewayPayments.set(tc.payment.id, tc.payment);
        const res = await fetch(`${baseUrl}/api/payments/verify-resource-payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            razorpay_order_id: tc.order.id,
            razorpay_payment_id: tc.payment.id,
            razorpay_signature: signRazorpayCheckout(tc.order.id, tc.payment.id),
            resourceId: BUNDLE_UUID
          })
        });
        const body = await res.json();
        assert.strictEqual(res.status, 400, `Expected 400 for ${tc.label}`);
        assert.strictEqual(body.verified, false);
        assert.strictEqual(body.fulfilled, false);
        assert.strictEqual(body.invoiceToken, undefined);
      }

      assert.strictEqual(state.payments.length, 0);
      assert.strictEqual(state.resource_purchases.length, 0);
      assert.strictEqual(state.crm_leads.length, 0);
    });

    await runTest("5.6 recover-lead rejects unauthenticated callers without guest token AND rejects using another resource's payment", async () => {
      mockRzp.reset();
      const { client, state } = createStatefulMockDb();
      setMockSupabaseServerClient(client);
      setMockRazorpayClient(mockRzp.client);

      // A1: Payment belonging to CHEAP_RES_UUID exists in gateway -> guest without token receives 403
      const gwOrd = "order_recover_other_gw";
      const gwPay = "pay_recover_other_gw";
      mockRzp.gatewayOrders.set(gwOrd, {
        id: gwOrd,
        amount: 7900,
        currency: "INR",
        notes: { itemType: "resource", resourceId: CHEAP_RES_UUID, customerEmail: "guest@example.com" }
      });
      mockRzp.gatewayPayments.set(gwPay, {
        id: gwPay,
        order_id: gwOrd,
        amount: 7900,
        currency: "INR",
        status: "captured",
        email: "guest@example.com"
      });
      const noTokRes = await fetch(`${baseUrl}/api/payments/recover-lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: gwOrd,
          paymentId: gwPay,
          resourceId: BUNDLE_UUID,
          customerDetails: { name: "Attacker", email: "guest@example.com" }
        })
      });
      assert.strictEqual(noTokRes.status, 403);
      assert.strictEqual((await noTokRes.json()).code, "MISSING_GUEST_TOKEN");

      // A2: Guest holds valid signed token for CHEAP_RES_UUID and tries recovering lead for BUNDLE_UUID -> 403 GUEST_TOKEN_RESOURCE_MISMATCH
      const cheapGuestToken = generateGuestResourceToken({
        paymentId: gwPay,
        orderId: gwOrd,
        resourceId: CHEAP_RES_UUID,
        email: "guest@example.com"
      });
      const wrongResTok = await fetch(`${baseUrl}/api/payments/recover-lead`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-resource-access-token": cheapGuestToken
        },
        body: JSON.stringify({
          orderId: gwOrd,
          paymentId: gwPay,
          resourceId: BUNDLE_UUID,
          customerDetails: { name: "Buyer", email: "guest@example.com" }
        })
      });
      assert.strictEqual(wrongResTok.status, 403);
      assert.strictEqual((await wrongResTok.json()).code, "GUEST_TOKEN_RESOURCE_MISMATCH");

      // B: Authenticated user probing a guest order without guest token receives 403;
      //    and authenticated owner replaying their own CHEAP_RES_UUID payment into BUNDLE_UUID receives 400
      const probeGuestRes = await fetch(`${baseUrl}/api/payments/recover-lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer token-owner-1" },
        body: JSON.stringify({
          orderId: gwOrd,
          paymentId: gwPay,
          resourceId: BUNDLE_UUID,
          customerDetails: { name: "Owner", email: "owner@example.com" }
        })
      });
      assert.strictEqual(probeGuestRes.status, 403);

      const userCheapOrd = "order_recover_user_cheap";
      const userCheapPay = "pay_recover_user_cheap";
      mockRzp.gatewayOrders.set(userCheapOrd, {
        id: userCheapOrd,
        amount: 7900,
        currency: "INR",
        notes: { itemType: "resource", resourceId: CHEAP_RES_UUID, userId: USER_1_ID }
      });
      mockRzp.gatewayPayments.set(userCheapPay, {
        id: userCheapPay,
        order_id: userCheapOrd,
        amount: 7900,
        currency: "INR",
        status: "captured",
        email: "owner@example.com"
      });
      state.resource_purchases.push({
        id: "rp_cheap_1",
        user_id: USER_1_ID,
        resource_id: CHEAP_RES_UUID,
        razorpay_order_id: userCheapOrd,
        razorpay_payment_id: userCheapPay,
        amount: 79,
        currency: "INR",
        status: "active"
      });
      const dbRes = await fetch(`${baseUrl}/api/payments/recover-lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer token-owner-1" },
        body: JSON.stringify({
          orderId: userCheapOrd,
          paymentId: userCheapPay,
          resourceId: BUNDLE_UUID,
          customerDetails: { name: "Owner", email: "owner@example.com" }
        })
      });
      const dbBody = await dbRes.json();
      assert.strictEqual(dbRes.status, 400);
      assert.strictEqual(dbBody.payment_verified, false);
      assert.strictEqual(state.crm_leads.length, 0);
    });

    await runTest("5.7 fulfillResourcePurchase enforces authoritative pricing and rejects idempotent replay with mismatched amount or order ID", async () => {
      const { client, state } = createStatefulMockDb();
      setMockSupabaseServerClient(client);

      // Underpaid direct call is rejected
      const badAmt = await fulfillResourcePurchase({
        userId: USER_1_ID,
        resourceId: BUNDLE_UUID,
        amount: 79,
        currency: "INR",
        orderId: "order_res_idem_1",
        paymentId: "pay_res_idem_1",
        customerName: "Arjun Mehta",
        customerEmail: "owner@example.com"
      });
      assert.strictEqual(badAmt.success, false);
      assert.strictEqual(badAmt.fulfilled, false);
      assert.strictEqual(badAmt.code, "AMOUNT_MISMATCH");
      assert.strictEqual(state.payments.length, 0);
      assert.strictEqual(state.resource_purchases.length, 0);

      // Legitimate purchase succeeds once
      const ok1 = await fulfillResourcePurchase({
        userId: USER_1_ID,
        resourceId: BUNDLE_UUID,
        amount: 299,
        currency: "INR",
        orderId: "order_res_idem_1",
        paymentId: "pay_res_idem_1",
        customerName: "Arjun Mehta",
        customerEmail: "owner@example.com"
      });
      assert.strictEqual(ok1.success, true);
      assert.strictEqual(ok1.fulfilled, true);
      assert.strictEqual(ok1.already_fulfilled, false);
      assert.strictEqual(state.payments.length, 1);
      assert.strictEqual(state.resource_purchases.length, 1);

      // Identical replay succeeds idempotently
      const okReplay = await fulfillResourcePurchase({
        userId: USER_1_ID,
        resourceId: BUNDLE_UUID,
        amount: 299,
        currency: "INR",
        orderId: "order_res_idem_1",
        paymentId: "pay_res_idem_1",
        customerName: "Arjun Mehta",
        customerEmail: "owner@example.com"
      });
      assert.strictEqual(okReplay.success, true);
      assert.strictEqual(okReplay.already_fulfilled, true);

      // Replay with mismatched orderId -> IDEMPOTENCY_CONFLICT
      const conflictOrder = await fulfillResourcePurchase({
        userId: USER_1_ID,
        resourceId: BUNDLE_UUID,
        amount: 299,
        currency: "INR",
        orderId: "order_tampered_other",
        paymentId: "pay_res_idem_1",
        customerName: "Arjun Mehta",
        customerEmail: "owner@example.com"
      });
      assert.strictEqual(conflictOrder.success, false);
      assert.strictEqual(conflictOrder.fulfilled, false);
      assert.strictEqual(conflictOrder.code, "IDEMPOTENCY_CONFLICT");

      // Replay with mismatched resourceId (and matching price check or DB conflict) -> rejected cleanly
      const conflictRes = await fulfillResourcePurchase({
        userId: USER_1_ID,
        resourceId: CHEAP_RES_UUID,
        amount: 79,
        currency: "INR",
        orderId: "order_res_idem_1",
        paymentId: "pay_res_idem_1",
        customerName: "Arjun Mehta",
        customerEmail: "owner@example.com"
      });
      assert.strictEqual(conflictRes.success, false);
      assert.strictEqual(conflictRes.fulfilled, false);
      assert.strictEqual(conflictRes.code, "IDEMPOTENCY_CONFLICT");

      // Replay with mismatched amount (tampered DB record simulation) -> IDEMPOTENCY_CONFLICT
      state.payments[0].amount = 1;
      const conflictDbAmt = await fulfillResourcePurchase({
        userId: USER_1_ID,
        resourceId: BUNDLE_UUID,
        amount: 299,
        currency: "INR",
        orderId: "order_res_idem_1",
        paymentId: "pay_res_idem_1",
        customerName: "Arjun Mehta",
        customerEmail: "owner@example.com"
      });
      assert.strictEqual(conflictDbAmt.success, false);
      assert.strictEqual(conflictDbAmt.fulfilled, false);
      assert.strictEqual(conflictDbAmt.code, "IDEMPOTENCY_CONFLICT");
      assert.strictEqual(state.payments.length, 1);
      assert.strictEqual(state.resource_purchases.length, 1);
    });
    // =========================================================================
    // P1-6: MANDATORY P1 SECURITY, AUTHORIZATION, CONCURRENCY & SQL STATIC CHECKS
    // =========================================================================
    console.log("\n[P1-6] P1 Ownership, Dynamic Pricing, ItemType/Status, Concurrency Harness & SQL Static Checks");

    await runTest("[UNIT] 6.1 toPaiseStrict and evaluateRecordOwnership enforce strict integer-paise and fail-closed ownership", async () => {
      assert.strictEqual(toPaiseStrict(299), 29900);
      assert.strictEqual(toPaiseStrict("588.82"), 58882);
      assert.strictEqual(toPaiseStrict(0.01), 1);
      for (const badVal of [null, undefined, true, false, "", "   ", 0, -50, NaN, Infinity, 12.345, "79.999"]) {
        assert.strictEqual(toPaiseStrict(badVal), null, `Expected null for invalid rupee input ${String(badVal)}`);
      }

      const guestAllowed = evaluateRecordOwnership(null, null);
      assert.strictEqual(guestAllowed.allowed, true);
      assert.strictEqual(guestAllowed.isGuest, true);

      const anonOnUserOwned = evaluateRecordOwnership(USER_1_ID, null);
      assert.strictEqual(anonOnUserOwned.allowed, false);
      assert.strictEqual(anonOnUserOwned.denied, true);

      const wrongUserOnOwned = evaluateRecordOwnership(USER_1_ID, { id: USER_2_ID, app_metadata: {} });
      assert.strictEqual(wrongUserOnOwned.allowed, false);
      assert.strictEqual(wrongUserOnOwned.denied, true);

      const ownerAllowed = evaluateRecordOwnership(USER_1_ID, { id: USER_1_ID, app_metadata: {} });
      assert.strictEqual(ownerAllowed.allowed, true);

      const unconfirmedAdminDenied = evaluateRecordOwnership(USER_1_ID, {
        id: ADMIN_ID,
        email: "admin@digitalmuid.com",
        email_confirmed_at: null,
        app_metadata: { role: "admin" }
      });
      assert.strictEqual(unconfirmedAdminDenied.allowed, false);
      assert.strictEqual(unconfirmedAdminDenied.denied, true);

      const adminAllowed = evaluateRecordOwnership(USER_1_ID, {
        id: ADMIN_ID,
        email: "admin@digitalmuid.com",
        email_confirmed_at: "2026-01-01T00:00:00Z",
        app_metadata: { role: "admin" }
      });
      assert.strictEqual(adminAllowed.allowed, true);
    });

    await runTest("[ISOLATED HTTP] 6.2 Unauthenticated requests are REJECTED (403) on user-owned DB & gateway records across bundle, download, purchase-status, recover-lead, and verify-resource-payment", async () => {
      mockRzp.reset();
      const { client, state } = createStatefulMockDb();
      setMockSupabaseServerClient(client);
      setMockRazorpayClient(mockRzp.client);

      // Case A: User-owned bundle purchase in BOTH tables
      const ordBnd = "order_bnd_own_1";
      const payBnd = "pay_bnd_own_1";
      state.payments.push({
        id: "p_bnd_own_1",
        user_id: USER_1_ID,
        item_type: "resource",
        item_id: BUNDLE_UUID,
        amount: 299,
        currency: "INR",
        razorpay_order_id: ordBnd,
        razorpay_payment_id: payBnd,
        status: "captured"
      });
      state.resource_purchases.push({
        id: "rp_bnd_own_1",
        user_id: USER_1_ID,
        resource_id: BUNDLE_UUID,
        razorpay_order_id: ordBnd,
        razorpay_payment_id: payBnd,
        amount: 299,
        currency: "INR",
        status: "active"
      });

      assert.strictEqual((await fetch(`${baseUrl}/api/payments/bundle-files?bundleId=${BUNDLE_UUID}&orderId=${ordBnd}&paymentId=${payBnd}`)).status, 403);
      assert.strictEqual((await fetch(`${baseUrl}/api/payments/get-bundle-files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bundleId: BUNDLE_UUID, orderId: ordBnd, paymentId: payBnd })
      })).status, 403);
      assert.strictEqual((await fetch(`${baseUrl}/api/payments/verify-purchase-status?resourceId=${BUNDLE_UUID}&orderId=${ordBnd}&paymentId=${payBnd}`)).status, 403);
      assert.strictEqual((await fetch(`${baseUrl}/api/payments/get-resource-download-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId: CHEAP_RES_UUID, orderId: ordBnd, paymentId: payBnd })
      })).status, 403);
      assert.strictEqual((await fetch(`${baseUrl}/api/payments/recover-lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: ordBnd, paymentId: payBnd, resourceId: BUNDLE_UUID, customerDetails: { name: "Anon", email: "anon@example.com" } })
      })).status, 403);

      // Case B: Mismatched user_id between payments (null) and resource_purchases (USER_2) -> unauthenticated rejected (403)
      const ordMix1 = "order_bnd_mix_1";
      const payMix1 = "pay_bnd_mix_1";
      state.payments.push({
        id: "p_bnd_mix_1",
        user_id: null,
        item_type: "resource",
        item_id: BUNDLE_UUID,
        amount: 299,
        currency: "INR",
        razorpay_order_id: ordMix1,
        razorpay_payment_id: payMix1,
        status: "captured"
      });
      state.resource_purchases.push({
        id: "rp_bnd_mix_1",
        user_id: USER_2_ID,
        resource_id: BUNDLE_UUID,
        razorpay_order_id: ordMix1,
        razorpay_payment_id: payMix1,
        amount: 299,
        currency: "INR",
        status: "active"
      });
      assert.strictEqual((await fetch(`${baseUrl}/api/payments/bundle-files?bundleId=${BUNDLE_UUID}&orderId=${ordMix1}&paymentId=${payMix1}`)).status, 403);
      assert.strictEqual((await fetch(`${baseUrl}/api/payments/get-bundle-files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bundleId: BUNDLE_UUID, orderId: ordMix1, paymentId: payMix1 })
      })).status, 403);

      // Case C: Reverse mismatch (payments.user_id = USER_1, resource_purchases.user_id = null) -> unauthenticated rejected (403)
      const ordMix2 = "order_bnd_mix_2";
      const payMix2 = "pay_bnd_mix_2";
      state.payments.push({
        id: "p_bnd_mix_2",
        user_id: USER_1_ID,
        item_type: "resource",
        item_id: BUNDLE_UUID,
        amount: 299,
        currency: "INR",
        razorpay_order_id: ordMix2,
        razorpay_payment_id: payMix2,
        status: "captured"
      });
      state.resource_purchases.push({
        id: "rp_bnd_mix_2",
        user_id: null,
        resource_id: BUNDLE_UUID,
        razorpay_order_id: ordMix2,
        razorpay_payment_id: payMix2,
        amount: 299,
        currency: "INR",
        status: "active"
      });
      assert.strictEqual((await fetch(`${baseUrl}/api/payments/bundle-files?bundleId=${BUNDLE_UUID}&orderId=${ordMix2}&paymentId=${payMix2}`)).status, 403);

      // Case D: Gateway-only user-owned order (not yet in DB) -> unauthenticated & cross-user rejected (403) across ALL routes
      const gwOrd = "order_gw_user2_res";
      const gwPay = "pay_gw_user2_res";
      mockRzp.gatewayOrders.set(gwOrd, {
        id: gwOrd,
        amount: 7900,
        currency: "INR",
        notes: { itemType: "resource", resourceId: CHEAP_RES_UUID, userId: USER_2_ID }
      });
      mockRzp.gatewayPayments.set(gwPay, {
        id: gwPay,
        order_id: gwOrd,
        amount: 7900,
        currency: "INR",
        status: "captured"
      });

      for (const headers of [{}, { Authorization: "Bearer token-owner-1" }]) {
        assert.strictEqual((await fetch(`${baseUrl}/api/payments/verify-purchase-status?resourceId=${CHEAP_RES_UUID}&orderId=${gwOrd}&paymentId=${gwPay}`, { headers })).status, 403);
        assert.strictEqual((await fetch(`${baseUrl}/api/payments/get-resource-download-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify({ resourceId: CHEAP_RES_UUID, orderId: gwOrd, paymentId: gwPay })
        })).status, 403);
        assert.strictEqual((await fetch(`${baseUrl}/api/payments/recover-lead`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify({ orderId: gwOrd, paymentId: gwPay, resourceId: CHEAP_RES_UUID, customerDetails: { name: "X", email: "x@example.com" } })
        })).status, 403);
        assert.strictEqual((await fetch(`${baseUrl}/api/payments/verify-resource-payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify({
            razorpay_order_id: gwOrd,
            razorpay_payment_id: gwPay,
            razorpay_signature: signRazorpayCheckout(gwOrd, gwPay),
            resourceId: CHEAP_RES_UUID
          })
        })).status, 403);
      }

      // Case E: Guest verify-resource-payment rejects mismatched customerDetails.email vs gateway notes.customerEmail (403)
      mockRzp.gatewayOrders.set("order_gw_guest_email", {
        id: "order_gw_guest_email",
        amount: 7900,
        currency: "INR",
        notes: { itemType: "resource", resourceId: CHEAP_RES_UUID, customerEmail: "real@example.com" }
      });
      mockRzp.gatewayPayments.set("pay_gw_guest_email", {
        id: "pay_gw_guest_email",
        order_id: "order_gw_guest_email",
        amount: 7900,
        currency: "INR",
        status: "captured",
        email: "real@example.com"
      });
      const guestEmailMismatch = await fetch(`${baseUrl}/api/payments/verify-resource-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpay_order_id: "order_gw_guest_email",
          razorpay_payment_id: "pay_gw_guest_email",
          razorpay_signature: signRazorpayCheckout("order_gw_guest_email", "pay_gw_guest_email"),
          resourceId: CHEAP_RES_UUID,
          customerDetails: { name: "Attacker", email: "spoof@example.com" }
        })
      });
      assert.strictEqual(guestEmailMismatch.status, 403);
    });

    await runTest("[ISOLATED HTTP] 6.3 ₹1 DB rows rejected across all resource endpoints & dynamic bundle DB price (299 -> 499) is strictly enforced", async () => {
      mockRzp.reset();
      const { client, state } = createStatefulMockDb();
      setMockSupabaseServerClient(client);
      setMockRazorpayClient(mockRzp.client);

      // A: ₹1 tampered DB row for ₹79 standalone resource and ₹299 bundle must NEVER unlock
      state.payments.push(
        { id: "p_1rs_res", user_id: USER_1_ID, item_type: "resource", item_id: CHEAP_RES_UUID, amount: 1, currency: "INR", razorpay_order_id: "order_1rs_res", razorpay_payment_id: "pay_1rs_res", status: "captured" },
        { id: "p_1rs_bnd", user_id: USER_1_ID, item_type: "resource", item_id: BUNDLE_UUID, amount: 1, currency: "INR", razorpay_order_id: "order_1rs_bnd", razorpay_payment_id: "pay_1rs_bnd", status: "captured" }
      );
      state.resource_purchases.push(
        { id: "rp_1rs_res", user_id: USER_1_ID, resource_id: CHEAP_RES_UUID, amount: 1, currency: "INR", razorpay_order_id: "order_1rs_res", razorpay_payment_id: "pay_1rs_res", status: "active" },
        { id: "rp_1rs_bnd", user_id: USER_1_ID, resource_id: BUNDLE_UUID, amount: 1, currency: "INR", razorpay_order_id: "order_1rs_bnd", razorpay_payment_id: "pay_1rs_bnd", status: "active" }
      );

      const st1 = await fetch(`${baseUrl}/api/payments/verify-purchase-status?resourceId=${CHEAP_RES_UUID}&orderId=order_1rs_res&paymentId=pay_1rs_res`, {
        headers: { Authorization: "Bearer token-owner-1" }
      });
      assert.strictEqual((await st1.json()).verified, false);

      assert.strictEqual((await fetch(`${baseUrl}/api/payments/get-resource-download-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer token-owner-1" },
        body: JSON.stringify({ resourceId: CHEAP_RES_UUID, orderId: "order_1rs_res", paymentId: "pay_1rs_res" })
      })).status, 403);

      assert.strictEqual((await fetch(`${baseUrl}/api/payments/recover-lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer token-owner-1" },
        body: JSON.stringify({ orderId: "order_1rs_res", paymentId: "pay_1rs_res", resourceId: CHEAP_RES_UUID })
      })).status, 400);

      assert.strictEqual((await fetch(`${baseUrl}/api/payments/bundle-files?bundleId=${BUNDLE_UUID}&orderId=order_1rs_bnd&paymentId=pay_1rs_bnd`, {
        headers: { Authorization: "Bearer token-owner-1" }
      })).status, 403);
      assert.strictEqual((await fetch(`${baseUrl}/api/payments/get-bundle-files`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer token-owner-1" },
        body: JSON.stringify({ bundleId: BUNDLE_UUID, orderId: "order_1rs_bnd", paymentId: "pay_1rs_bnd" })
      })).status, 403);

      // B: Raise bundle catalog price dynamically in DB from 299 -> 499; old ₹299 guest payment rejected for BOTH bundle and bundle child
      state.resources[0].price = 499;
      mockRzp.gatewayOrders.set("order_old_299", {
        id: "order_old_299",
        amount: 29900,
        currency: "INR",
        notes: { itemType: "resource", resourceId: BUNDLE_UUID }
      });
      mockRzp.gatewayPayments.set("pay_old_299", {
        id: "pay_old_299",
        order_id: "order_old_299",
        amount: 29900,
        currency: "INR",
        status: "captured"
      });
      assert.strictEqual((await fetch(`${baseUrl}/api/payments/bundle-files?bundleId=${BUNDLE_UUID}&orderId=order_old_299&paymentId=pay_old_299`)).status, 403);
      assert.strictEqual((await fetch(`${baseUrl}/api/payments/get-resource-download-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId: CHEAP_RES_UUID, orderId: "order_old_299", paymentId: "pay_old_299" })
      })).status, 403);

      // Exact new ₹499 payment WITHOUT signed guest token is rejected (403); WITH signed token unlocks BOTH bundle AND bundle child
      mockRzp.gatewayOrders.set("order_new_499", {
        id: "order_new_499",
        amount: 49900,
        currency: "INR",
        notes: { itemType: "resource", resourceId: BUNDLE_UUID, customerEmail: "guest499@example.com" }
      });
      mockRzp.gatewayPayments.set("pay_new_499", {
        id: "pay_new_499",
        order_id: "order_new_499",
        amount: 49900,
        currency: "INR",
        status: "captured",
        email: "guest499@example.com"
      });
      assert.strictEqual((await fetch(`${baseUrl}/api/payments/bundle-files?bundleId=${BUNDLE_UUID}&orderId=order_new_499&paymentId=pay_new_499`)).status, 403);
      assert.strictEqual((await fetch(`${baseUrl}/api/payments/get-resource-download-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId: CHEAP_RES_UUID, orderId: "order_new_499", paymentId: "pay_new_499" })
      })).status, 403);

      const ver499 = await fetch(`${baseUrl}/api/payments/verify-resource-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpay_order_id: "order_new_499",
          razorpay_payment_id: "pay_new_499",
          razorpay_signature: signRazorpayCheckout("order_new_499", "pay_new_499"),
          resourceId: BUNDLE_UUID,
          customerDetails: { name: "Guest 499", email: "guest499@example.com" }
        })
      });
      const ver499Body = await ver499.json();
      assert.strictEqual(ver499.status, 200);
      assert.ok(ver499Body.resourceAccessToken);

      const okBnd499 = await fetch(`${baseUrl}/api/payments/bundle-files?bundleId=${BUNDLE_UUID}&orderId=order_new_499&paymentId=pay_new_499`, {
        headers: { "x-resource-access-token": ver499Body.resourceAccessToken }
      });
      assert.strictEqual(okBnd499.status, 200);
      assert.strictEqual((await okBnd499.json()).authorized, true);

      const okChild499 = await fetch(`${baseUrl}/api/payments/get-resource-download-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-resource-access-token": ver499Body.resourceAccessToken
        },
        body: JSON.stringify({ resourceId: CHEAP_RES_UUID, orderId: "order_new_499", paymentId: "pay_new_499" })
      });
      assert.strictEqual(okChild499.status, 200);
    });

    await runTest("[ISOLATED HTTP] 6.4 Missing/empty/invalid itemType and non-published course.status are rejected across verify-course-payment & all webhook branches", async () => {
      mockRzp.reset();
      const { client, state } = createStatefulMockDb();
      setMockSupabaseServerClient(client);
      setMockRazorpayClient(mockRzp.client);

      // A: itemType checks on verify-course-payment
      for (const badType of [undefined, "", null, "other", "resource"]) {
        const oid = `order_crs_type_${String(badType)}`;
        const pid = `pay_crs_type_${String(badType)}`;
        mockRzp.gatewayOrders.set(oid, {
          id: oid,
          amount: 499900,
          currency: "INR",
          notes: badType === undefined ? { courseId: COURSE_UUID, userId: USER_1_ID } : { itemType: badType, courseId: COURSE_UUID, userId: USER_1_ID }
        });
        mockRzp.gatewayPayments.set(pid, { id: pid, order_id: oid, amount: 499900, currency: "INR", status: "captured" });

        const res = await fetch(`${baseUrl}/api/payments/verify-course-payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer token-owner-1" },
          body: JSON.stringify({
            razorpay_order_id: oid,
            razorpay_payment_id: pid,
            razorpay_signature: signRazorpayCheckout(oid, pid),
            courseId: COURSE_UUID
          })
        });
        assert.strictEqual(res.status, 400, `verify-course-payment must reject itemType=${String(badType)}`);
      }

      // B: Webhook checks for missing, empty, null, invalid itemType across course/resource/consultation note shapes
      const webhookCases = [
        { itemType: undefined, extra: { courseId: COURSE_UUID, userId: USER_1_ID }, amt: 499900 },
        { itemType: "", extra: { courseId: COURSE_UUID, userId: USER_1_ID }, amt: 499900 },
        { itemType: null, extra: { resourceId: BUNDLE_UUID }, amt: 29900 },
        { itemType: "other", extra: { productId: CONSULTATION_PRODUCT_UUID, bookingDate: "2026-12-26", bookingTime: "10:00 AM", customerEmail: "guest@example.com" }, amt: 58882 }
      ];
      for (let i = 0; i < webhookCases.length; i++) {
        const wc = webhookCases[i];
        const oid = `order_wh_badtype_${i}`;
        const pid = `pay_wh_badtype_${i}`;
        const notes = wc.itemType === undefined ? { ...wc.extra } : { itemType: wc.itemType, ...wc.extra };
        mockRzp.gatewayOrders.set(oid, { id: oid, amount: wc.amt, currency: "INR", notes });
        const raw = Buffer.from(JSON.stringify({
          event: "payment.captured",
          payload: { payment: { entity: { id: pid, order_id: oid, amount: wc.amt, currency: "INR", status: "captured", email: "guest@example.com" } } }
        }), "utf8");
        const whRes = await fetch(`${baseUrl}/api/payments/webhook`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-razorpay-signature": signRazorpayWebhook(raw) },
          body: raw
        });
        const whBody = await whRes.json();
        assert.strictEqual(whRes.status, 200);
        assert.strictEqual(whBody.fulfilled, false);
      }

      // C: Non-published course.status rejected on BOTH verify-course-payment and webhook
      mockRzp.gatewayOrders.set("order_crs_status", {
        id: "order_crs_status",
        amount: 499900,
        currency: "INR",
        notes: { itemType: "course", courseId: COURSE_UUID, userId: USER_1_ID }
      });
      mockRzp.gatewayPayments.set("pay_crs_status", {
        id: "pay_crs_status",
        order_id: "order_crs_status",
        amount: 499900,
        currency: "INR",
        status: "captured"
      });

      for (const badStatus of ["draft", "archived", null, ""]) {
        state.courses[0].status = badStatus;
        const verRes = await fetch(`${baseUrl}/api/payments/verify-course-payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer token-owner-1" },
          body: JSON.stringify({
            razorpay_order_id: "order_crs_status",
            razorpay_payment_id: "pay_crs_status",
            razorpay_signature: signRazorpayCheckout("order_crs_status", "pay_crs_status"),
            courseId: COURSE_UUID
          })
        });
        assert.strictEqual(verRes.status, 400, `verify-course-payment must reject course.status=${String(badStatus)}`);

        const raw = Buffer.from(JSON.stringify({
          event: "payment.captured",
          payload: { payment: { entity: { id: "pay_crs_status", order_id: "order_crs_status", amount: 499900, currency: "INR", status: "captured" } } }
        }), "utf8");
        const whRes = await fetch(`${baseUrl}/api/payments/webhook`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-razorpay-signature": signRazorpayWebhook(raw) },
          body: raw
        });
        assert.strictEqual((await whRes.json()).fulfilled, false, `webhook must reject course.status=${String(badStatus)}`);
      }

      assert.strictEqual(state.payments.length, 0);
      assert.strictEqual(state.course_enrollments.length, 0);
      assert.strictEqual(state.resource_purchases.length, 0);
      assert.strictEqual(state.bookings.length, 0);
    });

    await runTest("[UNIT] 6.5 fulfillResourcePurchase rejects ownership/order/status replays, heals Case B/C via RPC, fails closed when RPC missing, and never calls createUser", async () => {
      // Missing RPC MUST fail closed (MIGRATION_PENDING, zero JS writes)
      {
        const { client, state } = createStatefulMockDb({ simulateMissingResourceRpc: true });
        setMockSupabaseServerClient(client);
        const failRpc = await fulfillResourcePurchase({
          userId: null,
          resourceId: CHEAP_RES_UUID,
          amount: 79,
          currency: "INR",
          orderId: "order_res_missing_rpc",
          paymentId: "pay_res_missing_rpc",
          customerName: "Guest",
          customerEmail: "guest@example.com"
        });
        assert.strictEqual(failRpc.success, false);
        assert.strictEqual(failRpc.fulfilled, false);
        assert.strictEqual(failRpc.retryable, true);
        assert.strictEqual(failRpc.code, "MIGRATION_PENDING");
        assert.strictEqual(state.resource_purchases.length, 0);
        assert.strictEqual(state.payments.length, 0);
        assert.strictEqual(state.crm_leads.length, 0);
      }

      // Atomic RPC path: guest attribution, invariant checks, Case B/C healing & never calling auth.admin
      const { client, state } = createStatefulMockDb({ simulateMissingResourceRpc: false });
      setMockSupabaseServerClient(client);

      const guestRes = await fulfillResourcePurchase({
        userId: null,
        resourceId: CHEAP_RES_UUID,
        amount: 79,
        currency: "INR",
        orderId: "order_res_guest_u1",
        paymentId: "pay_res_guest_u1",
        customerName: "Guest Buyer",
        customerEmail: "owner@example.com" // matches an existing user email intentionally!
      });
      assert.strictEqual(guestRes.success, true);
      assert.strictEqual(guestRes.purchase.user_id, null);
      assert.strictEqual(state.authCreateUserCalls, 0);
      assert.strictEqual(state.authListUsersCalls, 0);

      const userPur = await fulfillResourcePurchase({
        userId: USER_1_ID,
        resourceId: BUNDLE_UUID,
        amount: 299,
        currency: "INR",
        orderId: "order_res_user_1",
        paymentId: "pay_res_user_1",
        customerName: "Arjun",
        customerEmail: "owner@example.com"
      });
      assert.strictEqual(userPur.success, true);

      // Replay with userId: null or different userId or different paymentId for same orderId -> IDEMPOTENCY_CONFLICT
      assert.strictEqual((await fulfillResourcePurchase({
        userId: null,
        resourceId: BUNDLE_UUID,
        amount: 299,
        currency: "INR",
        orderId: "order_res_user_1",
        paymentId: "pay_res_user_1"
      })).code, "IDEMPOTENCY_CONFLICT");

      assert.strictEqual((await fulfillResourcePurchase({
        userId: USER_2_ID,
        resourceId: BUNDLE_UUID,
        amount: 299,
        currency: "INR",
        orderId: "order_res_user_1",
        paymentId: "pay_res_user_1"
      })).code, "IDEMPOTENCY_CONFLICT");

      assert.strictEqual((await fulfillResourcePurchase({
        userId: USER_1_ID,
        resourceId: BUNDLE_UUID,
        amount: 299,
        currency: "INR",
        orderId: "order_res_user_1",
        paymentId: "pay_different_for_same_order"
      })).code, "IDEMPOTENCY_CONFLICT");

      // Second order by same USER_1 for already-owned BUNDLE_UUID -> DUPLICATE_USER_RESOURCE_PURCHASE
      assert.strictEqual((await fulfillResourcePurchase({
        userId: USER_1_ID,
        resourceId: BUNDLE_UUID,
        amount: 299,
        currency: "INR",
        orderId: "order_res_user_1_dup",
        paymentId: "pay_res_user_1_dup"
      })).code, "DUPLICATE_USER_RESOURCE_PURCHASE");

      // Case B heal: payments exists without resource_purchases
      state.payments.push({
        id: "pay_heal_b",
        user_id: USER_2_ID,
        item_type: "resource",
        item_id: CHEAP_RES_UUID,
        amount: 79,
        currency: "INR",
        razorpay_order_id: "order_heal_b",
        razorpay_payment_id: "pay_heal_b",
        status: "captured"
      });
      const healB = await fulfillResourcePurchase({
        userId: USER_2_ID,
        resourceId: CHEAP_RES_UUID,
        amount: 79,
        currency: "INR",
        orderId: "order_heal_b",
        paymentId: "pay_heal_b"
      });
      assert.strictEqual(healB.success, true);
      assert.strictEqual(healB.healed_purchase, true);

      // Case C heal: resource_purchases exists without payments
      state.resource_purchases.push({
        id: "rp_heal_c",
        user_id: null,
        resource_id: CHEAP_RES_UUID,
        razorpay_order_id: "order_heal_c",
        razorpay_payment_id: "pay_heal_c",
        amount: 79,
        currency: "INR",
        status: "active"
      });
      const healC = await fulfillResourcePurchase({
        userId: null,
        resourceId: CHEAP_RES_UUID,
        amount: 79,
        currency: "INR",
        orderId: "order_heal_c",
        paymentId: "pay_heal_c"
      });
      assert.strictEqual(healC.success, true);
      assert.strictEqual(healC.healed_ledger, true);
    });

    await runTest("[CONCURRENCY HARNESS] 6.6 Parallel fulfillResourcePurchase & fulfillConsultationPayment via atomic RPCs + Case C healing deduplicate rows", async () => {
      {
        const { client, state } = createStatefulMockDb({ simulateMissingResourceRpc: false });
        setMockSupabaseServerClient(client);

        const parallel = await Promise.all(
          Array.from({ length: 8 }, () => fulfillResourcePurchase({
            userId: USER_1_ID,
            resourceId: BUNDLE_UUID,
            amount: 299,
            currency: "INR",
            orderId: "order_res_conc_1",
            paymentId: "pay_res_conc_1",
            customerName: "Arjun",
            customerEmail: "owner@example.com"
          }))
        );
        assert.ok(parallel.every((r) => r.success && r.fulfilled));
        assert.strictEqual(state.resource_purchases.length, 1);
        assert.strictEqual(state.payments.length, 1);
        assert.strictEqual(state.crm_leads.length, 1);
      }

      {
        const { client, state } = createStatefulMockDb({ simulateMissingConsultationRpc: false });
        setMockSupabaseServerClient(client);

        state.payments.push({
          id: "pm_con_heal_c",
          user_id: USER_1_ID,
          item_type: "consultation",
          item_id: CONSULTATION_PRODUCT_UUID,
          amount: 588.82,
          currency: "INR",
          razorpay_order_id: "order_con_heal_c",
          razorpay_payment_id: "pay_con_heal_c",
          status: "captured"
        });

        const healCon = await fulfillConsultationPayment({
          userId: USER_1_ID,
          bookingDetails: { customerName: "Arjun", customerEmail: "owner@example.com", date: "2026-12-28", time: "11:00 AM" },
          orderId: "order_con_heal_c",
          paymentId: "pay_con_heal_c",
          productId: CONSULTATION_PRODUCT_UUID,
          amount: 588.82,
          currency: "INR"
        });
        assert.strictEqual(healCon.success, true);
        assert.strictEqual(healCon.healed_booking, true);
        assert.strictEqual(state.bookings.length, 1);

        const concCalls = await Promise.all(
          Array.from({ length: 8 }, () => fulfillConsultationPayment({
            userId: USER_1_ID,
            bookingDetails: { customerName: "Arjun", customerEmail: "owner@example.com", date: "2026-12-29", time: "04:00 PM" },
            orderId: "order_con_conc_1",
            paymentId: "pay_con_conc_1",
            productId: CONSULTATION_PRODUCT_UUID,
            amount: 588.82,
            currency: "INR"
          }))
        );
        assert.ok(concCalls.every((r) => r.success && r.fulfilled));
        assert.strictEqual(state.bookings.length, 2); // 1 healed + 1 concurrent
        assert.strictEqual(state.payments.length, 2);
        assert.strictEqual(state.crm_leads.length, 1);
      }
    });

    await runTest("[SQL/RPC STATIC] 6.7 SQL proposals 20261116000001, 20261116000002 & 20261116000003 enforce schema reconciliation, locking, strict validation & least-privilege grants", async () => {
      const consultSql = fs.readFileSync(
        path.resolve("supabase/migrations/20261116000001_harden_consultation_rpc_amount_validation.sql"),
        "utf8"
      );
      const consultSqlCode = consultSql.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
      assert.strictEqual(consultSqlCode.includes("payment_status"), false, "20261116000001 must not reference non-existent payment_status column");
      assert.strictEqual(consultSqlCode.includes("calendar_event_id"), false, "20261116000001 must not reference non-existent calendar_event_id column");
      assert.strictEqual(/\bmeet_url\b/.test(consultSqlCode.replace("p_booking_details->>'meet_url'", "")), false, "20261116000001 must write meeting_link, not meet_url column");
      assert.strictEqual(consultSqlCode.includes("'Conflict Reschedule'"), false, "20261116000001 must not insert invalid crm_leads status 'Conflict Reschedule'");
      assert.strictEqual(/EXCEPTION\s+WHEN\s+OTHERS\s+THEN\s+NULL/i.test(consultSqlCode), false, "20261116000001 must never swallow errors silently");
      assert.ok(consultSql.includes("meeting_link"));
      assert.ok(consultSql.includes("chk_bookings_status"));
      assert.ok(consultSql.includes("reschedule_pending"));
      assert.ok(consultSql.includes("idx_bookings_payment_id"));
      assert.ok(consultSql.includes("idx_bookings_razorpay_order_id"));
      assert.ok(consultSql.includes("pg_catalog.pg_advisory_xact_lock"));
      assert.ok(consultSql.includes("FOR SHARE"));
      assert.ok(consultSql.includes("FOR UPDATE"));
      assert.ok(consultSql.includes("'NaN'::NUMERIC"));
      assert.ok(consultSql.includes("EXCEPTION WHEN unique_violation"));
      assert.ok(consultSql.includes("v_new_payment.invoice_number"));
      assert.ok(consultSql.includes("IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'postgres')"));
      assert.ok(consultSql.includes("REVOKE ALL ON FUNCTION public.fulfill_consultation_payment(UUID, TEXT, TEXT, NUMERIC, TEXT, JSONB, UUID) FROM PUBLIC, anon, authenticated"));
      assert.ok(consultSql.includes("GRANT EXECUTE ON FUNCTION public.fulfill_consultation_payment(UUID, TEXT, TEXT, NUMERIC, TEXT, JSONB, UUID) TO service_role"));

      const courseSql = fs.readFileSync(
        path.resolve("supabase/migrations/20261116000002_harden_course_fulfillment_published_check.sql"),
        "utf8"
      );
      assert.ok(courseSql.includes("SET search_path = pg_catalog, pg_temp"));
      assert.ok(courseSql.includes("SECURITY DEFINER"));
      assert.ok(courseSql.includes("<> 'published'"));
      assert.ok(courseSql.includes("pg_catalog.round(p_amount, 2) IS DISTINCT FROM v_effective_price"));
      assert.ok(courseSql.includes("DELETE FROM public.student_course_wishlist"));
      assert.ok(courseSql.includes("OWNER TO postgres"));
      assert.ok(courseSql.includes("REVOKE ALL ON FUNCTION public.fulfill_course_enrollment(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated"));
      assert.ok(courseSql.includes("GRANT EXECUTE ON FUNCTION public.fulfill_course_enrollment(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT) TO service_role"));

      const resourceSql = fs.readFileSync(
        path.resolve("supabase/migrations/20261116000003_atomic_resource_payment_fulfillment.sql"),
        "utf8"
      );
      assert.strictEqual(/EXCEPTION\s+WHEN\s+OTHERS\s+THEN\s+NULL/i.test(resourceSql), false, "20261116000003 must never swallow errors silently");
      assert.ok(resourceSql.includes("ADD COLUMN IF NOT EXISTS customer_email TEXT"));
      assert.ok(resourceSql.includes("ADD COLUMN IF NOT EXISTS customer_phone TEXT"));
      assert.ok(resourceSql.includes("ADD COLUMN IF NOT EXISTS invoice_number TEXT"));
      assert.ok(resourceSql.includes("ALTER TABLE public.resource_purchases\n  ALTER COLUMN user_id DROP NOT NULL"));
      assert.ok(resourceSql.includes("uq_user_resource_purchase"));
      assert.ok(resourceSql.includes("WHERE user_id IS NOT NULL"));
      assert.ok(resourceSql.includes("uq_resource_purchases_razorpay_payment_id"));
      assert.ok(resourceSql.includes("uq_resource_purchases_razorpay_order_id"));
      assert.ok(resourceSql.includes("DUPLICATE_USER_RESOURCE_PURCHASE"));
      assert.ok(resourceSql.includes("CREATE OR REPLACE FUNCTION public.fulfill_resource_purchase("));
      assert.ok(resourceSql.includes("SET search_path = pg_catalog, pg_temp"));
      assert.ok(resourceSql.includes("SECURITY DEFINER"));
      assert.ok(resourceSql.includes("pg_catalog.pg_advisory_xact_lock"));
      assert.ok(resourceSql.includes("FOR SHARE"));
      assert.ok(resourceSql.includes("FOR UPDATE"));
      assert.ok(resourceSql.includes("'NaN'::NUMERIC"));
      assert.ok(resourceSql.includes("IS DISTINCT FROM 'published'"));
      assert.ok(resourceSql.includes("IS DISTINCT FROM 'paid'"));
      assert.ok(resourceSql.includes("IS DISTINCT FROM p_user_id"));
      assert.ok(resourceSql.includes("v_payment.invoice_number"));
      assert.ok(resourceSql.includes("IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'postgres')"));
      assert.ok(resourceSql.includes("REVOKE ALL ON FUNCTION public.fulfill_resource_purchase(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated"));
      assert.ok(resourceSql.includes("GRANT EXECUTE ON FUNCTION public.fulfill_resource_purchase(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role"));
    });

    await runTest("[ISOLATED HTTP] 6.8 Dedicated signed guest resource token: issuance, expiry, tampering, cross-binding & secret fail-closed", async () => {
      mockRzp.reset();
      const { client, state } = createStatefulMockDb();
      setMockSupabaseServerClient(client);
      setMockRazorpayClient(mockRzp.client);

      const guestOrd = "order_tok_guest_1";
      const guestPay = "pay_tok_guest_1";
      mockRzp.gatewayOrders.set(guestOrd, {
        id: guestOrd,
        amount: 29900,
        currency: "INR",
        notes: { itemType: "resource", resourceId: BUNDLE_UUID, customerEmail: "guesttok@example.com" }
      });
      mockRzp.gatewayPayments.set(guestPay, {
        id: guestPay,
        order_id: guestOrd,
        amount: 29900,
        currency: "INR",
        status: "captured",
        email: "guesttok@example.com"
      });

      // Missing/short RESOURCE_TOKEN_HMAC_SECRET fails closed on guest token issuance (503) without breaking authenticated user flows
      const savedSecret = process.env.RESOURCE_TOKEN_HMAC_SECRET;
      process.env.RESOURCE_TOKEN_HMAC_SECRET = "too_short";
      try {
        const noSecRes = await fetch(`${baseUrl}/api/payments/verify-resource-payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            razorpay_order_id: guestOrd,
            razorpay_payment_id: guestPay,
            razorpay_signature: signRazorpayCheckout(guestOrd, guestPay),
            resourceId: BUNDLE_UUID,
            customerDetails: { name: "Guest Tok", email: "guesttok@example.com" }
          })
        });
        assert.strictEqual(noSecRes.status, 503);
        assert.strictEqual((await noSecRes.json()).code, "RESOURCE_TOKEN_SECRET_MISSING");
      } finally {
        process.env.RESOURCE_TOKEN_HMAC_SECRET = savedSecret;
      }

      // Valid secret mints guest token cleanly
      const verRes = await fetch(`${baseUrl}/api/payments/verify-resource-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpay_order_id: guestOrd,
          razorpay_payment_id: guestPay,
          razorpay_signature: signRazorpayCheckout(guestOrd, guestPay),
          resourceId: BUNDLE_UUID,
          customerDetails: { name: "Guest Tok", email: "guesttok@example.com" }
        })
      });
      const verBody = await verRes.json();
      assert.strictEqual(verRes.status, 200);
      assert.ok(verBody.resourceAccessToken);

      // Token rejected when tampered, expired, wrong resource, wrong payment, or mismatched guest email
      const tampered = `${verBody.resourceAccessToken}x`;
      const expired = generateGuestResourceToken({
        paymentId: guestPay,
        orderId: guestOrd,
        resourceId: BUNDLE_UUID,
        email: "guesttok@example.com",
        expiresInMs: 1000,
        nowMs: Date.now() - 60000
      });
      const wrongResourceTok = generateGuestResourceToken({
        paymentId: guestPay,
        orderId: guestOrd,
        resourceId: CHEAP_RES_UUID,
        email: "guesttok@example.com"
      });
      const wrongPayTok = generateGuestResourceToken({
        paymentId: "pay_other_999",
        orderId: guestOrd,
        resourceId: BUNDLE_UUID,
        email: "guesttok@example.com"
      });
      const wrongIdentityTok = generateGuestResourceToken({
        paymentId: guestPay,
        orderId: guestOrd,
        resourceId: BUNDLE_UUID,
        email: "evil@example.com"
      });

      assert.strictEqual(verifyGuestResourceToken(expired, { paymentId: guestPay, orderId: guestOrd, resourceId: BUNDLE_UUID }).code, "EXPIRED_GUEST_TOKEN");

      for (const badTok of [null, tampered, expired, wrongResourceTok, wrongPayTok, wrongIdentityTok]) {
        const hdr = badTok ? { "x-resource-access-token": badTok } : {};
        assert.strictEqual((await fetch(`${baseUrl}/api/payments/verify-purchase-status?resourceId=${BUNDLE_UUID}&orderId=${guestOrd}&paymentId=${guestPay}`, { headers: hdr })).status, 403);
        assert.strictEqual((await fetch(`${baseUrl}/api/payments/bundle-files?bundleId=${BUNDLE_UUID}&orderId=${guestOrd}&paymentId=${guestPay}`, { headers: hdr })).status, 403);
        assert.strictEqual((await fetch(`${baseUrl}/api/payments/get-bundle-files`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...hdr },
          body: JSON.stringify({ bundleId: BUNDLE_UUID, orderId: guestOrd, paymentId: guestPay })
        })).status, 403);
        assert.strictEqual((await fetch(`${baseUrl}/api/payments/get-resource-download-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...hdr },
          body: JSON.stringify({ resourceId: CHEAP_RES_UUID, orderId: guestOrd, paymentId: guestPay })
        })).status, 403);
        assert.strictEqual((await fetch(`${baseUrl}/api/payments/recover-lead`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...hdr },
          body: JSON.stringify({ orderId: guestOrd, paymentId: guestPay, resourceId: BUNDLE_UUID, customerDetails: { name: "Guest Tok", email: "guesttok@example.com" } })
        })).status, 403);
      }

      // Valid guest token succeeds across ALL guest endpoints
      const okHdr = { "x-resource-access-token": verBody.resourceAccessToken };
      assert.strictEqual((await fetch(`${baseUrl}/api/payments/verify-purchase-status?resourceId=${BUNDLE_UUID}&orderId=${guestOrd}&paymentId=${guestPay}`, { headers: okHdr })).status, 200);
      assert.strictEqual((await fetch(`${baseUrl}/api/payments/bundle-files?bundleId=${BUNDLE_UUID}&orderId=${guestOrd}&paymentId=${guestPay}`, { headers: okHdr })).status, 200);
      assert.strictEqual((await fetch(`${baseUrl}/api/payments/get-bundle-files`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...okHdr },
        body: JSON.stringify({ bundleId: BUNDLE_UUID, orderId: guestOrd, paymentId: guestPay })
      })).status, 200);
      assert.strictEqual((await fetch(`${baseUrl}/api/payments/get-resource-download-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...okHdr },
        body: JSON.stringify({ resourceId: CHEAP_RES_UUID, orderId: guestOrd, paymentId: guestPay })
      })).status, 200);
      assert.strictEqual((await fetch(`${baseUrl}/api/payments/recover-lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...okHdr },
        body: JSON.stringify({ orderId: guestOrd, paymentId: guestPay, resourceId: BUNDLE_UUID, customerDetails: { name: "Guest Tok", email: "guesttok@example.com" } })
      })).status, 200);

      // Authenticated user-owned checkout does NOT mint a guest token and still accesses normally with Bearer token
      const usrOrd = "order_tok_user_1";
      const usrPay = "pay_tok_user_1";
      mockRzp.gatewayOrders.set(usrOrd, {
        id: usrOrd,
        amount: 7900,
        currency: "INR",
        notes: { itemType: "resource", resourceId: CHEAP_RES_UUID, userId: USER_1_ID }
      });
      mockRzp.gatewayPayments.set(usrPay, {
        id: usrPay,
        order_id: usrOrd,
        amount: 7900,
        currency: "INR",
        status: "captured",
        email: "owner@example.com"
      });
      const authVer = await fetch(`${baseUrl}/api/payments/verify-resource-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer token-owner-1" },
        body: JSON.stringify({
          razorpay_order_id: usrOrd,
          razorpay_payment_id: usrPay,
          razorpay_signature: signRazorpayCheckout(usrOrd, usrPay),
          resourceId: CHEAP_RES_UUID
        })
      });
      const authVerBody = await authVer.json();
      assert.strictEqual(authVer.status, 200);
      assert.strictEqual(authVerBody.resourceAccessToken, undefined);

      const authDl = await fetch(`${baseUrl}/api/payments/get-resource-download-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer token-owner-1" },
        body: JSON.stringify({ resourceId: CHEAP_RES_UUID })
      });
      assert.strictEqual(authDl.status, 200);
      assert.strictEqual(state.resource_purchases.filter((r) => r.user_id === USER_1_ID).length, 1);
    });

    await runTest("[UNIT & ISOLATED HTTP] 6.9 RPC failure classification (42883, unambiguous/ambiguous PGRST202, thrown error) & webhook 503 retry_required", async () => {
      mockRzp.reset();

      const cases = [
        {
          label: "SQLSTATE 42883 missing RPC",
          override: async () => ({ data: null, error: { code: "42883", message: "function does not exist" } }),
          expectedCode: "MIGRATION_PENDING",
          expectedRetryable: true,
          expectedWebhookStatus: 503
        },
        {
          label: "Unambiguous PGRST202",
          override: async () => ({ data: null, error: { code: "PGRST202", message: "Could not find the function in the schema cache" } }),
          expectedCode: "MIGRATION_PENDING",
          expectedRetryable: true,
          expectedWebhookStatus: 503
        },
        {
          label: "Ambiguous overload PGRST202",
          override: async () => ({ data: null, error: { code: "PGRST202", message: "Could not choose the best candidate function between overloads" } }),
          expectedCode: "RPC_SCHEMA_ERROR",
          expectedRetryable: false,
          expectedWebhookStatus: 200
        },
        {
          label: "Thrown transient network failure",
          override: async () => { throw new Error("fetch failed"); },
          expectedCode: "RPC_UNAVAILABLE",
          expectedRetryable: true,
          expectedWebhookStatus: 503
        }
      ];

      for (const tc of cases) {
        const { client, state } = createStatefulMockDb({
          consultationRpcOverride: tc.override,
          resourceRpcOverride: tc.override,
          courseRpcOverride: tc.override
        });
        setMockSupabaseServerClient(client);
        setMockRazorpayClient(mockRzp.client);

        const r1 = await fulfillConsultationPayment({
          userId: null,
          bookingDetails: { customerName: "Client", customerEmail: "c@example.com", date: "2026-12-30", time: "10:00 AM" },
          orderId: "order_rpc_c",
          paymentId: "pay_rpc_c",
          productId: CONSULTATION_PRODUCT_UUID,
          amount: 588.82,
          currency: "INR"
        });
        assert.strictEqual(r1.code, tc.expectedCode, `Consultation failed for ${tc.label}`);
        assert.strictEqual(r1.retryable, tc.expectedRetryable);

        const r2 = await fulfillResourcePurchase({
          userId: null,
          resourceId: BUNDLE_UUID,
          amount: 299,
          currency: "INR",
          orderId: "order_rpc_r",
          paymentId: "pay_rpc_r"
        });
        assert.strictEqual(r2.code, tc.expectedCode, `Resource failed for ${tc.label}`);
        assert.strictEqual(r2.retryable, tc.expectedRetryable);

        const r3 = await fulfillCourseEnrollment({
          userId: USER_1_ID,
          courseId: COURSE_UUID,
          amount: 4999,
          currency: "INR",
          orderId: "order_rpc_k",
          paymentId: "pay_rpc_k"
        });
        assert.strictEqual(r3.code, tc.expectedCode, `Course failed for ${tc.label}`);
        assert.strictEqual(r3.retryable, tc.expectedRetryable);

        // Webhook returns 503 retry_required on retryable failures, 200 on non-retryable RPC_SCHEMA_ERROR
        mockRzp.gatewayOrders.set("order_wh_rpc_err", {
          id: "order_wh_rpc_err",
          amount: 29900,
          currency: "INR",
          notes: { itemType: "resource", resourceId: BUNDLE_UUID, customerEmail: "wh@example.com" }
        });
        const whRaw = Buffer.from(JSON.stringify({
          event: "payment.captured",
          payload: { payment: { entity: { id: "pay_wh_rpc_err", order_id: "order_wh_rpc_err", amount: 29900, currency: "INR", status: "captured", email: "wh@example.com" } } }
        }), "utf8");
        const whResp = await fetch(`${baseUrl}/api/payments/webhook`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-razorpay-signature": signRazorpayWebhook(whRaw) },
          body: whRaw
        });
        const whBody = await whResp.json();
        assert.strictEqual(whResp.status, tc.expectedWebhookStatus, `Webhook status failed for ${tc.label}`);
        if (tc.expectedWebhookStatus === 503) {
          assert.strictEqual(whBody.status, "retry_required");
          assert.strictEqual(whBody.retryable, true);
        }

        // Verify zero JS fallback DB writes occurred
        assert.strictEqual(state.payments.length, 0);
        assert.strictEqual(state.bookings.length, 0);
        assert.strictEqual(state.resource_purchases.length, 0);
        assert.strictEqual(state.course_enrollments.length, 0);
      }
    });

    await runTest("[ISOLATED HTTP & UNIT] 6.10 Admin attribution preservation, duplicate user purchase 409, and strict monetary validation", async () => {
      mockRzp.reset();
      const { client, state } = createStatefulMockDb();
      setMockSupabaseServerClient(client);
      setMockRazorpayClient(mockRzp.client);

      // 1. Admin verifying a guest resource payment keeps user_id: null and buyer email (never admin.id / admin@digitalmuid.com)
      const admResOrd = "order_adm_guest_res";
      const admResPay = "pay_adm_guest_res";
      mockRzp.gatewayOrders.set(admResOrd, {
        id: admResOrd,
        amount: 29900,
        currency: "INR",
        notes: { itemType: "resource", resourceId: BUNDLE_UUID, customerEmail: "actualbuyer@example.com", customerName: "Actual Buyer" }
      });
      mockRzp.gatewayPayments.set(admResPay, {
        id: admResPay,
        order_id: admResOrd,
        amount: 29900,
        currency: "INR",
        status: "captured",
        email: "actualbuyer@example.com"
      });
      const admResVer = await fetch(`${baseUrl}/api/payments/verify-resource-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer token-admin" },
        body: JSON.stringify({
          razorpay_order_id: admResOrd,
          razorpay_payment_id: admResPay,
          razorpay_signature: signRazorpayCheckout(admResOrd, admResPay),
          resourceId: BUNDLE_UUID
        })
      });
      const admResBody = await admResVer.json();
      assert.strictEqual(admResVer.status, 200);
      assert.strictEqual(admResBody.purchase.user_id, null);
      assert.strictEqual(admResBody.payment.user_id, null);
      assert.strictEqual(admResBody.purchase.customer_email, "actualbuyer@example.com");
      assert.ok(admResBody.resourceAccessToken);

      // 2. Admin verifying a guest consultation payment keeps user_id: null and buyer's email
      const admConOrd = "order_adm_guest_con";
      const admConPay = "pay_adm_guest_con";
      mockRzp.gatewayOrders.set(admConOrd, {
        id: admConOrd,
        amount: 58882,
        currency: "INR",
        notes: { itemType: "consultation", productId: CONSULTATION_PRODUCT_UUID, customerEmail: "conbuyer@example.com" }
      });
      mockRzp.gatewayPayments.set(admConPay, {
        id: admConPay,
        order_id: admConOrd,
        amount: 58882,
        currency: "INR",
        status: "captured",
        email: "conbuyer@example.com"
      });
      const admConVer = await fetch(`${baseUrl}/api/payments/verify-consultation-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer token-admin" },
        body: JSON.stringify({
          razorpay_order_id: admConOrd,
          razorpay_payment_id: admConPay,
          razorpay_signature: signRazorpayCheckout(admConOrd, admConPay),
          bookingDetails: {
            customerName: "Consult Buyer",
            customerEmail: "conbuyer@example.com",
            date: "2026-12-31",
            time: "03:00 PM"
          }
        })
      });
      const admConBody = await admConVer.json();
      assert.strictEqual(admConVer.status, 200);
      assert.strictEqual(admConBody.booking.user_id, null);
      assert.strictEqual(admConBody.payment.user_id, null);
      assert.strictEqual(admConBody.booking.customer_email, "conbuyer@example.com");

      // 3. Duplicate active user resource purchase pre-check returns 409 before creating gateway order
      state.resource_purchases.push({
        id: "rp_existing_u1",
        user_id: USER_1_ID,
        resource_id: BUNDLE_UUID,
        razorpay_order_id: "order_prev_u1",
        razorpay_payment_id: "pay_prev_u1",
        amount: 299,
        currency: "INR",
        status: "active"
      });
      const ordersBefore = mockRzp.gatewayOrders.size;
      const dupCreateRes = await fetch(`${baseUrl}/api/payments/create-resource-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer token-owner-1" },
        body: JSON.stringify({ resourceId: BUNDLE_UUID })
      });
      const dupCreateBody = await dupCreateRes.json();
      assert.strictEqual(dupCreateRes.status, 409);
      assert.strictEqual(dupCreateBody.code, "DUPLICATE_USER_RESOURCE_PURCHASE");
      assert.strictEqual(mockRzp.gatewayOrders.size, ordersBefore);

      // 4. verify-resource-payment maps DUPLICATE_USER_RESOURCE_PURCHASE -> 409
      const dupOrd = "order_dup_res_u1";
      const dupPay = "pay_dup_res_u1";
      mockRzp.gatewayOrders.set(dupOrd, {
        id: dupOrd,
        amount: 29900,
        currency: "INR",
        notes: { itemType: "resource", resourceId: BUNDLE_UUID, userId: USER_1_ID }
      });
      mockRzp.gatewayPayments.set(dupPay, {
        id: dupPay,
        order_id: dupOrd,
        amount: 29900,
        currency: "INR",
        status: "captured"
      });
      const dupVerifyRes = await fetch(`${baseUrl}/api/payments/verify-resource-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer token-owner-1" },
        body: JSON.stringify({
          razorpay_order_id: dupOrd,
          razorpay_payment_id: dupPay,
          razorpay_signature: signRazorpayCheckout(dupOrd, dupPay),
          resourceId: BUNDLE_UUID
        })
      });
      assert.strictEqual(dupVerifyRes.status, 409);
      assert.strictEqual((await dupVerifyRes.json()).code, "DUPLICATE_USER_RESOURCE_PURCHASE");

      // 5. Strict integer-paise checks: reject 1-paise drift & >2-decimal prices
      const driftCheck = verifyInvoicePaymentAuthorization({
        paymentRecord: { status: "captured", amount: 299, currency: "INR", razorpay_order_id: "ord_1" },
        rzpPayment: { status: "captured", order_id: "ord_1", amount: 29901, currency: "INR" }
      });
      assert.strictEqual(driftCheck.authorized, false);

      const subPaiseCheck = verifyInvoicePaymentAuthorization({
        paymentRecord: { status: "captured", amount: 299.999, currency: "INR", razorpay_order_id: "ord_1" },
        rzpPayment: { status: "captured", order_id: "ord_1", amount: 30000, currency: "INR" }
      });
      assert.strictEqual(subPaiseCheck.authorized, false);

      assert.strictEqual(
        getAuthoritativeResourcePricing(BUNDLE_UUID, { id: BUNDLE_UUID, status: "published", access_type: "paid", price: 299.999, currency: "INR" }).accessType,
        "unverified"
      );
      assert.strictEqual(
        getAuthoritativeResourcePricing(BUNDLE_UUID, { id: BUNDLE_UUID, status: "published", access_type: "paid", price: Number.NaN, currency: "INR" }).accessType,
        "unverified"
      );
    });
  } finally {
    setMockSupabaseServerClient(null);
    setMockRazorpayClient(null);
    server.close();
  }

  console.log("\n==============================================================================");
  console.log("TEST RESULTS BY CATEGORY:");
  for (const [cat, counts] of Object.entries(categoryStats)) {
    console.log(`  - [${cat}]: ${counts.passed} PASSED, ${counts.failed} FAILED`);
  }
  console.log(`P0/P1 PAYMENT SECURITY REMEDIATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==============================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
