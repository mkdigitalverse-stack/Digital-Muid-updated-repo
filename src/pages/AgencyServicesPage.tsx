import React from 'react';
import { SEOHead } from '../components/SEOHead';
import { analytics } from '../utils/analytics';
import {
  ArrowRight,
  CheckCircle2,
  XCircle,
  Code2,
  TrendingUp,
  Cpu,
  Layers,
  Server,
  Zap,
  Gauge,
  Activity,
  Workflow,
  Clock,
  ShieldCheck,
  ChevronRight,
  Database,
  Send,
  MessageSquare,
  AlertTriangle,
  Lock,
  BarChart3,
  Calendar
} from 'lucide-react';

interface AgencyServicesPageProps {
  navigate: (path: string) => void;
}

export const AgencyServicesPage: React.FC<AgencyServicesPageProps> = ({ navigate }) => {
  const handleGrowthAuditClick = (sourceSection: string) => {
    analytics.trackGrowthAuditCta(sourceSection, '/growth-audit');
    navigate('/growth-audit');
  };

  return (
    <div className="min-h-screen bg-white selection:bg-[#FF6B00] selection:text-white">
      {/* Search Engine Optimization & Structured Data */}
      <SEOHead
        path="/agency-services"
        customData={{
          title: 'Agency Services | Digital MUID',
          description:
            'Custom web architecture, performance marketing, and AI automation engineered to improve acquisition, lead quality, and operational efficiency.',
          canonicalUrl: 'https://digitalmuid.in/agency-services'
        }}
      />

      {/* =========================================================================
          SECTION 1 — THE EXECUTIVE HERO (Restrained Dark Section — 10% of page)
          Two-column hero on dark background: clinical, confident, precise.
          Left: Eyebrow, H1, Subheadline, Primary CTA.
          Right: Refined technical visual / acquisition engine code & telemetry panel.
          ========================================================================= */}
      <div className="bg-[#07111F] text-slate-100 border-b border-slate-800 relative">
        <section
        id="executive-hero"
        className="relative pt-36 pb-20 sm:pt-44 sm:pb-28 lg:pt-48 lg:pb-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
      >
        {/* Subtle radial ambient glow */}
        <div
          className="absolute top-1/3 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[380px] bg-[#1877F2]/10 blur-[140px] rounded-full pointer-events-none -z-10"
          aria-hidden="true"
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Column — Executive Copy & Primary CTA (order-1 on mobile & desktop) */}
          <div className="lg:col-span-7 space-y-6 order-1">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10">
              <span className="w-2 h-2 rounded-full bg-[#FF6B00] animate-pulse" />
              <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#FF6B00] font-interface">
                ENTERPRISE PERFORMANCE &amp; CUSTOM DEVELOPMENT
              </span>
            </div>

            {/* H1 */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-display font-bold tracking-tight text-white leading-[1.12] text-balance">
              We build client acquisition engines, not brochure websites.
            </h1>

            {/* Sub-headline */}
            <p className="text-base sm:text-lg lg:text-xl text-slate-300 font-interface leading-relaxed max-w-2xl font-light">
              Stop losing qualified leads to slow loading times and broken funnels. We deploy custom React/Node.js architectures integrated with full-funnel performance marketing to drive predictable B2B and D2C revenue.
            </p>

            {/* Primary CTA */}
            <div className="pt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <a
                id="hero-request-audit-btn"
                href="/growth-audit"
                onClick={(e) => {
                  e.preventDefault();
                  handleGrowthAuditClick('agency_services_hero');
                }}
                className="inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl bg-[#FF6B00] hover:bg-[#FF7A1A] text-white font-bold text-sm tracking-wide shadow-xl shadow-[#FF6B00]/25 transition-all duration-200 cursor-pointer active:scale-[0.98] font-interface group"
                aria-label="Request a Growth Audit qualification"
              >
                <span>Request a Growth Audit</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>

              <div className="flex items-center gap-2 text-xs text-slate-400 font-interface">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Strict qualification • Limited monthly client intake</span>
              </div>
            </div>
          </div>

          {/* Right Column — Refined Technical Visual: Acquisition Engine Telemetry (order-2) */}
          <div className="lg:col-span-5 order-2">
            <div className="relative rounded-2xl bg-[#0A1322] border border-white/10 shadow-2xl p-6 sm:p-7 space-y-5 overflow-hidden">
              {/* Window Header */}
              <div className="flex items-center justify-between pb-3.5 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                  <span className="text-xs font-mono text-slate-400 ml-2">acquisition_engine.config.ts</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>200 OK • 18ms</span>
                </div>
              </div>

              {/* Code Snippet */}
              <div className="p-4 rounded-xl bg-black/50 border border-white/5 font-mono text-xs text-slate-300 space-y-1.5 overflow-x-auto">
                <div className="text-slate-500">// Custom Next/React SSR Hydration &amp; Telemetry</div>
                <div>
                  <span className="text-blue-400">const</span>{' '}
                  <span className="text-white">acquisitionEngine</span> ={' '}
                  <span className="text-blue-400">await</span>{' '}
                  <span className="text-emerald-300">createPipeline</span>({'{'}
                </div>
                <div className="pl-4">
                  <span className="text-slate-400">targetFCP:</span> <span className="text-amber-300">'0.4s'</span>,
                </div>
                <div className="pl-4">
                  <span className="text-slate-400">conversionHooks:</span> [<span className="text-amber-300">'Meta_CAPI'</span>, <span className="text-amber-300">'Google_Offline'</span>],
                </div>
                <div className="pl-4">
                  <span className="text-slate-400">qualificationTriage:</span> <span className="text-blue-400">true</span>,
                </div>
                <div className="pl-4">
                  <span className="text-slate-400">crmSync:</span> <span className="text-emerald-300">'automated_lead_router'</span>
                </div>
                <div>{'}'});</div>
              </div>

              {/* Performance Telemetry Strip */}
              <div className="grid grid-cols-3 gap-2.5 pt-1">
                <div className="p-3 rounded-lg bg-white/5 border border-white/5 text-center">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-interface">Lighthouse</div>
                  <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">99 / 100</div>
                  <div className="text-[10px] text-slate-500 font-interface">Audited score</div>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/5 text-center">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-interface">First Paint</div>
                  <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">0.4s</div>
                  <div className="text-[10px] text-slate-500 font-interface">Sub-second</div>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/5 text-center">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-interface">Attribution</div>
                  <div className="text-lg font-bold font-mono text-blue-400 mt-0.5">100%</div>
                  <div className="text-[10px] text-slate-500 font-interface">Closed-loop</div>
                </div>
              </div>

              {/* Technical Caption */}
              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400 font-interface">
                <span>Architecture: React 19 + Node.js Microservices</span>
                <span className="text-[#FF6B00] font-mono">Production Grade</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      </div>

      {/* =========================================================================
          SECTION 2 — THE BOTTLENECK: OLD WAY VS. NEW WAY (Light Section — 70% of page)
          Side-by-side comparison panels with light contrasting cards.
          Commercially direct, technically accurate, performance warning safeguard.
          ========================================================================= */}
      <div className="bg-white text-slate-900 border-b border-slate-200">
        <section
          id="bottleneck-comparison"
          className="py-20 sm:py-28 lg:py-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
        >
          <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FF6B00] font-interface">
              ARCHITECTURAL DIAGNOSIS
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight text-slate-900">
              The true cost of a generic tech stack.
            </h2>
            <p className="text-base sm:text-lg text-slate-600 font-interface leading-relaxed">
              If your landing page takes more than 2.5 seconds to load, your Customer Acquisition Cost (CAC) is artificially high. Here is why standard websites burn your ad budget:
            </p>
          </div>

          {/* Comparison Panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
            {/* Left Panel: The Standard Model (Limitations / Muted Red Accents) */}
            <div className="rounded-2xl bg-rose-50/70 border border-rose-200 p-7 sm:p-9 space-y-6 flex flex-col justify-between shadow-xs">
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-rose-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-600">
                      <XCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xl font-display font-bold text-slate-900">The Standard Model</h3>
                      <p className="text-xs text-rose-700 font-interface">Conventional operational limitations</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-rose-800 bg-rose-100 px-2.5 py-1 rounded-md border border-rose-200 font-semibold">
                    Ad Leaks
                  </span>
                </div>

                <ul className="space-y-4 font-interface">
                  <li className="flex items-start gap-3">
                    <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-1" />
                    <span className="text-sm text-slate-700 leading-relaxed">
                      Generic CMS and page-builder implementations, including WordPress or Shopify setups that may require unnecessary overhead.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-1" />
                    <span className="text-sm text-slate-700 leading-relaxed">
                      3+ second load times causing immediate paid traffic drop-off before your value proposition is rendered.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-1" />
                    <span className="text-sm text-slate-700 leading-relaxed">
                      Siloed Meta Ads and website analytics with no unified server-side conversion mapping.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-1" />
                    <span className="text-sm text-slate-700 leading-relaxed">
                      Manual lead follow-ups that delay response time and degrade prospect intent.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-1" />
                    <span className="text-sm text-slate-700 leading-relaxed">
                      Incomplete or untrackable attribution obscuring true campaign profitability.
                    </span>
                  </li>
                </ul>
              </div>

              <div className="pt-4 border-t border-rose-200 text-xs text-rose-800 font-interface flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                <span>Result: Unnecessary CAC escalation &amp; untrackable pipeline loss.</span>
              </div>
            </div>

            {/* Right Panel: The Digital MUID Engine (Restrained Green Accents) */}
            <div className="rounded-2xl bg-emerald-50/70 border border-emerald-200 p-7 sm:p-9 space-y-6 flex flex-col justify-between shadow-xs">
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-emerald-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xl font-display font-bold text-slate-900">The Digital MUID Engine</h3>
                      <p className="text-xs text-emerald-800 font-interface">Precision architecture &amp; growth mechanics</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-md border border-emerald-200 font-semibold">
                    Calibrated
                  </span>
                </div>

                <ul className="space-y-4 font-interface">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-1" />
                    <span className="text-sm text-slate-700 leading-relaxed">
                      Custom React frontend where appropriate, engineered and tested for fast loading and maximum UX responsiveness.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-1" />
                    <span className="text-sm text-slate-700 leading-relaxed">
                      Algorithmic ad mapping and structured conversion events feeding clean signals back into Meta &amp; Google ad auctions.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-1" />
                    <span className="text-sm text-slate-700 leading-relaxed">
                      AI-assisted CRM automation and lead routing that instantly qualifies prospects and alerts sales within seconds.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-1" />
                    <span className="text-sm text-slate-700 leading-relaxed">
                      Closed-loop ROI tracking connecting acquisition data directly to closed revenue and concrete business outcomes.
                    </span>
                  </li>
                </ul>
              </div>

              <div className="pt-4 border-t border-emerald-200 text-xs text-emerald-800 font-interface flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                <span>Result: Sub-second load times, filtered high-intent leads &amp; verifiable unit economics.</span>
              </div>
            </div>
          </div>

          {/* Claims Safeguard Note */}
          <div className="mt-8 p-4 rounded-xl bg-slate-50 border border-slate-200 max-w-3xl mx-auto text-center">
            <p className="text-xs text-slate-600 font-interface leading-relaxed">
              <strong className="text-slate-800">Performance Context:</strong> The 2.5-second benchmark reflects documented web performance research where mobile bounce rates increase non-linearly with latency. Our custom engineering targets sub-second rendering as a deliberate design objective to protect paid traffic investments.
            </p>
          </div>
        </section>
      </div>

      {/* =========================================================================
          SECTION 3 — THE THREE-PILLAR SOLUTION (Light Neutral Section — 70% of page)
          H2: Full-stack mechanics for scalable growth.
          Three clean white cards in a responsive grid.
          Accessible icons, titles, descriptions, and verified internal links.
          ========================================================================= */}
      <div className="bg-[#F8FAFC] text-slate-900 border-b border-slate-200">
        <section
          id="three-pillar-solution"
          className="py-20 sm:py-28 lg:py-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
        >
          <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FF6B00] font-interface">
              CORE CAPABILITIES
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight text-slate-900">
              Full-stack mechanics for scalable growth.
            </h2>
            <p className="text-base sm:text-lg text-slate-600 font-interface leading-relaxed">
              We don't offer disconnected services. We deliver an integrated three-pillar system aligning web architecture, performance buying, and operational automation.
            </p>
          </div>

          {/* Three Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Pillar 1 — Conversion Web Architecture */}
            <div className="p-8 rounded-2xl bg-white border border-slate-200 hover:border-[#FF6B00]/40 transition-all duration-200 flex flex-col justify-between group shadow-xs hover:shadow-md">
              <div className="space-y-5">
                <div className="w-12 h-12 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-[#FF6B00]">
                  <Code2 className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-display font-bold text-slate-900 group-hover:text-[#FF6B00] transition-colors">
                  Conversion Web Architecture
                </h3>
                <p className="text-sm text-slate-600 font-interface leading-relaxed">
                  We ditch heavy page builders. We engineer custom web applications using React.js and Node.js engineered for fast load times, seamless UX, and reduced conversion friction.
                </p>
              </div>

              <div className="pt-6 border-t border-slate-100 mt-6">
                <a
                  href="/web"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/web');
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#FF6B00] hover:text-[#FF8533] uppercase tracking-wider font-interface cursor-pointer"
                >
                  <span>Explore Web Solutions</span>
                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </a>
              </div>
            </div>

            {/* Pillar 2 — Algorithmic Media Buying */}
            <div className="p-8 rounded-2xl bg-white border border-slate-200 hover:border-blue-400 transition-all duration-200 flex flex-col justify-between group shadow-xs hover:shadow-md">
              <div className="space-y-5">
                <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#1877F2]">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-display font-bold text-slate-900 group-hover:text-[#1877F2] transition-colors">
                  Algorithmic Media Buying
                </h3>
                <p className="text-sm text-slate-600 font-interface leading-relaxed">
                  Data-driven campaigns across Meta and Google Ads. We do not optimize for vanity metrics; we optimize for pipeline velocity, qualified lead volume, and return on ad spend.
                </p>
              </div>

              <div className="pt-6 border-t border-slate-100 mt-6">
                <a
                  href="/services/modern-marketing"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/services/modern-marketing');
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1877F2] hover:text-blue-700 uppercase tracking-wider font-interface cursor-pointer"
                >
                  <span>Explore Media Buying</span>
                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </a>
              </div>
            </div>

            {/* Pillar 3 — AI & Operational Automation */}
            <div className="p-8 rounded-2xl bg-white border border-slate-200 hover:border-emerald-400 transition-all duration-200 flex flex-col justify-between group shadow-xs hover:shadow-md">
              <div className="space-y-5">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                  <Workflow className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-display font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                  AI &amp; Operational Automation
                </h3>
                <p className="text-sm text-slate-600 font-interface leading-relaxed">
                  Connecting your front-end traffic to your back-end sales. We deploy intelligent CRM automations and AI validation to triage leads and eliminate manual admin work.
                </p>
              </div>

              <div className="pt-6 border-t border-slate-100 mt-6">
                <a
                  href="/services/ai-automation"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/services/ai-automation');
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-wider font-interface cursor-pointer"
                >
                  <span>Explore Automation</span>
                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* =========================================================================
          SECTION 4 — THE EXECUTION ROADMAP (Light Section — 70% of page)
          H2: The deployment phases.
          Vertical timeline on desktop, stacked on mobile.
          Phase 1: The Build (One-time investment).
          Phase 2: The Engine (Monthly partnership).
          ========================================================================= */}
      <div className="bg-white text-slate-900 border-b border-slate-200">
        <section
          id="execution-roadmap"
          className="py-20 sm:py-28 lg:py-32 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto"
        >
          <div className="text-center space-y-4 mb-16">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FF6B00] font-interface">
              ENGAGEMENT BLUEPRINT
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight text-slate-900">
              The deployment phases.
            </h2>
            <p className="text-base sm:text-lg text-slate-600 font-interface leading-relaxed max-w-2xl mx-auto">
              A clear commercial structure separating foundational infrastructure engineering from ongoing algorithmic scaling.
            </p>
          </div>

          {/* Timeline Container */}
          <div className="relative pl-6 sm:pl-10 space-y-12 before:absolute before:left-3 sm:before:left-5 before:top-3 before:bottom-3 before:w-0.5 before:bg-gradient-to-b before:from-[#FF6B00] via-[#1877F2] to-emerald-500">
            {/* Phase 1 — The Build */}
            <div className="relative space-y-4">
              {/* Timeline node */}
              <div className="absolute -left-6 sm:-left-10 top-1 w-6 h-6 rounded-full bg-white border-2 border-[#FF6B00] flex items-center justify-center shadow-xs">
                <div className="w-2 h-2 rounded-full bg-[#FF6B00]" />
              </div>

              <div className="p-7 sm:p-8 rounded-2xl bg-[#F8FAFC] border border-slate-200 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-mono text-[#FF6B00] uppercase tracking-wider font-semibold">
                      PHASE 01 • PROPOSED 30-DAY ENGAGEMENT
                    </span>
                    <h3 className="text-2xl font-display font-bold text-slate-900 mt-1">
                      The Build (Days 1–30)
                    </h3>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-orange-100 border border-orange-200 text-[#FF6B00] font-interface text-xs font-bold uppercase tracking-wider">
                    One-time investment
                  </span>
                </div>

                <p className="text-base text-slate-600 font-interface leading-relaxed">
                  We map your customer journey, design the UI/UX, and hard-code your custom React frontend and Node.js backend. We integrate all analytics and conversion tracking.
                </p>

                {/* Milestone Deliverables */}
                <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono text-slate-700">
                  <div className="p-3 rounded-lg bg-white border border-slate-200 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Customer Journey &amp; Conversion UI/UX</span>
                  </div>
                  <div className="p-3 rounded-lg bg-white border border-slate-200 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Custom React Frontend Architecture</span>
                  </div>
                  <div className="p-3 rounded-lg bg-white border border-slate-200 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Node.js Backend &amp; CRM Routing</span>
                  </div>
                  <div className="p-3 rounded-lg bg-white border border-slate-200 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Server-Side CAPI &amp; Closed-Loop Analytics</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Phase 2 — The Engine */}
            <div className="relative space-y-4">
              {/* Timeline node */}
              <div className="absolute -left-6 sm:-left-10 top-1 w-6 h-6 rounded-full bg-white border-2 border-emerald-500 flex items-center justify-center shadow-xs">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>

              <div className="p-7 sm:p-8 rounded-2xl bg-[#F8FAFC] border border-slate-200 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-mono text-emerald-700 uppercase tracking-wider font-semibold">
                      PHASE 02 • ONGOING SCALING &amp; CALIBRATION
                    </span>
                    <h3 className="text-2xl font-display font-bold text-slate-900 mt-1">
                      The Engine (Ongoing Retainer)
                    </h3>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-700 font-interface text-xs font-bold uppercase tracking-wider">
                    Monthly partnership
                  </span>
                </div>

                <p className="text-base text-slate-600 font-interface leading-relaxed">
                  We launch your Meta and Google Ads, map the traffic to your new high-velocity landing pages, and optimize daily to scale your revenue while driving down CAC.
                </p>

                {/* Retainer Deliverables */}
                <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono text-slate-700">
                  <div className="p-3 rounded-lg bg-white border border-slate-200 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Active Meta &amp; Google Ad Buying</span>
                  </div>
                  <div className="p-3 rounded-lg bg-white border border-slate-200 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Landing Page Iterations &amp; CRO Experiments</span>
                  </div>
                  <div className="p-3 rounded-lg bg-white border border-slate-200 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Continuous CAC &amp; Unit Economics Audits</span>
                  </div>
                  <div className="p-3 rounded-lg bg-white border border-slate-200 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Automated Executive Telemetry Reporting</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* =========================================================================
          SECTION 5 — PROOF: CLINICAL TEARDOWNS (Blue Brand Section — 20% of page)
          H2: Engineered for unit economics.
          Two alternating case-study blocks:
          Case study 1 (Healthcare/B2B): Visual left, text right.
          Case study 2 (D2C/E-commerce): Text left, visual right.
          ========================================================================= */}
      <div className="bg-gradient-to-b from-[#102A6B] via-[#0E245C] to-[#0A1A45] border-b border-blue-500/20 text-white">
        <section
          id="clinical-teardowns"
          className="py-20 sm:py-28 lg:py-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
        >
          <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FF6B00] font-interface">
              PRODUCTION CASE STUDIES
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight text-white">
              Engineered for unit economics.
            </h2>
            <p className="text-base sm:text-lg text-blue-100 font-interface leading-relaxed font-light">
              We don't showcase vanity impressions. We document concrete technical interventions and their verified impact on cost-per-lead and operational throughput.
            </p>
          </div>

          <div className="space-y-16 lg:space-y-24">
            {/* Case Study 1 — Healthcare/B2B (Visual Left, Text Right on desktop; stacked on mobile) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
              {/* Visual (Left on desktop) */}
              <div className="lg:col-span-6 order-2 lg:order-1">
                <div className="rounded-2xl bg-[#091736] border border-blue-400/20 p-6 sm:p-7 space-y-5 shadow-2xl">
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-xs font-mono text-slate-300">
                        META_ADS_AUCTION • CLINICAL_INTAKE
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      Audited Result
                    </span>
                  </div>

                  {/* Performance Metrics Matrix */}
                  <div className="space-y-3 font-mono text-xs">
                    <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                      <span className="text-slate-400">Baseline Cost Per Lead (Legacy CMS)</span>
                      <span className="text-slate-400 line-through tabular-nums">₹1,840 / lead</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                      <span className="text-emerald-400 font-semibold">Post-Convergence CPL (Custom React)</span>
                      <span className="text-emerald-300 font-bold tabular-nums">₹1,067 / lead (-42%)</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                      <span className="text-slate-400">Measurement Period</span>
                      <span className="text-white font-semibold">6 Weeks Post-Launch</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs text-slate-400 font-interface">
                    <span>Client: Aura Health &amp; Care (Specialized Medical Practice)</span>
                    <span className="text-emerald-400 font-mono text-[11px]">Verified</span>
                  </div>
                </div>
              </div>

              {/* Text (Right on desktop) */}
              <div className="lg:col-span-6 space-y-5 order-1 lg:order-2">
                <span className="text-xs font-mono text-[#FF6B00] uppercase tracking-wider font-semibold">
                  CASE STUDY 01 • HEALTHCARE / CLINICAL B2B
                </span>

                <h3 className="text-2xl sm:text-3xl font-display font-bold text-white leading-tight">
                  Lowered CPL by 42%.
                </h3>

                <p className="text-base text-blue-100 font-interface leading-relaxed font-light">
                  Lowered CPL by 42%. Rebuilt the clinic's frontend in React and implemented a 3-step qualification funnel, instantly filtering out low-intent clicks before they hit the sales team.
                </p>

                {/* Problem - Intervention - Outcome */}
                <div className="space-y-3 pt-2 text-xs font-interface">
                  <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
                    <div className="text-rose-400 font-bold uppercase tracking-wider">The Bottleneck:</div>
                    <div className="text-slate-300 leading-relaxed">
                      A bloated WordPress site was averaging 3.8s mobile load times, resulting in low qualification rates and high lead acquisition costs.
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
                    <div className="text-[#FF6B00] font-bold uppercase tracking-wider">The Intervention:</div>
                    <div className="text-slate-300 leading-relaxed">
                      Rebuilt landing layer in pure React.js, deployed server-side event tracking, and configured a 3-step qualification questionnaire scoring budget and urgency.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Case Study 2 — D2C/E-commerce (Text Left, Visual Right on desktop; stacked on mobile) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
              {/* Text (Left on desktop) */}
              <div className="lg:col-span-6 space-y-5">
                <span className="text-xs font-mono text-cyan-300 uppercase tracking-wider font-semibold">
                  CASE STUDY 02 • D2C / WORKFLOW AUTOMATION
                </span>

                <h3 className="text-2xl sm:text-3xl font-display font-bold text-white leading-tight">
                  Saved 15+ hours a week.
                </h3>

                <p className="text-base text-blue-100 font-interface leading-relaxed font-light">
                  Saved 15+ hours a week. Deployed a custom Node.js automation sequence connecting Meta Lead Forms directly to the internal database with zero human intervention.
                </p>

                {/* Problem - Intervention - Outcome */}
                <div className="space-y-3 pt-2 text-xs font-interface">
                  <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
                    <div className="text-rose-400 font-bold uppercase tracking-wider">The Bottleneck:</div>
                    <div className="text-slate-300 leading-relaxed">
                      Client's sales reps were manually exporting CSVs from Meta Ads Manager three times daily, leading to 6-hour lead latency and missed conversion windows.
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
                    <div className="text-emerald-400 font-bold uppercase tracking-wider">The Intervention:</div>
                    <div className="text-slate-300 leading-relaxed">
                      Architected an event-driven webhook pipeline: Meta lead events trigger immediate cryptographic verification, CRM ingestion, deduplication, and automated WhatsApp alert dispatch within 12 seconds.
                    </div>
                  </div>
                </div>
              </div>

              {/* Visual (Right on desktop) */}
              <div className="lg:col-span-6">
                <div className="rounded-2xl bg-[#091736] border border-blue-400/20 p-6 sm:p-7 space-y-5 shadow-2xl">
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <Workflow className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-mono text-slate-300">
                        DEPLOYED_WORKFLOW_ARCHITECTURE
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                      Autonomous Pipeline
                    </span>
                  </div>

                  {/* Workflow Sequence Diagram */}
                  <div className="space-y-2.5 font-mono text-xs">
                    {/* Step 1 */}
                    <div className="p-3 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-2.5 text-slate-200">
                        <span className="text-slate-400 font-bold">01</span>
                        <span>Meta Lead Form Event</span>
                      </div>
                      <span className="text-[10px] text-slate-400">Instant Webhook</span>
                    </div>

                    {/* Flow Arrow */}
                    <div className="flex justify-center text-slate-500 py-0.5">↓</div>

                    {/* Step 2 */}
                    <div className="p-3 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-2.5 text-slate-200">
                        <span className="text-slate-400 font-bold">02</span>
                        <span>Node.js Validation &amp; Triage</span>
                      </div>
                      <span className="text-[10px] text-emerald-400">&lt;15ms Latency</span>
                    </div>

                    {/* Flow Arrow */}
                    <div className="flex justify-center text-slate-500 py-0.5">↓</div>

                    {/* Step 3 */}
                    <div className="p-3 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-2.5 text-slate-200">
                        <span className="text-slate-400 font-bold">03</span>
                        <span>CRM / Database Ingestion</span>
                      </div>
                      <span className="text-[10px] text-cyan-400">PostgreSQL / Supabase</span>
                    </div>

                    {/* Flow Arrow */}
                    <div className="flex justify-center text-slate-500 py-0.5">↓</div>

                    {/* Step 4 */}
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                      <div className="flex items-center gap-2.5 text-emerald-300 font-semibold">
                        <span className="text-emerald-400 font-bold">04</span>
                        <span>WhatsApp Business Dispatch</span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-400">Instant Alert</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs text-slate-400 font-interface">
                    <span>Methodology: 15+ hours saved via automated CSV triage</span>
                    <span className="text-cyan-400 font-mono text-[11px]">Zero-Touch</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* =========================================================================
          SECTION 6 — FINAL QUALIFICATION CTA (Restrained Dark Section — 10% of page)
          Dark minimal container centered near bottom.
          H2: Ready to audit your infrastructure?
          Paragraph: We operate as a fractional growth and engineering team...
          Primary Button: Request a Growth Audit (Connects to Phase 5 qualification)
          ========================================================================= */}
      <div className="bg-[#050B14] text-white">
        <section
          id="final-qualification-cta"
          className="py-20 sm:py-28 lg:py-32 px-4 sm:px-6 lg:px-8 border-t border-white/10 relative overflow-hidden text-center"
        >
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-[#FF6B00]/10 blur-[130px] rounded-full pointer-events-none -z-10"
          aria-hidden="true"
        />

        <div className="max-w-3xl mx-auto space-y-8">
          <div className="space-y-4">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FF6B00] font-interface">
              COMMERCIAL INTAKE
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight text-white leading-tight text-balance">
              Ready to audit your infrastructure?
            </h2>
            <p className="text-base sm:text-lg text-slate-300 font-interface leading-relaxed font-light max-w-2xl mx-auto">
              We operate as a fractional growth and engineering team for businesses generating baseline revenue with active ad spend. Request an audit, and we will diagnose exactly where your current tech stack is leaking profit.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <a
              id="final-request-audit-btn"
              href="/growth-audit"
              onClick={(e) => {
                e.preventDefault();
                handleGrowthAuditClick('agency_services_final_cta');
              }}
              className="w-full sm:w-auto px-9 py-4 rounded-xl bg-[#FF6B00] hover:bg-[#FF7A1A] text-white font-bold text-sm tracking-wide shadow-xl shadow-[#FF6B00]/25 transition-all duration-200 cursor-pointer active:scale-[0.98] font-interface flex items-center justify-center gap-2.5 group"
            >
              <span>Request a Growth Audit</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>

            <a
              id="final-learn-pathway-btn"
              href="/learn"
              onClick={(e) => {
                e.preventDefault();
                analytics.trackAcademyCta('agency_services_final');
                navigate('/learn');
              }}
              className="w-full sm:w-auto px-7 py-4 rounded-xl bg-white/5 hover:bg-white/10 text-white font-semibold text-sm border border-white/15 transition-all cursor-pointer font-interface"
            >
              <span>Explore Educational Programs</span>
            </a>
          </div>

          <div className="pt-4 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400 font-interface">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Multi-step qualification intake</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Direct calendar sync upon qualification</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Academy routing for early startups</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
  );
};
