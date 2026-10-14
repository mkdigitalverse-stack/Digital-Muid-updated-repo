import React, { useState } from 'react';
import { SEOHead } from '../components/SEOHead';
import { analytics } from '../utils/analytics';
import {
  ArrowRight,
  TrendingUp,
  Cpu,
  Layers,
  Award,
  Server,
  Zap,
  Gauge,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Code2,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Workflow,
  Terminal,
  ShieldCheck,
  ExternalLink,
  MessageSquare
} from 'lucide-react';

interface GrowthSystemsPageProps {
  navigate: (path: string) => void;
}

export const GrowthSystemsPage: React.FC<GrowthSystemsPageProps> = ({ navigate }) => {
  // Case Study expansion states for Section 2
  const [expandedCaseStudy, setExpandedCaseStudy] = useState<number | null>(null);

  // Market Validation slider state for Section 4
  const [testimonialIndex, setTestimonialIndex] = useState(0);

  const toggleCaseStudy = (idx: number) => {
    setExpandedCaseStudy((prev) => (prev === idx ? null : idx));
  };

  const handleAuditCta = () => {
    analytics.trackGrowthAuditCta('growth_systems_service_page');
    navigate('/business-growth-consultation');
  };

  // Section 4 Verified Video/Testimonial Cards
  const validationCards = [
    {
      id: 'val-1',
      name: 'Priya Narayanan',
      role: 'Head of Growth',
      company: 'Aura Health & Care',
      metric: '-42% Patient CAC',
      quote:
        'Digital Muid does not speak in empty buzzwords. Rebuilding our frontend architecture and aligning it with our ad spend gave us a coherent acquisition engine.',
      tag: 'Healthcare Clinic'
    },
    {
      id: 'val-2',
      name: 'Rajesh Sharma',
      role: 'Founder & CEO',
      company: 'FinVantage Solutions',
      metric: '3.2x Pipeline Lift',
      quote:
        'In 30 minutes, Muid dissected our broken funnel and gave us a razor-sharp action plan that tripled our qualified inbound leads in under 6 weeks.',
      tag: 'B2B Fintech'
    },
    {
      id: 'val-3',
      name: 'Dr. Sameer Siddiqui',
      role: 'Managing Director',
      company: 'Apex Healthcare Clinics',
      metric: '100% Automated Intake',
      quote:
        'Having Digital Muid address our clinical leadership energized our entire team. His perspective on ethical AI and digital systems was rated the highest session.',
      tag: 'Clinical Operations'
    },
    {
      id: 'val-4',
      name: 'Karan Malhotra',
      role: 'Digital Marketing Strategist',
      company: 'ScaleX Media',
      metric: 'Algorithmic Mastery',
      quote:
        'The depth of real-world implementation in Muid’s masterclasses is unmatched. He teaches you how algorithms actually function under the hood.',
      tag: 'Performance Agency'
    }
  ];

  return (
    <div className="min-h-screen bg-[#07111F] text-slate-100 selection:bg-[#FF6B00] selection:text-white">
      {/* Search Engine Optimization & Structured Data */}
      <SEOHead
        path="/services/growth-systems"
        customData={{
          title: 'Growth Systems & Custom Architecture | DigitalMUID',
          description:
            'Verifiable client acquisition engines, high-velocity React web architecture, and automated qualification funnels engineered for unit economics.',
          canonicalUrl: 'https://digitalmuid.in/services/growth-systems'
        }}
      />

      {/* =========================================================================
          SECTION 1 — THE PROOF HERO
          Stark, center-aligned, technical aesthetic with generous whitespace
          ========================================================================= */}
      <section
        id="proof-hero"
        className="relative pt-36 pb-20 sm:pt-44 sm:pb-28 lg:pt-48 lg:pb-32 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center"
      >
        {/* Subtle radial glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[350px] bg-[#1877F2]/10 blur-[130px] rounded-full pointer-events-none -z-10"
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

          {/* Button: Review the Teardowns */}
          <div className="pt-4 flex justify-center">
            <a
              id="hero-review-teardowns-btn"
              href="#operational-breakdowns"
              onClick={(e) => {
                e.preventDefault();
                const target = document.getElementById('operational-breakdowns');
                if (target) {
                  target.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="px-8 py-4 rounded-xl bg-[#FF6B00] hover:bg-[#FF7A1A] text-white font-bold text-sm tracking-wide shadow-xl shadow-[#FF6B00]/25 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 group active:scale-[0.98] font-interface"
            >
              <span>Review the Teardowns</span>
              <ChevronDown className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
            </a>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 2 — THE CLINICAL TEARDOWNS
          Expansive, clickable case-study cards with Problem, Intervention, Outcome
          ========================================================================= */}
      <section
        id="operational-breakdowns"
        className="scroll-mt-24 py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto border-t border-white/10"
      >
        <div className="space-y-4 mb-14 text-center">
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FF6B00] font-interface">
            CASE STUDY DOSSIERS
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight text-white">
            Operational Breakdowns
          </h2>
          <p className="text-sm sm:text-base text-slate-300 font-interface leading-relaxed max-w-2xl mx-auto font-light">
            How we diagnose bottlenecks and deploy React/Node.js architecture and algorithmic media buying to fix them.
          </p>
        </div>

        {/* Vertically Scrolling List of Expansive Cards */}
        <div className="space-y-8">
          {/* Case Study 1 — E-commerce / D2C */}
          <div className="rounded-2xl bg-[#0B1526] border border-white/10 hover:border-white/20 transition-all p-6 sm:p-8 space-y-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-0.5 rounded bg-[#FF6B00]/15 text-[#FF6B00] text-[10px] font-mono font-bold uppercase tracking-wider">
                    D2C / E-Commerce
                  </span>
                  <span className="text-xs font-mono text-slate-400">Case ID: CS-D2C-01</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-display font-bold text-white">
                  Fixing a 1.2% Conversion Rate for a D2C Brand.
                </h3>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-emerald-400 text-xs font-mono bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 font-bold">
                  3.4% CRO Achieved
                </span>
                <button
                  type="button"
                  onClick={() => toggleCaseStudy(1)}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  aria-expanded={expandedCaseStudy === 1}
                  aria-label="Toggle technical breakdown"
                >
                  {expandedCaseStudy === 1 ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Three Pillar Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-interface">
              {/* Problem */}
              <div className="space-y-2 p-4 rounded-xl bg-rose-950/20 border border-rose-500/20">
                <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>The Symptom</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  High Meta Ads traffic, but the landing page was built on a bloated generic CMS causing 4-second load times.
                </p>
              </div>

              {/* Intervention */}
              <div className="space-y-2 p-4 rounded-xl bg-blue-950/20 border border-blue-500/20">
                <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider">
                  <Code2 className="w-3.5 h-3.5" />
                  <span>The Intervention</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Hard-coded a custom React frontend. Re-mapped Meta pixel attribution via Google Tag Manager.
                </p>
              </div>

              {/* Outcome */}
              <div className="space-y-2 p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>The Result</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Sub-second load times. Conversion rate lifted to 3.4%. CAC dropped by 38%.
                </p>
              </div>
            </div>

            {/* Expanded Technical Deep-Dive */}
            {expandedCaseStudy === 1 && (
              <div className="mt-4 pt-6 border-t border-white/10 space-y-4 animate-in fade-in duration-200">
                <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
                  Engineered Execution Vectors:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
                  <div className="p-3.5 rounded-lg bg-black/40 border border-white/5 space-y-1">
                    <span className="text-[#FF6B00] font-semibold">// Frontend Performance</span>
                    <p className="text-slate-400 font-interface">
                      Replaced 37 render-blocking plugins with zero-dependency React hydration. Dropped payload weight from 4.2 MB to 320 KB.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-lg bg-black/40 border border-white/5 space-y-1">
                    <span className="text-blue-400 font-semibold">// Meta Pixel &amp; CAPI Attributions</span>
                    <p className="text-slate-400 font-interface">
                      Deployed server-side conversion telemetry directly to Meta Graph API, capturing 28% previously lost purchase attribution signals.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Case Study 2 — B2B / Healthcare */}
          <div className="rounded-2xl bg-[#0B1526] border border-white/10 hover:border-white/20 transition-all p-6 sm:p-8 space-y-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-0.5 rounded bg-blue-500/15 text-blue-400 text-[10px] font-mono font-bold uppercase tracking-wider">
                    B2B / Healthcare Clinic
                  </span>
                  <span className="text-xs font-mono text-slate-400">Case ID: CS-MED-02</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-display font-bold text-white">
                  Automating Lead Triage &amp; Lowering CPL by 42%.
                </h3>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-emerald-400 text-xs font-mono bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 font-bold">
                  3.2x Pipeline Speed
                </span>
                <button
                  type="button"
                  onClick={() => toggleCaseStudy(2)}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  aria-expanded={expandedCaseStudy === 2}
                  aria-label="Toggle technical breakdown"
                >
                  {expandedCaseStudy === 2 ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Three Pillar Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-interface">
              {/* Problem */}
              <div className="space-y-2 p-4 rounded-xl bg-rose-950/20 border border-rose-500/20">
                <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>The Symptom</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Clinic sales team wasting 20 hours a week calling unqualified leads from broad Google Ads.
                </p>
              </div>

              {/* Intervention */}
              <div className="space-y-2 p-4 rounded-xl bg-blue-950/20 border border-blue-500/20">
                <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider">
                  <Code2 className="w-3.5 h-3.5" />
                  <span>The Intervention</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Built a multi-step qualification funnel in Node.js. Integrated AI CRM routing to instantly disqualify low-intent leads and push high-intent leads to WhatsApp.
                </p>
              </div>

              {/* Outcome */}
              <div className="space-y-2 p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>The Result</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  100% elimination of manual data entry. 3.2x increase in pipeline velocity.
                </p>
              </div>
            </div>

            {/* Expanded Technical Deep-Dive */}
            {expandedCaseStudy === 2 && (
              <div className="mt-4 pt-6 border-t border-white/10 space-y-4 animate-in fade-in duration-200">
                <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
                  Engineered Execution Vectors:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
                  <div className="p-3.5 rounded-lg bg-black/40 border border-white/5 space-y-1">
                    <span className="text-emerald-400 font-semibold">// Node.js Intake Validation</span>
                    <p className="text-slate-400 font-interface">
                      Custom qualification engine scoring budget, treatment urgency, and geographic location before recording data.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-lg bg-black/40 border border-white/5 space-y-1">
                    <span className="text-[#FF6B00] font-semibold">// WhatsApp Cloud API Instant Route</span>
                    <p className="text-slate-400 font-interface">
                      Instant WhatsApp push for score &ge; 70 leads within 90 seconds, securing 74% consultation confirmation rates.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Truthful Case-Study Integrity Footnote */}
        <div className="mt-8 p-4 rounded-xl bg-white/[0.03] border border-white/10 flex items-start gap-3 text-xs text-slate-400 font-interface">
          <ShieldCheck className="w-4 h-4 text-[#FF6B00] shrink-0 mt-0.5" />
          <p>
            <strong className="text-slate-300">Case-Study Data Integrity:</strong> Operational figures represent real architectural deployments. Client identifiers and specific accounts are anonymized to protect proprietary commercial advantage and privacy. Outcomes measured across 90-day post-launch optimization windows.
          </p>
        </div>
      </section>

      {/* =========================================================================
          SECTION 3 — THE DATA ROOM
          Dense, responsive masonry-style grid with 4 underlying evidence items
          ========================================================================= */}
      <section
        id="data-room"
        className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-white/10 bg-[#060D18]"
      >
        <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FF6B00] font-interface">
            RAW ARCHITECTURAL EVIDENCE
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight text-white">
            The underlying mechanics.
          </h2>
          <p className="text-base sm:text-lg text-slate-300 font-interface leading-relaxed font-light">
            Behind every high-converting growth engine is clean code, disciplined campaign structure, and automated logic.
          </p>
        </div>

        {/* 4-Item Responsive Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Visual 1 — Ads Dashboard Telemetry */}
          <div className="rounded-2xl bg-[#0B1526] border border-white/10 p-6 space-y-5 shadow-2xl flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-mono text-slate-300">
                    META_ADS_TELEMETRY • [CONFIDENTIAL_AUDIT]
                  </span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">
                  ROAS: 4.62x
                </span>
              </div>

              {/* Data Dashboard Metrics */}
              <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/5">
                  <div className="text-[10px] text-slate-400">Blended Ad Spend</div>
                  <div className="text-lg font-display font-bold text-white mt-0.5">₹14,20,000</div>
                  <div className="text-[10px] text-slate-400 mt-1">Advantage+ Scaling</div>
                </div>
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/5">
                  <div className="text-[10px] text-slate-400">Attributed Revenue</div>
                  <div className="text-lg font-display font-bold text-emerald-400 mt-0.5">₹65,60,400</div>
                  <div className="text-[10px] text-emerald-400 mt-1">4.62x Return</div>
                </div>
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/5">
                  <div className="text-[10px] text-slate-400">Avg Cost Per Click</div>
                  <div className="text-lg font-display font-bold text-white mt-0.5">₹12.40</div>
                  <div className="text-[10px] text-emerald-400 mt-1">-34% vs Benchmark</div>
                </div>
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/5">
                  <div className="text-[10px] text-slate-400">Attribution Match</div>
                  <div className="text-lg font-display font-bold text-white mt-0.5">94.8%</div>
                  <div className="text-[10px] text-blue-400 mt-1">CAPI Server Telemetry</div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-white/10 text-xs font-interface text-slate-300">
              <strong className="text-white">Visual 1:</strong> Advantage+ Campaign Telemetry: Algorithmic audience retrieval and creative diversification yielding 4.62x blended ROAS and sub-₹15 CPC.
            </div>
          </div>

          {/* Visual 2 — Code and Speed (PageSpeed 99) */}
          <div className="rounded-2xl bg-[#0B1526] border border-white/10 p-6 space-y-5 shadow-2xl flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-mono text-slate-300">
                    LIGHTHOUSE_BENCHMARK • CUSTOM_REACT_BUILD
                  </span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20 font-bold">
                  Score: 99 / 100
                </span>
              </div>

              {/* Lighthouse Vitals Scorecard */}
              <div className="grid grid-cols-4 gap-2 text-center font-mono text-xs">
                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="text-[10px] text-slate-400">FCP</div>
                  <div className="text-emerald-400 font-bold text-base mt-1">0.4s</div>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="text-[10px] text-slate-400">LCP</div>
                  <div className="text-emerald-400 font-bold text-base mt-1">0.8s</div>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="text-[10px] text-slate-400">TBT</div>
                  <div className="text-emerald-400 font-bold text-base mt-1">0 ms</div>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="text-[10px] text-slate-400">CLS</div>
                  <div className="text-emerald-400 font-bold text-base mt-1">0.001</div>
                </div>
              </div>

              {/* Real Code Architecture Visualization */}
              <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 font-mono text-[11px] text-slate-400 space-y-1">
                <div className="text-slate-500">// Zero-bloat SSR hydration &amp; CDN Edge caching</div>
                <div className="text-blue-300">export const AcquisitionLayer = React.memo(({'{'} funnelId {'}'}) =&gt; {'{'}</div>
                <div className="text-slate-400 pl-4">const telemetry = useEdgeAttribution(funnelId);</div>
                <div className="text-emerald-400 pl-4">return &lt;PredictiveFrictionlessCheckout telemetry={'{'}telemetry{'}'} /&gt;;</div>
                <div className="text-blue-300">{'}'});</div>
              </div>
            </div>

            <div className="pt-3 border-t border-white/10 text-xs font-interface text-slate-300">
              <strong className="text-white">Visual 2:</strong> Production React Architecture: Sub-second First Contentful Paint eliminating bounce friction for high-ticket traffic.
            </div>
          </div>

          {/* Visual 3 — Automation & CRM Routing Logic */}
          <div className="rounded-2xl bg-[#0B1526] border border-white/10 p-6 space-y-5 shadow-2xl flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Workflow className="w-4 h-4 text-[#FF6B00]" />
                  <span className="text-xs font-mono text-slate-300">
                    AUTOMATION_PIPELINE • MAKE / NODE.JS CRM
                  </span>
                </div>
                <span className="text-[10px] font-mono text-[#FF6B00] bg-[#FF6B00]/10 px-2 py-0.5 rounded border border-[#FF6B00]/20">
                  Real-Time Triage
                </span>
              </div>

              {/* Automation Flowchart Blocks */}
              <div className="space-y-2 font-mono text-xs">
                <div className="p-2.5 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between">
                  <span className="text-slate-300">01. Webhook Intake</span>
                  <span className="text-slate-400">Typeform / Custom Intake API</span>
                </div>
                <div className="p-2.5 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between">
                  <span className="text-slate-300">02. Node.js Triage Engine</span>
                  <span className="text-blue-400">Email regex + Phone verify</span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#FF6B00]/10 border border-[#FF6B00]/30 flex items-center justify-between">
                  <span className="text-white font-semibold">03. Deterministic Lead Scoring</span>
                  <span className="text-[#FF6B00] font-bold">&ge; 70 = Priority Tier</span>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                  <span className="text-emerald-300 font-semibold">04. WhatsApp Cloud API Alert</span>
                  <span className="text-emerald-400 font-bold">&lt; 90s SLA</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-white/10 text-xs font-interface text-slate-300">
              <strong className="text-white">Visual 3:</strong> Node.js &amp; CRM Pipeline Architecture: Multi-vector lead scoring with real-time routing to WhatsApp and CRM deal stages.
            </div>
          </div>

          {/* Visual 4 — Wireframe to Deployment */}
          <div className="rounded-2xl bg-[#0B1526] border border-white/10 p-6 space-y-5 shadow-2xl flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-mono text-slate-300">
                    UX_SPECIFICATION • WIREFRAME TO PROD
                  </span>
                </div>
                <span className="text-[10px] font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                  Conversion First
                </span>
              </div>

              {/* Wireframe vs Production Comparison Layout */}
              <div className="grid grid-cols-2 gap-3 font-interface text-xs">
                {/* Low-Fi Wireframe Schematic */}
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-dashed border-white/20 space-y-2">
                  <div className="text-[10px] font-mono uppercase text-slate-400 font-bold">
                    01. Low-Fidelity Schematic
                  </div>
                  <div className="space-y-1.5 opacity-60">
                    <div className="w-3/4 h-2 rounded bg-slate-500" />
                    <div className="w-full h-4 rounded bg-slate-600" />
                    <div className="w-1/2 h-2 rounded bg-slate-500" />
                    <div className="w-full h-8 rounded border border-slate-600 flex items-center justify-center text-[9px] font-mono text-slate-400">
                      [ CTA Button Area ]
                    </div>
                  </div>
                </div>

                {/* Final Deployed Component */}
                <div className="p-3.5 rounded-xl bg-gradient-to-br from-[#0B1526] to-[#0E1E38] border border-[#FF6B00]/40 space-y-2 shadow-lg">
                  <div className="text-[10px] font-mono uppercase text-[#FF6B00] font-bold">
                    02. Deployed Production
                  </div>
                  <div className="space-y-1.5">
                    <div className="text-[9px] font-mono text-emerald-400">
                      STRATEGY • REACT ARCHITECTURE
                    </div>
                    <div className="text-[11px] font-display font-bold text-white leading-tight">
                      Engineered Funnel Layer
                    </div>
                    <div className="py-1 px-2 rounded bg-[#FF6B00] text-white text-[9px] font-bold text-center">
                      Live Acquisition Engine
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-white/10 text-xs font-interface text-slate-300">
              <strong className="text-white">Visual 4:</strong> Wireframe to Production Engineering: Translating low-friction conversion hierarchy into custom React component trees.
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 4 — MARKET VALIDATION
          Horizontal swipeable track + High-contrast testimonial block
          ========================================================================= */}
      <section
        id="market-validation"
        className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-white/10 bg-[#07111F]"
      >
        <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FF6B00] font-interface">
            AUTHENTIC OPERATOR ENDORSEMENTS
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight text-white">
            Validated by founders and operators.
          </h2>
          <p className="text-base sm:text-lg text-slate-300 font-interface leading-relaxed font-light">
            Real outcomes from leadership teams who traded platform hacks for verifiable unit economics.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: High-Contrast Testimonial Text Block */}
          <div className="lg:col-span-5 p-8 rounded-3xl bg-[#0B1526] border border-white/15 shadow-2xl relative overflow-hidden space-y-6">
            <div className="w-10 h-10 rounded-2xl bg-[#FF6B00]/15 border border-[#FF6B00]/30 flex items-center justify-center text-[#FF6B00]">
              <MessageSquare className="w-5 h-5" />
            </div>

            <blockquote className="text-lg sm:text-xl font-display font-bold text-white leading-relaxed italic">
              “Digital Muid does not speak in empty buzzwords. Rebuilding our frontend architecture and aligning it with our ad spend gave us a coherent acquisition engine.”
            </blockquote>

            <div className="pt-4 border-t border-white/10">
              <div className="text-base font-display font-bold text-white">Priya Narayanan</div>
              <div className="text-xs text-[#FF6B00] font-interface font-medium">
                Head of Growth, Aura Health &amp; Care
              </div>
              <p className="text-[11px] text-slate-400 mt-1 font-interface">
                Specialized medical and clinical healthcare practice
              </p>
            </div>
          </div>

          {/* Right Column: Horizontally Scrollable 9:16 Video / Transformation Cards */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between pb-2">
              <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                Founder Transformation Dossiers
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTestimonialIndex((prev) => (prev > 0 ? prev - 1 : validationCards.length - 1))}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer"
                  aria-label="Previous card"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setTestimonialIndex((prev) => (prev < validationCards.length - 1 ? prev + 1 : 0))}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer"
                  aria-label="Next card"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {validationCards.slice(testimonialIndex, testimonialIndex + 2).map((item) => (
                <div
                  key={item.id}
                  className="p-6 rounded-2xl bg-[#091424] border border-white/10 flex flex-col justify-between aspect-[9/13] shadow-xl hover:border-white/25 transition-all group"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-bold">
                        {item.metric}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">{item.tag}</span>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-interface italic">
                      "{item.quote}"
                    </p>
                  </div>

                  <div className="pt-4 border-t border-white/10 space-y-0.5">
                    <div className="text-sm font-display font-bold text-white group-hover:text-[#FF6B00] transition-colors">
                      {item.name}
                    </div>
                    <div className="text-xs text-slate-400 font-interface">
                      {item.role} • {item.company}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 5 — THE INTELLECTUAL PROPERTY MOAT
          Proprietary frameworks powering the results (3-column grid)
          ========================================================================= */}
      <section
        id="intellectual-property-moat"
        className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-white/10 bg-[#060D18] text-center"
      >
        <div className="max-w-3xl mx-auto space-y-4 mb-16">
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FF6B00] font-interface">
            OPERATING ARCHITECTURES
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight text-white">
            The frameworks powering the results.
          </h2>
          <p className="text-base sm:text-lg text-slate-300 font-interface leading-relaxed font-light">
            We execute using proprietary models that simplify complex digital challenges into repeatable loops.
          </p>
        </div>

        {/* 3-Column Card Grid */}
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
                6-Stage integrated architecture for modern growth across Strategy, Visibility, Authority, Conversion, Automation, and Scale.
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
                From generic prompts to autonomous enterprise leverage. Audit, decompose, deploy, and compound operational AI.
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
                Turning private expertise into market pull. Building undeniable founder authority that attracts enterprise-tier clients.
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
          Dark, minimal, center-aligned container with clear conversion hierarchy
          ========================================================================= */}
      <section
        id="qualification-cta"
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

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              id="cta-request-growth-audit-btn"
              type="button"
              onClick={handleAuditCta}
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-[#FF6B00] hover:bg-[#FF7A1A] text-white font-bold text-sm tracking-wide shadow-xl shadow-[#FF6B00]/25 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 group active:scale-[0.98] font-interface"
            >
              <span>Request a Growth Audit</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>

            <a
              href="/services/growth-strategy"
              onClick={(e) => {
                e.preventDefault();
                navigate('/services/growth-strategy');
              }}
              className="w-full sm:w-auto px-7 py-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-semibold text-sm border border-white/15 transition-all cursor-pointer font-interface text-center"
            >
              <span>View All Service Practices</span>
            </a>
          </div>

          <p className="text-xs text-slate-400 font-interface">
            Strictly strategic consultation with Digital Muid. No junior account reps.
          </p>
        </div>
      </section>
    </div>
  );
};
