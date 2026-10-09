import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { WebEnquiry, WebEnquiryDetails, WebEnquiryStatus } from '../types';

/**
 * Transforms a Supabase crm_leads row with source='Web Enquiry' into a domain WebEnquiry.
 */
export const mapDbRowToWebEnquiry = (row: any): WebEnquiry => {
  let details: WebEnquiryDetails = {
    projectType: 'New business website',
    businessName: row.name || 'Business Project',
    businessStage: 'Operating',
    goals: [],
    features: [],
    contentReadiness: 'In progress',
    timeline: 'Within 2–4 weeks',
    readiness: 'Ready to discuss',
    decisionMaker: 'I will decide',
    webStatus: 'New',
    internalNotes: '',
    assignedTo: '',
    followUpDate: '',
    contactAttempts: 0
  };

  if (row.notes) {
    try {
      const parsed = JSON.parse(row.notes);
      if (typeof parsed === 'object' && parsed !== null) {
        details = {
          ...details,
          ...parsed
        };
      }
    } catch {
      details.internalNotes = row.notes;
    }
  }

  // Determine effective status: prefer webStatus in structured details, fallback to DB status
  const effectiveStatus: WebEnquiryStatus =
    details.webStatus || (row.status === 'Converted' ? 'Won' : row.status || 'New');

  // Derive reference ID from UUID or timestamp
  const year = row.created_at ? new Date(row.created_at).getFullYear() : new Date().getFullYear();
  const shortId = (row.id || '').replace(/-/g, '').slice(0, 4).toUpperCase();
  const referenceId = `WEB-${year}-${shortId || '1001'}`;

  return {
    id: row.id,
    referenceId,
    name: row.name || '',
    email: row.email || '',
    phone: row.phone || '',
    businessName: details.businessName || row.name || 'Project',
    projectType: details.projectType || 'Website Project',
    timeline: details.timeline || 'Flexible',
    source: 'Web Enquiry',
    details,
    status: effectiveStatus,
    createdAt: row.created_at || new Date().toISOString()
  };
};

