/**
 * DIGITALMUID V4.3 — STEP 3B: SECURE PAID CMS FILE UPLOADS REGRESSION TEST SUITE
 *
 * Strictly offline & local (zero external network, zero Supabase/PostgreSQL/Razorpay/Resend calls).
 * Verifies:
 *  1. Paid CMS uploads route exclusively through POST /api/resources/admin/upload-paid-asset
 *     and return only canonical `supabase://paid-resources/<path>` references.
 *  2. Paid uploads never call `.from('resources')` and never call `getPublicUrl()`.
 *  3. Failed paid uploads never fall back to `/downloads/<filename>` and surface error state.
 *  4. Unauthenticated, invalid-JWT, non-admin, unconfirmed-email admin, and `confirmed_at`-only
 *     admin callers are rejected before any storage write.
 *  5. Arbitrary bucket/path headers/queries, invalid file types, MIME mismatches, spoofed magic
 *     bytes, traversal/encoded-traversal/NUL filenames, empty files, and oversized files are rejected.
 *  6. Private bucket upload failures and missing service-role client fail closed (HTTP 503)
 *     without leaking secrets or falling back to public storage.
 *  7. Free-resource uploads retain their existing `resources` bucket workflow intact.
 *  8. Newly saved or modified paid resources reject public `resources` bucket and `/downloads/`
 *     URLs without silently converting them, while metadata-only edits on unchanged legacy paid
 *     records remain preserved cleanly.
 *
 * Run: npx tsx tests/step3b_secure_paid_cms_upload_test.ts
 */

import assert from "node:assert";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import express from "express";

// Configure isolated offline environment BEFORE importing server/frontend modules
process.env.NODE_ENV = "test";
process.env.APP_ENV = "test";
process.env.FORCE_DEV_SAFETY = "true";
process.env.SUPABASE_URL = "https://step3b-isolated-offline-test.supabase.co";
delete process.env.VITE_SUPABASE_URL;
delete process.env.VITE_SUPABASE_ANON_KEY;
process.env.ALLOW_STAGING_TEST_WRITES = "true";
process.env.TRUST_PROXY_HOPS = "0";

const { setMockSupabaseServerClient } = await import("../server/supabaseServer.js");
const {
  createResourceRoutes,
  PAID_RESOURCES_BUCKET,
  PAID_UPLOAD_MAX_BYTES,
  validatePaidUploadFilename,
  validatePaidUploadContentType,
  validatePaidUploadSignature
} = await import("../server/resourceRoutes.js");

const {
  resourceService,
  isPublicResourcesStorageUrl,
  isCanonicalPrivatePaidReference,
  validatePaidResourcePersistence,
  resolvePaidUploadContentType
} = await import("../src/services/resourceService.ts");

const {
  executeResourceModalFileUpload,
  prepareResourceModalSavePayload
} = await import("../src/components/ResourceEditorModal.tsx");

const { AUTHORITATIVE_PAID_RESOURCES } = await import(
  "../src/constants/authoritativePaidResources.ts"
);

// Valid minimal binary payloads matching strict magic-byte signatures
const VALID_PDF_BYTES = Buffer.from("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n", "ascii");
const VALID_ZIP_BYTES = Buffer.from([
  0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00,
  0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
]);
const VALID_XLSX_BYTES = Buffer.from([
  0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00,
  0x08, 0x00, 0x00, 0x00, 0x21, 0x00, 0xaa, 0xbb
]);

const TOKENS = {
  CONFIRMED_ADMIN_EMAIL: "jwt_confirmed_admin_allowlist_ok",
  CONFIRMED_ADMIN_ROLE: "jwt_confirmed_admin_role_ok",
  UNCONFIRMED_ADMIN: "jwt_unconfirmed_admin_blocked",
  CONFIRMED_AT_ONLY_ADMIN: "jwt_confirmed_at_only_admin_blocked",
  CONFIRMED_NON_ADMIN: "jwt_confirmed_regular_user_blocked",
  INVALID_JWT: "jwt_expired_or_tampered"
};

const USERS_BY_TOKEN: Record<string, any> = {
  [TOKENS.CONFIRMED_ADMIN_EMAIL]: {
    id: "11111111-1111-4111-8111-111111111111",
    email: "admin@digitalmuid.com",
    email_confirmed_at: "2026-01-15T10:00:00.000Z",
    app_metadata: {}
  },
  [TOKENS.CONFIRMED_ADMIN_ROLE]: {
    id: "22222222-2222-4222-8222-222222222222",
    email: "ops-lead@digitalmuid.com",
    email_confirmed_at: "2026-01-15T10:00:00.000Z",
    app_metadata: { role: "admin" }
  },
  [TOKENS.UNCONFIRMED_ADMIN]: {
    id: "33333333-3333-4333-8333-333333333333",
    email: "admin@digitalmuid.com",
    email_confirmed_at: null,
    app_metadata: { role: "admin" }
  },
  [TOKENS.CONFIRMED_AT_ONLY_ADMIN]: {
    id: "44444444-4444-4444-8444-444444444444",
    email: "admin@digitalmuid.com",
    email_confirmed_at: null,
    confirmed_at: "2026-01-15T10:00:00.000Z",
    app_metadata: { role: "admin" }
  },
  [TOKENS.CONFIRMED_NON_ADMIN]: {
    id: "55555555-5555-4555-8555-555555555555",
    email: "student@example.com",
    email_confirmed_at: "2026-01-15T10:00:00.000Z",
    app_metadata: { role: "user" }
  }
};

