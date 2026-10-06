/**
 * Student Bookmarks & Saved Content Service (Phase 2H)
 * Handles durable cross-device bookmarking for resources, frameworks, articles, and videos.
 *
 * Enforces strict student isolation:
 * All database operations query or insert into public.student_bookmarks where auth.uid() = user_id.
 * Includes graceful localStorage fallback for resilience and offline support.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { BookmarkContentType, StudentBookmark } from '../types';

/**
 * Maps raw database row from public.student_bookmarks to domain StudentBookmark interface.
 */
export const mapDbRowToBookmark = (row: any): StudentBookmark => ({
  id: String(row.id),
  userId: String(row.user_id),
  contentType: row.content_type as BookmarkContentType,
  contentId: String(row.content_id),
  createdAt: String(row.created_at || new Date().toISOString())
});

const getStorageKey = (userId?: string) => `dm_student_bookmarks_${userId || 'guest'}`;

const getLocalBookmarks = (userId?: string): StudentBookmark[] => {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[BookmarkService] Failed to read local bookmarks:', err);
    return [];
  }
};

const saveLocalBookmarks = (bookmarks: StudentBookmark[], userId?: string) => {
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(bookmarks));
  } catch (err) {
    console.warn('[BookmarkService] Failed to write local bookmarks:', err);
  }
};

