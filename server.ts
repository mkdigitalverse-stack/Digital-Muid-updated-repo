process.env.DISABLE_HMR = "true";
import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { isRazorpayConfigured, isWebhookConfigured } from "./server/razorpay.js";
import { isSupabaseServerConfigured } from "./server/supabaseServer.js";
import { isMailerConfigured } from "./server/mailerService.js";
import { handleRazorpayWebhook } from "./server/paymentWebhook.js";
import paymentRoutes, {
  isAssetTokenSecretConfigured,
  isResourceTokenSecretConfigured,
  isInvoiceTokenSecretConfigured
} from "./server/paymentRoutes.js";
import webEnquiryRoutes from "./server/webEnquiryRoutes.js";
import growthAuditRoutes from "./server/growthAuditRoutes.js";
import authRoutes from "./server/authRoutes.js";
import {
  createResourceRoutes,
  resolveTrustProxyConfig,
  isDownloadRateLimitSecretConfigured
} from "./server/resourceRoutes.js";
import { seoRedirectMiddleware } from "./server/seoRedirects.js";
import { injectSeoIntoHtml } from "./server/htmlSeoInjector.js";
import {
  developmentSafetyMiddleware,
  isProductionEnvironment,
  evaluateDevelopmentSafety
} from "./server/developmentSafetyGate.js";

/**
 * Builds the serialized client environment script for HTML injection.
 * When running in development mode targeting production, sensitive credentials
 * are sanitized to prevent browser forms from mutating production data.
 */
function buildClientEnvScript(isProd: boolean): string {
  const safety = evaluateDevelopmentSafety();

  let clientSupabaseUrl = process.env.VITE_SUPABASE_URL || "";
  let clientAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "";
  let clientRazorpayKey = process.env.VITE_RAZORPAY_KEY_ID || "";

  if (!isProd && safety.isProductionSupabase) {
    clientSupabaseUrl = "";
    clientAnonKey = "";
  }

  if (!isProd && safety.isLiveRazorpay) {
    clientRazorpayKey = "";
  }

  const clientEnv = {
    VITE_SUPABASE_URL: clientSupabaseUrl,
    VITE_SUPABASE_ANON_KEY: clientAnonKey,
    VITE_RAZORPAY_KEY_ID: clientRazorpayKey,
    APP_ENV: isProd ? "production" : "development",
    SAFETY_GUARD_ACTIVE: !isProd,
    DEV_MUTATIONS_BLOCKED: !isProd && (safety.isProductionSupabase || safety.isLiveRazorpay),
  };

  const serializedEnv = JSON.stringify(clientEnv).replace(/</g, "\\u003c");
  return `<script>window.__ENV__ = Object.assign(window.__ENV__ || {}, ${serializedEnv});</script>`;
}

export const PROTECTED_ASSET_IDENTIFIERS = [
  "meta-ads-campaign-planner-workbook",
  "the-ad-budget-break-even-calculator",
  "the-ad-budget-breat-even-calculate",
  "10-high-converting-meta-ads-copy-frameworks",
  "pre-launch-tracking-audit-checklist",
  "meta-ads-campaign-planner-bundle",
] as const;

// Strictly extensionless SPA routes that legitimately contain a resource or bundle slug.
// File extensions (dots), extra nested paths, /downloads/*, and /protected_downloads/* are never matched.
const ALLOWED_PROTECTED_SLUG_SPA_PATTERNS: readonly RegExp[] = [
  /^\/resources\/[a-z0-9-]+$/,
  /^\/resources\/bundle\/[a-z0-9-]+$/,
];

const MAX_PATH_DECODE_ROUNDS = 3;
const CONTROL_CHAR_REGEX = /[\x00-\x1f\x7f]/;
const ENCODED_NULL_OR_BACKSLASH_REGEX = /%(?:00|5c)/i;
const VALID_PERCENT_ENCODED_PAIR_REGEX = /%[0-9a-fA-F]{2}/;
const MALFORMED_PERCENT_REGEX = /%(?![0-9a-fA-F]{2})/;