interface MockStorageCallLog {
  bucketsRequested: string[];
  uploads: Array<{ bucket: string; path: string; bytes: number; options: any }>;
  getPublicUrlCalls: Array<{ bucket: string; path: string }>;
}

function createMockServerSupabase(config?: {
  uploadResult?: (bucket: string, objectPath: string, body: Buffer, options: any) => Promise<any>;
}) {
  const log: MockStorageCallLog = {
    bucketsRequested: [],
    uploads: [],
    getPublicUrlCalls: []
  };

  const client = {
    auth: {
      async getUser(token: string) {
        const user = USERS_BY_TOKEN[token];
        if (!user) {
          return { data: { user: null }, error: new Error("Invalid JWT") };
        }
        return { data: { user }, error: null };
      }
    },
    storage: {
      from(bucket: string) {
        log.bucketsRequested.push(bucket);
        return {
          async upload(objectPath: string, body: Buffer, options: any) {
            log.uploads.push({
              bucket,
              path: objectPath,
              bytes: Buffer.isBuffer(body) ? body.length : 0,
              options
            });
            if (config?.uploadResult) {
              return config.uploadResult(bucket, objectPath, body, options);
            }
            return {
              data: { path: objectPath },
              error: null
            };
          },
          getPublicUrl(objectPath: string) {
            log.getPublicUrlCalls.push({ bucket, path: objectPath });
            return {
              data: {
                publicUrl: `https://step3b-isolated-offline-test.supabase.co/storage/v1/object/public/${bucket}/${objectPath}`
              }
            };
          }
        };
      }
    }
  };

  return { client, log };
}

function startTestServer(options?: { maxPaidUploadBytes?: number }) {
  const app = express();
  // Mirror server.ts middleware ordering: express.json() & express.urlencoded() BEFORE /api/resources
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use("/api/resources", createResourceRoutes({ isProduction: false, ...options }));

  return new Promise<{ server: http.Server; baseUrl: string }>((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const addr = server.address() as { port: number };
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

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
  try {
    await fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (err: any) {
    failed += 1;
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err?.stack || err}`);
  }
}

console.log("\n=== DIGITALMUID V4.3 — STEP 3B SECURE PAID CMS FILE UPLOADS SUITE ===\n");

// ---------------------------------------------------------------------------
// TEST 1: Confirmed-admin private upload succeeds for PDF, XLSX, ZIP
// ---------------------------------------------------------------------------
await runTest("1. Confirmed admin uploads PDF, XLSX, and ZIP strictly to private paid-resources bucket without getPublicUrl", async () => {
  const { client, log } = createMockServerSupabase();
  setMockSupabaseServerClient(client);
  const { server, baseUrl } = await startTestServer();

  try {
    eq(PAID_RESOURCES_BUCKET, "paid-resources");
    eq(PAID_UPLOAD_MAX_BYTES, 50 * 1024 * 1024);

    // 1a. PDF via confirmed allowlisted admin email
    const pdfResp = await fetch(`${baseUrl}/api/resources/admin/upload-paid-asset`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKENS.CONFIRMED_ADMIN_EMAIL}`,
        "Content-Type": "application/pdf",
        "X-Upload-Filename": encodeURIComponent("Meta Ads Playbook Q2.pdf")
      },
      body: VALID_PDF_BYTES
    });
    eq(pdfResp.status, 201);
    eq(pdfResp.headers.get("cache-control"), "no-store");
    const pdfJson: any = await pdfResp.json();
    eq(pdfJson.success, true);
    eq(pdfJson.bucket, "paid-resources");
    eq(pdfJson.contentType, "application/pdf");
    eq(pdfJson.sizeBytes, VALID_PDF_BYTES.length);
    ok(pdfJson.reference.startsWith("supabase://paid-resources/paid/"), "PDF reference must use canonical supabase://paid-resources/paid/ prefix");
    ok(pdfJson.reference.endsWith("_meta_ads_playbook_q2.pdf"), `Unexpected sanitized filename in ${pdfJson.reference}`);
    ok(!pdfJson.publicUrl && !pdfJson.url, "Response must not return a public URL");

    // 1b. XLSX via confirmed app_metadata.role === 'admin'
    const xlsxResp = await fetch(`${baseUrl}/api/resources/admin/upload-paid-asset`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKENS.CONFIRMED_ADMIN_ROLE}`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "X-Upload-Filename": encodeURIComponent("Campaign Budget Calculator.xlsx")
      },
      body: VALID_XLSX_BYTES
    });
    eq(xlsxResp.status, 201);
    const xlsxJson: any = await xlsxResp.json();
    eq(xlsxJson.success, true);
    eq(xlsxJson.contentType, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    ok(isCanonicalPrivatePaidReference(xlsxJson.reference));

    // 1c. ZIP with Windows browser MIME (application/x-zip-compressed -> canonical application/zip)
    const zipResp = await fetch(`${baseUrl}/api/resources/admin/upload-paid-asset`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKENS.CONFIRMED_ADMIN_EMAIL}`,
        "Content-Type": "application/x-zip-compressed",
        "X-Upload-Filename": encodeURIComponent("Bonus Templates Pack.zip")
      },
      body: VALID_ZIP_BYTES
    });
    eq(zipResp.status, 201);
    const zipJson: any = await zipResp.json();
    eq(zipJson.success, true);
    eq(zipJson.contentType, "application/zip");
    ok(isCanonicalPrivatePaidReference(zipJson.reference));

    // Verify storage isolation invariants
    eq(log.uploads.length, 3);
    ok(log.bucketsRequested.every((b) => b === "paid-resources"), "Only paid-resources bucket may ever be accessed");
    eq(log.bucketsRequested.includes("resources"), false, "Public resources bucket must NEVER be called");
    eq(log.getPublicUrlCalls.length, 0, "getPublicUrl() must NEVER be called for paid assets");
    ok(log.uploads.every((u) => u.options?.upsert === false && u.options?.cacheControl === "0"));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    setMockSupabaseServerClient(null);
  }
});

