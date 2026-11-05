/**
 * Centralized SEO Configuration and Metadata for DigitalMUID
 * 
 * ESM format compatible with both Node.js (scripts/server) and Vite/React (client).
 */

export const BASE_URL = 'https://digitalmuid.in';

export const SEO_DATA = {
  '/': {
    path: '/',
    canonicalUrl: 'https://digitalmuid.in/',
    title: 'Digital Muid — Growth Strategist | Founder | Educator | AI & Digital Transformation',
    description: 'I help businesses and professionals understand the changing digital world—and turn knowledge into meaningful growth. Strategic consulting, practical AI frameworks, courses, and resources.',
    ogTitle: 'Digital Muid — Growth Strategist | Founder | Educator',
    ogDescription: 'Turn digital knowledge into meaningful growth. Frameworks, education, and strategic consultation.',
    ogType: 'website',
    schema: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          '@id': 'https://digitalmuid.in/#organization',
          name: 'DigitalMUID',
          url: 'https://digitalmuid.in/',
          logo: 'https://digitalmuid.in/favicon.ico',
          founder: {
            '@type': 'Person',
            name: 'Digital Muid',
            jobTitle: 'Growth Strategist & AI Transformation Consultant',
            url: 'https://digitalmuid.in/about'
          },
          sameAs: [
            'https://www.linkedin.com/in/digitalmuid',
            'https://www.instagram.com/digitalmuid',
            'https://www.youtube.com/@digitalmuid'
          ]
        },
        {
          '@type': 'WebSite',
          '@id': 'https://digitalmuid.in/#website',
          url: 'https://digitalmuid.in/',
          name: 'DigitalMUID',
          publisher: { '@id': 'https://digitalmuid.in/#organization' }
        }
      ]
    },
    semanticHtml: `
      <header>
        <h1>Digital Muid — Growth Strategist, Founder & AI Transformation Consultant</h1>
        <p>Turning digital knowledge into predictable business growth through AI frameworks, education, and advisory.</p>
      </header>
      <main>
        <nav aria-label="Main Navigation">
          <ul>
            <li><a href="/web">Web Design & Development Services</a></li>
            <li><a href="/learn">Practical Digital Education & Courses</a></li>
            <li><a href="/business-growth-consultation">Book a Business Growth Consultation</a></li>
            <li><a href="/services">Strategic Advisory Services</a></li>
            <li><a href="/contact">Get in Touch</a></li>
          </ul>
        </nav>
      </main>
    `
  },

  '/web': {
    path: '/web',
    canonicalUrl: 'https://digitalmuid.in/web',
    title: 'Website Design & Development Services | DigitalMUID',
    description: 'Professional website design and custom development by DigitalMUID. We build high-converting business websites, LMS portals, booking systems, and e-commerce platforms.',
    ogTitle: 'Website Design & Development Services | DigitalMUID',
    ogDescription: 'Custom business websites, LMS portals, booking platforms, and web applications built for speed, conversion, and scale.',
    ogType: 'website',
    schema: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'ProfessionalService',
          '@id': 'https://digitalmuid.in/#organization',
          name: 'DigitalMUID Web Design & Development',
          url: 'https://digitalmuid.in/web',
          description: 'Professional website design and custom web development services for ambitious brands, founders, and growing enterprises.',
          serviceType: 'Website Design, Web Development, LMS Systems, Booking Platforms, E-Commerce Portals',
          areaServed: 'Worldwide',
          provider: {
            '@type': 'Person',
            name: 'Digital Muid'
          }
        },
        {
          '@type': 'WebPage',
          '@id': 'https://digitalmuid.in/web#webpage',
          url: 'https://digitalmuid.in/web',
          name: 'Website Design & Development Services | DigitalMUID',
          description: 'Professional website design and custom development by DigitalMUID. We build high-converting business websites, LMS portals, booking systems, and e-commerce platforms.'
        }
      ]
    },
    semanticHtml: `
      <article>
        <header>
          <h1>Website Design & Custom Web Development Services</h1>
          <p>We build high-converting business websites, LMS portals, booking platforms, and custom digital applications designed for authority, speed, and real revenue generation.</p>
        </header>
        <section>
          <h2>Core Web Solutions & Deliverables</h2>
          <ul>
            <li><strong>New Business Websites:</strong> Clean, high-converting digital foundations with modern typography, fast loading speeds, and responsive mobile architecture.</li>
            <li><strong>Website Redesigns:</strong> Modernize legacy, slow, or low-converting websites into authoritative brand assets.</li>
            <li><strong>LMS & E-Learning Portals:</strong> Course player interfaces, student dashboards, secure video streaming, and automated certificate verification.</li>
            <li><strong>Online Booking & Consultation Systems:</strong> Real-time calendar synchronization, payment gateways (Razorpay/Stripe), and client scheduling.</li>
            <li><strong>E-Commerce & Digital Commerce:</strong> Scalable product catalogs, secure checkout flows, and automated customer notifications.</li>
            <li><strong>Custom Web Applications:</strong> Bespoke full-stack React, TypeScript, and modern API-driven web systems.</li>
          </ul>
        </section>
        <section>
          <h2>Our Development Standards</h2>
          <p>Every website built by DigitalMUID adheres to strict production engineering: Lighthouse scores above 90, sub-second load times, mobile-first responsive layout, search engine structured data, and hardened SSL security.</p>
        </section>
        <section>
          <h2>Start Your Project Enquiry</h2>
          <p>Discuss your project scope, timeline, and custom requirements directly with our engineering team.</p>
          <p><a href="/contact">Submit a Project Enquiry</a> or <a href="/business-growth-consultation">Schedule an Advisory Consultation</a>.</p>
        </section>
      </article>
    `
  },

  '/academy': {
    path: '/academy',
    canonicalUrl: 'https://digitalmuid.in/academy',
    title: 'Digital MUID Academy | Digital Marketing & AI Education',
    description: 'Explore practical digital marketing, advertising, SEO, and AI education for students, freelancers, and growth operators at Digital MUID Academy.',
    ogTitle: 'Digital MUID Academy | Digital Marketing & AI Education',
    ogDescription: 'Explore practical digital marketing, advertising, SEO, and AI education for students, freelancers, and growth operators at Digital MUID Academy.',
    ogType: 'website',
    schema: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'EducationalOrganization',
          '@id': 'https://digitalmuid.in/academy#organization',
          name: 'Digital MUID Academy',
          url: 'https://digitalmuid.in/academy',
          description: 'Explore practical digital marketing, advertising, SEO, and AI education for students, freelancers, and growth operators at Digital MUID Academy.',
          founder: {
            '@type': 'Person',
            name: 'Digital Muid',
            jobTitle: 'Growth Strategist & Systems Architect'
          },
          hasOfferCatalog: {
            '@type': 'OfferCatalog',
            name: 'Digital MUID Curriculums',
            itemListElement: [
              {
                '@type': 'Course',
                name: 'Meta Ads Mastery: Algorithmic Scaling & Creative Strategy',
                description: 'Build profitable, high-ROAS ad campaigns using algorithmic audience matching and dynamic creative testing.',
                url: 'https://digitalmuid.in/learn/meta-ads-mastery',
                offers: {
                  '@type': 'Offer',
                  price: '1999',
                  priceCurrency: 'INR',
                  availability: 'https://schema.org/InStock'
                }
              },
              {
                '@type': 'Course',
                name: 'SEO (Search Engine Optimisation) with AI Integration',
                description: 'Complete SEO mastery course integrating AI search engines, programmatic workflows, and topical authority.',
                url: 'https://digitalmuid.in/learn/seo-search-engine-optimisation-with-ai-integration',
                offers: {
                  '@type': 'Offer',
                  price: '2499',
                  priceCurrency: 'INR',
                  availability: 'https://schema.org/InStock'
                }
              },
              {
                '@type': 'Course',
                name: 'AI & Automation for Modern Business Operations',
                description: 'Deploy intelligent LLM agents and automated workflows to cut 15+ hours of manual operations every week.',
                url: 'https://digitalmuid.in/learn/ai-automation-business-operations',
                offers: {
                  '@type': 'Offer',
                  price: '2199',
                  priceCurrency: 'INR',
                  availability: 'https://schema.org/InStock'
                }
              }
            ]
          }
        },
        {
          '@type': 'WebPage',
          '@id': 'https://digitalmuid.in/academy#webpage',
          url: 'https://digitalmuid.in/academy',
          name: 'Digital MUID Academy | Digital Marketing & AI Education',
          description: 'Explore practical digital marketing, advertising, SEO, and AI education for students, freelancers, and growth operators at Digital MUID Academy.'
        }
      ]
    },
    semanticHtml: `
      <article>
        <header>
          <h1>Digital MUID Academy: Stop learning platform hacks. Master the mechanics of digital growth.</h1>
          <p>We teach systems, not just buttons. Practical digital marketing, performance advertising, SEO, and AI workflows for high-ticket growth operators.</p>
        </header>
        <section>
          <h2>Educational Philosophy</h2>
          <p>We teach systems, not just buttons. Understand customer intent, CAC/LTV unit economics, attribution telemetry, and autonomous AI agents rather than ephemeral platform tricks.</p>
        </section>
        <section>
          <h2>Featured Curriculums</h2>
          <ul>
            <li><strong>Meta & Google Ads Mastery (₹1,999):</strong> Algorithmic media buying, creative testing sandboxes, CAPI telemetry.</li>
            <li><strong>SEO with AI Integration (₹2,499):</strong> Topical authority clusters, schema markup, generative AI search workflows.</li>
            <li><strong>AI & Automation for Operations (₹2,199):</strong> Autonomous triage agents, webhook synchronization, zero manual friction.</li>
          </ul>
        </section>
        <section>
          <h2>Free Foundation Courses & Toolkits</h2>
          <p>The 60-Minute Digital Marketing Blueprint, Intro to Freelancing & Client Acquisition, AI Prompt Pack, Growth Checklist, and Content Strategy OS.</p>
        </section>
      </article>
    `
  },

  '/learn': {
    path: '/learn',
    canonicalUrl: 'https://digitalmuid.in/learn',
    title: 'Practical Digital Education & AI Courses | DigitalMUID',
    description: 'Practical, AI-integrated digital masterclasses for founders, marketers, and professionals. Real-world systems, actionable frameworks, and live campaigns.',
    ogTitle: 'Practical Digital Education & AI Courses | DigitalMUID',
    ogDescription: 'Master practical digital marketing, Meta Ads, and AI automation with actionable courses designed to build real business systems.',
    ogType: 'website',
    schema: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'EducationalOccupationalProgram',
          '@id': 'https://digitalmuid.in/learn#program',
          name: 'DigitalMUID Masterclasses & Digital Education',
          description: 'Comprehensive, project-based educational curriculum covering Meta Ads Mastery, AI-assisted operations, and modern performance marketing.',
          provider: {
            '@type': 'Organization',
            name: 'DigitalMUID',
            url: 'https://digitalmuid.in/'
          },
          hasCourse: [
            {
              '@type': 'Course',
              name: 'Meta Ads Mastery: Complete Campaign Architecture',
              description: 'End-to-end framework for profitable Meta advertising, audience psychology, creative testing loops, and attribution modeling.',
              url: 'https://digitalmuid.in/learn/meta-ads-mastery'
            },
            {
              '@type': 'Course',
              name: 'AI Automation for Business Operations',
              description: 'Practical frameworks for integrating LLMs, workflow automation, and custom agent systems into daily business operations.',
              url: 'https://digitalmuid.in/learn/ai-automation-business-operations'
            }
          ]
        },
        {
          '@type': 'WebPage',
          '@id': 'https://digitalmuid.in/learn#webpage',
          url: 'https://digitalmuid.in/learn',
          name: 'Practical Digital Education & AI Courses | DigitalMUID',
          description: 'Practical, AI-integrated digital masterclasses for founders, marketers, and professionals. Real-world systems, actionable frameworks, and live campaigns.'
        }
      ]
    },
    semanticHtml: `
      <article>
        <header>
          <h1>Practical Digital Education & Performance Masterclasses</h1>
          <p>Don't just collect certificates. Build, launch, measure, and scale real digital systems with production-grade templates and live campaign walkthroughs.</p>
        </header>
        <section>
          <h2>Featured Masterclasses & Programs</h2>
          <ul>
            <li>
              <h3>Meta Ads Mastery: Complete Campaign Architecture</h3>
              <p>Comprehensive training on high-performance Meta advertising, audience targeting frameworks, creative fatigue mitigation, and conversion tracking.</p>
              <a href="/learn/meta-ads-mastery">View Meta Ads Mastery Course</a>
            </li>
            <li>
              <h3>AI Automation for Business Operations</h3>
              <p>Practical deployment of generative AI, automated lead flows, operational LLMs, and no-code/low-code integrations.</p>
              <a href="/learn/ai-automation-business-operations">View AI Automation Masterclass</a>
            </li>
          </ul>
        </section>
        <section>
          <h2>Our Learning Standard</h2>
          <p>Every cohort and course provides production-ready assets, verified certificates of completion, and direct actionable insights tested in active client businesses.</p>
          <p><a href="/business-growth-consultation">Need personalized advisory instead? Book a 1-on-1 Consultation</a></p>
        </section>
      </article>
    `
  },

  '/contact': {
    path: '/contact',
    canonicalUrl: 'https://digitalmuid.in/contact',
    title: 'Contact Digital Muid — Growth Advisory & Inquiries',
    description: 'Get in touch with Digital Muid for growth strategy advisory, web development inquiries, speaking engagements, and collaboration opportunities.',
    ogTitle: 'Contact Digital Muid — Growth Advisory & Inquiries',
    ogDescription: 'Connect with Digital Muid for strategic advisory, enterprise web projects, or keynote speaking inquiries.',
    ogType: 'website',
    schema: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'ContactPage',
          '@id': 'https://digitalmuid.in/contact#webpage',
          url: 'https://digitalmuid.in/contact',
          name: 'Contact Digital Muid — Growth Advisory & Inquiries',
          description: 'Direct communication channels for consulting, custom website scoping, executive masterclasses, and keynote speaking engagements.',
          mainEntity: {
            '@type': 'Person',
            name: 'Digital Muid',
            jobTitle: 'Growth Strategist & Founder',
            email: 'hello@digitalmuid.in',
            url: 'https://digitalmuid.in/about'
          }
        }
      ]
    },
    semanticHtml: `
      <article>
        <header>
          <h1>Get in Touch with Digital Muid</h1>
          <p>Have a question regarding strategic growth advisory, custom website development, or corporate education? Let's connect.</p>
        </header>
        <section>
          <h2>Direct Inquiries & Collaboration</h2>
          <p>Whether you represent an established enterprise modernizing legacy workflows or an ambitious founder building what's next, we welcome meaningful discussions.</p>
          <ul>
            <li><strong>Email:</strong> <a href="mailto:hello@digitalmuid.in">hello@digitalmuid.in</a></li>
            <li><strong>Headquarters:</strong> Lucknow, Uttar Pradesh, India (Serving clients globally)</li>
            <li><strong>Inquiry Categories:</strong> Strategic Advisory, Website Development, Keynote Speaking, Custom Corporate Cohorts</li>
          </ul>
        </section>
        <section>
          <h2>Schedule a Dedicated Growth Consultation</h2>
          <p>If you require immediate 1-on-1 strategic focus for your business architecture, reserve a dedicated slot on the calendar.</p>
          <p><a href="/business-growth-consultation">Book a 1-on-1 Consultation</a></p>
        </section>
      </article>
    `
  },

  '/book-consultation': {
    path: '/book-consultation',
    canonicalUrl: 'https://digitalmuid.in/book-consultation',
    title: 'Book a 1:1 Growth Diagnostic Consultation | Digital Muid',
    description: 'Reserve a private Growth Diagnostic Session with Muid Khan. Identify pipeline leaks, eliminate wasted ad spend, and receive an engineered acquisition blueprint.',
    ogTitle: 'Book a 1:1 Growth Diagnostic Consultation | Digital Muid',
    ogDescription: 'Reserve a private Growth Diagnostic Session with Muid Khan. Identify pipeline leaks, eliminate wasted ad spend, and receive an engineered acquisition blueprint.',
    ogType: 'website',
    schema: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Service',
          '@id': 'https://digitalmuid.in/book-consultation#service',
          name: '1:1 Growth Diagnostic Consultation',
          serviceType: 'Executive Strategy & Digital Advisory',
          provider: {
            '@type': 'Person',
            name: 'Muid Khan',
            jobTitle: 'Growth Strategist & AI Transformation Consultant',
            url: 'https://digitalmuid.in/about'
          },
          description: 'Reserve a private Growth Diagnostic Session with Muid Khan. Identify pipeline leaks, eliminate wasted ad spend, and receive an engineered acquisition blueprint.',
          areaServed: 'Worldwide'
        },
        {
          '@type': 'WebPage',
          '@id': 'https://digitalmuid.in/book-consultation#webpage',
          url: 'https://digitalmuid.in/book-consultation',
          name: 'Book a 1:1 Growth Diagnostic Consultation | Digital Muid',
          description: 'Reserve a private Growth Diagnostic Session with Muid Khan. Identify pipeline leaks, eliminate wasted ad spend, and receive an engineered acquisition blueprint.'
        }
      ]
    },
    semanticHtml: `
      <article>
        <header>
          <h1>Book a 1:1 Growth Diagnostic Consultation</h1>
          <p>Reserve a private Growth Diagnostic Session with Muid Khan. Identify pipeline leaks, eliminate wasted ad spend, and receive an engineered acquisition blueprint.</p>
        </header>
        <section>
          <h2>Growth Diagnostic Scope</h2>
          <ul>
            <li><strong>Pipeline & Conversion Audit:</strong> Identify funnel friction points and customer drop-offs.</li>
            <li><strong>Ad Spend & Unit Economics:</strong> Eliminate wasted advertising budget and improve CAC-to-LTV ratios.</li>
            <li><strong>Engineered Acquisition Blueprint:</strong> Receive actionable, prioritized growth architecture tailored to your business.</li>
          </ul>
        </section>
      </article>
    `
  },

  '/business-growth-consultation': {
    path: '/book-consultation',
    canonicalUrl: 'https://digitalmuid.in/book-consultation',
    title: 'Book a 1:1 Growth Diagnostic Consultation | Digital Muid',
    description: 'Reserve a private Growth Diagnostic Session with Muid Khan. Identify pipeline leaks, eliminate wasted ad spend, and receive an engineered acquisition blueprint.',
    ogTitle: 'Book a 1:1 Growth Diagnostic Consultation | Digital Muid',
    ogDescription: 'Reserve a private Growth Diagnostic Session with Muid Khan. Identify pipeline leaks, eliminate wasted ad spend, and receive an engineered acquisition blueprint.',
    ogType: 'website',
    schema: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Service',
          '@id': 'https://digitalmuid.in/book-consultation#service',
          name: '1:1 Growth Diagnostic Consultation',
          serviceType: 'Executive Strategy & Digital Advisory',
          provider: {
            '@type': 'Person',
            name: 'Muid Khan',
            jobTitle: 'Growth Strategist & AI Transformation Consultant',
            url: 'https://digitalmuid.in/about'
          },
          description: 'Reserve a private Growth Diagnostic Session with Muid Khan. Identify pipeline leaks, eliminate wasted ad spend, and receive an engineered acquisition blueprint.',
          areaServed: 'Worldwide'
        },
        {
          '@type': 'WebPage',
          '@id': 'https://digitalmuid.in/book-consultation#webpage',
          url: 'https://digitalmuid.in/book-consultation',
          name: 'Book a 1:1 Growth Diagnostic Consultation | Digital Muid',
          description: 'Reserve a private Growth Diagnostic Session with Muid Khan. Identify pipeline leaks, eliminate wasted ad spend, and receive an engineered acquisition blueprint.'
        }
      ]
    },
    semanticHtml: `
      <article>
        <header>
          <h1>1-on-1 Strategic Business Growth Consultation</h1>
          <p>Confidential, high-signal advisory designed to unblock your customer acquisition loops, implement real AI workflows, and scale sustainable revenue.</p>
        </header>
        <section>
          <h2>What We Cover in Your Consultation Session</h2>
          <ul>
            <li><strong>Growth Bottleneck Diagnosis:</strong> Thorough audit of current traffic, conversion friction, and retention gaps across your funnel.</li>
            <li><strong>AI & Automation Architecture:</strong> Practical roadmap for replacing repetitive tasks with automated LLM and agent workflows.</li>
            <li><strong>Acquisition Economics (CAC vs. LTV):</strong> Designing repeatable acquisition channels that scale profitably without burning ad budget.</li>
            <li><strong>Digital Infrastructure & Positioning:</strong> High-authority brand positioning and web presence optimization.</li>
          </ul>
        </section>
        <section>
          <h2>Who This Advisory Is Designed For</h2>
          <p>Startup founders, established business owners, agency principals, and marketing leaders seeking actionable clarity without generic agency fluff.</p>
          <p>Every session includes a post-call action blueprint and recorded video deliverables.</p>
        </section>
        <section>
          <h2>Reserve Your Consultation</h2>
          <p>Select your preferred date and time from the interactive booking calendar, complete secure confirmation, and receive immediate calendar credentials.</p>
          <p><a href="/contact">Have a custom corporate inquiry instead? Contact our team</a></p>
        </section>
      </article>
    `
  },

  '/services': {
    path: '/services',
    canonicalUrl: 'https://digitalmuid.in/services',
    title: 'Strategic Services & AI Transformation | DigitalMUID',
    description: 'Strategic growth services, operational AI automation, modern performance marketing, founder personal branding, and bespoke web development.',
    ogTitle: 'Strategic Services & AI Transformation | DigitalMUID',
    ogDescription: 'Comprehensive strategic consulting, automation architecture, and digital engineering for scaling companies.',
    ogType: 'website',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: 'DigitalMUID Strategic Consulting & Engineering',
      url: 'https://digitalmuid.in/services'
    }
  },

  '/services/growth-systems': {
    path: '/services/growth-systems',
    canonicalUrl: 'https://digitalmuid.in/services/growth-systems',
    title: 'Growth Systems & Custom Architecture | DigitalMUID',
    description: 'Verifiable client acquisition engines, high-velocity React web architecture, and automated qualification funnels engineered for unit economics.',
    ogTitle: 'Growth Systems & Custom Architecture | DigitalMUID',
    ogDescription: 'Verifiable client acquisition engines, high-velocity React web architecture, and automated qualification funnels engineered for unit economics.',
    ogType: 'website',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: 'DigitalMUID Growth Systems & Custom Architecture',
      url: 'https://digitalmuid.in/services/growth-systems'
    }
  },

  '/agency-services': {
    path: '/agency-services',
    canonicalUrl: 'https://digitalmuid.in/agency-services',
    title: 'Agency Services | Digital MUID',
    description: 'Custom web architecture, performance marketing, and AI automation engineered to improve acquisition, lead quality, and operational efficiency.',
    ogTitle: 'Agency Services | Digital MUID',
    ogDescription: 'Custom web architecture, performance marketing, and AI automation engineered to improve acquisition, lead quality, and operational efficiency.',
    ogType: 'website',
    schema: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'ProfessionalService',
          '@id': 'https://digitalmuid.in/agency-services#service',
          name: 'Digital MUID Enterprise Performance & Custom Development',
          url: 'https://digitalmuid.in/agency-services',
          description: 'Custom React.js and Node.js web architecture, Meta & Google Ads performance marketing, and CRM AI automation engineered for unit economics.',
          areaServed: 'Worldwide',
          provider: {
            '@type': 'Person',
            name: 'Digital Muid',
            jobTitle: 'Growth Strategist & Systems Operator',
            url: 'https://digitalmuid.in/about'
          }
        },
        {
          '@type': 'WebPage',
          '@id': 'https://digitalmuid.in/agency-services#webpage',
          url: 'https://digitalmuid.in/agency-services',
          name: 'Agency Services | Digital MUID',
          description: 'Custom web architecture, performance marketing, and AI automation engineered to improve acquisition, lead quality, and operational efficiency.'
        }
      ]
    },
    semanticHtml: `
      <article>
        <header>
          <p>ENTERPRISE PERFORMANCE & CUSTOM DEVELOPMENT</p>
          <h1>We build client acquisition engines, not brochure websites.</h1>
          <p>Stop losing qualified leads to slow loading times and broken funnels. We deploy custom React/Node.js architectures integrated with full-funnel performance marketing to drive predictable B2B and D2C revenue.</p>
        </header>
        <section>
          <h2>The True Cost of a Generic Tech Stack</h2>
          <p>If your landing page takes more than 2.5 seconds to load, your Customer Acquisition Cost (CAC) is artificially high.</p>
        </section>
        <section>
          <h2>Full-Stack Mechanics for Scalable Growth</h2>
          <ul>
            <li><strong>Conversion Web Architecture:</strong> Custom web applications using React.js and Node.js engineered for fast load times and reduced conversion friction.</li>
            <li><strong>Algorithmic Media Buying:</strong> Data-driven campaigns across Meta and Google Ads optimized for pipeline velocity and return on ad spend.</li>
            <li><strong>AI & Operational Automation:</strong> Connecting front-end traffic to back-end sales via intelligent CRM automations and AI lead validation.</li>
          </ul>
        </section>
        <section>
          <h2>The Deployment Phases</h2>
          <ol>
            <li><strong>The Build (Days 1–30):</strong> Custom frontend and backend architecture, tracking, and analytics integration. One-time investment.</li>
            <li><strong>The Engine (Ongoing Retainer):</strong> Algorithmic media buying, landing page optimization, and CAC calibration. Monthly partnership.</li>
          </ol>
        </section>
        <section>
          <h2>Ready to audit your infrastructure?</h2>
          <p><a href="/growth-audit">Request a Growth Audit</a></p>
        </section>
      </article>
    `
  },

  '/about': {
    path: '/about',
    canonicalUrl: 'https://digitalmuid.in/about',
    title: 'About Digital Muid | Performance Growth Strategist & Systems Architect',
    description: 'Learn how Muid Khan (Digital Muid) engineers predictable client acquisition systems using custom React/Node.js web architecture, Meta Ads, and AI automation.',
    ogTitle: 'About Digital Muid | Performance Growth Strategist & Systems Architect',
    ogDescription: 'Learn how Muid Khan (Digital Muid) engineers predictable client acquisition systems using custom React/Node.js web architecture, Meta Ads, and AI automation.',
    ogType: 'profile',
    schema: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Person',
          '@id': 'https://digitalmuid.in/#person',
          name: 'Muid Khan',
          alternateName: 'Digital Muid',
          url: 'https://digitalmuid.in',
          jobTitle: 'Performance Growth Strategist & Systems Architect',
          description: 'Specialist in custom React and Node.js web architecture, performance marketing, and automated conversion funnels.'
        },
        {
          '@type': 'Organization',
          '@id': 'https://digitalmuid.in/#organization',
          name: 'Digital Muid',
          url: 'https://digitalmuid.in',
          founder: {
            '@id': 'https://digitalmuid.in/#person'
          },
          subOrganization: [
            {
              '@type': 'Organization',
              name: 'MK Digitalverse'
            },
            {
              '@type': 'EducationalOrganization',
              name: 'MK Digitalverse Academy'
            }
          ]
        },
        {
          '@type': 'FAQPage',
          '@id': 'https://digitalmuid.in/about#faq',
          mainEntity: [
            {
              '@type': 'Question',
              name: 'What exactly does Digital Muid do, and how is it different from a digital marketing agency?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Digital Muid operates as a growth consultancy and systems architecture partner led by Muid Khan, unifying performance marketing (Meta Ads), custom React/Node.js web development, and automated lead triage workflows into a cohesive acquisition system.'
              }
            },
            {
              '@type': 'Question',
              name: 'Why do you build custom-coded websites using React and Node.js instead of CMS platforms like WordPress?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Custom code in React and Node.js eliminates plugin bloat and slow load times, providing sub-second page performance, superior data security, and seamless API integrations with CRM and triage systems that maximize conversion rates.'
              }
            },
            {
              '@type': 'Question',
              name: 'What industries and business stages do you work with?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'We primarily partner with established service businesses, healthcare and aesthetic clinics (such as dental and dermatology practices), high-ticket B2B consultants, and direct-to-consumer brands looking to scale lead generation while managing CAC.'
              }
            },
            {
              '@type': 'Question',
              name: 'How do Digital Muid, MK Digitalverse Academy, and MK Digitalverse work together?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Digital Muid provides strategic consulting and funnel architecture, MK Digitalverse delivers enterprise technology and agency execution globally, and MK Digitalverse Academy trains operators in real-world performance marketing and automation mechanics.'
              }
            },
            {
              '@type': 'Question',
              name: 'How does the engagement process work when working with Digital Muid?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Engagements start with a comprehensive Growth Diagnostic Session to identify funnel bottlenecks and cost-per-acquisition leakages, followed by the deployment of custom web infrastructure, targeted Meta Ads campaigns, and automated follow-up workflows.'
              }
            }
          ]
        }
      ]
    }
  },

  '/terms': {
    path: '/terms',
    canonicalUrl: 'https://digitalmuid.in/terms',
    title: 'Terms & Conditions — DigitalMUID',
    description: 'Terms of service, website use, consultation booking policies, course access conditions, and intellectual property guidelines for DigitalMUID.',
    ogTitle: 'Terms & Conditions — DigitalMUID',
    ogDescription: 'Official terms and conditions governing DigitalMUID services, educational courses, and consultations.',
    ogType: 'website',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Terms & Conditions — DigitalMUID',
      url: 'https://digitalmuid.in/terms'
    }
  }
};

export function getPageSEO(pathname) {
  const clean = (pathname || '/').split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
  
  if (SEO_DATA[clean]) {
    return SEO_DATA[clean];
  }

  // Handle aliases that canonicalize to primary routes
  if (clean === '/consultation') {
    return SEO_DATA['/business-growth-consultation'];
  }
  if (clean === '/courses') {
    return SEO_DATA['/learn'];
  }
  if (clean === '/web-services' || clean === '/web-development' || clean === '/web-design') {
    return SEO_DATA['/web'];
  }

  return null;
}
