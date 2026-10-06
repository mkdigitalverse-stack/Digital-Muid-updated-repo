import React, { useState } from 'react';
import {
  X,
  Plus,
  Edit2,
  Trash2,
  ArrowUp,
  ArrowDown,
  Layers,
  Check,
  AlertTriangle,
  Info,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Loader2
} from 'lucide-react';
import { FrameworkCategory, Framework } from '../types';
import { useApp } from '../context/AppContext';
import { slugify } from '../services/articleService';

interface FrameworkCategoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FrameworkCategoriesModal: React.FC<FrameworkCategoriesModalProps> = ({
  isOpen,
  onClose
}) => {
  const {
    frameworkCategories,
    frameworks,
    addFrameworkCategory,
    updateFrameworkCategory,
    deleteFrameworkCategory,
    toggleFrameworkCategoryStatus,
    reorderFrameworkCategories,
    notify
  } = useApp();

  // Form State for creating/editing
  const [isEditing, setIsEditing] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSortOrder, setFormSortOrder] = useState<number>(1);
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete protection modal state
  const [categoryToDelete, setCategoryToDelete] = useState<FrameworkCategory | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  // Sorted categories by sort_order
  const sortedCategories = [...frameworkCategories].sort(
    (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)
  );

  // Helper to count how many frameworks use a category
  const getFrameworkCount = (categoryName: string) => {
    return frameworks.filter(
      (fw) => (fw.category || '').toLowerCase() === categoryName.toLowerCase()
    ).length;
  };

  const handleOpenAddForm = () => {
    const nextOrder =
      frameworkCategories.length > 0
        ? Math.max(...frameworkCategories.map((c) => c.sortOrder || 0)) + 1
        : 1;

    setEditingCategoryId(null);
    setFormName('');
    setFormSlug('');
    setFormDescription('');
    setFormSortOrder(nextOrder);
    setFormIsActive(true);
    setIsSlugManuallyEdited(false);
    setIsEditing(true);
  };

  const handleOpenEditForm = (cat: FrameworkCategory) => {
    setEditingCategoryId(cat.id);
    setFormName(cat.name);
    setFormSlug(cat.slug);
    setFormDescription(cat.description || '');
    setFormSortOrder(cat.sortOrder || 0);
    setFormIsActive(cat.isActive !== false);
    setIsSlugManuallyEdited(true);
    setIsEditing(true);
  };

  const handleCancelForm = () => {
    setIsEditing(false);
    setEditingCategoryId(null);
    setFormName('');
    setFormSlug('');
    setFormDescription('');
    setIsSlugManuallyEdited(false);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormName(val);
    if (!isSlugManuallyEdited) {
      setFormSlug(slugify(val));
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = formName.trim();
    if (!trimmedName) {
      notify('Please enter a category name', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Partial<FrameworkCategory> = {
        name: trimmedName,
        slug: formSlug.trim() ? slugify(formSlug) : slugify(trimmedName),
        description: formDescription.trim(),
        sortOrder: Number(formSortOrder) || 1,
        isActive: formIsActive
      };

      if (editingCategoryId) {
        const res = await updateFrameworkCategory(editingCategoryId, payload);
        if (res.data) {
          handleCancelForm();
        }
      } else {
        const res = await addFrameworkCategory(payload);
        if (res.data) {
          handleCancelForm();
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Move category up in sort order
  const handleMoveUp = async (index: number) => {
    if (index <= 0) return;
    const newOrder = [...sortedCategories];
    const temp = newOrder[index - 1];
    newOrder[index - 1] = newOrder[index];
    newOrder[index] = temp;

    const ids = newOrder.map((c) => c.id);
    await reorderFrameworkCategories(ids);
  };

  // Move category down in sort order
  const handleMoveDown = async (index: number) => {
    if (index >= sortedCategories.length - 1) return;
    const newOrder = [...sortedCategories];
    const temp = newOrder[index + 1];
    newOrder[index + 1] = newOrder[index];
    newOrder[index] = temp;

    const ids = newOrder.map((c) => c.id);
    await reorderFrameworkCategories(ids);
  };

  // Toggle active status
  const handleToggleStatus = async (cat: FrameworkCategory) => {
    const newStatus = !(cat.isActive !== false);
    await toggleFrameworkCategoryStatus(cat.id, newStatus);
  };

  // Trigger Delete Confirmation or Protection Alert
  const handleRequestDelete = (cat: FrameworkCategory) => {
    setCategoryToDelete(cat);
  };

  const handleConfirmDelete = async () => {
    if (!categoryToDelete) return;
    setIsDeleting(true);
    try {
      const res = await deleteFrameworkCategory(categoryToDelete.id);
      if (res.success) {
        setCategoryToDelete(null);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      id="framework-categories-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        id="framework-categories-modal"
        className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-display font-bold text-white flex items-center gap-2">
                Framework Categories
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-normal border border-slate-700">
                  {frameworkCategories.length} Total
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage taxonomy, ordering, and active status for Digital Muid frameworks.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isEditing && (
              <button
                id="add-category-btn"
                onClick={handleOpenAddForm}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>New Category</span>
              </button>
            )}
            <button
              id="close-categories-modal-btn"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Add / Edit Inline Form */}
          {isEditing && (
            <div
              id="category-editor-form-container"
              className="p-5 rounded-xl bg-slate-950/80 border border-indigo-500/30 space-y-4 animate-in slide-in-from-top-2 duration-200"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2 text-indigo-400 text-sm font-semibold">
                  <Sparkles className="w-4 h-4" />
                  <span>{editingCategoryId ? 'Edit Category' : 'Create New Category'}</span>
                </div>
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="text-xs text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>

              <form onSubmit={handleSaveCategory} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Category Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      Category Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={handleNameChange}
                      placeholder="e.g. AI & Automation"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 placeholder:text-slate-500"
                    />
                  </div>

                  {/* Slug */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      URL Slug <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formSlug}
                      onChange={(e) => {
                        setIsSlugManuallyEdited(true);
                        setFormSlug(slugify(e.target.value));
                      }}
                      placeholder="e.g. ai-and-automation"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 placeholder:text-slate-500 font-mono text-xs"
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Description</label>
                  <textarea
                    rows={2}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Brief description explaining this framework methodology category..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 placeholder:text-slate-500 resize-none"
                  />
                </div>

                {/* Controls: Sort Order & Active Status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Sort Order (Priority)</label>
                    <input
                      type="number"
                      min={1}
                      value={formSortOrder}
                      onChange={(e) => setFormSortOrder(parseInt(e.target.value, 10) || 1)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-4 sm:pt-6">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formIsActive}
                        onChange={(e) => setFormIsActive(e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700 focus:ring-indigo-500"
                      />
                      <span className="text-xs font-medium text-slate-200">
                        Active for public filtering and editor dropdown
                      </span>
                    </label>
                  </div>
                </div>

                {/* Form Buttons */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleCancelForm}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer shadow-md shadow-indigo-600/20"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>{editingCategoryId ? 'Update Category' : 'Create Category'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Categories Table / List */}
          <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/50">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 w-16 text-center">Order</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 hidden md:table-cell">Description / Slug</th>
                  <th className="py-3 px-4 text-center">Usage</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {sortedCategories.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No categories found. Click &quot;New Category&quot; to create one.
                    </td>
                  </tr>
                ) : (
                  sortedCategories.map((cat, index) => {
                    const frameworkCount = getFrameworkCount(cat.name);
                    const isActive = cat.isActive !== false;

                    return (
                      <tr
                        key={cat.id}
                        className="hover:bg-slate-800/40 transition-colors group"
                      >
                        {/* Order & Move buttons */}
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <span className="font-mono text-slate-400 w-4 text-center">
                              {cat.sortOrder ?? index + 1}
                            </span>
                            <div className="flex flex-col">
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={() => handleMoveUp(index)}
                                title="Move up"
                                className="p-0.5 text-slate-500 hover:text-white disabled:opacity-20 disabled:hover:text-slate-500 transition-colors cursor-pointer"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                disabled={index === sortedCategories.length - 1}
                                onClick={() => handleMoveDown(index)}
                                title="Move down"
                                className="p-0.5 text-slate-500 hover:text-white disabled:opacity-20 disabled:hover:text-slate-500 transition-colors cursor-pointer"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </td>

                        {/* Name */}
                        <td className="py-3 px-4">
                          <div className="font-medium text-white text-sm flex items-center gap-2">
                            {cat.name}
                          </div>
                        </td>

                        {/* Description & Slug */}
                        <td className="py-3 px-4 hidden md:table-cell max-w-xs">
                          <p className="text-slate-300 truncate">{cat.description || '—'}</p>
                          <span className="text-[10px] font-mono text-slate-500">
                            /{cat.slug}
                          </span>
                        </td>

                        {/* Framework count badge */}
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                              frameworkCount > 0
                                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {frameworkCount} {frameworkCount === 1 ? 'framework' : 'frameworks'}
                          </span>
                        </td>

                        {/* Status Toggle */}
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(cat)}
                            title={isActive ? 'Deactivate category' : 'Activate category'}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                              isActive
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                                : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isActive ? 'bg-emerald-400' : 'bg-slate-500'
                              }`}
                            />
                            <span>{isActive ? 'Active' : 'Inactive'}</span>
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditForm(cat)}
                              title="Edit category"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRequestDelete(cat)}
                              title={
                                frameworkCount > 0
                                  ? `Protected: Assigned to ${frameworkCount} frameworks`
                                  : 'Delete category'
                              }
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Info className="w-4 h-4 text-indigo-400" />
            <span>
              Categories are backed by Supabase with live RLS and provide available options in the Framework Editor.
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* Delete / Protection Dialog Modal */}
      {categoryToDelete && (
        <div
          id="category-delete-dialog-overlay"
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-100">
            {getFrameworkCount(categoryToDelete.name) > 0 ? (
              // DELETION BLOCKED: Protective State
              <>
                <div className="flex items-center gap-3 text-amber-400">
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Cannot Delete Category</h3>
                    <p className="text-xs text-slate-400">Deletion Safety Protection</p>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  The category <strong className="text-white">&ldquo;{categoryToDelete.name}&rdquo;</strong> is currently assigned to{' '}
                  <strong className="text-amber-400">
                    {getFrameworkCount(categoryToDelete.name)} framework
                    {getFrameworkCount(categoryToDelete.name) > 1 ? 's' : ''}
                  </strong>
                  . To protect data integrity, categories with active frameworks cannot be deleted.
                </p>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400 space-y-1">
                  <p className="font-semibold text-slate-300">Recommended Action:</p>
                  <p>
                    Reassign those frameworks to another category in the Frameworks CMS, or toggle this category to <strong>Inactive</strong> to hide it from new framework creation.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setCategoryToDelete(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Got It
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await toggleFrameworkCategoryStatus(categoryToDelete.id, false);
                      setCategoryToDelete(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    Deactivate Instead
                  </button>
                </div>
              </>
            ) : (
              // DELETION ALLOWED: Safe to delete
              <>
                <div className="flex items-center gap-3 text-rose-400">
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                    <Trash2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Delete Category?</h3>
                    <p className="text-xs text-slate-400">This action cannot be undone.</p>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Are you sure you want to delete the category{' '}
                  <strong className="text-white">&ldquo;{categoryToDelete.name}&rdquo;</strong>? No frameworks are currently assigned to this category.
                </p>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setCategoryToDelete(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={handleConfirmDelete}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer shadow-md shadow-rose-600/20"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        <span>Delete Category</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
