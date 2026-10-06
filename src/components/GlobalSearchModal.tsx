import React, { useEffect, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Search,
  X,
  FileText,
  Video,
  Layers,
  Download,
  GraduationCap,
  ArrowRight,
  Sparkles,
  ExternalLink,
  Tag
} from 'lucide-react';
import { Framework, Article, Video as VideoType, Resource, Course } from '../types';

interface GlobalSearchModalProps {
  navigate: (path: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  navigate,
  isOpen: propIsOpen,
  onClose: propOnClose
}) => {
  const {
    isSearchOpen: contextIsOpen,
    setIsSearchOpen,
    searchQuery,
    setSearchQuery,
    articles = [],
    videos = [],
    frameworks = [],
    resources = [],
    courses = [],
    isAdminAuthenticated = false
  } = useApp();

  const isModalOpen = propIsOpen !== undefined ? propIsOpen : contextIsOpen;
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    if (propOnClose) {
      propOnClose();
    }
    setIsSearchOpen(false);
  };

  // Keyboard shortcut Cmd+K / Ctrl+K & Escape handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle search on Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        if (isModalOpen) {
          handleClose();
        } else {
          setIsSearchOpen(true);
        }
      }

      // Close on Escape if open
      if (e.key === 'Escape' && isModalOpen) {
        e.preventDefault();
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, setIsSearchOpen]);

  // Focus input and reset query on open/close
  useEffect(() => {
    if (isModalOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 60);

      // Diagnostic logging on open
      try {
        console.log('[Global Search Diagnostic]', {
          status: 'Search modal opened',
          searchOpened: true,
          articlesAvailable: articles.length,
          videosAvailable: videos.length,
          resourcesAvailable: resources.length,
          frameworksAvailable: frameworks.length,
          coursesAvailable: courses.length,
          isAdmin: isAdminAuthenticated
        });
      } catch {
        // Safe logging
      }

      return () => clearTimeout(timer);
    } else {
      setSearchQuery('');
    }
  }, [isModalOpen]);

  // Safe Token Matcher
  const matchesQuery = (text: string | undefined | null, query: string, tokens: string[]): boolean => {
    if (!text || typeof text !== 'string') return false;
    const lower = text.toLowerCase();
    if (lower.includes(query)) return true;
    return tokens.every((token) => lower.includes(token));
  };

  // Filtered Results with Draft Rules and Defensive Catching
  const {
    filteredArticles,
    filteredVideos,
    filteredFrameworks,
    filteredResources,
    filteredCourses,
    totalResults,
    searchError
  } = useMemo(() => {
    let err: string | null = null;
    const cleanQuery = (searchQuery || '').trim().toLowerCase();
    const tokens = cleanQuery.split(/\s+/).filter(Boolean);

    if (!cleanQuery) {
      return {
        filteredArticles: [],
        filteredVideos: [],
        filteredFrameworks: [],
        filteredResources: [],
        filteredCourses: [],
        totalResults: 0,
        searchError: null
      };
    }

    let fArticles: Article[] = [];
    let fVideos: VideoType[] = [];
    let fFrameworks: Framework[] = [];
    let fResources: Resource[] = [];
    let fCourses: Course[] = [];

    try {
      // 1. Frameworks
      const rawFw = Array.isArray(frameworks) ? frameworks : [];
      fFrameworks = rawFw.filter((fw) => {
        try {
          const isPublished = fw.status === 'published' || (!fw.status && (fw as any).draft !== true);
          if (!isAdminAuthenticated && !isPublished) return false;

          // Search in title, name, slug, subtitle, description, introduction, category, tags
          const title = fw.title || fw.name || '';
          const subtitle = fw.subtitle || '';
          const desc = fw.description || fw.introduction || fw.problemStatement || '';
          const cat = fw.category || '';
          const slug = fw.slug || '';
          const tagsStr = Array.isArray(fw.tags) ? fw.tags.join(' ') : '';

          // Search in stage titles/content
          const stages = (fw.frameworkContent ?? fw.framework_content ?? fw.steps ?? []) as any[];
          const stagesText = stages
            .map((s) => `${s.title || ''} ${s.subtitle || ''} ${s.shortDescription || ''} ${s.description || ''} ${s.content || ''}`)
            .join(' ');

          const fullSearchBlob = `${title} ${subtitle} ${desc} ${cat} ${slug} ${tagsStr} ${stagesText}`;
          return matchesQuery(fullSearchBlob, cleanQuery, tokens);
        } catch {
          return false;
        }
      });

      // 2. Articles
      const rawArt = Array.isArray(articles) ? articles : [];
      fArticles = rawArt.filter((art) => {
        try {
          const isPublished = art.status === 'published' || (!art.status && (art as any).draft !== true);
          if (!isAdminAuthenticated && !isPublished) return false;

          const title = art.title || '';
          const excerpt = art.excerpt || '';
          const cat = art.category || '';
          const slug = art.slug || '';
          const author = typeof art.author === 'string' ? art.author : art.author?.name || '';
          const tagsStr = Array.isArray(art.tags) ? art.tags.join(' ') : '';

          const fullSearchBlob = `${title} ${excerpt} ${cat} ${slug} ${author} ${tagsStr}`;
          return matchesQuery(fullSearchBlob, cleanQuery, tokens);
        } catch {
          return false;
        }
      });

      // 3. Videos
      const rawVid = Array.isArray(videos) ? videos : [];
      fVideos = rawVid.filter((vid) => {
        try {
          const isPublished = vid.status === 'published' || (!vid.status && (vid as any).draft !== true);
          if (!isAdminAuthenticated && !isPublished) return false;

          const title = vid.title || '';
          const desc = vid.description || '';
          const cat = vid.category || '';
          const slug = vid.slug || '';
          const tagsStr = Array.isArray(vid.tags) ? vid.tags.join(' ') : '';

          const fullSearchBlob = `${title} ${desc} ${cat} ${slug} ${tagsStr}`;
          return matchesQuery(fullSearchBlob, cleanQuery, tokens);
        } catch {
          return false;
        }
      });

      // 4. Resources
      const rawRes = Array.isArray(resources) ? resources : [];
      fResources = rawRes.filter((res) => {
        try {
          const isPublished = res.status === 'published' || (!res.status && (res as any).draft !== true);
          if (!isAdminAuthenticated && !isPublished) return false;

          const title = res.title || res.name || '';
          const desc = res.description || '';
          const cat = res.category || '';
          const resType = res.resourceType || res.type || '';
          const slug = res.slug || '';
          const tagsStr = Array.isArray(res.tags) ? res.tags.join(' ') : '';

          const fullSearchBlob = `${title} ${desc} ${cat} ${resType} ${slug} ${tagsStr}`;
          return matchesQuery(fullSearchBlob, cleanQuery, tokens);
        } catch {
          return false;
        }
      });

      // 5. Courses
      const rawCrs = Array.isArray(courses) ? courses : [];
      fCourses = rawCrs.filter((crs) => {
        try {
          const isPublished = crs.status === 'published' || !crs.status;
          if (!isAdminAuthenticated && !isPublished) return false;

          const title = crs.title || '';
          const outcome = crs.shortOutcome || '';
          const desc = crs.description || '';
          const level = crs.level || '';
          const slug = crs.slug || '';
          const tagsStr = Array.isArray(crs.tags) ? crs.tags.join(' ') : '';

          const fullSearchBlob = `${title} ${outcome} ${desc} ${level} ${slug} ${tagsStr}`;
          return matchesQuery(fullSearchBlob, cleanQuery, tokens);
        } catch {
          return false;
        }
      });
    } catch (e: any) {
      err = e?.message || 'Error during search filtering';
    }

    const total =
      fFrameworks.length +
      fArticles.length +
      fVideos.length +
      fResources.length +
      fCourses.length;

    // Diagnostic logging on query change
    try {
      console.log('[Global Search Diagnostic]', {
        SearchOpened: isModalOpen,
        Query: cleanQuery,
        ArticlesSearched: fArticles.length,
        VideosSearched: fVideos.length,
        ResourcesSearched: fResources.length,
        FrameworksSearched: fFrameworks.length,
        CoursesSearched: fCourses.length,
        TotalResults: total,
        NavigationTarget: null,
        Error: err
      });
    } catch {
      // Safe logging
    }

    return {
      filteredArticles: fArticles,
      filteredVideos: fVideos,
      filteredFrameworks: fFrameworks,
      filteredResources: fResources,
      filteredCourses: fCourses,
      totalResults: total,
      searchError: err
    };
  }, [searchQuery, articles, videos, frameworks, resources, courses, isAdminAuthenticated, isModalOpen]);

  const handleSelect = (path: string, itemType: string, itemTitle: string) => {
    try {
      console.log('[Global Search Diagnostic]', {
        SearchOpened: false,
        Query: searchQuery,
        ArticlesSearched: filteredArticles.length,
        VideosSearched: filteredVideos.length,
        ResourcesSearched: filteredResources.length,
        FrameworksSearched: filteredFrameworks.length,
        TotalResults: totalResults,
        NavigationTarget: path,
        SelectedType: itemType,
        SelectedTitle: itemTitle,
        Error: null
      });
    } catch {
      // Safe logging
    }

    handleClose();
    navigate(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!isModalOpen) return null;

  const query = (searchQuery || '').trim();

  return (
    <div
      id="global-search-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-start justify-center pt-12 sm:pt-20 px-3 sm:px-4 overflow-y-auto"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="search-modal-title"
    >
      <div
        className="w-full max-w-3xl bg-[#0B1526] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-auto sm:my-0 flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header Input */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-800 gap-3 bg-slate-900/90 shrink-0">
          <Search className="w-5 h-5 text-[#FF6B00] shrink-0" />
          <input
            id="global-search-input"
            ref={inputRef}
            type="text"
            placeholder="Search frameworks, articles, videos, resources, courses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-white placeholder-slate-400 text-sm sm:text-base focus:outline-none"
            aria-label="Search knowledge base"
            autoComplete="off"
            spellCheck="false"
          />
          {searchQuery && (
            <button
              id="clear-search-btn"
              type="button"
              onClick={() => setSearchQuery('')}
              className="p-1 text-slate-400 hover:text-white rounded cursor-pointer transition-colors"
              title="Clear search"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] text-slate-400 px-2 py-0.5 bg-slate-800 rounded border border-slate-700 hidden sm:inline font-mono">
              ESC
            </span>
            <button
              id="close-search-modal-btn"
              type="button"
              onClick={handleClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer transition-colors sm:hidden"
              aria-label="Close search"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Results / Suggestions Container */}
        <div className="overflow-y-auto p-4 sm:p-5 space-y-6 flex-1">
          {searchError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              Search Diagnostic Alert: {searchError}
            </div>
          )}

          {!query ? (
            <div className="py-8 sm:py-10 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#FF6B00]/10 border border-[#FF6B00]/20 flex items-center justify-center mx-auto text-[#FF6B00]">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 id="search-modal-title" className="text-slate-200 font-display font-bold text-base">
                  Search Digital Muid's Knowledge Ecosystem
                </h4>
                <p className="text-xs text-slate-400 font-interface max-w-md mx-auto">
                  Instant real-time search across proprietary frameworks, in-depth articles, teardown videos, and downloadable tools.
                </p>
              </div>

              {/* Popular Search Suggestions */}
              <div className="pt-3 space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-interface">
                  Suggested Topics
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 max-w-lg mx-auto">
                  {[
                    'Digital Growth Framework',
                    'Personal Authority',
                    'AI Transformation',
                    'Meta Ads Strategy',
                    'Conversion Architecture',
                    'Growth Stack',
                    'Automation'
                  ].map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => setSearchQuery(term)}
                      className="text-xs px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Tag className="w-3 h-3 text-[#FF6B00]" />
                      <span>{term}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : totalResults === 0 ? (
            <div className="py-12 sm:py-16 text-center text-slate-400 space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
                <Search className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-semibold text-slate-200">
                  No results found for &ldquo;{query}&rdquo;
                </p>
                <p className="text-xs text-slate-400 font-interface max-w-sm mx-auto">
                  We couldn't find any published content matching your search. Try searching for terms like <em>Growth</em>, <em>AI</em>, <em>Authority</em>, or <em>Automation</em>.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Category 1: Proprietary Frameworks */}
              {filteredFrameworks.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#FF6B00] font-interface">
                      <Layers className="w-4 h-4" />
                      <span>Proprietary Frameworks</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      {filteredFrameworks.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {filteredFrameworks.map((fw) => {
                      const stages = (fw.frameworkContent ?? fw.framework_content ?? fw.steps ?? []) as any[];
                      return (
                        <button
                          key={fw.id || fw.slug}
                          type="button"
                          onClick={() => handleSelect(`/frameworks/${fw.slug}`, 'Framework', fw.title || fw.name || '')}
                          className="w-full p-3.5 rounded-xl bg-slate-900/60 hover:bg-slate-800/90 border border-slate-800 hover:border-[#FF6B00]/40 text-left flex items-center justify-between group transition-all cursor-pointer"
                        >
                          <div className="space-y-1 min-w-0 pr-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#FF6B00]/15 text-[#FF6B00] border border-[#FF6B00]/25">
                                Framework
                              </span>
                              {fw.category && (
                                <span className="text-[10px] text-slate-400 font-interface">
                                  {fw.category}
                                </span>
                              )}
                              {stages.length > 0 && (
                                <span className="text-[10px] text-slate-400 font-interface">
                                  • {stages.length} Stages
                                </span>
                              )}
                              {isAdminAuthenticated && fw.status === 'draft' && (
                                <span className="text-[10px] font-bold uppercase px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded">
                                  Draft
                                </span>
                              )}
                            </div>
                            <h5 className="text-sm font-bold text-white group-hover:text-[#FF6B00] transition-colors truncate">
                              {fw.title || fw.name}
                            </h5>
                            {(fw.subtitle || fw.description) && (
                              <p className="text-xs text-slate-400 font-interface line-clamp-1">
                                {fw.subtitle || fw.description}
                              </p>
                            )}
                          </div>
                          <div className="w-8 h-8 rounded-lg bg-slate-800 group-hover:bg-[#FF6B00] flex items-center justify-center text-slate-400 group-hover:text-white transition-all shrink-0">
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Category 2: Articles & Insights */}
              {filteredArticles.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#1877F2] font-interface">
                      <FileText className="w-4 h-4" />
                      <span>Articles & Insights</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      {filteredArticles.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {filteredArticles.map((art) => (
                      <button
                        key={art.id || art.slug}
                        type="button"
                        onClick={() => handleSelect(`/insights/${art.slug}`, 'Article', art.title)}
                        className="w-full p-3.5 rounded-xl bg-slate-900/60 hover:bg-slate-800/90 border border-slate-800 hover:border-[#1877F2]/40 text-left flex items-center justify-between group transition-all cursor-pointer"
                      >
                        <div className="space-y-1 min-w-0 pr-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#1877F2]/15 text-[#1877F2] border border-[#1877F2]/25">
                              Article
                            </span>
                            {art.category && (
                              <span className="text-[10px] text-slate-400 font-interface">
                                {art.category}
                              </span>
                            )}
                            {(art.readTime || art.readingTimeMinutes) && (
                              <span className="text-[10px] text-slate-400 font-interface">
                                • {art.readTime || `${art.readingTimeMinutes} min read`}
                              </span>
                            )}
                            {isAdminAuthenticated && art.status === 'draft' && (
                              <span className="text-[10px] font-bold uppercase px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded">
                                Draft
                              </span>
                            )}
                          </div>
                          <h5 className="text-sm font-bold text-white group-hover:text-[#1877F2] transition-colors truncate">
                            {art.title}
                          </h5>
                          {art.excerpt && (
                            <p className="text-xs text-slate-400 font-interface line-clamp-1">
                              {art.excerpt}
                            </p>
                          )}
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-slate-800 group-hover:bg-[#1877F2] flex items-center justify-center text-slate-400 group-hover:text-white transition-all shrink-0">
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Category 3: Videos */}
              {filteredVideos.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-400 font-interface">
                      <Video className="w-4 h-4" />
                      <span>Watch & Video Breakdowns</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      {filteredVideos.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {filteredVideos.map((vid) => (
                      <button
                        key={vid.id || vid.slug}
                        type="button"
                        onClick={() => handleSelect(`/watch/${vid.slug}`, 'Video', vid.title)}
                        className="w-full p-3.5 rounded-xl bg-slate-900/60 hover:bg-slate-800/90 border border-slate-800 hover:border-purple-500/40 text-left flex items-center justify-between group transition-all cursor-pointer"
                      >
                        <div className="space-y-1 min-w-0 pr-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-500/15 text-purple-400 border border-purple-500/25">
                              Video
                            </span>
                            {vid.category && (
                              <span className="text-[10px] text-slate-400 font-interface">
                                {vid.category}
                              </span>
                            )}
                            {vid.duration && (
                              <span className="text-[10px] text-slate-400 font-interface">
                                • {vid.duration}
                              </span>
                            )}
                          </div>
                          <h5 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors truncate">
                            {vid.title}
                          </h5>
                          {vid.description && (
                            <p className="text-xs text-slate-400 font-interface line-clamp-1">
                              {vid.description}
                            </p>
                          )}
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-slate-800 group-hover:bg-purple-500 flex items-center justify-center text-slate-400 group-hover:text-white transition-all shrink-0">
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Category 4: Resources */}
              {filteredResources.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400 font-interface">
                      <Download className="w-4 h-4" />
                      <span>Free Resources & Toolkits</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      {filteredResources.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {filteredResources.map((res) => (
                      <button
                        key={res.id || res.slug}
                        type="button"
                        onClick={() => handleSelect(`/resources/${res.slug}`, 'Resource', res.title || res.name || '')}
                        className="w-full p-3.5 rounded-xl bg-slate-900/60 hover:bg-slate-800/90 border border-slate-800 hover:border-amber-500/40 text-left flex items-center justify-between group transition-all cursor-pointer"
                      >
                        <div className="space-y-1 min-w-0 pr-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/25">
                              {res.resourceType || res.type || 'Resource'}
                            </span>
                            {res.category && (
                              <span className="text-[10px] text-slate-400 font-interface">
                                {res.category}
                              </span>
                            )}
                            {res.fileType && (
                              <span className="text-[10px] text-slate-400 font-interface">
                                • {res.fileType}
                              </span>
                            )}
                          </div>
                          <h5 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors truncate">
                            {res.title || res.name}
                          </h5>
                          {res.description && (
                            <p className="text-xs text-slate-400 font-interface line-clamp-1">
                              {res.description}
                            </p>
                          )}
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-slate-800 group-hover:bg-amber-500 flex items-center justify-center text-slate-400 group-hover:text-white transition-all shrink-0">
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Category 5: Courses */}
              {filteredCourses.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400 font-interface">
                      <GraduationCap className="w-4 h-4" />
                      <span>Courses & Masterclasses</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      {filteredCourses.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {filteredCourses.map((crs) => (
                      <button
                        key={crs.id || crs.slug}
                        type="button"
                        onClick={() => handleSelect(`/learn/${crs.slug}`, 'Course', crs.title)}
                        className="w-full p-3.5 rounded-xl bg-slate-900/60 hover:bg-slate-800/90 border border-slate-800 hover:border-emerald-500/40 text-left flex items-center justify-between group transition-all cursor-pointer"
                      >
                        <div className="space-y-1 min-w-0 pr-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                              Course
                            </span>
                            {crs.level && (
                              <span className="text-[10px] text-slate-400 font-interface">
                                {crs.level}
                              </span>
                            )}
                            {crs.duration && (
                              <span className="text-[10px] text-slate-400 font-interface">
                                • {crs.duration}
                              </span>
                            )}
                          </div>
                          <h5 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors truncate">
                            {crs.title}
                          </h5>
                          {(crs.shortOutcome || crs.description) && (
                            <p className="text-xs text-slate-400 font-interface line-clamp-1">
                              {crs.shortOutcome || crs.description}
                            </p>
                          )}
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-slate-800 group-hover:bg-emerald-500 flex items-center justify-center text-slate-400 group-hover:text-white transition-all shrink-0">
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Bar */}
        <div className="px-4 py-3 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-interface shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-[10px] font-mono text-slate-300">
                ↵
              </kbd>
              <span>to select</span>
            </span>
            <span className="hidden sm:inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-[10px] font-mono text-slate-300">
                esc
              </kbd>
              <span>to close</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">
              {totalResults > 0 ? `${totalResults} result${totalResults === 1 ? '' : 's'}` : 'Global Search'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
