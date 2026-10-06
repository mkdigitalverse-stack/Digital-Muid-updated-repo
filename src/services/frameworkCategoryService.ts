import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { FrameworkCategory } from '../types';
import { slugify } from './articleService';

/**
 * Transforms a Supabase database row into an application FrameworkCategory object.
 */
export const mapDbRowToFrameworkCategory = (row: any): FrameworkCategory => {
  const isActive = Boolean(row.is_active ?? row.isActive ?? true);
  const sortOrder = typeof row.sort_order === 'number' 
    ? row.sort_order 
    : (typeof row.sortOrder === 'number' ? row.sortOrder : 0);

  return {
    id: String(row.id),
    name: String(row.name || '').trim(),
    slug: String(row.slug || '').trim(),
    description: String(row.description || '').trim(),
    sortOrder,
    sort_order: sortOrder,
    isActive,
    is_active: isActive,
    createdAt: row.created_at || row.createdAt || undefined,
    created_at: row.created_at || row.createdAt || undefined,
    updatedAt: row.updated_at || row.updatedAt || undefined,
    updated_at: row.updated_at || row.updatedAt || undefined
  };
};

/**
 * Framework Category Service with Supabase-First architecture and robust error isolation.
 */
export const frameworkCategoryService = {
  /**
   * Fetches only active categories for public display and editor dropdowns.
   * Sorted by sort_order ascending.
   */
  async fetchActiveFrameworkCategories(): Promise<{ data: FrameworkCategory[] | null; error: any }> {
    try {
      if (!isSupabaseConfigured()) {
        return { data: null, error: new Error('Supabase is not configured') };
      }

      const { data, error } = await supabase
        .from('framework_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) {
        // Safe check for table not existing yet
        if (error.code === 'PGRST205' || error.message?.includes('does not exist')) {
          console.warn('[FrameworkCategoryService] table public.framework_categories does not exist yet.');
        } else {
          console.error('[FrameworkCategoryService] Error fetching active categories:', error);
        }
        return { data: null, error };
      }

      const categories = (data || []).map(mapDbRowToFrameworkCategory);
      return { data: categories, error: null };
    } catch (err: any) {
      console.error('[FrameworkCategoryService] Unexpected error in fetchActiveFrameworkCategories:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Fetches all categories (active & inactive) for Admin Management.
   * Sorted by sort_order ascending.
   */
  async fetchAllFrameworkCategoriesAdmin(): Promise<{ data: FrameworkCategory[] | null; error: any }> {
    try {
      if (!isSupabaseConfigured()) {
        return { data: null, error: new Error('Supabase is not configured') };
      }

      const { data, error } = await supabase
        .from('framework_categories')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('does not exist')) {
          console.warn('[FrameworkCategoryService] table public.framework_categories does not exist yet.');
        } else {
          console.error('[FrameworkCategoryService] Error fetching all categories (admin):', error);
        }
        return { data: null, error };
      }

      const categories = (data || []).map(mapDbRowToFrameworkCategory);
      return { data: categories, error: null };
    } catch (err: any) {
      console.error('[FrameworkCategoryService] Unexpected error in fetchAllFrameworkCategoriesAdmin:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Creates a new framework category in Supabase.
   */
  async createFrameworkCategory(category: Partial<FrameworkCategory>): Promise<{ data: FrameworkCategory | null; error: any }> {
    try {
      if (!isSupabaseConfigured()) {
        return { data: null, error: new Error('Supabase is not configured') };
      }

      const name = String(category.name || '').trim();
      if (!name) {
        return { data: null, error: new Error('Category name is required') };
      }

      const slug = (category.slug && category.slug.trim()) ? slugify(category.slug) : slugify(name);
      const description = String(category.description || '').trim();
      const isActive = category.isActive ?? category.is_active ?? true;
      const sortOrder = typeof category.sortOrder === 'number' 
        ? category.sortOrder 
        : (typeof category.sort_order === 'number' ? category.sort_order : 0);

      const dbPayload = {
        name,
        slug,
        description,
        sort_order: sortOrder,
        is_active: isActive
      };

      const { data, error } = await supabase
        .from('framework_categories')
        .insert([dbPayload])
        .select('*')
        .single();

      if (error) {
        console.error('[FrameworkCategoryService] Error inserting category:', error);
        return { data: null, error };
      }

      return { data: mapDbRowToFrameworkCategory(data), error: null };
    } catch (err: any) {
      console.error('[FrameworkCategoryService] Unexpected error in createFrameworkCategory:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Updates an existing framework category.
   */
  async updateFrameworkCategory(id: string, category: Partial<FrameworkCategory>): Promise<{ data: FrameworkCategory | null; error: any }> {
    try {
      if (!isSupabaseConfigured()) {
        return { data: null, error: new Error('Supabase is not configured') };
      }

      if (!id) {
        return { data: null, error: new Error('Category ID is required for update') };
      }

      const updatePayload: Record<string, any> = {};

      if (category.name !== undefined) {
        updatePayload.name = String(category.name).trim();
      }
      if (category.slug !== undefined) {
        updatePayload.slug = slugify(category.slug);
      }
      if (category.description !== undefined) {
        updatePayload.description = String(category.description).trim();
      }
      if (category.sortOrder !== undefined || category.sort_order !== undefined) {
        updatePayload.sort_order = category.sortOrder ?? category.sort_order;
      }
      if (category.isActive !== undefined || category.is_active !== undefined) {
        updatePayload.is_active = category.isActive ?? category.is_active;
      }

      const { data, error } = await supabase
        .from('framework_categories')
        .update(updatePayload)
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        console.error('[FrameworkCategoryService] Error updating category:', error);
        return { data: null, error };
      }

      return { data: mapDbRowToFrameworkCategory(data), error: null };
    } catch (err: any) {
      console.error('[FrameworkCategoryService] Unexpected error in updateFrameworkCategory:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Deletes a category by id.
   */
  async deleteFrameworkCategory(id: string): Promise<{ success: boolean; error: any }> {
    try {
      if (!isSupabaseConfigured()) {
        return { success: false, error: new Error('Supabase is not configured') };
      }

      if (!id) {
        return { success: false, error: new Error('Category ID is required for deletion') };
      }

      const { error } = await supabase
        .from('framework_categories')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[FrameworkCategoryService] Error deleting category:', error);
        return { success: false, error };
      }

      return { success: true, error: null };
    } catch (err: any) {
      console.error('[FrameworkCategoryService] Unexpected error in deleteFrameworkCategory:', err);
      return { success: false, error: err };
    }
  },

  /**
   * Toggles category active status.
   */
  async toggleFrameworkCategoryStatus(id: string, isActive: boolean): Promise<{ data: FrameworkCategory | null; error: any }> {
    return this.updateFrameworkCategory(id, { isActive });
  },

  /**
   * Batch updates sort order of categories based on an array of category IDs.
   */
  async reorderFrameworkCategories(orderedCategoryIds: string[]): Promise<{ success: boolean; error: any }> {
    try {
      if (!isSupabaseConfigured()) {
        return { success: false, error: new Error('Supabase is not configured') };
      }

      if (!Array.isArray(orderedCategoryIds) || orderedCategoryIds.length === 0) {
        return { success: true, error: null };
      }

      const updates = orderedCategoryIds.map((id, index) =>
        supabase
          .from('framework_categories')
          .update({ sort_order: index + 1 })
          .eq('id', id)
      );

      const results = await Promise.all(updates);
      const firstError = results.find((r) => r.error)?.error;

      if (firstError) {
        console.error('[FrameworkCategoryService] Error reordering categories:', firstError);
        return { success: false, error: firstError };
      }

      return { success: true, error: null };
    } catch (err: any) {
      console.error('[FrameworkCategoryService] Unexpected error in reorderFrameworkCategories:', err);
      return { success: false, error: err };
    }
  }
};
