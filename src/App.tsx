import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { ToastNotification } from './components/ToastNotification';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SEOHead } from './components/SEOHead';

// Eager Core Pages
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { Booking } from './types';

// Lazy-loaded Route Pages (Code-splitting for fast initial parse & smooth navigation)
const AboutPage = lazy(() => import('./pages/AboutPage').then((m) => ({ default: m.AboutPage })));
const InsightsPage = lazy(() => import('./pages/InsightsPage').then((m) => ({ default: m.InsightsPage })));
const ArticleDetailPage = lazy(() => import('./pages/ArticleDetailPage').then((m) => ({ default: m.ArticleDetailPage })));
const WatchPage = lazy(() => import('./pages/WatchPage').then((m) => ({ default: m.WatchPage })));
const VideoDetailPage = lazy(() => import('./pages/VideoDetailPage').then((m) => ({ default: m.VideoDetailPage })));
const LearnPage = lazy(() => import('./pages/LearnPage').then((m) => ({ default: m.LearnPage })));
const AcademyPage = lazy(() => import('./pages/AcademyPage').then((m) => ({ default: m.AcademyPage })));
const CourseDetailPage = lazy(() => import('./pages/CourseDetailPage').then((m) => ({ default: m.CourseDetailPage })));
const FrameworksPage = lazy(() => import('./pages/FrameworksPage').then((m) => ({ default: m.FrameworksPage })));
const FrameworkDetailPage = lazy(() => import('./pages/FrameworkDetailPage').then((m) => ({ default: m.FrameworkDetailPage })));
const ResourcesPage = lazy(() => import('./pages/ResourcesPage').then((m) => ({ default: m.ResourcesPage })));
const FreeResourceThankYouPage = lazy(() => import('./pages/FreeResourceThankYouPage').then((m) => ({ default: m.FreeResourceThankYouPage })));
const PaidResourceThankYouPage = lazy(() => import('./pages/PaidResourceThankYouPage').then((m) => ({ default: m.PaidResourceThankYouPage })));
const BundleAccessPage = lazy(() => import('./pages/BundleAccessPage').then((m) => ({ default: m.BundleAccessPage })));
const MetaAdsCampaignBundlePage = lazy(() => import('./pages/MetaAdsCampaignBundlePage').then((m) => ({ default: m.MetaAdsCampaignBundlePage })));
const SpeakingPage = lazy(() => import('./pages/SpeakingPage').then((m) => ({ default: m.SpeakingPage })));
const ServicesPage = lazy(() => import('./pages/ServicesPage').then((m) => ({ default: m.ServicesPage })));
const GrowthSystemsPage = lazy(() => import('./pages/GrowthSystemsPage').then((m) => ({ default: m.GrowthSystemsPage })));
const AgencyServicesPage = lazy(() => import('./pages/AgencyServicesPage').then((m) => ({ default: m.AgencyServicesPage })));
const GrowthAuditPage = lazy(() => import('./pages/GrowthAuditPage').then((m) => ({ default: m.GrowthAuditPage })));
const WebPage = lazy(() => import('./pages/WebPage').then((m) => ({ default: m.WebPage })));
const ConsultationPage = lazy(() => import('./pages/ConsultationPage').then((m) => ({ default: m.ConsultationPage })));
const ConsultationConfirmationPage = lazy(() => import('./pages/ConsultationConfirmationPage').then((m) => ({ default: m.ConsultationConfirmationPage })));
const ContactPage = lazy(() => import('./pages/ContactPage').then((m) => ({ default: m.ContactPage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })));
const TermsPage = lazy(() => import('./pages/TermsPage').then((m) => ({ default: m.TermsPage })));
const AuthPage = lazy(() => import('./pages/AuthPage').then((m) => ({ default: m.AuthPage })));
const StudentDashboardPage = lazy(() => import('./pages/StudentDashboardPage').then((m) => ({ default: m.StudentDashboardPage })));
const MyCoursesPage = lazy(() => import('./pages/MyCoursesPage').then((m) => ({ default: m.MyCoursesPage })));
const MyConsultationsPage = lazy(() => import('./pages/MyConsultationsPage').then((m) => ({ default: m.MyConsultationsPage })));
const CoursePlayerPage = lazy(() => import('./pages/CoursePlayerPage').then((m) => ({ default: m.CoursePlayerPage })));
const AccountPage = lazy(() => import('./pages/AccountPage').then((m) => ({ default: m.AccountPage })));
const SavedContentPage = lazy(() => import('./pages/SavedContentPage').then((m) => ({ default: m.SavedContentPage })));
const CourseWishlistPage = lazy(() => import('./pages/CourseWishlistPage').then((m) => ({ default: m.CourseWishlistPage })));
const CertificateVerifyPage = lazy(() => import('./pages/CertificateVerifyPage').then((m) => ({ default: m.CertificateVerifyPage })));

