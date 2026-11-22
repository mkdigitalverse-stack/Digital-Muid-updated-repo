import express from "express";
import crypto from "crypto";
import { getSupabaseServerClient, isValidUUID } from "./supabaseServer.js";

const DEFAULT_WINDOW_SECONDS = 900; // 15 minutes
const DEFAULT_MAX_HITS = 10; // 10 increments per (resource_id, client_hash) per 15-min window
const MIN_HMAC_SECRET_LENGTH = 32;

/**
 * Resolves and strictly validates Express reverse-proxy hop configuration.
 *
 * SECURITY POLICY (P0-3):
 * - NEVER guesses a default proxy hop count (e.g. `1`).
 * - When `TRUST_PROXY_HOPS` is unset: Express uses `trust proxy = false` (0 hops),
 *   preventing raw `X-Forwarded-For` spoofing.
 * - In production, `TRUST_PROXY_HOPS` MUST be explicitly configured to a verified
 *   integer in `0..5` (Hostinger/edge hop count must be probed before cutover);
 *   otherwise fail-closed endpoints return HTTP 503.
 * - Any malformed/out-of-range value fails closed (`valid: false`) in ALL environments.
 *
 * @param {NodeJS.ProcessEnv} [env=process.env]
 * @param {boolean} [isProduction=false]
 */
export function resolveTrustProxyConfig(env = process.env, isProduction = false) {
  const raw = env?.TRUST_PROXY_HOPS;
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return {
      configured: false,
      valid: !isProduction,
      hops: 0,
      expressValue: false,
      reason: "TRUST_PROXY_HOPS is not explicitly configured"
    };
  }

  const trimmed = String(raw).trim();
  if (!/^[0-5]$/.test(trimmed)) {
    return {
      configured: false,
      valid: false,
      hops: 0,
      expressValue: false,
      reason: "TRUST_PROXY_HOPS must be an integer between 0 and 5"
    };
  }

  const hops = Number.parseInt(trimmed, 10);
  return {
    configured: true,
    valid: true,
    hops,
    expressValue: hops === 0 ? false : hops,
    reason: null
  };
}

/**
 * Returns the validated dedicated HMAC secret for free-download rate-limit keys.
 * Fails closed (returns null) if unset or shorter than 32 characters.
 * NEVER falls back to another secret or hardcoded string.
 *
 * @param {NodeJS.ProcessEnv} [env=process.env]
 * @returns {string|null}
 */
export function getDownloadRateLimitHmacSecret(env = process.env) {
  const secret = env?.DOWNLOAD_RATE_LIMIT_HMAC_SECRET;
  if (typeof secret !== "string") return null;
  const trimmed = secret.trim();
  if (trimmed.length < MIN_HMAC_SECRET_LENGTH) return null;
  return trimmed;
}

/**
 * @param {NodeJS.ProcessEnv} [env=process.env]
 * @returns {boolean}
 */
export function isDownloadRateLimitSecretConfigured(env = process.env) {
  return Boolean(getDownloadRateLimitHmacSecret(env));
}

/**
 * Extracts the trusted client IP strictly from Express-resolved `req.ip` or
 * the underlying socket remote address.
 *
 * NEVER parses raw `req.headers["x-forwarded-for"]` directly.
 *
 * @param {import('express').Request} req
 * @returns {string|null}
 */
export function extractTrustedClientIp(req) {
  const rawIp = req?.ip || req?.socket?.remoteAddress || null;
  if (!rawIp || typeof rawIp !== "string") return null;

  let normalized = rawIp.trim().toLowerCase();
  if (!normalized) return null;

  if (normalized.startsWith("::ffff:")) {
    normalized = normalized.slice(7);
  }
  return normalized || null;
}

/**
 * Computes a 64-character lowercase hex HMAC-SHA256 hash of the client IP.
 * Raw IPs are never persisted to the database.
 *
 * @param {string} clientIp
 * @param {string} secret
 * @returns {string}
 */
export function computeDownloadClientHash(clientIp, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(String(clientIp))
    .digest("hex");
}

/**
 * Creates the `/api/resources` router with fail-closed persistent rate limiting.
 *
 * @param {{ isProduction?: boolean, windowSeconds?: number, maxHits?: number }} [options]
 */
