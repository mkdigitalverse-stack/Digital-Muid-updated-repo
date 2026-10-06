/**
 * Lesson & Course Learning Progress Service (Student Phase 2A)
 * Handles durable lesson progress synchronization, completion toggles,
 * playback position tracking, and overall course progress calculation.
 *
 * Enforces strict student isolation: All reads and writes are bound to the
 * authenticated student session (auth.uid() = user_id) in compliance with
 * Supabase Row Level Security (RLS).
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Course, CourseLesson, LessonProgress, CourseProgressSummary } from '../types';

/**
 * Transforms a raw database record from public.lesson_progress into a domain LessonProgress object.
 */
export const mapDbRowToProgress = (row: any): LessonProgress => ({
  id: row.id,
  userId: row.user_id,
  courseId: row.course_id,
  lessonId: row.lesson_id,
  completed: Boolean(row.completed),
  lastPositionSeconds: Number(row.last_position_seconds) || 0,
  completedAt: row.completed_at || null,
  updatedAt: row.updated_at || row.created_at
});

export interface FlattenedLesson {
  id: string;
  title: string;
  order: number;
  moduleId: string;
  moduleTitle: string;
  duration?: string;
  durationMinutes?: number;
  deliveryType?: string;
  isPreview?: boolean;
  videoUrl?: string;
  meetUrl?: string;
  description?: string;
  resources?: any[];
}

/**
 * Extracts all lessons from a normalized or raw course curriculum into a flattened array.
 * Guarantees deterministic lesson IDs matching courseService.normalizeCourseCurriculum.
 */
export const extractAllLessons = (course: Course): FlattenedLesson[] => {
  if (!course || !Array.isArray(course.curriculum)) {
    return [];
  }

  const flattened: FlattenedLesson[] = [];

  course.curriculum.forEach((mod: any, modIdx) => {
    const moduleId = mod.id || `mod-${modIdx + 1}`;
    const moduleTitle = mod.title || mod.module || `Module ${modIdx + 1}`;

    if (Array.isArray(mod.lessons)) {
      mod.lessons.forEach((lesson, lIdx) => {
        if (typeof lesson === 'string') {
          flattened.push({
            id: `lsn-${modIdx + 1}-${lIdx + 1}`,
            title: lesson.trim(),
            order: lIdx + 1,
            moduleId,
            moduleTitle,
            isPreview: false
          });
        } else if (typeof lesson === 'object' && lesson !== null) {
          const lObj = lesson as CourseLesson;
          flattened.push({
            id: lObj.id || `lsn-${modIdx + 1}-${lIdx + 1}`,
            title: String(lObj.title || `Lesson ${lIdx + 1}`).trim(),
            order: typeof lObj.order === 'number' ? lObj.order : lIdx + 1,
            moduleId,
            moduleTitle,
            duration: lObj.duration,
            durationMinutes: lObj.durationMinutes,
            deliveryType: lObj.deliveryType,
            isPreview: Boolean(lObj.isPreview),
            videoUrl: lObj.videoUrl || (lObj as any).video_url,
            meetUrl: lObj.meetUrl || (lObj as any).meet_url,
            description: lObj.description,
            resources: (lObj as any).resources
          });
        }
      });
    }
  });

  return flattened;
};

/**
 * Pure calculation function: Determines course completion percentage, completed lessons count,
 * total lessons count, and whether the course is fully completed.
 */
export const calculateCourseProgress = (
  course: Course,
  progressRecords: LessonProgress[]
): CourseProgressSummary => {
  const allLessons = extractAllLessons(course);
  const totalLessons = allLessons.length;

  if (totalLessons === 0) {
    return {
      totalLessons: 0,
      completedLessons: 0,
      progressPercent: 0,
      isCourseCompleted: false
    };
  }

  // Create set of completed lesson IDs for O(1) lookup
  const completedLessonIds = new Set(
    progressRecords
      .filter((p) => p.completed)
      .map((p) => p.lessonId)
  );

  let completedLessons = 0;
  allLessons.forEach((l) => {
    if (completedLessonIds.has(l.id)) {
      completedLessons++;
    }
  });

  const progressPercent = Math.min(100, Math.round((completedLessons / totalLessons) * 100));
  const isCourseCompleted = completedLessons >= totalLessons && totalLessons > 0;

  return {
    totalLessons,
    completedLessons,
    progressPercent,
    isCourseCompleted
  };
};

