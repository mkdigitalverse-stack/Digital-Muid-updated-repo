import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Framework, FrameworkStage } from '../types';
import { slugify } from './articleService';

/**
 * Normalizes framework stages from JSONB or array payload into typed FrameworkStage objects.
 */
export const normalizeFrameworkStages = (rawStages: any): FrameworkStage[] => {
  if (!Array.isArray(rawStages)) {
    if (typeof rawStages === 'string') {
      try {
        const parsed = JSON.parse(rawStages);
        if (Array.isArray(parsed)) return normalizeFrameworkStages(parsed);
      } catch {
        return [];
      }
    }
    return [];
  }

  return rawStages.map((stage: any, index: number) => {
    const stepNum = typeof stage.step === 'number' ? stage.step : parseInt(stage.number || `${index + 1}`, 10) || (index + 1);
    const title = String(stage.title || '').trim();
    const shortDescription = String(stage.shortDescription || stage.subtitle || '').trim();
    const content = String(stage.content || stage.description || '').trim();
    const outcome = String(stage.outcome || stage.impact || '').trim();
    
    let keyActions: string[] = [];
    if (Array.isArray(stage.keyActions)) {
      keyActions = stage.keyActions.map((a: any) => String(a).trim()).filter(Boolean);
    } else if (typeof stage.keyActions === 'string' && stage.keyActions.trim()) {
      keyActions = stage.keyActions.split('\n').map((a: string) => a.trim()).filter(Boolean);
    }

    return {
      step: stepNum,
      title,
      shortDescription,
      content,
      keyActions,
      outcome,
      // Backward compatibility aliases
      number: String(stepNum).padStart(2, '0'),
      subtitle: shortDescription,
      description: content,
      impact: outcome
    };
  });
};

/**
 * Transforms a Supabase database row into an application Framework object.
 */
export const mapDbRowToFramework = (row: any): Framework => {
  const isFeatured = Boolean(row.is_featured ?? row.isFeatured ?? row.featured ?? false);
  const rawPubDate = row.published_at || row.publishedAt;
  const formattedPubDate = typeof rawPubDate === 'string' && rawPubDate.includes('T')
    ? rawPubDate.split('T')[0]
    : (rawPubDate ? String(rawPubDate) : undefined);

  const stages = normalizeFrameworkStages(row.framework_content ?? row.frameworkContent ?? row.steps);
  const title = String(row.title || row.name || '');
  const subtitle = String(row.subtitle || '');
  const description = String(row.description || row.introduction || '');
  const problemStatement = String(row.problem_statement ?? row.problemStatement ?? row.problem ?? '');
  const solutionStatement = String(row.solution_statement ?? row.solutionStatement ?? '');
  const coverImage = row.cover_image || row.coverImage || undefined;
  const whoIsItFor = String(row.who_is_it_for ?? row.whoIsItFor ?? '');
  const whenToUse = String(row.when_to_use ?? row.whenToUse ?? '');

  const relatedArticles = Array.isArray(row.related_articles ?? row.relatedArticles)
    ? (row.related_articles ?? row.relatedArticles)
    : [];
  const relatedVideos = Array.isArray(row.related_videos ?? row.relatedVideos)
    ? (row.related_videos ?? row.relatedVideos)
    : [];
  const relatedResources = Array.isArray(row.related_resources ?? row.relatedResources)
    ? (row.related_resources ?? row.relatedResources)
    : [];

  const tags = Array.isArray(row.tags) ? row.tags : (row.tags ? [row.tags] : [row.category || 'Digital Growth']);

  return {
    id: String(row.id),
    title,
    name: title, // alias for UI compatibility
    slug: String(row.slug || ''),
    subtitle,
    description,
    category: String(row.category || 'Digital Growth'),
    author: String(row.author || 'Digital Muid'),
    coverImage,
    cover_image: coverImage,
    problemStatement,
    problem_statement: problemStatement,
    solutionStatement,
    solution_statement: solutionStatement,
    frameworkContent: stages,
    framework_content: stages,
    whoIsItFor,
    who_is_it_for: whoIsItFor,
    whenToUse,
    when_to_use: whenToUse,
    relatedArticles,
    related_articles: relatedArticles,
    relatedVideos,
    related_videos: relatedVideos,
    relatedResources,
    related_resources: relatedResources,
    tags,
    status: (row.status || 'draft') as 'draft' | 'published' | 'archived',
    isFeatured,
    is_featured: isFeatured,
    featured: isFeatured,
    seoTitle: row.seo_title || row.seoTitle || undefined,
    seo_title: row.seo_title || row.seoTitle || undefined,
    seoDescription: row.seo_description || row.seoDescription || undefined,
    seo_description: row.seo_description || row.seoDescription || undefined,
    publishedAt: formattedPubDate,
    published_at: formattedPubDate,
    createdAt: String(row.created_at || row.createdAt || new Date().toISOString()),
    created_at: String(row.created_at || row.createdAt || new Date().toISOString()),
    updatedAt: String(row.updated_at || row.updatedAt || new Date().toISOString()),
    updated_at: String(row.updated_at || row.updatedAt || new Date().toISOString()),

    // Compatibility fields
    introduction: description,
    problem: problemStatement,
    steps: stages,
    diagramType: row.diagram_type || row.diagramType || 'stack',
    principles: Array.isArray(row.principles) ? row.principles : [],
    examples: Array.isArray(row.examples) ? row.examples : [],
    relatedCourses: Array.isArray(row.relatedCourses) ? row.relatedCourses : [],
    ctaText: row.ctaText || 'Deploy this framework in your organization'
  };
};

