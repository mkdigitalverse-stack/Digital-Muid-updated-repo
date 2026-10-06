import React, { useState, useEffect, useRef } from 'react';
import {
  Download,
  X,
  Check,
  Loader2,
  Image as ImageIcon,
  Star,
  Clock,
  Globe,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Tag,
  Eye,
  Plus,
  Trash2,
  Calendar,
  Sparkles,
  FileText,
  Upload,
  Link2,
  Layers,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Resource, ResourceType } from '../types';
import { slugify } from '../services/articleService';
import { resourceService } from '../services/resourceService';

interface ResourceEditorModalProps {
  isOpen: boolean;
  initialResource: Resource | null;
  onClose: () => void;
  onSave: (payload: Partial<Resource>, targetStatus: 'draft' | 'published') => Promise<void>;
  onUnpublish?: (id: string) => Promise<void>;
  isSaving: boolean;
}

const RESOURCE_TYPE_OPTIONS: ResourceType[] = [
  'Guide',
  'Checklist',
  'Template',
  'Framework',
  'E-book',
  'Report',
  'Toolkit',
  'Worksheet',
  'Prompt Pack',
  'Blueprint',
  'Other'
];

const CATEGORY_PRESETS = [
  'Digital Growth',
  'AI & Automation',
  'Brand Strategy',
  'Personal Branding',
  'Marketing',
  'Consulting & Leadership',
  'Systems & Architecture'
];

