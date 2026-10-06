import {
  Article,
  Video,
  Framework,
  FrameworkCategory,
  Resource,
  Course,
  Testimonial,
  SpeakingEvent,
  ConsultationProduct,
  AvailabilityRules,
  Booking,
  Lead,
  SiteSettings
} from '../types';

export const INITIAL_FRAMEWORK_CATEGORIES: FrameworkCategory[] = [
  {
    id: 'fc-01',
    name: 'Digital Growth',
    slug: 'digital-growth',
    description: 'Scalable digital acquisition, retention, and expansion frameworks.',
    sortOrder: 1,
    isActive: true
  },
  {
    id: 'fc-02',
    name: 'AI & Automation',
    slug: 'ai-and-automation',
    description: 'Architectures for implementing artificial intelligence and autonomous workflows.',
    sortOrder: 2,
    isActive: true
  },
  {
    id: 'fc-03',
    name: 'Personal Branding',
    slug: 'personal-branding',
    description: 'Methodologies for codifying expertise, executive presence, and market authority.',
    sortOrder: 3,
    isActive: true
  },
  {
    id: 'fc-04',
    name: 'Modern Marketing',
    slug: 'modern-marketing',
    description: 'Next-generation demand generation, attribution, and multi-channel engines.',
    sortOrder: 4,
    isActive: true
  },
  {
    id: 'fc-05',
    name: 'Consulting & Leadership',
    slug: 'consulting-and-leadership',
    description: 'High-impact advisory, change management, and executive leadership architectures.',
    sortOrder: 5,
    isActive: true
  },
  {
    id: 'fc-06',
    name: 'Systems & Architecture',
    slug: 'systems-and-architecture',
    description: 'Technical, operational, and organizational infrastructure blueprints.',
    sortOrder: 6,
    isActive: true
  },
  {
    id: 'fc-07',
    name: 'Business Transformation',
    slug: 'business-transformation',
    description: 'Enterprise reinvention, digital pivot, and scalable modernization models.',
    sortOrder: 7,
    isActive: true
  }
];

export const INITIAL_CONSULTATION_PRODUCT: ConsultationProduct = {
  id: '31bbb9bf-ce10-4da4-a517-dfc673f9b875',
  name: 'Business Growth Consultation',
  durationMinutes: 30,
  basePrice: 499,
  gstRate: 0.18,
  currency: 'INR',
  active: true,
  description: 'Bring one pivotal business or marketing challenge. Receive high-velocity strategic clarity, tactical roadmaps, and actionable next steps.',
  features: [
    '30-minute private 1-on-1 strategic session with Digital Muid',
    'Focused deep-dive into your specific growth or AI bottleneck',
    'Actionable framework implementation guidance',
    'Session recording and post-consultation summary notes',
    'Dedicated Google Meet link generated instantly'
  ]
};

export const INITIAL_AVAILABILITY_RULES: AvailabilityRules = {
  id: '233d74ce-6146-4c40-b1ac-716fb0d1489d',
  workingDays: [1, 2, 3, 4, 5], // Mon to Fri
  startTime: '11:00',
  endTime: '20:00',
  slotDurationMinutes: 30,
  bufferMinutes: 15,
  breakPeriods: [
    { start: '14:00', end: '15:00', name: 'Strategic Break' }
  ],
  blockedDates: [],
  blockedSlots: [],
  minNoticeHours: 4,
  maxAdvanceDays: 30
};

export const INITIAL_ARTICLES: Article[] = [
  {
    id: 'art-01',
    slug: 'digital-no-longer-just-marketing',
    title: 'Digital Is No Longer Just Marketing: The 2026 Strategic Convergence',
    excerpt: 'For decades, companies treated digital as a departmental silo. Today, growth occurs exclusively at the intersection of AI, customer operations, and brand trust.',
    content: `For decades, leadership teams categorized "digital" as a promotional tactic—a digital marketing line item managed in isolation from engineering, supply chain, or executive strategy.

In 2026, this artificial boundary has completely collapsed. Digital is no longer just marketing; it is the fundamental operating substrate of modern business.

### The Six Disconnected Silos Costing You Millions

When we audit mid-market and enterprise growth engines, we consistently discover companies running six fragmented systems:
1. **Ad spend without brand resonance**: Pouring budget into algorithmic ad channels without building distinct intellectual property.
2. **AI experimentation without operational integration**: Buying dozens of SaaS subscriptions without integrating LLMs into actual client workflows.
3. **High website traffic with zero conversion architecture**: Treating visitors as passive eyeballs rather than designing clear progressive disclosure pathways.

### The Unified Growth Stack

The winners of the next five years will not be the companies that run the highest volume of ads, but those that connect strategy, proprietary frameworks, AI automation, and authentic founder trust into a compounding ecosystem.

When these components align, customer acquisition cost drops, enterprise valuation climbs, and conversion velocity triples.`,
    category: 'Growth',
    tags: ['Strategy', 'AI', 'Digital Transformation', 'Growth Stack'],
    author: {
      name: 'Digital Muid',
      role: 'Growth Strategist & Founder',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'
    },
    readTime: '6 min read',
    publishedAt: '2026-06-18',
    status: 'published',
    featured: true,
    featuredImage: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
    seoTitle: 'Digital Is No Longer Just Marketing | Digital Muid',
    seoDescription: 'Why modern business growth happens at the convergence of AI, systems, content, and strategy.'
  },
  {
    id: 'art-02',
    slug: 'building-founder-authority-age-of-ai',
    title: 'Building Founder Authority in the Era of Commodity AI Content',
    excerpt: 'When generative AI can create endless mediocre articles, human perspective, verifiable track record, and original frameworks become your ultimate competitive moat.',
    content: `As artificial intelligence democratizes the production of text, imagery, and code, the internet is experiencing an unprecedented surge in synthesized mediocrity.

In an ocean of infinite generic advice, **authority is the rarest currency**.

### Why Surface Knowledge Fails

If your content sounds like a basic LLM prompt response, your potential enterprise clients will recognize it immediately. High-value clients do not buy generic summaries; they buy:
- **Battle-tested conviction** developed over 15+ years of real implementation.
- **Proprietary mental models** that simplify messy market chaos into actionable steps.
- **Human judgment** capable of navigating complex edge cases.

### The Authority Architecture

To build unbreakable personal and corporate authority:
1. Document your proprietary methodologies as trademarked frameworks.
2. Share radical transparency on real operational failures and breakthroughs.
3. Speak directly to the sophisticated tier of your market, refusing to dumb down nuance for vanity metrics.`,
    category: 'Personal Branding',
    tags: ['Founder Authority', 'Thought Leadership', 'Personal Brand', 'AI'],
    author: {
      name: 'Digital Muid',
      role: 'Growth Strategist & Founder',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'
    },
    readTime: '5 min read',
    publishedAt: '2026-07-02',
    status: 'published',
    featured: true,
    featuredImage: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'art-03',
    slug: 'practical-ai-transformation-framework',
    title: 'Practical AI Transformation: Moving from Novelty to Measurable Margin',
    excerpt: 'How leading founders audit their workflows, isolate leverage points, and deploy autonomous agents without breaking core customer trust.',
    content: `Most companies approaching AI make the mistake of looking for a single magical tool. Instead, true enterprise leverage stems from systematic process decomposition.

### The 4-Stage AI Deployment Vector
- **Audit**: Mapping high-friction repetitive operations across support, intake, research, and data synthesis.
- **Decompose**: Breaking complex roles into atomic tasks with explicit quality rubrics.
- **Deploy**: Establishing specialized agent loops with human verification thresholds.
- **Compound**: Feeding real transaction telemetry back into workflow refinements.`,
    category: 'AI',
    tags: ['AI Agents', 'Automation', 'Operations', 'Productivity'],
    author: {
      name: 'Digital Muid',
      role: 'Growth Strategist & Founder',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'
    },
    readTime: '7 min read',
    publishedAt: '2026-07-24',
    status: 'published',
    featured: false,
    featuredImage: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'art-04',
    slug: 'high-conversion-growth-system-anatomy',
    title: 'Anatomy of a High-Conversion Digital Growth System',
    excerpt: 'The step-by-step mechanics of capturing high-intent B2B and consumer demand without relying on discount gimmicks.',
    content: `A conversion funnel is not an aggressive series of popups. It is an empathetic, educational ladder that respects the buyer's intelligence at every rung.

Learn how we architect 6-stage growth systems that convert cold traffic into enthusiastic brand advocates.`,
    category: 'Marketing',
    tags: ['Conversion Rate', 'Funnel Design', 'Marketing Architecture'],
    author: {
      name: 'Digital Muid',
      role: 'Growth Strategist & Founder',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'
    },
    readTime: '8 min read',
    publishedAt: '2026-08-05',
    status: 'published',
    featured: false,
    featuredImage: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80'
  }
];

