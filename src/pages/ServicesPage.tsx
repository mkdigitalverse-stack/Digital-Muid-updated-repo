import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Bot,
  Megaphone,
  Award,
  Cpu,
  GraduationCap,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Zap,
  Target,
  Layers,
  ArrowUpRight
} from 'lucide-react';

interface ServicesPageProps {
  navigate: (path: string) => void;
  activeServiceSlug?: string;
}

export interface ServiceDetail {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  focusAreas: string[];
  deliverables: string[];
  idealFor: string;
}

export const SERVICES_LIST: ServiceDetail[] = [
  {
    id: 'srv-growth',
    slug: 'growth-strategy',
    title: 'Growth Strategy',
    tagline: 'High-velocity customer acquisition, conversion architecture, and market expansion.',
    description:
      'We audit and restructure your growth mechanics from unit economics to acquisition loops. Moving beyond fragmented tactics to build a defensible, repeatable customer acquisition engine.',
    icon: TrendingUp,
    accentColor: '#FF6B00',
    focusAreas: [
      'CAC-to-LTV Unit Economics & Payback Optimization',
      'Multi-Channel Acquisition & Attribution Modeling',
      'Conversion Rate Optimization (CRO) & Funnel Architecture',
      'Retention Loops & Customer Lifetime Expansion'
    ],
    deliverables: [
      'Comprehensive Growth Engine Diagnostic & Audit',
      'Prioritized 90-Day Execution Roadmap',
      'Custom Acquisition & Retention Architecture Blueprint',
      'Growth KPI & Tracking Dashboard Model'
    ],
    idealFor: 'Founders, Growth Directors, and leadership teams seeking sustainable scale without burning capital.'
  },
  {
    id: 'srv-ai',
    slug: 'ai-automation',
    title: 'AI & Automation',
    tagline: 'Operational AI integration, workflow automation, and custom intelligence pipelines.',
    description:
      'Transform generative AI from curiosity into operational leverage. We implement real-world LLM pipelines, autonomous workflows, and automated systems that multiply team output.',
    icon: Bot,
    accentColor: '#1877F2',
    focusAreas: [
      'Enterprise LLM & Agentic Workflow Architecture',
      'Internal Knowledge Base & Retrieval-Augmented Generation (RAG)',
      'Operational Task Automation & Tool Orchestration',
      'Custom AI Training & Executive Team Enablement'
    ],
    deliverables: [
      'AI Opportunity Map & Feasibility Matrix',
      'Automated Workflow Prototypes & Integrations',
      'Security-First AI Guidelines & Tech Stack Recommendations',
      'Team AI Playbook & Prompt Architecture Templates'
    ],
    idealFor: 'Forward-looking companies and operators seeking genuine productivity multipliers through AI.'
  },
  {
    id: 'srv-marketing',
    slug: 'modern-marketing',
    title: 'Modern Marketing',
    tagline: 'Editorial distribution, high-signal messaging, and full-funnel customer journeys.',
    description:
      'In a world flooded with AI noise, high-signal marketing wins. We construct strategic content architectures, media distribution pipelines, and performance campaigns that build enduring market trust.',
    icon: Megaphone,
    accentColor: '#8B5CF6',
    focusAreas: [
      'High-Signal Content & Editorial Engine Building',
      'Paid Acquisition & Performance Campaign Direction',
      'Narrative Strategy & Product Positioning',
      'Organic Search & Ecosystem Distribution'
    ],
    deliverables: [
      'Modern Marketing Stack & Distribution Blueprint',
      'Campaign Creative Strategy & Messaging Guidelines',
      'Omnichannel Content Multiplication Framework',
      'Measurement & Conversion Performance Framework'
    ],
    idealFor: 'B2B and high-growth brands that need to stand out, command authority, and accelerate inbound demand.'
  },
  {
    id: 'srv-branding',
    slug: 'personal-branding',
    title: 'Personal Branding',
    tagline: 'Founder authority, signature intellectual property codification, and executive positioning.',
    description:
      'Transform deep industry experience into market-commanding intellectual property. We help founders and executives build personal authority that drives commercial pipeline and investor conviction.',
    icon: Award,
    accentColor: '#0EA5E9',
    focusAreas: [
      'Proprietary Intellectual Property (IP) Codification',
      'Signature Framework Design & Naming',
      'Executive Social Presence & Thought Leadership Strategy',
      'Keynote & Speaking Engagement Architecture'
    ],
    deliverables: [
      'Signature Founder IP & Framework System',
      'Executive Positioning & Content Architecture Plan',
      'Media Kit & Speaking Authority Profile',
      'Editorial Publishing Cadence & Pipeline Engine'
    ],
    idealFor: 'CEOs, founders, investors, and senior executives building undeniable category authority.'
  },
  {
    id: 'srv-transformation',
    slug: 'digital-transformation',
    title: 'Digital Transformation',
    tagline: 'Modernizing tech stacks, digital customer touchpoints, and business operations.',
    description:
      'Bridge the gap between traditional operations and modern digital capabilities. We guide the structural transition to cloud infrastructure, agile tooling, and customer-first digital experiences.',
    icon: Cpu,
    accentColor: '#10B981',
    focusAreas: [
      'Legacy Workflow & Digital Stack Assessment',
      'Customer Experience (CX) & Touchpoint Modernization',
      'Cloud Architecture & Tool Consolidation',
      'Digital Culture, Governance & Change Leadership'
    ],
    deliverables: [
      'Digital Transformation Diagnostic & Gap Analysis',
      'Target State Architecture & Technology Selection Matrix',
      'Phased Migration & Implementation Roadmap',
      'Change Management & Executive Alignment Playbook'
    ],
    idealFor: 'Established mid-market enterprises and traditional businesses modernizing for the next decade.'
  },
  {
    id: 'srv-education',
    slug: 'education',
    title: 'Education',
    tagline: 'Executive workshops, cohort programs, and masterclasses for modern operators.',
    description:
      'High-impact learning experiences engineered for ambitious practitioners. Through structured curricula, live cohorts, and practical frameworks, we turn theory into operational mastery.',
    icon: GraduationCap,
    accentColor: '#F59E0B',
    focusAreas: [
      'Live Masterclasses & Executive AI Bootcamps',
      'Corporate Training & Internal Upskilling Cohorts',
      'Self-Paced Strategic Framework Courses',
      'Interactive Case Studies & Real-World Simulations'
    ],
    deliverables: [
      'Structured Video Masterclasses & Framework Workbooks',
      'Interactive Templates, Prompts & SOP Libraries',
      'Private Community Access & Live Q&A Sessions',
      'Verified Digital Muid Course Credentials'
    ],
    idealFor: 'Professionals, marketers, founders, and teams upgrading their strategic digital capabilities.'
  }
];