// ---------------------------------------------------------------------------
// TEST 2: Unauthenticated, invalid-JWT, non-admin, and unconfirmed admins rejected
// ---------------------------------------------------------------------------
await runTest("2. Unauthenticated, non-admin, unconfirmed-email admin, and confirmed_at-only admin callers are rejected before upload", async () => {
  const { client, log } = createMockServerSupabase();
  setMockSupabaseServerClient(client);
  const { server, baseUrl } = await startTestServer();

  try {
    const cases = [
      { label: "Missing Authorization header", auth: undefined, expectedStatus: 401, expectedCode: "AUTH_REQUIRED" },
      { label: "Malformed Basic auth header", auth: "Basic abc123", expectedStatus: 401, expectedCode: "AUTH_REQUIRED" },
      { label: "Empty Bearer token", auth: "Bearer   ", expectedStatus: 401, expectedCode: "AUTH_REQUIRED" },
      { label: "Invalid/expired JWT", auth: `Bearer ${TOKENS.INVALID_JWT}`, expectedStatus: 401, expectedCode: "INVALID_SESSION" },
      { label: "Confirmed non-admin user", auth: `Bearer ${TOKENS.CONFIRMED_NON_ADMIN}`, expectedStatus: 403, expectedCode: "ADMIN_REQUIRED" },
      { label: "Unconfirmed admin (email_confirmed_at: null)", auth: `Bearer ${TOKENS.UNCONFIRMED_ADMIN}`, expectedStatus: 403, expectedCode: "ADMIN_REQUIRED" },
      { label: "confirmed_at-only admin (email_confirmed_at: null)", auth: `Bearer ${TOKENS.CONFIRMED_AT_ONLY_ADMIN}`, expectedStatus: 403, expectedCode: "ADMIN_REQUIRED" }
    ];

    for (const tc of cases) {
      const headers: Record<string, string> = {
        "Content-Type": "application/pdf",
        "X-Upload-Filename": "secret-paid.pdf"
      };
      if (tc.auth !== undefined) headers.Authorization = tc.auth;

      const resp = await fetch(`${baseUrl}/api/resources/admin/upload-paid-asset`, {
        method: "POST",
        headers,
        body: VALID_PDF_BYTES
      });
      const json: any = await resp.json();
      eq(resp.status, tc.expectedStatus, `${tc.label}: expected HTTP ${tc.expectedStatus}`);
      eq(json.success, false, `${tc.label}: expected success=false`);
      eq(json.code, tc.expectedCode, `${tc.label}: expected code ${tc.expectedCode}`);
    }

    eq(log.uploads.length, 0, "Zero storage uploads may occur for rejected auth/admin requests");
    eq(log.bucketsRequested.length, 0, "Zero storage bucket accesses may occur for rejected auth/admin requests");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    setMockSupabaseServerClient(null);
  }
});

