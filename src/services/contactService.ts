import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ContactMessage } from '../types';

/**
 * Transforms a Supabase database row into an application ContactMessage object.
 */
export const mapDbRowToContactMessage = (row: any): ContactMessage => {
  return {
    id: row.id || `msg-${Date.now()}`,
    name: row.name || '',
    email: row.email || '',
    phone: row.phone || undefined,
    inquiryType: row.inquiry_type || row.inquiryType || 'General Inquiry',
    message: row.message || '',
    createdAt: row.created_at || row.createdAt || new Date().toISOString()
  };
};

/**
 * Transforms an application ContactMessage object into a Supabase database payload.
 */
export const mapContactMessageToDbPayload = (m: ContactMessage): Record<string, any> => {
  return {
    id: m.id,
    name: m.name,
    email: m.email,
    phone: m.phone || null,
    inquiry_type: m.inquiryType,
    message: m.message,
    created_at: m.createdAt
  };
};

/**
 * Contact Service: Modular API for Inbound Contact Inquiries in Supabase
 */
export const contactService = {
  /**
   * Fetches all contact messages (Admin access)
   */
  async fetchContactMessages(): Promise<{ data: ContactMessage[] | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase is not configured') };
    }

    try {
      const { data, error } = await supabase
        .from('contact_messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        return { data: null, error };
      }

      const mapped = (data || []).map(mapDbRowToContactMessage);
      return { data: mapped, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  },

  /**
   * Inserts a new contact message into Supabase
   */
  async insertContactMessage(
    message: ContactMessage
  ): Promise<{ data: ContactMessage | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase is not configured') };
    }

    try {
      const payload = mapContactMessageToDbPayload(message);
      const { error } = await supabase
        .from('contact_messages')
        .insert(payload);

      if (error) {
        console.error('[Supabase Contact] Insert error:', error);
        return { data: null, error };
      }

      return { data: message, error: null };
    } catch (err) {
      console.error('[Supabase Contact] Unexpected insert error:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Deletes a contact message from Supabase
   */
  async deleteContactMessage(id: string): Promise<{ success: boolean; error: any }> {
    if (!isSupabaseConfigured()) {
      return { success: false, error: new Error('Supabase is not configured') };
    }

    try {
      const { error } = await supabase
        .from('contact_messages')
        .delete()
        .eq('id', id);

      if (error) {
        return { success: false, error };
      }
      return { success: true, error: null };
    } catch (err) {
      return { success: false, error: err };
    }
  }
};
