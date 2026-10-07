import React, { useState } from 'react';
import heroPortrait from '../assets/images/regenerated_image_1788770375948.jpg';
import { useApp } from '../context/AppContext';
import { INITIAL_FRAMEWORKS } from '../data/initialData';
import {
  ArrowRight,
  Sparkles,
  Calendar,
  Layers,
  CheckCircle2,
  TrendingUp,
  Cpu,
  Brain,
  Award,
  Video,
  BookOpen,
  Download,
  Users,
  MessageSquare,
  Globe,
  Compass,
  Zap,
  Play,
  Clock,
  ChevronRight,
  ShieldCheck,
  Heart
} from 'lucide-react';

interface HomePageProps {
  navigate: (path: string) => void;
  onOpenResourceModal: (resourceId: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ navigate, onOpenResourceModal }) => {
  const {
    articles,
    videos,
    frameworks,
    resources,
    courses,
    testimonials,
    consultationProduct,
    speakingEvents,
    isCourseWishlisted,
    toggleCourseWishlist,
    studentEnrollments
  } = useApp();

  const [activePhilosophyStep, setActivePhilosophyStep] = useState(2); // AI default
  const [activeStackStep, setActiveStackStep] = useState(0);
  const [activeProofTab, setActiveProofTab] = useState<'Clients' | 'Students' | 'Collaborators'>('Clients');
  const [activeVideoCategory, setActiveVideoCategory] = useState<string>('All');

  const publishedArticles = articles.filter((a) => a.status === 'published');
  const featuredArticle = publishedArticles.find((a) => Boolean(a.isFeatured ?? a.featured)) || publishedArticles[0];
  const supportingArticles = featuredArticle ? publishedArticles.filter((a) => a.id !== featuredArticle.id).slice(0, 3) : [];
  const publishedResources = resources.filter((r) => r.status === 'published' || !r.status);
  const publishedFrameworks = frameworks.filter((f) => f.status === 'published' || !f.status);

  const signatureFramework =
    frameworks.find((f) => f.slug === 'digital-growth-stack') ||
    frameworks[0] ||
    INITIAL_FRAMEWORKS[0];

  const signatureStages =
    (signatureFramework?.frameworkContent ??
      signatureFramework?.framework_content ??
      signatureFramework?.steps ??
      INITIAL_FRAMEWORKS[0]?.frameworkContent ??
      []) as any[];

  const safeStackIndex = Math.min(activeStackStep, Math.max(0, signatureStages.length - 1));
  const activeStage = signatureStages[safeStackIndex] || signatureStages[0] || {
    number: '01',
    step: 1,
    title: 'Strategy & Positioning',
    subtitle: 'Core Vector & Positioning',
    description: 'Define your defensible market moat, identify high-intent ICP segments, and architect your proprietary value proposition.',
    impact: 'Eliminates wasted capital and focuses 100% of resources on proven demand vectors.',
    keyActions: [
      'Ideal Customer Profile (ICP) validation',
      'Value proposition stress-testing',
      'Competitive moat differentiation matrix'
    ]
  };

  const totalCalculated = (consultationProduct.basePrice * (1 + consultationProduct.gstRate)).toFixed(0);

  const philosophySteps = [
    { title: 'Strategy', desc: 'Market positioning & defensible moats' },
    { title: 'Technology', desc: 'Modern web architecture & digital infrastructure' },
    { title: 'AI', desc: 'Autonomous workflows & intelligent synthesis' },
    { title: 'Content', desc: 'Intellectual property & high-authority distribution' },
    { title: 'Customer Experience', desc: 'Frictionless conversion & value delivery' },
    { title: 'Systems', desc: 'Automated CRM, operations & telemetry' },
    { title: 'Growth', desc: 'Compounding enterprise value & predictable scale' }
  ];

  const impactAreas = [
    {
      title: 'Growth Strategy',
      desc: 'Turn digital activity into a measurable growth system with predictable unit economics.',
      icon: TrendingUp,
      route: '/frameworks/digital-growth-stack',
      tag: 'Framework'
    },
    {
      title: 'AI & Automation',
      desc: 'Use intelligent systems to rethink how businesses work, cutting operational friction.',
      icon: Cpu,
      route: '/frameworks/ai-transformation-framework',
      tag: 'AI Operating Model'
    },
    {
      title: 'Modern Marketing',
      desc: 'Build visibility, demand, and conversion without relying on cheap vanity metrics.',
      icon: Compass,
      route: '/learn/digital-marketing-masterclass',
      tag: 'Performance & Intent'
    },
    {
      title: 'Personal Branding',
      desc: 'Turn expertise into authority and commercial opportunity through signature frameworks.',
      icon: Award,
      route: '/frameworks/personal-authority-framework',
      tag: 'Intellectual Property'
    },
    {
      title: 'Digital Transformation',
      desc: 'Connect technology, people, and processes into a unified operating ecosystem.',
      icon: Globe,
      route: '/consultation',
      tag: 'Enterprise Advisory'
    },
    {
      title: 'Education',
      desc: 'Build practical digital skills that can actually be applied to launch and scale real businesses.',
      icon: BookOpen,
      route: '/learn',
      tag: 'Masterclasses'
    }
  ];

  const filteredVideos =
    activeVideoCategory === 'All'
      ? videos.slice(0, 4)
      : videos.filter((v) => v.category === activeVideoCategory).slice(0, 4);

  const filteredTestimonials = testimonials.filter((t) => t.category === activeProofTab);

  return (
    <div id="homepage-root" className="space-y-24 sm:space-y-32 pb-24 overflow-hidden">
      {/* ========================================================================= */}
      {/* SECTION 01 — HERO */}
      {/* ========================================================================= */}
      <section
        id="hero-section"
        className="relative min-h-[90vh] lg:min-h-screen flex items-center pt-28 sm:pt-32 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto hero-gradient"
      >
        {/* Editorial Watermark */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none select-none overflow-hidden">
          <span className="font-display font-black text-[22vw] leading-none whitespace-nowrap text-white">AUTHORITY</span>
        </div>

        {/* Ambient Gradients */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#1877F2]/10 rounded-full blur-3xl pointer-events-none -z-10"></div>
        <div className="absolute bottom-10 right-1/4 w-[30rem] h-[30rem] bg-[#1E3A8A]/20 rounded-full blur-3xl pointer-events-none -z-10"></div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center w-full relative z-10">
          {/* Left Column: Copy & CTAs */}
          <div className="lg:col-span-7 space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
            {/* Editorial Eyebrow */}
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.3em] text-[#FF6B00] font-interface">
              <span className="w-2 h-2 rounded-full bg-[#FF6B00]"></span>
              <span>FOUNDER & GROWTH STRATEGIST</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-6xl xl:text-7xl font-display font-bold text-white tracking-tight leading-[1.05]">
              Digital Growth.<br />
              <span className="text-[#1877F2]">AI. Strategy.</span><br />
              Transformation.
            </h1>

            {/* Supporting Copy */}
            <p className="text-lg sm:text-xl text-[#CBD5E1] font-interface font-light leading-relaxed max-w-2xl">
              I help businesses and professionals navigate digital growth, AI, and modern marketing—and turn knowledge into measurable action.
            </p>

            {/* Identity line */}
            <div className="pt-1 flex flex-wrap items-center gap-2.5 sm:gap-3 text-xs sm:text-sm text-[#CBD5E1]/70 font-interface border-l-2 border-[#FF6B00] pl-4">
              <span className="text-white font-medium">Founder</span>
              <span>·</span>
              <span className="text-white font-medium">Growth Strategist</span>
              <span>·</span>
              <span className="text-white font-medium">Educator</span>
              <span>·</span>
              <span className="text-white font-medium">AI & Digital Transformation</span>
            </div>

            {/* Hero CTAs */}
            <div className="pt-3 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3.5">
              {/* Primary CTA: Book a Consultation */}
              <button
                id="hero-primary-cta"
                onClick={() => navigate('/business-growth-consultation')}
                className="px-7 py-4 bg-[#FF6B00] hover:bg-[#e66000] text-white font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-lg shadow-[#FF6B00]/25 active:scale-98"
              >
                <Calendar className="w-4 h-4 text-white" />
                <span>BOOK A CONSULTATION</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Secondary CTA: Explore Digital Muid */}
              <button
                id="hero-secondary-cta"
                onClick={() => {
                  const el = document.getElementById('core-philosophy-section') || document.getElementById('impact-areas-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                  else navigate('/about');
                }}
                className="px-7 py-4 bg-white/10 hover:bg-white/15 text-white border border-white/20 font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>EXPLORE DIGITAL MUID</span>
                <ArrowRight className="w-4 h-4 text-white/60" />
              </button>

              {/* Subtle Education CTA */}
              <button
                id="hero-education-cta"
                onClick={() => navigate('/learn')}
                className="px-4 py-3 text-[#60A5FA] hover:text-white font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>LEARN WITH DIGITAL MUID</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Trust Footnote */}
            <div className="pt-2 flex items-center gap-4 text-xs text-white/50">
              <span className="text-white font-bold">Expert Advisory</span>
              <span>·</span>
              <span>Trusted by 100+ Brands & Founders</span>
            </div>
          </div>

          {/* Right Column: Editorial Portrait Box with Nodes */}
          <div className="lg:col-span-5 relative flex justify-center animate-in fade-in zoom-in-95 duration-1000">
            <div className="relative w-full max-w-md">
              {/* Editorial Frame */}
              <div className="relative rounded-2xl bg-[#0A1A2F] border border-white/10 shadow-2xl overflow-hidden group">
                <div className="relative aspect-[3/4] overflow-hidden bg-slate-950">
                  <img
                    src={heroPortrait}
                    alt="Digital Muid Portrait"
                    className="w-full h-full object-cover object-top filter grayscale contrast-115 brightness-90 group-hover:grayscale-0 group-hover:scale-102 transition-all duration-700"
                  />
                  {/* Dark subtle gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#07111F] via-[#07111F]/20 to-transparent"></div>

                  {/* Floating Node Pills */}
                  <div className="absolute top-8 left-6 node-pill">
                    AI Systems
                  </div>

                  <div className="absolute top-24 right-6 node-pill">
                    Growth Stack™
                  </div>

                  <div className="absolute bottom-20 left-8 node-pill">
                    Digital Strategy
                  </div>

                  {/* Graphic Lines */}
                  <div className="absolute top-1/2 left-3 w-px h-20 bg-gradient-to-b from-transparent via-[#FF6B00] to-transparent"></div>
                  <div className="absolute bottom-6 right-6 flex flex-col items-end gap-1 pointer-events-none">
                    <div className="h-px w-16 bg-white/20"></div>
                    <div className="h-px w-10 bg-white/20"></div>
                    <div className="h-px w-20 bg-white/20"></div>
                  </div>

                  {/* Editorial Name Tag Bottom */}
                  <div className="absolute bottom-4 left-4 right-4 p-3.5 rounded-xl bg-[#07111F]/90 backdrop-blur-md border border-white/10 shadow-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-bold text-[#FF6B00] tracking-[0.2em] uppercase font-interface">
                          Strategic Advisor
                        </div>
                        <div className="text-base font-bold text-white font-display">
                          Digital Muid
                        </div>
                      </div>
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 02 — AUTHORITY SNAPSHOT */}
      {/* ========================================================================= */}
      <section id="authority-snapshot" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 space-y-2">
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-[#FF6B00] font-interface">
            Track Record
          </div>
          <h2 className="text-2xl sm:text-4xl font-display font-bold text-slate-900 tracking-tight">
            15+ Years in the Digital World
          </h2>
          <p className="text-slate-600 text-sm font-interface max-w-xl mx-auto">
            A battle-tested track record spanning startups, healthcare systems, high-growth brands, and thousands of students.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 rounded-xl bg-white border border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md transition-all group">
            <div className="text-4xl sm:text-5xl font-display font-bold text-slate-900 group-hover:text-[#1877F2] transition-colors">
              15+
            </div>
            <div className="text-[11px] uppercase font-bold text-slate-500 mt-3 tracking-[0.2em] font-interface">
              Years Experience
            </div>
            <div className="text-xs text-slate-600 mt-1 font-interface">
              Continuous implementation across evolving algorithmic cycles.
            </div>
          </div>

          <div className="p-6 rounded-xl bg-white border border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md transition-all group">
            <div className="text-4xl sm:text-5xl font-display font-bold text-slate-900 group-hover:text-[#FF6B00] transition-colors">
              Multi
            </div>
            <div className="text-[11px] uppercase font-bold text-slate-500 mt-3 tracking-[0.2em] font-interface">
              Businesses & Projects
            </div>
            <div className="text-xs text-slate-600 mt-1 font-interface">
              Founded and scaled ventures from zero to national market presence.
            </div>
          </div>

          <div className="p-6 rounded-xl bg-white border border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md transition-all group">
            <div className="text-3xl sm:text-4xl font-display font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
              AI + TECH
            </div>
            <div className="text-[11px] uppercase font-bold text-slate-500 mt-3 tracking-[0.2em] font-interface">
              Integrated Domains
            </div>
            <div className="text-xs text-slate-600 mt-1 font-interface">
              Connecting disparate disciplines into one unified growth engine.
            </div>
          </div>

          <div className="p-6 rounded-xl bg-white border border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md transition-all group">
            <div className="text-3xl sm:text-4xl font-display font-bold text-[#1877F2] group-hover:text-slate-900 transition-colors">
              ONE MISSION
            </div>
            <div className="text-[11px] uppercase font-bold text-slate-500 mt-3 tracking-[0.2em] font-interface">
              Digital Clarity
            </div>
            <div className="text-xs text-slate-600 mt-1 font-interface">
              Replacing empty corporate jargon with actionable clarity.
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 03 — PHILOSOPHY (Visual Ecosystem) */}
      {/* ========================================================================= */}
      <section id="philosophy-section" className="bg-white border-y border-slate-200 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="max-w-3xl space-y-4">
            <div className="text-xs font-bold uppercase tracking-widest text-[#FF6B00] font-interface">
              The Digital Muid Philosophy
            </div>
            <h2 className="text-3xl sm:text-5xl font-display font-bold text-slate-900 tracking-tight leading-tight">
              Digital is no longer just marketing.
            </h2>
            <p className="text-slate-600 text-base sm:text-lg font-interface leading-relaxed">
              When a company isolates advertising from its tech architecture, customer experience, and AI capabilities, value leaks everywhere. True leverage occurs when all seven pillars connect seamlessly.
            </p>
          </div>

          {/* Interactive Ecosystem Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {philosophySteps.map((step, idx) => {
              const isSelected = activePhilosophyStep === idx;
              return (
                <button
                  key={step.title}
                  onClick={() => setActivePhilosophyStep(idx)}
                  className={`p-4 rounded-xl text-left border transition-all relative cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/80 border-[#1877F2] shadow-sm text-slate-900'
                      : 'bg-slate-50/70 border-slate-200 hover:border-slate-300 hover:bg-white text-slate-700'
                  }`}
                >
                  <div className="text-xs font-mono font-bold text-[#FF6B00] mb-2">0{idx + 1}</div>
                  <div className="text-base font-bold text-slate-900 font-display mb-1">{step.title}</div>
                  <div className="text-xs text-slate-500 line-clamp-2">{step.desc}</div>
                  {idx < 6 && (
                    <div className="hidden lg:block absolute -right-2 top-1/2 -translate-y-1/2 text-slate-400 z-10 font-bold">
                      →
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Final Statement Banner */}
          <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-slate-900 via-[#0B1E3B] to-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
            <p className="text-lg sm:text-xl font-display font-semibold text-white text-center sm:text-left">
              "The businesses that connect these disciplines will shape what comes next."
            </p>
            <button
              onClick={() => navigate('/frameworks')}
              className="shrink-0 px-5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-[#07111F] font-bold text-sm transition-all flex items-center gap-2 cursor-pointer shadow-md"
            >
              <span>See the Ecosystem</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 04 — AREAS OF IMPACT */}
      {/* ========================================================================= */}
      <section id="areas-of-impact" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-3 max-w-2xl">
            <div className="text-xs font-bold uppercase tracking-widest text-[#1877F2] font-interface">
              Strategic Capabilities
            </div>
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 tracking-tight">
              Where I Create Impact
            </h2>
            <p className="text-slate-600 text-sm sm:text-base font-interface">
              Six focused disciplines where strategic advisory and practical implementation unlock breakthrough velocity.
            </p>
          </div>
          <button
            onClick={() => navigate('/business-growth-consultation')}
            className="text-sm font-bold text-[#FF6B00] hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <span>Solve a challenge with Muid</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {impactAreas.map((area) => {
            const Icon = area.icon;
            return (
              <div
                key={area.title}
                onClick={() => navigate(area.route)}
                className="p-7 rounded-2xl bg-white border border-slate-200 hover:border-[#1877F2]/60 transition-all group cursor-pointer flex flex-col justify-between space-y-6 hover:-translate-y-1 shadow-sm hover:shadow-lg"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#1877F2] group-hover:scale-110 group-hover:bg-[#1877F2] group-hover:text-white transition-all">
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                      {area.tag}
                    </span>
                  </div>
                  <h3 className="text-xl font-display font-bold text-slate-900 group-hover:text-[#1877F2] transition-colors">
                    {area.title}
                  </h3>
                  <p className="text-slate-600 text-sm font-interface leading-relaxed">
                    {area.desc}
                  </p>
                </div>

                <div className="pt-2 flex items-center gap-2 text-xs font-bold text-slate-500 group-hover:text-slate-900 transition-colors">
                  <span>Explore impact vector</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform text-[#FF6B00]" />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 05 — SIGNATURE FRAMEWORK: The Digital Growth Stack™ */}
      {/* ========================================================================= */}
      <section id="signature-framework" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 sm:p-12 rounded-3xl bg-white border border-slate-200/90 shadow-xl relative overflow-hidden space-y-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-50 rounded-full blur-3xl pointer-events-none"></div>

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 relative z-10">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF6B00]/10 border border-[#FF6B00]/25 text-[#FF6B00] text-xs font-bold uppercase tracking-wider font-interface">
                <Layers className="w-3.5 h-3.5" /> Signature Proprietary System
              </div>
              <h2 className="text-3xl sm:text-5xl font-display font-bold text-slate-900 tracking-tight">
                The Digital Growth Stack™
              </h2>
              <p className="text-slate-600 text-base sm:text-lg font-interface">
                An interactive 6-stage architecture that transforms disjointed marketing efforts into an unstoppable, compounding growth engine.
              </p>
            </div>
            <button
              onClick={() => navigate('/frameworks/digital-growth-stack')}
              className="shrink-0 px-6 py-3 rounded-xl bg-[#1877F2] hover:bg-blue-600 text-white font-bold text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>Explore the Full Framework</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Interactive 6-Stage System Selector & Inspector */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start relative z-10">
            {/* Left: Stack Steps */}
            <div className="lg:col-span-5 space-y-2.5">
              {signatureStages.map((st, idx) => {
                const isActive = safeStackIndex === idx;
                const stepNumber = st.number ?? st.step ?? (idx + 1);
                const formattedNumber = typeof stepNumber === 'number' ? String(stepNumber).padStart(2, '0') : String(stepNumber);
                const stepTitle = st.title || `Stage ${stepNumber}`;
                const stepSub = st.subtitle || st.shortDescription || '';

                return (
                  <button
                    key={st.id || idx}
                    onClick={() => setActiveStackStep(idx)}
                    className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                      isActive
                        ? 'bg-blue-50/90 border-[#1877F2] shadow-sm translate-x-2'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <span
                        className={`font-mono text-sm font-bold ${
                          isActive ? 'text-[#FF6B00]' : 'text-slate-400'
                        }`}
                      >
                        {formattedNumber}
                      </span>
                      <div>
                        <div className="font-display font-bold text-slate-900 text-base">{stepTitle}</div>
                        {stepSub && <div className="text-xs text-slate-500 font-interface">{stepSub}</div>}
                      </div>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 transition-transform ${
                        isActive ? 'text-[#1877F2] translate-x-1' : 'text-slate-400'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {/* Right: Active Stage Detailed Inspector */}
            <div className="lg:col-span-7 p-6 sm:p-8 rounded-2xl bg-slate-50 border border-slate-200 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-[#FF6B00]/15 text-[#FF6B00] font-mono font-bold flex items-center justify-center text-sm">
                    {activeStage.number ?? activeStage.step ?? (safeStackIndex + 1)}
                  </span>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-display font-bold text-slate-900">
                      Stage {activeStage.number ?? activeStage.step ?? (safeStackIndex + 1)}: {activeStage.title}
                    </h3>
                    {(activeStage.subtitle || activeStage.shortDescription) && (
                      <p className="text-xs text-slate-500">
                        {activeStage.subtitle || activeStage.shortDescription}
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded bg-[#1877F2]/10 text-[#1877F2] border border-[#1877F2]/25 uppercase tracking-wider">
                  Active Vector
                </span>
              </div>

              {(activeStage.description || activeStage.content) && (
                <p className="text-slate-700 text-sm sm:text-base leading-relaxed">
                  {activeStage.description || activeStage.content}
                </p>
              )}

              {(activeStage.impact || activeStage.outcome) && (
                <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2">
                  <div className="text-xs font-bold text-[#FF6B00] uppercase tracking-wider">
                    Commercial Business Impact
                  </div>
                  <p className="text-sm text-slate-800 font-medium">
                    {activeStage.impact || activeStage.outcome}
                  </p>
                </div>
              )}

              {activeStage.keyActions && activeStage.keyActions.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Key Strategic Actions
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {activeStage.keyActions.map((action: string, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-slate-700">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{action}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 06 — INSIGHTS (Ideas Worth Thinking About) */}
      {/* ========================================================================= */}
      <section id="insights-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-3 max-w-2xl">
            <div className="text-xs font-bold uppercase tracking-widest text-[#1877F2] font-interface">
              Strategic Essays & Thought Leadership
            </div>
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 tracking-tight">
              Ideas Worth Thinking About
            </h2>
            <p className="text-slate-600 text-sm sm:text-base font-interface">
              Original essays on AI transformation, founder authority, modern marketing architecture, and digital economics.
            </p>
          </div>
          <button
            onClick={() => navigate('/insights')}
            className="text-sm font-bold text-[#1877F2] hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <span>Explore All Insights</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Large Featured Article */}
          {featuredArticle && (
            <div
              onClick={() => navigate(`/insights/${featuredArticle.slug}`)}
              className="lg:col-span-7 p-6 sm:p-8 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition-all group cursor-pointer flex flex-col justify-between space-y-6 shadow-sm hover:shadow-lg"
            >
              <div className="space-y-4">
                <div className="aspect-[16/9] w-full rounded-xl overflow-hidden bg-slate-100 relative">
                  <img
                    src={featuredArticle.featuredImage}
                    alt={featuredArticle.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 left-3 px-3 py-1 rounded-md bg-white/95 backdrop-blur-md text-[#1877F2] text-xs font-bold uppercase tracking-wider border border-slate-200 shadow-sm">
                    {featuredArticle.category}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>{featuredArticle.publishedAt}</span>
                  <span>·</span>
                  <span>{featuredArticle.readTime || `${featuredArticle.readingTimeMinutes || 5} min read`}</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 group-hover:text-[#1877F2] transition-colors leading-tight">
                  {featuredArticle.title}
                </h3>
                <p className="text-slate-600 text-sm sm:text-base font-interface leading-relaxed">
                  {featuredArticle.excerpt}
                </p>
              </div>

              <div className="pt-2 flex items-center justify-between text-sm font-bold text-slate-900 border-t border-slate-100">
                <span className="flex items-center gap-1 text-[#FF6B00]">
                  Read Strategic Essay <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
                <span className="text-xs text-slate-500 font-normal">
                  By {typeof featuredArticle.author === 'string' ? featuredArticle.author : featuredArticle.author?.name || 'Digital Muid'}
                </span>
              </div>
            </div>
          )}

          {/* 3 Supporting Article Cards */}
          <div className="lg:col-span-5 space-y-4 flex flex-col justify-between">
            {supportingArticles.map((art) => (
              <div
                key={art.id}
                onClick={() => navigate(`/insights/${art.slug}`)}
                className="p-5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 transition-all group cursor-pointer space-y-2.5 shadow-sm"
              >
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-bold text-[#1877F2] bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                    {art.category}
                  </span>
                  <span>{art.readTime || `${art.readingTimeMinutes || 5} min read`}</span>
                </div>
                <h4 className="text-base font-display font-bold text-slate-900 group-hover:text-[#1877F2] transition-colors line-clamp-2">
                  {art.title}
                </h4>
                <p className="text-xs text-slate-600 font-interface line-clamp-2">
                  {art.excerpt}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 07 — WATCH (Watch Muid) */}
      {/* ========================================================================= */}
      <section id="watch-section" className="bg-white border-y border-slate-200 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="text-xs font-bold uppercase tracking-widest text-purple-600 font-interface flex items-center gap-1.5">
                <Video className="w-4 h-4" /> Video Knowledge & Masterclasses
              </div>
              <h2 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 tracking-tight">
                Watch Muid
              </h2>
              <p className="text-slate-600 text-sm sm:text-base font-interface">
                Tactical breakdowns, framework explanations, and real-time teardowns of modern digital growth engines.
              </p>
            </div>

            {/* Video Category Filter Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {['All', 'Latest', 'AI', 'Marketing', 'Personal Branding'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveVideoCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    activeVideoCategory === cat
                      ? 'bg-purple-600 text-white font-bold shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredVideos.map((vid) => (
              <div
                key={vid.id}
                onClick={() => navigate(`/watch/${vid.slug}`)}
                className="rounded-2xl bg-white border border-slate-200 hover:border-purple-300 transition-all group cursor-pointer overflow-hidden flex flex-col justify-between space-y-4 p-4 shadow-sm hover:shadow-md"
              >
                <div className="space-y-3">
                  <div className="aspect-[16/9] w-full rounded-xl bg-slate-100 relative overflow-hidden">
                    <img
                      src={vid.thumbnail}
                      alt={vid.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center group-hover:bg-black/5 transition-colors">
                      <div className="w-10 h-10 rounded-full bg-white text-[#07111F] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <Play className="w-4 h-4 fill-current ml-0.5 text-purple-600" />
                      </div>
                    </div>
                    <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 text-white text-[10px] font-mono font-bold">
                      {vid.duration}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="text-purple-600 font-bold">{vid.category}</span>
                    <span>{vid.viewsCount} views</span>
                  </div>
                  <h4 className="font-display font-bold text-slate-900 text-sm group-hover:text-purple-600 transition-colors line-clamp-2">
                    {vid.title}
                  </h4>
                </div>

                <div className="text-xs font-bold text-slate-500 group-hover:text-slate-900 flex items-center gap-1 pt-1 border-t border-slate-100">
                  <span>Watch breakdown</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform text-purple-600" />
                </div>
              </div>
            ))}
          </div>

          <div className="text-center pt-4">
            <button
              onClick={() => navigate('/watch')}
              className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold inline-flex items-center gap-2 transition-all cursor-pointer shadow-md"
            >
              <span>Watch More Video Breakdowns</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 08 — EDUCATION (Learn Digital. Build What's Next.) */}
      {/* ========================================================================= */}
      <section id="education-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="text-xs font-bold uppercase tracking-widest text-emerald-600 font-interface">
              Practical Masterclasses & Cohorts
            </div>
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 tracking-tight">
              Learn Digital. Build What's Next.
            </h2>
            <p className="text-slate-600 text-sm sm:text-base font-interface">
              Practical, AI-integrated learning for students, professionals, marketers, and entrepreneurs.
            </p>
          </div>
          <button
            onClick={() => navigate('/learn')}
            className="text-sm font-bold text-emerald-600 hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <span>Explore All Learning</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {courses.map((course) => {
            const isEnrolled = studentEnrollments.some((e) => e.courseId === course.id);
            const isWishlisted = isCourseWishlisted(course.id);

            return (
              <div
                key={course.id}
                onClick={() => navigate(`/learn/${course.slug}`)}
                className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200 hover:border-emerald-500/60 transition-all group cursor-pointer flex flex-col justify-between space-y-6 shadow-sm hover:shadow-lg"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {course.level}
                      </span>
                      {course.aiIntegrated && (
                        <span className="text-xs font-bold px-2.5 py-1 rounded bg-blue-50 text-[#1877F2] border border-blue-200 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5" /> AI-Integrated
                        </span>
                      )}
                    </div>

                    <div className="shrink-0">
                      {isEnrolled ? (
                        <span className="px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider shadow-2xs">
                          Enrolled
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCourseWishlist(course.id);
                          }}
                          className={`p-2 rounded-xl backdrop-blur-md transition-all shadow-2xs cursor-pointer border ${
                            isWishlisted
                              ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100'
                              : 'bg-white/90 border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50/50'
                          }`}
                          title={isWishlisted ? 'Remove from Wishlist' : 'Save to Wishlist'}
                          aria-label={isWishlisted ? 'Remove from Wishlist' : 'Save to Wishlist'}
                        >
                          <Heart
                            className={`w-4 h-4 transition-transform ${
                              isWishlisted ? 'fill-rose-500 text-rose-500 scale-110' : ''
                            }`}
                          />
                        </button>
                      )}
                    </div>
                  </div>

                  <h3 className="text-2xl font-display font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                    {course.title}
                  </h3>
                  <p className="text-slate-600 text-sm font-interface leading-relaxed">
                    {course.shortOutcome}
                  </p>

                  <div className="flex items-center gap-4 text-xs text-slate-500 pt-2 border-t border-slate-100">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {course.duration}
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" /> {course.enrolledCount}+ Students
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Tuition Investment</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-bold text-slate-900 font-mono">₹{course.offerPrice || course.price}</span>
                      {course.offerPrice && (
                        <span className="text-xs text-slate-400 line-through font-mono">₹{course.price}</span>
                      )}
                    </div>
                  </div>
                  <span className="px-4 py-2 rounded-lg bg-slate-900 group-hover:bg-emerald-600 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-sm">
                    <span>Explore Course</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 09 — LEARNING PHILOSOPHY */}
      {/* ========================================================================= */}
      <section id="learning-philosophy" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 sm:p-12 rounded-3xl bg-white border border-slate-200 text-center space-y-8 shadow-sm">
          <div className="space-y-2 max-w-2xl mx-auto">
            <h3 className="text-2xl sm:text-4xl font-display font-bold text-slate-900 tracking-tight">
              Don't Just Learn. Build.
            </h3>
            <p className="text-slate-600 text-sm sm:text-base font-interface">
              Education should not end when the class ends.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 font-display font-bold text-sm sm:text-lg">
            {['Learn', 'Build', 'Launch', 'Measure', 'Improve'].map((step, idx) => (
              <React.Fragment key={step}>
                <div className="px-5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 shadow-sm">
                  {step}
                </div>
                {idx < 4 && <div className="text-[#FF6B00] text-xl font-bold">→</div>}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 10 — FRAMEWORK LIBRARY */}
      {/* ========================================================================= */}
      <section id="framework-library" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-3 max-w-2xl">
            <div className="text-xs font-bold uppercase tracking-widest text-[#FF6B00] font-interface">
              Intellectual Property
            </div>
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 tracking-tight">
              Ideas Become More Powerful When They Become Frameworks.
            </h2>
            <p className="text-slate-600 text-sm sm:text-base font-interface">
              Proprietary models designed to simplify complex market challenges into repeatable, high-leverage execution loops.
            </p>
          </div>
          <button
            onClick={() => navigate('/frameworks')}
            className="text-sm font-bold text-[#FF6B00] hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <span>Explore All Frameworks</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(publishedFrameworks.length > 0 ? publishedFrameworks : INITIAL_FRAMEWORKS).map((fw) => (
            <div
              key={fw.id}
              onClick={() => navigate(`/frameworks/${fw.slug}`)}
              className="p-7 rounded-2xl bg-white border border-slate-200 hover:border-[#FF6B00]/60 transition-all group cursor-pointer flex flex-col justify-between space-y-6 shadow-sm hover:shadow-lg"
            >
              <div className="space-y-4">
                <div className="w-10 h-10 rounded-lg bg-orange-50 border border-orange-100 text-[#FF6B00] flex items-center justify-center font-bold">
                  <Layers className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-display font-bold text-slate-900 group-hover:text-[#FF6B00] transition-colors">
                  {fw.title || fw.name}
                </h3>
                {fw.subtitle && <p className="text-xs font-bold text-slate-700">{fw.subtitle}</p>}
                <p className="text-xs text-slate-600 font-interface leading-relaxed line-clamp-3">
                  {fw.description || fw.introduction}
                </p>
              </div>

              <div className="pt-2 flex items-center gap-1.5 text-xs font-bold text-[#FF6B00] border-t border-slate-100">
                <span>Examine Framework</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 11 — RESOURCE LIBRARY */}
      {/* ========================================================================= */}
      <section id="resource-library" className="bg-white border-y border-slate-200 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-3 max-w-2xl">
              <div className="text-xs font-bold uppercase tracking-widest text-amber-600 font-interface">
                Free Downloads & Toolkits
              </div>
              <h2 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 tracking-tight">
                Useful Things. Free.
              </h2>
              <p className="text-slate-600 text-sm sm:text-base font-interface">
                Battle-tested prompt packs, growth checklists, operating templates, and conversion blueprints.
              </p>
            </div>
            <button
              onClick={() => navigate('/resources')}
              className="text-sm font-bold text-amber-600 hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <span>View All Free Resources</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {publishedResources.map((res) => (
              <div
                key={res.id}
                onClick={() => onOpenResourceModal(res.id)}
                className="p-6 rounded-2xl bg-slate-50 border border-slate-200 hover:border-amber-400 transition-all group cursor-pointer flex flex-col justify-between space-y-4 shadow-sm hover:shadow-md"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                      {res.type}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">{res.downloadCount}+ downloads</span>
                  </div>
                  <h4 className="font-display font-bold text-slate-900 text-base group-hover:text-amber-600 transition-colors line-clamp-2">
                    {res.name}
                  </h4>
                  <p className="text-xs text-slate-600 font-interface line-clamp-3">
                    {res.description}
                  </p>
                </div>

                <button
                  type="button"
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-amber-500 hover:text-slate-950 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Free Asset</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 12 — FOUNDER STORY */}
      {/* ========================================================================= */}
      <section id="founder-story" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 sm:p-12 rounded-3xl bg-white border border-slate-200 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center shadow-md">
          <div className="lg:col-span-7 space-y-6">
            <div className="text-xs font-bold uppercase tracking-widest text-[#1877F2] font-interface">
              Behind Digital Muid
            </div>
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 tracking-tight">
              15+ years of experimenting, building, teaching, and learning in the digital world.
            </h2>
            <p className="text-slate-700 text-sm sm:text-base font-interface leading-relaxed">
              I started in digital when algorithms were simple and social media was nascent. Over the past 15+ years, I have navigated every shift—from early SEO and performance media to high-velocity LLM workflows and AI operations.
            </p>
            <p className="text-slate-600 text-sm font-interface leading-relaxed">
              My core commitment is simple: eliminate snake-oil buzzwords and provide founders, executives, and students with practical, durable frameworks that create authentic enterprise value.
            </p>

            {/* Visual Timeline Sequence */}
            <div className="pt-4 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-700">
              <span className="px-2.5 py-1 rounded bg-slate-100 border border-slate-200 font-semibold">Digital Marketing</span>
              <span className="text-slate-400">↓</span>
              <span className="px-2.5 py-1 rounded bg-slate-100 border border-slate-200 font-semibold">Growth Strategy</span>
              <span className="text-slate-400">↓</span>
              <span className="px-2.5 py-1 rounded bg-slate-100 border border-slate-200 font-semibold">AI & Automation</span>
              <span className="text-slate-400">↓</span>
              <span className="px-2.5 py-1 rounded bg-slate-100 border border-slate-200 font-semibold">Education</span>
              <span className="text-slate-400">↓</span>
              <span className="px-2.5 py-1 rounded bg-blue-50 text-[#1877F2] border border-blue-200 font-bold">
                Transformation
              </span>
            </div>

            <div className="pt-2">
              <button
                onClick={() => navigate('/about')}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold inline-flex items-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <span>Read My Full Story</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 flex justify-center">
            <div className="w-full max-w-sm rounded-2xl overflow-hidden border border-slate-200 shadow-xl relative aspect-[4/5] bg-slate-100">
              <img
                src="https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80"
                alt="Digital Muid in Studio"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#07111F]/80 via-transparent to-transparent"></div>
              <div className="absolute bottom-4 left-4 right-4 p-3 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700 text-xs text-slate-200 text-center font-interface">
                "Real growth is an operating discipline, not an overnight tactic."
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 13 — SOCIAL PROOF */}
      {/* ========================================================================= */}
      <section id="social-proof" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="text-xs font-bold uppercase tracking-widest text-emerald-600 font-interface">
            Verified Track Record
          </div>
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 tracking-tight">
            People I've Had the Opportunity to Work With
          </h2>
          <p className="text-slate-600 text-sm font-interface">
            Authentic perspectives from founders, corporate leaders, students, and institutional collaborators.
          </p>

          {/* Social Proof Category Tabs */}
          <div className="flex items-center justify-center gap-2 pt-4">
            {(['Clients', 'Students', 'Collaborators'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveProofTab(tab)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeProofTab === tab
                    ? 'bg-[#1877F2] text-white shadow-md shadow-[#1877F2]/20'
                    : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredTestimonials.map((t) => (
            <div
              key={t.id}
              className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200 space-y-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="space-y-4">
                {t.metric && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold font-mono">
                    <TrendingUp className="w-3.5 h-3.5" />
                    {t.metric}
                  </div>
                )}
                <p className="text-slate-800 text-sm sm:text-base font-interface leading-relaxed italic">
                  "{t.quote}"
                </p>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                <img
                  src={t.photo}
                  alt={t.name}
                  referrerPolicy="no-referrer"
                  className="w-11 h-11 rounded-full object-cover border border-slate-200"
                />
                <div>
                  <div className="font-display font-bold text-slate-900 text-sm">{t.name}</div>
                  <div className="text-xs text-slate-500 font-interface">
                    {t.role} · <span className="text-slate-700 font-semibold">{t.company}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 14 — SPEAKING */}
      {/* ========================================================================= */}
      <section id="speaking-section" className="bg-white border-y border-slate-200 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-3 max-w-2xl">
              <div className="text-xs font-bold uppercase tracking-widest text-[#FF6B00] font-interface">
                Keynotes & Panels
              </div>
              <h2 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 tracking-tight">
                Ideas Worth Sharing
              </h2>
              <p className="text-slate-600 text-sm sm:text-base font-interface">
                High-impact keynotes and executive masterclasses for conferences, corporate retreats, and industry summits.
              </p>
            </div>
            <button
              onClick={() => navigate('/speaking')}
              className="shrink-0 px-5 py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#e66000] text-white text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer shadow-md"
            >
              <span>Invite Muid to Speak</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {speakingEvents.map((evt) => (
              <div
                key={evt.id}
                className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-4 flex flex-col justify-between shadow-sm"
              >
                <div className="space-y-3">
                  <div className="aspect-[16/9] w-full rounded-xl bg-slate-200 overflow-hidden">
                    <img
                      src={evt.photo}
                      alt={evt.eventName}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-900 font-bold">{evt.type}</span>
                    <span>{evt.date}</span>
                  </div>
                  <h4 className="font-display font-bold text-slate-900 text-base">{evt.title}</h4>
                  <p className="text-xs text-[#1877F2] font-bold">{evt.eventName} · {evt.location}</p>
                  <p className="text-xs text-slate-600 font-interface">{evt.topic}</p>
                </div>

                <div className="text-xs font-mono text-slate-500 pt-2 border-t border-slate-200 font-semibold">
                  Audience: {evt.attendees}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 15 — CONSULTATION CTA */}
      {/* ========================================================================= */}
      <section id="consultation-cta" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 sm:p-14 rounded-3xl bg-gradient-to-r from-slate-900 via-[#10233D] to-slate-900 border border-slate-800 shadow-2xl relative overflow-hidden text-center space-y-8">
          <div className="space-y-3 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF6B00]/15 border border-[#FF6B00]/30 text-[#FF6B00] text-xs font-bold uppercase tracking-wider font-interface">
              <Calendar className="w-3.5 h-3.5" /> High-Intensity 1-on-1 Strategic Session
            </div>
            <h2 className="text-3xl sm:text-5xl font-display font-bold text-white tracking-tight leading-tight">
              Have a Digital Growth Challenge?
            </h2>
            <p className="text-slate-300 text-base sm:text-lg font-interface leading-relaxed font-light">
              Sometimes the fastest way forward is simply having the right conversation. Bring one critical business bottleneck and walk away with absolute strategic clarity.
            </p>
          </div>

          {/* Pricing breakdown pill */}
          <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-sm">
            <span className="text-slate-400">Fixed Rate:</span>
            <span className="font-mono font-bold text-white">₹{consultationProduct.basePrice} + {(consultationProduct.gstRate * 100).toFixed(0)}% GST</span>
            <span className="text-slate-500">|</span>
            <span className="text-[#FF6B00] font-bold font-mono">Total ₹{totalCalculated}</span>
            <span className="text-xs text-slate-400">({consultationProduct.durationMinutes} mins on Google Meet)</span>
          </div>

          <div className="pt-2">
            <button
              id="cta-book-consultation-btn"
              onClick={() => navigate('/business-growth-consultation')}
              className="px-8 py-4 bg-[#FF6B00] hover:bg-[#e66000] text-white font-bold text-xs uppercase tracking-widest shadow-xl shadow-[#FF6B00]/25 transition-all inline-flex items-center gap-2.5 cursor-pointer active:scale-98"
            >
              <Calendar className="w-4 h-4" />
              <span>Book a Consultation Now</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 17 — FINAL CTA (Four Pathways) */}
      {/* ========================================================================= */}
      <section id="final-cta" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-5xl font-display font-bold text-slate-900 tracking-tight leading-tight">
            The Digital World Is Changing.{' '}
            <span className="text-[#1877F2]">Let's Understand What's Next.</span>
          </h2>
          <p className="text-slate-600 text-base font-interface">
            Choose your preferred pathway to engage with the Digital Muid ecosystem.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div
            onClick={() => navigate('/insights')}
            className="p-6 rounded-2xl bg-white border border-slate-200 hover:border-[#1877F2] transition-all group cursor-pointer space-y-4 shadow-sm hover:shadow-md"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1877F2] border border-blue-100 flex items-center justify-center font-bold">
              01
            </div>
            <h3 className="text-xl font-display font-bold text-slate-900 group-hover:text-[#1877F2] transition-colors">
              Read
            </h3>
            <p className="text-xs text-slate-600 font-interface">
              Dive into original strategic essays and growth architecture breakdowns.
            </p>
            <div className="pt-2 flex items-center gap-1 text-xs font-bold text-slate-700 group-hover:text-[#1877F2]">
              <span>Read Insights</span> <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>

          <div
            onClick={() => navigate('/watch')}
            className="p-6 rounded-2xl bg-white border border-slate-200 hover:border-purple-400 transition-all group cursor-pointer space-y-4 shadow-sm hover:shadow-md"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center font-bold">
              02
            </div>
            <h3 className="text-xl font-display font-bold text-slate-900 group-hover:text-purple-600 transition-colors">
              Watch
            </h3>
            <p className="text-xs text-slate-600 font-interface">
              Watch in-depth video tutorials, teardowns, and framework walkthroughs.
            </p>
            <div className="pt-2 flex items-center gap-1 text-xs font-bold text-slate-700 group-hover:text-purple-600">
              <span>Watch Videos</span> <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>

          <div
            onClick={() => navigate('/learn')}
            className="p-6 rounded-2xl bg-white border border-slate-200 hover:border-emerald-500 transition-all group cursor-pointer space-y-4 shadow-sm hover:shadow-md"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center font-bold">
              03
            </div>
            <h3 className="text-xl font-display font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
              Learn
            </h3>
            <p className="text-xs text-slate-600 font-interface">
              Enroll in practical, AI-integrated masterclasses and skill cohorts.
            </p>
            <div className="pt-2 flex items-center gap-1 text-xs font-bold text-slate-700 group-hover:text-emerald-600">
              <span>Explore Courses</span> <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>

          <div
            onClick={() => navigate('/business-growth-consultation')}
            className="p-6 rounded-2xl bg-white border border-slate-200 hover:border-[#FF6B00] transition-all group cursor-pointer space-y-4 shadow-sm hover:shadow-md"
          >
            <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#FF6B00] border border-orange-100 flex items-center justify-center font-bold">
              04
            </div>
            <h3 className="text-xl font-display font-bold text-slate-900 group-hover:text-[#FF6B00] transition-colors">
              Work With Muid
            </h3>
            <p className="text-xs text-slate-600 font-interface">
              Book a paid 1-on-1 strategic consultation or engage for enterprise advisory.
            </p>
            <div className="pt-2 flex items-center gap-1 text-xs font-bold text-[#FF6B00]">
              <span>Book Session</span> <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