// ---------------------------------------------------------------------------
// TEST 3: Arbitrary bucket/path selection, traversal filenames, bad MIME/magic, oversized, empty
// ---------------------------------------------------------------------------
await runTest("3. Rejects arbitrary bucket/path selection, traversal filenames, invalid types, spoofed signatures, empty files, and oversized files", async () => {
  const { client, log } = createMockServerSupabase();
  setMockSupabaseServerClient(client);
  // Use a small custom limit (256 bytes) to test real oversized rejection fast offline
  const { server, baseUrl } = await startTestServer({ maxPaidUploadBytes: 256 });

  try {
    const adminAuth = { Authorization: `Bearer ${TOKENS.CONFIRMED_ADMIN_EMAIL}` };

    // 3a. Arbitrary bucket override via query or headers
    const bucketAttempts = [
      { url: `${baseUrl}/api/resources/admin/upload-paid-asset?bucket=resources`, extraHeaders: {} },
      { url: `${baseUrl}/api/resources/admin/upload-paid-asset?storageBucket=resources`, extraHeaders: {} },
      { url: `${baseUrl}/api/resources/admin/upload-paid-asset`, extraHeaders: { "X-Storage-Bucket": "resources" } },
      { url: `${baseUrl}/api/resources/admin/upload-paid-asset`, extraHeaders: { "X-Upload-Bucket": "paid-resources" } },
      { url: `${baseUrl}/api/resources/admin/upload-paid-asset`, extraHeaders: { "X-Bucket": "public" } }
    ];
    for (const attempt of bucketAttempts) {
      const resp = await fetch(attempt.url, {
        method: "POST",
        headers: {
          ...adminAuth,
          "Content-Type": "application/pdf",
          "X-Upload-Filename": "valid.pdf",
          ...attempt.extraHeaders
        },
        body: VALID_PDF_BYTES
      });
      const json: any = await resp.json();
      eq(resp.status, 400);
      eq(json.code, "ARBITRARY_BUCKET_FORBIDDEN");
    }

    // 3b. Arbitrary path/folder override via query or headers
    const pathAttempts = [
      { url: `${baseUrl}/api/resources/admin/upload-paid-asset?path=downloads/a.pdf`, extraHeaders: {} },
      { url: `${baseUrl}/api/resources/admin/upload-paid-asset?folder=downloads`, extraHeaders: {} },
      { url: `${baseUrl}/api/resources/admin/upload-paid-asset`, extraHeaders: { "X-Storage-Path": "paid/overwrite.pdf" } },
      { url: `${baseUrl}/api/resources/admin/upload-paid-asset`, extraHeaders: { "X-Upload-Folder": "downloads" } }
    ];
    for (const attempt of pathAttempts) {
      const resp = await fetch(attempt.url, {
        method: "POST",
        headers: {
          ...adminAuth,
          "Content-Type": "application/pdf",
          "X-Upload-Filename": "valid.pdf",
          ...attempt.extraHeaders
        },
        body: VALID_PDF_BYTES
      });
      const json: any = await resp.json();
      eq(resp.status, 400);
      eq(json.code, "ARBITRARY_PATH_FORBIDDEN");
    }

    // 3c. Traversal, separator, encoded traversal, leading-dot, malformed encoding, and overlong filenames
    const badFilenames = [
      "../escape.pdf",
      "..\\escape.pdf",
      "sub/dir/file.pdf",
      "sub\\file.pdf",
      "%2e%2e%2fescape.pdf",
      "%2e%2e/escape.pdf",
      "file%2fname.pdf",
      "file%5cname.pdf",
      "evil%00.pdf",
      ".hidden.pdf",
      "...",
      ".pdf",
      "%ZZ_bad_encoding.pdf",
      `${"a".repeat(185)}.pdf`
    ];
    for (const badName of badFilenames) {
      const unitCheck = validatePaidUploadFilename(badName);
      eq(unitCheck.valid, false, `Unit validator must reject filename: ${badName}`);

      const resp = await fetch(`${baseUrl}/api/resources/admin/upload-paid-asset`, {
        method: "POST",
        headers: {
          ...adminAuth,
          "Content-Type": "application/pdf",
          "X-Upload-Filename": badName
        },
        body: VALID_PDF_BYTES
      });
      const json: any = await resp.json();
      eq(resp.status, 400, `HTTP endpoint must reject bad filename ${badName}`);
      eq(json.success, false);
    }

    // 3d. Disallowed extensions & MIME mismatches
    const badTypeCases = [
      { name: "xss.html", mime: "text/html", body: Buffer.from("<html></html>") },
      { name: "script.js", mime: "application/javascript", body: Buffer.from("alert(1)") },
      { name: "vector.svg", mime: "image/svg+xml", body: Buffer.from("<svg/>") },
      { name: "table.csv", mime: "text/csv", body: Buffer.from("a,b\n1,2\n") },
      { name: "guide.pdf", mime: "application/zip", body: VALID_PDF_BYTES },
      { name: "guide.pdf", mime: "application/octet-stream", body: VALID_PDF_BYTES },
      { name: "guide.pdf", mime: "application/json", body: Buffer.from('{"a":1}') }
    ];
    for (const tc of badTypeCases) {
      const resp = await fetch(`${baseUrl}/api/resources/admin/upload-paid-asset`, {
        method: "POST",
        headers: {
          ...adminAuth,
          "Content-Type": tc.mime,
          "X-Upload-Filename": tc.name
        },
        body: tc.body
      });
      const json: any = await resp.json();
      eq(resp.status, 400, `Expected 400 for ${tc.name} (${tc.mime})`);
      eq(json.code, "INVALID_FILE_TYPE");
    }

    // 3e. Spoofed magic bytes (HTML renamed to .pdf, text renamed to .xlsx/.zip)
    const spoofedCases = [
      { name: "spoof.pdf", mime: "application/pdf", body: Buffer.from("<html><script>alert(1)</script></html>") },
      { name: "spoof.xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", body: Buffer.from("NOT_A_REAL_XLSX") },
      { name: "spoof.zip", mime: "application/zip", body: Buffer.from("NOT_A_REAL_ZIP") }
    ];
    for (const tc of spoofedCases) {
      const resp = await fetch(`${baseUrl}/api/resources/admin/upload-paid-asset`, {
        method: "POST",
        headers: {
          ...adminAuth,
          "Content-Type": tc.mime,
          "X-Upload-Filename": tc.name
        },
        body: tc.body
      });
      const json: any = await resp.json();
      eq(resp.status, 400, `Expected 400 INVALID_FILE_SIGNATURE for ${tc.name}`);
      eq(json.code, "INVALID_FILE_SIGNATURE");
    }

    // Direct unit checks on signature & content-type helpers
    eq(validatePaidUploadSignature(VALID_PDF_BYTES, ".pdf"), true);
    eq(validatePaidUploadSignature(VALID_XLSX_BYTES, ".xlsx"), true);
    eq(validatePaidUploadSignature(VALID_ZIP_BYTES, ".zip"), true);
    eq(validatePaidUploadSignature(Buffer.from("<html>"), ".pdf"), false);
    eq(validatePaidUploadContentType("text/html", ".pdf").valid, false);

    // 3f. Empty file (0 bytes)
    const emptyResp = await fetch(`${baseUrl}/api/resources/admin/upload-paid-asset`, {
      method: "POST",
      headers: {
        ...adminAuth,
        "Content-Type": "application/pdf",
        "X-Upload-Filename": "empty.pdf"
      },
      body: Buffer.alloc(0)
    });
    const emptyJson: any = await emptyResp.json();
    eq(emptyResp.status, 400);
    eq(emptyJson.code, "EMPTY_FILE");

    // 3g. Oversized file (> 256 byte test limit)
    const oversizedBuf = Buffer.concat([VALID_PDF_BYTES, Buffer.alloc(400, 0x41)]);
    const oversizedResp = await fetch(`${baseUrl}/api/resources/admin/upload-paid-asset`, {
      method: "POST",
      headers: {
        ...adminAuth,
        "Content-Type": "application/pdf",
        "X-Upload-Filename": "too-large.pdf"
      },
      body: oversizedBuf
    });
    const oversizedJson: any = await oversizedResp.json();
    eq(oversizedResp.status, 413);
    eq(oversizedJson.code, "FILE_TOO_LARGE");

    // 3h. Oversized chunked request (no Content-Length header — verifies express.raw limit + JSON error handler)
    const chunkedResult = await new Promise<{ status: number; body: any }>((resolve, reject) => {
      const url = new URL(`${baseUrl}/api/resources/admin/upload-paid-asset`);
      const req = http.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname,
          method: "POST",
          headers: {
            ...adminAuth,
            "Content-Type": "application/pdf",
            "X-Upload-Filename": "chunked-too-large.pdf",
            "Transfer-Encoding": "chunked"
          }
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            resolve({
              status: res.statusCode || 0,
              body: JSON.parse(Buffer.concat(chunks).toString("utf8"))
            });
          });
        }
      );
      req.on("error", reject);
      req.write(VALID_PDF_BYTES);
      req.end(Buffer.alloc(400, 0x42));
    });
    eq(chunkedResult.status, 413);
    eq(chunkedResult.body.code, "FILE_TOO_LARGE");

    eq(log.uploads.length, 0, "Zero storage uploads may occur for invalid/oversized/malicious inputs");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    setMockSupabaseServerClient(null);
  }
});

