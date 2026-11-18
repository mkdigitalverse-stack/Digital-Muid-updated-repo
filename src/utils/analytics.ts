/**
 * DigitalMUID — Analytics Event Helper (GTM / GA4 DataLayer)
 *
 * Dispatches structured, privacy-compliant events to window.dataLayer.
 * Does not send PII (no raw email addresses, names, or passwords).
 */

declare global {
  interface Window {
    dataLayer?: any[];
  }
}

export interface AnalyticsEventPayload {
  event: string;
  cta_name?: string;
  destination?: string;
  framework_name?: string;
  resource_title?: string;
  source_section?: string;
  [key: string]: any;
}

const SENSITIVE_NORMALIZED_KEYS = new Set([
  'token',
  'accesstoken',
  'resourceaccesstoken',
  'invoicetoken',
  'assettoken',
  'guesttoken'
]);

const MAX_SANITIZATION_DEPTH = 12;

function tryDecodeURIComponentRepeated(input: string, maxPasses = 2): { value: string; error: boolean } {
  let current = input;
  for (let i = 0; i < maxPasses; i++) {
    if (!current.includes('%')) break;
    try {
      const decoded = decodeURIComponent(current);
      if (decoded === current) break;
      current = decoded;
    } catch {
      return { value: current, error: true };
    }
  }
  return { value: current, error: false };
}

