import React, { useState, useEffect } from 'react';
import {
  Video as VideoIcon,
  X,
  Check,
  Loader2,
  Image as ImageIcon,
  Star,
  Clock,
  Globe,
  ChevronDown,
  ChevronUp,
  Play,
  ExternalLink,
  Tag,
  Eye,
  Plus,
  Trash2,
  Calendar,
  Sparkles
} from 'lucide-react';
import { Video } from '../types';
import { slugify } from '../services/articleService';
import { extractYouTubeVideoId, getYouTubeThumbnail, getYouTubeEmbedUrl } from '../services/videoService';

interface VideoEditorModalProps {
  isOpen: boolean;
  initialVideo: Video | null;
  onClose: () => void;
  onSave: (payload: Partial<Video>, targetStatus: 'draft' | 'published') => Promise<void>;
  onUnpublish?: (id: string) => Promise<void>;
  isSaving: boolean;
}

const CATEGORY_PRESETS = [
  'Brand Strategy',
  'AI & Automation',
  'Executive Consulting',
  'Performance Marketing',
  'Technology',
  'Strategic Execution',
  'Digital Transformation'
];

export const VideoEditorModal: React.FC<VideoEditorModalProps> = ({
  isOpen,
  initialVideo,
  onClose,
  onSave,
  onUnpublish,
  isSaving
}) => {
  const isEditing = Boolean(initialVideo && initialVideo.id);
  const isAlreadyPublished = initialVideo?.status === 'published';

  // Form State
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [category, setCategory] = useState('Brand Strategy');
  const [youtubeUrlInput, setYoutubeUrlInput] = useState('');
  const [youtubeVideoId, setYoutubeVideoId] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [duration, setDuration] = useState('12:00');
  const [viewsCount, setViewsCount] = useState('1.5k views');
  const [description, setDescription] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [publishedAt, setPublishedAt] = useState('');

  // SEO State
  const [isSeoOpen, setIsSeoOpen] = useState(false);
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');

  // UI / Preview
  const [showLiveEmbedPreview, setShowLiveEmbedPreview] = useState(true);
  const [isDirty, setIsDirty] = useState(false);

  // Initialize or reset form when initialVideo changes
  useEffect(() => {
    if (isOpen) {
      if (initialVideo) {
        setTitle(initialVideo.title || '');
        setSlug(initialVideo.slug || '');
        setIsSlugManuallyEdited(true);
        setCategory(initialVideo.category || 'Brand Strategy');
        
        const vidId = initialVideo.youtubeVideoId || extractYouTubeVideoId(initialVideo.embedUrl || '') || '';
        setYoutubeVideoId(vidId);
        setYoutubeUrlInput(vidId ? `https://www.youtube.com/watch?v=${vidId}` : initialVideo.embedUrl || '');
        
        setThumbnailUrl(initialVideo.thumbnailUrl || initialVideo.thumbnail || (vidId ? getYouTubeThumbnail(vidId) : ''));
        setDuration(initialVideo.duration || '12:00');
        setViewsCount(initialVideo.viewsCount || '1.5k views');
        setDescription(initialVideo.description || '');
        setIsFeatured(Boolean(initialVideo.isFeatured ?? initialVideo.featured));
        setTags(initialVideo.tags && Array.isArray(initialVideo.tags) ? initialVideo.tags : []);
        setPublishedAt(initialVideo.publishedAt || (initialVideo.status === 'published' ? new Date().toISOString().split('T')[0] : ''));
        setSeoTitle(initialVideo.seoTitle || '');
        setSeoDescription(initialVideo.seoDescription || '');
        setIsSeoOpen(Boolean(initialVideo.seoTitle || initialVideo.seoDescription));
      } else {
        // Fresh draft
        setTitle('');
        setSlug('');
        setIsSlugManuallyEdited(false);
        setCategory('Brand Strategy');
        setYoutubeUrlInput('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
        setYoutubeVideoId('dQw4w9WgXcQ');
        setThumbnailUrl('https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg');
        setDuration('12:00');
        setViewsCount('1.2k views');
        setDescription('');
        setIsFeatured(false);
        setTags(['DigitalGrowth', 'Strategy', 'Business']);
        setPublishedAt(new Date().toISOString().split('T')[0]);
        setSeoTitle('');
        setSeoDescription('');
        setIsSeoOpen(false);
      }
      setIsDirty(false);
    }
  }, [isOpen, initialVideo]);

  if (!isOpen) return null;

  // Handle Title Change & Slug Auto-Generation
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

  // Handle YouTube URL Input
  const handleYouTubeUrlChange = (val: string) => {
    setYoutubeUrlInput(val);
    setIsDirty(true);
    const extractedId = extractYouTubeVideoId(val);
    if (extractedId) {
      setYoutubeVideoId(extractedId);
      // Auto populate thumbnail if empty or previously set to youtube auto
      if (!thumbnailUrl || thumbnailUrl.includes('youtube.com/vi/')) {
        setThumbnailUrl(getYouTubeThumbnail(extractedId));
      }
    }
  };

  // Tags management
  const handleAddTag = () => {
    const clean = tagInput.trim().replace(/^#/, '');
    if (clean && !tags.includes(clean)) {
      setTags([...tags, clean]);
      setTagInput('');
      setIsDirty(true);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
    setIsDirty(true);
  };

  // Submit Handler
  const handleFormSubmit = async (targetStatus: 'draft' | 'published') => {
    if (!title.trim()) {
      alert('Video title is required.');
      return;
    }

    const finalSlug = slug.trim() || slugify(title);
    const finalVideoId = youtubeVideoId || extractYouTubeVideoId(youtubeUrlInput) || '';
    const finalEmbedUrl = finalVideoId ? getYouTubeEmbedUrl(finalVideoId) : '';
    const finalThumb = thumbnailUrl || (finalVideoId ? getYouTubeThumbnail(finalVideoId) : '');
    const finalYtUrl = youtubeUrlInput.trim() || (finalVideoId ? `https://www.youtube.com/watch?v=${finalVideoId}` : '');

    const payload: Partial<Video> = {
      title: title.trim(),
      slug: finalSlug,
      category,
      youtubeUrl: finalYtUrl,
      videoUrl: finalYtUrl,
      youtubeVideoId: finalVideoId,
      embedUrl: finalEmbedUrl,
      thumbnailUrl: finalThumb,
      thumbnail: finalThumb,
      duration: duration.trim() || '12:00',
      viewsCount: viewsCount.trim() || '1.2k views',
      description: description.trim(),
      tags: tags,
      isFeatured: isFeatured,
      featured: isFeatured,
      status: targetStatus,
      publishedAt: targetStatus === 'published' ? (publishedAt ? new Date(publishedAt).toISOString() : new Date().toISOString()) : undefined,
      seoTitle: seoTitle.trim() || title.trim(),
      seoDescription: seoDescription.trim() || description.trim().slice(0, 160)
    };

    await onSave(payload, targetStatus);
  };

  const calculatedEmbed = youtubeVideoId ? getYouTubeEmbedUrl(youtubeVideoId) : '';

  return (
    <div id="video-editor-modal" className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-5xl max-h-[92vh] flex flex-col rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between gap-4 bg-slate-900/90 sticky top-0 z-10 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center">
              <VideoIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-display font-bold text-white">
                  {isEditing ? 'Edit Video Breakdown' : 'Create New Video'}
                </h2>
                {isAlreadyPublished ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider border border-emerald-500/30">
                    Live Published
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase tracking-wider border border-amber-500/30">
                    Draft
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Manage YouTube video stream, custom metadata, and public watch page.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-slate-200">
          {/* Main Details Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Core Metadata */}
            <div className="lg:col-span-2 space-y-4">
              {/* Title */}
              <div>
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Video Title *</span>
                  <span className="text-[11px] text-slate-500 font-mono">{title.length}/100</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Strategic Growth Architecture: How to Scale Without Chaos"
                  value={title}
                  onChange={handleTitleChange}
                  className="w-full mt-1.5 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Slug */}
              <div>
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>URL Slug *</span>
                  <span className="text-[11px] text-slate-500 font-mono">/watch/{slug || '...'}</span>
                </label>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-500">
                    /watch/
                  </span>
                  <input
                    type="text"
                    required
                    value={slug}
                    onChange={handleSlugChange}
                    placeholder="strategic-growth-architecture"
                    className="flex-1 px-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSlug(slugify(title));
                      setIsSlugManuallyEdited(false);
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                    title="Regenerate slug from title"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* YouTube Link / Video ID */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>YouTube URL or Video ID *</span>
                  {youtubeVideoId && (
                    <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                      <Check className="w-3 h-3" /> ID: {youtubeVideoId}
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  required
                  placeholder="https://www.youtube.com/watch?v=dQw4w9WgXcQ or dQw4w9WgXcQ"
                  value={youtubeUrlInput}
                  onChange={(e) => handleYouTubeUrlChange(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-purple-500"
                />
                <p className="text-[11px] text-slate-500 font-interface">
                  Paste standard YouTube watch URLs, short links (youtu.be), or direct 11-character video IDs.
                </p>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Description / Overview *</span>
                  <span className="text-[11px] text-slate-500 font-mono">{description.length} chars</span>
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Summarize the core takeaways, models, and strategies discussed in this video breakdown..."
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    setIsDirty(true);
                  }}
                  className="w-full mt-1.5 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs leading-relaxed focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300">Focus Tags / Keywords</label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Tag className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="Add tag and press Enter (e.g. AIStrategy)"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                      className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>

                {/* Tag Pills */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium"
                    >
                      #{t}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(t)}
                        className="text-slate-400 hover:text-rose-400 ml-1 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {tags.length === 0 && (
                    <span className="text-xs text-slate-500 italic">No tags added yet.</span>
                  )}
                </div>
              </div>
            </div>

            {/* Right 1 Col: Settings, Media, Preview */}
            <div className="space-y-4">
              {/* Category */}
              <div>
                <label className="text-xs font-semibold text-slate-300">Category *</label>
                <select
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    setIsDirty(true);
                  }}
                  className="w-full mt-1.5 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-purple-500 cursor-pointer"
                >
                  {CATEGORY_PRESETS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Duration & Views count */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300">Duration</label>
                  <input
                    type="text"
                    placeholder="12:45"
                    value={duration}
                    onChange={(e) => {
                      setDuration(e.target.value);
                      setIsDirty(true);
                    }}
                    className="w-full mt-1.5 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300">Views Display</label>
                  <input
                    type="text"
                    placeholder="2.4k views"
                    value={viewsCount}
                    onChange={(e) => {
                      setViewsCount(e.target.value);
                      setIsDirty(true);
                    }}
                    className="w-full mt-1.5 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Custom Thumbnail URL */}
              <div>
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Thumbnail Image URL</span>
                  {youtubeVideoId && (
                    <button
                      type="button"
                      onClick={() => setThumbnailUrl(getYouTubeThumbnail(youtubeVideoId))}
                      className="text-[11px] text-purple-400 hover:underline cursor-pointer"
                    >
                      Use YouTube HQ
                    </button>
                  )}
                </label>
                <input
                  type="url"
                  placeholder="https://img.youtube.com/vi/..."
                  value={thumbnailUrl}
                  onChange={(e) => {
                    setThumbnailUrl(e.target.value);
                    setIsDirty(true);
                  }}
                  className="w-full mt-1.5 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Featured toggle */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-amber-400" />
                    <span>Featured Video</span>
                  </span>
                  <p className="text-[11px] text-slate-400">Pin to top of public Watch Hub</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsFeatured(!isFeatured);
                    setIsDirty(true);
                  }}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                    isFeatured ? 'bg-purple-600' : 'bg-slate-800'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      isFeatured ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Video Embed Live Preview */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300">Playback Preview</span>
                  <button
                    type="button"
                    onClick={() => setShowLiveEmbedPreview(!showLiveEmbedPreview)}
                    className="text-purple-400 text-[11px] hover:underline"
                  >
                    {showLiveEmbedPreview ? 'Hide Player' : 'Show Player'}
                  </button>
                </div>

                {showLiveEmbedPreview && (
                  <div className="aspect-[16/9] w-full rounded-2xl overflow-hidden bg-black border border-slate-800 relative">
                    {calculatedEmbed ? (
                      <iframe
                        src={calculatedEmbed}
                        title="Video Preview"
                        className="w-full h-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 p-4 text-center">
                        <Play className="w-8 h-8 text-slate-600 mb-1" />
                        <p className="text-[11px]">Enter a valid YouTube URL or ID to load live playback.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SEO Accordion */}
          <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/60">
            <button
              type="button"
              onClick={() => setIsSeoOpen(!isSeoOpen)}
              className="w-full p-4 flex items-center justify-between text-xs font-semibold text-slate-300 hover:bg-slate-800/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-purple-400" />
                <span>Search Engine Optimization (SEO & JSON-LD VideoObject)</span>
              </div>
              {isSeoOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {isSeoOpen && (
              <div className="p-4 pt-0 space-y-4 border-t border-slate-800/60">
                <div className="grid grid-cols-1 gap-4 pt-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                      <span>Custom SEO Title</span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {(seoTitle || title).length}/60
                      </span>
                    </label>
                    <input
                      type="text"
                      placeholder={title || 'Custom meta title for Google search...'}
                      value={seoTitle}
                      onChange={(e) => {
                        setSeoTitle(e.target.value);
                        setIsDirty(true);
                      }}
                      className="w-full mt-1 px-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                      <span>Custom Meta Description</span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {(seoDescription || description).length}/160
                      </span>
                    </label>
                    <textarea
                      rows={2}
                      placeholder={description || 'Meta snippet for search engines and social cards...'}
                      value={seoDescription}
                      onChange={(e) => {
                        setSeoDescription(e.target.value);
                        setIsDirty(true);
                      }}
                      className="w-full mt-1 px-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 sm:p-6 border-t border-slate-800 bg-slate-900/90 flex flex-col sm:flex-row items-center justify-between gap-3 sticky bottom-0 z-10 backdrop-blur-md">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {isEditing && isAlreadyPublished && onUnpublish && (
              <button
                type="button"
                disabled={isSaving}
                onClick={async () => {
                  if (initialVideo?.id) {
                    await onUnpublish(initialVideo.id);
                    onClose();
                  }
                }}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold transition-colors cursor-pointer"
              >
                Unpublish to Draft
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleFormSubmit('draft')}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              <span>Save as Draft</span>
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleFormSubmit('published')}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg shadow-purple-600/30 transition-all disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>{isAlreadyPublished ? 'Update Published' : 'Publish Live'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
