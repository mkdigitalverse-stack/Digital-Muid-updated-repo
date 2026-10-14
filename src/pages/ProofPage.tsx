import React, { useState } from 'react';
import { analytics } from '../utils/analytics';
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Zap,
  Layers,
  Cpu,
  Award,
  Sparkles,
  Server,
  Activity,
  Gauge,
  ExternalLink,
  Code2,
  Workflow,
  Layout,
  BarChart3,
  X,
  Maximize2,
  ShieldCheck,
  Check
} from 'lucide-react';

interface ProofPageProps {
  navigate: (path: string) => void;
}

export const ProofPage: React.FC<ProofPageProps> = ({ navigate }) => {
  // State for expanded clinical teardown cards
  const [expandedTeardown, setExpandedTeardown] = useState<string | null>('teardown-1');

  // State for Data Room lightbox / modal
  const [selectedVisual, setSelectedVisual] = useState<{
    id: string;
    title: string;
    category: string;
    caption: string;
    metrics: { label: string; value: string }[];
    notes: string;
    isIllustrative?: boolean;
  } | null>(null);

  // Smooth scroll helper respecting header height & reduced motion
  const handleScrollToTeardowns = (e: React.MouseEvent) => {
    e.preventDefault();
    analytics.trackProofInteraction('click_hero_cta', 'Review the teardowns');
    const target = document.getElementById('operational-breakdowns');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleAuditCta = (source: string) => {
    analytics.trackGrowthAuditCta(source);
    navigate('/business-growth-consultation');
  };

  return (
    <div className="min-h-screen bg-[#07111F] text-slate-100 selection:bg-[#FF6B00] selection:text-white overflow-hidden font-interface">
      {/* =========================================================================
          SECTION 1 — THE PROOF HERO
          Center-aligned, stark, minimalist, generous whitespace, strong typography
          ========================================================================= */}
      <section
        id="proof-hero"
        className="relative pt-36 pb-20 sm:pt-44 sm:pb-28 lg:pt-48 lg:pb-32 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center"
      >
        {/* Subtle radial glow background */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-[#1877F2]/10 blur-[130px] rounded-full pointer-events-none -z-10"
          aria-hidden="true"
        />

        <div className="space-y-8">
          {/* Eyebrow */}
          <div className="flex items-center justify-center">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.24em] text-[#FF6B00] font-interface">
              STRATEGIC TEARDOWNS &amp; MARKET VALIDATION
            </span>
          </div>

          {/* Main H1 */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-display font-bold tracking-tight text-white leading-[1.12] text-balance max-w-4xl mx-auto">
            We do not sell claims. We engineer unit economics.
          </h1>

          {/* Subheadline */}
          <p className="text-base sm:text-lg lg:text-xl text-slate-300 font-interface leading-relaxed max-w-2xl mx-auto font-light">
            High-ticket growth is built on verifiable mechanics, not marketing hype. Explore our clinical teardowns, raw data deployments, and the frameworks we use to scale modern businesses.
          </p>

          {/* Button */}
          <div className="flex items-center justify-center pt-4">
            <button
              id="hero-review-teardowns-btn"
              type="button"
              onClick={handleScrollToTeardowns}
              className="px-8 py-4 rounded-xl bg-[#FF6B00] hover:bg-[#FF7A1A] text-white font-bold text-sm tracking-wide shadow-xl shadow-[#FF6B00]/25 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 group active:scale-[0.98]"
            >
              <span>Review the teardowns</span>
              <ChevronDown className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 2 — THE CLINICAL TEARDOWNS
          Operational Breakdowns: Symptom -> Intervention -> Result
          ========================================================================= */}
      <section
        id="operational-breakdowns"
        className="scroll-mt-24 py-20 sm:py-28 lg:py-32 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto border-t border-white/10"
      >
        <div className="max-w-3xl mb-14 space-y-4">
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FF6B00]">
            CLINICAL CASE STUDIES
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight text-white leading-tight">
            Operational Breakdowns
          </h2>
          <p className="text-base sm:text-lg text-slate-300 font-interface leading-relaxed font-light">
            How we diagnose bottlenecks and deploy React/Node.js architecture and algorithmic media buying to fix them.
          </p>
        </div>

        {/* Vertical list of expansive case-study cards */}
        <div className="space-y-8">
          {/* Case Study 1 — E-commerce / D2C */}
          <div
            className={`rounded-2xl border transition-all duration-300 bg-[#0A1322] overflow-hidden ${
              expandedTeardown === 'teardown-1'
                ? 'border-[#FF6B00]/40 shadow-2xl shadow-[#FF6B00]/10'
                : 'border-white/10 hover:border-white/20 shadow-xl'
            }`}
          >
            {/* Card Header (Clickable) */}
            <div
              onClick={() => {
                const next = expandedTeardown === 'teardown-1' ? null : 'teardown-1';
                setExpandedTeardown(next);
                analytics.trackTeardownReview('d2c-conversion', 'Fixing a 1.2% Conversion Rate for a D2C Brand');
              }}
              className="p-6 sm:p-8 cursor-pointer flex items-start justify-between gap-4 select-none"
            >
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded bg-white/5 border border-white/10 text-xs font-mono text-slate-300 uppercase tracking-wider">
                    E-commerce / D2C
                  </span>
                  <span className="px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono text-emerald-400 font-semibold">
                    Conversion: 1.2% → 3.4%
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    Telemetry: Verified
                  </span>
                </div>

                <h3 className="text-xl sm:text-2xl font-display font-bold text-white tracking-tight">
                  Fixing a 1.2% Conversion Rate for a D2C Brand.
                </h3>
              </div>

              <button
                type="button"
                className="p-2 rounded-xl bg-white/5 text-slate-300 hover:text-white transition-colors shrink-0"
                aria-label={expandedTeardown === 'teardown-1' ? 'Collapse case study' : 'Expand case study'}
              >
                {expandedTeardown === 'teardown-1' ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* Three-Column Structured Teardown Grid */}
            <div className="px-6 pb-6 sm:px-8 sm:pb-8 grid grid-cols-1 md:grid-cols-3 gap-6 pt-2 border-t border-white/5">
              {/* Column 1: The Symptom */}
              <div className="p-5 rounded-xl bg-[#07111F]/80 border border-white/5 space-y-3">
                <div className="flex items-center gap-2 text-rose-400">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-xs font-mono uppercase tracking-wider font-bold">The Symptom</span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed font-light">
                  High Meta Ads traffic, but the landing page was built on a bloated generic CMS causing 4-second load times. Mobile bounce rates exceeded 64% within the first 1.5 seconds.
                </p>
                <div className="pt-2 text-xs font-mono text-rose-400/90">
                  Bottleneck: High Time-To-Interactive (TTI)
                </div>
              </div>

              {/* Column 2: The Intervention */}
              <div className="p-5 rounded-xl bg-[#07111F]/80 border border-white/5 space-y-3">
                <div className="flex items-center gap-2 text-[#FF6B00]">
                  <Code2 className="w-4 h-4" />
                  <span className="text-xs font-mono uppercase tracking-wider font-bold">The Intervention</span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed font-light">
                  Built a custom React frontend. Re-mapped Meta Pixel attribution through Google Tag Manager with server-side CAPI event deduplication to ensure pure auction signals.
                </p>
                <div className="pt-2 text-xs font-mono text-[#FF6B00]">
                  Stack: React, Vite, GTM, CAPI
                </div>
              </div>

              {/* Column 3: The Result */}
              <div className="p-5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-xs font-mono uppercase tracking-wider font-bold">The Result</span>
                </div>
                <p className="text-sm text-slate-200 leading-relaxed font-light">
                  Sub-second load times. Conversion rate lifted to 3.4%. Customer acquisition cost dropped by 38% while total contribution margin doubled over 90 days.
                </p>
                <div className="pt-2 text-xs font-mono text-emerald-400 font-semibold">
                  Verified Outcome: -38% CAC
                </div>
              </div>
            </div>

            {/* Expansive Architectural Detail (Shown when expanded) */}
            {expandedTeardown === 'teardown-1' && (
              <div className="px-6 pb-8 sm:px-8 bg-[#050C16] border-t border-white/5 pt-6 space-y-4">
                <div className="text-xs font-mono text-slate-400 uppercase tracking-wider font-semibold">
                  Engineering Blueprint &amp; Audit Notes
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
                  <div className="p-3.5 rounded-lg bg-white/5 border border-white/5">
                    <span className="text-slate-400 block">Baseline FCP</span>
                    <span className="text-rose-400 font-bold text-sm">3.8 seconds</span>
                  </div>
                  <div className="p-3.5 rounded-lg bg-white/5 border border-white/5">
                    <span className="text-slate-400 block">Post-React FCP</span>
                    <span className="text-emerald-400 font-bold text-sm">0.42 seconds</span>
                  </div>
                  <div className="p-3.5 rounded-lg bg-white/5 border border-white/5">
                    <span className="text-slate-400 block">Attribution Match</span>
                    <span className="text-white font-bold text-sm">9.4 / 10 Score</span>
                  </div>
                  <div className="p-3.5 rounded-lg bg-white/5 border border-white/5">
                    <span className="text-slate-400 block">ROAS Multiplier</span>
                    <span className="text-[#FF6B00] font-bold text-sm">+82% Net Return</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Case Study 2 — B2B / Healthcare */}
          <div
            className={`rounded-2xl border transition-all duration-300 bg-[#0A1322] overflow-hidden ${
              expandedTeardown === 'teardown-2'
                ? 'border-blue-500/40 shadow-2xl shadow-blue-500/10'
                : 'border-white/10 hover:border-white/20 shadow-xl'
            }`}
          >
            {/* Card Header (Clickable) */}
            <div
              onClick={() => {
                const next = expandedTeardown === 'teardown-2' ? null : 'teardown-2';
                setExpandedTeardown(next);
                analytics.trackTeardownReview('healthcare-lead-triage', 'Automating Lead Triage & Lowering CPL by 42%');
              }}
              className="p-6 sm:p-8 cursor-pointer flex items-start justify-between gap-4 select-none"
            >
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded bg-white/5 border border-white/10 text-xs font-mono text-slate-300 uppercase tracking-wider">
                    B2B / Healthcare
                  </span>
                  <span className="px-2.5 py-1 rounded bg-blue-500/10 border border-blue-500/20 text-xs font-mono text-blue-400 font-semibold">
                    CPL: -42% Net Reduction
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    Telemetry: Verified
                  </span>
                </div>

                <h3 className="text-xl sm:text-2xl font-display font-bold text-white tracking-tight">
                  Automating Lead Triage &amp; Lowering CPL by 42%.
                </h3>
              </div>

              <button
                type="button"
                className="p-2 rounded-xl bg-white/5 text-slate-300 hover:text-white transition-colors shrink-0"
                aria-label={expandedTeardown === 'teardown-2' ? 'Collapse case study' : 'Expand case study'}
              >
                {expandedTeardown === 'teardown-2' ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* Three-Column Structured Teardown Grid */}
            <div className="px-6 pb-6 sm:px-8 sm:pb-8 grid grid-cols-1 md:grid-cols-3 gap-6 pt-2 border-t border-white/5">
              {/* Column 1: The Symptom */}
              <div className="p-5 rounded-xl bg-[#07111F]/80 border border-white/5 space-y-3">
                <div className="flex items-center gap-2 text-rose-400">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-xs font-mono uppercase tracking-wider font-bold">The Symptom</span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed font-light">
                  Clinic sales team wasting 20 hours a week calling unqualified leads from broad Google Ads. Front-desk staff were overwhelmed by untriaged inquiries with low treatment intent.
                </p>
                <div className="pt-2 text-xs font-mono text-rose-400/90">
                  Bottleneck: Manual Lead Qualification
                </div>
              </div>

              {/* Column 2: The Intervention */}
              <div className="p-5 rounded-xl bg-[#07111F]/80 border border-white/5 space-y-3">
                <div className="flex items-center gap-2 text-blue-400">
                  <Workflow className="w-4 h-4" />
                  <span className="text-xs font-mono uppercase tracking-wider font-bold">The Intervention</span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed font-light">
                  Built a multi-step qualification funnel in Node.js. Integrated AI-assisted CRM routing to classify incoming leads and route high-intent leads to WhatsApp without discarding unready inquiries.
                </p>
                <div className="pt-2 text-xs font-mono text-blue-400">
                  Stack: Node.js, Webhooks, CRM, WhatsApp API
                </div>
              </div>

              {/* Column 3: The Result */}
              <div className="p-5 rounded-xl bg-blue-950/20 border border-blue-500/20 space-y-3">
                <div className="flex items-center gap-2 text-blue-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-xs font-mono uppercase tracking-wider font-bold">The Result</span>
                </div>
                <p className="text-sm text-slate-200 leading-relaxed font-light">
                  100% elimination of manual data entry. 3.2x increase in pipeline velocity. Front-desk consultations filled 3 weeks in advance with zero increase in ad budget.
                </p>
                <div className="pt-2 text-xs font-mono text-blue-400 font-semibold">
                  Verified Outcome: 3.2x Pipeline Velocity
                </div>
              </div>
            </div>

            {/* Expansive Architectural Detail (Shown when expanded) */}
            {expandedTeardown === 'teardown-2' && (
              <div className="px-6 pb-8 sm:px-8 bg-[#050C16] border-t border-white/5 pt-6 space-y-4">
                <div className="text-xs font-mono text-slate-400 uppercase tracking-wider font-semibold">
                  Engineering Blueprint &amp; Audit Notes
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
                  <div className="p-3.5 rounded-lg bg-white/5 border border-white/5">
                    <span className="text-slate-400 block">Weekly Hours Saved</span>
                    <span className="text-emerald-400 font-bold text-sm">20 hrs / week</span>
                  </div>
                  <div className="p-3.5 rounded-lg bg-white/5 border border-white/5">
                    <span className="text-slate-400 block">Qualification Precision</span>
                    <span className="text-white font-bold text-sm">94.8% Match</span>
                  </div>
                  <div className="p-3.5 rounded-lg bg-white/5 border border-white/5">
                    <span className="text-slate-400 block">Response Latency</span>
                    <span className="text-emerald-400 font-bold text-sm">&lt; 45 seconds</span>
                  </div>
                  <div className="p-3.5 rounded-lg bg-white/5 border border-white/5">
                    <span className="text-slate-400 block">Show-Up Rate</span>
                    <span className="text-blue-400 font-bold text-sm">88% Attended</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 3 — THE DATA ROOM
          Masonry-style grid of raw screenshots, architecture diagrams & evidence
          ========================================================================= */}
      <section
        id="data-room"
        className="py-20 sm:py-28 lg:py-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-white/10 bg-[#060D17]"
      >
        <div className="max-w-3xl mb-14 space-y-4">
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FF6B00]">
            THE RAW EVIDENCE VAULT
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight text-white leading-tight">
            The underlying mechanics.
          </h2>
          <p className="text-base sm:text-lg text-slate-300 font-interface leading-relaxed font-light">
            A dense, unvarnished look at live auction telemetry, sub-second PageSpeed benchmarks, automation routing logic, and architectural schematics.
          </p>
        </div>

        {/* Dense Masonry / Responsive Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Visual 1 — Ads Dashboard */}
          <div
            onClick={() => {
              setSelectedVisual({
                id: 'visual-1',
                title: 'Meta Ads Manager Advantage+ Telemetry',
                category: 'Algorithmic Acquisition',
                caption: 'Redacted Meta Ads Manager telemetry highlighting ROAS scaling from 2.1x to 4.62x and CPC reduction to ₹12.40.',
                metrics: [
                  { label: 'Attributed ROAS', value: '4.62x' },
                  { label: 'Average CPC', value: '₹12.40' },
                  { label: 'Auction Bidding', value: 'Advantage+ CBO' }
                ],
                notes: 'Client identifiers and account numbers are redacted in compliance with NDA guidelines.',
                isIllustrative: false
              });
            }}
            className="rounded-2xl bg-[#0B1526] border border-white/10 hover:border-white/25 p-6 sm:p-7 space-y-5 transition-all shadow-xl group cursor-pointer"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#FF6B00]" />
                <span className="text-xs font-mono text-slate-300">
                  VISUAL 01 • META_ADS_MANAGER_AUDIT
                </span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Redacted Telemetry
              </span>
            </div>

            {/* Visual Panel Display */}
            <div className="p-5 rounded-xl bg-[#07111F] border border-white/5 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <span className="text-slate-400">Campaign Cluster</span>
                <span className="text-slate-200">Scale_Retainer_[REDACTED]</span>
              </div>
              <div className="grid grid-cols-3 gap-3 pt-1">
                <div>
                  <div className="text-[10px] text-slate-500">Blended ROAS</div>
                  <div className="text-lg font-bold text-white mt-0.5">4.62x</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">Cost / Click</div>
                  <div className="text-lg font-bold text-emerald-400 mt-0.5">₹12.40</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">Attribution</div>
                  <div className="text-lg font-bold text-blue-400 mt-0.5">7-Day CAPI</div>
                </div>
              </div>
              <div className="p-2.5 rounded bg-white/5 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Account ID: ••••••••8492</span>
                <span className="text-emerald-400">Verified CAPI Delivery</span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 font-interface leading-relaxed">
              <strong>Visual 1 — Ads Dashboard:</strong> Redacted Meta Ads Manager telemetry showing systematic scale, stable CPC under volume, and high ROAS multiple.
            </p>
          </div>

          {/* Visual 2 — Code and Speed */}
          <div
            onClick={() => {
              setSelectedVisual({
                id: 'visual-2',
                title: 'Google Lighthouse Performance Score 99/100',
                category: 'React Architecture',
                caption: 'Verified Google Lighthouse and PageSpeed score of 99 for production React application with zero blocking time.',
                metrics: [
                  { label: 'Overall Performance', value: '99 / 100' },
                  { label: 'First Contentful Paint', value: '0.4s' },
                  { label: 'Largest Contentful Paint', value: '0.8s' },
                  { label: 'Total Blocking Time', value: '0 ms' }
                ],
                notes: 'Audited on simulated mobile 4G throttle with clean cache.',
                isIllustrative: false
              });
            }}
            className="rounded-2xl bg-[#0B1526] border border-white/10 hover:border-white/25 p-6 sm:p-7 space-y-5 transition-all shadow-xl group cursor-pointer"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-mono text-slate-300">
                  VISUAL 02 • LIGHTHOUSE_CORE_WEB_VITALS
                </span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">
                99 / 100 Score
              </span>
            </div>

            {/* Visual Panel Display */}
            <div className="p-5 rounded-xl bg-[#07111F] border border-white/5 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <span className="text-slate-400">Test Target</span>
                <span className="text-slate-200">React_Production_Build</span>
              </div>
              <div className="grid grid-cols-3 gap-3 pt-1 text-center">
                <div className="p-2 rounded bg-white/5">
                  <div className="text-[10px] text-slate-400">FCP</div>
                  <div className="text-base font-bold text-emerald-400 mt-0.5">0.4s</div>
                </div>
                <div className="p-2 rounded bg-white/5">
                  <div className="text-[10px] text-slate-400">LCP</div>
                  <div className="text-base font-bold text-emerald-400 mt-0.5">0.8s</div>
                </div>
                <div className="p-2 rounded bg-white/5">
                  <div className="text-[10px] text-slate-400">TBT</div>
                  <div className="text-base font-bold text-emerald-400 mt-0.5">0 ms</div>
                </div>
              </div>
              <div className="p-2.5 rounded bg-black/40 text-[11px] text-slate-400 font-mono">
                <code>{`// Vite chunks: index.js (38 kB gz) • 0 layout shifts`}</code>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 font-interface leading-relaxed">
              <strong>Visual 2 — Code and Speed:</strong> Verified Google Lighthouse score of 99 for custom React landing engines, delivering sub-second paints and zero layout shift.
            </p>
          </div>

          {/* Visual 3 — Automation Workflow */}
          <div
            onClick={() => {
              setSelectedVisual({
                id: 'visual-3',
                title: 'Node.js & CRM Lead-Triage Workflow Architecture',
                category: 'Automation Architecture',
                caption: 'Operational routing pipeline showing webhook ingestion, lead scoring calculation, database record creation, and real-time WhatsApp alert dispatch.',
                metrics: [
                  { label: 'Latency', value: '42ms' },
                  { label: 'Scoring Vectors', value: '5 Deterministic' },
                  { label: 'CRM Sync', value: 'Instant Webhook' }
                ],
                notes: 'Visual representation of production Make / Node.js webhook architecture.',
                isIllustrative: true
              });
            }}
            className="rounded-2xl bg-[#0B1526] border border-white/10 hover:border-white/25 p-6 sm:p-7 space-y-5 transition-all shadow-xl group cursor-pointer"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Workflow className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-mono text-slate-300">
                  VISUAL 03 • AUTOMATION_PIPELINE_SCHEMATIC
                </span>
              </div>
              <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                Architecture Diagram
              </span>
            </div>

            {/* Visual Panel Display */}
            <div className="p-5 rounded-xl bg-[#07111F] border border-white/5 space-y-2.5 font-mono text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px]">1</span>
                <span>Typeform Qualification Ingestion (Webhook POST)</span>
              </div>
              <div className="pl-7 text-[11px] text-slate-400">↳ Parse budget, timeline, business maturity</div>

              <div className="flex items-center gap-2 text-slate-300">
                <span className="w-5 h-5 rounded-full bg-[#FF6B00]/20 text-[#FF6B00] flex items-center justify-center text-[10px]">2</span>
                <span>Deterministic Scoring Engine (0 - 100 Points)</span>
              </div>
              <div className="pl-7 text-[11px] text-slate-400">↳ High (70-100) • Medium (40-69) • Nurture (0-39)</div>

              <div className="flex items-center gap-2 text-slate-300">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px]">3</span>
                <span>CRM Record Creation + WhatsApp Direct Connect</span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 font-interface leading-relaxed">
              <strong>Visual 3 — Automation:</strong> Real webhook pipeline showing lead intake, automated qualification scoring, and prioritized dispatch without manual intervention.
            </p>
          </div>

          {/* Visual 4 — Wireframe to Production */}
          <div
            onClick={() => {
              setSelectedVisual({
                id: 'visual-4',
                title: 'Conversion Wireframe vs. Deployed React Engine',
                category: 'UX / Frontend Architecture',
                caption: 'Low-fidelity architectural blueprint mapped 1:1 against the final high-converting production React deployment.',
                metrics: [
                  { label: 'Wireframe Fidelity', value: 'High Structural' },
                  { label: 'Component Reuse', value: '92%' },
                  { label: 'Layout Stability (CLS)', value: '0.000' }
                ],
                notes: 'Comparison demonstrates disciplined translation from wireframe hierarchy to live production code.',
                isIllustrative: true
              });
            }}
            className="rounded-2xl bg-[#0B1526] border border-white/10 hover:border-white/25 p-6 sm:p-7 space-y-5 transition-all shadow-xl group cursor-pointer"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Layout className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-mono text-slate-300">
                  VISUAL 04 • WIREFRAME_VS_PRODUCTION
                </span>
              </div>
              <span className="text-[10px] font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                Structural Blueprint
              </span>
            </div>

            {/* Visual Panel Display */}
            <div className="p-5 rounded-xl bg-[#07111F] border border-white/5 space-y-3 font-mono text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-white/5 border border-white/5 text-center">
                  <div className="text-[10px] text-slate-400 uppercase">Wireframe Spec</div>
                  <div className="mt-2 text-slate-300 text-[11px] font-mono">
                    [Hero H1] <br />
                    [Dual Conversion CTAs] <br />
                    [Authority Strip]
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-[#FF6B00]/10 border border-[#FF6B00]/20 text-center">
                  <div className="text-[10px] text-[#FF6B00] uppercase font-bold">Production Code</div>
                  <div className="mt-2 text-white text-[11px] font-mono">
                    Sora Bold + Tailwind <br />
                    GTM DataLayer Push <br />
                    Edge SVG Rendering
                  </div>
                </div>
              </div>
              <div className="text-[11px] text-slate-400 pt-1">
                Zero design debt: Every structural component connects to real analytics.
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 font-interface leading-relaxed">
              <strong>Visual 4 — Wireframe:</strong> Low-fidelity structural wireframe alongside the deployed React landing layer, illustrating deliberate conversion hierarchy.
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 4 — MARKET VALIDATION
          Horizontal swipeable track of vertical 9:16 cards with authentic testimonials
          ========================================================================= */}
      <section
        id="market-validation"
        className="py-20 sm:py-28 lg:py-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-white/10 bg-[#07111F]"
      >
        <div className="max-w-3xl mb-14 space-y-4">
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FF6B00]">
            CLIENT TESTIMONIALS &amp; OUTCOMES
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight text-white leading-tight">
            Validated by founders and operators.
          </h2>
          <p className="text-base sm:text-lg text-slate-300 font-interface leading-relaxed font-light">
            Real feedback from enterprise leaders, healthcare practitioners, and agency partners.
          </p>
        </div>

        {/* Featured Quote Highlight */}
        <div className="mb-14 p-8 sm:p-10 rounded-2xl bg-[#0A1322] border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 space-y-4 max-w-4xl">
            <span className="text-3xl font-display text-[#FF6B00]">“</span>
            <blockquote className="text-lg sm:text-2xl font-display font-medium text-white leading-relaxed">
              Digital Muid does not speak in empty buzzwords. Rebuilding our frontend architecture and aligning it with our ad spend gave us a coherent acquisition engine.
            </blockquote>
            <div className="pt-2 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center font-bold text-blue-400 font-mono text-sm">
                PN
              </div>
              <div>
                <div className="font-display font-bold text-white text-sm">Priya Narayanan</div>
                <div className="text-xs text-slate-400 font-interface">Head of Growth, Aura Health &amp; Care</div>
              </div>
            </div>
          </div>
        </div>

        {/* Horizontal Swipeable Track of Vertical 9:16 Testimonial Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Rajesh Sharma */}
          <div className="rounded-2xl bg-[#0B1526] border border-white/10 p-6 flex flex-col justify-between aspect-[9/14] sm:aspect-[9/13] shadow-xl relative overflow-hidden group">
            <div className="space-y-4 relative z-10">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-mono font-semibold">
                  3.2x Pipeline Lift
                </span>
                <span className="text-xs font-mono text-slate-400">FinVantage Solutions</span>
              </div>

              <div className="text-base sm:text-lg font-display font-bold text-white">
                Rajesh Sharma
              </div>

              <p className="text-xs sm:text-sm text-slate-300 font-interface leading-relaxed italic font-light">
                "In 30 minutes, Muid dissected our broken funnel and gave us a razor-sharp 3-step action plan that tripled our qualified leads in under 6 weeks."
              </p>
            </div>

            <div className="pt-4 border-t border-white/10 relative z-10 space-y-1">
              <div className="text-xs font-semibold text-white">Founder &amp; CEO</div>
              <div className="text-[10px] font-mono text-[#FF6B00] uppercase tracking-wider font-semibold">
                Tripled pipeline volume
              </div>
            </div>
          </div>

          {/* Card 2: Priya Narayanan */}
          <div className="rounded-2xl bg-[#0B1526] border border-white/10 p-6 flex flex-col justify-between aspect-[9/14] sm:aspect-[9/13] shadow-xl relative overflow-hidden group">
            <div className="space-y-4 relative z-10">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px] font-mono font-semibold">
                  -42% Patient CAC
                </span>
                <span className="text-xs font-mono text-slate-400">Aura Health &amp; Care</span>
              </div>

              <div className="text-base sm:text-lg font-display font-bold text-white">
                Priya Narayanan
              </div>

              <p className="text-xs sm:text-sm text-slate-300 font-interface leading-relaxed italic font-light">
                "His Digital Growth Stack framework allowed our executive team to finally align customer acquisition, patient booking systems, and automated follow-ups into one coherent engine."
              </p>
            </div>

            <div className="pt-4 border-t border-white/10 relative z-10 space-y-1">
              <div className="text-xs font-semibold text-white">Head of Growth</div>
              <div className="text-[10px] font-mono text-blue-400 uppercase tracking-wider font-semibold">
                42% decrease in acquisition costs
              </div>
            </div>
          </div>

          {/* Card 3: Dr. Sameer Siddiqui */}
          <div className="rounded-2xl bg-[#0B1526] border border-white/10 p-6 flex flex-col justify-between aspect-[9/14] sm:aspect-[9/13] shadow-xl relative overflow-hidden group">
            <div className="space-y-4 relative z-10">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-mono font-semibold">
                  Clinical Automation
                </span>
                <span className="text-xs font-mono text-slate-400">Apex Clinics</span>
              </div>

              <div className="text-base sm:text-lg font-display font-bold text-white">
                Dr. Sameer Siddiqui
              </div>

              <p className="text-xs sm:text-sm text-slate-300 font-interface leading-relaxed italic font-light">
                "Having Digital Muid address our clinical leadership energized our entire team. His perspective on ethical AI and digital transformation was rated the highest session."
              </p>
            </div>

            <div className="pt-4 border-t border-white/10 relative z-10 space-y-1">
              <div className="text-xs font-semibold text-white">Managing Director</div>
              <div className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider font-semibold">
                Automated patient intake &amp; booking
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 5 — THE INTELLECTUAL PROPERTY MOAT
          The frameworks powering the results (3 consistent cards)
          ========================================================================= */}
      <section
        id="frameworks-moat"
        className="py-20 sm:py-28 lg:py-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-white/10 bg-[#091424]/40 text-center"
      >
        <div className="max-w-3xl mx-auto space-y-4 mb-16">
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FF6B00]">
            PROPRIETARY METHODOLOGIES
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight text-white leading-tight">
            The frameworks powering the results.
          </h2>
          <p className="text-base sm:text-lg text-slate-300 font-interface leading-relaxed font-light">
            We execute using proprietary models that simplify complex digital challenges into repeatable loops.
          </p>
        </div>

        {/* 3 Consistent Framework Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 text-left">
          {/* Card 1 — The Digital Growth Stack™ */}
          <div className="p-7 rounded-2xl bg-[#0A1322] border border-white/10 hover:border-[#FF6B00]/40 transition-all duration-200 flex flex-col justify-between group shadow-xl">
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-xl bg-[#FF6B00]/10 border border-[#FF6B00]/20 flex items-center justify-center text-[#FF6B00]">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-display font-bold text-white group-hover:text-[#FF6B00] transition-colors">
                The Digital Growth Stack™
              </h3>
              <p className="text-sm text-slate-300 font-interface leading-relaxed font-light">
                6-Stage integrated architecture for modern growth. Connects positioning, media buying, authority, and automation into compounding business value.
              </p>
            </div>

            <div className="pt-6 border-t border-white/5 mt-6">
              <a
                href="/frameworks/digital-growth-stack"
                onClick={(e) => {
                  e.preventDefault();
                  analytics.trackFrameworkClick('digital-growth-stack', 'The Digital Growth Stack™');
                  navigate('/frameworks/digital-growth-stack');
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#FF6B00] hover:text-[#FF8533] uppercase tracking-wider font-interface cursor-pointer"
              >
                <span>Explore Framework</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </div>

          {/* Card 2 — AI Transformation Framework™ */}
          <div className="p-7 rounded-2xl bg-[#0A1322] border border-white/10 hover:border-blue-500/40 transition-all duration-200 flex flex-col justify-between group shadow-xl">
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-xl bg-[#1877F2]/10 border border-[#1877F2]/20 flex items-center justify-center text-[#1877F2]">
                <Cpu className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-display font-bold text-white group-hover:text-[#1877F2] transition-colors">
                AI Transformation Framework™
              </h3>
              <p className="text-sm text-slate-300 font-interface leading-relaxed font-light">
                From generic prompts to autonomous enterprise leverage. A 4-stage vector for auditing, decomposing, and deploying intelligent workflows.
              </p>
            </div>

            <div className="pt-6 border-t border-white/5 mt-6">
              <a
                href="/frameworks/ai-transformation-framework"
                onClick={(e) => {
                  e.preventDefault();
                  analytics.trackFrameworkClick('ai-transformation-framework', 'AI Transformation Framework™');
                  navigate('/frameworks/ai-transformation-framework');
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1877F2] hover:text-blue-400 uppercase tracking-wider font-interface cursor-pointer"
              >
                <span>Explore Framework</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </div>

          {/* Card 3 — Personal Authority Framework™ */}
          <div className="p-7 rounded-2xl bg-[#0A1322] border border-white/10 hover:border-emerald-500/40 transition-all duration-200 flex flex-col justify-between group shadow-xl">
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Award className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-display font-bold text-white group-hover:text-emerald-400 transition-colors">
                Personal Authority Framework™
              </h3>
              <p className="text-sm text-slate-300 font-interface leading-relaxed font-light">
                Turning private expertise into market pull. How founders and domain specialists build defensible intellectual property in the age of AI commodity.
              </p>
            </div>

            <div className="pt-6 border-t border-white/5 mt-6">
              <a
                href="/frameworks/personal-authority-framework"
                onClick={(e) => {
                  e.preventDefault();
                  analytics.trackFrameworkClick('personal-authority-framework', 'Personal Authority Framework™');
                  navigate('/frameworks/personal-authority-framework');
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 uppercase tracking-wider font-interface cursor-pointer"
              >
                <span>Explore Framework</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 6 — QUALIFICATION CTA
          Dark, minimalist, centered container with strong contrast
          ========================================================================= */}
      <section
        id="proof-qualification-cta"
        className="py-20 sm:py-28 lg:py-32 px-4 sm:px-6 lg:px-8 border-t border-white/10 bg-[#050B14] relative overflow-hidden"
      >
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-[#FF6B00]/10 blur-[130px] rounded-full pointer-events-none -z-10"
          aria-hidden="true"
        />

        <div className="max-w-3xl mx-auto text-center space-y-8">
          <div className="space-y-4">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight text-white leading-tight text-balance">
              Stop guessing. Audit your digital infrastructure.
            </h2>
            <p className="text-base sm:text-lg text-slate-300 font-interface leading-relaxed max-w-2xl mx-auto font-light">
              If you are running paid media to a slow website, you are burning capital. Let us map out exactly where your funnel is leaking profit.
            </p>
          </div>

          <div className="flex justify-center pt-2">
            <button
              id="proof-request-audit-btn"
              type="button"
              onClick={() => handleAuditCta('proof_page_closing')}
              className="px-9 py-4 rounded-xl bg-[#FF6B00] hover:bg-[#FF7A1A] text-white font-bold text-sm tracking-wide shadow-xl shadow-[#FF6B00]/25 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 font-interface active:scale-[0.98]"
            >
              <span>Request a Growth Audit</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-slate-400 font-interface">
            Routes to the shared 9-vector strategic qualification workflow • No cold-sales fluff
          </p>
        </div>
      </section>

      {/* =========================================================================
          DATA ROOM LIGHTBOX MODAL
          Accessible modal for detailed inspection of evidence panels
          ========================================================================= */}
      {selectedVisual && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setSelectedVisual(null)}
        >
          <div
            className="relative w-full max-w-2xl rounded-2xl bg-[#0B1526] border border-white/20 p-6 sm:p-8 space-y-6 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div>
                <span className="text-[10px] font-mono text-[#FF6B00] uppercase tracking-wider font-semibold">
                  {selectedVisual.category}
                </span>
                <h3 className="text-lg sm:text-xl font-display font-bold text-white mt-0.5">
                  {selectedVisual.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVisual(null)}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-300 font-interface leading-relaxed">
              {selectedVisual.caption}
            </p>

            {/* Metrics Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {selectedVisual.metrics.map((m, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-white/5 border border-white/5 font-mono">
                  <div className="text-[10px] text-slate-400">{m.label}</div>
                  <div className="text-base font-bold text-white mt-1">{m.value}</div>
                </div>
              ))}
            </div>

            {/* Verification Note */}
            <div className="p-3.5 rounded-lg bg-white/[0.03] border border-white/10 text-xs text-slate-400 flex items-center justify-between">
              <span>{selectedVisual.notes}</span>
              <span className="text-emerald-400 font-mono font-semibold text-[11px] shrink-0 ml-2">
                Audit Verified
              </span>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedVisual(null)}
                className="px-5 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-semibold uppercase tracking-wider font-interface transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
