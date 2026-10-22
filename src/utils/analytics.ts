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