export const INITIAL_VIDEOS: Video[] = [
  {
    id: 'vid-01',
    slug: 'digital-growth-stack-masterclass',
    title: 'The Digital Growth Stack™ Breakdown: From Zero to Predictable Scale',
    description: 'A comprehensive 24-minute breakdown of how modern founders integrate Strategy, Visibility, Authority, Conversion, Automation, and Scale into one unstoppable operating system.',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    thumbnail: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1000&q=80',
    category: 'Latest',
    duration: '24:18',
    tags: ['Growth Stack', 'Masterclass', 'Strategy'],
    featured: true,
    publishedAt: '2026-08-01',
    status: 'published',
    viewsCount: '48.2K'
  },
  {
    id: 'vid-02',
    slug: 'how-to-architect-business-for-ai',
    title: 'How to Architect Your Business for AI Transformation in 2026',
    description: 'Step-by-step tactical walkthrough for business leaders on replacing manual operational friction with autonomous AI workflows.',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    thumbnail: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1000&q=80',
    category: 'AI',
    duration: '18:45',
    tags: ['AI Strategy', 'Operations', 'Transformation'],
    featured: true,
    publishedAt: '2026-07-20',
    status: 'published',
    viewsCount: '32.1K'
  },
  {
    id: 'vid-03',
    slug: 'meta-ads-algorithmic-evolution',
    title: 'Meta Ads in 2026: The Algorithmic Shift Every Marketer Must Understand',
    description: 'Why micro-targeting is dead, and how creative architecture, high-resonance hooks, and first-party data are driving superior ROAS.',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    thumbnail: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1000&q=80',
    category: 'Marketing',
    duration: '21:10',
    tags: ['Meta Ads', 'Paid Media', 'Performance Marketing'],
    featured: false,
    publishedAt: '2026-07-12',
    status: 'published',
    viewsCount: '29.5K'
  },
  {
    id: 'vid-04',
    slug: 'framework-thinking-intellectual-property',
    title: 'Framework Thinking: How to Turn Intuition Into High-Value Proprietary Assets',
    description: 'Stop selling generic commoditized time. Learn the exact method to codify your tacit knowledge into signature frameworks that command premium positioning.',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    thumbnail: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1000&q=80',
    category: 'Personal Branding',
    duration: '15:32',
    tags: ['Frameworks', 'Authority', 'Monetization'],
    featured: false,
    publishedAt: '2026-06-28',
    status: 'published',
    viewsCount: '19.8K'
  }
];

