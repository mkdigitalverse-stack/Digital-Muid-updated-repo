import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { GraduationCap, Sparkles, Clock, Users, CheckCircle2, ArrowRight, BookOpen, ShieldCheck, Heart } from 'lucide-react';

interface LearnPageProps {
  navigate: (path: string) => void;
}

export const LearnPage: React.FC<LearnPageProps> = ({ navigate }) => {
  const { courses, isCourseWishlisted, toggleCourseWishlist, studentEnrollments } = useApp();
  const [selectedLevel, setSelectedLevel] = useState<string>('All');

  const filteredCourses = courses.filter((c) => {
    const matchesLevel = selectedLevel === 'All' || c.level === selectedLevel;
    return matchesLevel && c.status === 'published';
  });

  return (
    <div id="learn-page-root" className="pt-28 sm:pt-32 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
      {/* Header */}
      <div className="max-w-3xl space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold uppercase tracking-wider font-interface">
          <GraduationCap className="w-3.5 h-3.5" /> Practical Digital Education
        </div>
        <h1 className="text-4xl sm:text-5xl font-display font-bold text-slate-900 tracking-tight">
          Learn Digital. Build What's Next.
        </h1>
        <p className="text-slate-600 text-base sm:text-lg font-interface">
          Practical, AI-integrated masterclasses for founders, marketers, professionals, and students who want to build real systems rather than just collect certificates.
        </p>
      </div>

      {/* Learning Philosophy Callout */}
      <div className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-600 font-mono">Our Educational Standard</div>
          <p className="text-lg font-display font-bold text-slate-900">Don't Just Learn. Build. Launch. Measure. Improve.</p>
          <p className="text-xs text-slate-600">Every masterclass includes production-ready templates, direct accountability, and live campaign teardowns.</p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {['Beginner', 'Intermediate', 'Advanced', 'All Levels'].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setSelectedLevel(lvl === selectedLevel ? 'All' : lvl)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedLevel === lvl
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Courses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {filteredCourses.map((course) => {
          const thumbnail = course.thumbnail || course.thumbnailUrl || course.coverImage;
          const highlights = course.highlights || [];
          return (
            <div
              key={course.id}
              onClick={() => navigate(`/learn/${course.slug}`)}
              className="p-7 sm:p-8 rounded-3xl bg-white border border-slate-200 hover:border-emerald-300 transition-all group cursor-pointer flex flex-col justify-between space-y-6 shadow-sm hover:shadow-md"
            >
              <div className="space-y-5">
                <div className="aspect-[16/9] w-full rounded-2xl bg-slate-100 relative overflow-hidden flex items-center justify-center">
                  {thumbnail ? (
                    <img
                      src={thumbnail}
                      alt={course.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <GraduationCap className="w-12 h-12 text-slate-400" />
                  )}
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded bg-white/95 backdrop-blur-md text-emerald-700 text-xs font-bold uppercase tracking-wider border border-slate-200 shadow-sm">
                      {course.level}
                    </span>
                    {course.aiIntegrated && (
                      <span className="px-2.5 py-1 rounded bg-blue-600 text-white text-xs font-bold flex items-center gap-1 shadow-sm">
                        <Sparkles className="w-3 h-3" /> AI-Integrated
                      </span>
                    )}
                  </div>

                  <div className="absolute top-3 right-3 z-10">
                    {studentEnrollments.some((e) => e.courseId === course.id) ? (
                      <span className="px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider shadow-sm">
                        Enrolled
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCourseWishlist(course.id);
                        }}
                        className={`p-2 rounded-xl backdrop-blur-md transition-all shadow-sm cursor-pointer border ${
                          isCourseWishlisted(course.id)
                            ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100'
                            : 'bg-white/90 border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-white'
                        }`}
                        title={isCourseWishlisted(course.id) ? 'Remove from Wishlist' : 'Save to Wishlist'}
                        aria-label={isCourseWishlisted(course.id) ? 'Remove from Wishlist' : 'Save to Wishlist'}
                      >
                        <Heart
                          className={`w-4 h-4 transition-transform ${
                            isCourseWishlisted(course.id) ? 'fill-rose-500 text-rose-500 scale-110' : ''
                          }`}
                        />
                      </button>
                    )}
                  </div>
                </div>

                <h2 className="text-2xl font-display font-bold text-slate-900 group-hover:text-emerald-700 transition-colors leading-snug">
                  {course.title}
                </h2>

                <p className="text-slate-600 text-sm font-interface leading-relaxed">
                  {course.shortOutcome || course.tagline || course.description}
                </p>

                {/* Highlights */}
                {highlights.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    {highlights.slice(0, 3).map((h: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-slate-700 font-interface">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{typeof h === 'string' ? h : (h?.title || h?.text || String(h))}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-4 text-xs text-slate-500 pt-3 border-t border-slate-100">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> {course.duration}
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> {course.enrolledCount || 0}+ Enrolled
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Tuition</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold text-slate-900 font-mono">
                      {course.priceFormatted || (course.price ? `₹${course.offerPrice || course.price}` : 'Enquire')}
                    </span>
                    {course.offerPrice && course.price && (
                      <span className="text-xs text-slate-400 line-through font-mono">₹{course.price}</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="px-5 py-2.5 rounded-xl bg-slate-900 group-hover:bg-emerald-600 text-white font-bold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  <span>View Full Curriculum</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Strategic 1-on-1 Advisory Alternative */}
      <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-[#07111F] via-[#0B1E3B] to-[#07111F] border border-slate-800 text-center space-y-6 shadow-xl text-white">
        <div className="text-xs font-bold uppercase tracking-widest text-[#FF6B00] font-interface">
          Personalized Advisory
        </div>
        <h2 className="text-2xl sm:text-4xl font-display font-bold text-white tracking-tight">
          Need 1-on-1 Strategic Guidance for Your Company?
        </h2>
        <p className="text-slate-300 text-sm sm:text-base max-w-xl mx-auto font-interface">
          If you are looking for direct, hands-on advisory tailored to your team's specific growth hurdles, schedule a 30-minute strategic consultation.
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
            onClick={() => navigate('/contact')}
            className="px-8 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-widest border border-white/20 inline-flex items-center gap-2 cursor-pointer transition-all"
          >
            <span>GET IN TOUCH</span>
            <ArrowRight className="w-4 h-4 text-white/70" />
          </button>
        </div>
      </div>
    </div>
  );
};
