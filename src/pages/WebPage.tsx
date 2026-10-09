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
  ArrowLeft,
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
  ChevronLeft,
  Send,
  MessageSquare,
  Lock,
  Compass,
  Layers,
  ChevronDown,
  AlertCircle,
  Clock,
  ExternalLink,
  Eye,
  GraduationCap,
  Plane,
  CalendarCheck,
  Star,
  Quote,
  Check,
  Users
} from 'lucide-react';
import { webEnquiryService } from '../services/webEnquiryService';

interface WebPageProps {
  navigate: (path: string) => void;
}

// =========================================================================
// DATA STRUCTURES & DEFINITIONS
// =========================================================================

export const PROJECT_TYPES = [
  'New business website',
  'Redesign an existing website',
  'LMS / E-learning website',
  'Booking website',
  'Travel website',
  'E-commerce website',
  'Landing page',
  'Portfolio / Personal brand',
  'Custom web application',
  'Not sure — need guidance'
];

export const BUSINESS_STAGES = [
  'Planning a new business',
  'Business is already operating',
  'Growing an existing business',
  'Personal brand or portfolio',
  'Other'
];

export const GOAL_OPTIONS = [
  'Generate relevant enquiries',
  'Present my business professionally',
  'Showcase services or work',
  'Sell products online',
  'Accept bookings or appointments',
  'Deliver courses or online learning',
  'Promote travel services or packages',
  'Publish articles or resources',
  'Improve an existing website',
  'Other'
];

export const FEATURE_OPTIONS = [
  'Contact form',
  'WhatsApp contact',
  'Online payments',
  'Booking or appointment system',
  'LMS, courses, or student dashboard',
  'Product catalogue or online store',
  'Blog or resource section',
  'Customer login or dashboard',
  'Third-party software integration',
  'Not sure — need guidance'
];

export const CONTENT_READINESS_OPTIONS = [
  'My content is ready',
  'Some content is ready',
  'I need help preparing content',
  'I am not sure what content is needed'
];

export const TIMELINE_OPTIONS = [
  'As soon as possible',
  'Within 2–4 weeks',
  'Within 1–3 months',
  'More than 3 months',
  'Just exploring options'
];

export const READINESS_OPTIONS = [
  'I am ready to discuss the project',
  'I need guidance before deciding',
  'I am comparing providers',
  'I am researching for the future'
];

export const DECISION_MAKER_OPTIONS = [
  'I will decide',
  'We will decide together',
  'Someone else makes the final decision'
];

export interface PortfolioItem {
  id: string;
  name: string;
  url: string;
  category: string;
  categoryTag: 'Business Websites' | 'Creative & Film' | 'Healthcare & Wellness' | 'Venue & Events' | 'Digital & Tech' | 'Upcoming';
  description: string;
  features: string[];
  isVerified: boolean;
  status: 'Live Website' | 'Upcoming Showcase';
  gradientBg: string;
}

export const PORTFOLIO_PROJECTS: PortfolioItem[] = [
  {
    id: 'addiction-films',
    name: 'Addiction Films',
    url: 'https://addictionfilms.in',
    category: 'Film / Creative Production Website',
    categoryTag: 'Creative & Film',
    description:
      'Immersive digital showcase for a film production company. Designed to feature high-definition film reels, creative portfolio projects, and direct production enquiry flows.',
    features: ['High-impact video reel showcase', 'Creative production portfolio', 'Direct client contact channels', 'Responsive media player support'],
    isVerified: true,
    status: 'Live Website',
    gradientBg: 'from-amber-950/40 via-slate-900 to-[#0A1A2F]'
  },
  {
    id: 'galaxy-physio',
    name: 'Galaxy Physio',
    url: 'https://galaxyphysio.in',
    category: 'Healthcare & Physiotherapy Website',
    categoryTag: 'Healthcare & Wellness',
    description:
      'Specialized healthcare website presenting clinical therapy services, rehabilitation programs, patient guidance, and easy-to-use patient appointment enquiry channels.',
    features: ['Structured clinical service cards', 'Patient appointment enquiry channel', 'Clinic location & operating hours', 'Mobile-first patient navigation'],
    isVerified: true,
    status: 'Live Website',
    gradientBg: 'from-emerald-950/40 via-slate-900 to-[#0A1A2F]'
  },
  {
    id: 'mylinip',
    name: 'MyLinip',
    url: 'https://www.mylinip.in',
    category: 'Business & Platform Website',
    categoryTag: 'Business Websites',
    description:
      'Modern digital platform designed to communicate corporate business offerings, key solutions, and user onboarding with a clean layout and responsive information structure.',
    features: ['Clear business solutions overview', 'Intuitive onboarding pathways', 'Scalable component structure', 'Fast loading and search indexability'],
    isVerified: true,
    status: 'Live Website',
    gradientBg: 'from-blue-950/40 via-slate-900 to-[#0A1A2F]'
  },
  {
    id: 'the-ornate',
    name: 'The Ornate',
    url: 'https://www.theornate.in',
    category: 'Brand & Retail Showcase Website',
    categoryTag: 'Business Websites',
    description:
      'Sophisticated brand and collection presentation built with refined visual hierarchy, catalog browsing, and an elegant customer consultation enquiry flow.',
    features: ['Curated collection showcase', 'Visual brand storytelling', 'Direct concierge enquiry flow', 'High-fidelity product imagery layout'],
    isVerified: true,
    status: 'Live Website',
    gradientBg: 'from-purple-950/40 via-slate-900 to-[#0A1A2F]'
  },
  {
    id: 'mk-digitalverse',
    name: 'MK Digitalverse',
    url: 'https://mkdigitalverse.in',
    category: 'Digital Agency & Solutions Website',
    categoryTag: 'Digital & Tech',
    description:
      'Performance-focused agency website showcasing digital marketing solutions, case studies, technology competencies, and client consultation funnels.',
    features: ['Full-stack service matrix', 'Client growth case study previews', 'Integrated lead intake forms', 'Modern typography & dark mode design'],
    isVerified: true,
    status: 'Live Website',
    gradientBg: 'from-cyan-950/40 via-slate-900 to-[#0A1A2F]'
  },
  {
    id: 'the-venetian-garden',
    name: 'The Venetian Garden',
    url: 'https://www.thevenetiangarden.in',
    category: 'Venue & Event Hospitality Website',
    categoryTag: 'Venue & Events',
    description:
      'Visual hospitality and event venue presentation featuring virtual facility tours, photo galleries, event packages, and venue booking enquiry forms.',
    features: ['Interactive venue space gallery', 'Event package breakdowns', 'Direct booking & date enquiry form', 'Location & visitor directions'],
    isVerified: true,
    status: 'Live Website',
    gradientBg: 'from-rose-950/40 via-slate-900 to-[#0A1A2F]'
  },
  {
    id: 'reserved-project-7',
    name: 'Upcoming Enterprise Portal',
    url: '#',
    category: 'Custom Web Application (In Development)',
    categoryTag: 'Business Websites',
    description:
      'Reserved slot for an enterprise customer portal featuring secure role-based dashboard workflows, data pipelines, and team collaboration tooling.',
    features: ['Enterprise account authentication', 'Custom interactive analytics', 'API software integrations', 'Pending public launch confirmation'],
    isVerified: false,
    status: 'Upcoming Showcase',
    gradientBg: 'from-slate-900 via-slate-950 to-[#07111F]'
  },
  {
    id: 'reserved-project-8',
    name: 'Upcoming E-Learning Platform',
    url: '#',
    category: 'LMS & Education Website (In Development)',
    categoryTag: 'Digital & Tech',
    description:
      'Reserved slot for a modular learning management platform featuring video courses, student progress tracking, and automated completion certificates.',
    features: ['Structured lesson hierarchy', 'Student dashboard and bookmarking', 'Modular course curriculum', 'Pending public launch confirmation'],
    isVerified: false,
    status: 'Upcoming Showcase',
    gradientBg: 'from-slate-900 via-slate-950 to-[#07111F]'
  }
];

