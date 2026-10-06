import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Bookmark,
  BookmarkCheck,
  Trash2,
  ArrowRight,
  Download,
  ExternalLink,
  BookOpen,
  Play,
  Compass,
  FileText,
  Filter,
  Search,
  ArrowLeft,
  Loader2,
  Clock,
  Layers,
  CheckCircle2
} from 'lucide-react';
import { BookmarkContentType, SavedContentItem, Resource } from '../types';
import { resourceService } from '../services';

interface SavedContentPageProps {
  navigate: (path: string) => void;
}

type FilterTab = 'all' | 'resource' | 'framework' | 'article' | 'video';

export const SavedContentPage: React.FC<SavedContentPageProps> = ({ navigate }) => {
  const {
    currentUser,
    isStudentAuthenticated,
    studentBookmarks,
    isBookmarksLoading,
    toggleBookmark,
    resources,
    frameworks,
    articles,
    videos,
    notify
  } = useApp();

  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Redirect to login if visitor is not authenticated
  if (!currentUser && !isStudentAuthenticated) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4 py-16 bg-[#F8FAFC]">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200/80 shadow-xl p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#FF6B00]/10 border border-[#FF6B00]/20 flex items-center justify-center mx-auto mb-5">
            <Bookmark className="w-8 h-8 text-[#FF6B00]" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Student Access Required</h1>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            Please sign in to your student account to access your saved toolkits, interactive frameworks, essays, and video masterclasses.
          </p>
          <div className="flex flex-col gap-3">
            <button
              id="saved-signin-btn"
              type="button"
              onClick={() => navigate('/login')}
              className="w-full py-3 px-4 bg-[#FF6B00] hover:bg-[#e66000] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors cursor-pointer shadow-md shadow-[#FF6B00]/20 flex items-center justify-center gap-2"
            >
              <span>Sign In to Student Portal</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => navigate('/resources')}
              className="w-full py-2.5 px-4 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            >
              Browse Public Toolkits & Resources
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Resolve bookmarks into actual content items, strictly enforcing publication status
  const resolvedSavedItems = useMemo<SavedContentItem[]>(() => {
    if (!studentBookmarks || studentBookmarks.length === 0) return [];

    const items: SavedContentItem[] = [];

    studentBookmarks.forEach((bm) => {
      if (bm.contentType === 'resource') {
        const res = (resources || []).find(
          (r) => (r.id === bm.contentId || r.slug === bm.contentId) && (r.status === 'published' || !r.status)
        );
        if (res) {
          items.push({
            bookmarkId: bm.id,
            contentType: 'resource',
            contentId: bm.contentId,
            createdAt: bm.createdAt,
            title: res.title || res.name || 'Untitled Resource',
            description: res.description,
            slug: res.slug,
            category: res.category || 'Digital Growth',
            thumbnailUrl: res.thumbnailUrl || res.coverImage,
            author: res.author || 'Digital Muid',
            publishedAt: res.publishedAt,
            resource: res
          });
        }
      } else if (bm.contentType === 'framework') {
        const fw = (frameworks || []).find(
          (f) => (f.id === bm.contentId || f.slug === bm.contentId) && (f.status === 'published' || !f.status)
        );
        if (fw) {
          items.push({
            bookmarkId: bm.id,
            contentType: 'framework',
            contentId: bm.contentId,
            createdAt: bm.createdAt,
            title: fw.title || fw.name || 'Strategic Framework',
            description: fw.description,
            slug: fw.slug,
            category: fw.category || 'Strategy',
            author: 'Digital Muid',
            framework: fw
          });
        }
      } else if (bm.contentType === 'article') {
        const art = (articles || []).find(
          (a) => (a.id === bm.contentId || a.slug === bm.contentId) && (a.status === 'published' || !a.status)
        );
        if (art) {
          items.push({
            bookmarkId: bm.id,
            contentType: 'article',
            contentId: bm.contentId,
            createdAt: bm.createdAt,
            title: art.title || 'Strategic Essay',
            description: art.excerpt || art.summary || art.description,
            slug: art.slug,
            category: art.category || 'Growth & AI',
            thumbnailUrl: art.coverImage || art.imageUrl,
            author: art.author || 'Digital Muid',
            publishedAt: art.publishedAt || art.date,
            article: art
          });
        }
      } else if (bm.contentType === 'video') {
        const vid = (videos || []).find(
          (v) => (v.id === bm.contentId || v.slug === bm.contentId) && (v.status === 'published' || !v.status)
        );
        if (vid) {
          items.push({
            bookmarkId: bm.id,
            contentType: 'video',
            contentId: bm.contentId,
            createdAt: bm.createdAt,
            title: vid.title || 'Video Breakdown',
            description: vid.description,
            slug: vid.slug,
            category: vid.category || 'Masterclasses',
            thumbnailUrl: vid.thumbnailUrl || vid.thumbnail,
            author: vid.instructor || 'Digital Muid',
            publishedAt: vid.publishedAt,
            video: vid
          });
        }
      }
    });

    return items;
  }, [studentBookmarks, resources, frameworks, articles, videos]);

  // Counts by content type
  const counts = useMemo(() => {
    return {
      all: resolvedSavedItems.length,
      resource: resolvedSavedItems.filter((i) => i.contentType === 'resource').length,
      framework: resolvedSavedItems.filter((i) => i.contentType === 'framework').length,
      article: resolvedSavedItems.filter((i) => i.contentType === 'article').length,
      video: resolvedSavedItems.filter((i) => i.contentType === 'video').length
    };
  }, [resolvedSavedItems]);

  // Filtered by tab and search
  const filteredItems = useMemo(() => {
    let result = resolvedSavedItems;
    if (activeTab !== 'all') {
      result = result.filter((i) => i.contentType === activeTab);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          (i.description && i.description.toLowerCase().includes(q)) ||
          (i.category && i.category.toLowerCase().includes(q))
      );
    }
    return result;
  }, [resolvedSavedItems, activeTab, searchQuery]);

  // Direct Resource Download Action
  const handleDeliverResource = async (res: Resource) => {
    if (!res) return;
    setDownloadingId(res.id);
    try {
      const result = await resourceService.deliverResource(res);
      if (result.success) {
        notify(`Opening "${res.title || res.name || 'Resource'}"...`, 'success');
      } else {
        notify(result.error || 'Unable to open file right now. Please try again.', 'error');
      }
    } catch (err: any) {
      notify('Download error. Please try again.', 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleRemove = async (item: SavedContentItem) => {
    await toggleBookmark(item.contentType, item.contentId);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header Banner */}
      <section className="bg-[#07111F] text-white border-b border-slate-800 relative overflow-hidden py-10 sm:py-14">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,107,0,0.12),transparent_60%)] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <button
                  id="saved-back-to-dashboard-btn"
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Student Dashboard</span>
                </button>
                <span className="text-slate-600">/</span>
                <span className="text-xs font-semibold text-[#FF6B00]">Saved Items</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                <BookmarkCheck className="w-7 h-7 text-[#FF6B00]" />
                <span>Saved Content & Toolkits</span>
              </h1>
              <p className="text-sm text-slate-300 mt-2 max-w-2xl leading-relaxed">
                Your personal reference collection. Curate executive frameworks, prompt playbooks, strategic essays, and video masterclasses for quick recall across your devices.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-2.5 text-right">
                <div className="text-2xl font-black text-white">{counts.all}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Bookmarked</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Workspace */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Navigation Filters & Search */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 lg:pb-0 scrollbar-none">
            <button
              id="tab-saved-all"
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'all'
                  ? 'bg-[#FF6B00] text-white shadow-md shadow-[#FF6B00]/20'
                  : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span>All Saved</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] ${activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {counts.all}
              </span>
            </button>

            <button
              id="tab-saved-resources"
              type="button"
              onClick={() => setActiveTab('resource')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'resource'
                  ? 'bg-[#FF6B00] text-white shadow-md shadow-[#FF6B00]/20'
                  : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Toolkits & Resources</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] ${activeTab === 'resource' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {counts.resource}
              </span>
            </button>

            <button
              id="tab-saved-frameworks"
              type="button"
              onClick={() => setActiveTab('framework')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'framework'
                  ? 'bg-[#FF6B00] text-white shadow-md shadow-[#FF6B00]/20'
                  : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Frameworks</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] ${activeTab === 'framework' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {counts.framework}
              </span>
            </button>

            <button
              id="tab-saved-articles"
              type="button"
              onClick={() => setActiveTab('article')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'article'
                  ? 'bg-[#FF6B00] text-white shadow-md shadow-[#FF6B00]/20'
                  : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Insights & Articles</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] ${activeTab === 'article' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {counts.article}
              </span>
            </button>

            <button
              id="tab-saved-videos"
              type="button"
              onClick={() => setActiveTab('video')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'video'
                  ? 'bg-[#FF6B00] text-white shadow-md shadow-[#FF6B00]/20'
                  : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              <span>Video Breakdowns</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] ${activeTab === 'video' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {counts.video}
              </span>
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative w-full lg:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="saved-content-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search saved items..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/20 focus:border-[#FF6B00]"
            />
          </div>
        </div>

        {/* Loading State */}
        {isBookmarksLoading && resolvedSavedItems.length === 0 ? (
          <div className="py-20 text-center">
            <Loader2 className="w-8 h-8 text-[#FF6B00] animate-spin mx-auto mb-3" />
            <p className="text-xs font-semibold text-slate-500">Loading your saved content...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          /* Empty State */
          <div className="py-16 text-center max-w-lg mx-auto bg-white rounded-2xl border border-slate-200/80 p-8 shadow-sm mt-6">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto mb-4 text-slate-400">
              <Bookmark className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              {searchQuery ? 'No matching saved items found' : 'No items saved in this category yet'}
            </h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              {searchQuery
                ? 'Try broadening your search query or switch back to the "All Saved" tab.'
                : 'Bookmark toolkits, strategic frameworks, essays, and masterclasses across the site to build your personalized reference library.'}
            </p>

            <div className="grid grid-cols-2 gap-2.5 max-w-md mx-auto">
              <button
                type="button"
                onClick={() => navigate('/resources')}
                className="p-2.5 bg-slate-50 hover:bg-[#FF6B00]/5 border border-slate-200 hover:border-[#FF6B00]/30 rounded-xl text-left transition-all cursor-pointer text-xs group"
              >
                <div className="font-semibold text-slate-800 group-hover:text-[#FF6B00] flex items-center justify-between">
                  <span>Toolkits Hub</span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Spreadsheets & Guides</div>
              </button>

              <button
                type="button"
                onClick={() => navigate('/frameworks')}
                className="p-2.5 bg-slate-50 hover:bg-[#FF6B00]/5 border border-slate-200 hover:border-[#FF6B00]/30 rounded-xl text-left transition-all cursor-pointer text-xs group"
              >
                <div className="font-semibold text-slate-800 group-hover:text-[#FF6B00] flex items-center justify-between">
                  <span>Frameworks</span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Strategic Blueprints</div>
              </button>

              <button
                type="button"
                onClick={() => navigate('/blog')}
                className="p-2.5 bg-slate-50 hover:bg-[#FF6B00]/5 border border-slate-200 hover:border-[#FF6B00]/30 rounded-xl text-left transition-all cursor-pointer text-xs group"
              >
                <div className="font-semibold text-slate-800 group-hover:text-[#FF6B00] flex items-center justify-between">
                  <span>Insights & Essays</span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Tactical Playbooks</div>
              </button>

              <button
                type="button"
                onClick={() => navigate('/watch')}
                className="p-2.5 bg-slate-50 hover:bg-[#FF6B00]/5 border border-slate-200 hover:border-[#FF6B00]/30 rounded-xl text-left transition-all cursor-pointer text-xs group"
              >
                <div className="font-semibold text-slate-800 group-hover:text-[#FF6B00] flex items-center justify-between">
                  <span>Video Hub</span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Masterclass Breakdowns</div>
              </button>
            </div>
          </div>
        ) : (
          /* Cards Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
            {filteredItems.map((item) => {
              const isResource = item.contentType === 'resource';
              const isFramework = item.contentType === 'framework';
              const isArticle = item.contentType === 'article';
              const isVideo = item.contentType === 'video';

              return (
                <div
                  key={`${item.contentType}-${item.contentId}`}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group hover:border-[#FF6B00]/30"
                >
                  {/* Card Header & Badge */}
                  <div className="p-5 flex-1">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                          isResource
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                            : isFramework
                            ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                            : isArticle
                            ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                            : 'bg-purple-50 text-purple-700 border border-purple-200/60'
                        }`}
                      >
                        {isResource && <Download className="w-3 h-3" />}
                        {isFramework && <Compass className="w-3 h-3" />}
                        {isArticle && <FileText className="w-3 h-3" />}
                        {isVideo && <Play className="w-3 h-3" />}
                        <span>
                          {isResource
                            ? 'Toolkit'
                            : isFramework
                            ? 'Framework'
                            : isArticle
                            ? 'Insight Essay'
                            : 'Video'}
                        </span>
                      </span>

                      {/* Remove Bookmark Action */}
                      <button
                        type="button"
                        onClick={() => handleRemove(item)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Remove from saved items"
                        aria-label={`Remove ${item.title} from saved items`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#FF6B00] transition-colors line-clamp-2 mb-2 leading-snug">
                      {item.title}
                    </h3>

                    {item.description && (
                      <p className="text-xs text-slate-500 line-clamp-2 mb-4 leading-relaxed">
                        {item.description}
                      </p>
                    )}

                    {/* Metadata tags */}
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-auto">
                      {item.category && (
                        <span className="font-medium text-slate-600">{item.category}</span>
                      )}
                      {isArticle && item.article?.readingTime && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{item.article.readingTime}</span>
                        </span>
                      )}
                      {isVideo && item.video?.duration && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{item.video.duration}</span>
                        </span>
                      )}
                      {isFramework && item.framework?.stages && (
                        <span className="flex items-center gap-1">
                          <Layers className="w-3 h-3" />
                          <span>{item.framework.stages.length} Stages</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="p-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-2">
                    {isResource ? (
                      <button
                        type="button"
                        onClick={() => item.resource && handleDeliverResource(item.resource)}
                        disabled={downloadingId === item.contentId}
                        className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        {downloadingId === item.contentId ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Opening...</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5" />
                            <span>Download Toolkit</span>
                          </>
                        )}
                      </button>
                    ) : isFramework ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/frameworks/${item.slug}`)}
                        className="w-full py-2 px-3 bg-[#07111F] hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <span>Explore Blueprint</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : isArticle ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/blog/${item.slug}`)}
                        className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Read Essay</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-auto" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => navigate(`/watch/${item.slug}`)}
                        className="w-full py-2 px-3 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Watch Breakdown</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-auto" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
