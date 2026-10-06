import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { NewsletterSubscriber } from '../types';

/**
 * Transforms a Supabase database row into an application NewsletterSubscriber object.
 */
export const mapDbRowToSubscriber = (row: any): NewsletterSubscriber => {
  return {
    id: row.id || `sub-${Date.now()}`,
    name: row.name || '',
    email: row.email || '',
    source: row.source || 'Homepage Brief',
    subscribedAt: row.subscribed_at || row.subscribedAt || new Date().toISOString()
  };
};

/**
 * Transforms an application NewsletterSubscriber object into a Supabase database payload.
 */
export const mapSubscriberToDbPayload = (s: NewsletterSubscriber): Record<string, any> => {
  return {
    id: s.id,
    name: s.name || null,
    email: s.email,
    source: s.source,
    is_active: true,
    subscribed_at: s.subscribedAt
  };
};

/**
 * Subscriber Service: Modular API for Newsletter Subscribers in Supabase
 */
export const subscriberService = {
  /**
   * Fetches all subscribers
   */
  async fetchSubscribers(): Promise<{ data: NewsletterSubscriber[] | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase is not configured') };
    }

    try {
      const { data, error } = await supabase
        .from('newsletter_subscribers')
        .select('*')
        .order('subscribed_at', { ascending: false });

      if (error) {
        return { data: null, error };
      }

      const mapped = (data || []).map(mapDbRowToSubscriber);
      return { data: mapped, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  },

  /**
   * Inserts a new subscriber into Supabase
   */
  async insertSubscriber(
    subscriber: NewsletterSubscriber
  ): Promise<{ data: NewsletterSubscriber | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase is not configured') };
    }

    try {
      const payload = mapSubscriberToDbPayload(subscriber);
      const { error } = await supabase
        .from('newsletter_subscribers')
        .upsert(payload, { onConflict: 'email' });

      if (error) {
        console.error('[Supabase Subscriber] Upsert error:', error);
        return { data: null, error };
      }

      return { data: subscriber, error: null };
    } catch (err) {
      console.error('[Supabase Subscriber] Unexpected insert error:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Deletes or unsubscribes a subscriber from Supabase
   */
  async deleteSubscriber(id: string): Promise<{ success: boolean; error: any }> {
    if (!isSupabaseConfigured()) {
      return { success: false, error: new Error('Supabase is not configured') };
    }

    try {
      const { error } = await supabase
        .from('newsletter_subscribers')
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
