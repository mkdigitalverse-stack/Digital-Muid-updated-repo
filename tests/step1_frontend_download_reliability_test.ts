/**
 * DIGITALMUID V4.3 — STEP 1B: FRONTEND DOWNLOAD RELIABILITY REGRESSION TESTS
 *
 * Strictly offline behavioral regression suite for:
 *  - src/services/resourceService.ts
 *  - src/pages/BundleAccessPage.tsx
 *
 * Covers:
 *  1. Expired signed Storage URL (max 1 refresh/retry, success on retry, stop on 2nd expiry, non-expiry no-retry)
 *  2. Expired local asset token (retry ONLY on exact 403 INVALID_DOWNLOAD_TOKEN, no retry on mismatch/non-JSON)
 *  3. No-retry cases (entitlement 401/403, 429, 503/5xx, 404, network throws, malformed JSON & HTML errors)
 *  4. Filename safety (Content-Disposition, RFC 5987, strip ?token=.../#frag, reject API names & traversal)
 *  5. Diagnostic redaction (zero signed URLs, bearer tokens, access tokens, or query params in console output)
 *  6. BundleAccessPage component execution (fresh URL on click, max 1 expiry refresh, no false success toast,
 *     429/503/network do NOT show purchase-required paywall, 403 entitlement denial DOES show paywall,
 *     guest & authenticated credential forwarding)
 *
 * Run: npx tsx tests/step1_frontend_download_reliability_test.ts
 */

import assert from "node:assert";
import React from "react";

// Guarantee strictly offline mode before importing frontend modules
delete process.env.VITE_SUPABASE_URL;
delete process.env.VITE_SUPABASE_ANON_KEY;

import {
  resourceService,
  safeParseResponseBody,
  classifyHttpFailure,
  isExpiredSignedStorageResponse,
  isExpiredAssetTokenResponse,
  extractSafeDownloadFilename,
  redactSensitiveUrl,
  redactSensitiveText
} from "../src/services/resourceService.ts";
import { BundleAccessPage, captureAndScrubBundleAccessUrl } from "../src/pages/BundleAccessPage.tsx";
import {
  clearMemoryGuestResourceTokens,
  saveStoredGuestResourceToken
} from "../src/services/paymentService.ts";

// ---------------------------------------------------------------------------
// Assertion & Test Runner Accounting
// ---------------------------------------------------------------------------
let testsPassed = 0;
let testsFailed = 0;
let assertionCount = 0;

const origConsoleLog = console.log.bind(console);
const origConsoleWarn = console.warn.bind(console);
const origConsoleError = console.error.bind(console);

function expectStrictEqual<T>(actual: T, expected: T, message?: string) {
  assertionCount += 1;
  assert.strictEqual(actual, expected, message);
}

function expectOk(value: unknown, message?: string) {
  assertionCount += 1;
  assert.ok(value, message);
}

async function runTest(name: string, fn: () => Promise<void> | void) {
  const beforeAssertions = assertionCount;
  try {
    await fn();
    const delta = assertionCount - beforeAssertions;
    if (delta === 0) {
      throw new Error("Test executed 0 assertions");
    }
    testsPassed += 1;
    origConsoleLog(`  [PASS] ${name} (${delta} assertions)`);
  } catch (err: any) {
    testsFailed += 1;
    origConsoleError(`  [FAIL] ${name}: ${err?.message || err}`);
  }
}

// ---------------------------------------------------------------------------
// Mock Browser Environment (DOM anchors, sessionStorage, URL, fetch, console)
// ---------------------------------------------------------------------------
interface RecordedAnchor {
  href: string;
  download: string;
  target: string;
  rel: string;
  clicked: boolean;
  attributes: Record<string, string>;
}

interface RecordedFetchCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
}

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  key(index: number) {
    return Array.from(this.map.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
}

function makeResponse(
  status: number,
  body: string | Uint8Array,
  headers: Record<string, string> = {}
): Response {
  const normalizedHeaders = new Headers(headers);
  return new Response(body, { status, headers: normalizedHeaders });
}

function makeJsonResponse(
  status: number,
  payload: unknown,
  headers: Record<string, string> = {}
): Response {
  return makeResponse(status, JSON.stringify(payload), {
    "content-type": "application/json",
    ...headers
  });
}

interface MockBrowserEnv {
  anchors: RecordedAnchor[];
  fetchCalls: RecordedFetchCall[];
  consoleEntries: Array<{ level: "log" | "warn" | "error"; text: string }>;
  createdBlobUrls: string[];
  revokedBlobUrls: string[];
  sessionStorage: MemoryStorage;
  setFetchHandler: (
    fn: (url: string, init?: RequestInit) => Promise<Response> | Response
  ) => void;
  setUrl: (pathAndSearch: string) => void;
  restore: () => void;
}

function installMockBrowserEnv(initialUrl = "/resources/bundle/meta-ads-campaign-planner-bundle"): MockBrowserEnv {
  const anchors: RecordedAnchor[] = [];
  const fetchCalls: RecordedFetchCall[] = [];
  const consoleEntries: Array<{ level: "log" | "warn" | "error"; text: string }> = [];
  const createdBlobUrls: string[] = [];
  const revokedBlobUrls: string[] = [];
  const sessionStorage = new MemoryStorage();

  const origFetch = globalThis.fetch;
  const origWindow = (globalThis as any).window;
  const origDocument = (globalThis as any).document;
  const origCreateObjectURL = URL.createObjectURL;
  const origRevokeObjectURL = URL.revokeObjectURL;

  let currentHandler: (url: string, init?: RequestInit) => Promise<Response> | Response = () => {
    throw new Error("Unexpected fetch call with no mock handler configured");
  };

  let blobCounter = 0;

  const parseUrlParts = (u: string) => {
    const parsed = new URL(u, "https://digitalmuid.test");
    return {
      pathname: parsed.pathname,
      search: parsed.search,
      hash: parsed.hash,
      href: parsed.href
    };
  };

  const mockLocation = parseUrlParts(initialUrl);
  const mockHistory = {
    state: null as any,
    replaceState(state: any, _title: string, nextUrl?: string | URL | null) {
      mockHistory.state = state;
      if (typeof nextUrl === "string") {
        Object.assign(mockLocation, parseUrlParts(nextUrl));
      }
    }
  };

  const mockBody = {
    style: { overflow: "" },
    appendChild(el: any) {
      return el;
    },
    removeChild(el: any) {
      return el;
    }
  };

  const mockDocument = {
    body: mockBody,
    createElement(tag: string) {
      const rec: RecordedAnchor = {
        href: "",
        download: "",
        target: "",
        rel: "",
        clicked: false,
        attributes: {}
      };
      if (tag.toLowerCase() === "a") {
        anchors.push(rec);
      }
      return {
        get href() {
          return rec.href;
        },
        set href(v: string) {
          rec.href = v;
        },
        get download() {
          return rec.download;
        },
        set download(v: string) {
          rec.download = v;
        },
        get target() {
          return rec.target;
        },
        set target(v: string) {
          rec.target = v;
        },
        get rel() {
          return rec.rel;
        },
        set rel(v: string) {
          rec.rel = v;
        },
        setAttribute(k: string, v: string) {
          rec.attributes[k] = v;
          if (k === "download") rec.download = v;
          if (k === "href") rec.href = v;
        },
        click() {
          rec.clicked = true;
        }
      };
    }
  };

  const mockWindow: any = {
    location: mockLocation,
    history: mockHistory,
    sessionStorage,
    localStorage: new MemoryStorage(),
    dataLayer: [],
    addEventListener() {},
    removeEventListener() {},
    open() {
      return null;
    }
  };

  (globalThis as any).window = mockWindow;
  (globalThis as any).document = mockDocument;
  URL.createObjectURL = () => {
    blobCounter += 1;
    const u = `blob:mock-download-${blobCounter}`;
    createdBlobUrls.push(u);
    return u;
  };
  URL.revokeObjectURL = (u: string) => {
    revokedBlobUrls.push(u);
  };

  globalThis.fetch = (async (input: any, init?: RequestInit) => {
    const url = typeof input === "string" ? input : String(input?.url || input);
    const headersObj: Record<string, string> = {};
    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((v, k) => {
          headersObj[k.toLowerCase()] = v;
        });
      } else if (Array.isArray(init.headers)) {
        for (const [k, v] of init.headers) {
          headersObj[String(k).toLowerCase()] = String(v);
        }
      } else {
        for (const [k, v] of Object.entries(init.headers as Record<string, string>)) {
          headersObj[k.toLowerCase()] = String(v);
        }
      }
    }
    fetchCalls.push({
      url,
      method: (init?.method || "GET").toUpperCase(),
      headers: headersObj,
      body: typeof init?.body === "string" ? init.body : null
    });
    return await currentHandler(url, init);
  }) as typeof fetch;

  const formatArgs = (args: unknown[]) =>
    args
      .map((a) => {
        if (typeof a === "string") return a;
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      })
      .join(" ");

  console.log = (...args: unknown[]) => {
    consoleEntries.push({ level: "log", text: formatArgs(args) });
  };
  console.warn = (...args: unknown[]) => {
    consoleEntries.push({ level: "warn", text: formatArgs(args) });
  };
  console.error = (...args: unknown[]) => {
    consoleEntries.push({ level: "error", text: formatArgs(args) });
  };

  clearMemoryGuestResourceTokens();

  return {
    anchors,
    fetchCalls,
    consoleEntries,
    createdBlobUrls,
    revokedBlobUrls,
    sessionStorage,
    setFetchHandler(fn) {
      currentHandler = fn;
    },
    setUrl(pathAndSearch: string) {
      Object.assign(mockLocation, parseUrlParts(pathAndSearch));
    },
    restore() {
      console.log = origConsoleLog;
      console.warn = origConsoleWarn;
      console.error = origConsoleError;
      globalThis.fetch = origFetch;
      (globalThis as any).window = origWindow;
      (globalThis as any).document = origDocument;
      URL.createObjectURL = origCreateObjectURL;
      URL.revokeObjectURL = origRevokeObjectURL;
      clearMemoryGuestResourceTokens();
    }
  };
}

