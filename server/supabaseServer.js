import { createClient } from "@supabase/supabase-js";

/**
 * UUID v4 validation regex
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates if a string is a standard UUID.
 * @param {string} id
 * @returns {boolean}
 */
export function isValidUUID(id) {
  return typeof id === "string" && UUID_REGEX.test(id.trim());
}

/**
 * Extracts and decodes a clean HTTP/HTTPS URL from potentially encoded environment strings.
 */
function sanitizeSupabaseUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  let decoded = rawUrl;
  try { decoded = decodeURIComponent(rawUrl); } catch {}
  const match = decoded.match(/https?:\/\/[^\s\n\r"'\\]+/);
  if (match) {
    try {
      new URL(match[0]);
      return match[0];
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Removes accidental whitespace/newlines and decodes keys.
 */
function sanitizeSupabaseKey(rawKey) {
  if (!rawKey || typeof rawKey !== 'string') return null;
  let decoded = rawKey;
  try { decoded = decodeURIComponent(rawKey); } catch {}
  const clean = decoded.replace(/\s+/g, '').trim();
  return clean.length > 20 ? clean : null;
}

/**
 * Cached singleton instance of the privileged Supabase server client.
 */
let supabaseServerInstance = null;

/**
 * Checks whether the privileged Supabase Service Role client can be initialized.
 * @returns {boolean}
 */
export function isSupabaseServerConfigured() {
  const url = sanitizeSupabaseUrl(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL);
  const serviceRoleKey = sanitizeSupabaseKey(process.env.SUPABASE_SERVICE_ROLE_KEY);
  return Boolean(url && serviceRoleKey);
}

/**
 * Lazily retrieves or initializes the privileged Supabase client using SUPABASE_SERVICE_ROLE_KEY.
 * This client bypasses RLS and must strictly be kept on the server.
 * Returns null if unconfigured, preventing startup crashes.
 * @returns {import('@supabase/supabase-js').SupabaseClient|null}
 */
export function getSupabaseServerClient() {
  const url = sanitizeSupabaseUrl(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL);
  const serviceRoleKey = sanitizeSupabaseKey(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!url || !serviceRoleKey) {
    return null;
  }

  if (!supabaseServerInstance) {
    supabaseServerInstance = createClient(url, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return supabaseServerInstance;
}

/**
 * Verifies a Supabase JWT access token and returns the authenticated user record.
 * Never trusts a client-supplied user ID; authenticates against Supabase Auth.
 *
 * @param {string} token - Bearer JWT from Authorization header
 * @returns {Promise<{ user: import('@supabase/supabase-js').User|null, error: any }>}
 */
export async function verifySupabaseToken(token) {
  if (!token || typeof token !== "string") {
    return { user: null, error: new Error("Authentication token is missing") };
  }

  const cleanToken = token.replace(/^Bearer\s+/i, "").trim();
  if (!cleanToken) {
    return { user: null, error: new Error("Malformed Bearer token") };
  }

  const url = sanitizeSupabaseUrl(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL);
  const key = sanitizeSupabaseKey(
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY
  );

  if (!url || !key) {
    return { user: null, error: new Error("Supabase is not configured on the server") };
  }

  try {
    const authClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data, error } = await authClient.auth.getUser(cleanToken);
    if (error || !data?.user) {
      return { user: null, error: error || new Error("User session invalid or expired") };
    }

    return { user: data.user, error: null };
  } catch (err) {
    return { user: null, error: err };
  }
}

/**
 * Checks if a user has admin privileges based on verified email or metadata.
 * @param {import('@supabase/supabase-js').User|null} user
 * @returns {boolean}
 */
export function checkIsAdmin(user) {
  if (!user) return false;
  const email = (user.email || '').toLowerCase().trim();
  const adminEmails = ['mkdigitalverse@gmail.com', 'admin@digitalmuid.com'];
  if (adminEmails.includes(email)) return true;
  if (user.app_metadata?.role === 'admin' || user.user_metadata?.role === 'admin') return true;
  return false;
}

/**
 * Returns a Supabase database client for server queries.
 * Prefers the privileged Service Role client if configured.
 * Otherwise, falls back to the public anon key client authenticated with the user's Bearer token.
 *
 * @param {string} [userToken] - Optional user Bearer token for RLS policy enforcement
 * @returns {import('@supabase/supabase-js').SupabaseClient|null}
 */
export function getSupabaseDbClient(userToken = null) {
  // 1. If service role key is available, use privileged client
  const serviceClient = getSupabaseServerClient();
  if (serviceClient) {
    return serviceClient;
  }

  // 2. Fall back to user-scoped client using public anon key
  const url = sanitizeSupabaseUrl(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL);
  const anonKey = sanitizeSupabaseKey(process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY);

  if (!url || !anonKey) {
    return null;
  }

  const cleanToken = userToken ? userToken.replace(/^Bearer\s+/i, "").trim() : null;

  const clientOptions = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  };

  if (cleanToken) {
    clientOptions.global = {
      headers: {
        Authorization: `Bearer ${cleanToken}`,
      },
    };
  }

  return createClient(url, anonKey, clientOptions);
}