export const INITIAL_FRAMEWORKS: Framework[] = [
  {
    id: 'fw-01',
    title: 'The Digital Growth Stack™',
    name: 'The Digital Growth Stack™',
    slug: 'digital-growth-stack',
    subtitle: 'The 6-Stage Integrated Operating Architecture for Modern Growth',
    description: 'A holistic framework engineered across 15+ years of digital scaling to unify strategy, customer acquisition, operational automation, and brand enterprise value.',
    introduction: 'A holistic framework engineered across 15+ years of digital scaling to unify strategy, customer acquisition, operational automation, and brand enterprise value.',
    category: 'Digital Growth',
    author: 'Digital Muid',
    coverImage: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
    cover_image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
    problemStatement: 'Companies suffer when their marketing, technology, AI, and sales pipelines operate in isolated silos, resulting in bloated customer acquisition costs, churn, and stagnant scale.',
    problem: 'Companies suffer when their marketing, technology, AI, and sales pipelines operate in isolated silos, resulting in bloated customer acquisition costs, churn, and stagnant scale.',
    solutionStatement: 'Deploy a unified, 6-stage sequential operating engine that aligns ICP demand capture, intellectual property positioning, autonomous lead operations, and recurring LTV expansion.',
    frameworkContent: [
      {
        step: 1,
        title: 'Strategy & Positioning',
        shortDescription: 'Core Vector & Positioning',
        content: 'Define your defensible market moat, identify high-intent ICP segments, and architect your proprietary value proposition.',
        keyActions: [
          'Ideal Customer Profile (ICP) validation',
          'Value proposition stress-testing',
          'Competitive moat differentiation matrix'
        ],
        outcome: 'Eliminates wasted capital and focuses 100% of resources on proven demand vectors.',
        number: '01',
        subtitle: 'Core Vector & Positioning',
        description: 'Define your defensible market moat, identify high-intent ICP segments, and architect your proprietary value proposition.',
        impact: 'Eliminates wasted capital and focuses 100% of resources on proven demand vectors.'
      },
      {
        step: 2,
        title: 'Visibility & Media',
        shortDescription: 'High-Resonance Demand Capture',
        content: 'Deploy organic distribution, precision search capture, and AI-optimized algorithmic media to build undeniable market awareness.',
        keyActions: [
          'Pillar content syndication engine',
          'Algorithmic paid media orchestration',
          'Search intent and semantic capture'
        ],
        outcome: 'Generates consistent top-of-funnel inbound interest from buyers ready to solve immediate pain points.',
        number: '02',
        subtitle: 'High-Resonance Demand Capture',
        description: 'Deploy organic distribution, precision search capture, and AI-optimized algorithmic media to build undeniable market awareness.',
        impact: 'Generates consistent top-of-funnel inbound interest from buyers ready to solve immediate pain points.'
      },
      {
        step: 3,
        title: 'Authority & IP',
        shortDescription: 'Intellectual Property & Trust Architecture',
        content: 'Publish signature frameworks, verified case studies, and executive thought leadership to turn skepticism into institutional credibility.',
        keyActions: [
          'Signature framework publishing',
          'Executive founder brand establishment',
          'Strategic social proof ecosystems'
        ],
        outcome: 'Shortens enterprise sales cycles from months to days while commanding premium pricing.',
        number: '03',
        subtitle: 'Intellectual Property & Trust Architecture',
        description: 'Publish signature frameworks, verified case studies, and executive thought leadership to turn skepticism into institutional credibility.',
        impact: 'Shortens enterprise sales cycles from months to days while commanding premium pricing.'
      },
      {
        step: 4,
        title: 'Conversion Engine',
        shortDescription: 'Frictionless Value Exchange',
        content: 'Design educational conversion paths, interactive diagnostic tools, and frictionless checkout/booking systems.',
        keyActions: [
          'High-intent landing page architecture',
          'Interactive diagnostic assessment funnels',
          'Transparent, trust-centric consultation checkout'
        ],
        outcome: 'Maximizes lead-to-revenue conversion velocity and eliminates leakages.',
        number: '04',
        subtitle: 'Frictionless Value Exchange',
        description: 'Design educational conversion paths, interactive diagnostic tools, and frictionless checkout/booking systems.',
        impact: 'Maximizes lead-to-revenue conversion velocity and eliminates leakages.'
      },
      {
        step: 5,
        title: 'Automation & AI',
        shortDescription: 'AI Operations & Workflow Systems',
        content: 'Implement autonomous lead routing, CRM intelligence, automated meeting provisioning, and dynamic client onboarding.',
        keyActions: [
          'AI agent customer triage & routing',
          'Automated Google Meet & calendar provisioning',
          'Self-healing CRM synchronization'
        ],
        outcome: 'Allows business operations to run 24/7 with zero manual data entry bottlenecks.',
        number: '05',
        subtitle: 'AI Operations & Workflow Systems',
        description: 'Implement autonomous lead routing, CRM intelligence, automated meeting provisioning, and dynamic client onboarding.',
        impact: 'Allows business operations to run 24/7 with zero manual data entry bottlenecks.'
      },
      {
        step: 6,
        title: 'Scale & Compounding',
        shortDescription: 'Compounding Revenue & Expansion',
        content: 'Leverage data feedback loops, client lifetime value expansion, community flywheel mechanics, and market vertical expansion.',
        keyActions: [
          'Client retention & expansion flywheels',
          'Predictable referral engine automation',
          'Cross-sell product line orchestration'
        ],
        outcome: 'Transforms transactional revenue into compounding, highly predictable enterprise asset valuation.',
        number: '06',
        subtitle: 'Compounding Revenue & Expansion',
        description: 'Leverage data feedback loops, client lifetime value expansion, community flywheel mechanics, and market vertical expansion.',
        impact: 'Transforms transactional revenue into compounding, highly predictable enterprise asset valuation.'
      }
    ],
    whoIsItFor: 'Founders, CMOs, and enterprise leaders seeking to scale revenue without exponentially growing headcount or relying solely on ad spend.',
    whenToUse: 'Deploy when expanding into new product categories, experiencing plateaued digital ad returns, or unifying fragmented sales/marketing teams.',
    relatedArticles: ['digital-no-longer-just-marketing', 'high-conversion-growth-system-anatomy'],
    relatedVideos: [],
    relatedResources: ['res-01', 'res-02'],
    tags: ['Digital Growth', 'Systems', 'Scaling', 'AI Operations'],
    status: 'published',
    isFeatured: true,
    featured: true,
    publishedAt: '2026-08-01',
    steps: [
      {
        number: '01',
        title: 'Strategy',
        subtitle: 'Core Vector & Positioning',
        description: 'Define your defensible market moat, identify high-intent ICP segments, and architect your proprietary value proposition.',
        impact: 'Eliminates wasted capital and focuses 100% of resources on proven demand vectors.',
        keyActions: [
          'Ideal Customer Profile (ICP) validation',
          'Value proposition stress-testing',
          'Competitive moat differentiation matrix'
        ],
        step: 1
      },
      {
        number: '02',
        title: 'Visibility',
        subtitle: 'High-Resonance Demand Capture',
        description: 'Deploy organic distribution, precision search capture, and AI-optimized algorithmic media to build undeniable market awareness.',
        impact: 'Generates consistent top-of-funnel inbound interest from buyers ready to solve immediate pain points.',
        keyActions: [
          'Pillar content syndication engine',
          'Algorithmic paid media orchestration',
          'Search intent and semantic capture'
        ],
        step: 2
      },
      {
        number: '03',
        title: 'Authority',
        subtitle: 'Intellectual Property & Trust Architecture',
        description: 'Publish signature frameworks, verified case studies, and executive thought leadership to turn skepticism into institutional credibility.',
        impact: 'Shortens enterprise sales cycles from months to days while commanding premium pricing.',
        keyActions: [
          'Signature framework publishing',
          'Executive founder brand establishment',
          'Strategic social proof ecosystems'
        ],
        step: 3
      },
      {
        number: '04',
        title: 'Conversion',
        subtitle: 'Frictionless Value Exchange',
        description: 'Design educational conversion paths, interactive diagnostic tools, and frictionless checkout/booking systems.',
        impact: 'Maximizes lead-to-revenue conversion velocity and eliminates leakages.',
        keyActions: [
          'High-intent landing page architecture',
          'Interactive diagnostic assessment funnels',
          'Transparent, trust-centric consultation checkout'
        ],
        step: 4
      },
      {
        number: '05',
        title: 'Automation',
        subtitle: 'AI Operations & Workflow Systems',
        description: 'Implement autonomous lead routing, CRM intelligence, automated meeting provisioning, and dynamic client onboarding.',
        impact: 'Allows business operations to run 24/7 with zero manual data entry bottlenecks.',
        keyActions: [
          'AI agent customer triage & routing',
          'Automated Google Meet & calendar provisioning',
          'Self-healing CRM synchronization'
        ],
        step: 5
      },
      {
        number: '06',
        title: 'Scale',
        subtitle: 'Compounding Revenue & Expansion',
        description: 'Leverage data feedback loops, client lifetime value expansion, community flywheel mechanics, and market vertical expansion.',
        impact: 'Transforms transactional revenue into compounding, highly predictable enterprise asset valuation.',
        keyActions: [
          'Client retention & expansion flywheels',
          'Predictable referral engine automation',
          'Cross-sell product line orchestration'
        ],
        step: 6
      }
    ],
    principles: [
      'Clarity precedes amplification: Never advertise confusion.',
      'Authority reduces conversion friction by over 80%.',
      'Automation without documented systems only multiplies chaos.',
      'Compounding retention outlasts short-term acquisition spikes.'
    ],
    diagramType: 'stack',
    examples: [
      'D2C brand scaled from ₹10L/mo to ₹1.2Cr/mo by aligning Authority with Meta Ads creative iterations.',
      'B2B Tech consultancy 4xed consultation closing rate after codifying their service into an interactive framework.'
    ],
    relatedCourses: ['digital-marketing-masterclass', 'ai-automation-business-operations'],
    ctaText: 'Deploy The Digital Growth Stack in Your Business'
  },
  {
    id: 'fw-02',
    title: 'Personal Authority Framework™',
    name: 'Personal Authority Framework™',
    slug: 'personal-authority-framework',
    subtitle: 'From Invisible Expert to Industry Reference Point',
    description: 'A systematic 4-tier model for founders, executives, and specialists to turn private expertise into unmatched market pull and business opportunity.',
    introduction: 'A systematic 4-tier model for founders, executives, and specialists to turn private expertise into unmatched market pull and business opportunity.',
    category: 'Personal Branding',
    author: 'Digital Muid',
    coverImage: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=1200&q=80',
    cover_image: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=1200&q=80',
    problemStatement: 'Brilliant founders remain underpriced and overlooked because they lack a disciplined system to package and distribute their credibility.',
    problem: 'Brilliant founders remain underpriced and overlooked because they lack a disciplined system to package and distribute their credibility.',
    solutionStatement: 'Systematically codify tacit judgment into proprietary visual models, distribute them across high-signal media channels, and monetize through high-ticket advisory retainers.',
    frameworkContent: [
      {
        step: 1,
        title: 'Niche Dominance Vector',
        shortDescription: 'Extreme Focus & Point of View',
        content: 'Isolate the exact intersection where your 15+ years of experience solve a high-stakes commercial dilemma.',
        keyActions: ['Thesis formulation', 'Category creation narrative', 'Target audience filtering'],
        outcome: 'Stops you from competing with thousands of generic generalists.',
        number: '01',
        subtitle: 'Extreme Focus & Point of View',
        description: 'Isolate the exact intersection where your 15+ years of experience solve a high-stakes commercial dilemma.',
        impact: 'Stops you from competing with thousands of generic generalists.'
      },
      {
        step: 2,
        title: 'Intellectual Property Engine',
        shortDescription: 'Codifying Wisdom into Frameworks',
        content: 'Turn your subconscious intuition into named, visual models that people can share, cite, and implement.',
        keyActions: ['Framework diagramming', 'Case study codification', 'Methodology naming'],
        outcome: 'Makes your solution proprietary and legally defensible.',
        number: '02',
        subtitle: 'Codifying Wisdom into Frameworks',
        description: 'Turn your subconscious intuition into named, visual models that people can share, cite, and implement.',
        impact: 'Makes your solution proprietary and legally defensible.'
      },
      {
        step: 3,
        title: 'Multi-Channel Signal Blast',
        shortDescription: 'Consistent Omnipresence',
        content: 'Distribute authoritative essays, video breakdowns, and keynote presentations across LinkedIn, YouTube, and industry stages.',
        keyActions: ['Weekly executive insights', 'Video breakdowns', 'Keynote positioning'],
        outcome: 'Attracts inbound Fortune 500 leads, speaking invites, and investor interest.',
        number: '03',
        subtitle: 'Consistent Omnipresence',
        description: 'Distribute authoritative essays, video breakdowns, and keynote presentations across LinkedIn, YouTube, and industry stages.',
        impact: 'Attracts inbound Fortune 500 leads, speaking invites, and investor interest.'
      },
      {
        step: 4,
        title: 'High-Ticket Monetization',
        shortDescription: 'Converting Credibility to Cash',
        content: 'Direct the generated trust toward premium advisory retainers, paid strategic consultations, and high-impact educational masterclasses.',
        keyActions: ['Consultation pricing engine', 'Advisory retainers', 'Cohort masterclasses'],
        outcome: 'Establishes sustainable 7-figure revenue with high operating margins.',
        number: '04',
        subtitle: 'Converting Credibility to Cash',
        description: 'Direct the generated trust toward premium advisory retainers, paid strategic consultations, and high-impact educational masterclasses.',
        impact: 'Establishes sustainable 7-figure revenue with high operating margins.'
      }
    ],
    whoIsItFor: 'Consultants, C-suite executives, agency owners, and domain specialists seeking to escape fee commoditization.',
    whenToUse: 'Use when repositioning from execution-based services to high-margin advisory and thought leadership.',
    relatedArticles: ['building-founder-authority-age-of-ai'],
    relatedVideos: [],
    relatedResources: ['res-02'],
    tags: ['Personal Branding', 'Authority', 'Intellectual Property', 'Consulting'],
    status: 'published',
    isFeatured: true,
    featured: true,
    publishedAt: '2026-08-01',
    steps: [
      {
        number: '01',
        title: 'Niche Dominance Vector',
        subtitle: 'Extreme Focus & Point of View',
        description: 'Isolate the exact intersection where your 15+ years of experience solve a high-stakes commercial dilemma.',
        impact: 'Stops you from competing with thousands of generic generalists.',
        keyActions: ['Thesis formulation', 'Category creation narrative', 'Target audience filtering'],
        step: 1
      },
      {
        number: '02',
        title: 'Intellectual Property Engine',
        subtitle: 'Codifying Wisdom into Frameworks',
        description: 'Turn your subconscious intuition into named, visual models that people can share, cite, and implement.',
        impact: 'Makes your solution proprietary and legally defensible.',
        keyActions: ['Framework diagramming', 'Case study codification', 'Methodology naming'],
        step: 2
      },
      {
        number: '03',
        title: 'Multi-Channel Signal Blast',
        subtitle: 'Consistent Omnipresence',
        description: 'Distribute authoritative essays, video breakdowns, and keynote presentations across LinkedIn, YouTube, and industry stages.',
        impact: 'Attracts inbound Fortune 500 leads, speaking invites, and investor interest.',
        keyActions: ['Weekly executive insights', 'Video breakdowns', 'Keynote positioning'],
        step: 3
      },
      {
        number: '04',
        title: 'High-Ticket Monetization',
        subtitle: 'Converting Credibility to Cash',
        description: 'Direct the generated trust toward premium advisory retainers, paid strategic consultations, and high-impact educational masterclasses.',
        impact: 'Establishes sustainable 7-figure revenue with high operating margins.',
        keyActions: ['Consultation pricing engine', 'Advisory retainers', 'Cohort masterclasses'],
        step: 4
      }
    ],
    principles: [
      'Positioning: Specificity creates premium pricing power.',
      'Artifacts: Published frameworks outperform resumes 100 to 1.',
      'Distribution: Own your distribution channels before renting algorithms.',
      'Commercialization: Authority must convert into direct equity or cash flow.'
    ],
    diagramType: 'flow',
    examples: [
      'Helped 40+ founders transition from outbound cold outreach to 100% inbound high-ticket advisory clients.'
    ],
    relatedCourses: ['social-media-mastery', 'content-marketing-ip-creation'],
    ctaText: 'Build Your Personal Authority Engine'
  },
  {
    id: 'fw-03',
    title: 'AI Transformation Framework™',
    name: 'AI Transformation Framework™',
    slug: 'ai-transformation-framework',
    subtitle: 'From Generic Prompts to Autonomous Enterprise Leverage',
    description: 'A pragmatic blueprint for non-technical executives and teams to integrate artificial intelligence safely into customer acquisition, service delivery, and strategic intelligence.',
    introduction: 'A pragmatic blueprint for non-technical executives and teams to integrate artificial intelligence safely into customer acquisition, service delivery, and strategic intelligence.',
    category: 'AI & Automation',
    author: 'Digital Muid',
    coverImage: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
    cover_image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
    problemStatement: '90% of AI initiatives stall because teams use AI as a novelty chat toy rather than a systematic process re-engineering driver.',
    problem: '90% of AI initiatives stall because teams use AI as a novelty chat toy rather than a systematic process re-engineering driver.',
    solutionStatement: 'Conduct friction audits, design scoped agentic loops with strict evaluation rubrics, and install human validation gateways for dependable automation.',
    frameworkContent: [
      {
        step: 1,
        title: 'Operational Friction Audit',
        shortDescription: 'Friction Mapping',
        content: 'Quantify hours and cost consumed by repetitive human triage, document extraction, and routine customer communications.',
        keyActions: ['Workflow heatmapping', 'Cost-per-task analysis', 'Error rate benchmarking'],
        outcome: 'Pinpoints immediate high-ROI automation targets.',
        number: '01',
        subtitle: 'Friction Mapping',
        description: 'Quantify hours and cost consumed by repetitive human triage, document extraction, and routine customer communications.',
        impact: 'Pinpoints immediate high-ROI automation targets.'
      },
      {
        step: 2,
        title: 'Scoped Agent Architecture',
        shortDescription: 'Specialized LLM Loops',
        content: 'Build scoped autonomous agents equipped with specific system prompts, tool capabilities, and guardrails.',
        keyActions: ['Prompt system design', 'Tool-calling API integrations', 'Evaluation rubrics'],
        outcome: 'Delivers 10x faster execution without sacrificing accuracy.',
        number: '02',
        subtitle: 'Specialized LLM Loops',
        description: 'Build scoped autonomous agents equipped with specific system prompts, tool capabilities, and guardrails.',
        impact: 'Delivers 10x faster execution without sacrificing accuracy.'
      },
      {
        step: 3,
        title: 'Human Validation Gateways',
        shortDescription: 'Safety & Quality Control',
        content: 'Establish clear checkpoints where subject matter experts review high-stakes deliverables before client dispatch.',
        keyActions: ['Review threshold triggers', 'Exception logging', 'Continuous learning feedback'],
        outcome: 'Eliminates hallucination risks and maintains high customer trust.',
        number: '03',
        subtitle: 'Safety & Quality Control',
        description: 'Establish clear checkpoints where subject matter experts review high-stakes deliverables before client dispatch.',
        impact: 'Eliminates hallucination risks and maintains high customer trust.'
      },
      {
        step: 4,
        title: 'Autonomous Scaling & Telemetry',
        shortDescription: 'Continuous Workflow Optimization',
        content: 'Connect automated workflows directly to CRM, payment systems, calendar scheduling, and analytics telemetry.',
        keyActions: ['End-to-end integration', 'Latency monitoring', 'Capacity scaling'],
        outcome: 'Allows the business to 5x throughput without scaling headcount.',
        number: '04',
        subtitle: 'Continuous Workflow Optimization',
        description: 'Connect automated workflows directly to CRM, payment systems, calendar scheduling, and analytics telemetry.',
        impact: 'Allows the business to 5x throughput without scaling headcount.'
      }
    ],
    whoIsItFor: 'Operations managers, enterprise executives, and digital agencies seeking to safely automate core service pipelines.',
    whenToUse: 'Deploy when employee time is consumed by routine triage, data copying, or slow proposal turnarounds.',
    relatedArticles: ['practical-ai-transformation-framework'],
    relatedVideos: [],
    relatedResources: ['res-01'],
    tags: ['AI & Automation', 'Agents', 'Operations', 'Productivity'],
    status: 'published',
    isFeatured: true,
    featured: true,
    publishedAt: '2026-08-01',
    steps: [
      {
        number: '01',
        title: 'Operational Audit',
        subtitle: 'Friction Mapping',
        description: 'Quantify hours and cost consumed by repetitive human triage, document extraction, and routine customer communications.',
        impact: 'Pinpoints immediate high-ROI automation targets.',
        keyActions: ['Workflow heatmapping', 'Cost-per-task analysis', 'Error rate benchmarking'],
        step: 1
      },
      {
        number: '02',
        title: 'Agent Architecture',
        subtitle: 'Specialized LLM Loops',
        description: 'Build scoped autonomous agents equipped with specific system prompts, tool capabilities, and guardrails.',
        impact: 'Delivers 10x faster execution without sacrificing accuracy.',
        keyActions: ['Prompt system design', 'Tool-calling API integrations', 'Evaluation rubrics'],
        step: 2
      },
      {
        number: '03',
        title: 'Human Validation Gateways',
        subtitle: 'Safety & Quality Control',
        description: 'Establish clear checkpoints where subject matter experts review high-stakes deliverables before client dispatch.',
        impact: 'Eliminates hallucination risks and maintains high customer trust.',
        keyActions: ['Review threshold triggers', 'Exception logging', 'Continuous learning feedback'],
        step: 3
      },
      {
        number: '04',
        title: 'Autonomous Scaling',
        subtitle: 'Continuous Workflow Optimization',
        description: 'Connect automated workflows directly to CRM, payment systems, calendar scheduling, and analytics telemetry.',
        impact: 'Allows the business to 5x throughput without scaling headcount.',
        keyActions: ['End-to-end integration', 'Latency monitoring', 'Capacity scaling'],
        step: 4
      }
    ],
    principles: [
      'Process first, models second.',
      'Human-in-the-loop safeguards enterprise reputation.',
      'Telemetry feedback creates an insurmountable proprietary advantage.'
    ],
    diagramType: 'cycle',
    examples: [
      'Automated 70% of intake and proposal generation for a consulting firm, dropping delivery turnaround from 4 days to 2 hours.'
    ],
    relatedCourses: ['ai-automation-business-operations'],
    ctaText: 'Transform Your Business with AI'
  }
];