export interface ProtectedAssetGuardDecision {
  allowed: boolean;
  statusCode?: 400 | 403;
  code?: string;
  error?: string;
  message?: string;
  normalizedPath?: string;
}

function hasTraversalSegment(candidatePath: string): boolean {
  const segments = candidatePath.split("/");
  return segments.some((segment) => segment === "..");
}

function setNoStoreSecurityHeaders(res: express.Response): void {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
}

/**
 * Evaluates whether an incoming request URL is permitted through the protected asset guard.
 *
 * Rules:
 * - Inspects pathname only (never query string or fragment), so SPA query params like
 *   `/resources?slug=<protected-slug>` are never falsely blocked.
 * - Rejects malformed percent-encoding, unresolved multi-layer encoding, null bytes,
 *   control characters, backslashes, and `..` path traversal segments (fail-closed).
 * - Blocks direct access to `/protected_downloads` (at any depth) and any path referencing
 *   protected asset identifiers unless it matches an explicitly allowed, extensionless SPA route
 *   without percent-encoded obfuscation.
 */
export function evaluateProtectedAssetRequest(rawUrlInput: string): ProtectedAssetGuardDecision {
  const rawUrl = typeof rawUrlInput === "string" && rawUrlInput.length > 0 ? rawUrlInput : "/";
  const queryOrHashIndex = rawUrl.search(/[?#]/);
  const rawPathname = (queryOrHashIndex === -1 ? rawUrl : rawUrl.slice(0, queryOrHashIndex)) || "/";

  // 1. Immediate raw checks for null bytes, control chars, backslashes, and traversal
  if (
    rawPathname.includes("\0") ||
    CONTROL_CHAR_REGEX.test(rawPathname) ||
    ENCODED_NULL_OR_BACKSLASH_REGEX.test(rawPathname) ||
    rawPathname.includes("\\")
  ) {
    return {
      allowed: false,
      statusCode: 400,
      code: "INVALID_PATH_CHARACTERS",
      error: "Bad Request",
      message: "Request path contains prohibited characters or escape sequences.",
    };
  }

  if (hasTraversalSegment(rawPathname)) {
    return {
      allowed: false,
      statusCode: 400,
      code: "PATH_TRAVERSAL_REJECTED",
      error: "Bad Request",
      message: "Path traversal segments are strictly prohibited.",
    };
  }

  // 2. Bounded iterative percent-decoding (rejects malformed or unresolved repeated encodings)
  let decodedPath = rawPathname;
  let decodeRounds = 0;

  for (let round = 0; round < MAX_PATH_DECODE_ROUNDS; round++) {
    if (!decodedPath.includes("%")) {
      break;
    }

    if (MALFORMED_PERCENT_REGEX.test(decodedPath)) {
      return {
        allowed: false,
        statusCode: 400,
        code: "MALFORMED_URL_ENCODING",
        error: "Bad Request",
        message: "Malformed URL percent-encoding is not permitted.",
      };
    }

    let nextDecoded: string;
    try {
      nextDecoded = decodeURIComponent(decodedPath);
    } catch {
      return {
        allowed: false,
        statusCode: 400,
        code: "MALFORMED_URL_ENCODING",
        error: "Bad Request",
        message: "Malformed URL percent-encoding is not permitted.",
      };
    }

    decodeRounds += 1;

    if (
      nextDecoded.includes("\0") ||
      CONTROL_CHAR_REGEX.test(nextDecoded) ||
      nextDecoded.includes("\\")
    ) {
      return {
        allowed: false,
        statusCode: 400,
        code: "INVALID_DECODED_PATH",
        error: "Bad Request",
        message: "Decoded request path contains prohibited characters.",
      };
    }

    if (hasTraversalSegment(nextDecoded)) {
      return {
        allowed: false,
        statusCode: 400,
        code: "PATH_TRAVERSAL_REJECTED",
        error: "Bad Request",
        message: "Path traversal segments are strictly prohibited.",
      };
    }

    if (nextDecoded === decodedPath) {
      break;
    }
    decodedPath = nextDecoded;
  }

  // Fail closed if unresolved or malformed percent-encoding still remains after bounded decoding
  if (
    decodedPath.includes("%") &&
    (VALID_PERCENT_ENCODED_PAIR_REGEX.test(decodedPath) || MALFORMED_PERCENT_REGEX.test(decodedPath))
  ) {
    return {
      allowed: false,
      statusCode: 400,
      code: "UNRESOLVED_URL_ENCODING",
      error: "Bad Request",
      message: "Repeated or unresolved URL encoding is not permitted.",
    };
  }

  // 3. Normalize POSIX path (collapses duplicate slashes and `.` segments)
  const posixNormalized = path.posix.normalize(decodedPath.startsWith("/") ? decodedPath : `/${decodedPath}`);
  const normalizedPath = posixNormalized.length > 1 ? posixNormalized.replace(/\/+$/, "") : posixNormalized;
  const lowerPath = normalizedPath.toLowerCase();

  // Exempt legitimate /api/* routes (already validated above against traversal/encoding attacks)
  if (lowerPath === "/api" || lowerPath.startsWith("/api/")) {
    return { allowed: true, normalizedPath };
  }

  // 4. Always block any direct access to protected_downloads directory
  const lowerSegments = lowerPath.split("/").filter(Boolean);
  if (lowerSegments.includes("protected_downloads")) {
    return {
      allowed: false,
      statusCode: 403,
      code: "PROTECTED_ASSET_FORBIDDEN",
      error: "Forbidden",
      message: "Direct access to paid digital assets is strictly prohibited. A confirmed, verified purchase is required.",
      normalizedPath,
    };
  }

  // 5. Block paths matching protected asset identifiers unless they are an explicitly allowed extensionless SPA route
  const matchesProtectedAsset = PROTECTED_ASSET_IDENTIFIERS.some((ident) =>
    lowerPath.includes(ident)
  );

  if (matchesProtectedAsset) {
    const rawTrimmedLower = (rawPathname.length > 1 ? rawPathname.replace(/\/+$/, "") : rawPathname).toLowerCase();
    const isAllowedSpaRoute =
      decodeRounds === 0 &&
      ALLOWED_PROTECTED_SLUG_SPA_PATTERNS.some(
        (pattern) => pattern.test(lowerPath) && pattern.test(rawTrimmedLower)
      );

    if (!isAllowedSpaRoute) {
      return {
        allowed: false,
        statusCode: 403,
        code: "PROTECTED_ASSET_FORBIDDEN",
        error: "Forbidden",
        message: "Direct access to paid digital assets is strictly prohibited. A confirmed, verified purchase is required.",
        normalizedPath,
      };
    }
  }

  return { allowed: true, normalizedPath };
}

export function protectedAssetGuardMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const decision = evaluateProtectedAssetRequest(req.originalUrl || req.url || req.path || "/");
  if (!decision.allowed) {
    setNoStoreSecurityHeaders(res);
    return res.status(decision.statusCode || 403).json({
      error: decision.error || "Forbidden",
      code: decision.code || "PROTECTED_ASSET_FORBIDDEN",
      message:
        decision.message ||
        "Direct access to paid digital assets is strictly prohibited. A confirmed, verified purchase is required.",
    });
  }
  return next();
}

export interface CreateAppOptions {
  isProduction?: boolean;
  distDir?: string;
}

export async function createApp(options: CreateAppOptions = {}) {
  const app = express();

  const isProduction = options.isProduction ?? isProductionEnvironment();

  // Configure reverse proxy trust explicitly via TRUST_PROXY_HOPS (P0-3 / SEC-05).
  // Never guesses a hop count (defaults to false / 0 hops when unset).
  const trustProxyConfig = resolveTrustProxyConfig(process.env, isProduction);
  app.set("trust proxy", trustProxyConfig.expressValue);

  // 0. Mount Development Safety Gate BEFORE any write endpoints, webhooks, or API handlers
  app.use(developmentSafetyMiddleware);

  // 1. Mount Razorpay Webhook endpoint with exact raw body handling BEFORE express.json()
  app.post(
    "/api/payments/webhook",
    express.raw({ type: "*/*" }),
    handleRazorpayWebhook
  );

  // 2. Configure JSON body parsing with raw body retention for other routes
  app.use(
    express.json({
      verify: (req: any, _res, buf) => {
        // Retain unaltered raw request buffer for cryptographic verification
        if (buf && buf.length) {
          req.rawBody = buf;
        }
      },
    })
  );

  // 3. Configure URL-encoded body parsing
  app.use(express.urlencoded({ extended: true }));

  // 4. Health & Gateway Diagnostics API endpoints (read-only infrastructure checks)
  app.get(["/healthz", "/health", "/api/health"], (_req, res) => {
    const assetTokenSecretConfigured = isAssetTokenSecretConfigured();
    const resourceTokenSecretConfigured = isResourceTokenSecretConfigured();
    const invoiceTokenSecretConfigured = isInvoiceTokenSecretConfigured();
    const downloadRateLimitSecretConfigured = isDownloadRateLimitSecretConfigured();
    const trustProxyHealth = resolveTrustProxyConfig(process.env, isProduction);
    const allRequiredTokenSecretsConfigured =
      assetTokenSecretConfigured &&
      resourceTokenSecretConfigured &&
      invoiceTokenSecretConfigured;

    res.status(allRequiredTokenSecretsConfigured ? 200 : 503).json({
      status: allRequiredTokenSecretsConfigured ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      gateway: {
        razorpayConfigured: isRazorpayConfigured(),
        webhookConfigured: isWebhookConfigured(),
        supabaseServerConfigured: isSupabaseServerConfigured(),
        emailConfigured: isMailerConfigured(),
        assetTokenSecretConfigured,
        resourceTokenSecretConfigured,
        invoiceTokenSecretConfigured,
        downloadRateLimitSecretConfigured,
        trustProxyHopsConfigured: trustProxyHealth.configured,
        downloadCounterReady: downloadRateLimitSecretConfigured && trustProxyHealth.valid,
      },
    });
  });

  // 5. Payment Gateway APIs
  app.use("/api/payments", paymentRoutes);

  // 5.5. Resource Catalog & Persistent Free-Download Counter APIs (P0-3)
  app.use("/api/resources", createResourceRoutes({ isProduction }));

  // 6. Web Project Enquiries CRM APIs
  app.use("/api/web-enquiries", webEnquiryRoutes);

  // 7. Growth Audit Qualification CRM & Booking APIs
  app.use("/api/growth-audit", growthAuditRoutes);

  // 8. Auth Transactional Communications APIs
  app.use("/api/auth", authRoutes);

  // 9. API 404 handler - prevents unhandled API requests from returning index.html
  app.all("/api/*", (_req, res) => {
    res.status(404).json({ error: "API endpoint not found" });
  });

  // 8. Legacy WordPress 301 Redirects & 410 Retirements Middleware
  app.use(seoRedirectMiddleware);

  // 8.5. Security Guard: Prohibit unauthorised direct HTTP/GET/HEAD access to paid digital assets
  app.use(protectedAssetGuardMiddleware);

  // 9. Vite middleware for development / Static fallback for production
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "custom",
    });

    // Ensure browsers (especially Safari with DISABLE_HMR=true) never cache Vite pre-bundled deps as immutable in dev
    app.use((req, res, next) => {
      const url = req.url || "";
      if (url.startsWith("/node_modules/.vite/") || url.startsWith("/src/")) {
        if (url.startsWith("/node_modules/.vite/")) {
          delete req.headers["if-none-match"];
          delete req.headers["if-modified-since"];
        }
        const origSetHeader = res.setHeader.bind(res);
        res.setHeader = ((name: string, value: number | string | readonly string[]) => {
          if (String(name).toLowerCase() === "cache-control") {
            return origSetHeader(name, "no-store, no-cache, must-revalidate");
          }
          return origSetHeader(name, value);
        }) as typeof res.setHeader;
        origSetHeader("Cache-Control", "no-store, no-cache, must-revalidate");
        origSetHeader("Pragma", "no-cache");
      }
      next();
    });

    app.use(vite.middlewares);

    // Guard: nonexistent XML files must return genuine HTTP 404 in development
    app.use((req, res, next) => {
      if (req.path.endsWith(".xml") && req.path !== "/sitemap.xml") {
        res.status(404);
        res.setHeader("Content-Type", "application/xml; charset=utf-8");
        return res.send(`<?xml version="1.0" encoding="UTF-8"?><error><status>404</status><message>XML resource not found</message></error>`);
      }
      next();
    });

    const isModuleOrAssetPath = (reqPath: string): boolean => {
      if (reqPath.startsWith("/src/") || reqPath.startsWith("/assets/") || reqPath.startsWith("/node_modules/")) {
        return true;
      }
      return /\.(?:mjs|cjs|js|jsx|ts|tsx|css|map|json|wasm|svg|png|jpe?g|webp|gif|ico|woff2?|ttf|eot|pdf|xlsx|zip)$/i.test(reqPath);
    };

    app.get("*", async (req, res, next) => {
      if (req.path.startsWith("/api") || req.path.includes(".")) {
        return next();
      }
      try {
        const templatePath = path.resolve(process.cwd(), "index.html");
        let template = fs.readFileSync(templatePath, "utf-8");
        template = await vite.transformIndexHtml(req.originalUrl || req.url, template);
        let finalHtml = injectSeoIntoHtml(template, req.path);
        const envScript = buildClientEnvScript(false);
        if (finalHtml.includes("</head>")) {
          finalHtml = finalHtml.replace("</head>", `${envScript}</head>`);
        } else {
          finalHtml = envScript + finalHtml;
        }
        res.status(200).set({
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Pragma": "no-cache",
        }).end(finalHtml);
      } catch (e) {
        next(e);
      }
    });

    // Guard: missing module/asset requests in dev must return plain 404, never HTML text/html
    app.use((req, res, next) => {
      if (isModuleOrAssetPath(req.path)) {
        res.status(404).set({
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store, no-cache, must-revalidate",
        }).send("Not Found");
        return;
      }
      next();
    });
  } else {
    const distPath = options.distDir
      ? options.distDir
      : (fs.existsSync(path.join(process.cwd(), "dist", "index.html"))
          ? path.join(process.cwd(), "dist")
          : (fs.existsSync(path.join(process.cwd(), "index.html"))
              ? process.cwd()
              : path.join(__dirname, "..", "dist")));
    const indexPath = path.join(distPath, "index.html");

    const isModuleOrAssetPath = (reqPath: string): boolean => {
      if (reqPath.startsWith("/src/") || reqPath.startsWith("/assets/") || reqPath.startsWith("/node_modules/")) {
        return true;
      }
      return /\.(?:mjs|cjs|js|jsx|ts|tsx|css|map|json|wasm|svg|png|jpe?g|webp|gif|ico|woff2?|ttf|eot|pdf|xlsx|zip)$/i.test(reqPath);
    };

    app.use(express.static(distPath, { index: false, redirect: false }));

    // Guard: nonexistent XML files must return genuine HTTP 404, never fall through to HTML SPA
    app.use((req, res, next) => {
      if (req.path.endsWith(".xml")) {
        res.status(404);
        res.setHeader("Content-Type", "application/xml; charset=utf-8");
        return res.send(`<?xml version="1.0" encoding="UTF-8"?><error><status>404</status><message>XML resource not found</message></error>`);
      }
      if (isModuleOrAssetPath(req.path)) {
        res.status(404);
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
        return res.send("Asset not found");
      }
      next();
    });

    app.get("*", (req, res) => {
      try {
        if (!fs.existsSync(indexPath)) {
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          return res.status(200).send("<!doctype html><html><head><title>Loading...</title></head><body>Application is starting up...</body></html>");
        }

        const cleanSubdir = req.path.replace(/^\/+/, "").replace(/\/+$/, "");
        const specificHtmlPath = cleanSubdir ? path.join(distPath, cleanSubdir, "index.html") : indexPath;

        let html = fs.existsSync(specificHtmlPath)
          ? fs.readFileSync(specificHtmlPath, "utf8")
          : fs.readFileSync(indexPath, "utf8");

        html = injectSeoIntoHtml(html, req.path);
        const envScript = buildClientEnvScript(true);

        if (html.includes("</head>")) {
          html = html.replace("</head>", `${envScript}</head>`);
        } else {
          html = envScript + html;
        }

        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
        res.send(html);
      } catch (_err) {
        if (fs.existsSync(indexPath)) {
          res.sendFile(indexPath);
        } else {
          res.status(200).send("<!doctype html><html><head><title>Loading...</title></head><body>Application is starting up...</body></html>");
        }
      }
    });
  }

  return app;
}

