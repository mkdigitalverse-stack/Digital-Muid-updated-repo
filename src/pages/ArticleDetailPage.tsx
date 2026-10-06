import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ArrowLeft, Clock, Calendar, Share2, ArrowRight, Sparkles, BookOpen, Loader2, Layers, Bookmark } from 'lucide-react';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { articleService } from '../services/articleService';
import { isSupabaseConfigured } from '../lib/supabase';
import { Article } from '../types';
import { findFrameworksForArticle, findContextualArticlesForArticle } from '../utils/frameworkRelationships';

interface ArticleDetailPageProps {
  slug: string;
  navigate: (path: string) => void;
}

export const ArticleDetailPage: React.FC<ArticleDetailPageProps> = ({ slug, navigate }) => {
  const {
    articles,
    frameworks,
    notify,
    consultationProduct,
    isAdminAuthenticated,
    currentUser,
    isBookmarked,
    toggleBookmark
  } = useApp();
  const [fetchedArticle, setFetchedArticle] = useState<Article | null>(null);
  const [isFetchingRemote, setIsFetchingRemote] = useState<boolean>(isSupabaseConfigured());
  const [remoteResolved, setRemoteResolved] = useState<boolean>(!isSupabaseConfigured());

  // Authoritatively query Supabase for requested slug
  useEffect(() => {
    let isMounted = true;

    if (!isSupabaseConfigured()) {
      setIsFetchingRemote(false);
      setRemoteResolved(true);
      return;
    }

    setIsFetchingRemote(true);
    articleService.fetchArticleBySlug(slug).then((res) => {
      if (!isMounted) return;
      if (res.data) {
        setFetchedArticle(res.data);
      } else {
        setFetchedArticle(null);
      }
      setIsFetchingRemote(false);
      setRemoteResolved(true);
    }).catch((err) => {
      if (!isMounted) return;
      console.warn('[Article Detail] Remote query fallback notice:', err);
      setIsFetchingRemote(false);
      setRemoteResolved(true);
    });

    return () => {
      isMounted = false;
    };
  }, [slug]);

  // Determine active article:
  // When Supabase is configured, use strictly the remote query result.
  // When Supabase is NOT configured, fallback to in-memory/local articles.
  const localArticle = !isSupabaseConfigured() ? articles.find((a) => a.slug === slug) : null;
  const article = isSupabaseConfigured() ? fetchedArticle : (fetchedArticle || localArticle);

  // An article is accessible publicly only if status === 'published'.
  // Authenticated admins may preview drafts.
  const isAccessible = Boolean(article && (article.status === 'published' || isAdminAuthenticated));
  const totalCalculated = (consultationProduct.basePrice * (1 + consultationProduct.gstRate)).toFixed(0);

  if (isFetchingRemote || !remoteResolved) {
    return (
      <div id="article-detail-loading" className="pt-32 pb-24 text-center space-y-4 max-w-xl mx-auto px-4">
        <Loader2 className="w-8 h-8 text-[#1877F2] animate-spin mx-auto" />
        <p className="text-slate-600 text-sm font-interface">Loading essay...</p>
      </div>
    );
  }

  if (!isAccessible || !article) {
    return (
      <div id="article-not-found" className="pt-32 pb-24 text-center space-y-6 max-w-xl mx-auto px-4 sm:px-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold font-interface">
          <Sparkles className="w-3.5 h-3.5 text-[#1877F2]" /> Digital Muid Insights
        </div>
        <h1 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 tracking-tight">
          Article Not Found
        </h1>
        <p className="text-slate-600 text-sm sm:text-base font-interface leading-relaxed">
          The essay you are looking for does not exist, has been unpublished, or is currently stored as an unpublished draft.
        </p>
        <div className="pt-2">
          <button
            onClick={() => navigate('/insights')}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#1877F2] hover:bg-blue-600 text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Insights</span>
          </button>
        </div>
      </div>
    );
  }

  const authorName = typeof article.author === 'string' ? article.author : article.author?.name || 'Digital Muid';
  const authorRole = typeof article.author === 'object' && article.author?.role ? article.author.role : 'Founder & Strategic Architect';
  const authorAvatar = typeof article.author === 'object' && article.author?.avatar ? article.author.avatar : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';
  const readTimeString = article.readTime || `${article.readingTimeMinutes || 5} min read`;

  // Discover published Frameworks that authoritatively reference this Article
  const connectedFrameworks = findFrameworksForArticle(article, frameworks, isAdminAuthenticated);

  // Discover contextual related articles (prioritizing articles in the same framework)
  const relatedArticles = findContextualArticlesForArticle(article, frameworks, articles, 2, isAdminAuthenticated);

  const isArticleBookmarked = isBookmarked('article', article.id);

  const handleToggleBookmark = async () => {
    if (!currentUser) {
      notify('Please sign in to save articles to your personal library.', 'info');
      navigate('/login');
      return;
    }
    await toggleBookmark('article', article.id);
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      notify('Article link copied to clipboard!', 'success');
    }
  };

  return (
    <div id="article-detail-root" className="pt-28 sm:pt-32 pb-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
      {/* Back Button */}
      <button
        onClick={() => navigate('/insights')}
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to All Insights</span>
      </button>

      {/* Header Info */}
      <div className="space-y-6">
        {article.status !== 'published' && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold flex items-center justify-between">
            <span>Admin Preview Mode: This article is currently a <strong>Draft</strong> and is hidden from public visitors.</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[10px] uppercase font-bold tracking-wider">Draft</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="px-3 py-1 rounded-full bg-blue-50 text-[#1877F2] font-bold uppercase tracking-wider border border-blue-200">
            {article.category}
          </span>
          <span className="text-slate-500 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> {readTimeString}
          </span>
          {article.publishedAt && (
            <span className="text-slate-500">· Published on {article.publishedAt}</span>
          )}
        </div>

        <h1 className="text-3xl sm:text-5xl font-display font-bold text-slate-900 tracking-tight leading-tight">
          {article.title}
        </h1>

        {/* Author Bio Bar */}
        <div className="flex items-center justify-between pt-4 pb-6 border-y border-slate-200">
          <div className="flex items-center gap-3">
            <img
              src={authorAvatar}
              alt={authorName}
              referrerPolicy="no-referrer"
              className="w-12 h-12 rounded-full object-cover border border-slate-300"
            />
            <div>
              <div className="font-display font-bold text-slate-900 text-sm">{authorName}</div>
              <div className="text-xs text-slate-500">{authorRole}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id={`bookmark-article-${article.id}`}
              type="button"
              onClick={handleToggleBookmark}
              className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-xs ${
                isArticleBookmarked
                  ? 'bg-orange-50 border-orange-200 text-[#FF6B00] hover:bg-orange-100'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 hover:text-slate-900'
              }`}
              title={isArticleBookmarked ? 'Saved to bookmarks' : 'Save for later'}
            >
              <Bookmark className={`w-4 h-4 ${isArticleBookmarked ? 'fill-[#FF6B00]' : ''}`} />
              <span className="hidden sm:inline">{isArticleBookmarked ? 'Saved' : 'Save'}</span>
            </button>

            <button
              id={`share-article-${article.id}`}
              type="button"
              onClick={handleShare}
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 hover:text-slate-900 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-xs"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">Share Essay</span>
            </button>
          </div>
        </div>
      </div>

      {/* Featured Header Image */}
      <div className="aspect-[16/9] w-full rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-md">
        <img
          src={article.featuredImage}
          alt={article.title}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Article Markdown / Content Body */}
      <div className="max-w-none text-slate-800 font-interface text-base sm:text-lg leading-relaxed">
        <MarkdownRenderer content={article.content} />
      </div>

      {/* Tags */}
      {article.tags && article.tags.length > 0 && (
        <div className="pt-6 border-t border-slate-200 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500 font-semibold mr-2">Topic Vectors:</span>
          {article.tags.map((t) => (
            <span key={t} className="text-xs px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 font-medium">
              #{t}
            </span>
          ))}
        </div>
      )}

      {/* Contextual Strategic Framework Presentation */}
      {connectedFrameworks.length > 0 && (
        <div className="space-y-4 pt-4">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-orange-100 text-[#FF6B00]">
              <Layers className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-[#FF6B00] font-mono">
              Part of a Strategic Framework
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {connectedFrameworks.map((fw) => {
              const stageCount = fw.frameworkContent?.length || 0;
              return (
                <div
                  key={fw.id || fw.slug}
                  onClick={() => {
                    navigate(`/frameworks/${fw.slug}`);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-[#0B1E3B] to-slate-900 border border-slate-800 text-white hover:border-[#FF6B00]/60 transition-all cursor-pointer group shadow-xl relative overflow-hidden"
                >
                  <div className="relative z-10 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-md bg-[#FF6B00]/20 text-[#FF6B00] text-[11px] font-mono font-bold uppercase tracking-wider border border-[#FF6B00]/30">
                          {fw.category || 'Strategic Framework'}
                        </span>
                        {stageCount > 0 && (
                          <span className="text-xs text-slate-300 font-mono">
                            · {stageCount} Execution Stages
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-bold text-[#FF6B00] group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                        Explore Framework <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <h3 className="text-xl sm:text-2xl font-display font-bold text-white group-hover:text-amber-300 transition-colors">
                        {fw.title}
                      </h3>
                      {(fw.subtitle || fw.description) && (
                        <p className="text-sm text-slate-300 font-interface leading-relaxed line-clamp-2">
                          {fw.subtitle || fw.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Integrated Consultation Callout */}
      <div className="p-8 rounded-3xl bg-slate-900 text-white border border-slate-800 text-center space-y-6 shadow-xl">
        <h3 className="text-2xl font-display font-bold text-white">
          Apply These Strategic Insights to Your Business
        </h3>
        <p className="text-slate-300 text-sm max-w-lg mx-auto">
          Book a 30-minute high-intensity strategic consultation with Digital Muid to dissect your current growth bottlenecks.
        </p>
        <button
          onClick={() => navigate('/consultation')}
          className="px-6 py-3 rounded-xl bg-[#FF6B00] hover:bg-[#FF7A1A] text-white font-semibold text-sm inline-flex items-center gap-2 shadow-lg shadow-[#FF6B00]/30 transition-all cursor-pointer"
        >
          <Calendar className="w-4 h-4" />
          <span>Book Consultation (₹{totalCalculated})</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Related Reading */}
      {relatedArticles.length > 0 && (
        <div className="space-y-6 pt-6">
          <h3 className="text-xl font-display font-bold text-slate-900">Continue Reading</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {relatedArticles.map((rel) => (
              <div
                key={rel.id}
                onClick={() => {
                  navigate(`/insights/${rel.slug}`);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 cursor-pointer space-y-2 group shadow-sm hover:shadow-md transition-all"
              >
                <span className="text-[10px] font-bold text-[#1877F2] uppercase">{rel.category}</span>
                <h4 className="text-base font-display font-bold text-slate-900 group-hover:text-[#1877F2] transition-colors line-clamp-2">
                  {rel.title}
                </h4>
                <p className="text-xs text-slate-600 line-clamp-2">{rel.excerpt}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
