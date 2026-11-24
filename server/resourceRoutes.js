import express from "express";
import crypto from "crypto";
import path from "path";
import {
  getSupabaseServerClient,
  isValidUUID,
  verifySupabaseToken,
  isEmailConfirmed,
  checkIsAdmin
} from "./supabaseServer.js";

const DEFAULT_WINDOW_SECONDS = 900; // 15 minutes
const DEFAULT_MAX_HITS = 10; // 10 increments per (resource_id, client_hash) per 15-min window
const MIN_HMAC_SECRET_BYTES = 32;

export const PAID_RESOURCES_BUCKET = "paid-resources";
export const PAID_UPLOAD_MAX_BYTES = 50 * 1024 * 1024; // 50 MiB (aligned with paid-resources bucket limit)
export const PAID_UPLOAD_MAX_FILENAME_LENGTH = 180;

export const ALLOWED_PAID_UPLOAD_TYPES = Object.freeze({
  ".pdf": Object.freeze({
    canonicalMime: "application/pdf",
    acceptedMimes: Object.freeze(["application/pdf"])
  }),
  ".xlsx": Object.freeze({
    canonicalMime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    acceptedMimes: Object.freeze([
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ])
  }),
  ".zip": Object.freeze({
    canonicalMime: "application/zip",
    acceptedMimes: Object.freeze(["application/zip", "application/x-zip-compressed"])
  })
});

const FORBIDDEN_BUCKET_QUERY_KEYS = ["bucket", "storageBucket", "targetBucket", "storage_bucket"];
const FORBIDDEN_BUCKET_HEADER_KEYS = ["x-storage-bucket", "x-upload-bucket", "x-bucket"];
const FORBIDDEN_PATH_QUERY_KEYS = ["path", "storagePath", "folder", "storage_path"];
const FORBIDDEN_PATH_HEADER_KEYS = ["x-storage-path", "x-upload-folder", "x-upload-path"];

/**
 * Validates and sanitizes an uploaded paid-asset filename.
 * Rejects path traversal, path separators, encoded traversal sequences,
 * control/NUL bytes, leading dots, overlong names, and disallowed extensions.
 *
 * @param {string} rawHeaderValue
 * @returns {{ valid: boolean, cleanFilename?: string, ext?: string, code?: string, error?: string }}
 */