export const ServicesPage: React.FC<ServicesPageProps> = ({ navigate, activeServiceSlug }) => {
  const [selectedSlug, setSelectedSlug] = useState<string>(activeServiceSlug || 'all');

  useEffect(() => {
    if (activeServiceSlug) {
      setSelectedSlug(activeServiceSlug);
    }
  }, [activeServiceSlug]);

  const activeService = SERVICES_LIST.find((s) => s.slug === selectedSlug);

  return (
    <div id="services-page-root" className="pt-28 sm:pt-32 pb-24 space-y-20">
      {/* ========================================================================= */}
      {/* 1. HERO SECTION */}
      {/* ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 sm:p-14 rounded-3xl bg-gradient-to-br from-[#07111F] via-[#0B1E3B] to-[#07111F] border border-slate-800 text-white shadow-2xl relative overflow-hidden space-y-8">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#1877F2]/15 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#FF6B00]/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10 max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF6B00]/15 border border-[#FF6B00]/30 text-[#FF6B00] text-xs font-bold uppercase tracking-widest font-interface">
              <Sparkles className="w-3.5 h-3.5" /> HOW DIGITAL MUID HELPS
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-display font-bold text-white tracking-tight leading-[1.1]">
              Strategic Services for Digital Growth & Modern Execution
            </h1>

            <p className="text-slate-300 text-base sm:text-lg font-interface leading-relaxed font-light">
              High-intensity advisory, modern marketing architecture, AI integration, and executive education designed to build defensible commercial advantage.
            </p>

            {/* CTA Triple Journey */}
            <div className="pt-4 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3.5">
              <button
                id="services-hero-consultation-btn"
                onClick={() => navigate('/business-growth-consultation')}
                className="px-7 py-4 bg-[#FF6B00] hover:bg-[#e66000] text-white font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-lg shadow-[#FF6B00]/25 active:scale-98"
              >
                <Calendar className="w-4 h-4 text-white" />
                <span>Book a Consultation</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                id="services-hero-learn-btn"
                onClick={() => navigate('/learn')}
                className="px-7 py-4 bg-white hover:bg-slate-100 text-[#07111F] font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-white/5"
              >
                <span>Learn with Digital Muid</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                id="services-hero-contact-btn"
                onClick={() => navigate('/contact')}
                className="px-6 py-4 bg-white/10 hover:bg-white/15 text-white border border-white/20 font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Get in Touch</span>
                <ArrowRight className="w-4 h-4 text-white/70" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. SERVICES NAV TABS / PILLS */}
      {/* ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-none border-b border-slate-200">
          <button
            onClick={() => setSelectedSlug('all')}
            className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-t-xl transition-all cursor-pointer whitespace-nowrap ${
              selectedSlug === 'all'
                ? 'bg-white text-[#FF6B00] border-t-2 border-x border-[#FF6B00] shadow-sm -mb-[1px]'
                : 'text-slate-600 hover:text-slate-900 bg-slate-100/60'
            }`}
          >
            All Services ({SERVICES_LIST.length})
          </button>
          {SERVICES_LIST.map((srv) => (
            <button
              key={srv.slug}
              onClick={() => setSelectedSlug(srv.slug)}
              className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-t-xl transition-all cursor-pointer whitespace-nowrap ${
                selectedSlug === srv.slug
                  ? 'bg-white text-[#1877F2] border-t-2 border-x border-[#1877F2] shadow-sm -mb-[1px]'
                  : 'text-slate-600 hover:text-slate-900 bg-slate-100/60'
              }`}
            >
              {srv.title}
            </button>
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. FOCUSED DETAIL OR FULL GRID VIEW */}
      {/* ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {activeService && selectedSlug !== 'all' ? (
          /* Focused Single Service View */
          <div className="p-8 sm:p-12 rounded-3xl bg-white border border-slate-200 shadow-md space-y-8 animate-in fade-in duration-200">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold shadow-md"
                  style={{ backgroundColor: activeService.accentColor }}
                >
                  <activeService.icon className="w-7 h-7" />
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-500 font-interface">
                    Strategic Service
                  </div>
                  <h2 className="text-2xl sm:text-4xl font-display font-bold text-slate-900">
                    {activeService.title}
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate('/business-growth-consultation')}
                  className="px-6 py-3 bg-[#FF6B00] hover:bg-[#e66000] text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-[#FF6B00]/20"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Book Consultation</span>
                </button>
                <button
                  onClick={() => setSelectedSlug('all')}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer"
                >
                  View All
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-lg font-medium text-slate-800 leading-relaxed font-interface">
                {activeService.tagline}
              </p>
              <p className="text-slate-600 text-sm sm:text-base font-interface leading-relaxed max-w-4xl">
                {activeService.description}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
              {/* Focus Areas */}
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#1877F2]">
                  <Target className="w-4 h-4" /> Core Focus Areas
                </div>
                <ul className="space-y-3 text-sm text-slate-700">
                  {activeService.focusAreas.map((fa, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-[#1877F2] shrink-0 mt-0.5" />
                      <span>{fa}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Key Deliverables */}
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#FF6B00]">
                  <Layers className="w-4 h-4" /> Strategic Deliverables
                </div>
                <ul className="space-y-3 text-sm text-slate-700">
                  {activeService.deliverables.map((del, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-[#FF6B00] shrink-0 mt-0.5" />
                      <span>{del}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-blue-50/70 border border-blue-100 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-[#1877F2] shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm text-slate-700">
                <strong className="text-slate-900 font-semibold">Ideal Fit: </strong>
                {activeService.idealFor}
              </div>
            </div>
          </div>
        ) : (
          /* Full Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {SERVICES_LIST.map((srv) => {
              const Icon = srv.icon;
              return (
                <div
                  key={srv.id}
                  className="p-8 rounded-3xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-lg transition-all flex flex-col justify-between space-y-6 group"
                >
                  <div className="space-y-5">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm"
                      style={{ backgroundColor: srv.accentColor }}
                    >
                      <Icon className="w-6 h-6" />
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-xl font-display font-bold text-slate-900 group-hover:text-[#1877F2] transition-colors">
                        {srv.title}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed">
                        {srv.tagline}
                      </p>
                    </div>

                    <p className="text-sm text-slate-600 font-interface leading-relaxed line-clamp-3">
                      {srv.description}
                    </p>

                    <div className="pt-2 space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Key Capabilities:
                      </div>
                      <ul className="space-y-1.5 text-xs text-slate-700">
                        {srv.focusAreas.slice(0, 3).map((f, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                            <span className="truncate">{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <button
                      onClick={() => setSelectedSlug(srv.slug)}
                      className="text-xs font-bold text-[#1877F2] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>Explore Scope</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => navigate('/business-growth-consultation')}
                      className="text-xs font-bold text-[#FF6B00] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>Consult Muid</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* 4. CLOSING CTA BANNER */}
      {/* ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-[#07111F] via-[#0B1E3B] to-[#07111F] border border-slate-800 text-center space-y-6 shadow-xl text-white">
          <div className="text-xs font-bold uppercase tracking-widest text-[#FF6B00] font-interface">
            Work Directly with Digital Muid
          </div>
          <h2 className="text-2xl sm:text-4xl font-display font-bold text-white tracking-tight">
            Have a Specific Business Challenge to Solve?
          </h2>
          <p className="text-slate-300 text-sm sm:text-base max-w-xl mx-auto font-interface leading-relaxed">
            Reserve a 30-minute 1-on-1 strategic consultation to diagnose your growth funnel, AI architecture, or transformation bottleneck.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <button
              onClick={() => navigate('/business-growth-consultation')}
              className="px-8 py-3.5 rounded-xl bg-[#FF6B00] hover:bg-[#e66000] text-white font-bold text-xs uppercase tracking-widest shadow-xl inline-flex items-center gap-2 cursor-pointer transition-all"
            >
              <Calendar className="w-4 h-4" />
              <span>Book a Consultation</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate('/contact')}
              className="px-8 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-widest border border-white/20 inline-flex items-center gap-2 cursor-pointer transition-all"
            >
              <span>Get in Touch</span>
              <ArrowRight className="w-4 h-4 text-white/70" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