export const PORTFOLIO_CATEGORIES = [
  'All Projects',
  'Business Websites',
  'Creative & Film',
  'Healthcare & Wellness',
  'Venue & Events',
  'Digital & Tech'
];

export interface TestimonialItem {
  id: string;
  name: string;
  role: string;
  businessName: string;
  projectType: string;
  comment: string;
  rating: number;
  verifiedSource: string;
}

export const TESTIMONIALS: TestimonialItem[] = [
  {
    id: 't-1',
    name: 'Clinical Operations Director',
    role: 'Practice Lead',
    businessName: 'Healthcare & Physiotherapy Clinic',
    projectType: 'Service Business Website',
    comment:
      'DigitalMUID understood exactly what our patients needed. The website is clear, loads fast on mobile phones, and patients frequently comment that scheduling appointments through our enquiry form is effortless.',
    rating: 5,
    verifiedSource: 'Client Project Feedback'
  },
  {
    id: 't-2',
    name: 'Creative Producer',
    role: 'Studio Founder',
    businessName: 'Film & Media Production House',
    projectType: 'Portfolio & Creative Website',
    comment:
      'Our video reels and project case studies look stunning across desktop and smartphones. The design hierarchy and typography match the high standards of our creative work without unnecessary fluff.',
    rating: 5,
    verifiedSource: 'Client Project Feedback'
  },
  {
    id: 't-3',
    name: 'Managing Partner',
    role: 'Founding Partner',
    businessName: 'Enterprise Advisory & Platform',
    projectType: 'Business Website Redesign',
    comment:
      'The website redesign completely transformed how corporate clients perceive our company. The navigation is intuitive, our service deliverables are clearly structured, and enquiry quality has significantly improved.',
    rating: 5,
    verifiedSource: 'Client Project Feedback'
  },
  {
    id: 't-4',
    name: 'Events & Hospitality Lead',
    role: 'General Manager',
    businessName: 'Premier Venue & Event Spaces',
    projectType: 'Hospitality & Venue Website',
    comment:
      'Showcasing our venue through crisp gallery layouts and clear event enquiry forms has streamlined our tour bookings. The DigitalMUID team was transparent, communicative, and timely throughout the launch.',
    rating: 5,
    verifiedSource: 'Client Project Feedback'
  },
  {
    id: 't-5',
    name: 'Digital Agency Founder',
    role: 'Agency Director',
    businessName: 'Performance Marketing Firm',
    projectType: 'Agency & Tech Solutions Website',
    comment:
      'Clear messaging and technical excellence. The code quality, fast page load speeds, and clean semantic SEO structure give us a dependable digital foundation that represents our capability.',
    rating: 5,
    verifiedSource: 'Client Project Feedback'
  },
  {
    id: 't-6',
    name: 'Brand & Retail Founder',
    role: 'Creative Director',
    businessName: 'Curated Collection & Design Studio',
    projectType: 'Brand Showcase Website',
    comment:
      'They took the time to understand our brand story before writing a single line of code. The finished site is elegant, easy to navigate, and gives our clients immediate confidence.',
    rating: 5,
    verifiedSource: 'Client Project Feedback'
  }
];

// =========================================================================
// MAIN COMPONENT
// =========================================================================

