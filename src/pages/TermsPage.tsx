import React, { useEffect, useState } from 'react';
import { 
  FileText, 
  ShieldCheck, 
  Scale, 
  Clock, 
  Mail, 
  Calendar, 
  GraduationCap, 
  Globe, 
  Laptop, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight, 
  ExternalLink,
  ChevronRight,
  BookOpen,
  Lock,
  Printer
} from 'lucide-react';

interface TermsPageProps {
  navigate: (path: string) => void;
}

export const TermsPage: React.FC<TermsPageProps> = ({ navigate }) => {
  const [activeSection, setActiveSection] = useState<string>('intro');

  useEffect(() => {
    const originalTitle = document.title;
    document.title = 'Terms & Conditions — DigitalMUID';

    let metaDesc = document.querySelector('meta[name="description"]');
    const originalDesc = metaDesc ? metaDesc.getAttribute('content') : '';
    if (metaDesc) {
      metaDesc.setAttribute(
        'content',
        'Terms & Conditions and Terms of Service governing website usage, educational courses, private consultations, and web development services at DigitalMUID.'
      );
    }

    window.scrollTo({ top: 0, behavior: 'instant' });

    return () => {
      document.title = originalTitle;
      if (metaDesc && originalDesc) {
        metaDesc.setAttribute('content', originalDesc);
      }
    };
  }, []);

  const lastUpdated = 'October 2026';

  const sections = [
    { id: 'business-info', title: '1. Responsible Entity & Contact' },
    { id: 'acceptance', title: '2. Scope & Acceptance of Terms' },
    { id: 'website-use', title: '3. Website Access & Permitted Use' },
    { id: 'accounts', title: '4. Accounts & User Responsibilities' },
    { id: 'courses', title: '5. Educational Courses & Digital Access' },
    { id: 'consultations', title: '6. Private Strategy Consultations' },
    { id: 'web-services', title: '7. Custom Web & Digital Services' },
    { id: 'payments', title: '8. Pricing, Taxes & Payments' },
    { id: 'cancellations-refunds', title: '9. Cancellations & Refund Policies' },
    { id: 'intellectual-property', title: '10. Intellectual Property & Licenses' },
    { id: 'third-party', title: '11. Third-Party Platforms & Tools' },
    { id: 'liability', title: '12. Professional Disclaimers & Liability' },
    { id: 'changes', title: '13. Changes to These Terms' },
    { id: 'governing-law', title: '14. Governing Law & Owner Approval Items' },
  ];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div id="terms-page-root" className="pt-28 sm:pt-32 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
      {/* Hero Header */}
      <div className="relative rounded-3xl bg-gradient-to-br from-[#07111F] via-[#0B1E3B] to-[#07111F] border border-slate-800 text-white p-8 sm:p-12 overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#1877F2]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#FF6B00]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-mono font-bold uppercase tracking-wider text-[#FF6B00]">
            <Scale className="w-3.5 h-3.5" /> Legal Agreement & Policies
          </div>
          <h1 className="text-3xl sm:text-5xl font-display font-bold text-white tracking-tight">
            Terms & Conditions
          </h1>
          <p className="text-slate-300 text-sm sm:text-base font-interface leading-relaxed">
            These Terms & Conditions constitute a legally binding agreement between you and DigitalMUID. Please review these provisions carefully before using our website, enrolling in training courses, booking private advisory consultations, or engaging our digital services.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-slate-400 font-interface">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-300" />
              Effective Date: {lastUpdated}
            </span>
            <span className="text-slate-600">•</span>
            <span className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-[#1877F2]" />
              digitalmuid.in
            </span>
            <button
              onClick={handlePrint}
              className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors cursor-pointer"
              title="Print Terms & Conditions"
            >
              <Printer className="w-3.5 h-3.5" /> Print Summary
            </button>
          </div>
        </div>
      </div>

      {/* Owner Approval Notice Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 flex items-start gap-3.5 text-xs sm:text-sm font-interface">
        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-amber-800">
            Notice Regarding Pending Entity & Regulatory Specifications
          </p>
          <p className="text-amber-900/80 leading-relaxed text-xs">
            To maintain strict factual accuracy and avoid inventing legal representations, specific statutory disclosures (such as registered corporate entity name, formal CIN/GSTIN registry numbers, and explicit territorial court jurisdictions) are marked with <span className="font-mono font-bold text-amber-800">[Requires Owner Approval: ...]</span> pending formal corporate filing documentation.
          </p>
        </div>
      </div>

      {/* Main Content Layout with Sticky Navigation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Table of Contents Sticky Sidebar */}
        <div className="hidden lg:block lg:col-span-4 sticky top-28 space-y-4">
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4 font-interface">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
              <BookOpen className="w-4 h-4 text-[#1877F2]" /> Table of Contents
            </div>
            <nav className="space-y-1 text-xs">
              {sections.map((sec) => (
                <a
                  key={sec.id}
                  href={`#${sec.id}`}
                  onClick={() => setActiveSection(sec.id)}
                  className={`block px-3 py-2 rounded-lg transition-colors leading-snug ${
                    activeSection === sec.id
                      ? 'bg-blue-50 text-[#1877F2] font-semibold border-l-2 border-[#1877F2]'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {sec.title}
                </a>
              ))}
            </nav>
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <p className="text-[11px] text-slate-500">Need specific clarification?</p>
              <button
                onClick={() => navigate('/contact')}
                className="w-full py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5 text-[#1877F2]" /> Contact Legal Inquiries
              </button>
            </div>
          </div>
        </div>

        {/* Legal Text Body */}
        <div className="lg:col-span-8 space-y-10 text-slate-700 font-interface leading-relaxed">
          
          {/* Section 1 */}
          <section id="business-info" className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4 scroll-mt-28">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#1877F2] font-mono">
              <Globe className="w-4 h-4" /> Section 1
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900">
              1. Responsible Business Entity & Contact Information
            </h2>
            <div className="space-y-3 text-sm">
              <p>
                This website (<strong>digitalmuid.in</strong>) and its associated platforms, subdomains, courses, and digital assets are managed and operated by <strong>DigitalMUID</strong> ("Digital Muid", "we", "us", or "our").
              </p>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">Platform Brand:</span>
                  <span>Digital Muid / DigitalMUID</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">Official Website:</span>
                  <span>https://digitalmuid.in</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">Official Executive Contact:</span>
                  <span>support@digitalmuid.in / mkdigitalverse@gmail.com</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">Operational Hub:</span>
                  <span>Bengaluru / Mumbai, India (Global Remote Advisory)</span>
                </div>
                <div className="flex items-start gap-2 pt-1 border-t border-slate-200 text-amber-800 font-mono">
                  <span className="font-semibold shrink-0">Corporate Registration:</span>
                  <span>[Requires Owner Approval: Registered Legal Entity Name, CIN/LLPIN/GSTIN, and Registered Corporate Address]</span>
                </div>
              </div>
            </div>
          </section>

          {/* Section 2 */}
          <section id="acceptance" className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4 scroll-mt-28">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#1877F2] font-mono">
              <CheckCircle2 className="w-4 h-4" /> Section 2
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900">
              2. Scope & Acceptance of Terms
            </h2>
            <div className="space-y-3 text-sm">
              <p>
                By accessing, browsing, or utilizing this website, or by creating an account, enrolling in any training course, booking an advisory consultation, or submitting an enquiry for web services, you acknowledge that you have read, understood, and agreed to be bound by these Terms & Conditions.
              </p>
              <p>
                If you are entering into this agreement on behalf of a company, partnership, or other legal entity, you represent and warrant that you possess the authority to bind such entity to these terms. If you do not agree to all terms herein, you must immediately discontinue use of the website and services.
              </p>
            </div>
          </section>

          {/* Section 3 */}
          <section id="website-use" className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4 scroll-mt-28">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#1877F2] font-mono">
              <Globe className="w-4 h-4" /> Section 3
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900">
              3. Website Access & Permitted Use
            </h2>
            <div className="space-y-3 text-sm">
              <p>
                We grant you a non-exclusive, non-transferable, revocable limited license to access and use the public areas of DigitalMUID strictly for legitimate informational, educational, and business evaluation purposes.
              </p>
              <p className="font-semibold text-slate-900">Prohibited Conduct:</p>
              <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-slate-600">
                <li>Attempting to probe, scan, or breach any security vulnerability or firewall of the site.</li>
                <li>Engaging in automated scraping, data extraction, bot indexing, or reverse engineering of site code or intellectual property.</li>
                <li>Submitting fraudulent, malicious, deceptive, or defamatory inquiries or reviews.</li>
                <li>Impersonating Digital Muid, team members, or any other individual or corporate entity.</li>
              </ul>
            </div>
          </section>

          {/* Section 4 */}
          <section id="accounts" className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4 scroll-mt-28">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#1877F2] font-mono">
              <Lock className="w-4 h-4" /> Section 4
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900">
              4. Account Registration & User Responsibilities
            </h2>
            <div className="space-y-3 text-sm">
              <p>
                When creating an account to access learning dashboards, enrolled courses, certificate registries, or consultation management:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-slate-600">
                <li>You must provide accurate, current, and complete registration information.</li>
                <li>You are solely responsible for maintaining the confidentiality of your login credentials and password.</li>
                <li>Each course registration is strictly single-user. Account sharing, credential distribution, or concurrent multi-user viewing is explicitly prohibited and constitutes cause for immediate termination of access without refund.</li>
                <li>You must notify us immediately at <code>contact@digitalmuid.com</code> if you suspect unauthorized access to your account.</li>
              </ul>
            </div>
          </section>

          {/* Section 5 */}
          <section id="courses" className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4 scroll-mt-28">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600 font-mono">
              <GraduationCap className="w-4 h-4" /> Section 5
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900">
              5. Educational Courses & Digital Training Masterclasses
            </h2>
            <div className="space-y-3 text-sm">
              <p>
                DigitalMUID provides specialized, self-paced masterclasses and digital education (such as the <em>Complete Meta Ads Mastery Masterclass</em> and <em>AI Automation in Business Operations</em>).
              </p>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs sm:text-sm">
                <p><strong>License Grant:</strong> Enrollment purchases a personal, non-exclusive, non-transferable license to access streamable lesson videos, downloadable templates, and curriculum assessments for your personal professional development.</p>
                <p><strong>Strict Anti-Piracy Policy:</strong> Recording, screen-capturing, downloading video streams through third-party tools, republishing, reselling, or incorporating our curriculum into external courses or corporate libraries without express written agreement is strictly prohibited and subject to legal enforcement under intellectual property laws.</p>
                <p><strong>Completion Certificates:</strong> Certificates of completion are issued in accordance with course completion metrics and may be verified on our official verification portal (<code>/verify-certificate</code>). DigitalMUID reserves the right to revoke any certificate obtained through fraudulent or automated means.</p>
              </div>
            </div>
          </section>

          {/* Section 6 */}
          <section id="consultations" className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4 scroll-mt-28">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#FF6B00] font-mono">
              <Calendar className="w-4 h-4" /> Section 6
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900">
              6. Private 1-on-1 Strategy Consultations
            </h2>
            <div className="space-y-3 text-sm">
              <p>
                Paid 1-on-1 strategy consultations are standalone, high-leverage advisory sessions conducted personally by Digital Muid to analyze your business bottlenecks, marketing architecture, or AI roadmap.
              </p>
              <div className="space-y-2 text-xs sm:text-sm">
                <p><strong>Session Mechanics:</strong> Sessions are 30 minutes in duration and conducted via private video conference (Google Meet). Up to three key business stakeholders (e.g. co-founders or departmental leads) may participate on the same call.</p>
                <p><strong>Intake Requirement:</strong> Clients must complete the intake diagnostic questionnaire prior to the call so strategic time is focused on actionable solutions rather than basic background discovery.</p>
                <p><strong>Strict Confidentiality:</strong> All proprietary business metrics, growth data, customer lists, and strategic roadmaps shared during the session are held under strict professional confidentiality.</p>
                <p><strong>Rescheduling Policy:</strong> Consultations may be rescheduled with at least <strong>24 hours advance notice</strong> prior to the booked time slot via the link in your confirmation email. Because calendar availability is strictly reserved, missed appointments or cancellations with less than 24 hours notice cannot be refunded.</p>
              </div>
            </div>
          </section>

          {/* Section 7 */}
          <section id="web-services" className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4 scroll-mt-28">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#1877F2] font-mono">
              <Laptop className="w-4 h-4" /> Section 7
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900">
              7. Custom Web Design & Development Services
            </h2>
            <div className="space-y-3 text-sm">
              <p>
                Custom website design, engineering, and digital growth services (as detailed on <code>/web</code>) are delivered on a bespoke, proposal-backed basis.
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-slate-600">
                <li>Specific deliverables, timelines, milestone payments, and acceptance criteria are defined in individual Statements of Work (SOW) or written client proposals.</li>
                <li>Client must furnish necessary assets (copy, high-resolution media, domain and hosting access credentials) in a timely manner.</li>
                <li>Final deployment and transfer of bespoke code assets occur upon receipt of full milestone payments as stipulated in the project agreement.</li>
              </ul>
            </div>
          </section>

          {/* Section 8 */}
          <section id="payments" className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4 scroll-mt-28">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
              <Scale className="w-4 h-4" /> Section 8
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900">
              8. Pricing, Taxes & Payment Processing
            </h2>
            <div className="space-y-3 text-sm">
              <p>
                All prices quoted across the platform are in <strong>Indian Rupees (INR)</strong> unless explicitly designated in another currency on international checkout invoices.
              </p>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs sm:text-sm">
                <p><strong>Goods & Services Tax (GST):</strong> Applicable GST (typically 18%) is calculated and transparently itemized at checkout in compliance with statutory tax schedules.</p>
                <p><strong>Payment Gateways:</strong> Digital transactions are processed securely via verified third-party payment gateways (including Razorpay). DigitalMUID does not store your full payment card details or net banking credentials on our servers.</p>
                <p><strong>Invoices & Receipts:</strong> Automated digital invoices and receipts are generated upon successful payment verification and can be accessed within your user account or received via email.</p>
              </div>
            </div>
          </section>

          {/* Section 9 */}
          <section id="cancellations-refunds" className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4 scroll-mt-28">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-600 font-mono">
              <AlertCircle className="w-4 h-4" /> Section 9
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900">
              9. Cancellations & Refund Policies
            </h2>
            <div className="space-y-4 text-sm">
              <p>
                Because DigitalMUID offers distinct services (digital courseware vs. live time-reserved advisory vs. agency development), specific refund terms apply to each category:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <h3 className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4 text-emerald-600" /> Course Purchases
                  </h3>
                  <p className="text-xs text-slate-600">
                    Courses include immediate digital onboarding. While marketing materials describe a 100% Satisfaction Guarantee, formal refund requests are subject to verification:
                  </p>
                  <p className="text-[11px] font-mono text-amber-800 bg-amber-50 p-2 rounded border border-amber-200">
                    [Requires Owner Approval: Specific Course Refund Policy Window, e.g. 7-day refund window provided less than 25% of course lessons have been accessed/completed]
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <h3 className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-[#FF6B00]" /> Strategy Consultations
                  </h3>
                  <p className="text-xs text-slate-600">
                    Full flexibility to reschedule with at least <strong>24 hours notice</strong>. Due to dedicated preparation and reserved advisory time slots, no-shows or cancellations within 24 hours of the scheduled call are non-refundable.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
                <p><strong>Custom Web Services:</strong> Retainers and milestone deposits for custom software and design projects are non-refundable once work commences, as outlined in individual service contracts.</p>
              </div>
            </div>
          </section>

          {/* Section 10 */}
          <section id="intellectual-property" className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4 scroll-mt-28">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#1877F2] font-mono">
              <ShieldCheck className="w-4 h-4" /> Section 10
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900">
              10. Intellectual Property Rights & Frameworks
            </h2>
            <div className="space-y-3 text-sm">
              <p>
                All content published on this website—including proprietary growth frameworks, mental models, curriculum architectures, written articles, case studies, videos, downloadable blueprints, graphic assets, trademarks, and codebases—is the exclusive intellectual property of <strong>Digital Muid</strong> and protected by Indian and international copyright and trademark laws.
              </p>
              <p>
                You may not copy, reproduce, mirror, republish, distribute, sell, or create derivative works from any part of our intellectual property without prior explicit written permission from DigitalMUID.
              </p>
            </div>
          </section>

          {/* Section 11 */}
          <section id="third-party" className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4 scroll-mt-28">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
              <ExternalLink className="w-4 h-4" /> Section 11
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900">
              11. Third-Party Platforms, APIs & External Tools
            </h2>
            <div className="space-y-3 text-sm">
              <p>
                Our services and courses train users and clients on third-party technologies and ad platforms (e.g., Meta/Facebook Ads, Google Ads, LinkedIn, Zapier, Make, OpenAI, Anthropic, Razorpay).
              </p>
              <p className="text-xs sm:text-sm text-slate-600">
                DigitalMUID is an independent advisory and educational provider. We are not affiliated with, endorsed by, or sponsored by Meta Platforms, Google, or any third-party company. We have no control over, and accept no liability for, changes in third-party advertising policies, account suspension decisions, algorithm modifications, or pricing changes enacted by third-party platforms.
              </p>
            </div>
          </section>

          {/* Section 12 */}
          <section id="liability" className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4 scroll-mt-28">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-600 font-mono">
              <AlertCircle className="w-4 h-4" /> Section 12
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900">
              12. Professional Disclaimers & Limitation of Liability
            </h2>
            <div className="space-y-3 text-sm">
              <p>
                <strong>Educational & Advisory Nature:</strong> All consultations, courses, strategic frameworks, and materials are provided for educational and advisory purposes only. While our strategies reflect verified methodologies, DigitalMUID makes no warranty or guarantee regarding specific financial gains, return on ad spend (ROAS), or business outcomes, which depend upon client execution, market competition, budget, and business variables.
              </p>
              <p>
                <strong>Limitation of Damages:</strong> To the maximum extent permitted by applicable law, DigitalMUID and its directors, contractors, or affiliates shall not be liable for any indirect, incidental, special, punitive, or consequential damages (including loss of profits, data, goodwill, or business interruption) arising from your use of the website, courses, or advisory.
              </p>
              <p>
                <strong>Aggregate Liability Cap:</strong> In any event, DigitalMUID's total cumulative liability arising out of any claim shall not exceed the total amount actually paid by you to DigitalMUID for the specific product or service giving rise to the claim in the twelve (12) months preceding the incident.
              </p>
            </div>
          </section>

          {/* Section 13 */}
          <section id="changes" className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4 scroll-mt-28">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
              <Clock className="w-4 h-4" /> Section 13
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900">
              13. Modifications to These Terms
            </h2>
            <div className="space-y-3 text-sm">
              <p>
                We reserve the right to revise, amend, or update these Terms & Conditions at our discretion to reflect evolving business offerings, technological features, or statutory legal requirements.
              </p>
              <p>
                Any changes will be posted directly to this page with the updated "Effective Date" at the top. Continued use of the website or services following the posting of revised terms indicates your acceptance of the revisions.
              </p>
            </div>
          </section>

          {/* Section 14 */}
          <section id="governing-law" className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4 scroll-mt-28">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-700 font-mono">
              <Scale className="w-4 h-4" /> Section 14
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900">
              14. Governing Law & Unresolved Policy Items
            </h2>
            <div className="space-y-4 text-sm">
              <p>
                These terms shall be governed by and construed in accordance with the laws of the Republic of India.
              </p>

              <div className="p-5 rounded-xl bg-amber-50 border border-amber-200 space-y-3 text-xs">
                <h3 className="font-bold text-amber-900 text-sm flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  Owner Verification & Policy Approvals Required
                </h3>
                <p className="text-amber-800">
                  The following legal specifications are pending official confirmation by the DigitalMUID management and will be formalized upon review:
                </p>
                <ol className="list-decimal pl-5 space-y-1 text-amber-900/90 font-mono">
                  <li><strong>Registered Legal Entity:</strong> [Requires Owner Approval: Formal registered entity name, e.g. Digital Muid Technologies Private Limited / Sole Proprietorship / LLP]</li>
                  <li><strong>Statutory Registration Numbers:</strong> [Requires Owner Approval: Official GSTIN, PAN, or MSME registration number]</li>
                  <li><strong>Jurisdiction & Venue:</strong> [Requires Owner Approval: Exact designated city / court jurisdiction, e.g. Bengaluru, Karnataka or Mumbai, Maharashtra]</li>
                  <li><strong>Explicit Course Refund Window:</strong> [Requires Owner Approval: Formal course return window policy e.g. 7 calendar days with prerequisite progress cap]</li>
                </ol>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 text-white">
                <div className="space-y-0.5 text-xs text-center sm:text-left">
                  <p className="font-bold text-white">Have questions about these terms?</p>
                  <p className="text-slate-400">Our team is available to assist with legal and partnership inquiries.</p>
                </div>
                <button
                  onClick={() => navigate('/contact')}
                  className="px-4 py-2.5 rounded-xl bg-[#1877F2] hover:bg-blue-600 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Contact Executive Office</span>
                </button>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
};
