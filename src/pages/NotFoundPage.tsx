import React, { useEffect } from 'react';
import { Compass, ArrowRight, Home, Layers, GraduationCap, MessageSquare, AlertCircle } from 'lucide-react';

interface NotFoundPageProps {
  navigate: (path: string) => void;
  statusCode?: 404 | 410;
  reason?: 'pricing-retired' | 'terms-retired' | 'general';
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({
  navigate,
  statusCode = 404,
  reason = 'general'
}) => {
  useEffect(() => {
    // Set informative page title and meta for crawlers/users
    const originalTitle = document.title;
    if (statusCode === 410) {
      document.title = '410 Content Permanently Retired | DigitalMUID';
    } else {
      document.title = '404 Page Not Found | DigitalMUID';
    }

    let metaRobots = document.querySelector('meta[name="robots"]');
    let createdMeta = false;
    if (!metaRobots) {
      metaRobots = document.createElement('meta');
      metaRobots.setAttribute('name', 'robots');
      document.head.appendChild(metaRobots);
      createdMeta = true;
    }
    const originalRobots = metaRobots.getAttribute('content') || '';
    metaRobots.setAttribute('content', 'noindex, follow');

    window.scrollTo({ top: 0, behavior: 'instant' });

    return () => {
      document.title = originalTitle;
      if (createdMeta && metaRobots) {
        metaRobots.remove();
      } else if (metaRobots) {
        metaRobots.setAttribute('content', originalRobots);
      }
    };
  }, [statusCode]);

  const is410 = statusCode === 410;

  return (
    <div id="not-found-page-root" className="min-h-[75vh] flex items-center justify-center pt-28 pb-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl w-full p-8 sm:p-12 rounded-3xl bg-[#0A1A2F] border border-white/10 shadow-2xl text-center space-y-6 text-white relative overflow-hidden">
        {/* Subtle Ambient Background Glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#1877F2]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#FF6B00]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          {/* Status Tag */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono font-bold uppercase tracking-wider text-[#FF6B00]">
            {is410 ? (
              <>
                <AlertCircle className="w-3.5 h-3.5" />
                <span>HTTP 410 — Content Retired</span>
              </>
            ) : (
              <>
                <Compass className="w-3.5 h-3.5" />
                <span>HTTP 404 — Page Not Found</span>
              </>
            )}
          </div>

          {/* Heading */}
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight text-white">
              {is410
                ? reason === 'pricing-retired'
                  ? 'Pricing Packages Discontinued'
                  : 'Content Permanently Retired'
                : 'Page Not Found'}
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-light">
              {is410 ? (
                reason === 'pricing-retired' ? (
                  <>
                    DigitalMUID has transitioned from static, off-the-shelf pricing packages to custom scoped client engagements and strategic advisory.
                  </>
                ) : (
                  <>
                    This legacy URL from our previous website has been permanently discontinued during our platform modernization.
                  </>
                )
              ) : (
                <>
                  The page you are looking for doesn't exist, has been moved to a new canonical address, or the link was misdirected.
                </>
              )}
            </p>
          </div>

          {/* Quick Helpful Navigation Actions */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-xs text-slate-300 space-y-2 text-left">
            <div className="font-semibold text-white">Looking for something specific?</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => navigate('/services')}
                className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white flex items-center gap-2 text-left transition-colors cursor-pointer"
              >
                <Layers className="w-4 h-4 text-[#FF6B00] shrink-0" />
                <span>Our Services</span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/learn')}
                className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white flex items-center gap-2 text-left transition-colors cursor-pointer"
              >
                <GraduationCap className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Learning Platform</span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/business-growth-consultation')}
                className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white flex items-center gap-2 text-left transition-colors cursor-pointer"
              >
                <ArrowRight className="w-4 h-4 text-[#1877F2] shrink-0" />
                <span>Growth Consultation</span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/contact')}
                className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white flex items-center gap-2 text-left transition-colors cursor-pointer"
              >
                <MessageSquare className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Contact DigitalMUID</span>
              </button>
            </div>
          </div>

          {/* Primary Return Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-6 py-3 rounded-xl bg-[#FF6B00] hover:bg-[#e66000] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 mx-auto shadow-lg shadow-[#FF6B00]/25 transition-all cursor-pointer"
            >
              <Home className="w-4 h-4" />
              <span>Return to Homepage</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
