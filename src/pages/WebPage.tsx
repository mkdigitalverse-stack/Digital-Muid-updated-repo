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
  ExternalLink,
  ChevronDown,
  Building2,
  CalendarCheck,
  GraduationCap,
  Plane,
  Eye,
  Check,
  ChevronLeft,
  ChevronRight,
  Star,
  Quote,
  Sparkles,
  HelpCircle,
  Clock,
  Compass,
  MessageSquare,
  Lock,
  Layers,
  Send,
  Users,
  Briefcase,
  Rocket
} from 'lucide-react';
import { webEnquiryService } from '../services/webEnquiryService';

// =========================================================================
// TYPES & CONSTANTS
// =========================================================================

interface WebPageProps {
  navigate: (path: string) => void;
}

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
  'Not sure yet — need guidance'
];

export const BUSINESS_STAGES = [
  'Early idea or planning stage',
  'Newly launched business',
  'Established business looking to grow',
  'Expanding or redesigning an existing presence'
];

export const GOALS_OPTIONS = [
  'Generate relevant enquiries',
  'Present my business professionally',
  'Showcase past work & portfolio',
  'Sell products online (E-commerce)',
  'Accept online bookings or appointments',
  'Provide online learning or courses',
  'Present travel packages and itineraries',
  'Publish content, articles, or resources',
  'Improve an existing website',
  'Other custom requirement'
];

export const FEATURES_OPTIONS = [
  'Contact form',
  'WhatsApp contact',
  'Online payments',
  'Booking functionality',
  'LMS / student dashboard',
  'E-commerce store',
  'Blog or CMS',
  'Customer login / portal',
  'Third-party software integration',
  'Not sure — need guidance'
];