export function validatePaidUploadFilename(rawHeaderValue) {
  if (typeof rawHeaderValue !== "string" || !rawHeaderValue.trim()) {
    return {
      valid: false,
      code: "INVALID_FILENAME",
      error: "A valid filename header (X-Upload-Filename) is required."
    };
  }

  const rawTrimmed = rawHeaderValue.trim();
  if (rawTrimmed.length > PAID_UPLOAD_MAX_FILENAME_LENGTH * 3) {
    return {
      valid: false,
      code: "INVALID_FILENAME",
      error: "Filename exceeds maximum allowed length."
    };
  }

  // Reject raw percent-encoded traversal, path separators, or NUL bytes before decoding
  if (/(?:%2e|%2f|%5c|%00)/i.test(rawTrimmed)) {
    return {
      valid: false,
      code: "INVALID_FILENAME",
      error: "Filename contains forbidden encoded path characters."
    };
  }

  let decoded;
  try {
    decoded = decodeURIComponent(rawTrimmed).trim();
  } catch {
    return {
      valid: false,
      code: "INVALID_FILENAME",
      error: "Filename encoding is malformed."
    };
  }

  if (!decoded || decoded.length > PAID_UPLOAD_MAX_FILENAME_LENGTH) {
    return {
      valid: false,
      code: "INVALID_FILENAME",
      error: "Filename is empty or exceeds maximum allowed length."
    };
  }

  // Reject control characters, NUL bytes, path separators, traversal sequences, or leading dots
  if (
    /[\x00-\x1f\x7f]/.test(decoded) ||
    decoded.includes("/") ||
    decoded.includes("\\") ||
    decoded.includes("..") ||
    decoded.startsWith(".")
  ) {
    return {
      valid: false,
      code: "INVALID_FILENAME",
      error: "Filename contains forbidden path or control characters."
    };
  }

  if (path.basename(decoded) !== decoded) {
    return {
      valid: false,
      code: "INVALID_FILENAME",
      error: "Filename must not contain directory segments."
    };
  }

  const ext = path.extname(decoded).toLowerCase();
  if (!ext || !Object.prototype.hasOwnProperty.call(ALLOWED_PAID_UPLOAD_TYPES, ext)) {
    return {
      valid: false,
      code: "INVALID_FILE_TYPE",
      error: "Only PDF (.pdf), Excel (.xlsx), and ZIP (.zip) files are allowed for paid assets."
    };
  }

  const baseName = decoded.slice(0, -ext.length);
  const safeBase = baseName
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/\.+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_-]+|[_-]+$/g, "")
    .slice(0, 100);

  if (!safeBase) {
    return {
      valid: false,
      code: "INVALID_FILENAME",
      error: "Filename must contain valid alphanumeric characters."
    };
  }

  const cleanFilename = `${safeBase.toLowerCase()}${ext}`;
  if (
    path.basename(cleanFilename) !== cleanFilename ||
    cleanFilename.includes("..") ||
    /[\/\\]/.test(cleanFilename)
  ) {
    return {
      valid: false,
      code: "INVALID_FILENAME",
      error: "Sanitized filename failed safety validation."
    };
  }

  return {
    valid: true,
    cleanFilename,
    ext
  };
}

/**
 * Validates that the HTTP Content-Type matches the allowed MIME type for the validated extension.
 *
 * @param {string|undefined} rawContentType
 * @param {string} ext
 * @returns {{ valid: boolean, canonicalMime?: string, code?: string, error?: string }}
 */
export function validatePaidUploadContentType(rawContentType, ext) {
  const spec = ALLOWED_PAID_UPLOAD_TYPES[ext];
  if (!spec) {
    return {
      valid: false,
      code: "INVALID_FILE_TYPE",
      error: "Unsupported paid-asset file extension."
    };
  }

  if (typeof rawContentType !== "string" || !rawContentType.trim()) {
    return {
      valid: false,
      code: "INVALID_FILE_TYPE",
      error: "A valid Content-Type header matching the file type is required."
    };
  }

  const normalizedMime = rawContentType.split(";")[0].trim().toLowerCase();
  if (!spec.acceptedMimes.includes(normalizedMime)) {
    return {
      valid: false,
      code: "INVALID_FILE_TYPE",
      error: `Content-Type '${normalizedMime}' is not permitted for ${ext} paid assets.`
    };
  }

  return {
    valid: true,
    canonicalMime: spec.canonicalMime
  };
}

/**
 * Validates binary magic bytes to prevent MIME/extension spoofing (e.g. HTML/JS renamed to .pdf).
 *
 * @param {Buffer} buffer
 * @param {string} ext
 * @returns {boolean}
 */
export function validatePaidUploadSignature(buffer, ext) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return false;

  if (ext === ".pdf") {
    return buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  }

  if (ext === ".xlsx") {
    // OOXML .xlsx is a ZIP container starting with local file header PK\x03\x04
    return (
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      buffer[2] === 0x03 &&
      buffer[3] === 0x04
    );
  }

  if (ext === ".zip") {
    // Standard ZIP local file header (PK\x03\x04) or empty archive EOCD (PK\x05\x06)
    return (
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      ((buffer[2] === 0x03 && buffer[3] === 0x04) ||
        (buffer[2] === 0x05 && buffer[3] === 0x06))
    );
  }

  return false;
}

/**
 * Builds a strictly server-controlled destination path inside the private `paid-resources` bucket.
 *
 * @param {string} cleanFilename
 * @returns {string}
 */