export function createResourceRoutes(options = {}) {
  const router = express.Router();
  const isProduction = Boolean(options.isProduction);
  const windowSeconds = Number.isInteger(options.windowSeconds)
    ? options.windowSeconds
    : DEFAULT_WINDOW_SECONDS;
  const maxHits = Number.isInteger(options.maxHits)
    ? options.maxHits
    : DEFAULT_MAX_HITS;

  /**
   * POST /api/resources/:id/record-download
   *
   * Server-side free-resource download counter backed by atomic PostgreSQL RPC
   * `public.record_free_resource_download(...)` and persistent table
   * `public.resource_download_rate_limits`.
   *
   * Strictly fail-closed:
   * - HTTP 400 on invalid UUID
   * - HTTP 503 if HMAC secret, proxy trust config (in prod or invalid),
   *   service-role client, client IP, or persistent backing RPC is unavailable
   *   (NEVER falls back to in-memory rate limiting)
   * - HTTP 404 if resource does not exist
   * - HTTP 403 if resource is paid, nonzero price, draft, or archived
   * - HTTP 429 with Retry-After header when rate-limited
   * - HTTP 409 if defensive UPDATE affected 0 rows (never reports success)
   * - HTTP 200 ONLY when `allowed === true && incremented === true`
   */
  router.post("/:id/record-download", async (req, res) => {
    try {
      const resourceId = String(req.params?.id || "").trim();
      if (!isValidUUID(resourceId)) {
        return res.status(400).json({
          success: false,
          allowed: false,
          incremented: false,
          code: "INVALID_RESOURCE_ID",
          error: "A valid resource UUID is required."
        });
      }

      const hmacSecret = getDownloadRateLimitHmacSecret(process.env);
      if (!hmacSecret) {
        return res.status(503).json({
          success: false,
          allowed: false,
          incremented: false,
          code: "RATE_LIMIT_SECRET_UNCONFIGURED",
          error: "Download rate-limit service is not configured."
        });
      }

      const trustProxy = resolveTrustProxyConfig(process.env, isProduction);
      if (!trustProxy.valid) {
        return res.status(503).json({
          success: false,
          allowed: false,
          incremented: false,
          code: "PROXY_TRUST_UNCONFIGURED",
          error: "Reverse proxy trust configuration is missing or invalid."
        });
      }

      const supabaseServer = getSupabaseServerClient();
      if (!supabaseServer || typeof supabaseServer.rpc !== "function") {
        return res.status(503).json({
          success: false,
          allowed: false,
          incremented: false,
          code: "SERVICE_ROLE_UNAVAILABLE",
          error: "Persistent download counter service is unavailable."
        });
      }

      const clientIp = extractTrustedClientIp(req);
      if (!clientIp) {
        return res.status(503).json({
          success: false,
          allowed: false,
          incremented: false,
          code: "CLIENT_IP_UNAVAILABLE",
          error: "Unable to resolve client network identity."
        });
      }

      const clientHash = computeDownloadClientHash(clientIp, hmacSecret);

      const { data, error } = await supabaseServer.rpc("record_free_resource_download", {
        p_resource_id: resourceId,
        p_client_hash: clientHash,
        p_window_seconds: windowSeconds,
        p_max_hits: maxHits
      });

      if (error || !data || typeof data !== "object") {
        return res.status(503).json({
          success: false,
          allowed: false,
          incremented: false,
          code: "RATE_LIMIT_STORAGE_UNAVAILABLE",
          error: "Persistent download rate-limit storage is unavailable."
        });
      }

      const code = String(data.code || "");

      if (code === "RATE_LIMITED") {
        const retryAfter = Math.max(1, Number.parseInt(String(data.retry_after_seconds ?? windowSeconds), 10) || windowSeconds);
        res.setHeader("Retry-After", String(retryAfter));
        return res.status(429).json({
          success: false,
          allowed: false,
          incremented: false,
          code: "RATE_LIMITED",
          retryAfterSeconds: retryAfter,
          downloadCount: typeof data.download_count === "number" ? data.download_count : undefined,
          error: "Too many download requests. Please try again later."
        });
      }

      if (code === "NOT_FOUND") {
        return res.status(404).json({
          success: false,
          allowed: false,
          incremented: false,
          code: "NOT_FOUND",
          error: "Resource not found."
        });
      }

      if (code === "NOT_ELIGIBLE") {
        return res.status(403).json({
          success: false,
          allowed: false,
          incremented: false,
          code: "NOT_ELIGIBLE",
          error: "Only published free resources may use the public download counter."
        });
      }

      if (code === "UPDATE_AFFECTED_ZERO_ROWS") {
        return res.status(409).json({
          success: false,
          allowed: false,
          incremented: false,
          code: "UPDATE_AFFECTED_ZERO_ROWS",
          error: "Resource eligibility changed concurrently; download count was not incremented."
        });
      }

      if (code === "OK" && data.allowed === true && data.incremented === true) {
        return res.status(200).json({
          success: true,
          allowed: true,
          incremented: true,
          code: "OK",
          downloadCount: data.download_count,
          remaining: data.remaining ?? 0
        });
      }

      // Any unexpected/malformed RPC outcome fails closed
      return res.status(503).json({
        success: false,
        allowed: false,
        incremented: false,
        code: "RATE_LIMIT_STORAGE_UNAVAILABLE",
        error: "Unexpected download counter response."
      });
    } catch (err) {
      console.error("[Resource Download Counter] Fail-closed error:", err?.message || err);
      return res.status(503).json({
        success: false,
        allowed: false,
        incremented: false,
        code: "RATE_LIMIT_STORAGE_UNAVAILABLE",
        error: "Persistent download counter service encountered an error."
      });
    }
  });

  return router;
}

export default createResourceRoutes;
