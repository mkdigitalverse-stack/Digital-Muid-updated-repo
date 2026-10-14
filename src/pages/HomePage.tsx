import React, { useState, useRef } from 'react';
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
  Code2,
  AlertCircle,
  Loader2,
  BookOpen,
  Award,
  Zap,
  Server,
  Play,
  Volume2,
  VolumeX,
  FileText,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Gauge,
  Activity
} from 'lucide-react';

interface HomePageProps {
  navigate: (path: string) => void;
  onOpenResourceModal?: (resourceId: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ navigate }) => {
  const { recordResourceDownload, settings } = useApp();

  // VSL Player State for Section 2
  const [isPlayingVsl, setIsPlayingVsl] = useState(false);
  const [isVslMuted, setIsVslMuted] = useState(true);

  // Lead Capture State for Section 10
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

  // Section 1.5 Verified Client Brands
  const verifiedClients = [
    { name: 'MK Digitalverse', category: 'Growth & Architecture Engine', tag: 'Parent Group' },
    { name: 'FinVantage Solutions', category: 'Financial Tech & Advisory', tag: 'B2B Scale' },
    { name: 'Aura Health & Care', category: 'Specialized Medical Practice', tag: 'Healthcare' },
    { name: 'Apex Healthcare Clinics', category: 'Clinical Operations & Intake', tag: 'Multi-Location' },
    { name: 'ScaleX Media', category: 'Performance Media Infrastructure', tag: 'Agency Partner' }
  ];

  return (
    <div className="min-h-screen bg-[#07111F] text-slate-100 selection:bg-[#FF6B00] selection:text-white overflow-hidden">
      {/* =========================================================================
          SECTION 1 — THE SWITCHBOARD (HERO)
          Center-aligned composition, strong typography, deliberate whitespace
          ========================================================================= */}
      <section
        id="hero"
        className="relative pt-36 pb-16 sm:pt-44 sm:pb-24 lg:pt-48 lg:pb-28 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center"
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

          {/* Supporting Sub-headline */}
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
              <span>Build My Growth Engine</span>
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
              <span>Master The Mechanics</span>
              <BookOpen className="w-4 h-4 text-slate-400" />
            </a>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 1.5 — BRAND TRUST CAROUSEL
          Seamless horizontal marquee with muted/grayscale client logos
          ========================================================================= */}
      <section
        id="brand-trust-carousel"
        className="border-y border-white/10 bg-[#060D17] py-6 sm:py-8 overflow-hidden relative"
        aria-label="Client & Brand Trust Marquee"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 mb-4 text-center">
          <p className="text-xs sm:text-xs font-semibold text-slate-400 font-interface uppercase tracking-[0.2em]">
            Engineering digital growth for leading brands and clinics:
          </p>
        </div>

        {/* Marquee Track Container with gradient edge fades */}
        <div className="relative w-full overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-16 sm:w-28 bg-gradient-to-r from-[#060D17] to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-16 sm:w-28 bg-gradient-to-l from-[#060D17] to-transparent z-10 pointer-events-none" />

          <div className="animate-marquee flex items-center gap-6 sm:gap-10 py-2">
            {/* Set 1 */}
            {verifiedClients.map((client, idx) => (
              <div
                key={`client-1-${idx}`}
                className="flex items-center gap-3 px-5 py-3 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/25 transition-all duration-200 shrink-0 select-none group"
              >
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-xs font-mono font-bold text-slate-300 group-hover:text-white transition-colors">
                  0{idx + 1}
                </div>
                <div className="text-left">
                  <div className="font-display font-semibold text-sm text-slate-300 group-hover:text-white transition-colors tracking-tight">
                    {client.name}
                  </div>
                  <div className="text-[10px] font-interface text-slate-400 uppercase tracking-wider">
                    {client.category}
                  </div>
                </div>
              </div>
            ))}

            {/* Set 2 (for continuous loop) */}
            {verifiedClients.map((client, idx) => (
              <div
                key={`client-2-${idx}`}
                className="flex items-center gap-3 px-5 py-3 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/25 transition-all duration-200 shrink-0 select-none group"
                aria-hidden="true"
              >
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-xs font-mono font-bold text-slate-300 group-hover:text-white transition-colors">
                  0{idx + 1}
                </div>
                <div className="text-left">
                  <div className="font-display font-semibold text-sm text-slate-300 group-hover:text-white transition-colors tracking-tight">
                    {client.name}
                  </div>
                  <div className="text-[10px] font-interface text-slate-400 uppercase tracking-wider">
                    {client.category}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 2 — THE DIAGNOSTIC VSL
          Centered, cinematic 16:9 container with standard YouTube player / branded preview
          ========================================================================= */}
      <section
        id="diagnostic-vsl"
        className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center"
      >
        <div className="space-y-4 mb-10">
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FF6B00] font-interface">
            DIAGNOSTIC STRATEGY BREAKDOWN
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight text-white leading-tight">
            How we engineer digital growth in 2026.
          </h2>
          <p className="text-sm sm:text-base text-slate-300 font-interface leading-relaxed max-w-2xl mx-auto font-light">
            A comprehensive 4-minute architectural breakdown: custom React engines, algorithmic ad funnels, and unit economics that withstand platform volatility.
          </p>
        </div>

        {/* 16:9 Cinematic Video Container */}
        <div className="relative w-full max-w-4xl mx-auto rounded-3xl overflow-hidden border border-white/15 bg-[#0A1322] shadow-2xl aspect-video group">
          {isPlayingVsl ? (
            <div className="w-full h-full bg-black">
              {/* Privacy-conscious YouTube iframe using youtube-nocookie.com */}
              <iframe
                className="w-full h-full"
                src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0&modestbranding=1"
                title="How we engineer digital growth in 2026 — DigitalMUID Diagnostic VSL"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="relative w-full h-full flex flex-col justify-between p-6 sm:p-10 text-left bg-gradient-to-t from-[#07111F] via-[#0A1A2F]/90 to-[#07111F]/80">
              {/* Background ambient mesh */}
              <div
                className="absolute inset-0 bg-radial from-[#1877F2]/20 via-transparent to-transparent pointer-events-none"
                aria-hidden="true"
              />

              {/* Top Controls Header Bar */}
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-mono text-emerald-400 font-semibold uppercase tracking-wider">
                    Diagnostic VSL • 2026 Master Edition
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-slate-400 bg-white/10 px-2 py-1 rounded">
                    1080p60 HD
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 bg-white/10 px-2 py-1 rounded">
                    CC Enabled
                  </span>
                </div>
              </div>

              {/* Center Play Button with ripple effect */}
              <div className="relative z-10 my-auto flex flex-col items-center justify-center text-center py-6">
                <button
                  type="button"
                  onClick={() => {
                    analytics.trackVslInteraction('play_vsl');
                    setIsPlayingVsl(true);
                  }}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#FF6B00] hover:bg-[#FF7A1A] text-white flex items-center justify-center shadow-2xl shadow-[#FF6B00]/40 transition-all duration-300 hover:scale-105 active:scale-95 group/btn cursor-pointer focus:outline-none focus:ring-4 focus:ring-[#FF6B00]/50"
                  aria-label="Play Diagnostic Video: How we engineer digital growth in 2026"
                >
                  <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-white text-white translate-x-0.5 group-hover/btn:scale-110 transition-transform" />
                </button>
                <div className="mt-4 space-y-1">
                  <div className="text-xs font-mono text-slate-300 uppercase tracking-widest font-semibold">
                    Watch Full System Walkthrough
                  </div>
                  <div className="text-[11px] text-slate-400">Runtime: 4 mins 18 secs • No fluff</div>
                </div>
              </div>

              {/* Bottom Metadata & Coverage Tags */}
              <div className="relative z-10 pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-2 text-slate-300">
                  <span className="text-slate-400">Coverage:</span>
                  <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white font-mono text-[11px]">
                    React Architecture
                  </span>
                  <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white font-mono text-[11px]">
                    Algorithmic Ad Funnels
                  </span>
                  <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white font-mono text-[11px]">
                    Unit Economics
                  </span>
                </div>
                <div className="text-slate-400 font-interface text-[11px]">
                  Presented by Digital Muid
                </div>
              </div>
            </div>
          )}
        </div>

        {/* CTA Button below video */}
        <div className="pt-8 flex justify-center">
          <a
            id="vsl-growth-audit-btn"
            href="/business-growth-consultation"
            onClick={(e) => {
              e.preventDefault();
              analytics.trackGrowthAuditCta('diagnostic_vsl');
              navigate('/business-growth-consultation');
            }}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[#FF6B00] hover:bg-[#FF7A1A] text-white font-bold text-sm tracking-wide shadow-xl shadow-[#FF6B00]/25 transition-all duration-200 cursor-pointer active:scale-[0.98] font-interface"
          >
            <span>Request a Growth Audit</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      {/* =========================================================================
          SECTION 3 — TECH AUTHORITY STRIP
          Monochrome/grayscale modern tech stack strip
          ========================================================================= */}
      <section
        id="tech-authority-strip"
        className="border-y border-white/10 bg-[#0A1322] py-8 sm:py-10 px-4 sm:px-6 lg:px-8"
      >
        <div className="max-w-6xl mx-auto">
          <p className="text-center text-xs sm:text-xs font-semibold text-slate-400 font-interface uppercase tracking-[0.2em] mb-6">
            Powering digital infrastructure with modern stacks:
          </p>

          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 lg:gap-14">
            {/* React.js */}
            <div className="flex items-center gap-2.5 text-slate-400 hover:text-slate-200 transition-colors">
              <svg className="w-5 h-5 text-slate-300" viewBox="-11.5 -10.23174 23 20.46348" fill="currentColor">
                <circle cx="0" cy="0" r="2.05" />
                <g stroke="currentColor" strokeWidth="1" fill="none">
                  <ellipse rx="11" ry="4.2" />
                  <ellipse rx="11" ry="4.2" transform="rotate(60)" />
                  <ellipse rx="11" ry="4.2" transform="rotate(120)" />
                </g>
              </svg>
              <span className="font-display font-semibold text-sm tracking-tight text-slate-300">React.js</span>
            </div>

            {/* Node.js */}
            <div className="flex items-center gap-2.5 text-slate-400 hover:text-slate-200 transition-colors">
              <svg className="w-5 h-5 text-slate-300" viewBox="0 0 32 32" fill="currentColor">
                <path d="M16 2.5L2.8 10.1v15.2L16 32.9l13.2-7.6V10.1L16 2.5zm10.7 21.3L16 30l-10.7-6.2V11.3L16 5.1l10.7 6.2v12.5z" />
              </svg>
              <span className="font-display font-semibold text-sm tracking-tight text-slate-300">Node.js</span>
            </div>

            {/* Meta Ads */}
            <div className="flex items-center gap-2.5 text-slate-400 hover:text-slate-200 transition-colors">
              <svg className="w-5 h-5 text-slate-300" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z" />
              </svg>
              <span className="font-display font-semibold text-sm tracking-tight text-slate-300">Meta Ads</span>
            </div>

            {/* Google Ads */}
            <div className="flex items-center gap-2.5 text-slate-400 hover:text-slate-200 transition-colors">
              <svg className="w-5 h-5 text-slate-300" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
              </svg>
              <span className="font-display font-semibold text-sm tracking-tight text-slate-300">Google Ads</span>
            </div>

            {/* Google Flow */}
            <div className="flex items-center gap-2.5 text-slate-400 hover:text-slate-200 transition-colors">
              <div className="w-5 h-5 rounded bg-white/10 flex items-center justify-center text-slate-300 text-[9px] font-bold">
                GF
              </div>
              <span className="font-display font-semibold text-sm tracking-tight text-slate-300">Google Flow</span>
            </div>

            {/* Omni Flash */}
            <div className="flex items-center gap-2.5 text-slate-400 hover:text-slate-200 transition-colors">
              <div className="w-5 h-5 rounded bg-white/10 flex items-center justify-center text-slate-300 text-[9px] font-bold">
                <Zap className="w-3.5 h-3.5" />
              </div>
              <span className="font-display font-semibold text-sm tracking-tight text-slate-300">Omni Flash</span>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 4 — CORPORATE PIPELINE
          50/50 split on desktop with high-quality dark-mode React dashboard mockup
          ========================================================================= */}
      <section
        id="corporate-pipeline"
        className="py-20 sm:py-28 lg:py-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Column — Visual: Dark-Mode Dashboard Mockup & Code Visualization */}
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

            {/* Three Feature Bullets */}
            <div className="space-y-4 pt-2">
              {/* Bullet 1 */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
                <div className="flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-[#FF6B00]" />
                  <h3 className="text-base font-display font-semibold text-white">Performance web dev</h3>
                </div>
                <p className="text-sm text-slate-300 font-interface leading-relaxed pl-6">
                  Custom React landing pages built for millisecond load times and conversion.
                </p>
              </div>

              {/* Bullet 2 */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#FF6B00]" />
                  <h3 className="text-base font-display font-semibold text-white">Algorithmic acquisition</h3>
                </div>
                <p className="text-sm text-slate-300 font-interface leading-relaxed pl-6">
                  Advanced Meta &amp; Google Ads media buying.
                </p>
              </div>

              {/* Bullet 3 */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-[#FF6B00]" />
                  <h3 className="text-base font-display font-semibold text-white">AI operations</h3>
                </div>
                <p className="text-sm text-slate-300 font-interface leading-relaxed pl-6">
                  Autonomous workflows using custom AI avatars and CRM integrations.
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
                <span>Request a Growth Audit</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 5 — ACADEMY PIPELINE
          Two-column split: copy on left, curriculum visual on right
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

            {/* Feature Bullets Checklist */}
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
                <span>Explore the Academy</span>
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
          SECTION 6 — PROPRIETARY IP
          Centered section communicating DigitalMUID's 3 core frameworks
          ========================================================================= */}
      <section
        id="proprietary-ip"
        className="py-20 sm:py-28 lg:py-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center"
      >
        <div className="max-w-3xl mx-auto space-y-4 mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight text-white">
            The Digital Muid Operating Architecture
          </h2>
          <p className="text-base sm:text-lg text-slate-300 font-interface leading-relaxed font-light">
            Proprietary models designed to simplify complex market challenges into repeatable, high-leverage execution loops.
          </p>
        </div>

        {/* Three-Column Card Grid */}
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
                6-Stage integrated architecture for modern growth.
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
                <span>Explore Framework</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 7 — THE PROOF ENGINE
          Built for unit economics. Validated by the market.
          Subsection A: Client Transformations (9:16 portrait video/review cards)
          Subsection B: The Mechanics (2-column verified evidence grid)
          ========================================================================= */}
      <section
        id="proof-engine"
        className="py-20 sm:py-28 lg:py-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-white/10 bg-[#060E1A]"
      >
        <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FF6B00] font-interface">
            MEASURED COMMERCIAL IMPACT
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight text-white">
            Built for unit economics. Validated by the market.
          </h2>
          <p className="text-base sm:text-lg text-slate-300 font-interface leading-relaxed font-light">
            We measure outcomes in pipeline value, acquisition cost reductions, and technical conversion lift—not vanity traffic.
          </p>
        </div>

        {/* Subsection A — Client Transformations (Horizontal Track of Portrait 9:16 Cards) */}
        <div className="mb-16 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#FF6B00]" />
              <span>Client Transformations</span>
            </h3>
            <span className="text-xs font-interface text-slate-400">
              Verified outcomes across B2B &amp; healthcare clinics
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Transformation 1: FinVantage Solutions */}
            <div className="relative rounded-2xl bg-[#0B1526] border border-white/10 hover:border-white/20 transition-all p-6 flex flex-col justify-between aspect-[9/14] sm:aspect-[9/13] shadow-xl overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF6B00]/10 rounded-full blur-2xl pointer-events-none" />

              <div className="space-y-4 relative z-10">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-mono font-semibold">
                    3.2x Pipeline Lift
                  </span>
                  <span className="text-xs font-mono text-slate-400">B2B Advisory</span>
                </div>

                <div className="text-base sm:text-lg font-display font-bold text-white group-hover:text-[#FF6B00] transition-colors">
                  FinVantage Solutions
                </div>

                <p className="text-xs sm:text-sm text-slate-300 font-interface leading-relaxed italic font-light">
                  "In 30 minutes, Muid dissected our broken funnel and gave us a 3-step action plan that tripled our qualified leads in under 6 weeks."
                </p>
              </div>

              {/* Bottom Caption & Client Info */}
              <div className="pt-4 border-t border-white/10 relative z-10 space-y-1">
                <div className="text-xs font-semibold text-white font-interface">Rajesh Sharma</div>
                <div className="text-[11px] text-slate-400 font-interface">Founder &amp; CEO</div>
                <div className="pt-2">
                  <span className="text-[10px] font-mono text-[#FF6B00] uppercase tracking-wider font-semibold">
                    Tripled pipeline volume
                  </span>
                </div>
              </div>
            </div>

            {/* Transformation 2: Aura Health & Care */}
            <div className="relative rounded-2xl bg-[#0B1526] border border-white/10 hover:border-white/20 transition-all p-6 flex flex-col justify-between aspect-[9/14] sm:aspect-[9/13] shadow-xl overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="space-y-4 relative z-10">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px] font-mono font-semibold">
                    -42% Patient CAC
                  </span>
                  <span className="text-xs font-mono text-slate-400">Healthcare Clinic</span>
                </div>

                <div className="text-base sm:text-lg font-display font-bold text-white group-hover:text-blue-400 transition-colors">
                  Aura Health &amp; Care
                </div>

                <p className="text-xs sm:text-sm text-slate-300 font-interface leading-relaxed italic font-light">
                  "His Digital Growth Stack framework allowed our executive team to finally align customer acquisition, patient booking systems, and automated follow-ups into one engine."
                </p>
              </div>

              {/* Bottom Caption & Client Info */}
              <div className="pt-4 border-t border-white/10 relative z-10 space-y-1">
                <div className="text-xs font-semibold text-white font-interface">Priya Narayanan</div>
                <div className="text-[11px] text-slate-400 font-interface">Head of Growth</div>
                <div className="pt-2">
                  <span className="text-[10px] font-mono text-blue-400 uppercase tracking-wider font-semibold">
                    42% decrease in acquisition costs
                  </span>
                </div>
              </div>
            </div>

            {/* Transformation 3: Apex Healthcare Clinics */}
            <div className="relative rounded-2xl bg-[#0B1526] border border-white/10 hover:border-white/20 transition-all p-6 flex flex-col justify-between aspect-[9/14] sm:aspect-[9/13] shadow-xl overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="space-y-4 relative z-10">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-mono font-semibold">
                    98% Executive Approval
                  </span>
                  <span className="text-xs font-mono text-slate-400">Clinical Leadership</span>
                </div>

                <div className="text-base sm:text-lg font-display font-bold text-white group-hover:text-emerald-400 transition-colors">
                  Apex Healthcare Clinics
                </div>

                <p className="text-xs sm:text-sm text-slate-300 font-interface leading-relaxed italic font-light">
                  "Having Digital Muid address our clinical leadership energized our team. His perspective on ethical AI and digital operations was rated the single highest session."
                </p>
              </div>

              {/* Bottom Caption & Client Info */}
              <div className="pt-4 border-t border-white/10 relative z-10 space-y-1">
                <div className="text-xs font-semibold text-white font-interface">Dr. Sameer Siddiqui</div>
                <div className="text-[11px] text-slate-400 font-interface">Managing Director</div>
                <div className="pt-2">
                  <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider font-semibold">
                    Automated patient intake &amp; booking
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Subsection B — The Mechanics (Two-Column Evidence Grid) */}
        <div className="space-y-6 pt-6 border-t border-white/10">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>The Mechanics</span>
            </h3>
            <span className="text-xs font-interface text-slate-400">
              Redacted telemetry from live campaigns and production architectures
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Asset 1: Redacted Meta Ads Dashboard Analytics */}
            <div className="rounded-2xl bg-[#0B1526] border border-white/10 p-6 space-y-5 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-mono text-slate-300">
                    AD_ACCOUNT_TELEMETRY • [REDACTED_CLIENT_X]
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded">
                  Advantage+ Auction
                </span>
              </div>

              {/* Redacted Data Matrix */}
              <div className="space-y-3 font-mono text-xs">
                <div className="p-3 rounded-lg bg-white/5 flex items-center justify-between">
                  <span className="text-slate-400">Baseline Blended CAC</span>
                  <span className="text-slate-400 line-through tabular-nums">₹1,840 / lead</span>
                </div>
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                  <span className="text-emerald-400 font-semibold">Calibrated Post-Convergence CAC</span>
                  <span className="text-emerald-300 font-bold tabular-nums">₹1,067 / lead (-42%)</span>
                </div>
                <div className="p-3 rounded-lg bg-white/5 flex items-center justify-between">
                  <span className="text-slate-400">Attributed ROAS Multiple</span>
                  <span className="text-white font-bold tabular-nums">4.62x Verified</span>
                </div>
              </div>

              {/* Caption */}
              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
                <p className="font-interface text-slate-300">
                  <strong className="text-white">Client X:</strong> 42% decrease in CAC via algorithmic scaling.
                </p>
                <span className="text-[10px] font-mono text-emerald-400">Audited</span>
              </div>
            </div>

            {/* Asset 2: React Code Visualization & Verified PageSpeed */}
            <div className="rounded-2xl bg-[#0B1526] border border-white/10 p-6 space-y-5 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs font-mono text-slate-300">
                    LIGHTHOUSE_BENCHMARK • [REDACTED_CLIENT_Y]
                  </span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">
                  Score: 99 / 100
                </span>
              </div>

              {/* Scorecard Matrix */}
              <div className="grid grid-cols-3 gap-3 font-mono text-xs text-center">
                <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                  <div className="text-[10px] text-slate-400">First Contentful Paint</div>
                  <div className="text-emerald-400 font-bold text-base mt-1">0.4s</div>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                  <div className="text-[10px] text-slate-400">Largest Contentful Paint</div>
                  <div className="text-emerald-400 font-bold text-base mt-1">0.8s</div>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                  <div className="text-[10px] text-slate-400">Total Blocking Time</div>
                  <div className="text-emerald-400 font-bold text-base mt-1">0 ms</div>
                </div>
              </div>

              {/* Code Snippet Highlight */}
              <div className="p-3 rounded-lg bg-black/40 border border-white/5 font-mono text-[11px] text-slate-400 space-y-1">
                <div className="text-slate-500">// Zero-bloat SSR hydration &amp; CDN Edge caching</div>
                <div className="text-blue-300">const pipeline = await createAcquisitionEngine(config);</div>
                <div className="text-emerald-400">return pipeline.optimize({'{'} targetLatency: 'sub-second' {'}'});</div>
              </div>

              {/* Caption */}
              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
                <p className="font-interface text-slate-300">
                  <strong className="text-white">Client Y:</strong> Sub-second load times unlocking 3x conversion rates.
                </p>
                <span className="text-[10px] font-mono text-emerald-400">Production</span>
              </div>
            </div>
          </div>

          {/* Link to full proof & teardowns page */}
          <div className="pt-10 flex justify-center">
            <a
              id="homepage-view-all-proof-btn"
              href="/proof"
              onClick={(e) => {
                e.preventDefault();
                analytics.trackProofInteraction('click_homepage_proof_link', 'Explore all clinical teardowns & data room');
                navigate('/proof');
              }}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white border border-white/10 text-xs font-semibold uppercase tracking-wider transition-all font-interface group"
            >
              <span>Explore all clinical teardowns &amp; raw data room</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#FF6B00] group-hover:translate-x-1 transition-transform" />
            </a>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 8 — THE OPERATOR
          Two-column profile section: portrait left, biography right
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
                <span>Read the Full Story</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 9 — THE GROWTH LAB
          Centered heading & 3-card horizontal blog layout
          ========================================================================= */}
      <section
        id="growth-lab"
        className="py-20 sm:py-28 lg:py-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-white/10 bg-[#07111F]"
      >
        <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FF6B00] font-interface">
            THE GROWTH LAB
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight text-white">
            Strategic teardowns &amp; execution models
          </h2>
          <p className="text-base sm:text-lg text-slate-300 font-interface leading-relaxed font-light">
            Field notes from live growth experiments, algorithmic ad shifts, and technical conversion optimization.
          </p>
        </div>

        {/* 3-Card Horizontal Blog Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {/* Card 1: Anatomy of a high-conversion digital growth system */}
          <div className="rounded-2xl bg-[#0A1322] border border-white/10 hover:border-[#FF6B00]/40 transition-all duration-200 flex flex-col justify-between p-7 group shadow-xl">
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400 font-interface">
                <span className="px-2.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300 font-mono text-[10px] uppercase">
                  Marketing Architecture
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>8 min read</span>
                </span>
              </div>

              <h3 className="text-xl font-display font-bold text-white group-hover:text-[#FF6B00] transition-colors leading-snug">
                Anatomy of a high-conversion digital growth system
              </h3>

              <p className="text-sm text-slate-300 font-interface leading-relaxed font-light">
                The step-by-step mechanics of capturing high-intent B2B and consumer demand without relying on discount gimmicks.
              </p>
            </div>

            <div className="pt-6 border-t border-white/5 mt-6">
              <a
                href="/blog/high-conversion-growth-system-anatomy"
                onClick={(e) => {
                  e.preventDefault();
                  analytics.trackArticleClick('high-conversion-growth-system-anatomy', 'Anatomy of a high-conversion digital growth system');
                  navigate('/blog/high-conversion-growth-system-anatomy');
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#FF6B00] hover:text-[#FF8533] uppercase tracking-wider font-interface cursor-pointer"
              >
                <span>Read Strategic Essay</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </div>

          {/* Card 2: Practical AI transformation: Moving from novelty to margin */}
          <div className="rounded-2xl bg-[#0A1322] border border-white/10 hover:border-blue-500/40 transition-all duration-200 flex flex-col justify-between p-7 group shadow-xl">
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400 font-interface">
                <span className="px-2.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300 font-mono text-[10px] uppercase">
                  AI Transformation
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>7 min read</span>
                </span>
              </div>

              <h3 className="text-xl font-display font-bold text-white group-hover:text-blue-400 transition-colors leading-snug">
                Practical AI transformation: Moving from novelty to margin
              </h3>

              <p className="text-sm text-slate-300 font-interface leading-relaxed font-light">
                How leading founders audit their workflows, isolate leverage points, and deploy autonomous agents without breaking core customer trust.
              </p>
            </div>

            <div className="pt-6 border-t border-white/5 mt-6">
              <a
                href="/blog/practical-ai-transformation-framework"
                onClick={(e) => {
                  e.preventDefault();
                  analytics.trackArticleClick('practical-ai-transformation-framework', 'Practical AI transformation: Moving from novelty to margin');
                  navigate('/blog/practical-ai-transformation-framework');
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1877F2] hover:text-blue-400 uppercase tracking-wider font-interface cursor-pointer"
              >
                <span>Read Strategic Essay</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </div>

          {/* Card 3: Meta Ads in 2026: The algorithmic shift */}
          <div className="rounded-2xl bg-[#0A1322] border border-white/10 hover:border-emerald-500/40 transition-all duration-200 flex flex-col justify-between p-7 group shadow-xl">
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400 font-interface">
                <span className="px-2.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300 font-mono text-[10px] uppercase">
                  Algorithmic Media
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>6 min read</span>
                </span>
              </div>

              <h3 className="text-xl font-display font-bold text-white group-hover:text-emerald-400 transition-colors leading-snug">
                Meta Ads in 2026: The algorithmic shift
              </h3>

              <p className="text-sm text-slate-300 font-interface leading-relaxed font-light">
                Why micro-targeting is obsolete, and how creative architecture, high-resonance hooks, and first-party data are driving superior ROAS.
              </p>
            </div>

            <div className="pt-6 border-t border-white/5 mt-6">
              <a
                href="/blog/meta-ads-2026-algorithmic-shift"
                onClick={(e) => {
                  e.preventDefault();
                  analytics.trackArticleClick('meta-ads-2026-algorithmic-shift', 'Meta Ads in 2026: The algorithmic shift');
                  navigate('/blog/meta-ads-2026-algorithmic-shift');
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 uppercase tracking-wider font-interface cursor-pointer"
              >
                <span>Read Strategic Essay</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </div>
        </div>

        {/* Button: Read All Strategic Essays */}
        <div className="flex justify-center">
          <a
            id="read-all-essays-btn"
            href="/blog"
            onClick={(e) => {
              e.preventDefault();
              navigate('/blog');
            }}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-semibold text-sm border border-white/15 transition-all cursor-pointer font-interface active:scale-[0.98]"
          >
            <span>Read All Strategic Essays</span>
            <ArrowRight className="w-4 h-4 text-slate-400" />
          </a>
        </div>
      </section>

      {/* =========================================================================
          SECTION 10 — BOTTOM LEAD CAPTURE
          Full-width dark background, strong heading, clear email form
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
                      Email address
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
                        <span>Download Diagnostic</span>
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