export const INITIAL_RESOURCES: Resource[] = [
  {
    id: 'res-01',
    slug: 'ai-prompt-pack-growth-strategy',
    title: 'AI Prompt Pack: 50+ High-Performance Growth Prompts',
    name: 'AI Prompt Pack: 50+ High-Performance Growth Prompts',
    resourceType: 'Prompt Pack',
    type: 'Prompt Pack',
    description: 'Precision system prompts for market sizing, ICP psychological profiling, ad copywriting, competitor gap analysis, and executive strategy.',
    thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
    fileUrl: '/downloads/ai-growth-prompts.pdf',
    category: 'AI & Automation',
    leadCaptureRequired: true,
    isFeatured: true,
    featured: true,
    downloadCount: 4120,
    status: 'published',
    fileSize: '3.4 MB',
    fileType: 'PDF',
    format: 'PDF Document',
    author: 'Digital Muid',
    readingTimeMinutes: 15,
    previewPoints: [
      '50+ Battle-tested prompts categorized by business function',
      'Chain-of-thought frameworks for deep market research',
      'High-converting ad script generators for Meta & Google',
      'System prompts for persona stress-testing and customer objections'
    ]
  },
  {
    id: 'res-02',
    slug: 'digital-growth-checklist-32-vectors',
    title: 'The 32-Point Digital Growth & Readiness Checklist',
    name: 'The 32-Point Digital Growth & Readiness Checklist',
    resourceType: 'Checklist',
    type: 'Checklist',
    description: 'The exact diagnostic checklist we use during private client audits to uncover marketing leaks, conversion bottlenecks, and automation opportunities.',
    thumbnailUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80',
    fileUrl: '/downloads/digital-growth-checklist.pdf',
    category: 'Growth Strategy',
    leadCaptureRequired: true,
    isFeatured: true,
    featured: true,
    downloadCount: 3890,
    status: 'published',
    fileSize: '1.8 MB',
    fileType: 'PDF',
    format: 'PDF Document',
    author: 'Digital Muid',
    readingTimeMinutes: 10,
    previewPoints: [
      'Diagnostic scoring matrix from 0 to 100 for your digital maturity',
      'Technical SEO, tracking, and pixel audit checklist',
      'Landing page friction index and CRO best practices',
      'AI readiness score for operational bottlenecks'
    ]
  },
  {
    id: 'res-03',
    slug: 'content-strategy-template-30-day-os',
    title: 'Content Strategy Template: The 30-Day Thought Leadership OS',
    name: 'Content Strategy Template: The 30-Day Thought Leadership OS',
    resourceType: 'Template',
    type: 'Template',
    description: 'A modular Notion & spreadsheet template to plan, write, and repurpose high-authority content across LinkedIn, YouTube, and newsletters in 2 hours/week.',
    thumbnailUrl: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80',
    fileUrl: '/downloads/thought-leadership-os.xlsx',
    category: 'Personal Branding',
    leadCaptureRequired: true,
    isFeatured: true,
    featured: true,
    downloadCount: 2940,
    status: 'published',
    fileSize: '2.1 MB',
    fileType: 'XLSX / Notion',
    format: 'Spreadsheet Template',
    author: 'Digital Muid',
    readingTimeMinutes: 12,
    previewPoints: [
      'Pillar-to-micro content distribution framework',
      'Hook library with 45 proven high-retention formats',
      'Editorial calendar calendar template with automated status tags',
      'Metric tracker measuring real pipeline conversion, not vanity likes'
    ]
  },
  {
    id: 'res-04',
    slug: 'marketing-funnel-blueprint-high-intent',
    title: 'High-Intent Marketing Funnel Blueprint',
    name: 'High-Intent Marketing Funnel Blueprint',
    resourceType: 'Blueprint',
    type: 'Blueprint',
    description: 'Visual system map illustrating how to guide cold prospective buyers into committed, paying consultation clients and students.',
    thumbnailUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80',
    fileUrl: '/downloads/marketing-funnel-blueprint.pdf',
    category: 'Marketing',
    leadCaptureRequired: true,
    isFeatured: false,
    featured: false,
    downloadCount: 2150,
    status: 'published',
    fileSize: '4.2 MB',
    fileType: 'PDF',
    format: 'Visual Architecture Blueprint',
    author: 'Digital Muid',
    readingTimeMinutes: 8,
    previewPoints: [
      'End-to-end architecture diagrams for low-ticket and high-ticket offers',
      'Email nurture sequence scripts with 40%+ open rates',
      'Retargeting pixel event mapping blueprint'
    ]
  }
];

