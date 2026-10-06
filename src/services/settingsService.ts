import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { SiteSettings } from '../types';

/**
 * Transforms a Supabase database row into an application SiteSettings object.
 */
export const mapDbRowToSiteSettings = (row: any): SiteSettings => {
  return {
    adminEmail: row.admin_email || row.adminEmail || 'mkdigitalverse@gmail.com',
    razorpayKeyId: row.razorpay_key_id || row.razorpayKeyId || 'rzp_test_placeholder_key',
    razorpayTestMode: row.razorpay_test_mode !== undefined ? Boolean(row.razorpay_test_mode) : true,
    googleCalendarConnected: row.google_calendar_connected !== undefined ? Boolean(row.google_calendar_connected) : true,
    googleMeetEnabled: row.google_meet_enabled !== undefined ? Boolean(row.google_meet_enabled) : true,
    notificationEmail: row.notification_email || row.notificationEmail || 'mkdigitalverse@gmail.com',
    phoneContact: row.phone_contact || row.phoneContact || '+91 99066 84898',
    locationCity: row.location_city || row.locationCity || 'Bengaluru & Srinagar, India',
    socialLinkedin: row.social_linkedin || row.socialLinkedin || 'https://linkedin.com/in/digitalmuid',
    socialInstagram: row.social_instagram || row.socialInstagram || 'https://instagram.com/digitalmuid',
    socialFacebook: row.social_facebook || row.socialFacebook || 'https://facebook.com/digitalmuid',
    socialYoutube: row.social_youtube || row.socialYoutube || 'https://youtube.com/@digitalmuid'
  };
};

/**
 * Transforms an application SiteSettings object into a Supabase database payload.
 */
export const mapSiteSettingsToDbPayload = (s: SiteSettings): Record<string, any> => {
  return {
    id: 'primary_site_settings',
    admin_email: s.adminEmail,
    razorpay_key_id: s.razorpayKeyId,
    razorpay_test_mode: s.razorpayTestMode,
    google_calendar_connected: s.googleCalendarConnected,
    google_meet_enabled: s.googleMeetEnabled,
    notification_email: s.notificationEmail,
    phone_contact: s.phoneContact,
    location_city: s.locationCity,
    social_linkedin: s.socialLinkedin || null,
    social_instagram: s.socialInstagram || null,
    social_facebook: s.socialFacebook || null,
    social_youtube: s.socialYoutube || null,
    updated_at: new Date().toISOString()
  };
};

/**
 * Settings Service: Modular API for Platform Configuration in Supabase
 */
export const settingsService = {
  /**
   * Fetches the platform site settings
   */
  async fetchSiteSettings(): Promise<{ data: SiteSettings | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase is not configured') };
    }

    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) {
        return { data: null, error };
      }

      if (!data) {
        return { data: null, error: null };
      }

      return { data: mapDbRowToSiteSettings(data), error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  },

  /**
   * Updates platform site settings
   */
  async updateSiteSettings(
    settings: SiteSettings
  ): Promise<{ data: SiteSettings | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase is not configured') };
    }

    try {
      const payload = mapSiteSettingsToDbPayload(settings);
      const { data, error } = await supabase
        .from('site_settings')
        .upsert(payload, { onConflict: 'id' })
        .select()
        .single();

      if (error) {
        return { data: null, error };
      }

      return { data: data ? mapDbRowToSiteSettings(data) : settings, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  }
};
