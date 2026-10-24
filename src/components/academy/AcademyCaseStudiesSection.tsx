import React from 'react';
import {
  FolderKanban,
  Search,
  Share2,
  PieChart,
  BarChart3,
  Wrench,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export const AcademyCaseStudiesSection: React.FC = () => {
  const caseStudies = [
    {
      id: 'cs-seo',
      category: 'SEO Audit & Keyword Research',
      badge: 'Sample Training Project 01',
      title: 'Technical E-Commerce SEO Audit & Topical Mapping',
      icon: Search,
      image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80',
      imageAlt: 'Sample project visual of SEO audit dashboard with technical crawl diagnostics and topical entity keyword map',
      challenge:
        'A multi-category direct-to-consumer store with 400+ product pages is suffering from index bloat, internal keyword cannibalization, and declining organic visibility.',
      activities: [
        'Simulate crawl extraction to detect 404 loops and redirect chains.',
        'Cluster search queries into navigational, commercial, and transactional intent groups.',
        'Generate JSON-LD Product & Breadcrumb schemas with proper entity mapping.',
        'Draft an engineering-ready technical recommendation brief.'
      ],
      tools: 'Google Search Console, Screaming Frog principles, Gemini/Claude for entity clustering, Schema.org',
      outcome:
        'A comprehensive, 12-page technical audit report prioritized by business impact that can be handed directly to a dev team.',
      accent: 'emerald'
    },
    {
      id: 'cs-social',
      category: 'Social Media Content Planning',
      badge: 'Sample Training Project 02',
      title: '30-Day Omnichannel Authority Content Architecture',
      icon: Share2,
      image: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&w=800&q=80',
      imageAlt: 'Sample project visual of multi-platform social media calendar layout, carousel slides, and hook scripts',
      challenge:
        'A B2B consultancy relies entirely on inconsistent referral traffic and lacks a predictable mechanism to generate inbound executive enquiries via LinkedIn and YouTube.',
      activities: [
        'Deconstruct founder domain expertise into three distinct core content pillars.',
        'Write 12 high-retention direct response video hook scripts and visual carousel slides.',
        'Configure a modular Notion / spreadsheet content engine for 2-hour/week execution.',
        'Implement conversion CTA frameworks that drive visitors toward diagnostic audits.'
      ],
      tools: 'Notion Editorial Database, Figma / Canva layout blueprints, Direct-Response Copywriting Formulas',
      outcome:
        'A complete 30-day editorial schedule with pre-written scripts, design guidelines, and lead-routing mechanics.',
      accent: 'blue'
    },
    {
      id: 'cs-ads',
      category: 'Digital Advertising Campaign Planning',
      badge: 'Sample Training Project 03',
      title: 'Advantage+ & Google Search Budget Allocation Model',
      icon: PieChart,
      image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80',
      imageAlt: 'Sample project visual of digital advertising campaign architecture, testing sandboxes, and budget allocation',
      challenge:
        'A growth business with a ₹75,000 monthly ad budget is burning cash due to unscientific broad targeting, zero creative testing sandboxes, and broken attribution.',
      activities: [
        'Calculate unit economics: Contribution Margin, blended break-even CAC, and payback periods.',
        'Build a 3:1 creative testing sandbox inside Meta Ads Manager with dynamic variation sets.',
        'Draft exact campaign naming taxonomy, negative keyword lists, and daily pacing rules.',
        'Set up first-party CAPI telemetry verification checklist.'
      ],
      tools: 'Meta Ads Manager sandbox blueprints, Google Ads Keyword Planner, Financial CAC Spreadsheet',
      outcome:
        'A complete, investor-grade campaign media plan specifying exact budget allocation, creative cadence, and kill-switches.',
      accent: 'orange'
    },
    {
      id: 'cs-cro',
      category: 'Website Analytics & Conversion Optimisation',
      badge: 'Sample Training Project 04',
      title: 'Full-Funnel GA4 Tracking & Landing Page Friction Audit',
      icon: BarChart3,
      image: 'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?auto=format&fit=crop&w=800&q=80',
      imageAlt: 'Sample project visual of Google Analytics 4 conversion funnel, checkout drop-off telemetry, and speed metrics',
      challenge:
        'A SaaS lead-generation page receives 5,000 monthly clicks from paid search, but only converts at 1.2% with 82% of users abandoning at the pricing/booking step.',
      activities: [
        'Audit Google Analytics 4 event schemas and Google Tag Manager trigger fires.',
        'Perform a heuristic UX teardown across mobile viewport sizes (sub-800ms DOM rendering).',
        'Map out scroll-depth, form abandonment, and friction vectors.',
        'Produce an A/B testing hypothesis matrix prioritizing high-leverage UI fixes.'
      ],
      tools: 'Google Analytics 4 (GA4), Google Tag Manager (GTM) dataLayer, Lighthouse / PageSpeed Insights',
      outcome:
        'A detailed conversion rate optimization (CRO) teardown report outlining 5 immediate friction fixes with projected impact.',
      accent: 'purple'
    }
  ];

  return (
    <section id="practical-training-approach" className="py-20 sm:py-28 bg-slate-50 text-slate-900 border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
        {/* Header */}
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
            <FolderKanban className="w-3.5 h-3.5 text-[#FF6B00]" />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-800 font-interface">
              PRACTICAL TRAINING APPROACH
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-slate-900 tracking-tight">
            Project Case Studies
          </h2>
          <p className="text-slate-600 text-base sm:text-lg font-interface leading-relaxed">
            Practical capability is forged by solving real business problems, not by memorizing menus. Every Academy student
            completes structured, scenario-based project case studies covering end-to-end digital marketing mechanics.
          </p>
        </div>

        {/* 4 Case Study Cards with Illustrative Visuals */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {caseStudies.map((cs) => {
            const Icon = cs.icon;
            return (
              <div
                key={cs.id}
                className="p-8 rounded-3xl bg-white border border-slate-200/90 shadow-sm hover:shadow-xl hover:border-[#1877F2]/40 transition-all flex flex-col justify-between space-y-6"
              >
                <div className="space-y-5">
                  {/* Visual Banner */}
                  <div className="aspect-[16/9] w-full rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 relative group">
                    <img
                      src={cs.image}
                      alt={cs.imageAlt}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                    <div className="absolute top-3 left-3 flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-white bg-black/70 backdrop-blur-xs px-2.5 py-1 rounded-md border border-white/10">
                        {cs.badge}
                      </span>
                      <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950/80 backdrop-blur-xs px-2 py-0.5 rounded border border-emerald-500/30">
                        Sample Project Visual
                      </span>
                    </div>
                  </div>

                  {/* Category & Title */}
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-[#1877F2]">
                      {cs.category}
                    </span>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-[#1877F2] flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5 text-[#1877F2]" />
                      </div>
                      <h3 className="text-xl font-display font-bold text-slate-900 leading-snug">
                        {cs.title}
                      </h3>
                    </div>
                  </div>

                  {/* Challenge */}
                  <div className="space-y-1.5 p-4 rounded-xl bg-slate-50 border border-slate-200/70 text-xs text-slate-700 font-interface">
                    <span className="font-bold text-slate-900 uppercase tracking-wider text-[10px] block text-red-600">
                      The Challenge Scenario:
                    </span>
                    <p className="leading-relaxed">{cs.challenge}</p>
                  </div>

                  {/* Activities */}
                  <div className="space-y-2">
                    <span className="font-bold text-slate-900 uppercase tracking-wider text-[10px] block text-slate-500">
                      Learning Activities Practiced:
                    </span>
                    <ul className="space-y-1.5 text-xs text-slate-700">
                      {cs.activities.map((act, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{act}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Tools */}
                  <div className="space-y-1 text-xs text-slate-600 pt-1">
                    <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1.5">
                      <Wrench className="w-3.5 h-3.5 text-slate-500" /> Tools &amp; Methods Used:
                    </span>
                    <p className="text-[11px] text-slate-500 font-mono">{cs.tools}</p>
                  </div>
                </div>

                {/* Outcome */}
                <div className="pt-4 border-t border-slate-100 space-y-1">
                  <span className="font-bold text-emerald-800 text-[10px] uppercase tracking-wider block">
                    Expected Learning Outcome:
                  </span>
                  <p className="text-xs text-slate-700 font-interface font-medium">
                    {cs.outcome}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Clear Disclaimer */}
        <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-600 font-interface flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Illustrative Project Scope:</strong> These projects represent hands-on student training simulations
            designed for structured skill building. Screenshots and graphics are illustrative training visuals and are not
            presented as evidence of completed third-party client work.
          </span>
        </div>
      </div>
    </section>
  );
};
