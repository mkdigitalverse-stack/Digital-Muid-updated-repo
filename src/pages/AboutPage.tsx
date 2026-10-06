import React from 'react';
import aboutPortrait from '../assets/images/regenerated_image_1788770763227.jpg';
import { ArrowRight, CheckCircle2, Award, Compass, Brain, TrendingUp, Calendar } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface AboutPageProps {
  navigate: (path: string) => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({ navigate }) => {
  const { consultationProduct } = useApp();
  const totalCalculated = consultationProduct?.basePrice
    ? (consultationProduct.basePrice * (1 + (consultationProduct.gstRate || 0))).toFixed(0)
    : '2999';

  const careerMilestones = [
    {
      year: '2011–2015',
      title: 'Digital Marketing & Performance Media Genesis',
      description: 'Pioneered early paid traffic, conversion funnels, and organic search optimization across fast-growing e-commerce ventures and startups.'
    },
    {
      year: '2016–2019',
      title: 'Growth Strategy & Enterprise Advisory',
      description: 'Transitioned to strategic consulting, designing comprehensive growth models for mid-market healthcare, SaaS, and retail businesses.'
    },
    {
      year: '2020–2023',
      title: 'Digital Education & Framework Codification',
      description: 'Founded executive cohorts and educational programs, training 3,000+ professionals in actionable digital and marketing architectures.'
    },
    {
      year: '2024–Present',
      title: 'AI Transformation & Digital Muid Ecosystem',
      description: 'Architecting intelligent autonomous business workflows, authoring signature intellectual property frameworks, and advising high-growth founders globally.'
    }
  ];

  const operatingPrinciples = [
    {
      number: '01',
      title: 'Clarity Before Amplification',
      desc: 'Never spend a single rupee amplifying a confusing message. Strategic positioning and product-market resonance must always precede aggressive advertising.'
    },
    {
      number: '02',
      title: 'Intellectual Property Moats',
      desc: 'Tactics decay; frameworks compound. The greatest founders codify their judgment into proprietary mental models that establish undeniable authority.'
    },
    {
      number: '03',
      title: 'Humanity Inside AI Workflows',
      desc: 'Artificial intelligence provides infinite operational speed, but authentic human trust, nuance, and high-stakes judgment remain the ultimate currency.'
    },
    {
      number: '04',
      title: 'Unified Systems Over Siloed Hacks',
      desc: 'True growth is an integrated operating discipline connecting marketing, tech, CRM, customer journey, and operations into a single continuous feedback loop.'
    }
  ];

  return (
    <div id="about-page-root" className="pt-28 sm:pt-32 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20">
      {/* Hero Intro */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#1877F2] text-xs font-bold uppercase tracking-wider font-interface">
            Founder · Strategist · Educator
          </div>
          <h1 className="text-4xl sm:text-6xl font-display font-bold text-slate-900 tracking-tight leading-tight">
            I help people understand the digital world—and{' '}
            <span className="text-[#FF6B00]">turn knowledge into growth.</span>
          </h1>
          <p className="text-slate-600 text-lg font-interface leading-relaxed">
            For over 15 years, I have lived at the frontier of digital transformation. I have seen tactics rise and die, algorithms morph, and business models shift. Through it all, one truth has remained constant: the companies that master both strategy and systems win.
          </p>
          <div className="pt-2 flex flex-wrap gap-4">
            <button
              onClick={() => navigate('/business-growth-consultation')}
              className="px-6 py-3.5 rounded-xl bg-[#FF6B00] hover:bg-[#FF7A1A] text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-[#FF6B00]/25 transition-all cursor-pointer"
            >
              <Calendar className="w-4 h-4" />
              <span>Book a Consultation (₹{totalCalculated})</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate('/frameworks')}
              className="px-6 py-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-900 font-bold text-sm transition-all shadow-sm cursor-pointer"
            >
              Explore My Frameworks
            </button>
          </div>
        </div>

        <div className="lg:col-span-5 flex justify-center">
          <div className="relative w-full max-w-md aspect-[3/4] rounded-3xl overflow-hidden border border-slate-200 shadow-2xl bg-slate-900">
            <img
              src={aboutPortrait}
              alt="Digital Muid"
              className="w-full h-full object-cover object-top"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#07111F] via-transparent to-transparent"></div>
            <div className="absolute bottom-6 left-6 right-6 p-4 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-800 text-center">
              <p className="text-xs font-bold text-[#FF6B00] uppercase tracking-wider">The Digital Muid Ethos</p>
              <p className="text-sm font-semibold text-white mt-0.5">"Pragmatic Implementation Over Empty Theory"</p>
            </div>
          </div>
        </div>
      </div>

      {/* 15+ Year Evolution Timeline */}
      <div className="p-8 sm:p-12 rounded-3xl bg-white border border-slate-200 space-y-10 shadow-sm">
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-widest text-[#1877F2]">Journey & Track Record</div>
          <h2 className="text-3xl font-display font-bold text-slate-900">15+ Years of Evolution</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {careerMilestones.map((m, idx) => (
            <div key={idx} className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <span className="text-xs font-mono font-bold text-[#FF6B00] bg-[#FF6B00]/10 px-2.5 py-1 rounded">
                {m.year}
              </span>
              <h3 className="text-base font-display font-bold text-slate-900 mt-2">{m.title}</h3>
              <p className="text-xs text-slate-600 font-interface leading-relaxed">{m.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Core Operating Principles */}
      <div className="space-y-8">
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-widest text-[#FF6B00]">Philosophy in Practice</div>
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-slate-900">Core Operating Principles</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {operatingPrinciples.map((p) => (
            <div key={p.number} className="p-8 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1877F2] font-mono font-bold flex items-center justify-center text-sm border border-blue-100">
                {p.number}
              </div>
              <h3 className="text-xl font-display font-bold text-slate-900">{p.title}</h3>
              <p className="text-sm text-slate-600 font-interface leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Consultation Banner */}
      <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-slate-900 via-[#0B1E3B] to-slate-900 border border-slate-800 text-center space-y-6 shadow-xl">
        <h3 className="text-2xl sm:text-3xl font-display font-bold text-white">
          Ready to Work Directly with Digital Muid?
        </h3>
        <p className="text-slate-300 text-sm sm:text-base max-w-xl mx-auto">
          Whether you need high-intensity strategic clarity on your digital growth stack, AI workflow transformation, or founder authority positioning.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <button
            onClick={() => navigate('/business-growth-consultation')}
            className="px-8 py-3.5 rounded-xl bg-[#FF6B00] hover:bg-[#FF7A1A] text-white font-bold text-base shadow-xl inline-flex items-center gap-2 cursor-pointer transition-all"
          >
            <Calendar className="w-4 h-4" />
            <span>Book a Consultation</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate('/contact')}
            className="px-8 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-base border border-white/20 inline-flex items-center gap-2 cursor-pointer transition-all"
          >
            <span>Get in Touch</span>
            <ArrowRight className="w-4 h-4 text-white/70" />
          </button>
        </div>
      </div>
    </div>
  );
};