function normalizeSensitiveKey(rawKey: string): string {
  return rawKey.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function checkSensitiveParamKey(rawKey: string): { isSensitive: boolean; unsafe: boolean } {
  if (!rawKey) return { isSensitive: false, unsafe: false };
  if (SENSITIVE_NORMALIZED_KEYS.has(normalizeSensitiveKey(rawKey))) {
    return { isSensitive: true, unsafe: false };
  }
  if (rawKey.includes('%')) {
    const decoded = tryDecodeURIComponentRepeated(rawKey, 3);
    if (decoded.error) {
      return { isSensitive: false, unsafe: true };
    }
    if (SENSITIVE_NORMALIZED_KEYS.has(normalizeSensitiveKey(decoded.value))) {
      return { isSensitive: true, unsafe: false };
    }
  }
  return { isSensitive: false, unsafe: false };
}

function sanitizeQueryPairs(
  rawQuery: string,
  depth = 0
): { cleaned: string; ok: boolean; hadSensitive: boolean } {
  if (!rawQuery) return { cleaned: '', ok: true, hadSensitive: false };
  if (depth > 3) return { cleaned: '', ok: false, hadSensitive: true };

  const segments = rawQuery.split('&');
  const kept: string[] = [];
  let hadSensitive = false;

  for (const seg of segments) {
    if (!seg) continue;
    const eqIdx = seg.indexOf('=');
    const rawKey = eqIdx >= 0 ? seg.slice(0, eqIdx) : seg;
    const keyCheck = checkSensitiveParamKey(rawKey);
    if (keyCheck.unsafe) {
      return { cleaned: '', ok: false, hadSensitive: true };
    }
    if (keyCheck.isSensitive) {
      hadSensitive = true;
      continue;
    }

    if (eqIdx >= 0) {
      const rawVal = seg.slice(eqIdx + 1);
      if (rawVal.includes('%')) {
        const decodedVal = tryDecodeURIComponentRepeated(rawVal, 2);
        if (!decodedVal.error && decodedVal.value !== rawVal && /[?&=]/.test(decodedVal.value)) {
          const nested = sanitizeUrlOrQueryString(decodedVal.value, depth + 1);
          if (!nested.ok) {
            return { cleaned: '', ok: false, hadSensitive: true };
          }
          if (nested.changed) {
            hadSensitive = true;
            kept.push(`${rawKey}=${encodeURIComponent(nested.value)}`);
            continue;
          }
        } else if (decodedVal.error && /(?:token|resource_?access)/i.test(rawVal)) {
          return { cleaned: '', ok: false, hadSensitive: true };
        }
      } else if (/^https?:\/\//i.test(rawVal) || (rawVal.startsWith('/') && rawVal.includes('?'))) {
        const nested = sanitizeUrlOrQueryString(rawVal, depth + 1);
        if (!nested.ok) {
          return { cleaned: '', ok: false, hadSensitive: true };
        }
        if (nested.changed) {
          hadSensitive = true;
          kept.push(`${rawKey}=${nested.value}`);
          continue;
        }
      }
    }

    kept.push(seg);
  }

  return { cleaned: kept.join('&'), ok: true, hadSensitive };
}

function sanitizeHashFragment(
  rawHash: string,
  depth = 0
): { cleaned: string; ok: boolean; changed: boolean } {
  if (!rawHash) return { cleaned: '', ok: true, changed: false };
  const withoutPound = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;
  const qIdx = withoutPound.indexOf('?');

  if (qIdx >= 0) {
    const hashPath = withoutPound.slice(0, qIdx);
    const hashQuery = withoutPound.slice(qIdx + 1);
    const res = sanitizeQueryPairs(hashQuery, depth);
    if (!res.ok) return { cleaned: '', ok: false, changed: true };
    if (!res.cleaned && !hashPath) {
      return { cleaned: '', ok: true, changed: res.hadSensitive || hashQuery.length > 0 };
    }
    const nextHash = `#${hashPath}${res.cleaned ? `?${res.cleaned}` : ''}`;
    return { cleaned: nextHash, ok: true, changed: res.hadSensitive };
  }

  if (withoutPound.includes('=')) {
    const res = sanitizeQueryPairs(withoutPound, depth);
    if (!res.ok) return { cleaned: '', ok: false, changed: true };
    if (!res.hadSensitive) return { cleaned: rawHash, ok: true, changed: false };
    return { cleaned: res.cleaned ? `#${res.cleaned}` : '', ok: true, changed: true };
  }

  return { cleaned: rawHash, ok: true, changed: false };
}

function sanitizeUrlOrQueryString(
  raw: string,
  depth = 0
): { value: string; ok: boolean; changed: boolean } {
  if (depth > 3) return { value: '', ok: false, changed: true };

  // Split hash first
  const hashIdx = raw.indexOf('#');
  const beforeHash = hashIdx >= 0 ? raw.slice(0, hashIdx) : raw;
  const rawHash = hashIdx >= 0 ? raw.slice(hashIdx) : '';

  const qIdx = beforeHash.indexOf('?');
  const basePart = qIdx >= 0 ? beforeHash.slice(0, qIdx) : beforeHash;
  const rawQuery = qIdx >= 0 ? beforeHash.slice(qIdx + 1) : '';

  let cleanedQuery = '';
  let changed = false;
  if (qIdx >= 0) {
    const qRes = sanitizeQueryPairs(rawQuery, depth);
    if (!qRes.ok) return { value: '', ok: false, changed: true };
    cleanedQuery = qRes.cleaned;
    changed = qRes.hadSensitive;
  } else if (!/^https?:\/\//i.test(beforeHash) && !beforeHash.startsWith('/') && beforeHash.includes('=')) {
    // Bare query-like string without leading '?' (e.g., "orderId=1&token=SECRET")
    const bareRes = sanitizeQueryPairs(beforeHash, depth);
    if (!bareRes.ok) return { value: '', ok: false, changed: true };
    if (bareRes.hadSensitive) {
      const hRes = sanitizeHashFragment(rawHash, depth);
      if (!hRes.ok) return { value: '', ok: false, changed: true };
      const combinedBare = `${bareRes.cleaned}${hRes.cleaned}`;
      return { value: combinedBare, ok: true, changed: true };
    }
  }

  const hRes = sanitizeHashFragment(rawHash, depth);
  if (!hRes.ok) return { value: '', ok: false, changed: true };
  if (hRes.changed) changed = true;

  const rebuilt = `${basePart}${cleanedQuery ? `?${cleanedQuery}` : ''}${hRes.cleaned}`;
  return { value: rebuilt, ok: true, changed };
}

function hasResidualSensitiveQuery(str: string): boolean {
  if (!str.includes('=')) return false;
  const decoded = tryDecodeURIComponentRepeated(str, 2);
  if (decoded.error && /(?:token|resource_?access)/i.test(str) && /[?&#=]/.test(str)) {
    return true;
  }
  const target = decoded.value;
  return /(?:^|[?&#\s])(?:token|access[\s_-]*token|resource[\s_-]*access[\s_-]*token|invoice[\s_-]*token|asset[\s_-]*token|guest[\s_-]*token)\s*=/i.test(
    target
  );
}

function sanitizeStringValue(input: string): string | undefined {
  try {
    if (!input) return input;
    const trimmed = input.trim();

    // Case 1: Standalone HTTP(S) URL, protocol-relative URL, relative path with query/hash, or query/hash string
    const isStandaloneUrl =
      !/\s/.test(trimmed) &&
      (/^https?:\/\//i.test(trimmed) ||
        /^\/\/[^\s]+/.test(trimmed) ||
        (trimmed.startsWith('/') && (trimmed.includes('?') || trimmed.includes('#'))) ||
        ((trimmed.startsWith('?') || trimmed.startsWith('#')) && trimmed.includes('=')) ||
        (!trimmed.includes(' ') && trimmed.includes('=') && trimmed.includes('&')));

    if (isStandaloneUrl) {
      const res = sanitizeUrlOrQueryString(trimmed);
      if (!res.ok) return undefined;
      if (hasResidualSensitiveQuery(res.value)) return undefined;
      // Preserve empty omission if input was solely a sensitive bare query parameter (e.g., "token=SECRET")
      if (!res.value && res.changed && !trimmed.startsWith('http') && !trimmed.startsWith('/')) {
        return undefined;
      }
      return res.value;
    }

    // Case 2: Text containing embedded URLs (e.g., "Visit https://digitalmuid.in/paid?token=SECRET")
    let out = input;
    if (/https?:\/\/[^\s"'<>]+/i.test(out)) {
      let failed = false;
      out = out.replace(/https?:\/\/[^\s"'<>]+/gi, (matchedUrl) => {
        const res = sanitizeUrlOrQueryString(matchedUrl);
        if (!res.ok || hasResidualSensitiveQuery(res.value)) {
          failed = true;
          return '';
        }
        return res.value;
      });
      if (failed) return undefined;
    }

    if (hasResidualSensitiveQuery(out)) {
      return undefined;
    }

    return out;
  } catch {
    return undefined;
  }
}

function sanitizeValue(value: any, ancestors: WeakSet<object>, depth: number): any {
  if (depth > MAX_SANITIZATION_DEPTH) {
    return undefined;
  }

  if (value === null || value === undefined) return value;

  const t = typeof value;
  if (t === 'string') {
    return sanitizeStringValue(value);
  }
  if (t === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (t === 'boolean') {
    return value;
  }
  if (t === 'bigint') {
    return value.toString();
  }
  if (t === 'function' || t === 'symbol') {
    return undefined;
  }

  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : undefined;
  }

  if (typeof value !== 'object') {
    return undefined;
  }

  if (ancestors.has(value)) {
    // Circular reference: fail closed by omitting cyclic edge
    return undefined;
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      const sanitizedArr: any[] = [];
      for (let i = 0; i < value.length; i++) {
        try {
          const item = value[i];
          const cleanItem = sanitizeValue(item, ancestors, depth + 1);
          if (cleanItem !== undefined) {
            sanitizedArr.push(cleanItem);
          }
        } catch {
          // Omit unreadable/throwing array element
        }
      }
      return sanitizedArr;
    }

    // Fail closed for non-plain objects (Error, Map, Set, DOM nodes, custom class instances)
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      return undefined;
    }

    const out: Record<string, any> = {};
    let keys: string[];
    try {
      keys = Object.keys(value);
    } catch {
      return undefined;
    }

    for (const key of keys) {
      const keyCheck = checkSensitiveParamKey(key);
      if (keyCheck.unsafe || keyCheck.isSensitive) {
        continue;
      }

      let rawProp: any;
      try {
        rawProp = value[key];
      } catch {
        // Omit property if getter throws
        continue;
      }

      const cleanProp = sanitizeValue(rawProp, ancestors, depth + 1);
      if (cleanProp !== undefined) {
        out[key] = cleanProp;
      }
    }
    return out;
  } finally {
    ancestors.delete(value);
  }
}

function getSanitizedLocation(): { page_location?: string; page_path?: string } {
  if (typeof window === 'undefined') return {};
  try {
    const rawHref = window.location?.href;
    if (typeof rawHref !== 'string' || !rawHref) return {};
    const parsed = new URL(rawHref);
    const rebuiltRaw = `${parsed.origin}${parsed.pathname}${parsed.search || ''}${parsed.hash || ''}`;
    const res = sanitizeUrlOrQueryString(rebuiltRaw);
    if (!res.ok || hasResidualSensitiveQuery(res.value)) {
      return {};
    }
    const cleanUrl = new URL(res.value);
    const cleanSearch = cleanUrl.search || '';
    const cleanHash = cleanUrl.hash || '';
    return {
      page_location: `${cleanUrl.origin}${cleanUrl.pathname}${cleanSearch}${cleanHash}`,
      page_path: `${cleanUrl.pathname}${cleanSearch}${cleanHash}`
    };
  } catch {
    return {};
  }
}

function sanitizeEventParams(input: Record<string, any>): Record<string, any> | undefined {
  try {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return {};
    }
    const sanitized = sanitizeValue(input, new WeakSet<object>(), 0);
    if (!sanitized || typeof sanitized !== 'object' || Array.isArray(sanitized)) {
      return undefined;
    }
    return sanitized;
  } catch {
    return undefined;
  }
}

export function trackEvent(eventName: string, params: Record<string, any> = {}): void {
  try {
    if (typeof window === 'undefined') return;
    if (typeof eventName !== 'string' || !eventName.trim()) return;
    const cleanEventName = sanitizeStringValue(eventName.trim());
    if (!cleanEventName) return;

    const cleanLocation = getSanitizedLocation();
    const cleanParams = sanitizeEventParams(params);
    if (cleanParams === undefined) {
      // Fail closed: do not push raw/unsanitized params to dataLayer
      return;
    }

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: cleanEventName,
      timestamp: new Date().toISOString(),
      ...cleanLocation,
      ...cleanParams
    });
  } catch {
    // Fail closed silently — never push raw unsanitized data
  }
}

