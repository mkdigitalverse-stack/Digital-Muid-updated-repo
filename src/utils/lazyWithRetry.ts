import React, { lazy } from 'react';

const RELOAD_GUARD_PREFIX = 'dm_module_reload_guard_';
const RELOAD_COOLDOWN_MS = 15_000;

/**
 * Detects browser dynamic ES module / chunk load failures caused by:
 * - Transient preview/auth proxy redirects (CORS error on module script)
 * - HTML returned instead of JavaScript (invalid MIME type for module script)
 * - Stale chunk hashes after a deployment or dev server restart
 */
export function isDynamicImportError(error: unknown): boolean {
  if (!error) return false;
  const message =
    typeof error === 'string'
      ? error
      : String((error as any)?.message || (error as any)?.reason?.message || error);
  const lower = message.toLowerCase();
  return (
    lower.includes('is not a valid javascript mime type') ||
    lower.includes('cross-origin script load denied') ||
    lower.includes('failed to fetch dynamically imported module') ||
    lower.includes('importing a module script failed') ||
    lower.includes('error loading dynamically imported module') ||
    lower.includes('loading chunk') ||
    lower.includes('loading css chunk') ||
    (error as any)?.name === 'ChunkLoadError'
  );
}

/**
 * Performs a single loop-guarded full page reload to clear poisoned browser ES module
 * caches and refresh preview/session cookies. Returns true if a reload was initiated.
 */
export function triggerGuardedModuleReload(scopeKey?: string): boolean {
  if (typeof window === 'undefined') return false;
  const key = `${RELOAD_GUARD_PREFIX}${scopeKey || window.location.pathname || '/'}`;
  const now = Date.now();

  try {
    const lastAttemptRaw = window.sessionStorage?.getItem(key);
    const lastAttempt = lastAttemptRaw ? parseInt(lastAttemptRaw, 10) : 0;
    if (Number.isFinite(lastAttempt) && now - lastAttempt < RELOAD_COOLDOWN_MS) {
      return false;
    }
    window.sessionStorage?.setItem(key, String(now));
  } catch {
    // If sessionStorage is unavailable, avoid risking an unbounded reload loop
    return false;
  }

  window.location.reload();
  return true;
}

/**
 * Wraps React.lazy with automatic loop-guarded reload recovery when a route's
 * dynamic ES module fails due to MIME type, CORS redirect, or stale chunk errors.
 */
export function lazyWithRetry<T extends React.ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  routeKey: string
): React.LazyExoticComponent<T> {
  return lazy(() =>
    importer().catch((err) => {
      if (isDynamicImportError(err)) {
        const reloaded = triggerGuardedModuleReload(routeKey);
        if (reloaded) {
          // Keep Suspense fallback visible while the browser completes the reload
          return new Promise<{ default: T }>(() => {});
        }
      }
      throw err;
    })
  );
}
