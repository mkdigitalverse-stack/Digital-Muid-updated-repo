import React, { useState, useEffect, useRef } from 'react';
import {
  Layers,
  X,
  Check,
  Loader2,
  Image as ImageIcon,
  Star,
  Globe,
  ChevronDown,
  ChevronUp,
  Tag,
  Eye,
  Plus,
  Trash2,
  Calendar,
  Sparkles,
  ArrowUp,
  ArrowDown,
  FileText,
  Video,
  Download,
  AlertCircle,
  HelpCircle,
  Clock,
  Target,
  Workflow,
  Lightbulb,
  CheckCircle2,
  Upload
} from 'lucide-react';
import { Framework, FrameworkStage, FrameworkCategory, Article, Video as VideoType, Resource } from '../types';
import { slugify } from '../services/articleService';
import { frameworkService } from '../services/frameworkService';
import { useApp } from '../context/AppContext';

interface FrameworkEditorModalProps {
  isOpen: boolean;
  initialFramework: Framework | null;
  onClose: () => void;
  onSave: (payload: Partial<Framework>, targetStatus: 'draft' | 'published') => Promise<void>;
  onUnpublish?: (id: string) => Promise<void>;
  isSaving: boolean;
  availableArticles: Article[];
  availableVideos: VideoType[];
  availableResources: Resource[];
  availableCategories?: FrameworkCategory[];
}

