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
  trackGrowthAuditCta: (sourceSection: string = 'hero', destination: string = '/growth-audit') => {
    trackEvent('growth_audit_cta_click', {
      cta_name: 'Request growth audit',
      destination,
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
  }
};
