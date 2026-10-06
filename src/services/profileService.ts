import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserProfile } from '../types';

export interface ProfileDbRow {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  headline: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

export function mapProfileFromDb(row: ProfileDbRow): UserProfile {
  return {
    id: row.id,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
    phone: row.phone,
    headline: row.headline,
    bio: row.bio,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export const profileService = {
  /**
   * Fetches a user's profile by their auth ID.
   */
  async fetchProfile(userId: string): Promise<{ data: UserProfile | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: null };
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('[ProfileService] Fetch error:', error);
        return { data: null, error };
      }

      if (!data) {
        return { data: null, error: null };
      }

      return { data: mapProfileFromDb(data as ProfileDbRow), error: null };
    } catch (err) {
      console.error('[ProfileService] Unexpected fetch error:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Ensures that a profile record exists for the given user ID.
   * If not present, creates one with the provided default metadata.
   */
  async ensureProfile(
    userId: string,
    defaults?: { fullName?: string | null; avatarUrl?: string | null }
  ): Promise<{ data: UserProfile | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: null };
    }

    try {
      // 1. Check existing
      const existing = await this.fetchProfile(userId);
      if (existing.data) {
        return { data: existing.data, error: null };
      }

      // 2. Insert if not existing
      const insertPayload = {
        id: userId,
        full_name: defaults?.fullName || null,
        avatar_url: defaults?.avatarUrl || null,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('profiles')
        .insert(insertPayload)
        .select('*')
        .single();

      if (error) {
        // If conflict error (already inserted concurrently by trigger), re-fetch
        if (error.code === '23505' || error.message?.includes('duplicate key')) {
          return await this.fetchProfile(userId);
        }
        console.error('[ProfileService] Insert error:', error);
        return { data: null, error };
      }

      return { data: mapProfileFromDb(data as ProfileDbRow), error: null };
    } catch (err) {
      console.error('[ProfileService] Unexpected ensure error:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Updates an existing profile row.
   */
  async updateProfile(
    userId: string,
    updates: {
      fullName?: string;
      avatarUrl?: string;
      phone?: string;
      headline?: string;
      bio?: string;
    }
  ): Promise<{ data: UserProfile | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: 'Database not configured' };
    }

    try {
      const payload: Partial<ProfileDbRow> = {
        updated_at: new Date().toISOString()
      };
      if (updates.fullName !== undefined) payload.full_name = updates.fullName;
      if (updates.avatarUrl !== undefined) payload.avatar_url = updates.avatarUrl;
      if (updates.phone !== undefined) payload.phone = updates.phone;
      if (updates.headline !== undefined) payload.headline = updates.headline;
      if (updates.bio !== undefined) payload.bio = updates.bio;

      const { data, error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', userId)
        .select('*')
        .single();

      if (error) {
        return { data: null, error };
      }

      return { data: mapProfileFromDb(data as ProfileDbRow), error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  }
};
