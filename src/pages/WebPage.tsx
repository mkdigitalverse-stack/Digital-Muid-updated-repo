import React, { useState, useEffect, useRef } from 'react';
import {
  Globe,
  Monitor,
  Smartphone,
  RefreshCw,
  ShoppingBag,
  FileText,
  UserCheck,
  Code2,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Zap,
  Search,
  Layout,
  MousePointerClick,
  Sparkles,
  HelpCircle,
  Building2,
  Rocket,
  Briefcase,
  ChevronRight,
  Send,
  MessageSquare,
  Lock,
  Compass,
  Layers,
  ChevronDown,
  AlertCircle,
  Clock,
  Users
} from 'lucide-react';
import { webEnquiryService } from '../services/webEnquiryService';

interface WebPageProps {
  navigate: (path: string) => void;
}

const PROJECT_TYPES = [
  'Business Website Design',
  'Website Redesign',
  'Service Business Website',
  'E-commerce Website',
  'Landing Page',
  'Portfolio & Personal Brand',
  'Custom Web Functionality'
];

const BUSINESS_STAGES = [
  'New business / Launching soon',
  'Existing business operating',
  'Established business scaling',
  'Individual professional / Consultant'
];

const GOAL_OPTIONS = [
  'Explain our services clearly',
  'Generate qualified sales enquiries',
  'Sell products online',
  'Build credibility and trust',
  'Replace an outdated website',
  'Improve mobile responsiveness',
  'Automate bookings or forms',
  'Rank higher on search engines'
];

const FEATURE_OPTIONS = [
  'Custom Contact & Enquiry Forms',
  'WhatsApp / Live Chat Integration',
  'Content Management System (CMS)',
  'Service or Product Catalog',
  'Online Payment or Checkout',
  'Appointment / Meeting Booking',
  'Customer Dashboard / Portal',
  'Newsletter / CRM Integration'
];

const CONTENT_READINESS_OPTIONS = [
  'Ready — We have text, images, and brand assets prepared',
  'In progress — We have drafts and need help refining them',
  'Starting from scratch — We need guidance on structure and copy'
];

const TIMELINE_OPTIONS = [
  'Urgent — Within 2 to 3 weeks',
  'Standard — Within 4 to 6 weeks',
  'Flexible — Planning ahead for the next 2–3 months',
  'Just exploring options for future planning'
];

const READINESS_OPTIONS = [
  'Ready to begin as soon as scope is finalized',
  'Comparing options and preparing internal approval',
  'Initial research phase to understand requirements'
];

const DECISION_MAKER_OPTIONS = [
  'I am the primary decision-maker',
  'I am deciding alongside partners / co-founders',
  'I am evaluating options on behalf of my organization'
];