/**
 * Transforms an application Framework object or partial update into a Supabase database payload.
 * Strictly adheres to public.frameworks schema.
 */
export const mapFrameworkToDbPayload = (f: Partial<Framework>): Record<string, any> => {
  const payload: Record<string, any> = {};

  if (f.title !== undefined || f.name !== undefined) {
    payload.title = (f.title || f.name || '').trim();
  }
  if (f.slug !== undefined) {
    payload.slug = slugify(f.slug || f.title || f.name || '');
  }
  if (f.subtitle !== undefined) payload.subtitle = f.subtitle.trim();
  if (f.description !== undefined || f.introduction !== undefined) {
    payload.description = (f.description !== undefined ? f.description : f.introduction || '').trim();
  }
  if (f.category !== undefined) payload.category = f.category.trim();
  if (f.author !== undefined) payload.author = f.author.trim();
  
  if (f.coverImage !== undefined || f.cover_image !== undefined) {
    payload.cover_image = (f.coverImage || f.cover_image || '').trim() || null;
  }

  if (f.problemStatement !== undefined || f.problem_statement !== undefined || f.problem !== undefined) {
    payload.problem_statement = (f.problemStatement ?? f.problem_statement ?? f.problem ?? '').trim();
  }

  if (f.solutionStatement !== undefined || f.solution_statement !== undefined) {
    payload.solution_statement = (f.solutionStatement ?? f.solution_statement ?? '').trim();
  }

  const isUUID = (str: any) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

  if (f.frameworkContent !== undefined || f.framework_content !== undefined || f.steps !== undefined) {
    const rawStages = f.frameworkContent ?? f.framework_content ?? f.steps ?? [];
    payload.framework_content = normalizeFrameworkStages(rawStages).map((s, idx) => ({
      step: s.step || idx + 1,
      title: s.title || '',
      shortDescription: s.shortDescription || s.subtitle || '',
      content: s.content || s.description || '',
      keyActions: Array.isArray(s.keyActions) ? s.keyActions : [],
      outcome: s.outcome || s.impact || '',
      // Aliases preserved in JSONB for full fidelity
      number: s.number || String(s.step || idx + 1).padStart(2, '0'),
      subtitle: s.shortDescription || s.subtitle || '',
      description: s.content || s.description || '',
      impact: s.outcome || s.impact || ''
    }));
  }

  if (f.whoIsItFor !== undefined || f.who_is_it_for !== undefined) {
    payload.who_is_it_for = (f.whoIsItFor ?? f.who_is_it_for ?? '').trim();
  }

  if (f.whenToUse !== undefined || f.when_to_use !== undefined) {
    payload.when_to_use = (f.whenToUse ?? f.when_to_use ?? '').trim();
  }

  if (f.relatedArticles !== undefined || f.related_articles !== undefined) {
    const raw = f.relatedArticles ?? f.related_articles ?? [];
    payload.related_articles = Array.isArray(raw) ? raw.filter(isUUID) : [];
  }
  if (f.relatedVideos !== undefined || f.related_videos !== undefined) {
    const raw = f.relatedVideos ?? f.related_videos ?? [];
    payload.related_videos = Array.isArray(raw) ? raw.filter(isUUID) : [];
  }
  if (f.relatedResources !== undefined || f.related_resources !== undefined) {
    const raw = f.relatedResources ?? f.related_resources ?? [];
    payload.related_resources = Array.isArray(raw) ? raw.filter(isUUID) : [];
  }

  if (f.tags !== undefined) {
    payload.tags = Array.isArray(f.tags) ? f.tags : [String(f.tags)];
  }

  if (f.status !== undefined) {
    payload.status = f.status;
    if (f.status === 'published' && !f.publishedAt && !f.published_at) {
      payload.published_at = new Date().toISOString();
    }
  }

  if (f.isFeatured !== undefined || f.is_featured !== undefined || f.featured !== undefined) {
    payload.is_featured = Boolean(f.isFeatured ?? f.is_featured ?? f.featured);
  }

  if (f.seoTitle !== undefined || f.seo_title !== undefined) {
    payload.seo_title = (f.seoTitle || f.seo_title || '').trim() || null;
  }
  if (f.seoDescription !== undefined || f.seo_description !== undefined) {
    payload.seo_description = (f.seoDescription || f.seo_description || '').trim() || null;
  }

  if (f.publishedAt !== undefined || f.published_at !== undefined) {
    payload.published_at = f.publishedAt || f.published_at || null;
  }

  payload.updated_at = new Date().toISOString();

  return payload;
};

