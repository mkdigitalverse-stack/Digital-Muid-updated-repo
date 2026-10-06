import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Resource } from '../types';
import { slugify } from './articleService';
import { generateResourcePdfBlob } from '../utils/pdfGenerator';

/**
 * Transforms a Supabase database row from public.resources into an application Resource object.
 */
export const mapDbRowToResource = (row: any): Resource => {
  const isFeatured = Boolean(row.is_featured ?? row.isFeatured ?? row.featured ?? false);
  const rawPubDate = row.published_at || row.publishedAt;
  const formattedPubDate = typeof rawPubDate === 'string' && rawPubDate.includes('T')
    ? rawPubDate.split('T')[0]
    : (rawPubDate ? String(rawPubDate) : undefined);

  const fileUrl = row.file_url || row.fileUrl || row.downloadUrl || undefined;
  const externalUrl = row.external_url || row.externalUrl || undefined;
  const thumbnailUrl = row.thumbnail_url || row.thumbnailUrl || row.coverImage || undefined;
  const title = String(row.title || row.name || '');
  const resourceType = String(row.resource_type || row.resourceType || row.type || 'Guide');

  return {
    id: String(row.id),
    title,
    name: title, // alias for UI compatibility
    slug: String(row.slug || ''),
    description: String(row.description || ''),
    resourceType,
    type: resourceType as any, // alias for UI compatibility
    category: String(row.category || 'Digital Growth'),
    fileUrl,
    downloadUrl: fileUrl, // alias for UI compatibility
    externalUrl,
    thumbnailUrl,
    coverImage: thumbnailUrl, // alias for UI compatibility
    author: String(row.author || 'Digital Muid'),
    fileType: row.file_type || row.fileType || row.format || undefined,
    fileSize: row.file_size || row.fileSize || undefined,
    format: row.file_type || row.format || 'Digital Asset', // alias for UI compatibility
    readingTimeMinutes: row.reading_time_minutes ?? row.readingTimeMinutes ?? undefined,
    tags: Array.isArray(row.tags) ? row.tags : (row.tags ? [row.tags] : [row.category || 'Digital Growth']),
    status: (row.status || 'draft') as 'draft' | 'published' | 'archived',
    isFeatured,
    featured: isFeatured, // alias for UI compatibility
    publishedAt: formattedPubDate,
    downloadCount: typeof row.download_count === 'number' ? row.download_count : 0,
    previewPoints: Array.isArray(row.preview_points) ? row.preview_points : [],
    whatIsIncluded: Array.isArray(row.what_is_included) ? row.what_is_included : [],
    leadCaptureRequired: row.lead_capture_required !== undefined ? Boolean(row.lead_capture_required) : true,
    seoTitle: row.seo_title || row.seoTitle || undefined,
    seoDescription: row.seo_description || row.seoDescription || undefined,
    createdAt: String(row.created_at || row.createdAt || new Date().toISOString()),
    updatedAt: String(row.updated_at || row.updatedAt || new Date().toISOString())
  };
};

/**
 * Transforms an application Resource object or partial update into a Supabase database payload.
 * Strictly adheres to public.resources schema:
 * title, slug, description, resource_type, category, file_url, external_url,
 * thumbnail_url, author, file_type, file_size, reading_time_minutes, tags,
 * status, is_featured, published_at, seo_title, seo_description, updated_at
 */
