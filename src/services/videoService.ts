import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Video } from '../types';
import { slugify } from './articleService';

/**
 * Extracts a YouTube Video ID safely from various formats:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/shorts/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://m.youtube.com/watch?v=VIDEO_ID
 * - Plain 11-character ID
 */
export const extractYouTubeVideoId = (input: string): string | null => {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  const patterns = [
    /(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/i,
    /(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/i,
    /(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/i,
    /(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})/i,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/v\/([a-zA-Z0-9_-]{11})/i
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
};

/**
 * Generates privacy-friendly standard embed URL
 */
export const getYouTubeEmbedUrl = (videoId: string): string => {
  if (!videoId) return '';
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
};

/**
 * Generates standard high-definition thumbnail URL from video ID
 */
export const getYouTubeThumbnail = (videoId: string): string => {
  if (!videoId) return '';
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
};

/**
 * Transforms a Supabase database row into an application Video object.
 */
export const mapDbRowToVideo = (row: any): Video => {
  const isFeatured = Boolean(row.is_featured ?? row.isFeatured ?? row.featured ?? false);
  const rawPubDate = row.published_at || row.publishedAt;
  const formattedPubDate = typeof rawPubDate === 'string' && rawPubDate.includes('T')
    ? rawPubDate.split('T')[0]
    : (rawPubDate ? String(rawPubDate) : undefined);

  const youtubeUrl = String(row.youtube_url || row.youtubeUrl || row.videoUrl || '');
  const rawVideoId = row.youtube_video_id || row.youtubeVideoId;
  const youtubeVideoId = rawVideoId || (youtubeUrl ? extractYouTubeVideoId(youtubeUrl) : undefined) || undefined;
  
  const autoThumbnail = youtubeVideoId ? getYouTubeThumbnail(youtubeVideoId) : '';
  const thumbnailUrl = row.thumbnail_url || row.thumbnailUrl || row.thumbnail || autoThumbnail;
  const embedUrl = youtubeVideoId ? getYouTubeEmbedUrl(youtubeVideoId) : (row.embed_url || row.embedUrl || '');

  return {
    id: String(row.id),
    title: String(row.title || ''),
    slug: String(row.slug || ''),
    description: String(row.description || ''),
    category: String(row.category || 'Digital Growth'),
    youtubeUrl,
    youtubeVideoId,
    thumbnailUrl,
    thumbnail: thumbnailUrl, // alias for UI compatibility
    videoUrl: youtubeUrl, // alias for UI compatibility
    embedUrl,
    duration: row.duration || '12:00',
    creator: String(row.creator || 'Digital Muid'),
    tags: Array.isArray(row.tags) ? row.tags : (row.tags ? [row.tags] : [row.category || 'Digital Growth']),
    status: (row.status || 'draft') as 'draft' | 'published' | 'archived',
    isFeatured,
    featured: isFeatured,
    publishedAt: formattedPubDate,
    viewsCount: row.views_count || row.viewsCount || '1.2k views',
    seoTitle: row.seo_title || row.seoTitle || undefined,
    seoDescription: row.seo_description || row.seoDescription || undefined,
    createdAt: String(row.created_at || row.createdAt || new Date().toISOString()),
    updatedAt: String(row.updated_at || row.updatedAt || new Date().toISOString())
  };
};

/**
 * Transforms an application Video object or partial update into a Supabase database payload.
 * Strictly adheres to public.videos schema:
 * title, slug, description, category, youtube_url, youtube_video_id, thumbnail_url,
 * duration, creator, tags, status, is_featured, published_at, seo_title, seo_description, updated_at
 */
export const mapVideoToDbPayload = (v: Partial<Video>): Record<string, any> => {
  const payload: Record<string, any> = {};

  if (v.title !== undefined) payload.title = v.title.trim();
  if (v.slug !== undefined) payload.slug = slugify(v.slug || v.title || '');
  if (v.description !== undefined) payload.description = v.description;
  if (v.category !== undefined) payload.category = v.category;

  const rawYoutubeUrl = (v.youtubeUrl || v.videoUrl || '').trim();
  const vidId = v.youtubeVideoId || (rawYoutubeUrl ? extractYouTubeVideoId(rawYoutubeUrl) : null);

  if (rawYoutubeUrl) {
    payload.youtube_url = rawYoutubeUrl;
  } else if (vidId) {
    payload.youtube_url = `https://www.youtube.com/watch?v=${vidId}`;
  }

  if (vidId) {
    payload.youtube_video_id = vidId;
    if (!v.thumbnailUrl && !v.thumbnail) {
      payload.thumbnail_url = getYouTubeThumbnail(vidId);
    }
  }

  if (v.thumbnailUrl !== undefined || v.thumbnail !== undefined) {
    const thumb = v.thumbnailUrl || v.thumbnail;
    payload.thumbnail_url = thumb ? thumb.trim() : null;
  }

  if (v.duration !== undefined) {
    payload.duration = v.duration ? v.duration.trim() : '12:00';
  }

  if (v.creator !== undefined) {
    payload.creator = v.creator ? v.creator.trim() : 'Digital Muid';
  }

  if (v.tags !== undefined) {
    payload.tags = Array.isArray(v.tags) ? v.tags : (v.tags ? [v.tags] : []);
  }

  if (v.status !== undefined) {
    payload.status = v.status;
  }

  if (v.isFeatured !== undefined || v.featured !== undefined) {
    payload.is_featured = Boolean(v.isFeatured ?? v.featured ?? false);
  }

  if (v.publishedAt !== undefined) {
    payload.published_at = v.publishedAt ? new Date(v.publishedAt).toISOString() : null;
  }

  if (v.seoTitle !== undefined) {
    payload.seo_title = v.seoTitle ? v.seoTitle.trim() : null;
  }

  if (v.seoDescription !== undefined) {
    payload.seo_description = v.seoDescription ? v.seoDescription.trim() : null;
  }

  payload.updated_at = new Date().toISOString();
  return payload;
};

/**
 * Video Service: Supabase database interface for Videos and Watch CMS
 */
export const videoService = {
  /**
   * Fetches published videos only (public endpoint)
   */
  async fetchPublishedVideos(): Promise<{ data: Video[] | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase is not configured') };
    }

    try {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('status', 'published')
        .order('published_at', { ascending: false, nullsFirst: false });

      if (error) {
        if (error.code !== 'PGRST205') {
          console.error('[Videos CMS Diagnostic] Error fetching published videos:', error);
        } else {
          console.debug('[Videos CMS Diagnostic] Notice: public.videos table is not in schema cache (PGRST205), relying on fallback.');
        }
        return { data: null, error };
      }

      const mapped = (data || []).map(mapDbRowToVideo);
      return { data: mapped, error: null };
    } catch (err) {
      console.warn('[Videos CMS Diagnostic] Unexpected fetchPublishedVideos error:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Fetches all videos including drafts (authenticated admin endpoint)
   */
  async fetchAllVideos(): Promise<{ data: Video[] | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase is not configured') };
    }

    try {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code !== 'PGRST205') {
          console.error('[Videos CMS Diagnostic] Error fetching all videos:', error);
        } else {
          console.debug('[Videos CMS Diagnostic] Notice: public.videos table is not in schema cache (PGRST205), relying on fallback.');
        }
        return { data: null, error };
      }

      const mapped = (data || []).map(mapDbRowToVideo);
      return { data: mapped, error: null };
    } catch (err) {
      console.warn('[Videos CMS Diagnostic] Unexpected fetchAllVideos error:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Fetches a single video by slug
   */
  async fetchVideoBySlug(slug: string): Promise<{ data: Video | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase is not configured') };
    }

    try {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();

      if (error) {
        if (error.code !== 'PGRST205') {
          console.error(`[Videos CMS Diagnostic] Error fetching video by slug (${slug}):`, error);
        }
        return { data: null, error };
      }

      if (!data) {
        return { data: null, error: null };
      }

      return { data: mapDbRowToVideo(data), error: null };
    } catch (err) {
      console.warn(`[Videos CMS Diagnostic] Unexpected error fetching video slug (${slug}):`, err);
      return { data: null, error: err };
    }
  },

  /**
   * Inserts a new video into Supabase
   */
  async insertVideo(video: Partial<Video>): Promise<{ data: Video | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase is not configured') };
    }

    try {
      const payload = mapVideoToDbPayload(video);
      if (!payload.title) {
        return { data: null, error: new Error('Video title is required') };
      }
      if (!payload.youtube_url) {
        return { data: null, error: new Error('YouTube URL is required') };
      }
      if (!payload.slug) {
        payload.slug = slugify(payload.title);
      }

      // If status is published and published_at is not set, set it now
      if (payload.status === 'published' && !payload.published_at) {
        payload.published_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('videos')
        .insert([payload])
        .select()
        .single();

      if (error) {
        console.error('[Videos CMS Diagnostic]', {
          operation: 'create',
          supabaseConfigured: true,
          table: 'public.videos',
          success: false,
          errorCode: error.code,
          errorMessage: error.message,
          errorDetails: error.details,
          errorHint: error.hint
        });
        return { data: null, error };
      }

      console.info('[Videos CMS Diagnostic]', {
        operation: 'create',
        supabaseConfigured: true,
        table: 'public.videos',
        success: true,
        videoId: data?.id
      });

      return { data: mapDbRowToVideo(data), error: null };
    } catch (err: any) {
      console.error('[Videos CMS Diagnostic] Unexpected error inserting video:', {
        operation: 'create',
        supabaseConfigured: true,
        table: 'public.videos',
        success: false,
        errorMessage: err?.message || String(err)
      });
      return { data: null, error: err };
    }
  },

  /**
   * Updates an existing video by ID in Supabase
   */
  async updateVideo(id: string, updates: Partial<Video>): Promise<{ data: Video | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase is not configured') };
    }

    try {
      const payload = mapVideoToDbPayload(updates);

      if (payload.status === 'published' && !payload.published_at && updates.publishedAt === undefined) {
        payload.published_at = new Date().toISOString();
      } else if (payload.status === 'draft' && updates.publishedAt === undefined) {
        payload.published_at = null;
      }

      const { data, error } = await supabase
        .from('videos')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('[Videos CMS Diagnostic]', {
          operation: 'update',
          supabaseConfigured: true,
          table: 'public.videos',
          success: false,
          videoId: id,
          errorCode: error.code,
          errorMessage: error.message,
          errorDetails: error.details,
          errorHint: error.hint
        });
        return { data: null, error };
      }

      console.info('[Videos CMS Diagnostic]', {
        operation: 'update',
        supabaseConfigured: true,
        table: 'public.videos',
        success: true,
        videoId: data?.id
      });

      return { data: mapDbRowToVideo(data), error: null };
    } catch (err: any) {
      console.error('[Videos CMS Diagnostic] Unexpected error updating video:', {
        operation: 'update',
        supabaseConfigured: true,
        table: 'public.videos',
        success: false,
        videoId: id,
        errorMessage: err?.message || String(err)
      });
      return { data: null, error: err };
    }
  },

  /**
   * Deletes a video from Supabase by ID
   */
  async deleteVideo(id: string): Promise<{ success: boolean; error: any }> {
    if (!isSupabaseConfigured()) {
      return { success: false, error: new Error('Supabase is not configured') };
    }

    try {
      const { error } = await supabase
        .from('videos')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[Videos CMS Diagnostic]', {
          operation: 'delete',
          supabaseConfigured: true,
          table: 'public.videos',
          success: false,
          videoId: id,
          errorCode: error.code,
          errorMessage: error.message
        });
        return { success: false, error };
      }

      console.info('[Videos CMS Diagnostic]', {
        operation: 'delete',
        supabaseConfigured: true,
        table: 'public.videos',
        success: true,
        videoId: id
      });

      return { success: true, error: null };
    } catch (err: any) {
      console.error('[Videos CMS Diagnostic] Unexpected error deleting video:', {
        operation: 'delete',
        supabaseConfigured: true,
        table: 'public.videos',
        success: false,
        videoId: id,
        errorMessage: err?.message || String(err)
      });
      return { success: false, error: err };
    }
  },

  /**
   * Publishes a video (sets status to published and records published_at)
   */
  async publishVideo(id: string): Promise<{ data: Video | null; error: any }> {
    return this.updateVideo(id, {
      status: 'published',
      publishedAt: new Date().toISOString()
    });
  },

  /**
   * Unpublishes a video (sets status to draft)
   */
  async unpublishVideo(id: string): Promise<{ data: Video | null; error: any }> {
    return this.updateVideo(id, {
      status: 'draft',
      publishedAt: undefined
    });
  }
};
