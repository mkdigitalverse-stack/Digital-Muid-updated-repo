import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  X,
  Check,
  Loader2,
  Image as ImageIcon,
  Star,
  Globe,
  Tag,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Calendar,
  Sparkles,
  ArrowUp,
  ArrowDown,
  FileText,
  Video,
  Download,
  Clock,
  Layers,
  Users,
  DollarSign,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  ExternalLink,
  BookOpen,
  Link,
  Video as VideoIcon,
  Shield,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Course, CourseModule, CourseLesson, CourseLessonMedia, Framework, Article, Video as VideoType, Resource } from '../types';
import { slugify } from '../services/articleService';
import { normalizeCourseCurriculum, courseService } from '../services/courseService';

interface CourseEditorModalProps {
  isOpen: boolean;
  initialCourse: Course | null;
  onClose: () => void;
  onSave: (payload: Partial<Course>, targetStatus: 'draft' | 'published') => Promise<void>;
  onUnpublish?: (id: string) => Promise<void>;
  isSaving: boolean;
  availableFrameworks?: Framework[];
  availableArticles?: Article[];
  availableVideos?: VideoType[];
  availableResources?: Resource[];
}

export const CourseEditorModal: React.FC<CourseEditorModalProps> = ({
  isOpen,
  initialCourse,
  onClose,
  onSave,
  onUnpublish,
  isSaving,
  availableFrameworks = [],
  availableArticles = [],
  availableVideos = [],
  availableResources = []
}) => {
  const isEditing = Boolean(initialCourse && initialCourse.id);
  const isAlreadyPublished = initialCourse?.status === 'published';

  // Active Tab within modal
  const [activeTab, setActiveTab] = useState<'overview' | 'pricing' | 'curriculum' | 'ai_highlights' | 'media' | 'ecosystem' | 'seo'>('overview');

  // Core Form State
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [shortOutcome, setShortOutcome] = useState('');
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState<'Beginner' | 'Intermediate' | 'Advanced' | 'All Levels'>('All Levels');
  const [deliveryMode, setDeliveryMode] = useState<'Live Cohort' | 'Self-Paced' | 'Hybrid Masterclass'>('Live Cohort');
  const [duration, setDuration] = useState('');
  
  // Pricing & Cohort
  const [price, setPrice] = useState<number>(4999);
  const [offerPrice, setOfferPrice] = useState<string>('2499');
  const [offerExpiresAt, setOfferExpiresAt] = useState<string>('');
  const [currency, setCurrency] = useState('INR');
  const [cohortStartDate, setCohortStartDate] = useState('');
  const [maxSeats, setMaxSeats] = useState<string>('');
  const [enrolledCount, setEnrolledCount] = useState<number>(0);

  // Instructor
  const [instructor, setInstructor] = useState('Digital Muid');
  const [instructorTitle, setInstructorTitle] = useState('Growth Architect & Strategy Consultant');
  const [instructorAvatar, setInstructorAvatar] = useState('');

  // Media
  const [thumbnail, setThumbnail] = useState('');
  const [coverImage, setCoverImage] = useState('');

  // AI & Highlights
  const [aiIntegrated, setAiIntegrated] = useState(true);
  const [aiToolInput, setAiToolInput] = useState('');
  const [aiToolsCovered, setAiToolsCovered] = useState<string[]>([]);
  const [featured, setFeatured] = useState(false);
  const [highlights, setHighlights] = useState<string[]>([]);
  const [highlightInput, setHighlightInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // Curriculum Builder (Structured Modules & Lessons)
  const [curriculum, setCurriculum] = useState<CourseModule[]>([]);

  // Ecosystem Cross-Linking
  const [relatedFrameworks, setRelatedFrameworks] = useState<string[]>([]);
  const [relatedArticles, setRelatedArticles] = useState<string[]>([]);
  const [relatedVideos, setRelatedVideos] = useState<string[]>([]);
  const [relatedResources, setRelatedResources] = useState<string[]>([]);

  // SEO & Social
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [ogImage, setOgImage] = useState('');

  // Errors & Warnings
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Secure Media State (lessonId -> { mediaProvider, assetId })
  const [lessonMediaMap, setLessonMediaMap] = useState<{ [lessonId: string]: { mediaProvider: string; assetId: string } }>({});
  const [expandedMediaLessonId, setExpandedMediaLessonId] = useState<string | null>(null);

  // Reset or Populate form on open
  useEffect(() => {
    if (isOpen) {
      if (initialCourse) {
        // Load secure lesson media if editing an existing course
        if (initialCourse.id) {
          courseService.fetchCourseLessonMedia(initialCourse.id).then(res => {
            const map: { [lessonId: string]: { mediaProvider: string; assetId: string } } = {};
            if (res.data && Array.isArray(res.data)) {
              res.data.forEach(m => {
                map[m.lessonId] = {
                  mediaProvider: m.provider,
                  assetId: m.assetId
                };
              });
            }
            setLessonMediaMap(map);
          }).catch(err => {
            console.warn('[CourseEditorModal] Failed to load secure media:', err);
          });
        } else {
          setLessonMediaMap({});
        }
        setTitle(initialCourse.title || initialCourse.name || '');
        setSlug(initialCourse.slug || '');
        setIsSlugManuallyEdited(true);
        setShortOutcome(initialCourse.shortOutcome || initialCourse.short_outcome || '');
        setDescription(initialCourse.description || '');
        setLevel(initialCourse.level || 'All Levels');
        setDeliveryMode((initialCourse.deliveryMode || initialCourse.delivery_mode || 'Live Cohort') as any);
        setDuration(initialCourse.duration || '');

        setPrice(typeof initialCourse.price === 'number' ? initialCourse.price : 0);
        const op = initialCourse.offerPrice !== undefined ? initialCourse.offerPrice : initialCourse.offer_price;
        setOfferPrice(op !== undefined && op !== null ? String(op) : '');
        
        const rawExpiry = initialCourse.offerExpiresAt || initialCourse.offer_expires_at;
        setOfferExpiresAt(rawExpiry ? rawExpiry.split('T')[0] : '');

        setCurrency(initialCourse.currency || 'INR');
        
        const rawCohort = initialCourse.cohortStartDate || initialCourse.cohort_start_date;
        setCohortStartDate(rawCohort ? rawCohort.split('T')[0] : '');

        const ms = initialCourse.maxSeats !== undefined ? initialCourse.maxSeats : initialCourse.max_seats;
        setMaxSeats(ms !== undefined && ms !== null ? String(ms) : '');

        setEnrolledCount(initialCourse.enrolledCount || initialCourse.enrolled_count || 0);

        setInstructor(initialCourse.instructor || 'Digital Muid');
        setInstructorTitle(initialCourse.instructorTitle || initialCourse.instructor_title || '');
        setInstructorAvatar(initialCourse.instructorAvatar || initialCourse.instructor_avatar || '');

        setThumbnail(initialCourse.thumbnail || '');
        setCoverImage(initialCourse.coverImage || initialCourse.cover_image || '');

        setAiIntegrated(Boolean(initialCourse.aiIntegrated ?? initialCourse.ai_integrated));
        setAiToolsCovered(initialCourse.aiToolsCovered || initialCourse.ai_tools_covered || []);
        setFeatured(Boolean(initialCourse.featured ?? initialCourse.isFeatured));
        setHighlights(initialCourse.highlights || []);
        setTags(initialCourse.tags || ['Digital Growth']);

        setCurriculum(normalizeCourseCurriculum(initialCourse.curriculum));

        setRelatedFrameworks(initialCourse.relatedFrameworks || initialCourse.related_frameworks || []);
        setRelatedArticles(initialCourse.relatedArticles || initialCourse.related_articles || []);
        setRelatedVideos(initialCourse.relatedVideos || initialCourse.related_videos || []);
        setRelatedResources(initialCourse.relatedResources || initialCourse.related_resources || []);

        setSeoTitle(initialCourse.seoTitle || initialCourse.seo_title || '');
        setSeoDescription(initialCourse.seoDescription || initialCourse.seo_description || '');
        setOgImage(initialCourse.ogImage || initialCourse.og_image || '');
      } else {
        // Defaults for new masterclass
        setTitle('');
        setSlug('');
        setIsSlugManuallyEdited(false);
        setShortOutcome('');
        setDescription('');
        setLevel('All Levels');
        setDeliveryMode('Live Cohort');
        setDuration('12 Hours · 28 Lessons');
        setPrice(4999);
        setOfferPrice('2499');
        setOfferExpiresAt('');
        setCurrency('INR');
        setCohortStartDate('');
        setMaxSeats('50');
        setEnrolledCount(0);
        setInstructor('Digital Muid');
        setInstructorTitle('Growth Architect & Strategy Consultant');
        setInstructorAvatar('');
        setThumbnail('https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80');
        setCoverImage('https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80');
        setAiIntegrated(true);
        setAiToolsCovered(['ChatGPT Plus', 'Claude 3.7', 'Perplexity', 'Make.com']);
        setFeatured(false);
        setHighlights([
          'Direct Live Cohort masterclass with Digital Muid',
          'Interactive workspace templates & execution playbooks',
          'Lifetime access to recordings & private student network',
          'Verified Certificate of Completion'
        ]);
        setTags(['Digital Growth', 'Masterclass', 'AI Transformation']);
        setCurriculum([
          {
            id: 'mod-1',
            module: 'Module 1: Strategic Architecture & Foundations',
            title: 'Module 1: Strategic Architecture & Foundations',
            summary: 'Deconstruct core growth vectors, positioning moats, and unit economics.',
            duration: '3.5 hours',
            lessons: [
              {
                title: 'Market Vector & ICP Psychological Profiling',
                duration: '45 mins',
                deliveryType: 'live',
                isPreview: true
              },
              {
                title: 'Value Proposition Stress-Testing Matrix',
                duration: '60 mins',
                deliveryType: 'live',
                isPreview: false
              }
            ]
          }
        ]);
        setRelatedFrameworks([]);
        setRelatedArticles([]);
        setRelatedVideos([]);
        setRelatedResources([]);
        setSeoTitle('');
        setSeoDescription('');
        setOgImage('');
      }
      setErrors({});
      setActiveTab('overview');
    }
  }, [isOpen, initialCourse]);

  // Auto-generate slug from title
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTitle(val);
    if (!isSlugManuallyEdited) {
      setSlug(slugify(val));
    }
  };

  // Tag helper
  const handleAddTag = (e: React.KeyboardEvent | React.MouseEvent) => {
    if (e.type === 'keydown' && (e as React.KeyboardEvent).key !== 'Enter') return;
    if (e.type === 'keydown') (e as React.KeyboardEvent).preventDefault();

    const clean = tagInput.trim();
    if (clean && !tags.includes(clean)) {
      setTags([...tags, clean]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  // AI Tool helper
  const handleAddAiTool = (e: React.KeyboardEvent | React.MouseEvent) => {
    if (e.type === 'keydown' && (e as React.KeyboardEvent).key !== 'Enter') return;
    if (e.type === 'keydown') (e as React.KeyboardEvent).preventDefault();

    const clean = aiToolInput.trim();
    if (clean && !aiToolsCovered.includes(clean)) {
      setAiToolsCovered([...aiToolsCovered, clean]);
      setAiToolInput('');
    }
  };

  const handleRemoveAiTool = (toolToRemove: string) => {
    setAiToolsCovered(aiToolsCovered.filter(t => t !== toolToRemove));
  };

  // Highlight helper
  const handleAddHighlight = () => {
    const clean = highlightInput.trim();
    if (clean) {
      setHighlights([...highlights, clean]);
      setHighlightInput('');
    }
  };

  const handleRemoveHighlight = (idx: number) => {
    setHighlights(highlights.filter((_, i) => i !== idx));
  };

  // Curriculum Handlers
  const handleAddModule = () => {
    const nextIdx = curriculum.length + 1;
    const newMod: CourseModule = {
      id: `mod-${Date.now()}`,
      module: `Module ${nextIdx}: New Module Title`,
      title: `Module ${nextIdx}: New Module Title`,
      summary: '',
      duration: '2.5 hours',
      lessons: [
        {
          title: 'Lesson 1: Introduction & Concepts',
          duration: '30 mins',
          deliveryType: 'live',
          isPreview: false
        }
      ]
    };
    setCurriculum([...curriculum, newMod]);
  };

  const handleUpdateModule = (idx: number, updates: Partial<CourseModule>) => {
    setCurriculum(curriculum.map((m, i) => (i === idx ? { ...m, ...updates } : m)));
  };

  const handleDeleteModule = (idx: number) => {
    setCurriculum(curriculum.filter((_, i) => i !== idx));
  };

  const handleMoveModule = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= curriculum.length) return;
    const updated = [...curriculum];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;
    setCurriculum(updated);
  };

  const handleAddLesson = (moduleIdx: number) => {
    const mod = curriculum[moduleIdx];
    const currentLessons = Array.isArray(mod.lessons) ? mod.lessons : [];
    const newLessonNumber = currentLessons.length + 1;

    const newLesson: CourseLesson = {
      title: `Lesson ${newLessonNumber}: Core Execution`,
      duration: '45 mins',
      deliveryType: 'live',
      isPreview: false
    };

    const updatedMod: CourseModule = {
      ...mod,
      lessons: [...currentLessons, newLesson]
    };

    handleUpdateModule(moduleIdx, updatedMod);
  };

  const handleUpdateLesson = (moduleIdx: number, lessonIdx: number, updates: Partial<CourseLesson>) => {
    const mod = curriculum[moduleIdx];
    const currentLessons = Array.isArray(mod.lessons) ? mod.lessons : [];
    const updatedLessons = currentLessons.map((l, i) => {
      if (i !== lessonIdx) return l;
      if (typeof l === 'string') {
        return { title: l, ...updates };
      }
      return { ...l, ...updates };
    });

    handleUpdateModule(moduleIdx, { ...mod, lessons: updatedLessons });
  };

  const handleDeleteLesson = (moduleIdx: number, lessonIdx: number) => {
    const mod = curriculum[moduleIdx];
    const currentLessons = Array.isArray(mod.lessons) ? mod.lessons : [];
    handleUpdateModule(moduleIdx, {
      ...mod,
      lessons: currentLessons.filter((_, i) => i !== lessonIdx)
    });
  };

  const handleMoveLesson = (moduleIdx: number, lessonIdx: number, direction: 'up' | 'down') => {
    const mod = curriculum[moduleIdx];
    const currentLessons = [...(Array.isArray(mod.lessons) ? mod.lessons : [])];
    const targetIdx = direction === 'up' ? lessonIdx - 1 : lessonIdx + 1;
    if (targetIdx < 0 || targetIdx >= currentLessons.length) return;

    const temp = currentLessons[lessonIdx];
    currentLessons[lessonIdx] = currentLessons[targetIdx];
    currentLessons[targetIdx] = temp;

    handleUpdateModule(moduleIdx, { ...mod, lessons: currentLessons });
  };

  const handleUpdateLessonMedia = (lessonId: string, mediaProvider: string, assetId: string) => {
    setLessonMediaMap(prev => ({
      ...prev,
      [lessonId]: { mediaProvider, assetId }
    }));
  };

  // Cross-linking toggles
  const toggleRelation = (
    currentList: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>,
    idOrSlug: string
  ) => {
    if (currentList.includes(idOrSlug)) {
      setList(currentList.filter(item => item !== idOrSlug));
    } else {
      setList([...currentList, idOrSlug]);
    }
  };

  // Submit validation & execution
  const handleSave = async (targetStatus: 'draft' | 'published') => {
    const newErrors: { [key: string]: string } = {};

    if (!title.trim()) newErrors.title = 'Course title is required';
    if (!slug.trim()) newErrors.slug = 'URL slug is required';
    if (price < 0) newErrors.price = 'Price cannot be negative';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setActiveTab('overview');
      return;
    }

    const parsedOfferPrice = offerPrice.trim() !== '' && !isNaN(Number(offerPrice))
      ? Number(offerPrice)
      : undefined;

    const parsedMaxSeats = maxSeats.trim() !== '' && !isNaN(Number(maxSeats))
      ? Number(maxSeats)
      : undefined;

    const payload: Partial<Course> = {
      title: title.trim(),
      name: title.trim(),
      slug: slugify(slug),
      shortOutcome: shortOutcome.trim(),
      short_outcome: shortOutcome.trim(),
      description: description.trim(),
      level,
      deliveryMode,
      delivery_mode: deliveryMode,
      duration: duration.trim(),
      price: Number(price) || 0,
      offerPrice: parsedOfferPrice,
      offer_price: parsedOfferPrice,
      offerExpiresAt: offerExpiresAt ? new Date(offerExpiresAt).toISOString() : undefined,
      offer_expires_at: offerExpiresAt ? new Date(offerExpiresAt).toISOString() : undefined,
      currency: currency.trim() || 'INR',
      cohortStartDate: cohortStartDate ? new Date(cohortStartDate).toISOString() : undefined,
      cohort_start_date: cohortStartDate ? new Date(cohortStartDate).toISOString() : undefined,
      maxSeats: parsedMaxSeats,
      max_seats: parsedMaxSeats,
      enrolledCount: Number(enrolledCount) || 0,
      enrolled_count: Number(enrolledCount) || 0,
      instructor: instructor.trim() || 'Digital Muid',
      instructorTitle: instructorTitle.trim() || undefined,
      instructor_title: instructorTitle.trim() || undefined,
      instructorAvatar: instructorAvatar.trim() || undefined,
      instructor_avatar: instructorAvatar.trim() || undefined,
      thumbnail: thumbnail.trim() || 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80',
      coverImage: coverImage.trim() || undefined,
      cover_image: coverImage.trim() || undefined,
      aiIntegrated,
      ai_integrated: aiIntegrated,
      aiToolsCovered,
      ai_tools_covered: aiToolsCovered,
      featured,
      isFeatured: featured,
      status: targetStatus,
      curriculum,
      highlights,
      tags: tags.length > 0 ? tags : ['Digital Growth'],
      relatedFrameworks,
      related_frameworks: relatedFrameworks,
      relatedArticles,
      related_articles: relatedArticles,
      relatedVideos,
      related_videos: relatedVideos,
      relatedResources,
      related_resources: relatedResources,
      seoTitle: seoTitle.trim() || undefined,
      seo_title: seoTitle.trim() || undefined,
      seoDescription: seoDescription.trim() || undefined,
      seo_description: seoDescription.trim() || undefined,
      ogImage: ogImage.trim() || undefined,
      og_image: ogImage.trim() || undefined
    };

    await onSave(payload, targetStatus);

    // If existing course, synchronize secure lesson media entries
    if (initialCourse?.id) {
      try {
        const courseId = initialCourse.id;
        for (const [lessonId, mediaInfo] of Object.entries(lessonMediaMap)) {
          const typedMedia = mediaInfo as { mediaProvider: string; assetId: string };
          if (typedMedia.assetId && typedMedia.assetId.trim()) {
            await courseService.upsertCourseLessonMedia({
              courseId,
              lessonId,
              provider: (typedMedia.mediaProvider as any) || 'youtube_unlisted',
              assetId: typedMedia.assetId.trim(),
              isPreview: false
            });
          } else {
            await courseService.deleteCourseLessonMedia(courseId, lessonId);
          }
        }
      } catch (mediaErr) {
        console.warn('[CourseEditorModal] Error persisting secure media entries:', mediaErr);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-5xl rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  {isEditing ? 'Edit Masterclass & Course' : 'Create New Masterclass'}
                </h2>
                {isAlreadyPublished && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase tracking-wider border border-emerald-500/20">
                    Live Published
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-mono">
                {slug ? `/courses/${slug}` : 'Configure curriculum, cohort dates, pricing, and AI curriculum'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Tabs Navigation */}
        <div className="px-6 border-b border-slate-800 bg-slate-950/40 flex items-center gap-1 overflow-x-auto shrink-0 scrollbar-none">
          {[
            { id: 'overview', label: '1. Overview', icon: FileText },
            { id: 'pricing', label: '2. Pricing & Cohort', icon: DollarSign },
            { id: 'curriculum', label: `3. Curriculum (${curriculum.length})`, icon: BookOpen },
            { id: 'ai_highlights', label: '4. AI & Highlights', icon: Sparkles },
            { id: 'media', label: '5. Media & Assets', icon: ImageIcon },
            { id: 'ecosystem', label: `6. Strategic Ecosystem (${relatedFrameworks.length + relatedArticles.length + relatedVideos.length + relatedResources.length})`, icon: Layers },
            { id: 'seo', label: '7. SEO & Social', icon: Globe }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-3.5 text-xs font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'border-amber-400 text-amber-300 bg-amber-400/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Title & Slug */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Course Title *</span>
                  <span className="text-[10px] text-slate-500 font-mono">Shown across catalog and hero banners</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={handleTitleChange}
                  placeholder="e.g., Digital Marketing Masterclass: The Complete Modern Growth System"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 focus:outline-none text-white text-sm"
                />
                {errors.title && <p className="text-xs text-rose-400 font-medium">{errors.title}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span>URL Slug *</span>
                    <button
                      type="button"
                      onClick={() => setIsSlugManuallyEdited(!isSlugManuallyEdited)}
                      className="text-[10px] text-amber-400 hover:underline cursor-pointer font-mono"
                    >
                      {isSlugManuallyEdited ? 'Locked to Manual' : 'Auto-Syncing with Title'}
                    </button>
                  </label>
                  <div className="flex items-center rounded-xl bg-slate-950 border border-slate-700 focus-within:border-amber-400 overflow-hidden">
                    <span className="pl-3 pr-1 text-slate-500 text-xs font-mono">/courses/</span>
                    <input
                      type="text"
                      value={slug}
                      onChange={e => {
                        setIsSlugManuallyEdited(true);
                        setSlug(slugify(e.target.value));
                      }}
                      placeholder="digital-marketing-masterclass"
                      className="w-full px-2 py-2.5 bg-transparent text-white text-sm font-mono focus:outline-none"
                    />
                  </div>
                  {errors.slug && <p className="text-xs text-rose-400 font-medium">{errors.slug}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Duration & Lesson Count</label>
                  <input
                    type="text"
                    value={duration}
                    onChange={e => setDuration(e.target.value)}
                    placeholder="e.g., 16 Hours · 38 Lessons"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 focus:outline-none text-white text-sm"
                  />
                </div>
              </div>

              {/* Short Outcome */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Short Outcome Promise</span>
                  <span className="text-[10px] text-slate-500">Concise 1-sentence value proposition for cards</span>
                </label>
                <input
                  type="text"
                  value={shortOutcome}
                  onChange={e => setShortOutcome(e.target.value)}
                  placeholder="e.g., Master strategic demand generation, performance paid media, intent search, and full-funnel conversion."
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 focus:outline-none text-white text-sm"
                />
              </div>

              {/* Full Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Full Description & Objective</label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Detailed breakdown of what students will master, who will benefit most, and the strategic rationale..."
                  className="w-full p-4 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 focus:outline-none text-white text-sm leading-relaxed"
                />
              </div>

              {/* Level & Delivery Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Target Skill Level</label>
                  <select
                    value={level}
                    onChange={e => setLevel(e.target.value as any)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 focus:outline-none text-white text-sm cursor-pointer"
                  >
                    <option value="All Levels">All Levels (Comprehensive)</option>
                    <option value="Beginner">Beginner (Foundational)</option>
                    <option value="Intermediate">Intermediate (Practitioners)</option>
                    <option value="Advanced">Advanced (Executive & Deep Strategy)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Delivery Mode</label>
                  <select
                    value={deliveryMode}
                    onChange={e => setDeliveryMode(e.target.value as any)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 focus:outline-none text-white text-sm cursor-pointer"
                  >
                    <option value="Live Cohort">Live Cohort (Scheduled Google Meet Masterclasses)</option>
                    <option value="Self-Paced">Self-Paced (Instant On-Demand Access)</option>
                    <option value="Hybrid Masterclass">Hybrid Masterclass (Recorded + Weekly Live Q&A)</option>
                  </select>
                </div>
              </div>

              {/* Instructor Details */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 font-mono">Instructor Profile</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-400">Instructor Name</label>
                    <input
                      type="text"
                      value={instructor}
                      onChange={e => setInstructor(e.target.value)}
                      placeholder="Digital Muid"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-400">Instructor Title</label>
                    <input
                      type="text"
                      value={instructorTitle}
                      onChange={e => setInstructorTitle(e.target.value)}
                      placeholder="Growth Architect & Strategy Consultant"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-400">Avatar Image URL</label>
                    <input
                      type="text"
                      value={instructorAvatar}
                      onChange={e => setInstructorAvatar(e.target.value)}
                      placeholder="https://.../avatar.jpg"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PRICING & COHORT */}
          {activeTab === 'pricing' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Standard Price (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    value={price}
                    onChange={e => setPrice(Number(e.target.value))}
                    placeholder="4999"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 focus:outline-none text-white text-sm font-mono"
                  />
                  {errors.price && <p className="text-xs text-rose-400 font-medium">{errors.price}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Special Offer Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={offerPrice}
                    onChange={e => setOfferPrice(e.target.value)}
                    placeholder="2499 (leave blank if no discount)"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 focus:outline-none text-white text-sm font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Offer Expiry Date</label>
                  <input
                    type="date"
                    value={offerExpiresAt}
                    onChange={e => setOfferExpiresAt(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 focus:outline-none text-white text-sm cursor-pointer"
                  />
                </div>
              </div>

              {/* Price Preview Callout */}
              <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">
                    ₹
                  </div>
                  <div>
                    <div className="text-white font-semibold flex items-center gap-2">
                      <span>Public Display:</span>
                      {offerPrice && Number(offerPrice) > 0 ? (
                        <>
                          <span className="text-amber-400 font-bold text-sm">₹{Number(offerPrice).toLocaleString()}</span>
                          <span className="line-through text-slate-500">₹{Number(price).toLocaleString()}</span>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">
                            {Math.round(((Number(price) - Number(offerPrice)) / Number(price)) * 100)}% OFF
                          </span>
                        </>
                      ) : (
                        <span className="text-amber-400 font-bold text-sm">₹{Number(price).toLocaleString()}</span>
                      )}
                    </div>
                    <p className="text-slate-400 text-[11px]">Enquiry lead forms will capture intent with this pricing structure.</p>
                  </div>
                </div>
              </div>

              {/* Cohort Dates & Seats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-400" />
                    <span>Cohort Start Date</span>
                  </label>
                  <input
                    type="date"
                    value={cohortStartDate}
                    onChange={e => setCohortStartDate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 focus:outline-none text-white text-sm cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-amber-400" />
                    <span>Max Seat Cap</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={maxSeats}
                    onChange={e => setMaxSeats(e.target.value)}
                    placeholder="50"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 focus:outline-none text-white text-sm font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Enrolled Count (Social Proof)</label>
                  <input
                    type="number"
                    min="0"
                    value={enrolledCount}
                    onChange={e => setEnrolledCount(Number(e.target.value))}
                    placeholder="1420"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 focus:outline-none text-white text-sm font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CURRICULUM BUILDER */}
          {activeTab === 'curriculum' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Curriculum Modules & Lessons</h3>
                  <p className="text-xs text-slate-400">
                    Structure the educational journey with structured modules, detailed lessons, and duration tags.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddModule}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Module</span>
                </button>
              </div>

              {curriculum.length === 0 ? (
                <div className="p-8 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 text-center space-y-3">
                  <BookOpen className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">No modules added yet. Click "Add Module" to start structuring your course.</p>
                  <button
                    type="button"
                    onClick={handleAddModule}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                  >
                    Create First Module
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {curriculum.map((mod, modIdx) => {
                    const lessons = Array.isArray(mod.lessons) ? mod.lessons : [];
                    return (
                      <div
                        key={mod.id || modIdx}
                        className="rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden shadow-sm"
                      >
                        {/* Module Header Bar */}
                        <div className="p-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 flex-1">
                            <span className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold font-mono text-xs flex items-center justify-center shrink-0">
                              {String(modIdx + 1).padStart(2, '0')}
                            </span>
                            <div className="flex-1 space-y-1">
                              <input
                                type="text"
                                value={mod.module || mod.title || ''}
                                onChange={e => handleUpdateModule(modIdx, { module: e.target.value, title: e.target.value })}
                                placeholder="Module Title (e.g. Module 1: Strategic Foundations)"
                                className="w-full px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs font-semibold focus:border-amber-400 focus:outline-none"
                              />
                            </div>
                            <div className="w-32 shrink-0">
                              <input
                                type="text"
                                value={mod.duration || ''}
                                onChange={e => handleUpdateModule(modIdx, { duration: e.target.value })}
                                placeholder="e.g. 3.5 hours"
                                className="w-full px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-lg text-slate-300 text-xs font-mono focus:border-amber-400 focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleMoveModule(modIdx, 'up')}
                              disabled={modIdx === 0}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 cursor-pointer"
                              title="Move Module Up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveModule(modIdx, 'down')}
                              disabled={modIdx === curriculum.length - 1}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 cursor-pointer"
                              title="Move Module Down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteModule(modIdx)}
                              className="p-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 cursor-pointer ml-1"
                              title="Delete Module"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Module Lessons Container */}
                        <div className="p-4 space-y-3 bg-slate-950/40">
                          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                            <span>LESSONS IN MODULE ({lessons.length})</span>
                            <button
                              type="button"
                              onClick={() => handleAddLesson(modIdx)}
                              className="text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Add Lesson</span>
                            </button>
                          </div>

                          <div className="space-y-2">
                            {lessons.map((lesson, lessonIdx) => {
                              const lessonTitle = typeof lesson === 'string' ? lesson : lesson.title;
                              const lessonDur = typeof lesson === 'object' ? lesson.duration : '';
                              const isPreview = typeof lesson === 'object' ? Boolean(lesson.isPreview) : false;
                              const lessonId = typeof lesson === 'object' && lesson.id ? lesson.id : `lesson-${modIdx}-${lessonIdx}`;
                              const currentMedia = lessonMediaMap[lessonId] || { mediaProvider: 'youtube', assetId: '' };
                              const isMediaOpen = expandedMediaLessonId === lessonId;

                              return (
                                <div
                                  key={lessonIdx}
                                  className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs"
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 flex-1">
                                      <span className="text-slate-500 font-mono text-[10px] w-5">
                                        {lessonIdx + 1}.
                                      </span>
                                      <input
                                        type="text"
                                        value={lessonTitle}
                                        onChange={e => handleUpdateLesson(modIdx, lessonIdx, { title: e.target.value })}
                                        placeholder="Lesson Title"
                                        className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white text-xs focus:border-amber-400 focus:outline-none"
                                      />
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                      <input
                                        type="text"
                                        value={lessonDur || ''}
                                        onChange={e => handleUpdateLesson(modIdx, lessonIdx, { duration: e.target.value })}
                                        placeholder="45 mins"
                                        className="w-20 px-2 py-1 rounded bg-slate-950 border border-slate-700 text-slate-300 text-xs font-mono focus:border-amber-400 focus:outline-none"
                                      />

                                      <button
                                        type="button"
                                        onClick={() => handleUpdateLesson(modIdx, lessonIdx, { isPreview: !isPreview })}
                                        className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-all cursor-pointer ${
                                          isPreview
                                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                            : 'bg-slate-800 text-slate-500 hover:text-slate-300'
                                        }`}
                                        title="Toggle Free Preview tag"
                                      >
                                        {isPreview ? 'Preview' : 'Locked'}
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => setExpandedMediaLessonId(isMediaOpen ? null : lessonId)}
                                        className={`px-2 py-1 rounded text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                                          currentMedia.assetId
                                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                            : 'bg-slate-800 text-slate-400 hover:text-white'
                                        }`}
                                        title="Configure Secure Media Stream"
                                      >
                                        <Shield className="w-2.5 h-2.5" />
                                        <span>{currentMedia.assetId ? 'Media Configured' : 'Add Media'}</span>
                                        {isMediaOpen ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleMoveLesson(modIdx, lessonIdx, 'up')}
                                        disabled={lessonIdx === 0}
                                        className="p-1 text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer"
                                      >
                                        <ArrowUp className="w-3 h-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleMoveLesson(modIdx, lessonIdx, 'down')}
                                        disabled={lessonIdx === lessons.length - 1}
                                        className="p-1 text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer"
                                      >
                                        <ArrowDown className="w-3 h-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteLesson(modIdx, lessonIdx)}
                                        className="p-1 text-rose-400 hover:text-rose-300 cursor-pointer"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Secure Media Configuration Drawer */}
                                  {isMediaOpen && (
                                    <div className="mt-2 p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 flex flex-wrap items-center gap-3">
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <label className="text-[10px] text-slate-400 font-mono uppercase">Provider:</label>
                                        <select
                                          value={currentMedia.mediaProvider}
                                          onChange={e => handleUpdateLessonMedia(lessonId, e.target.value, currentMedia.assetId)}
                                          className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white text-xs focus:border-amber-400 focus:outline-none"
                                        >
                                          <option value="youtube">YouTube (Unlisted/Private)</option>
                                          <option value="vimeo">Vimeo Showcase/Private</option>
                                          <option value="cloudflare_stream">Cloudflare Stream</option>
                                          <option value="custom_hls">Custom HLS / Direct</option>
                                        </select>
                                      </div>

                                      <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                                        <label className="text-[10px] text-slate-400 font-mono uppercase">Asset ID:</label>
                                        <input
                                          type="text"
                                          value={currentMedia.assetId}
                                          onChange={e => handleUpdateLessonMedia(lessonId, currentMedia.mediaProvider, e.target.value)}
                                          placeholder="Video ID (e.g. dQw4w9WgXcQ or CF UID)"
                                          className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: AI & HIGHLIGHTS */}
          {activeTab === 'ai_highlights' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* AI Integration */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">AI-Integrated Masterclass</h4>
                      <p className="text-[11px] text-slate-400">Highlights hands-on AI agent tools & prompt systems in the curriculum</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAiIntegrated(!aiIntegrated)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      aiIntegrated
                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {aiIntegrated ? 'AI Enabled' : 'Standard'}
                  </button>
                </div>

                {aiIntegrated && (
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <label className="text-xs font-semibold text-slate-300">AI Tools Covered</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={aiToolInput}
                        onChange={e => setAiToolInput(e.target.value)}
                        onKeyDown={handleAddAiTool}
                        placeholder="Type tool (e.g. ChatGPT, Claude 3.7, Make.com) and press Enter"
                        className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:border-amber-400 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleAddAiTool}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
                      >
                        Add Tool
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {aiToolsCovered.map(tool => (
                        <span
                          key={tool}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs font-medium"
                        >
                          <Sparkles className="w-3 h-3 text-amber-400" />
                          <span>{tool}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveAiTool(tool)}
                            className="hover:text-white cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Key Value Highlights */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">Key Course Highlights (Bullet points on landing page)</label>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={highlightInput}
                    onChange={e => setHighlightInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddHighlight())}
                    placeholder="e.g., 15+ Years of battle-tested frameworks"
                    className="flex-1 px-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:border-amber-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddHighlight}
                    className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
                  >
                    Add Highlight
                  </button>
                </div>

                <div className="space-y-1.5">
                  {highlights.map((hl, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 text-xs text-slate-300"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>{hl}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveHighlight(idx)}
                        className="text-slate-500 hover:text-rose-400 cursor-pointer p-1"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tags & Featured */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-amber-400" />
                    <span>Tags & Categories</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={handleAddTag}
                      placeholder="Add tag and press Enter"
                      className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:border-amber-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddTag}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs border border-slate-700"
                      >
                        <span>{tag}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="hover:text-white cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-amber-400" />
                    <span>Featured Spotlight</span>
                  </label>
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-white">Promote to Featured Masterclass</div>
                      <p className="text-[11px] text-slate-400">Featured courses appear highlighted with special badges.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFeatured(!featured)}
                      className={`p-2 rounded-xl border transition-all cursor-pointer ${
                        featured
                          ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                          : 'bg-slate-800 border-slate-700 text-slate-500'
                      }`}
                    >
                      <Star className={`w-5 h-5 ${featured ? 'fill-current' : ''}`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: MEDIA & ASSETS */}
          {activeTab === 'media' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Thumbnail */}
                <div className="space-y-3">
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span>Card Thumbnail URL</span>
                    <span className="text-[10px] text-slate-500">16:9 Aspect Ratio</span>
                  </label>
                  <input
                    type="text"
                    value={thumbnail}
                    onChange={e => setThumbnail(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 focus:outline-none text-white text-xs font-mono"
                  />
                  <div className="relative rounded-2xl overflow-hidden aspect-video bg-slate-950 border border-slate-800 flex items-center justify-center">
                    {thumbnail ? (
                      <img
                        src={thumbnail}
                        alt="Thumbnail preview"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="text-center text-slate-600 space-y-1">
                        <ImageIcon className="w-8 h-8 mx-auto" />
                        <p className="text-xs">No thumbnail image</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Cover Image */}
                <div className="space-y-3">
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span>Course Detail Cover Image</span>
                    <span className="text-[10px] text-slate-500">Full Hero Banner</span>
                  </label>
                  <input
                    type="text"
                    value={coverImage}
                    onChange={e => setCoverImage(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 focus:outline-none text-white text-xs font-mono"
                  />
                  <div className="relative rounded-2xl overflow-hidden aspect-video bg-slate-950 border border-slate-800 flex items-center justify-center">
                    {coverImage ? (
                      <img
                        src={coverImage}
                        alt="Cover banner preview"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="text-center text-slate-600 space-y-1">
                        <ImageIcon className="w-8 h-8 mx-auto" />
                        <p className="text-xs">No cover hero image</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: STRATEGIC ECOSYSTEM (RELATIONSHIPS) */}
          {activeTab === 'ecosystem' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-200">
                <p className="font-semibold text-white">Strategic Knowledge Hub Integration</p>
                <p className="text-indigo-300/80 mt-0.5">
                  Link this Masterclass to relevant frameworks, deep-dive articles, masterclass videos, and downloadable resources.
                </p>
              </div>

              {/* Related Frameworks */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Connected Frameworks ({relatedFrameworks.length})</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 rounded-xl bg-slate-950 border border-slate-800 custom-scrollbar">
                  {availableFrameworks.length === 0 ? (
                    <p className="text-xs text-slate-500 p-2 col-span-2">No published frameworks available.</p>
                  ) : (
                    availableFrameworks.map(fw => {
                      const isSelected = relatedFrameworks.includes(fw.id) || relatedFrameworks.includes(fw.slug);
                      return (
                        <button
                          key={fw.id}
                          type="button"
                          onClick={() => toggleRelation(relatedFrameworks, setRelatedFrameworks, fw.id)}
                          className={`p-2.5 rounded-lg text-left text-xs transition-all flex items-center justify-between border cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-200'
                              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                          }`}
                        >
                          <span className="truncate pr-2 font-medium">{fw.title || fw.name}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Related Articles */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#1877F2]" />
                  <span>Related Insights & Articles ({relatedArticles.length})</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 rounded-xl bg-slate-950 border border-slate-800 custom-scrollbar">
                  {availableArticles.length === 0 ? (
                    <p className="text-xs text-slate-500 p-2 col-span-2">No published articles available.</p>
                  ) : (
                    availableArticles.map(art => {
                      const isSelected = relatedArticles.includes(art.id) || relatedArticles.includes(art.slug);
                      return (
                        <button
                          key={art.id}
                          type="button"
                          onClick={() => toggleRelation(relatedArticles, setRelatedArticles, art.id)}
                          className={`p-2.5 rounded-lg text-left text-xs transition-all flex items-center justify-between border cursor-pointer ${
                            isSelected
                              ? 'bg-[#1877F2]/20 border-[#1877F2]/40 text-[#1877F2]'
                              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                          }`}
                        >
                          <span className="truncate pr-2 font-medium">{art.title}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-[#1877F2] shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Related Videos */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5 text-rose-400" />
                  <span>Related Masterclass Videos ({relatedVideos.length})</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 rounded-xl bg-slate-950 border border-slate-800 custom-scrollbar">
                  {availableVideos.length === 0 ? (
                    <p className="text-xs text-slate-500 p-2 col-span-2">No videos available.</p>
                  ) : (
                    availableVideos.map(vid => {
                      const isSelected = relatedVideos.includes(vid.id) || relatedVideos.includes(vid.slug);
                      return (
                        <button
                          key={vid.id}
                          type="button"
                          onClick={() => toggleRelation(relatedVideos, setRelatedVideos, vid.id)}
                          className={`p-2.5 rounded-lg text-left text-xs transition-all flex items-center justify-between border cursor-pointer ${
                            isSelected
                              ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                          }`}
                        >
                          <span className="truncate pr-2 font-medium">{vid.title}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Related Resources */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Connected Playbooks & Lead Magnets ({relatedResources.length})</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 rounded-xl bg-slate-950 border border-slate-800 custom-scrollbar">
                  {availableResources.length === 0 ? (
                    <p className="text-xs text-slate-500 p-2 col-span-2">No downloadable resources available.</p>
                  ) : (
                    availableResources.map(res => {
                      const isSelected = relatedResources.includes(res.id) || relatedResources.includes(res.slug);
                      return (
                        <button
                          key={res.id}
                          type="button"
                          onClick={() => toggleRelation(relatedResources, setRelatedResources, res.id)}
                          className={`p-2.5 rounded-lg text-left text-xs transition-all flex items-center justify-between border cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                          }`}
                        >
                          <span className="truncate pr-2 font-medium">{res.title || res.name}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: SEO & SOCIAL */}
          {activeTab === 'seo' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Custom SEO Title</label>
                <input
                  type="text"
                  value={seoTitle}
                  onChange={e => setSeoTitle(e.target.value)}
                  placeholder="Leave empty to use course title"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 focus:outline-none text-white text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Custom Meta Description</label>
                <textarea
                  rows={3}
                  value={seoDescription}
                  onChange={e => setSeoDescription(e.target.value)}
                  placeholder="Leave empty to use short outcome promise"
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 focus:outline-none text-white text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Open Graph Social Image URL</label>
                <input
                  type="text"
                  value={ogImage}
                  onChange={e => setOgImage(e.target.value)}
                  placeholder="https://.../og-image.jpg (Defaults to cover image)"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 focus:outline-none text-white text-xs font-mono"
                />
              </div>
            </div>
          )}
        </div>

        {/* Bottom Action Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {isAlreadyPublished && onUnpublish && initialCourse && (
              <button
                type="button"
                onClick={async () => {
                  if (confirm('Switch this course back to Draft? It will be hidden from public catalog.')) {
                    await onUnpublish(initialCourse.id);
                  }
                }}
                disabled={isSaving}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <EyeOff className="w-3.5 h-3.5" />
                <span>Switch to Draft</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => handleSave('draft')}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1.5 border border-slate-700 cursor-pointer"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>Save as Draft</span>
            </button>

            <button
              type="button"
              onClick={() => handleSave('published')}
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Eye className="w-3.5 h-3.5" />
              )}
              <span>{isAlreadyPublished ? 'Update Live Course' : 'Publish Live to Catalog'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
