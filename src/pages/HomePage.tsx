import React, { useState } from 'react';
import heroPortrait from '../assets/images/regenerated_image_1788770375948.jpg';
import { useApp } from '../context/AppContext';
import { analytics } from '../utils/analytics';
import {
  ArrowRight,
  CheckCircle2,
  Cpu,
  Layers,
  TrendingUp,
  Download,
  Terminal,
  Code2,
  Check,
  AlertCircle,
  Loader2,
  BookOpen,
  Compass,
  Award,
  Zap,
  ShieldCheck,
  BarChart3,
  Server
} from 'lucide-react';

interface HomePageProps {
  navigate: (path: string) => void;
  onOpenResourceModal?: (resourceId: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ navigate }) => {
  const { recordResourceDownload } = useApp();

  // Lead Capture State for Section 7
  const [diagnosticEmail, setDiagnosticEmail] = useState('');
  const [diagnosticStatus, setDiagnosticStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [diagnosticErrorMsg, setDiagnosticErrorMsg] = useState('');
  const [isDuplicate, setIsDuplicate] = useState(false);

  // Diagnostic form submission handler
  const handleDiagnosticSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = diagnosticEmail.trim().toLowerCase();

    // 1. Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setDiagnosticStatus('error');
      setDiagnosticErrorMsg('Please provide a valid business email address.');
      return;
    }

    // 2. Prevent duplicate submission
    if (diagnosticStatus === 'success' || isDuplicate) {
      return;
    }

    setDiagnosticStatus('loading');
    setDiagnosticErrorMsg('');

    try {
      // res-02 is the existing 32-point checklist in INITIAL_RESOURCES & public/downloads/digital-growth-checklist.pdf
      const result = await recordResourceDownload(
        'res-02',
        cleanEmail,
        cleanEmail.split('@')[0],
        undefined,
        'Growth Diagnostic Lead'
      );

      if (result.success) {
        setDiagnosticStatus('success');
        setIsDuplicate(true);

        // Track in Analytics DataLayer (No PII passed)
        analytics.trackDiagnosticFormSubmit('The 32-Point Digital Growth & Readiness Checklist');
        analytics.trackDiagnosticDownload('digital-growth-checklist.pdf');

        // Trigger secure file download
        const downloadUrl = '/downloads/digital-growth-checklist.pdf';
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = 'digital-growth-readiness-checklist-32-points.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        setDiagnosticStatus('error');
        setDiagnosticErrorMsg('Unable to process your request. Please try again.');
      }
    } catch (err) {
      setDiagnosticStatus('error');
      setDiagnosticErrorMsg('Network or service interruption. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-[#07111F] text-slate-100 selection:bg-[#FF6B00] selection:text-white overflow-hidden">
      {/* =========================================================================
          SECTION ONE — THE SWITCHBOARD (HERO)
          Center-aligned composition, strong typography, deliberate whitespace
          ========================================================================= */}
      <section
        id="hero"
        className="relative pt-36 pb-20 sm:pt-44 sm:pb-28 lg:pt-48 lg:pb-32 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center"
      >
        {/* Subtle radial glow background */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-[#1877F2]/10 blur-[120px] rounded-full pointer-events-none -z-10"
          aria-hidden="true"
        />

        <div className="space-y-8">
          {/* Eyebrow Label */}
          <div className="flex items-center justify-center">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.24em] text-[#FF6B00] font-interface">
              STRATEGY • REACT ARCHITECTURE • AI AUTOMATION
            </span>
          </div>

          {/* Main Heading H1 */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-display font-bold tracking-tight text-white leading-[1.12] text-balance max-w-4xl mx-auto">
            Engineered growth systems for scaling businesses &amp; marketing professionals.
          </h1>

          {/* Supporting Paragraph */}
          <p className="text-base sm:text-lg lg:text-xl text-slate-300 font-interface leading-relaxed max-w-2xl mx-auto font-light">
            We design full-stack client acquisition engines, deploy custom web architecture, and train the next generation of performance marketers. Growth is a system, not a tactic.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            {/* Primary CTA */}
            <a
              id="hero-primary-cta"
              href="/business-growth-consultation"
              onClick={(e) => {
                e.preventDefault();
                analytics.trackGrowthAuditCta('hero');
                navigate('/business-growth-consultation');
              }}
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-[#FF6B00] hover:bg-[#FF7A1A] text-white font-bold text-sm tracking-wide shadow-xl shadow-[#FF6B00]/25 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 group active:scale-[0.98] font-interface"
            >
              <span>Build my growth engine</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </a>

            {/* Secondary CTA */}
            <a
              id="hero-secondary-cta"
              href="/learn"
              onClick={(e) => {
                e.preventDefault();
                analytics.trackAcademyCta('hero');
                navigate('/learn');
              }}
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white/5 hover:bg-white/10 text-white font-semibold text-sm border border-white/15 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98] font-interface"
            >
              <span>Master the mechanics</span>
              <BookOpen className="w-4 h-4 text-slate-400" />
            </a>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION TWO — THE AUTHORITY STRIP
          Technology and platform strip beneath the hero
          ========================================================================= */}
      <section
        id="authority-strip"
        className="border-y border-white/10 bg-[#0A1322] py-8 sm:py-10 px-4 sm:px-6 lg:px-8"
      >
        <div className="max-w-6xl mx-auto">
          <p className="text-center text-xs sm:text-sm font-semibold text-slate-400 font-interface uppercase tracking-[0.16em] mb-6">
            Powering digital infrastructure with modern stacks:
          </p>

          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 lg:gap-14">
            {/* React.js */}
            <div className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors">
              <svg className="w-6 h-6 text-[#61DAFB]" viewBox="-11.5 -10.23174 23 20.46348" fill="currentColor">
                <circle cx="0" cy="0" r="2.05" fill="#61DAFB" />
                <g stroke="#61DAFB" strokeWidth="1" fill="none">
                  <ellipse rx="11" ry="4.2" />
                  <ellipse rx="11" ry="4.2" transform="rotate(60)" />
                  <ellipse rx="11" ry="4.2" transform="rotate(120)" />
                </g>
              </svg>
              <span className="font-display font-semibold text-sm tracking-tight text-slate-300">React.js</span>
            </div>

            {/* Node.js */}
            <div className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors">
              <svg className="w-6 h-6 text-[#5FA04E]" viewBox="0 0 32 32" fill="currentColor">
                <path d="M16 2.5L2.8 10.1v15.2L16 32.9l13.2-7.6V10.1L16 2.5zm10.7 21.3L16 30l-10.7-6.2V11.3L16 5.1l10.7 6.2v12.5z" />
              </svg>
              <span className="font-display font-semibold text-sm tracking-tight text-slate-300">Node.js</span>
            </div>

            {/* Meta Ads */}
            <div className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors">
              <svg className="w-6 h-6 text-[#0081FB]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z" />
              </svg>
              <span className="font-display font-semibold text-sm tracking-tight text-slate-300">Meta Ads</span>
            </div>

            {/* Google Ads */}
            <div className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors">
              <svg className="w-6 h-6 text-[#FABB05]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
              </svg>
              <span className="font-display font-semibold text-sm tracking-tight text-slate-300">Google Ads</span>
            </div>

            {/* Google Flow */}
            <div className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors">
              <div className="w-6 h-6 rounded bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold">
                GF
              </div>
              <span className="font-display font-semibold text-sm tracking-tight text-slate-300">Google Flow</span>
            </div>

            {/* Omni Flash */}
            <div className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors">
              <div className="w-6 h-6 rounded bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-white text-[10px] font-bold">
                <Zap className="w-3.5 h-3.5" />
              </div>
              <span className="font-display font-semibold text-sm tracking-tight text-slate-300">Omni Flash</span>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION THREE — CORPORATE PIPELINE
          Two-column section targeting business owners, agencies, and organizations
          ========================================================================= */}
      <section
        id="corporate-pipeline"
        className="py-20 sm:py-28 lg:py-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Column — Visual: Dark-Mode Analytics & Acquisition Engine */}
          <div className="lg:col-span-6 order-2 lg:order-1">
            <div className="relative rounded-2xl bg-[#0B1526] border border-white/10 shadow-2xl overflow-hidden p-6 sm:p-7 space-y-6">
              {/* Header bar */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                  <span className="text-xs font-mono text-slate-400 ml-2">acquisition_pipeline.engine</span>
                </div>
                <div className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
                  <Server className="w-3 h-3" />
                  <span>200 OK • 18ms latency</span>
                </div>
              </div>

              {/* KPI Matrix Strip */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/5">
                  <div className="text-[11px] text-slate-400 font-interface">Qualified Pipeline</div>
                  <div className="text-xl sm:text-2xl font-display font-bold text-white tabular-nums mt-0.5">₹48.2L</div>
                  <div className="text-[10px] text-emerald-400 font-semibold mt-1">↑ +38% MoM</div>
                </div>
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/5">
                  <div className="text-[11px] text-slate-400 font-interface">Conversion Velocity</div>
                  <div className="text-xl sm:text-2xl font-display font-bold text-white tabular-nums mt-0.5">4.82%</div>
                  <div className="text-[10px] text-emerald-400 font-semibold mt-1">CRO Calibrated</div>
                </div>
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/5">
                  <div className="text-[11px] text-slate-400 font-interface">CAC Efficiency</div>
                  <div className="text-xl sm:text-2xl font-display font-bold text-white tabular-nums mt-0.5">3.8x</div>
                  <div className="text-[10px] text-orange-400 font-semibold mt-1">LTV:CAC ratio</div>
                </div>
              </div>

              {/* Client Acquisition Funnel Stages */}
              <div className="space-y-2.5 pt-2">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-interface">
                  Full-Funnel Acquisition Stages
                </div>

                <div className="space-y-2 font-mono text-xs">
                  <div className="p-3 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between">
                    <span className="text-slate-300">01. Algorithmic Media (Meta &amp; Google)</span>
                    <span className="text-slate-400 tabular-nums">24,500 High-Intent Visitors</span>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between">
                    <span className="text-slate-300">02. High-Velocity React Landing Layer</span>
                    <span className="text-emerald-400 tabular-nums">1,180 Diagnostic Opt-ins</span>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between">
                    <span className="text-slate-300">03. Automated Qualification &amp; CRM Routing</span>
                    <span className="text-blue-400 tabular-nums">240 Strategic Audits</span>
                  </div>
                  <div className="p-3 rounded-lg bg-[#FF6B00]/10 border border-[#FF6B00]/30 flex items-center justify-between">
                    <span className="text-white font-semibold">04. Closed Commercial Retainers</span>
                    <span className="text-[#FF6B00] font-bold tabular-nums">High-Ticket Closes</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column — Heading & Capabilities */}
          <div className="lg:col-span-6 order-1 lg:order-2 space-y-6">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight text-white leading-tight">
              Beautiful websites don't close deals. Engineered funnels do.
            </h2>

            <p className="text-base sm:text-lg text-slate-300 font-interface leading-relaxed font-light">
              Stop burning ad budget on brochure websites that leak traffic. We build bespoke client acquisition systems from the server up. From high-velocity React and Node.js architectures to full-funnel Meta and Google Ads management, we align your tech infrastructure with your revenue goals.
            </p>

            {/* Three Capability Items */}
            <div className="space-y-4 pt-2">
              {/* Item 1 */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
                <div className="flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-[#FF6B00]" />
                  <h3 className="text-base font-display font-semibold text-white">Performance web development</h3>
                </div>
                <p className="text-sm text-slate-300 font-interface leading-relaxed pl-6">
                  Custom React landing pages and web experiences designed for fast loading, accessibility, and conversion.
                </p>
              </div>

              {/* Item 2 */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#FF6B00]" />
                  <h3 className="text-base font-display font-semibold text-white">Algorithmic acquisition</h3>
                </div>
                <p className="text-sm text-slate-300 font-interface leading-relaxed pl-6">
                  Meta and Google Ads management focused on campaign structure, measurement, experimentation, and acquisition performance.
                </p>
              </div>

              {/* Item 3 */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-[#FF6B00]" />
                  <h3 className="text-base font-display font-semibold text-white">AI operations</h3>
                </div>
                <p className="text-sm text-slate-300 font-interface leading-relaxed pl-6">
                  AI-assisted workflows, custom AI avatars where genuinely available, and CRM integrations designed to reduce repetitive work and improve operational efficiency.
                </p>
              </div>
            </div>

            {/* CTA */}
            <div className="pt-2">
              <a
                id="corporate-audit-cta"
                href="/business-growth-consultation"
                onClick={(e) => {
                  e.preventDefault();
                  analytics.trackGrowthAuditCta('corporate_pipeline');
                  navigate('/business-growth-consultation');
                }}
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-[#FF6B00] hover:bg-[#FF7A1A] text-white font-bold text-sm tracking-wide shadow-lg shadow-[#FF6B00]/25 transition-all cursor-pointer font-interface active:scale-[0.98]"
              >
                <span>Request a growth audit</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION FOUR — ACADEMY PIPELINE
          Reverse two-column layout to distinguish education from corporate services
          ========================================================================= */}
      <section
        id="academy-pipeline"
        className="py-20 sm:py-28 lg:py-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-white/10 bg-[#091424]/60"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Column — Heading & Curriculum Checklist */}
          <div className="lg:col-span-6 space-y-6">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight text-white leading-tight">
              Stop learning platform hacks. Master the mechanics of digital growth.
            </h2>

            <p className="text-base sm:text-lg text-slate-300 font-interface leading-relaxed font-light">
              The digital landscape doesn't reward copy-paste tactics anymore. Our Academy is built for students, freelancers, and professionals who want to understand the underlying economics of performance marketing, SEO, and AI automation. Learn the exact systems we use to scale real businesses.
            </p>

            {/* Learning Areas Checklist */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-white/5 border border-white/10">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="text-sm sm:text-base font-semibold text-slate-200 font-interface">
                  Performance media buying (Meta &amp; Google)
                </span>
              </div>

              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-white/5 border border-white/10">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="text-sm sm:text-base font-semibold text-slate-200 font-interface">
                  Search engine optimization (AI-integrated)
                </span>
              </div>

              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-white/5 border border-white/10">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="text-sm sm:text-base font-semibold text-slate-200 font-interface">
                  Funnel building &amp; conversion strategy
                </span>
              </div>
            </div>

            {/* CTA */}
            <div className="pt-2">
              <a
                id="academy-explore-cta"
                href="/learn"
                onClick={(e) => {
                  e.preventDefault();
                  analytics.trackAcademyCta('academy_pipeline');
                  navigate('/learn');
                }}
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-[#1877F2] hover:bg-blue-600 text-white font-bold text-sm tracking-wide shadow-lg shadow-[#1877F2]/25 transition-all cursor-pointer font-interface active:scale-[0.98]"
              >
                <span>Explore the academy</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Right Column — Visual: Educational Video & Curriculum Interface */}
          <div className="lg:col-span-6">
            <div className="rounded-2xl bg-[#0B1526] border border-white/10 shadow-2xl p-6 sm:p-7 space-y-5">
              {/* Educational Player Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#FF6B00]" />
                  <span className="text-xs font-semibold text-white font-interface uppercase tracking-wider">
                    DigitalMUID Academy Portal
                  </span>
                </div>
                <span className="text-[11px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Live Masterclass Modules
                </span>
              </div>

              {/* Featured Course Card */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-[#FF6B00] uppercase tracking-wider font-interface">
                      Core Masterclass
                    </span>
                    <h3 className="text-base font-display font-bold text-white mt-0.5">
                      Meta Ads Mastery: Algorithmic Media Buying
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-slate-400 bg-white/5 px-2 py-1 rounded">
                    12 Modules
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                    <span>Curriculum Progress</span>
                    <span className="text-white font-semibold">100% Comprehensive</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#FF6B00] to-emerald-400 rounded-full w-4/5" />
                  </div>
                </div>
              </div>

              {/* Module Syllabus Preview */}
              <div className="space-y-2">
                <div className="p-3 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="text-slate-400 font-mono">01</span>
                    <span className="text-slate-200 font-medium">Underlying Economics of Paid Acquisition</span>
                  </div>
                  <span className="text-emerald-400 text-[11px] font-mono">45 mins</span>
                </div>

                <div className="p-3 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="text-slate-400 font-mono">02</span>
                    <span className="text-slate-200 font-medium">Algorithmic Ad Account Architecture &amp; CBO</span>
                  </div>
                  <span className="text-emerald-400 text-[11px] font-mono">60 mins</span>
                </div>

                <div className="p-3 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="text-slate-400 font-mono">03</span>
                    <span className="text-slate-200 font-medium">AI Automation &amp; Intelligent Workflow Systems</span>
                  </div>
                  <span className="text-emerald-400 text-[11px] font-mono">55 mins</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION FIVE — PROPRIETARY IP
          Centered section communicating DigitalMUID's frameworks
          ========================================================================= */}
      <section
        id="proprietary-ip"
        className="py-20 sm:py-28 lg:py-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center"
      >
        <div className="max-w-3xl mx-auto space-y-4 mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight text-white">
            The Digital MUID operating architecture
          </h2>
          <p className="text-base sm:text-lg text-slate-300 font-interface leading-relaxed font-light">
            Proprietary models designed to simplify complex market challenges into repeatable, high-leverage execution loops.
          </p>
        </div>

        {/* Three-Column Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 text-left">
          {/* Card One — The Digital Growth Stack™ */}
          <div className="p-7 rounded-2xl bg-[#0A1322] border border-white/10 hover:border-[#FF6B00]/40 transition-all duration-200 flex flex-col justify-between group shadow-xl">
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-xl bg-[#FF6B00]/10 border border-[#FF6B00]/20 flex items-center justify-center text-[#FF6B00]">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-display font-bold text-white group-hover:text-[#FF6B00] transition-colors">
                The Digital Growth Stack™
              </h3>
              <p className="text-sm text-slate-300 font-interface leading-relaxed font-light">
                6-stage integrated architecture for modern growth.
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
                <span>Explore framework</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </div>

          {/* Card Two — AI Transformation Framework™ */}
          <div className="p-7 rounded-2xl bg-[#0A1322] border border-white/10 hover:border-blue-500/40 transition-all duration-200 flex flex-col justify-between group shadow-xl">
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-xl bg-[#1877F2]/10 border border-[#1877F2]/20 flex items-center justify-center text-[#1877F2]">
                <Cpu className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-display font-bold text-white group-hover:text-[#1877F2] transition-colors">
                AI Transformation Framework™
              </h3>
              <p className="text-sm text-slate-300 font-interface leading-relaxed font-light">
                From generic prompts to autonomous enterprise leverage.
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
                <span>Explore framework</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </div>

          {/* Card Three — Personal Authority Framework™ */}
          <div className="p-7 rounded-2xl bg-[#0A1322] border border-white/10 hover:border-emerald-500/40 transition-all duration-200 flex flex-col justify-between group shadow-xl">
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Award className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-display font-bold text-white group-hover:text-emerald-400 transition-colors">
                Personal Authority Framework™
              </h3>
              <p className="text-sm text-slate-300 font-interface leading-relaxed font-light">
                Turning private expertise into market pull.
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
                <span>Explore framework</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION SIX — THE OPERATOR
          Two-column profile section
          ========================================================================= */}
      <section
        id="the-operator"
        className="py-20 sm:py-28 lg:py-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-white/10 bg-[#091424]/40"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Column — Portrait */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-full max-w-md aspect-square sm:aspect-[4/5] rounded-3xl overflow-hidden border border-white/15 shadow-2xl bg-slate-900 group">
              <img
                src={heroPortrait}
                alt="Digital Muid — Founder & Growth Systems Operator"
                className="w-full h-full object-cover object-center filter grayscale group-hover:grayscale-0 transition-all duration-500"
                loading="lazy"
                width={400}
                height={500}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#07111F] via-transparent to-transparent opacity-80" />
              <div className="absolute bottom-5 left-5 right-5">
                <div className="text-lg font-display font-bold text-white">Digital Muid</div>
                <div className="text-xs text-[#FF6B00] font-interface font-medium">Founder &amp; Systems Operator</div>
              </div>
            </div>
          </div>

          {/* Right Column — Heading & Biography */}
          <div className="lg:col-span-7 space-y-6">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FF6B00] font-interface">
              THE OPERATOR
            </span>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight text-white leading-tight">
              The operator behind the systems
            </h2>

            <p className="text-base sm:text-lg text-slate-300 font-interface leading-relaxed font-light">
              I operate at the intersection of custom web architecture, AI, and performance marketing. Operating a full-service digital agency out of Lucknow for a borderless economy, my focus is strictly on mechanics over motivation. Whether deploying a custom Node.js application or training the next cohort of marketers, the mission is simple: replace empty corporate jargon with actionable, measurable clarity.
            </p>

            <div className="pt-2">
              <a
                id="operator-story-cta"
                href="/about"
                onClick={(e) => {
                  e.preventDefault();
                  analytics.trackOperatorProfileClick();
                  navigate('/about');
                }}
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-sm tracking-wide border border-white/15 transition-all cursor-pointer font-interface active:scale-[0.98]"
              >
                <span>Read the full story</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION SEVEN — LEAD CAPTURE & CLOSING CONVERSION
          Full-width closing conversion section with high-contrast treatment
          ========================================================================= */}
      <section
        id="lead-capture"
        className="py-20 sm:py-28 lg:py-32 px-4 sm:px-6 lg:px-8 border-t border-white/10 bg-[#050B14] relative overflow-hidden"
      >
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-[#FF6B00]/10 blur-[130px] rounded-full pointer-events-none -z-10"
          aria-hidden="true"
        />

        <div className="max-w-3xl mx-auto text-center space-y-8">
          <div className="space-y-4">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight text-white leading-tight text-balance">
              Before you spend another Rupee on ads, check your infrastructure.
            </h2>
            <p className="text-base sm:text-lg text-slate-300 font-interface leading-relaxed max-w-2xl mx-auto font-light">
              Download the exact 32-point digital growth &amp; readiness checklist we use to audit high-ticket client funnels and uncover conversion bottlenecks.
            </p>
          </div>

          {/* Inline Lead Capture Form */}
          <div className="max-w-xl mx-auto">
            {diagnosticStatus === 'success' ? (
              <div className="p-6 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-left space-y-3">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                  <h3 className="text-base font-bold text-white font-display">
                    Diagnostic checklist unlocked &amp; ready!
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 font-interface leading-relaxed">
                  Your download has started. If the download did not begin automatically, you can access the checklist directly below:
                </p>
                <div className="pt-2">
                  <a
                    href="/downloads/digital-growth-checklist.pdf"
                    download="digital-growth-readiness-checklist-32-points.pdf"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs uppercase tracking-wider font-interface transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF Again</span>
                  </a>
                </div>
              </div>
            ) : (
              <form onSubmit={handleDiagnosticSubmit} className="space-y-4 text-left">
                <div className="flex flex-col sm:flex-row items-stretch gap-3">
                  <div className="flex-1">
                    <label htmlFor="diagnostic-email-input" className="sr-only">
                      Business Email Address
                    </label>
                    <input
                      id="diagnostic-email-input"
                      type="email"
                      required
                      placeholder="Enter your business email"
                      value={diagnosticEmail}
                      onChange={(e) => {
                        setDiagnosticEmail(e.target.value);
                        if (diagnosticStatus === 'error') setDiagnosticStatus('idle');
                      }}
                      className="w-full px-5 py-4 rounded-xl bg-white/5 border border-white/15 text-white placeholder-slate-400 text-sm focus:outline-none focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] transition-colors font-interface"
                    />
                  </div>

                  <button
                    id="diagnostic-submit-btn"
                    type="submit"
                    disabled={diagnosticStatus === 'loading'}
                    className="px-7 py-4 rounded-xl bg-[#FF6B00] hover:bg-[#FF7A1A] disabled:opacity-50 text-white font-bold text-sm tracking-wide shadow-lg shadow-[#FF6B00]/25 transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 font-interface active:scale-[0.98]"
                  >
                    {diagnosticStatus === 'loading' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>Download diagnostic</span>
                      </>
                    )}
                  </button>
                </div>

                {diagnosticStatus === 'error' && (
                  <div className="flex items-center gap-2 text-rose-400 text-xs font-interface">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{diagnosticErrorMsg}</span>
                  </div>
                )}

                <p className="text-[11px] text-slate-400 text-center font-interface">
                  Strictly confidential. No spam, ever. Verified 32-vector framework in PDF format.
                </p>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