export const WebPage: React.FC<WebPageProps> = ({ navigate }) => {
  const formRef = useRef<HTMLDivElement>(null);

  // SEO Setup
  useEffect(() => {
    const originalTitle = document.title;
    document.title = 'Website Design & Development Services | DigitalMUID';

    let metaDesc = document.querySelector('meta[name="description"]');
    const originalDesc = metaDesc ? metaDesc.getAttribute('content') : '';
    if (metaDesc) {
      metaDesc.setAttribute(
        'content',
        'Professional website design and development services for businesses, startups, and service providers. Fast, mobile-first, conversion-focused websites built with DigitalMUID.'
      );
    }

    // Add JSON-LD Structured Data
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'web-service-schema';
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: 'Website Design and Development Services',
      provider: {
        '@type': 'Organization',
        name: 'DigitalMUID',
        url: 'https://digitalmuid.in'
      },
      serviceType: 'Web Development',
      description:
        'Professional website design and custom development services for growing businesses, service providers, and professionals.',
      areaServed: 'Worldwide',
      url: 'https://digitalmuid.in/web'
    });
    document.head.appendChild(script);

    return () => {
      document.title = originalTitle;
      if (metaDesc && originalDesc) {
        metaDesc.setAttribute('content', originalDesc);
      }
      const existingScript = document.getElementById('web-service-schema');
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, []);

  // Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [projectType, setProjectType] = useState(PROJECT_TYPES[0]);
  const [businessStage, setBusinessStage] = useState(BUSINESS_STAGES[1]);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([
    'Explain our services clearly',
    'Generate qualified sales enquiries'
  ]);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([
    'Custom Contact & Enquiry Forms',
    'WhatsApp / Live Chat Integration'
  ]);
  const [contentReadiness, setContentReadiness] = useState(CONTENT_READINESS_OPTIONS[0]);
  const [existingWebsiteUrl, setExistingWebsiteUrl] = useState('');
  const [referenceUrls, setReferenceUrls] = useState('');
  const [timeline, setTimeline] = useState(TIMELINE_OPTIONS[1]);
  const [readiness, setReadiness] = useState(READINESS_OPTIONS[0]);
  const [decisionMaker, setDecisionMaker] = useState(DECISION_MAKER_OPTIONS[0]);
  const [additionalRequirements, setAdditionalRequirements] = useState('');
  const [consentAgreed, setConsentAgreed] = useState(false);

  // Submission UI States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submissionSuccess, setSubmissionSuccess] = useState<{
    referenceId: string;
    clientName: string;
    business: string;
  } | null>(null);

  // FAQ Accordion State
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const scrollToForm = (preselectedType?: string) => {
    if (preselectedType) {
      setProjectType(preselectedType);
    }
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const scrollToServices = () => {
    const el = document.getElementById('services-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const toggleGoal = (goal: string) => {
    setSelectedGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
    );
  };

  const toggleFeature = (feature: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(feature) ? prev.filter((f) => f !== feature) : [...prev, feature]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmissionError(null);

    // Client-side validations
    if (!fullName.trim() || fullName.trim().length < 2) {
      setSubmissionError('Please enter your full name.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email.trim())) {
      setSubmissionError('Please provide a valid business or professional email address.');
      return;
    }
    if (!phone.trim() || phone.trim().length < 7) {
      setSubmissionError('Please enter a valid phone or WhatsApp number with area code.');
      return;
    }
    if (!businessName.trim()) {
      setSubmissionError('Please provide your business or project name.');
      return;
    }
    if (!consentAgreed) {
      setSubmissionError('Please confirm your consent so we can review your brief and contact you.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await webEnquiryService.submitEnquiry({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        businessName: businessName.trim(),
        projectType,
        businessStage,
        goals: selectedGoals,
        features: selectedFeatures,
        contentReadiness,
        existingWebsiteUrl: existingWebsiteUrl.trim() || undefined,
        referenceUrls: referenceUrls.trim() || undefined,
        timeline,
        readiness,
        decisionMaker,
        additionalRequirements: additionalRequirements.trim() || undefined,
        consentAgreed: true
      });

      if (!res.success) {
        setSubmissionError(res.error || 'Failed to submit enquiry. Please try again or reach out directly.');
        return;
      }

      setSubmissionSuccess({
        referenceId: res.referenceId || 'WEB-CONFIRMED',
        clientName: fullName.trim(),
        business: businessName.trim()
      });
    } catch (err: any) {
      setSubmissionError(err?.message || 'A network error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setSubmissionSuccess(null);
    setSubmissionError(null);
    setFullName('');
    setEmail('');
    setPhone('');
    setBusinessName('');
    setExistingWebsiteUrl('');
    setReferenceUrls('');
    setAdditionalRequirements('');
    setConsentAgreed(false);
  };

  const serviceCards = [
    {
      id: 'biz-web',
      typeValue: 'Business Website Design',
      title: 'Business Website Design',
      shortDesc:
        'For businesses that need a professional online presence, clear service information, and an easy way for customers to get in touch.',
      icon: Building2,
      accent: 'border-blue-500/30 text-blue-400 bg-blue-500/10',
      highlights: [
        'Clear value proposition & service offerings',
        'Mobile-friendly responsive layout across all screens',
        'Fast page loading & straightforward navigation',
        'Direct inquiry forms and WhatsApp click-to-chat'
      ]
    },
    {
      id: 'redesign',
      typeValue: 'Website Redesign',
      title: 'Website Redesign',
      shortDesc:
        'For businesses with an outdated, confusing, difficult-to-use, or poorly performing website that no longer reflects their standards.',
      icon: RefreshCw,
      accent: 'border-orange-500/30 text-orange-400 bg-orange-500/10',
      highlights: [
        'Complete visual modernizing and brand alignment',
        'Improved information architecture & menu structure',
        'Mobile optimization & speed improvement',
        'Preservation of key existing search traffic and URLs'
      ]
    },
    {
      id: 'service-biz',
      typeValue: 'Service Business Website',
      title: 'Service Business Websites',
      shortDesc:
        'For consultants, agencies, professionals, local service providers, and businesses that generate qualified enquiries online.',
      icon: Briefcase,
      accent: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10',
      highlights: [
        'Structured service cards with clear deliverables',
        'Trust signals, credentials, and client proof sections',
        'Interactive quote inquiry & consultation intake forms',
        'Automated lead notifications and CRM routing'
      ]
    },
    {
      id: 'ecommerce',
      typeValue: 'E-commerce Website',
      title: 'E-commerce Websites',
      shortDesc:
        'For businesses that want to present products online and support an appropriate online shopping and checkout experience.',
      icon: ShoppingBag,
      accent: 'border-purple-500/30 text-purple-400 bg-purple-500/10',
      highlights: [
        'Clean product catalog with categories and filters',
        'Secure checkout with Razorpay, UPI, or card gateways',
        'Inventory management & automated order notifications',
        'Mobile-first cart and streamlined one-page checkout'
      ]
    },
    {
      id: 'landing-pages',
      typeValue: 'Landing Page',
      title: 'Landing Pages',
      shortDesc:
        'Focused pages designed around a specific service, campaign, offer, or customer action without distracting navigation.',
      icon: MousePointerClick,
      accent: 'border-pink-500/30 text-pink-400 bg-pink-500/10',
      highlights: [
        'Laser-focused copy layout engineered for conversion',
        'Fast, distraction-free single-page flow',
        'Direct connection to lead forms and payment gateways',
        'Built for paid ad campaigns, launches, and events'
      ]
    },
    {
      id: 'portfolio',
      typeValue: 'Portfolio & Personal Brand',
      title: 'Portfolio and Personal Brand Websites',
      shortDesc:
        'For professionals, creators, consultants, and individuals who want to present their work, case studies, and expertise with authority.',
      icon: UserCheck,
      accent: 'border-amber-500/30 text-amber-400 bg-amber-500/10',
      highlights: [
        'Compelling bio, credentials, and personal authority',
        'Interactive case study and work showcase modules',
        'Direct booking links for speaking or consultations',
        'Blog or insight publishing integration'
      ]
    },
    {
      id: 'custom-web',
      typeValue: 'Custom Web Functionality',
      title: 'Custom Website Functionality',
      shortDesc:
        'For projects that need tailored forms, integrations, booking features, customer portals, dashboards, or other agreed functionality.',
      icon: Code2,
      accent: 'border-cyan-500/30 text-cyan-400 bg-cyan-500/10',
      highlights: [
        'Tailored booking workflows & multi-step calculators',
        'Customer account dashboards and protected portals',
        'API integrations with existing software & CRMs',
        'Custom business logic and automated database pipelines'
      ]
    }
  ];

  const whoWeHelpList = [
    {
      title: 'New businesses building their first website',
      desc: 'Get online quickly with a credible, professional foundation that gives first-time visitors immediate confidence.',
      icon: Rocket
    },
    {
      title: 'Established businesses improving their online presence',
      desc: 'Modernize an existing brand so your digital touchpoint matches the real quality of your company in the market.',
      icon: Building2
    },
    {
      title: 'Service providers seeking more relevant enquiries',
      desc: 'Structure your service offerings and forms so qualified prospects easily understand your value and reach out.',
      icon: Briefcase
    },
    {
      title: 'Businesses planning to sell products online',
      desc: 'Set up an intuitive product catalog and dependable checkout system that customers find simple and reliable to use.',
      icon: ShoppingBag
    },
    {
      title: 'Professionals showcasing their expertise',
      desc: 'Build personal authority, showcase past work, and facilitate direct client inquiries or speaking invitations.',
      icon: UserCheck
    },
    {
      title: 'Businesses replacing a difficult-to-manage website',
      desc: 'Transition away from clunky, slow, or broken platforms into a clean, modern, and easily maintained solution.',
      icon: RefreshCw
    }
  ];

  const goodWebsitePillars = [
    {
      title: 'Clear messaging',
      desc: 'Visitors should immediately grasp what your business does, who you help, and why your solution matters without wading through confusing buzzwords.',
      icon: MessageSquare
    },
    {
      title: 'Mobile-friendly design',
      desc: 'More than 70% of business visitors browse from smartphones. Your website must render cleanly and feel natural on phones, tablets, and wide monitors.',
      icon: Smartphone
    },
    {
      title: 'Easy navigation',
      desc: 'Intuitive menus, sensible page hierarchy, and uncluttered layouts ensure potential customers locate key information without friction.',
      icon: Compass
    },
    {
      title: 'Clear calls to action',
      desc: 'Every key page gives the visitor an obvious next step — whether sending an enquiry, requesting a quote, booking a call, or buying a product.',
      icon: MousePointerClick
    },
    {
      title: 'Search-engine-friendly structure',
      desc: 'Clean HTML semantic structure, sensible headings, descriptive page titles, and crawlable site architecture help search engines index your pages properly.',
      icon: Search
    },
    {
      title: 'Fast performance',
      desc: 'Optimized image assets, streamlined code, and modern hosting standards ensure pages load quickly without frustrating waiting times.',
      icon: Zap
    },
    {
      title: 'Trust and security',
      desc: 'Standard SSL encryption, explicit contact information, and transparent business credentials give prospects peace of mind to share information.',
      icon: ShieldCheck
    },
    {
      title: 'Easy content management',
      desc: 'Where agreed, we configure intuitive content management tools so your team can comfortably update text, articles, or products in-house.',
      icon: Layout
    }
  ];

  const processSteps = [
    {
      step: 'Step 1',
      title: 'Understand Your Business',
      desc: 'We start by learning about your business, target audience, core services, and what specific outcomes you want the website to achieve.'
    },
    {
      step: 'Step 2',
      title: 'Plan the Website',
      desc: 'Together we establish the sitemap, page structure, content requirements, key features, and overall scope for the project.'
    },
    {
      step: 'Step 3',
      title: 'Design the Experience',
      desc: 'We organise information clearly and craft a visual layout that reflects your brand identity, keeping usability and clarity front and center.'
    },
    {
      step: 'Step 4',
      title: 'Build and Test',
      desc: 'We develop the agreed website, testing thoroughly across modern mobile devices, desktop browsers, forms, and core user pathways.'
    },
    {
      step: 'Step 5',
      title: 'Launch the Website',
      desc: 'Once approved and ready, we coordinate domain routing, hosting deployment, and live verification using the agreed setup.'
    },
    {
      step: 'Step 6',
      title: 'Support and Improvements',
      desc: 'Where agreed, we provide handover guidance and remain available for scheduled updates, technical maintenance, or iterative additions.'
    }
  ];

  const faqs = [
    {
      q: 'How long does a website project usually take?',
      a: 'A focused landing page or small business website typically takes 2 to 4 weeks once content and scope are confirmed. More extensive service websites, custom portals, or e-commerce stores generally take 4 to 8 weeks depending on the agreed features. We set a realistic schedule before kick-off.'
    },
    {
      q: 'What do I need to prepare before we begin?',
      a: 'Having your logo, basic brand colors, high-level service descriptions, and any existing photos is very helpful. If you do not have finalized text or images yet, that is completely fine — we can help outline the required content and guide you through what is needed step by step.'
    },
    {
      q: 'Will my website look good and work smoothly on mobile phones?',
      a: 'Yes. Every website we build is designed mobile-first. We rigorously verify that layouts, text sizing, buttons, images, and forms function effortlessly on smartphones, tablets, laptops, and desktop displays.'
    },
    {
      q: 'Can our internal team update content after launch?',
      a: 'Yes, if agreed as part of the project scope. We can set up straightforward content management functionality so your team can easily update text, add blog articles, or modify service descriptions without touching code.'
    },
    {
      q: 'How do hosting and domain names work?',
      a: 'You retain full ownership of your domain and hosting accounts. We can guide you through selecting the right host (such as Vercel, Netlify, or your preferred provider), assist with DNS records, and ensure your SSL certificate is correctly enabled.'
    },
    {
      q: 'How is project scope and pricing determined?',
      a: 'Because every business has unique requirements, features, and content readiness, we do not use rigid one-size-fits-all packages. After you submit your project enquiry, we review your brief and discuss specific deliverables. We then provide a transparent, fixed written scope with no surprises.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#07111F] text-slate-100 font-sans selection:bg-[#FF6B00] selection:text-white">
      {/* ========================================================================= */}
      {/* SECTION 1: HERO */}
      {/* ========================================================================= */}
      <section className="relative pt-12 pb-20 sm:pt-20 sm:pb-28 overflow-hidden border-b border-white/10">
        {/* Ambient Gradient Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] sm:w-[900px] h-[400px] bg-gradient-to-tr from-[#1877F2]/15 via-[#FF6B00]/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-10 right-10 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            {/* Left Column: Headline and Positioning */}
            <div className="lg:col-span-7 space-y-6 text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-slate-300">
                <Globe className="w-3.5 h-3.5 text-[#FF6B00]" />
                <span className="uppercase tracking-wider text-[11px] font-bold text-slate-300">
                  DigitalMUID Web Services
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-400 text-[11px] font-medium">Accepting Projects</span>
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-5xl font-display font-extrabold text-white tracking-tight leading-[1.15]">
                Website Design & Development Services That Help Your Business Grow
              </h1>

              <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl font-light">
                Your website is often the first place people learn about your business. DigitalMUID helps you build a professional online presence that explains what you do, builds trust, and makes it easier for customers to contact you.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => scrollToForm()}
                  className="px-7 py-3.5 rounded-xl bg-[#FF6B00] hover:bg-[#e66000] text-white font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-lg shadow-[#FF6B00]/25 transition-all transform hover:-translate-y-0.5 cursor-pointer"
                >
                  <span>Discuss Your Website Project</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={scrollToServices}
                  className="px-6 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-slate-200 hover:text-white font-medium text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <span>Explore Our Services</span>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              {/* Trust Indicators */}
              <div className="pt-4 border-t border-white/10 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>100% Mobile Responsive</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Fast Loading & SEO-Ready</span>
                </div>
                <div className="flex items-center gap-2 col-span-2 sm:col-span-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Clear, Honest Guidance</span>
                </div>
              </div>
            </div>

            {/* Right Column: Clean Interactive Visual Device Mockup */}
            <div className="lg:col-span-5">
              <div className="relative mx-auto max-w-md lg:max-w-none">
                {/* Desktop Screen Mockup Frame */}
                <div className="rounded-2xl bg-[#0A1A2F] border border-white/15 shadow-2xl p-3 sm:p-4 backdrop-blur-md relative overflow-hidden">
                  {/* Browser Bar */}
                  <div className="flex items-center justify-between pb-3 border-b border-white/10 text-xs text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                    </div>
                    <div className="px-3 py-1 rounded-md bg-white/5 border border-white/10 text-[11px] text-slate-300 font-mono truncate max-w-[190px]">
                      https://yourbusiness.com
                    </div>
                    <div className="w-4" />
                  </div>

                  {/* Browser Content Preview */}
                  <div className="pt-3 space-y-3">
                    {/* Mock Nav */}
                    <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-white/5 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded bg-[#FF6B00] flex items-center justify-center text-[9px] font-bold text-white">
                          B
                        </div>
                        <span className="font-bold text-white">Your Business</span>
                      </div>
                      <div className="hidden sm:flex items-center gap-2.5 text-slate-400 text-[10px]">
                        <span>Services</span>
                        <span>About</span>
                        <span>Case Studies</span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-[#FF6B00] text-white text-[9px] font-bold">
                        Contact
                      </span>
                    </div>

                    {/* Mock Hero Content */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-white/5 to-transparent border border-white/5 space-y-2 text-left">
                      <span className="inline-block px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[9px] font-semibold uppercase">
                        Service Provider
                      </span>
                      <h4 className="text-sm sm:text-base font-bold text-white leading-tight">
                        We Help Clients Solve Real Problems Efficiently
                      </h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Clear messaging, clean layout, and direct calls to action that make contacting you effortless.
                      </p>
                      <div className="pt-1 flex items-center gap-2">
                        <div className="px-3 py-1 rounded bg-[#FF6B00] text-white text-[10px] font-semibold">
                          Request a Quote
                        </div>
                        <div className="px-3 py-1 rounded bg-white/10 text-slate-300 text-[10px]">
                          Learn More
                        </div>
                      </div>
                    </div>

                    {/* Mock Service Grid */}
                    <div className="grid grid-cols-2 gap-2 text-left">
                      <div className="p-2.5 rounded-lg bg-white/5 border border-white/5 space-y-1">
                        <div className="w-5 h-5 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px]">
                          <Zap className="w-3 h-3" />
                        </div>
                        <div className="text-[11px] font-semibold text-white">Core Solution</div>
                        <div className="text-[9px] text-slate-400">Structured deliverables & clear outcomes.</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white/5 border border-white/5 space-y-1">
                        <div className="w-5 h-5 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px]">
                          <ShieldCheck className="w-3 h-3" />
                        </div>
                        <div className="text-[11px] font-semibold text-white">Verified Trust</div>
                        <div className="text-[9px] text-slate-400">Proof, testimonials, and confidence.</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mobile Preview Badge Floating Overlay */}
                <div className="absolute -bottom-5 -right-3 sm:-right-5 w-44 sm:w-48 p-3 rounded-xl bg-[#07111F] border border-white/20 shadow-2xl space-y-1.5 backdrop-blur-lg">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-semibold text-white flex items-center gap-1">
                      <Smartphone className="w-3 h-3 text-[#FF6B00]" />
                      Mobile Optimized
                    </span>
                    <span className="text-emerald-400 font-bold">Fast</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-emerald-400 rounded-full w-4/5" />
                  </div>
                  <p className="text-[9px] text-slate-400">Engineered to look great on modern mobile devices.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 2: SERVICES */}
      {/* ========================================================================= */}
      <section id="services-section" className="py-20 sm:py-24 border-b border-white/10 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-14">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[#FF6B00] text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3 h-3" />
              Tailored Capabilities
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-extrabold text-white tracking-tight">
              Website Solutions for Your Business
            </h2>
            <p className="text-base text-slate-300 leading-relaxed font-light">
              Whether you are starting from scratch or improving an existing website, we can help you choose a solution that fits your goals.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {serviceCards.map((service) => {
              const Icon = service.icon;
              return (
                <div
                  key={service.id}
                  className="rounded-2xl bg-[#0A1A2F]/80 hover:bg-[#0A1A2F] border border-white/10 hover:border-white/20 p-6 sm:p-7 flex flex-col justify-between transition-all duration-200 group shadow-lg"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${service.accent}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
                        Service
                      </span>
                    </div>

                    <div>
                      <h3 className="text-lg sm:text-xl font-display font-bold text-white group-hover:text-[#FF6B00] transition-colors">
                        {service.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
                        {service.shortDesc}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-white/5 space-y-2">
                      {service.highlights.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-6 mt-6 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => scrollToForm(service.typeValue)}
                      className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-[#FF6B00] text-slate-200 hover:text-white border border-white/10 hover:border-[#FF6B00] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <span>Discuss This Service</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-center text-xs text-slate-400 mt-8 max-w-2xl mx-auto">
            Note: Every project is customized to your exact requirements. Final deliverables and inclusions are established collaboratively during our scoping discussion.
          </p>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 3: WHO WE HELP */}
      {/* ========================================================================= */}
      <section className="py-20 sm:py-24 border-b border-white/10 bg-[#060E1A]/60 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-14">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[#FF6B00] text-xs font-bold uppercase tracking-wider">
              <Users className="w-3 h-3" />
              Target Audience
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-extrabold text-white tracking-tight">
              A Website That Fits Your Business Goals
            </h2>
            <p className="text-base text-slate-300 leading-relaxed font-light">
              We work with founders, leaders, and professionals across diverse stages who value clear communication and real business utility.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {whoWeHelpList.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className="rounded-2xl bg-[#0A1A2F]/60 border border-white/10 p-6 space-y-3 hover:border-white/20 transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#FF6B00]">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-white">
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 4: WHAT MAKES A GOOD WEBSITE? */}
      {/* ========================================================================= */}
      <section className="py-20 sm:py-24 border-b border-white/10 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-14">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[#FF6B00] text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="w-3 h-3" />
              Quality Principles
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-extrabold text-white tracking-tight">
              More Than Just a Good-Looking Website
            </h2>
            <p className="text-base text-slate-300 leading-relaxed font-light">
              Visual aesthetics matter, but a truly successful website balances messaging clarity, technical reliability, user comfort, and conversion focus.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {goodWebsitePillars.map((pillar, idx) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={idx}
                  className="p-6 rounded-2xl bg-[#0A1A2F]/60 border border-white/10 space-y-3 text-left hover:bg-[#0A1A2F] transition-all"
                >
                  <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-white">{pillar.title}</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">{pillar.desc}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-12 p-4 sm:p-5 rounded-2xl bg-white/5 border border-white/10 max-w-3xl mx-auto text-center text-xs text-slate-400">
            We focus on proven design and development best practices without making unsupported guarantees about overnight search rankings, sudden viral traffic, or unrealistic revenue spikes.
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 5: OUR PROCESS */}
      {/* ========================================================================= */}
      <section className="py-20 sm:py-24 border-b border-white/10 bg-[#060E1A]/60 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-14">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[#FF6B00] text-xs font-bold uppercase tracking-wider">
              <Layers className="w-3 h-3" />
              Methodology
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-extrabold text-white tracking-tight">
              A Clear Process From Idea to Launch
            </h2>
            <p className="text-base text-slate-300 leading-relaxed font-light">
              We keep the journey structured and transparent at every milestone, so you always know what is happening and what comes next.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {processSteps.map((step, idx) => (
              <div
                key={idx}
                className="relative rounded-2xl bg-[#0A1A2F] border border-white/10 p-6 sm:p-7 space-y-3 text-left hover:border-white/20 transition-all shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-lg bg-[#FF6B00]/10 border border-[#FF6B00]/30 text-[#FF6B00] text-xs font-bold font-mono">
                    {step.step}
                  </span>
                  <span className="text-slate-500 text-xs font-mono">0{idx + 1}</span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white pt-1">
                  {step.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-light">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center text-xs text-slate-400">
            Ongoing maintenance, copy generation, and specialized hosting setups are discussed and agreed individually based on your business preferences.
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 6: FAQ */}
      {/* ========================================================================= */}
      <section className="py-20 sm:py-24 border-b border-white/10 relative">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-12">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[#FF6B00] text-xs font-bold uppercase tracking-wider">
              <HelpCircle className="w-3 h-3" />
              Frequently Asked Questions
            </div>
            <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-white tracking-tight">
              Common Questions About Working Together
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-light">
              Clear, practical answers about our timelines, technical setup, and collaboration model.
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div
                  key={index}
                  className="rounded-2xl bg-[#0A1A2F]/80 border border-white/10 overflow-hidden transition-all"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                    className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-white/5 transition-colors"
                  >
                    <span className="font-semibold text-white text-sm sm:text-base">
                      {faq.q}
                    </span>
                    <ChevronDown
                      className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-[#FF6B00]' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 sm:px-6 sm:pb-6 text-xs sm:text-sm text-slate-300 leading-relaxed border-t border-white/5 pt-4">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 7: DEDICATED PROJECT ENQUIRY FORM */}
      {/* ========================================================================= */}
      <section ref={formRef} id="enquiry-form" className="py-20 sm:py-28 relative">
        {/* Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-gradient-to-tr from-[#FF6B00]/10 via-[#1877F2]/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-12">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF6B00]/10 border border-[#FF6B00]/30 text-[#FF6B00] text-xs font-bold uppercase tracking-wider">
              <Send className="w-3 h-3" />
              Start The Conversation
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-extrabold text-white tracking-tight">
              Start Your Website Project Discussion
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl mx-auto font-light">
              Tell us about your business and website goals. We review every enquiry and get in touch within one business day to discuss scope and options.
            </p>
          </div>

          {/* SUCCESS SCREEN */}
          {submissionSuccess ? (
            <div className="p-8 sm:p-12 rounded-3xl bg-[#0A1A2F] border border-emerald-500/30 shadow-2xl text-center space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-mono font-bold tracking-wider">
                  Enquiry Reference: {submissionSuccess.referenceId}
                </span>
                <h3 className="text-2xl sm:text-3xl font-display font-bold text-white">
                  Thank You, {submissionSuccess.clientName}!
                </h3>
                <p className="text-slate-300 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
                  Your project enquiry for <strong className="text-white">{submissionSuccess.business}</strong> has been logged into our system. Our team will review your brief and reach out within 1 business day.
                </p>
              </div>

              <div className="p-4 sm:p-6 rounded-2xl bg-white/5 border border-white/10 max-w-lg mx-auto text-left text-xs sm:text-sm space-y-2 text-slate-300">
                <p className="font-semibold text-white">What happens next?</p>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-[#FF6B00]">1.</span>
                  <span>We inspect your goals, reference links, and current stage.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-[#FF6B00]">2.</span>
                  <span>We send you a brief confirmation via email or WhatsApp.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-[#FF6B00]">3.</span>
                  <span>We schedule a short discovery call to agree on precise scope.</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="px-6 py-3 rounded-xl bg-[#FF6B00] hover:bg-[#e66000] text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  Submit Another Project Brief
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Return to Home
                </button>
              </div>
            </div>
          ) : (
            /* ENQUIRY FORM */
            <form
              onSubmit={handleSubmit}
              className="p-6 sm:p-10 rounded-3xl bg-[#0A1A2F] border border-white/15 shadow-2xl space-y-8"
            >
              {submissionError && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-3 text-xs sm:text-sm">
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="font-semibold text-white">Submission Issue:</span> {submissionError}
                  </div>
                </div>
              )}

              {/* STEP A: CONTACT & BUSINESS DETAILS */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-white/10 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <span className="w-5 h-5 rounded-full bg-white/10 text-white flex items-center justify-center text-[10px]">
                    1
                  </span>
                  <span>Contact & Business Information</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Full Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Sarah Jenkins"
                      className="w-full px-4 py-3 rounded-xl bg-[#07111F] border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#FF6B00] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Business Email <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. sarah@company.com"
                      className="w-full px-4 py-3 rounded-xl bg-[#07111F] border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#FF6B00] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Phone / WhatsApp <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. +91 98765 43210"
                      className="w-full px-4 py-3 rounded-xl bg-[#07111F] border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#FF6B00] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Business or Project Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="e.g. Apex Consulting Group"
                      className="w-full px-4 py-3 rounded-xl bg-[#07111F] border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#FF6B00] transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* STEP B: PROJECT TYPE & CURRENT STAGE */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-white/10 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <span className="w-5 h-5 rounded-full bg-white/10 text-white flex items-center justify-center text-[10px]">
                    2
                  </span>
                  <span>Project Scope & Category</span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-2">
                    What type of website project are you planning? <span className="text-rose-400">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {PROJECT_TYPES.map((type) => {
                      const isSelected = projectType === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setProjectType(type)}
                          className={`p-3 rounded-xl text-left text-xs font-medium border transition-all cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? 'bg-[#FF6B00]/15 border-[#FF6B00] text-white shadow-md shadow-[#FF6B00]/10'
                              : 'bg-[#07111F] border-white/10 text-slate-300 hover:border-white/20 hover:text-white'
                          }`}
                        >
                          <span>{type}</span>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-[#FF6B00] shrink-0 ml-1.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Current Business Stage
                    </label>
                    <select
                      value={businessStage}
                      onChange={(e) => setBusinessStage(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-[#07111F] border border-white/10 text-white text-xs sm:text-sm focus:outline-none focus:border-[#FF6B00]"
                    >
                      {BUSINESS_STAGES.map((stage) => (
                        <option key={stage} value={stage}>
                          {stage}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Desired Timeline
                    </label>
                    <select
                      value={timeline}
                      onChange={(e) => setTimeline(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-[#07111F] border border-white/10 text-white text-xs sm:text-sm focus:outline-none focus:border-[#FF6B00]"
                    >
                      {TIMELINE_OPTIONS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* STEP C: GOALS & FEATURES */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-white/10 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <span className="w-5 h-5 rounded-full bg-white/10 text-white flex items-center justify-center text-[10px]">
                    3
                  </span>
                  <span>Primary Goals & Desired Features</span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-2">
                    What are the main goals for this website? (Select all that apply)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {GOAL_OPTIONS.map((goal) => {
                      const isSelected = selectedGoals.includes(goal);
                      return (
                        <button
                          key={goal}
                          type="button"
                          onClick={() => toggleGoal(goal)}
                          className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-blue-600/20 border-blue-500 text-white'
                              : 'bg-[#07111F] border-white/10 text-slate-400 hover:text-white'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-blue-400' : 'bg-slate-600'}`} />
                          <span>{goal}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2">
                  <label className="block text-xs font-medium text-slate-300 mb-2">
                    Key Features Needed (Select all that apply)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {FEATURE_OPTIONS.map((feat) => {
                      const isSelected = selectedFeatures.includes(feat);
                      return (
                        <button
                          key={feat}
                          type="button"
                          onClick={() => toggleFeature(feat)}
                          className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-emerald-600/20 border-emerald-500 text-white'
                              : 'bg-[#07111F] border-white/10 text-slate-400 hover:text-white'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                          <span>{feat}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* STEP D: CONTEXT & PREPARATION */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-white/10 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <span className="w-5 h-5 rounded-full bg-white/10 text-white flex items-center justify-center text-[10px]">
                    4
                  </span>
                  <span>Preparation & References</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Existing Website URL (if any)
                    </label>
                    <input
                      type="url"
                      value={existingWebsiteUrl}
                      onChange={(e) => setExistingWebsiteUrl(e.target.value)}
                      placeholder="https://example.com"
                      className="w-full px-4 py-3 rounded-xl bg-[#07111F] border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#FF6B00]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Websites you admire for inspiration (optional)
                    </label>
                    <input
                      type="text"
                      value={referenceUrls}
                      onChange={(e) => setReferenceUrls(e.target.value)}
                      placeholder="e.g. stripe.com, linear.app"
                      className="w-full px-4 py-3 rounded-xl bg-[#07111F] border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#FF6B00]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Content Readiness (Text & Photos)
                    </label>
                    <select
                      value={contentReadiness}
                      onChange={(e) => setContentReadiness(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-[#07111F] border border-white/10 text-white text-xs sm:text-sm focus:outline-none focus:border-[#FF6B00]"
                    >
                      {CONTENT_READINESS_OPTIONS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Your Decision-Maker Role
                    </label>
                    <select
                      value={decisionMaker}
                      onChange={(e) => setDecisionMaker(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-[#07111F] border border-white/10 text-white text-xs sm:text-sm focus:outline-none focus:border-[#FF6B00]"
                    >
                      {DECISION_MAKER_OPTIONS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Additional Requirements or Context (optional)
                  </label>
                  <textarea
                    rows={4}
                    value={additionalRequirements}
                    onChange={(e) => setAdditionalRequirements(e.target.value)}
                    placeholder="Tell us about specific customer problems, integrations, target audience notes, or any questions you have..."
                    className="w-full px-4 py-3 rounded-xl bg-[#07111F] border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#FF6B00]"
                  />
                </div>
              </div>

              {/* CONSENT & SUBMIT */}
              <div className="space-y-4 pt-2">
                <label className="flex items-start gap-3 text-xs text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    required
                    checked={consentAgreed}
                    onChange={(e) => setConsentAgreed(e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-[#07111F] text-[#FF6B00] focus:ring-[#FF6B00] mt-0.5"
                  />
                  <span>
                    I confirm this is a genuine business enquiry, and I agree to be contacted by the DigitalMUID team to discuss website scope and options.
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 px-8 rounded-xl bg-[#FF6B00] hover:bg-[#e66000] disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-[#FF6B00]/25 transition-all cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Submitting Your Brief...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Website Project Brief</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <p className="text-center text-[11px] text-slate-500">
                  Zero spam. Your information is strictly used to evaluate your project scope and contact you directly.
                </p>
              </div>
            </form>
          )}

          {/* Direct Contact Alternative */}
          <div className="mt-8 text-center text-xs text-slate-400 space-y-1">
            <p>Prefer to reach out directly first?</p>
            <p className="text-slate-300">
              Email:{' '}
              <a href="mailto:muid@digitalmuid.in" className="text-[#FF6B00] hover:underline font-medium">
                muid@digitalmuid.in
              </a>{' '}
              · WhatsApp:{' '}
              <a
                href="https://wa.me/919934333671"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:underline font-medium"
              >
                +91 99343 33671
              </a>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
