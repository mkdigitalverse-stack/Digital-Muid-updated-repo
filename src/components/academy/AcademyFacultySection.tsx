import React from 'react';
import aboutPortrait from '../../assets/images/regenerated_image_1788770763227.jpg';
import { Users2, ShieldCheck, UserCheck, UserPlus, Info } from 'lucide-react';

export const AcademyFacultySection: React.FC = () => {
  return (
    <section id="course-faculty" className="py-20 sm:py-28 bg-white text-slate-900 border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
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
            Learn from verified practitioners who design, audit, and execute live digital systems every day.
            We maintain strict transparency: real instructors are clearly identified, and upcoming faculty slots remain
            visible as pending administrative submission.
          </p>
        </div>

        {/* 4 Faculty Profiles Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Slot 1: Digital Muid (Verified Lead Faculty) */}
          <div className="rounded-3xl bg-slate-50 border border-slate-200 hover:border-[#1877F2]/50 hover:shadow-lg transition-all p-6 flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div className="aspect-[4/5] w-full rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 relative">
                <img
                  src={aboutPortrait}
                  alt="Digital Muid — Lead Instructor & Founder"
                  className="w-full h-full object-cover object-top"
                />
                <div className="absolute top-3 left-3">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600/90 text-white text-[10px] font-bold uppercase tracking-wider backdrop-blur-xs">
                    <UserCheck className="w-3 h-3" /> Verified Instructor
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-[11px] font-mono uppercase tracking-wider text-[#1877F2] font-bold">
                  Lead Faculty &amp; Founder
                </div>
                <h3 className="text-xl font-display font-bold text-slate-900">
                  Digital Muid
                </h3>
                <p className="text-xs font-semibold text-slate-700">
                  Growth Architecture, Paid Media &amp; AI Systems
                </p>
              </div>

              <p className="text-xs text-slate-600 font-interface leading-relaxed">
                15+ years advising founders, scaling performance media accounts across Meta and Google, and codifying
                autonomous marketing frameworks.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-200 text-[11px] font-mono text-emerald-700 flex items-center gap-1.5 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Full Curriculum Lead</span>
            </div>
          </div>

          {/* Slot 2: Placeholder (SEO & Content Architecture) */}
          <div className="rounded-3xl bg-slate-50/60 border border-dashed border-slate-300 p-6 flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div className="aspect-[4/5] w-full rounded-2xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center text-slate-400 p-6 text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center">
                  <UserPlus className="w-6 h-6" />
                </div>
                <span className="text-xs font-mono font-medium text-slate-500 uppercase tracking-wider">
                  Slot 02 Profile Crop
                </span>
                <span className="text-[10px] text-slate-400">
                  (Portrait 4:5 / Square 1:1)
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-bold">
                  Faculty Slot 02 · Admin Editable
                </div>
                <h3 className="text-xl font-display font-bold text-slate-700">
                  Senior SEO Specialist
                </h3>
                <p className="text-xs font-semibold text-slate-600">
                  Technical SEO, Topical Clusters &amp; GEO
                </p>
              </div>

              <p className="text-xs text-slate-500 font-interface leading-relaxed italic">
                Instructor profile and photo pending administrative verification. Profile will be published once formal
                onboarding is finalized.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-200 text-[11px] font-mono text-slate-500 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              <span>Pending Admin Profile</span>
            </div>
          </div>

          {/* Slot 3: Placeholder (Social Media Strategy) */}
          <div className="rounded-3xl bg-slate-50/60 border border-dashed border-slate-300 p-6 flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div className="aspect-[4/5] w-full rounded-2xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center text-slate-400 p-6 text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center">
                  <UserPlus className="w-6 h-6" />
                </div>
                <span className="text-xs font-mono font-medium text-slate-500 uppercase tracking-wider">
                  Slot 03 Profile Crop
                </span>
                <span className="text-[10px] text-slate-400">
                  (Portrait 4:5 / Square 1:1)
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-bold">
                  Faculty Slot 03 · Admin Editable
                </div>
                <h3 className="text-xl font-display font-bold text-slate-700">
                  Creative Strategy Lead
                </h3>
                <p className="text-xs font-semibold text-slate-600">
                  Performance Social Media &amp; Hook Architecture
                </p>
              </div>

              <p className="text-xs text-slate-500 font-interface leading-relaxed italic">
                Instructor profile and photo pending administrative verification. Profile will be published once formal
                onboarding is finalized.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-200 text-[11px] font-mono text-slate-500 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              <span>Pending Admin Profile</span>
            </div>
          </div>

          {/* Slot 4: Placeholder (Analytics & Conversion) */}
          <div className="rounded-3xl bg-slate-50/60 border border-dashed border-slate-300 p-6 flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div className="aspect-[4/5] w-full rounded-2xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center text-slate-400 p-6 text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center">
                  <UserPlus className="w-6 h-6" />
                </div>
                <span className="text-xs font-mono font-medium text-slate-500 uppercase tracking-wider">
                  Slot 04 Profile Crop
                </span>
                <span className="text-[10px] text-slate-400">
                  (Portrait 4:5 / Square 1:1)
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-bold">
                  Faculty Slot 04 · Admin Editable
                </div>
                <h3 className="text-xl font-display font-bold text-slate-700">
                  Analytics &amp; CRO Engineer
                </h3>
                <p className="text-xs font-semibold text-slate-600">
                  GA4 Telemetry, Tag Manager &amp; Conversion Rates
                </p>
              </div>

              <p className="text-xs text-slate-500 font-interface leading-relaxed italic">
                Instructor profile and photo pending administrative verification. Profile will be published once formal
                onboarding is finalized.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-200 text-[11px] font-mono text-slate-500 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              <span>Pending Admin Profile</span>
            </div>
          </div>
        </div>

        {/* Informational Callout */}
        <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-600 font-interface flex items-center gap-2">
          <Info className="w-4 h-4 text-[#1877F2] shrink-0" />
          <span>
            Faculty slots 2 through 4 represent scheduled co-instructor seats for upcoming cohort programs. Only verified
            practitioners with verified professional track records are listed.
          </span>
        </div>
      </div>
    </section>
  );
};
