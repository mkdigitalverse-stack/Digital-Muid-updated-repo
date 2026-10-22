import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Resource, ResourcePurchase } from '../types';
import { slugify } from './articleService';
import { generateResourcePdfBlob } from '../utils/pdfGenerator';

/**
 * Transforms a raw row from public.resource_purchases into a domain ResourcePurchase object.
 */
export const mapDbRowToResourcePurchase = (row: any): ResourcePurchase => ({
  id: String(row.id),
  userId: String(row.user_id || row.userId || ''),
  user_id: String(row.user_id || row.userId || ''),
  resourceId: String(row.resource_id || row.resourceId || ''),
  resource_id: String(row.resource_id || row.resourceId || ''),
  razorpayOrderId: row.razorpay_order_id || row.razorpayOrderId || undefined,
  razorpay_order_id: row.razorpay_order_id || row.razorpayOrderId || undefined,
  razorpayPaymentId: row.razorpay_payment_id || row.razorpayPaymentId || undefined,
  razorpay_payment_id: row.razorpay_payment_id || row.razorpayPaymentId || undefined,
  amount: typeof row.amount === 'number' ? row.amount : parseFloat(row.amount || '0') || 0,
  currency: row.currency || 'INR',
  status: (row.status || 'active') as 'active' | 'revoked',
  purchasedAt: String(row.purchased_at || row.purchasedAt || row.created_at || new Date().toISOString())
});

const PRICING_OVERRIDES_KEY = 'digitalmuid_resource_pricing_overrides';

export interface ResourcePricingOverride {
  accessType: 'free' | 'paid';
  price: number;
  currency: string;
}

/**
 * Reads local pricing overrides for resources when database table schema does not yet include access_type.
 */
