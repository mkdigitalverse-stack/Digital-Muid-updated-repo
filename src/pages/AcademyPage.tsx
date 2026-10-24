import React from 'react';
import { SEOHead } from '../components/SEOHead';
import { analytics, trackEvent } from '../utils/analytics';
import { AcademyBenefitsSection } from '../components/academy/AcademyBenefitsSection';
import { AcademyAboutMkSection } from '../components/academy/AcademyAboutMkSection';
import { AcademyFacultySection } from '../components/academy/AcademyFacultySection';
import { AcademyCaseStudiesSection } from '../components/academy/AcademyCaseStudiesSection';
import { AcademyStudentGalleryCarousel } from '../components/academy/AcademyStudentGalleryCarousel';
import { AcademyDeliveryModesSection } from '../components/academy/AcademyDeliveryModesSection';
import { AcademyFaqSection } from '../components/academy/AcademyFaqSection';
import { AcademyWhatsAppButton } from '../components/academy/AcademyWhatsAppButton';
import { AcademyFreeFoundationCarousel } from '../components/academy/AcademyFreeFoundationCarousel';
import { AcademyReviewsSection } from '../components/academy/AcademyReviewsSection';
import { AcademyResourcesVaultSection } from '../components/academy/AcademyResourcesVaultSection';
import { AcademyBlogSection } from '../components/academy/AcademyBlogSection';
import {
  GraduationCap,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Download,
  BookOpen,
  Users,
  Video,
  Layers,
  Cpu,
  Clock,
  ShieldCheck,
  TrendingUp,
  ExternalLink,
  MessageSquare,
  FileSpreadsheet,
  FileText,
  Briefcase,
  Star,
  Quote,
  Flame,
  Lightbulb,
  Zap
} from 'lucide-react';

interface AcademyPageProps {
  navigate: (path: string) => void;
}