// Named tracking helpers for Homepage key conversion interactions
export const analytics = {
  trackGrowthAuditCta: (sourceSection: string = 'hero', destination: string = '/growth-audit') => {
    trackEvent('growth_audit_cta_click', {
      cta_name: 'Request growth audit',
      destination,
      source_section: sourceSection
    });
  },

  trackConsultationCta: (sourceSection: string = 'navbar', destination: string = '/business-growth-consultation') => {
    trackEvent('consultation_cta_click', {
      cta_name: 'Book Consultation',
      destination,
      source_section: sourceSection
    });
  },

  trackAcademyCta: (sourceSection: string = 'hero', destination: string = '/academy') => {
    trackEvent('academy_cta_click', {
      cta_name: 'Master the mechanics / Explore the academy',
      destination,
      source_section: sourceSection
    });
  },

  trackFrameworkClick: (frameworkSlug: string, frameworkTitle: string) => {
    trackEvent('framework_link_click', {
      framework_slug: frameworkSlug,
      framework_title: frameworkTitle,
      destination: `/frameworks/${frameworkSlug}`
    });
  },

  trackOperatorProfileClick: () => {
    trackEvent('operator_profile_click', {
      cta_name: 'Read the full story',
      destination: '/about'
    });
  },

  trackDiagnosticFormSubmit: (resourceTitle: string) => {
    trackEvent('diagnostic_form_submit', {
      resource_title: resourceTitle,
      status: 'success'
    });
  },

  trackDiagnosticDownload: (fileName: string) => {
    trackEvent('diagnostic_download', {
      file_name: fileName,
      status: 'delivered'
    });
  },

  trackArticleClick: (articleSlug: string, articleTitle: string) => {
    trackEvent('article_card_click', {
      article_slug: articleSlug,
      article_title: articleTitle,
      destination: `/blog/${articleSlug}`
    });
  },

  trackVslInteraction: (action: string) => {
    trackEvent('vsl_interaction', {
      action: action,
      video_title: 'How we engineer digital growth in 2026'
    });
  },

  trackGrowthAuditFormStart: () => {
    trackEvent('growth_audit_form_start', {
      form_name: 'Request Growth Audit Qualification',
      timestamp: new Date().toISOString()
    });
  },

  trackGrowthAuditStepComplete: (stepNumber: number, stepName: string) => {
    trackEvent('growth_audit_step_complete', {
      step_number: stepNumber,
      step_name: stepName
    });
  },

  trackGrowthAuditFormSubmit: (status: 'qualified' | 'academy_nurture' | 'startup_review') => {
    trackEvent('growth_audit_form_submit', {
      qualification_status: status,
      status: 'submitted'
    });
  },

  trackGrowthAuditQualified: (qualificationStatus: string) => {
    trackEvent('growth_audit_qualified', {
      qualification_status: qualificationStatus
    });
  },

  trackGrowthAuditAcademyRedirect: () => {
    trackEvent('growth_audit_academy_redirect', {
      destination: '/learn',
      action: 'explore_academy_click'
    });
  },

  trackGrowthAuditBookingStart: () => {
    trackEvent('growth_audit_booking_start', {
      action: 'calendar_opened'
    });
  },

  trackGrowthAuditBookingConfirmed: (bookingRef: string, date: string, time: string) => {
    trackEvent('growth_audit_booking_confirmed', {
      booking_reference: bookingRef,
      appointment_date: date,
      appointment_time: time,
      status: 'confirmed'
    });
  },

  /**
   * Dispatched strictly after a visitor's free resource lead enquiry is saved in the database.
   * Never sends PII (no names, phones, or raw email addresses).
   */
  trackFreeResourceLeadConversion: (params: {
    resourceId: string;
    resourceTitle: string;
    submissionId: string;
    resourceType?: string;
    sourcePage?: string;
  }) => {
    trackEvent('free_resource_lead_conversion', {
      resource_id: params.resourceId,
      resource_title: params.resourceTitle,
      submission_id: params.submissionId,
      resource_type: params.resourceType || 'lead_magnet',
      source_page: params.sourcePage || '/resources',
      conversion_timestamp: new Date().toISOString(),
      event_id: params.submissionId
    });
  },

  /**
   * Dispatched when an authorized free resource file download is initiated.
   */
  trackFreeResourceDownload: (params: {
    resourceId: string;
    resourceTitle: string;
    fileType?: string;
  }) => {
    trackEvent('free_resource_download', {
      resource_id: params.resourceId,
      resource_title: params.resourceTitle,
      file_type: params.fileType || 'digital_asset',
      download_timestamp: new Date().toISOString()
    });
  },

  /**
   * Dispatched when a paid resource checkout/order is created on the server.
   */
  trackPaidCheckoutInitiated: (params: {
    resourceId: string;
    resourceTitle: string;
    orderId: string;
    amount: number;
    currency?: string;
  }) => {
    trackEvent('paid_checkout_initiated', {
      resource_id: params.resourceId,
      resource_title: params.resourceTitle,
      order_id: params.orderId,
      amount: params.amount,
      currency: params.currency || 'INR',
      timestamp: new Date().toISOString()
    });
  },

  /**
   * Dispatched ONLY after cryptographic server-side HMAC payment verification succeeds.
   * Never sends payment secrets or customer PII.
   */
  trackPaidResourcePurchase: (params: {
    resourceId: string;
    resourceTitle: string;
    orderId: string;
    paymentId: string;
    amount: number;
    currency?: string;
  }) => {
    trackEvent('paid_resource_purchase_conversion', {
      resource_id: params.resourceId,
      resource_title: params.resourceTitle,
      order_id: params.orderId,
      payment_id: params.paymentId,
      amount: params.amount,
      currency: params.currency || 'INR',
      conversion_timestamp: new Date().toISOString(),
      event_id: params.orderId || params.paymentId
    });
  },

  /**
   * Dispatched when an authorized paid resource file download is initiated.
   */
  trackPaidResourceDownload: (params: {
    resourceId: string;
    resourceTitle: string;
    orderId?: string;
  }) => {
    trackEvent('paid_resource_download', {
      resource_id: params.resourceId,
      resource_title: params.resourceTitle,
      order_id: params.orderId || undefined,
      download_timestamp: new Date().toISOString()
    });
  }
};