const RouteFallback: React.FC = () => (
  <div className="min-h-[65vh] pt-28 pb-16 flex items-center justify-center px-4">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-2 border-[#2457D6] border-t-transparent rounded-full animate-spin" />
      <p className="text-xs font-interface font-semibold text-[#596579] tracking-wide">
        Loading view...
      </p>
    </div>
  </div>
);

const MainApp: React.FC = () => {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return window.location.pathname || '/';
  });

  const { isSearchOpen, setIsSearchOpen } = useApp();
  const [selectedResourceIdForModal, setSelectedResourceIdForModal] = useState<string | null>(null);
  const [lastConfirmedBooking, setLastConfirmedBooking] = useState<Booking | null>(null);

  // Router handler
  const navigate = useCallback((path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Simple Router Matching
  const renderCurrentPage = () => {
    const normalizedPath = currentPath.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
    const path = normalizedPath;

    if (path === '/' || path === '') {
      return (
        <HomePage
          navigate={navigate}
          onOpenResourceModal={(id) => {
            setSelectedResourceIdForModal(id);
            navigate('/resources');
          }}
        />
      );
    }
    if (path === '/about') {
      return <AboutPage navigate={navigate} />;
    }
    if (path === '/insights' || path === '/articles' || path === '/blog') {
      return <InsightsPage navigate={navigate} />;
    }
    if (path.startsWith('/insights/')) {
      const slug = path.replace('/insights/', '');
      return <ArticleDetailPage slug={slug} navigate={navigate} />;
    }
    if (path.startsWith('/articles/')) {
      const slug = path.replace('/articles/', '');
      return <ArticleDetailPage slug={slug} navigate={navigate} />;
    }
    if (path.startsWith('/blog/')) {
      const slug = path.replace('/blog/', '');
      return <ArticleDetailPage slug={slug} navigate={navigate} />;
    }
    if (path === '/watch' || path === '/videos') {
      return <WatchPage navigate={navigate} />;
    }
    if (path.startsWith('/watch/')) {
      const slug = path.replace('/watch/', '');
      return <VideoDetailPage slug={slug} navigate={navigate} />;
    }
    if (path.startsWith('/videos/')) {
      const slug = path.replace('/videos/', '');
      return <VideoDetailPage slug={slug} navigate={navigate} />;
    }
    if (path === '/academy' || path === '/apply') {
      return <AcademyPage navigate={navigate} />;
    }
    if (path === '/courses') {
      window.history.replaceState({}, '', '/learn');
      return <LearnPage navigate={navigate} />;
    }
    if (path === '/learn') {
      return <LearnPage navigate={navigate} />;
    }
    if (path.startsWith('/learn/') && path.endsWith('/player')) {
      const slug = path.replace('/learn/', '').replace('/player', '');
      return <CoursePlayerPage slug={slug} navigate={navigate} />;
    }
    if (path.startsWith('/courses/') && path.endsWith('/player')) {
      const slug = path.replace('/courses/', '').replace('/player', '');
      return <CoursePlayerPage slug={slug} navigate={navigate} />;
    }
    if (path.startsWith('/learn/')) {
      const slug = path.replace('/learn/', '');
      return <CourseDetailPage slug={slug} navigate={navigate} />;
    }
    if (path.startsWith('/courses/')) {
      const slug = path.replace('/courses/', '');
      return <CourseDetailPage slug={slug} navigate={navigate} />;
    }
    if (path === '/frameworks') {
      return <FrameworksPage navigate={navigate} />;
    }
    if (path === '/frameworks/growth-strategies') {
      return <FrameworksPage navigate={navigate} initialCategory="Digital Growth" />;
    }
    if (path === '/frameworks/ai-automation') {
      return <FrameworksPage navigate={navigate} initialCategory="AI & Automation" />;
    }
    if (path === '/frameworks/modern-marketing') {
      return <FrameworksPage navigate={navigate} initialCategory="Modern Marketing" />;
    }
    if (path === '/frameworks/personal-branding') {
      return <FrameworksPage navigate={navigate} initialCategory="Personal Branding" />;
    }
    if (path === '/frameworks/digital-transformation') {
      return <FrameworksPage navigate={navigate} initialCategory="Business Transformation" />;
    }
    if (path === '/frameworks/education') {
      return <FrameworksPage navigate={navigate} initialCategory="all" />;
    }
    if (path.startsWith('/frameworks/')) {
      const slug = path.replace('/frameworks/', '');
      return <FrameworkDetailPage slug={slug} navigate={navigate} />;
    }
    if (path === '/resources/thank-you/free') {
      return <FreeResourceThankYouPage navigate={navigate} />;
    }
    if (path === '/resources/thank-you/paid') {
      return <PaidResourceThankYouPage navigate={navigate} />;
    }
    if (
      path === '/meta_ad_campaign_bundle' ||
      path === '/meta-ad-campaign-bundle' ||
      path === '/meta-ads-campaign-planner-bundle'
    ) {
      return <MetaAdsCampaignBundlePage navigate={navigate} />;
    }
    if (path.startsWith('/resources/bundle/') || path === '/resources/bundle-access' || path === '/resources/bundle') {
      const slug = path.startsWith('/resources/bundle/') ? path.replace('/resources/bundle/', '') : 'meta-ads-campaign-planner-bundle';
      return <BundleAccessPage slug={slug} navigate={navigate} />;
    }
    if (path === '/resources' || path.startsWith('/resources/') || path.startsWith('/downloads/')) {
      const searchStr = currentPath.includes('?')
        ? currentPath.slice(currentPath.indexOf('?'))
        : (typeof window !== 'undefined' ? window.location.search : '');
      const sp = new URLSearchParams(searchStr);
      const queryId = sp.get('resourceId') || sp.get('download') || sp.get('id') || sp.get('slug');
      const slug = path.startsWith('/resources/') ? path.replace('/resources/', '') : (queryId || selectedResourceIdForModal);
      return (
        <ResourcesPage
          navigate={navigate}
          selectedResourceId={slug}
          onCloseModal={() => {
            setSelectedResourceIdForModal(null);
            if (path !== '/resources' || searchStr) {
              navigate('/resources');
            }
          }}
        />
      );
    }
    if (path === '/speaking') {
      return <SpeakingPage navigate={navigate} />;
    }
    if (path === '/services/growth-systems' || path === '/growth-systems') {
      return <GrowthSystemsPage navigate={navigate} />;
    }
    if (path === '/agency-services') {
      return <AgencyServicesPage navigate={navigate} />;
    }
    if (path === '/services') {
      return <GrowthSystemsPage navigate={navigate} />;
    }
    if (path.startsWith('/services/')) {
      const serviceSlug = path.replace('/services/', '');
      return <ServicesPage navigate={navigate} activeServiceSlug={serviceSlug} />;
    }
    if (path === '/web-services' || path === '/web-development' || path === '/web-design') {
      window.history.replaceState({}, '', '/web');
      return <WebPage navigate={navigate} />;
    }
    if (path === '/web') {
      return <WebPage navigate={navigate} />;
    }
    if (path === '/blog') {
      return <InsightsPage navigate={navigate} />;
    }
    if (path.startsWith('/blog/')) {
      const slug = path.replace('/blog/', '');
      return <ArticleDetailPage slug={slug} navigate={navigate} />;
    }
    if (path === '/growth-audit' || path === '/request-growth-audit') {
      return <GrowthAuditPage navigate={navigate} />;
    }
    if (path === '/book-consultation' || path === '/business-growth-consultation' || path === '/consultation') {
      return (
        <ConsultationPage
          navigate={navigate}
          onBookingConfirmed={(bk) => setLastConfirmedBooking(bk)}
        />
      );
    }
    if (path === '/consultation/confirmation') {
      return (
        <ConsultationConfirmationPage
          booking={lastConfirmedBooking}
          navigate={navigate}
        />
      );
    }
    if (path === '/contact') {
      return <ContactPage navigate={navigate} />;
    }
    if (path === '/terms' || path === '/terms-of-service' || path === '/terms-and-conditions') {
      return <TermsPage navigate={navigate} />;
    }
    if (path === '/login' || path === '/signin' || path === '/reset-password' || path === '/reset') {
      return <AuthPage initialMode={path === '/reset-password' || path === '/reset' ? 'reset' : 'login'} navigate={navigate} />;
    }
    if (path === '/register' || path === '/signup') {
      return <AuthPage initialMode="register" navigate={navigate} />;
    }
    if (path === '/account' || path === '/profile' || path === '/billing' || path === '/invoices') {
      return <AccountPage navigate={navigate} initialTab={path === '/billing' || path === '/invoices' ? 'billing' : undefined} />;
    }
    if (path === '/dashboard') {
      return <StudentDashboardPage navigate={navigate} />;
    }
    if (path === '/my-courses') {
      return <MyCoursesPage navigate={navigate} />;
    }
    if (path === '/my-consultations') {
      return <MyConsultationsPage navigate={navigate} />;
    }
    if (path === '/saved' || path === '/saved-content' || path === '/bookmarks') {
      return <SavedContentPage navigate={navigate} />;
    }
    if (path === '/wishlist') {
      return <CourseWishlistPage navigate={navigate} />;
    }
    if (path.startsWith('/verify-certificate/') || path.startsWith('/verify/') || path.startsWith('/certificates/')) {
      let code = '';
      if (path.startsWith('/verify-certificate/')) code = path.replace('/verify-certificate/', '');
      else if (path.startsWith('/verify/')) code = path.replace('/verify/', '');
      else if (path.startsWith('/certificates/')) code = path.replace('/certificates/', '');
      return <CertificateVerifyPage code={decodeURIComponent(code)} navigate={navigate} />;
    }
    if (path === '/verify' || path === '/verify-certificate') {
      return <CertificateVerifyPage navigate={navigate} />;
    }
    if (path === '/admin' || path.startsWith('/admin/')) {
      return <AdminPage navigate={navigate} />;
    }

    // Legacy WordPress URLs Handling (Client-side routing fallback)
    if (path === '/services-3' || path === '/services-3/') {
      return <ServicesPage navigate={navigate} />;
    }
    if (path === '/services-3/social-media-marketing' || path === '/services-3/social-media-marketing/') {
      return <ServicesPage navigate={navigate} activeServiceSlug="modern-marketing" />;
    }
    if (path === '/smm-packages-in-lucknow' || path === '/smm-packages-in-lucknow/') {
      return <ServicesPage navigate={navigate} activeServiceSlug="modern-marketing" />;
    }
    if (path.includes('complete-meta-ads-mastery-course')) {
      return <CourseDetailPage slug="meta-ads-mastery" navigate={navigate} />;
    }
    if (path === '/price' || path === '/price/') {
      return <NotFoundPage navigate={navigate} statusCode={410} reason="pricing-retired" />;
    }
    if (path === '/terms-conditions' || path === '/terms-conditions/') {
      return <TermsPage navigate={navigate} />;
    }

    // Root Homepage
    if (path === '/' || path === '') {
      return (
        <HomePage
          navigate={navigate}
          onOpenResourceModal={(id) => {
            setSelectedResourceIdForModal(id);
            navigate('/resources');
          }}
        />
      );
    }

    // Unknown URL: 404 Not Found Page (Prevents soft-404 homepage fallback)
    return <NotFoundPage navigate={navigate} statusCode={404} />;
  };

  const normalizedCurrentPath = currentPath.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
  const isAdminView = normalizedCurrentPath === '/admin' || normalizedCurrentPath.startsWith('/admin/');
  const isPlayerView = (normalizedCurrentPath.startsWith('/learn/') || normalizedCurrentPath.startsWith('/courses/')) && normalizedCurrentPath.endsWith('/player');
  const isSalesPage =
    normalizedCurrentPath === '/meta_ad_campaign_bundle' ||
    normalizedCurrentPath === '/meta-ad-campaign-bundle' ||
    normalizedCurrentPath === '/meta-ads-campaign-planner-bundle';

  return (
    <div className={`min-h-screen ${isSalesPage ? 'bg-[#070B14]' : 'bg-[#F7F9FC]'} text-[#172033] selection:bg-[#2457D6] selection:text-white relative flex flex-col justify-between`}>
      <SEOHead path={normalizedCurrentPath} />
      {!isAdminView && !isPlayerView && !isSalesPage && (
        <Navbar
          currentPath={currentPath}
          navigate={navigate}
          onOpenSearch={() => setIsSearchOpen(true)}
        />
      )}

      <main className="flex-1">
        <ErrorBoundary resetKey={normalizedCurrentPath}>
          <Suspense fallback={<RouteFallback />}>
            {renderCurrentPage()}
          </Suspense>
        </ErrorBoundary>
      </main>

      {!isAdminView && !isPlayerView && !isSalesPage && <Footer navigate={navigate} />}

      {/* Modals & Overlays */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        navigate={navigate}
      />
      <ToastNotification />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