export function buildPaidStorageObjectPath(cleanFilename) {
  const randomSuffix = crypto.randomBytes(6).toString("hex");
  const objectPath = `paid/${Date.now()}_${randomSuffix}_${cleanFilename}`;
  if (
    !objectPath.startsWith("paid/") ||
    objectPath.includes("..") ||
    objectPath.includes("\\") ||
    objectPath.includes("//") ||
    /[\x00-\x1f\x7f\s]/.test(objectPath)
  ) {
    throw new Error("Generated storage path failed safety invariants.");
  }
  return objectPath;
}

const EXACT_PLACEHOLDER_SECRETS = new Set([
  "undefined",
  "null",
  "none",
  "changeme",
  "change_me",
  "replace_me",
  "placeholder",
  "secret",
  "generate_at_least_32_bytes_random_hex_secret_here"
]);

function isPlaceholderOrMalformedSecret(candidate) {
  if (!candidate || typeof candidate !== "string") return true;
  // Reject internal whitespace or ASCII control characters
  if (/[\s\x00-\x1f\x7f]/.test(candidate)) return true;

  const lower = candidate.toLowerCase();
  if (EXACT_PLACEHOLDER_SECRETS.has(lower)) return true;
  if (
    lower.startsWith("generate_at_least_32_bytes") ||
    lower.startsWith("your_") ||
    lower.startsWith("my_") ||
    lower.includes("placeholder") ||
    lower.includes("replace_me") ||
    lower.includes("change_me") ||
    lower.includes("secret_here") ||
    lower.includes("example_secret")
  ) {
    return true;
  }

  // Reject trivial zero/low-entropy repeated patterns (e.g. "0".repeat(64), "ab".repeat(32))
  if (new Set(candidate).size < 4) return true;
  return false;
}

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
 * Fails closed (returns null) if unset, placeholder, malformed, invalid hex,
 * or shorter than 32 decoded bytes (256 bits).
 * NEVER falls back to another secret or hardcoded string, and NEVER logs secret values.
 *
 * Supported formats:
 * - Hexadecimal (`<hex>`, `hex:<hex>`, or `0x<hex>`): requires valid even-length hex
 *   with decoded byte length >= 32 (i.e. >= 64 hex characters).
 * - Base64 / Base64URL (`base64:<val>` or `base64url:<val>`): requires valid alphabet
 *   with decoded byte length >= 32.
 * - Raw high-entropy UTF-8 string: requires >= 32 UTF-8 bytes and >= 32 characters.
 *
 * @param {NodeJS.ProcessEnv} [env=process.env]
 * @returns {string|null}
 */