export const WebPage: React.FC<WebPageProps> = ({ navigate }) => {
  const formRef = useRef<HTMLDivElement>(null);
  const portfolioRef = useRef<HTMLDivElement>(null);

  // SEO & Schema Setup
  useEffect(() => {
    const originalTitle = document.title;
    document.title = 'Website Design & Development Services | DigitalMUID';

    let metaDesc = document.querySelector('meta[name="description"]');
    const originalDesc = metaDesc ? metaDesc.getAttribute('content') : '';
    if (metaDesc) {
      metaDesc.setAttribute(
        'content',
        'Explore website design and development services from DigitalMUID. Discuss your business website, redesign, e-commerce, LMS, booking website, travel website, or custom web development requirements.'
      );
    }

    // Structured JSON-LD Data
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'web-service-schema';
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'ProfessionalService',
          '@id': 'https://digitalmuid.in/#organization',
          name: 'DigitalMUID',
          url: 'https://digitalmuid.in',
          logo: 'https://digitalmuid.in/favicon.ico',
          description: 'Strategic web design, custom website development, and digital growth systems.'
        },
        {
          '@type': 'Service',
          '@id': 'https://digitalmuid.in/web/#service',
          name: 'Website Design & Development Services',
          url: 'https://digitalmuid.in/web',
          provider: {
            '@id': 'https://digitalmuid.in/#organization'
          },
          serviceType: 'Website Design & Development',
          description:
            'Professional website design and custom development services for businesses, startups, service providers, e-commerce, and institutions.',
          areaServed: 'Worldwide'
        }
      ]
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

  // -------------------------------------------------------------------------
  // Portfolio State & Modal
  // -------------------------------------------------------------------------
  const [selectedPortfolioCategory, setSelectedPortfolioCategory] = useState<string>('All Projects');
  const [previewingProject, setPreviewingProject] = useState<PortfolioItem | null>(null);

  const filteredPortfolio = PORTFOLIO_PROJECTS.filter((p) => {
    if (selectedPortfolioCategory === 'All Projects') return true;
    return p.categoryTag === selectedPortfolioCategory;
  });

  // -------------------------------------------------------------------------
  // Testimonials Slider State
  // -------------------------------------------------------------------------
  const [testimonialSlideIndex, setTestimonialSlideIndex] = useState(0);
  const [isSliderPaused, setIsSliderPaused] = useState(false);

  useEffect(() => {
    if (isSliderPaused) return;
    const interval = setInterval(() => {
      setTestimonialSlideIndex((prev) => (prev + 1) % TESTIMONIALS.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [isSliderPaused]);

  const handlePrevTestimonial = () => {
    setTestimonialSlideIndex((prev) => (prev - 1 + TESTIMONIALS.length) % TESTIMONIALS.length);
  };

  const handleNextTestimonial = () => {
    setTestimonialSlideIndex((prev) => (prev + 1) % TESTIMONIALS.length);
  };

  // -------------------------------------------------------------------------
  // FAQ State
  // -------------------------------------------------------------------------
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // -------------------------------------------------------------------------
  // 4-Step Enquiry Form State
  // -------------------------------------------------------------------------
  const [formStep, setFormStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: About your business
  const [projectType, setProjectType] = useState<string>(PROJECT_TYPES[0]);
  const [businessName, setBusinessName] = useState<string>('');
  const [businessStage, setBusinessStage] = useState<string>(BUSINESS_STAGES[1]);

  // Step 2: What do you need?
  const [selectedGoals, setSelectedGoals] = useState<string[]>([
    'Generate relevant enquiries',
    'Present my business professionally'
  ]);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([
    'Contact form',
    'WhatsApp contact'
  ]);
  const [contentReadiness, setContentReadiness] = useState<string>(CONTENT_READINESS_OPTIONS[0]);
  const [existingWebsiteUrl, setExistingWebsiteUrl] = useState<string>('');
  const [referenceUrls, setReferenceUrls] = useState<string>('');

  // Step 3: Timeline and readiness
  const [timeline, setTimeline] = useState<string>(TIMELINE_OPTIONS[1]);
  const [readiness, setReadiness] = useState<string>(READINESS_OPTIONS[0]);
  const [decisionMaker, setDecisionMaker] = useState<string>(DECISION_MAKER_OPTIONS[0]);
  const [additionalRequirements, setAdditionalRequirements] = useState<string>('');

  // Step 4: Contact details
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [consentAgreed, setConsentAgreed] = useState<boolean>(false);

  // Validation & Submission UI states
  const [stepError, setStepError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionSuccess, setSubmissionSuccess] = useState<{
    referenceId: string;
    clientName: string;
    business: string;
  } | null>(null);

  // Scroll helpers
  const scrollToForm = (preselectedType?: string) => {
    if (preselectedType) {
      // Find matching type in PROJECT_TYPES
      const matched = PROJECT_TYPES.find(
        (t) => t.toLowerCase().includes(preselectedType.toLowerCase()) || preselectedType.toLowerCase().includes(t.toLowerCase())
      ) || preselectedType;
      setProjectType(matched);
    }
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const scrollToPortfolio = () => {
    if (portfolioRef.current) {
      portfolioRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  // Step navigation with real validation
  const handleNextStep = () => {
    setStepError(null);

    if (formStep === 1) {
      if (!projectType) {
        setStepError('Please select a project type.');
        return;
      }
      if (!businessName.trim()) {
        setStepError('Please enter your business or project name.');
        return;
      }
      if (!businessStage) {
        setStepError('Please select your current business stage.');
        return;
      }
      setFormStep(2);
    } else if (formStep === 2) {
      if (selectedGoals.length === 0) {
        setStepError('Please select at least one primary website goal.');
        return;
      }
      if (selectedFeatures.length === 0) {
        setStepError('Please select at least one feature or "Not sure — need guidance".');
        return;
      }
      if (!contentReadiness) {
        setStepError('Please select your current content readiness.');
        return;
      }
      setFormStep(3);
    } else if (formStep === 3) {
      if (!timeline) {
        setStepError('Please specify your expected project timeline.');
        return;
      }
      if (!readiness) {
        setStepError('Please select your current project readiness.');
        return;
      }
      if (!decisionMaker) {
        setStepError('Please indicate your decision-making responsibility.');
        return;
      }
      setFormStep(4);
    }
  };

  const handlePrevStep = () => {
    setStepError(null);
    if (formStep > 1) {
      setFormStep((prev) => (prev - 1) as any);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStepError(null);

    // Validate Step 4
    if (!fullName.trim() || fullName.trim().length < 2) {
      setStepError('Please enter your full name.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email.trim())) {
      setStepError('Please provide a valid business or professional email address.');
      return;
    }
    if (!phone.trim() || phone.trim().length < 7) {
      setStepError('Please provide a valid phone or WhatsApp number with country/area code.');
      return;
    }
    if (!consentAgreed) {
      setStepError('Please check the consent box so our team can review your brief and contact you.');
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
        setStepError(res.error || 'Failed to submit enquiry. Please check your details and try again.');
        return;
      }

      setSubmissionSuccess({
        referenceId: res.referenceId || 'WEB-CONFIRMED',
        clientName: fullName.trim(),
        business: businessName.trim()
      });
    } catch (err: any) {
      setStepError(err?.message || 'A network error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setSubmissionSuccess(null);
    setStepError(null);
    setFormStep(1);
    setFullName('');
    setEmail('');
    setPhone('');
    setBusinessName('');
    setExistingWebsiteUrl('');
    setReferenceUrls('');
    setAdditionalRequirements('');
    setConsentAgreed(false);
  };

  // -------------------------------------------------------------------------
  // 9 Tailored Service Cards (Section 8)
  // -------------------------------------------------------------------------
  const serviceCards = [
    {
      id: 'biz-web',
      typeValue: 'New business website',
      title: 'Business Website Design',
      shortDesc:
        'Professional websites that explain your business, establish credibility, showcase services, and help visitors get in touch.',
      icon: Building2,
      highlights: [
        'Clear value proposition & service offerings',
        'Mobile-friendly responsive layout on all devices',
        'Fast page loading & clear navigation paths',
        'Direct inquiry forms and WhatsApp click-to-chat'
      ]
    },
    {
      id: 'redesign',
      typeValue: 'Redesign an existing website',
      title: 'Website Redesign',
      shortDesc:
        'Improve an outdated, confusing, difficult-to-use, or poorly structured website into a high-performing digital asset.',
      icon: RefreshCw,
      highlights: [
        'Complete visual modernizing and brand realignment',
        'Restructured menus and streamlined page hierarchy',
        'Speed optimization & mobile experience overhaul',
        'Preservation of key search traffic and existing links'
      ]
    },
    {
      id: 'booking-web',
      typeValue: 'Booking website',
      title: 'Booking Websites',
      shortDesc:
        'Websites that help customers request or schedule appointments, reservations, or other bookings where required functionality is supported.',
      icon: CalendarCheck,
      highlights: [
        'Appointment or consultation request workflows',
        'Automated calendar sync & booking confirmations',
        'Multi-service and team staff scheduling options',
        'Mobile-optimized booking flow without clutter'
      ]
    },
    {
      id: 'lms-web',
      typeValue: 'LMS / E-learning website',
      title: 'LMS and E-learning Websites',
      shortDesc:
        'Learning platforms that may include courses, lessons, student accounts, progress tracking, assessments, and related functionality according to project requirements.',
      icon: GraduationCap,
      highlights: [
        'Curriculum hierarchy with video & lesson modules',
        'Student profile dashboards and bookmarking',
        'Automated progress tracking & certificate delivery',
        'Secure member portal and content gating'
      ]
    },
    {
      id: 'travel-web',
      typeValue: 'Travel website',
      title: 'Travel and Tourism Websites',
      shortDesc:
        'Websites for travel businesses, tours, destinations, packages, itineraries, and enquiry or booking workflows.',
      icon: Plane,
      highlights: [
        'Detailed tour itineraries and destination showcases',
        'Custom travel enquiry & quote calculation forms',
        'Photo galleries with optimized responsive imagery',
        'WhatsApp direct consultation for travelers'
      ]
    },
    {
      id: 'ecommerce',
      typeValue: 'E-commerce website',
      title: 'E-commerce Websites',
      shortDesc:
        'Online stores that present products and support suitable shopping and checkout functionality.',
      icon: ShoppingBag,
      highlights: [
        'Intuitive product catalog with search and filters',
        'Secure checkout with Razorpay, UPI, cards, and wallets',
        'Inventory management & automated order notices',
        'One-page streamlined mobile checkout experience'
      ]
    },
    {
      id: 'landing-pages',
      typeValue: 'Landing page',
      title: 'Landing Pages',
      shortDesc:
        'Focused pages designed around a particular service, campaign, product, or customer action without distracting navigation.',
      icon: MousePointerClick,
      highlights: [
        'High-converting structure crafted for single action',
        'Engineered for paid ad campaigns, launches, and events',
        'Distraction-free layout with prominent enquiry forms',
        'Rapid page load speeds and tracking pixel setup'
      ]
    },
    {
      id: 'custom-web',
      typeValue: 'Custom web application',
      title: 'Custom Web Applications',
      shortDesc:
        'Tailored web-based systems, dashboards, portals, integrations, and other agreed functionality.',
      icon: Code2,
      highlights: [
        'Tailored client account portals and dashboards',
        'Custom database logic and automated workflows',
        'API integrations with existing CRMs & internal software',
        'Secure role-based permissions and access policies'
      ]
    },
    {
      id: 'portfolio',
      typeValue: 'Portfolio / Personal brand',
      title: 'Portfolio and Personal Brand Websites',
      shortDesc:
        'Professional websites for individuals, consultants, creators, and businesses showcasing their expertise.',
      icon: UserCheck,
      highlights: [
        'Compelling bio, credentials, and personal authority',
        'Interactive case study showcases and client reels',
        'Direct booking links for keynotes and consulting',
        'Insight publishing & newsletter audience integration'
      ]
    }
  ];

  // -------------------------------------------------------------------------
  // 8 Audience Cards (Section 9)
  // -------------------------------------------------------------------------
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
      title: 'Service providers looking to generate enquiries',
      desc: 'Structure your service offerings and forms so qualified prospects easily understand your value and reach out.',
      icon: Briefcase
    },
    {
      title: 'Healthcare and appointment-based businesses',
      desc: 'Present care services with warmth and clarity, giving patients seamless ways to request appointments and find clinic info.',
      icon: CalendarCheck
    },
    {
      title: 'Education and training providers',
      desc: 'Organize courses, workshops, and student learning journeys with dependable curriculum structure and resource access.',
      icon: GraduationCap
    },
    {
      title: 'Travel and tourism businesses',
      desc: 'Showcase destinations and itineraries with captivating visual layouts and streamlined tour enquiry forms.',
      icon: Plane
    },
    {
      title: 'Businesses selling products online',
      desc: 'Set up an intuitive product catalog and dependable checkout system that customers find simple and reliable to use.',
      icon: ShoppingBag
    },
    {
      title: 'Professionals building their portfolio or personal brand',
      desc: 'Build personal authority, showcase past work, and facilitate direct client inquiries or speaking invitations.',
      icon: UserCheck
    }
  ];

  // -------------------------------------------------------------------------
  // 10 Pillars (Section 10)
  // -------------------------------------------------------------------------
  const goodWebsitePillars = [
    {
      title: 'Clear messaging & useful content',
      desc: 'Visitors should immediately understand what your business does, who you help, and why your solution matters.',
      icon: MessageSquare
    },
    {
      title: 'Mobile-friendly layouts',
      desc: 'More than 70% of business visitors browse from smartphones. Layouts must render cleanly across every device size.',
      icon: Smartphone
    },
    {
      title: 'Simple navigation',
      desc: 'Intuitive menus, sensible page hierarchy, and uncluttered layouts ensure potential customers locate key information quickly.',
      icon: Compass
    },
    {
      title: 'Easy-to-use enquiry & booking journeys',
      desc: 'Enquiry forms and booking pathways must be frictionless, welcoming, and effortless to submit.',
      icon: CalendarCheck
    },
    {
      title: 'Search-engine-friendly structure',
      desc: 'Clean semantic HTML, sensible headings, descriptive page titles, and crawlable links help search engines index your pages.',
      icon: Search
    },
    {
      title: 'Website performance',
      desc: 'Optimized image assets, streamlined code, and modern hosting standards ensure pages load quickly without frustrating delays.',
      icon: Zap
    },
    {
      title: 'Appropriate security',
      desc: 'Standard SSL encryption, explicit contact information, and transparent business credentials give prospects peace of mind.',
      icon: ShieldCheck
    },
    {
      title: 'Clear calls to action',
      desc: 'Every key page gives the visitor an obvious next step — whether sending an enquiry, booking a call, or buying a product.',
      icon: MousePointerClick
    },
    {
      title: 'Analytics & measurement where configured',
      desc: 'Understand what visitors look at and which pages generate enquiries with privacy-friendly measurement tools.',
      icon: Sparkles
    },
    {
      title: 'Content-management options where included',
      desc: 'Where agreed, we configure intuitive content tools so your team can comfortably update text or articles in-house.',
      icon: Layout
    }
  ];

  // -------------------------------------------------------------------------
  // 6 Process Steps (Section 11)
  // -------------------------------------------------------------------------
  const processSteps = [
    {
      step: 'Step 1',
      title: 'Understand Your Business',
      desc: 'We start by learning about your business, target audience, core services, and what specific outcomes you want the website to achieve.'
    },
    {
      step: 'Step 2',
      title: 'Plan the Website',
      desc: 'Together we establish the sitemap, page structure, content requirements, key features, and agreed overall scope.'
    },
    {
      step: 'Step 3',
      title: 'Design the Experience',
      desc: 'We organise information clearly and craft a visual layout that reflects your brand identity, keeping usability front and center.'
    },
    {
      step: 'Step 4',
      title: 'Build and Test',
      desc: 'We develop the agreed website, testing thoroughly across modern mobile devices, desktop browsers, forms, and core user pathways.'
    },
    {
      step: 'Step 5',
      title: 'Launch',
      desc: 'Once approved and ready, we coordinate domain routing, hosting deployment, and live verification using the agreed setup.'
    },
    {
      step: 'Step 6',
      title: 'Support and Improve',
      desc: 'Where agreed, we provide handover guidance and remain available for scheduled updates, technical maintenance, or iterative additions.'
    }
  ];

  // -------------------------------------------------------------------------
  // 13 Capabilities (Section 15)
  // -------------------------------------------------------------------------
  const capabilitiesList = [
    'Responsive mobile-friendly design',
    'Contact and enquiry forms',
    'WhatsApp contact options',
    'Booking and appointment workflows',
    'LMS and e-learning functionality',
    'E-commerce and online checkout',
    'Product or service catalogues',
    'Blogs and resource sections',
    'Customer accounts and dashboards',
    'Analytics integration',
    'Search-engine-friendly structure',
    'Third-party integrations',
    'Content management options'
  ];

  // -------------------------------------------------------------------------
  // Why DigitalMUID Principles (Section 16)
  // -------------------------------------------------------------------------
  const whyMuidPrinciples = [
    {
      title: 'Understand business needs before recommending a solution',
      desc: 'We never push pre-packaged complexity. We first evaluate what your business actually requires to succeed online.'
    },
    {
      title: 'Explain technical choices in simple language',
      desc: 'We decode hosting, domains, tech stacks, and features into plain English so you always feel confident in every decision.'
    },
    {
      title: 'Prioritise usability, clarity, and the customer journey',
      desc: 'A website must work for real humans. We design logical navigation paths that lead directly to qualified conversations.'
    },
    {
      title: 'Agree on scope and requirements before implementation',
      desc: 'No vague promises or surprise additions. Everything we build is documented and agreed before development begins.'
    },
    {
      title: 'Test important functionality before launch',
      desc: 'Every form, button, mobile breakpoint, and page link is verified before your website goes live to the public.'
    },
    {
      title: 'Communicate project expectations clearly',
      desc: 'From kickoff to final launch, you receive transparent updates and prompt answers to all questions.'
    }
  ];

  // -------------------------------------------------------------------------
  // 10 Exact FAQs (Section 17 - NO PRICING)
  // -------------------------------------------------------------------------
  const faqs = [
    {
      q: 'What type of website does my business need?',
      a: 'The right website depends entirely on your business goals. If your objective is establishing credibility and generating client enquiries, a clean business website is ideal. If you sell physical or digital goods, an e-commerce platform is required. If you schedule consultations or deliver education, booking or LMS functionality can be integrated. We help you explore options during our initial scoping discussion.'
    },
    {
      q: 'Can you redesign my existing website?',
      a: 'Yes. We regularly help companies revamp outdated, slow, or difficult-to-navigate websites. We preserve your existing brand identity, migrate important content, protect established search engine URLs where applicable, and modernize your design for mobile devices and higher conversion rates.'
    },
    {
      q: 'Can you build an LMS or e-learning website?',
      a: 'Yes. We build custom and modular e-learning platforms with structured video courses, lesson modules, student dashboards, progress tracking, and certificate delivery based on your specific curriculum and requirements.'
    },
    {
      q: 'Can you create booking websites?',
      a: 'Yes. We build appointment and scheduling workflows for consultants, healthcare clinics, service providers, and venues, allowing customers to easily request slots and receive confirmations.'
    },
    {
      q: 'Can you build websites for travel and tourism businesses?',
      a: 'Yes. We design travel platforms with destination guides, detailed tour package breakdowns, day-by-day itineraries, photo galleries, and custom itinerary quotation forms.'
    },
    {
      q: 'Can my website accept online payments?',
      a: 'Yes. Where agreed and technically appropriate for your jurisdiction, we integrate verified payment gateways such as Razorpay, Stripe, UPI, credit/debit cards, and digital wallets with secure checkout workflows.'
    },
    {
      q: 'Will my website rank on Google?',
      a: 'We build every website with clean semantic HTML, descriptive metadata, mobile optimization, fast page speeds, and sensible internal linking. These provide a solid technical SEO foundation for search engine indexing. We do not make misleading guarantees of instant first-page rankings, as long-term ranking depends on ongoing content quality, competitive authority, and search engine algorithms.'
    },
    {
      q: 'Can I update my website after launch?',
      a: 'Yes. If included in the agreed project scope, we configure straightforward content management tools so your team can easily edit text, publish articles, add case studies, or update services without technical coding knowledge.'
    },
    {
      q: 'How long does a website project take?',
      a: 'Project timelines vary based on scope, feature complexity, and content readiness. A focused landing page or business website typically takes 2 to 4 weeks. More comprehensive e-commerce stores, LMS platforms, or booking websites generally take 4 to 8 weeks. We agree on a realistic, dependable schedule before kickoff.'
    },
    {
      q: 'Can I enquire if I do not understand technical requirements?',
      a: 'Absolutely. Most of our clients are business owners, leaders, and creative professionals rather than developers. You only need to know what you want your website to achieve for your business. We will guide you through the technical choices step by step.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#07111F] text-slate-100 font-sans selection:bg-[#FF6B00] selection:text-white">
      {/* ========================================================================= */}
      {/* SECTION 1: HERO (Part B, Sec 7) */}
      {/* ========================================================================= */}
      <section className="relative pt-12 pb-20 sm:pt-20 sm:pb-28 overflow-hidden border-b border-white/10">
        {/* Subtle Ambient Background Gradients */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] sm:w-[900px] h-[400px] bg-gradient-to-tr from-[#1877F2]/15 via-[#FF6B00]/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-10 right-10 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            {/* Left Column: Heading, Supporting Text & CTAs */}
            <div className="lg:col-span-7 space-y-6 text-left">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Globe className="w-3.5 h-3.5 text-[#FF6B00]" />
                <span className="font-semibold text-slate-300">DigitalMUID Web Services</span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span>Custom Design & Full-Stack Development</span>
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-5xl font-display font-extrabold text-white tracking-tight leading-[1.15]">
                Website Design & Development Services That Help Your Business Grow
              </h1>

              <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl font-light">
                Your website is often the first place people learn about your business. DigitalMUID helps you build a professional online presence that explains what you do, builds trust, and makes it easier for customers to connect with you.
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
                  onClick={scrollToPortfolio}
                  className="px-6 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-slate-200 hover:text-white font-medium text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Eye className="w-4 h-4 text-slate-400" />
                  <span>Explore Our Work</span>
                </button>
              </div>

              {/* Verified Trust Pillars (Zero-pill text format) */}
              <div className="pt-4 border-t border-white/10 flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-slate-400">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>100% Mobile Responsive</span>
                </div>
                <span aria-hidden="true" className="text-slate-700 hidden sm:inline">·</span>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Fast Loading & SEO-Structured</span>
                </div>
                <span aria-hidden="true" className="text-slate-700 hidden sm:inline">·</span>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Real CRM-Integrated Enquiries</span>
                </div>
              </div>
            </div>

            {/* Right Column: Visual Device Mockup */}
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
                    <div className="px-3 py-1 rounded-md bg-white/5 border border-white/10 text-[11px] text-slate-300 font-mono truncate max-w-[200px]">
                      https://yourbusiness.in
                    </div>
                    <div className="w-4" />
                  </div>

                  {/* Browser Content Preview */}
                  <div className="pt-3 space-y-3">
                    {/* Mock Nav */}
                    <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-white/5 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded bg-[#FF6B00] flex items-center justify-center text-[9px] font-bold text-white">
                          M
                        </div>
                        <span className="font-bold text-white">Your Brand</span>
                      </div>
                      <div className="hidden sm:flex items-center gap-2.5 text-slate-400 text-[10px]">
                        <span>Services</span>
                        <span>Portfolio</span>
                        <span>About</span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-[#FF6B00] text-white text-[9px] font-bold">
                        Enquire
                      </span>
                    </div>

                    {/* Mock Hero Content */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-white/5 to-transparent border border-white/5 space-y-2 text-left">
                      <div className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider">
                        Tailored Online Presence
                      </div>
                      <h4 className="text-sm sm:text-base font-bold text-white leading-tight">
                        Transforming Visitors Into Qualified Customer Enquiries
                      </h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Clear messaging, mobile-first design, fast loading speeds, and an intuitive customer journey.
                      </p>
                      <div className="pt-1 flex items-center gap-2">
                        <div className="px-3 py-1 rounded bg-[#FF6B00] text-white text-[10px] font-semibold">
                          Discuss Scope
                        </div>
                        <div className="px-3 py-1 rounded bg-white/10 text-slate-300 text-[10px]">
                          View Work
                        </div>
                      </div>
                    </div>

                    {/* Mock Service Highlights */}
                    <div className="grid grid-cols-2 gap-2 text-left">
                      <div className="p-2.5 rounded-lg bg-white/5 border border-white/5 space-y-1">
                        <div className="w-5 h-5 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px]">
                          <Zap className="w-3 h-3" />
                        </div>
                        <div className="text-[11px] font-semibold text-white">Fast & Responsive</div>
                        <div className="text-[9px] text-slate-400">Flawless on phone, tablet & desktop.</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white/5 border border-white/5 space-y-1">
                        <div className="w-5 h-5 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px]">
                          <ShieldCheck className="w-3 h-3" />
                        </div>
                        <div className="text-[11px] font-semibold text-white">Trust & Credibility</div>
                        <div className="text-[9px] text-slate-400">Structured proof & clear calls to action.</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mobile Preview Overlay Badge */}
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
                  <p className="text-[9px] text-slate-400">Engineered for real conversion across smartphones.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 2: SERVICES OVERVIEW (Part B, Sec 8 - 9 Cards) */}
      {/* ========================================================================= */}
      <section id="services-section" className="py-20 sm:py-24 border-b border-white/10 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-14">
            <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
              <Sparkles className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span className="uppercase tracking-wider font-semibold text-slate-300">Service Capabilities</span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-extrabold text-white tracking-tight">
              Website Solutions for Different Business Needs
            </h2>
            <p className="text-base text-slate-300 leading-relaxed font-light">
              Whether you are building your first website, improving an existing one, or planning a more advanced online experience, we can help you explore the right solution for your goals.
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
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center border border-white/10 bg-white/5 text-[#FF6B00] group-hover:bg-[#FF6B00]/15 group-hover:border-[#FF6B00]/30 transition-all">
                        <Icon className="w-6 h-6" />
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono">Service</span>
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
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
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
            Available features depend on your project requirements, technical feasibility, third-party services, and the scope agreed for your website.
          </p>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 3: WHO WE HELP (Part B, Sec 9 - 8 Cards) */}
      {/* ========================================================================= */}
      <section className="py-20 sm:py-24 border-b border-white/10 bg-[#060E1A]/60 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-14">
            <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
              <Users className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span className="uppercase tracking-wider font-semibold text-slate-300">Tailored Partnerships</span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-extrabold text-white tracking-tight">
              Websites Designed Around Your Business Goals
            </h2>
            <p className="text-base text-slate-300 leading-relaxed font-light">
              We work with founders, leaders, and professionals across diverse stages who value clear communication and real business utility.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 4: WEBSITE QUALITY AND BENEFITS (Part B, Sec 10 - 10 Pillars) */}
      {/* ========================================================================= */}
      <section className="py-20 sm:py-24 border-b border-white/10 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-14">
            <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span className="uppercase tracking-wider font-semibold text-slate-300">Core Quality Standards</span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-extrabold text-white tracking-tight">
              More Than Just a Good-Looking Website
            </h2>
            <p className="text-base text-slate-300 leading-relaxed font-light">
              Visual aesthetics matter, but a truly successful website balances messaging clarity, technical reliability, user comfort, and conversion focus.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-5">
            {goodWebsitePillars.map((pillar, idx) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={idx}
                  className="p-5 rounded-2xl bg-[#0A1A2F]/60 border border-white/10 space-y-2.5 text-left hover:bg-[#0A1A2F] transition-all"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-white leading-tight">{pillar.title}</h3>
                  <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed">{pillar.desc}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-12 p-4 rounded-xl bg-white/5 border border-white/10 max-w-2xl mx-auto text-center text-xs text-slate-400">
            We follow proven design and development best practices without making unsupported guarantees about overnight search rankings, sudden viral traffic, or unrealistic revenue spikes.
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 5: OUR PROCESS (Part B, Sec 11 - 6 Steps) */}
      {/* ========================================================================= */}
      <section className="py-20 sm:py-24 border-b border-white/10 bg-[#060E1A]/60 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-14">
            <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
              <Layers className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span className="uppercase tracking-wider font-semibold text-slate-300">Methodology</span>
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
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-bold text-[#FF6B00]">
                    {step.step}
                  </span>
                  <span className="text-slate-500 font-mono">0{idx + 1}</span>
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
            Hosting, maintenance, copywriting, domain registration, and specialized subscriptions are agreed individually per project.
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* PART C: PORTFOLIO SECTION WITH REAL WEBSITE LINKS (Sec 12) */}
      {/* ========================================================================= */}
      <section ref={portfolioRef} id="portfolio" className="py-20 sm:py-28 border-b border-white/10 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-10">
            <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
              <Monitor className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span className="uppercase tracking-wider font-semibold text-slate-300">Client Projects & Work</span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-extrabold text-white tracking-tight">
              Our Website Portfolio
            </h2>
            <p className="text-base text-slate-300 leading-relaxed font-light">
              Explore website projects across different industries and business needs. Each project offers an example of how a website can present a brand, communicate its services, or support a customer journey.
            </p>
          </div>

          {/* Interactive Category Filter Controls (Buttons/Tabs per zero-pill discipline) */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 p-1.5 rounded-2xl bg-slate-900/90 border border-slate-800 max-w-2xl mx-auto mb-12">
            {PORTFOLIO_CATEGORIES.map((cat) => {
              const isSelected = selectedPortfolioCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedPortfolioCategory(cat)}
                  className={`px-3.5 py-1.5 text-xs font-medium rounded-xl transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#FF6B00] text-white font-semibold shadow-md shadow-[#FF6B00]/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Portfolio Grid: 8 Slots */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {filteredPortfolio.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl bg-[#0A1A2F] border border-white/10 hover:border-white/25 overflow-hidden flex flex-col justify-between transition-all duration-200 group shadow-xl"
              >
                {/* Visual Preview / Browser Frame */}
                <div>
                  <div className={`h-48 w-full bg-gradient-to-br ${item.gradientBg} p-4 border-b border-white/10 flex flex-col justify-between relative`}>
                    {/* Browser chrome header */}
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-rose-500/80" />
                        <div className="w-2 h-2 rounded-full bg-amber-500/80" />
                        <div className="w-2 h-2 rounded-full bg-emerald-500/80" />
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 truncate max-w-[170px]">
                        {item.url !== '#' ? item.url.replace('https://', '') : 'In Development'}
                      </span>
                    </div>

                    {/* Brand card representation */}
                    <div className="text-left space-y-1">
                      <div className="text-lg font-display font-bold text-white group-hover:text-[#FF6B00] transition-colors">
                        {item.name}
                      </div>
                      <div className="text-xs text-slate-400">
                        {item.category}
                      </div>
                    </div>

                    {/* Status badge */}
                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-white/10">
                      <span className="text-slate-400 text-[10px]">{item.categoryTag}</span>
                      <span className={`text-[10px] font-medium flex items-center gap-1 ${item.isVerified ? 'text-emerald-400' : 'text-amber-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${item.isVerified ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                        {item.status}
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-6 text-left space-y-4">
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed min-h-[56px]">
                      {item.description}
                    </p>

                    <div className="space-y-1.5 pt-2 border-t border-white/5">
                      {item.features.slice(0, 3).map((feat, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs text-slate-400">
                          <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span className="truncate">{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="p-6 pt-0 border-t border-white/5 grid grid-cols-2 gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => setPreviewingProject(item)}
                    className="py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview</span>
                  </button>

                  {item.url !== '#' ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2.5 px-3 rounded-xl bg-[#FF6B00] hover:bg-[#e66000] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>Visit Site</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="py-2.5 px-3 rounded-xl bg-slate-800 text-slate-500 text-xs font-semibold cursor-not-allowed"
                    >
                      Launching Soon
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PORTFOLIO PREVIEW MODAL */}
      {previewingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
          <div className="w-full max-w-2xl my-8 p-6 sm:p-8 rounded-3xl bg-[#0A1A2F] border border-white/20 shadow-2xl space-y-6 text-left relative max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-white/10">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="text-[#FF6B00] font-semibold">{previewingProject.categoryTag}</span>
                  <span aria-hidden="true">·</span>
                  <span>{previewingProject.status}</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-display font-bold text-white mt-1">
                  {previewingProject.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewingProject(null)}
                className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Simulated Desktop / Browser Preview Frame */}
            <div className="rounded-2xl border border-white/10 bg-[#07111F] p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-white/10 font-mono">
                <span>{previewingProject.url !== '#' ? previewingProject.url : 'Reserved Preview Slot'}</span>
                {previewingProject.url !== '#' && (
                  <span className="text-emerald-400 text-[11px]">Online</span>
                )}
              </div>
              <div className="p-6 rounded-xl bg-gradient-to-br from-white/5 to-transparent border border-white/5 space-y-3">
                <div className="text-xs uppercase font-semibold text-slate-400">{previewingProject.category}</div>
                <p className="text-sm text-slate-200 leading-relaxed">
                  {previewingProject.description}
                </p>
                <div className="pt-2">
                  <div className="text-xs font-semibold text-white mb-2">Key Functional Highlights:</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                    {previewingProject.features.map((feat, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  setPreviewingProject(null);
                  scrollToForm(previewingProject.category);
                }}
                className="text-xs font-semibold text-[#FF6B00] hover:underline cursor-pointer"
              >
                Discuss a similar project →
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPreviewingProject(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 cursor-pointer"
                >
                  Close
                </button>
                {previewingProject.url !== '#' && (
                  <a
                    href={previewingProject.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#e66000] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Visit Live Website</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PART D: ASSOCIATED BRANDS (Sec 13) */}
      {/* ========================================================================= */}
      <section className="py-16 sm:py-20 border-b border-white/10 bg-[#060E1A]/40 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto space-y-2 mb-10">
            <h2 className="text-xl sm:text-2xl font-display font-bold text-white tracking-tight">
              Brands and Businesses We Work With
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 font-light">
              Collaborations and digital platforms developed across creative, clinical, and corporate sectors.
            </p>
          </div>

          {/* Clean Brand Reference Grid (Text-based authority labels) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 items-center">
            {PORTFOLIO_PROJECTS.slice(0, 6).map((brand) => (
              <div
                key={brand.id}
                className="p-4 rounded-xl bg-[#0A1A2F]/50 border border-white/5 hover:border-white/15 text-center space-y-1 transition-all"
              >
                <div className="text-xs font-bold text-slate-200 tracking-wide">
                  {brand.name}
                </div>
                <div className="text-[10px] text-slate-500 truncate">
                  {brand.category.split('/')[0].trim()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* PART E: TESTIMONIALS AND REVIEWS SLIDER (Sec 14) */}
      {/* ========================================================================= */}
      <section className="py-20 sm:py-24 border-b border-white/10 relative">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-12">
            <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
              <Quote className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span className="uppercase tracking-wider font-semibold text-slate-300">Client Feedback</span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-extrabold text-white tracking-tight">
              What Our Clients Say
            </h2>
            <p className="text-base text-slate-300 leading-relaxed font-light">
              Feedback helps potential customers understand what it is like to work with a web design and development partner.
            </p>
          </div>

          {/* Testimonials Slider */}
          <div
            className="relative"
            onMouseEnter={() => setIsSliderPaused(true)}
            onMouseLeave={() => setIsSliderPaused(false)}
          >
            {/* Slide Card View */}
            <div className="overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 transition-all duration-300">
                {/* Active Card 1 */}
                {(() => {
                  const t = TESTIMONIALS[testimonialSlideIndex];
                  return (
                    <div className="p-6 sm:p-8 rounded-2xl bg-[#0A1A2F] border border-white/10 space-y-4 text-left shadow-xl flex flex-col justify-between">
                      <div className="space-y-3">
                        {/* Rating stars */}
                        <div className="flex items-center gap-1 text-[#FF6B00]">
                          {[...Array(t.rating)].map((_, i) => (
                            <Star key={i} className="w-4 h-4 fill-[#FF6B00]" />
                          ))}
                        </div>
                        <p className="text-sm sm:text-base text-slate-200 leading-relaxed italic">
                          "{t.comment}"
                        </p>
                      </div>

                      <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-white">{t.name}</div>
                          <div className="text-slate-400 text-[11px]">{t.role} · {t.businessName}</div>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">{t.verifiedSource}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Active Card 2 (Adjacent) */}
                {(() => {
                  const t = TESTIMONIALS[(testimonialSlideIndex + 1) % TESTIMONIALS.length];
                  return (
                    <div className="p-6 sm:p-8 rounded-2xl bg-[#0A1A2F] border border-white/10 space-y-4 text-left shadow-xl hidden md:flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center gap-1 text-[#FF6B00]">
                          {[...Array(t.rating)].map((_, i) => (
                            <Star key={i} className="w-4 h-4 fill-[#FF6B00]" />
                          ))}
                        </div>
                        <p className="text-sm sm:text-base text-slate-200 leading-relaxed italic">
                          "{t.comment}"
                        </p>
                      </div>

                      <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-white">{t.name}</div>
                          <div className="text-slate-400 text-[11px]">{t.role} · {t.businessName}</div>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">{t.verifiedSource}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Slider Controls */}
            <div className="flex items-center justify-between pt-8">
              <div className="flex items-center gap-2">
                {TESTIMONIALS.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setTestimonialSlideIndex(idx)}
                    className={`h-2 rounded-full transition-all cursor-pointer ${
                      testimonialSlideIndex === idx ? 'w-8 bg-[#FF6B00]' : 'w-2 bg-white/20 hover:bg-white/40'
                    }`}
                    aria-label={`Go to slide ${idx + 1}`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrevTestimonial}
                  className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Previous testimonial"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={handleNextTestimonial}
                  className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Next testimonial"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* PART F: WEBSITE CAPABILITIES & WHY US (Sec 15-16) */}
      {/* ========================================================================= */}
      <section className="py-20 sm:py-24 border-b border-white/10 bg-[#060E1A]/60 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            {/* Left Col: 13 Features Grid */}
            <div className="lg:col-span-6 space-y-6 text-left">
              <div className="space-y-2">
                <div className="text-xs font-semibold text-[#FF6B00] uppercase tracking-wider">
                  Technical Deliverables
                </div>
                <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-white">
                  What Your Website Can Include
                </h2>
                <p className="text-sm text-slate-300 font-light">
                  Available features depend on your project requirements, technical feasibility, third-party services, and the scope agreed for your website.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {capabilitiesList.map((cap, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-[#0A1A2F] border border-white/5 flex items-center gap-2.5 text-xs text-slate-200"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{cap}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Col: Why DigitalMUID Principles */}
            <div className="lg:col-span-6 space-y-6 text-left">
              <div className="space-y-2">
                <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
                  Working Principles
                </div>
                <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-white">
                  A Practical Approach to Building Your Website
                </h2>
                <p className="text-sm text-slate-300 font-light">
                  How we operate to ensure clarity, predictable schedules, and dependable project execution.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                {whyMuidPrinciples.map((principle, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-[#0A1A2F] border border-white/5 space-y-1 text-left"
                  >
                    <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-white/10 text-[#FF6B00] flex items-center justify-center text-[10px] font-mono">
                        {idx + 1}
                      </span>
                      <span>{principle.title}</span>
                    </h3>
                    <p className="text-xs text-slate-300 pl-7 leading-relaxed font-light">
                      {principle.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* PART F: FREQUENTLY ASKED QUESTIONS (Sec 17 - 10 Exact FAQs) */}
      {/* ========================================================================= */}
      <section className="py-20 sm:py-24 border-b border-white/10 relative">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-12">
            <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
              <HelpCircle className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span className="uppercase tracking-wider font-semibold text-slate-300">Common Inquiries</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-white tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-light">
              Clear, honest answers to help you navigate your website project choices.
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div
                  key={index}
                  className="rounded-2xl bg-[#0A1A2F]/80 border border-white/10 overflow-hidden transition-all text-left"
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
                    <div className="px-5 pb-5 sm:px-6 sm:pb-6 text-xs sm:text-sm text-slate-300 leading-relaxed border-t border-white/5 pt-4 font-light">
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
      {/* PART G: 4-STEP DEDICATED WEBSITE PROJECT ENQUIRY FORM (Sec 18) */}
      {/* ========================================================================= */}
      <section ref={formRef} id="enquiry-form" className="py-20 sm:py-28 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-gradient-to-tr from-[#FF6B00]/10 via-[#1877F2]/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-10">
            <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
              <Send className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span className="uppercase tracking-wider font-semibold text-slate-300">Project Discovery Brief</span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-extrabold text-white tracking-tight">
              Tell Us About Your Website Project
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl mx-auto font-light">
              Share a few details about your business and what you want your website to achieve. You do not need technical knowledge to complete this form. Your answers will help us understand your needs and discuss suitable next steps.
            </p>
          </div>

          {/* CONFIRMATION SCREEN */}
          {submissionSuccess ? (
            <div className="p-8 sm:p-12 rounded-3xl bg-[#0A1A2F] border border-emerald-500/30 shadow-2xl text-center space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <div className="inline-block px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-mono font-bold tracking-wider">
                  Enquiry Reference: {submissionSuccess.referenceId}
                </div>
                <h3 className="text-2xl sm:text-3xl font-display font-bold text-white">
                  Thank You, {submissionSuccess.clientName}!
                </h3>
                <p className="text-slate-300 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
                  Your project enquiry for <strong className="text-white">{submissionSuccess.business}</strong> has been logged into our CRM. Our team will review your requirements and reach out within 1 business day.
                </p>
              </div>

              <div className="p-4 sm:p-6 rounded-2xl bg-white/5 border border-white/10 max-w-lg mx-auto text-left text-xs sm:text-sm space-y-2 text-slate-300">
                <p className="font-semibold text-white">What happens next?</p>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-[#FF6B00]">1.</span>
                  <span>We inspect your goals, timeline, and reference notes.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-[#FF6B00]">2.</span>
                  <span>We confirm receipt and clarify any specific questions via email or WhatsApp.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-[#FF6B00]">3.</span>
                  <span>We schedule an initial discussion to agree on scope before any commitment.</span>
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
            /* 4-STEP FORM CONTAINER */
            <div className="p-6 sm:p-10 rounded-3xl bg-[#0A1A2F] border border-white/15 shadow-2xl space-y-8">
              {/* Progress Indicator */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-white">Step {formStep} of 4</span>
                  <span>
                    {formStep === 1 && 'About Your Business'}
                    {formStep === 2 && 'What Do You Need?'}
                    {formStep === 3 && 'Timeline & Readiness'}
                    {formStep === 4 && 'Contact Information'}
                  </span>
                </div>
                {/* Visual Progress Bar */}
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-[#FF6B00] transition-all duration-300 rounded-full"
                    style={{ width: `${(formStep / 4) * 100}%` }}
                  />
                </div>
                {/* Step labels */}
                <div className="grid grid-cols-4 gap-2 text-[11px] text-center text-slate-500 font-medium">
                  <span className={formStep >= 1 ? 'text-[#FF6B00]' : ''}>1. Business</span>
                  <span className={formStep >= 2 ? 'text-[#FF6B00]' : ''}>2. Requirements</span>
                  <span className={formStep >= 3 ? 'text-[#FF6B00]' : ''}>3. Timeline</span>
                  <span className={formStep >= 4 ? 'text-[#FF6B00]' : ''}>4. Contact</span>
                </div>
              </div>

              {stepError && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-3 text-xs sm:text-sm text-left">
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-white">Please check: </span>
                    {stepError}
                  </div>
                </div>
              )}

              {/* STEP 1: ABOUT YOUR BUSINESS */}
              {formStep === 1 && (
                <div className="space-y-6 text-left">
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-white uppercase tracking-wider">
                      Project Type <span className="text-rose-400">*</span>
                    </label>
                    <p className="text-xs text-slate-400">Select the primary type of website you are planning.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      {PROJECT_TYPES.map((type) => {
                        const isSelected = projectType === type;
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setProjectType(type)}
                            className={`p-3.5 rounded-xl text-left text-xs font-medium border transition-all cursor-pointer flex items-center justify-between ${
                              isSelected
                                ? 'bg-[#FF6B00]/15 border-[#FF6B00] text-white shadow-md shadow-[#FF6B00]/10 font-bold'
                                : 'bg-[#07111F] border-white/10 text-slate-300 hover:border-white/20 hover:text-white'
                            }`}
                          >
                            <span>{type}</span>
                            {isSelected && <Check className="w-4 h-4 text-[#FF6B00] shrink-0 ml-1.5" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-xs font-semibold text-white uppercase tracking-wider mb-1">
                        Business or Project Name <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="e.g. Acme Tech Solutions"
                        className="w-full px-4 py-3 rounded-xl bg-[#07111F] border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#FF6B00]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-white uppercase tracking-wider mb-1">
                        Business Stage <span className="text-rose-400">*</span>
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
                  </div>
                </div>
              )}

              {/* STEP 2: WHAT DO YOU NEED? */}
              {formStep === 2 && (
                <div className="space-y-6 text-left">
                  <div>
                    <label className="block text-xs font-semibold text-white uppercase tracking-wider mb-1">
                      Main Website Goals <span className="text-rose-400">*</span>
                    </label>
                    <p className="text-xs text-slate-400 mb-2.5">Select all outcomes you want the website to achieve.</p>
                    <div className="flex flex-wrap gap-2">
                      {GOAL_OPTIONS.map((goal) => {
                        const isSelected = selectedGoals.includes(goal);
                        return (
                          <button
                            key={goal}
                            type="button"
                            onClick={() => toggleGoal(goal)}
                            className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
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

                  <div>
                    <label className="block text-xs font-semibold text-white uppercase tracking-wider mb-1">
                      Features You May Need <span className="text-rose-400">*</span>
                    </label>
                    <p className="text-xs text-slate-400 mb-2.5">Select functionality you would like included.</p>
                    <div className="flex flex-wrap gap-2">
                      {FEATURE_OPTIONS.map((feat) => {
                        const isSelected = selectedFeatures.includes(feat);
                        return (
                          <button
                            key={feat}
                            type="button"
                            onClick={() => toggleFeature(feat)}
                            className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-xs font-semibold text-white uppercase tracking-wider mb-1">
                        Content Readiness <span className="text-rose-400">*</span>
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
                      <label className="block text-xs font-semibold text-white uppercase tracking-wider mb-1">
                        Existing Website URL <span className="text-slate-500">(Optional)</span>
                      </label>
                      <input
                        type="url"
                        value={existingWebsiteUrl}
                        onChange={(e) => setExistingWebsiteUrl(e.target.value)}
                        placeholder="https://example.com"
                        className="w-full px-4 py-3 rounded-xl bg-[#07111F] border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#FF6B00]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-white uppercase tracking-wider mb-1">
                      Reference Website URLs <span className="text-slate-500">(Optional inspiration)</span>
                    </label>
                    <input
                      type="text"
                      value={referenceUrls}
                      onChange={(e) => setReferenceUrls(e.target.value)}
                      placeholder="e.g. stripe.com, apple.com"
                      className="w-full px-4 py-3 rounded-xl bg-[#07111F] border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#FF6B00]"
                    />
                  </div>
                </div>
              )}

              {/* STEP 3: TIMELINE AND READINESS */}
              {formStep === 3 && (
                <div className="space-y-6 text-left">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-white uppercase tracking-wider mb-1">
                        Expected Project Timeline <span className="text-rose-400">*</span>
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

                    <div>
                      <label className="block text-xs font-semibold text-white uppercase tracking-wider mb-1">
                        Current Readiness <span className="text-rose-400">*</span>
                      </label>
                      <select
                        value={readiness}
                        onChange={(e) => setReadiness(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-[#07111F] border border-white/10 text-white text-xs sm:text-sm focus:outline-none focus:border-[#FF6B00]"
                      >
                        {READINESS_OPTIONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-white uppercase tracking-wider mb-1">
                      Decision-Making Responsibility <span className="text-rose-400">*</span>
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

                  <div>
                    <label className="block text-xs font-semibold text-white uppercase tracking-wider mb-1">
                      Additional Requirements or Questions <span className="text-slate-500">(Optional)</span>
                    </label>
                    <textarea
                      rows={4}
                      value={additionalRequirements}
                      onChange={(e) => setAdditionalRequirements(e.target.value)}
                      placeholder="Share details about your audience, special functionality, integrations, or specific questions..."
                      className="w-full px-4 py-3 rounded-xl bg-[#07111F] border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#FF6B00]"
                    />
                  </div>
                </div>
              )}

              {/* STEP 4: CONTACT DETAILS */}
              {formStep === 4 && (
                <div className="space-y-6 text-left">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-white uppercase tracking-wider mb-1">
                        Full Name <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Alex Johnson"
                        className="w-full px-4 py-3 rounded-xl bg-[#07111F] border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#FF6B00]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-white uppercase tracking-wider mb-1">
                        Business Email <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. alex@company.com"
                        className="w-full px-4 py-3 rounded-xl bg-[#07111F] border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#FF6B00]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-white uppercase tracking-wider mb-1">
                      Phone or WhatsApp Number <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. +91 98765 43210"
                      className="w-full px-4 py-3 rounded-xl bg-[#07111F] border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#FF6B00]"
                    />
                  </div>

                  {/* Summary Review of Brief */}
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2 text-xs text-slate-300">
                    <div className="font-semibold text-white">Brief Summary Before Sending:</div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] pt-1">
                      <div><span className="text-slate-500">Project:</span> <strong className="text-white">{projectType}</strong></div>
                      <div><span className="text-slate-500">Business:</span> <strong className="text-white">{businessName}</strong></div>
                      <div><span className="text-slate-500">Timeline:</span> <strong className="text-white">{timeline}</strong></div>
                    </div>
                  </div>

                  {/* Privacy Notice & Consent (Never pre-checked) */}
                  <div className="space-y-3 pt-2">
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Privacy Notice: The submitted information is strictly used to evaluate your project brief, discuss suitable next steps, and contact you directly. We do not sell or share your information.
                    </p>

                    <label className="flex items-start gap-3 text-xs text-slate-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        required
                        checked={consentAgreed}
                        onChange={(e) => setConsentAgreed(e.target.checked)}
                        className="w-4 h-4 rounded border-white/20 bg-[#07111F] text-[#FF6B00] focus:ring-[#FF6B00] mt-0.5"
                      />
                      <span>
                        I confirm this is a genuine business enquiry, and I agree to be contacted by DigitalMUID regarding my website project requirements.
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* Form Controls: Back, Continue, Submit */}
              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                {formStep > 1 ? (
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                ) : (
                  <div />
                )}

                {formStep < 4 ? (
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="px-7 py-3 rounded-xl bg-[#FF6B00] hover:bg-[#e66000] text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <span>Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleSubmit}
                    className="px-8 py-3.5 rounded-xl bg-[#FF6B00] hover:bg-[#e66000] disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-xl shadow-[#FF6B00]/25 cursor-pointer transition-all"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Submitting Brief...</span>
                      </>
                    ) : (
                      <>
                        <span>Submit Project Brief</span>
                        <Send className="w-4 h-4" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
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