export const INITIAL_COURSES: Course[] = [
  {
    id: 'crs-01',
    slug: 'digital-marketing-masterclass',
    title: 'Digital Marketing Masterclass: The Complete Modern Growth System',
    shortOutcome: 'Master strategic demand generation, performance paid media, intent search, and full-funnel conversion.',
    description: 'A comprehensive, hands-on master program designed for founders, marketing heads, and ambitious professionals looking to build, execute, and scale modern marketing campaigns.',
    curriculum: [
      {
        module: 'Module 1: Strategic Foundations & Market Moats',
        lessons: ['Deconstructing the Modern Buyer', 'Value Proposition Architecture', 'Unit Economics & CAC/LTV Equations'],
        duration: '3.5 hours'
      },
      {
        module: 'Module 2: Performance Paid Media Execution',
        lessons: ['Meta Ads Ecosystem & Algorithmic Creative', 'Google Search & Performance Max', 'Attribution & First-Party Analytics'],
        duration: '5.0 hours'
      },
      {
        module: 'Module 3: Organic Demand & Authority Publishing',
        lessons: ['Search Intent Dominance', 'Video Content Engines', 'Email Nurture Systems'],
        duration: '4.0 hours'
      },
      {
        module: 'Module 4: Conversion Rate Optimization & Funnels',
        lessons: ['High-Velocity Landing Pages', 'Checkout Friction Reduction', 'Post-Purchase Retention Loops'],
        duration: '3.5 hours'
      }
    ],
    duration: '16 Hours · 38 Lessons',
    level: 'All Levels',
    price: 4999,
    offerPrice: 2499,
    thumbnail: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80',
    instructor: 'Digital Muid',
    aiIntegrated: true,
    featured: true,
    status: 'published',
    enrolledCount: 1420,
    tags: ['Digital Marketing', 'Growth', 'Meta Ads', 'SEO'],
    highlights: [
      '15+ Years of battle-tested frameworks',
      'Real-world campaign budgets & audits',
      'Lifetime access & quarterly curriculum updates',
      'Certificate of Completion & private alumni network'
    ]
  },
  {
    id: 'crs-02',
    slug: 'meta-ads-mastery',
    title: 'Meta Ads Mastery: Algorithmic Scaling & Creative Strategy',
    shortOutcome: 'Build profitable, high-ROAS ad campaigns using algorithmic audience matching and dynamic creative testing.',
    description: 'Stop guessing on ad creative. Learn the exact testing protocols, budget pacing rules, and creative frameworks used to scale ad accounts profitably.',
    curriculum: [
      {
        module: 'Module 1: The Modern Meta Algorithm',
        lessons: ['How Meta Delivers Ads in 2026', 'Broad Targeting vs Advantage+', 'Signal Optimization'],
        duration: '2.5 hours'
      },
      {
        module: 'Module 2: High-Performance Creative Production',
        lessons: ['Hook Frameworks (Visual & Verbal)', 'Direct Response Scripting', 'UGC vs Editorial Formats'],
        duration: '4.0 hours'
      },
      {
        module: 'Module 3: Account Architecture & Scaling Rules',
        lessons: ['Creative Testing Sandboxes', 'Scaling Vertically & Horizontally', 'Managing Fatigue'],
        duration: '3.5 hours'
      }
    ],
    duration: '10 Hours · 24 Lessons',
    level: 'Intermediate',
    price: 3499,
    offerPrice: 1999,
    thumbnail: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80',
    instructor: 'Digital Muid',
    aiIntegrated: true,
    featured: true,
    status: 'published',
    enrolledCount: 980,
    tags: ['Meta Ads', 'Paid Media', 'ROAS'],
    highlights: [
      'Live ad account breakdowns',
      'Creative brief templates for design teams',
      'Direct response copywriting formulas'
    ]
  },
  {
    id: 'crs-03',
    slug: 'ai-automation-business-operations',
    title: 'AI & Automation for Modern Business Operations',
    shortOutcome: 'Deploy intelligent LLM agents and automated workflows to cut 15+ hours of manual operations every week.',
    description: 'A deeply pragmatic, non-technical blueprint for business owners to automate customer triage, reporting, intake, and content workflows.',
    curriculum: [
      {
        module: 'Module 1: AI Readiness & Process Decomposition',
        lessons: ['Identifying High-Leverage Tasks', 'Cost vs Speed Tradeoffs', 'Choosing the Right Models'],
        duration: '2.0 hours'
      },
      {
        module: 'Module 2: Building Autonomous Workflows',
        lessons: ['Connecting APIs & Webhooks', 'Automated Email & Calendar Systems', 'CRM Synchronizations'],
        duration: '4.5 hours'
      },
      {
        module: 'Module 3: Custom LLM Agents with Guardrails',
        lessons: ['System Prompt Engineering', 'Human Verification Gates', 'Deploying Safe Customer Agents'],
        duration: '3.5 hours'
      }
    ],
    duration: '10 Hours · 22 Lessons',
    level: 'Intermediate',
    price: 3999,
    offerPrice: 2199,
    thumbnail: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
    instructor: 'Digital Muid',
    aiIntegrated: true,
    featured: true,
    status: 'published',
    enrolledCount: 840,
    tags: ['AI', 'Automation', 'Operations', 'Workflows'],
    highlights: [
      'Ready-to-import webhook & workflow templates',
      'No-code & low-code integration guides',
      'Executive AI compliance playbook'
    ]
  },
  {
    id: 'crs-04',
    slug: 'social-media-mastery',
    title: 'Social Media Mastery: Organic Distribution & Authority',
    shortOutcome: 'Build an engaged, high-intent audience across LinkedIn, YouTube, and Instagram without gimmicks.',
    description: 'Transform organic social media from an inconsistent chore into a reliable client acquisition and brand reputation engine.',
    curriculum: [
      {
        module: 'Module 1: Content Architecture',
        lessons: ['Core Thesis Definition', 'Format Stacking', 'Writing for High Retention'],
        duration: '3.0 hours'
      },
      {
        module: 'Module 2: Platform Mechanics',
        lessons: ['LinkedIn Thought Leadership', 'YouTube Longform to Shortform', 'Instagram Carousels'],
        duration: '3.5 hours'
      }
    ],
    duration: '6.5 Hours · 18 Lessons',
    level: 'All Levels',
    price: 2499,
    offerPrice: 1499,
    thumbnail: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80',
    instructor: 'Digital Muid',
    aiIntegrated: false,
    featured: false,
    status: 'published',
    enrolledCount: 650,
    tags: ['Social Media', 'LinkedIn', 'Personal Brand'],
    highlights: [
      'Proven post templates with 100k+ reach',
      'Profile optimization guidelines',
      'Repurposing workflows'
    ]
  },
  {
    id: '14c77e7b-c9c4-41e2-896d-b74935941ae5',
    slug: 'seo-search-engine-optimisation-with-ai-integration',
    title: 'SEO ( search engine optimisation) with AI integration',
    shortOutcome: 'Complete seo mastery course using AI',
    description: 'Ai implemented seo optimised course',
    curriculum: [
      {
        id: 'mod-1',
        module: 'Module 1: Strategic Architecture & Foundations',
        title: 'Module 1: Strategic Architecture & Foundations',
        summary: 'Deconstruct core growth vectors, positioning moats, and unit economics.',
        duration: '3.5 hours',
        order: 1,
        lessons: [
          {
            id: 'lsn-1-1',
            order: 1,
            title: 'Seo optimisation implementation',
            duration: '45 mins',
            deliveryType: 'live',
            videoUrl: '',
            meetUrl: '',
            isPreview: true,
            description: ''
          },
          {
            id: 'lsn-1-2',
            order: 2,
            title: 'Lesson 3: Core Execution',
            duration: '45 mins',
            deliveryType: 'live',
            videoUrl: '',
            meetUrl: '',
            isPreview: false,
            description: ''
          },
          {
            id: 'lsn-1-3',
            order: 3,
            title: 'Lesson 4: Core Execution',
            duration: '45 mins',
            deliveryType: 'live',
            videoUrl: '',
            meetUrl: '',
            isPreview: false,
            description: ''
          }
        ]
      }
    ],
    duration: '8 Hours · 21 Lessons',
    level: 'Beginner',
    deliveryMode: 'Self-Paced',
    price: 8999,
    offerPrice: 2499,
    offerExpiresAt: '2026-09-18T00:00:00+00:00',
    currency: 'INR',
    thumbnail: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80',
    instructor: 'Digital Muid',
    instructorTitle: 'Growth Architect & Strategy Consultant',
    aiIntegrated: true,
    aiToolsCovered: ['ChatGPT Plus', 'Claude 3.7', 'Perplexity', 'Make.com', 'Opus'],
    featured: false,
    status: 'published',
    enrolledCount: 17,
    cohortStartDate: '2026-08-31T00:00:00+00:00',
    maxSeats: 50,
    tags: ['Digital Growth', 'Masterclass', 'AI Transformation'],
    highlights: [
      'Direct Live Cohort masterclass with Digital Muid',
      'Interactive workspace templates & execution playbooks',
      'Lifetime access to recordings & private student network',
      'Verified Certificate of Completion',
      'Implementation'
    ]
  }
];

