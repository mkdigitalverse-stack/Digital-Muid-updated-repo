/**
 * DIGITALMUID V4.3 — SEPARATE-CONNECTION POSTGRESQL CONCURRENCY & ROLLBACK RUNNER
 * File: supabase/tests/v4_3_postgres_concurrency_test.mjs
 *
 * Security & Guard Boundaries:
 *   - Client runner enforces strict loopback host (`127.0.0.1` / `localhost` / `::1`)
 *     and exact target database `digitalmuid_ci_chronological_replay`.
 *   - SQL session verifies PostgreSQL major version 17 and canonical seeded fixture data.
 *   - Workers execute inside explicit `BEGIN; SET LOCAL ROLE service_role; ... COMMIT;`
 *     with unconditional `ROLLBACK` cleanup on errors/failed assertions.
 *   - Never connects to hosted Supabase, production, or external databases.
 */

import assert from "node:assert";
import pg from "pg";

const { Client } = pg;

const EXPECTED_DB = "digitalmuid_ci_chronological_replay";

function assertSafeTargetConfig() {
  const host = (process.env.PGHOST || "127.0.0.1").trim();
  const db = (process.env.PGDATABASE || EXPECTED_DB).trim();
  const forbidden = /supabase|kpuxtsworzkueyffjaaz|rds\.amazonaws\.com/i;

  // Node runner strictly enforces loopback PGHOST (workflow connects to Docker service port on 127.0.0.1)
  if (!["127.0.0.1", "localhost", "::1"].includes(host)) {
    throw new Error(`SAFETY HALT: PGHOST must be loopback (127.0.0.1/localhost/::1), got "${host}".`);
  }
  if (db !== EXPECTED_DB) {
    throw new Error(`SAFETY HALT: PGDATABASE must be "${EXPECTED_DB}", got "${db}".`);
  }
  if (forbidden.test(host) || forbidden.test(db)) {
    throw new Error("SAFETY HALT: Forbidden hosted PostgreSQL target detected.");
  }
}

async function openClient() {
  const client = new Client({
    host: process.env.PGHOST || "127.0.0.1",
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE || EXPECTED_DB
  });
  await client.connect();
  return client;
}

async function withClients(count, fn) {
  const clients = await Promise.all(Array.from({ length: count }, () => openClient()));
  try {
    return await fn(clients);
  } finally {
    // Ensure any open transaction / held row lock is rolled back cleanly before disconnecting
    await Promise.all(
      clients.map(async (c) => {
        await c.query("ROLLBACK").catch(() => {});
        await c.end().catch(() => {});
      })
    );
  }
}

/**
 * Deterministic barrier synchronization (zero wall-clock setTimeout reliance):
 * Waits until every worker coroutine is parked on the release barrier before releasing all at once.
 */
async function runSynchronized(clients, workerFn) {
  let releaseBarrier;
  const barrier = new Promise((resolve) => {
    releaseBarrier = resolve;
  });

  let readyCount = 0;
  let markAllReady;
  const allReady = new Promise((resolve) => {
    markAllReady = resolve;
  });

  const settledPromise = Promise.all(
    clients.map(async (client, idx) => {
      readyCount += 1;
      if (readyCount === clients.length) {
        markAllReady();
      }
      await barrier;
      return workerFn(client, idx);
    })
  );

  await allReady;
  releaseBarrier();
  return settledPromise;
}

function assertParamBindingMatch(sql, params) {
  if (params === undefined) return;
  assert.ok(Array.isArray(params), `SQL params must be an array, got ${typeof params}`);
  const withoutStrings = sql.replace(/'(?:''|[^'])*'/g, "''");
  const placeholderNums = [...withoutStrings.matchAll(/\$(\d+)\b/g)].map((m) => Number(m[1]));
  const uniqueSorted = [...new Set(placeholderNums)].sort((a, b) => a - b);
  const expectedCount = uniqueSorted.length > 0 ? uniqueSorted[uniqueSorted.length - 1] : 0;

  assert.strictEqual(
    uniqueSorted.length,
    expectedCount,
    `Non-contiguous SQL placeholders in query (${uniqueSorted.join(", ")}): ${sql}`
  );
  assert.strictEqual(
    params.length,
    expectedCount,
    `SQL parameter count mismatch: query expects ${expectedCount} ($1..$${expectedCount}), supplied ${params.length}`
  );
}