export async function startServer() {
  const portArgIndex = process.argv.indexOf("--port");
  const cliPort = portArgIndex !== -1 && process.argv[portArgIndex + 1] ? process.argv[portArgIndex + 1] : null;

  // In AI Studio development container, Nginx reverse-proxies from external 8080 to internal 3000.
  // In Cloud Run live deployment (ais-pre / live service), the container MUST listen directly
  // on the port specified by Cloud Run (process.env.PORT, default 8080).
  const isDevContainer = Boolean(
    process.env.NGINX_PORT ||
    process.env.DEFAULT_APP_PORT ||
    process.env.CONTROL_PLANE_PORT ||
    process.env.K_SERVICE?.startsWith("ais-dev-")
  );

  const isProduction = isProductionEnvironment();

  // Respect TEST_PORT for local testing; otherwise in dev use 3000, and in Cloud Run use process.env.PORT (8080)
  const PORT = process.env.TEST_PORT
    ? parseInt(process.env.TEST_PORT, 10)
    : (isDevContainer && process.env.NODE_ENV !== "production"
        ? parseInt(cliPort || "3000", 10)
        : parseInt(process.env.PORT || cliPort || "8080", 10));

  const app = await createApp({ isProduction });

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT} (mode: ${isProduction ? 'production' : 'development'})`);
    if (isRazorpayConfigured()) {
      console.log("[Payment Gateway] Razorpay server credentials detected.");
    } else {
      console.log("[Payment Gateway] Razorpay server credentials not configured (development mode).");
    }
  });

  server.on("error", (err: any) => {
    console.error("[Server Error]", err);
  });

  return server;
}

const isDirectEntrypoint = (() => {
  // CommonJS bundle execution (e.g. `node dist/server.cjs`)
  if (typeof require === "function" && typeof module !== "undefined" && require.main === module) {
    return true;
  }
  // ESM execution (e.g. `tsx server.ts`)
  try {
    const entryArg = process.argv[1];
    if (entryArg) {
      const base = path.basename(path.resolve(entryArg));
      if (base === "server.ts" || base === "server.cjs" || base === "server.js") {
        return true;
      }
    }
  } catch {
    // Ignore argv resolution errors
  }
  return false;
})();

if (isDirectEntrypoint) {
  startServer();
}