export const INITIAL_TESTIMONIALS: Testimonial[] = [
  {
    id: 't-01',
    name: 'Rajesh Sharma',
    role: 'Founder & CEO',
    company: 'FinVantage Solutions',
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
    category: 'Clients',
    quote: 'Booking a consultation with Digital Muid was the turning point in our quarterly marketing strategy. In 30 minutes, he dissected our broken funnel and gave us a razor-sharp 3-step action plan that tripled our pipeline qualified leads in under 6 weeks.',
    metric: '3.2x Qualified Inbound Pipeline'
  },
  {
    id: 't-02',
    name: 'Priya Narayanan',
    role: 'Head of Growth',
    company: 'Aura Health & Care',
    photo: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80',
    category: 'Clients',
    quote: 'Muid does not speak in empty buzzwords. His Digital Growth Stack framework allowed our executive team to finally align customer acquisition, patient booking systems, and automated follow-ups into one coherent engine.',
    metric: '-42% Patient Acquisition Cost'
  },
  {
    id: 't-03',
    name: 'Karan Malhotra',
    role: 'Digital Marketing Strategist',
    company: 'ScaleX Media',
    photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
    category: 'Students',
    quote: 'The depth of real-world implementation in Muid’s masterclasses is unmatched. He teaches you how algorithms actually function under the hood, not just what buttons to click in Ad Manager.',
    metric: 'Promoted to Senior Growth Lead'
  },
  {
    id: 't-04',
    name: 'Dr. Sameer Siddiqui',
    role: 'Managing Director',
    company: 'Apex Healthcare Clinics',
    photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=300&q=80',
    category: 'Collaborators',
    quote: 'Having Digital Muid as a keynote speaker at our annual health-tech summit energized our entire leadership team. His perspective on ethical AI and digital transformation was the highest rated session.',
    metric: '98% Attendee Approval'
  }
];

