/**
 * DIGITALMUID V4.3 — P0-3 GENUINE MULTI-CONNECTION POSTGRESQL 17 CONCURRENCY RUNNER
 * File: supabase/tests/p0_3_postgres_concurrency_test.mjs
 *
 * Executes REAL concurrent PostgreSQL transactions across separate `pg.Client`
 * connections against `public.record_free_resource_download(...)` to verify:
 *   P0-3-C1: 15 simultaneous separate-connection `service_role` calls against
 *            max_hits=10 produce EXACTLY 10 increments (`download_count = 10`)
 *            and EXACTLY 5 `RATE_LIMITED` responses with zero lost updates.
 *   P0-3-C2: Concurrent admin `free -> paid` transition holds row lock while a
 *            separate `service_role` counter call blocks on `wait_event_type='Lock'`
 *            (verified via `pg_stat_activity`), then after admin commit returns
 *            `NOT_ELIGIBLE` with 0 increment and 0 phantom rate-limit rows.
 *   P0-3-C3: Concurrent admin `published -> archived` transition holds row lock
 *            while a separate `service_role` counter call blocks on `Lock`, then
 *            after commit returns `NOT_ELIGIBLE` with 0 increment and 0 phantom rows.
 *
 * Security & Guard Boundaries:
 *   - Enforces strict loopback `PGHOST` (`127.0.0.1` / `localhost` / `::1`) and
 *     exact disposable CI database `digitalmuid_ci_chronological_replay`.
 *   - Verifies PostgreSQL major version 17 (`server_version_num` 170000..179999).
 *   - Uses ONLY synthetic fixture UUIDs (`99200000-...`) with collision guard and
 *     guaranteed `finally` cleanup. Never connects to Supabase or production.
 */

import assert from "node:assert";
import pg from "pg";

const { Client } = pg;

const EXPECTED_DB = "digitalmuid_ci_chronological_replay";

const SYNTH_BURST_RES_ID = "99200000-0000-4000-8000-000000000001";
const SYNTH_PAID_RACE_RES_ID = "99200000-0000-4000-8000-000000000002";
const SYNTH_ARCHIVE_RACE_RES_ID = "99200000-0000-4000-8000-000000000003";
const ALL_SYNTH_RES_IDS = [
  SYNTH_BURST_RES_ID,
  SYNTH_PAID_RACE_RES_ID,
  SYNTH_ARCHIVE_RACE_RES_ID
];

function assertSafeTargetConfig() {
  const host = (process.env.PGHOST || "127.0.0.1").trim();
  const db = (process.env.PGDATABASE || EXPECTED_DB).trim();
  const forbidden = /supabase|kpuxtsworzkueyffjaaz|rds\.amazonaws\.com/i;

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
    await Promise.all(
      clients.map(async (c) => {
        await c.query("ROLLBACK").catch(() => {});
        await c.end().catch(() => {});
      })
    );
  }
}

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

