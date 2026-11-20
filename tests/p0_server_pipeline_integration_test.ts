/**
 * DIGITAL MUID V4.3 — P0-1 SERVER PIPELINE INTEGRATION TEST SUITE
 *
 * Tests the ACTUAL Express production middleware pipeline (`createApp({ isProduction: true })`)
 * AND spawns the compiled production CommonJS bundle (`dist/server.cjs`) end-to-end.
 *
 * Zero external network calls (Supabase, Razorpay, Resend, Hostinger are never contacted).
 * Uses raw `http.request` so un-normalized traversal, encoded paths, null bytes, backslashes,
 * and malformed percent-encodings reach Express intact without client-side URL normalization.
 */

import assert from "node:assert";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";

// Ensure clean offline test secrets BEFORE importing server.ts
process.env.ASSET_TOKEN_HMAC_SECRET = "test-p01-asset-secret-min-32-chars-xxxxxxxx";
process.env.RESOURCE_TOKEN_HMAC_SECRET = "test-p01-resource-secret-min-32-chars-xxxxxx";
process.env.INVOICE_TOKEN_HMAC_SECRET = "test-p01-invoice-secret-min-32-chars-xxxxxxx";
process.env.SUPABASE_URL = "";
process.env.SUPABASE_SERVICE_ROLE_KEY = "";
process.env.VITE_SUPABASE_URL = "";
process.env.VITE_SUPABASE_ANON_KEY = "";
process.env.RAZORPAY_KEY_ID = "";
process.env.RAZORPAY_KEY_SECRET = "";
process.env.RESEND_API_KEY = "";

import {
  createApp,
  evaluateProtectedAssetRequest,
  PROTECTED_ASSET_IDENTIFIERS,
} from "../server.ts";

let passed = 0;
let failed = 0;

async function runTest(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ PASS: ${name}`);
  } catch (err: any) {
    failed++;
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err?.stack || err?.message || err}`);
  }
}

interface RawHttpResponse {
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
  text: string;
}

function rawHttpRequest(
  port: number,
  rawPath: string,
  method = "GET"
): Promise<RawHttpResponse> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        method,
        path: rawPath,
        headers: {
          Host: `127.0.0.1:${port}`,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on("end", () => {
          const body = Buffer.concat(chunks);
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers,
            body,
            text: body.toString("utf8"),
          });
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

async function waitForServerReady(port: number, timeoutMs = 10000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await rawHttpRequest(port, "/healthz");
      if (res.statusCode === 200 || res.statusCode === 503) {
        return;
      }
    } catch {
      // retry until ready
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`Server on port ${port} did not become ready within ${timeoutMs}ms`);
}

