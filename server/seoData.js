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

  '/business-growth-consultation': {
    path: '/business-growth-consultation',
    canonicalUrl: 'https://digitalmuid.in/business-growth-consultation',
    title: '1-on-1 Business Growth Consultation | DigitalMUID',
    description: 'Book a 1-on-1 strategic growth consultation with Digital Muid. Tailored advisory on AI automation, digital transformation, CAC/LTV scaling, and revenue architecture.',
    ogTitle: '1-on-1 Business Growth Consultation | DigitalMUID',
    ogDescription: 'Strategic advisory for founders and leaders. Unlock bottlenecks in acquisition, AI workflows, and digital operations.',
    ogType: 'website',
    schema: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Service',
          '@id': 'https://digitalmuid.in/business-growth-consultation#service',
          name: '1-on-1 Strategic Business Growth Consultation',
          serviceType: 'Executive Strategy & Digital Advisory',
          provider: {
            '@type': 'Person',
            name: 'Digital Muid',
            jobTitle: 'Growth Strategist & AI Transformation Consultant',
            url: 'https://digitalmuid.in/about'
          },
          description: 'A focused, confidential 1-on-1 strategic deep dive diagnosing growth bottlenecks, customer acquisition economics, AI workflow implementation, and revenue architecture.',
          areaServed: 'Worldwide'
        },
        {
          '@type': 'WebPage',
          '@id': 'https://digitalmuid.in/business-growth-consultation#webpage',
          url: 'https://digitalmuid.in/business-growth-consultation',
          name: '1-on-1 Business Growth Consultation | DigitalMUID',
          description: 'Book a 1-on-1 strategic growth consultation with Digital Muid. Tailored advisory on AI automation, digital transformation, CAC/LTV scaling, and revenue architecture.'
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

  '/about': {
    path: '/about',
    canonicalUrl: 'https://digitalmuid.in/about',
    title: 'About Digital Muid — Growth Strategist & AI Educator',
    description: 'Learn about Digital Muid, background in performance marketing, AI operational frameworks, speaking, and helping brands achieve meaningful scale.',
    ogTitle: 'About Digital Muid — Growth Strategist & AI Educator',
    ogDescription: 'Founder, growth strategist, and educator helping modern businesses build lasting digital authority.',
    ogType: 'profile',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: 'Digital Muid',
      url: 'https://digitalmuid.in/about'
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
