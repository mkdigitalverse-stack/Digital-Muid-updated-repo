import React from 'react';
import { useApp } from '../../context/AppContext';
import { Quote, Star, Video, ExternalLink, ShieldCheck, UserCheck } from 'lucide-react';

interface AcademyReviewsSectionProps {
  navigate: (path: string) => void;
}

export const AcademyReviewsSection: React.FC<AcademyReviewsSectionProps> = ({ navigate }) => {
  const { testimonials } = useApp();

  // Filter approved/active testimonials
  // Prioritize student or client testimonials from real data source
  const approvedTestimonials = (testimonials || []).filter(
    (t) => t.category === 'Students' || t.category === 'Clients' || !t.category
  );

  return (
    <section id="student-transformations" className="py-20 sm:py-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 bg-white text-slate-900 border-b border-slate-200/80">
      <div className="max-w-3xl space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200">
          <Quote className="w-3.5 h-3.5 text-[#FF6B00]" />
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FF6B00] font-interface">
            AUTHENTICATED LEARNER FEEDBACK
          </span>
        </div>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-slate-900 tracking-tight">
          Student Transformations
        </h2>
        <p className="text-slate-600 text-sm sm:text-base font-interface">
          Outcomes from students, agency leaders, and founders who implemented our operational frameworks in live production.
        </p>
      </div>

      {approvedTestimonials.length === 0 ? (
        <div className="p-12 rounded-3xl bg-slate-50 border border-slate-200 text-center space-y-3">
          <ShieldCheck className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="font-display font-bold text-slate-800 text-lg">No reviews published yet</h3>
          <p className="text-xs text-slate-500 font-interface max-w-md mx-auto">
            Reviews are published following strict student verification and consent.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {approvedTestimonials.slice(0, 3).map((t) => (
            <div
              key={t.id}
              className="p-8 rounded-3xl bg-slate-50 border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-6"
            >
              <div className="space-y-4">
                <div className="flex items-center gap-1 text-amber-500">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-slate-700 font-interface leading-relaxed italic">
                  “{t.quote}”
                </p>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center gap-4">
                {t.photo ? (
                  <img
                    src={t.photo}
                    alt={t.name}
                    className="w-12 h-12 rounded-full object-cover border border-slate-300 shadow-sm shrink-0"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm shrink-0">
                    {t.name.charAt(0)}
                  </div>
                )}
                <div>
                  <div className="font-display font-bold text-slate-900 text-sm">{t.name}</div>
                  <div className="text-[11px] text-slate-500 font-interface">
                    {t.role} {t.company && `· ${t.company}`}
                  </div>
                  {t.metric && (
                    <div className="mt-1 text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block">
                      {t.metric}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Video Breakdown Teardown Banner */}
      <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 text-white flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#FF6B00]/20 border border-[#FF6B00]/30 text-[#FF6B00] flex items-center justify-center shrink-0">
            <Video className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-400 font-mono">Watch Video Breakdown</div>
            <h4 className="text-lg font-display font-bold text-white">
              The Digital Growth Stack™: Zero to Predictable Scale
            </h4>
            <p className="text-xs text-slate-400">24-minute comprehensive framework breakdown with real ad accounts.</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate('/watch')}
          className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shrink-0"
        >
          <span>Watch Masterclass</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>
    </section>
  );
};