async function main() {
  console.log("=================================================================");
  console.log("DIGITAL MUID V4.3 — P0-1 SERVER PIPELINE INTEGRATION TEST SUITE");
  console.log("=================================================================\n");

  const distDir = path.resolve(process.cwd(), "dist");
  const distIndex = path.join(distDir, "index.html");
  const distServerCjs = path.join(distDir, "server.cjs");

  assert.ok(
    fs.existsSync(distIndex),
    `Expected dist/index.html to exist (run npm run build before running this test): ${distIndex}`
  );
  assert.ok(
    fs.existsSync(distServerCjs),
    `Expected dist/server.cjs to exist (run npm run build before running this test): ${distServerCjs}`
  );

  // =========================================================================
  // PART 1: Actual Express Production Middleware Pipeline (createApp)
  // =========================================================================
  console.log("[Part 1] Express production pipeline via createApp({ isProduction: true })");
  const app = await createApp({ isProduction: true, distDir });
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const addr = server.address();
  assert.ok(addr && typeof addr === "object", "Ephemeral test server must bind a port");
  const port = addr.port;

  try {
    // 1. Legitimate SPA routes MUST remain accessible (HTTP 200 text/html)
    const legitimateSpaRoutes = [
      "/resources/bundle/meta-ads-campaign-planner-bundle",
      "/resources/thank-you/paid",
      "/resources/thank-you/paid?payment_id=pay_test_123&resourceId=meta-ads-campaign-planner-workbook",
      "/resources/meta-ads-campaign-planner-workbook",
      "/resources/the-ad-budget-break-even-calculator",
      "/resources/10-high-converting-meta-ads-copy-frameworks",
      "/resources/pre-launch-tracking-audit-checklist",
      "/resources/meta-ads-campaign-planner-bundle",
      "/resources?slug=meta-ads-campaign-planner-bundle",
      "/resources?slug=the-ad-budget-break-even-calculator&utm_source=email",
      "/resources/bundle-access?bundle=meta-ads-campaign-planner-bundle",
    ];

    for (const route of legitimateSpaRoutes) {
      await runTest(`SPA route accessible (200 HTML): ${route}`, async () => {
        const res = await rawHttpRequest(port, route);
        assert.strictEqual(res.statusCode, 200, `Expected 200 for ${route}, got ${res.statusCode}: ${res.text.slice(0, 200)}`);
        assert.ok(
          String(res.headers["content-type"] || "").includes("text/html"),
          `Expected text/html for ${route}, got ${res.headers["content-type"]}`
        );
        assert.ok(res.text.includes("<!doctype html>") || res.text.includes("<html"), `Expected HTML document for ${route}`);
      });
    }

    // 2. All 4 existing free downloads MUST continue working (HTTP 200 with exact file bytes)
    const freeDownloads = [
      { path: "/downloads/ai-growth-prompts.pdf", diskPath: path.resolve(process.cwd(), "public/downloads/ai-growth-prompts.pdf") },
      { path: "/downloads/digital-growth-checklist.pdf", diskPath: path.resolve(process.cwd(), "public/downloads/digital-growth-checklist.pdf") },
      { path: "/downloads/marketing-funnel-blueprint.pdf", diskPath: path.resolve(process.cwd(), "public/downloads/marketing-funnel-blueprint.pdf") },
      { path: "/downloads/thought-leadership-os.xlsx", diskPath: path.resolve(process.cwd(), "public/downloads/thought-leadership-os.xlsx") },
    ];

    for (const item of freeDownloads) {
      await runTest(`Free download works (200 exact bytes): ${item.path}`, async () => {
        const expectedBytes = fs.readFileSync(item.diskPath);
        const res = await rawHttpRequest(port, item.path);
        assert.strictEqual(res.statusCode, 200, `Expected 200 for ${item.path}, got ${res.statusCode}`);
        assert.strictEqual(
          Buffer.compare(res.body, expectedBytes),
          0,
          `Expected byte-for-byte match with ${item.diskPath} (${expectedBytes.length} bytes, got ${res.body.length})`
        );
      });
    }

    // 3. Protected downloadable files & static paths MUST be blocked (HTTP 403)
    const blockedStaticPaths = [
      "/downloads/meta-ads-campaign-planner-workbook.pdf",
      "/downloads/the-ad-budget-break-even-calculator.xlsx",
      "/downloads/the-ad-budget-break-even-calculator.pdf",
      "/downloads/10-high-converting-meta-ads-copy-frameworks.pdf",
      "/downloads/pre-launch-tracking-audit-checklist.pdf",
      "/downloads/meta-ads-campaign-planner-workbook",
      "/downloads/meta-ads-campaign-planner-bundle.zip",
      "/protected_downloads/meta-ads-campaign-planner-workbook.pdf",
      "/server/protected_downloads/the-ad-budget-break-even-calculator.xlsx",
      "/protected_downloads/unrelated-file.txt",
      "/resources/meta-ads-campaign-planner-workbook.pdf",
      "/resources/bundle/meta-ads-campaign-planner-bundle.zip",
      "/resources/the-ad-budget-break-even-calculator.xlsx",
      "/meta-ads-campaign-planner-workbook.pdf",
      "/assets/the-ad-budget-break-even-calculator.xlsx",
      "/DOWNLOADS/META-ADS-CAMPAIGN-PLANNER-WORKBOOK.PDF",
      "/downloads/meta-ads-campaign-planner-workbook.pdf?download=1",
    ];

    for (const blocked of blockedStaticPaths) {
      await runTest(`Protected static path blocked (403): ${blocked}`, async () => {
        const res = await rawHttpRequest(port, blocked);
        assert.strictEqual(res.statusCode, 403, `Expected 403 for ${blocked}, got ${res.statusCode}`);
        assert.ok(
          String(res.headers["cache-control"] || "").includes("no-store"),
          `Expected no-store Cache-Control header for ${blocked}`
        );
      });
    }

    await runTest("HEAD request to protected static path blocked (403)", async () => {
      const res = await rawHttpRequest(port, "/downloads/meta-ads-campaign-planner-workbook.pdf", "HEAD");
      assert.strictEqual(res.statusCode, 403, `Expected 403 for HEAD protected asset, got ${res.statusCode}`);
    });

    // Test B: Trailing-slash protected download (GET & HEAD), redirect & cache headers, no loops, SEO redirect preserved
    for (const trailingProtectedPath of [
      "/downloads/meta-ads-campaign-planner-workbook.pdf/",
      "/protected_downloads/meta-ads-campaign-planner-workbook.pdf/",
    ]) {
      for (const method of ["GET", "HEAD"] as const) {
        await runTest(`Test B: Trailing-slash protected download (${method}) blocked without asset leak or loop: ${trailingProtectedPath}`, async () => {
          const firstRes = await rawHttpRequest(port, trailingProtectedPath, method);

          // Must never serve 200 or PDF bytes on initial request
          assert.notStrictEqual(firstRes.statusCode, 200, `Trailing-slash protected path must never return 200`);
          assert.notStrictEqual(firstRes.body.subarray(0, 4).toString("ascii"), "%PDF", `Must never leak PDF bytes`);

          let terminalRes = firstRes;
          if (firstRes.statusCode === 301 || firstRes.statusCode === 302 || firstRes.statusCode === 308) {
            const location = String(firstRes.headers.location || "");
            assert.ok(location.length > 0, `Redirect for ${trailingProtectedPath} must include Location header`);
            assert.notStrictEqual(location, trailingProtectedPath, "Redirect Location must not self-loop");
            assert.strictEqual(location.endsWith("/"), false, `Redirect target '${location}' must strip trailing slash (no loop)`);

            // Follow exactly 1 hop: terminal response MUST be 403 with no-store headers and not another redirect
            terminalRes = await rawHttpRequest(port, location, method);
            assert.notStrictEqual(terminalRes.statusCode, 301, "Must not chain/loop redirects");
            assert.notStrictEqual(terminalRes.statusCode, 302, "Must not chain/loop redirects");
          }

          assert.strictEqual(
            terminalRes.statusCode,
            403,
            `Expected terminal 403 for ${method} ${trailingProtectedPath}, got ${terminalRes.statusCode}`
          );
          assert.ok(
            String(terminalRes.headers["cache-control"] || "").includes("no-store"),
            `Expected no-store Cache-Control header on terminal 403 for ${method} ${trailingProtectedPath}`
          );
          assert.strictEqual(
            String(terminalRes.headers["pragma"] || "").toLowerCase(),
            "no-cache",
            `Expected Pragma: no-cache header on terminal 403 for ${method} ${trailingProtectedPath}`
          );
          assert.notStrictEqual(terminalRes.body.subarray(0, 4).toString("ascii"), "%PDF", `Terminal response must never contain PDF bytes`);
        });
      }
    }

    await runTest("Test B: Legitimate SEO redirects preserved without loops (/meta-ads-campaign-planner-bundle -> /meta_ad_campaign_bundle, trailing-slash SPA route)", async () => {
      const seoAliasRes = await rawHttpRequest(port, "/meta-ads-campaign-planner-bundle", "GET");
      assert.strictEqual(seoAliasRes.statusCode, 301, `Expected 301 for legacy SEO alias, got ${seoAliasRes.statusCode}`);
      assert.strictEqual(seoAliasRes.headers.location, "/meta_ad_campaign_bundle");
      const aliasTargetRes = await rawHttpRequest(port, String(seoAliasRes.headers.location), "GET");
      assert.strictEqual(aliasTargetRes.statusCode, 200);
      assert.ok(String(aliasTargetRes.headers["content-type"] || "").includes("text/html"));

      const spaTrailingRes = await rawHttpRequest(port, "/resources/bundle/meta-ads-campaign-planner-bundle/", "GET");
      assert.strictEqual(spaTrailingRes.statusCode, 301);
      assert.strictEqual(spaTrailingRes.headers.location, "/resources/bundle/meta-ads-campaign-planner-bundle");
      const spaTargetRes = await rawHttpRequest(port, String(spaTrailingRes.headers.location), "GET");
      assert.strictEqual(spaTargetRes.statusCode, 200);
      assert.ok(String(spaTargetRes.headers["content-type"] || "").includes("text/html"));
    });

    // 4. URL encoding, repeated encoding, traversal, null bytes, backslashes, malformed paths
    const encodedProtectedPaths = [
      "/downloads/%6deta-ads-campaign-planner-workbook.pdf",
      "/downloads/%256deta-ads-campaign-planner-workbook.pdf",
      "/%70rotected_downloads/meta-ads-campaign-planner-workbook.pdf",
      "/%2570rotected_downloads/meta-ads-campaign-planner-workbook.pdf",
      "/resources/meta-ads-campaign-planner-workbook%2epdf",
      "/resources/bundle/meta-ads-campaign-planner-bundle%2ezip",
      "/resources%2fmeta-ads-campaign-planner-workbook",
      "/resources%252fmeta-ads-campaign-planner-workbook",
    ];

    for (const encodedPath of encodedProtectedPaths) {
      await runTest(`Encoded protected path blocked (403): ${encodedPath}`, async () => {
        const res = await rawHttpRequest(port, encodedPath);
        assert.strictEqual(res.statusCode, 403, `Expected 403 for ${encodedPath}, got ${res.statusCode}: ${res.text}`);
      });
    }

    const malformedAndAttackPaths = [
      // Unresolved repeated encoding (4+ rounds)
      "/downloads/%2525256deta-ads-campaign-planner-workbook.pdf",
      "/resources/%2525252e%2525252e/protected_downloads/meta-ads-campaign-planner-workbook.pdf",
      // Malformed percent-encoding
      "/downloads/%ZZ",
      "/resources/%E0%A4%A",
      "/downloads/100%",
      "/downloads/%25ZZ",
      // Path traversal (raw, single-encoded, double-encoded)
      "/resources/../downloads/meta-ads-campaign-planner-workbook.pdf",
      "/downloads/%2e%2e/protected_downloads/meta-ads-campaign-planner-workbook.pdf",
      "/downloads/%252e%252e%252fprotected_downloads%252fmeta-ads-campaign-planner-workbook.pdf",
      "/resources/bundle/../../protected_downloads/meta-ads-campaign-planner-workbook.pdf",
      // Null bytes (single & double encoded)
      "/resources/bundle/meta-ads-campaign-planner-bundle%00.pdf",
      "/downloads/ai-growth-prompts.pdf%00",
      "/resources/bundle/meta-ads-campaign-planner-bundle%2500.pdf",
      // Backslashes (single & double encoded)
      "/downloads%5cmeta-ads-campaign-planner-workbook.pdf",
      "/downloads%255cmeta-ads-campaign-planner-workbook.pdf",
      "/protected_downloads%5cthe-ad-budget-break-even-calculator.xlsx",
    ];

    for (const attackPath of malformedAndAttackPaths) {
      await runTest(`Malformed/traversal/null/backslash path rejected fail-closed (400): ${attackPath}`, async () => {
        const res = await rawHttpRequest(port, attackPath);
        assert.strictEqual(res.statusCode, 400, `Expected 400 for ${attackPath}, got ${res.statusCode}: ${res.text}`);
        assert.ok(
          String(res.headers["cache-control"] || "").includes("no-store"),
          `Expected no-store Cache-Control for ${attackPath}`
        );
      });
    }

    await runTest("Direct evaluator rejects literal raw null byte and literal backslash", () => {
      const nullDecision = evaluateProtectedAssetRequest("/resources/bundle/meta-ads-campaign-planner-bundle\0.pdf");
      assert.strictEqual(nullDecision.allowed, false);
      assert.strictEqual(nullDecision.statusCode, 400);

      const backslashDecision = evaluateProtectedAssetRequest("/downloads\\meta-ads-campaign-planner-workbook.pdf");
      assert.strictEqual(backslashDecision.allowed, false);
      assert.strictEqual(backslashDecision.statusCode, 400);

      assert.strictEqual(PROTECTED_ASSET_IDENTIFIERS.length, 6);
    });

    // 5. API routes & authentication behavior preserved
    await runTest("Health endpoint /api/health returns 200 JSON", async () => {
      const res = await rawHttpRequest(port, "/api/health");
      assert.strictEqual(res.statusCode, 200);
      const parsed = JSON.parse(res.text);
      assert.strictEqual(parsed.status, "ok");
    });

    await runTest("Unauthenticated /api/payments/invoice/:id still returns 401 JSON", async () => {
      const res = await rawHttpRequest(port, "/api/payments/invoice/pay_unauth_pipeline_test");
      assert.strictEqual(res.statusCode, 401);
      const parsed = JSON.parse(res.text);
      assert.strictEqual(parsed.success, false);
    });

    await runTest("Protected resource API route /api/payments/download-paid-asset preserves API auth behavior", async () => {
      const res = await rawHttpRequest(
        port,
        "/api/payments/download-paid-asset?file=meta-ads-campaign-planner-workbook.pdf"
      );
      assert.ok(
        res.statusCode === 400 || res.statusCode === 401 || res.statusCode === 403,
        `Expected API auth rejection (400/401/403), got ${res.statusCode}`
      );
      const parsed = JSON.parse(res.text);
      assert.strictEqual(parsed.code === "PROTECTED_ASSET_FORBIDDEN", false, "API route must not be intercepted by static asset guard");
    });

    await runTest("Unknown /api/* endpoint still returns 404 JSON", async () => {
      const res = await rawHttpRequest(port, "/api/does-not-exist");
      assert.strictEqual(res.statusCode, 404);
      const parsed = JSON.parse(res.text);
      assert.strictEqual(parsed.error, "API endpoint not found");
    });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  // =========================================================================
  // PART 2: Real Compiled Production Bundle (`node dist/server.cjs`)
  // =========================================================================
  console.log("\n[Part 2] Production CJS bundle startup & routing (`node dist/server.cjs`)");

  // Pick a free ephemeral port
  const probeServer = http.createServer();
  await new Promise<void>((resolve) => probeServer.listen(0, "127.0.0.1", () => resolve()));
  const cjsPort = (probeServer.address() as any).port;
  await new Promise<void>((resolve) => probeServer.close(() => resolve()));

  const child = spawn(process.execPath, [distServerCjs], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "production",
      TEST_PORT: String(cjsPort),
      PORT: String(cjsPort),
      ASSET_TOKEN_HMAC_SECRET: "test-cjs-asset-secret-min-32-chars-xxxxxxxx",
      RESOURCE_TOKEN_HMAC_SECRET: "test-cjs-resource-secret-min-32-chars-xxxxxx",
      INVOICE_TOKEN_HMAC_SECRET: "test-cjs-invoice-secret-min-32-chars-xxxxxxx",
      SUPABASE_URL: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      VITE_SUPABASE_URL: "",
      VITE_SUPABASE_ANON_KEY: "",
      RAZORPAY_KEY_ID: "",
      RAZORPAY_KEY_SECRET: "",
      RESEND_API_KEY: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let childStderr = "";
  child.stderr?.on("data", (d) => {
    childStderr += d.toString("utf8");
  });

  try {
    await waitForServerReady(cjsPort, 10000);

    await runTest("dist/server.cjs starts in production mode and serves /healthz (200)", async () => {
      const res = await rawHttpRequest(cjsPort, "/healthz");
      assert.strictEqual(res.statusCode, 200, `Expected 200 /healthz, got ${res.statusCode}. stderr=${childStderr}`);
      const parsed = JSON.parse(res.text);
      assert.strictEqual(parsed.status, "ok");
    });

    await runTest("dist/server.cjs serves bundle SPA route (200 HTML)", async () => {
      const res = await rawHttpRequest(cjsPort, "/resources/bundle/meta-ads-campaign-planner-bundle");
      assert.strictEqual(res.statusCode, 200);
      assert.ok(String(res.headers["content-type"] || "").includes("text/html"));
    });

    await runTest("dist/server.cjs serves SPA query route /resources?slug=<protected> (200 HTML)", async () => {
      const res = await rawHttpRequest(cjsPort, "/resources?slug=meta-ads-campaign-planner-bundle");
      assert.strictEqual(res.statusCode, 200);
      assert.ok(String(res.headers["content-type"] || "").includes("text/html"));
    });

    await runTest("dist/server.cjs serves all 4 free downloads (200)", async () => {
      for (const p of [
        "/downloads/ai-growth-prompts.pdf",
        "/downloads/digital-growth-checklist.pdf",
        "/downloads/marketing-funnel-blueprint.pdf",
        "/downloads/thought-leadership-os.xlsx",
      ]) {
        const res = await rawHttpRequest(cjsPort, p);
        assert.strictEqual(res.statusCode, 200, `Expected 200 for ${p} in dist/server.cjs, got ${res.statusCode}`);
      }
    });

    await runTest("dist/server.cjs blocks direct protected asset download (403)", async () => {
      const res = await rawHttpRequest(cjsPort, "/downloads/meta-ads-campaign-planner-workbook.pdf");
      assert.strictEqual(res.statusCode, 403);
    });

    await runTest("dist/server.cjs rejects double-encoded traversal (400)", async () => {
      const res = await rawHttpRequest(
        cjsPort,
        "/downloads/%252e%252e%252fprotected_downloads%252fmeta-ads-campaign-planner-workbook.pdf"
      );
      assert.strictEqual(res.statusCode, 400);
    });
  } finally {
    child.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {}
        resolve();
      }, 2000);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  console.log(`\nSummary: ${passed} passed, ${failed} failed (total ${passed + failed})`);
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal P0-1 test error:", err);
  process.exit(1);
});