// ---------------------------------------------------------------------------
// Lightweight Offline React 19 Component Harness (for BundleAccessPage)
// ---------------------------------------------------------------------------
interface EffectRecord {
  deps?: readonly unknown[];
  cleanup?: (() => void) | void;
  pendingFn?: () => (() => void) | void;
}

function depsChanged(prev?: readonly unknown[], next?: readonly unknown[]): boolean {
  if (!prev || !next) return true;
  if (prev.length !== next.length) return true;
  for (let i = 0; i < prev.length; i++) {
    if (!Object.is(prev[i], next[i])) return true;
  }
  return false;
}

function collectElementText(node: any): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(collectElementText).join(" ");
  if (typeof node === "object" && node.props) {
    return collectElementText(node.props.children);
  }
  return "";
}

function findElements(node: any, predicate: (el: any) => boolean, out: any[] = []): any[] {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const child of node) findElements(child, predicate, out);
    return out;
  }
  if (predicate(node)) {
    out.push(node);
  }
  if (node.props && node.props.children !== undefined) {
    findElements(node.props.children, predicate, out);
  }
  return out;
}

function mountFunctionComponent<P>(
  Component: React.FC<P>,
  props: P,
  mockContextValue: any
) {
  const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  assert.ok(internals, "React 19 internals unavailable for offline hook harness");

  const states: any[] = [];
  const refs: Array<{ current: any }> = [];
  const effects: EffectRecord[] = [];
  let dirty = false;
  let tree: any = null;

  const renderOnce = () => {
    let stateIdx = 0;
    let refIdx = 0;
    let effectIdx = 0;
    dirty = false;

    const dispatcher = {
      useContext() {
        return mockContextValue;
      },
      useState(initial: any) {
        const idx = stateIdx++;
        if (!(idx in states)) {
          states[idx] = typeof initial === "function" ? initial() : initial;
        }
        const setState = (updater: any) => {
          const prev = states[idx];
          const next = typeof updater === "function" ? updater(prev) : updater;
          if (!Object.is(prev, next)) {
            states[idx] = next;
            dirty = true;
          }
        };
        return [states[idx], setState];
      },
      useRef(initial: any) {
        const idx = refIdx++;
        if (!(idx in refs)) {
          refs[idx] = { current: initial };
        }
        return refs[idx];
      },
      useEffect(fn: () => (() => void) | void, deps?: readonly unknown[]) {
        const idx = effectIdx++;
        const prev = effects[idx];
        if (!prev || depsChanged(prev.deps, deps)) {
          effects[idx] = {
            deps: deps ? [...deps] : undefined,
            cleanup: prev?.cleanup,
            pendingFn: fn
          };
        }
      },
      useMemo(factory: () => any) {
        return factory();
      },
      useCallback(fn: any) {
        return fn;
      }
    };

    const prevH = internals.H;
    internals.H = dispatcher;
    try {
      tree = Component(props);
    } finally {
      internals.H = prevH;
    }

    // Run pending effects after commit
    for (const rec of effects) {
      if (rec && rec.pendingFn) {
        const fn = rec.pendingFn;
        rec.pendingFn = undefined;
        if (typeof rec.cleanup === "function") {
          rec.cleanup();
        }
        rec.cleanup = fn();
      }
    }
  };

  const flush = async (maxRounds = 15) => {
    for (let i = 0; i < maxRounds; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (dirty) {
        renderOnce();
      } else {
        // Check one extra microtask turn for chained async promises
        await Promise.resolve();
        if (dirty) {
          renderOnce();
        } else {
          break;
        }
      }
    }
  };

  renderOnce();

  return {
    getTree: () => tree,
    getText: () => collectElementText(tree),
    findButtonsByText: (needle: string) =>
      findElements(
        tree,
        (el) => el.type === "button" && collectElementText(el).includes(needle)
      ),
    flush,
    rerender: () => renderOnce(),
    unmount() {
      for (const rec of effects) {
        if (rec && typeof rec.cleanup === "function") {
          rec.cleanup();
          rec.cleanup = undefined;
        }
      }
    }
  };
}

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------
const PAID_WORKBOOK_RESOURCE: any = {
  id: "14780d45-4457-46c2-a478-9d25a939448e",
  slug: "meta-ads-campaign-planner-workbook",
  title: "Meta Ads Campaign Planner Workbook",
  name: "Meta Ads Campaign Planner Workbook",
  accessType: "paid",
  price: 199,
  currency: "INR",
  fileUrl: "/protected_downloads/meta-ads-campaign-planner-workbook.pdf"
};

const BUNDLE_ID = "2d50e5e3-711d-4461-a70d-0ed54dd29f17";

function makeBundleFilesPayload(tokenTag: string) {
  return {
    success: true,
    authorized: true,
    bundle: { id: BUNDLE_ID, title: "Meta Ads Campaign Planner Bundle" },
    files: [
      {
        id: "14780d45-4457-46c2-a478-9d25a939448e",
        slug: "meta-ads-campaign-planner-workbook",
        title: "Meta Ads Campaign Planner Workbook",
        format: "PDF Document",
        fileSize: "1.4 MB",
        filename: "meta-ads-campaign-planner-workbook.pdf",
        downloadUrl: `https://storage.example.test/storage/v1/object/sign/paid-resources/workbook.pdf?token=${tokenTag}_wb`
      },
      {
        id: "3fc22943-9562-4e78-9d5f-70c26b90cbef",
        slug: "the-ad-budget-breat-even-calculate",
        title: "Ad Budget & Break-Even Calculator",
        format: "Spreadsheet",
        fileSize: "420 KB",
        filename: "ad-budget-break-even-calculator.xlsx",
        downloadUrl: `https://storage.example.test/storage/v1/object/sign/paid-resources/calc.xlsx?token=${tokenTag}_calc`
      }
    ]
  };
}

