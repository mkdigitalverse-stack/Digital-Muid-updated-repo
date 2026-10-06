import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Search, ArrowRight, Clock, Sparkles, Loader2, Bookmark } from 'lucide-react';
import { articleService } from '../services/articleService';
import { isSupabaseConfigured } from '../lib/supabase';
import { Article } from '../types';

interface InsightsPageProps {
  navigate: (path: string) => void;
}

export const InsightsPage: React.FC<InsightsPageProps> = ({ navigate }) => {
  const {
    articles: contextArticles,
    isBookmarked,
    toggleBookmark,
    currentUser,
    notify
  } = useApp();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchFilter, setSearchFilter] = useState('');
  const [fetchedArticles, setFetchedArticles] = useState<Article[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(isSupabaseConfigured());
  const [articleSource, setArticleSource] = useState<'Supabase' | 'LocalStorage' | 'InitialData'>('InitialData');

  const categories = ['All', 'AI', 'Growth', 'Marketing', 'Personal Branding', 'Business', 'Technology'];

  const handleToggleArticleBookmark = async (e: React.MouseEvent, articleId: string) => {
    e.stopPropagation();
    if (!currentUser) {
      notify('Please sign in to save articles to your student portal.', 'info');
      navigate('/login');
      return;
    }
    await toggleBookmark('article', articleId);
  };

  // Authoritative published articles fetch from Supabase on mount
  useEffect(() => {
    let isMounted = true;

    if (!isSupabaseConfigured()) {
      setIsLoading(false);
      setArticleSource('InitialData');
      console.info('[Articles Diagnostic]\nArticles source: InitialData\nSupabase configured: false\nSupabase request successful: false\nSupabase article count: 0\nPublic article count: ' + contextArticles.filter(a => a.status === 'published').length);
      return;
    }

    articleService.fetchPublishedArticles().then((res) => {
      if (!isMounted) return;

      if (res.data !== null && !res.error) {
        // Successful Supabase response (even if data is [])
        setFetchedArticles(res.data);
        setArticleSource('Supabase');
        setIsLoading(false);

        const publishedSlugs = res.data.map(a => ({ slug: a.slug, status: a.status }));
        console.info(
          `[Articles Diagnostic]\nArticles source: Supabase\nSupabase configured: true\nSupabase request successful: true\nSupabase article count: ${res.data.length}\nPublic article count: ${res.data.length}\nPublished Items: ${JSON.stringify(publishedSlugs)}`
        );
      } else {
        // Fallback to local storage / context articles if Supabase request failed
        console.warn('[Articles Diagnostic]\nArticles source: LocalStorage\nSupabase configured: true\nSupabase request successful: false\nError:', res.error);
        setArticleSource('LocalStorage');
        setIsLoading(false);
      }
    }).catch((err) => {
      if (!isMounted) return;
      console.error('[Articles Diagnostic] Unexpected error during public articles sync:', err);
      setArticleSource('LocalStorage');
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Determine active articles list: prioritize authoritative Supabase fetched results if available
  const activeArticles = fetchedArticles !== null
    ? fetchedArticles
    : (isSupabaseConfigured() && isLoading ? [] : contextArticles);

  const filteredArticles = activeArticles.filter((art) => {
    const matchesCategory = selectedCategory === 'All' || art.category === selectedCategory;
    const searchLower = searchFilter.toLowerCase().trim();
    const matchesSearch =
      !searchLower ||
      (art.title && art.title.toLowerCase().includes(searchLower)) ||
      (art.excerpt && art.excerpt.toLowerCase().includes(searchLower)) ||
      (Array.isArray(art.tags) && art.tags.some((t) => t && t.toLowerCase().includes(searchLower))) ||
      (typeof art.author === 'string' && art.author.toLowerCase().includes(searchLower)) ||
      (typeof art.author === 'object' && art.author?.name && art.author.name.toLowerCase().includes(searchLower));
    return matchesCategory && matchesSearch && art.status === 'published';
  });

  return (
    <div id="insights-page-root" className="pt-28 sm:pt-32 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
      {/* Header */}
      <div className="max-w-3xl space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#1877F2] text-xs font-bold uppercase tracking-wider font-interface">
          <Sparkles className="w-3.5 h-3.5" /> Essays & Market Theses
        </div>
        <h1 className="text-4xl sm:text-5xl font-display font-bold text-slate-900 tracking-tight">
          Insights & Strategic Analysis
        </h1>
        <p className="text-slate-600 text-base sm:text-lg font-interface">
          Original essays on AI transformation, founder authority, modern marketing architecture, and digital economics. Written for leaders who value depth over soundbites.
        </p>
      </div>

      {/* Controls: Search and Category Pills */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#1877F2] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Filter Input */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search insights..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:border-[#1877F2]"
          />
        </div>
      </div>

      {/* Articles Grid */}
      {isLoading && isSupabaseConfigured() ? (
        <div className="text-center py-20 space-y-4">
          <Loader2 className="w-8 h-8 text-[#1877F2] animate-spin mx-auto" />
          <p className="text-slate-500 text-sm font-interface">Loading strategic insights...</p>
        </div>
      ) : filteredArticles.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <p className="text-slate-500 text-base">No articles found matching your criteria.</p>
          <button
            onClick={() => { setSelectedCategory('All'); setSearchFilter(''); }}
            className="text-xs text-[#1877F2] font-semibold hover:underline cursor-pointer"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredArticles.map((art) => (
            <article
              key={art.id}
              onClick={() => navigate(`/insights/${art.slug}`)}
              className="p-6 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 hover:-translate-y-1 transition-all group cursor-pointer flex flex-col justify-between space-y-6 shadow-sm hover:shadow-lg"
            >
              <div className="space-y-4">
                <div className="aspect-[16/10] w-full rounded-xl overflow-hidden bg-slate-100 relative">
                  <img
                    src={art.featuredImage}
                    alt={art.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded bg-white/95 backdrop-blur-md text-[#1877F2] text-[10px] font-bold uppercase tracking-wider border border-slate-200 shadow-sm">
                    {art.category}
                  </div>
                  <button
                    type="button"
                    id={`bookmark-card-article-${art.id}`}
                    onClick={(e) => handleToggleArticleBookmark(e, art.id)}
                    className={`absolute top-3 right-3 p-2 rounded-xl backdrop-blur-md transition-all shadow-sm cursor-pointer z-10 ${
                      isBookmarked('article', art.id)
                        ? 'bg-white text-[#FF6B00] border border-orange-200 shadow-orange-500/10'
                        : 'bg-white/90 hover:bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                    }`}
                    title={isBookmarked('article', art.id) ? 'Remove article from saved' : 'Save article'}
                    aria-label={isBookmarked('article', art.id) ? 'Remove article from saved' : 'Save article'}
                  >
                    <Bookmark className={`w-3.5 h-3.5 ${isBookmarked('article', art.id) ? 'fill-[#FF6B00]' : ''}`} />
                  </button>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> {art.readTime || `${art.readingTimeMinutes || 5} min read`}
                  </span>
                  <span>·</span>
                  <span>{art.publishedAt}</span>
                </div>

                <h2 className="text-xl font-display font-bold text-slate-900 group-hover:text-[#1877F2] transition-colors leading-tight">
                  {art.title}
                </h2>

                <p className="text-slate-600 text-xs sm:text-sm font-interface leading-relaxed line-clamp-3">
                  {art.excerpt}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-600 group-hover:text-slate-900">
                <span className="flex items-center gap-1.5 text-[#FF6B00]">
                  Read Full Essay <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </span>
                <span className="text-[11px] text-slate-500">
                  By {typeof art.author === 'string' ? art.author : art.author?.name || 'Digital Muid'}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Strategic Call to Action */}
      <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-[#07111F] via-[#0B1E3B] to-[#07111F] border border-slate-800 text-center space-y-6 shadow-xl text-white">
        <div className="text-xs font-bold uppercase tracking-widest text-[#FF6B00] font-interface">
          Turn Strategic Ideas into Market Execution
        </div>
        <h2 className="text-2xl sm:text-4xl font-display font-bold text-white tracking-tight">
          Ready to Apply These Frameworks to Your Business?
        </h2>
        <p className="text-slate-300 text-sm sm:text-base max-w-xl mx-auto font-interface">
          Book a 1-on-1 strategic consultation to diagnose your growth funnel or explore our executive masterclasses.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <button
            onClick={() => navigate('/business-growth-consultation')}
            className="px-8 py-3.5 rounded-xl bg-[#FF6B00] hover:bg-[#e66000] text-white font-bold text-xs uppercase tracking-widest shadow-xl inline-flex items-center gap-2 cursor-pointer transition-all"
          >
            <span>BOOK A CONSULTATION</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate('/learn')}
            className="px-8 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-widest border border-white/20 inline-flex items-center gap-2 cursor-pointer transition-all"
          >
            <span>LEARN WITH DIGITAL MUID</span>
            <ArrowRight className="w-4 h-4 text-white/70" />
          </button>
        </div>
      </div>
    </div>
  );
};