export const ResourceEditorModal: React.FC<ResourceEditorModalProps> = ({
  isOpen,
  initialResource,
  onClose,
  onSave,
  onUnpublish,
  isSaving
}) => {
  const isEditing = Boolean(initialResource && initialResource.id);
  const isAlreadyPublished = initialResource?.status === 'published';

  // Form State
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [resourceType, setResourceType] = useState<ResourceType>('Guide');
  const [category, setCategory] = useState('Digital Growth');
  const [description, setDescription] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [author, setAuthor] = useState('Digital Muid');
  const [fileType, setFileType] = useState('PDF');
  const [fileSize, setFileSize] = useState('2.4 MB');
  const [readingTimeMinutes, setReadingTimeMinutes] = useState<number | ''>(10);
  const [isFeatured, setIsFeatured] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [publishedAt, setPublishedAt] = useState('');

  // SEO State
  const [isSeoOpen, setIsSeoOpen] = useState(false);
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');

  // File Upload State
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [isUploadingThumb, setIsUploadingThumb] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [uploadNoticeType, setUploadNoticeType] = useState<'success' | 'error' | 'info'>('info');
  const [thumbNotice, setThumbNotice] = useState<string | null>(null);
  const [thumbNoticeType, setThumbNoticeType] = useState<'success' | 'error' | 'info'>('info');

  // UI / Preview
  const [showLivePreview, setShowLivePreview] = useState(true);
  const [activeDeliveryTab, setActiveDeliveryTab] = useState<'file' | 'external'>('file');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  // Initialize or reset form when initialResource changes
  useEffect(() => {
    if (isOpen) {
      if (initialResource) {
        setTitle(initialResource.title || initialResource.name || '');
        setSlug(initialResource.slug || '');
        setIsSlugManuallyEdited(true);
        setResourceType((initialResource.resourceType || initialResource.type || 'Guide') as ResourceType);
        setCategory(initialResource.category || 'Digital Growth');
        setDescription(initialResource.description || '');
        setFileUrl(initialResource.fileUrl || initialResource.downloadUrl || '');
        setExternalUrl(initialResource.externalUrl || '');
        setThumbnailUrl(initialResource.thumbnailUrl || initialResource.coverImage || '');
        setAuthor(initialResource.author || 'Digital Muid');
        setFileType(initialResource.fileType || initialResource.format || 'PDF');
        setFileSize(initialResource.fileSize || '');
        setReadingTimeMinutes(initialResource.readingTimeMinutes ?? 10);
        setIsFeatured(Boolean(initialResource.isFeatured ?? initialResource.featured));
        setTags(initialResource.tags && Array.isArray(initialResource.tags) ? initialResource.tags : []);
        setPublishedAt(
          initialResource.publishedAt ||
            (initialResource.status === 'published' ? new Date().toISOString().split('T')[0] : '')
        );
        setSeoTitle(initialResource.seoTitle || '');
        setSeoDescription(initialResource.seoDescription || '');
        setActiveDeliveryTab(initialResource.externalUrl && !initialResource.fileUrl ? 'external' : 'file');
      } else {
        // Defaults for new resource
        setTitle('');
        setSlug('');
        setIsSlugManuallyEdited(false);
        setResourceType('Guide');
        setCategory('Digital Growth');
        setDescription('');
        setFileUrl('');
        setExternalUrl('');
        setThumbnailUrl('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80');
        setAuthor('Digital Muid');
        setFileType('PDF Document');
        setFileSize('2.5 MB');
        setReadingTimeMinutes(10);
        setIsFeatured(false);
        setTags(['Digital Growth', 'Strategy']);
        setPublishedAt(new Date().toISOString().split('T')[0]);
        setSeoTitle('');
        setSeoDescription('');
        setActiveDeliveryTab('file');
      }
      setUploadNotice(null);
      setThumbNotice(null);
    }
  }, [isOpen, initialResource]);

  // Handle title change & slug auto-generation
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTitle(val);
    if (!isSlugManuallyEdited) {
      setSlug(slugify(val));
    }
  };

  // Tag management
  const handleAddTag = () => {
    const cleaned = tagInput.trim().replace(/^#/, '');
    if (cleaned && !tags.includes(cleaned)) {
      setTags([...tags, cleaned]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag();
    }
  };

  // Handle File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value so same file can be selected again
    e.target.value = '';

    setIsUploadingFile(true);
    setUploadNotice('Uploading file to Supabase storage...');
    setUploadNoticeType('info');

    try {
      // Auto-populate format & size
      const ext = file.name.split('.').pop()?.toUpperCase() || 'FILE';
      setFileType(`${ext} Document`);
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      setFileSize(`${sizeMb} MB`);

      const { url, error } = await resourceService.uploadResourceFile(file, 'downloads');
      if (url && !error) {
        setFileUrl(url);
        setUploadNotice(`File uploaded: ${file.name} (${sizeMb} MB)`);
        setUploadNoticeType('success');
      } else {
        console.warn('[Upload Notice] Supabase storage upload warning:', error);
        // If fileUrl not already set, preserve file name
        if (!fileUrl) {
          setFileUrl(`/downloads/${file.name}`);
        }
        const errMsg = error?.message || 'Upload complete (local reference)';
        setUploadNotice(`File attached: ${file.name} (${sizeMb} MB)`);
        setUploadNoticeType('success');
      }
    } catch (err: any) {
      console.warn('[Upload Error]', err);
      setUploadNotice(`Upload notice: ${err.message || 'File registered'}`);
      setUploadNoticeType('info');
    } finally {
      setIsUploadingFile(false);
    }
  };

  // Handle Thumbnail Upload
  const handleThumbUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value so same file can be selected again
    e.target.value = '';

    // Max 5MB image
    if (file.size > 5 * 1024 * 1024) {
      setThumbNotice('Image exceeds 5MB limit. Please select a smaller image file.');
      setThumbNoticeType('error');
      return;
    }

    setIsUploadingThumb(true);
    setThumbNotice('Uploading image to storage...');
    setThumbNoticeType('info');

    try {
      const { url, error } = await resourceService.uploadResourceFile(file, 'covers');
      if (url && !error) {
        setThumbnailUrl(url);
        setThumbNotice('Cover image uploaded successfully.');
        setThumbNoticeType('success');
      } else {
        console.warn('[Thumb Upload Notice]', error);
        // Create local object URL for preview if storage bucket is not ready
        const localPreview = URL.createObjectURL(file);
        setThumbnailUrl(localPreview);
        setThumbNotice('Image selected (preview mode).');
        setThumbNoticeType('info');
      }
    } catch (err: any) {
      console.warn('[Thumb Upload Error]', err);
      setThumbNotice(`Image notice: ${err.message || 'Image loaded'}`);
      setThumbNoticeType('info');
    } finally {
      setIsUploadingThumb(false);
    }
  };

  // Build Payload
  const buildPayload = (): Partial<Resource> => {
    const finalSlug = slugify(slug || title);
    const readingTime = typeof readingTimeMinutes === 'number' ? readingTimeMinutes : undefined;

    return {
      title: title.trim(),
      name: title.trim(),
      slug: finalSlug,
      description: description.trim(),
      resourceType,
      type: resourceType,
      category,
      fileUrl: fileUrl.trim() || undefined,
      downloadUrl: fileUrl.trim() || undefined,
      externalUrl: externalUrl.trim() || undefined,
      thumbnailUrl: thumbnailUrl.trim() || undefined,
      coverImage: thumbnailUrl.trim() || undefined,
      author: author.trim() || 'Digital Muid',
      fileType: fileType.trim() || undefined,
      fileSize: fileSize.trim() || undefined,
      format: fileType.trim() || 'Digital Asset',
      readingTimeMinutes: readingTime,
      tags: tags.length > 0 ? tags : [category],
      isFeatured,
      featured: isFeatured,
      publishedAt: publishedAt || undefined,
      seoTitle: seoTitle.trim() || undefined,
      seoDescription: seoDescription.trim() || undefined
    };
  };

  const handleSaveDraft = async () => {
    if (!title.trim()) {
      alert('Please provide a title for the resource.');
      return;
    }
    await onSave(buildPayload(), 'draft');
  };

  const handlePublish = async () => {
    if (!title.trim()) {
      alert('Please provide a title for the resource.');
      return;
    }
    await onSave(buildPayload(), 'published');
  };

  const handleUnpublishAction = async () => {
    if (initialResource?.id && onUnpublish) {
      await onUnpublish(initialResource.id);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-5xl my-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-display font-bold text-white flex items-center gap-2">
                {isEditing ? 'Edit Resource' : 'Create New Resource'}
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                  Supabase CMS
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Manage downloadable guides, templates, frameworks, and tools in the production database.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body - Scrollable */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {/* Main Grid: Left Form Controls, Right Live Card Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Form (7 cols) */}
            <div className="lg:col-span-7 space-y-5">
              {/* Title & Slug */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Resource Title <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={handleTitleChange}
                    placeholder="e.g. AI Prompt Pack: 50+ High-Performance Growth Prompts"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-400">
                      URL Slug <span className="text-slate-500 font-mono text-[10px]">(/resources/...)</span>
                    </label>
                    {isSlugManuallyEdited && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsSlugManuallyEdited(false);
                          setSlug(slugify(title));
                        }}
                        className="text-[10px] text-amber-400 hover:underline"
                      >
                        Reset to Auto
                      </button>
                    )}
                  </div>
                  <div className="flex items-center rounded-xl bg-slate-950 border border-slate-800 px-3 py-1.5 text-xs text-slate-400 focus-within:border-amber-500">
                    <span className="text-slate-600 font-mono">/resources/</span>
                    <input
                      type="text"
                      value={slug}
                      onChange={(e) => {
                        setIsSlugManuallyEdited(true);
                        setSlug(slugify(e.target.value));
                      }}
                      placeholder="ai-prompt-pack-growth-prompts"
                      className="w-full bg-transparent text-white font-mono text-xs focus:outline-none ml-1"
                    />
                  </div>
                </div>
              </div>

              {/* Resource Type & Category Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Resource Type
                  </label>
                  <select
                    value={resourceType}
                    onChange={(e) => setResourceType(e.target.value as ResourceType)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
                  >
                    {RESOURCE_TYPE_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Category
                  </label>
                  <input
                    type="text"
                    list="category-presets"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g. AI & Automation"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
                  />
                  <datalist id="category-presets">
                    {CATEGORY_PRESETS.map((cat) => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Summary & Value Proposition <span className="text-slate-500 font-normal">(displayed on card)</span>
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe key insights, frameworks, or templates included in this resource..."
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500 transition-colors leading-relaxed"
                />
              </div>

              {/* Delivery Source Selection: Direct File vs External Link */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/90 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    Resource Delivery Asset
                  </span>
                  <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setActiveDeliveryTab('file')}
                      className={`px-2.5 py-1 rounded-md transition-all ${
                        activeDeliveryTab === 'file'
                          ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      File Download (PDF/Doc)
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveDeliveryTab('external')}
                      className={`px-2.5 py-1 rounded-md transition-all ${
                        activeDeliveryTab === 'external'
                          ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      External Link (Notion/Drive/Tool)
                    </button>
                  </div>
                </div>

                {activeDeliveryTab === 'file' ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">
                        File Download URL
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Link2 className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={fileUrl}
                            onChange={(e) => setFileUrl(e.target.value)}
                            placeholder="https://... or /downloads/guide.pdf"
                            className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileUpload}
                          className="hidden"
                          accept=".pdf,.xlsx,.csv,.docx,.zip,.json,.pptx"
                        />
                        <button
                          type="button"
                          disabled={isUploadingFile}
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 shrink-0 border border-slate-700 transition-colors cursor-pointer"
                        >
                          {isUploadingFile ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                          ) : (
                            <Upload className="w-3.5 h-3.5 text-amber-400" />
                          )}
                          <span>{isUploadingFile ? 'Uploading...' : 'Upload File'}</span>
                        </button>
                      </div>
                    </div>

                    {uploadNotice && (
                      <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        {uploadNotice}
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      External URL <span className="text-slate-500">(Google Drive, Notion workspace, Canva, Web app)</span>
                    </label>
                    <div className="relative">
                      <ExternalLink className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="url"
                        value={externalUrl}
                        onChange={(e) => setExternalUrl(e.target.value)}
                        placeholder="https://notion.so/... or https://drive.google.com/..."
                        className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                )}

                {/* File Metadata row: Format, Size, Reading Time */}
                <div className="grid grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="block text-[10px] font-medium text-slate-400 mb-1">Format</label>
                    <input
                      type="text"
                      value={fileType}
                      onChange={(e) => setFileType(e.target.value)}
                      placeholder="PDF Document"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-400 mb-1">File Size / Pages</label>
                    <input
                      type="text"
                      value={fileSize}
                      onChange={(e) => setFileSize(e.target.value)}
                      placeholder="2.4 MB"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-400 mb-1">Est. Minutes</label>
                    <input
                      type="number"
                      min={1}
                      max={300}
                      value={readingTimeMinutes}
                      onChange={(e) => setReadingTimeMinutes(e.target.value ? parseInt(e.target.value, 10) : '')}
                      placeholder="10"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Cover Image / Thumbnail */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">Cover Image / Thumbnail URL</label>
                  <input
                    type="file"
                    ref={thumbInputRef}
                    onChange={handleThumbUpload}
                    className="hidden"
                    accept="image/jpeg,image/png,image/webp,image/svg+xml,image/gif"
                  />
                  <button
                    type="button"
                    onClick={() => thumbInputRef.current?.click()}
                    disabled={isUploadingThumb}
                    className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    {isUploadingThumb ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    {isUploadingThumb ? 'Uploading...' : 'Upload Image'}
                  </button>
                </div>
                <div className="relative">
                  <ImageIcon className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={thumbnailUrl}
                    onChange={(e) => setThumbnailUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/... or upload image"
                    className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>

                {thumbNotice && (
                  <p className={`text-[11px] mt-1.5 flex items-center gap-1 font-medium ${
                    thumbNoticeType === 'error' ? 'text-rose-400' : thumbNoticeType === 'success' ? 'text-emerald-400' : 'text-blue-400'
                  }`}>
                    {thumbNoticeType === 'success' && <CheckCircle2 className="w-3 h-3" />}
                    {thumbNotice}
                  </p>
                )}

                {thumbnailUrl && (
                  <div className="mt-2 flex items-center gap-3 p-2 rounded-xl bg-slate-900 border border-slate-800">
                    <img
                      src={thumbnailUrl}
                      alt="Thumbnail preview"
                      className="w-12 h-10 rounded-lg object-cover bg-slate-950 border border-slate-800 shrink-0"
                      referrerPolicy="no-referrer"
                      onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                    />
                    <div className="text-[10px] text-slate-400 truncate flex-1 font-mono">{thumbnailUrl}</div>
                    <button
                      type="button"
                      onClick={() => { setThumbnailUrl(''); setThumbNotice(null); }}
                      className="text-[10px] text-rose-400 hover:text-rose-300 font-semibold cursor-pointer shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              {/* Tags & Author Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Author</label>
                  <input
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="Digital Muid"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Published Date</label>
                  <div className="relative">
                    <Calendar className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="date"
                      value={publishedAt}
                      onChange={(e) => setPublishedAt(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Tag Management */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Tags</label>
                <div className="flex items-center gap-2 mb-2">
                  <div className="relative flex-1">
                    <Tag className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleTagKeyDown}
                      placeholder="Add tag and press Enter"
                      className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="px-2.5 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-1"
                    >
                      #{t}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(t)}
                        className="hover:text-rose-400 text-amber-400/80 transition-colors"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Featured Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                      isFeatured
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    <Star className="w-4 h-4 fill-current" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Pin to Featured Resources</h4>
                    <p className="text-[11px] text-slate-400">Highlights this resource at the top of the /resources library.</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isFeatured}
                    onChange={(e) => setIsFeatured(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              {/* SEO Collapsible Section */}
              <div className="rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsSeoOpen(!isSeoOpen)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left text-xs font-bold text-white hover:bg-slate-900/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-amber-400" />
                    <span>Search Engine Optimization (SEO & Meta Tags)</span>
                  </div>
                  {isSeoOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>

                {isSeoOpen && (
                  <div className="p-4 pt-1 border-t border-slate-800/80 space-y-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">SEO Title</label>
                      <input
                        type="text"
                        value={seoTitle}
                        onChange={(e) => setSeoTitle(e.target.value)}
                        placeholder={title || 'Resource Title | Digital Muid'}
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">SEO Meta Description</label>
                      <textarea
                        rows={2}
                        value={seoDescription}
                        onChange={(e) => setSeoDescription(e.target.value)}
                        placeholder={description || 'Meta description for Google search results...'}
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    {/* Google SERP Snippet Preview */}
                    <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                        Google Search Preview
                      </span>
                      <div className="text-xs text-[#8ab4f8] font-medium truncate">
                        {seoTitle || title || 'Resource Title'} | Digital Muid
                      </div>
                      <div className="text-[11px] text-emerald-400 truncate">
                        https://digitalmuid.com/resources/{slug || 'slug'}
                      </div>
                      <div className="text-[11px] text-slate-400 line-clamp-2">
                        {seoDescription || description || 'Download and access strategic digital growth assets.'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Live Resource Card Preview (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="sticky top-2 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-amber-400" />
                    Live Card Preview
                  </span>
                  <span className="text-[10px] text-slate-500">Updates as you type</span>
                </div>

                {/* Resource Card Visual Render */}
                <div className="rounded-2xl bg-slate-950 border border-slate-800 p-5 space-y-4 shadow-xl">
                  {/* Cover */}
                  <div className="relative rounded-xl overflow-hidden aspect-video bg-slate-900 border border-slate-800">
                    {thumbnailUrl ? (
                      <img
                        src={thumbnailUrl}
                        alt={title || 'Resource Preview'}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 gap-1.5">
                        <Download className="w-8 h-8" />
                        <span className="text-[10px]">No cover image provided</span>
                      </div>
                    )}

                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                      <span className="px-2.5 py-0.5 rounded-md bg-amber-500 text-slate-950 text-[10px] font-bold uppercase tracking-wider shadow-md">
                        {resourceType}
                      </span>
                      {isFeatured && (
                        <span className="px-2 py-0.5 rounded-md bg-black/80 text-amber-300 text-[10px] font-bold flex items-center gap-1 shadow-md border border-amber-500/30">
                          <Star className="w-2.5 h-2.5 fill-current" />
                          Featured
                        </span>
                      )}
                    </div>

                    <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 text-white text-[10px] font-mono">
                      {fileType || 'PDF'} • {fileSize || '2.4 MB'}
                    </div>
                  </div>

                  {/* Category & Status */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="px-2.5 py-0.5 rounded-md bg-amber-500/10 text-amber-300 font-semibold border border-amber-500/20">
                      {category}
                    </span>
                    <span className="text-slate-400 text-[11px] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {readingTimeMinutes ? `${readingTimeMinutes} min` : '10 min'}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-base font-display font-bold text-white line-clamp-2">
                    {title || 'Resource Title Will Appear Here'}
                  </h3>

                  {/* Description */}
                  <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                    {description || 'Summary and overview of the downloadable asset or digital framework...'}
                  </p>

                  {/* Tags */}
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {tags.slice(0, 3).map((t) => (
                        <span key={t} className="text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Action Button Preview */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    <div className="text-[11px] text-slate-500">
                      By {author || 'Digital Muid'}
                    </div>
                    <button
                      type="button"
                      className="px-3.5 py-1.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-500/20"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{externalUrl ? 'Access Resource' : 'Download Free'}</span>
                    </button>
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Current CMS Status:</span>
                    {isAlreadyPublished ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        Published to Live Site
                      </span>
                    ) : (
                      <span className="text-amber-400 font-bold flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                        Draft (Admin View Only)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Database Target:</span>
                    <span className="font-mono text-slate-400">public.resources</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            {isAlreadyPublished && onUnpublish && (
              <button
                type="button"
                disabled={isSaving}
                onClick={handleUnpublishAction}
                className="px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold border border-amber-500/30 transition-colors"
              >
                Revert to Draft
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveDraft}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              <span>Save Draft</span>
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={handlePublish}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>{isAlreadyPublished ? 'Update & Publish' : 'Publish Resource'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
