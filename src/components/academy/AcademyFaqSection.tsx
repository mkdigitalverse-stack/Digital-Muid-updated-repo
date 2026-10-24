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
      question: 'What courses and curriculums are currently available at DigitalMUID Academy?',
      answer:
        'We offer three core master curriculums: Meta & Google Ads Mastery: Algorithmic Scaling (₹1,999 special admission), SEO with AI Integration: Intent Dominance (₹2,499), and AI & Automation for Modern Business Operations (₹2,199). We also provide two 100% free foundational masterclasses covering the 60-Minute Digital Marketing Blueprint and Freelance Client Acquisition.',
      category: 'Curriculum'
    },
    {
      question: 'Do I need previous marketing experience or technical coding skills to join?',
      answer:
        'No technical coding knowledge is required. Our programs start from first-principles unit economics and buyer psychology before advancing into tool configurations. The Free Foundation masterclasses and SEO curriculum welcome beginners, while the Ads Mastery program is optimized for early-to-intermediate practitioners wanting predictable scale.',
      category: 'Eligibility'
    },
    {
      question: 'How do Online cohorts differ from In-Person Classroom batches?',
      answer:
        'Online training provides live Google Meet cohort sessions, full on-demand recordings in the student portal, downloadable spreadsheets, and weekly virtual Q&A office hours. Offline classroom training is conducted at verified training centres in Srinagar and Bengaluru, offering direct workstation feedback, physical workbooks, and face-to-face mentorship.',
      category: 'Delivery Modes'
    },
    {
      question: 'How are practical projects and case studies conducted?',
      answer:
        'Rather than passive multiple-choice quizzes, every course incorporates scenario-based project work. Students execute simulated technical SEO audits, 30-day authority content schedules, dynamic creative sandboxes, and full-funnel GA4 tracking audits. These assignments compile directly into a client-ready proof-of-work portfolio.',
      category: 'Projects'
    },
    {
      question: 'What is the course duration and weekly time commitment?',
      answer:
        'Our master curriculums typically feature 8 to 12 hours of core structured instruction across 20 to 24 lessons. We recommend allocating 4 to 6 hours per week for 4 weeks to absorb the lectures, execute guided project exercises, and attend live cohort office hours.',
      category: 'Schedule'
    },
    {
      question: 'What are the course fees and payment arrangements?',
      answer:
        'Fees range from ₹1,999 to ₹2,499 under current special admissions pricing (with free foundation modules at ₹0). All payments are processed securely via our encrypted Razorpay gateway, supporting UPI (Google Pay, PhonePe, Paytm), credit/debit cards, and net banking. Standard GST invoices are issued upon enrollment.',
      category: 'Fees'
    },
    {
      question: 'Do students receive a verified Certificate of Completion?',
      answer:
        'Yes. Students who complete all video modules and submit their required project assignments receive an official DigitalMUID Certificate of Completion. Each certificate includes a unique verification credential ID that can be shared on LinkedIn or verified by prospective employers.',
      category: 'Certificates'
    },
    {
      question: 'What career preparation and placement guidance is offered?',
      answer:
        'We offer pragmatic career readiness: portfolio reviews, resume positioning, freelance client acquisition frameworks, and retainer pricing models. In accordance with ethical education principles, we do not make false guarantees of automatic jobs or instant wealth. We train you to possess verifiable competence that wins real interviews and contracts.',
      category: 'Careers'
    },
    {
      question: 'How can I contact the admissions team and enrol in an upcoming cohort?',
      answer:
        'You can enroll directly through any curriculum page on our website or connect with our admissions team on WhatsApp at +91 93358 17155. For institutional and corporate training inquiries, email support@digitalmuid.in.',
      category: 'Enrolment'
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
              TRANSPARENT ADMISSIONS GUIDANCE
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
