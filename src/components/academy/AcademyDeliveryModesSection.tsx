import React from 'react';
import {
  MonitorPlay,
  MapPin,
  CheckCircle2,
  Calendar,
  MessageSquare,
  ArrowRight,
  Sparkles,
  ShieldCheck
} from 'lucide-react';

interface AcademyDeliveryModesSectionProps {
  navigate: (path: string) => void;
}

export const AcademyDeliveryModesSection: React.FC<AcademyDeliveryModesSectionProps> = ({ navigate }) => {
  const handleEnquire = (mode: 'online' | 'offline') => {
    const text =
      mode === 'online'
        ? 'Hello DigitalMUID, I would like to enquire about your Online Digital Marketing training batches.'
        : 'Hello DigitalMUID, I would like to enquire about your In-Person Classroom training batches in Srinagar/Bengaluru.';
    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/919335817155?text=${encoded}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <section id="training-delivery-modes" className="py-20 sm:py-28 bg-white text-slate-900 border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
        {/* Header */}
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#1877F2]">
            <MonitorPlay className="w-3.5 h-3.5 text-[#FF6B00]" />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#1877F2] font-interface">
              FLEXIBLE LEARNING FORMATS
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-slate-900 tracking-tight">
            Training Delivery Modes
          </h2>
          <p className="text-slate-600 text-base sm:text-lg font-interface leading-relaxed">
            Choose the learning environment that suits your operational schedule. Both formats provide identical
            systems-level frameworks, practical exercises, and practitioner guidance.
          </p>
        </div>

        {/* 2 Mode Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Mode 1: Online Training */}
          <div className="p-8 sm:p-10 rounded-3xl bg-slate-50 border border-slate-200/90 hover:border-[#1877F2]/40 hover:shadow-xl transition-all flex flex-col justify-between space-y-8">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-[#1877F2] flex items-center justify-center">
                  <MonitorPlay className="w-6 h-6 text-[#1877F2]" />
                </div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-blue-700 bg-blue-100/60 border border-blue-200 px-3 py-1 rounded-full">
                  Global Remote Access
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-display font-bold text-slate-900">
                  Online Training Format
                </h3>
                <p className="text-sm text-slate-600 font-interface leading-relaxed">
                  Interactive live webinars combined with on-demand module recordings and downloadable operational assets.
                  Learn at your own pace while maintaining weekly cohort accountability.
                </p>
              </div>

              <div className="space-y-3 pt-2 border-t border-slate-200 text-xs sm:text-sm text-slate-700">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Live Interactive Video:</strong> Cohort sessions conducted via Google Meet with real-time screen sharing and ad manager walkthroughs.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Learning Materials:</strong> Companion Notion workspaces, downloadable CAC calculation spreadsheets, and system prompt packs.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Ongoing Mentorship:</strong> Bi-weekly strategy Q&amp;A sessions and ad account teardowns directly with Digital Muid.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Lifetime Updates:</strong> Automatic quarterly curriculum updates whenever Meta or Google algorithms shift.
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 space-y-3">
              <button
                type="button"
                onClick={() => handleEnquire('online')}
                className="w-full py-4 rounded-xl bg-[#1877F2] hover:bg-blue-600 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-blue-500/20"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Enquire About Online Batch Schedule</span>
              </button>
              <div className="text-center text-[11px] text-slate-500 font-mono">
                Flexible evening and weekend batch options available
              </div>
            </div>
          </div>

          {/* Mode 2: Offline / Classroom Training */}
          <div className="p-8 sm:p-10 rounded-3xl bg-slate-50 border border-slate-200/90 hover:border-emerald-500/40 hover:shadow-xl transition-all flex flex-col justify-between space-y-8">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-emerald-600" />
                </div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100/60 border border-emerald-200 px-3 py-1 rounded-full">
                  Srinagar &amp; Bengaluru
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-display font-bold text-slate-900">
                  In-Person Classroom Training
                </h3>
                <p className="text-sm text-slate-600 font-interface leading-relaxed">
                  Immersive classroom workshops held in dedicated physical training centres. Ideal for students and teams
                  who thrive with face-to-face mentorship and collaborative workstation exercises.
                </p>
              </div>

              <div className="space-y-3 pt-2 border-t border-slate-200 text-xs sm:text-sm text-slate-700">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Physical Classroom Batches:</strong> Workstation setup with live instructor guidance and supervised campaign assembly.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Verified Centre Locations:</strong> Training batches conducted in Srinagar (J&amp;K) and Bengaluru (Karnataka), India.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Printed Workbooks:</strong> Physical system binders, campaign diagnostic checklists, and direct peer collaboration.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Dedicated Review Hours:</strong> Personal 1-on-1 portfolio and resume feedback sessions before cohort graduation.
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 space-y-3">
              <button
                type="button"
                onClick={() => handleEnquire('offline')}
                className="w-full py-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <Calendar className="w-4 h-4" />
                <span>Enquire About In-Person Classroom Seats</span>
              </button>
              <div className="text-center text-[11px] text-slate-500 font-mono">
                Exact centre addresses &amp; seat limits confirmed upon application
              </div>
            </div>
          </div>
        </div>

        {/* Factual Integrity Notice */}
        <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-600 font-interface flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#1877F2] shrink-0" />
          <span>
            <strong>Location &amp; Schedule Transparency:</strong> We only publish verified delivery locations. Specific
            classroom schedules, classroom capacities, and calendar batch dates are provided directly to applicants upon
            enquiry to prevent false vacancy commitments.
          </span>
        </div>
      </div>
    </section>
  );
};
