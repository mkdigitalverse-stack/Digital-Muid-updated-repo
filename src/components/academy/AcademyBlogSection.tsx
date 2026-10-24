import React from 'react';
import { useApp } from '../../context/AppContext';
import { BookOpen, ArrowRight, Clock, Calendar, Sparkles } from 'lucide-react';

interface AcademyBlogSectionProps {
  navigate: (path: string) => void;
}

export const AcademyBlogSection: React.FC<AcademyBlogSectionProps> = ({ navigate }) => {
  const { articles } = useApp();

  // Filter only published articles
  const publishedArticles = (articles || []).filter(
    (a) => a.status === 'published' || !a.status
  );

  // Sort by publishedAt descending (most recent first)
  const sortedArticles = [...publishedArticles].sort((a, b) => {
    const dateA = new Date(a.publishedAt || 0).getTime();
    const dateB = new Date(b.publishedAt || 0).getTime();
    return dateB - dateA;
  });

  // Featured articles
  const featuredArticles = sortedArticles.filter(
    (a) => Boolean(a.featured || a.isFeatured)
  );

  // Top featured post (or first sorted post)
  const heroFeatured = featuredArticles.length > 0 ? featuredArticles[0] : sortedArticles[0];

  // Three most recently published articles (excluding heroFeatured if possible, or top 3)
  const recentArticles = sortedArticles
    .filter((a) => !heroFeatured || a.id !== heroFeatured.id)
    .slice(0, 3);

  // Fallback to top 3 if recentArticles is empty
  const displayRecent = recentArticles.length > 0 ? recentArticles : sortedArticles.slice(0, 3);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Recently Published';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const handleArticleClick = (slug: string) => {
    navigate(`/blog/${slug}`);
  };

  return (
    <section id="learners-hub" className="py-20 sm:py-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 bg-white text-slate-900 border-b border-slate-200/80">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200">
            <BookOpen className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-700 font-interface">
              STRATEGIC ESSAYS &amp; DEEP DIVES
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-slate-900 tracking-tight">
            Learner's Hub
          </h2>
          <p className="text-slate-600 text-sm sm:text-base font-interface">
            Long-form essays and strategic breakdowns on customer acquisition economics, generative AI, and authority publishing.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/insights')}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-200 transition-colors cursor-pointer shrink-0"
        >
          <span>Read All Published Articles</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {publishedArticles.length === 0 ? (
        <div className="p-12 rounded-3xl bg-slate-50 border border-slate-200 text-center space-y-3">
          <BookOpen className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="font-display font-bold text-slate-800 text-lg">No published articles yet</h3>
          <p className="text-xs text-slate-500 font-interface max-w-md mx-auto">
            New essays and strategic analyses are being prepared for release. Check back soon or visit our full catalog.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Main Featured Published Essay */}
          {heroFeatured && (
            <article
              onClick={() => handleArticleClick(heroFeatured.slug)}
              className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-[#0B1528] to-[#07111F] text-white border border-slate-800 hover:border-blue-500/50 shadow-xl transition-all cursor-pointer group"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-5 aspect-[16/10] rounded-2xl overflow-hidden bg-slate-800 border border-white/10 relative">
                  <img
                    src={heroFeatured.featuredImage || 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80'}
                    alt={heroFeatured.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute top-3 left-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1877F2] text-white text-[10px] font-bold uppercase tracking-wider shadow-sm">
                      <Sparkles className="w-3 h-3" /> Featured Essay
                    </span>
                  </div>
                </div>

                <div className="lg:col-span-7 space-y-4">
                  <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                    <span className="px-2.5 py-0.5 rounded bg-white/10 text-emerald-400 font-semibold">
                      {heroFeatured.category || 'Strategy'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(heroFeatured.publishedAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {heroFeatured.readTime || '6 min read'}
                    </span>
                  </div>

                  <h3 className="text-2xl sm:text-3xl font-display font-bold text-white group-hover:text-blue-300 transition-colors leading-tight">
                    {heroFeatured.title}
                  </h3>

                  <p className="text-sm text-slate-300 font-interface leading-relaxed line-clamp-3">
                    {heroFeatured.excerpt || 'Strategic deep-dive into digital transformation and marketing architecture.'}
                  </p>

                  <div className="pt-2 flex items-center gap-2 text-xs font-bold text-[#60A5FA] group-hover:translate-x-1 transition-transform">
                    <span>Read Full Essay</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </article>
          )}

          {/* Sub-grid: 3 Most Recently Published Eligible Posts */}
          <div>
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 mb-4">
              Recent Published Insights
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {displayRecent.map((article) => (
                <article
                  key={article.id}
                  onClick={() => handleArticleClick(article.slug)}
                  className="p-6 rounded-2xl bg-slate-50 hover:bg-white border border-slate-200/80 hover:border-blue-300 shadow-2xs hover:shadow-md transition-all group flex flex-col justify-between space-y-4 cursor-pointer"
                >
                  <div className="space-y-3">
                    <div className="aspect-[16/10] w-full rounded-xl overflow-hidden bg-slate-200 border border-slate-200 relative">
                      <img
                        src={article.featuredImage || 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80'}
                        alt={article.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 backdrop-blur-xs text-white text-[10px] font-mono uppercase tracking-wider">
                        {article.category || 'Growth'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                      <span>{formatDate(article.publishedAt)}</span>
                      <span>·</span>
                      <span>{article.readTime || '5 min read'}</span>
                    </div>

                    <h4 className="text-base font-display font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-snug line-clamp-2">
                      {article.title}
                    </h4>

                    <p className="text-xs text-slate-600 font-interface line-clamp-2 leading-relaxed">
                      {article.excerpt}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-200 text-xs font-bold text-blue-600 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    <span>Read Essay</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