export const progressService = {
  /**
   * Fetches all lesson progress records for the currently authenticated student for a specific course.
   * Enforces that queries are strictly bound to the authenticated user's ID.
   */
  async fetchCourseProgress(courseId: string): Promise<{ data: LessonProgress[]; error: any }> {
    try {
      if (!isSupabaseConfigured()) {
        return { data: [], error: null };
      }

      if (!courseId) {
        return { data: [], error: 'Course ID is required' };
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return { data: [], error: authError || 'User is not authenticated' };
      }

      const { data, error } = await supabase
        .from('lesson_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('[ProgressService] Error fetching course progress:', error);
        return { data: [], error };
      }

      return {
        data: (data || []).map(mapDbRowToProgress),
        error: null
      };
    } catch (err) {
      console.error('[ProgressService] Unexpected error fetching course progress:', err);
      return { data: [], error: err };
    }
  },

  /**
   * Fetches all lesson progress records for the currently authenticated student across all enrolled courses.
   */
  async fetchMyAllProgress(): Promise<{ data: LessonProgress[]; error: any }> {
    try {
      if (!isSupabaseConfigured()) {
        return { data: [], error: null };
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return { data: [], error: authError || 'User is not authenticated' };
      }

      const { data, error } = await supabase
        .from('lesson_progress')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('[ProgressService] Error fetching all progress:', error);
        return { data: [], error };
      }

      return {
        data: (data || []).map(mapDbRowToProgress),
        error: null
      };
    } catch (err) {
      console.error('[ProgressService] Unexpected error fetching all progress:', err);
      return { data: [], error: err };
    }
  },

  /**
   * Saves the playback position (in seconds) for a given lesson.
   * Upserts into public.lesson_progress for the current student.
   * Preserves completion status if a record already exists.
   */
  async saveLessonPlaybackPosition(
    courseId: string,
    lessonId: string,
    positionSeconds: number
  ): Promise<{ data: LessonProgress | null; error: any }> {
    try {
      if (!isSupabaseConfigured()) {
        return { data: null, error: null };
      }

      if (!courseId || !lessonId) {
        return { data: null, error: 'Course ID and Lesson ID are required' };
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return { data: null, error: authError || 'User is not authenticated' };
      }

      const safeSeconds = Math.max(0, Math.floor(positionSeconds));

      const payload = {
        user_id: user.id,
        course_id: courseId,
        lesson_id: lessonId,
        last_position_seconds: safeSeconds,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('lesson_progress')
        .upsert(payload, { onConflict: 'user_id,course_id,lesson_id' })
        .select()
        .single();

      if (error) {
        console.error('[ProgressService] Error saving playback position:', error);
        return { data: null, error };
      }

      return {
        data: data ? mapDbRowToProgress(data) : null,
        error: null
      };
    } catch (err) {
      console.error('[ProgressService] Unexpected error saving playback position:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Marks a lesson as completed or incomplete for the current student.
   * Upserts into public.lesson_progress for the current student.
   */
  async toggleLessonCompletion(
    courseId: string,
    lessonId: string,
    completed: boolean
  ): Promise<{ data: LessonProgress | null; error: any }> {
    try {
      if (!isSupabaseConfigured()) {
        return { data: null, error: null };
      }

      if (!courseId || !lessonId) {
        return { data: null, error: 'Course ID and Lesson ID are required' };
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return { data: null, error: authError || 'User is not authenticated' };
      }

      const now = new Date().toISOString();
      const payload = {
        user_id: user.id,
        course_id: courseId,
        lesson_id: lessonId,
        completed,
        completed_at: completed ? now : null,
        updated_at: now
      };

      const { data, error } = await supabase
        .from('lesson_progress')
        .upsert(payload, { onConflict: 'user_id,course_id,lesson_id' })
        .select()
        .single();

      if (error) {
        console.error('[ProgressService] Error toggling lesson completion:', error);
        return { data: null, error };
      }

      return {
        data: data ? mapDbRowToProgress(data) : null,
        error: null
      };
    } catch (err) {
      console.error('[ProgressService] Unexpected error toggling lesson completion:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Helper utility to extract all flattened lessons from a Course curriculum.
   */
  extractAllLessons,

  /**
   * Calculates comprehensive course progress stats against a course's curriculum.
   */
  calculateCourseProgress
};