export const FrameworkEditorModal: React.FC<FrameworkEditorModalProps> = ({
  isOpen,
  initialFramework,
  onClose,
  onSave,
  onUnpublish,
  isSaving,
  availableArticles,
  availableVideos,
  availableResources,
  availableCategories
}) => {
  const { frameworkCategories: contextCategories } = useApp();
  const categoriesSource = (availableCategories && availableCategories.length > 0) ? availableCategories : contextCategories;
  
  // Compute active categories list sorted by sortOrder
  const activeCategoryList = (categoriesSource || [])
    .filter(c => c.isActive !== false)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map(c => c.name);

  // Compute total category options, ensuring the initialFramework's existing category is preserved even if deactivated
  const categoryOptions = React.useMemo(() => {
    const list = activeCategoryList.length > 0
      ? [...activeCategoryList]
      : [
          'Digital Growth',
          'AI & Automation',
          'Personal Branding',
          'Modern Marketing',
          'Consulting & Leadership',
          'Systems & Architecture',
          'Business Transformation'
        ];

    if (initialFramework?.category && !list.includes(initialFramework.category)) {
      list.push(initialFramework.category);
    }
    return list;
  }, [activeCategoryList, initialFramework?.category]);

  const defaultCategory = categoryOptions[0] || 'Digital Growth';

  const isEditing = Boolean(initialFramework && initialFramework.id);
  const isAlreadyPublished = initialFramework?.status === 'published';

  // Core Form State
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(defaultCategory);
  const [author, setAuthor] = useState('Digital Muid');
  const [coverImage, setCoverImage] = useState('');
  const [problemStatement, setProblemStatement] = useState('');
  const [solutionStatement, setSolutionStatement] = useState('');
  const [whoIsItFor, setWhoIsItFor] = useState('');
  const [whenToUse, setWhenToUse] = useState('');

  // Dynamic Stages Builder
  const [stages, setStages] = useState<FrameworkStage[]>([]);

  // Cross-linking
  const [relatedArticles, setRelatedArticles] = useState<string[]>([]);
  const [relatedVideos, setRelatedVideos] = useState<string[]>([]);
  const [relatedResources, setRelatedResources] = useState<string[]>([]);

  // Tags & Status
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isFeatured, setIsFeatured] = useState(false);
  const [publishedAt, setPublishedAt] = useState('');

  // SEO State
  const [isSeoOpen, setIsSeoOpen] = useState(false);
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');

  // UI state
  const [activeTab, setActiveTab] = useState<'content' | 'stages' | 'audience' | 'relations' | 'seo'>('content');
  const [showLivePreview, setShowLivePreview] = useState(true);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageNotice, setImageNotice] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize or reset form
  useEffect(() => {
    if (isOpen) {
      if (initialFramework) {
        setTitle(initialFramework.title || initialFramework.name || '');
        setSlug(initialFramework.slug || '');
        setIsSlugManuallyEdited(true);
        setSubtitle(initialFramework.subtitle || '');
        setDescription(initialFramework.description || initialFramework.introduction || '');
        setCategory(initialFramework.category || defaultCategory);
        setAuthor(initialFramework.author || 'Digital Muid');
        setCoverImage(initialFramework.coverImage || initialFramework.cover_image || '');
        setProblemStatement(initialFramework.problemStatement || initialFramework.problem_statement || initialFramework.problem || '');
        setSolutionStatement(initialFramework.solutionStatement || initialFramework.solution_statement || '');
        setWhoIsItFor(initialFramework.whoIsItFor || initialFramework.who_is_it_for || '');
        setWhenToUse(initialFramework.whenToUse || initialFramework.when_to_use || '');
        
        const rawStages = initialFramework.frameworkContent ?? initialFramework.framework_content ?? initialFramework.steps ?? [];
        if (Array.isArray(rawStages) && rawStages.length > 0) {
          setStages(rawStages.map((s, idx) => ({
            step: s.step || idx + 1,
            title: s.title || '',
            shortDescription: s.shortDescription || s.subtitle || '',
            content: s.content || s.description || '',
            keyActions: Array.isArray(s.keyActions) ? s.keyActions : [],
            outcome: s.outcome || s.impact || ''
          })));
        } else {
          setStages([
            {
              step: 1,
              title: 'Phase One: Discovery & Positioning',
              shortDescription: 'Core Vector Definition',
              content: 'Identify core market dilemma, validate high-intent ICP vectors, and stress-test value positioning.',
              keyActions: ['Audit customer touchpoints', 'Map friction points'],
              outcome: 'Eliminate wasted budget and achieve extreme operational clarity.'
            }
          ]);
        }

        setRelatedArticles(initialFramework.relatedArticles || initialFramework.related_articles || []);
        setRelatedVideos(initialFramework.relatedVideos || initialFramework.related_videos || []);
        setRelatedResources(initialFramework.relatedResources || initialFramework.related_resources || []);

        setTags(initialFramework.tags && Array.isArray(initialFramework.tags) ? initialFramework.tags : [initialFramework.category || 'Digital Growth']);
        setIsFeatured(Boolean(initialFramework.isFeatured ?? initialFramework.is_featured ?? initialFramework.featured));
        setPublishedAt(
          initialFramework.publishedAt ||
            (initialFramework.status === 'published' ? new Date().toISOString().split('T')[0] : '')
        );
        setSeoTitle(initialFramework.seoTitle || initialFramework.seo_title || '');
        setSeoDescription(initialFramework.seoDescription || initialFramework.seo_description || '');
      } else {
        // Defaults for new framework
        setTitle('');
        setSlug('');
        setIsSlugManuallyEdited(false);
        setSubtitle('');
        setDescription('');
        setCategory(defaultCategory);
        setAuthor('Digital Muid');
        setCoverImage('https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80');
        setProblemStatement('');
        setSolutionStatement('');
        setWhoIsItFor('');
        setWhenToUse('');
        setStages([
          {
            step: 1,
            title: 'Phase 1: Foundation & Audit',
            shortDescription: 'Diagnostic baseline and positioning vector',
            content: 'Isolate key structural constraints and establish measurable baseline KPIs before execution.',
            keyActions: ['Define Ideal Customer Profile', 'Audit current conversion funnel'],
            outcome: 'Clear operational roadmap with quantified targets.'
          },
          {
            step: 2,
            title: 'Phase 2: Architecture & System Design',
            shortDescription: 'Design proprietary workflows and distribution engines',
            content: 'Engineer the high-leverage digital systems, content flywheels, and automated pipeline handoffs.',
            keyActions: ['Build automated routing', 'Deploy signature content assets'],
            outcome: 'Scalable infrastructure operating without founder bottleneck.'
          },
          {
            step: 3,
            title: 'Phase 3: Execution & Compounding',
            shortDescription: 'Iterative optimization and enterprise expansion',
            content: 'Scale high-converting distribution channels, maximize retention loops, and optimize unit economics.',
            keyActions: ['Analyze telemetry data', 'Refine retention flywheels'],
            outcome: 'Predictable high-margin enterprise growth.'
          }
        ]);
        setRelatedArticles([]);
        setRelatedVideos([]);
        setRelatedResources([]);
        setTags(['Digital Growth', 'Strategy']);
        setIsFeatured(false);
        setPublishedAt(new Date().toISOString().split('T')[0]);
        setSeoTitle('');
        setSeoDescription('');
      }
      setActiveTab('content');
      setImageNotice(null);
    }
  }, [isOpen, initialFramework]);

  if (!isOpen) return null;

  // Handle title change & auto slug
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTitle(val);
    if (!isSlugManuallyEdited) {
      setSlug(slugify(val));
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSlug(slugify(e.target.value));
    setIsSlugManuallyEdited(true);
  };

  // Tag Management
  const handleAddTag = () => {
    const clean = tagInput.trim();
    if (clean && !tags.includes(clean)) {
      setTags([...tags, clean]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  // Stage Management
  const handleAddStage = () => {
    const newStepNum = stages.length + 1;
    const newStage: FrameworkStage = {
      step: newStepNum,
      title: `Phase ${newStepNum}: New Strategic Vector`,
      shortDescription: 'Brief description of this stage',
      content: 'Detailed strategic guidelines, methodologies, and execution criteria.',
      keyActions: ['Initial milestone action'],
      outcome: 'Expected commercial or operational outcome'
    };
    setStages([...stages, newStage]);
  };

  const handleUpdateStage = (index: number, updates: Partial<FrameworkStage>) => {
    setStages(prev => prev.map((s, idx) => idx === index ? { ...s, ...updates } : s));
  };

  const handleDeleteStage = (index: number) => {
    if (stages.length <= 1) {
      alert('A framework must have at least one stage.');
      return;
    }
    const updated = stages.filter((_, idx) => idx !== index).map((s, idx) => ({ ...s, step: idx + 1 }));
    setStages(updated);
  };

  const handleMoveStage = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= stages.length) return;
    const newStages = [...stages];
    const temp = newStages[index];
    newStages[index] = newStages[targetIndex];
    newStages[targetIndex] = temp;
    // Re-index steps
    setStages(newStages.map((s, idx) => ({ ...s, step: idx + 1 })));
  };

  // Image Upload handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setImageNotice({ msg: 'Please select a valid image file (JPG, PNG, WebP).', type: 'error' });
      return;
    }

    try {
      setIsUploadingImage(true);
      setImageNotice(null);
      const res = await frameworkService.uploadFrameworkCoverImage(file);
      if (res.url) {
        setCoverImage(res.url);
        setImageNotice({ msg: 'Image uploaded successfully!', type: 'success' });
      } else {
        const errorMsg = res.error?.message || 'Storage upload failed. Check Supabase storage bucket permissions.';
        setImageNotice({ msg: errorMsg, type: 'error' });
      }
    } catch (err: any) {
      setImageNotice({ msg: err.message || 'Upload failed.', type: 'error' });
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Save Validation & Dispatch
  const handleSaveAttempt = async (targetStatus: 'draft' | 'published') => {
    if (!title.trim()) {
      alert('Framework title is required.');
      setActiveTab('content');
      return;
    }

    if (!slug.trim()) {
      alert('Framework slug is required.');
      setActiveTab('content');
      return;
    }

    if (stages.length === 0) {
      alert('At least one framework stage is required.');
      setActiveTab('stages');
      return;
    }

    const payload: Partial<Framework> = {
      title: title.trim(),
      name: title.trim(),
      slug: slugify(slug),
      subtitle: subtitle.trim(),
      description: description.trim(),
      introduction: description.trim(),
      category: category.trim(),
      author: author.trim() || 'Digital Muid',
      coverImage: coverImage.trim() || undefined,
      cover_image: coverImage.trim() || undefined,
      problemStatement: problemStatement.trim(),
      problem_statement: problemStatement.trim(),
      problem: problemStatement.trim(),
      solutionStatement: solutionStatement.trim(),
      solution_statement: solutionStatement.trim(),
      frameworkContent: stages,
      framework_content: stages,
      steps: stages,
      whoIsItFor: whoIsItFor.trim(),
      who_is_it_for: whoIsItFor.trim(),
      whenToUse: whenToUse.trim(),
      when_to_use: whenToUse.trim(),
      relatedArticles,
      related_articles: relatedArticles,
      relatedVideos,
      related_videos: relatedVideos,
      relatedResources,
      related_resources: relatedResources,
      tags: tags.length > 0 ? tags : [category],
      status: targetStatus,
      isFeatured,
      is_featured: isFeatured,
      featured: isFeatured,
      seoTitle: seoTitle.trim() || undefined,
      seo_title: seoTitle.trim() || undefined,
      seoDescription: seoDescription.trim() || undefined,
      seo_description: seoDescription.trim() || undefined,
      publishedAt: publishedAt || (targetStatus === 'published' ? new Date().toISOString().split('T')[0] : undefined),
      published_at: publishedAt || (targetStatus === 'published' ? new Date().toISOString().split('T')[0] : undefined)
    };

    await onSave(payload, targetStatus);
  };

  return (
    <div
      id="framework-editor-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="framework-editor-modal"
        className="relative w-full max-w-6xl bg-[#0B1528] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#07111F]/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-blue-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white font-display">
                  {isEditing ? `Edit Framework: ${title || 'Untitled'}` : 'Create New Proprietary Framework'}
                </h2>
                {isEditing && (
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      initialFramework?.status === 'published'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {initialFramework?.status || 'Draft'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Codify Digital Muid’s strategic models, mental architecture, and multi-stage execution systems.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowLivePreview(!showLivePreview)}
              className={`hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                showLivePreview
                  ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              {showLivePreview ? 'Hide Preview' : 'Show Preview'}
            </button>

            <button
              id="framework-modal-close-btn"
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex items-center gap-1 px-6 border-b border-white/5 bg-[#081324] overflow-x-auto">
          {[
            { id: 'content', label: '1. Identity & Core', icon: FileText },
            { id: 'stages', label: `2. Execution Stages (${stages.length})`, icon: Workflow },
            { id: 'audience', label: '3. Strategic Audience', icon: Target },
            { id: 'relations', label: '4. Cross-Linking', icon: Lightbulb },
            { id: 'seo', label: '5. SEO & Social', icon: Globe }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-all cursor-pointer ${
                  isActive
                    ? 'border-indigo-400 text-indigo-300 bg-indigo-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-white/10'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Modal Body with optional Side Preview */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 bg-[#07111F]">
          {/* Main Form Fields (Full width if preview hidden, 7 cols if preview shown) */}
          <div className={`${showLivePreview ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-6`}>
            {/* TAB 1: IDENTITY & CORE CONTENT */}
            {activeTab === 'content' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                {/* Title & Slug */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center justify-between">
                    <span>Framework Title <span className="text-rose-400">*</span></span>
                    <span className="text-[11px] text-slate-500">{title.length}/100 chars</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={handleTitleChange}
                    placeholder="e.g. The Digital Growth Stack™"
                    className="w-full bg-[#0B1728] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-display font-bold"
                  />
                </div>

                {/* Slug Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                      URL Slug <span className="text-rose-400">*</span>
                    </label>
                    <span className="text-[11px] text-indigo-400 font-mono">
                      /frameworks/{slug || 'your-slug'}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={slug}
                    onChange={handleSlugChange}
                    placeholder="e.g. digital-growth-stack"
                    className="w-full bg-[#0B1728] border border-white/10 rounded-xl px-4 py-2 text-indigo-300 font-mono text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Subtitle / Tagline */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Subtitle / Architecture Tagline
                  </label>
                  <input
                    type="text"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder="e.g. The 6-Stage Integrated Operating Architecture for Modern Growth"
                    className="w-full bg-[#0B1728] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Category & Author */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Category
                    </label>
                    <div className="relative">
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full bg-[#0B1728] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 appearance-none cursor-pointer"
                      >
                        {categoryOptions.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Author / Architect
                    </label>
                    <input
                      type="text"
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                      placeholder="Digital Muid"
                      className="w-full bg-[#0B1728] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Overview / Introduction */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Executive Overview / Introduction
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide a high-level summary of what this framework accomplishes, why it was developed, and its fundamental thesis."
                    className="w-full bg-[#0B1728] border border-white/10 rounded-xl p-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 leading-relaxed resize-y"
                  />
                </div>

                {/* Cover Image & Upload */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center justify-between">
                    <span>Cover Image Asset</span>
                    <span className="text-[11px] text-slate-500">Unsplash URL or Storage Upload</span>
                  </label>
                  
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={coverImage}
                      onChange={(e) => setCoverImage(e.target.value)}
                      placeholder="https://images.unsplash.com/photo-..."
                      className="flex-1 bg-[#0B1728] border border-white/10 rounded-xl px-4 py-2 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500 font-mono"
                    />
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={isUploadingImage}
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isUploadingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      Upload
                    </button>
                  </div>

                  {imageNotice && (
                    <p className={`text-xs ${imageNotice.type === 'success' ? 'text-emerald-400' : 'text-rose-400'} flex items-center gap-1`}>
                      {imageNotice.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                      {imageNotice.msg}
                    </p>
                  )}
                </div>

                {/* Problem vs Solution Statements */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5 p-4 rounded-xl bg-rose-500/5 border border-rose-500/20">
                    <label className="text-xs font-semibold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      The Problem / Market Dilemma
                    </label>
                    <textarea
                      rows={4}
                      value={problemStatement}
                      onChange={(e) => setProblemStatement(e.target.value)}
                      placeholder="What structural failure, inefficiency, or dilemma does the industry face before implementing this model?"
                      className="w-full bg-[#081220] border border-white/10 rounded-lg p-2.5 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-rose-500 leading-relaxed"
                    />
                  </div>

                  <div className="space-y-1.5 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                    <label className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      The Strategic Solution
                    </label>
                    <textarea
                      rows={4}
                      value={solutionStatement}
                      onChange={(e) => setSolutionStatement(e.target.value)}
                      placeholder="How does this proprietary framework definitively resolve the problem and unlock non-linear leverage?"
                      className="w-full bg-[#081220] border border-white/10 rounded-lg p-2.5 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500 leading-relaxed"
                    />
                  </div>
                </div>

                {/* Tags & Featured */}
                <div className="pt-2 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Tags & Topics
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddTag();
                          }
                        }}
                        placeholder="Type tag & press Enter"
                        className="flex-1 bg-[#0B1728] border border-white/10 rounded-xl px-3 py-1.5 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={handleAddTag}
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-medium cursor-pointer"
                      >
                        Add
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {tags.map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
                        >
                          #{t}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(t)}
                            className="hover:text-rose-400 transition-colors ml-0.5 cursor-pointer"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <label className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors">
                      <input
                        type="checkbox"
                        checked={isFeatured}
                        onChange={(e) => setIsFeatured(e.target.checked)}
                        className="w-4 h-4 text-indigo-600 rounded bg-[#0B1728] border-white/20 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                      />
                      <div>
                        <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                          Feature on Frameworks Hub & Homepage
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Highlights this model prominently in hero displays.
                        </p>
                      </div>
                    </label>

                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <label className="text-xs text-slate-300 whitespace-nowrap">Publish Date:</label>
                      <input
                        type="date"
                        value={publishedAt}
                        onChange={(e) => setPublishedAt(e.target.value)}
                        className="bg-[#0B1728] border border-white/10 rounded-lg px-2.5 py-1 text-white text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: DYNAMIC EXECUTION STAGES */}
            {activeTab === 'stages' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2 font-display">
                      <Workflow className="w-4 h-4 text-indigo-400" />
                      Framework Progression Stages
                    </h3>
                    <p className="text-xs text-slate-400">
                      Define the sequential steps, core directives, and expected outcomes of this framework.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddStage}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Stage
                  </button>
                </div>

                <div className="space-y-4">
                  {stages.map((stage, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-[#091527] border border-white/10 hover:border-indigo-500/30 transition-all space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 font-mono text-xs font-bold flex items-center justify-center">
                            {String(stage.step).padStart(2, '0')}
                          </span>
                          <input
                            type="text"
                            value={stage.title}
                            onChange={(e) => handleUpdateStage(idx, { title: e.target.value })}
                            placeholder="Stage Title (e.g. Strategy & Moat Alignment)"
                            className="bg-transparent border-b border-white/10 px-2 py-1 text-sm font-bold text-white focus:outline-none focus:border-indigo-400 font-display w-64 sm:w-80"
                          />
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveStage(idx, 'up')}
                            className="p-1 rounded bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === stages.length - 1}
                            onClick={() => handleMoveStage(idx, 'down')}
                            className="p-1 rounded bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                            title="Move Down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteStage(idx)}
                            className="p-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 ml-1 cursor-pointer"
                            title="Delete Stage"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Subtitle / Short Description */}
                      <input
                        type="text"
                        value={stage.shortDescription || ''}
                        onChange={(e) => handleUpdateStage(idx, { shortDescription: e.target.value })}
                        placeholder="Short summary / focus (e.g. Core Vector & Positioning)"
                        className="w-full bg-[#0B182B] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-indigo-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />

                      {/* Detailed Content */}
                      <textarea
                        rows={2}
                        value={stage.content || ''}
                        onChange={(e) => handleUpdateStage(idx, { content: e.target.value })}
                        placeholder="Detailed execution guidance, philosophy, or methodology for this stage."
                        className="w-full bg-[#0B182B] border border-white/10 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 leading-relaxed"
                      />

                      {/* Key Actions & Outcome */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                            Key Action Directives (One per line)
                          </label>
                          <textarea
                            rows={3}
                            value={Array.isArray(stage.keyActions) ? stage.keyActions.join('\n') : ''}
                            onChange={(e) =>
                              handleUpdateStage(idx, {
                                keyActions: e.target.value.split('\n').map((a) => a.trim()).filter(Boolean)
                              })
                            }
                            placeholder="ICP validation matrix&#10;Value proposition stress-testing&#10;Competitive moat audit"
                            className="w-full bg-[#081220] border border-white/10 rounded-lg p-2 text-xs text-slate-200 font-mono placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            Expected Stage Outcome
                          </label>
                          <textarea
                            rows={3}
                            value={stage.outcome || ''}
                            onChange={(e) => handleUpdateStage(idx, { outcome: e.target.value })}
                            placeholder="e.g. Eliminates wasted capital and focuses 100% of resources on proven demand vectors."
                            className="w-full bg-[#081220] border border-white/10 rounded-lg p-2 text-xs text-emerald-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2 flex justify-center">
                  <button
                    type="button"
                    onClick={handleAddStage}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-indigo-300 border border-white/10 text-xs font-semibold transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Add Another Stage ({stages.length + 1})
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: STRATEGIC AUDIENCE & DEPLOYMENT */}
            {activeTab === 'audience' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2 font-display">
                    <Target className="w-4 h-4 text-indigo-400" />
                    Target Audience & Deployment Timing
                  </h3>
                  <p className="text-xs text-slate-400">
                    Define who should deploy this model and at what specific organizational stage.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5 p-4 rounded-xl bg-[#091527] border border-white/10">
                    <label className="text-xs font-semibold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5" />
                      Who Is This Framework For?
                    </label>
                    <textarea
                      rows={3}
                      value={whoIsItFor}
                      onChange={(e) => setWhoIsItFor(e.target.value)}
                      placeholder="e.g. Founders, CMOs, and enterprise leaders seeking to scale revenue without exponentially growing headcount or relying solely on ad spend."
                      className="w-full bg-[#0B182B] border border-white/10 rounded-lg p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 leading-relaxed"
                    />
                  </div>

                  <div className="space-y-1.5 p-4 rounded-xl bg-[#091527] border border-white/10">
                    <label className="text-xs font-semibold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      When Should Organizations Deploy This Framework?
                    </label>
                    <textarea
                      rows={3}
                      value={whenToUse}
                      onChange={(e) => setWhenToUse(e.target.value)}
                      placeholder="e.g. Deploy when expanding into new product categories, experiencing plateaued digital ad returns, or unifying fragmented sales/marketing teams."
                      className="w-full bg-[#0B182B] border border-white/10 rounded-lg p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 leading-relaxed"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: CROSS-LINKING */}
            {activeTab === 'relations' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2 font-display">
                    <Lightbulb className="w-4 h-4 text-indigo-400" />
                    Cross-Linked Content Ecosystem
                  </h3>
                  <p className="text-xs text-slate-400">
                    Connect this framework with published essays, videos, and toolkits across the platform.
                  </p>
                </div>

                {/* Related Articles */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                    Related Articles ({relatedArticles.length} selected)
                  </label>
                  <div className="max-h-40 overflow-y-auto p-2 bg-[#091527] border border-white/10 rounded-xl space-y-1">
                    {availableArticles.length === 0 ? (
                      <p className="text-xs text-slate-500 p-2">No articles available.</p>
                    ) : (
                      availableArticles.map((art) => {
                        const isSelected = relatedArticles.includes(art.id) || relatedArticles.includes(art.slug);
                        return (
                          <button
                            key={art.id}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setRelatedArticles(relatedArticles.filter((id) => id !== art.id && id !== art.slug));
                              } else {
                                setRelatedArticles([...relatedArticles, art.id]);
                              }
                            }}
                            className={`w-full text-left px-3 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                          >
                            <span className="truncate">{art.title}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0 ml-2" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Related Videos */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Video className="w-3.5 h-3.5 text-rose-400" />
                    Related Videos ({relatedVideos.length} selected)
                  </label>
                  <div className="max-h-40 overflow-y-auto p-2 bg-[#091527] border border-white/10 rounded-xl space-y-1">
                    {availableVideos.length === 0 ? (
                      <p className="text-xs text-slate-500 p-2">No videos available.</p>
                    ) : (
                      availableVideos.map((vid) => {
                        const isSelected = relatedVideos.includes(vid.id) || relatedVideos.includes(vid.slug);
                        return (
                          <button
                            key={vid.id}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setRelatedVideos(relatedVideos.filter((id) => id !== vid.id && id !== vid.slug));
                              } else {
                                setRelatedVideos([...relatedVideos, vid.id]);
                              }
                            }}
                            className={`w-full text-left px-3 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                          >
                            <span className="truncate">{vid.title}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0 ml-2" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Related Resources */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    Related Resources / SOPs ({relatedResources.length} selected)
                  </label>
                  <div className="max-h-40 overflow-y-auto p-2 bg-[#091527] border border-white/10 rounded-xl space-y-1">
                    {availableResources.length === 0 ? (
                      <p className="text-xs text-slate-500 p-2">No resources available.</p>
                    ) : (
                      availableResources.map((res) => {
                        const isSelected = relatedResources.includes(res.id) || relatedResources.includes(res.slug);
                        return (
                          <button
                            key={res.id}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setRelatedResources(relatedResources.filter((id) => id !== res.id && id !== res.slug));
                              } else {
                                setRelatedResources([...relatedResources, res.id]);
                              }
                            }}
                            className={`w-full text-left px-3 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                          >
                            <span className="truncate">{res.title}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0 ml-2" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: SEO & METADATA */}
            {activeTab === 'seo' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2 font-display">
                    <Globe className="w-4 h-4 text-indigo-400" />
                    SEO & Social Metadata
                  </h3>
                  <p className="text-xs text-slate-400">
                    Configure search engine title, description, and structured data snippet.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center justify-between">
                      <span>Custom SEO Title</span>
                      <span className="text-[11px] text-slate-500">{(seoTitle || title).length}/60 recommended</span>
                    </label>
                    <input
                      type="text"
                      value={seoTitle}
                      onChange={(e) => setSeoTitle(e.target.value)}
                      placeholder={title ? `${title} | Digital Muid Frameworks` : 'Strategic Framework Title | Digital Muid'}
                      className="w-full bg-[#0B1728] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center justify-between">
                      <span>Custom SEO Meta Description</span>
                      <span className="text-[11px] text-slate-500">{(seoDescription || description).length}/160 recommended</span>
                    </label>
                    <textarea
                      rows={3}
                      value={seoDescription}
                      onChange={(e) => setSeoDescription(e.target.value)}
                      placeholder={description || 'A comprehensive framework developed by Digital Muid to scale enterprise digital operations.'}
                      className="w-full bg-[#0B1728] border border-white/10 rounded-xl p-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 leading-relaxed"
                    />
                  </div>

                  {/* Google Search Preview */}
                  <div className="p-4 rounded-xl bg-[#091527] border border-white/10 space-y-1.5">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Google Search Result Preview
                    </span>
                    <div className="space-y-0.5">
                      <div className="text-xs text-[#202124] dark:text-[#bdc1c6] truncate">
                        https://digitalmuid.com › frameworks › {slug || 'framework-slug'}
                      </div>
                      <div className="text-sm font-medium text-[#1a0dab] dark:text-[#8ab4f8] hover:underline cursor-pointer truncate">
                        {seoTitle || title || 'Framework Title'} | Digital Muid
                      </div>
                      <div className="text-xs text-[#4d5156] dark:text-[#bdc1c6] line-clamp-2 leading-relaxed">
                        {seoDescription || description || 'Explore Digital Muid’s proprietary methodology, execution stages, and strategic blueprints.'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Live Preview Column */}
          {showLivePreview && (
            <div className="lg:col-span-5 hidden lg:block border-l border-white/10 pl-6 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" />
                  Live Card & Detail Preview
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {stages.length} Stages
                </span>
              </div>

              {/* Card Preview */}
              <div className="rounded-2xl bg-[#091527] border border-white/10 overflow-hidden shadow-lg p-5 space-y-4">
                {coverImage && (
                  <div className="relative h-36 rounded-xl overflow-hidden bg-slate-900 border border-white/5">
                    <img
                      src={coverImage}
                      alt={title || 'Framework'}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#091527] via-transparent to-transparent" />
                    <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#1877F2] text-white">
                      {category}
                    </span>
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                      Digital Muid Framework
                    </span>
                    {isFeatured && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300">
                        <Star className="w-2.5 h-2.5 fill-amber-300" /> Featured
                      </span>
                    )}
                  </div>
                  <h4 className="text-base font-bold text-white font-display">
                    {title || 'Framework Title'}
                  </h4>
                  {subtitle && (
                    <p className="text-xs text-indigo-200 font-medium mt-0.5">
                      {subtitle}
                    </p>
                  )}
                  {description && (
                    <p className="text-xs text-slate-400 line-clamp-2 mt-2 leading-relaxed">
                      {description}
                    </p>
                  )}
                </div>

                {/* Stage Progression Preview */}
                <div className="space-y-1.5 pt-2 border-t border-white/5">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Sequential Flow ({stages.length} Steps)
                  </span>
                  <div className="space-y-1">
                    {stages.slice(0, 4).map((s, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-1.5 rounded-lg bg-white/5 text-xs text-slate-300"
                      >
                        <span className="font-mono text-[10px] text-indigo-400 font-bold">
                          {String(s.step).padStart(2, '0')}
                        </span>
                        <span className="truncate font-medium">{s.title || `Stage ${idx + 1}`}</span>
                      </div>
                    ))}
                    {stages.length > 4 && (
                      <span className="text-[10px] text-slate-500 pl-1">
                        + {stages.length - 4} more stages
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500 border-t border-white/5">
                  <span>Author: {author || 'Digital Muid'}</span>
                  <span>{tags.length} Tags</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Action Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-white/10 bg-[#07111F]">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            Supabase Table: <span className="font-mono text-slate-300">public.frameworks</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              id="framework-modal-cancel-btn"
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>

            {/* Save as Draft */}
            <button
              id="framework-save-draft-btn"
              type="button"
              disabled={isSaving}
              onClick={() => handleSaveAttempt('draft')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white border border-white/10 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
              Save Draft
            </button>

            {/* Publish Live */}
            <button
              id="framework-publish-btn"
              type="button"
              disabled={isSaving}
              onClick={() => handleSaveAttempt('published')}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {isAlreadyPublished ? 'Update Published Framework' : 'Publish Live to Website'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