async function waitForBackendLockWait(observerClient, targetPid, maxAttempts = 80) {
  for (let i = 0; i < maxAttempts; i += 1) {
    const { rows } = await observerClient.query(
      `SELECT wait_event_type, wait_event, state
       FROM pg_catalog.pg_stat_activity
       WHERE pid = $1`,
      [targetPid]
    );
    if (rows.length === 1 && rows[0].wait_event_type === "Lock") {
      return rows[0];
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Expected backend pid=${targetPid} to enter wait_event_type='Lock' on FOR UPDATE row lock.`);
}

async function cleanupSyntheticFixtures(adminClient) {
  await adminClient.query(
    `DELETE FROM public.resource_download_rate_limits WHERE resource_id = ANY($1::uuid[])`,
    [ALL_SYNTH_RES_IDS]
  );
  await adminClient.query(
    `DELETE FROM public.resources WHERE id = ANY($1::uuid[])`,
    [ALL_SYNTH_RES_IDS]
  );
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
    console.log(`[P0-3 PG Concurrency] Connected to disposable PG 17: ${rows[0].db}`);

    // Collision guard before seeding synthetic fixtures
    const { rows: existing } = await admin.query(
      `SELECT id FROM public.resources WHERE id = ANY($1::uuid[]) OR slug LIKE 'p03-conc-%'`,
      [ALL_SYNTH_RES_IDS]
    );
    assert.strictEqual(existing.length, 0, "COLLISION GUARD: Synthetic P0-3 concurrency fixture already exists.");

    try {
      // Seed 3 synthetic published free resources (all NOT NULL + CHECK constraints satisfied)
      await admin.query(
        `INSERT INTO public.resources (
           id, title, slug, description, resource_type, category,
           file_url, thumbnail_url, author, file_type, file_size,
           reading_time_minutes, tags, status, is_featured, published_at, download_count,
           preview_points, what_is_included, lead_capture_required, seo_title, seo_description,
           access_type, price, currency
         )
         VALUES
           ($1::uuid, 'P03 Conc Burst Free', 'p03-conc-burst-free', 'Desc', 'Guide', 'Growth',
            '/downloads/p03-conc-burst.pdf', 'https://example.test/c1.png', 'Digital Muid', 'PDF', '1 MB',
            5, ARRAY['free'], 'published', false, NOW(), 0, '{}'::text[], '{}'::text[], false, 'SEO', 'SEO', 'free', 0, 'INR'),
           ($2::uuid, 'P03 Conc Paid Race', 'p03-conc-paid-race', 'Desc', 'Guide', 'Growth',
            '/downloads/p03-conc-paid.pdf', 'https://example.test/c2.png', 'Digital Muid', 'PDF', '1 MB',
            5, ARRAY['free'], 'published', false, NOW(), 0, '{}'::text[], '{}'::text[], false, 'SEO', 'SEO', 'free', 0, 'INR'),
           ($3::uuid, 'P03 Conc Archive Race', 'p03-conc-archive-race', 'Desc', 'Guide', 'Growth',
            '/downloads/p03-conc-archive.pdf', 'https://example.test/c3.png', 'Digital Muid', 'PDF', '1 MB',
            5, ARRAY['free'], 'published', false, NOW(), 0, '{}'::text[], '{}'::text[], false, 'SEO', 'SEO', 'free', 0, 'INR')`,
        [SYNTH_BURST_RES_ID, SYNTH_PAID_RACE_RES_ID, SYNTH_ARCHIVE_RACE_RES_ID]
      );

      // -----------------------------------------------------------------------
      // P0-3-C1: 15 concurrent separate-connection calls against max_hits=10
      // -----------------------------------------------------------------------
      const burstHash = "d".repeat(64);
      const burstResults = await withClients(15, async (workers) => {
        return runSynchronized(workers, async (client) => {
          const { rows: rpcRows } = await execAsServiceRole(
            client,
            `SELECT public.record_free_resource_download($1::uuid, $2::text, $3::integer, $4::integer) AS res`,
            [SYNTH_BURST_RES_ID, burstHash, 900, 10]
          );
          return rpcRows[0].res;
        });
      });

      const allowedRows = burstResults.filter((r) => r.code === "OK" && r.allowed === true && r.incremented === true);
      const rateLimitedRows = burstResults.filter((r) => r.code === "RATE_LIMITED" && r.allowed === false && r.incremented === false);
      assert.strictEqual(allowedRows.length, 10, `Expected exactly 10 allowed increments, got ${allowedRows.length}`);
      assert.strictEqual(rateLimitedRows.length, 5, `Expected exactly 5 RATE_LIMITED responses, got ${rateLimitedRows.length}`);

      const { rows: afterBurstRes } = await admin.query(
        `SELECT download_count FROM public.resources WHERE id = $1::uuid`,
        [SYNTH_BURST_RES_ID]
      );
      assert.strictEqual(Number(afterBurstRes[0].download_count), 10, "download_count must equal exactly 10 after 15 concurrent calls");
      console.log("  ✓ PASS [P0-3-C1]: 15 separate-connection concurrent calls -> exactly 10 increments, 5 RATE_LIMITED, 0 lost updates");

      // -----------------------------------------------------------------------
      // P0-3-C2: Concurrent admin `free -> paid` transition under FOR UPDATE
      // -----------------------------------------------------------------------
      await withClients(3, async ([adminTxn, workerTxn, observer]) => {
        const { rows: pidRows } = await workerTxn.query("SELECT pg_backend_pid() AS pid");
        const workerPid = pidRows[0].pid;

        await adminTxn.query("BEGIN");
        await adminTxn.query(
          `SELECT id FROM public.resources WHERE id = $1::uuid FOR UPDATE`,
          [SYNTH_PAID_RACE_RES_ID]
        );
        await adminTxn.query(
          `UPDATE public.resources SET access_type = 'paid', price = 299 WHERE id = $1::uuid`,
          [SYNTH_PAID_RACE_RES_ID]
        );

        const raceHash = "e".repeat(64);
        const workerPromise = execAsServiceRole(
          workerTxn,
          `SELECT public.record_free_resource_download($1::uuid, $2::text, $3::integer, $4::integer) AS res`,
          [SYNTH_PAID_RACE_RES_ID, raceHash, 900, 10]
        );

        // Prove worker genuinely blocks on PostgreSQL row lock before admin commits
        const lockInfo = await waitForBackendLockWait(observer, workerPid);
        assert.strictEqual(lockInfo.wait_event_type, "Lock");

        await adminTxn.query("COMMIT");

        const { rows: workerOut } = await workerPromise;
        const outcome = workerOut[0].res;
        assert.strictEqual(outcome.allowed, false);
        assert.strictEqual(outcome.incremented, false);
        assert.strictEqual(outcome.code, "NOT_ELIGIBLE");

        const { rows: resState } = await observer.query(
          `SELECT download_count, access_type, price FROM public.resources WHERE id = $1::uuid`,
          [SYNTH_PAID_RACE_RES_ID]
        );
        assert.strictEqual(Number(resState[0].download_count), 0);
        assert.strictEqual(resState[0].access_type, "paid");

        const { rows: rlState } = await observer.query(
          `SELECT COUNT(*)::int AS cnt FROM public.resource_download_rate_limits WHERE resource_id = $1::uuid`,
          [SYNTH_PAID_RACE_RES_ID]
        );
        assert.strictEqual(rlState[0].cnt, 0, "Zero rate-limit hits must be recorded when concurrent free->paid wins");
      });
      console.log("  ✓ PASS [P0-3-C2]: Concurrent admin free->paid serialized via FOR UPDATE lock wait -> NOT_ELIGIBLE, 0 increments, 0 phantom rate-limit hits");

      // -----------------------------------------------------------------------
      // P0-3-C3: Concurrent admin `published -> archived` transition under FOR UPDATE
      // -----------------------------------------------------------------------
      await withClients(3, async ([adminTxn, workerTxn, observer]) => {
        const { rows: pidRows } = await workerTxn.query("SELECT pg_backend_pid() AS pid");
        const workerPid = pidRows[0].pid;

        await adminTxn.query("BEGIN");
        await adminTxn.query(
          `SELECT id FROM public.resources WHERE id = $1::uuid FOR UPDATE`,
          [SYNTH_ARCHIVE_RACE_RES_ID]
        );
        await adminTxn.query(
          `UPDATE public.resources SET status = 'archived' WHERE id = $1::uuid`,
          [SYNTH_ARCHIVE_RACE_RES_ID]
        );

        const archiveHash = "f".repeat(64);
        const workerPromise = execAsServiceRole(
          workerTxn,
          `SELECT public.record_free_resource_download($1::uuid, $2::text, $3::integer, $4::integer) AS res`,
          [SYNTH_ARCHIVE_RACE_RES_ID, archiveHash, 900, 10]
        );

        const lockInfo = await waitForBackendLockWait(observer, workerPid);
        assert.strictEqual(lockInfo.wait_event_type, "Lock");

        await adminTxn.query("COMMIT");

        const { rows: workerOut } = await workerPromise;
        const outcome = workerOut[0].res;
        assert.strictEqual(outcome.allowed, false);
        assert.strictEqual(outcome.incremented, false);
        assert.strictEqual(outcome.code, "NOT_ELIGIBLE");

        const { rows: resState } = await observer.query(
          `SELECT download_count, status FROM public.resources WHERE id = $1::uuid`,
          [SYNTH_ARCHIVE_RACE_RES_ID]
        );
        assert.strictEqual(Number(resState[0].download_count), 0);
        assert.strictEqual(resState[0].status, "archived");

        const { rows: rlState } = await observer.query(
          `SELECT COUNT(*)::int AS cnt FROM public.resource_download_rate_limits WHERE resource_id = $1::uuid`,
          [SYNTH_ARCHIVE_RACE_RES_ID]
        );
        assert.strictEqual(rlState[0].cnt, 0, "Zero rate-limit hits must be recorded when concurrent published->archived wins");
      });
      console.log("  ✓ PASS [P0-3-C3]: Concurrent admin published->archived serialized via FOR UPDATE lock wait -> NOT_ELIGIBLE, 0 increments, 0 phantom rate-limit hits");
    } finally {
      await cleanupSyntheticFixtures(admin);
    }
  });

  console.log("=== ALL P0-3 SEPARATE-CONNECTION POSTGRESQL 17 CONCURRENCY TESTS PASSED ===");
}

run().catch((err) => {
  console.error("P0-3 POSTGRESQL CONCURRENCY TEST FAILED:", err);
  process.exit(1);
});
