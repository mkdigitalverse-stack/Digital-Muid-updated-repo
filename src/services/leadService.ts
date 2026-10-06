import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Lead, LeadStatus, LeadSource } from '../types';

/**
 * Transforms a Supabase database row into an application Lead object.
 */
export const mapDbRowToLead = (row: any): Lead => {
  return {
    id: row.id || `lead-${Date.now()}`,
    name: row.name || '',
    email: row.email || '',
    phone: row.phone || undefined,
    source: (row.source || 'Contact') as LeadSource,
    interest: row.interest || '',
    notes: row.notes || '',
    status: (row.status || 'New') as LeadStatus,
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    amount: row.amount ? Number(row.amount) : undefined
  };
};

/**
 * Transforms an application Lead object into a Supabase database payload.
 */
export const mapLeadToDbPayload = (l: Lead): Record<string, any> => {
  return {
    id: l.id,
    name: l.name,
    email: l.email,
    phone: l.phone || null,
    source: l.source,
    interest: l.interest,
    notes: l.notes || null,
    status: l.status,
    amount: l.amount || null,
    created_at: l.createdAt
  };
};

/**
 * Lead Service: Modular API for CRM Leads Pipeline in Supabase
 */
export const leadService = {
  /**
   * Fetches all CRM leads ordered by most recent
   */
  async fetchLeads(): Promise<{ data: Lead[] | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase is not configured') };
    }

    try {
      const { data, error } = await supabase
        .from('crm_leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        return { data: null, error };
      }

      const mapped = (data || []).map(mapDbRowToLead);
      return { data: mapped, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  },

  /**
   * Inserts a new lead into Supabase
   */
  async insertLead(lead: Lead): Promise<{ data: Lead | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase is not configured') };
    }

    try {
      const payload = mapLeadToDbPayload(lead);
      const { error } = await supabase
        .from('crm_leads')
        .insert(payload);

      if (error) {
        console.error('[Supabase Lead] Insert error:', error);
        return { data: null, error };
      }

      return { data: lead, error: null };
    } catch (err) {
      console.error('[Supabase Lead] Unexpected insert error:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Updates an existing CRM lead (pipeline status, notes, contact details)
   */
  async updateLead(
    id: string,
    updates: Partial<Lead>
  ): Promise<{ data: Lead | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase is not configured') };
    }

    try {
      const dbUpdates: Record<string, any> = {
        updated_at: new Date().toISOString()
      };

      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.email !== undefined) dbUpdates.email = updates.email;
      if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
      if (updates.amount !== undefined) dbUpdates.amount = updates.amount;

      const { data, error } = await supabase
        .from('crm_leads')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return { data: null, error };
      }

      return { data: data ? mapDbRowToLead(data) : null, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  },

  /**
   * Deletes a lead from Supabase
   */
  async deleteLead(id: string): Promise<{ success: boolean; error: any }> {
    if (!isSupabaseConfigured()) {
      return { success: false, error: new Error('Supabase is not configured') };
    }

    try {
      const { error } = await supabase.from('crm_leads').delete().eq('id', id);
      if (error) {
        return { success: false, error };
      }
      return { success: true, error: null };
    } catch (err) {
      return { success: false, error: err };
    }
  }
};
