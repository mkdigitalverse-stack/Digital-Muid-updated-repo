import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Download, CheckCircle2, ArrowRight, ShieldCheck, X, ExternalLink, Search, Clock, Star, Loader2, Layers, Bookmark } from 'lucide-react';
import { Resource } from '../types';
import { resourceService } from '../services/resourceService';
import { findFrameworksForResource } from '../utils/frameworkRelationships';

interface ResourcesPageProps {
  navigate: (path: string) => void;
  selectedResourceId?: string | null;
  onCloseModal?: () => void;
}

export const ResourcesPage: React.FC<ResourcesPageProps> = ({
  navigate,
  selectedResourceId,
  onCloseModal
}) => {
  const {
    resources,
    frameworks,
    recordResourceDownload,
    notify,
    currentUser,
    userProfile,
    isAdminAuthenticated,
    isBookmarked,
    toggleBookmark
  } = useApp();

  const isAuthenticatedStudent = Boolean(currentUser && !isAdminAuthenticated);

  const [activeDownloadResource, setActiveDownloadResource] = useState<Resource | null>(null);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [profession, setProfession] = useState('');
  const [isSubmittingLead, setIsSubmittingLead] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Filter published resources for public display
  const publishedResources = resources.filter(
    (r) => r.status === 'published' || !r.status
  );

  // If passed from parent
  React.useEffect(() => {
    if (selectedResourceId) {
      const res = publishedResources.find((r) => r.id === selectedResourceId || r.slug === selectedResourceId);
      if (res) {
        setActiveDownloadResource(res);
        if (currentUser && !isAdminAuthenticated) {
          setIsCompleted(true);
        }
      }
    }
  }, [selectedResourceId, publishedResources, currentUser, isAdminAuthenticated]);

  const handleToggleResourceBookmark = async (resourceId: string) => {
    if (!currentUser) {
      notify('Please sign in to save toolkits to your personal library.', 'info');
      navigate('/login');
      return;
    }
    await toggleBookmark('resource', resourceId);
  };

  const handleDownloadClick = async (res: Resource) => {
    // Authenticated students bypass the public lead-capture form and directly access/deliver the resource
    if (isAuthenticatedStudent) {
      setActiveDownloadResource(res);
      setIsCompleted(true);
      setFormError(null);
      setDownloadError(null);
      setIsDownloading(true);

      try {
        // Record download in CRM/history asynchronously without blocking
        recordResourceDownload(
          res.id,
          currentUser?.email || '',
          userProfile?.fullName || 'Student',
          userProfile?.phone || 'Student Member',
          userProfile?.title || 'Student'
        ).catch((err) => {
          console.warn('[ResourcesPage] Could not auto-record student download:', err);
        });

        const deliveryRes = await resourceService.deliverResource(res);
        if (!deliveryRes.success) {
          setDownloadError(deliveryRes.error || "We're unable to open this resource right now. Please try again.");
          notify(deliveryRes.error || "Unable to open resource", "error");
        } else {
          notify(`Student Access: Delivering ${res.title || res.name || 'resource'}...`, "success");
        }
      } catch (err: any) {
        console.error('[ResourcesPage] Error delivering resource to student:', err);
        setDownloadError("We're unable to open this resource right now. Please try again.");
      } finally {
        setIsDownloading(false);
      }
      return;
    }

    // Anonymous visitors keep the existing lead-capture flow unchanged
    setActiveDownloadResource(res);
    setIsCompleted(false);
    setFormError(null);
    setDownloadError(null);
  };

  const handleModalClose = () => {
    setActiveDownloadResource(null);
    setIsCompleted(false);
    setFormError(null);
    setDownloadError(null);
    if (onCloseModal) onCloseModal();
  };

  const handleTriggerDownload = async () => {
    if (!activeDownloadResource) return;
    setIsDownloading(true);
    setDownloadError(null);

    try {
      const res = await resourceService.deliverResource(activeDownloadResource);
      if (!res.success) {
        setDownloadError(res.error || "We're unable to open this resource right now. Please try again.");
      }
    } catch (err: any) {
      console.error('[ResourcesPage] Error triggering download:', err);
      setDownloadError("We're unable to open this resource right now. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSubmitLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDownloadResource) return;

    if (!name.trim()) {
      setFormError('Please enter your name.');
      return;
    }
    if (!mobile.trim()) {
      setFormError('Please enter your mobile / WhatsApp number.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setFormError('Please enter a valid email address.');
      return;
    }
    if (!profession.trim()) {
      setFormError('Please enter your profession or current role.');
      return;
    }

    setFormError(null);
    setIsSubmittingLead(true);

    try {
      // Record download & register CRM lead
      await recordResourceDownload(
        activeDownloadResource.id,
        email.trim(),
        name.trim(),
        mobile.trim(),
        profession.trim()
      );
      setIsCompleted(true);
    } catch (err: any) {
      setFormError(err?.message || 'Unable to register details. Please try again.');
    } finally {
      setIsSubmittingLead(false);
    }
  };

  // Categories extracted from available resources
  const categories = ['all', ...Array.from(new Set(publishedResources.map((r) => r.category).filter(Boolean)))];

  const filteredResources = publishedResources.filter((res) => {
    const title = (res.title || res.name || '').toLowerCase();
    const desc = (res.description || '').toLowerCase();
    const cat = (res.category || '').toLowerCase();
    const type = (res.resourceType || res.type || '').toLowerCase();
    const tags = (res.tags || []).map((t) => t.toLowerCase()).join(' ');

    const matchesSearch =
      searchQuery === '' ||
      title.includes(searchQuery.toLowerCase()) ||
      desc.includes(searchQuery.toLowerCase()) ||
      cat.includes(searchQuery.toLowerCase()) ||
      type.includes(searchQuery.toLowerCase()) ||
      tags.includes(searchQuery.toLowerCase());

    const matchesCat = selectedCategory === 'all' || res.category === selectedCategory;

    return matchesSearch && matchesCat;
  });

  return (
    <div id="resources-page-root" className="pt-28 sm:pt-32 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
      {/* Header */}
      <div className="max-w-3xl space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 text-xs font-bold uppercase tracking-wider font-interface">
          <Download className="w-3.5 h-3.5 text-amber-500" /> High-Utility Free Toolkits
        </div>
        <h1 className="text-4xl sm:text-5xl font-display font-bold text-slate-900 tracking-tight">
          Useful Things. Free.
        </h1>
        <p className="text-slate-600 text-base sm:text-lg font-interface leading-relaxed">
          Production-tested templates, AI prompt matrices, execution checklists, and funnel architectures. Curated to save you hundreds of hours of trial and error.
        </p>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer capitalize ${
                selectedCategory === cat
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              {cat === 'all' ? 'All Resources' : cat}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search toolkits, guides, prompts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>
      </div>

      {/* Resource Grid */}
      {filteredResources.length === 0 ? (
        <div className="p-12 rounded-3xl bg-white border border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <Download className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No resources found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No tools or guides match your search criteria. Try a different keyword or reset filters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredResources.map((res) => {
            const isFeatured = Boolean(res.isFeatured ?? res.featured);
            const thumb = res.thumbnailUrl || res.coverImage;
            const resTitle = res.title || res.name;
            const resType = res.resourceType || res.type || 'Guide';
            const fileMeta = res.fileSize || res.fileType || res.format || 'PDF Asset';
            const connectedFrameworks = findFrameworksForResource(res, frameworks, isAdminAuthenticated);

            return (
              <div
                key={res.id}
                className="p-7 rounded-3xl bg-white border border-slate-200 hover:border-amber-400 transition-all group flex flex-col justify-between space-y-6 shadow-xs hover:shadow-md"
              >
                <div className="space-y-4">
                  {/* Optional Card Cover Thumbnail */}
                  {thumb && (
                    <div className="relative rounded-2xl overflow-hidden aspect-video bg-slate-100 border border-slate-100">
                      <img
                        src={thumb}
                        alt={resTitle}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                      />
                      {isFeatured && (
                        <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/80 text-amber-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-md">
                          <Star className="w-2.5 h-2.5 fill-current" />
                          Featured
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded border border-amber-200 uppercase tracking-wider">
                      {resType}
                    </span>
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-mono font-medium">
                      {res.readingTimeMinutes && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {res.readingTimeMinutes} min
                        </span>
                      )}
                      <span>{res.downloadCount || 0}+ downloads</span>
                    </div>
                  </div>

                  <h2 className="text-xl font-display font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
                    {resTitle}
                  </h2>

                  <p className="text-slate-600 text-xs sm:text-sm font-interface leading-relaxed line-clamp-3">
                    {res.description}
                  </p>

                  {(res.previewPoints && res.previewPoints.length > 0) || (res.whatIsIncluded && res.whatIsIncluded.length > 0) ? (
                    <div className="space-y-1.5 pt-2">
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Included in toolkit:</div>
                      {(res.previewPoints || res.whatIsIncluded || []).slice(0, 3).map((item, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-slate-700">
                          <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {connectedFrameworks.length > 0 && (
                    <div className="pt-3 border-t border-slate-100">
                      <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-orange-50/80 border border-orange-200/60 text-xs">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Layers className="w-3.5 h-3.5 text-[#FF6B00] shrink-0" />
                          <span className="font-mono text-[10px] text-orange-950 font-bold uppercase truncate">
                            Built for: {connectedFrameworks[0].title}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/frameworks/${connectedFrameworks[0].slug}`);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="text-[11px] font-bold text-[#FF6B00] hover:text-[#e66000] whitespace-nowrap inline-flex items-center gap-0.5 cursor-pointer"
                        >
                          <span>Explore</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    id={`download-btn-${res.slug}`}
                    onClick={() => handleDownloadClick(res)}
                    className="flex-1 py-3 rounded-xl bg-slate-900 hover:bg-amber-600 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    <Download className="w-4 h-4" />
                    <span>
                      {isAuthenticatedStudent
                        ? (res.externalUrl ? '1-Click Student Access' : `Instant Download (${fileMeta})`)
                        : (res.externalUrl ? 'Access Toolkit' : `Download Free (${fileMeta})`)}
                    </span>
                  </button>

                  <button
                    id={`bookmark-resource-${res.id}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleResourceBookmark(res.id);
                    }}
                    className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center transition-all cursor-pointer shadow-xs ${
                      isBookmarked('resource', res.id)
                        ? 'bg-orange-50 border-orange-200 text-[#FF6B00] hover:bg-orange-100'
                        : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 hover:text-slate-900'
                    }`}
                    title={isBookmarked('resource', res.id) ? 'Saved to bookmarks' : 'Save toolkit'}
                  >
                    <Bookmark className={`w-4 h-4 ${isBookmarked('resource', res.id) ? 'fill-[#FF6B00]' : ''}`} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Strategic Call to Action */}
      <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-[#07111F] via-[#0B1E3B] to-[#07111F] border border-slate-800 text-center space-y-6 shadow-xl text-white">
        <div className="text-xs font-bold uppercase tracking-widest text-[#FF6B00] font-interface">
          Accelerate Your Growth Velocity
        </div>
        <h2 className="text-2xl sm:text-4xl font-display font-bold text-white tracking-tight">
          Looking for Step-by-Step Training or Direct Advisory?
        </h2>
        <p className="text-slate-300 text-sm sm:text-base max-w-xl mx-auto font-interface">
          Learn our full growth systems in our executive courses or schedule a dedicated 1-on-1 strategic consultation.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <button
            onClick={() => navigate('/learn')}
            className="px-8 py-3.5 rounded-xl bg-white hover:bg-slate-100 text-[#07111F] font-bold text-xs uppercase tracking-widest shadow-xl inline-flex items-center gap-2 cursor-pointer transition-all"
          >
            <span>LEARN WITH DIGITAL MUID</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate('/business-growth-consultation')}
            className="px-8 py-3.5 rounded-xl bg-[#FF6B00] hover:bg-[#e66000] text-white font-bold text-xs uppercase tracking-widest shadow-xl inline-flex items-center gap-2 cursor-pointer transition-all"
          >
            <span>BOOK A CONSULTATION</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Email Capture / Direct Download Modal */}
      {activeDownloadResource && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 relative shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="absolute top-5 right-5 flex items-center gap-1.5">
              <button
                id={`modal-bookmark-btn-${activeDownloadResource.id}`}
                type="button"
                onClick={() => handleToggleResourceBookmark(activeDownloadResource.id)}
                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                  isBookmarked('resource', activeDownloadResource.id)
                    ? 'bg-orange-50 border-orange-200 text-[#FF6B00]'
                    : 'text-slate-400 hover:text-slate-900 border-transparent hover:border-slate-200'
                }`}
                title={isBookmarked('resource', activeDownloadResource.id) ? 'Saved' : 'Save toolkit'}
              >
                <Bookmark className={`w-4 h-4 ${isBookmarked('resource', activeDownloadResource.id) ? 'fill-[#FF6B00]' : ''}`} />
              </button>
              <button
                onClick={handleModalClose}
                className="text-slate-400 hover:text-slate-900 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isCompleted || isAuthenticatedStudent ? (
              <div className="text-center py-6 space-y-6">
                <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200 shadow-xs">
                  <CheckCircle2 className="w-10 h-10" />
                </div>

                <div className="space-y-2">
                  {isAuthenticatedStudent ? (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 font-interface">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Student Verified Access</span>
                    </div>
                  ) : null}
                  <h3 className="text-2xl font-display font-bold text-slate-900">
                    {activeDownloadResource.title || activeDownloadResource.name}
                  </h3>
                  <p className="text-slate-800 text-sm font-semibold">
                    {isAuthenticatedStudent
                      ? `Welcome, ${userProfile?.fullName?.split(' ')[0] || 'Student'}! Your toolkit is ready.`
                      : "You're In! 🎉"}
                  </p>
                  <p className="text-slate-600 text-xs">
                    {isAuthenticatedStudent
                      ? 'Lead capture is bypassed for enrolled students. Click below to access your toolkit directly.'
                      : 'Click below to access your free resource.'}
                  </p>
                </div>

                {downloadError && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium text-left">
                    {downloadError}
                  </div>
                )}

                <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center items-center">
                  <button
                    type="button"
                    onClick={handleTriggerDownload}
                    disabled={isDownloading}
                    className="w-full sm:flex-1 py-3.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-60"
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>PREPARING RESOURCE...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>DOWNLOAD RESOURCE</span>
                      </>
                    )}
                  </button>
                  <button
                    id={`modal-action-bookmark-btn-${activeDownloadResource.id}`}
                    type="button"
                    onClick={() => handleToggleResourceBookmark(activeDownloadResource.id)}
                    className={`w-full sm:w-auto px-4 py-3.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      isBookmarked('resource', activeDownloadResource.id)
                        ? 'bg-orange-50 border-orange-200 text-[#FF6B00]'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                    }`}
                  >
                    <Bookmark className={`w-4 h-4 ${isBookmarked('resource', activeDownloadResource.id) ? 'fill-[#FF6B00]' : ''}`} />
                    <span>{isBookmarked('resource', activeDownloadResource.id) ? 'Saved' : 'Save'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleModalClose}
                    className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitLead} className="space-y-4">
                <div className="space-y-2">
                  <div className="text-xs font-mono font-bold text-amber-700 uppercase">
                    Free Instant Access · {activeDownloadResource.fileSize || activeDownloadResource.fileType || activeDownloadResource.format || 'Resource Asset'}
                  </div>
                  <h3 className="text-2xl font-display font-bold text-slate-900">
                    {activeDownloadResource.title || activeDownloadResource.name}
                  </h3>
                  <p className="text-xs text-slate-600">
                    Enter your professional details below to immediately unlock and download this asset.
                  </p>
                </div>

                {formError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                    {formError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-700 font-semibold block">Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="Aditi Sharma"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-700 font-semibold block">Mobile / WhatsApp *</label>
                    <input
                      type="tel"
                      required
                      placeholder="+91 98765 43210"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-700 font-semibold block">Email Address *</label>
                    <input
                      type="email"
                      required
                      placeholder="aditi@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-700 font-semibold block">Profession / Role *</label>
                    <input
                      type="text"
                      required
                      placeholder="Founder / Growth Lead / Marketer"
                      value={profession}
                      onChange={(e) => setProfession(e.target.value)}
                      className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Direct instant download. Zero spam.</span>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmittingLead}
                    className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    <span>{isSubmittingLead ? 'Unlocking Resource...' : 'Unlock & Access Resource'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