export const webEnquiryService = {
  /**
   * Submits a new Web Enquiry via secure server API.
   * Handles client-side offline/direct-fallback gracefully if necessary.
   */
  async submitEnquiry(payload: {
    fullName: string;
    email: string;
    phone: string;
    businessName: string;
    projectType: string;
    businessStage: string;
    goals: string[];
    features: string[];
    contentReadiness: string;
    existingWebsiteUrl?: string;
    referenceUrls?: string;
    timeline: string;
    readiness: string;
    decisionMaker: string;
    additionalRequirements?: string;
    consentAgreed: boolean;
  }): Promise<{ success: boolean; referenceId?: string; id?: string; error?: string }> {
    try {
      const response = await fetch('/api/web-enquiries/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        return {
          success: false,
          error: result.error || 'Failed to submit enquiry. Please check your details and try again.'
        };
      }

      return {
        success: true,
        referenceId: result.referenceId,
        id: result.id
      };
    } catch (err: any) {
      console.error('[webEnquiryService] Submit error:', err);
      return {
        success: false,
        error: err?.message || 'Network error while connecting to server. Please try again.'
      };
    }
  },

  /**
   * Fetches all web enquiries for authenticated CRM administrators.
   * Calls /api/web-enquiries/admin/all with fallback to direct Supabase query under admin session.
   */
  async fetchAdminWebEnquiries(): Promise<{ data: WebEnquiry[]; error: any }> {
    try {
      if (isSupabaseConfigured()) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          try {
            const res = await fetch('/api/web-enquiries/admin/all', {
              headers: {
                Authorization: `Bearer ${session.access_token}`
              }
            });
            if (res.ok) {
              const json = await res.json();
              if (json.success && Array.isArray(json.enquiries)) {
                return {
                  data: json.enquiries.map(mapDbRowToWebEnquiry),
                  error: null
                };
              }
            }
          } catch (apiErr) {
            console.warn('[webEnquiryService] Server API notice, falling back:', apiErr);
          }
        }

        // Direct query fallback under authenticated session
        const { data, error } = await supabase
          .from('crm_leads')
          .select('*')
          .eq('source', 'Web Enquiry')
          .order('created_at', { ascending: false });

        if (!error && data) {
          return {
            data: data.map(mapDbRowToWebEnquiry),
            error: null
          };
        }
        if (error) {
          return { data: [], error };
        }
      }

      return { data: [], error: null };
    } catch (err: any) {
      console.error('[webEnquiryService] Fetch error:', err);
      return { data: [], error: err };
    }
  },

  /**
   * Updates status, internal notes, or follow-up details for a web enquiry.
   */
  async updateWebEnquiry(
    id: string,
    updates: {
      status?: WebEnquiryStatus;
      internalNotes?: string;
      assignedTo?: string;
      followUpDate?: string;
      contactAttempts?: number;
    }
  ): Promise<{ success: boolean; data?: WebEnquiry; error?: any }> {
    try {
      if (isSupabaseConfigured()) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          try {
            const res = await fetch(`/api/web-enquiries/admin/${id}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`
              },
              body: JSON.stringify(updates)
            });
            if (res.ok) {
              const json = await res.json();
              if (json.success && json.enquiry) {
                return {
                  success: true,
                  data: mapDbRowToWebEnquiry(json.enquiry),
                  error: null
                };
              }
            }
          } catch (apiErr) {
            console.warn('[webEnquiryService] Server update notice, falling back:', apiErr);
          }
        }

        // Fallback: fetch row and update notes JSON directly
        const { data: current } = await supabase
          .from('crm_leads')
          .select('*')
          .eq('id', id)
          .single();

        if (current) {
          let parsed: any = {};
          try { parsed = JSON.parse(current.notes || '{}'); } catch {}
          if (updates.status) parsed.webStatus = updates.status;
          if (updates.internalNotes !== undefined) parsed.internalNotes = updates.internalNotes;
          if (updates.assignedTo !== undefined) parsed.assignedTo = updates.assignedTo;
          if (updates.followUpDate !== undefined) parsed.followUpDate = updates.followUpDate;
          if (updates.contactAttempts !== undefined) parsed.contactAttempts = updates.contactAttempts;

          let crmStatus = 'New';
          if (updates.status === 'Contacted') crmStatus = 'Contacted';
          else if (updates.status === 'Qualified' || updates.status === 'Proposal Sent') crmStatus = 'Qualified';
          else if (updates.status === 'Won') crmStatus = 'Converted';
          else if (updates.status === 'Lost') crmStatus = 'Lost';

          const { data: updated, error: updateErr } = await supabase
            .from('crm_leads')
            .update({
              notes: JSON.stringify(parsed),
              status: crmStatus
            })
            .eq('id', id)
            .select()
            .single();

          if (!updateErr && updated) {
            return {
              success: true,
              data: mapDbRowToWebEnquiry(updated),
              error: null
            };
          }
          return { success: false, error: updateErr };
        }
      }

      return { success: false, error: new Error('Supabase not configured') };
    } catch (err: any) {
      console.error('[webEnquiryService] Update error:', err);
      return { success: false, error: err };
    }
  },

  /**
   * Deletes a web enquiry from the database.
   */
  async deleteWebEnquiry(id: string): Promise<{ success: boolean; error?: any }> {
    try {
      if (isSupabaseConfigured()) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          try {
            const res = await fetch(`/api/web-enquiries/admin/${id}`, {
              method: 'DELETE',
              headers: {
                Authorization: `Bearer ${session.access_token}`
              }
            });
            if (res.ok) {
              const json = await res.json();
              if (json.success) return { success: true };
            }
          } catch (apiErr) {
            console.warn('[webEnquiryService] Server delete notice:', apiErr);
          }
        }

        const { error } = await supabase
          .from('crm_leads')
          .delete()
          .eq('id', id)
          .eq('source', 'Web Enquiry');

        if (!error) return { success: true };
        return { success: false, error };
      }

      return { success: false, error: new Error('Supabase not configured') };
    } catch (err: any) {
      console.error('[webEnquiryService] Delete error:', err);
      return { success: false, error: err };
    }
  }
};