export const frameworkService = {
  /**
   * Fetches published frameworks for public visitors.
   * Only returns frameworks where status = 'published', ordered by published_at DESC.
   */
  async fetchPublishedFrameworks(): Promise<{ data: Framework[] | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: { message: 'Supabase is not configured' } };
    }

    try {
      const { data, error } = await supabase
        .from('frameworks')
        .select('*')
        .eq('status', 'published')
        .order('published_at', { ascending: false, nullsFirst: false });

      if (error) {
        if (error.code !== 'PGRST205') {
          console.warn('[Supabase Frameworks] Error fetching published frameworks:', error);
        }
        return { data: null, error };
      }

      const frameworks = (data || []).map(mapDbRowToFramework);
      return { data: frameworks, error: null };
    } catch (err: any) {
      console.warn('[Supabase Frameworks] Unexpected error in fetchPublishedFrameworks:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Fetches all frameworks (drafts, published, archived) for authenticated admins.
   */
  async fetchAllFrameworksAdmin(): Promise<{ data: Framework[] | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: { message: 'Supabase is not configured' } };
    }

    try {
      const t0 = Date.now();
      const { data: { session } } = await supabase.auth.getSession();
      console.info('[Framework Admin Fetch Diagnostic]');
      console.info('authenticated:', Boolean(session && session.user));
      console.info('user id:', session?.user?.id || null);
      console.info('is admin:', Boolean(session && session.user));
      console.info('query started:', new Date(t0).toISOString());

      const { data, error } = await supabase
        .from('frameworks')
        .select('*')
        .order('created_at', { ascending: false });

      const t1 = Date.now();
      console.info('query returned:', new Date(t1).toISOString());
      console.info('row count:', data ? data.length : (data === null ? null : 0));
      console.info('first row:', data && data.length > 0 ? data[0] : null);
      console.info('supabase error code:', error?.code || null);
      console.info('supabase error message:', error?.message || null);
      console.info('supabase error details:', error?.details || null);
      console.info('supabase error hint:', error?.hint || null);

      if (error) {
        if (error.code !== 'PGRST205') {
          console.warn('[Supabase Frameworks] Error fetching all frameworks for admin:', error);
        }
        return { data: null, error };
      }

      const frameworks = (data || []).map(mapDbRowToFramework);
      return { data: frameworks, error: null };
    } catch (err: any) {
      console.warn('[Supabase Frameworks] Unexpected error in fetchAllFrameworksAdmin:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Fetches a single framework by slug.
   * If not admin, only published records are returned.
   */
  async fetchFrameworkBySlug(slug: string, isAdmin = false): Promise<{ data: Framework | null; error: any }> {
    if (!isSupabaseConfigured() || !slug) {
      return { data: null, error: { message: 'Supabase unconfigured or invalid slug' } };
    }

    try {
      let query = supabase
        .from('frameworks')
        .select('*')
        .eq('slug', slug);

      if (!isAdmin) {
        query = query.eq('status', 'published');
      }

      const { data, error } = await query.maybeSingle();

      if (error) {
        return { data: null, error };
      }

      if (!data) {
        return { data: null, error: null };
      }

      return { data: mapDbRowToFramework(data), error: null };
    } catch (err: any) {
      console.warn('[Supabase Frameworks] Error fetching framework by slug:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Inserts a new framework into public.frameworks.
   */
  async createFramework(framework: Partial<Framework>): Promise<{ data: Framework | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: { message: 'Supabase is not configured' } };
    }

    try {
      const dbPayload = mapFrameworkToDbPayload(framework);
      if (!dbPayload.title) {
        return { data: null, error: { message: 'Framework title is required' } };
      }
      if (!dbPayload.slug) {
        dbPayload.slug = slugify(dbPayload.title);
      }

      const { data, error } = await supabase
        .from('frameworks')
        .insert([dbPayload])
        .select('*')
        .single();

      if (error) {
        console.error('[Supabase Frameworks] Create framework error:', error);
        return { data: null, error };
      }

      return { data: mapDbRowToFramework(data), error: null };
    } catch (err: any) {
      console.error('[Supabase Frameworks] Unexpected error in createFramework:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Updates an existing framework in public.frameworks.
   */
  async updateFramework(id: string, updates: Partial<Framework>): Promise<{ data: Framework | null; error: any }> {
    if (!isSupabaseConfigured() || !id) {
      return { data: null, error: { message: 'Supabase unconfigured or missing framework ID' } };
    }

    try {
      const dbPayload = mapFrameworkToDbPayload(updates);

      const { data, error } = await supabase
        .from('frameworks')
        .update(dbPayload)
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        console.error('[Supabase Frameworks] Update framework error:', error);
        return { data: null, error };
      }

      return { data: mapDbRowToFramework(data), error: null };
    } catch (err: any) {
      console.error('[Supabase Frameworks] Unexpected error in updateFramework:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Deletes a framework permanently from public.frameworks.
   */
  async deleteFramework(id: string): Promise<{ success: boolean; error: any }> {
    if (!isSupabaseConfigured() || !id) {
      return { success: false, error: { message: 'Supabase unconfigured or missing framework ID' } };
    }

    try {
      const { error } = await supabase
        .from('frameworks')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[Supabase Frameworks] Delete framework error:', error);
        return { success: false, error };
      }

      return { success: true, error: null };
    } catch (err: any) {
      console.error('[Supabase Frameworks] Unexpected error in deleteFramework:', err);
      return { success: false, error: err };
    }
  },

  /**
   * Convenience method to publish a framework.
   */
  async publishFramework(id: string): Promise<{ data: Framework | null; error: any }> {
    return this.updateFramework(id, {
      status: 'published',
      publishedAt: new Date().toISOString()
    });
  },

  /**
   * Convenience method to unpublish a framework back to draft status.
   */
  async unpublishFramework(id: string): Promise<{ data: Framework | null; error: any }> {
    return this.updateFramework(id, {
      status: 'draft'
    });
  },

  /**
   * Toggles the is_featured boolean flag on a framework.
   */
  async toggleFeatureFramework(id: string, isFeatured: boolean): Promise<{ data: Framework | null; error: any }> {
    return this.updateFramework(id, {
      isFeatured
    });
  },

  /**
   * Uploads an image cover asset to Supabase Storage bucket 'resources' (or dedicated folder).
   */
  async uploadFrameworkCoverImage(file: File): Promise<{ url: string | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { url: null, error: { message: 'Supabase storage is unconfigured' } };
    }

    try {
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_').toLowerCase();
      const uniquePath = `frameworks/${Date.now()}_${cleanFileName}`;

      const { data, error } = await supabase.storage
        .from('resources')
        .upload(uniquePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) {
        console.warn('[Supabase Storage] Framework image upload notice:', error);
        return { url: null, error };
      }

      const { data: publicUrlData } = supabase.storage
        .from('resources')
        .getPublicUrl(data.path);

      return { url: publicUrlData.publicUrl, error: null };
    } catch (err: any) {
      console.warn('[Supabase Storage] Framework image upload unexpected error:', err);
      return { url: null, error: err };
    }
  },

  /**
   * Safely imports/synchronizes the baseline initial frameworks into public.frameworks.
   * - Queries Supabase by slug for each framework.
   * - If slug does NOT exist, inserts the complete framework.
   * - If slug already exists, leaves it untouched (never creates duplicates).
   * - Performs write-through verification by fetching the record back and verifying key fields.
   */
  async syncInitialFrameworks(initialList: Framework[]): Promise<{
    totalCount: number;
    importedCount: number;
    alreadyExistingCount: number;
    failedCount: number;
    results: Array<{ slug: string; status: 'imported' | 'exists' | 'failed'; error?: any; verified?: boolean }>;
  }> {
    if (!isSupabaseConfigured()) {
      return {
        totalCount: initialList.length,
        importedCount: 0,
        alreadyExistingCount: 0,
        failedCount: initialList.length,
        results: initialList.map(f => ({ slug: f.slug, status: 'failed', error: 'Supabase not configured' }))
      };
    }

    const results: Array<{ slug: string; status: 'imported' | 'exists' | 'failed'; error?: any; verified?: boolean }> = [];
    let importedCount = 0;
    let alreadyExistingCount = 0;
    let failedCount = 0;

    for (const fw of initialList) {
      try {
        // 1. Check if record with this slug already exists
        const { data: existing, error: checkErr } = await supabase
          .from('frameworks')
          .select('id, slug, title, status')
          .eq('slug', fw.slug)
          .maybeSingle();

        if (checkErr) {
          console.warn(`[Sync Initial Frameworks] Slug check error for ${fw.slug}:`, checkErr);
        }

        if (existing && existing.id) {
          console.info(`[Sync Initial Frameworks] Framework "${fw.slug}" already exists in Supabase. Skipping.`);
          alreadyExistingCount++;
          results.push({ slug: fw.slug, status: 'exists', verified: true });
          continue;
        }

        // 2. Map complete framework to DB payload
        const payload = mapFrameworkToDbPayload(fw);
        if (!payload.title) {
          payload.title = (fw.title || fw.name || '').trim();
        }
        if (!payload.slug) {
          payload.slug = fw.slug;
        }

        // 3. Insert record into public.frameworks
        const { data: inserted, error: insertErr } = await supabase
          .from('frameworks')
          .insert([payload])
          .select('*')
          .single();

        if (insertErr || !inserted) {
          console.error(`[Sync Initial Frameworks] Failed to insert ${fw.slug}:`, insertErr);
          failedCount++;
          results.push({ slug: fw.slug, status: 'failed', error: insertErr });
          continue;
        }

        // 4. Write-through verification: Fetch back from Supabase and verify critical fields
        const { data: verifiedRow, error: verifyErr } = await supabase
          .from('frameworks')
          .select('id, title, slug, category, status, is_featured, framework_content, created_at, updated_at')
          .eq('slug', fw.slug)
          .single();

        if (verifyErr || !verifiedRow || !verifiedRow.id || !verifiedRow.slug || !verifiedRow.title) {
          console.error(`[Sync Initial Frameworks] Verification failed for ${fw.slug}:`, verifyErr);
          failedCount++;
          results.push({ slug: fw.slug, status: 'failed', error: verifyErr || 'Verification failed', verified: false });
          continue;
        }

        console.info(`[Sync Initial Frameworks] Successfully imported and verified "${fw.slug}" (ID: ${verifiedRow.id})`);
        importedCount++;
        results.push({ slug: fw.slug, status: 'imported', verified: true });
      } catch (err: any) {
        console.error(`[Sync Initial Frameworks] Unexpected error during sync of ${fw.slug}:`, err);
        failedCount++;
        results.push({ slug: fw.slug, status: 'failed', error: err });
      }
    }

    return {
      totalCount: initialList.length,
      importedCount,
      alreadyExistingCount,
      failedCount,
      results
    };
  }
};
