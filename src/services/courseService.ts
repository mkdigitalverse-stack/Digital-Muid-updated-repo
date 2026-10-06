import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Course, CourseModule, CourseLesson, CourseLessonMedia, CourseEnrollment, PlaybackAuthorization } from '../types';
import { slugify } from './articleService';
import { INITIAL_COURSES } from '../data/initialData';

/**
 * Normalizes course curriculum from JSONB or array payload into structured CourseModule objects.
 */
export const normalizeCourseCurriculum = (rawCurriculum: any): CourseModule[] => {
  if (!Array.isArray(rawCurriculum)) {
    if (typeof rawCurriculum === 'string') {
      try {
        const parsed = JSON.parse(rawCurriculum);
        if (Array.isArray(parsed)) return normalizeCourseCurriculum(parsed);
      } catch {
        return [];
      }
    }
    return [];
  }

  return rawCurriculum.map((mod: any, index: number) => {
    const moduleName = String(mod.module || mod.title || `Module ${index + 1}`).trim();
    const summary = mod.summary || mod.description || '';
    const duration = mod.duration || '';

    let lessons: any[] = [];
    if (Array.isArray(mod.lessons)) {
      lessons = mod.lessons.map((lesson: any, lIndex: number) => {
        if (typeof lesson === 'string') {
          return {
            id: `lsn-${index + 1}-${lIndex + 1}`,
            title: lesson.trim(),
            order: lIndex + 1
          };
        }
        if (typeof lesson === 'object' && lesson !== null) {
          return {
            id: lesson.id || `lsn-${index + 1}-${lIndex + 1}`,
            title: String(lesson.title || `Lesson ${lIndex + 1}`).trim(),
            description: lesson.description || '',
            durationMinutes: typeof lesson.durationMinutes === 'number' ? lesson.durationMinutes : undefined,
            duration: lesson.duration || (lesson.durationMinutes ? `${lesson.durationMinutes} mins` : ''),
            deliveryType: lesson.deliveryType || lesson.delivery_type || 'live',
            videoUrl: lesson.videoUrl || lesson.video_url || '',
            meetUrl: lesson.meetUrl || lesson.meet_url || '',
            isPreview: Boolean(lesson.isPreview || lesson.is_preview || false),
            hasSecureMedia: Boolean(lesson.hasSecureMedia || lesson.has_secure_media || false),
            mediaProvider: lesson.mediaProvider || lesson.media_provider || undefined,
            order: typeof lesson.order === 'number' ? lesson.order : lIndex + 1
          };
        }
        return { id: `lsn-${index + 1}-${lIndex + 1}`, title: `Lesson ${lIndex + 1}`, order: lIndex + 1 };
      });
    }

    return {
      id: mod.id || `mod-${index + 1}`,
      module: moduleName,
      title: moduleName,
      summary,
      duration,
      lessons,
      order: typeof mod.order === 'number' ? mod.order : index + 1
    };
  });
};

/**
 * Transforms a Supabase database row into an application Course object.
 */
