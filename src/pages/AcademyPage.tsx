import React from 'react';
import { SEOHead } from '../components/SEOHead';
import { analytics, trackEvent } from '../utils/analytics';
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
    <div className="min-h-screen bg-[#07111F] text-slate-100 selection:bg-[#FF6B00] selection:text-white">
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
        className="relative pt-36 pb-20 sm:pt-44 sm:pb-28 lg:pt-48 lg:pb-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
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
      <section id="philosophy" className="py-20 sm:py-24 border-t border-white/5 bg-[#050D1A]/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10">
              <Layers className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FF6B00] font-interface">
                EDUCATIONAL PHILOSOPHY
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-white tracking-tight">
              We teach systems, not just buttons.
            </h2>
            <p className="text-slate-300 text-base sm:text-lg font-interface leading-relaxed">
              Anyone can follow a 20-minute tutorial to toggle an ad placement. But when the auction cost doubles or the
              algorithm updates, button-pushers panic. Operators who understand economic levers, attribution models, and
              creative mechanics thrive.
            </p>
          </div>

          {/* 4 Architectural Principles */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-white/20 transition-colors space-y-4">
              <div className="w-10 h-10 rounded-xl bg-[#1877F2]/10 border border-[#1877F2]/20 text-[#60A5FA] flex items-center justify-center font-mono font-bold text-sm">
                01
              </div>
              <h3 className="text-lg font-display font-bold text-white">First-Principles Unit Economics</h3>
              <p className="text-xs text-slate-400 font-interface leading-relaxed">
                Before touching Ads Manager or an SEO tool, calculate your Contribution Margin, blended CAC, LTV ratios,
                and Payback Windows. If your unit economics are broken, more traffic just burns cash faster.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-white/20 transition-colors space-y-4">
              <div className="w-10 h-10 rounded-xl bg-[#FF6B00]/10 border border-[#FF6B00]/20 text-[#FF6B00] flex items-center justify-center font-mono font-bold text-sm">
                02
              </div>
              <h3 className="text-lg font-display font-bold text-white">Algorithmic Retrieval &amp; Signal Training</h3>
              <p className="text-xs text-slate-400 font-interface leading-relaxed">
                Meta Advantage+ and Google Smart Bidding are not targeted by manual demographic checkboxes. Creative
                assets are your primary targeting vector, trained on clean server-side CAPI telemetry.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-white/20 transition-colors space-y-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono font-bold text-sm">
                03
              </div>
              <h3 className="text-lg font-display font-bold text-white">Full-Stack Conversion Architecture</h3>
              <p className="text-xs text-slate-400 font-interface leading-relaxed">
                No bloated page builder can replace a sub-800ms React/Node.js conversion layer. We teach you how site
                speed, semantic DOM, and frictionless UI directly protect your ad spend.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-white/20 transition-colors space-y-4">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center font-mono font-bold text-sm">
                04
              </div>
              <h3 className="text-lg font-display font-bold text-white">Autonomous Workflows &amp; AI Agents</h3>
              <p className="text-xs text-slate-400 font-interface leading-relaxed">
                Move past novelty prompt generation. Deploy multi-step autonomous LLM workflows, customer intake triage,
                and automated reporting systems that eliminate 15+ hours of manual toil every week.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 3 — PREMIUM CURRICULUMS
          Meta & Google Ads Mastery (₹1,999)
          SEO with AI Integration (₹2,499)
          AI & Automation for Operations (₹2,199)
          ========================================================================= */}
      <section id="premium-curriculums" className="py-20 sm:py-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10">
              <Flame className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FF6B00] font-interface">
                FEATURED MASTER PROGRAMS
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-white tracking-tight">
              Premium Curriculums
            </h2>
            <p className="text-slate-300 text-sm sm:text-base font-interface">
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
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] text-white text-xs font-bold border border-white/10 transition-colors cursor-pointer shrink-0"
          >
            <span>Browse Full Catalog</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* 3 Featured Course Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Card 1: Meta Ads Mastery (crs-02) */}
          <div className="rounded-3xl bg-[#0B1528] border border-white/10 hover:border-[#1877F2]/40 transition-all p-7 sm:p-8 flex flex-col justify-between space-y-6 group shadow-lg">
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
                <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  Course ID: crs-02 · 10 Hours · 24 Lessons
                </div>
                <h3 className="text-xl font-display font-bold text-white group-hover:text-[#60A5FA] transition-colors leading-snug">
                  Meta &amp; Google Ads Mastery: Algorithmic Scaling
                </h3>
                <p className="text-xs text-slate-300 font-interface leading-relaxed">
                  Stop guessing on ad creative. Learn the exact testing protocols, budget pacing rules, dynamic creative
                  sandboxes, and CAPI telemetry used to scale ad accounts profitably.
                </p>
              </div>

              {/* Syllabus Highlights */}
              <div className="space-y-2 text-xs text-slate-300 pt-2 border-t border-white/5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Andromeda retrieval engine &amp; Advantage+ algorithms</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Dynamic creative testing sandboxes &amp; hook scripts</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>First-party CAPI telemetry &amp; blended ROAS rules</span>
                </div>
              </div>
            </div>

            {/* Price & CTA */}
            <div className="pt-4 border-t border-white/10 space-y-4">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">Special Enrollment</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold font-mono text-white">₹1,999</span>
                    <span className="text-xs text-slate-500 line-through font-mono">₹3,499</span>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  43% Off
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleCurriculumClick('meta-ads-mastery')}
                className="w-full py-3.5 rounded-xl bg-[#1877F2] hover:bg-[#166fe5] text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md group-hover:shadow-[#1877F2]/20"
              >
                <span>View Curriculum &amp; Enroll</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Card 2: SEO with AI Integration */}
          <div className="rounded-3xl bg-[#0B1528] border border-white/10 hover:border-emerald-500/40 transition-all p-7 sm:p-8 flex flex-col justify-between space-y-6 group shadow-lg">
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
                <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  Course ID: 14c77e7b... · 8 Hours · 21 Lessons
                </div>
                <h3 className="text-xl font-display font-bold text-white group-hover:text-emerald-400 transition-colors leading-snug">
                  SEO with AI Integration: Intent Dominance
                </h3>
                <p className="text-xs text-slate-300 font-interface leading-relaxed">
                  Master the convergence of search intent, generative answer engine optimization (GEO), and programmatic
                  LLM content architecture to capture high-value buyer demand.
                </p>
              </div>

              {/* Syllabus Highlights */}
              <div className="space-y-2 text-xs text-slate-300 pt-2 border-t border-white/5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Topical authority clusters &amp; entity mapping</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Programmatic SEO workflows with Claude &amp; ChatGPT</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>JSON-LD Schema &amp; Generative Engine Optimization</span>
                </div>
              </div>
            </div>

            {/* Price & CTA */}
            <div className="pt-4 border-t border-white/10 space-y-4">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">Special Enrollment</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold font-mono text-white">₹2,499</span>
                    <span className="text-xs text-slate-500 line-through font-mono">₹8,999</span>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  72% Off
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleCurriculumClick('seo-search-engine-optimisation-with-ai-integration')}
                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md group-hover:shadow-emerald-600/20"
              >
                <span>View Curriculum &amp; Enroll</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Card 3: AI & Automation for Operations (crs-03) */}
          <div className="rounded-3xl bg-[#0B1528] border border-white/10 hover:border-purple-500/40 transition-all p-7 sm:p-8 flex flex-col justify-between space-y-6 group shadow-lg">
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
                <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  Course ID: crs-03 · 10 Hours · 22 Lessons
                </div>
                <h3 className="text-xl font-display font-bold text-white group-hover:text-purple-400 transition-colors leading-snug">
                  AI &amp; Automation for Modern Business Operations
                </h3>
                <p className="text-xs text-slate-300 font-interface leading-relaxed">
                  A pragmatic blueprint for business owners, agency leads, and growth operators to automate customer
                  intake, triage, reporting, and fulfillment workflows without code complexity.
                </p>
              </div>

              {/* Syllabus Highlights */}
              <div className="space-y-2 text-xs text-slate-300 pt-2 border-t border-white/5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Autonomous customer triage &amp; webhook routing</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Connecting CRM pipelines with Make.com &amp; Zapier</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>System prompt engineering &amp; verification gates</span>
                </div>
              </div>
            </div>

            {/* Price & CTA */}
            <div className="pt-4 border-t border-white/10 space-y-4">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">Special Enrollment</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold font-mono text-white">₹2,199</span>
                    <span className="text-xs text-slate-500 line-through font-mono">₹3,999</span>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  45% Off
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleCurriculumClick('ai-automation-business-operations')}
                className="w-full py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md group-hover:shadow-purple-600/20"
              >
                <span>View Curriculum &amp; Enroll</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 4 — FREE FOUNDATION
          The 60-Minute Digital Marketing Blueprint
          Intro to Freelancing & Client Acquisition
          ========================================================================= */}
      <section id="free-foundation" className="py-20 sm:py-24 border-t border-white/5 bg-[#050D1A]/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400 font-interface">
                NO PAYMENT REQUIRED · 100% FREE
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-white tracking-tight">
              Free Foundation
            </h2>
            <p className="text-slate-300 text-sm sm:text-base font-interface">
              Calibrate your strategic thinking and commercial skills before committing capital. These foundational
              modules are completely free for all registered students.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Free Module 1 */}
            <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/10 hover:border-emerald-500/30 transition-all flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-[11px] font-bold font-mono uppercase tracking-wider border border-emerald-500/25">
                    Free Foundation Masterclass
                  </span>
                  <span className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> 60 Minutes
                  </span>
                </div>

                <h3 className="text-2xl font-display font-bold text-white">
                  The 60-Minute Digital Marketing Blueprint
                </h3>

                <p className="text-sm text-slate-300 font-interface leading-relaxed">
                  Understand the interconnected anatomy of modern demand generation. We deconstruct unit economics,
                  conversion funnels, intent capture, and organic distribution loops in one clinical, 60-minute master
                  walkthrough.
                </p>

                <div className="space-y-2 text-xs text-slate-300 pt-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>The 6-stage Digital Growth Stack™ mental model</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>How to calculate your real break-even CAC</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Downloadable companion system framework</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">Admission Fee</div>
                  <div className="text-xl font-bold font-mono text-emerald-400">FREE / ₹0</div>
                </div>

                <button
                  type="button"
                  onClick={() => handleFreeFoundationClick('The 60-Minute Digital Marketing Blueprint')}
                  className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <span>Start Free Masterclass</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Free Module 2 */}
            <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/10 hover:border-emerald-500/30 transition-all flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-[11px] font-bold font-mono uppercase tracking-wider border border-emerald-500/25">
                    Free Foundation Masterclass
                  </span>
                  <span className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> 45 Minutes
                  </span>
                </div>

                <h3 className="text-2xl font-display font-bold text-white">
                  Intro to Freelancing &amp; Client Acquisition
                </h3>

                <p className="text-sm text-slate-300 font-interface leading-relaxed">
                  How to package technical marketing skills, construct a proof-of-work portfolio without past agency
                  experience, and secure your first 3 high-ticket monthly retainer clients with zero spam cold messaging.
                </p>

                <div className="space-y-2 text-xs text-slate-300 pt-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Packaging skills into productized growth offers</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>The Clinical Diagnostic pitch script for founders</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Retainer pricing formulas: Value-based vs hourly</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">Admission Fee</div>
                  <div className="text-xl font-bold font-mono text-emerald-400">FREE / ₹0</div>
                </div>

                <button
                  type="button"
                  onClick={() => handleFreeFoundationClick('Intro to Freelancing & Client Acquisition')}
                  className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <span>Start Free Masterclass</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 5 — STUDENT TRANSFORMATIONS
          Real, approved testimonials, screenshots, and written reviews
          ========================================================================= */}
      <section id="student-transformations" className="py-20 sm:py-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10">
            <Quote className="w-3.5 h-3.5 text-[#FF6B00]" />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FF6B00] font-interface">
              VERIFIED STUDENT PROOF
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-white tracking-tight">
            Student Transformations
          </h2>
          <p className="text-slate-300 text-sm sm:text-base font-interface">
            Real outcomes from students, agency leaders, and founders who implemented our operational frameworks in
            live production.
          </p>
        </div>

        {/* 3 Real Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Review 1 */}
          <div className="p-8 rounded-3xl bg-[#0B1528] border border-white/10 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-1 text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400" />
                ))}
              </div>
              <p className="text-sm text-slate-200 font-interface leading-relaxed italic">
                “The depth of real-world implementation in Muid’s masterclasses is unmatched. He teaches you how
                algorithms actually function under the hood, not just what buttons to click in Ad Manager.”
              </p>
            </div>

            <div className="pt-4 border-t border-white/5 flex items-center gap-4">
              <img
                src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80"
                alt="Karan Malhotra"
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded-full object-cover border border-white/10"
              />
              <div>
                <div className="font-display font-bold text-white text-sm">Karan Malhotra</div>
                <div className="text-[11px] text-slate-400 font-interface">Digital Marketing Strategist · ScaleX Media</div>
                <div className="mt-1 text-[11px] font-mono font-bold text-emerald-400">
                  Promoted to Senior Growth Lead
                </div>
              </div>
            </div>
          </div>

          {/* Review 2 */}
          <div className="p-8 rounded-3xl bg-[#0B1528] border border-white/10 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-1 text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400" />
                ))}
              </div>
              <p className="text-sm text-slate-200 font-interface leading-relaxed italic">
                “Muid does not speak in empty buzzwords. His Digital Growth Stack framework allowed our executive team to
                finally align customer acquisition, patient booking systems, and automated follow-ups into one coherent
                engine.”
              </p>
            </div>

            <div className="pt-4 border-t border-white/5 flex items-center gap-4">
              <img
                src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80"
                alt="Priya Narayanan"
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded-full object-cover border border-white/10"
              />
              <div>
                <div className="font-display font-bold text-white text-sm">Priya Narayanan</div>
                <div className="text-[11px] text-slate-400 font-interface">Head of Growth · Aura Health &amp; Care</div>
                <div className="mt-1 text-[11px] font-mono font-bold text-emerald-400">
                  -42% Patient Acquisition Cost
                </div>
              </div>
            </div>
          </div>

          {/* Review 3 */}
          <div className="p-8 rounded-3xl bg-[#0B1528] border border-white/10 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-1 text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400" />
                ))}
              </div>
              <p className="text-sm text-slate-200 font-interface leading-relaxed italic">
                “Booking a consultation with Digital Muid was the turning point in our quarterly marketing strategy. In
                30 minutes, he dissected our broken funnel and gave us a razor-sharp 3-step action plan that tripled our
                qualified pipeline.”
              </p>
            </div>

            <div className="pt-4 border-t border-white/5 flex items-center gap-4">
              <img
                src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80"
                alt="Rajesh Sharma"
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded-full object-cover border border-white/10"
              />
              <div>
                <div className="font-display font-bold text-white text-sm">Rajesh Sharma</div>
                <div className="text-[11px] text-slate-400 font-interface">Founder &amp; CEO · FinVantage Solutions</div>
                <div className="mt-1 text-[11px] font-mono font-bold text-emerald-400">
                  3.2x Qualified Inbound Pipeline
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Video Breakdown Teardown Banner */}
        <div className="p-8 rounded-3xl bg-gradient-to-r from-blue-950/40 via-slate-900/40 to-slate-950 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-6">
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

          <a
            href="/watch/digital-growth-stack-masterclass"
            onClick={(e) => {
              e.preventDefault();
              navigate('/watch');
            }}
            className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shrink-0"
          >
            <span>Watch Masterclass</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </section>

      {/* =========================================================================
          SECTION 6 — RESOURCE VAULT
          Three free toolkits with working download links
          ========================================================================= */}
      <section id="resource-vault" className="py-20 sm:py-24 border-t border-white/5 bg-[#050D1A]/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="max-w-2xl space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10">
                <Download className="w-3.5 h-3.5 text-[#FF6B00]" />
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FF6B00] font-interface">
                  OPERATIONAL TOOLKITS
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-white tracking-tight">
                The Resource Vault
              </h2>
              <p className="text-slate-300 text-sm sm:text-base font-interface">
                Three free, battle-tested toolkits, prompt libraries, and diagnostic spreadsheets to accelerate your
                daily marketing execution.
              </p>
            </div>

            <a
              href="/resources"
              onClick={(e) => {
                e.preventDefault();
                navigate('/resources');
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] text-white text-xs font-bold border border-white/10 transition-colors cursor-pointer shrink-0"
            >
              <span>Explore All Resources</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Toolkit 1: AI Prompt Pack */}
            <div className="p-7 rounded-3xl bg-[#0B1528] border border-white/10 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                  <Cpu className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
                    PDF Guide · 3.4 MB
                  </span>
                  <h3 className="text-xl font-display font-bold text-white pt-1">
                    AI Prompt Pack: 50+ Growth Prompts
                  </h3>
                  <p className="text-xs text-slate-300 font-interface leading-relaxed">
                    Precision system prompts for market sizing, ICP psychological profiling, ad copywriting, competitor
                    gap analysis, and executive strategy.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-white/5 space-y-2">
                <a
                  href="/downloads/ai-growth-prompts.pdf"
                  download
                  className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF (3.4 MB)</span>
                </a>
                <button
                  type="button"
                  onClick={() => navigate('/resources/ai-prompt-pack-growth-strategy')}
                  className="w-full py-2 text-center text-[11px] text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  View Details &amp; Preview Points
                </button>
              </div>
            </div>

            {/* Toolkit 2: 32-Point Growth Checklist */}
            <div className="p-7 rounded-3xl bg-[#0B1528] border border-white/10 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                    PDF Checklist · 1.8 MB
                  </span>
                  <h3 className="text-xl font-display font-bold text-white pt-1">
                    The 32-Point Growth Checklist
                  </h3>
                  <p className="text-xs text-slate-300 font-interface leading-relaxed">
                    The diagnostic checklist we use during private client audits to uncover marketing leaks, conversion
                    bottlenecks, and automation opportunities.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-white/5 space-y-2">
                <a
                  href="/downloads/digital-growth-checklist.pdf"
                  download
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF (1.8 MB)</span>
                </a>
                <button
                  type="button"
                  onClick={() => navigate('/resources/digital-growth-checklist-32-vectors')}
                  className="w-full py-2 text-center text-[11px] text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  View Details &amp; Preview Points
                </button>
              </div>
            </div>

            {/* Toolkit 3: 30-Day Thought Leadership OS */}
            <div className="p-7 rounded-3xl bg-[#0B1528] border border-white/10 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-[#60A5FA] flex items-center justify-center">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#60A5FA] bg-blue-500/10 px-2 py-0.5 rounded">
                    XLSX / Notion · 2.1 MB
                  </span>
                  <h3 className="text-xl font-display font-bold text-white pt-1">
                    30-Day Thought Leadership OS
                  </h3>
                  <p className="text-xs text-slate-300 font-interface leading-relaxed">
                    A modular spreadsheet &amp; Notion system to plan, write, and repurpose high-authority content across
                    LinkedIn, YouTube, and newsletters in 2 hours/week.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-white/5 space-y-2">
                <a
                  href="/downloads/thought-leadership-os.xlsx"
                  download
                  className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Template (2.1 MB)</span>
                </a>
                <button
                  type="button"
                  onClick={() => navigate('/resources/content-strategy-template-30-day-os')}
                  className="w-full py-2 text-center text-[11px] text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  View Details &amp; Preview Points
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 7 — LEARNER'S HUB
          Links to actual published articles
          ========================================================================= */}
      <section id="learners-hub" className="py-20 sm:py-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10">
              <BookOpen className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FF6B00] font-interface">
                STRATEGIC ESSAYS &amp; TEARDOWNS
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-white tracking-tight">
              Learner's Hub
            </h2>
            <p className="text-slate-300 text-sm sm:text-base font-interface">
              Long-form deep dives into customer acquisition economics, generative AI, and authority publishing.
            </p>
          </div>

          <a
            href="/insights"
            onClick={(e) => {
              e.preventDefault();
              navigate('/insights');
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] text-white text-xs font-bold border border-white/10 transition-colors cursor-pointer shrink-0"
          >
            <span>Read All Articles</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* 4 Real Published Articles */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <a
            href="/blog/digital-no-longer-just-marketing"
            onClick={(e) => {
              e.preventDefault();
              navigate('/blog/digital-no-longer-just-marketing');
            }}
            className="p-6 rounded-2xl bg-[#0B1528] border border-white/10 hover:border-white/25 transition-all group flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                Strategy · 6 Min Read
              </span>
              <h3 className="text-base font-display font-bold text-white group-hover:text-[#60A5FA] transition-colors leading-snug">
                Digital Is No Longer Just Marketing: The 2026 Strategic Convergence
              </h3>
              <p className="text-xs text-slate-400 font-interface line-clamp-3">
                For decades, companies treated digital as a departmental silo. Today, growth occurs exclusively at the
                intersection of AI, customer operations, and brand trust.
              </p>
            </div>
            <div className="text-xs font-bold text-[#60A5FA] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              <span>Read Essay</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </a>

          <a
            href="/blog/meta-ads-2026-algorithmic-shift"
            onClick={(e) => {
              e.preventDefault();
              navigate('/blog/meta-ads-2026-algorithmic-shift');
            }}
            className="p-6 rounded-2xl bg-[#0B1528] border border-white/10 hover:border-white/25 transition-all group flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#60A5FA] bg-blue-500/10 px-2 py-0.5 rounded">
                Performance · 8 Min Read
              </span>
              <h3 className="text-base font-display font-bold text-white group-hover:text-[#60A5FA] transition-colors leading-snug">
                Meta Ads in 2026: The Algorithmic Shift
              </h3>
              <p className="text-xs text-slate-400 font-interface line-clamp-3">
                Why micro-targeting is dead, and how creative architecture, high-resonance hooks, and first-party data
                are driving superior ROAS.
              </p>
            </div>
            <div className="text-xs font-bold text-[#60A5FA] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              <span>Read Essay</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </a>

          <a
            href="/blog/practical-ai-transformation-framework"
            onClick={(e) => {
              e.preventDefault();
              navigate('/blog/practical-ai-transformation-framework');
            }}
            className="p-6 rounded-2xl bg-[#0B1528] border border-white/10 hover:border-white/25 transition-all group flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
                AI &amp; Ops · 7 Min Read
              </span>
              <h3 className="text-base font-display font-bold text-white group-hover:text-purple-400 transition-colors leading-snug">
                Practical AI Transformation: Moving from Novelty to Margin
              </h3>
              <p className="text-xs text-slate-400 font-interface line-clamp-3">
                How leading founders audit their workflows, isolate leverage points, and deploy autonomous agents
                without breaking customer trust.
              </p>
            </div>
            <div className="text-xs font-bold text-[#60A5FA] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              <span>Read Essay</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </a>

          <a
            href="/blog/building-founder-authority-commodity-ai-content"
            onClick={(e) => {
              e.preventDefault();
              navigate('/blog/building-founder-authority-commodity-ai-content');
            }}
            className="p-6 rounded-2xl bg-[#0B1528] border border-white/10 hover:border-white/25 transition-all group flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                Authority · 5 Min Read
              </span>
              <h3 className="text-base font-display font-bold text-white group-hover:text-amber-400 transition-colors leading-snug">
                Building Founder Authority in the Era of Commodity AI Content
              </h3>
              <p className="text-xs text-slate-400 font-interface line-clamp-3">
                When generative AI can create endless articles, human perspective, verifiable track record, and
                original frameworks become your ultimate moat.
              </p>
            </div>
            <div className="text-xs font-bold text-[#60A5FA] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              <span>Read Essay</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </a>
        </div>
      </section>

      {/* =========================================================================
          SECTION 8 — COMMUNITY & ACCOUNTABILITY
          Accurate information about Q&A, campaign teardowns, and job/freelance ops
          ========================================================================= */}
      <section id="community" className="py-20 sm:py-28 border-t border-white/5 bg-[#050D1A]/80">
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
    </div>
  );
};
