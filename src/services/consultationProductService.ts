import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ConsultationProduct } from '../types';

export const PRODUCTION_CONSULTATION_PRODUCT_ID = '31bbb9bf-ce10-4da4-a517-dfc673f9b875';

/**
 * Transforms a Supabase database row into an application ConsultationProduct object.
 * Uses only PRODUCTION_CONSULTATION_PRODUCT_ID as the single fallback UUID.
 */
export const mapDbRowToConsultationProduct = (row: any): ConsultationProduct => {
  return {
    id: row.id || PRODUCTION_CONSULTATION_PRODUCT_ID,
    name: row.name || 'Business Growth & Scaling Consultation',
    durationMinutes: Number(row.duration_minutes ?? row.durationMinutes ?? 30),
    basePrice: Number(row.base_price ?? row.basePrice ?? 499),
    gstRate: Number(row.gst_rate ?? row.gstRate ?? 0.18),
    currency: row.currency || 'INR',
    active: row.active !== undefined ? Boolean(row.active) : true,
    description: row.description || '1-on-1 strategic deep dive focused on high-leverage growth levers.',
    features: Array.isArray(row.features)
      ? row.features
      : typeof row.features === 'string'
      ? JSON.parse(row.features)
      : [
          'Full-funnel growth architecture audit',
          'Offer positioning & high-ticket pricing teardown',
          'AI workflow integration roadmap',
          'Post-session action summary & recording'
        ]
  };
};

/**
 * Transforms an application ConsultationProduct object into a Supabase database payload.
 */
export const mapConsultationProductToDbPayload = (p: ConsultationProduct): Record<string, any> => {
  return {
    name: p.name,
    duration_minutes: p.durationMinutes,
    base_price: p.basePrice,
    gst_rate: p.gstRate,
    currency: p.currency,
    active: p.active,
    description: p.description,
    features: p.features,
    slug: 'business-growth-consultation',
    updated_at: new Date().toISOString()
  };
};

/**
 * Consultation Product Service: Modular API for Consultation Offerings in Supabase
 */
export const consultationProductService = {
  /**
   * Fetches the primary active consultation product
   */
  async fetchConsultationProduct(): Promise<{ data: ConsultationProduct | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase is not configured') };
    }

    try {
      const { data, error } = await supabase
        .from('consultation_products')
        .select('*')
        .eq('active', true)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('[consultationProductService] Error fetching consultation product:', error);
        return { data: null, error };
      }

      if (!data) {
        // Fallback to canonical product row UUID if active filter returned null
        const { data: canonData, error: canonError } = await supabase
          .from('consultation_products')
          .select('*')
          .eq('id', PRODUCTION_CONSULTATION_PRODUCT_ID)
          .maybeSingle();

        if (canonError || !canonData) {
          return { data: null, error: null };
        }
        return { data: mapDbRowToConsultationProduct(canonData), error: null };
      }

      return { data: mapDbRowToConsultationProduct(data), error: null };
    } catch (err) {
      console.error('[consultationProductService] Unexpected error fetching consultation product:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Updates consultation product details and pricing directly targeting canonical row ID.
   */
  async updateConsultationProduct(
    product: ConsultationProduct
  ): Promise<{ data: ConsultationProduct | null; error: any }> {
    try {
      // 1. If user is authenticated admin, call privileged server endpoint first
      if (isSupabaseConfigured()) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          try {
            const res = await fetch('/api/payments/admin/update-consultation-pricing', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`
              },
              body: JSON.stringify({
                basePrice: product.basePrice,
                gstRate: product.gstRate,
                durationMinutes: product.durationMinutes
              })
            });
            if (res.ok) {
              const resData = await res.json();
              if (resData.success && resData.product) {
                return { data: mapDbRowToConsultationProduct(resData.product), error: null };
              }
            }
          } catch (apiErr) {
            console.warn('[consultationProductService] Server endpoint notice, falling back to direct:', apiErr);
          }
        }
      }

      if (!isSupabaseConfigured()) {
        return { data: product, error: null };
      }

      const targetId =
        product.id && product.id.length === 36
          ? product.id
          : PRODUCTION_CONSULTATION_PRODUCT_ID;

      const payload = {
        ...mapConsultationProductToDbPayload(product),
        id: targetId
      };

      // 2. Direct UPDATE attempt
      const { data: updateData, error: updateError } = await supabase
        .from('consultation_products')
        .update(payload)
        .eq('id', targetId)
        .select()
        .maybeSingle();

      if (!updateError && updateData) {
        return { data: mapDbRowToConsultationProduct(updateData), error: null };
      }

      // 3. Fallback to upsert
      const { data: upsertData, error: upsertError } = await supabase
        .from('consultation_products')
        .upsert(payload, { onConflict: 'id' })
        .select()
        .single();

      if (upsertError) {
        console.error('[consultationProductService] Error updating consultation product:', upsertError || updateError);
        return { data: null, error: upsertError || updateError };
      }

      return { data: upsertData ? mapDbRowToConsultationProduct(upsertData) : product, error: null };
    } catch (err) {
      console.error('[consultationProductService] Unexpected error updating consultation product:', err);
      return { data: null, error: err };
    }
  }
};
