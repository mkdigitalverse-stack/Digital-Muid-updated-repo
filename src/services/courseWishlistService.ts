/**
 * Course Wishlist Service (Phase 4A)
 * Handles dedicated wishlist persistence for courses in public.student_course_wishlist.
 * Enforces strict student isolation and database authority.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { StudentCourseWishlistItem } from '../types';
import { INITIAL_COURSES } from '../data/initialData';

export const mapDbRowToWishlistItem = (row: any): StudentCourseWishlistItem => ({
  id: String(row.id),
  userId: String(row.user_id),
  courseId: String(row.course_id),
  createdAt: String(row.created_at || new Date().toISOString())
});

/**
 * Resolves any course identifier (local ID like 'crs-01', slug, or UUID)
 * to the authoritative public.courses(id) UUID stored in Supabase.
 */
export const resolveCanonicalCourseUuid = async (courseId: string): Promise<string | null> => {
  const cleanId = String(courseId || '').trim();
  if (!cleanId) return null;

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);
  if (isUuid) {
    return cleanId;
  }

  if (!isSupabaseConfigured()) {
    return cleanId;
  }

  try {
    const fallbackCourse = INITIAL_COURSES.find((c) => c.id === cleanId || c.slug === cleanId);
    const lookupSlug = fallbackCourse ? fallbackCourse.slug : cleanId;

    const { data, error } = await supabase
      .from('courses')
      .select('id')
      .eq('slug', lookupSlug)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('[CourseWishlistService] Error resolving course slug to UUID:', error.message);
      return null;
    }

    if (data?.id) {
      return String(data.id);
    }

    return null;
  } catch (err) {
    console.error('[CourseWishlistService] Failed to resolve course UUID:', err);
    return null;
  }
};

export const courseWishlistService = {
  /**
   * Fetches all wishlisted course records for the given authenticated student.
   */
  async fetchCourseWishlist(userId: string): Promise<{ data: StudentCourseWishlistItem[] | null; error: any }> {
    if (!userId) {
      return { data: [], error: null };
    }

    if (!isSupabaseConfigured()) {
      return { data: [], error: null };
    }

    try {
      const { data, error } = await supabase
        .from('student_course_wishlist')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        if (
          error.code === '42P01' ||
          error.code === 'PGRST205' ||
          error.message?.includes('does not exist') ||
          error.message?.includes('schema cache')
        ) {
          console.warn('[CourseWishlistService] student_course_wishlist table does not exist yet.');
          return { data: [], error: null };
        }
        console.error('[CourseWishlistService] fetch error:', error);
        return { data: null, error };
      }

      const items = (data || []).map(mapDbRowToWishlistItem);
      return { data: items, error: null };
    } catch (err: any) {
      console.error('[CourseWishlistService] Unexpected fetch error:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Adds a course to the student's wishlist.
   * Resolves non-UUID identifiers (e.g. 'crs-01' or slug) to canonical course UUIDs.
   * Idempotent: Handles duplicate entries gracefully without error.
   */
  async addCourseToWishlist(
    userId: string,
    courseId: string
  ): Promise<{ data: StudentCourseWishlistItem | null; error: any; alreadyExists?: boolean }> {
    if (!userId || !courseId) {
      return { data: null, error: new Error('User ID and Course ID are required.') };
    }

    if (!isSupabaseConfigured()) {
      const mockItem: StudentCourseWishlistItem = {
        id: `mock-wishlist-${Date.now()}`,
        userId,
        courseId,
        createdAt: new Date().toISOString()
      };
      return { data: mockItem, error: null };
    }

    try {
      const resolvedCourseId = await resolveCanonicalCourseUuid(courseId);
      if (!resolvedCourseId) {
        return {
          data: null,
          error: new Error(`Course "${courseId}" could not be matched with an active database record.`)
        };
      }

      const { data, error } = await supabase
        .from('student_course_wishlist')
        .insert({
          user_id: userId,
          course_id: resolvedCourseId
        })
        .select()
        .single();

      if (error) {
        // Unique constraint violation (duplicate key 23505)
        if (error.code === '23505' || error.message?.includes('unique') || error.message?.includes('duplicate')) {
          return { data: null, error: null, alreadyExists: true };
        }

        if (
          error.code === '42P01' ||
          error.code === 'PGRST205' ||
          error.message?.includes('does not exist') ||
          error.message?.includes('schema cache')
        ) {
          console.warn('[CourseWishlistService] student_course_wishlist table does not exist yet.');
          const mockItem: StudentCourseWishlistItem = {
            id: `client-wishlist-${Date.now()}`,
            userId,
            courseId: resolvedCourseId,
            createdAt: new Date().toISOString()
          };
          return { data: mockItem, error: null };
        }

        console.error('[CourseWishlistService] insert error:', error);
        return { data: null, error };
      }

      return { data: mapDbRowToWishlistItem(data), error: null };
    } catch (err: any) {
      console.error('[CourseWishlistService] Unexpected insert error:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Removes a course from the student's wishlist.
   * Resolves non-UUID identifiers before executing delete.
   */
  async removeCourseFromWishlist(
    userId: string,
    courseId: string
  ): Promise<{ success: boolean; error: any }> {
    if (!userId || !courseId) {
      return { success: false, error: new Error('User ID and Course ID are required.') };
    }

    if (!isSupabaseConfigured()) {
      return { success: true, error: null };
    }

    try {
      const resolvedCourseId = (await resolveCanonicalCourseUuid(courseId)) || courseId;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedCourseId);

      if (!isUuid) {
        // If it cannot be resolved to a UUID, it was never in the UUID table
        return { success: true, error: null };
      }

      const { error } = await supabase
        .from('student_course_wishlist')
        .delete()
        .eq('user_id', userId)
        .eq('course_id', resolvedCourseId);

      if (error) {
        if (
          error.code === '42P01' ||
          error.code === 'PGRST205' ||
          error.message?.includes('does not exist') ||
          error.message?.includes('schema cache')
        ) {
          return { success: true, error: null };
        }
        console.error('[CourseWishlistService] delete error:', error);
        return { success: false, error };
      }

      return { success: true, error: null };
    } catch (err: any) {
      console.error('[CourseWishlistService] Unexpected delete error:', err);
      return { success: false, error: err };
    }
  }
};
