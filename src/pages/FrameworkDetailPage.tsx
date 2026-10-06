import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  ArrowLeft,
  Layers,
  CheckCircle2,
  Calendar,
  ArrowRight,
  TrendingUp,
  Share2,
  Users,
  FileText,
  Video,
  Download,
  Star,
  Bookmark
} from 'lucide-react';

interface FrameworkDetailPageProps {
  slug: string;
  navigate: (path: string) => void;
}

export const FrameworkDetailPage: React.FC<FrameworkDetailPageProps> = ({ slug, navigate }) => {
  const {
    frameworks,
    articles,
    videos,
    resources,
    notify,
    consultationProduct,
    isAdminAuthenticated,
    currentUser,
    isBookmarked,
    toggleBookmark
  } = useApp();
  
  // Strict publication check: Public users can only see published frameworks
  const framework = frameworks.find(
    (f) => f.slug === slug && (isAdminAuthenticated || f.status === 'published')
  );

  const [activeStepIndex, setActiveStepIndex] = useState(0);

  const totalCalculated = (consultationProduct.basePrice * (1 + consultationProduct.gstRate)).toFixed(0);

  if (!framework) {
    return (
      <div className="pt-32 pb-24 text-center space-y-4 max-w-lg mx-auto px-4">
        <div className="w-12 h-12 rounded-2xl bg-orange-50 text-[#FF6B00] flex items-center justify-center mx-auto">
          <Layers className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 font-display">Framework Not Found</h1>
        <p className="text-sm text-slate-500">
          The requested methodology does not exist, is an unpublished draft, or has been archived.
        </p>
        <button
          onClick={() => navigate('/frameworks')}
          className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
        >
          Back to Framework Library
        </button>
      </div>
    );
  }

  const title = framework.title || framework.name || 'Proprietary Framework';
  const subtitle = framework.subtitle || '';
  const intro = framework.description || framework.introduction || '';
  const stages = framework.frameworkContent ?? framework.framework_content ?? framework.steps ?? [];
  const safeActiveIndex = Math.min(activeStepIndex, Math.max(0, stages.length - 1));
  const activeStage = stages[safeActiveIndex];
  const targetAudience = framework.targetAudience ?? framework.target_audience ?? [];

  // Related content resolution - strictly respect publication status for public visitors
  const relatedArticlesList = (framework.relatedArticles ?? framework.related_articles ?? [])
    .map(id => articles.find(a => (a.id === id || a.slug === id) && (isAdminAuthenticated || a.status === 'published')))
    .filter(Boolean);

  const relatedVideosList = (framework.relatedVideos ?? framework.related_videos ?? [])
    .map(id => videos.find(v => (v.id === id || v.slug === id) && (isAdminAuthenticated || v.status === 'published' || !v.status)))
    .filter(Boolean);

  const relatedResourcesList = (framework.relatedResources ?? framework.related_resources ?? [])
    .map(id => resources.find(r => (r.id === id || r.slug === id) && (isAdminAuthenticated || r.status === 'published' || !r.status)))
    .filter(Boolean);

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      notify('Framework link copied to clipboard!', 'success');
    }
  };

  const isFrameworkBookmarked = isBookmarked('framework', framework.id);

  const handleToggleBookmark = async () => {
    if (!currentUser) {
      notify('Please sign in to save frameworks to your personal library.', 'info');
      navigate('/login');
      return;
    }
    await toggleBookmark('framework', framework.id);
  };

  return (
    <div id="framework-detail-root" className="pt-28 sm:pt-32 pb-24 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
      {/* Back Button */}
      <button
        onClick={() => navigate('/frameworks')}
        className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Framework Library</span>
      </button>

      {/* Header Bar */}
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-[#FF6B00] text-xs font-bold uppercase tracking-wider font-interface">
            <Layers className="w-3.5 h-3.5" /> How Digital Muid Thinks
          </div>
          <div className="flex items-center gap-2">
            <button
              id={`bookmark-framework-${framework.id}`}
              type="button"
              onClick={handleToggleBookmark}
              className={`p-2 px-3.5 rounded-xl border text-xs font-bold flex items-center gap-2 shadow-sm cursor-pointer transition-all ${
                isFrameworkBookmarked
                  ? 'bg-orange-50 border-orange-200 text-[#FF6B00] hover:bg-orange-100'
                  : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700 hover:text-slate-900'
              }`}
              title={isFrameworkBookmarked ? 'Saved to bookmarks' : 'Save framework'}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isFrameworkBookmarked ? 'fill-[#FF6B00]' : ''}`} />
              <span>{isFrameworkBookmarked ? 'Saved' : 'Save'}</span>
            </button>

            <button
              id={`share-framework-${framework.id}`}
              type="button"
              onClick={handleShare}
              className="p-2 px-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 hover:text-slate-900 text-xs font-bold flex items-center gap-2 shadow-sm cursor-pointer transition-all"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share Framework</span>
            </button>
          </div>
        </div>

        <div>
          <h1 className="text-3xl sm:text-5xl font-display font-bold text-slate-900 tracking-tight leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-lg sm:text-xl font-semibold text-slate-600 mt-2 font-interface">
              {subtitle}
            </p>
          )}
        </div>

        {intro && (
          <p className="text-slate-600 text-base sm:text-lg font-interface leading-relaxed max-w-4xl">
            {intro}
          </p>
        )}

        {/* Target Audience Pill List */}
        {targetAudience.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-slate-400" /> Best Suited For:
            </span>
            {targetAudience.map((aud, i) => (
              <span
                key={i}
                className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200"
              >
                {aud}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Interactive Stage Explorer */}
      {stages.length > 0 && (
        <div className="p-8 sm:p-10 rounded-3xl bg-white border border-slate-200 space-y-10 shadow-sm">
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-widest text-[#FF6B00]">Stage Breakdown</div>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-slate-900">
              Sequential Execution Flow
            </h2>
          </div>

          {/* Step Selector Ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {stages.map((st, idx) => {
              const isSelected = safeActiveIndex === idx;
              const rawNum = st.number ?? st.step ?? (idx + 1);
              const formattedNumber = typeof rawNum === 'number' ? String(rawNum).padStart(2, '0') : String(rawNum).padStart(2, '0');
              const stepTitle = st.title || `Stage ${rawNum}`;
              return (
                <button
                  key={st.id || idx}
                  onClick={() => setActiveStepIndex(idx)}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-orange-500 text-white border-orange-500 shadow-sm translate-y-[-2px]'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-900'
                  }`}
                >
                  <div className={`text-[11px] font-mono font-bold ${isSelected ? 'text-white' : 'text-slate-500'}`}>
                    {formattedNumber}
                  </div>
                  <div className={`text-xs font-bold mt-1 line-clamp-1 ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                    {stepTitle}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Stage Detailed View */}
          {activeStage && (
            <div className="p-6 sm:p-8 rounded-2xl bg-slate-50 border border-slate-200 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-orange-100 text-[#FF6B00] font-mono font-bold flex items-center justify-center text-base border border-orange-200 shrink-0">
                    {activeStage.number ?? activeStage.step ?? (safeActiveIndex + 1)}
                  </span>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-display font-bold text-slate-900">
                      Stage {activeStage.number ?? activeStage.step ?? (safeActiveIndex + 1)}: {activeStage.title}
                    </h3>
                    {(activeStage.subtitle || activeStage.shortDescription) && (
                      <p className="text-xs text-slate-600 font-interface mt-0.5">
                        {activeStage.subtitle || activeStage.shortDescription}
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-xs font-mono text-slate-600 bg-white px-3 py-1 rounded border border-slate-200 self-start sm:self-auto shadow-xs font-semibold">
                  Stage {safeActiveIndex + 1} of {stages.length}
                </span>
              </div>

              {(activeStage.description || activeStage.content) && (
                <p className="text-slate-700 text-sm sm:text-base leading-relaxed">
                  {activeStage.description || activeStage.content}
                </p>
              )}

              {(activeStage.impact || activeStage.outcome) && (
                <div className="p-5 rounded-xl bg-white border border-orange-200 shadow-xs space-y-2">
                  <div className="text-xs font-bold text-[#FF6B00] uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4" /> Commercial Impact on Growth
                  </div>
                  <p className="text-sm text-slate-800 font-medium">
                    {activeStage.impact || activeStage.outcome}
                  </p>
                </div>
              )}

              {activeStage.keyActions && activeStage.keyActions.length > 0 && (
                <div className="space-y-3">
                  <div className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Required Execution Directives
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {activeStage.keyActions.map((action, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-slate-700 p-2.5 rounded bg-white border border-slate-200 shadow-xs">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{action}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Cross-linking: Related Articles, Videos, and Resources */}
      {(relatedArticlesList.length > 0 || relatedVideosList.length > 0 || relatedResourcesList.length > 0) && (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-orange-100 text-[#FF6B00]">
              <Layers className="w-4 h-4" />
            </span>
            <h3 className="text-xl font-display font-bold text-slate-900">
              Related Knowledge & Tools
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {relatedArticlesList.map((art: any) => (
              <div
                key={art.id}
                onClick={() => navigate(`/insights/${art.slug}`)}
                className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-[#1877F2] transition-all cursor-pointer space-y-2 group shadow-xs"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#1877F2] flex items-center gap-1">
                  <FileText className="w-3 h-3" /> Related Article
                </span>
                <h4 className="text-sm font-bold text-slate-900 group-hover:text-[#1877F2] transition-colors line-clamp-2">
                  {art.title}
                </h4>
              </div>
            ))}

            {relatedVideosList.map((vid: any) => (
              <div
                key={vid.id}
                onClick={() => navigate(`/watch/${vid.slug}`)}
                className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-rose-400 transition-all cursor-pointer space-y-2 group shadow-xs"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 flex items-center gap-1">
                  <Video className="w-3 h-3" /> Related Masterclass
                </span>
                <h4 className="text-sm font-bold text-slate-900 group-hover:text-rose-600 transition-colors line-clamp-2">
                  {vid.title}
                </h4>
              </div>
            ))}

            {relatedResourcesList.map((res: any) => (
              <div
                key={res.id}
                onClick={() => navigate(`/resources/${res.slug}`)}
                className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-emerald-400 transition-all cursor-pointer space-y-2 group shadow-xs"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1">
                  <Download className="w-3 h-3" /> Actionable Template / PDF
                </span>
                <h4 className="text-sm font-bold text-slate-900 group-hover:text-emerald-600 transition-colors line-clamp-2">
                  {res.name}
                </h4>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Implementation Consultation Callout */}
      <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-slate-900 via-[#0B1E3B] to-slate-900 border border-slate-800 text-center space-y-6 shadow-xl">
        <h3 className="text-2xl sm:text-3xl font-display font-bold text-white">
          Implement {title} in Your Organization
        </h3>
        <p className="text-slate-300 text-sm sm:text-base max-w-xl mx-auto">
          Book a 1-on-1 strategic consultation with Digital Muid to tailor this framework to your exact market positioning and business model.
        </p>
        <button
          onClick={() => navigate('/consultation')}
          className="px-8 py-4 rounded-xl bg-[#FF6B00] hover:bg-[#FF7A1A] text-white font-bold text-base shadow-xl inline-flex items-center gap-2 cursor-pointer transition-all"
        >
          <Calendar className="w-5 h-5" />
          <span>Book Implementation Session (₹{totalCalculated})</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