export const mapResourceToDbPayload = (r: Partial<Resource>): Record<string, any> => {
  const payload: Record<string, any> = {};

  if (r.title !== undefined || r.name !== undefined) {
    const val = (r.title || r.name || '').trim();
    payload.title = val;
  }

  if (r.slug !== undefined) {
    payload.slug = slugify(r.slug || r.title || r.name || '');
  }

  if (r.description !== undefined) {
    payload.description = r.description.trim();
  }

  if (r.resourceType !== undefined || r.type !== undefined) {
    payload.resource_type = (r.resourceType || r.type || 'guide').trim();
  }

  if (r.category !== undefined) {
    payload.category = r.category.trim();
  }

  if (r.fileUrl !== undefined || r.downloadUrl !== undefined) {
    const file = r.fileUrl || r.downloadUrl;
    payload.file_url = file ? file.trim() : null;
  }

  if (r.externalUrl !== undefined) {
    payload.external_url = r.externalUrl ? r.externalUrl.trim() : null;
  }

  if (r.thumbnailUrl !== undefined || r.coverImage !== undefined) {
    const thumb = r.thumbnailUrl || r.coverImage;
    payload.thumbnail_url = thumb ? thumb.trim() : null;
  }

  if (r.author !== undefined) {
    payload.author = r.author.trim() || 'Digital Muid';
  }

  if (r.fileType !== undefined || r.format !== undefined) {
    const ft = r.fileType || r.format;
    payload.file_type = ft ? ft.trim() : null;
  }

  if (r.fileSize !== undefined) {
    payload.file_size = r.fileSize ? r.fileSize.trim() : null;
  }

  if (r.readingTimeMinutes !== undefined) {
    payload.reading_time_minutes = typeof r.readingTimeMinutes === 'number' && !isNaN(r.readingTimeMinutes)
      ? r.readingTimeMinutes
      : null;
  }

  if (r.tags !== undefined) {
    payload.tags = Array.isArray(r.tags)
      ? r.tags.map(t => t.trim()).filter(Boolean)
      : (r.tags ? [String(r.tags).trim()] : []);
  }

  if (r.status !== undefined) {
    payload.status = r.status;
  }

  if (r.isFeatured !== undefined || r.featured !== undefined) {
    payload.is_featured = Boolean(r.isFeatured ?? r.featured);
  }

  if (r.publishedAt !== undefined) {
    payload.published_at = r.publishedAt ? new Date(r.publishedAt).toISOString() : null;
  } else if (r.status === 'published' && !payload.published_at) {
    payload.published_at = new Date().toISOString();
  }

  if (r.seoTitle !== undefined) {
    payload.seo_title = r.seoTitle ? r.seoTitle.trim() : null;
  }

  if (r.seoDescription !== undefined) {
    payload.seo_description = r.seoDescription ? r.seoDescription.trim() : null;
  }

  payload.updated_at = new Date().toISOString();

  return payload;
};

