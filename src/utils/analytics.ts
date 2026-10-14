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

export function trackEvent(eventName: string, params: Record<string, any> = {}): void {
  try {
    if (typeof window !== 'undefined') {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: eventName,
        timestamp: new Date().toISOString(),
        ...params
      });
    }
  } catch (err) {
    // Fail silently in environments without window / dataLayer
  }
}

// Named tracking helpers for Homepage key conversion interactions
export const analytics = {
  trackGrowthAuditCta: (sourceSection: string = 'hero') => {
    trackEvent('growth_audit_cta_click', {
      cta_name: 'Build my growth engine / Request growth audit',
      destination: '/business-growth-consultation',
      source_section: sourceSection
    });
  },

  trackAcademyCta: (sourceSection: string = 'hero') => {
    trackEvent('academy_cta_click', {
      cta_name: 'Master the mechanics / Explore the academy',
      destination: '/learn',
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

  trackProofInteraction: (action: string, label: string) => {
    trackEvent('proof_interaction', {
      action,
      label
    });
  },

  trackTeardownReview: (teardownId: string, teardownTitle: string) => {
    trackEvent('teardown_review_click', {
      teardown_id: teardownId,
      teardown_title: teardownTitle
    });
  }
};
