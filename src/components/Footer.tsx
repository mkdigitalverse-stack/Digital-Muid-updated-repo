import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  ArrowRight,
  Send,
  Linkedin,
  Instagram,
  Facebook,
  Youtube,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Calendar
} from 'lucide-react';

interface FooterProps {
  navigate: (path: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ navigate }) => {
  const { addSubscriber, settings } = useApp();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      const res = addSubscriber(email, name, 'Footer Brief');
      if (res) {
        setSubscribed(true);
        setEmail('');
        setName('');
      }
    }
  };

  const handleNav = (path: string) => {
    navigate(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const socialLinks = [
    {
      name: 'LinkedIn',
      url: settings.socialLinkedin || 'https://www.linkedin.com/in/digitalmuid',
      icon: Linkedin,
      ariaLabel: 'Follow Digital Muid on LinkedIn'
    },
    {
      name: 'Instagram',
      url: settings.socialInstagram || 'https://www.instagram.com/digitalmuid',
      icon: Instagram,
      ariaLabel: 'Follow Digital Muid on Instagram'
    },
    {
      name: 'Facebook',
      url: settings.socialFacebook || 'https://www.facebook.com/digitalmuid',
      icon: Facebook,
      ariaLabel: 'Follow Digital Muid on Facebook'
    },
    {
      name: 'YouTube',
      url: settings.socialYoutube || 'https://www.youtube.com/@digitalmuid',
      icon: Youtube,
      ariaLabel: 'Subscribe to Digital Muid on YouTube'
    }
  ];

  return (
    <footer id="site-footer" className="bg-[#07111F] text-[#CBD5E1] border-t border-white/10 pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Newsletter Section: The Digital Muid Brief */}
        <div className="p-8 sm:p-10 rounded-3xl bg-[#0A1A2F] border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#1877F2]/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-6 space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF6B00]/10 border border-[#FF6B00]/30 text-[#FF6B00] text-[10px] font-bold uppercase tracking-[0.2em] font-interface">
                <Sparkles className="w-3 h-3" />
                The Digital Muid Brief
              </div>
              <h3 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
                One practical idea about digital growth, AI, or modern marketing.
              </h3>
              <p className="text-[#CBD5E1]/70 text-sm sm:text-base font-interface font-light">
                Delivered without the noise. Join 4,500+ founders, marketers, and leaders who read Muid's weekly strategic breakdown.
              </p>
            </div>

            <div className="lg:col-span-6">
              {subscribed ? (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 text-white">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                  <div>
                    <p className="font-semibold text-sm">You are on the list!</p>
                    <p className="text-xs text-[#CBD5E1]/70">Look out for the next edition directly in your inbox.</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubscribe} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Your First Name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-[#07111F] border border-white/10 text-white placeholder-white/40 text-sm focus:outline-none focus:border-[#FF6B00] transition-colors font-interface"
                    />
                    <input
                      type="email"
                      required
                      placeholder="Your Email Address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-[#07111F] border border-white/10 text-white placeholder-white/40 text-sm focus:outline-none focus:border-[#FF6B00] transition-colors font-interface"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#FF6B00] hover:bg-[#e66000] text-white text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-[#FF6B00]/20 transition-all cursor-pointer font-interface"
                  >
                    <span>Join the Brief</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <p className="text-[11px] text-white/40">
                    Zero spam. Unsubscribe anytime with 1-click.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Main Footer Links Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 pb-12 border-b border-white/10 font-interface">
          {/* Brand Col (4 cols) */}
          <div className="lg:col-span-4 space-y-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded bg-[#1877F2] flex items-center justify-center text-white font-display font-bold text-sm shadow-md shadow-[#1877F2]/20">
                M
              </div>
              <span className="font-display font-bold text-lg text-white tracking-tight">DIGITAL MUID</span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#FF6B00]">
              Founder · Growth Strategist · Educator · AI & Transformation
            </p>
            <p className="text-[#CBD5E1]/70 text-sm leading-relaxed max-w-sm font-light">
              I help businesses and professionals navigate digital growth, AI, and modern marketing—and turn knowledge into measurable action.
            </p>

            {/* Primary Footer CTA */}
            <div className="pt-2">
              <button
                onClick={() => handleNav('/business-growth-consultation')}
                className="w-full sm:w-auto px-6 py-3 bg-[#FF6B00] hover:bg-[#e66000] text-white text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-[#FF6B00]/20 transition-all cursor-pointer rounded-none"
              >
                <Calendar className="w-4 h-4 text-white" />
                <span>BOOK A CONSULTATION</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Social Links (Strict Order: LinkedIn | Instagram | Facebook | YouTube) */}
            <div className="flex items-center gap-3 pt-2" aria-label="Official Social Profiles">
              {socialLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.name}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-lg bg-[#0A1A2F] hover:bg-white/15 border border-white/10 hover:border-white/30 flex items-center justify-center text-white/70 hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-[#FF6B00]"
                    aria-label={item.ariaLabel}
                    title={item.name}
                  >
                    <Icon className="w-4 h-4" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Group 1: Explore (3 cols) */}
          <div className="lg:col-span-3">
            <h4 className="font-display font-bold text-white text-xs uppercase tracking-[0.2em] mb-4">
              Explore
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <button onClick={() => handleNav('/about')} className="hover:text-white text-[#CBD5E1]/70 transition-colors cursor-pointer text-left">
                  About Digital Muid
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('/insights')} className="hover:text-white text-[#CBD5E1]/70 transition-colors cursor-pointer text-left">
                  Insights & Essays
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('/watch')} className="hover:text-white text-[#CBD5E1]/70 transition-colors cursor-pointer text-left">
                  Watch (Keynotes & Talks)
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('/frameworks')} className="hover:text-white text-[#CBD5E1]/70 transition-colors cursor-pointer text-left">
                  Proprietary Frameworks
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('/resources')} className="hover:text-white text-[#CBD5E1]/70 transition-colors cursor-pointer text-left">
                  Resources & Playbooks
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('/speaking')} className="hover:text-white text-[#CBD5E1]/70 transition-colors cursor-pointer text-left">
                  Speaking & Keynotes
                </button>
              </li>
            </ul>
          </div>

          {/* Group 2: Services (3 cols) */}
          <div className="lg:col-span-3">
            <h4 className="font-display font-bold text-white text-xs uppercase tracking-[0.2em] mb-4">
              Services
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <button onClick={() => handleNav('/services/growth-strategy')} className="hover:text-white text-[#CBD5E1]/70 transition-colors cursor-pointer text-left">
                  Growth Strategy
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('/services/ai-automation')} className="hover:text-white text-[#CBD5E1]/70 transition-colors cursor-pointer text-left">
                  AI & Automation
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('/services/modern-marketing')} className="hover:text-white text-[#CBD5E1]/70 transition-colors cursor-pointer text-left">
                  Modern Marketing
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('/services/personal-branding')} className="hover:text-white text-[#CBD5E1]/70 transition-colors cursor-pointer text-left">
                  Personal Branding
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('/services/digital-transformation')} className="hover:text-white text-[#CBD5E1]/70 transition-colors cursor-pointer text-left">
                  Digital Transformation
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('/services/education')} className="hover:text-white text-[#CBD5E1]/70 transition-colors cursor-pointer text-left">
                  Education & Workshops
                </button>
              </li>
            </ul>
          </div>

          {/* Group 3: Learn & Connect (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h4 className="font-display font-bold text-white text-xs uppercase tracking-[0.2em] mb-4">
                Learn
              </h4>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <button onClick={() => handleNav('/learn')} className="text-[#60A5FA] font-medium hover:underline cursor-pointer text-left">
                    Learn With Digital Muid
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-display font-bold text-white text-xs uppercase tracking-[0.2em] mb-4">
                Connect
              </h4>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <button onClick={() => handleNav('/blog')} className="hover:text-white text-[#CBD5E1]/70 transition-colors cursor-pointer text-left">
                    Blog & Articles
                  </button>
                </li>
                <li>
                  <button onClick={() => handleNav('/contact')} className="hover:text-white text-[#CBD5E1]/70 transition-colors cursor-pointer text-left">
                    Get in Touch
                  </button>
                </li>
                <li>
                  <button onClick={() => handleNav('/admin')} className="text-white/40 hover:text-white text-xs flex items-center gap-1 pt-2 cursor-pointer">
                    <ShieldCheck className="w-3 h-3" /> Admin Center
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-white/40 gap-4 font-interface">
          <p>© {new Date().getFullYear()} Digital Muid. All rights reserved. Intellectual property & strategic frameworks.</p>
          <div className="flex items-center gap-6">
            <button onClick={() => handleNav('/contact')} className="hover:text-white cursor-pointer">Privacy Policy</button>
            <button onClick={() => handleNav('/contact')} className="hover:text-white cursor-pointer">Terms of Service</button>
            <button onClick={() => handleNav('/business-growth-consultation')} className="hover:text-white cursor-pointer">Consultation Terms</button>
          </div>
        </div>
      </div>
    </footer>
  );
};