export const INITIAL_SPEAKING_EVENTS: SpeakingEvent[] = [
  {
    id: 'spk-01',
    title: 'AI Transformation & The Future of Business Growth',
    eventName: 'Global Tech & Growth Summit',
    location: 'Mumbai & Hybrid Broadcast',
    date: 'October 2026',
    type: 'Keynote',
    topic: 'How mid-market enterprises can deploy intelligent LLM systems without risking brand reputation or customer trust.',
    photo: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=800&q=80',
    attendees: '1,200+ Executives'
  },
  {
    id: 'spk-02',
    title: 'The Death of Vanity Metrics: Building Defensible Founder Authority',
    eventName: 'Founder & Venture Conclave',
    location: 'Bengaluru, India',
    date: 'August 2026',
    type: 'Panel',
    topic: 'Navigating algorithmic distribution changes and creating trademarked IP assets in crowded markets.',
    photo: 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?auto=format&fit=crop&w=800&q=80',
    attendees: '600+ Founders'
  },
  {
    id: 'spk-03',
    title: 'Healthcare Digital Transformation: Patient Journey Orchestration',
    eventName: 'National Healthcare Innovation Forum',
    location: 'New Delhi, India',
    date: 'May 2026',
    type: 'Workshop',
    topic: 'Connecting digital discovery, automated patient triage, and high-trust clinic consultation systems.',
    photo: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=800&q=80',
    attendees: '350+ Clinic Leaders'
  }
];