// ---------------------------------------------------------------------------
// TEST 4: Private bucket upload failures fail closed without secret leakage
// ---------------------------------------------------------------------------
await runTest("4. Private bucket upload failures and unavailable service-role client fail closed (HTTP 503) with zero secret leakage", async () => {
  const { server, baseUrl } = await startTestServer();

  try {
    // 4a. Service-role client unavailable -> 503 SERVICE_ROLE_UNAVAILABLE
    setMockSupabaseServerClient(null);
    const noClientResp = await fetch(`${baseUrl}/api/resources/admin/upload-paid-asset`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKENS.CONFIRMED_ADMIN_EMAIL}`,
        "Content-Type": "application/pdf",
        "X-Upload-Filename": "playbook.pdf"
      },
      body: VALID_PDF_BYTES
    });
    const noClientJson: any = await noClientResp.json();
    eq(noClientResp.status, 503);
    eq(noClientJson.code, "SERVICE_ROLE_UNAVAILABLE");

    // 4b. Private bucket returns storage error containing sensitive mock token -> 503, no leakage, no public fallback
    const secretLeakSentinel = "SUPER_SECRET_SERVICE_ROLE_KEY_DO_NOT_ECHO_999";
    const { client: failClient, log: failLog } = createMockServerSupabase({
      async uploadResult() {
        return {
          data: null,
          error: {
            statusCode: "404",
            message: `Bucket paid-resources not found while using ${secretLeakSentinel}`
          }
        };
      }
    });
    setMockSupabaseServerClient(failClient);

    const storageErrResp = await fetch(`${baseUrl}/api/resources/admin/upload-paid-asset`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKENS.CONFIRMED_ADMIN_EMAIL}`,
        "Content-Type": "application/pdf",
        "X-Upload-Filename": "playbook.pdf"
      },
      body: VALID_PDF_BYTES
    });
    const storageErrText = await storageErrResp.text();
    const storageErrJson = JSON.parse(storageErrText);
    eq(storageErrResp.status, 503);
    eq(storageErrJson.success, false);
    eq(storageErrJson.code, "PRIVATE_STORAGE_UPLOAD_FAILED");
    eq(storageErrText.includes(secretLeakSentinel), false, "Response must NEVER leak upstream error details or secrets");
    eq(failLog.bucketsRequested.includes("resources"), false, "Must NEVER fall back to public resources bucket");
    eq(failLog.getPublicUrlCalls.length, 0, "Must NEVER call getPublicUrl on failure");

    // 4c. Private bucket throws exception -> 503 fail closed without leakage
    const { client: throwClient } = createMockServerSupabase({
      async uploadResult() {
        throw new Error(`Upstream crash with ${secretLeakSentinel}`);
      }
    });
    setMockSupabaseServerClient(throwClient);

    const throwResp = await fetch(`${baseUrl}/api/resources/admin/upload-paid-asset`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKENS.CONFIRMED_ADMIN_EMAIL}`,
        "Content-Type": "application/pdf",
        "X-Upload-Filename": "playbook.pdf"
      },
      body: VALID_PDF_BYTES
    });
    const throwText = await throwResp.text();
    eq(throwResp.status, 503);
    eq(throwText.includes(secretLeakSentinel), false);
    eq(JSON.parse(throwText).code, "PRIVATE_STORAGE_UPLOAD_FAILED");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    setMockSupabaseServerClient(null);
  }
});

// ---------------------------------------------------------------------------
// TEST 5: resourceService.uploadPaidResourceFile end-to-end against local server
// ---------------------------------------------------------------------------
await runTest("5. resourceService.uploadPaidResourceFile calls POST /api/resources/admin/upload-paid-asset and rejects non-canonical references", async () => {
  const { client, log } = createMockServerSupabase();
  setMockSupabaseServerClient(client);
  const { server, baseUrl } = await startTestServer();

  try {
    const endpointUrl = `${baseUrl}/api/resources/admin/upload-paid-asset`;
    const pdfFile = new File([VALID_PDF_BYTES], "Meta Ads Paid Masterclass.pdf", {
      type: "application/pdf"
    });

    // 5a. Authenticated confirmed admin succeeds
    const okResult = await resourceService.uploadPaidResourceFile(pdfFile, {
      accessToken: TOKENS.CONFIRMED_ADMIN_EMAIL,
      endpointUrl
    });
    eq(okResult.error, null);
    ok(okResult.url && okResult.url.startsWith("supabase://paid-resources/paid/"));
    eq(log.bucketsRequested.includes("resources"), false);
    eq(log.getPublicUrlCalls.length, 0);

    // 5b. Missing auth token fails closed without hitting server
    const beforeUploads = log.uploads.length;
    const unauthResult = await resourceService.uploadPaidResourceFile(pdfFile, {
      endpointUrl
    });
    eq(unauthResult.url, null);
    eq(unauthResult.code, "AUTH_REQUIRED");
    eq(log.uploads.length, beforeUploads);

    // 5c. Content-Type inference when browser supplies empty file.type for .xlsx
    const emptyTypeXlsx = new File([VALID_XLSX_BYTES], "Budget Sheet.xlsx", { type: "" });
    eq(
      resolvePaidUploadContentType(emptyTypeXlsx),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    const xlsxResult = await resourceService.uploadPaidResourceFile(emptyTypeXlsx, {
      accessToken: TOKENS.CONFIRMED_ADMIN_ROLE,
      endpointUrl
    });
    eq(xlsxResult.error, null);
    ok(xlsxResult.url && isCanonicalPrivatePaidReference(xlsxResult.url));

    // 5d. Defense-in-depth: if a misbehaving endpoint ever returned a public URL instead of supabase://paid-resources/..., fail closed
    const originalFetch = globalThis.fetch;
    try {
      (globalThis as any).fetch = async () =>
        new Response(
          JSON.stringify({
            success: true,
            reference: "https://example.supabase.co/storage/v1/object/public/resources/downloads/leak.pdf"
          }),
          { status: 201, headers: { "Content-Type": "application/json" } }
        );
      const badRefResult = await resourceService.uploadPaidResourceFile(pdfFile, {
        accessToken: TOKENS.CONFIRMED_ADMIN_EMAIL,
        endpointUrl
      });
      eq(badRefResult.url, null);
      eq(badRefResult.code, "INVALID_PRIVATE_REFERENCE");
    } finally {
      globalThis.fetch = originalFetch;
    }
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    setMockSupabaseServerClient(null);
  }
});

// ---------------------------------------------------------------------------
// TEST 6: ResourceEditorModal upload routing (paid vs free, zero /downloads/ fallback)
// ---------------------------------------------------------------------------
await runTest("6. ResourceEditorModal routes paid uploads to uploadPaidResourceFile, never falls back to /downloads/, and preserves free uploads", async () => {
  const paidPdf = new File([VALID_PDF_BYTES], "Premium Framework.pdf", { type: "application/pdf" });
  const freePdf = new File([VALID_PDF_BYTES], "Free Starter Checklist.pdf", { type: "application/pdf" });

  let paidCalls = 0;
  let freeCalls = 0;

  // 6a. Paid upload success -> uses uploadPaid ONLY, never uploadFree
  const paidSuccess = await executeResourceModalFileUpload({
    file: paidPdf,
    isPaidResource: true,
    currentFileUrl: "",
    uploadPaid: async () => {
      paidCalls += 1;
      return { url: "supabase://paid-resources/paid/1700000000_abcdef_premium_framework.pdf", error: null };
    },
    uploadFree: async () => {
      freeCalls += 1;
      throw new Error("uploadFree MUST NEVER be called for paid resources");
    }
  });
  eq(paidSuccess.success, true);
  eq(paidSuccess.noticeType, "success");
  eq(paidSuccess.nextFileUrl, "supabase://paid-resources/paid/1700000000_abcdef_premium_framework.pdf");
  eq(paidCalls, 1);
  eq(freeCalls, 0);

  // 6b. Failed paid upload -> NEVER falls back to /downloads/<filename>, preserves empty currentFileUrl
  const paidFailureEmpty = await executeResourceModalFileUpload({
    file: paidPdf,
    isPaidResource: true,
    currentFileUrl: "",
    uploadPaid: async () => ({
      url: null,
      code: "PRIVATE_STORAGE_UPLOAD_FAILED",
      error: { message: "Private bucket unavailable" }
    }),
    uploadFree: async () => {
      freeCalls += 1;
      throw new Error("uploadFree MUST NEVER be called for paid resources");
    }
  });
  eq(paidFailureEmpty.success, false);
  eq(paidFailureEmpty.noticeType, "error");
  eq(paidFailureEmpty.nextFileUrl, "", "Failed paid upload must NEVER fall back to /downloads/");
  eq(paidFailureEmpty.nextFileUrl.includes("/downloads/"), false);
  eq(freeCalls, 0);

  // 6c. Thrown paid upload exception -> NEVER falls back to /downloads/, preserves existing private URL
  const existingPrivateRef = "supabase://paid-resources/paid/existing.pdf";
  const paidThrown = await executeResourceModalFileUpload({
    file: paidPdf,
    isPaidResource: true,
    currentFileUrl: existingPrivateRef,
    uploadPaid: async () => {
      throw new Error("Network disconnected");
    },
    uploadFree: async () => {
      freeCalls += 1;
      throw new Error("uploadFree MUST NEVER be called for paid resources");
    }
  });
  eq(paidThrown.success, false);
  eq(paidThrown.noticeType, "error");
  eq(paidThrown.nextFileUrl, existingPrivateRef);
  eq(freeCalls, 0);

  // 6d. Free resource upload -> preserves existing uploadResourceFile(file, 'downloads') workflow
  let freeFolderUsed = "";
  const freeSuccess = await executeResourceModalFileUpload({
    file: freePdf,
    isPaidResource: false,
    currentFileUrl: "",
    uploadPaid: async () => {
      paidCalls += 1;
      throw new Error("uploadPaid should not be called for free resources");
    },
    uploadFree: async (_f, folder) => {
      freeCalls += 1;
      freeFolderUsed = folder || "";
      return {
        url: "https://example.supabase.co/storage/v1/object/public/resources/downloads/123_free_starter_checklist.pdf",
        error: null
      };
    }
  });
  eq(freeSuccess.success, true);
  eq(freeSuccess.noticeType, "success");
  eq(freeFolderUsed, "downloads");
  ok(freeSuccess.nextFileUrl.includes("/storage/v1/object/public/resources/downloads/"));
  eq(freeCalls, 1);
  eq(paidCalls, 1);
});

// ---------------------------------------------------------------------------
// TEST 7: Persistence guards reject public resources URLs on paid saves, preserve legacy records
// ---------------------------------------------------------------------------
await runTest("7. Newly saved/updated paid resources reject public resources and /downloads/ URLs without silent conversion while preserving legacy records", async () => {
  const publicResourcesUrl =
    "https://kpuxtsworzkueyffjaaz.supabase.co/storage/v1/object/public/resources/downloads/paid-leak.pdf";
  const supabaseResourcesRef = "supabase://resources/downloads/paid-leak.pdf";
  const localDownloadsFallback = "/downloads/paid-leak.pdf";
  const canonicalPrivateRef = "supabase://paid-resources/paid/1700000000_a1b2c3_paid.pdf";

  // 7a. URL classifier checks
  eq(isPublicResourcesStorageUrl(publicResourcesUrl), true);
  eq(isPublicResourcesStorageUrl(supabaseResourcesRef), true);
  eq(isPublicResourcesStorageUrl(localDownloadsFallback), true);
  eq(isPublicResourcesStorageUrl("https://digitalmuid.com/downloads/paid-leak.pdf"), true);
  eq(isPublicResourcesStorageUrl(canonicalPrivateRef), false);
  eq(isCanonicalPrivatePaidReference(canonicalPrivateRef), true);
  eq(isCanonicalPrivatePaidReference(publicResourcesUrl), false);
  eq(isCanonicalPrivatePaidReference("supabase://paid-resources/../escape.pdf"), false);

  // 7b. resourceService.insertResource blocks ALL public resources / /downloads/ URLs for paid resources
  for (const forbiddenUrl of [publicResourcesUrl, supabaseResourcesRef, localDownloadsFallback]) {
    const insertRes = await resourceService.insertResource({
      title: "New Paid Guide",
      slug: "new-paid-guide",
      accessType: "paid",
      price: 499,
      fileUrl: forbiddenUrl,
      status: "published"
    });
    eq(insertRes.data, null);
    eq(insertRes.error?.code, "PAID_PUBLIC_URL_FORBIDDEN", `insertResource must reject ${forbiddenUrl}`);
  }

  // 7c. resourceService.updateResource blocks public resources / /downloads/ URLs on paid resources
  const updatePaidRes = await resourceService.updateResource("99999999-9999-4999-8999-999999999999", {
    accessType: "paid",
    price: 499,
    fileUrl: publicResourcesUrl
  });
  eq(updatePaidRes.data, null);
  eq(updatePaidRes.error?.code, "PAID_PUBLIC_URL_FORBIDDEN");

  // 7d. Authoritative paid resource ID rejects public URL even if partial update omits accessType
  const authoritativeId = Object.values(AUTHORITATIVE_PAID_RESOURCES)[0].id;
  const authUpdateRes = await resourceService.updateResource(authoritativeId, {
    fileUrl: publicResourcesUrl
  });
  eq(authUpdateRes.data, null);
  eq(authUpdateRes.error?.code, "PAID_PUBLIC_URL_FORBIDDEN");

  // 7e. Free resource persistence validation allows public resources URLs
  eq(
    validatePaidResourcePersistence({
      title: "Free Checklist",
      accessType: "free",
      price: 0,
      fileUrl: publicResourcesUrl
    }).valid,
    true
  );

  // 7f. Modal save validator: new paid resource with public URL is rejected (never silently rewritten)
  const newPaidBlocked = prepareResourceModalSavePayload({
    payload: { title: "New Paid Blueprint", accessType: "paid", price: 499, fileUrl: publicResourcesUrl },
    isEditing: false,
    wasInitiallyPaid: false,
    isPaidResource: true,
    initialFileUrl: "",
    currentFileUrl: publicResourcesUrl,
    targetStatus: "published",
    price: 499
  });
  eq(newPaidBlocked.ok, false);
  eq(newPaidBlocked.code, "PAID_PUBLIC_URL_FORBIDDEN");

  // 7g. Modal save validator: free resource flipped to paid with existing public URL is rejected
  const flippedToPaidBlocked = prepareResourceModalSavePayload({
    payload: { title: "Converted Paid Guide", accessType: "paid", price: 299, fileUrl: publicResourcesUrl },
    isEditing: true,
    wasInitiallyPaid: false,
    isPaidResource: true,
    initialFileUrl: publicResourcesUrl,
    currentFileUrl: publicResourcesUrl,
    targetStatus: "draft",
    price: 299
  });
  eq(flippedToPaidBlocked.ok, false);
  eq(flippedToPaidBlocked.code, "PAID_PUBLIC_URL_FORBIDDEN");

  // 7h. Modal save validator: existing legacy paid resource metadata-only edit preserves legacy record without pretending it's migrated
  const legacyMetadataEdit = prepareResourceModalSavePayload({
    payload: {
      title: "Legacy Paid Guide (Updated Copy)",
      accessType: "paid",
      price: 499,
      fileUrl: publicResourcesUrl,
      downloadUrl: publicResourcesUrl
    },
    isEditing: true,
    wasInitiallyPaid: true,
    isPaidResource: true,
    initialFileUrl: publicResourcesUrl,
    currentFileUrl: publicResourcesUrl,
    targetStatus: "published",
    price: 499
  });
  eq(legacyMetadataEdit.ok, true);
  eq(legacyMetadataEdit.preservedLegacyFileUrl, true);
  eq(legacyMetadataEdit.payload?.fileUrl, undefined, "Unchanged legacy URL must be omitted from update payload rather than silently converted or overwritten");
  eq(legacyMetadataEdit.payload?.downloadUrl, undefined);

  // 7i. Modal save validator: existing legacy paid resource CANNOT be modified to a different public resources URL
  const legacyChangedToOtherPublic = prepareResourceModalSavePayload({
    payload: {
      title: "Legacy Paid Guide",
      accessType: "paid",
      price: 499,
      fileUrl: localDownloadsFallback
    },
    isEditing: true,
    wasInitiallyPaid: true,
    isPaidResource: true,
    initialFileUrl: publicResourcesUrl,
    currentFileUrl: localDownloadsFallback,
    targetStatus: "published",
    price: 499
  });
  eq(legacyChangedToOtherPublic.ok, false);
  eq(legacyChangedToOtherPublic.code, "PAID_PUBLIC_URL_FORBIDDEN");

  // 7j. Modal save validator: paid resource with canonical private reference succeeds intact
  const validPrivateSave = prepareResourceModalSavePayload({
    payload: {
      title: "Secure Paid Playbook",
      accessType: "paid",
      price: 499,
      fileUrl: canonicalPrivateRef,
      downloadUrl: canonicalPrivateRef
    },
    isEditing: false,
    wasInitiallyPaid: false,
    isPaidResource: true,
    initialFileUrl: "",
    currentFileUrl: canonicalPrivateRef,
    targetStatus: "published",
    price: 499
  });
  eq(validPrivateSave.ok, true);
  eq(validPrivateSave.payload?.fileUrl, canonicalPrivateRef);
});

// ---------------------------------------------------------------------------
// TEST 8: Source-level static invariants (defense-in-depth verification)
// ---------------------------------------------------------------------------
await runTest("8. Static source invariants: server/resourceRoutes.js never touches public resources bucket or getPublicUrl", () => {
  const resourceRoutesSrc = fs.readFileSync(
    path.resolve(process.cwd(), "server/resourceRoutes.js"),
    "utf8"
  );
  eq(
    /\.getPublicUrl\s*\(/.test(resourceRoutesSrc),
    false,
    "server/resourceRoutes.js must never call getPublicUrl()"
  );
  eq(
    /\.from\s*\(\s*["'`]resources["'`]\s*\)/.test(resourceRoutesSrc),
    false,
    "server/resourceRoutes.js must never access the public 'resources' bucket"
  );
  ok(
    resourceRoutesSrc.includes("PAID_RESOURCES_BUCKET = \"paid-resources\""),
    "server/resourceRoutes.js must hardcode PAID_RESOURCES_BUCKET = 'paid-resources'"
  );
});

console.log(`\nSummary: ${passed} passed, ${failed} failed (${assertionCount} assertions)`);
if (failed > 0) {
  process.exit(1);
}
