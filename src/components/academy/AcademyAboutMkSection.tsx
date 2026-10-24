import React from 'react';
import { Building2, ExternalLink, ShieldCheck, Cpu, Target, Compass, Edit3 } from 'lucide-react';

export const AcademyAboutMkSection: React.FC = () => {
  return (
    <section id="about-mk-digitalverse" className="py-20 sm:py-28 bg-[#07111F] text-white border-t border-b border-slate-800 relative overflow-hidden">
      {/* Background radial glow */}
      <div
        className="absolute bottom-0 right-0 w-[500px] h-[300px] bg-[#1877F2]/10 blur-[140px] rounded-full pointer-events-none -z-10"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
        {/* Header */}
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10">
            <Building2 className="w-3.5 h-3.5 text-[#FF6B00]" />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FF6B00] font-interface">
              INSTITUTIONAL FOUNDATION
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-white tracking-tight">
            About MK Digitalverse
          </h2>
          <p className="text-slate-300 text-base sm:text-lg font-interface leading-relaxed">
            The operational engine behind <strong className="text-white font-semibold">DigitalMUID Academy</strong>.
            Understanding how our agency practice directly powers and validates our educational curriculum.
          </p>
        </div>

        {/* 2-Column Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-7 space-y-6 text-slate-300 font-interface leading-relaxed text-sm sm:text-base">
            <p>
              <strong className="text-white font-semibold">MK Digitalverse</strong> is the parent digital growth and
              technology agency founded by Digital Muid. The organisation provides digital marketing architectures, web
              system development, conversion optimization, and AI automation solutions for growing businesses, healthcare
              practices, and mid-market enterprises.
            </p>
            <p>
              <strong className="text-white font-semibold">DigitalMUID Academy</strong> was established as MK Digitalverse's
              dedicated educational division. Rather than teaching outdated textbook theories, the Academy acts as a direct
              knowledge-transfer pipeline: every framework, SOP, prompt, and campaign testing methodology taught in the classroom
              is first deployed and refined across active client engagements at MK Digitalverse.
            </p>

            {/* 3 Pillars */}
            <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                <Target className="w-5 h-5 text-[#FF6B00]" />
                <h4 className="text-sm font-bold text-white font-display">Agency Rigour</h4>
                <p className="text-xs text-slate-400">
                  Curriculums grounded in verified commercial practice rather than academic abstraction.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                <Cpu className="w-5 h-5 text-[#60A5FA]" />
                <h4 className="text-sm font-bold text-white font-display">Systems Orientation</h4>
                <p className="text-xs text-slate-400">
                  Emphasising full-funnel architectures, clean tracking, and scalable automation workflows.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                <Compass className="w-5 h-5 text-emerald-400" />
                <h4 className="text-sm font-bold text-white font-display">Ethical Clarity</h4>
                <p className="text-xs text-slate-400">
                  Realistic expectations, honest capabilities, and sustainable growth without deception.
                </p>
              </div>
            </div>
          </div>

          {/* Right Card: Institutional Verification & Admin Notice */}
          <div className="lg:col-span-5 space-y-5">
            <div className="p-7 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-5 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <span className="font-display font-bold text-white text-base">Verified Organisation Overview</span>
                </div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Active
                </span>
              </div>

              <div className="space-y-3 text-xs text-slate-300 font-interface">
                <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                  <span className="text-slate-400">Entity Name:</span>
                  <span className="text-white font-semibold">MK Digitalverse</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                  <span className="text-slate-400">Educational Division:</span>
                  <span className="text-white font-semibold">DigitalMUID Academy</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                  <span className="text-slate-400">Primary Centres:</span>
                  <span className="text-white font-semibold">Srinagar &amp; Bengaluru, India</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                  <span className="text-slate-400">Official Contact:</span>
                  <span className="text-white font-semibold">+91 93358 17155</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Parent Agency Site:</span>
                  <a
                    href="https://mkdigitalverse.in"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#60A5FA] hover:underline flex items-center gap-1 font-semibold"
                  >
                    <span>mkdigitalverse.in</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Administrator-editable disclosure placeholder */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                  <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Administrator Notice</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed font-interface">
                  Corporate registry details, formal accreditations, and partner institution updates are configurable via the
                  administrative control panel to preserve strict factual accuracy.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
