/**
 * DIGITALMUID V4.3 — FINDING 4 REMEDIATION: LOCAL PROTECTED-DOWNLOAD FILESYSTEM BOUNDARY TEST SUITE
 *
 * Strictly offline & local (zero external network, zero Supabase/PostgreSQL/Razorpay/Resend calls,
 * and zero mutations outside isolated temporary directories under os.tmpdir()).
 *
 * Verifies:
 *  1. Symlink used as the configured `protected_downloads` base directory is rejected
 *     (unit + HTTP, with and without trailing slash, and fail-closed in multi-candidate lists).
 *  2. Non-directory configured base paths (regular file, FIFO, filesystem root) are rejected.
 *  3. Normal real directory remains accepted (unit fd open + HTTP 200 exact bytes + non-existent
 *     earlier candidate skip).
 *  4. Final-file symlink attacks (outside target and inside-directory target) remain rejected via
 *     kernel `O_NOFOLLOW` (`ELOOP` -> `symlink_rejected`, HTTP 404).
 *  5. Directories and real POSIX FIFOs (named pipes) are rejected without blocking (`O_NONBLOCK` +
 *     `fstatSync(fd).isFile()` -> `not_a_regular_file`, HTTP 404).
 *  6. Path traversal, nested segments, NUL/control chars, and non-allowlisted filenames remain rejected.
 *  7. Existing post-open file replacement / inode mismatch (`file_identity_mismatch`), post-open
 *     symlink replacement (`symlink_rejected`), and post-validation pre-stream swap (original fd
 *     bytes streamed) continue to work.
 *  8. Deterministic safe parent-directory replacement tests (isolated temp fixtures):
 *     - Post-open swap of base directory to symlink -> `directory_changed` (HTTP 404).
 *     - Pre-open swap of base directory to symlink (persistent) -> `directory_changed` (HTTP 404).
 *     - Pre-open A-B-A swap of base directory to symlink & immediate restore -> `file_identity_mismatch`
 *       (HTTP 404, zero outside bytes leaked).
 *     - Pre-open swap of base directory to a different real directory -> `directory_changed` (HTTP 404).
 *  9. Existing 4-file allowlist and 900-second paid asset token expiry remain unchanged.
 *
 * Run: npx tsx tests/finding4_protected_fs_boundary_test.ts
 */

import assert from "node:assert";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import express from "express";

// Configure isolated offline environment BEFORE importing server modules
process.env.NODE_ENV = "test";
process.env.APP_ENV = "test";
process.env.FORCE_DEV_SAFETY = "true";
process.env.SUPABASE_URL = "https://finding4-isolated-offline-test.supabase.co";
process.env.RAZORPAY_KEY_ID = "rzp_test_finding4_offline_only";
process.env.RAZORPAY_KEY_SECRET = "rzp_test_finding4_offline_secret_32_bytes!!";
process.env.RAZORPAY_WEBHOOK_SECRET = "whsec_test_finding4_offline_secret_32_byte!";
process.env.ASSET_TOKEN_HMAC_SECRET = "finding4_asset_hmac_secret_min_32_chars_ok!";
process.env.INVOICE_TOKEN_HMAC_SECRET = "finding4_invoice_hmac_secret_min_32_chars_!";
process.env.RESOURCE_TOKEN_HMAC_SECRET = "finding4_resource_hmac_secret_min_32_chars!";
process.env.TRUST_PROXY_HOPS = "0";

const {
  default: paymentRoutes,
  resetPaymentRateLimits,
  ASSET_TOKEN_TTL_MS,
  ASSET_TOKEN_MAX_TTL_MS,
  BUNDLE_ITEMS,
  PROTECTED_LOCAL_ASSET_ALLOWLIST,
  resolveAllowlistedProtectedFilename,
  openConfinedProtectedAssetFd,
  resolveConfinedProtectedAssetPath,
  setTestProtectedAssetConfig,
  generateAssetAccessToken
} = await import("../server/paymentRoutes.js");

let passed = 0;
let failed = 0;
let assertionCount = 0;

function eq<T>(actual: T, expected: T, message?: string) {
  assertionCount += 1;
  assert.strictEqual(actual, expected, message);
}