export const AcademyPage: React.FC<AcademyPageProps> = ({ navigate }) => {
  const handleCurriculumClick = (slug: string) => {
    trackEvent('academy_curriculum_click', {
      curriculum_slug: slug,
      destination: `/learn/${slug}`
    });
    navigate(`/learn/${slug}`);
  };

  const handleFreeFoundationClick = (title: string) => {
    trackEvent('academy_free_foundation_click', {
      course_title: title,
      destination: '/learn'
    });
    navigate('/learn');
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const navOffset = 80;
      const elementPosition = el.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo({
        top: elementPosition - navOffset,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-[#FF6B00] selection:text-white">
      {/* Search Engine Optimization & Structured Data */}
      <SEOHead
        path="/academy"
        customData={{
          title: 'Digital MUID Academy | Digital Marketing & AI Education',
          description:
            'Explore practical digital marketing, advertising, SEO, and AI education for students, freelancers, and growth operators at Digital MUID Academy.',
          canonicalUrl: 'https://digitalmuid.in/academy'
        }}
      />

      {/* =========================================================================
          SECTION 1 — THE EDUCATION HERO
          "Stop learning platform hacks. Master the mechanics of digital growth."
          ========================================================================= */}
      <section
        id="education-hero"
        className="relative bg-[#07111F] text-white pt-36 pb-20 sm:pt-44 sm:pb-28 lg:pt-48 lg:pb-32 px-4 sm:px-6 lg:px-8 border-b border-slate-800"
      >
        {/* Subtle radial ambient glow */}
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-[#1877F2]/10 blur-[150px] rounded-full pointer-events-none -z-10"
          aria-hidden="true"
        />

        <div className="max-w-4xl mx-auto text-center space-y-8">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/10">
            <GraduationCap className="w-3.5 h-3.5 text-[#FF6B00]" />
            <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#FF6B00] font-interface">
              DIGITAL MUID ACADEMY · SYSTEMS OVER TACTICS
            </span>
          </div>

          {/* H1 */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-display font-bold tracking-tight text-white leading-[1.12] text-balance">
            Stop learning platform hacks.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-400">
              Master the mechanics of digital growth.
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-base sm:text-lg lg:text-xl text-slate-300 font-interface leading-relaxed max-w-3xl mx-auto font-light">
            Tactical button-pushing becomes obsolete with every algorithm update. We train founders, marketing leaders,
            and growth operators to architect predictable client acquisition engines using first-principles economics,
            custom web infrastructure, and algorithmic media.
          </p>

          {/* Action CTAs */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              id="hero-explore-curriculums-btn"
              type="button"
              onClick={() => scrollToSection('premium-curriculums')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl bg-[#FF6B00] hover:bg-[#FF7A1A] text-white font-bold text-sm tracking-wide shadow-xl shadow-[#FF6B00]/25 transition-all duration-200 cursor-pointer active:scale-[0.98] font-interface group"
            >
              <span>Explore Premium Curriculums</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>

            <button
              id="hero-free-foundation-btn"
              type="button"
              onClick={() => scrollToSection('free-foundation')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] text-white font-semibold text-sm border border-white/10 hover:border-white/20 transition-all duration-200 cursor-pointer font-interface"
            >
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Access Free Foundation</span>
            </button>
          </div>

          {/* Catalog Deep Link */}
          <div className="pt-1">
            <a
              href="/learn"
              onClick={(e) => {
                e.preventDefault();
                navigate('/learn');
              }}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer group"
            >
              <span>Looking for the full catalog with level filters?</span>
              <span className="text-[#60A5FA] group-hover:underline font-semibold">Browse all courses</span>
              <ArrowRight className="w-3 h-3 text-[#60A5FA]" />
            </a>
          </div>

          {/* Telemetry / Trust Grid */}
          <div className="pt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 max-w-3xl mx-auto text-left">
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
              <div className="text-xl font-bold font-mono text-white">15+ Years</div>
              <div className="text-[11px] text-slate-400 font-interface">Battle-Tested Models</div>
            </div>
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
              <div className="text-xl font-bold font-mono text-emerald-400">4,500+</div>
              <div className="text-[11px] text-slate-400 font-interface">Practitioners Trained</div>
            </div>
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
              <div className="text-xl font-bold font-mono text-white">100%</div>
              <div className="text-[11px] text-slate-400 font-interface">Real-Account Telemetry</div>
            </div>
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
              <div className="text-xl font-bold font-mono text-[#FF6B00]">Verified</div>
              <div className="text-[11px] text-slate-400 font-interface">Certificate Security</div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 2 — THE PHILOSOPHY
          "We teach systems, not just buttons."
          ========================================================================= */}
      <section id="philosophy" className="py-20 sm:py-24 border-t border-b border-slate-200/80 bg-slate-50 text-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#1877F2]">
              <Layers className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#1877F2] font-interface">
                EDUCATIONAL PHILOSOPHY
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-slate-900 tracking-tight">
              We teach systems, not just buttons.
            </h2>
            <p className="text-slate-600 text-base sm:text-lg font-interface leading-relaxed">
              Anyone can follow a 20-minute tutorial to toggle an ad placement. But when the auction cost doubles or the
              algorithm updates, button-pushers panic. Operators who understand economic levers, attribution models, and
              creative mechanics thrive.
            </p>
          </div>

          {/* 4 Architectural Principles */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-2xl bg-white border border-slate-200/80 hover:border-slate-300 hover:shadow-md transition-all space-y-4 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-[#1877F2] flex items-center justify-center font-mono font-bold text-sm">
                01
              </div>
              <h3 className="text-lg font-display font-bold text-slate-900">First-Principles Unit Economics</h3>
              <p className="text-xs text-slate-600 font-interface leading-relaxed">
                Before touching Ads Manager or an SEO tool, calculate your Contribution Margin, blended CAC, LTV ratios,
                and Payback Windows. If your unit economics are broken, more traffic just burns cash faster.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200/80 hover:border-slate-300 hover:shadow-md transition-all space-y-4 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200 text-[#FF6B00] flex items-center justify-center font-mono font-bold text-sm">
                02
              </div>
              <h3 className="text-lg font-display font-bold text-slate-900">Algorithmic Retrieval &amp; Signal Training</h3>
              <p className="text-xs text-slate-600 font-interface leading-relaxed">
                Meta Advantage+ and Google Smart Bidding are not targeted by manual demographic checkboxes. Creative
                assets are your primary targeting vector, trained on clean server-side CAPI telemetry.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200/80 hover:border-slate-300 hover:shadow-md transition-all space-y-4 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center font-mono font-bold text-sm">
                03
              </div>
              <h3 className="text-lg font-display font-bold text-slate-900">Full-Stack Conversion Architecture</h3>
              <p className="text-xs text-slate-600 font-interface leading-relaxed">
                No bloated page builder can replace a sub-800ms React/Node.js conversion layer. We teach you how site
                speed, semantic DOM, and frictionless UI directly protect your ad spend.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200/80 hover:border-slate-300 hover:shadow-md transition-all space-y-4 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 text-purple-600 flex items-center justify-center font-mono font-bold text-sm">
                04
              </div>
              <h3 className="text-lg font-display font-bold text-slate-900">Autonomous Workflows &amp; AI Agents</h3>
              <p className="text-xs text-slate-600 font-interface leading-relaxed">
                Move past novelty prompt generation. Deploy multi-step autonomous LLM workflows, customer intake triage,
                and automated reporting systems that eliminate 15+ hours of manual toil every week.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          ADDITIONAL SECTION 1 — BENEFITS OF LEARNING DIGITALMUID
          Structured training, practical learning, real-world workflows
          ========================================================================= */}
      <AcademyBenefitsSection />

      {/* =========================================================================
          SECTION 3 — PREMIUM CURRICULUMS
          Meta & Google Ads Mastery (₹1,999)
          SEO with AI Integration (₹2,499)
          AI & Automation for Operations (₹2,199)
          ========================================================================= */}
      <section id="premium-curriculums" className="py-20 sm:py-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 bg-white text-slate-900">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200">
              <Flame className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FF6B00] font-interface">
                FEATURED MASTER PROGRAMS
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-slate-900 tracking-tight">
              Premium Curriculums
            </h2>
            <p className="text-slate-600 text-sm sm:text-base font-interface">
              Practitioner-built master programs engineered to deliver verifiable outcomes. All curriculums feature
              production-grade templates, private alumni access, and quarterly updates.
            </p>
          </div>

          <a
            href="/learn"
            onClick={(e) => {
              e.preventDefault();
              navigate('/learn');
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer shrink-0 shadow-sm"
          >
            <span>Browse Full Catalog</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* 3 Featured Course Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Card 1: Meta Ads Mastery (crs-02) */}
          <div className="rounded-3xl bg-white border border-slate-200/90 hover:border-[#1877F2]/50 hover:shadow-xl transition-all p-7 sm:p-8 flex flex-col justify-between space-y-6 group shadow-sm">
            <div className="space-y-5">
              {/* Thumbnail / Header */}
              <div className="aspect-[16/9] w-full rounded-2xl bg-slate-900 relative overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80"
                  alt="Meta & Google Ads Mastery"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded bg-black/70 backdrop-blur-md text-[#FF6B00] text-[10px] font-bold uppercase tracking-wider border border-white/10">
                    Intermediate
                  </span>
                  <span className="px-2.5 py-1 rounded bg-[#1877F2] text-white text-[10px] font-bold flex items-center gap-1 shadow-sm">
                    <Sparkles className="w-2.5 h-2.5" /> AI-Integrated
                  </span>
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-2">
                <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
                  Course ID: crs-02 · 10 Hours · 24 Lessons
                </div>
                <h3 className="text-xl font-display font-bold text-slate-900 group-hover:text-[#1877F2] transition-colors leading-snug">
                  Meta &amp; Google Ads Mastery: Algorithmic Scaling
                </h3>
                <p className="text-xs text-slate-600 font-interface leading-relaxed">
                  Stop guessing on ad creative. Learn the exact testing protocols, budget pacing rules, dynamic creative
                  sandboxes, and CAPI telemetry used to scale ad accounts profitably.
                </p>
              </div>

              {/* Syllabus Highlights */}
              <div className="space-y-2 text-xs text-slate-700 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Andromeda retrieval engine &amp; Advantage+ algorithms</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Dynamic creative testing sandboxes &amp; hook scripts</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>First-party CAPI telemetry &amp; blended ROAS rules</span>
                </div>
              </div>
            </div>

            {/* Price & CTA */}
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Special Enrollment</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold font-mono text-slate-900">₹1,999</span>
                    <span className="text-xs text-slate-400 line-through font-mono">₹3,499</span>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  43% Off
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleCurriculumClick('meta-ads-mastery')}
                className="w-full py-3.5 rounded-xl bg-[#FF6B00] hover:bg-[#FF7A1A] text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-[#FF6B00]/20"
              >
                <span>View Curriculum &amp; Enroll</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Card 2: SEO with AI Integration */}
          <div className="rounded-3xl bg-white border border-slate-200/90 hover:border-emerald-500/50 hover:shadow-xl transition-all p-7 sm:p-8 flex flex-col justify-between space-y-6 group shadow-sm">
            <div className="space-y-5">
              {/* Thumbnail / Header */}
              <div className="aspect-[16/9] w-full rounded-2xl bg-slate-900 relative overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80"
                  alt="SEO with AI Integration"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded bg-black/70 backdrop-blur-md text-[#FF6B00] text-[10px] font-bold uppercase tracking-wider border border-white/10">
                    All Levels
                  </span>
                  <span className="px-2.5 py-1 rounded bg-emerald-600 text-white text-[10px] font-bold flex items-center gap-1 shadow-sm">
                    <Sparkles className="w-2.5 h-2.5" /> AI-Integrated
                  </span>
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-2">
                <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
                  Course ID: 14c77e7b... · 8 Hours · 21 Lessons
                </div>
                <h3 className="text-xl font-display font-bold text-slate-900 group-hover:text-emerald-600 transition-colors leading-snug">
                  SEO with AI Integration: Intent Dominance
                </h3>
                <p className="text-xs text-slate-600 font-interface leading-relaxed">
                  Master the convergence of search intent, generative answer engine optimization (GEO), and programmatic
                  LLM content architecture to capture high-value buyer demand.
                </p>
              </div>

              {/* Syllabus Highlights */}
              <div className="space-y-2 text-xs text-slate-700 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Topical authority clusters &amp; entity mapping</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Programmatic SEO workflows with Claude &amp; ChatGPT</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>JSON-LD Schema &amp; Generative Engine Optimization</span>
                </div>
              </div>
            </div>

            {/* Price & CTA */}
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Special Enrollment</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold font-mono text-slate-900">₹2,499</span>
                    <span className="text-xs text-slate-400 line-through font-mono">₹8,999</span>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  72% Off
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleCurriculumClick('seo-search-engine-optimisation-with-ai-integration')}
                className="w-full py-3.5 rounded-xl bg-[#FF6B00] hover:bg-[#FF7A1A] text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-[#FF6B00]/20"
              >
                <span>View Curriculum &amp; Enroll</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Card 3: AI & Automation for Operations (crs-03) */}
          <div className="rounded-3xl bg-white border border-slate-200/90 hover:border-purple-500/50 hover:shadow-xl transition-all p-7 sm:p-8 flex flex-col justify-between space-y-6 group shadow-sm">
            <div className="space-y-5">
              {/* Thumbnail / Header */}
              <div className="aspect-[16/9] w-full rounded-2xl bg-slate-900 relative overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80"
                  alt="AI & Automation for Operations"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded bg-black/70 backdrop-blur-md text-[#FF6B00] text-[10px] font-bold uppercase tracking-wider border border-white/10">
                    Intermediate
                  </span>
                  <span className="px-2.5 py-1 rounded bg-purple-600 text-white text-[10px] font-bold flex items-center gap-1 shadow-sm">
                    <Sparkles className="w-2.5 h-2.5" /> AI-Integrated
                  </span>
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-2">
                <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
                  Course ID: crs-03 · 10 Hours · 22 Lessons
                </div>
                <h3 className="text-xl font-display font-bold text-slate-900 group-hover:text-purple-600 transition-colors leading-snug">
                  AI &amp; Automation for Modern Business Operations
                </h3>
                <p className="text-xs text-slate-600 font-interface leading-relaxed">
                  A pragmatic blueprint for business owners, agency leads, and growth operators to automate customer
                  intake, triage, reporting, and fulfillment workflows without code complexity.
                </p>
              </div>

              {/* Syllabus Highlights */}
              <div className="space-y-2 text-xs text-slate-700 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Autonomous customer triage &amp; webhook routing</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Connecting CRM pipelines with Make.com &amp; Zapier</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>System prompt engineering &amp; verification gates</span>
                </div>
              </div>
            </div>

            {/* Price & CTA */}
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Special Enrollment</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold font-mono text-slate-900">₹2,199</span>
                    <span className="text-xs text-slate-400 line-through font-mono">₹3,999</span>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  45% Off
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleCurriculumClick('ai-automation-business-operations')}
                className="w-full py-3.5 rounded-xl bg-[#FF6B00] hover:bg-[#FF7A1A] text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-[#FF6B00]/20"
              >
                <span>View Curriculum &amp; Enroll</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          ADDITIONAL SECTION 6 — TRAINING DELIVERY MODES (ONLINE & OFFLINE)
          ========================================================================= */}
      <AcademyDeliveryModesSection navigate={navigate} />

      {/* =========================================================================
          ADDITIONAL SECTION 4 — PRACTICAL TRAINING APPROACH: PROJECT CASE STUDIES
          ========================================================================= */}
      <AcademyCaseStudiesSection />

      {/* =========================================================================
          ADDITIONAL SECTION 3 — COURSE FACULTY (FOUR PROFILES)
          ========================================================================= */}
      <AcademyFacultySection />

      {/* =========================================================================
          SECTION 4 — FREE FOUNDATION (6-CARD INTERACTIVE CAROUSEL)
          ========================================================================= */}
      <AcademyFreeFoundationCarousel onCardClick={handleFreeFoundationClick} />

      {/* =========================================================================
          SECTION 5 — STUDENT TRANSFORMATIONS (VERIFIED REVIEWS & FEEDBACK)
          ========================================================================= */}
      <AcademyReviewsSection navigate={navigate} />

      {/* =========================================================================
          ADDITIONAL SECTION 5 — STUDENT SUCCESS GALLERY: SQUARE IMAGE CAROUSEL
          ========================================================================= */}
      <AcademyStudentGalleryCarousel />

      {/* =========================================================================
          ADDITIONAL SECTION 2 — ABOUT MK DIGITALVERSE
          ========================================================================= */}
      <AcademyAboutMkSection />

      {/* =========================================================================
          SECTION 6 — RESOURCE VAULT (CONNECTED OPERATIONAL ASSETS)
          ========================================================================= */}
      <AcademyResourcesVaultSection navigate={navigate} />

      {/* =========================================================================
          SECTION 7 — LEARNER'S HUB (VERIFIED PUBLISHED ARTICLES)
          ========================================================================= */}
      <AcademyBlogSection navigate={navigate} />

      {/* =========================================================================
          ADDITIONAL SECTION 7 — FREQUENTLY ASKED QUESTIONS (ACCESSIBLE ACCORDIONS)
          ========================================================================= */}
      <AcademyFaqSection />

      {/* =========================================================================
          SECTION 8 — COMMUNITY & ACCOUNTABILITY
          Accurate information about Q&A, campaign teardowns, and job/freelance ops
          ========================================================================= */}
      <section id="community" className="py-20 sm:py-28 border-t border-slate-800 bg-[#07111F] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10">
              <Users className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FF6B00] font-interface">
                ACTIVE OPERATOR NETWORK
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-white tracking-tight">
              A Practitioner Community, Not a Passive Video Archive
            </h2>
            <p className="text-slate-300 text-base sm:text-lg font-interface leading-relaxed">
              Enrolling in Digital MUID Academy connects you directly to an active operating network. Courses are backed
              by real-world accountability, weekly strategic office hours, and collaborative campaign audits.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-[#60A5FA] flex items-center justify-center">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h3 className="text-base font-display font-bold text-white">Live Strategy Q&amp;A</h3>
              <p className="text-xs text-slate-400 font-interface leading-relaxed">
                Bi-weekly live video sessions with Digital Muid to troubleshoot ad account pacing, conversion anomalies,
                and technical bottlenecks.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#FF6B00]/10 text-[#FF6B00] flex items-center justify-center">
                <Flame className="w-5 h-5" />
              </div>
              <h3 className="text-base font-display font-bold text-white">Live Campaign Teardowns</h3>
              <p className="text-xs text-slate-400 font-interface leading-relaxed">
                Submit your active ad funnels, landing pages, or client pitch decks for clinical teardowns in front of
                the peer cohort.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Briefcase className="w-5 h-5" />
              </div>
              <h3 className="text-base font-display font-bold text-white">Freelance &amp; Job Leads</h3>
              <p className="text-xs text-slate-400 font-interface leading-relaxed">
                Direct access to high-ticket consulting briefs, agency placement referrals, and vetted founder client
                introductions.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-display font-bold text-white">Continual IP Updates</h3>
              <p className="text-xs text-slate-400 font-interface leading-relaxed">
                Lifetime updates to prompt libraries, webhook blueprints, and curriculum lessons whenever major platform
                algorithms shift.
              </p>
            </div>
          </div>

          {/* Final Call to Action Box */}
          <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-b from-[#0B1528] to-[#07111F] border border-white/10 text-center space-y-6">
            <h3 className="text-2xl sm:text-3xl font-display font-bold text-white">
              Ready to master modern growth systems?
            </h3>
            <p className="text-sm text-slate-300 font-interface max-w-xl mx-auto">
              Choose a practitioner curriculum or explore our full catalog with category filters and instant enrollment.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <a
                href="/learn"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/learn');
                }}
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-[#FF6B00] hover:bg-[#FF7A1A] text-white font-bold text-sm tracking-wide shadow-xl shadow-[#FF6B00]/25 transition-all cursor-pointer font-interface"
              >
                Browse All Courses in Catalog
              </a>

              <a
                href="/growth-audit"
                onClick={(e) => {
                  e.preventDefault();
                  analytics.trackGrowthAuditCta('academy_footer', '/growth-audit');
                  navigate('/growth-audit');
                }}
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm border border-white/10 transition-all cursor-pointer font-interface"
              >
                Request a Strategic Growth Audit
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          ADDITIONAL SECTION 8 — FLOATING WHATSAPP CONTACT BUTTON (+91 93358 17155)
          ========================================================================= */}
      <AcademyWhatsAppButton />
    </div>
  );
};
