import React, { useState } from 'react';
import { SEOHead } from '../components/SEOHead';
import { analytics } from '../utils/analytics';
import {
  ArrowRight,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Layers,
  Zap,
  Target,
  ShieldAlert,
  Gauge,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronDown,
  Building2,
  GraduationCap,
  Compass,
  Cpu,
  ShieldCheck,
  Check
} from 'lucide-react';

interface HomePageProps {
  navigate: (path: string) => void;
  onOpenResourceModal?: (resourceId: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ navigate }) => {
  // Interactive FAQ state
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const toggleFaq = (index: number) => {
    setOpenFaqIndex((prev) => (prev === index ? null : index));
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

  // FAQ Data matching exact page copy
  const faqs = [
    {
      question: 'How does Digital Muid differ from a regular digital marketing agency?',
      answer:
        'Traditional agencies sell piecemeal services—like managing ads without touching your website, or building a generic website without understanding performance marketing economics. Digital Muid is a growth consultancy and systems architecture firm led by Muid Khan. We build the entire infrastructure: scientific Meta Ads, custom-coded React/Node.js websites, and automated back-end lead triage so your marketing and technology work as a unified revenue engine.'
    },
    {
      question: 'Why do you build websites in React and Node.js instead of WordPress?',
      answer:
        'Modern conversion rates are won or lost on loading speed, security, and responsive user experience. Generic CMS platforms rely on dozens of third-party plugins that bloat code, slow down page speed, and introduce security vulnerabilities. Custom code in React and Node.js ensures sub-second load times, superior conversion rates, custom interactive triage funnels, and complete ownership of your digital assets.'
    },
    {
      question: 'What kind of businesses do you work with?',
      answer:
        'We partner with established service businesses, high-ticket B2B consultancies, specialized firms, and premium brands that already have a proven product or service and are ready to invest in custom infrastructure to scale their customer acquisition predictably.'
    },
    {
      question: 'How do we start working together?',
      answer:
        'All client relationships begin with a private Growth Diagnostic Session. We analyze your past campaign data, current website conversion flow, and lead management processes to uncover exact friction points and design a custom 90-day system blueprint.'
    }
  ];

  // Comparison table rows matching exact copy
  const comparisonRows = [
    {
      typical: 'Pre-packaged, bloated WordPress or drag-and-drop templates',
      digitalMuid: '100% custom-coded React and Node.js web applications'
    },
    {
      typical: 'Reports vanity metrics (reach, impressions, CTR)',
      digitalMuid: 'Optimizes strictly for CAC, qualified leads, and gross margin'
    },
    {
      typical: 'Fragmented services: Ads team blames web team for poor sales',
      digitalMuid: 'Unified system: Strategy, engineering, and acquisition run in sync'
    },
    {
      typical: 'Manual lead follow-up and slow communication',
      digitalMuid: 'Automated CRM triage, WhatsApp dispatch, and pipeline tracking'
    },
    {
      typical: 'Work handed off to junior interns after signing',
      digitalMuid: 'Direct architecture and oversight by Muid Khan'
    }
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-[#FF6B00] selection:text-white">
      {/* =========================================================================
          PAGE METADATA & SEO HEAD TAGS
          ========================================================================= */}
      <SEOHead
        path="/"
        customData={{
          title: 'Digital Muid | Performance Growth Strategist & Systems Architect',
          description:
            'We engineer predictable customer acquisition engines, bespoke React/Node.js web architecture, and automated client intake systems for ambitious businesses.',
          canonicalUrl: 'https://digitalmuid.in/'
        }}
      />

      {/* =========================================================================
          SECTION 1: HERO (FIRST IMPRESSION & POSITIONING)
          ========================================================================= */}
      <section
        id="hero"
        className="relative bg-[#07111F] text-slate-100 pt-36 pb-20 sm:pt-44 sm:pb-28 lg:pt-48 lg:pb-32 px-4 sm:px-6 lg:px-8 border-b border-slate-800 overflow-hidden"
      >
        {/* Subtle radial aura */}
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-[#1877F2]/10 blur-[140px] rounded-full pointer-events-none -z-10"
          aria-hidden="true"
        />

        <div className="max-w-5xl mx-auto text-center space-y-8">
          {/* Pre-header Badge / Pill */}
          <div className="flex items-center justify-center">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-[#1877F2]/30 text-xs font-mono font-semibold uppercase tracking-[0.2em] text-[#1877F2]">
              <Sparkles className="w-3.5 h-3.5 text-[#FF6B00]" />
              PERFORMANCE SYSTEMS &amp; GROWTH ARCHITECTURE
            </span>
          </div>

          {/* H1: Main Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-display font-bold tracking-tight text-white leading-[1.12] text-balance max-w-4xl mx-auto">
            Growth Is Not a Tactic. It Is an Engineered System.
          </h1>

          {/* Sub-headline */}
          <p className="text-base sm:text-lg lg:text-xl text-slate-300 font-interface leading-relaxed max-w-3xl mx-auto font-light">
            Most businesses bleed revenue through fragmented ad campaigns, sluggish CMS templates, and manual
            follow-ups. We design, code, and deploy unified client acquisition pipelines—combining scientific paid
            media, custom React &amp; Node.js web architecture, and automated triage systems built for bottom-line profit.
          </p>

          {/* Primary Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button
              onClick={() => {
                analytics.trackGrowthAuditCta('hero_primary');
                navigate('/book-consultation');
              }}
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-[#FF6B00] hover:bg-[#FF7A1A] text-white font-bold text-sm tracking-wide shadow-xl shadow-[#FF6B00]/25 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 group active:scale-[0.98] font-interface"
            >
              <span>Book a Growth Diagnostic</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>

            <button
              onClick={() => scrollToSection('ecosystem')}
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white/5 hover:bg-white/10 text-white font-semibold text-sm border border-white/15 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98] font-interface"
            >
              <span>Explore Our Systems</span>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          {/* Proof & Operational Anchor Strip */}
          <div className="pt-12 sm:pt-16">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-800/80 pt-10 text-left">
              {/* Metric 1 */}
              <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col justify-between space-y-2">
                <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-[#1877F2]">
                  <Cpu className="w-4 h-4 text-[#FF6B00]" />
                  <span>Metric 1</span>
                </div>
                <div className="text-lg font-display font-bold text-white tracking-tight">
                  100% Custom Code
                </div>
                <p className="text-xs text-slate-400 font-interface leading-relaxed">
                  (Zero Bloated WordPress or Page-Builder Templates)
                </p>
              </div>

              {/* Metric 2 */}
              <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col justify-between space-y-2">
                <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-[#1877F2]">
                  <Layers className="w-4 h-4 text-[#FF6B00]" />
                  <span>Metric 2</span>
                </div>
                <div className="text-lg font-display font-bold text-white tracking-tight">
                  Full-Stack Architecture
                </div>
                <p className="text-xs text-slate-400 font-interface leading-relaxed">
                  (Meta Ads + Bespoke Web + CRM Automation)
                </p>
              </div>

              {/* Metric 3 */}
              <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col justify-between space-y-2">
                <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-[#1877F2]">
                  <TrendingUp className="w-4 h-4 text-[#FF6B00]" />
                  <span>Metric 3</span>
                </div>
                <div className="text-lg font-display font-bold text-white tracking-tight">
                  Unit Economics First
                </div>
                <p className="text-xs text-slate-400 font-interface leading-relaxed">
                  (Focused strictly on CAC, Lead Quality &amp; Net Margins)
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 2: THE PROBLEM STATEMENT (SPEAKING DIRECTLY TO THE AUDIENCE)
          ========================================================================= */}
      <section
        id="problem-statement"
        className="py-20 sm:py-28 bg-slate-50 text-slate-900 border-b border-slate-200"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          {/* Header */}
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] font-interface">
                THE COMMERCIAL BOTTLENECK
              </span>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-slate-900 tracking-tight">
              Why Your Marketing Feels Inconsistent, Unpredictable, and Expensive
            </h2>

            <p className="text-slate-600 text-base sm:text-lg font-interface leading-relaxed">
              If you are running an established company, a high-ticket service firm, or a scaling brand, you have likely
              experienced this cycle:
            </p>
          </div>

          {/* Friction Grid - 3 Core Failure Points */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="rounded-3xl bg-white border border-slate-200 p-7 shadow-xs hover:shadow-md transition-all space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 font-mono font-bold text-sm">
                01
              </div>
              <h3 className="text-xl font-display font-bold text-slate-900">
                The Disconnected Agency Trap
              </h3>
              <p className="text-sm text-slate-600 font-interface leading-relaxed">
                You hire an ad agency that boasts about impressions, clicks, and ROAS. But when you check your bank
                balance, sales figures, and lead quality, the numbers don't add up. They optimize for vanity platform
                metrics, not cash in the bank.
              </p>
            </div>

            {/* Card 2 */}
            <div className="rounded-3xl bg-white border border-slate-200 p-7 shadow-xs hover:shadow-md transition-all space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 font-mono font-bold text-sm">
                02
              </div>
              <h3 className="text-xl font-display font-bold text-slate-900">
                The Fragile, Slow Web Architecture
              </h3>
              <p className="text-sm text-slate-600 font-interface leading-relaxed">
                Your website was built on a generic CMS template with 40+ plugins. It takes 4+ seconds to load, breaks on
                mobile updates, and leaks 40% of the traffic you paid hard money to acquire before visitors even read your
                offer.
              </p>
            </div>

            {/* Card 3 */}
            <div className="rounded-3xl bg-white border border-slate-200 p-7 shadow-xs hover:shadow-md transition-all space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 font-mono font-bold text-sm">
                03
              </div>
              <h3 className="text-xl font-display font-bold text-slate-900">
                The Manual Follow-Up Decay
              </h3>
              <p className="text-sm text-slate-600 font-interface leading-relaxed">
                Leads submit an inquiry and sit in an email inbox for hours or days. Without automated qualification,
                instant WhatsApp triage, and dynamic CRM routing, high-intent buyers get cold and hire your competitor
                instead.
              </p>
            </div>
          </div>

          {/* Bottom Line Summary Callout */}
          <div className="p-6 sm:p-8 rounded-3xl bg-[#07111F] text-white border border-slate-800 shadow-md">
            <blockquote className="text-base sm:text-lg lg:text-xl font-display italic leading-relaxed text-slate-200 border-l-4 border-[#FF6B00] pl-5 sm:pl-6">
              &ldquo;You don't have a traffic problem. You have an architecture problem. When front-end acquisition
              doesn't talk to your web infrastructure and back-end operations, growth stalls.&rdquo;
            </blockquote>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 3: THE DIGITAL MUID SOLUTION (THE 4 PILLARS)
          ========================================================================= */}
      <section
        id="operating-framework"
        className="py-20 sm:py-28 bg-white text-slate-900 border-b border-slate-200"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
          {/* Header */}
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#1877F2]">
              <Cpu className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] font-interface">
                THE OPERATING FRAMEWORK
              </span>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-slate-900 tracking-tight">
              The Engineered Growth Engine: How We Build Predictability
            </h2>
          </div>

          {/* 4 Pillars Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Pillar 1 */}
            <div className="rounded-3xl bg-slate-50 border border-slate-200 p-8 flex flex-col justify-between hover:border-[#1877F2]/40 transition-all space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-blue-100/70 border border-blue-200 flex items-center justify-center text-[#1877F2]">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#1877F2]">
                    Pillar 01
                  </span>
                </div>

                <h3 className="text-xl sm:text-2xl font-display font-bold text-slate-900">
                  Scientific Paid Media &amp; Customer Acquisition (Meta Ads)
                </h3>

                <p className="text-sm text-slate-700 font-interface leading-relaxed">
                  We don't &quot;boost posts&quot; or run spray-and-pray ads. We engineer direct-response campaigns
                  governed by strict unit economics.
                </p>

                <ul className="space-y-2.5 pt-2 text-sm text-slate-600 font-interface">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Rigorous hook and creative testing protocols.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Server-side tracking, Conversions API (CAPI), and attribution integrity.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Focus on Customer Acquisition Cost (CAC) and qualified pipeline velocity over cheap, low-intent clicks.</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Pillar 2 */}
            <div className="rounded-3xl bg-slate-50 border border-slate-200 p-8 flex flex-col justify-between hover:border-[#1877F2]/40 transition-all space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-orange-100/70 border border-orange-200 flex items-center justify-center text-[#FF6B00]">
                    <Layers className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#FF6B00]">
                    Pillar 02
                  </span>
                </div>

                <h3 className="text-xl sm:text-2xl font-display font-bold text-slate-900">
                  Custom Full-Stack Web Engineering (React &amp; Node.js)
                </h3>

                <p className="text-sm text-slate-700 font-interface leading-relaxed">
                  Your website is your highest-leverage sales asset. We throw out bloated template builders and write
                  bespoke, production-grade code.
                </p>

                <ul className="space-y-2.5 pt-2 text-sm text-slate-600 font-interface">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Sub-second page load speeds that maximize ad spend conversion.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Interactive, multi-step customer qualification and intake forms.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Enterprise-grade security, flawless mobile rendering, and zero plugin dependencies.</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Pillar 3 */}
            <div className="rounded-3xl bg-slate-50 border border-slate-200 p-8 flex flex-col justify-between hover:border-[#1877F2]/40 transition-all space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-purple-100/70 border border-purple-200 flex items-center justify-center text-purple-600">
                    <Zap className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-purple-700">
                    Pillar 03
                  </span>
                </div>

                <h3 className="text-xl sm:text-2xl font-display font-bold text-slate-900">
                  Automated CRM &amp; Lead Triage Engines
                </h3>

                <p className="text-sm text-slate-700 font-interface leading-relaxed">
                  We connect your marketing directly into your operational workflow.
                </p>

                <ul className="space-y-2.5 pt-2 text-sm text-slate-600 font-interface">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Instant automated response via WhatsApp API, SMS, and email the second a lead arrives.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Dynamic lead scoring and qualification to filter out tire-kickers.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Calendar synchronization and automated appointment reminders to eliminate no-shows.</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Pillar 4 */}
            <div className="rounded-3xl bg-slate-50 border border-slate-200 p-8 flex flex-col justify-between hover:border-[#1877F2]/40 transition-all space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100/70 border border-emerald-200 flex items-center justify-center text-emerald-600">
                    <Target className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-700">
                    Pillar 04
                  </span>
                </div>

                <h3 className="text-xl sm:text-2xl font-display font-bold text-slate-900">
                  Strategic Positioning &amp; Offer Mechanics
                </h3>

                <p className="text-sm text-slate-700 font-interface leading-relaxed">
                  Even the best code and ad sets fail if your message blends into the noise.
                </p>

                <ul className="space-y-2.5 pt-2 text-sm text-slate-600 font-interface">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Diagnostic audit of your competitive market landscape.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Restructuring your core offer into an undeniable value proposition.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Positioning your brand as the obvious, premium authority in your space.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 4: THE ECOSYSTEM (CLARITY OF ENTITIES)
          ========================================================================= */}
      <section
        id="ecosystem"
        className="py-20 sm:py-28 bg-slate-50 text-slate-900 border-b border-slate-200"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          {/* Header */}
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#1877F2]">
              <Compass className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] font-interface">
                THE EXPANSION MODEL
              </span>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-slate-900 tracking-tight">
              One Unified Ecosystem. Three Distinct Capabilities.
            </h2>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: Digital Muid */}
            <div className="rounded-3xl bg-white border border-slate-200 p-8 flex flex-col justify-between hover:shadow-lg transition-all space-y-6">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#1877F2]">
                  <Compass className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-display font-bold text-slate-900">
                  Digital Muid (Advisory &amp; Architecture)
                </h3>
                <p className="text-sm text-slate-600 font-interface leading-relaxed">
                  The strategic brain led directly by Muid Khan. We diagnose operational bottlenecks, restructure offers,
                  and architect end-to-end acquisition systems for founders and leaders ready to scale.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <button
                  onClick={() => {
                    analytics.trackGrowthAuditCta('ecosystem_diagnostic');
                    navigate('/book-consultation');
                  }}
                  className="w-full inline-flex items-center justify-between text-xs font-mono font-bold text-[#1877F2] hover:text-blue-700 group cursor-pointer"
                >
                  <span>Book a 1:1 Diagnostic Session</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>

            {/* Card 2: MK Digitalverse */}
            <div className="rounded-3xl bg-white border border-slate-200 p-8 flex flex-col justify-between hover:shadow-lg transition-all space-y-6">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-center text-[#FF6B00]">
                  <Building2 className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-display font-bold text-slate-900">
                  MK Digitalverse (Global Full-Service Execution)
                </h3>
                <p className="text-sm text-slate-600 font-interface leading-relaxed">
                  Our GST-registered technology and digital execution agency. MK Digitalverse provides the heavy
                  engineering power: full-stack React/Node.js web development, enterprise system integrations, and global
                  paid media management.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <a
                  href="https://www.mkdigitalverse.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-between text-xs font-mono font-bold text-[#FF6B00] hover:text-orange-700 group cursor-pointer"
                >
                  <span>Explore Agency Services</span>
                  <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </a>
              </div>
            </div>

            {/* Card 3: MK Digitalverse Academy */}
            <div className="rounded-3xl bg-white border border-slate-200 p-8 flex flex-col justify-between hover:shadow-lg transition-all space-y-6">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-display font-bold text-slate-900">
                  MK Digitalverse Academy (Skills &amp; Education)
                </h3>
                <p className="text-sm text-slate-600 font-interface leading-relaxed">
                  Our educational division dedicated to building sovereign operators. We teach ambitious marketers,
                  freelancers, and entrepreneurs the raw mechanics of media buying, conversion funnels, and automation
                  systems.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <button
                  onClick={() => {
                    analytics.trackAcademyCta('ecosystem_card');
                    navigate('/academy');
                  }}
                  className="w-full inline-flex items-center justify-between text-xs font-mono font-bold text-emerald-700 hover:text-emerald-800 group cursor-pointer"
                >
                  <span>View Academy Programs</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 5: THE OPERATING STANDARD (WHY US)
          ========================================================================= */}
      <section
        id="operating-standard"
        className="py-20 sm:py-28 bg-white text-slate-900 border-b border-slate-200"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          {/* Header */}
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#1877F2]">
              <Gauge className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] font-interface">
                OUR STANDARD
              </span>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-slate-900 tracking-tight">
              Mechanics Over Motivation: Why Operators Choose Us
            </h2>
          </div>

          {/* Comparison Table / Split Grid */}
          <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
              {/* Left Column Header (Typical Agency) */}
              <div className="p-6 sm:p-8 bg-slate-50/70 border-b border-slate-200 md:border-b-0">
                <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-rose-600 mb-2">
                  <XCircle className="w-4 h-4" />
                  <span>The Typical Agency Way</span>
                </div>
                <p className="text-xs text-slate-500 font-interface">
                  Fragmented vendors, shallow vanity reporting, and template shortcuts.
                </p>
              </div>

              {/* Right Column Header (The Digital Muid System) */}
              <div className="p-6 sm:p-8 bg-blue-50/40">
                <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-[#1877F2] mb-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>The Digital Muid System</span>
                </div>
                <p className="text-xs text-slate-500 font-interface">
                  Full-stack engineering, strict unit economics, and unified execution.
                </p>
              </div>
            </div>

            {/* Comparison Rows */}
            <div className="divide-y divide-slate-200">
              {comparisonRows.map((row, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 hover:bg-slate-50/40 transition-colors"
                >
                  {/* Left Column (Typical Agency) */}
                  <div className="p-5 sm:p-6 flex items-start gap-3 text-slate-600 text-sm font-interface">
                    <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <span>{row.typical}</span>
                  </div>

                  {/* Right Column (Digital Muid System) */}
                  <div className="p-5 sm:p-6 flex items-start gap-3 text-slate-900 text-sm font-interface font-medium bg-blue-50/20">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{row.digitalMuid}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 6: FREQUENTLY ASKED QUESTIONS (SEO & CONVERSION)
          ========================================================================= */}
      <section
        id="faq"
        className="py-20 sm:py-28 bg-slate-50 text-slate-900 border-b border-slate-200"
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#1877F2]">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] font-interface">
                COMMON QUESTIONS
              </span>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-slate-900 tracking-tight">
              Frequently Asked Questions
            </h2>
          </div>

          {/* Accordion FAQ list */}
          <div className="space-y-4">
            {faqs.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl bg-white border border-slate-200 transition-all overflow-hidden shadow-xs hover:border-slate-300"
                >
                  <button
                    onClick={() => toggleFaq(idx)}
                    className="w-full p-6 text-left flex items-center justify-between gap-4 cursor-pointer"
                    aria-expanded={isOpen}
                  >
                    <span className="text-base sm:text-lg font-display font-bold text-slate-900">
                      {faq.question}
                    </span>
                    <div
                      className={`w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 bg-blue-50 border-blue-200 text-[#1877F2]' : 'text-slate-400'
                      }`}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-6 pb-6 pt-0 text-sm sm:text-base text-slate-600 font-interface leading-relaxed border-t border-slate-100 pt-4">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 7: FINAL CALL TO ACTION (CTA BANNER)
          ========================================================================= */}
      <section
        id="final-cta"
        className="py-20 sm:py-28 bg-[#07111F] text-white relative overflow-hidden"
      >
        {/* Radial glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-[#FF6B00]/10 blur-[150px] rounded-full pointer-events-none -z-10"
          aria-hidden="true"
        />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          {/* H2: Final CTA Headline */}
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight text-white leading-tight text-balance">
            Ready to Replace Marketing Guesswork with an Engineered Pipeline?
          </h2>

          {/* Body Text */}
          <p className="text-base sm:text-lg text-slate-300 font-interface leading-relaxed max-w-2xl mx-auto font-light">
            Stop burning budget on isolated tactics that leave your pipeline dry. Let’s diagnose your bottlenecks,
            optimize your unit economics, and build an acquisition engine built to scale.
          </p>

          {/* Primary Button */}
          <div className="pt-2 flex flex-col items-center justify-center gap-4">
            <button
              onClick={() => {
                analytics.trackGrowthAuditCta('final_cta');
                navigate('/book-consultation');
              }}
              className="w-full sm:w-auto px-9 py-4 rounded-xl bg-[#FF6B00] hover:bg-[#FF7A1A] text-white font-bold text-base tracking-wide shadow-2xl shadow-[#FF6B00]/30 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 group active:scale-[0.98] font-interface"
            >
              <span>Schedule Your Growth Diagnostic Session</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>

            {/* Subtext / Reassurance */}
            <div className="flex items-center gap-2 text-xs text-slate-400 font-interface">
              <Clock className="w-3.5 h-3.5 text-[#1877F2]" />
              <span>Strictly limited to 4 diagnostic allocations per week. Direct 1-on-1 session with Digital Muid.</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
