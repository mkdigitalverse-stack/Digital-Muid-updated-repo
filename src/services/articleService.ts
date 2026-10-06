import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Article } from '../types';

/**
 * Generates a clean URL-safe slug from a string title.
 */
export const slugify = (text: string): string => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

/**
 * Transforms a Supabase database row into an application Article object.
 */
export const mapDbRowToArticle = (row: any): Article => {
  const readingTime = Number(row.reading_time_minutes ?? row.readingTimeMinutes ?? 5);
  const isFeatured = Boolean(row.is_featured ?? row.isFeatured ?? row.featured ?? false);
  const rawAuthor = row.author;
  const authorObj = typeof rawAuthor === 'string'
    ? {
        name: rawAuthor || 'Digital Muid',
        role: 'Founder & Strategic Architect',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'
      }
    : (rawAuthor || {
        name: 'Digital Muid',
        role: 'Founder & Strategic Architect',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'
      });

  const rawPubDate = row.published_at || row.publishedAt;
  const formattedPubDate = typeof rawPubDate === 'string' && rawPubDate.includes('T')
    ? rawPubDate.split('T')[0]
    : (rawPubDate ? String(rawPubDate) : undefined);

  return {
    id: String(row.id || `art-${Date.now()}`),
    title: String(row.title || ''),
    slug: String(row.slug || ''),
    excerpt: String(row.excerpt || ''),
    content: String(row.content || ''),
    category: String(row.category || 'Digital Growth'),
    author: authorObj,
    featuredImage: row.featured_image || row.featuredImage || 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
    readingTimeMinutes: readingTime > 0 ? readingTime : 5,
    readTime: `${readingTime > 0 ? readingTime : 5} min read`,
    status: (row.status || 'draft') as 'draft' | 'published' | 'archived',
    isFeatured,
    featured: isFeatured,
    publishedAt: formattedPubDate,
    seoTitle: row.seo_title || row.seoTitle || undefined,
    seoDescription: row.seo_description || row.seoDescription || undefined,
    tags: Array.isArray(row.tags) ? row.tags : [row.category || 'Strategy', 'Growth'],
    createdAt: String(row.created_at || row.createdAt || new Date().toISOString()),
    updatedAt: String(row.updated_at || row.updatedAt || new Date().toISOString())
  };
};

/**
 * Transforms an application Article object or partial update into a Supabase database payload.
 */
export const mapArticleToDbPayload = (a: Partial<Article>): Record<string, any> => {
  const payload: Record<string, any> = {};

  if (a.title !== undefined) payload.title = a.title.trim();
  if (a.slug !== undefined) payload.slug = slugify(a.slug || a.title || '');
  if (a.excerpt !== undefined) payload.excerpt = a.excerpt;
  if (a.content !== undefined) payload.content = a.content;
  if (a.category !== undefined) payload.category = a.category;
  if (a.author !== undefined) {
    payload.author = typeof a.author === 'string' ? a.author : (a.author?.name || 'Digital Muid');
  }
  if (a.featuredImage !== undefined) {
    payload.featured_image = a.featuredImage ? a.featuredImage.trim() : null;
  }
  if (a.readingTimeMinutes !== undefined) {
    payload.reading_time_minutes = Math.max(1, Number(a.readingTimeMinutes) || 5);
  }
  if (a.status !== undefined) {
    payload.status = a.status;
  }
  if (a.isFeatured !== undefined || a.featured !== undefined) {
    payload.is_featured = Boolean(a.isFeatured ?? a.featured ?? false);
  }
  if (a.publishedAt !== undefined) {
    payload.published_at = a.publishedAt ? new Date(a.publishedAt).toISOString() : null;
  }
  if (a.seoTitle !== undefined) {
    payload.seo_title = a.seoTitle ? a.seoTitle.trim() : null;
  }
  if (a.seoDescription !== undefined) {
    payload.seo_description = a.seoDescription ? a.seoDescription.trim() : null;
  }

  payload.updated_at = new Date().toISOString();
  return payload;
};

/**
 * Article Service: Modular API for Articles CMS in Supabase
 */