export const mapDbRowToCourse = (row: any): Course => {
  const isFeatured = Boolean(row.featured ?? row.is_featured ?? row.isFeatured ?? false);
  const curriculum = normalizeCourseCurriculum(row.curriculum);
  const price = typeof row.price === 'number' ? row.price : parseFloat(row.price || '0') || 0;
  const offerPrice = row.offer_price !== null && row.offer_price !== undefined
    ? (typeof row.offer_price === 'number' ? row.offer_price : parseFloat(row.offer_price))
    : (row.offerPrice !== undefined ? row.offerPrice : undefined);

  const rawOfferExpires = row.offer_expires_at || row.offerExpiresAt;
  const rawCohortStart = row.cohort_start_date || row.cohortStartDate;

  const relatedFrameworks = Array.isArray(row.related_frameworks ?? row.relatedFrameworks)
    ? (row.related_frameworks ?? row.relatedFrameworks)
    : [];
  const relatedArticles = Array.isArray(row.related_articles ?? row.relatedArticles)
    ? (row.related_articles ?? row.relatedArticles)
    : [];
  const relatedVideos = Array.isArray(row.related_videos ?? row.relatedVideos)
    ? (row.related_videos ?? row.relatedVideos)
    : [];
  const relatedResources = Array.isArray(row.related_resources ?? row.relatedResources)
    ? (row.related_resources ?? row.relatedResources)
    : [];

  const highlights = Array.isArray(row.highlights)
    ? row.highlights
    : (row.highlights ? [row.highlights] : []);
  
  const tags = Array.isArray(row.tags)
    ? row.tags
    : (row.tags ? [row.tags] : ['Digital Growth']);

  const aiToolsCovered = Array.isArray(row.ai_tools_covered ?? row.aiToolsCovered)
    ? (row.ai_tools_covered ?? row.aiToolsCovered)
    : [];

  const rawCreated = row.created_at || row.createdAt;
  const formattedCreatedAt = typeof rawCreated === 'string' && rawCreated.includes('T')
    ? rawCreated.split('T')[0]
    : (rawCreated ? String(rawCreated) : undefined);

  const title = String(row.title || row.name || '');

  return {
    id: String(row.id),
    slug: String(row.slug || ''),
    title,
    name: title, // alias for UI compatibility
    shortOutcome: String(row.short_outcome ?? row.shortOutcome ?? ''),
    short_outcome: String(row.short_outcome ?? row.shortOutcome ?? ''),
    description: String(row.description || ''),
    curriculum,
    duration: String(row.duration || ''),
    level: (row.level as any) || 'All Levels',
    deliveryMode: (row.delivery_mode ?? row.deliveryMode ?? 'Live Cohort') as any,
    delivery_mode: (row.delivery_mode ?? row.deliveryMode ?? 'Live Cohort'),
    price,
    offerPrice: offerPrice !== undefined && !isNaN(offerPrice) ? offerPrice : undefined,
    offer_price: offerPrice !== undefined && !isNaN(offerPrice) ? offerPrice : undefined,
    offerExpiresAt: rawOfferExpires ? String(rawOfferExpires) : undefined,
    offer_expires_at: rawOfferExpires ? String(rawOfferExpires) : undefined,
    currency: String(row.currency || 'INR'),
    thumbnail: String(row.thumbnail || 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80'),
    coverImage: row.cover_image || row.coverImage || undefined,
    cover_image: row.cover_image || row.coverImage || undefined,
    instructor: String(row.instructor || 'Digital Muid'),
    instructorTitle: row.instructor_title || row.instructorTitle || undefined,
    instructor_title: row.instructor_title || row.instructorTitle || undefined,
    instructorAvatar: row.instructor_avatar || row.instructorAvatar || undefined,
    instructor_avatar: row.instructor_avatar || row.instructorAvatar || undefined,
    aiIntegrated: Boolean(row.ai_integrated ?? row.aiIntegrated ?? false),
    ai_integrated: Boolean(row.ai_integrated ?? row.aiIntegrated ?? false),
    aiToolsCovered,
    ai_tools_covered: aiToolsCovered,
    featured: isFeatured,
    isFeatured,
    status: (row.status as any) || 'draft',
    enrolledCount: typeof row.enrolled_count === 'number'
      ? row.enrolled_count
      : (typeof row.enrolledCount === 'number' ? row.enrolledCount : 0),
    enrolled_count: typeof row.enrolled_count === 'number'
      ? row.enrolled_count
      : (typeof row.enrolledCount === 'number' ? row.enrolledCount : 0),
    cohortStartDate: rawCohortStart ? String(rawCohortStart) : undefined,
    cohort_start_date: rawCohortStart ? String(rawCohortStart) : undefined,
    maxSeats: typeof row.max_seats === 'number'
      ? row.max_seats
      : (typeof row.maxSeats === 'number' ? row.maxSeats : undefined),
    max_seats: typeof row.max_seats === 'number'
      ? row.max_seats
      : (typeof row.maxSeats === 'number' ? row.maxSeats : undefined),
    highlights,
    tags,
    relatedFrameworks,
    related_frameworks: relatedFrameworks,
    relatedArticles,
    related_articles: relatedArticles,
    relatedVideos,
    related_videos: relatedVideos,
    relatedResources,
    related_resources: relatedResources,
    seoTitle: row.seo_title || row.seoTitle || undefined,
    seo_title: row.seo_title || row.seoTitle || undefined,
    seoDescription: row.seo_description || row.seoDescription || undefined,
    seo_description: row.seo_description || row.seoDescription || undefined,
    ogImage: row.og_image || row.ogImage || undefined,
    og_image: row.og_image || row.ogImage || undefined,
    createdAt: formattedCreatedAt,
    created_at: rawCreated ? String(rawCreated) : undefined,
    updatedAt: row.updated_at || row.updatedAt || undefined,
    updated_at: row.updated_at || row.updatedAt || undefined
  };
};

/**
 * Maps Course object to Supabase database payload.
 */
export const mapCourseToDbPayload = (course: Partial<Course>) => {
  const payload: Record<string, any> = {};

  if (course.title !== undefined || course.name !== undefined) {
    payload.title = String(course.title || course.name || '').trim();
  }
  if (course.slug !== undefined) {
    payload.slug = slugify(course.slug);
  }
  if (course.shortOutcome !== undefined || course.short_outcome !== undefined) {
    payload.short_outcome = String(course.shortOutcome ?? course.short_outcome ?? '').trim();
  }
  if (course.description !== undefined) {
    payload.description = String(course.description || '').trim();
  }
  if (course.level !== undefined) {
    payload.level = course.level;
  }
  if (course.deliveryMode !== undefined || course.delivery_mode !== undefined) {
    payload.delivery_mode = course.deliveryMode || course.delivery_mode || 'Live Cohort';
  }
  if (course.duration !== undefined) {
    payload.duration = String(course.duration || '').trim();
  }
  if (course.price !== undefined) {
    payload.price = typeof course.price === 'number' ? course.price : parseFloat(course.price as any) || 0;
  }
  if (course.offerPrice !== undefined || course.offer_price !== undefined) {
    const val = course.offerPrice !== undefined ? course.offerPrice : course.offer_price;
    payload.offer_price = val !== null && val !== undefined && (val as any) !== '' && !isNaN(Number(val))
      ? Number(val)
      : null;
  }
  if (course.offerExpiresAt !== undefined || course.offer_expires_at !== undefined) {
    const val = course.offerExpiresAt || course.offer_expires_at;
    payload.offer_expires_at = val ? new Date(val).toISOString() : null;
  }
  if (course.currency !== undefined) {
    payload.currency = String(course.currency || 'INR').trim();
  }
  if (course.instructor !== undefined) {
    payload.instructor = String(course.instructor || 'Digital Muid').trim();
  }
  if (course.instructorTitle !== undefined || course.instructor_title !== undefined) {
    payload.instructor_title = course.instructorTitle || course.instructor_title || null;
  }
  if (course.instructorAvatar !== undefined || course.instructor_avatar !== undefined) {
    payload.instructor_avatar = course.instructorAvatar || course.instructor_avatar || null;
  }
  if (course.thumbnail !== undefined) {
    payload.thumbnail = String(course.thumbnail || '').trim() || null;
  }
  if (course.coverImage !== undefined || course.cover_image !== undefined) {
    payload.cover_image = String(course.coverImage || course.cover_image || '').trim() || null;
  }
  if (course.aiIntegrated !== undefined || course.ai_integrated !== undefined) {
    payload.ai_integrated = Boolean(course.aiIntegrated ?? course.ai_integrated);
  }
  if (course.aiToolsCovered !== undefined || course.ai_tools_covered !== undefined) {
    const tools = course.aiToolsCovered ?? course.ai_tools_covered;
    payload.ai_tools_covered = Array.isArray(tools) ? tools : [];
  }
  if (course.featured !== undefined || course.isFeatured !== undefined) {
    payload.featured = Boolean(course.featured ?? course.isFeatured);
  }
  if (course.status !== undefined) {
    payload.status = course.status;
  }
  if (course.enrolledCount !== undefined || course.enrolled_count !== undefined) {
    payload.enrolled_count = Number(course.enrolledCount ?? course.enrolled_count ?? 0);
  }
  if (course.cohortStartDate !== undefined || course.cohort_start_date !== undefined) {
    const val = course.cohortStartDate || course.cohort_start_date;
    payload.cohort_start_date = val ? new Date(val).toISOString() : null;
  }
  if (course.maxSeats !== undefined || course.max_seats !== undefined) {
    const val = course.maxSeats ?? course.max_seats;
    payload.max_seats = val !== null && val !== undefined && (val as any) !== '' && !isNaN(Number(val))
      ? Number(val)
      : null;
  }
  if (course.curriculum !== undefined) {
    payload.curriculum = normalizeCourseCurriculum(course.curriculum);
  }
  if (course.highlights !== undefined) {
    payload.highlights = Array.isArray(course.highlights) ? course.highlights : [];
  }
  if (course.tags !== undefined) {
    payload.tags = Array.isArray(course.tags) ? course.tags : [];
  }
  if (course.relatedFrameworks !== undefined || course.related_frameworks !== undefined) {
    const rel = course.relatedFrameworks ?? course.related_frameworks;
    payload.related_frameworks = Array.isArray(rel) ? rel : [];
  }
  if (course.relatedArticles !== undefined || course.related_articles !== undefined) {
    const rel = course.relatedArticles ?? course.related_articles;
    payload.related_articles = Array.isArray(rel) ? rel : [];
  }
  if (course.relatedVideos !== undefined || course.related_videos !== undefined) {
    const rel = course.relatedVideos ?? course.related_videos;
    payload.related_videos = Array.isArray(rel) ? rel : [];
  }
  if (course.relatedResources !== undefined || course.related_resources !== undefined) {
    const rel = course.relatedResources ?? course.related_resources;
    payload.related_resources = Array.isArray(rel) ? rel : [];
  }
  if (course.seoTitle !== undefined || course.seo_title !== undefined) {
    payload.seo_title = course.seoTitle || course.seo_title || null;
  }
  if (course.seoDescription !== undefined || course.seo_description !== undefined) {
    payload.seo_description = course.seoDescription || course.seo_description || null;
  }
  if (course.ogImage !== undefined || course.og_image !== undefined) {
    payload.og_image = course.ogImage || course.og_image || null;
  }

  return payload;
};

export const courseService = {
  /**
   * Fetches published courses for public visitors.
   */
  async fetchPublishedCourses(): Promise<{ data: Course[] | null; error: any }> {
    try {
      if (!isSupabaseConfigured()) {
        console.warn('[CourseService] Supabase not configured. Using local initial courses.');
        return { data: INITIAL_COURSES.filter(c => c.status === 'published'), error: null };
      }

      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('courses')) {
          console.warn('[CourseService] Table "courses" not yet migrated. Falling back to local data.');
          return { data: INITIAL_COURSES.filter(c => c.status === 'published'), error: null };
        }
        console.error('[CourseService] Error fetching published courses:', error);
        return { data: null, error };
      }

      if (!data || data.length === 0) {
        return { data: INITIAL_COURSES.filter(c => c.status === 'published'), error: null };
      }

      const courses = data.map(mapDbRowToCourse);
      return { data: courses, error: null };
    } catch (err: any) {
      console.error('[CourseService] Exception in fetchPublishedCourses:', err);
      return { data: INITIAL_COURSES.filter(c => c.status === 'published'), error: null };
    }
  },

  /**
   * Fetches all courses (published, draft, archived) for Admin CMS.
   */
  async fetchAllCourses(): Promise<{ data: Course[] | null; error: any }> {
    try {
      if (!isSupabaseConfigured()) {
        return { data: INITIAL_COURSES, error: null };
      }

      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('courses')) {
          console.warn('[CourseService] Table "courses" not yet migrated. Falling back to local data.');
          return { data: INITIAL_COURSES, error: null };
        }
        console.error('[CourseService] Error fetching all courses:', error);
        return { data: null, error };
      }

      if (!data || data.length === 0) {
        return { data: INITIAL_COURSES, error: null };
      }

      const courses = data.map(mapDbRowToCourse);
      return { data: courses, error: null };
    } catch (err: any) {
      console.error('[CourseService] Exception in fetchAllCourses:', err);
      return { data: INITIAL_COURSES, error: null };
    }
  },

  /**
   * Fetches a single course by slug.
   */
  async fetchCourseBySlug(slug: string): Promise<{ data: Course | null; error: any }> {
    try {
      const cleanSlug = slugify(slug);
      if (!isSupabaseConfigured()) {
        const found = INITIAL_COURSES.find(c => c.slug === cleanSlug || c.slug === slug);
        return { data: found || null, error: found ? null : new Error('Course not found') };
      }

      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('slug', cleanSlug)
        .maybeSingle();

      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('courses')) {
          const found = INITIAL_COURSES.find(c => c.slug === cleanSlug || c.slug === slug);
          return { data: found || null, error: null };
        }
        console.error(`[CourseService] Error fetching course by slug "${slug}":`, error);
        return { data: null, error };
      }

      if (!data) {
        const found = INITIAL_COURSES.find(c => c.slug === cleanSlug || c.slug === slug);
        return { data: found || null, error: found ? null : new Error('Course not found') };
      }

      return { data: mapDbRowToCourse(data), error: null };
    } catch (err: any) {
      console.error('[CourseService] Exception in fetchCourseBySlug:', err);
      const found = INITIAL_COURSES.find(c => c.slug === slug);
      return { data: found || null, error: null };
    }
  },

  /**
   * Inserts a new course into Supabase.
   */
  async insertCourse(courseData: Partial<Course>): Promise<{ data: Course | null; error: any }> {
    try {
      if (!isSupabaseConfigured()) {
        const localCourse: Course = {
          id: `crs-${Date.now()}`,
          slug: slugify(courseData.slug || courseData.title || `course-${Date.now()}`),
          title: courseData.title || 'Untitled Course',
          shortOutcome: courseData.shortOutcome || '',
          description: courseData.description || '',
          curriculum: normalizeCourseCurriculum(courseData.curriculum),
          duration: courseData.duration || '10 Hours',
          level: courseData.level || 'All Levels',
          deliveryMode: courseData.deliveryMode || 'Live Cohort',
          price: courseData.price || 0,
          offerPrice: courseData.offerPrice,
          offerExpiresAt: courseData.offerExpiresAt,
          currency: courseData.currency || 'INR',
          thumbnail: courseData.thumbnail || 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80',
          coverImage: courseData.coverImage,
          instructor: courseData.instructor || 'Digital Muid',
          instructorTitle: courseData.instructorTitle,
          instructorAvatar: courseData.instructorAvatar,
          aiIntegrated: Boolean(courseData.aiIntegrated),
          aiToolsCovered: courseData.aiToolsCovered || [],
          featured: Boolean(courseData.featured || courseData.isFeatured),
          status: courseData.status || 'draft',
          enrolledCount: courseData.enrolledCount || 0,
          cohortStartDate: courseData.cohortStartDate,
          maxSeats: courseData.maxSeats,
          tags: courseData.tags || [],
          highlights: courseData.highlights || [],
          relatedFrameworks: courseData.relatedFrameworks || [],
          relatedArticles: courseData.relatedArticles || [],
          relatedVideos: courseData.relatedVideos || [],
          relatedResources: courseData.relatedResources || [],
          seoTitle: courseData.seoTitle,
          seoDescription: courseData.seoDescription,
          ogImage: courseData.ogImage,
          createdAt: new Date().toISOString().split('T')[0]
        };
        return { data: localCourse, error: null };
      }

      const payload = mapCourseToDbPayload(courseData);
      if (!payload.title) {
        return { data: null, error: new Error('Course title is required.') };
      }
      if (!payload.slug) {
        payload.slug = slugify(payload.title);
      }

      const { data, error } = await supabase
        .from('courses')
        .insert([payload])
        .select()
        .single();

      if (error) {
        console.error('[CourseService] Error inserting course:', error);
        return { data: null, error };
      }

      return { data: mapDbRowToCourse(data), error: null };
    } catch (err: any) {
      console.error('[CourseService] Exception in insertCourse:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Updates an existing course by id in Supabase.
   */
  async updateCourse(id: string, updates: Partial<Course>): Promise<{ data: Course | null; error: any }> {
    try {
      if (!isSupabaseConfigured()) {
        const updatedCourse: Course = {
          ...(updates as any),
          id,
          updatedAt: new Date().toISOString()
        };
        return { data: updatedCourse, error: null };
      }

      const payload = mapCourseToDbPayload(updates);

      const { data, error } = await supabase
        .from('courses')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error(`[CourseService] Error updating course ${id}:`, error);
        return { data: null, error };
      }

      return { data: mapDbRowToCourse(data), error: null };
    } catch (err: any) {
      console.error('[CourseService] Exception in updateCourse:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Deletes a course from Supabase by id.
   */
  async deleteCourse(id: string): Promise<{ success: boolean; error: any }> {
    try {
      if (!isSupabaseConfigured()) {
        return { success: true, error: null };
      }

      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', id);

      if (error) {
        console.error(`[CourseService] Error deleting course ${id}:`, error);
        return { success: false, error };
      }

      return { success: true, error: null };
    } catch (err: any) {
      console.error('[CourseService] Exception in deleteCourse:', err);
      return { success: false, error: err };
    }
  },

  /**
   * Publishes a course (sets status to 'published').
   */
  async publishCourse(id: string): Promise<{ data: Course | null; error: any }> {
    return this.updateCourse(id, {
      status: 'published'
    });
  },

  /**
   * Unpublishes a course (sets status to 'draft').
   */
  async unpublishCourse(id: string): Promise<{ data: Course | null; error: any }> {
    return this.updateCourse(id, {
      status: 'draft'
    });
  },

  /**
   * Synchronizes initial courses into Supabase without overwriting existing courses by slug.
   */
  async syncInitialCourses(initialCourses: Course[] = INITIAL_COURSES): Promise<{
    totalCount: number;
    importedCount: number;
    alreadyExistingCount: number;
    failedCount: number;
    results: any[];
  }> {
    const summary = {
      totalCount: initialCourses.length,
      importedCount: 0,
      alreadyExistingCount: 0,
      failedCount: 0,
      results: [] as any[]
    };

    if (!isSupabaseConfigured()) {
      return summary;
    }

    try {
      // 1. Fetch all existing course slugs from Supabase
      const { data: existingRows, error: fetchErr } = await supabase
        .from('courses')
        .select('id, slug');

      if (fetchErr) {
        console.error('[CourseService] Error fetching existing courses for baseline sync:', fetchErr);
        summary.failedCount = initialCourses.length;
        return summary;
      }

      const existingSlugSet = new Set((existingRows || []).map((r: any) => r.slug));

      // 2. Iterate through initial courses and insert missing ones
      for (const course of initialCourses) {
        const cleanSlug = slugify(course.slug);
        if (existingSlugSet.has(cleanSlug) || existingSlugSet.has(course.slug)) {
          summary.alreadyExistingCount++;
          summary.results.push({ slug: course.slug, status: 'already_exists' });
          continue;
        }

        const payload = mapCourseToDbPayload(course);
        const { data: inserted, error: insertErr } = await supabase
          .from('courses')
          .insert([payload])
          .select()
          .single();

        if (insertErr) {
          console.error(`[CourseService] Failed to sync baseline course "${course.title}":`, insertErr);
          summary.failedCount++;
          summary.results.push({ slug: course.slug, status: 'failed', error: insertErr });
        } else {
          summary.importedCount++;
          existingSlugSet.add(cleanSlug);
          summary.results.push({ slug: course.slug, status: 'imported', id: inserted?.id });
        }
      }

      console.info('[CourseService] Initial courses baseline sync complete:', summary);
      return summary;
    } catch (err: any) {
      console.error('[CourseService] Exception during syncInitialCourses:', err);
      return summary;
    }
  },

  /**
   * Requests a secure playback token for a course lesson.
   * Calls the database RPC public.get_course_lesson_playback to verify authorization.
   * Returns short-lived media provider and asset ID if authorized, or an error reason.
   */
  async getLessonPlaybackToken(courseId: string, lessonId: string): Promise<PlaybackAuthorization> {
    try {
      if (!isSupabaseConfigured()) {
        return {
          authorized: false,
          error: 'Backend authentication service not configured'
        };
      }

      const { data, error } = await supabase.rpc('get_course_lesson_playback', {
        p_course_id: courseId,
        p_lesson_id: lessonId
      });

      if (error) {
        console.error(`[CourseService] Error fetching playback token for lesson ${lessonId}:`, error);
        return {
          authorized: false,
          error: error.message || 'Authorization error'
        };
      }

      if (!data) {
        return {
          authorized: false,
          error: 'No authorization response received'
        };
      }

      return {
        authorized: Boolean(data.authorized),
        provider: data.provider,
        assetId: data.asset_id,
        playbackType: data.playback_type,
        expiresAt: data.expires_at,
        error: data.error,
        isEnrolled: Boolean(data.is_enrolled),
        isAdmin: Boolean(data.is_admin),
        isPreview: Boolean(data.is_preview)
      };
    } catch (err: any) {
      console.error('[CourseService] Exception in getLessonPlaybackToken:', err);
      return {
        authorized: false,
        error: err?.message || 'Unexpected authorization failure'
      };
    }
  },

  /**
   * Fetches all lesson media records for a given course (Admin only).
   */
  async fetchCourseLessonMedia(courseId: string): Promise<{ data: CourseLessonMedia[] | null; error: any }> {
    try {
      if (!isSupabaseConfigured()) {
        return { data: [], error: null };
      }

      const { data, error } = await supabase
        .from('course_lesson_media')
        .select('*')
        .eq('course_id', courseId);

      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('course_lesson_media')) {
          return { data: [], error: null };
        }
        console.error('[CourseService] Error fetching course lesson media:', error);
        return { data: null, error };
      }

      const formatted: CourseLessonMedia[] = (data || []).map((row: any) => ({
        id: row.id,
        courseId: row.course_id,
        lessonId: row.lesson_id,
        provider: row.provider,
        assetId: row.asset_id,
        isPreview: Boolean(row.is_preview),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));

      return { data: formatted, error: null };
    } catch (err: any) {
      console.error('[CourseService] Exception in fetchCourseLessonMedia:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Upserts a secure lesson media record (Admin only).
   */
  async upsertCourseLessonMedia(media: {
    courseId: string;
    lessonId: string;
    provider: 'cloudflare_stream' | 'mux' | 'supabase_storage' | 'youtube_unlisted' | 'external';
    assetId: string;
    isPreview: boolean;
  }): Promise<{ data: CourseLessonMedia | null; error: any }> {
    try {
      if (!isSupabaseConfigured()) {
        return {
          data: {
            courseId: media.courseId,
            lessonId: media.lessonId,
            provider: media.provider,
            assetId: media.assetId,
            isPreview: media.isPreview,
            updatedAt: new Date().toISOString()
          },
          error: null
        };
      }

      const payload = {
        course_id: media.courseId,
        lesson_id: media.lessonId,
        provider: media.provider,
        asset_id: media.assetId,
        is_preview: media.isPreview,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('course_lesson_media')
        .upsert(payload, { onConflict: 'course_id,lesson_id' })
        .select()
        .single();

      if (error) {
        console.error('[CourseService] Error upserting course lesson media:', error);
        return { data: null, error };
      }

      return {
        data: {
          id: data.id,
          courseId: data.course_id,
          lessonId: data.lesson_id,
          provider: data.provider,
          assetId: data.asset_id,
          isPreview: Boolean(data.is_preview),
          createdAt: data.created_at,
          updatedAt: data.updated_at
        },
        error: null
      };
    } catch (err: any) {
      console.error('[CourseService] Exception in upsertCourseLessonMedia:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Deletes a secure lesson media record (Admin only).
   */
  async deleteCourseLessonMedia(courseId: string, lessonId: string): Promise<{ success: boolean; error: any }> {
    try {
      if (!isSupabaseConfigured()) return { success: true, error: null };

      const { error } = await supabase
        .from('course_lesson_media')
        .delete()
        .eq('course_id', courseId)
        .eq('lesson_id', lessonId);

      if (error) {
        console.error('[CourseService] Error deleting lesson media:', error);
        return { success: false, error };
      }

      return { success: true, error: null };
    } catch (err: any) {
      console.error('[CourseService] Exception in deleteCourseLessonMedia:', err);
      return { success: false, error: err };
    }
  }
};
