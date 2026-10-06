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

    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';
    const existingScript = document.querySelector(`script[src="${SCRIPT_URL}"]`);

    if (existingScript) {
      if (window.Razorpay) {
        resolve(true);
      } else {
        existingScript.addEventListener('load', () => resolve(true), { once: true });
        existingScript.addEventListener('error', () => resolve(false), { once: true });
      }
      return;
    }

    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.error('[Razorpay Loader] Failed to load Razorpay Checkout SDK script.');
      resolve(false);
    };

    document.body.appendChild(script);
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
