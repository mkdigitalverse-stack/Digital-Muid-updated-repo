import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, Sparkles, MessageSquare } from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
  category?: string;
}

export const AcademyFaqSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs: FaqItem[] = [
    {
      question: 'What makes MK Digitalverse Academy different from other digital marketing institutes?',
      answer:
        'Most institutes offer generic, syllabus-driven training that focuses on theoretical concepts and basic tool usage. MK Digitalverse Academy focuses strictly on full-funnel system engineering: advanced Meta Ads media buying, automated CRM and WhatsApp lead routing, conversion architecture, and client acquisition economics. You learn how to drive measurable revenue rather than chasing vanity impressions.',
      category: 'Curriculum'
    },
    {
      question: 'Do I need prior coding or technical experience to enroll?',
      answer:
        'No prior software engineering experience is required. While we teach you the architectural principles behind custom-coded systems (like React and Node.js) and why they outperform bloated CMS builders, the primary training focuses on funnel strategy, media buying mechanics, CRM integrations, and no-code automation logic that anyone with computer literacy can master.',
      category: 'Prerequisites'
    },
    {
      question: 'Is the curriculum pre-recorded or live mentorship?',
      answer:
        'The academy combines structured, high-definition system breakdown modules with live implementation clinics, weekly campaign teardowns, and direct portfolio audits led by Muid Khan. This ensures you receive direct feedback on your actual campaigns, funnels, and client pitches.',
      category: 'Delivery'
    },
    {
      question: 'Will this program help me get clients or a high-paying job?',
      answer:
        'Yes. We dedicate an entire core pillar to commercial monetization. You will learn how to conduct diagnostic client audits, pitch high-ticket retainers, and use cold video outreach frameworks. You will graduate with a verified portfolio of real campaign architectures and funnels that demonstrate tangible authority to prospective employers or private clients.',
      category: 'Outcomes'
    },
    {
      question: 'How does MK Digitalverse Academy connect with Digital Muid and MK Digitalverse?',
      answer:
        'MK Digitalverse Academy is the talent and educational division of our three-part ecosystem: Digital Muid provides private growth advisory and strategy, MK Digitalverse provides global agency execution, and the Academy trains the next generation of sovereign digital growth operators.',
      category: 'Ecosystem'
    }
  ];

  const toggleFaq = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="academy-faqs" className="py-20 sm:py-28 bg-slate-50 text-slate-900 border-b border-slate-200/80">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#1877F2]">
            <HelpCircle className="w-3.5 h-3.5 text-[#FF6B00]" />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#1877F2] font-interface">
              TRANSPARENT ANSWERS
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-slate-900 tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-slate-600 text-sm sm:text-base font-interface max-w-2xl mx-auto">
            Everything you need to know about our curriculums, delivery formats, practical projects, and enrollment.
          </p>
        </div>

        {/* Accordions */}
        <div className="space-y-4" role="region" aria-label="Frequently Asked Questions Accordions">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            const buttonId = `faq-btn-${idx}`;
            const panelId = `faq-panel-${idx}`;

            return (
              <div
                key={idx}
                className="rounded-2xl bg-white border border-slate-200/90 shadow-2xs overflow-hidden transition-all"
              >
                <button
                  id={buttonId}
                  type="button"
                  onClick={() => toggleFaq(idx)}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  className="w-full p-6 text-left flex items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors cursor-pointer"
                >
                  <span className="font-display font-bold text-slate-900 text-base sm:text-lg leading-snug">
                    {faq.question}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                    {isOpen ? <ChevronUp className="w-4 h-4 text-[#1877F2]" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {isOpen && (
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    className="px-6 pb-6 pt-1 text-slate-600 text-xs sm:text-sm font-interface leading-relaxed border-t border-slate-100"
                  >
                    <p>{faq.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Still have questions banner */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm text-center sm:text-left">
          <div>
            <h4 className="font-display font-bold text-slate-900 text-base">
              Have a specific question about your learning pathway?
            </h4>
            <p className="text-xs text-slate-500 font-interface">
              Chat directly with our academic advisory team on WhatsApp or send an enquiry.
            </p>
          </div>
          <a
            href="https://wa.me/919335817155?text=Hello%20DigitalMUID%2C%20I%20have%20a%20question%20about%20enrolling%20in%20the%20Academy."
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shrink-0 shadow-sm"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Chat on WhatsApp</span>
          </a>
        </div>
      </div>
    </section>
  );
};
