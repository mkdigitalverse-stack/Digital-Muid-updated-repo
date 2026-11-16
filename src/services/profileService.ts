import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserProfile } from '../types';

import { formatStudentId } from '../utils/studentId';

export interface ProfileDbRow {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  headline: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
  // Optional forward-compatible V4.3 columns (not yet present in live public.profiles)
  student_id?: string | null;
  state?: string | null;
}

export interface ProfileUpdateInput {
  fullName?: string | null;
  avatarUrl?: string | null;
  phone?: string | null;
  headline?: string | null;
  bio?: string | null;
}

export interface ProfileUpdateDbPayload {
  full_name?: string;
  avatar_url?: string | null;
  phone?: string | null;
  headline?: string | null;
  bio?: string | null;
  updated_at: string;
}

function normalizeOptionalProfileText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function buildProfileUpdatePayload(updates: ProfileUpdateInput): ProfileUpdateDbPayload {
  const payload: ProfileUpdateDbPayload = {
    updated_at: new Date().toISOString()
  };

  if (updates.fullName !== undefined && updates.fullName !== null) {
    const trimmedFullName = String(updates.fullName).trim();
    if (trimmedFullName.length > 0) {
      payload.full_name = trimmedFullName;
    }
  }

  const normalizedAvatar = normalizeOptionalProfileText(updates.avatarUrl);
  if (normalizedAvatar !== undefined) payload.avatar_url = normalizedAvatar;

  const normalizedPhone = normalizeOptionalProfileText(updates.phone);
  if (normalizedPhone !== undefined) payload.phone = normalizedPhone;

  const normalizedHeadline = normalizeOptionalProfileText(updates.headline);
  if (normalizedHeadline !== undefined) payload.headline = normalizedHeadline;

  const normalizedBio = normalizeOptionalProfileText(updates.bio);
  if (normalizedBio !== undefined) payload.bio = normalizedBio;

  return payload;
}

export function mapProfileFromDb(row: ProfileDbRow): UserProfile {
  return {
    id: row.id,
    studentId: formatStudentId(row.id, row.student_id),
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
    phone: row.phone,
    headline: row.headline,
    bio: row.bio,
    state: row.state ?? null,
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
   * Updates an existing profile row using strictly verified live columns.
   */
  async updateProfile(
    userId: string,
    updates: ProfileUpdateInput,
    client: any = supabase
  ): Promise<{ data: UserProfile | null; error: any }> {
    if (client === supabase && !isSupabaseConfigured()) {
      return { data: null, error: 'Database not configured' };
    }

    try {
      if (updates.fullName !== undefined && String(updates.fullName ?? '').trim().length === 0) {
        return { data: null, error: 'Full name cannot be blank.' };
      }

      const payload = buildProfileUpdatePayload(updates);

      const { data, error } = await client
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