export const articleService = {
  /**
   * Fetches published articles only (public endpoint)
   */
  async fetchPublishedArticles(): Promise<{ data: Article[] | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase is not configured') };
    }

    try {
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('status', 'published')
        .order('published_at', { ascending: false, nullsFirst: false });

      if (error) {
        if (error.code !== 'PGRST205') {
          console.error('[Supabase Article] Error fetching published articles:', error);
        } else {
          console.debug('[Supabase Article] Notice: public.articles table is not in schema cache (PGRST205), relying on local storage articles repository.');
        }
        return { data: null, error };
      }

      const mapped = (data || []).map(mapDbRowToArticle);
      return { data: mapped, error: null };
    } catch (err) {
      console.warn('[Supabase Article] Unexpected fetchPublishedArticles error:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Fetches all articles including drafts (authenticated admin endpoint)
   */
  async fetchAllArticles(): Promise<{ data: Article[] | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase is not configured') };
    }

    try {
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code !== 'PGRST205') {
          console.error('[Supabase Article] Error fetching all articles:', error);
        } else {
          console.debug('[Supabase Article] Notice: public.articles table is not in schema cache (PGRST205), relying on local storage articles repository.');
        }
        return { data: null, error };
      }

      const mapped = (data || []).map(mapDbRowToArticle);
      return { data: mapped, error: null };
    } catch (err) {
      console.warn('[Supabase Article] Unexpected fetchAllArticles error:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Fetches a single published article by its slug
   */
  async fetchArticleBySlug(slug: string): Promise<{ data: Article | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase is not configured') };
    }

    try {
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();

      if (error) {
        if (error.code !== 'PGRST205') {
          console.error(`[Supabase Article] Error fetching article by slug (${slug}):`, error);
        }
        return { data: null, error };
      }

      if (!data) {
        return { data: null, error: null };
      }

      return { data: mapDbRowToArticle(data), error: null };
    } catch (err) {
      console.warn(`[Supabase Article] Unexpected error fetching slug (${slug}):`, err);
      return { data: null, error: err };
    }
  },

  /**
   * Inserts a new article into Supabase
   */
  async insertArticle(article: Partial<Article>): Promise<{ data: Article | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase is not configured') };
    }

    try {
      const payload = mapArticleToDbPayload(article);
      if (!payload.title) {
        return { data: null, error: new Error('Article title is required') };
      }
      if (!payload.slug) {
        payload.slug = slugify(payload.title);
      }

      // If status is published and published_at is not set, set it now
      if (payload.status === 'published' && !payload.published_at) {
        payload.published_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('articles')
        .insert([payload])
        .select()
        .single();

      if (error) {
        if (error.code !== 'PGRST205') {
          console.error('[Supabase Article] Error inserting article:', error);
        } else {
          console.debug('[Supabase Article] public.articles table is not in schema cache (PGRST205).');
        }
        return { data: null, error };
      }

      return { data: mapDbRowToArticle(data), error: null };
    } catch (err) {
      console.warn('[Supabase Article] Unexpected error inserting article:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Updates an existing article in Supabase by ID
   */
  async updateArticle(id: string, updates: Partial<Article>): Promise<{ data: Article | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase is not configured') };
    }

    try {
      const payload = mapArticleToDbPayload(updates);

      // If updating to published and published_at was unset, set it
      if (payload.status === 'published' && !payload.published_at && updates.publishedAt === undefined) {
        payload.published_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('articles')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code !== 'PGRST205') {
          console.error(`[Supabase Article] Error updating article (${id}):`, error);
        } else {
          console.debug('[Supabase Article] public.articles table is not in schema cache (PGRST205).');
        }
        return { data: null, error };
      }

      return { data: mapDbRowToArticle(data), error: null };
    } catch (err) {
      console.warn(`[Supabase Article] Unexpected error updating article (${id}):`, err);
      return { data: null, error: err };
    }
  },

  /**
   * Deletes an article from Supabase by ID
   */
  async deleteArticle(id: string): Promise<{ success: boolean; error: any }> {
    if (!isSupabaseConfigured()) {
      return { success: false, error: new Error('Supabase is not configured') };
    }

    try {
      const { error } = await supabase
        .from('articles')
        .delete()
        .eq('id', id);

      if (error) {
        console.error(`[Supabase Article] Error deleting article (${id}):`, error);
        return { success: false, error };
      }

      return { success: true, error: null };
    } catch (err) {
      console.error(`[Supabase Article] Unexpected error deleting article (${id}):`, err);
      return { success: false, error: err };
    }
  },

  /**
   * Publishes an article (sets status to published and sets published_at)
   */
  async publishArticle(id: string): Promise<{ data: Article | null; error: any }> {
    return this.updateArticle(id, {
      status: 'published',
      publishedAt: new Date().toISOString()
    });
  },

  /**
   * Unpublishes an article (sets status to draft)
   */
  async unpublishArticle(id: string): Promise<{ data: Article | null; error: any }> {
    return this.updateArticle(id, {
      status: 'draft'
    });
  }
};