async function execAsServiceRole(client, sql, params) {
  assertParamBindingMatch(sql, params);
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL ROLE service_role");
    const result = await client.query(sql, params);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  }
}

async function run() {
  assertSafeTargetConfig();

  await withClients(1, async ([admin]) => {
    const { rows } = await admin.query(
      "SELECT current_database() AS db, version() AS ver, current_setting('server_version_num')::int AS ver_num"
    );
    assert.strictEqual(rows[0].db, EXPECTED_DB);
    assert.ok(
      rows[0].ver_num >= 170000 && rows[0].ver_num < 180000,
      `Expected PostgreSQL 17, got ${rows[0].ver_num} (${rows[0].ver})`
    );
    console.log(`Connected to disposable PostgreSQL 17: ${rows[0].db} (${rows[0].ver.split(",")[0]})`);

    // Explicitly verify canonical consultation_products fixture row seeded by 20260926000001
    const { rows: prodRows } = await admin.query(
      `SELECT id, base_price::numeric AS base_price, gst_rate::numeric AS gst_rate, currency, active
       FROM public.consultation_products
       WHERE id = '31bbb9bf-ce10-4da4-a517-dfc673f9b875'::uuid`
    );
    assert.strictEqual(prodRows.length, 1, "FIXTURE ERROR: Missing seeded default consultation_products row.");
    assert.strictEqual(prodRows[0].active, true);
    assert.strictEqual(Number(prodRows[0].base_price), 499);
    assert.strictEqual(Number(prodRows[0].gst_rate), 0.18);
    assert.strictEqual(prodRows[0].currency, "INR");

    await admin.query(`
      INSERT INTO auth.users (id, email, raw_user_meta_data)
      VALUES
        ('dddddddd-0000-4000-8000-000000000001', 'ci.conc1@example.test', '{"full_name":"Conc One"}'::jsonb),
        ('dddddddd-0000-4000-8000-000000000002', 'ci.conc2@example.test', '{"full_name":"Conc Two"}'::jsonb)
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.courses (id, slug, title, price, offer_price, currency, status, enrolled_count)
      VALUES ('eeeeeeee-0000-4000-8000-000000000001', 'ci-conc-course', 'CI Concurrency Course', 588.82, NULL, 'INR', 'published', 0)
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.resources (id, title, slug, resource_type, access_type, price, currency, status)
      VALUES ('ffffffff-0000-4000-8000-000000000001', 'CI Conc Resource', 'ci-conc-resource', 'bundle', 'paid', 588.82, 'INR', 'published')
      ON CONFLICT (id) DO NOTHING;
    `);
  });

  // 1. Consultation simultaneous duplicate replay race (3 distinct connections as service_role)
  await withClients(3, async (clients) => {
    const details = JSON.stringify({
      customer_name: "Conc Consult",
      customer_email: "conc.consult@example.test",
      customer_phone: "9876543210",
      business_name: "Conc Corp",
      primary_challenge: "Latency",
      desired_outcome: "Consistency",
      date: "2026-12-20",
      time: "03:00 PM"
    });

    const results = await runSynchronized(clients, async (c) => {
      const { rows } = await execAsServiceRole(
        c,
        `SELECT public.fulfill_consultation_payment($1::uuid, $2, $3, $4::numeric, 'INR', $5::jsonb) AS res`,
        ["dddddddd-0000-4000-8000-000000000001", "ord_conc_con_dup", "pay_conc_con_dup", 588.82, details]
      );
      return rows[0].res;
    });

    for (const r of results) {
      assert.strictEqual(r.success, true, `Expected success=true, got ${JSON.stringify(r)}`);
    }
    const alreadyCount = results.filter((r) => r.already_fulfilled === true).length;
    assert.strictEqual(alreadyCount, 2, `Expected exactly 2 already_fulfilled replays, got ${alreadyCount}`);

    const { rows: cnts } = await clients[0].query(`
      SELECT
        (SELECT COUNT(*)::int FROM public.payments WHERE razorpay_payment_id = 'pay_conc_con_dup' AND invoice_number ~ '^DM/') AS pay_cnt,
        (SELECT COUNT(*)::int FROM public.bookings WHERE payment_id = 'pay_conc_con_dup' AND invoice_number ~ '^DM/') AS bkg_cnt,
        (SELECT COUNT(*)::int FROM public.crm_leads WHERE notes IS NOT NULL AND pg_catalog.strpos(notes, 'pay_conc_con_dup') > 0) AS lead_cnt
    `);
    assert.deepStrictEqual(cnts[0], { pay_cnt: 1, bkg_cnt: 1, lead_cnt: 1 });
    console.log("  ✓ PASS [C1]: Consultation duplicate replay across 3 connections created 1 payment, 1 booking, 1 lead & invoice");
  });

  // 2. Consultation simultaneous same-slot race (2 distinct payments racing for 2026-12-21 05:00 PM)
  await withClients(2, async (clients) => {
    const results = await runSynchronized(clients, async (c, idx) => {
      const details = JSON.stringify({
        customer_name: `Slot Racer ${idx}`,
        customer_email: `racer${idx}@example.test`,
        customer_phone: "9000000001",
        business_name: "Race Co",
        primary_challenge: "Slot",
        desired_outcome: "Safe conflict",
        date: "2026-12-21",
        time: "05:00 PM"
      });
      const { rows } = await execAsServiceRole(
        c,
        `SELECT public.fulfill_consultation_payment($1::uuid, $2, $3, $4::numeric, 'INR', $5::jsonb) AS res`,
        [
          idx === 0 ? "dddddddd-0000-4000-8000-000000000001" : "dddddddd-0000-4000-8000-000000000002",
          `ord_conc_slot_${idx}`,
          `pay_conc_slot_${idx}`,
          588.82,
          details
        ]
      );
      return rows[0].res;
    });

    assert.strictEqual(results[0].success, true);
    assert.strictEqual(results[1].success, true);

    const { rows: slotRows } = await clients[0].query(`
      SELECT status FROM public.bookings
      WHERE booking_date = '2026-12-21' AND booking_time = '05:00 PM'
      ORDER BY status ASC
    `);
    assert.deepStrictEqual(
      slotRows.map((r) => r.status),
      ["confirmed", "reschedule_pending"]
    );
    const { rows: slotMeta } = await clients[0].query(`
      SELECT
        (SELECT COUNT(*)::int FROM public.payments WHERE razorpay_payment_id IN ('pay_conc_slot_0', 'pay_conc_slot_1')) AS pay_cnt,
        (SELECT COUNT(*)::int FROM public.crm_leads WHERE notes IS NOT NULL AND (notes LIKE '%pay_conc_slot_0%' OR notes LIKE '%pay_conc_slot_1%')) AS lead_cnt
    `);
    assert.deepStrictEqual(slotMeta[0], { pay_cnt: 2, lead_cnt: 2 });
    console.log("  ✓ PASS [C2]: Consultation concurrent same-slot race produced 1 confirmed + 1 reschedule_pending & 2 payments/leads");
  });

  // 3. Course enrollment concurrent verify + webhook race (3 connections)
  await withClients(3, async (clients) => {
    const results = await runSynchronized(clients, async (c) => {
      const { rows } = await execAsServiceRole(
        c,
        `SELECT public.fulfill_course_enrollment($1::uuid, $2::uuid, $3::numeric, 'INR', $4, $5) AS res`,
        [
          "dddddddd-0000-4000-8000-000000000001",
          "eeeeeeee-0000-4000-8000-000000000001",
          588.82,
          "ord_conc_crs_1",
          "pay_conc_crs_1"
        ]
      );
      return rows[0].res;
    });

    for (const r of results) {
      assert.strictEqual(r.success, true);
    }
    assert.strictEqual(results.filter((r) => r.already_fulfilled === true).length, 2);

    const { rows: stats } = await clients[0].query(`
      SELECT
        (SELECT COUNT(*)::int FROM public.payments WHERE razorpay_payment_id = 'pay_conc_crs_1' AND invoice_number ~ '^DM/') AS pay_cnt,
        (SELECT COUNT(*)::int FROM public.course_enrollments
          WHERE user_id = 'dddddddd-0000-4000-8000-000000000001'
            AND course_id = 'eeeeeeee-0000-4000-8000-000000000001'
            AND status = 'active'
            AND enrollment_id ~ '^DM-ENR-[0-9]+$') AS enr_cnt,
        (SELECT enrolled_count::int FROM public.courses WHERE id = 'eeeeeeee-0000-4000-8000-000000000001') AS crs_cnt,
        (SELECT COUNT(*)::int FROM public.notifications WHERE user_id = 'dddddddd-0000-4000-8000-000000000001' AND type = 'enrollment_success') AS notif_cnt
    `);
    assert.deepStrictEqual(stats[0], { pay_cnt: 1, enr_cnt: 1, crs_cnt: 1, notif_cnt: 1 });
    console.log("  ✓ PASS [C3]: Course concurrent enrollment across 3 connections persisted once (enrolled_count=1)");
  });

  // 4. Resource purchase concurrent duplicate replay + distinct active duplicate rollback check
  await withClients(3, async (clients) => {
    const results = await runSynchronized(clients, async (c) => {
      const { rows } = await execAsServiceRole(
        c,
        `SELECT public.fulfill_resource_purchase($1::uuid, $2::uuid, $3::numeric, $4, $5, $6, $7, $8, $9, $10) AS res`,
        [
          "dddddddd-0000-4000-8000-000000000001",
          "ffffffff-0000-4000-8000-000000000001",
          588.82,
          "INR",
          "ord_conc_res_1",
          "pay_conc_res_1",
          "Conc One",
          "ci.conc1@example.test",
          "9111111111",
          "CI Conc Resource"
        ]
      );
      return rows[0].res;
    });
    for (const r of results) {
      assert.strictEqual(r.success, true);
    }
    const { rows: u1Counts } = await clients[0].query(`
      SELECT
        (SELECT COUNT(*)::int FROM public.payments WHERE razorpay_payment_id = 'pay_conc_res_1') AS pay_cnt,
        (SELECT COUNT(*)::int FROM public.resource_purchases WHERE razorpay_payment_id = 'pay_conc_res_1' AND status = 'active') AS pur_cnt
    `);
    assert.deepStrictEqual(u1Counts[0], { pay_cnt: 1, pur_cnt: 1 });

    // Race two distinct orders for the same user+resource -> exactly 1 winner, loser rolled back
    const dupResults = await runSynchronized(clients.slice(0, 2), async (c, idx) => {
      try {
        const { rows } = await execAsServiceRole(
          c,
          `SELECT public.fulfill_resource_purchase($1::uuid, $2::uuid, $3::numeric, $4, $5, $6, $7, $8, $9, $10) AS res`,
          [
            "dddddddd-0000-4000-8000-000000000002",
            "ffffffff-0000-4000-8000-000000000001",
            588.82,
            "INR",
            `ord_conc_res_u2_${idx}`,
            `pay_conc_res_u2_${idx}`,
            "Conc Two",
            "ci.conc2@example.test",
            "9222222222",
            "CI Conc Resource"
          ]
        );
        return { ok: true, res: rows[0].res };
      } catch (err) {
        return { ok: false, message: err.message };
      }
    });

    const winnerCount = dupResults.filter((d) => d.ok && d.res.success === true).length;
    const loserCount = dupResults.filter((d) => !d.ok || d.res.success === false).length;
    assert.strictEqual(winnerCount, 1, `Expected 1 winner on duplicate user resource race, got ${JSON.stringify(dupResults)}`);
    assert.strictEqual(loserCount, 1);

    const { rows: u2Counts } = await clients[0].query(`
      SELECT
        (SELECT COUNT(*)::int FROM public.payments WHERE razorpay_payment_id IN ('pay_conc_res_u2_0', 'pay_conc_res_u2_1')) AS pay_cnt,
        (SELECT COUNT(*)::int FROM public.resource_purchases
          WHERE user_id = 'dddddddd-0000-4000-8000-000000000002'
            AND resource_id = 'ffffffff-0000-4000-8000-000000000001'
            AND status = 'active') AS pur_cnt
    `);
    assert.deepStrictEqual(u2Counts[0], { pay_cnt: 1, pur_cnt: 1 });
    console.log("  ✓ PASS [C4]: Resource concurrent race blocked duplicate active purchase & rolled back loser atomically");
  });

  // 5 & 6. Credit note concurrent idempotency, competing refunds, deterministic DB lock serialization, & savepoint recovery
  await withClients(3, async (clients) => {
    // 5A: Concurrent idempotent refund retries with identical refund_id
    const idemp = await runSynchronized(clients, async (c) => {
      const { rows } = await execAsServiceRole(
        c,
        `SELECT * FROM public.record_credit_note_with_limit($1, $2, $3::numeric, $4, $5::uuid, 'INR', '2026-07-01T10:00:00Z')`,
        ["pay_conc_crs_1", "rfnd_conc_1", 300.00, "Concurrent partial refund", "dddddddd-0000-4000-8000-000000000001"]
      );
      return rows[0];
    });
    assert.strictEqual(idemp.filter((r) => r.is_idempotent_duplicate === false).length, 1);
    assert.strictEqual(idemp.filter((r) => r.is_idempotent_duplicate === true).length, 2);

    // 5B: Two concurrent refunds of 200.00 each against remaining balance 288.82 -> strictly 1 succeeds, 1 rejects with P0001
    const comp = await runSynchronized(clients.slice(0, 2), async (c, idx) => {
      try {
        const { rows } = await execAsServiceRole(
          c,
          `SELECT * FROM public.record_credit_note_with_limit($1, $2, $3::numeric, $4, $5::uuid, 'INR', '2026-07-02T10:00:00Z')`,
          ["pay_conc_crs_1", `rfnd_conc_race_${idx}`, 200.00, `Competing refund ${idx}`, "dddddddd-0000-4000-8000-000000000001"]
        );
        return { ok: true, row: rows[0] };
      } catch (err) {
        return { ok: false, code: err.code, message: err.message };
      }
    });

    assert.strictEqual(comp.filter((x) => x.ok).length, 1, `Expected 1 winning partial refund, got ${JSON.stringify(comp)}`);
    const loser = comp.find((x) => !x.ok);
    assert.ok(loser, "Expected 1 losing over-limit refund");
    assert.strictEqual(loser.code, "P0001");
    assert.match(loser.message, /exceeds remaining eligible refundable balance/i);

    const { rows: midState } = await clients[2].query(`
      SELECT
        (SELECT COUNT(*)::int FROM public.credit_notes WHERE payment_id = 'pay_conc_crs_1') AS cnt,
        (SELECT SUM(amount)::numeric::float8 FROM public.credit_notes WHERE payment_id = 'pay_conc_crs_1') AS total_refunded,
        (SELECT status FROM public.payments WHERE razorpay_payment_id = 'pay_conc_crs_1') AS pay_status
    `);
    assert.deepStrictEqual(midState[0], { cnt: 2, total_refunded: 500, pay_status: "captured" });

    // 5C: Explicit SQL transaction unique_violation + SAVEPOINT rollback recovery test
    await clients[0].query("BEGIN");
    try {
      await clients[0].query("SAVEPOINT sp_dup_pay");
      let caught23505 = false;
      try {
        await clients[0].query(`
          INSERT INTO public.payments (user_id, item_type, item_title, amount, currency, razorpay_order_id, razorpay_payment_id, status)
          VALUES ('dddddddd-0000-4000-8000-000000000001', 'course', 'Dup Test', 588.82, 'INR', 'ord_conc_crs_1', 'pay_conc_crs_1', 'pending')
        `);
      } catch (err) {
        if (err.code === "23505") caught23505 = true;
      }
      assert.strictEqual(caught23505, true, "Expected SQLSTATE 23505 unique_violation on duplicate razorpay_payment_id");
      await clients[0].query("ROLLBACK TO SAVEPOINT sp_dup_pay");
      const { rows: afterSp } = await clients[0].query(
        `SELECT COUNT(*)::int AS cnt FROM public.credit_notes WHERE payment_id = 'pay_conc_crs_1'`
      );
      assert.strictEqual(afterSp[0].cnt, 2);
    } finally {
      await clients[0].query("ROLLBACK").catch(() => {});
    }

    console.log("  ✓ PASS [C5]: Credit-note concurrent serialization, over-limit rejection & savepoint recovery passed");

    // 6. Deterministic DB Lock-Contention Invariant Test (proves Client B blocks on FOR UPDATE and reads Client A's committed total)
    const { rows: pidRow } = await clients[1].query("SELECT pg_backend_pid() AS pid");
    const blockedPid = pidRow[0].pid;

    await clients[0].query("BEGIN");
    await clients[1].query("BEGIN");
    try {
      await clients[0].query("SET LOCAL ROLE service_role");
      await clients[0].query(
        `SELECT * FROM public.record_credit_note_with_limit($1, $2, $3::numeric, $4, $5::uuid, 'INR', '2026-07-03T10:00:00Z')`,
        ["pay_conc_crs_1", "rfnd_conc_lock_a", 88.82, "Final refund under lock", "dddddddd-0000-4000-8000-000000000001"]
      );

      // Launch Client 1 while Client 0 still holds FOR UPDATE lock uncommitted
      await clients[1].query("SET LOCAL ROLE service_role");
      const waiterPromise = clients[1]
        .query(
          `SELECT * FROM public.record_credit_note_with_limit($1, $2, $3::numeric, $4, $5::uuid, 'INR', '2026-07-03T10:00:05Z')`,
          ["pay_conc_crs_1", "rfnd_conc_lock_b", 10.00, "Must fail after lock release", "dddddddd-0000-4000-8000-000000000001"]
        )
        .then((r) => ({ ok: true, rows: r.rows }))
        .catch((err) => ({ ok: false, code: err.code, message: err.message }));

      // Wait deterministically on pg_stat_activity until PostgreSQL reports Client 1 blocked on Lock
      let sawLockWait = false;
      for (let i = 0; i < 60; i += 1) {
        const { rows: act } = await clients[2].query(
          `SELECT state, wait_event_type FROM pg_stat_activity WHERE pid = $1`,
          [blockedPid]
        );
        if (act[0] && act[0].state === "active" && act[0].wait_event_type === "Lock") {
          sawLockWait = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 50));
      }
      assert.strictEqual(sawLockWait, true, "Expected Client B to visibly wait on PostgreSQL Lock in pg_stat_activity");

      // Commit Client 0 (total refunded becomes 588.82, status='refunded'), releasing lock
      await clients[0].query("COMMIT");

      const waiterResult = await waiterPromise;
      await clients[1].query("ROLLBACK").catch(() => {});

      assert.strictEqual(waiterResult.ok, false, "Blocked Client B must fail after Client A consumed remaining balance");
      assert.strictEqual(waiterResult.code, "P0001");
      assert.match(waiterResult.message, /exceeds remaining eligible refundable balance/i);

      const { rows: finalState } = await clients[2].query(`
        SELECT
          (SELECT COUNT(*)::int FROM public.credit_notes WHERE payment_id = 'pay_conc_crs_1') AS cnt,
          (SELECT SUM(amount)::numeric::float8 FROM public.credit_notes WHERE payment_id = 'pay_conc_crs_1') AS total_refunded,
          (SELECT status FROM public.payments WHERE razorpay_payment_id = 'pay_conc_crs_1') AS pay_status,
          (SELECT COUNT(*)::int FROM public.credit_notes WHERE refund_id = 'rfnd_conc_lock_b') AS leaked_cnt
      `);
      assert.deepStrictEqual(finalState[0], {
        cnt: 3,
        total_refunded: 588.82,
        pay_status: "refunded",
        leaked_cnt: 0
      });
    } finally {
      await clients[0].query("ROLLBACK").catch(() => {});
      await clients[1].query("ROLLBACK").catch(() => {});
    }

    console.log("  ✓ PASS [C6]: Deterministic pg_stat_activity Lock wait & post-COMMIT balance enforcement verified");
  });

  console.log("ALL SEPARATE-CONNECTION POSTGRESQL CONCURRENCY TESTS PASSED");
}

run().catch((err) => {
  console.error("CONCURRENCY TEST FAILURE:", err);
  process.exit(1);
});