export const INITIAL_BOOKINGS: Booking[] = [
  {
    id: 'bk-101',
    bookingCode: 'DM-2026-8941',
    customerName: 'Ananya Deshmukh',
    customerEmail: 'ananya@elevatetech.io',
    customerPhone: '+91 98765 43210',
    businessName: 'Elevate Tech Systems',
    primaryChallenge: 'High customer acquisition cost and lack of organic founder authority.',
    desiredOutcome: 'A clear roadmap to integrate the Digital Growth Stack and reduce ad dependency.',
    website: 'https://elevatetech.io',
    linkedin: 'https://linkedin.com/in/ananyadeshmukh',
    date: '2026-08-16',
    time: '15:30',
    durationMinutes: 30,
    baseAmount: 499,
    gstRate: 0.18,
    gstAmount: 89.82,
    totalAmount: 588.82,
    currency: 'INR',
    paymentId: 'pay_Nzgq829391024',
    razorpayOrderId: 'order_Nzgq1092837',
    paymentStatus: 'paid',
    calendarEventId: 'cal_evt_8912401',
    meetUrl: 'https://meet.google.com/muid-strat-grow',
    status: 'confirmed',
    createdAt: '2026-08-14T01:20:00Z',
    notes: 'Prioritized for enterprise software scale evaluation.'
  }
];

export const INITIAL_LEADS: Lead[] = [
  {
    id: 'lead-01',
    name: 'Ananya Deshmukh',
    email: 'ananya@elevatetech.io',
    phone: '+91 98765 43210',
    source: 'Consultation',
    interest: 'Business Growth Consultation',
    notes: 'Paid booking confirmed for Aug 16, 3:30 PM. Focus on CAC reduction.',
    status: 'Qualified',
    createdAt: '2026-08-14T01:20:00Z',
    amount: 588.82
  },
  {
    id: 'lead-02',
    name: 'Vikram Sethi',
    email: 'vikram.sethi@logistix.com',
    phone: '+91 98111 22334',
    source: 'Resource Download',
    interest: 'AI Prompt Pack: 50+ High-Performance Growth Prompts',
    notes: 'Downloaded prompt pack. Interested in enterprise operational automation.',
    status: 'New',
    createdAt: '2026-08-13T18:45:00Z'
  },
  {
    id: 'lead-03',
    name: 'Sneha Roy',
    email: 'sneha@brandstudio.in',
    phone: '+91 97234 56789',
    source: 'Newsletter',
    interest: 'The Digital Muid Brief',
    notes: 'Subscribed to weekly brief via homepage footer.',
    status: 'Contacted',
    createdAt: '2026-08-12T11:10:00Z'
  }
];

export const INITIAL_SETTINGS: SiteSettings = {
  adminEmail: 'mkdigitalverse@gmail.com',
  razorpayKeyId: 'rzp_live_DigitalMuidKeyId',
  razorpayTestMode: true,
  googleCalendarConnected: true,
  googleMeetEnabled: true,
  notificationEmail: 'mkdigitalverse@gmail.com',
  phoneContact: '+91 98000 12345',
  locationCity: 'Mumbai & Bangalore, India',
  socialLinkedin: 'https://www.linkedin.com/in/digitalmuid',
  socialInstagram: 'https://www.instagram.com/digitalmuid',
  socialFacebook: 'https://www.facebook.com/digitalmuid',
  socialYoutube: 'https://www.youtube.com/@digitalmuid'
};
