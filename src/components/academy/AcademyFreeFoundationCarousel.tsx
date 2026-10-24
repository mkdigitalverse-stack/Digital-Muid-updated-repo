import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Clock,
  CheckCircle2,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play
} from 'lucide-react';

interface FreeCard {
  id: string;
  title: string;
  duration: string;
  badge: string;
  description: string;
  highlights: string[];
  courseSlug: string;
}

interface AcademyFreeFoundationCarouselProps {
  onCardClick: (title: string) => void;
}

export const AcademyFreeFoundationCarousel: React.FC<AcademyFreeFoundationCarouselProps> = ({ onCardClick }) => {
  const freeCards: FreeCard[] = [
    {
      id: 'ff-01',
      title: 'The 60-Minute Digital Marketing Blueprint',
      duration: '60 Minutes',
      badge: 'Free Foundation Masterclass 01',
      description:
        'Understand the interconnected anatomy of modern demand generation. We deconstruct unit economics, conversion funnels, intent capture, and organic distribution loops in one clinical master walkthrough.',
      highlights: [
        'The 6-stage Digital Growth Stack™ mental model',
        'How to calculate your real break-even CAC',
        'Downloadable companion system framework'
      ],
      courseSlug: 'digital-marketing-masterclass'
    },
    {
      id: 'ff-02',
      title: 'Intro to Freelancing & Client Acquisition',
      duration: '45 Minutes',
      badge: 'Free Foundation Masterclass 02',
      description:
        'How to package technical marketing skills, construct a proof-of-work portfolio without past agency experience, and secure your first 3 high-ticket monthly retainer clients with zero cold spam messaging.',
      highlights: [
        'Packaging skills into productized growth offers',
        'The Clinical Diagnostic pitch script for founders',
        'Retainer pricing formulas: Value-based vs hourly'
      ],
      courseSlug: 'social-media-mastery'
    },
    {
      id: 'ff-03',
      title: 'Unit Economics & Break-Even CAC Calculator',
      duration: '40 Minutes',
      badge: 'Free Foundation Masterclass 03',
      description:
        'Master the financial mathematical equations that dictate paid media survival before spending ad capital. Calculate contribution margins, blended ROAS targets, and payback windows.',
      highlights: [
        'Contribution margin & unit economics formula spreadsheet',
        'Blended CAC vs Platform-reported ROAS reality',
        'Payback window metrics for subscription & commerce'
      ],
      courseSlug: 'meta-ads-mastery'
    },
    {
      id: 'ff-04',
      title: 'Organic Authority & High-Retention Hook Scripting',
      duration: '50 Minutes',
      badge: 'Free Foundation Masterclass 04',
      description:
        'Learn how to write visual and verbal hooks that capture attention in algorithmic feeds. Turn complex founder expertise into bite-sized high-retention video and carousel assets.',
      highlights: [
        'The 3-second visual pattern interrupt methodology',
        'Scripting templates for LinkedIn carousels & YouTube',
        'Repurposing 1 core thesis into 10 distribution formats'
      ],
      courseSlug: 'social-media-mastery'
    },
    {
      id: 'ff-05',
      title: 'Technical SEO & Topical Entity Mapping Starter',
      duration: '45 Minutes',
      badge: 'Free Foundation Masterclass 05',
      description:
        'A practical introduction to search engine architecture in the generative AI era. Learn how Google and answer engines parse topical authority clusters and entity relationships.',
      highlights: [
        'Topical clustering principles & keyword intent triage',
        'JSON-LD schema generation with LLM validation',
        'Core Web Vitals & technical crawl error isolation'
      ],
      courseSlug: 'seo-search-engine-optimisation-with-ai-integration'
    },
    {
      id: 'ff-06',
      title: 'AI Workflow Automation: Process Decomposition',
      duration: '55 Minutes',
      badge: 'Free Foundation Masterclass 06',
      description:
        'Identify high-leverage friction points in daily business operations. Learn how to decompose manual triage workflows and connect webhooks and autonomous LLM agents safely.',
      highlights: [
        'Process decomposition checklist for marketing teams',
        'Connecting webhooks without code complexity',
        'Deploying system prompt guardrails to avoid hallucinations'
      ],
      courseSlug: 'ai-automation-business-operations'
    }
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  // Auto sliding interval (5s)
  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % freeCards.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [isPaused, freeCards.length]);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + freeCards.length) % freeCards.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % freeCards.length);
  };

  // Touch Swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    if (distance > 50) {
      handleNext();
    } else if (distance < -50) {
      handlePrev();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  return (
    <section
      id="free-foundation"
      className="py-20 sm:py-24 border-t border-b border-blue-900/40 bg-gradient-to-br from-[#0B1528] via-[#0F1E36] to-[#07111F] text-white"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400 font-interface">
                NO PAYMENT REQUIRED · 100% FREE (6 APPROVED FOUNDATIONS)
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-white tracking-tight">
              Free Foundation Masterclasses
            </h2>
            <p className="text-slate-300 text-sm sm:text-base font-interface">
              Calibrate your strategic thinking and commercial skills before committing capital. Explore all 6 approved
              foundational modules with live interactive exercises.
            </p>
          </div>

          {/* Carousel Navigation Controls */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsPaused(!isPaused)}
              className="p-2.5 rounded-xl border border-white/10 hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
              aria-label={isPaused ? 'Resume auto sliding' : 'Pause auto sliding'}
              title={isPaused ? 'Play' : 'Pause'}
            >
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={handlePrev}
              className="p-2.5 rounded-xl border border-white/10 hover:bg-white/10 text-slate-200 transition-colors cursor-pointer"
              aria-label="Previous Free Masterclass Card"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="p-2.5 rounded-xl border border-white/10 hover:bg-white/10 text-slate-200 transition-colors cursor-pointer"
              aria-label="Next Free Masterclass Card"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Carousel Container */}
        <div
          className="relative overflow-hidden"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Card Viewport - displays 2 visible cards on lg, 1 on mobile, cycling seamlessly */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[0, 1].map((offset) => {
              const cardIdx = (currentIndex + offset) % freeCards.length;
              const card = freeCards[cardIdx];

              return (
                <div
                  key={`${card.id}-${offset}`}
                  className="p-8 rounded-3xl bg-[#0F1E36]/90 border border-blue-800/40 hover:border-emerald-500/40 transition-all flex flex-col justify-between space-y-6 shadow-xl animate-in fade-in duration-300"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-[11px] font-bold font-mono uppercase tracking-wider border border-emerald-500/25">
                        {card.badge}
                      </span>
                      <span className="text-xs text-slate-300 font-mono flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" /> {card.duration}
                      </span>
                    </div>

                    <h3 className="text-2xl font-display font-bold text-white leading-snug">
                      {card.title}
                    </h3>

                    <p className="text-sm text-slate-300 font-interface leading-relaxed">
                      {card.description}
                    </p>

                    <div className="space-y-2 text-xs text-slate-200 pt-2">
                      {card.highlights.map((h, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>{h}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">Admission Fee</div>
                      <div className="text-xl font-bold font-mono text-emerald-400">FREE / ₹0</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onCardClick(card.title)}
                      className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-emerald-950/40"
                    >
                      <span>Start Free Masterclass</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Carousel Pagination Indicator Dots */}
        <div className="flex items-center justify-center gap-2 pt-2" role="tablist" aria-label="Free Foundation Carousel Dots">
          {freeCards.map((c, idx) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              role="tab"
              aria-selected={currentIndex === idx}
              aria-label={`Go to Free Foundation Card ${idx + 1}: ${c.title}`}
              className={`h-2 rounded-full transition-all cursor-pointer ${
                currentIndex === idx ? 'w-8 bg-emerald-400' : 'w-2 bg-white/20 hover:bg-white/40'
              }`}
            />
          ))}
          <span className="text-xs font-mono text-slate-400 ml-3">
            Card {currentIndex + 1} of {freeCards.length}
          </span>
        </div>
      </div>
    </section>
  );
};
