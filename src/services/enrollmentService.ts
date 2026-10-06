/**
 * Student Course Enrollment Service (Student Phase 2A)
 * Handles retrieving course enrollments for the currently authenticated student,
 * hydrating course metadata, and aggregating current learning progress metrics.
 *
 * Enforces strict student isolation: Queries are strictly bound to the authenticated
 * student's user ID (auth.uid() = user_id) in compliance with Row Level Security (RLS).
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Course, CourseEnrollment, StudentEnrollmentWithCourse } from '../types';
import { mapDbRowToCourse } from './courseService';
import { calculateCourseProgress, mapDbRowToProgress } from './progressService';

/**
 * Transforms a raw database record from public.course_enrollments into a domain CourseEnrollment object.
 */
export const mapDbRowToEnrollment = (row: any): CourseEnrollment => ({
  id: row.id,
  userId: row.user_id,
  courseId: row.course_id,
  status: (row.status as 'active' | 'expired' | 'revoked') || 'active',
  enrolledAt: row.enrolled_at || row.created_at,
  expiresAt: row.expires_at || null,
  source: (row.source as 'purchase' | 'admin_grant' | 'cohort') || 'purchase',
  orderId: row.payment_id || null,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export const enrollmentService = {
  /**
   * Fetches all enrollments for the currently authenticated student.
   * Hydrates each enrollment with its corresponding Course information and progress summary.
   */
  async fetchMyEnrollments(): Promise<{ data: StudentEnrollmentWithCourse[]; error: any }> {
    try {
      if (!isSupabaseConfigured()) {
        return { data: [], error: null };
      }

      // 1. Obtain current authenticated student session
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return { data: [], error: authError || 'User is not authenticated' };
      }

      // 2. Fetch enrollment records for this student only
      const { data: enrollmentsData, error: enrollmentsError } = await supabase
        .from('course_enrollments')
        .select('*')
        .eq('user_id', user.id)
        .order('enrolled_at', { ascending: false });

      if (enrollmentsError) {
        console.error('[EnrollmentService] Error querying course enrollments:', enrollmentsError);
        return { data: [], error: enrollmentsError };
      }

      if (!enrollmentsData || enrollmentsData.length === 0) {
        return { data: [], error: null };
      }

      const domainEnrollments = enrollmentsData.map(mapDbRowToEnrollment);
      const courseIds = Array.from(new Set(domainEnrollments.map((e) => e.courseId)));

      // 3. Batch-fetch the associated courses from public.courses
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select('*')
        .in('id', courseIds);

      if (coursesError) {
        console.error('[EnrollmentService] Error querying courses for enrollments:', coursesError);
      }

      const courseMap = new Map<string, Course>();
      if (coursesData && coursesData.length > 0) {
        coursesData.forEach((row) => {
          const c = mapDbRowToCourse(row);
          courseMap.set(c.id, c);
        });
      }

      // 4. Batch-fetch progress records for this student and these enrolled courses
      const { data: progressData, error: progressError } = await supabase
        .from('lesson_progress')
        .select('*')
        .eq('user_id', user.id)
        .in('course_id', courseIds);

      if (progressError) {
        console.warn('[EnrollmentService] Notice fetching lesson progress for enrollments:', progressError);
      }

      const progressByCourse = new Map<string, any[]>();
      if (progressData && progressData.length > 0) {
        progressData.forEach((row) => {
          const list = progressByCourse.get(row.course_id) || [];
          list.push(mapDbRowToProgress(row));
          progressByCourse.set(row.course_id, list);
        });
      }

      // 5. Combine enrollments with courses and computed progress metrics
      const enriched: StudentEnrollmentWithCourse[] = domainEnrollments.map((enrollment) => {
        const course = courseMap.get(enrollment.courseId);
        const progressList = progressByCourse.get(enrollment.courseId) || [];

        let progressPercent = 0;
        let completedLessonsCount = 0;
        let totalLessonsCount = 0;
        let lastLessonId: string | undefined = undefined;
        let lastAccessedAt = enrollment.enrolledAt;

        if (course) {
          const stats = calculateCourseProgress(course, progressList);
          progressPercent = stats.progressPercent;
          completedLessonsCount = stats.completedLessons;
          totalLessonsCount = stats.totalLessons;
        }

        if (progressList.length > 0) {
          // Sort to find most recently updated lesson progress
          const sorted = [...progressList].sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
          if (sorted[0]) {
            lastLessonId = sorted[0].lessonId;
            lastAccessedAt = sorted[0].updatedAt;
          }
        }

        return {
          ...enrollment,
          course,
          progressPercent,
          completedLessonsCount,
          totalLessonsCount,
          lastLessonId,
          lastAccessedAt
        };
      });

      return { data: enriched, error: null };
    } catch (err) {
      console.error('[EnrollmentService] Unexpected error fetching student enrollments:', err);
      return { data: [], error: err };
    }
  },

  /**
   * Checks whether the currently authenticated student is actively enrolled in a given course.
   */
  async checkIsCourseEnrolled(courseId: string): Promise<boolean> {
    try {
      if (!isSupabaseConfigured() || !courseId) {
        return false;
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return false;
      }

      const { data, error } = await supabase
        .from('course_enrollments')
        .select('id, status, expires_at')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .eq('status', 'active')
        .maybeSingle();

      if (error || !data) {
        return false;
      }

      // Check expiration timestamp if present
      if (data.expires_at) {
        const isExpired = new Date(data.expires_at).getTime() < Date.now();
        if (isExpired) return false;
      }

      return true;
    } catch (err) {
      console.error('[EnrollmentService] Error checking course enrollment:', err);
      return false;
    }
  },

  /**
   * Fetches the specific enrollment record for a given course for the currently authenticated student.
   */
  async fetchMyEnrollmentForCourse(
    courseId: string
  ): Promise<{ data: StudentEnrollmentWithCourse | null; isEnrolled: boolean; error: any }> {
    try {
      if (!isSupabaseConfigured()) {
        return { data: null, isEnrolled: false, error: null };
      }

      if (!courseId) {
        return { data: null, isEnrolled: false, error: 'Course ID is required' };
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return { data: null, isEnrolled: false, error: authError || 'User is not authenticated' };
      }

      const { data: row, error } = await supabase
        .from('course_enrollments')
        .select('*')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .maybeSingle();

      if (error) {
        console.error('[EnrollmentService] Error fetching course enrollment:', error);
        return { data: null, isEnrolled: false, error };
      }

      if (!row) {
        return { data: null, isEnrolled: false, error: null };
      }

      const enrollment = mapDbRowToEnrollment(row);
      const isExpired = enrollment.expiresAt
        ? new Date(enrollment.expiresAt).getTime() < Date.now()
        : false;
      const isEnrolled = enrollment.status === 'active' && !isExpired;

      // Fetch course metadata
      const { data: courseRow } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .maybeSingle();

      const course = courseRow ? mapDbRowToCourse(courseRow) : undefined;

      // Fetch progress
      const { data: progressRows } = await supabase
        .from('lesson_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('course_id', courseId);

      const progressList = (progressRows || []).map(mapDbRowToProgress);
      let progressPercent = 0;
      let completedLessonsCount = 0;
      let totalLessonsCount = 0;

      if (course) {
        const stats = calculateCourseProgress(course, progressList);
        progressPercent = stats.progressPercent;
        completedLessonsCount = stats.completedLessons;
        totalLessonsCount = stats.totalLessons;
      }

      const result: StudentEnrollmentWithCourse = {
        ...enrollment,
        course,
        progressPercent,
        completedLessonsCount,
        totalLessonsCount
      };

      return { data: result, isEnrolled, error: null };
    } catch (err) {
      console.error('[EnrollmentService] Unexpected error fetching enrollment for course:', err);
      return { data: null, isEnrolled: false, error: err };
    }
  }
};