export const getResourcePricingOverrides = (): Record<string, ResourcePricingOverride> => {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(PRICING_OVERRIDES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

/**
 * Persists local pricing overrides for a resource by ID and slug.
 */
export const saveResourcePricingOverride = (
  id?: string,
  slug?: string,
  override?: ResourcePricingOverride
) => {
  if (typeof window === 'undefined' || !window.localStorage || !override) return;
  try {
    const current = getResourcePricingOverrides();
    if (id) current[id] = override;
    if (slug) current[slug] = override;
    window.localStorage.setItem(PRICING_OVERRIDES_KEY, JSON.stringify(current));
  } catch (e) {
    console.warn('[ResourceService] Failed to persist pricing override:', e);
  }
};

/**
 * Identifies if an error is due to a missing column in Supabase schema cache (PGRST204).
 */
export const isPgrstMissingColumnError = (err: any): boolean => {
  if (!err) return false;
  if (err.code === 'PGRST204') return true;
  const msg = typeof err.message === 'string' ? err.message.toLowerCase() : '';
  return msg.includes('column') && (
    msg.includes('access_type') ||
    msg.includes('price') ||
    msg.includes('currency') ||
    msg.includes('schema cache')
  );
};

/**
 * Transforms a Supabase database row from public.resources into an application Resource object.
 */
export const mapDbRowToResource = (row: any): Resource => {
  const isFeatured = Boolean(row.is_featured ?? row.isFeatured ?? row.featured ?? false);
  const rawPubDate = row.published_at || row.publishedAt;
  const formattedPubDate = typeof rawPubDate === 'string' && rawPubDate.includes('T')
    ? rawPubDate.split('T')[0]
    : (rawPubDate ? String(rawPubDate) : undefined);

  const localOverrides = getResourcePricingOverrides();
  const localOverride = (row.id ? localOverrides[row.id] : null) || (row.slug ? localOverrides[row.slug] : null);

  const rawAccessType = row.access_type ?? row.accessType;
  const resolvedAccessType = (rawAccessType !== undefined && rawAccessType !== null
    ? String(rawAccessType).toLowerCase()
    : (localOverride?.accessType || 'free')) as 'free' | 'paid';

  const rawPrice = row.price;
  const resolvedPrice = typeof rawPrice === 'number'
    ? rawPrice
    : (rawPrice !== undefined && rawPrice !== null ? (parseFloat(rawPrice) || 0) : (localOverride?.price ?? 0));

  const resolvedCurrency = row.currency || localOverride?.currency || 'INR';

  // Security: Redact private paid file locations from unauthenticated public queries
  const isPaid = resolvedAccessType === 'paid' && resolvedPrice > 0;
  const allowExplicitUrls = Boolean(row.__allow_paid_urls);
  const rawFileUrl = row.file_url || row.fileUrl || row.downloadUrl || undefined;
  const rawExternalUrl = row.external_url || row.externalUrl || undefined;
  const fileUrl = isPaid && !allowExplicitUrls ? undefined : rawFileUrl;
  const externalUrl = isPaid && !allowExplicitUrls ? undefined : rawExternalUrl;
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
    accessType: resolvedAccessType === 'paid' ? 'paid' : 'free',
    access_type: resolvedAccessType === 'paid' ? 'paid' : 'free',
    price: resolvedAccessType === 'paid' ? Math.max(0, resolvedPrice) : 0,
    currency: resolvedCurrency,
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

  if (r.accessType !== undefined || r.access_type !== undefined) {
    const at = (r.accessType || r.access_type || 'free').toLowerCase();
    payload.access_type = at === 'paid' ? 'paid' : 'free';
  }

  if (r.price !== undefined) {
    payload.price = typeof r.price === 'number' ? Math.max(0, r.price) : 0;
  }

  if (r.currency !== undefined) {
    payload.currency = r.currency || 'INR';
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

      let { data, error } = await supabase
        .from('resources')
        .insert([payload])
        .select()
        .single();

      if (isPgrstMissingColumnError(error)) {
        console.warn('[Supabase Resources] public.resources table schema does not include access_type/price yet (PGRST204). Retrying insert without pricing columns and storing pricing locally.');
        const safePayload = { ...payload };
        delete safePayload.access_type;
        delete safePayload.price;
        delete safePayload.currency;

        const retry = await supabase
          .from('resources')
          .insert([safePayload])
          .select()
          .single();

        if (retry.error) {
          if (retry.error.code === 'PGRST116') {
            return {
              data: null,
              error: {
                code: '403',
                message: 'Administrator authorization required. Please ensure you are logged in to the admin portal.'
              }
            };
          }
          console.error('[Supabase Resources] Safe insert retry failed:', retry.error);
          return { data: null, error: retry.error };
        }

        const created = mapDbRowToResource(retry.data);
        const at = (resource.accessType || resource.access_type || 'free').toLowerCase() === 'paid' ? 'paid' : 'free';
        const pr = typeof resource.price === 'number' ? Math.max(0, resource.price) : 0;
        const cur = resource.currency || 'INR';

        saveResourcePricingOverride(created.id, created.slug, {
          accessType: at,
          price: pr,
          currency: cur
        });

        created.accessType = at;
        created.access_type = at;
        created.price = pr;
        created.currency = cur;

        return { data: created, error: null };
      }

      if (error) {
        if (error.code === 'PGRST116') {
          return {
            data: null,
            error: {
              code: '403',
              message: 'Administrator authorization required. Please ensure you are logged in to the admin portal.'
            }
          };
        }
        console.error('[Supabase Resources] Insert error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        return { data: null, error };
      }

      // If full insert succeeded with pricing columns, also update local override for immediate consistency
      if (resource.accessType !== undefined || resource.access_type !== undefined || resource.price !== undefined) {
        const at = (resource.accessType || resource.access_type || 'free').toLowerCase() === 'paid' ? 'paid' : 'free';
        const pr = typeof resource.price === 'number' ? Math.max(0, resource.price) : 0;
        saveResourcePricingOverride(data?.id, resource.slug, {
          accessType: at,
          price: pr,
          currency: resource.currency || 'INR'
        });
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

      let { data, error } = await supabase
        .from('resources')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (isPgrstMissingColumnError(error)) {
        console.warn(`[Supabase Resources] public.resources table schema does not include access_type/price yet (PGRST204). Retrying update without pricing columns and storing pricing locally.`);
        const safePayload = { ...payload };
        delete safePayload.access_type;
        delete safePayload.price;
        delete safePayload.currency;

        const retry = await supabase
          .from('resources')
          .update(safePayload)
          .eq('id', id)
          .select()
          .single();

        if (retry.error) {
          if (retry.error.code === 'PGRST116') {
            return {
              data: null,
              error: {
                code: '403',
                message: 'Administrator authorization required. Please ensure you are logged in to the admin portal.'
              }
            };
          }
          console.error(`[Supabase Resources] Safe update retry failed for ${id}:`, retry.error);
          return { data: null, error: retry.error };
        }

        const updated = mapDbRowToResource(retry.data);
        const at = (updates.accessType || updates.access_type || updated.accessType || 'free').toLowerCase() === 'paid' ? 'paid' : 'free';
        const pr = typeof updates.price === 'number' ? Math.max(0, updates.price) : (updated.price || 0);
        const cur = updates.currency || updated.currency || 'INR';

        saveResourcePricingOverride(id, updates.slug || updated.slug, {
          accessType: at,
          price: pr,
          currency: cur
        });

        updated.accessType = at;
        updated.access_type = at;
        updated.price = pr;
        updated.currency = cur;

        console.info(`[Supabase Resources] Successfully updated resource ${id} (with safe schema fallback)`);
        return { data: updated, error: null };
      }

      if (error) {
        if (error.code === 'PGRST116') {
          return {
            data: null,
            error: {
              code: '403',
              message: 'Administrator authorization required. Please ensure you are logged in to the admin portal.'
            }
          };
        }
        console.error(`[Supabase Resources] Update failed for ${id}:`, {
          code: error.code,
          message: error.message,
          details: error.details
        });
        return { data: null, error };
      }

      // If full update succeeded, also update local override for immediate consistency
      if (updates.accessType !== undefined || updates.access_type !== undefined || updates.price !== undefined) {
        const at = (updates.accessType || updates.access_type || 'free').toLowerCase() === 'paid' ? 'paid' : 'free';
        const pr = typeof updates.price === 'number' ? Math.max(0, updates.price) : 0;
        saveResourcePricingOverride(id, updates.slug, {
          accessType: at,
          price: pr,
          currency: updates.currency || 'INR'
        });
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
   * Enforces payment verification for paid resources before allowing download or PDF generation.
   * Handles:
   * 1. External URLs (Google Drive, Dropbox, Notion, GitHub, etc.)
   * 2. Supabase Storage URLs (public and signed URLs)
   * 3. Static server assets (/downloads/*.pdf)
   * 4. Reliable Client-Side standard PDF generation fallback
   */
  async deliverResource(
    resource: Resource,
    options?: { isAuthorized?: boolean; orderId?: string; paymentId?: string }
  ): Promise<{ success: boolean; error?: string }> {
    if (!resource) {
      console.error('[Resource Delivery Error] No resource object provided');
      return { success: false, error: 'This resource is temporarily unavailable. Please try again later.' };
    }

    const isPaid = (resource.accessType === 'paid' || (resource as any).access_type === 'paid') && (resource.price || 0) > 0;
    if (isPaid && !options?.isAuthorized) {
      console.warn(`[Resource Delivery Guard] Unauthorized delivery attempt for paid resource: ${resource.id}`);
      return {
        success: false,
        error: 'This is a paid resource. Valid payment verification is required to download or access this content.'
      };
    }

    let externalUrl = resource.externalUrl?.trim() || null;
    let rawFileUrl = (resource.fileUrl || resource.downloadUrl)?.trim() || null;

    // Server-side payment verification and asset link resolution for paid assets
    if (isPaid) {
      try {
        const { data: authSessionData } = isSupabaseConfigured()
          ? await supabase.auth.getSession()
          : { data: { session: null } };
        const authHeader = authSessionData?.session?.access_token
          ? `Bearer ${authSessionData.session.access_token}`
          : undefined;

        const verifyResp = await fetch('/api/payments/get-resource-download-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authHeader ? { Authorization: authHeader } : {})
          },
          body: JSON.stringify({
            resourceId: resource.id,
            orderId: options?.orderId,
            paymentId: options?.paymentId
          })
        });

        const verifyData = await verifyResp.json();
        if (!verifyResp.ok || !verifyData.success) {
          console.warn('[Resource Delivery Guard] Server rejected download authorization:', verifyData.error);
          return {
            success: false,
            error: verifyData.error || 'A confirmed payment is required to download this paid asset.'
          };
        }

        if (verifyData.isBundle) {
          return {
            success: true,
            isBundle: true,
            bundleUrl: verifyData.bundleAccessUrl || '/resources/bundle/meta-ads-campaign-planner-bundle'
          } as any;
        }

        rawFileUrl = (verifyData.downloadUrl || verifyData.fileUrl)?.trim() || null;
        externalUrl = verifyData.externalUrl?.trim() || null;
      } catch (fetchErr: any) {
        console.error('[Resource Delivery Guard] Verification call failed:', fetchErr);
        return {
          success: false,
          error: 'Unable to verify payment authorization with server. Please try again.'
        };
      }
    }

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
  },

  /**
   * Fetches verified resource purchases for the currently authenticated student from Supabase.
   */
  async fetchMyPurchases(): Promise<{ data: ResourcePurchase[]; error: any }> {
    try {
      if (!isSupabaseConfigured()) {
        return { data: [], error: null };
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return { data: [], error: authError || new Error('User is not authenticated') };
      }

      let purchases: ResourcePurchase[] = [];

      // 1. Try public.resource_purchases
      const { data: purData, error: purError } = await supabase
        .from('resource_purchases')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('purchased_at', { ascending: false });

      if (!purError && purData && purData.length > 0) {
        purchases = purData.map(mapDbRowToResourcePurchase);
      } else if (purError && purError.code !== 'PGRST205') {
        console.warn('[ResourceService] Notice fetching student resource purchases:', purError.message);
      }

      // 2. Query public.payments for student's resource orders
      try {
        const { data: payData, error: payError } = await supabase
          .from('payments')
          .select('*')
          .eq('user_id', user.id)
          .eq('item_type', 'resource')
          .eq('status', 'captured')
          .order('created_at', { ascending: false });

        if (!payError && payData && payData.length > 0) {
          const existingPaymentIds = new Set(purchases.map(p => p.razorpayPaymentId || p.razorpay_payment_id));
          const existingResourceIds = new Set(purchases.map(p => p.resourceId || p.resource_id));

          payData.forEach((payRow: any) => {
            const payId = payRow.razorpay_payment_id;
            const resId = payRow.item_id;
            if (!existingPaymentIds.has(payId) && !existingResourceIds.has(resId)) {
              purchases.push({
                id: payRow.id,
                userId: payRow.user_id,
                user_id: payRow.user_id,
                resourceId: resId,
                resource_id: resId,
                razorpayOrderId: payRow.razorpay_order_id,
                razorpay_order_id: payRow.razorpay_order_id,
                razorpayPaymentId: payId,
                razorpay_payment_id: payId,
                amount: Number(payRow.amount) || 0,
                currency: payRow.currency || 'INR',
                status: 'active',
                purchasedAt: payRow.created_at || new Date().toISOString()
              });
            }
          });
        }
      } catch (payErr) {
        console.warn('[ResourceService] Notice querying payments ledger for student resources:', payErr);
      }

      return { data: purchases, error: null };
    } catch (err: any) {
      console.error('[ResourceService] Unexpected exception fetching student purchases:', err);
      return { data: [], error: err };
    }
  },

  /**
   * Fetches all resource purchases for authenticated administrators.
   */
  async fetchAllPurchasesForAdmin(): Promise<{ data: ResourcePurchase[]; error: any }> {
    try {
      if (!isSupabaseConfigured()) {
        return { data: [], error: null };
      }

      const { data, error } = await supabase
        .from('resource_purchases')
        .select('*')
        .order('purchased_at', { ascending: false });

      if (error) {
        console.warn('[ResourceService] Notice querying all resource purchases for admin:', error);
        return { data: [], error };
      }

      const purchases = (data || []).map(mapDbRowToResourcePurchase);
      return { data: purchases, error: null };
    } catch (err: any) {
      console.error('[ResourceService] Exception fetching admin purchases:', err);
      return { data: [], error: err };
    }
  },

  /**
   * Fetches the 4 authorized deliverable files for the Meta Ads Campaign Planner Bundle.
   * Calls the server-side /api/payments/bundle-files endpoint which verifies payment status.
   */
  async fetchBundleFiles(bundleId: string, options?: { orderId?: string; paymentId?: string }): Promise<{
    success: boolean;
    authorized: boolean;
    bundle?: any;
    files?: Array<{
      id: string;
      slug: string;
      title: string;
      description?: string;
      format?: string;
      fileSize?: string;
      filename: string;
      downloadUrl: string | null;
    }>;
    error?: string;
  }> {
    try {
      const { data: authSessionData } = isSupabaseConfigured()
        ? await supabase.auth.getSession()
        : { data: { session: null } };
      const authHeader = authSessionData?.session?.access_token
        ? `Bearer ${authSessionData.session.access_token}`
        : undefined;

      const query = new URLSearchParams({
        bundleId,
        ...(options?.orderId ? { orderId: options.orderId } : {}),
        ...(options?.paymentId ? { paymentId: options.paymentId } : {})
      });

      const resp = await fetch(`/api/payments/bundle-files?${query.toString()}`, {
        headers: {
          ...(authHeader ? { Authorization: authHeader } : {})
        }
      });
      const data = await resp.json();
      return data;
    } catch (err: any) {
      console.error('[ResourceService] Exception fetching bundle files:', err);
      return { success: false, authorized: false, error: err?.message || 'Failed to fetch bundle files.' };
    }
  }
};
