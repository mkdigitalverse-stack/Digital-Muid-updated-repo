import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Layers, ArrowRight, Sparkles, CheckCircle2, Star, Tag, Bookmark } from 'lucide-react';

interface FrameworksPageProps {
  navigate: (path: string) => void;
}

export const FrameworksPage: React.FC<FrameworksPageProps> = ({ navigate }) => {
  const {
    frameworks,
    frameworkCategories,
    isAdminAuthenticated,
    isBookmarked,
    toggleBookmark,
    currentUser,
    notify
  } = useApp();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const handleToggleFrameworkBookmark = async (e: React.MouseEvent, frameworkId: string) => {
    e.stopPropagation();
    if (!currentUser) {
      notify('Please sign in to save frameworks to your personal library.', 'info');
      navigate('/login');
      return;
    }
    await toggleBookmark('framework', frameworkId);
  };

  const visibleFrameworks = frameworks.filter(
    (f) => isAdminAuthenticated || f.status === 'published'
  );

  // Active framework categories
  const activeCategories = frameworkCategories.filter((c) => c.isActive !== false);

  // Filter frameworks by selected category
  const filteredFrameworks = visibleFrameworks.filter((fw) => {
    if (selectedCategory === 'all') return true;
    return (fw.category || '').toLowerCase() === selectedCategory.toLowerCase();
  });

  return (
    <div id="frameworks-page-root" className="pt-28 sm:pt-32 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
      {/* Header */}
      <div className="max-w-3xl space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-[#FF6B00] text-xs font-bold uppercase tracking-wider font-interface">
          <Layers className="w-3.5 h-3.5" /> How Digital Muid Thinks
        </div>
        <h1 className="text-4xl sm:text-5xl font-display font-bold text-slate-900 tracking-tight">
          Proprietary Strategic Frameworks
        </h1>
        <p className="text-slate-600 text-base sm:text-lg font-interface leading-relaxed">
          Ideas become powerful when they become structured systems. Explore our signature architectures designed to simplify complex market dynamics into repeatable growth and transformation models.
        </p>
      </div>

      {/* Dynamic Category Filter Pills */}
      {activeCategories.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300'
            }`}
          >
            All Frameworks ({visibleFrameworks.length})
          </button>
          {activeCategories.map((cat) => {
            const count = visibleFrameworks.filter(
              (f) => (f.category || '').toLowerCase() === cat.name.toLowerCase()
            ).length;
            const isSelected = selectedCategory.toLowerCase() === cat.name.toLowerCase();

            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.name)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#FF6B00] text-white shadow-md shadow-orange-500/20'
                    : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300'
                }`}
              >
                <span>{cat.name}</span>
                {count > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Frameworks Grid */}
      <div className="space-y-8">
        {filteredFrameworks.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-white border border-slate-200 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 text-[#FF6B00] flex items-center justify-center mx-auto">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-display font-bold text-slate-900">
              No frameworks found in &ldquo;{selectedCategory}&rdquo;
            </h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto font-interface">
              We haven&apos;t published any models under this category yet. Check back soon or view all frameworks.
            </p>
            <button
              onClick={() => setSelectedCategory('all')}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              View All Frameworks
            </button>
          </div>
        ) : (
          filteredFrameworks.map((fw, idx) => {
            const title = fw.title || fw.name || 'Strategic Framework';
            const subtitle = fw.subtitle || '';
            const intro = fw.description || fw.introduction || '';
            const stages = fw.frameworkContent ?? fw.framework_content ?? fw.steps ?? [];
            const isFeatured = Boolean(fw.isFeatured ?? fw.is_featured ?? fw.featured);
            const thumb = fw.coverImage || fw.cover_image;
            const categoryName = fw.category || 'Strategic Architecture';

            return (
              <div
                key={fw.id}
                onClick={() => navigate(`/frameworks/${fw.slug}`)}
                className="p-8 sm:p-10 rounded-3xl bg-white border border-slate-200 hover:border-orange-300 transition-all group cursor-pointer space-y-6 shadow-sm hover:shadow-md relative overflow-hidden"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-4">
                    {thumb ? (
                      <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                        <img
                          src={thumb}
                          alt={title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ) : (
                      <span className="w-12 h-12 rounded-2xl bg-orange-50 text-[#FF6B00] font-mono font-bold flex items-center justify-center text-lg border border-orange-200 shrink-0">
                        0{idx + 1}
                      </span>
                    )}
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider border border-slate-200">
                          {categoryName}
                        </span>
                        <h2 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 group-hover:text-[#FF6B00] transition-colors">
                          {title}
                        </h2>
                        {isFeatured && (
                          <span className="px-2 py-0.5 rounded-full bg-orange-100 text-[#FF6B00] text-[10px] font-bold uppercase tracking-wider border border-orange-200 flex items-center gap-1">
                            <Star className="w-3 h-3 fill-current" />
                            Featured
                          </span>
                        )}
                      </div>
                      {subtitle && (
                        <p className="text-sm font-semibold text-slate-500 mt-0.5">{subtitle}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-start lg:self-auto">
                    <button
                      type="button"
                      id={`bookmark-card-framework-${fw.id}`}
                      onClick={(e) => handleToggleFrameworkBookmark(e, fw.id)}
                      className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                        isBookmarked('framework', fw.id)
                          ? 'bg-orange-50 border-orange-200 text-[#FF6B00] hover:bg-orange-100'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900'
                      }`}
                      title={isBookmarked('framework', fw.id) ? 'Remove framework from saved' : 'Save framework'}
                      aria-label={isBookmarked('framework', fw.id) ? 'Remove framework from saved' : 'Save framework'}
                    >
                      <Bookmark className={`w-4 h-4 ${isBookmarked('framework', fw.id) ? 'fill-[#FF6B00]' : ''}`} />
                      <span className="hidden sm:inline text-xs">{isBookmarked('framework', fw.id) ? 'Saved' : 'Save'}</span>
                    </button>

                    <div className="flex items-center gap-2 text-xs font-bold text-[#FF6B00]">
                      <span>Deep-Dive Framework Blueprint</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
                    </div>
                  </div>
                </div>

                {intro && (
                  <p className="text-slate-600 text-sm sm:text-base font-interface leading-relaxed max-w-4xl line-clamp-3">
                    {intro}
                  </p>
                )}

                {/* Steps / Stages Preview */}
                {stages.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
                    {stages.map((st, sIdx) => {
                      const stNumber = st.number ?? (sIdx + 1);
                      return (
                        <div
                          key={st.id || sIdx}
                          className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1"
                        >
                          <div className="text-[10px] font-mono font-bold text-[#FF6B00]">
                            STAGE {stNumber}
                          </div>
                          <div className="text-xs font-bold text-slate-900 line-clamp-1">
                            {st.title}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Strategic Call to Action */}
      <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-[#07111F] via-[#0B1E3B] to-[#07111F] border border-slate-800 text-center space-y-6 shadow-xl text-white">
        <div className="text-xs font-bold uppercase tracking-widest text-[#FF6B00] font-interface">
          Operationalize These Frameworks
        </div>
        <h2 className="text-2xl sm:text-4xl font-display font-bold text-white tracking-tight">
          Want Custom Framework Architecture for Your Business?
        </h2>
        <p className="text-slate-300 text-sm sm:text-base max-w-xl mx-auto font-interface">
          Book a 1-on-1 consultation to customize these models for your organization or explore our masterclasses and advisory engagements.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <button
            onClick={() => navigate('/consultation')}
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
