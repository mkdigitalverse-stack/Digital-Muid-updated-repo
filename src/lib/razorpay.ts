/**
 * Browser-safe Razorpay Checkout SDK loader and client helpers.
 *
 * CRITICAL SECURITY GUARANTEES:
 * - Only uses public browser key: VITE_RAZORPAY_KEY_ID.
 * - NEVER imports or handles server secrets (RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY).
 * - All order pricing and parameters originate strictly from server endpoints.
 */

declare global {
  interface Window {
    Razorpay?: any;
    __ENV__?: Record<string, string>;
  }
}

/**
 * Loads the official Razorpay Checkout SDK script dynamically.
 * Resolves to true if window.Razorpay is ready, or false if the network request fails.
 */
export function loadRazorpayCheckoutScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }

    if (typeof window.Razorpay === 'function') {
      resolve(true);
      return;
    }

    const SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';
    const existingScript = document.querySelector(`script[src="${SCRIPT_URL}"]`) as HTMLScriptElement | null;

    let hasResolved = false;
    const safeResolve = (val: boolean) => {
      if (!hasResolved) {
        hasResolved = true;
        clearInterval(pollTimer);
        clearTimeout(timeoutTimer);
        resolve(val);
      }
    };

    // Polling mechanism to immediately catch window.Razorpay availability even if load event already fired
    const pollTimer = setInterval(() => {
      if (typeof window.Razorpay === 'function') {
        safeResolve(true);
      }
    }, 50);

    // 5-second safety timeout so checkout never hangs
    const timeoutTimer = setTimeout(() => {
      if (typeof window.Razorpay === 'function') {
        safeResolve(true);
      } else {
        console.warn('[Razorpay Loader] Timed out waiting for Razorpay Checkout SDK.');
        safeResolve(false);
      }
    }, 5000);

    if (existingScript) {
      if (typeof window.Razorpay === 'function') {
        safeResolve(true);
        return;
      }

      existingScript.addEventListener('load', () => {
        if (typeof window.Razorpay === 'function') {
          safeResolve(true);
        }
      }, { once: true });

      existingScript.addEventListener('error', () => {
        console.error('[Razorpay Loader] Existing script encountered network error.');
        safeResolve(false);
      }, { once: true });

      return;
    }

    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      if (typeof window.Razorpay === 'function') {
        safeResolve(true);
      }
    };
    script.onerror = () => {
      console.error('[Razorpay Loader] Failed to load Razorpay Checkout SDK script.');
      safeResolve(false);
    };

    document.head.appendChild(script);
  });
}

/**
 * Returns the public Razorpay Key ID configured for the frontend environment.
 */
export function getClientRazorpayKeyId(): string | null {
  let key: any = undefined;

  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      key = import.meta.env.VITE_RAZORPAY_KEY_ID;
    }
  } catch {}

  if (!key && typeof window !== 'undefined' && window.__ENV__) {
    key = window.__ENV__.VITE_RAZORPAY_KEY_ID;
  }

  if (typeof key === 'string' && key.trim().length > 0) {
    return key.trim();
  }

  return null;
}
