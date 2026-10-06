import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  X,
  Check,
  Loader2,
  Image as ImageIcon,
  Star,
  Clock,
  Globe,
  ChevronDown,
  ChevronUp,
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link2,
  Code,
  Minus,
  Eye,
  Edit3,
  Sparkles,
  Columns,
  ExternalLink,
  Undo,
  Calendar
} from 'lucide-react';
import { Article } from '../types';
import { slugify } from '../services/articleService';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ArticleEditorModalProps {
  isOpen: boolean;
  initialArticle: Article | null;
  onClose: () => void;
  onSave: (payload: Partial<Article>, targetStatus: 'draft' | 'published') => Promise<void>;
  onUnpublish?: (id: string) => Promise<void>;
  isSaving: boolean;
}

const CATEGORY_PRESETS = [
  'Digital Growth',
  'AI Transformation',
  'Marketing Systems',
  'Founder Authority',
  'Personal Branding',
  'Technology'
];

export const ArticleEditorModal: React.FC<ArticleEditorModalProps> = ({
  isOpen,
  initialArticle,
  onClose,
  onSave,
  onUnpublish,
  isSaving
}) => {
  const isEditing = Boolean(initialArticle && initialArticle.id);
  const isAlreadyPublished = initialArticle?.status === 'published';

  // Form State
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [category, setCategory] = useState('Digital Growth');
  const [author, setAuthor] = useState('Digital Muid');
  const [readingTime, setReadingTime] = useState('5');
  const [isFeatured, setIsFeatured] = useState(false);
  const [featuredImage, setFeaturedImage] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [publishedAt, setPublishedAt] = useState('');
  
  // SEO State
  const [isSeoOpen, setIsSeoOpen] = useState(false);
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');

  // UI state
  const [viewMode, setViewMode] = useState<'write' | 'preview' | 'split'>('write');
  const [isDirty, setIsDirty] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize or reset form when initialArticle changes
  useEffect(() => {
    if (isOpen) {
      if (initialArticle) {
        setTitle(initialArticle.title || '');
        setSlug(initialArticle.slug || '');
        setIsSlugManuallyEdited(true);
        setCategory(initialArticle.category || 'Digital Growth');
        setAuthor(typeof initialArticle.author === 'string' ? initialArticle.author : initialArticle.author?.name || 'Digital Muid');
        setReadingTime(String(initialArticle.readingTimeMinutes || parseInt(initialArticle.readTime || '5', 10) || 5));
        setIsFeatured(Boolean(initialArticle.isFeatured ?? initialArticle.featured));
        setFeaturedImage(initialArticle.featuredImage || '');
        setExcerpt(initialArticle.excerpt || '');
        setContent(initialArticle.content || '');
        setPublishedAt(initialArticle.publishedAt || (initialArticle.status === 'published' ? new Date().toISOString().split('T')[0] : ''));
        setSeoTitle(initialArticle.seoTitle || '');
        setSeoDescription(initialArticle.seoDescription || '');
        setIsSeoOpen(Boolean(initialArticle.seoTitle || initialArticle.seoDescription));
      } else {
        // Fresh draft
        setTitle('');
        setSlug('');
        setIsSlugManuallyEdited(false);
        setCategory('Digital Growth');
        setAuthor('Digital Muid');
        setReadingTime('5');
        setIsFeatured(false);
        setFeaturedImage('https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80');
        setExcerpt('');
        setContent('');
        setPublishedAt(new Date().toISOString().split('T')[0]);
        setSeoTitle('');
        setSeoDescription('');
        setIsSeoOpen(false);
      }
      setViewMode('write');
      setIsDirty(false);
    }
  }, [isOpen, initialArticle]);

  if (!isOpen) return null;

  // Auto-generate slug from title if user hasn't explicitly customized it
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTitle(val);
    setIsDirty(true);
    if (!isSlugManuallyEdited) {
      setSlug(slugify(val));
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSlug(e.target.value);
    setIsSlugManuallyEdited(true);
    setIsDirty(true);
  };

  // Word count and auto estimated read time calculation
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const calculatedReadTime = Math.max(1, Math.ceil(wordCount / 200));

  const handleApplyCalculatedReadTime = () => {
    setReadingTime(String(calculatedReadTime));
    setIsDirty(true);
  };

  // Formatting Toolbar Helper for Textarea
  const insertFormatting = (prefix: string, suffix: string = '', defaultPlaceholder: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const previousText = textarea.value;
    const selectedText = previousText.substring(start, end) || defaultPlaceholder;

    const replacement = `${prefix}${selectedText}${suffix}`;
    const newText = previousText.substring(0, start) + replacement + previousText.substring(end);

    setContent(newText);
    setIsDirty(true);

    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + prefix.length + selectedText.length;
      textarea.setSelectionRange(start + prefix.length, newCursorPos);
    }, 0);
  };

  const handleSafeClose = () => {
    if (isDirty) {
      const confirmLeave = window.confirm('You have unsaved changes in this article. Are you sure you want to exit?');
      if (!confirmLeave) return;
    }
    onClose();
  };

  const handleSubmit = async (targetStatus: 'draft' | 'published') => {
    if (!title.trim()) {
      alert('Please enter an article title.');
      return;
    }

    const finalSlug = slug.trim() ? slugify(slug) : slugify(title);
    const readingTimeMinutes = Math.max(1, parseInt(readingTime, 10) || calculatedReadTime || 5);

    const payload: Partial<Article> = {
      title: title.trim(),
      slug: finalSlug,
      excerpt: excerpt.trim(),
      content: content.trim(),
      category: category.trim() || 'Digital Growth',
      author: {
        name: author.trim() || 'Digital Muid',
        role: 'Founder & Strategic Architect',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'
      },
      featuredImage: featuredImage.trim() || 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
      readingTimeMinutes,
      status: targetStatus,
      isFeatured,
      featured: isFeatured,
      publishedAt: targetStatus === 'published' ? (publishedAt || new Date().toISOString().split('T')[0]) : undefined,
      seoTitle: seoTitle.trim() || undefined,
      seoDescription: seoDescription.trim() || undefined,
      tags: [category.trim() || 'Strategy', 'Growth']
    };

    await onSave(payload, targetStatus);
    setIsDirty(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-5xl my-4 sm:my-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* ========================================================================= */}
        {/* MODAL HEADER */}
        {/* ========================================================================= */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between gap-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1877F2]/10 border border-[#1877F2]/20 flex items-center justify-center text-[#1877F2]">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-display font-bold text-white">
                  {isEditing ? 'Edit Strategic Article' : 'Author New Strategic Article'}
                </h3>
                {isAlreadyPublished ? (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                    Live
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 text-[10px] font-bold border border-amber-500/20">
                    Draft
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Author and publish strategic essays directly synchronized with Supabase (<code className="text-[#1877F2]">public.articles</code>).
              </p>
            </div>
          </div>

          <button
            onClick={handleSafeClose}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Close editor"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ========================================================================= */}
        {/* MODAL BODY (SCROLLABLE) */}
        {/* ========================================================================= */}
        <div className="p-4 sm:p-6 md:p-8 overflow-y-auto space-y-6 flex-1">
          {/* 1. Title & URL Slug */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Article Title <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g., Why Digital Growth Is Changing in the Autonomous AI Era"
                value={title}
                onChange={handleTitleChange}
                className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-700 text-white text-base sm:text-lg font-display font-bold placeholder-slate-500 focus:outline-none focus:border-[#1877F2] transition-colors"
              />
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-slate-400 uppercase tracking-wider">
                  Public URL Slug <span className="text-rose-400">*</span>
                </label>
                <span className="text-[11px] text-slate-500 font-mono">
                  {slug ? `/insights/${slugify(slug)}` : '/insights/[slug]'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-xs font-mono hidden sm:inline">/insights/</span>
                <input
                  type="text"
                  required
                  placeholder="why-digital-growth-is-changing"
                  value={slug}
                  onChange={handleSlugChange}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-[#1877F2]"
                />
                {!isSlugManuallyEdited && title && (
                  <span className="text-[10px] text-emerald-400 font-medium px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20">
                    Auto-generated
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 2. Metadata Grid: Category, Author, Reading Time, Homepage Pin */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
            {/* Category */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Category
              </label>
              <input
                type="text"
                list="category-options"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setIsDirty(true);
                }}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-[#1877F2]"
                placeholder="Digital Growth"
              />
              <datalist id="category-options">
                {CATEGORY_PRESETS.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>

            {/* Author */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Author
              </label>
              <input
                type="text"
                value={author}
                onChange={(e) => {
                  setAuthor(e.target.value);
                  setIsDirty(true);
                }}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-[#1877F2]"
                placeholder="Digital Muid"
              />
            </div>

            {/* Reading Time */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Read Time (Mins)
                </label>
                {content.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={handleApplyCalculatedReadTime}
                    className="text-[10px] text-[#1877F2] hover:underline"
                    title={`Calculated from ${wordCount} words (${calculatedReadTime}m)`}
                  >
                    Auto ({calculatedReadTime}m)
                  </button>
                )}
              </div>
              <input
                type="number"
                min="1"
                value={readingTime}
                onChange={(e) => {
                  setReadingTime(e.target.value);
                  setIsDirty(true);
                }}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-[#1877F2]"
              />
            </div>

            {/* Featured on Homepage */}
            <div className="flex flex-col justify-center">
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Homepage Pin
              </label>
              <label className="flex items-center gap-2 cursor-pointer mt-1 py-1">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => {
                    setIsFeatured(e.target.checked);
                    setIsDirty(true);
                  }}
                  className="w-4 h-4 rounded text-[#1877F2] focus:ring-0 bg-slate-900 border-slate-700 cursor-pointer"
                />
                <span className="text-xs text-white flex items-center gap-1 font-medium">
                  <Star className={`w-3.5 h-3.5 ${isFeatured ? 'text-[#1877F2] fill-current' : 'text-slate-500'}`} />
                  <span>Featured Hero</span>
                </span>
              </label>
            </div>
          </div>

          {/* 3. Featured Image URL */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Featured Image URL (Optional)
            </label>
            <div className="flex flex-col sm:flex-row gap-3 items-start">
              <div className="flex-1 w-full">
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/photo-..."
                  value={featuredImage}
                  onChange={(e) => {
                    setFeaturedImage(e.target.value);
                    setIsDirty(true);
                  }}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-[#1877F2]"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  High resolution landscape format (16:9) recommended for card and hero views.
                </p>
              </div>

              {/* Image Preview Thumbnail */}
              <div className="w-24 h-14 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center flex-shrink-0">
                {featuredImage ? (
                  <img
                    src={featuredImage}
                    alt="Article thumbnail preview"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-600 text-[10px]">
                    <ImageIcon className="w-4 h-4 mb-0.5" />
                    <span>Fallback</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 4. Excerpt / Summary */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Summary / Excerpt <span className="text-rose-400">*</span>
              </label>
              <span className="text-[11px] text-slate-500">
                {excerpt.length} characters
              </span>
            </div>
            <textarea
              required
              rows={2}
              placeholder="Executive summary of this strategic thesis shown on preview cards, search listings, and social sharing cards..."
              value={excerpt}
              onChange={(e) => {
                setExcerpt(e.target.value);
                setIsDirty(true);
              }}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-[#1877F2] leading-relaxed"
            />
          </div>

          {/* 5. Article Content & Markdown Toolbar */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Article Body (Markdown) <span className="text-rose-400">*</span>
                </label>
                <span className="text-[11px] text-slate-500 font-mono">
                  {wordCount} words · {calculatedReadTime} min read
                </span>
              </div>

              {/* View Mode Switcher: Write / Preview / Split */}
              <div className="flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setViewMode('write')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    viewMode === 'write' ? 'bg-[#1877F2] text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Write</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('preview')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    viewMode === 'preview' ? 'bg-[#1877F2] text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('split')}
                  className={`hidden md:flex px-3 py-1 rounded-lg text-xs font-semibold items-center gap-1.5 transition-colors cursor-pointer ${
                    viewMode === 'split' ? 'bg-[#1877F2] text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Columns className="w-3.5 h-3.5" />
                  <span>Split</span>
                </button>
              </div>
            </div>

            {/* Markdown Helper Formatting Toolbar */}
            {viewMode !== 'preview' && (
              <div className="flex flex-wrap items-center gap-1 p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300">
                <button
                  type="button"
                  onClick={() => insertFormatting('## ', '', 'Section Heading')}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Heading 2 (## )"
                >
                  <Heading2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('### ', '', 'Subheading')}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Heading 3 (### )"
                >
                  <Heading3 className="w-4 h-4" />
                </button>
                <div className="w-px h-4 bg-slate-800 mx-1" />
                <button
                  type="button"
                  onClick={() => insertFormatting('**', '**', 'bold text')}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Bold (**text**)"
                >
                  <Bold className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('*', '*', 'italic text')}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Italic (*text*)"
                >
                  <Italic className="w-4 h-4" />
                </button>
                <div className="w-px h-4 bg-slate-800 mx-1" />
                <button
                  type="button"
                  onClick={() => insertFormatting('- ', '', 'List item')}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Bullet List (- )"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('1. ', '', 'Numbered item')}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Numbered List (1. )"
                >
                  <ListOrdered className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('> ', '', 'Quoted text')}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Blockquote (> )"
                >
                  <Quote className="w-4 h-4" />
                </button>
                <div className="w-px h-4 bg-slate-800 mx-1" />
                <button
                  type="button"
                  onClick={() => insertFormatting('[', '](https://digitalmuid.com)', 'link text')}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Link ([text](url))"
                >
                  <Link2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('```\n', '\n```', 'code block')}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Code Block"
                >
                  <Code className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('\n---\n', '', '')}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Horizontal Divider (---)"
                >
                  <Minus className="w-4 h-4" />
                </button>

                <div className="ml-auto hidden sm:flex items-center text-[11px] text-slate-500">
                  Markdown Formatting Supported
                </div>
              </div>
            )}

            {/* Content Area Rendering according to ViewMode */}
            {viewMode === 'write' && (
              <textarea
                ref={textareaRef}
                required
                rows={14}
                placeholder="## 1. The Core Thesis&#10;&#10;In the evolving digital ecosystem, traditional marketing funnels are rapidly giving way to autonomous systems...&#10;&#10;### Key Architectural Shifts&#10;&#10;- Shift 1: High-conviction brand authority&#10;- Shift 2: Zero-latency conversion funnels&#10;- Shift 3: Algorithmic distribution engine"
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  setIsDirty(true);
                }}
                className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-700 text-white text-sm font-mono focus:outline-none focus:border-[#1877F2] leading-relaxed resize-y"
              />
            )}

            {viewMode === 'preview' && (
              <div className="w-full min-h-[350px] max-h-[500px] overflow-y-auto p-6 rounded-2xl bg-slate-950/90 border border-slate-800 text-white">
                {content.trim() ? (
                  <MarkdownRenderer content={content} />
                ) : (
                  <div className="py-12 text-center text-slate-500 text-xs">
                    No content written yet. Switch to "Write" mode to author your essay.
                  </div>
                )}
              </div>
            )}

            {viewMode === 'split' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <textarea
                  ref={textareaRef}
                  required
                  rows={14}
                  placeholder="Enter markdown article content..."
                  value={content}
                  onChange={(e) => {
                    setContent(e.target.value);
                    setIsDirty(true);
                  }}
                  className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-700 text-white text-sm font-mono focus:outline-none focus:border-[#1877F2] leading-relaxed resize-y"
                />
                <div className="w-full min-h-[350px] max-h-[450px] overflow-y-auto p-5 rounded-2xl bg-slate-950/90 border border-slate-800 text-white">
                  {content.trim() ? (
                    <MarkdownRenderer content={content} />
                  ) : (
                    <div className="py-12 text-center text-slate-500 text-xs">
                      Live markdown preview will appear here as you type.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 6. Collapsible SEO & Metadata Settings */}
          <div className="rounded-2xl bg-slate-950/60 border border-slate-800 overflow-hidden">
            <button
              type="button"
              onClick={() => setIsSeoOpen(!isSeoOpen)}
              className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-slate-900/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#1877F2]" />
                <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                  SEO & Search Metadata
                </span>
                {(seoTitle || seoDescription) && (
                  <span className="w-2 h-2 rounded-full bg-[#1877F2]"></span>
                )}
              </div>
              <div className="flex items-center gap-2 text-slate-400 text-xs">
                <span>{isSeoOpen ? 'Collapse' : 'Configure'}</span>
                {isSeoOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {isSeoOpen && (
              <div className="p-5 border-t border-slate-800/80 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* SEO Title */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        SEO Meta Title
                      </label>
                      <span className="text-[10px] text-slate-500">
                        {seoTitle.length}/60 chars
                      </span>
                    </div>
                    <input
                      type="text"
                      placeholder={title || 'Search engine title override'}
                      value={seoTitle}
                      onChange={(e) => {
                        setSeoTitle(e.target.value);
                        setIsDirty(true);
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-[#1877F2]"
                    />
                  </div>

                  {/* Publish Date Override */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Publish Date Override
                      </label>
                      <span className="text-[10px] text-slate-500">Optional</span>
                    </div>
                    <input
                      type="date"
                      value={publishedAt}
                      onChange={(e) => {
                        setPublishedAt(e.target.value);
                        setIsDirty(true);
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-[#1877F2]"
                    />
                  </div>
                </div>

                {/* SEO Description */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      SEO Meta Description
                    </label>
                    <span className={`text-[10px] ${seoDescription.length > 160 ? 'text-amber-400' : 'text-slate-500'}`}>
                      {seoDescription.length}/160 chars recommended
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    placeholder={excerpt || 'Meta description for Google search snippets and social sharing open graph tags...'}
                    value={seoDescription}
                    onChange={(e) => {
                      setSeoDescription(e.target.value);
                      setIsDirty(true);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-[#1877F2]"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MODAL FOOTER & PUBLISHING CONTROLS */}
        {/* ========================================================================= */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/90 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSafeClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>

            {isAlreadyPublished && initialArticle && onUnpublish && (
              <button
                type="button"
                disabled={isSaving}
                onClick={async () => {
                  const confirmUnpub = window.confirm('Unpublish this article and revert status to draft?');
                  if (confirmUnpub) {
                    await onUnpublish(initialArticle.id);
                    onClose();
                  }
                }}
                className="px-4 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                Unpublish to Draft
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {/* Save as Draft */}
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSubmit('draft')}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center justify-center gap-2 border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              <span>Save Draft</span>
            </button>

            {/* Publish or Save Changes */}
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSubmit(isAlreadyPublished ? 'published' : 'published')}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-[#1877F2] hover:bg-[#2563EB] text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-[#1877F2]/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{isAlreadyPublished ? 'Save Changes' : 'Publish Article'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