function ok(value: unknown, message?: string) {
  assertionCount += 1;
  assert.ok(value, message);
}

async function runTest(name: string, fn: () => Promise<void> | void) {
  const before = assertionCount;
  try {
    await fn();
    const delta = assertionCount - before;
    if (delta === 0) throw new Error("Test executed 0 assertions");
    passed += 1;
    console.log(`  [PASS] ${name} (${delta} assertions)`);
  } catch (err: any) {
    failed += 1;
    console.error(`  [FAIL] ${name}: ${err?.message || err}`);
  }
}

async function startPaymentServer() {
  const app = express();
  app.use(express.json());
  app.use("/api/payments", paymentRoutes);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("Failed to bind local test server");
  return { server, baseUrl: `http://127.0.0.1:${addr.port}` };
}

async function stopServer(server: http.Server) {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

function makeTempFixture(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function createFifoSafe(fifoPath: string): boolean {
  try {
    execFileSync("mkfifo", [fifoPath], { stdio: "ignore" });
    return fs.lstatSync(fifoPath).isFIFO();
  } catch {
    return false;
  }
}

async function main() {
  console.log("========================================================================");
  console.log("DIGITALMUID V4.3 — FINDING 4: PROTECTED FILESYSTEM BOUNDARY TESTS");
  console.log("========================================================================");

  const { server, baseUrl } = await startPaymentServer();
  const targetResourceId = BUNDLE_ITEMS[0].id;
  const targetFilename = "meta-ads-campaign-planner-workbook.pdf";
  const validToken = generateAssetAccessToken(targetResourceId)!;

  try {
    // 1. Symlink used as configured protected_downloads base directory is rejected
    await runTest("4.1 Symlink configured as protected_downloads base directory is rejected (unit, trailing slash, multi-candidate fail-closed, and HTTP)", async () => {
      const tmpRoot = makeTempFixture("dm-f4-basedir-sym-");
      try {
        const outsideTargetDir = path.join(tmpRoot, "outside_target");
        const realSafeDir = path.join(tmpRoot, "real_safe");
        const symlinkBaseDir = path.join(tmpRoot, "protected_downloads");
        fs.mkdirSync(outsideTargetDir);
        fs.mkdirSync(realSafeDir);
        fs.writeFileSync(path.join(outsideTargetDir, targetFilename), "%PDF-1.4 OUTSIDE_SECRET_VIA_SYMLINK_BASEDIR");
        fs.writeFileSync(path.join(realSafeDir, targetFilename), "%PDF-1.4 LEGIT_SAFE_DIR_CONTENT");
        fs.symlinkSync(outsideTargetDir, symlinkBaseDir, "dir");

        // 1a. Direct openConfinedProtectedAssetFd rejects symlink base dir
        const r1 = openConfinedProtectedAssetFd(targetFilename, [symlinkBaseDir]);
        eq(r1.ok, false);
        eq(r1.reason, "base_dir_symlink_rejected");

        // 1b. Trailing slash on symlink base dir STILL rejects (path.resolve strips trailing slash before lstatSync)
        const r2 = openConfinedProtectedAssetFd(targetFilename, [`${symlinkBaseDir}${path.sep}`]);
        eq(r2.ok, false);
        eq(r2.reason, "base_dir_symlink_rejected");

        // 1c. resolveConfinedProtectedAssetPath also rejects symlink base dir
        const r3 = resolveConfinedProtectedAssetPath(targetFilename, [symlinkBaseDir]);
        eq(r3.ok, false);
        eq(r3.reason, "base_dir_symlink_rejected");

        // 1d. Multi-candidate list fails closed immediately if primary configured base dir is a symlink
        const r4 = openConfinedProtectedAssetFd(targetFilename, [symlinkBaseDir, realSafeDir]);
        eq(r4.ok, false);
        eq(r4.reason, "base_dir_symlink_rejected");

        // 1e. End-to-end HTTP GET /api/payments/download-paid-asset returns 404 PROTECTED_ASSET_UNAVAILABLE with zero leakage
        setTestProtectedAssetConfig({ candidateDirs: [symlinkBaseDir] });
        resetPaymentRateLimits();
        const resp = await fetch(`${baseUrl}/api/payments/download-paid-asset`, {
          headers: { Authorization: `Bearer ${validToken}` }
        });
        eq(resp.status, 404);
        eq(resp.headers.get("referrer-policy"), "no-referrer");
        eq(resp.headers.get("x-content-type-options"), "nosniff");
        const bodyText = await resp.text();
        eq(JSON.parse(bodyText).code, "PROTECTED_ASSET_UNAVAILABLE");
        ok(!bodyText.includes("OUTSIDE_SECRET_VIA_SYMLINK_BASEDIR"), "Must never leak outside file bytes");
        ok(!bodyText.includes(tmpRoot), "Must never leak internal filesystem path");
      } finally {
        setTestProtectedAssetConfig(null);
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      }
    });

    // 2. Non-directory configured base path (regular file, FIFO, root) is rejected
    await runTest("4.2 Non-directory configured base paths (regular file, FIFO, filesystem root) are rejected", () => {
      const tmpRoot = makeTempFixture("dm-f4-basedir-nondir-");
      try {
        const regularFileAsBase = path.join(tmpRoot, "not_a_dir_file");
        fs.writeFileSync(regularFileAsBase, "plain file");

        const rFile = openConfinedProtectedAssetFd(targetFilename, [regularFileAsBase]);
        eq(rFile.ok, false);
        eq(rFile.reason, "base_dir_not_a_directory");

        const rRoot = openConfinedProtectedAssetFd(targetFilename, [path.parse(tmpRoot).root]);
        eq(rRoot.ok, false);
        eq(rRoot.reason, "base_dir_not_a_directory");

        const fifoAsBase = path.join(tmpRoot, "fifo_as_base");
        if (createFifoSafe(fifoAsBase)) {
          const rFifo = openConfinedProtectedAssetFd(targetFilename, [fifoAsBase]);
          eq(rFifo.ok, false);
          eq(rFifo.reason, "base_dir_not_a_directory");
        }
      } finally {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      }
    });

    // 3. Normal real directory remains accepted (unit + HTTP + missing earlier candidate skip)
    await runTest("4.3 Normal real protected_downloads directory remains accepted (unit fd open, HTTP 200 stream, and missing-candidate fallback)", async () => {
      const tmpRoot = makeTempFixture("dm-f4-realdir-");
      try {
        const missingDir = path.join(tmpRoot, "does_not_exist");
        const realDir = path.join(tmpRoot, "protected_downloads");
        fs.mkdirSync(realDir);
        const expectedBytes = Buffer.from("%PDF-1.4 LEGITIMATE_PAID_WORKBOOK_BYTES_FINDING_4");
        fs.writeFileSync(path.join(realDir, targetFilename), expectedBytes);

        // Unit open with missing earlier candidate followed by real dir
        const opened = openConfinedProtectedAssetFd(targetFilename, [missingDir, realDir]);
        eq(opened.ok, true);
        eq(typeof opened.fd, "number");
        eq(opened.size, expectedBytes.length);
        const readBack = fs.readFileSync(opened.fd!);
        fs.closeSync(opened.fd!);
        ok(readBack.equals(expectedBytes), "Opened descriptor must read exact legitimate file bytes");

        // resolveConfinedProtectedAssetPath succeeds and closes fd cleanly
        const resolved = resolveConfinedProtectedAssetPath(targetFilename, [realDir]);
        eq(resolved.ok, true);
        eq(path.basename(resolved.filePath!), targetFilename);

        // HTTP end-to-end stream from real directory
        setTestProtectedAssetConfig({ candidateDirs: [missingDir, realDir] });
        resetPaymentRateLimits();
        const resp = await fetch(`${baseUrl}/api/payments/download-paid-asset`, {
          headers: { Authorization: `Bearer ${validToken}` }
        });
        eq(resp.status, 200);
        eq(resp.headers.get("referrer-policy"), "no-referrer");
        eq(resp.headers.get("x-content-type-options"), "nosniff");
        eq(resp.headers.get("content-disposition"), `attachment; filename="${targetFilename}"`);
        const streamed = Buffer.from(await resp.arrayBuffer());
        ok(streamed.equals(expectedBytes), "HTTP stream must deliver exact legitimate bytes");
      } finally {
        setTestProtectedAssetConfig(null);
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      }
    });

    // 4. Final-file symlink attacks remain rejected (outside target AND same-dir target)
    await runTest("4.4 Final-file symlink attacks (outside target and in-directory symlink) remain rejected via O_NOFOLLOW", async () => {
      const tmpRoot = makeTempFixture("dm-f4-filesym-");
      try {
        const realDir = path.join(tmpRoot, "protected_downloads");
        fs.mkdirSync(realDir);
        const outsideSecret = path.join(tmpRoot, "outside_secret.txt");
        const insideOther = path.join(realDir, "other.pdf");
        fs.writeFileSync(outsideSecret, "OUTSIDE_SECRET_DO_NOT_LEAK");
        fs.writeFileSync(insideOther, "%PDF-1.4 INSIDE_OTHER_FILE");

        // 4a. Symlink pointing outside protected_downloads
        const symOutsidePath = path.join(realDir, targetFilename);
        fs.symlinkSync(outsideSecret, symOutsidePath);

        const rOut = openConfinedProtectedAssetFd(targetFilename, [realDir]);
        eq(rOut.ok, false);
        eq(rOut.reason, "symlink_rejected");

        setTestProtectedAssetConfig({ candidateDirs: [realDir] });
        resetPaymentRateLimits();
        const respOut = await fetch(`${baseUrl}/api/payments/download-paid-asset`, {
          headers: { Authorization: `Bearer ${validToken}` }
        });
        eq(respOut.status, 404);
        const outText = await respOut.text();
        eq(JSON.parse(outText).code, "PROTECTED_ASSET_UNAVAILABLE");
        ok(!outText.includes("OUTSIDE_SECRET_DO_NOT_LEAK"));

        // 4b. Symlink pointing to another regular file inside the SAME protected_downloads directory
        fs.unlinkSync(symOutsidePath);
        fs.symlinkSync(insideOther, symOutsidePath);
        const rIn = openConfinedProtectedAssetFd(targetFilename, [realDir]);
        eq(rIn.ok, false);
        eq(rIn.reason, "symlink_rejected");
      } finally {
        setTestProtectedAssetConfig(null);
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      }
    });

    // 5. Directories, FIFOs (named pipes), and non-regular files are rejected without hanging
    await runTest("4.5 Subdirectories and real POSIX FIFOs (named pipes) are rejected immediately via O_NONBLOCK + fstatSync without hanging", async () => {
      const tmpRoot = makeTempFixture("dm-f4-nonregular-");
      try {
        const realDir = path.join(tmpRoot, "protected_downloads");
        fs.mkdirSync(realDir);
        const targetPath = path.join(realDir, targetFilename);

        // 5a. Directory with allowlisted filename
        fs.mkdirSync(targetPath);
        const rDir = openConfinedProtectedAssetFd(targetFilename, [realDir]);
        eq(rDir.ok, false);
        eq(rDir.reason, "not_a_regular_file");

        setTestProtectedAssetConfig({ candidateDirs: [realDir] });
        resetPaymentRateLimits();
        const respDir = await fetch(`${baseUrl}/api/payments/download-paid-asset`, {
          headers: { Authorization: `Bearer ${validToken}` }
        });
        eq(respDir.status, 404);
        eq((await respDir.json()).code, "PROTECTED_ASSET_UNAVAILABLE");

        // 5b. Real POSIX FIFO (named pipe) with allowlisted filename -> must NOT block and must return not_a_regular_file
        fs.rmdirSync(targetPath);
        const fifoCreated = createFifoSafe(targetPath);
        ok(fifoCreated, "Expected POSIX mkfifo to create isolated named pipe in tmpdir");

        const startMs = Date.now();
        const rFifo = openConfinedProtectedAssetFd(targetFilename, [realDir]);
        const elapsedMs = Date.now() - startMs;
        eq(rFifo.ok, false);
        eq(rFifo.reason, "not_a_regular_file");
        ok(elapsedMs < 2000, `FIFO open must not block (elapsed=${elapsedMs}ms)`);

        resetPaymentRateLimits();
        const respFifo = await fetch(`${baseUrl}/api/payments/download-paid-asset`, {
          headers: { Authorization: `Bearer ${validToken}` }
        });
        eq(respFifo.status, 404);
        eq((await respFifo.json()).code, "PROTECTED_ASSET_UNAVAILABLE");
      } finally {
        setTestProtectedAssetConfig(null);
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      }
    });

    // 6. Path traversal and non-allowlisted filenames remain rejected
    await runTest("4.6 Path traversal, nested segments, NUL/control bytes, and non-allowlisted filenames remain rejected", async () => {
      const tmpRoot = makeTempFixture("dm-f4-traversal-");
      try {
        const realDir = path.join(tmpRoot, "protected_downloads");
        fs.mkdirSync(realDir);
        fs.writeFileSync(path.join(tmpRoot, "outside.pdf"), "SECRET");
        fs.writeFileSync(path.join(realDir, targetFilename), "%PDF-1.4 OK");

        for (const badName of [
          "",
          "   ",
          ".",
          "..",
          "../outside.pdf",
          "..\\outside.pdf",
          "sub/meta-ads-campaign-planner-workbook.pdf",
          "meta-ads-campaign-planner-workbook.pdf\0.png",
          "meta-ads-campaign-planner-workbook.pdf\n",
          "/etc/passwd"
        ]) {
          const r = openConfinedProtectedAssetFd(badName, [realDir]);
          eq(r.ok, false, `Expected rejection for bad filename ${JSON.stringify(badName)}`);
        }

        // Non-allowlisted resource IDs/slugs rejected by resolveAllowlistedProtectedFilename & HTTP 404
        for (const unmapped of [
          "unknown-resource-id",
          "../etc/passwd",
          "__proto__",
          "constructor",
          "toString"
        ]) {
          eq(resolveAllowlistedProtectedFilename(unmapped), null);
        }

        const unmappedTok = generateAssetAccessToken("94000000-0000-4000-8000-000000000099")!;
        resetPaymentRateLimits();
        const resp = await fetch(`${baseUrl}/api/payments/download-paid-asset`, {
          headers: { Authorization: `Bearer ${unmappedTok}` }
        });
        eq(resp.status, 404);
        eq((await resp.json()).code, "UNMAPPED_PROTECTED_ASSET");
      } finally {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      }
    });

    // 7. Existing file replacement and inode checks continue to work
    await runTest("4.7 File replacement / inode mismatch after openSync and post-validation pre-stream swap continue to work", async () => {
      const tmpRoot = makeTempFixture("dm-f4-inode-");
      try {
        const realDir = path.join(tmpRoot, "protected_downloads");
        fs.mkdirSync(realDir);
        const targetPath = path.join(realDir, targetFilename);
        const outsideSecret = path.join(tmpRoot, "outside_secret.txt");
        fs.writeFileSync(outsideSecret, "OUTSIDE_SECRET_INODE_TEST");

        // 7a. File unlinked and replaced with a different regular file (new inode) immediately after openSync
        fs.writeFileSync(targetPath, "%PDF-1.4 ORIGINAL_INODE_A");
        setTestProtectedAssetConfig({
          candidateDirs: [realDir],
          hooks: {
            onAfterOpen: ({ candidatePath }: { candidatePath: string }) => {
              fs.unlinkSync(candidatePath);
              fs.writeFileSync(candidatePath, "%PDF-1.4 REPLACED_INODE_B");
            }
          }
        });
        const rInode = openConfinedProtectedAssetFd(targetFilename);
        eq(rInode.ok, false);
        eq(rInode.reason, "file_identity_mismatch");

        // 7b. File replaced with symlink immediately after openSync -> symlink_rejected
        fs.writeFileSync(targetPath, "%PDF-1.4 ORIGINAL_BEFORE_SYM");
        setTestProtectedAssetConfig({
          candidateDirs: [realDir],
          hooks: {
            onAfterOpen: ({ candidatePath }: { candidatePath: string }) => {
              fs.unlinkSync(candidatePath);
              fs.symlinkSync(outsideSecret, candidatePath);
            }
          }
        });
        const rSymAfter = openConfinedProtectedAssetFd(targetFilename);
        eq(rSymAfter.ok, false);
        eq(rSymAfter.reason, "symlink_rejected");

        // 7c. File replaced with symlink AFTER fd validation & BEFORE stream read -> streams ONLY original validated fd bytes
        fs.unlinkSync(targetPath);
        const originalBytes = Buffer.from("%PDF-1.4 ORIGINAL_FD_ONLY_BYTES");
        fs.writeFileSync(targetPath, originalBytes);
        setTestProtectedAssetConfig({
          candidateDirs: [realDir],
          hooks: {
            onBeforeStream: ({ filePath }: { filePath: string }) => {
              fs.unlinkSync(filePath);
              fs.symlinkSync(outsideSecret, filePath);
            }
          }
        });
        resetPaymentRateLimits();
        const resp = await fetch(`${baseUrl}/api/payments/download-paid-asset`, {
          headers: { Authorization: `Bearer ${validToken}` }
        });
        eq(resp.status, 200);
        const streamed = Buffer.from(await resp.arrayBuffer());
        ok(streamed.equals(originalBytes), "Must stream exact originally-validated fd bytes");
        ok(!streamed.toString("utf8").includes("OUTSIDE_SECRET_INODE_TEST"));
      } finally {
        setTestProtectedAssetConfig(null);
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      }
    });

    // 8. Deterministic parent-directory replacement tests (safe isolated temp fixtures)
    await runTest("4.8 Deterministic parent-directory replacement races (post-open symlink swap, pre-open persistent swap, pre-open A-B-A swap, and swap to different real dir) are detected and blocked", async () => {
      const tmpRoot = makeTempFixture("dm-f4-parent-race-");
      try {
        const outsideDir = path.join(tmpRoot, "outside_attacker_dir");
        fs.mkdirSync(outsideDir);
        fs.writeFileSync(path.join(outsideDir, targetFilename), "%PDF-1.4 ATTACKER_OUTSIDE_FILE_SECRET");

        // 8a. Post-open parent-directory swap to symlink (onAfterOpen)
        {
          const baseDir = path.join(tmpRoot, "case8a_protected_downloads");
          const backupDir = path.join(tmpRoot, "case8a_backup");
          fs.mkdirSync(baseDir);
          fs.writeFileSync(path.join(baseDir, targetFilename), "%PDF-1.4 LEGIT_8A");

          setTestProtectedAssetConfig({
            candidateDirs: [baseDir],
            hooks: {
              onAfterOpen: () => {
                fs.renameSync(baseDir, backupDir);
                fs.symlinkSync(outsideDir, baseDir, "dir");
              }
            }
          });
          const res = openConfinedProtectedAssetFd(targetFilename);
          eq(res.ok, false);
          eq(res.reason, "directory_changed");
        }

        // 8b. Pre-open persistent parent-directory swap to symlink (onBeforeOpen) -> openSync opens outside file,
        //     post-open lstatSync(resolvedBaseDir) detects symlink + inode change, closes fd, HTTP 404, zero leakage!
        {
          const baseDir = path.join(tmpRoot, "case8b_protected_downloads");
          const backupDir = path.join(tmpRoot, "case8b_backup");
          fs.mkdirSync(baseDir);
          fs.writeFileSync(path.join(baseDir, targetFilename), "%PDF-1.4 LEGIT_8B");

          let beforeHookRan = false;
          setTestProtectedAssetConfig({
            candidateDirs: [baseDir],
            hooks: {
              onBeforeOpen: () => {
                beforeHookRan = true;
                fs.renameSync(baseDir, backupDir);
                fs.symlinkSync(outsideDir, baseDir, "dir");
              }
            }
          });
          resetPaymentRateLimits();
          const resp = await fetch(`${baseUrl}/api/payments/download-paid-asset`, {
            headers: { Authorization: `Bearer ${validToken}` }
          });
          eq(beforeHookRan, true);
          eq(resp.status, 404);
          const bodyText = await resp.text();
          eq(JSON.parse(bodyText).code, "PROTECTED_ASSET_UNAVAILABLE");
          ok(!bodyText.includes("ATTACKER_OUTSIDE_FILE_SECRET"), "Pre-open parent symlink swap must never leak outside bytes");
        }

        // 8c. Pre-open A-B-A parent-directory swap (swapped to symlink right before openSync, restored right after openSync) ->
        //     fd opened attacker's file inode while restored path has legitimate file inode -> caught by file_identity_mismatch!
        {
          const baseDir = path.join(tmpRoot, "case8c_protected_downloads");
          const backupDir = path.join(tmpRoot, "case8c_backup");
          fs.mkdirSync(baseDir);
          fs.writeFileSync(path.join(baseDir, targetFilename), "%PDF-1.4 LEGIT_8C");

          let swapped = false;
          let restored = false;
          setTestProtectedAssetConfig({
            candidateDirs: [baseDir],
            hooks: {
              onBeforeOpen: () => {
                swapped = true;
                fs.renameSync(baseDir, backupDir);
                fs.symlinkSync(outsideDir, baseDir, "dir");
              },
              onAfterOpen: () => {
                restored = true;
                fs.unlinkSync(baseDir);
                fs.renameSync(backupDir, baseDir);
              }
            }
          });
          const res = openConfinedProtectedAssetFd(targetFilename);
          eq(swapped, true);
          eq(restored, true);
          eq(res.ok, false);
          eq(res.reason, "file_identity_mismatch");

          // Also verify over HTTP with zero leakage
          swapped = false;
          restored = false;
          resetPaymentRateLimits();
          const resp = await fetch(`${baseUrl}/api/payments/download-paid-asset`, {
            headers: { Authorization: `Bearer ${validToken}` }
          });
          eq(swapped, true);
          eq(restored, true);
          eq(resp.status, 404);
          const bodyText = await resp.text();
          eq(JSON.parse(bodyText).code, "PROTECTED_ASSET_UNAVAILABLE");
          ok(!bodyText.includes("ATTACKER_OUTSIDE_FILE_SECRET"), "A-B-A parent-directory swap must never leak outside bytes");
        }

        // 8d. Pre-open parent-directory swap to a DIFFERENT real directory (no symlink involved) -> caught by directory_changed!
        {
          const baseDir = path.join(tmpRoot, "case8d_protected_downloads");
          const backupDir = path.join(tmpRoot, "case8d_backup");
          const attackerRealDir = path.join(tmpRoot, "case8d_attacker_real");
          fs.mkdirSync(baseDir);
          fs.mkdirSync(attackerRealDir);
          fs.writeFileSync(path.join(baseDir, targetFilename), "%PDF-1.4 LEGIT_8D");
          fs.writeFileSync(path.join(attackerRealDir, targetFilename), "%PDF-1.4 ATTACKER_REAL_DIR_8D");

          setTestProtectedAssetConfig({
            candidateDirs: [baseDir],
            hooks: {
              onBeforeOpen: () => {
                fs.renameSync(baseDir, backupDir);
                fs.renameSync(attackerRealDir, baseDir);
              }
            }
          });
          const res = openConfinedProtectedAssetFd(targetFilename);
          eq(res.ok, false);
          eq(res.reason, "directory_changed");
        }
      } finally {
        setTestProtectedAssetConfig(null);
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      }
    });

    // 9. Non-regression: 4-file allowlist and 900-second paid asset token TTL unchanged
    await runTest("4.9 Four-file allowlist and 900-second paid asset token TTL remain unchanged", () => {
      const uniqueFiles = Array.from(new Set(Object.values(PROTECTED_LOCAL_ASSET_ALLOWLIST))).sort();
      eq(uniqueFiles.length, 4);
      eq(uniqueFiles[0], "10-high-converting-meta-ads-copy-frameworks.pdf");
      eq(uniqueFiles[1], "meta-ads-campaign-planner-workbook.pdf");
      eq(uniqueFiles[2], "pre-launch-tracking-audit-checklist.pdf");
      eq(uniqueFiles[3], "the-ad-budget-break-even-calculator.xlsx");
      eq(ASSET_TOKEN_TTL_MS, 900_000);
      eq(ASSET_TOKEN_MAX_TTL_MS, 900_000);
    });
  } finally {
    setTestProtectedAssetConfig(null);
    await stopServer(server);
  }

  console.log("========================================================================");
  console.log(`FINDING 4 SUMMARY: ${passed} passed, ${failed} failed (${assertionCount} assertions)`);
  console.log("========================================================================");
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[Finding 4 Test Runner Fatal]", err);
  process.exit(1);
});