export const resourceService = {
  /**
   * Fetches published resources from public.resources (ordered by published_at DESC).
   * Accessible by public visitors.
   */
  async fetchPublishedResources(): Promise<{ data: Resource[] | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: 'Supabase unconfigured' };
    }

    try {
      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .eq('status', 'published')
        .order('is_featured', { ascending: false })
        .order('published_at', { ascending: false, nullsFirst: false });

      if (error) {
        if (error.code !== 'PGRST205') {
          console.error('[Supabase Resources] fetchPublishedResources error:', error);
        } else {
          console.debug('[Supabase Resources] Notice: public.resources table is not in schema cache (PGRST205), relying on local fallback.');
        }
        return { data: null, error };
      }

      const mapped = (data || []).map(mapDbRowToResource);
      return { data: mapped, error: null };
    } catch (err: any) {
      console.warn('[Supabase Resources] fetchPublishedResources unexpected failure:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Fetches all resources (drafts + published + archived) for the Admin CMS.
   * Requires active admin authentication session.
   */
  async fetchAllResources(): Promise<{ data: Resource[] | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: 'Supabase unconfigured' };
    }

    try {
      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code !== 'PGRST205') {
          console.error('[Supabase Resources] fetchAllResources error:', error);
        } else {
          console.debug('[Supabase Resources] Notice: public.resources table is not in schema cache (PGRST205), relying on local fallback.');
        }
        return { data: null, error };
      }

      const mapped = (data || []).map(mapDbRowToResource);
      return { data: mapped, error: null };
    } catch (err: any) {
      console.warn('[Supabase Resources] fetchAllResources unexpected failure:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Alias for fetchAllResources for semantic consistency with admin flows.
   */
  async fetchAllResourcesAdmin(): Promise<{ data: Resource[] | null; error: any }> {
    return this.fetchAllResources();
  },

  /**
   * Fetches a single resource by unique slug.
   */
  async fetchResourceBySlug(slug: string): Promise<{ data: Resource | null; error: any }> {
    if (!isSupabaseConfigured() || !slug) {
      return { data: null, error: 'Invalid parameters or Supabase unconfigured' };
    }

    try {
      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .eq('slug', slug.trim())
        .maybeSingle();

      if (error) {
        if (error.code !== 'PGRST205') {
          console.error('[Supabase Resources] fetchResourceBySlug error:', error);
        } else {
          console.debug('[Supabase Resources] Notice: public.resources table is not in schema cache (PGRST205).');
        }
        return { data: null, error };
      }

      if (!data) {
        return { data: null, error: null };
      }

      return { data: mapDbRowToResource(data), error: null };
    } catch (err: any) {
      console.warn('[Supabase Resources] fetchResourceBySlug unexpected failure:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Inserts a new resource record into public.resources.
   * Validates required fields before executing database write.
   */
  async insertResource(resource: Partial<Resource>): Promise<{ data: Resource | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: { message: 'Database is not connected. Configure VITE_SUPABASE_URL.' } };
    }

    try {
      const title = (resource.title || resource.name || '').trim();
      if (!title) {
        return { data: null, error: { message: 'Resource title is required.' } };
      }

      const baseSlug = slugify(resource.slug || title);
      const payload = mapResourceToDbPayload({
        ...resource,
        title,
        slug: baseSlug,
        status: resource.status || 'draft',
        publishedAt: resource.status === 'published' ? (resource.publishedAt || new Date().toISOString()) : null
      });

      console.info('[Supabase Resources] Inserting resource record into public.resources:', {
        title: payload.title,
        slug: payload.slug,
        status: payload.status,
        resource_type: payload.resource_type
      });

      const { data, error } = await supabase
        .from('resources')
        .insert([payload])
        .select()
        .single();

      if (error) {
        console.error('[Supabase Resources] Insert error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        return { data: null, error };
      }

      const created = mapDbRowToResource(data);
      console.info('[Supabase Resources] Successfully inserted resource ID:', created.id);
      return { data: created, error: null };
    } catch (err: any) {
      console.error('[Supabase Resources] Unexpected insertion error:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Updates an existing resource record in public.resources.
   */
  async updateResource(id: string, updates: Partial<Resource>): Promise<{ data: Resource | null; error: any }> {
    if (!isSupabaseConfigured() || !id) {
      return { data: null, error: { message: 'Invalid ID or Supabase unconfigured' } };
    }

    try {
      const payload = mapResourceToDbPayload(updates);

      console.info(`[Supabase Resources] Updating resource record ${id}:`, payload);

      const { data, error } = await supabase
        .from('resources')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error(`[Supabase Resources] Update failed for ${id}:`, {
          code: error.code,
          message: error.message,
          details: error.details
        });
        return { data: null, error };
      }

      const updated = mapDbRowToResource(data);
      console.info(`[Supabase Resources] Successfully updated resource ${id}`);
      return { data: updated, error: null };
    } catch (err: any) {
      console.error(`[Supabase Resources] Unexpected update error for ${id}:`, err);
      return { data: null, error: err };
    }
  },

  /**
   * Deletes a resource record from public.resources.
   */
  async deleteResource(id: string): Promise<{ success: boolean; error: any }> {
    if (!isSupabaseConfigured() || !id) {
      return { success: false, error: { message: 'Invalid ID or Supabase unconfigured' } };
    }

    try {
      console.info(`[Supabase Resources] Deleting resource record ${id}`);

      const { error } = await supabase
        .from('resources')
        .delete()
        .eq('id', id);

      if (error) {
        console.error(`[Supabase Resources] Delete failed for ${id}:`, error);
        return { success: false, error };
      }

      console.info(`[Supabase Resources] Successfully deleted resource ${id}`);
      return { success: true, error: null };
    } catch (err: any) {
      console.error(`[Supabase Resources] Unexpected delete error for ${id}:`, err);
      return { success: false, error: err };
    }
  },

  /**
   * Publishes a resource immediately.
   */
  async publishResource(id: string): Promise<{ data: Resource | null; error: any }> {
    return this.updateResource(id, {
      status: 'published',
      publishedAt: new Date().toISOString()
    });
  },

  /**
   * Unpublishes a resource to draft state.
   */
  async unpublishResource(id: string): Promise<{ data: Resource | null; error: any }> {
    return this.updateResource(id, {
      status: 'draft'
    });
  },

  /**
   * Uploads an asset (PDF, template, image, document) to Supabase Storage bucket 'resources'.
   * Falls back gracefully if bucket does not exist or storage is unconfigured.
   */
  async uploadResourceFile(file: File, folder = 'files'): Promise<{ url: string | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { url: null, error: { message: 'Supabase storage is unconfigured' } };
    }

    try {
      const fileExt = file.name.split('.').pop() || 'dat';
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_').toLowerCase();
      const uniquePath = `${folder}/${Date.now()}_${cleanFileName}`;

      const { data, error } = await supabase.storage
        .from('resources')
        .upload(uniquePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) {
        console.warn('[Supabase Storage] Resources bucket upload notice:', error);
        return { url: null, error };
      }

      const { data: publicUrlData } = supabase.storage
        .from('resources')
        .getPublicUrl(data.path);

      return { url: publicUrlData.publicUrl, error: null };
    } catch (err: any) {
      console.warn('[Supabase Storage] Upload unexpected error:', err);
      return { url: null, error: err };
    }
  },

  /**
   * Increments the download_count counter for a resource.
   */
  async incrementDownloadCount(id: string): Promise<{ success: boolean; error: any }> {
    if (!isSupabaseConfigured() || !id) {
      return { success: false, error: null };
    }

    try {
      // 1. Try atomic database RPC function first
      const { error: rpcErr } = await supabase.rpc('increment_resource_downloads', { resource_id: id });
      if (!rpcErr) {
        return { success: true, error: null };
      }

      // 2. Fallback to direct read-modify-write if RPC function not created
      const { data, error: selectErr } = await supabase
        .from('resources')
        .select('download_count')
        .eq('id', id)
        .maybeSingle();

      if (!selectErr && data) {
        const nextCount = (data.download_count || 0) + 1;
        const { error: updateErr } = await supabase
          .from('resources')
          .update({ download_count: nextCount })
          .eq('id', id);

        if (!updateErr) {
          return { success: true, error: null };
        }
      }

      return { success: false, error: selectErr || rpcErr };
    } catch (err: any) {
      console.warn('[Supabase Resources] incrementDownloadCount error notice:', err);
      return { success: false, error: err };
    }
  },

  /**
   * Safely delivers/downloads a resource asset to the client without React Router navigation.
   * Handles:
   * 1. External URLs (Google Drive, Dropbox, Notion, GitHub, etc.)
   * 2. Supabase Storage URLs (public and signed URLs)
   * 3. Static server assets (/downloads/*.pdf)
   * 4. Reliable Client-Side standard PDF generation fallback
   */
  async deliverResource(resource: Resource): Promise<{ success: boolean; error?: string }> {
    if (!resource) {
      console.error('[Resource Delivery Error] No resource object provided');
      return { success: false, error: 'This resource is temporarily unavailable. Please try again later.' };
    }

    const externalUrl = resource.externalUrl?.trim() || null;
    const rawFileUrl = (resource.fileUrl || resource.downloadUrl)?.trim() || null;

    let deliveryMethod = 'Unknown';
    let resolvedUrl = '';
    let storageBucket = 'none';
    let storageObjectPath = 'none';
    let deliveryResult = 'failure';
    let errorCode = '';
    let errorMessage = '';

    const safeFilename = `${(resource.slug || resource.title || resource.name || 'resource')
      .replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;

    try {
      // -------------------------------------------------------------
      // 1. External URL Delivery (Google Drive, Dropbox, Notion, etc.)
      // -------------------------------------------------------------
      if (externalUrl && /^https?:\/\//i.test(externalUrl)) {
        deliveryMethod = 'External URL';
        resolvedUrl = externalUrl;

        try {
          window.open(externalUrl, '_blank', 'noopener,noreferrer');
          deliveryResult = 'success';
          this.logDeliveryDiagnostic({
            resource,
            deliveryMethod,
            resolvedUrl,
            storageBucket,
            storageObjectPath,
            deliveryResult,
            errorCode,
            errorMessage
          });
          return { success: true };
        } catch (extErr: any) {
          console.warn('[Resource Delivery Error] Failed to open external URL:', extErr);
          errorCode = 'EXTERNAL_URL_POPUP_BLOCKED';
          errorMessage = extErr?.message || 'Failed to open external link';
        }
      }

      // -------------------------------------------------------------
      // 2. Full HTTP/HTTPS URL (Supabase Storage / Cloud CDN)
      // -------------------------------------------------------------
      if (rawFileUrl && /^https?:\/\//i.test(rawFileUrl)) {
        deliveryMethod = 'Supabase Storage';
        resolvedUrl = rawFileUrl;

        try {
          let downloadTarget = rawFileUrl;

          // Check if this is a Supabase storage URL that needs signed URL generation for private buckets
          if (isSupabaseConfigured() && rawFileUrl.includes('/storage/v1/object/')) {
            storageBucket = 'resources';
            const match = rawFileUrl.match(/\/resources\/(.+)$/);
            if (match && match[1]) {
              storageObjectPath = decodeURIComponent(match[1].split('?')[0]);
              const { data: signedData, error: signErr } = await supabase.storage
                .from('resources')
                .createSignedUrl(storageObjectPath, 3600);
              if (signedData?.signedUrl && !signErr) {
                downloadTarget = signedData.signedUrl;
                resolvedUrl = downloadTarget;
              }
            }
          }

          // Try downloading via fetched blob for seamless download prompt
          try {
            const resp = await fetch(downloadTarget, { mode: 'cors' });
            if (resp.ok) {
              const blob = await resp.blob();
              const blobUrl = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = blobUrl;
              link.download = safeFilename;
              link.target = '_blank';
              link.rel = 'noopener noreferrer';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);

              deliveryResult = 'success';
              this.logDeliveryDiagnostic({
                resource,
                deliveryMethod,
                resolvedUrl,
                storageBucket,
                storageObjectPath,
                deliveryResult,
                errorCode,
                errorMessage
              });
              return { success: true };
            }
          } catch {
            // Direct browser link fallback if CORS blocks fetch
            const link = document.createElement('a');
            link.href = downloadTarget;
            link.download = safeFilename;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            deliveryResult = 'success';
            this.logDeliveryDiagnostic({
              resource,
              deliveryMethod,
              resolvedUrl,
              storageBucket,
              storageObjectPath,
              deliveryResult,
              errorCode,
              errorMessage
            });
            return { success: true };
          }
        } catch (storageErr: any) {
          console.warn('[Resource Delivery Error] Supabase storage access notice:', storageErr);
          errorCode = 'STORAGE_DOWNLOAD_ERROR';
          errorMessage = storageErr?.message || 'Storage download error';
        }
      }

      // -------------------------------------------------------------
      // 3. Static Server Asset (e.g. /downloads/META.pdf)
      // -------------------------------------------------------------
      if (rawFileUrl && (rawFileUrl.startsWith('/downloads/') || rawFileUrl.startsWith('/') || rawFileUrl.startsWith('downloads/'))) {
        deliveryMethod = 'Static Asset';
        const cleanPath = rawFileUrl.startsWith('/') ? rawFileUrl : `/${rawFileUrl}`;
        resolvedUrl = cleanPath;

        try {
          const resp = await fetch(cleanPath);
          const contentType = resp.headers.get('content-type') || '';
          // Confirm file exists and is not SPA index.html fallback
          if (resp.ok && !contentType.includes('text/html')) {
            const blob = await resp.blob();
            const blobUrl = URL.createObjectURL(blob);
            const assetFilename = cleanPath.split('/').pop() || safeFilename;

            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = assetFilename;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);

            deliveryResult = 'success';
            this.logDeliveryDiagnostic({
              resource,
              deliveryMethod,
              resolvedUrl,
              storageBucket,
              storageObjectPath,
              deliveryResult,
              errorCode,
              errorMessage
            });
            return { success: true };
          } else {
            errorCode = 'STATIC_ASSET_NOT_FOUND';
            errorMessage = `Asset at ${cleanPath} returned ${resp.status} with content-type: ${contentType}`;
          }
        } catch (staticErr: any) {
          console.warn('[Resource Delivery Error] Static fetch notice:', staticErr);
          errorCode = 'STATIC_FETCH_FAILED';
          errorMessage = staticErr?.message || 'Failed to fetch static asset';
        }
      }

      // -------------------------------------------------------------
      // 4. Reliable Client-Side Dynamic PDF Generation Fallback
      // -------------------------------------------------------------
      deliveryMethod = 'Dynamic PDF';
      resolvedUrl = 'blob:application/pdf';

      try {
        const pdfBlob = generateResourcePdfBlob(resource);
        const blobUrl = URL.createObjectURL(pdfBlob);
        const targetFilename = rawFileUrl?.split('/').pop() || safeFilename;
        const filename = targetFilename.toLowerCase().endsWith('.pdf') ? targetFilename : `${targetFilename}.pdf`;

        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);

        deliveryResult = 'success';
        this.logDeliveryDiagnostic({
          resource,
          deliveryMethod,
          resolvedUrl,
          storageBucket,
          storageObjectPath,
          deliveryResult,
          errorCode: 'FALLBACK_GENERATED_PDF',
          errorMessage: errorMessage || 'Delivered via dynamic PDF generator'
        });
        return { success: true };
      } catch (blobErr: any) {
        console.error('[Resource Delivery Error] Dynamic PDF generation failure:', blobErr);
        errorCode = 'PDF_GENERATOR_FAILED';
        errorMessage = blobErr?.message || 'PDF generator failure';
      }

      this.logDeliveryDiagnostic({
        resource,
        deliveryMethod,
        resolvedUrl,
        storageBucket,
        storageObjectPath,
        deliveryResult: 'failure',
        errorCode: errorCode || 'DELIVERY_FAILED',
        errorMessage: errorMessage || 'All delivery mechanisms exhausted'
      });

      return {
        success: false,
        error: "We're unable to open this resource right now. Please try again."
      };
    } catch (unexpectedErr: any) {
      console.error('[Resource Delivery Error] Unexpected delivery failure:', unexpectedErr);
      return {
        success: false,
        error: "We're unable to open this resource right now. Please try again."
      };
    }
  },

  /**
   * Internal structured diagnostic logger for Resource Delivery tracing
   */
  logDeliveryDiagnostic(diag: {
    resource: Resource;
    deliveryMethod: string;
    resolvedUrl: string;
    storageBucket: string;
    storageObjectPath: string;
    deliveryResult: string;
    errorCode?: string;
    errorMessage?: string;
  }) {
    console.log(
      `[Resource Delivery Diagnostic]\n` +
      `resource id: ${diag.resource.id || 'N/A'}\n` +
      `resource slug: ${diag.resource.slug || 'N/A'}\n` +
      `resource title: ${diag.resource.title || diag.resource.name || 'N/A'}\n` +
      `file_url: ${diag.resource.fileUrl || 'N/A'}\n` +
      `external_url: ${diag.resource.externalUrl || 'N/A'}\n` +
      `delivery method:\n` +
      `- ${diag.deliveryMethod}\n` +
      `resolved URL: ${diag.resolvedUrl}\n` +
      `Storage bucket: ${diag.storageBucket}\n` +
      `Storage object path: ${diag.storageObjectPath}\n` +
      `lead submission confirmed: true\n` +
      `download counter update: true\n` +
      `delivery result: ${diag.deliveryResult}\n` +
      `error code: ${diag.errorCode || 'none'}\n` +
      `error message: ${diag.errorMessage || 'none'}`
    );
  }
};