// ---------------------------------------------------------------------------
// Main Test Execution
// ---------------------------------------------------------------------------
async function main() {
  origConsoleLog("==================================================================");
  origConsoleLog("DIGITALMUID V4.3 — STEP 1B FRONTEND DOWNLOAD RELIABILITY TESTS");
  origConsoleLog("==================================================================");

  // =========================================================================
  // GROUP 1: EXPIRED SIGNED STORAGE URL (deliverResource)
  // =========================================================================
  origConsoleLog("\n[Group 1] Expired Signed Storage URL Handling (resourceService.deliverResource)");

  await runTest("1.1 Expired signed Storage URL (400 InvalidJWT) refreshes ONCE, retries, and succeeds", async () => {
    const env = installMockBrowserEnv();
    try {
      let authCalls = 0;
      let storageCalls = 0;
      const expiredUrl =
        "https://storage.example.test/storage/v1/object/sign/paid-resources/workbook.pdf?token=EXPIRED_JWT_SECRET_111";
      const freshUrl =
        "https://storage.example.test/storage/v1/object/sign/paid-resources/workbook.pdf?token=FRESH_JWT_SECRET_222";

      env.setFetchHandler(async (url) => {
        if (url === "/api/payments/get-resource-download-url") {
          authCalls += 1;
          return makeJsonResponse(200, {
            success: true,
            downloadUrl: authCalls === 1 ? expiredUrl : freshUrl,
            accessType: "paid"
          });
        }
        if (url === expiredUrl) {
          storageCalls += 1;
          return makeJsonResponse(400, {
            statusCode: "400",
            error: "InvalidJWT",
            message: "exp claim timestamp check failed"
          });
        }
        if (url === freshUrl) {
          storageCalls += 1;
          return makeResponse(200, "%PDF-1.7-fresh-workbook-bytes", {
            "content-type": "application/pdf",
            "content-disposition": 'attachment; filename="meta-ads-campaign-planner-workbook.pdf"'
          });
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      });

      const res = await resourceService.deliverResource(PAID_WORKBOOK_RESOURCE, {
        orderId: "order_s1_1",
        paymentId: "pay_s1_1",
        resourceAccessToken: "GUEST_SECRET_TOKEN_ABC"
      });

      expectStrictEqual(res.success, true, "Retry after expired Storage URL must succeed");
      expectStrictEqual(authCalls, 2, "Must call get-resource-download-url exactly twice (initial + 1 refresh)");
      expectStrictEqual(storageCalls, 2, "Must call Storage exactly twice (initial expired + 1 retry)");
      expectStrictEqual(env.anchors.length, 1, "Exactly one download anchor should be triggered");
      expectStrictEqual(env.anchors[0].clicked, true);
      expectStrictEqual(env.anchors[0].download, "meta-ads-campaign-planner-workbook.pdf");
      expectOk(env.anchors[0].href.startsWith("blob:"), "Download must use blob URL, not raw signed URL");
    } finally {
      env.restore();
    }
  });

  await runTest("1.2 Second consecutive expired signed Storage URL stops at max 1 retry (no loop, no success)", async () => {
    const env = installMockBrowserEnv();
    try {
      let authCalls = 0;
      let storageCalls = 0;

      env.setFetchHandler(async (url) => {
        if (url === "/api/payments/get-resource-download-url") {
          authCalls += 1;
          return makeJsonResponse(200, {
            success: true,
            downloadUrl: `https://storage.example.test/storage/v1/object/sign/paid-resources/workbook.pdf?token=EXPIRED_${authCalls}`,
            accessType: "paid"
          });
        }
        if (url.startsWith("https://storage.example.test/")) {
          storageCalls += 1;
          return makeJsonResponse(403, {
            statusCode: "403",
            error: "InvalidJWT",
            message: "Signature has expired"
          });
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      });

      const res = await resourceService.deliverResource(PAID_WORKBOOK_RESOURCE, {
        orderId: "order_s1_2",
        paymentId: "pay_s1_2",
        resourceAccessToken: "GUEST_SECRET_TOKEN_DEF"
      });

      expectStrictEqual(res.success, false, "Second expiry must fail truthfully");
      expectStrictEqual(res.errorCategory, "expired_link");
      expectStrictEqual(authCalls, 2, "Must NOT exceed 1 refresh (initial + 1 retry = 2 auth calls)");
      expectStrictEqual(storageCalls, 2, "Must NOT exceed 1 retry (2 storage fetches total)");
      expectStrictEqual(env.anchors.length, 0, "Must NEVER open an anchor or generate fallback PDF on failure");
    } finally {
      env.restore();
    }
  });

  await runTest("1.3 Non-expiry 403/400 from Storage does NOT trigger refresh retry", async () => {
    const env = installMockBrowserEnv();
    try {
      let authCalls = 0;
      let storageCalls = 0;
      const signedUrl =
        "https://storage.example.test/storage/v1/object/sign/paid-resources/workbook.pdf?token=VALID_NOT_EXPIRED";

      env.setFetchHandler(async (url) => {
        if (url === "/api/payments/get-resource-download-url") {
          authCalls += 1;
          return makeJsonResponse(200, { success: true, downloadUrl: signedUrl, accessType: "paid" });
        }
        if (url === signedUrl) {
          storageCalls += 1;
          return makeJsonResponse(403, { error: "AccessDenied", message: "Bucket policy denied access" });
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      });

      const res = await resourceService.deliverResource(PAID_WORKBOOK_RESOURCE, {
        orderId: "order_s1_3",
        paymentId: "pay_s1_3",
        resourceAccessToken: "GUEST_SECRET_TOKEN_GHI"
      });

      expectStrictEqual(res.success, false);
      expectStrictEqual(res.errorCategory, "download_failed");
      expectStrictEqual(authCalls, 1, "Non-expiry 403 must NOT refresh");
      expectStrictEqual(storageCalls, 1, "Non-expiry 403 must NOT retry");
      expectStrictEqual(env.anchors.length, 0);
    } finally {
      env.restore();
    }
  });

  // =========================================================================
  // GROUP 2: EXPIRED LOCAL ASSET TOKEN (/api/payments/download-paid-asset)
  // =========================================================================
  origConsoleLog("\n[Group 2] Expired Local Asset Token Handling (/api/payments/download-paid-asset)");

  await runTest("2.1 Exact 403 INVALID_DOWNLOAD_TOKEN refreshes ONCE, retries, and completes with safe filename", async () => {
    const env = installMockBrowserEnv();
    try {
      let authCalls = 0;
      let assetCalls = 0;
      const staleTok = "STALE_ASSET_TOKEN_111.sig111";
      const freshTok = "FRESH_ASSET_TOKEN_222.sig222";
      const localEndpoint = "/api/payments/download-paid-asset";

      env.setFetchHandler(async (url, init) => {
        if (url === "/api/payments/get-resource-download-url") {
          authCalls += 1;
          return makeJsonResponse(200, {
            success: true,
            downloadUrl: localEndpoint,
            assetAccessToken: authCalls === 1 ? staleTok : freshTok,
            accessType: "paid"
          });
        }
        if (url === localEndpoint) {
          assetCalls += 1;
          const headers = (init?.headers || {}) as Record<string, string>;
          const authHeader = headers.Authorization || headers.authorization || "";
          if (authHeader === `Bearer ${staleTok}`) {
            return makeJsonResponse(403, {
              success: false,
              code: "INVALID_DOWNLOAD_TOKEN",
              error: "Forbidden: Invalid, expired, or tampered download token."
            });
          }
          if (authHeader === `Bearer ${freshTok}`) {
            return makeResponse(200, "%PDF-1.7-local-paid-asset", {
              "content-type": "application/pdf",
              "content-disposition": 'attachment; filename="meta-ads-campaign-planner-workbook.pdf"'
            });
          }
          throw new Error(`Unexpected Authorization header: ${authHeader}`);
        }
        throw new Error(`Unexpected URL: ${url}`);
      });

      const res = await resourceService.deliverResource(PAID_WORKBOOK_RESOURCE, {
        orderId: "order_s2_1",
        paymentId: "pay_s2_1",
        resourceAccessToken: "GUEST_SECRET_LOCAL_1"
      });

      expectStrictEqual(res.success, true);
      expectStrictEqual(authCalls, 2);
      expectStrictEqual(assetCalls, 2);
      expectStrictEqual(env.anchors.length, 1);
      expectStrictEqual(env.anchors[0].download, "meta-ads-campaign-planner-workbook.pdf");
      expectOk(!env.anchors[0].download.includes("token="), "Filename must never include token=");
      expectOk(!env.anchors[0].download.includes("?"), "Filename must never include query string");
    } finally {
      env.restore();
    }
  });

  await runTest("2.2 Second 403 INVALID_DOWNLOAD_TOKEN stops at max 1 retry", async () => {
    const env = installMockBrowserEnv();
    try {
      let authCalls = 0;
      let assetCalls = 0;

      env.setFetchHandler(async (url) => {
        if (url === "/api/payments/get-resource-download-url") {
          authCalls += 1;
          return makeJsonResponse(200, {
            success: true,
            downloadUrl: `/api/payments/download-paid-asset?token=EXPIRED_TOK_${authCalls}.sig`,
            accessType: "paid"
          });
        }
        if (url.startsWith("/api/payments/download-paid-asset")) {
          assetCalls += 1;
          return makeJsonResponse(403, {
            success: false,
            code: "INVALID_DOWNLOAD_TOKEN",
            error: "Expired download token."
          });
        }
        throw new Error(`Unexpected URL: ${url}`);
      });

      const res = await resourceService.deliverResource(PAID_WORKBOOK_RESOURCE, {
        orderId: "order_s2_2",
        paymentId: "pay_s2_2",
        resourceAccessToken: "GUEST_SECRET_LOCAL_2"
      });

      expectStrictEqual(res.success, false);
      expectStrictEqual(res.code, "INVALID_DOWNLOAD_TOKEN");
      expectStrictEqual(res.errorCategory, "expired_link");
      expectStrictEqual(authCalls, 2);
      expectStrictEqual(assetCalls, 2);
      expectStrictEqual(env.anchors.length, 0);
    } finally {
      env.restore();
    }
  });

  await runTest("2.3 Resource/file/metadata mismatch 403 and non-JSON 403 NEVER trigger retry", async () => {
    const mismatchCases = [
      { label: "TOKEN_RESOURCE_MISMATCH", status: 403, body: JSON.stringify({ success: false, code: "TOKEN_RESOURCE_MISMATCH", error: "Mismatch" }), ct: "application/json" },
      { label: "TOKEN_FILE_MISMATCH", status: 403, body: JSON.stringify({ success: false, code: "TOKEN_FILE_MISMATCH", error: "File mismatch" }), ct: "application/json" },
      { label: "TOKEN_METADATA_OVERRIDE_REJECTED", status: 403, body: JSON.stringify({ success: false, code: "TOKEN_METADATA_OVERRIDE_REJECTED", error: "Override rejected" }), ct: "application/json" },
      { label: "non-JSON 403 HTML", status: 403, body: "<html><body>403 Forbidden</body></html>", ct: "text/html" }
    ];

    for (const tc of mismatchCases) {
      const env = installMockBrowserEnv();
      try {
        let authCalls = 0;
        let assetCalls = 0;

        env.setFetchHandler(async (url) => {
          if (url === "/api/payments/get-resource-download-url") {
            authCalls += 1;
            return makeJsonResponse(200, {
              success: true,
              downloadUrl: "/api/payments/download-paid-asset?token=MISMATCH_TOK.sig",
              accessType: "paid"
            });
          }
          if (url.startsWith("/api/payments/download-paid-asset")) {
            assetCalls += 1;
            return makeResponse(tc.status, tc.body, { "content-type": tc.ct });
          }
          throw new Error(`Unexpected URL: ${url}`);
        });

        const res = await resourceService.deliverResource(PAID_WORKBOOK_RESOURCE, {
          orderId: "order_s2_3",
          paymentId: "pay_s2_3",
          resourceAccessToken: "GUEST_SECRET_LOCAL_3"
        });

        expectStrictEqual(res.success, false, `${tc.label} must fail`);
        expectStrictEqual(authCalls, 1, `${tc.label} must NOT trigger refresh`);
        expectStrictEqual(assetCalls, 1, `${tc.label} must NOT trigger retry`);
        expectStrictEqual(env.anchors.length, 0, `${tc.label} must NOT trigger download anchor`);
      } finally {
        env.restore();
      }
    }
  });

  // =========================================================================
  // GROUP 3: NO-RETRY CASES & NON-JSON / MALFORMED ERROR HANDLING
  // =========================================================================
  origConsoleLog("\n[Group 3] No-Retry Cases, Malformed JSON, and HTML Error Responses");

  await runTest("3.1 deliverResource authorization endpoint: 401/403, 429, 503 JSON, 503 HTML, 502 HTML, malformed JSON, network throw (zero retries)", async () => {
    const authFailureCases: Array<{
      label: string;
      handler: () => Promise<Response> | Response;
      expectedCategory: string;
    }> = [
      {
        label: "401 entitlement denial",
        handler: () => makeJsonResponse(401, { success: false, error: "Authentication required." }),
        expectedCategory: "entitlement_denied"
      },
      {
        label: "403 entitlement denial",
        handler: () => makeJsonResponse(403, { success: false, code: "MISSING_GUEST_TOKEN", error: "Payment required." }),
        expectedCategory: "entitlement_denied"
      },
      {
        label: "429 rate limited",
        handler: () => makeJsonResponse(429, { success: false, code: "RATE_LIMIT_EXCEEDED", error: "Too many requests." }, { "retry-after": "60" }),
        expectedCategory: "rate_limited"
      },
      {
        label: "503 JSON server unavailable",
        handler: () => makeJsonResponse(503, { success: false, error: "Database unavailable." }),
        expectedCategory: "server_error"
      },
      {
        label: "503 HTML gateway error",
        handler: () => makeResponse(503, "<html><body><h1>503 Service Temporarily Unavailable</h1></body></html>", { "content-type": "text/html" }),
        expectedCategory: "server_error"
      },
      {
        label: "502 HTML proxy error",
        handler: () => makeResponse(502, "<html><body>Bad Gateway</body></html>", { "content-type": "text/html" }),
        expectedCategory: "server_error"
      },
      {
        label: "200 malformed JSON body",
        handler: () => makeResponse(200, "{broken json not valid", { "content-type": "application/json" }),
        expectedCategory: "server_error"
      },
      {
        label: "network failure throw",
        handler: () => {
          throw new TypeError("Failed to fetch");
        },
        expectedCategory: "network_error"
      }
    ];

    for (const tc of authFailureCases) {
      const env = installMockBrowserEnv();
      try {
        let calls = 0;
        env.setFetchHandler(async () => {
          calls += 1;
          return tc.handler();
        });

        const res = await resourceService.deliverResource(PAID_WORKBOOK_RESOURCE, {
          orderId: "order_s3_1",
          paymentId: "pay_s3_1"
        });

        expectStrictEqual(res.success, false, `${tc.label}: must return success=false`);
        expectStrictEqual(res.errorCategory, tc.expectedCategory, `${tc.label}: unexpected category`);
        expectStrictEqual(calls, 1, `${tc.label}: must NOT retry`);
        expectOk(typeof res.error === "string" && res.error.length > 0, `${tc.label}: must return readable error`);
        expectStrictEqual(env.anchors.length, 0);
      } finally {
        env.restore();
      }
    }
  });

  await runTest("3.2 deliverResource asset download step: 429, 503, 404, HTML 200, network failure NEVER retry (Storage & local)", async () => {
    const downloadCases: Array<{
      label: string;
      downloadUrl: string;
      downloadHandler: () => Promise<Response> | Response;
      expectedCategory: string;
    }> = [
      {
        label: "Storage 429",
        downloadUrl: "https://storage.example.test/storage/v1/object/sign/paid-resources/w.pdf?token=T1",
        downloadHandler: () => makeJsonResponse(429, { error: "Too many requests" }),
        expectedCategory: "rate_limited"
      },
      {
        label: "Storage 503 HTML",
        downloadUrl: "https://storage.example.test/storage/v1/object/sign/paid-resources/w.pdf?token=T2",
        downloadHandler: () => makeResponse(503, "<html>503 Upstream Error</html>", { "content-type": "text/html" }),
        expectedCategory: "server_error"
      },
      {
        label: "Storage 404",
        downloadUrl: "https://storage.example.test/storage/v1/object/sign/paid-resources/w.pdf?token=T3",
        downloadHandler: () => makeJsonResponse(404, { error: "not_found", message: "Object not found" }),
        expectedCategory: "download_failed"
      },
      {
        label: "Storage HTML 200",
        downloadUrl: "https://storage.example.test/storage/v1/object/sign/paid-resources/w.pdf?token=T4",
        downloadHandler: () => makeResponse(200, "<html><body>SPA fallback</body></html>", { "content-type": "text/html" }),
        expectedCategory: "download_failed"
      },
      {
        label: "Storage network throw",
        downloadUrl: "https://storage.example.test/storage/v1/object/sign/paid-resources/w.pdf?token=T5",
        downloadHandler: () => {
          throw new TypeError("Failed to fetch");
        },
        expectedCategory: "network_error"
      },
      {
        label: "Local 429",
        downloadUrl: "/api/payments/download-paid-asset?token=L1.sig",
        downloadHandler: () => makeJsonResponse(429, { success: false, code: "RATE_LIMIT_EXCEEDED", error: "Rate limited" }),
        expectedCategory: "rate_limited"
      },
      {
        label: "Local 503 HTML",
        downloadUrl: "/api/payments/download-paid-asset?token=L2.sig",
        downloadHandler: () => makeResponse(503, "<html>503</html>", { "content-type": "text/html" }),
        expectedCategory: "server_error"
      },
      {
        label: "Local 404",
        downloadUrl: "/api/payments/download-paid-asset?token=L3.sig",
        downloadHandler: () => makeJsonResponse(404, { success: false, code: "PROTECTED_ASSET_UNAVAILABLE", error: "Not found" }),
        expectedCategory: "download_failed"
      },
      {
        label: "Local network throw",
        downloadUrl: "/api/payments/download-paid-asset?token=L4.sig",
        downloadHandler: () => {
          throw new TypeError("Network offline");
        },
        expectedCategory: "network_error"
      }
    ];

    for (const tc of downloadCases) {
      const env = installMockBrowserEnv();
      try {
        let authCalls = 0;
        let dlCalls = 0;

        env.setFetchHandler(async (url) => {
          if (url === "/api/payments/get-resource-download-url") {
            authCalls += 1;
            return makeJsonResponse(200, { success: true, downloadUrl: tc.downloadUrl, accessType: "paid" });
          }
          dlCalls += 1;
          return tc.downloadHandler();
        });

        const res = await resourceService.deliverResource(PAID_WORKBOOK_RESOURCE, {
          orderId: "order_s3_2",
          paymentId: "pay_s3_2",
          resourceAccessToken: "GUEST_SECRET_S3"
        });

        expectStrictEqual(res.success, false, `${tc.label}: must fail`);
        expectStrictEqual(res.errorCategory, tc.expectedCategory, `${tc.label}: category mismatch`);
        expectStrictEqual(authCalls, 1, `${tc.label}: must NOT refresh`);
        expectStrictEqual(dlCalls, 1, `${tc.label}: must NOT retry download`);
        expectStrictEqual(env.anchors.length, 0, `${tc.label}: must NOT trigger anchor or fallback PDF`);
      } finally {
        env.restore();
      }
    }
  });

  await runTest("3.3 fetchBundleFiles safely classifies 401/403, 429, 503 HTML, malformed JSON, empty body, and network failures", async () => {
    const cases: Array<{
      label: string;
      handler: () => Promise<Response> | Response;
      expectedCategory: string;
      expectedRetryAfter?: number;
    }> = [
      {
        label: "403 entitlement denial",
        handler: () => makeJsonResponse(403, { success: false, authorized: false, code: "MISSING_GUEST_TOKEN", error: "Payment required." }),
        expectedCategory: "entitlement_denied"
      },
      {
        label: "429 rate limited with Retry-After header",
        handler: () => makeJsonResponse(429, { success: false, code: "RATE_LIMIT_EXCEEDED", error: "Slow down" }, { "retry-after": "120" }),
        expectedCategory: "rate_limited",
        expectedRetryAfter: 120
      },
      {
        label: "503 HTML proxy error",
        handler: () => makeResponse(503, "<html><body>503 Service Unavailable</body></html>", { "content-type": "text/html" }),
        expectedCategory: "server_error"
      },
      {
        label: "500 malformed JSON",
        handler: () => makeResponse(500, "{not-json", { "content-type": "application/json" }),
        expectedCategory: "server_error"
      },
      {
        label: "200 empty body",
        handler: () => makeResponse(200, "", { "content-type": "application/json" }),
        expectedCategory: "server_error"
      },
      {
        label: "404 not found",
        handler: () => makeJsonResponse(404, { success: false, error: "Not found" }),
        expectedCategory: "download_failed"
      },
      {
        label: "network throw",
        handler: () => {
          throw new TypeError("Failed to fetch");
        },
        expectedCategory: "network_error"
      }
    ];

    for (const tc of cases) {
      const env = installMockBrowserEnv();
      try {
        let calls = 0;
        env.setFetchHandler(async () => {
          calls += 1;
          return tc.handler();
        });

        const res = await resourceService.fetchBundleFiles(BUNDLE_ID, {
          orderId: "order_b3",
          paymentId: "pay_b3"
        });

        expectStrictEqual(res.success, false, tc.label);
        expectStrictEqual(res.authorized, false, tc.label);
        expectStrictEqual(res.errorCategory, tc.expectedCategory, tc.label);
        expectStrictEqual(calls, 1, `${tc.label}: fetchBundleFiles must not auto-retry`);
        if (tc.expectedRetryAfter !== undefined) {
          expectStrictEqual(res.retryAfterSeconds, tc.expectedRetryAfter, tc.label);
        }
      } finally {
        env.restore();
      }
    }
  });

  // =========================================================================
  // GROUP 4: FILENAME SAFETY
  // =========================================================================
  origConsoleLog("\n[Group 4] Filename Safety (extractSafeDownloadFilename + End-to-End Local Anchor)");

  await runTest("4.1 extractSafeDownloadFilename honors safe Content-Disposition (quoted, unquoted, RFC 5987) and strips tokens/fragments", () => {
    expectStrictEqual(
      extractSafeDownloadFilename(
        'attachment; filename="meta-ads-campaign-planner-workbook.pdf"',
        "/api/payments/download-paid-asset?token=eyJhbGciOi.sig#section",
        "fallback.pdf"
      ),
      "meta-ads-campaign-planner-workbook.pdf"
    );

    expectStrictEqual(
      extractSafeDownloadFilename(
        "attachment; filename*=UTF-8''Ad%20Budget%20Calculator.xlsx",
        "/api/payments/download-paid-asset?token=eyJ.sig",
        "fallback.xlsx"
      ),
      "Ad Budget Calculator.xlsx"
    );

    expectStrictEqual(
      extractSafeDownloadFilename(
        "attachment; filename=pre-launch-checklist.pdf",
        null,
        "fallback.pdf"
      ),
      "pre-launch-checklist.pdf"
    );

    // Rejects API endpoint name and strips ?token=... / #frag when Content-Disposition is absent
    expectStrictEqual(
      extractSafeDownloadFilename(
        null,
        "/api/payments/download-paid-asset?token=eyJsecret.sig#frag",
        "meta-ads-campaign-planner-workbook.pdf"
      ),
      "meta-ads-campaign-planner-workbook.pdf"
    );

    expectStrictEqual(
      extractSafeDownloadFilename(
        'attachment; filename="download-paid-asset?token=eyJsecret.sig"',
        null,
        "safe-workbook.pdf"
      ),
      "safe-workbook.pdf"
    );

    expectStrictEqual(
      extractSafeDownloadFilename(
        'attachment; filename="token=leaked.pdf"',
        null,
        "safe-workbook.pdf"
      ),
      "safe-workbook.pdf"
    );

    expectStrictEqual(
      extractSafeDownloadFilename(
        'attachment; filename="../etc/passwd"',
        "/api/payments/bundle-files?bundleId=123",
        "safe-workbook.pdf"
      ),
      "safe-workbook.pdf"
    );

    // Preserves clean static path filename while stripping query & fragment
    expectStrictEqual(
      extractSafeDownloadFilename(
        null,
        "/downloads/META-ADS-GUIDE.pdf?v=2#page=3",
        "fallback.pdf"
      ),
      "META-ADS-GUIDE.pdf"
    );
  });

  await runTest("4.2 End-to-end deliverResource on local protected asset WITHOUT Content-Disposition never puts token in <a download>", async () => {
    const env = installMockBrowserEnv();
    try {
      const localEndpoint = "/api/payments/download-paid-asset";
      const localToken = "SENSITIVE_LOCAL_TOKEN_XYZ.sig999";
      env.setFetchHandler(async (url, init) => {
        if (url === "/api/payments/get-resource-download-url") {
          return makeJsonResponse(200, {
            success: true,
            downloadUrl: localEndpoint,
            assetAccessToken: localToken,
            accessType: "paid"
          });
        }
        if (url === localEndpoint) {
          const headers = (init?.headers || {}) as Record<string, string>;
          expectStrictEqual(headers.Authorization || headers.authorization, `Bearer ${localToken}`);
          return makeResponse(200, "%PDF-1.7-no-cd-header", { "content-type": "application/pdf" });
        }
        throw new Error(`Unexpected URL: ${url}`);
      });

      const res = await resourceService.deliverResource(PAID_WORKBOOK_RESOURCE, {
        orderId: "order_s4_2",
        paymentId: "pay_s4_2",
        resourceAccessToken: "GUEST_TOK_S4"
      });

      expectStrictEqual(res.success, true);
      expectStrictEqual(env.anchors.length, 1);
      expectStrictEqual(env.anchors[0].download, "meta-ads-campaign-planner-workbook.pdf");
      expectOk(!env.anchors[0].download.includes("SENSITIVE_LOCAL_TOKEN_XYZ"));
      expectOk(!env.anchors[0].download.includes("download-paid-asset"));
      expectOk(!env.anchors[0].download.includes("?"));
      expectOk(!env.anchors[0].download.includes("#"));
    } finally {
      env.restore();
    }
  });

  // =========================================================================
  // GROUP 5: DIAGNOSTIC REDACTION
  // =========================================================================
  origConsoleLog("\n[Group 5] Console Diagnostic & Log Redaction");

  await runTest("5.1 redactSensitiveUrl and redactSensitiveText strip signed URLs, bearer tokens, access tokens, and query strings", () => {
    const signedStorage =
      "https://proj.supabase.co/storage/v1/object/sign/paid-resources/wb.pdf?token=SECRET_SIGNED_JWT_987654";
    const redactedStorage = redactSensitiveUrl(signedStorage);
    expectStrictEqual(redactedStorage, "https://proj.supabase.co/storage/v1/object/sign/[redacted]");
    expectOk(!redactedStorage.includes("SECRET_SIGNED_JWT_987654"));

    const localAsset = "/api/payments/download-paid-asset?token=SECRET_LOCAL_HMAC_123456.sig";
    const redactedLocal = redactSensitiveUrl(localAsset);
    expectStrictEqual(redactedLocal, "/api/payments/download-paid-asset?[redacted]");
    expectOk(!redactedLocal.includes("SECRET_LOCAL_HMAC_123456"));

    const credUrl = "https://admin:supersecret@files.example.test/a/b.pdf?sig=XYZ_SIG#top";
    const redactedCred = redactSensitiveUrl(credUrl);
    expectOk(!redactedCred.includes("supersecret"), "Embedded credentials must be removed");
    expectOk(!redactedCred.includes("XYZ_SIG"), "Query signature must be removed");
    expectOk(!redactedCred.includes("#top"), "Fragment must be removed");

    const rawText =
      "Failed with Authorization: Bearer MY_SUPER_SECRET_JWT_ABC and resourceAccessToken=GUEST_SECRET_999 at https://proj.supabase.co/storage/v1/object/sign/paid-resources/f.pdf?token=SIGNED_TOK_777";
    const redactedText = redactSensitiveText(rawText);
    expectOk(!redactedText.includes("MY_SUPER_SECRET_JWT_ABC"), "Bearer token must be redacted");
    expectOk(!redactedText.includes("GUEST_SECRET_999"), "resourceAccessToken must be redacted");
    expectOk(!redactedText.includes("SIGNED_TOK_777"), "Signed URL token must be redacted");
    expectOk(redactedText.includes("Bearer [redacted]"));
  });

  await runTest("5.2 Live console output during deliverResource (success + failure) contains ZERO signed URLs or tokens", async () => {
    const env = installMockBrowserEnv();
    try {
      const signedJwt = "ULTRA_SECRET_SIGNED_STORAGE_JWT_ALPHA";
      const localTok = "ULTRA_SECRET_LOCAL_ASSET_TOKEN_BETA";
      const guestTok = "ULTRA_SECRET_GUEST_ENTITLEMENT_GAMMA";

      // Run 1: Signed Storage success
      env.setFetchHandler(async (url) => {
        if (url === "/api/payments/get-resource-download-url") {
          return makeJsonResponse(200, {
            success: true,
            downloadUrl: `https://storage.example.test/storage/v1/object/sign/paid-resources/wb.pdf?token=${signedJwt}`,
            accessType: "paid"
          });
        }
        return makeResponse(200, "%PDF-1.7-ok", { "content-type": "application/pdf" });
      });

      const okRes = await resourceService.deliverResource(PAID_WORKBOOK_RESOURCE, {
        orderId: "order_s5_1",
        paymentId: "pay_s5_1",
        resourceAccessToken: guestTok
      });
      expectStrictEqual(okRes.success, true);

      // Run 2: Local asset 404 failure (triggers diagnostic errorMessage containing asset path)
      env.setFetchHandler(async (url) => {
        if (url === "/api/payments/get-resource-download-url") {
          return makeJsonResponse(200, {
            success: true,
            downloadUrl: `/api/payments/download-paid-asset?token=${localTok}`,
            accessType: "paid"
          });
        }
        return makeJsonResponse(404, { success: false, code: "PROTECTED_ASSET_UNAVAILABLE", error: "Missing" });
      });

      const failRes = await resourceService.deliverResource(PAID_WORKBOOK_RESOURCE, {
        orderId: "order_s5_2",
        paymentId: "pay_s5_2",
        resourceAccessToken: guestTok
      });
      expectStrictEqual(failRes.success, false);

      expectOk(env.consoleEntries.length >= 2, "Diagnostics should have been recorded");
      const allLogs = env.consoleEntries.map((e) => e.text).join("\n");
      expectOk(!allLogs.includes(signedJwt), "Signed Storage JWT leaked in console logs!");
      expectOk(!allLogs.includes(localTok), "Local asset token leaked in console logs!");
      expectOk(!allLogs.includes(guestTok), "Guest entitlement token leaked in console logs!");
      expectOk(allLogs.includes("[redacted]"), "Redaction markers must appear in diagnostic logs");
    } finally {
      env.restore();
    }
  });

  // =========================================================================
  // GROUP 6: BUNDLE ACCESS PAGE BEHAVIOR (Real React Component Execution)
  // =========================================================================
  origConsoleLog("\n[Group 6] BundleAccessPage Real Component Behavior");

  function makeMockAppContext(notifications: Array<{ message: string; type: string }>) {
    return {
      resources: [],
      hasPurchasedResource: () => false,
      purchaseResource: async () => {},
      notify: (message: string, type = "info") => {
        notifications.push({ message, type });
      },
      currentUser: null,
      userProfile: null
    };
  }

  await runTest("6.1 BundleAccessPage requests a FRESH authorized URL on download click (ignoring mount-cached URL) and preserves guest token", async () => {
    const guestToken = "GUEST_BUNDLE_ENTITLEMENT_SECRET_01";
    const env = installMockBrowserEnv(
      `/resources/bundle/meta-ads-campaign-planner-bundle?orderId=order_b61&paymentId=pay_b61&resourceAccessToken=${guestToken}`
    );
    const notifications: Array<{ message: string; type: string }> = [];
    let mounted: ReturnType<typeof mountFunctionComponent> | null = null;

    try {
      let bundleFetchCount = 0;
      const requestedStorageUrls: string[] = [];

      env.setFetchHandler(async (url) => {
        if (url.startsWith("/api/payments/bundle-files")) {
          bundleFetchCount += 1;
          return makeJsonResponse(200, makeBundleFilesPayload(`SIGNED_CALL_${bundleFetchCount}`));
        }
        if (url.startsWith("https://storage.example.test/")) {
          requestedStorageUrls.push(url);
          return makeResponse(200, "%PDF-1.7-bundle-workbook", {
            "content-type": "application/pdf",
            "content-disposition": 'attachment; filename="meta-ads-campaign-planner-workbook.pdf"'
          });
        }
        throw new Error(`Unexpected URL: ${url}`);
      });

      mounted = mountFunctionComponent(
        BundleAccessPage,
        { navigate: () => {} },
        makeMockAppContext(notifications)
      );
      await mounted.flush();

      // Token must be scrubbed from browser URL
      expectOk(!((globalThis as any).window.location.search as string).includes(guestToken));
      expectStrictEqual(bundleFetchCount, 1, "Initial mount loads bundle files once");
      expectOk(mounted.getText().includes("Access Authorized & Verified"));

      const downloadBtns = mounted.findButtonsByText("Download Asset");
      expectStrictEqual(downloadBtns.length, 2, "Must render Download Asset buttons");

      // User clicks Download Asset -> MUST fetch fresh bundle URLs (SIGNED_CALL_2), NOT reuse SIGNED_CALL_1
      await downloadBtns[0].props.onClick();
      await mounted.flush();

      expectStrictEqual(bundleFetchCount, 2, "Download click must request a fresh authorized URL");
      expectStrictEqual(requestedStorageUrls.length, 1);
      expectOk(
        requestedStorageUrls[0].includes("SIGNED_CALL_2_wb"),
        "Download must fetch the freshly minted URL, not the stale mount URL"
      );
      expectOk(
        !requestedStorageUrls[0].includes("SIGNED_CALL_1_wb"),
        "Must NOT reuse mount-time signed URL"
      );

      // Verify guest token was forwarded on BOTH mount and download click
      const bundleApiCalls = env.fetchCalls.filter((c) => c.url.startsWith("/api/payments/bundle-files"));
      expectStrictEqual(bundleApiCalls.length, 2);
      expectStrictEqual(bundleApiCalls[0].headers["x-resource-access-token"], guestToken);
      expectStrictEqual(bundleApiCalls[1].headers["x-resource-access-token"], guestToken);

      expectStrictEqual(env.anchors.length, 1);
      expectStrictEqual(env.anchors[0].download, "meta-ads-campaign-planner-workbook.pdf");
      expectOk(notifications.some((n) => n.type === "success"), "Successful download notifies success");
    } finally {
      mounted?.unmount();
      env.restore();
    }
  });

  await runTest("6.2 BundleAccessPage refreshes expired signed URL AT MOST ONCE on download (succeeds on retry; stops on 2nd expiry with NO success message)", async () => {
    const env = installMockBrowserEnv(
      "/resources/bundle/meta-ads-campaign-planner-bundle?orderId=order_b62&paymentId=pay_b62"
    );
    saveStoredGuestResourceToken({
      resourceId: BUNDLE_ID,
      orderId: "order_b62",
      paymentId: "pay_b62",
      token: "GUEST_TOK_B62"
    });
    const notifications: Array<{ message: string; type: string }> = [];
    let mounted: ReturnType<typeof mountFunctionComponent> | null = null;

    try {
      let bundleCalls = 0;
      let storageCalls = 0;
      let mode: "recover-on-retry" | "double-expire" = "recover-on-retry";

      env.setFetchHandler(async (url) => {
        if (url.startsWith("/api/payments/bundle-files")) {
          bundleCalls += 1;
          return makeJsonResponse(200, makeBundleFilesPayload(`TOK_${bundleCalls}`));
        }
        if (url.startsWith("https://storage.example.test/")) {
          storageCalls += 1;
          if (mode === "recover-on-retry") {
            if (storageCalls === 1) {
              return makeJsonResponse(400, {
                statusCode: "400",
                error: "InvalidJWT",
                message: "exp claim timestamp check failed"
              });
            }
            return makeResponse(200, "%PDF-1.7-recovered", { "content-type": "application/pdf" });
          }
          // double-expire mode: every signed URL returns 400 InvalidJWT
          return makeJsonResponse(400, {
            statusCode: "400",
            error: "InvalidJWT",
            message: "exp claim timestamp check failed"
          });
        }
        throw new Error(`Unexpected URL: ${url}`);
      });

      mounted = mountFunctionComponent(
        BundleAccessPage,
        { navigate: () => {} },
        makeMockAppContext(notifications)
      );
      await mounted.flush();
      expectStrictEqual(bundleCalls, 1);

      // Part A: First click -> expired URL #1 -> refreshes ONCE -> URL #2 succeeds
      let btns = mounted.findButtonsByText("Download Asset");
      await btns[0].props.onClick();
      await mounted.flush();

      expectStrictEqual(bundleCalls, 3, "Mount (1) + click fresh (2) + 1 expiry refresh (3)");
      expectStrictEqual(storageCalls, 2, "Expired attempt (1) + single retry (2)");
      expectStrictEqual(notifications.filter((n) => n.type === "success").length, 1);

      // Part B: Second click in double-expire mode -> stops after 1 refresh, ZERO success toast, ZERO broken anchor
      mode = "double-expire";
      const beforeBundle = bundleCalls;
      const beforeStorage = storageCalls;
      const beforeAnchors = env.anchors.length;
      notifications.length = 0;

      btns = mounted.findButtonsByText("Download Asset");
      await btns[0].props.onClick();
      await mounted.flush();

      expectStrictEqual(bundleCalls - beforeBundle, 2, "Click fresh + max 1 expiry refresh = 2 bundle calls");
      expectStrictEqual(storageCalls - beforeStorage, 2, "Initial expired + max 1 retry = 2 storage calls");
      expectStrictEqual(env.anchors.length, beforeAnchors, "Must NOT open broken anchor on expired failure");
      expectStrictEqual(notifications.filter((n) => n.type === "success").length, 0, "Failed download MUST NEVER notify success");
      expectStrictEqual(notifications.filter((n) => n.type === "error").length, 1, "Must notify truthful error");
      expectOk(mounted.getText().includes("expired"), "Inline error banner must show truthful expiry message");
      expectOk(!mounted.getText().includes("Payment Required"), "Expired download link must NOT show paywall");
    } finally {
      mounted?.unmount();
      env.restore();
    }
  });

  await runTest("6.3 BundleAccessPage failed downloads (Storage 500, 429, HTML 200, network throw) NEVER show success or paywall", async () => {
    const failureModes: Array<{ label: string; storageFn: () => Response | never }> = [
      { label: "Storage 500", storageFn: () => makeJsonResponse(500, { error: "Internal Server Error" }) },
      { label: "Storage 429", storageFn: () => makeJsonResponse(429, { error: "Too Many Requests" }) },
      { label: "Storage HTML 200", storageFn: () => makeResponse(200, "<html>Error</html>", { "content-type": "text/html" }) },
      {
        label: "Storage network throw",
        storageFn: () => {
          throw new TypeError("Failed to fetch");
        }
      }
    ];

    for (const fm of failureModes) {
      const env = installMockBrowserEnv(
        "/resources/bundle/meta-ads-campaign-planner-bundle?orderId=order_b63&paymentId=pay_b63"
      );
      saveStoredGuestResourceToken({
        resourceId: BUNDLE_ID,
        orderId: "order_b63",
        paymentId: "pay_b63",
        token: "GUEST_TOK_B63"
      });
      const notifications: Array<{ message: string; type: string }> = [];
      let mounted: ReturnType<typeof mountFunctionComponent> | null = null;

      try {
        let bundleCalls = 0;
        let storageCalls = 0;
        env.setFetchHandler(async (url) => {
          if (url.startsWith("/api/payments/bundle-files")) {
            bundleCalls += 1;
            return makeJsonResponse(200, makeBundleFilesPayload(`F63_${bundleCalls}`));
          }
          storageCalls += 1;
          return fm.storageFn();
        });

        mounted = mountFunctionComponent(
          BundleAccessPage,
          { navigate: () => {} },
          makeMockAppContext(notifications)
        );
        await mounted.flush();

        const btns = mounted.findButtonsByText("Download Asset");
        await btns[0].props.onClick();
        await mounted.flush();

        expectStrictEqual(bundleCalls, 2, `${fm.label}: mount (1) + click fresh (1), NO extra retry`);
        expectStrictEqual(storageCalls, 1, `${fm.label}: must NOT retry non-expiry storage failure`);
        expectStrictEqual(env.anchors.length, 0, `${fm.label}: must NOT trigger broken anchor`);
        expectStrictEqual(notifications.filter((n) => n.type === "success").length, 0, `${fm.label}: must NEVER notify success`);
        expectStrictEqual(notifications.filter((n) => n.type === "error").length, 1, `${fm.label}: must notify error`);
        expectOk(!mounted.getText().includes("Payment Required"), `${fm.label}: must NOT show paywall`);
      } finally {
        mounted?.unmount();
        env.restore();
      }
    }
  });

  await runTest("6.4 BundleAccessPage HTTP 429, HTTP 503 (JSON & HTML), and network failures do NOT display purchase-required paywall (and Retry recovers)", async () => {
    const transientCases: Array<{
      label: string;
      firstResponse: () => Response | never;
      expectedHeading: string;
    }> = [
      {
        label: "HTTP 429 rate limited",
        firstResponse: () => makeJsonResponse(429, { success: false, code: "RATE_LIMIT_EXCEEDED", error: "Rate limit exceeded." }),
        expectedHeading: "Too Many Requests"
      },
      {
        label: "HTTP 503 JSON unavailable",
        firstResponse: () => makeJsonResponse(503, { success: false, error: "Service unavailable." }),
        expectedHeading: "Download Service Temporarily Unavailable"
      },
      {
        label: "HTTP 503 HTML proxy error",
        firstResponse: () => makeResponse(503, "<html><body>503 Service Unavailable</body></html>", { "content-type": "text/html" }),
        expectedHeading: "Download Service Temporarily Unavailable"
      },
      {
        label: "Network failure",
        firstResponse: () => {
          throw new TypeError("Failed to fetch");
        },
        expectedHeading: "Connection Issue While Verifying Access"
      }
    ];

    for (const tc of transientCases) {
      const env = installMockBrowserEnv(
        "/resources/bundle/meta-ads-campaign-planner-bundle?orderId=order_b64&paymentId=pay_b64"
      );
      const notifications: Array<{ message: string; type: string }> = [];
      let mounted: ReturnType<typeof mountFunctionComponent> | null = null;

      try {
        let attempt = 0;
        env.setFetchHandler(async (url) => {
          if (url.startsWith("/api/payments/bundle-files")) {
            attempt += 1;
            if (attempt === 1) {
              return tc.firstResponse();
            }
            return makeJsonResponse(200, makeBundleFilesPayload("RECOVERED_TOK"));
          }
          throw new Error(`Unexpected URL: ${url}`);
        });

        mounted = mountFunctionComponent(
          BundleAccessPage,
          { navigate: () => {} },
          makeMockAppContext(notifications)
        );
        await mounted.flush();

        const text = mounted.getText();
        expectOk(text.includes("Temporary Verification Issue"), `${tc.label}: missing temporary badge`);
        expectOk(text.includes(tc.expectedHeading), `${tc.label}: missing expected heading`);
        expectOk(!text.includes("Purchase Required"), `${tc.label}: MUST NOT show Purchase Required badge`);
        expectOk(!text.includes("Payment Required to Access Bundle Deliverables"), `${tc.label}: MUST NOT show Payment Required paywall`);
        expectOk(!text.includes("Unlock Complete Bundle (₹299)"), `${tc.label}: MUST NOT show ₹299 checkout CTA`);

        // Clicking Retry Verification recovers to authorized deliverables without requiring repayment
        const retryBtns = mounted.findButtonsByText("Retry Verification");
        expectStrictEqual(retryBtns.length, 1, `${tc.label}: must render Retry Verification button`);
        await retryBtns[0].props.onClick();
        await mounted.flush();

        const recoveredText = mounted.getText();
        expectOk(recoveredText.includes("Access Authorized & Verified"), `${tc.label}: Retry should restore authorized access`);
        expectStrictEqual(mounted.findButtonsByText("Download Asset").length, 2);
      } finally {
        mounted?.unmount();
        env.restore();
      }
    }
  });

  await runTest("6.5 BundleAccessPage HTTP 403 entitlement denial continues to display purchase-required access restriction", async () => {
    const env = installMockBrowserEnv("/resources/bundle/meta-ads-campaign-planner-bundle");
    const notifications: Array<{ message: string; type: string }> = [];
    let mounted: ReturnType<typeof mountFunctionComponent> | null = null;

    try {
      env.setFetchHandler(async (url) => {
        if (url.startsWith("/api/payments/bundle-files")) {
          return makeJsonResponse(403, {
            success: false,
            authorized: false,
            error: "Forbidden: Verified purchase required."
          });
        }
        throw new Error(`Unexpected URL: ${url}`);
      });

      mounted = mountFunctionComponent(
        BundleAccessPage,
        { navigate: () => {} },
        makeMockAppContext(notifications)
      );
      await mounted.flush();

      const text = mounted.getText();
      expectOk(text.includes("Purchase Required"), "403 entitlement denial must display Purchase Required badge");
      expectOk(
        text.includes("Payment Required to Access Bundle Deliverables"),
        "403 entitlement denial must display Payment Required card"
      );
      expectOk(
        text.includes("Unlock Complete Bundle (₹299)"),
        "403 entitlement denial must display purchase CTA"
      );
      expectOk(!text.includes("Temporary Verification Issue"), "403 must not show temporary issue card");
      expectOk(!text.includes("Authorized Deliverables"), "403 must not render deliverables");
    } finally {
      mounted?.unmount();
      env.restore();
    }
  });

  await runTest("6.6 Helper edge checks: safeParseResponseBody, classifyHttpFailure, isExpiredSignedStorageResponse, isExpiredAssetTokenResponse, captureAndScrubBundleAccessUrl", async () => {
    const parsedBroken = await safeParseResponseBody(makeResponse(502, "<html>Bad Gateway</html>", { "content-type": "text/html" }));
    expectStrictEqual(parsedBroken.json, null);
    expectOk(parsedBroken.text.includes("Bad Gateway"));

    expectStrictEqual(classifyHttpFailure(429, null, "pay").errorCategory, "rate_limited");
    expectStrictEqual(classifyHttpFailure(503, null, "pay").errorCategory, "server_error");
    expectStrictEqual(classifyHttpFailure(403, null, "pay").errorCategory, "entitlement_denied");
    expectStrictEqual(classifyHttpFailure(200, null, "pay").errorCategory, "server_error");

    expectStrictEqual(isExpiredSignedStorageResponse(400, { error: "InvalidJWT", message: "exp claim timestamp check failed" }), true);
    expectStrictEqual(isExpiredSignedStorageResponse(403, { message: "Token has expired" }), true);
    expectStrictEqual(isExpiredSignedStorageResponse(403, { error: "AccessDenied" }), false);
    expectStrictEqual(isExpiredSignedStorageResponse(429, { message: "InvalidJWT" }), false);
    expectStrictEqual(isExpiredSignedStorageResponse(503, { message: "InvalidJWT" }), false);
    expectStrictEqual(isExpiredSignedStorageResponse(404, { message: "Not found" }), false);

    expectStrictEqual(isExpiredAssetTokenResponse(403, { code: "INVALID_DOWNLOAD_TOKEN" }), true);
    expectStrictEqual(isExpiredAssetTokenResponse(403, { code: "TOKEN_RESOURCE_MISMATCH" }), false);
    expectStrictEqual(isExpiredAssetTokenResponse(403, { code: "TOKEN_FILE_MISMATCH" }), false);
    expectStrictEqual(isExpiredAssetTokenResponse(403, null), false);
    expectStrictEqual(isExpiredAssetTokenResponse(503, { code: "INVALID_DOWNLOAD_TOKEN" }), false);

    // Ensure captureAndScrubBundleAccessUrl still works cleanly
    const env = installMockBrowserEnv("/resources/bundle/meta-ads-campaign-planner-bundle?orderId=o1&paymentId=p1&resourceAccessToken=tok123");
    try {
      const ref = { current: null as string | null };
      const cap = captureAndScrubBundleAccessUrl(ref);
      expectStrictEqual(cap.orderId, "o1");
      expectStrictEqual(cap.paymentId, "p1");
      expectStrictEqual(cap.capturedToken, "tok123");
      expectStrictEqual(ref.current, "tok123");
      expectOk(!((globalThis as any).window.location.search as string).includes("tok123"));
    } finally {
      env.restore();
    }
  });

  origConsoleLog("\n==================================================================");
  origConsoleLog(
    `STEP 1B FRONTEND DOWNLOAD RELIABILITY SUMMARY: ${testsPassed} passed, ${testsFailed} failed (total ${testsPassed + testsFailed}, ${assertionCount} assertions)`
  );
  origConsoleLog("==================================================================");

  process.exit(testsFailed > 0 ? 1 : 0);
}

main().catch((err) => {
  origConsoleError("Fatal Step 1B test error:", err);
  process.exit(1);
});