export const bookmarkService = {
  /**
   * Fetches all saved bookmarks for the current authenticated student.
   */
  async fetchUserBookmarks(userId?: string): Promise<{ data: StudentBookmark[] | null; error: any }> {
    // If Supabase is unconfigured, return local bookmarks
    if (!isSupabaseConfigured()) {
      return { data: getLocalBookmarks(userId), error: null };
    }

    try {
      // Determine active user ID from session if not passed
      let effectiveUserId = userId;
      if (!effectiveUserId) {
        const { data: authData } = await supabase.auth.getUser();
        effectiveUserId = authData?.user?.id;
      }

      if (!effectiveUserId) {
        return { data: getLocalBookmarks(userId), error: null };
      }

      const { data, error } = await supabase
        .from('student_bookmarks')
        .select('*')
        .eq('user_id', effectiveUserId)
        .order('created_at', { ascending: false });

      if (error) {
        // Fall back to localStorage gracefully if table is not yet cached or offline
        console.warn('[BookmarkService] Supabase query notice:', error.message);
        const local = getLocalBookmarks(effectiveUserId);
        return { data: local, error };
      }

      const mapped = (data || []).map(mapDbRowToBookmark);
      // Sync local storage cache
      saveLocalBookmarks(mapped, effectiveUserId);
      return { data: mapped, error: null };
    } catch (err: any) {
      console.warn('[BookmarkService] fetchUserBookmarks unexpected failure:', err);
      return { data: getLocalBookmarks(userId), error: err };
    }
  },

  /**
   * Adds a new bookmark for the student.
   * Strictly writes to Supabase first when configured and updates cache on success.
   */
  async addBookmark(
    contentType: BookmarkContentType,
    contentId: string,
    userId?: string
  ): Promise<{ data: StudentBookmark | null; error: any }> {
    const cleanId = String(contentId).trim();
    if (!cleanId) {
      return { data: null, error: new Error('Invalid contentId') };
    }

    // Determine user ID
    let effectiveUserId = userId;
    if (!effectiveUserId && isSupabaseConfigured()) {
      const { data: authData } = await supabase.auth.getUser();
      effectiveUserId = authData?.user?.id;
    }

    const fallbackBookmark: StudentBookmark = {
      id: `local-bm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId: effectiveUserId || 'guest',
      contentType,
      contentId: cleanId,
      createdAt: new Date().toISOString()
    };

    // If Supabase is unconfigured or guest user, operate in local cache
    if (!isSupabaseConfigured() || !effectiveUserId || effectiveUserId === 'guest') {
      const currentLocal = getLocalBookmarks(effectiveUserId);
      const exists = currentLocal.some(
        (b) => b.contentType === contentType && b.contentId === cleanId
      );
      if (!exists) {
        saveLocalBookmarks([fallbackBookmark, ...currentLocal], effectiveUserId);
      }
      return { data: fallbackBookmark, error: null };
    }

    try {
      const { data, error } = await supabase
        .from('student_bookmarks')
        .insert({
          user_id: effectiveUserId,
          content_type: contentType,
          content_id: cleanId
        })
        .select('*')
        .single();

      if (error) {
        // If unique constraint violation (already bookmarked), fetch existing record
        if (error.code === '23505') {
          const { data: existing } = await supabase
            .from('student_bookmarks')
            .select('*')
            .eq('user_id', effectiveUserId)
            .eq('content_type', contentType)
            .eq('content_id', cleanId)
            .maybeSingle();

          if (existing) {
            const mapped = mapDbRowToBookmark(existing);
            const currentLocal = getLocalBookmarks(effectiveUserId);
            if (!currentLocal.some((b) => b.id === mapped.id)) {
              saveLocalBookmarks([mapped, ...currentLocal], effectiveUserId);
            }
            return { data: mapped, error: null };
          }
        }
        console.warn('[BookmarkService] Supabase insert error:', error.message);
        return { data: null, error };
      }

      const mapped = mapDbRowToBookmark(data);
      // Supabase mutation succeeded -> update local cache
      const currentLocal = getLocalBookmarks(effectiveUserId);
      const updated = [
        mapped,
        ...currentLocal.filter((b) => !(b.contentType === contentType && b.contentId === cleanId))
      ];
      saveLocalBookmarks(updated, effectiveUserId);
      return { data: mapped, error: null };
    } catch (err: any) {
      console.warn('[BookmarkService] addBookmark unexpected error:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Removes an existing bookmark for the student.
   * Strictly deletes from Supabase first when configured and updates cache on success.
   */
  async removeBookmark(
    contentType: BookmarkContentType,
    contentId: string,
    userId?: string
  ): Promise<{ success: boolean; error: any }> {
    const cleanId = String(contentId).trim();
    if (!cleanId) {
      return { success: false, error: new Error('Invalid contentId') };
    }

    let effectiveUserId = userId;
    if (!effectiveUserId && isSupabaseConfigured()) {
      const { data: authData } = await supabase.auth.getUser();
      effectiveUserId = authData?.user?.id;
    }

    // If Supabase is unconfigured or guest user, operate in local cache
    if (!isSupabaseConfigured() || !effectiveUserId || effectiveUserId === 'guest') {
      const currentLocal = getLocalBookmarks(effectiveUserId);
      const filtered = currentLocal.filter(
        (b) => !(b.contentType === contentType && b.contentId === cleanId)
      );
      saveLocalBookmarks(filtered, effectiveUserId);
      return { success: true, error: null };
    }

    try {
      const { error } = await supabase
        .from('student_bookmarks')
        .delete()
        .eq('user_id', effectiveUserId)
        .eq('content_type', contentType)
        .eq('content_id', cleanId);

      if (error) {
        console.warn('[BookmarkService] Supabase delete error:', error.message);
        return { success: false, error };
      }

      // Supabase mutation succeeded -> update local cache
      const currentLocal = getLocalBookmarks(effectiveUserId);
      const filtered = currentLocal.filter(
        (b) => !(b.contentType === contentType && b.contentId === cleanId)
      );
      saveLocalBookmarks(filtered, effectiveUserId);
      return { success: true, error: null };
    } catch (err: any) {
      console.warn('[BookmarkService] removeBookmark unexpected error:', err);
      return { success: false, error: err };
    }
  },

  /**
   * Toggles bookmark state.
   * Does NOT independently decide INSERT vs DELETE by checking localStorage.
   * Caller (application state) explicitly supplies isCurrentlySaved.
   */
  async toggleBookmark(
    contentType: BookmarkContentType,
    contentId: string,
    userId?: string,
    isCurrentlySaved?: boolean
  ): Promise<{ bookmarked: boolean; data?: StudentBookmark | null; error: any }> {
    const cleanId = String(contentId).trim();
    if (!cleanId) {
      return { bookmarked: false, error: new Error('Invalid contentId') };
    }

    let effectiveUserId = userId;
    if (!effectiveUserId && isSupabaseConfigured()) {
      const { data: authData } = await supabase.auth.getUser();
      effectiveUserId = authData?.user?.id;
    }

    // Determine operation from caller's explicit state.
    // If not supplied, fall back to checking local cache as secondary safeguard.
    let shouldRemove = isCurrentlySaved;
    if (shouldRemove === undefined) {
      const currentLocal = getLocalBookmarks(effectiveUserId);
      shouldRemove = currentLocal.some(
        (b) => b.contentType === contentType && b.contentId === cleanId
      );
    }

    if (shouldRemove) {
      const res = await this.removeBookmark(contentType, cleanId, effectiveUserId);
      return { bookmarked: false, error: res.error };
    } else {
      const res = await this.addBookmark(contentType, cleanId, effectiveUserId);
      return { bookmarked: true, data: res.data, error: res.error };
    }
  }
};