export const CONTENT_READINESS_OPTIONS = [
  'Content is ready (text and images prepared)',
  'Content is partially ready',
  'Need help organizing and preparing content'
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
    gradientBg: 'from-amber-100 via-orange-50 to-slate-100'
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
    gradientBg: 'from-emerald-100 via-teal-50 to-slate-100'
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
    gradientBg: 'from-blue-100 via-indigo-50 to-slate-100'
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
    gradientBg: 'from-purple-100 via-violet-50 to-slate-100'
  },
  {
    id: 'mk-digitalverse',
    name: 'MK Digitalverse',
    url: 'https://mkdigitalverse.in',
    category: 'Digital Agency & Solutions Website',
    categoryTag: 'Digital & Tech',
    description:
      'Performance-focused agency website showcasing digital marketing solutions, case studies, technology competencies, and client consultation funnels.',
    features: ['Full-stack service matrix', 'Client growth case study previews', 'Integrated lead intake forms', 'Modern typography & clean design'],
    isVerified: true,
    status: 'Live Website',
    gradientBg: 'from-cyan-100 via-sky-50 to-slate-100'
  },
  {
    id: 'the-venetian-garden',
    name: 'The Venetian Garden',
    url: 'https://www.thevenetiangarden.in',
    category: 'Venue & Event Hospitality Website',
    categoryTag: 'Venue & Events',
    description:
      'Visual hospitality and event venue presentation featuring venue space photos, event packages, and venue booking enquiry forms.',
    features: ['Interactive venue space gallery', 'Event package breakdowns', 'Direct booking & date enquiry form', 'Location & visitor directions'],
    isVerified: true,
    status: 'Live Website',
    gradientBg: 'from-rose-100 via-pink-50 to-slate-100'
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
    gradientBg: 'from-slate-100 via-slate-50 to-slate-200'
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
    gradientBg: 'from-slate-100 via-slate-50 to-slate-200'
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
          url: 'https://digitalmuid.in/web',
          description:
            'Professional website design and development services helping businesses build credible online presence, custom web applications, LMS portals, and booking platforms.',
          serviceType: 'Website Design and Web Development',
          areaServed: 'Worldwide'
        },
        {
          '@type': 'WebPage',
          '@id': 'https://digitalmuid.in/web#webpage',
          url: 'https://digitalmuid.in/web',
          name: 'Website Design & Development Services | DigitalMUID',
          description:
            'Explore website design and development services from DigitalMUID. Discuss your business website, redesign, e-commerce, LMS, booking website, travel website, or custom web development requirements.'
        }
      ]
    });
    document.head.appendChild(script);

    // Scroll to top on mount
    window.scrollTo({ top: 0, behavior: 'instant' });

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
        referenceId: res.referenceId || 'MUID-WEB',
        clientName: fullName.trim(),
        business: businessName.trim()
      });
    } catch (err: any) {
      setStepError(err.message || 'Network error occurred while submitting. Please try again.');
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
  // 9 Tailored Service Cards (Section B)
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
        'Product catalogs with organized categories',
        'Frictionless mobile cart & checkout experience',
        'Secure payment gateway integrations',
        'Inventory tracking & order notification setup'
      ]
    },
    {
      id: 'landing-page',
      typeValue: 'Landing page',
      title: 'Landing Page Design',
      shortDesc:
        'Focused single-page websites designed to explain a specific service, product, campaign, or offer with a clear call to action.',
      icon: Layout,
      highlights: [
        'Distraction-free high-conversion layout',
        'Persuasive copy hierarchy & proof points',
        'Fast mobile load speed for ad campaigns',
        'Lead capture form with instant CRM integration'
      ]
    },
    {
      id: 'custom-web-app',
      typeValue: 'Custom web application',
      title: 'Custom Web Application Development',
      shortDesc:
        'Websites and portals with tailored functionality, user logins, data workflows, or custom business logic.',
      icon: Code2,
      highlights: [
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
  // 8 Audience Cards (Section C)
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
  // 10 Pillars (Section D)
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
      title: 'Logical structure for search engines (SEO)',
      desc: 'Clean semantic HTML tags, metadata, fast load speeds, and well-structured headings support search visibility.',
      icon: Search
    },
    {
      title: 'Fast page loading speed',
      desc: 'Optimized image assets and clean code reduce bounce rates and keep visitors engaged on your website.',
      icon: Zap
    },
    {
      title: 'Clear visual trust factors',
      desc: 'Legible typography, coherent brand colors, transparent contact channels, and consistent layouts build credibility.',
      icon: ShieldCheck
    },
    {
      title: 'Security and data protection',
      desc: 'Modern HTTPS encryption, secure form processing, and spam protection keep client information safe.',
      icon: Lock
    },
    {
      title: 'Useful integrations where needed',
      desc: 'Connect your website to payment gateways, analytics tools, CRM pipelines, and messaging channels.',
      icon: Layers
    },
    {
      title: 'Maintainability and growth readiness',
      desc: 'A modular foundation that can expand as your business introduces new offerings or expands into new markets.',
      icon: Clock
    }
  ];

  // -------------------------------------------------------------------------
  // 6 Process Steps (Section E)
  // -------------------------------------------------------------------------
  const processSteps = [
    {
      step: 'Step 1',
      title: 'Understand Goals and Scope',
      desc: 'We discuss your business, target audience, preferred website type, and must-have functionality before suggesting a path.'
    },
    {
      step: 'Step 2',
      title: 'Plan the Structure',
      desc: 'We map out the sitemap, page hierarchy, and essential content requirements to ensure intuitive user flows.'
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
  // Capabilities & Why DigitalMUID Principles (Section I)
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
    }
  ];

  // -------------------------------------------------------------------------
  // FAQs (Section J)
  // -------------------------------------------------------------------------
  const faqs = [
    {
      q: 'What types of websites can DigitalMUID develop?',
      a: 'We develop business websites, website redesigns, booking websites, LMS and e-learning portals, travel and tourism platforms, e-commerce stores, landing pages, custom web applications, and personal brand portfolios.'
    },
    {
      q: 'Can you redesign an existing website?',
      a: 'Yes. We frequently help businesses modernize older, slow, or poorly structured websites. We improve aesthetics, optimize mobile responsiveness, clean up navigation paths, and ensure your critical content and search visibility are preserved.'
    },
    {
      q: 'Can a website be designed for mobile users?',
      a: 'Every website we build is fully responsive by default. We design layouts, tap targets, font sizes, and forms specifically to provide an effortless experience on smartphones, tablets, laptops, and desktop screens.'
    },
    {
      q: 'Can booking or payment functionality be integrated?',
      a: 'Yes, where suitable for your business model and technical requirements. We can integrate online payment gateways (like Razorpay, Stripe, or UPI) and structured booking or consultation scheduling systems.'
    },
    {
      q: 'Can you develop an LMS or e-learning website?',
      a: 'Yes. We design educational websites and learning management systems with course modules, video lessons, student dashboards, resource downloads, and progress tracking tailored to course creators and training academies.'
    },
    {
      q: 'Can you help with SEO-friendly website structure?',
      a: 'Yes. We build websites using semantic HTML, clean URL structures, fast loading speeds, meta tag optimization, OpenGraph social cards, and schema structured data to give your business a solid foundation for search engines.'
    },
    {
      q: 'What information should I prepare before starting?',
      a: 'It is helpful to have an overview of your business services, target audience, preferred branding guidelines or colors, and any reference websites you admire. If your copy and media are still being prepared, we can guide you through structuring them.'
    },
    {
      q: 'Can I discuss a project even if my requirements are not finalized?',
      a: 'Yes. You do not need a completed specification document to start. Simply share your general goals and current business stage through our enquiry form, and we will help you clarify what makes practical sense for your scope and timeline.'
    },
    {
      q: 'How long does a typical website project take?',
      a: 'Timelines depend on scope and readiness. A focused landing page or small business website may take 2 to 3 weeks, while comprehensive platforms, e-commerce stores, or custom LMS portals typically take 4 to 8 weeks with agreed milestones.'
    },
    {
      q: 'Do I need technical skills to manage my website after launch?',
      a: 'No. Most of our clients are business owners, leaders, and creative professionals rather than developers. You only need to know what you want your website to achieve for your business. We will guide you through the technical choices step by step.'
    }
  ];

  // =========================================================================
  // RENDER (70% Light / 20% Blue / 10% Orange Visual Balance)
  // =========================================================================

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans selection:bg-[#FF6B00] selection:text-white">
      {/* ========================================================================= */}
      {/* SECTION A: HERO (Light 70% foundation with brand blue typography & orange CTA) */}
      {/* ========================================================================= */}
      <section className="relative pt-12 pb-20 sm:pt-20 sm:pb-28 overflow-hidden bg-gradient-to-b from-white via-slate-50 to-[#F8FAFC] border-b border-slate-200/80">
        {/* Subtle Ambient Brand Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] sm:w-[900px] h-[400px] bg-gradient-to-tr from-[#1877F2]/10 via-[#FF6B00]/5 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-10 right-10 w-72 h-72 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            {/* Left Column: Heading, Supporting Text & CTAs */}
            <div className="lg:col-span-7 space-y-6 text-left">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Globe className="w-3.5 h-3.5 text-[#FF6B00]" />
                <span className="font-semibold text-[#0A1A2F]">DigitalMUID Web Services</span>
                <span aria-hidden="true" className="text-slate-400">·</span>
                <span>Custom Design & Web Development</span>
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-5xl font-display font-extrabold text-[#0A1A2F] tracking-tight leading-[1.15]">
                Website Design & Development Services That Help Your Business Grow
              </h1>

              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl font-normal">
                Your website should do more than look good. DigitalMUID helps businesses create professional, user-friendly websites that communicate clearly, build trust, showcase services, and support business growth.
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
                  className="px-6 py-3.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-[#0A1A2F] font-semibold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                >
                  <Eye className="w-4 h-4 text-slate-500" />
                  <span>Explore Our Work</span>
                </button>
              </div>

              {/* Verified Trust Pillars */}
              <div className="pt-4 border-t border-slate-200/80 flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-slate-600">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-medium text-slate-700">100% Mobile Responsive</span>
                </div>
                <span aria-hidden="true" className="text-slate-300 hidden sm:inline">·</span>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-medium text-slate-700">Fast Loading & SEO-Structured</span>
                </div>
                <span aria-hidden="true" className="text-slate-300 hidden sm:inline">·</span>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-medium text-slate-700">Real CRM-Integrated Enquiries</span>
                </div>
              </div>
            </div>

            {/* Right Column: Visual Device Mockup (Clean Light/Dark Hybrid Frame) */}
            <div className="lg:col-span-5">
              <div className="relative mx-auto max-w-md lg:max-w-none">
                {/* Desktop Screen Mockup Frame */}
                <div className="rounded-2xl bg-white border border-slate-200 shadow-2xl p-3 sm:p-4 relative overflow-hidden">
                  {/* Browser Bar */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-xs text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    </div>
                    <div className="px-3 py-1 rounded-md bg-slate-100 text-[11px] text-slate-600 font-mono truncate max-w-[200px]">
                      https://yourbusiness.in
                    </div>
                    <div className="w-4" />
                  </div>

                  {/* Browser Content Preview */}
                  <div className="pt-3 space-y-3">
                    {/* Mock Nav */}
                    <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-100 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded bg-[#FF6B00] flex items-center justify-center text-[9px] font-bold text-white">
                          M
                        </div>
                        <span className="font-bold text-[#0A1A2F]">Your Brand</span>
                      </div>
                      <div className="hidden sm:flex items-center gap-2.5 text-slate-500 text-[10px]">
                        <span>Services</span>
                        <span>Portfolio</span>
                        <span>About</span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-[#FF6B00] text-white text-[9px] font-bold">
                        Enquire
                      </span>
                    </div>

                    {/* Mock Hero Content */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50/60 to-slate-50 border border-blue-100 space-y-2 text-left">
                      <div className="text-[10px] text-[#1877F2] font-bold uppercase tracking-wider">
                        Tailored Online Presence
                      </div>
                      <h4 className="text-sm sm:text-base font-bold text-[#0A1A2F] leading-tight">
                        Transforming Visitors Into Qualified Customer Enquiries
                      </h4>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Clear messaging, mobile-first design, fast loading speeds, and an intuitive customer journey.
                      </p>
                      <div className="pt-1 flex items-center gap-2">
                        <div className="px-3 py-1 rounded bg-[#FF6B00] text-white text-[10px] font-semibold">
                          Discuss Scope
                        </div>
                        <div className="px-3 py-1 rounded bg-white border border-slate-200 text-slate-700 text-[10px] font-medium">
                          View Work
                        </div>
                      </div>
                    </div>

                    {/* Mock Service Highlights */}
                    <div className="grid grid-cols-2 gap-2 text-left">
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
                        <div className="w-5 h-5 rounded bg-blue-100 text-[#1877F2] flex items-center justify-center text-[10px]">
                          <Zap className="w-3 h-3" />
                        </div>
                        <div className="text-[11px] font-semibold text-[#0A1A2F]">Fast & Responsive</div>
                        <div className="text-[9px] text-slate-500">Flawless on phone, tablet & desktop.</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
                        <div className="w-5 h-5 rounded bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px]">
                          <ShieldCheck className="w-3 h-3" />
                        </div>
                        <div className="text-[11px] font-semibold text-[#0A1A2F]">Trust & Credibility</div>
                        <div className="text-[9px] text-slate-500">Structured proof & clear conversion.</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mobile Preview Overlay Badge */}
                <div className="absolute -bottom-5 -right-3 sm:-right-5 w-44 sm:w-48 p-3 rounded-xl bg-white border border-slate-200 shadow-xl space-y-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-semibold text-[#0A1A2F] flex items-center gap-1">
                      <Smartphone className="w-3 h-3 text-[#FF6B00]" />
                      Mobile Optimized
                    </span>
                    <span className="text-emerald-600 font-bold">Fast</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full w-4/5" />
                  </div>
                  <p className="text-[9px] text-slate-500">Engineered for real conversion across smartphones.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION B: WEBSITE SERVICES (Light 70% with 9 Service Cards) */}
      {/* ========================================================================= */}
      <section id="services-section" className="py-20 sm:py-24 bg-white border-b border-slate-200/80 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-14">
            <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
              <Sparkles className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span className="uppercase tracking-wider font-semibold text-[#0A1A2F]">Service Capabilities</span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-extrabold text-[#0A1A2F] tracking-tight">
              Website Solutions for Different Business Needs
            </h2>
            <p className="text-base text-slate-600 leading-relaxed font-normal">
              Whether you are building your first website, improving an existing one, or planning a more advanced online experience, we can help you explore the right solution for your goals.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {serviceCards.map((service) => {
              const Icon = service.icon;
              return (
                <div
                  key={service.id}
                  className="rounded-2xl bg-slate-50/80 hover:bg-white border border-slate-200/90 hover:border-blue-400/60 p-6 sm:p-7 flex flex-col justify-between transition-all duration-200 group shadow-sm hover:shadow-md"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center border border-blue-100 bg-blue-50 text-[#1877F2] group-hover:bg-[#FF6B00] group-hover:text-white group-hover:border-[#FF6B00] transition-all">
                        <Icon className="w-6 h-6" />
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">Service</span>
                    </div>

                    <div>
                      <h3 className="text-lg sm:text-xl font-display font-bold text-[#0A1A2F] group-hover:text-[#1877F2] transition-colors">
                        {service.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                        {service.shortDesc}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 space-y-2">
                      {service.highlights.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-6 mt-6 border-t border-slate-200/70">
                    <button
                      type="button"
                      onClick={() => scrollToForm(service.typeValue)}
                      className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-[#FF6B00] text-slate-700 hover:text-white border border-slate-300 hover:border-[#FF6B00] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm hover:shadow"
                    >
                      <span>Discuss This Service</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-center text-xs text-slate-500 mt-8 max-w-2xl mx-auto">
            Available features depend on your project requirements, technical feasibility, third-party services, and the scope agreed for your website.
          </p>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION C: WHO WE HELP (Light 70% with 8 Audience Cards) */}
      {/* ========================================================================= */}
      <section className="py-20 sm:py-24 bg-[#F8FAFC] border-b border-slate-200/80 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-14">
            <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
              <Users className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span className="uppercase tracking-wider font-semibold text-[#0A1A2F]">Audience Alignment</span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-extrabold text-[#0A1A2F] tracking-tight">
              Websites Designed Around Your Business Goals
            </h2>
            <p className="text-base text-slate-600 leading-relaxed font-normal">
              We work with founders, leaders, and professionals across diverse stages who value clear communication and real business utility.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {whoWeHelpList.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className="rounded-2xl bg-white border border-slate-200 p-6 space-y-3 hover:border-blue-400/50 hover:shadow-md transition-all text-left shadow-sm"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#1877F2]">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-[#0A1A2F]">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION D: WHAT MAKES A USEFUL BUSINESS WEBSITE? (10 Quality Pillars) */}
      {/* ========================================================================= */}
      <section className="py-20 sm:py-24 bg-white border-b border-slate-200/80 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-14">
            <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span className="uppercase tracking-wider font-semibold text-[#0A1A2F]">Core Standards</span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-extrabold text-[#0A1A2F] tracking-tight">
              What Makes a Useful Business Website?
            </h2>
            <p className="text-base text-slate-600 leading-relaxed font-normal">
              Visual aesthetics matter, but a truly successful website balances messaging clarity, technical reliability, user comfort, and conversion focus.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-5">
            {goodWebsitePillars.map((pillar, idx) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={idx}
                  className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5 text-left hover:bg-white hover:shadow-md transition-all"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 text-[#1877F2] flex items-center justify-center">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-[#0A1A2F] leading-tight">{pillar.title}</h3>
                  <p className="text-[11px] sm:text-xs text-slate-600 leading-relaxed">{pillar.desc}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-12 p-4 rounded-xl bg-slate-50 border border-slate-200 max-w-2xl mx-auto text-center text-xs text-slate-500">
            We follow proven design and development best practices without making unsupported guarantees about overnight search rankings, sudden viral traffic, or unrealistic revenue spikes.
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION E: OUR PROCESS (20% Brand Blue Section Transition) */}
      {/* ========================================================================= */}
      <section className="py-20 sm:py-24 bg-[#0A1A2F] text-white border-b border-[#0A1A2F] relative">
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
                className="relative rounded-2xl bg-[#0F233A] border border-white/10 p-6 sm:p-7 space-y-3 text-left hover:border-white/25 transition-all shadow-lg"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-bold text-[#FF6B00]">
                    {step.step}
                  </span>
                  <span className="text-slate-400 font-mono">0{idx + 1}</span>
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
      {/* SECTION F: PORTFOLIO SHOWCASE (Light 70% with verified project links) */}
      {/* ========================================================================= */}
      <section ref={portfolioRef} id="portfolio" className="py-20 sm:py-28 bg-[#F8FAFC] border-b border-slate-200/80 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-10">
            <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
              <Monitor className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span className="uppercase tracking-wider font-semibold text-[#0A1A2F]">Portfolio & Case Studies</span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-extrabold text-[#0A1A2F] tracking-tight">
              Our Website Portfolio
            </h2>
            <p className="text-base text-slate-600 leading-relaxed font-normal">
              Explore website projects across different industries and business needs. Each project offers an example of how a website can present a brand, communicate its services, or support a customer journey.
            </p>
          </div>

          {/* Interactive Category Filter Controls (Zero-pill button group) */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 p-1.5 rounded-2xl bg-white border border-slate-200 shadow-sm max-w-2xl mx-auto mb-12">
            {PORTFOLIO_CATEGORIES.map((cat) => {
              const isSelected = selectedPortfolioCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedPortfolioCategory(cat)}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#FF6B00] text-white shadow-md shadow-[#FF6B00]/20'
                      : 'text-slate-600 hover:text-[#0A1A2F] hover:bg-slate-100'
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
                className="rounded-2xl bg-white border border-slate-200/90 hover:border-blue-400/60 overflow-hidden flex flex-col justify-between transition-all duration-200 group shadow-sm hover:shadow-lg"
              >
                {/* Visual Preview / Browser Frame */}
                <div>
                  <div className={`h-48 w-full bg-gradient-to-br ${item.gradientBg} p-4 border-b border-slate-200 flex flex-col justify-between relative`}>
                    {/* Browser chrome header */}
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-rose-400" />
                        <div className="w-2 h-2 rounded-full bg-amber-400" />
                        <div className="w-2 h-2 rounded-full bg-emerald-400" />
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 truncate max-w-[170px]">
                        {item.url !== '#' ? item.url.replace('https://', '') : 'In Development'}
                      </span>
                    </div>

                    {/* Brand card representation */}
                    <div className="text-left space-y-1">
                      <div className="text-lg font-display font-bold text-[#0A1A2F] group-hover:text-[#1877F2] transition-colors">
                        {item.name}
                      </div>
                      <div className="text-xs text-slate-600">
                        {item.category}
                      </div>
                    </div>

                    {/* Status badge */}
                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60">
                      <span className="text-slate-500 text-[10px] font-medium">{item.categoryTag}</span>
                      <span className={`text-[10px] font-semibold flex items-center gap-1 ${item.isVerified ? 'text-emerald-700' : 'text-amber-700'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${item.isVerified ? 'bg-emerald-600' : 'bg-amber-600'}`} />
                        {item.status}
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-6 text-left space-y-4">
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed min-h-[56px]">
                      {item.description}
                    </p>

                    <div className="space-y-1.5 pt-2 border-t border-slate-100">
                      {item.features.slice(0, 3).map((feat, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs text-slate-600">
                          <Check className="w-3.5 h-3.5 text-[#1877F2] shrink-0" />
                          <span className="truncate">{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="p-6 pt-0 border-t border-slate-100 grid grid-cols-2 gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => setPreviewingProject(item)}
                    className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview</span>
                  </button>

                  {item.url !== '#' ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2.5 px-3 rounded-xl bg-[#FF6B00] hover:bg-[#e66000] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm shadow-[#FF6B00]/20"
                    >
                      <span>Visit Site</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="py-2.5 px-3 rounded-xl bg-slate-100 text-slate-400 text-xs font-semibold cursor-not-allowed"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl my-8 p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-2xl space-y-6 text-left relative max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="text-[#FF6B00] font-semibold">{previewingProject.categoryTag}</span>
                  <span aria-hidden="true">·</span>
                  <span>{previewingProject.status}</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-display font-bold text-[#0A1A2F] mt-1">
                  {previewingProject.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewingProject(null)}
                className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-800 hover:bg-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Simulated Desktop Preview Frame */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-200 font-mono">
                <span>{previewingProject.url !== '#' ? previewingProject.url : 'Reserved Preview Slot'}</span>
                {previewingProject.url !== '#' && (
                  <span className="text-emerald-700 font-semibold text-[11px]">Online</span>
                )}
              </div>
              <div className="p-6 rounded-xl bg-white border border-slate-200 space-y-3">
                <div className="text-xs uppercase font-bold text-[#1877F2]">{previewingProject.category}</div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {previewingProject.description}
                </p>
                <div className="pt-2">
                  <div className="text-xs font-bold text-[#0A1A2F] mb-2">Key Functional Highlights:</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700">
                    {previewingProject.features.map((feat, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
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
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Close
                </button>
                {previewingProject.url !== '#' && (
                  <a
                    href={previewingProject.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#e66000] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm shadow-[#FF6B00]/20"
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
      {/* SECTION G: BRANDS AND BUSINESSES (Light 70%) */}
      {/* ========================================================================= */}
      <section className="py-16 sm:py-20 bg-white border-b border-slate-200/80 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto space-y-2 mb-10">
            <h2 className="text-xl sm:text-2xl font-display font-bold text-[#0A1A2F] tracking-tight">
              Brands and Businesses We Work With
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-normal">
              Collaborations and digital platforms developed across creative, clinical, and corporate sectors.
            </p>
          </div>

          {/* Clean Brand Reference Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 items-center">
            {PORTFOLIO_PROJECTS.slice(0, 6).map((brand) => (
              <div
                key={brand.id}
                className="p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 text-center space-y-1 transition-all"
              >
                <div className="text-xs font-bold text-[#0A1A2F] tracking-wide">
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
      {/* SECTION H: TESTIMONIALS AND REVIEWS (Light 70% with slider) */}
      {/* ========================================================================= */}
      <section className="py-20 sm:py-24 bg-[#F8FAFC] border-b border-slate-200/80 relative">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-12">
            <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
              <Quote className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span className="uppercase tracking-wider font-semibold text-[#0A1A2F]">Client Feedback</span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-extrabold text-[#0A1A2F] tracking-tight">
              What Our Clients Say
            </h2>
            <p className="text-base text-slate-600 leading-relaxed font-normal">
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
                    <div className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200 space-y-4 text-left shadow-sm flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center gap-1 text-[#FF6B00]">
                          {[...Array(t.rating)].map((_, i) => (
                            <Star key={i} className="w-4 h-4 fill-[#FF6B00]" />
                          ))}
                        </div>
                        <p className="text-sm sm:text-base text-slate-700 leading-relaxed italic">
                          "{t.comment}"
                        </p>
                      </div>

                      <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-[#0A1A2F]">{t.name}</div>
                          <div className="text-slate-500 text-[11px]">{t.role} · {t.businessName}</div>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">{t.verifiedSource}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Active Card 2 */}
                {(() => {
                  const t = TESTIMONIALS[(testimonialSlideIndex + 1) % TESTIMONIALS.length];
                  return (
                    <div className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200 space-y-4 text-left shadow-sm hidden md:flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center gap-1 text-[#FF6B00]">
                          {[...Array(t.rating)].map((_, i) => (
                            <Star key={i} className="w-4 h-4 fill-[#FF6B00]" />
                          ))}
                        </div>
                        <p className="text-sm sm:text-base text-slate-700 leading-relaxed italic">
                          "{t.comment}"
                        </p>
                      </div>

                      <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-[#0A1A2F]">{t.name}</div>
                          <div className="text-slate-500 text-[11px]">{t.role} · {t.businessName}</div>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">{t.verifiedSource}</span>
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
                      testimonialSlideIndex === idx ? 'w-8 bg-[#FF6B00]' : 'w-2 bg-slate-300 hover:bg-slate-400'
                    }`}
                    aria-label={`Go to slide ${idx + 1}`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrevTestimonial}
                  className="w-10 h-10 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center transition-colors cursor-pointer shadow-sm"
                  aria-label="Previous testimonial"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={handleNextTestimonial}
                  className="w-10 h-10 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center transition-colors cursor-pointer shadow-sm"
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
      {/* SECTION I: WHY DIGITALMUID & CAPABILITIES (Light 70%) */}
      {/* ========================================================================= */}
      <section className="py-20 sm:py-24 bg-white border-b border-slate-200/80 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            {/* Left Col: 13 Features Grid */}
            <div className="lg:col-span-6 space-y-6 text-left">
              <div className="space-y-2">
                <div className="text-xs font-semibold text-[#FF6B00] uppercase tracking-wider">
                  Technical Deliverables
                </div>
                <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-[#0A1A2F]">
                  What Your Website Can Include
                </h2>
                <p className="text-sm text-slate-600 font-normal">
                  Available features depend on your project requirements, technical feasibility, third-party services, and the scope agreed for your website.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {capabilitiesList.map((cap, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2.5 text-xs text-slate-700"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{cap}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Col: Why DigitalMUID Principles */}
            <div className="lg:col-span-6 space-y-6 text-left">
              <div className="space-y-2">
                <div className="text-xs font-semibold text-[#1877F2] uppercase tracking-wider">
                  Working Principles
                </div>
                <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-[#0A1A2F]">
                  A Practical Approach to Building Your Website
                </h2>
                <p className="text-sm text-slate-600 font-normal">
                  How we operate to ensure clarity, predictable schedules, and dependable project execution.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                {whyMuidPrinciples.map((principle, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-left"
                  >
                    <h3 className="text-xs sm:text-sm font-bold text-[#0A1A2F] flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-[#1877F2] flex items-center justify-center text-[10px] font-mono">
                        {idx + 1}
                      </span>
                      <span>{principle.title}</span>
                    </h3>
                    <p className="text-xs text-slate-600 pl-7 leading-relaxed font-normal">
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
      {/* SECTION J: FREQUENTLY ASKED QUESTIONS (Light 70%) */}
      {/* ========================================================================= */}
      <section className="py-20 sm:py-24 bg-[#F8FAFC] border-b border-slate-200/80 relative">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-12">
            <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
              <HelpCircle className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span className="uppercase tracking-wider font-semibold text-[#0A1A2F]">Common Inquiries</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-[#0A1A2F] tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
              Clear, honest answers to help you navigate your website project choices.
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div
                  key={index}
                  className="rounded-2xl bg-white border border-slate-200 overflow-hidden transition-all text-left shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                    className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <span className="font-semibold text-[#0A1A2F] text-sm sm:text-base">
                      {faq.q}
                    </span>
                    <ChevronDown
                      className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-[#FF6B00]' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 sm:px-6 sm:pb-6 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-4 font-normal">
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
      {/* SECTION K & ENQUIRY FORM: DEDICATED WEB SERVICES DISCOVERY BRIEF */}
      {/* ========================================================================= */}
      <section ref={formRef} id="enquiry-form" className="py-20 sm:py-28 bg-white relative">
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-10">
            <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
              <Send className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span className="uppercase tracking-wider font-semibold text-[#0A1A2F]">Start Your Enquiry</span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-extrabold text-[#0A1A2F] tracking-tight">
              Let’s Discuss Your Website Project
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto font-normal">
              Tell us about your business, your goals, and the website you have in mind. We’ll review your requirements and get in touch to discuss the next steps.
            </p>
          </div>

          {/* CONFIRMATION SCREEN */}
          {submissionSuccess ? (
            <div className="p-8 sm:p-12 rounded-3xl bg-white border border-emerald-300 shadow-xl text-center space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <div className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-mono font-bold tracking-wider">
                  Enquiry Reference: {submissionSuccess.referenceId}
                </div>
                <h3 className="text-2xl sm:text-3xl font-display font-bold text-[#0A1A2F]">
                  Thank You, {submissionSuccess.clientName}!
                </h3>
                <p className="text-slate-600 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
                  Your project enquiry for <strong className="text-[#0A1A2F]">{submissionSuccess.business}</strong> has been logged into our CRM. Our team will review your requirements and reach out within 1 business day.
                </p>
              </div>

              <div className="p-4 sm:p-6 rounded-2xl bg-slate-50 border border-slate-200 max-w-lg mx-auto text-left text-xs sm:text-sm space-y-2 text-slate-700">
                <p className="font-bold text-[#0A1A2F]">What happens next?</p>
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
                  className="px-6 py-3 rounded-xl bg-[#FF6B00] hover:bg-[#e66000] text-white text-xs font-bold uppercase tracking-wider cursor-pointer shadow-md shadow-[#FF6B00]/25"
                >
                  Submit Another Project Brief
                </button>
              </div>
            </div>
          ) : (
            /* MULTI-STEP DISCOVERY FORM */
            <div className="rounded-3xl bg-white border border-slate-200 shadow-xl overflow-hidden text-left">
              {/* Form Progress Header */}
              <div className="bg-slate-50 px-6 sm:px-8 py-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-mono font-bold text-[#FF6B00] uppercase">
                    Step {formStep} of 4
                  </div>
                  <div className="text-sm sm:text-base font-bold text-[#0A1A2F] mt-0.5">
                    {formStep === 1 && '1. Project & Business Overview'}
                    {formStep === 2 && '2. Goals, Features & Content'}
                    {formStep === 3 && '3. Planning & Timeline'}
                    {formStep === 4 && '4. Contact Information'}
                  </div>
                </div>

                {/* Progress Indicators */}
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4].map((stepNum) => (
                    <div
                      key={stepNum}
                      className={`h-2 rounded-full transition-all ${
                        formStep === stepNum
                          ? 'w-8 bg-[#FF6B00]'
                          : formStep > stepNum
                          ? 'w-4 bg-[#0A1A2F]'
                          : 'w-4 bg-slate-200'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
                {stepError && (
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm font-medium flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0" />
                    <span>{stepError}</span>
                  </div>
                )}

                {/* ------------------------------------------------------------- */}
                {/* STEP 1: ABOUT YOUR BUSINESS */}
                {/* ------------------------------------------------------------- */}
                {formStep === 1 && (
                  <div className="space-y-6">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                        What type of website are you looking for? <span className="text-[#FF6B00]">*</span>
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {PROJECT_TYPES.map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setProjectType(type)}
                            className={`p-3 rounded-xl text-xs text-left transition-all cursor-pointer border ${
                              projectType === type
                                ? 'bg-blue-50 border-[#1877F2] text-[#0A1A2F] font-bold shadow-sm'
                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="businessName" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                        Business or Project Name <span className="text-[#FF6B00]">*</span>
                      </label>
                      <input
                        id="businessName"
                        type="text"
                        placeholder="e.g. Acme Studio, Dr. Sharma Clinic"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                        Current Business Stage <span className="text-[#FF6B00]">*</span>
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {BUSINESS_STAGES.map((stage) => (
                          <button
                            key={stage}
                            type="button"
                            onClick={() => setBusinessStage(stage)}
                            className={`p-3 rounded-xl text-xs text-left transition-all cursor-pointer border ${
                              businessStage === stage
                                ? 'bg-blue-50 border-[#1877F2] text-[#0A1A2F] font-bold shadow-sm'
                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {stage}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ------------------------------------------------------------- */}
                {/* STEP 2: WHAT DO YOU NEED? */}
                {/* ------------------------------------------------------------- */}
                {formStep === 2 && (
                  <div className="space-y-6">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                        What are the main goals of your website? (Select all that apply) <span className="text-[#FF6B00]">*</span>
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {GOALS_OPTIONS.map((goal) => {
                          const isChecked = selectedGoals.includes(goal);
                          return (
                            <button
                              key={goal}
                              type="button"
                              onClick={() => toggleGoal(goal)}
                              className={`p-3 rounded-xl text-xs text-left transition-all cursor-pointer border flex items-center justify-between ${
                                isChecked
                                  ? 'bg-blue-50 border-[#1877F2] text-[#0A1A2F] font-bold shadow-sm'
                                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <span>{goal}</span>
                              {isChecked && <Check className="w-4 h-4 text-[#1877F2] shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                        Key features or integrations you may need <span className="text-[#FF6B00]">*</span>
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {FEATURES_OPTIONS.map((feat) => {
                          const isChecked = selectedFeatures.includes(feat);
                          return (
                            <button
                              key={feat}
                              type="button"
                              onClick={() => toggleFeature(feat)}
                              className={`p-3 rounded-xl text-xs text-left transition-all cursor-pointer border flex items-center justify-between ${
                                isChecked
                                  ? 'bg-blue-50 border-[#1877F2] text-[#0A1A2F] font-bold shadow-sm'
                                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <span>{feat}</span>
                              {isChecked && <Check className="w-4 h-4 text-[#1877F2] shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                        Content readiness <span className="text-[#FF6B00]">*</span>
                      </label>
                      <div className="space-y-2">
                        {CONTENT_READINESS_OPTIONS.map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setContentReadiness(option)}
                            className={`w-full p-3 rounded-xl text-xs text-left transition-all cursor-pointer border ${
                              contentReadiness === option
                                ? 'bg-blue-50 border-[#1877F2] text-[#0A1A2F] font-bold shadow-sm'
                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="existingUrl" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                          Existing Website URL (if any)
                        </label>
                        <input
                          id="existingUrl"
                          type="text"
                          placeholder="https://example.com"
                          value={existingWebsiteUrl}
                          onChange={(e) => setExistingWebsiteUrl(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 text-xs focus:outline-none focus:border-[#FF6B00]"
                        />
                      </div>

                      <div>
                        <label htmlFor="refUrls" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                          Reference Websites You Like
                        </label>
                        <input
                          id="refUrls"
                          type="text"
                          placeholder="e.g. stripe.com, apple.com"
                          value={referenceUrls}
                          onChange={(e) => setReferenceUrls(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 text-xs focus:outline-none focus:border-[#FF6B00]"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ------------------------------------------------------------- */}
                {/* STEP 3: TIMELINE AND READINESS */}
                {/* ------------------------------------------------------------- */}
                {formStep === 3 && (
                  <div className="space-y-6">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                        Expected Project Timeline <span className="text-[#FF6B00]">*</span>
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {TIMELINE_OPTIONS.map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setTimeline(t)}
                            className={`p-3 rounded-xl text-xs text-left transition-all cursor-pointer border ${
                              timeline === t
                                ? 'bg-blue-50 border-[#1877F2] text-[#0A1A2F] font-bold shadow-sm'
                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                        Current Project Readiness <span className="text-[#FF6B00]">*</span>
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {READINESS_OPTIONS.map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setReadiness(r)}
                            className={`p-3 rounded-xl text-xs text-left transition-all cursor-pointer border ${
                              readiness === r
                                ? 'bg-blue-50 border-[#1877F2] text-[#0A1A2F] font-bold shadow-sm'
                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                        Decision-Making Role <span className="text-[#FF6B00]">*</span>
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {DECISION_MAKER_OPTIONS.map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setDecisionMaker(d)}
                            className={`p-3 rounded-xl text-xs text-left transition-all cursor-pointer border ${
                              decisionMaker === d
                                ? 'bg-blue-50 border-[#1877F2] text-[#0A1A2F] font-bold shadow-sm'
                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="additionalNotes" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                        Additional details or notes about your project
                      </label>
                      <textarea
                        id="additionalNotes"
                        rows={3}
                        placeholder="Tell us any specific ideas, target launch dates, or questions you have..."
                        value={additionalRequirements}
                        onChange={(e) => setAdditionalRequirements(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 text-xs focus:outline-none focus:border-[#FF6B00]"
                      />
                    </div>
                  </div>
                )}

                {/* ------------------------------------------------------------- */}
                {/* STEP 4: CONTACT INFORMATION */}
                {/* ------------------------------------------------------------- */}
                {formStep === 4 && (
                  <div className="space-y-6">
                    <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100 text-xs text-[#0A1A2F] space-y-1">
                      <div className="font-bold flex items-center gap-1.5 text-[#1877F2]">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Brief Summary: {projectType}</span>
                      </div>
                      <p className="text-slate-600">
                        For <strong>{businessName}</strong> · Expected: <strong>{timeline}</strong>
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="fullName" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                          Your Full Name <span className="text-[#FF6B00]">*</span>
                        </label>
                        <input
                          id="fullName"
                          type="text"
                          required
                          placeholder="e.g. Rahul Sharma"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-[#FF6B00]"
                        />
                      </div>

                      <div>
                        <label htmlFor="businessEmail" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                          Business Email <span className="text-[#FF6B00]">*</span>
                        </label>
                        <input
                          id="businessEmail"
                          type="email"
                          required
                          placeholder="name@company.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-[#FF6B00]"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="phoneNum" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                        Phone / WhatsApp Number <span className="text-[#FF6B00]">*</span>
                      </label>
                      <input
                        id="phoneNum"
                        type="tel"
                        required
                        placeholder="+91 98765 43210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-[#FF6B00]"
                      />
                      <p className="text-[11px] text-slate-500 mt-1">
                        We respect your privacy. We will use this only to review your brief and reply with project guidance.
                      </p>
                    </div>

                    {/* Consent Checkbox */}
                    <div className="pt-2">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={consentAgreed}
                          onChange={(e) => setConsentAgreed(e.target.checked)}
                          className="mt-1 w-4 h-4 rounded border-slate-300 text-[#FF6B00] focus:ring-[#FF6B00]"
                        />
                        <span className="text-xs text-slate-600 leading-relaxed">
                          I agree to share these details with DigitalMUID so their team can evaluate my project requirements and contact me regarding this enquiry.
                        </span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Form Navigation Controls */}
                <div className="flex items-center justify-between pt-6 border-t border-slate-200">
                  {formStep > 1 ? (
                    <button
                      type="button"
                      onClick={handlePrevStep}
                      disabled={isSubmitting}
                      className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors"
                    >
                      ← Back
                    </button>
                  ) : (
                    <div />
                  )}

                  {formStep < 4 ? (
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="px-7 py-3 rounded-xl bg-[#0A1A2F] hover:bg-[#1877F2] text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-all shadow-md"
                    >
                      <span>Continue</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-8 py-3.5 rounded-xl bg-[#FF6B00] hover:bg-[#e66000] disabled:bg-slate-400 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg shadow-[#FF6B00]/25 transition-all transform hover:-translate-y-0.5"
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
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
              </form>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
