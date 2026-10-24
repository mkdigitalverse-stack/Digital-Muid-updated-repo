import React from 'react';
import {
  GraduationCap,
  BookOpen,
  Code2,
  GitBranch,
  Layers,
  Briefcase,
  TrendingUp,
  Headphones,
  CheckCircle2,
  ShieldAlert
} from 'lucide-react';

export const AcademyBenefitsSection: React.FC = () => {
  const benefits = [
    {
      icon: BookOpen,
      title: 'Structured Concept-to-Execution Curriculum',
      description:
        'Progression from core commercial foundations (unit economics, CAC, LTV) through to advanced algorithmic retrieval and AI-integrated execution.',
      color: 'blue'
    },
    {
      icon: Code2,
      title: 'Hands-On Exercises & Guided Project Work',
      description:
        'Every conceptual lesson pairs with a practical exercise—building real campaign sandboxes, writing hook scripts, and assembling conversion funnels.',
      color: 'orange'
    },
    {
      icon: GitBranch,
      title: 'Understanding Real-World Marketing Workflows',
      description:
        'Learn the exact operating cadence used by growth agencies: creative testing protocols, weekly ad pacing, bid adjustments, and performance audits.',
      color: 'emerald'
    },
    {
      icon: Layers,
      title: 'Exposure to Industry Tools & Campaign Planning',
      description:
        'Direct hands-on experience inside Meta Ads Manager, Google Ads, Google Analytics 4, Tag Manager, Search Console, and generative LLM toolchains.',
      color: 'purple'
    },
    {
      icon: Briefcase,
      title: 'Portfolio-Building Opportunities',
      description:
        'Graduate with demonstrable proof-of-work: client-ready SEO audits, live paid media plans, content strategy spreadsheets, and CRO teardowns.',
      color: 'amber'
    },
    {
      icon: TrendingUp,
      title: 'Career Preparation for Jobs, Freelance & Agency Roles',
      description:
        'Learn how to package commercial marketing skills, interview with strategic confidence, and construct client retainers without cold spamming.',
      color: 'blue'
    },
    {
      icon: Headphones,
      title: 'Dedicated Learning Support & Office Hours',
      description:
        'Direct access to bi-weekly strategy Q&A sessions, campaign teardowns, and community troubleshooting throughout your learning journey.',
      color: 'emerald'
    }
  ];

  return (
    <section id="academy-benefits" className="py-20 sm:py-28 bg-slate-50 text-slate-900 border-t border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
        {/* Section Header */}
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#1877F2]">
            <GraduationCap className="w-3.5 h-3.5 text-[#FF6B00]" />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#1877F2] font-interface">
              PRACTICAL TRAINING OUTCOMES
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-slate-900 tracking-tight">
            Benefits of Learning DigitalMUID
          </h2>
          <p className="text-slate-600 text-base sm:text-lg font-interface leading-relaxed">
            Digital marketing education fails when isolated in abstract theory. Through DigitalMUID, powered by the
            operational expertise of <strong className="text-slate-900 font-semibold">MK Digitalverse</strong>, we merge
            structured curriculum training with direct, practical learning on live campaigns and realistic business challenges.
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {benefits.map((b, idx) => {
            const Icon = b.icon;
            return (
              <div
                key={idx}
                className="p-7 rounded-2xl bg-white border border-slate-200/90 hover:border-[#1877F2]/40 hover:shadow-lg transition-all space-y-4 shadow-sm flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 text-[#1877F2] flex items-center justify-center">
                    <Icon className="w-6 h-6 text-[#1877F2]" />
                  </div>
                  <h3 className="text-lg font-display font-bold text-slate-900 leading-snug">
                    {b.title}
                  </h3>
                  <p className="text-xs text-slate-600 font-interface leading-relaxed">
                    {b.description}
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-100 flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Integrated in all academy programs</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Ethics & Realistic Guidance Callout */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 text-slate-700 text-xs sm:text-sm font-interface flex flex-col sm:flex-row items-start sm:items-center gap-4 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="font-bold text-slate-900 text-sm">
              Our Commitment to Honest Education
            </div>
            <p className="text-slate-600 text-xs leading-relaxed">
              We provide structured training, real-world frameworks, and practitioner mentorship. We do not make
              unsupported promises of guaranteed jobs, guaranteed placements, or instant wealth. Professional and commercial
              success depends on individual effort, consistent skill application, and market demand.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
