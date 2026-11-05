import React, { useState } from 'react';
import aboutPortrait from '../assets/images/regenerated_image_1788770763227.jpg';
import {
  ArrowRight,
  CheckCircle2,
  Calendar,
  Layers,
  TrendingUp,
  Zap,
  Target,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Globe,
  Compass,
  Cpu
} from 'lucide-react';
import { SEOHead } from '../components/SEOHead';

interface AboutPageProps {
  navigate: (path: string) => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({ navigate }) => {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const domainExpertise = [
    {
      icon: TrendingUp,
      title: 'Performance Marketing & Acquisition',
      desc: 'Scientific Meta Ads management focused strictly on Customer Acquisition Cost (CAC), lead qualification thresholds, and bottom-line profit margins.'
    },
    {
      icon: Cpu,
      title: 'High-Velocity Web Engineering',
      desc: 'Rejecting fragile, slow, plugin-heavy CMS page builders in favor of custom-engineered, clean-code web applications built on modern frameworks (React & Node.js) for sub-second page speed and bulletproof conversion rates.'
    },
    {
      icon: Target,
      title: 'Conversion Architecture',
      desc: 'Designing direct-response funnels that triage, qualify, and educate prospects before they ever get on a call with your sales team.'
    },
    {
      icon: Zap,
      title: 'AI & Operations Automation',
      desc: 'Connecting acquisition channels directly to CRM databases, WhatsApp/SMS routing engines, and automated nurture sequences to eliminate lead leakage.'
    }
  ];

  const diagnosticMethodology = [
    {
      step: '01',
      title: 'Diagnose the Bottleneck',
      desc: 'Uncovering where cash, leads, or conversions are leaking.'
    },
    {
      step: '02',
      title: 'Re-engineer the Positioning',
      desc: 'Clarifying what makes your offer undeniably superior.'
    },
    {
      step: '03',
      title: 'Deploy Infrastructure',
      desc: 'Building custom web assets, tracking architecture, and funnel pipelines.'
    },
    {
      step: '04',
      title: 'Scale with Predictability',
      desc: 'Driving targeted paid traffic into a conversion machine that generates clear, attributable return on investment.'
    }
  ];

  const whyChooseUs = [
    {
      icon: Layers,
      title: 'Strategic & Technical Alignment',
      desc: "Most consultants don't code, and most developers don't understand consumer psychology or media buying. Because I bridge deep commercial strategy with custom React/Node.js web engineering, your messaging, design, and technical speed work as one unified conversion engine."
    },
    {
      icon: TrendingUp,
      title: 'Ruthless Focus on Unit Economics',
      desc: 'Clicks and impressions do not pay payroll. We measure success by pipeline throughput, qualified inquiries, Customer Acquisition Cost (CAC), and customer lifetime value.'
    },
    {
      icon: Cpu,
      title: 'Custom Architecture Over Templates',
      desc: 'We do not build generic WordPress or drag-and-drop sites that get sluggish and vulnerable. We build lightweight, ultra-fast custom code tailored precisely to your customer intake workflow.'
    },
    {
      icon: Zap,
      title: 'Complete Operational Continuity',
      desc: 'From strategic diagnosis to full execution and automated back-end lead triage, your acquisition funnel has no weak links.'
    }
  ];

  const faqs = [
    {
      q: 'What exactly does Digital Muid do, and how is it different from a digital marketing agency?',
      a: 'Digital Muid operates as a growth consultancy and systems architecture partner led directly by Muid Khan, rather than a conventional agency selling disconnected services. Most traditional agencies sell single tactics—running ads without fixing the website, or building a generic website without understanding paid acquisition economics. Digital Muid unifies the entire client acquisition funnel: performance marketing (Meta Ads), custom high-speed web architecture (React / Node.js), and automated lead triage workflows. You get diagnostic strategy, technical engineering, and revenue accountability from a single growth architect.'
    },
    {
      q: 'Why do you build custom-coded websites using React and Node.js instead of CMS platforms like WordPress?',
      a: 'Conversion rates depend heavily on page speed, technical security, and interactive user experience. Off-the-shelf CMS templates and plugin-heavy page builders often suffer from code bloat, slow server response times, and recurring security vulnerabilities. By engineering bespoke web assets in React and Node.js, we deliver sub-second load times, custom patient/client intake triage forms, seamless API integrations with your CRM, and a proprietary look that sets your brand above competitors.'
    },
    {
      q: 'What industries and business stages do you work with?',
      a: 'We primarily partner with established service businesses, healthcare and aesthetic clinics (such as dental and dermatology practices), high-ticket B2B consultants, and direct-to-consumer brands looking to move past inconsistent revenue cycles. Our systems are designed for businesses that already have a proven offer and want an engineered acquisition pipeline to scale lead volume while controlling Customer Acquisition Cost (CAC).'
    },
    {
      q: 'How do Digital Muid, MK Digitalverse Academy, and MK Digitalverse work together?',
      a: (
        <div className="space-y-2">
          <p>They form a unified three-tier ecosystem:</p>
          <ol className="list-decimal list-inside space-y-1.5 pl-1">
            <li><strong>Digital Muid</strong> is the strategic and advisory arm, where Muid Khan works directly on growth diagnostics, positioning, and conversion architecture.</li>
            <li><strong>MK Digitalverse</strong> is our GST-registered full-service technology agency that executes end-to-end development, media management, and enterprise-scale implementations for global clients.</li>
            <li><strong>MK Digitalverse Academy</strong> is our educational division, equipping modern marketers, founders, and professionals with practical, industry-grade skills in systems engineering, funnel mechanics, and performance marketing.</li>
          </ol>
        </div>
      )
    },
    {
      q: 'How does the engagement process work when working with Digital Muid?',
      a: 'Every partnership begins with a Growth Diagnostic Session. Rather than offering one-size-fits-all packages, we review your current funnel, cost per lead, conversion rates, and tech stack to identify exact leakages. Once the diagnostic is complete, we map out a customized system roadmap—combining custom web infrastructure, direct-response ad creative, and CRM workflow automation—to hit measurable revenue targets.'
    }
  ];

  return (
    <div id="about-page-root" className="pt-28 sm:pt-32 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20">
      <SEOHead path="/about" />

      {/* ========================================================================= */}
      {/* HERO SECTION */}
      {/* ========================================================================= */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#1877F2] text-xs font-bold uppercase tracking-wider font-interface">
            THE ARCHITECT BEHIND THE SYSTEM
          </div>
          <h1 className="text-4xl sm:text-6xl font-display font-bold text-slate-900 tracking-tight leading-tight">
            Growth Isn't an Accident.{' '}
            <span className="text-[#FF6B00]">It’s an Engineered Discipline.</span>
          </h1>
          <p className="text-slate-600 text-lg font-interface leading-relaxed">
            I help ambitious business owners, healthcare practices, and brand leaders replace fragmented marketing hacks with predictable, full-funnel acquisition systems, custom web architecture, and automated client intake operations.
          </p>
          <div className="pt-2 flex flex-wrap gap-4">
            <button
              onClick={() => navigate('/contact')}
              className="px-6 py-3.5 rounded-xl bg-[#FF6B00] hover:bg-[#FF7A1A] text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-[#FF6B00]/25 transition-all cursor-pointer"
            >
              <Calendar className="w-4 h-4" />
              <span>Book a Growth Diagnostic Session</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href="#ecosystem"
              className="px-6 py-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-900 font-bold text-sm transition-all shadow-sm cursor-pointer inline-flex items-center gap-2"
            >
              <span>Explore the Ecosystem</span>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </a>
          </div>
        </div>

        <div className="lg:col-span-5 flex justify-center">
          <div className="relative w-full max-w-md aspect-[3/4] rounded-3xl overflow-hidden border border-slate-200 shadow-2xl bg-slate-900">
            <img
              src={aboutPortrait}
              alt="Muid Khan — Digital Muid"
              className="w-full h-full object-cover object-top"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#07111F] via-transparent to-transparent"></div>
            <div className="absolute bottom-6 left-6 right-6 p-4 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-800 text-center">
              <p className="text-xs font-bold text-[#FF6B00] uppercase tracking-wider">The Digital Muid Ethos</p>
              <p className="text-sm font-semibold text-white mt-0.5">&ldquo;Mechanics Over Motivation&rdquo;</p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 1: ABOUT DIGITAL MUID (80% FOCUS) */}
      {/* ========================================================================= */}
      <section className="p-8 sm:p-12 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-12">
        <div className="space-y-4 max-w-3xl">
          <div className="text-xs font-bold uppercase tracking-widest text-[#1877F2] font-interface">
            BACKGROUND & PHILOSOPHY
          </div>
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 tracking-tight">
            I Don’t Sell Marketing Tactics. I Engineer Business Expansion.
          </h2>
        </div>

        {/* Lead Paragraph: The Origin & The Flaw in the Market */}
        <div className="space-y-4 text-slate-700 text-base sm:text-lg font-interface leading-relaxed">
          <p className="font-semibold text-slate-900">
            I am Muid Khan—known professionally as Digital Muid. I am a Performance Growth Strategist, Systems Architect, and Business Consultant.
          </p>
          <p className="text-slate-600">
            My journey began with a fundamental observation about the modern digital landscape: most businesses fail to scale not because they lack a strong service or product, but because their front-end acquisition and back-end technology are completely disconnected. They are sold surface-level tactics—an ad campaign here, a generic template website there—with zero regard for unit economics, pipeline velocity, or operational follow-through.
          </p>
          <p className="text-slate-600">
            Over years of deep, hands-on immersion across diverse verticals—from healthcare clinics and high-ticket service firms to direct-to-consumer and manufacturing enterprises—I have diagnosed and rebuilt fragmented marketing engines from the ground up.
          </p>
        </div>

        {/* Core Body: Technical Breadth Cards */}
        <div className="space-y-4 pt-2">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 font-interface">
            Domain Expertise Across the Commercial Growth Arc
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {domainExpertise.map((domain, idx) => {
              const Icon = domain.icon;
              return (
                <div
                  key={idx}
                  className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 hover:border-slate-300 transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1877F2] flex items-center justify-center border border-blue-100 font-bold">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h4 className="text-lg font-display font-bold text-slate-900">{domain.title}</h4>
                  <p className="text-xs sm:text-sm text-slate-600 font-interface leading-relaxed">{domain.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* The Stance: Mechanics Over Motivation */}
        <div className="space-y-6 pt-4 border-t border-slate-200">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-[#FF6B00] text-xs font-bold uppercase tracking-wider font-interface">
              The Operational Stance
            </div>
            <h3 className="text-2xl sm:text-3xl font-display font-bold text-slate-900">
              Mechanics Over Motivation.
            </h3>
            <p className="text-slate-600 text-sm sm:text-base font-interface leading-relaxed max-w-3xl">
              I do not believe in hype, vanity metrics, or platform loopholes that break with the next algorithm change. My approach is diagnostic, rigorous, and clinical:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {diagnosticMethodology.map((m) => (
              <div key={m.step} className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                <span className="text-xs font-mono font-bold text-[#FF6B00] bg-[#FF6B00]/10 px-2.5 py-1 rounded inline-block">
                  STEP {m.step}
                </span>
                <h4 className="text-base font-display font-bold text-slate-900 mt-2">{m.title}</h4>
                <p className="text-xs text-slate-600 font-interface leading-relaxed">{m.desc}</p>
              </div>
            ))}
          </div>

          <div className="p-5 rounded-2xl bg-blue-50/60 border border-blue-200 text-slate-800 text-sm font-interface leading-relaxed">
            Every project I take on receives my direct, meticulous involvement. When you work with Digital Muid, you don’t get handed off to an inexperienced junior executive; you work with a growth architect who treats your capital and your pipeline with absolute institutional discipline.
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 2: THE ECOSYSTEM (20% NATURAL INTEGRATION) */}
      {/* ========================================================================= */}
      <section id="ecosystem" className="space-y-10 scroll-mt-28">
        <div className="space-y-3 max-w-3xl">
          <div className="text-xs font-bold uppercase tracking-widest text-[#FF6B00] font-interface">
            EXPANDING THE IMPACT
          </div>
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 tracking-tight">
            The Ecosystem: Cultivating Talent & Scaling Global Delivery
          </h2>
          <p className="text-slate-600 text-base font-interface leading-relaxed">
            To build an enduring standard of excellence in the market, my work naturally extends into two focused operational arms:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Card 1: MK Digitalverse Academy */}
          <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-6 flex flex-col justify-between hover:border-slate-300 transition-all">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-orange-50 text-[#FF6B00] flex items-center justify-center border border-orange-100">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-interface">10% Educational Arm</span>
                <h3 className="text-xl sm:text-2xl font-display font-bold text-slate-900">
                  MK Digitalverse Academy — Cultivating Practical Mastery
                </h3>
              </div>
              <p className="text-slate-600 text-sm font-interface leading-relaxed">
                True growth is sustainable only when the people operating the tools understand the mechanics.
              </p>
              <p className="text-slate-600 text-sm font-interface leading-relaxed">
                Through MK Digitalverse Academy, I mentor ambitious marketers, career professionals, and founders. We strip away superficial platform tips to teach real-world systems: full-stack media buying, CRM automation, funnel psychology, and strategic consulting. It is education designed for operational sovereignty—producing operators who understand the <em>why</em> behind every metric.
              </p>
            </div>
            <div className="pt-2">
              <button
                onClick={() => navigate('/academy')}
                className="px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-xs uppercase tracking-wider transition-all inline-flex items-center gap-2 cursor-pointer"
              >
                <span>Explore Academy Programs</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Card 2: MK Digitalverse */}
          <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-6 flex flex-col justify-between hover:border-slate-300 transition-all">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#1877F2] flex items-center justify-center border border-blue-100">
                <Globe className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-interface">10% Global Execution Arm</span>
                <h3 className="text-xl sm:text-2xl font-display font-bold text-slate-900">
                  MK Digitalverse — Global Execution & Digital Infrastructure
                </h3>
              </div>
              <p className="text-slate-600 text-sm font-interface leading-relaxed">
                To support larger enterprises, scaling brands, and international clients, MK Digitalverse serves as our full-service agency and execution engine.
              </p>
              <p className="text-slate-600 text-sm font-interface leading-relaxed">
                Operating globally, MK Digitalverse delivers enterprise-grade full-stack development, multi-platform media execution, and complex system integrations. It is the powerhouse that brings our architectural strategies to life across competitive international markets.
              </p>
            </div>
            <div className="pt-2">
              <button
                onClick={() => navigate('/web')}
                className="px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-xs uppercase tracking-wider transition-all inline-flex items-center gap-2 cursor-pointer"
              >
                <span>View Web & Infrastructure</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 3: VISION & MISSION */}
      {/* ========================================================================= */}
      <section className="space-y-8">
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-widest text-emerald-600 font-interface">
            PURPOSE & DIRECTION
          </div>
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 tracking-tight">
            Vision & Mission
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="p-8 rounded-3xl bg-slate-900 text-white space-y-4 border border-slate-800 shadow-md">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 font-bold">
              <Compass className="w-5 h-5" />
            </div>
            <h3 className="text-2xl font-display font-bold text-white">Our Vision</h3>
            <p className="text-slate-300 text-sm sm:text-base font-interface leading-relaxed">
              To establish a global benchmark where businesses scale through engineered, transparent systems—free from agency guesswork, bloated software, and unpredictable revenue cycles.
            </p>
          </div>

          <div className="p-8 rounded-3xl bg-gradient-to-br from-[#07111F] via-[#0B1E3B] to-[#07111F] text-white space-y-4 border border-slate-800 shadow-md">
            <div className="w-10 h-10 rounded-xl bg-[#1877F2]/15 text-[#1877F2] flex items-center justify-center border border-[#1877F2]/30 font-bold">
              <Target className="w-5 h-5" />
            </div>
            <h3 className="text-2xl font-display font-bold text-white">Our Mission</h3>
            <p className="text-slate-300 text-sm sm:text-base font-interface leading-relaxed">
              To bridge the gap between creative acquisition and technical architecture: delivering custom-coded performance assets that protect margins, maximize pipeline velocity, and empower business owners with total control over their growth.
            </p>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 4: WHY CHOOSE US */}
      {/* ========================================================================= */}
      <section className="space-y-10">
        <div className="space-y-2 max-w-3xl">
          <div className="text-xs font-bold uppercase tracking-widest text-[#1877F2] font-interface">
            THE DISTINCT ADVANTAGE
          </div>
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 tracking-tight">
            Why Founders & Industry Leaders Work With Digital Muid
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {whyChooseUs.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="p-8 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#1877F2] font-bold flex items-center justify-center border border-blue-100">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-display font-bold text-slate-900">{item.title}</h3>
                <p className="text-sm text-slate-600 font-interface leading-relaxed">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 5: FREQUENTLY ASKED QUESTIONS */}
      {/* ========================================================================= */}
      <section className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <div className="text-xs font-bold uppercase tracking-widest text-[#1877F2] font-interface">
            CLARITY & EXECUTION
          </div>
          <h2 className="text-3xl font-display font-bold text-slate-900 tracking-tight">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isExpanded = expandedFaq === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm transition-all"
              >
                <button
                  type="button"
                  onClick={() => setExpandedFaq(isExpanded ? null : idx)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50"
                >
                  <span className="font-display font-bold text-base text-slate-900">{faq.q}</span>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
                  )}
                </button>
                {isExpanded && (
                  <div className="px-5 pb-5 text-sm text-slate-600 font-interface leading-relaxed border-t border-slate-100 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 6: FINAL CALL TO ACTION (CTA) */}
      {/* ========================================================================= */}
      <section className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-slate-900 via-[#0B1E3B] to-slate-900 border border-slate-800 text-center space-y-6 shadow-xl">
        <h2 className="text-2xl sm:text-4xl font-display font-bold text-white tracking-tight">
          Stop Guessing Your Growth. Let’s Build Your System.
        </h2>
        <p className="text-slate-300 text-sm sm:text-base max-w-2xl mx-auto font-interface">
          Whether you are scaling a clinic, an enterprise service firm, or a high-ticket business, your next stage of growth requires engineered infrastructure. Let’s identify your pipeline bottlenecks and map a clear trajectory forward.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <button
            onClick={() => navigate('/contact')}
            className="px-8 py-3.5 rounded-xl bg-[#FF6B00] hover:bg-[#FF7A1A] text-white font-bold text-sm uppercase tracking-wider shadow-xl inline-flex items-center gap-2 cursor-pointer transition-all"
          >
            <Calendar className="w-4 h-4" />
            <span>Book a Growth Diagnostic Session</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate('/academy')}
            className="px-8 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm uppercase tracking-wider border border-white/20 inline-flex items-center gap-2 cursor-pointer transition-all"
          >
            <span>Explore Academy Programs</span>
            <ArrowRight className="w-4 h-4 text-white/70" />
          </button>
        </div>
      </section>
    </div>
  );
};