export function getDownloadRateLimitHmacSecret(env = process.env) {
  const secret = env?.DOWNLOAD_RATE_LIMIT_HMAC_SECRET;
  if (typeof secret !== "string") return null;

  const trimmed = secret.trim();
  if (isPlaceholderOrMalformedSecret(trimmed)) return null;

  // 1. Explicit hexadecimal prefixes: `hex:...` or `0x...`
  if (/^(?:hex:|0x)/i.test(trimmed)) {
    const hexBody = trimmed.replace(/^(?:hex:|0x)/i, "");
    if (!hexBody || hexBody.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hexBody)) {
      return null;
    }
    if (isPlaceholderOrMalformedSecret(hexBody)) return null;
    const decoded = Buffer.from(hexBody, "hex");
    if (decoded.length < MIN_HMAC_SECRET_BYTES) return null;
    return trimmed;
  }

  // 2. Explicit base64 / base64url prefixes
  if (/^base64url:/i.test(trimmed)) {
    const body = trimmed.slice("base64url:".length);
    if (!body || !/^[A-Za-z0-9_-]+$/.test(body) || body.length % 4 === 1) {
      return null;
    }
    if (isPlaceholderOrMalformedSecret(body)) return null;
    const decoded = Buffer.from(body, "base64url");
    if (decoded.length < MIN_HMAC_SECRET_BYTES) return null;
    return trimmed;
  }

  if (/^base64:/i.test(trimmed)) {
    const body = trimmed.slice("base64:".length);
    if (!body || body.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(body)) {
      return null;
    }
    if (isPlaceholderOrMalformedSecret(body)) return null;
    const decoded = Buffer.from(body, "base64");
    if (decoded.length < MIN_HMAC_SECRET_BYTES) return null;
    return trimmed;
  }

  // 3. Unprefixed pure hexadecimal string: validate decoded byte length (>= 32 bytes / 64 hex chars)
  if (/^[0-9a-fA-F]+$/.test(trimmed)) {
    if (trimmed.length % 2 !== 0) return null;
    const decoded = Buffer.from(trimmed, "hex");
    if (decoded.length < MIN_HMAC_SECRET_BYTES) return null;
    return trimmed;
  }

  // 4. General raw UTF-8 secret: require at least 32 bytes AND 32 characters
  if (trimmed.length < MIN_HMAC_SECRET_BYTES || Buffer.byteLength(trimmed, "utf8") < MIN_HMAC_SECRET_BYTES) {
    return null;
  }

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
 * Creates the `/api/resources` router with fail-closed persistent rate limiting
 * and confirmed-admin-only private paid-asset uploads.
 *
 * @param {{ isProduction?: boolean, windowSeconds?: number, maxHits?: number, maxPaidUploadBytes?: number }} [options]
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
  const maxPaidUploadBytes =
    Number.isInteger(options.maxPaidUploadBytes) && options.maxPaidUploadBytes > 0
      ? Math.min(options.maxPaidUploadBytes, PAID_UPLOAD_MAX_BYTES)
      : PAID_UPLOAD_MAX_BYTES;

  /**
   * Middleware 1 (Pre-body): Strictly authenticates a confirmed-email administrator
   * BEFORE reading or buffering any binary upload payload.
   */
  const requireConfirmedAdminForPaidUpload = async (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");

    const authHeader = typeof req.headers?.authorization === "string"
      ? req.headers.authorization.trim()
      : "";
    if (!authHeader || !/^Bearer\s+\S+$/i.test(authHeader)) {
      return res.status(401).json({
        success: false,
        code: "AUTH_REQUIRED",
        error: "Administrator authentication is required."
      });
    }

    const supabaseServer = getSupabaseServerClient();
    if (
      !supabaseServer ||
      !supabaseServer.storage ||
      typeof supabaseServer.storage.from !== "function"
    ) {
      return res.status(503).json({
        success: false,
        code: "SERVICE_ROLE_UNAVAILABLE",
        error: "Private paid-asset storage service is unavailable."
      });
    }

    try {
      const { user, error: authError } = await verifySupabaseToken(authHeader);
      if (authError || !user) {
        return res.status(401).json({
          success: false,
          code: "INVALID_SESSION",
          error: "Invalid or expired administrator session."
        });
      }

      if (!isEmailConfirmed(user) || !checkIsAdmin(user)) {
        return res.status(403).json({
          success: false,
          code: "ADMIN_REQUIRED",
          error: "Confirmed administrator privileges are required to upload paid assets."
        });
      }

      req.verifiedAdminUser = user;
      req.supabaseServer = supabaseServer;
      return next();
    } catch {
      return res.status(503).json({
        success: false,
        code: "AUTH_VERIFICATION_FAILED",
        error: "Unable to verify administrator session."
      });
    }
  };

  /**
   * Middleware 2 (Pre-body): Rejects caller bucket/path selection, validates filename,
   * validates MIME type against the extension allowlist, and enforces declared Content-Length.
   */
  const validatePaidUploadHeaders = (req, res, next) => {
    for (const key of FORBIDDEN_BUCKET_QUERY_KEYS) {
      if (req.query && req.query[key] !== undefined) {
        return res.status(400).json({
          success: false,
          code: "ARBITRARY_BUCKET_FORBIDDEN",
          error: "Callers may not specify a target storage bucket for paid assets."
        });
      }
    }
    for (const headerName of FORBIDDEN_BUCKET_HEADER_KEYS) {
      if (req.headers && req.headers[headerName] !== undefined) {
        return res.status(400).json({
          success: false,
          code: "ARBITRARY_BUCKET_FORBIDDEN",
          error: "Callers may not specify a target storage bucket for paid assets."
        });
      }
    }
    for (const key of FORBIDDEN_PATH_QUERY_KEYS) {
      if (req.query && req.query[key] !== undefined) {
        return res.status(400).json({
          success: false,
          code: "ARBITRARY_PATH_FORBIDDEN",
          error: "Callers may not specify an arbitrary storage path for paid assets."
        });
      }
    }
    for (const headerName of FORBIDDEN_PATH_HEADER_KEYS) {
      if (req.headers && req.headers[headerName] !== undefined) {
        return res.status(400).json({
          success: false,
          code: "ARBITRARY_PATH_FORBIDDEN",
          error: "Callers may not specify an arbitrary storage path for paid assets."
        });
      }
    }

    const rawFilenameHeader = req.headers?.["x-upload-filename"];
    const filenameHeaderStr = Array.isArray(rawFilenameHeader)
      ? ""
      : (rawFilenameHeader ?? "");
    const filenameCheck = validatePaidUploadFilename(filenameHeaderStr);
    if (!filenameCheck.valid) {
      return res.status(400).json({
        success: false,
        code: filenameCheck.code || "INVALID_FILENAME",
        error: filenameCheck.error
      });
    }

    const contentTypeCheck = validatePaidUploadContentType(
      req.headers?.["content-type"],
      filenameCheck.ext
    );
    if (!contentTypeCheck.valid) {
      return res.status(400).json({
        success: false,
        code: contentTypeCheck.code || "INVALID_FILE_TYPE",
        error: contentTypeCheck.error
      });
    }

    const rawContentLength = req.headers?.["content-length"];
    if (rawContentLength !== undefined) {
      const lengthStr = String(rawContentLength).trim();
      if (!/^\d+$/.test(lengthStr)) {
        return res.status(400).json({
          success: false,
          code: "INVALID_CONTENT_LENGTH",
          error: "Invalid Content-Length header."
        });
      }
      const declaredBytes = Number.parseInt(lengthStr, 10);
      if (declaredBytes === 0) {
        return res.status(400).json({
          success: false,
          code: "EMPTY_FILE",
          error: "Uploaded file must not be empty."
        });
      }
      if (declaredBytes > maxPaidUploadBytes) {
        return res.status(413).json({
          success: false,
          code: "FILE_TOO_LARGE",
          error: `Paid asset exceeds maximum allowed size of ${Math.floor(maxPaidUploadBytes / (1024 * 1024))} MB.`
        });
      }
    }

    req.paidUploadMeta = {
      cleanFilename: filenameCheck.cleanFilename,
      ext: filenameCheck.ext,
      canonicalMime: contentTypeCheck.canonicalMime
    };
    return next();
  };

  /**
   * Middleware 3: Raw binary body parser bounded by maxPaidUploadBytes + JSON error handler.
   */
  const rawPaidUploadParser = express.raw({
    type: () => true,
    limit: maxPaidUploadBytes
  });

  const handlePaidUploadBodyError = (err, _req, res, next) => {
    if (!err) return next();
    res.setHeader("Cache-Control", "no-store");
    if (err.type === "entity.too.large" || err.status === 413 || err.statusCode === 413) {
      return res.status(413).json({
        success: false,
        code: "FILE_TOO_LARGE",
        error: `Paid asset exceeds maximum allowed size of ${Math.floor(maxPaidUploadBytes / (1024 * 1024))} MB.`
      });
    }
    return res.status(400).json({
      success: false,
      code: "INVALID_UPLOAD_BODY",
      error: "Failed to read uploaded file payload."
    });
  };

  /**
   * POST /api/resources/admin/upload-paid-asset
   *
   * Confirmed-admin-only private paid-asset upload endpoint (Step 3B).
   * - Uploads exclusively to the private `paid-resources` Supabase Storage bucket.
   * - NEVER calls `getPublicUrl()` and NEVER falls back to the public `resources` bucket.
   * - Returns ONLY the canonical private reference format: `supabase://paid-resources/<path>`.
   */
  router.post(
    "/admin/upload-paid-asset",
    requireConfirmedAdminForPaidUpload,
    validatePaidUploadHeaders,
    rawPaidUploadParser,
    handlePaidUploadBodyError,
    async (req, res) => {
      try {
        const fileBuffer = req.body;
        if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
          return res.status(400).json({
            success: false,
            code: "EMPTY_FILE",
            error: "Uploaded file must not be empty."
          });
        }

        if (fileBuffer.length > maxPaidUploadBytes) {
          return res.status(413).json({
            success: false,
            code: "FILE_TOO_LARGE",
            error: `Paid asset exceeds maximum allowed size of ${Math.floor(maxPaidUploadBytes / (1024 * 1024))} MB.`
          });
        }

        const { cleanFilename, ext, canonicalMime } = req.paidUploadMeta;
        if (!validatePaidUploadSignature(fileBuffer, ext)) {
          return res.status(400).json({
            success: false,
            code: "INVALID_FILE_SIGNATURE",
            error: `Uploaded file content does not match a valid ${ext} file signature.`
          });
        }

        const objectPath = buildPaidStorageObjectPath(cleanFilename);
        const supabaseServer = req.supabaseServer;

        const { data, error } = await supabaseServer.storage
          .from(PAID_RESOURCES_BUCKET)
          .upload(objectPath, fileBuffer, {
            contentType: canonicalMime,
            cacheControl: "0",
            upsert: false
          });

        if (
          error ||
          !data ||
          typeof data.path !== "string" ||
          !data.path.trim() ||
          data.path.includes("..") ||
          data.path.includes("\\") ||
          /[\x00-\x1f\x7f\s]/.test(data.path)
        ) {
          const safeStatusCode = error?.statusCode || error?.code || "STORAGE_UPLOAD_FAILED";
          console.error(`[Paid Asset Upload] Private storage upload failed (${safeStatusCode})`);
          return res.status(503).json({
            success: false,
            code: "PRIVATE_STORAGE_UPLOAD_FAILED",
            error: "Private paid-asset storage upload failed. Ensure the private paid-resources bucket is configured."
          });
        }

        const normalizedUploadedPath = data.path.replace(/^\/+/, "");
        if (!normalizedUploadedPath || normalizedUploadedPath.includes("..")) {
          return res.status(503).json({
            success: false,
            code: "PRIVATE_STORAGE_UPLOAD_FAILED",
            error: "Private paid-asset storage returned an invalid object reference."
          });
        }

        const reference = `supabase://${PAID_RESOURCES_BUCKET}/${normalizedUploadedPath}`;
        return res.status(201).json({
          success: true,
          reference,
          storagePath: normalizedUploadedPath,
          bucket: PAID_RESOURCES_BUCKET,
          contentType: canonicalMime,
          sizeBytes: fileBuffer.length
        });
      } catch {
        console.error("[Paid Asset Upload] Unexpected fail-closed error during private upload.");
        return res.status(503).json({
          success: false,
          code: "PRIVATE_STORAGE_UPLOAD_FAILED",
          error: "Private paid-asset storage upload failed. Please try again later."
        });
      }
    }
  );

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
