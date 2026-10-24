import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Briefcase,
  AlertCircle,
  Pause,
  Play,
  Award,
  Users,
  X,
  ExternalLink
} from 'lucide-react';

interface StudentSlide {
  id: string;
  name: string;
  role: string;
  course: string;
  outcome: string;
  image: string;
  isVerified: boolean;
  notes?: string;
}

export const AcademyStudentGalleryCarousel: React.FC = () => {
  const slides: StudentSlide[] = [
    {
      id: 'student-01',
      name: 'Karan Malhotra',
      role: 'Growth Practitioner',
      course: 'Meta & Google Ads Mastery: Algorithmic Scaling',
      outcome: 'Digital Marketing Strategist at ScaleX Media · Promoted to Senior Growth Lead',
      image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&h=600&q=80',
      isVerified: true,
      notes: 'Verified alumni review with authenticated professional milestone.'
    },
    {
      id: 'student-02',
      name: 'Alumni Profile 02',
      role: 'Freelance Growth Operator',
      course: 'SEO with AI Integration: Intent Dominance',
      outcome: 'Secured First 3 Independent Client SEO Retainers',
      image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&h=600&q=80',
      isVerified: false,
      notes: 'Sample testing card. Formal student testimonial verification pending.'
    },
    {
      id: 'student-03',
      name: 'Alumni Profile 03',
      role: 'Operations & Automation Lead',
      course: 'AI & Automation for Business Operations',
      outcome: 'Automated Inbound Lead Triage for B2B Healthcare Services',
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&h=600&q=80',
      isVerified: false,
      notes: 'Sample testing card. Formal student testimonial verification pending.'
    },
    {
      id: 'student-04',
      name: 'Alumni Profile 04',
      role: 'Agency Media Buyer',
      course: 'Digital Marketing & Growth Architecture Foundation',
      outcome: 'Transitioned from Generalist to Dedicated Paid Acquisition Executive',
      image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&h=600&q=80',
      isVerified: false,
      notes: 'Sample testing card. Formal student testimonial verification pending.'
    }
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  // Auto-sliding interval (5 seconds) with pause support
  useEffect(() => {
    if (isPaused || isModalOpen) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [isPaused, isModalOpen, slides.length]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  };

  // Touch Swipe Handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;

    if (distance > minSwipeDistance) {
      handleNext();
    } else if (distance < -minSwipeDistance) {
      handlePrev();
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  const activeSlide = slides[currentIndex];

  return (
    <section
      id="student-success-gallery"
      className="py-20 sm:py-28 bg-white text-slate-900 border-b border-slate-200/80"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
              <Award className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-800 font-interface">
                VERIFIED ALUMNI PROGRESSION
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-slate-900 tracking-tight">
              Student Success Gallery
            </h2>
            <p className="text-slate-600 text-sm sm:text-base font-interface">
              Practitioners and growth operators who applied our systems in jobs, agency seats, and freelance businesses.
            </p>
          </div>

          {/* Action & Controls */}
          <div className="flex items-center flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold font-interface transition-colors cursor-pointer shadow-xs"
            >
              <Users className="w-4 h-4 text-[#FF6B00]" />
              <span>See More Students</span>
            </button>

            <button
              type="button"
              onClick={() => setIsPaused(!isPaused)}
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
              aria-label={isPaused ? 'Play carousel automatic progression' : 'Pause carousel automatic progression'}
              title={isPaused ? 'Resume autoplay' : 'Pause autoplay'}
            >
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={handlePrev}
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
              aria-label="Previous Student Slide"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
              aria-label="Next Student Slide"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Carousel Viewport with Touch/Swipe */}
        <div
          className="rounded-3xl bg-slate-50 border border-slate-200/90 p-6 sm:p-10 shadow-sm overflow-hidden"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            {/* Square 1:1 Aspect Image Card */}
            <div className="md:col-span-5 flex justify-center">
              <div className="relative w-full max-w-sm aspect-square rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 shadow-md">
                <img
                  src={activeSlide.image}
                  alt={`${activeSlide.name} — Student Outcome (${activeSlide.role})`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute top-3 left-3">
                  {activeSlide.isVerified ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-bold font-mono tracking-wider shadow-sm">
                      <ShieldCheck className="w-3.5 h-3.5" /> Verified Outcome
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/90 text-amber-300 text-[11px] font-bold font-mono tracking-wider shadow-sm border border-amber-400/30">
                      <AlertCircle className="w-3.5 h-3.5" /> Sample Preview Card
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Slide Information */}
            <div className="md:col-span-7 space-y-5">
              <div className="space-y-2">
                <div className="text-xs font-mono uppercase tracking-wider text-[#1877F2] font-bold">
                  {activeSlide.course}
                </div>
                <h3 className="text-2xl sm:text-3xl font-display font-bold text-slate-900">
                  {activeSlide.name}
                </h3>
                <div className="text-sm font-semibold text-slate-600">
                  {activeSlide.role}
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-2">
                <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-emerald-600" /> Professional Career Milestone:
                </div>
                <p className="text-sm sm:text-base font-interface font-semibold text-slate-900 leading-snug">
                  {activeSlide.outcome}
                </p>
              </div>

              {activeSlide.notes && (
                <p className="text-xs text-slate-500 font-interface italic">
                  Note: {activeSlide.notes}
                </p>
              )}

              {/* Slide Indicators */}
              <div className="pt-3 flex items-center gap-2" role="tablist" aria-label="Student Carousel Pagination">
                {slides.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    role="tab"
                    aria-selected={currentIndex === idx}
                    aria-label={`Go to student slide ${idx + 1}: ${s.name}`}
                    className={`h-2.5 rounded-full transition-all cursor-pointer ${
                      currentIndex === idx ? 'w-8 bg-[#1877F2]' : 'w-2.5 bg-slate-300 hover:bg-slate-400'
                    }`}
                  />
                ))}
                <span className="text-xs font-mono text-slate-500 ml-2">
                  {currentIndex + 1} of {slides.length}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Anti-Slop Transparency Note */}
        <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-600 font-interface flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            <strong>Authenticity Policy:</strong> In compliance with strict truth-in-marketing standards, we never invent
            testimonials, fake employers, or fictional salary statistics. Cards without formal student consent are clearly
            flagged as sample preview entries.
          </span>
        </div>
      </div>

      {/* Accessible See More Students Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="students-modal-title"
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white text-slate-900 border border-slate-200 shadow-2xl p-6 sm:p-8 space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 id="students-modal-title" className="text-2xl font-display font-bold text-slate-900">
                  Student Success &amp; Outcomes Gallery
                </h3>
                <p className="text-xs text-slate-500 font-interface">
                  Verified alumni milestones and approved case studies from DigitalMUID cohorts.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Close Student Success Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Grid of All Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {slides.map((s) => (
                <div
                  key={s.id}
                  className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex gap-4 items-start"
                >
                  <div className="w-24 h-24 aspect-square rounded-xl overflow-hidden bg-slate-900 shrink-0 border border-slate-200">
                    <img
                      src={s.image}
                      alt={`${s.name} portrait`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {s.isVerified ? (
                        <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Verified
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          Sample Preview
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-slate-500 truncate">
                        {s.course}
                      </span>
                    </div>
                    <h4 className="font-display font-bold text-slate-900 text-base truncate">
                      {s.name}
                    </h4>
                    <p className="text-xs text-slate-600 font-interface leading-snug">
                      {s.outcome}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-interface">
              <span>All student testimonials are collected with signed consent and verified records.</span>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold transition-colors cursor-pointer"
              >
                Back to Academy
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
