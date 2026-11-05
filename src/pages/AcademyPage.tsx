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
  Users,
  Layers,
  Cpu,
  ShieldCheck,
  TrendingUp,
  MessageSquare,
  Briefcase,
  Flame,
  Zap,
  Target,
  FileText,
  Award,
  BookOpen,
  HelpCircle,
  Building
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

  const corePillars = [
    {
      number: '01',
      title: 'Scientific Paid Media & Performance Buying (Meta Ads)',
      icon: TrendingUp,
      color: 'blue',
      points: [
        'Move beyond vanity metrics like CTR and impressions to master CAC, ROAS, and MER (Marketing Efficiency Ratio).',
        'Direct-response ad creative strategy, hook testing frameworks, and high-budget scaling mechanics.',
        'Pixel diagnostics, Conversions API (CAPI) architecture, and attribution modeling.'
      ]
    },
    {
      number: '02',
      title: 'Direct-Response Funnel Architecture',
      icon: Layers,
      color: 'orange',
      points: [
        'The psychology of high-converting landing pages: headline testing, narrative friction, and value propositions.',
        'Designing triage lead capture flows that qualify and educate prospects before they speak to sales.',
        'Understanding modern tech infrastructure: Why custom-engineered frameworks (React & Node.js) outperform bloated drag-and-drop templates.'
      ]
    },
    {
      number: '03',
      title: 'AI Workflows & Marketing Automation',
      icon: Zap,
      color: 'purple',
      points: [
        'Building automated lead routing engines using CRM platforms, WhatsApp Business API, and webhook triggers.',
        'Automating appointment booking, follow-up sequences, and lead scoring.',
        'Using generative AI tools for structured market research, audience profiling, and creative testing scripts.'
      ]
    },
    {
      number: '04',
      title: 'Commercial Strategy & Client Acquisition',
      icon: Target,
      color: 'emerald',
      points: [
        'How to package high-ticket growth services ($1,000+ retainers) instead of selling commoditized services.',
        'Cold outreach systems: Personalized video audits, high-intent DM funnels, and enterprise pitch decks.',
        'Retaining clients through transparent economic reporting rather than vanity metric dashboards.'
      ]
    }
  ];

  const studentProfiles = [
    {
      title: 'Ambitious Freelancers & Marketers',
      desc: 'You already know the basics, but you are stuck charging entry-level rates for basic deliverables. You want to evolve into a high-earning Performance Growth Strategist who commands retainers based on revenue impact.',
      icon: TrendingUp
    },
    {
      title: 'Agency Founders & Operators',
      desc: 'You need a repeatable, institutional framework to deliver predictable client results, streamline your internal media buying operations, and eliminate client churn.',
      icon: Building
    },
    {
      title: 'Business Owners & Solopreneurs',
      desc: 'You want complete sovereignty over your customer acquisition. You refuse to get misled by external agencies and want to build a reliable in-house lead generation pipeline that operates predictably.',
      icon: ShieldCheck
    }
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-[#FF6B00] selection:text-white">
      {/* Search Engine Optimization & Structured Data */}
      <SEOHead
        path="/academy"
        customData={{
          title: 'MK Digitalverse Academy | Advanced Performance Marketing & Systems Engineering',
          description:
            'Master full-funnel performance marketing, direct-response conversion architecture, and automated client acquisition systems. Led directly by Muid Khan.',
          canonicalUrl: 'https://digitalmuid.in/academy'
        }}
      />

      {/* =========================================================================
          HERO SECTION
          ========================================================================= */}
      <section
        id="education-hero"
        className="relative bg-[#07111F] text-white pt-36 pb-20 sm:pt-44 sm:pb-28 lg:pt-48 lg:pb-32 px-4 sm:px-6 lg:px-8 border-b border-slate-800"
      >
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-[#1877F2]/10 blur-[150px] rounded-full pointer-events-none -z-10"
          aria-hidden="true"
        />

        <div className="max-w-4xl mx-auto text-center space-y-8">
          {/* Pre-header Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/10">
            <GraduationCap className="w-3.5 h-3.5 text-[#FF6B00]" />
            <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#FF6B00] font-interface">
              PRACTICAL SYSTEMS OVER SURFACE TACTICS
            </span>
          </div>

          {/* H1: Page Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-display font-bold tracking-tight text-white leading-[1.12] text-balance">
            Stop Learning Tricks.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-400">
              Master the Mechanics of Commercial Growth.
            </span>
          </h1>

          {/* Hero Sub-headline */}
          <p className="text-base sm:text-lg lg:text-xl text-slate-300 font-interface leading-relaxed max-w-3xl mx-auto font-light">
            The industry doesn’t need more button-pushers or generic social media managers. MK Digitalverse Academy trains performance marketers, consultants, and founders to engineer scalable acquisition funnels, scientific paid media, and automated client pipelines.
          </p>

          {/* CTA Group */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              id="hero-apply-cohort-btn"
              type="button"
              onClick={() => scrollToSection('curriculum')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl bg-[#FF6B00] hover:bg-[#FF7A1A] text-white font-bold text-sm tracking-wide shadow-xl shadow-[#FF6B00]/25 transition-all duration-200 cursor-pointer active:scale-[0.98] font-interface group"
            >
              <span>Apply for the Flagship Cohort</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>

            <button
              id="hero-download-syllabus-btn"
              type="button"
              onClick={() => scrollToSection('syllabus')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] text-white font-semibold text-sm border border-white/10 hover:border-white/20 transition-all duration-200 cursor-pointer font-interface"
            >
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Download Course Syllabus</span>
            </button>
          </div>

          {/* Hero Stats / Proof Bar */}
          <div className="pt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 max-w-3xl mx-auto text-left">
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1">
              <div className="text-sm font-bold text-white font-display">100% Direct Industry Application</div>
              <div className="text-xs text-slate-400 font-interface">Zero Fluff · Real Account Telemetry</div>
            </div>
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1">
              <div className="text-sm font-bold text-[#FF6B00] font-display">Built on Full-Stack Systems</div>
              <div className="text-xs text-slate-400 font-interface">Paid Media + Funnel Psychology + Automation</div>
            </div>
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1">
              <div className="text-sm font-bold text-emerald-400 font-display">Mentorship Led Directly</div>
              <div className="text-xs text-slate-400 font-interface">By Muid Khan · Active Growth Operator</div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 1: THE ACADEMY MANIFESTO (THE PROBLEM IN EDTECH)
          ========================================================================= */}
      <section id="manifesto" className="py-20 sm:py-24 border-b border-slate-200/80 bg-slate-50 text-slate-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#1877F2]">
              <Layers className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#1877F2] font-interface">
                THE INDUSTRY REALITY
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-slate-900 tracking-tight">
              Why 95% of Digital Marketing Training Fails You
            </h2>
          </div>

          <div className="space-y-6 text-slate-700 text-base sm:text-lg font-interface leading-relaxed">
            <p>
              Most marketing academies teach you how to use tools that change every few months. They sell you pre-recorded, outdated modules on how to create basic social media graphics, boost a post, or build a slow template website.
            </p>

            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
              <p className="font-semibold text-slate-900">
                Then, you step into the real market—and clients or employers ask you to solve real problems:
              </p>
              <ul className="space-y-2 pl-2 text-sm sm:text-base">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <span className="italic font-medium text-slate-800">&ldquo;Why is our Customer Acquisition Cost (CAC) unprofitable?&rdquo;</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <span className="italic font-medium text-slate-800">&ldquo;Why are our leads unqualified and not converting into sales?&rdquo;</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <span className="italic font-medium text-slate-800">&ldquo;How do we connect ad clicks directly to an automated CRM workflow?&rdquo;</span>
                </li>
              </ul>
            </div>

            <p>
              Standard courses cannot answer these questions because they teach platform tricks instead of commercial mechanics.
            </p>

            <div className="p-5 rounded-2xl bg-blue-50/70 border border-blue-200 text-slate-900 font-medium">
              At MK Digitalverse Academy, we treat digital marketing as an applied engineering discipline. You do not just learn how to run ads; you learn consumer unit economics, conversion architecture, and operational system design.
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 2: CORE CURRICULUM ARCHITECTURE (WHAT YOU BUILD)
          ========================================================================= */}
      <section id="curriculum" className="py-20 sm:py-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16 scroll-mt-24">
        {/* Anchor for syllabus downloads */}
        <div id="syllabus" className="scroll-mt-28" />

        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-[#FF6B00]">
            <Cpu className="w-3.5 h-3.5 text-[#FF6B00]" />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FF6B00] font-interface">
              THE OPERATING FRAMEWORK
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-slate-900 tracking-tight">
            Built Around the 4 Pillars of Modern Growth
          </h2>
          <p className="text-slate-600 text-base sm:text-lg font-interface">
            Every curriculum, assignment, and campaign teardown is engineered around these four foundational disciplines.
          </p>
        </div>

        {/* 4 Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {corePillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.number}
                className="p-8 rounded-3xl bg-white border border-slate-200 hover:border-slate-300 transition-all shadow-sm space-y-6 flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-[#1877F2]">
                      <Icon className="w-6 h-6 text-[#1877F2]" />
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                      PILLAR {pillar.number}
                    </span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-display font-bold text-slate-900 leading-snug">
                    {pillar.title}
                  </h3>
                  <ul className="space-y-3 pt-2">
                    {pillar.points.map((pt, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-xs sm:text-sm text-slate-600 font-interface leading-relaxed">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        {/* Featured Master Programs Enrollment Cards */}
        <div className="pt-8 space-y-8 border-t border-slate-200">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <span className="text-xs font-bold uppercase tracking-widest text-[#FF6B00] font-interface">DIRECT ADMISSIONS</span>
              <h3 className="text-2xl sm:text-3xl font-display font-bold text-slate-900">
                Enroll in Featured Master Programs
              </h3>
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Program 1 */}
            <div className="rounded-3xl bg-white border border-slate-200/90 hover:border-[#1877F2]/50 hover:shadow-xl transition-all p-7 sm:p-8 flex flex-col justify-between space-y-6 group shadow-sm">
              <div className="space-y-5">
                <div className="aspect-[16/9] w-full rounded-2xl bg-slate-900 relative overflow-hidden">
                  <img
                    src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80"
                    alt="Meta Ads Mastery"
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
                <div className="space-y-2">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
                    Course ID: crs-02 · 10 Hours · 24 Lessons
                  </div>
                  <h4 className="text-xl font-display font-bold text-slate-900 group-hover:text-[#1877F2] transition-colors leading-snug">
                    Meta &amp; Google Ads Mastery: Algorithmic Scaling
                  </h4>
                  <p className="text-xs text-slate-600 font-interface leading-relaxed">
                    Stop guessing on ad creative. Learn the exact testing protocols, budget pacing rules, dynamic creative sandboxes, and CAPI telemetry used to scale ad accounts profitably.
                  </p>
                </div>
              </div>
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

            {/* Program 2 */}
            <div className="rounded-3xl bg-white border border-slate-200/90 hover:border-emerald-500/50 hover:shadow-xl transition-all p-7 sm:p-8 flex flex-col justify-between space-y-6 group shadow-sm">
              <div className="space-y-5">
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
                <div className="space-y-2">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
                    Course ID: 14c77e7b... · 8 Hours · 21 Lessons
                  </div>
                  <h4 className="text-xl font-display font-bold text-slate-900 group-hover:text-emerald-600 transition-colors leading-snug">
                    SEO with AI Integration: Intent Dominance
                  </h4>
                  <p className="text-xs text-slate-600 font-interface leading-relaxed">
                    Master the convergence of search intent, generative answer engine optimization (GEO), and programmatic LLM content architecture to capture high-value buyer demand.
                  </p>
                </div>
              </div>
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

            {/* Program 3 */}
            <div className="rounded-3xl bg-white border border-slate-200/90 hover:border-purple-500/50 hover:shadow-xl transition-all p-7 sm:p-8 flex flex-col justify-between space-y-6 group shadow-sm">
              <div className="space-y-5">
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
                <div className="space-y-2">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
                    Course ID: crs-03 · 10 Hours · 22 Lessons
                  </div>
                  <h4 className="text-xl font-display font-bold text-slate-900 group-hover:text-purple-600 transition-colors leading-snug">
                    AI &amp; Automation for Modern Business Operations
                  </h4>
                  <p className="text-xs text-slate-600 font-interface leading-relaxed">
                    A pragmatic blueprint for business owners, agency leads, and growth operators to automate customer intake, triage, reporting, and fulfillment workflows without code complexity.
                  </p>
                </div>
              </div>
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
        </div>
      </section>

      {/* =========================================================================
          SECTION 3: WHO THIS ACADEMY IS ENGINEERED FOR
          ========================================================================= */}
      <section className="py-20 sm:py-24 bg-slate-50 border-y border-slate-200 text-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#1877F2]">
              <Users className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#1877F2] font-interface">
                STUDENT PROFILE
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-slate-900 tracking-tight">
              Is This Academy Right for You?
            </h2>
            <p className="text-slate-600 text-base sm:text-lg font-interface">
              We design our cohorts for operators who measure success in real revenue, not vanity certificates.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {studentProfiles.map((prof, idx) => {
              const Icon = prof.icon;
              return (
                <div
                  key={idx}
                  className="p-8 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between hover:shadow-md transition-shadow"
                >
                  <div className="space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-orange-50 text-[#FF6B00] flex items-center justify-center border border-orange-100 font-bold">
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-display font-bold text-slate-900">{prof.title}</h3>
                    <p className="text-slate-600 text-sm font-interface leading-relaxed">{prof.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 4: THE INSTRUCTOR ADVANTAGE
          ========================================================================= */}
      <section className="py-20 sm:py-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 sm:p-14 rounded-3xl bg-slate-900 text-white border border-slate-800 space-y-8 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#1877F2]/10 blur-3xl rounded-full pointer-events-none" />

          <div className="relative z-10 max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.05] border border-white/10 text-[#FF6B00] text-xs font-bold uppercase tracking-wider font-interface">
              <Award className="w-3.5 h-3.5" /> MENTORSHIP THAT MATTERS
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-white tracking-tight">
              Taught by an Active Growth Operator, Not a Professional Theorist
            </h2>

            <div className="space-y-4 text-slate-300 text-base sm:text-lg font-interface leading-relaxed">
              <p>
                Most online instructors teach marketing because they couldn't survive doing it for real businesses.
              </p>
              <p>
                MK Digitalverse Academy is led directly by <strong className="text-white font-semibold">Muid Khan (Digital Muid)</strong>, Founder of MK Digitalverse and an active Performance Growth Strategist.
              </p>
              <p>
                Every framework, template, and pipeline taught in the academy is identical to the systems deployed daily for private clients, specialized clinics, and scaling enterprises across competitive markets. You are not learning textbook theory; you are absorbing battle-tested playbooks forged on live campaigns with real capital at risk.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Complementary Practical Training Modules & Reviews */}
      <AcademyBenefitsSection />
      <AcademyDeliveryModesSection navigate={navigate} />
      <AcademyCaseStudiesSection />
      <AcademyFacultySection />
      <AcademyFreeFoundationCarousel onCardClick={handleFreeFoundationClick} />
      <AcademyReviewsSection navigate={navigate} />
      <AcademyStudentGalleryCarousel />
      <AcademyAboutMkSection />
      <AcademyResourcesVaultSection navigate={navigate} />
      <AcademyBlogSection navigate={navigate} />

      {/* =========================================================================
          SECTION 5: FREQUENTLY ASKED QUESTIONS (SEO & CONVERSION OPTIMIZED)
          ========================================================================= */}
      <AcademyFaqSection />

      {/* =========================================================================
          SECTION 6: FINAL CONVERSION CTA
          ========================================================================= */}
      <section className="py-20 sm:py-28 border-t border-slate-800 bg-[#07111F] text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-8 sm:p-14 rounded-3xl bg-gradient-to-b from-[#0B1528] to-[#07111F] border border-white/10 text-center space-y-6 shadow-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-xs font-bold uppercase tracking-wider text-[#FF6B00] font-interface">
              <Flame className="w-3.5 h-3.5" /> APPLICATION OPEN
            </div>

            <h2 className="text-3xl sm:text-5xl font-display font-bold text-white tracking-tight">
              Build the Skills That Never Get Outdated.
            </h2>

            <p className="text-base sm:text-lg text-slate-300 font-interface max-w-2xl mx-auto leading-relaxed font-light">
              Step into the top tier of performance marketers and growth operators. Join the next cohort of MK Digitalverse Academy and learn how to build engineered systems that drive real economic value.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <button
                type="button"
                onClick={() => scrollToSection('curriculum')}
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-[#FF6B00] hover:bg-[#FF7A1A] text-white font-bold text-sm tracking-wide shadow-xl shadow-[#FF6B00]/25 transition-all cursor-pointer font-interface inline-flex items-center justify-center gap-2"
              >
                <span>Apply for Next Cohort</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => navigate('/contact')}
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm border border-white/10 transition-all cursor-pointer font-interface"
              >
                Speak with an Admissions Advisor
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Floating WhatsApp contact button */}
      <AcademyWhatsAppButton />
    </div>
  );
};
