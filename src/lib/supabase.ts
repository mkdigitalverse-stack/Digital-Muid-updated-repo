import { createClient } from '@supabase/supabase-js';

// Safe unconfigured mock URL strictly to prevent createClient constructor from crashing at bundle load time
const UNCONFIGURED_PLACEHOLDER_URL = 'https://unconfigured-project.supabase.co';
const UNCONFIGURED_PLACEHOLDER_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.unconfigured_key';

/**
 * Validates whether the runtime environment has supplied a valid Supabase project URL.
 */
export const getEnvSupabaseUrl = (): string | null => {
  let envUrl: any = undefined;
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      envUrl = import.meta.env.VITE_SUPABASE_URL;
    }
  } catch {}
  if (!envUrl && typeof window !== 'undefined' && (window as any).__ENV__) {
    envUrl = (window as any).__ENV__.VITE_SUPABASE_URL;
  }
  if (!envUrl && typeof process !== 'undefined' && process.env) {
    envUrl = process.env.VITE_SUPABASE_URL;
  }

  if (typeof envUrl === 'string' && envUrl.trim().length > 0) {
    try {
      envUrl = decodeURIComponent(envUrl);
    } catch {}
    const match = envUrl.match(/https?:\/\/[^\s\n\r"'\\]+/);
    if (match) {
      try {
        new URL(match[0]);
        return match[0];
      } catch {
        return null;
      }
    }
  }
  return null;
};

/**
 * Validates whether the runtime environment has supplied a valid Supabase client anon key.
 */
export const getEnvSupabaseAnonKey = (): string | null => {
  let envKey: any = undefined;
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    }
  } catch {}
  if (!envKey && typeof window !== 'undefined' && (window as any).__ENV__) {
    envKey = (window as any).__ENV__.VITE_SUPABASE_ANON_KEY;
  }
  if (!envKey && typeof process !== 'undefined' && process.env) {
    envKey = process.env.VITE_SUPABASE_ANON_KEY;
  }

  if (typeof envKey === 'string' && envKey.trim().length > 0) {
    try {
      envKey = decodeURIComponent(envKey);
    } catch {}
    const match = envKey.match(/(?:sb_publishable_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|[A-Za-z0-9_.-]{30,})/);
    const key = match ? match[0] : envKey.trim();
    if (
      key !== 'YOUR_SUPABASE_ANON_KEY' &&
      key.length > 20 &&
      !key.includes('unconfigured') &&
      !key.includes('placeholder')
    ) {
      return key;
    }
  }
  return null;
};

/**
 * Checks if Supabase authentication and backend are properly configured.
 */
export const getSupabaseConfigStatus = (): { isConfigured: boolean; error?: string } => {
  const validUrl = getEnvSupabaseUrl();
  const validKey = getEnvSupabaseAnonKey();

  if (!validUrl) {
    return {
      isConfigured: false,
      error: 'VITE_SUPABASE_URL is missing or is not a valid HTTP/HTTPS URL.'
    };
  }

  if (!validKey) {
    return {
      isConfigured: false,
      error: 'VITE_SUPABASE_ANON_KEY is missing or invalid in environment variables.'
    };
  }

  return { isConfigured: true };
};

export const isSupabaseConfigured = (): boolean => {
  return getSupabaseConfigStatus().isConfigured;
};

const activeUrl = getEnvSupabaseUrl() || UNCONFIGURED_PLACEHOLDER_URL;
const activeKey = getEnvSupabaseAnonKey() || UNCONFIGURED_PLACEHOLDER_KEY;

/**
 * Singleton Supabase Client instance for client-side operations.
 * Uses public publishable/anon key only. Never expose service_role keys on the frontend.
 */
export const supabase = createClient(activeUrl, activeKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'digital_muid_supabase_auth_token'
  }
});

