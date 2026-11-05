import React from 'react';
import aboutPortrait from '../../assets/images/regenerated_image_1788770763227.jpg';
import { Users2, ShieldCheck, UserCheck, Award, CheckCircle2 } from 'lucide-react';

export const AcademyFacultySection: React.FC = () => {
  return (
    <section id="course-faculty" className="py-20 sm:py-28 bg-white text-slate-900 border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Header */}
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#1877F2]">
            <Users2 className="w-3.5 h-3.5 text-[#FF6B00]" />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#1877F2] font-interface">
              INSTRUCTIONAL LEADERSHIP
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-slate-900 tracking-tight">
            Course Faculty
          </h2>
          <p className="text-slate-600 text-base sm:text-lg font-interface leading-relaxed">
            Learn directly from an active growth practitioner and systems architect who designs, audits, and executes
            commercial acquisition infrastructure every day.
          </p>
        </div>

        {/* Prominent Single Faculty Profile */}
        <div className="max-w-4xl mx-auto">
          <div className="rounded-3xl bg-slate-50 border border-slate-200 p-6 sm:p-10 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row gap-8 lg:gap-10 items-center md:items-start">
            {/* Portrait Column */}
            <div className="w-full sm:w-72 md:w-80 shrink-0">
              <div className="aspect-[4/5] w-full rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 relative shadow-sm">
                <img
                  src={aboutPortrait}
                  alt="Digital Muid — Lead Faculty & Founder"
                  className="w-full h-full object-cover object-top"
                />
                <div className="absolute top-3 left-3">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-600/95 text-white text-[11px] font-bold uppercase tracking-wider backdrop-blur-xs shadow-xs">
                    <UserCheck className="w-3.5 h-3.5" /> Verified Instructor
                  </span>
                </div>
              </div>
            </div>

            {/* Content Column */}
            <div className="flex-1 space-y-6 text-left">
              <div className="space-y-2">
                <div className="text-xs font-mono uppercase tracking-widest text-[#1877F2] font-bold">
                  LEAD FACULTY &amp; FOUNDER
                </div>
                <h3 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold text-slate-900 tracking-tight">
                  Digital Muid
                </h3>
                <p className="text-sm sm:text-base font-semibold text-[#FF6B00]">
                  Growth Architecture, Paid Media &amp; AI Systems
                </p>
              </div>

              <p className="text-slate-600 font-interface text-sm sm:text-base leading-relaxed">
                15+ years advising founders, scaling performance media accounts across Meta and Google, and codifying
                autonomous marketing frameworks.
              </p>

              {/* Highlights / Verified Credentials */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-700 bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/80">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>15+ Years Commercial Experience</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-slate-700 bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/80">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Meta &amp; Google Media Specialist</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-slate-700 bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/80">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Engineered Funnels &amp; CAPI Routing</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-slate-700 bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/80">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Autonomous Marketing Frameworks</span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
                <div className="text-xs font-mono text-emerald-700 flex items-center gap-2 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Full Curriculum Lead &amp; Mentor</span>
                </div>
                <div className="text-xs font-mono text-slate-500 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-[#FF6B00]" />
                  <span>Direct 1:1 Review &amp; Audit Oversight</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
