import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { ToastNotification } from './components/ToastNotification';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SEOHead } from './components/SEOHead';

// Pages
import { HomePage } from './pages/HomePage';
import { AboutPage } from './pages/AboutPage';
import { InsightsPage } from './pages/InsightsPage';
import { ArticleDetailPage } from './pages/ArticleDetailPage';
import { WatchPage } from './pages/WatchPage';
import { VideoDetailPage } from './pages/VideoDetailPage';
import { LearnPage } from './pages/LearnPage';
import { CourseDetailPage } from './pages/CourseDetailPage';
import { FrameworksPage } from './pages/FrameworksPage';
import { FrameworkDetailPage } from './pages/FrameworkDetailPage';
import { ResourcesPage } from './pages/ResourcesPage';
import { SpeakingPage } from './pages/SpeakingPage';
import { ServicesPage } from './pages/ServicesPage';
import { GrowthSystemsPage } from './pages/GrowthSystemsPage';
import { WebPage } from './pages/WebPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ConsultationPage } from './pages/ConsultationPage';
import { ConsultationConfirmationPage } from './pages/ConsultationConfirmationPage';
import { ContactPage } from './pages/ContactPage';
import { AdminPage } from './pages/AdminPage';
import { TermsPage } from './pages/TermsPage';
import { AuthPage } from './pages/AuthPage';
import { StudentDashboardPage } from './pages/StudentDashboardPage';
import { MyCoursesPage } from './pages/MyCoursesPage';
import { MyConsultationsPage } from './pages/MyConsultationsPage';
import { CoursePlayerPage } from './pages/CoursePlayerPage';
import { AccountPage } from './pages/AccountPage';
import { SavedContentPage } from './pages/SavedContentPage';
import { CourseWishlistPage } from './pages/CourseWishlistPage';
import { CertificateVerifyPage } from './pages/CertificateVerifyPage';
import { Booking } from './types';

const MainApp: React.FC = () => {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return window.location.pathname || '/';
  });

  const { isSearchOpen, setIsSearchOpen } = useApp();
  const [selectedResourceIdForModal, setSelectedResourceIdForModal] = useState<string | null>(null);
  const [lastConfirmedBooking, setLastConfirmedBooking] = useState<Booking | null>(null);

  // Router handler
  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
    if (path.startsWith('/frameworks/')) {
      const slug = path.replace('/frameworks/', '');
      return <FrameworkDetailPage slug={slug} navigate={navigate} />;
    }
    if (path === '/resources' || path.startsWith('/resources/') || path.startsWith('/downloads/')) {
      const slug = path.startsWith('/resources/') ? path.replace('/resources/', '') : selectedResourceIdForModal;
      return (
        <ResourcesPage
          navigate={navigate}
          selectedResourceId={slug}
          onCloseModal={() => setSelectedResourceIdForModal(null)}
        />
      );
    }
    if (path === '/speaking') {
      return <SpeakingPage navigate={navigate} />;
    }
    if (path === '/services/growth-systems' || path === '/growth-systems') {
      return <GrowthSystemsPage navigate={navigate} />;
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
    if (path === '/consultation' || path === '/growth-audit' || path === '/request-growth-audit') {
      window.history.replaceState({}, '', '/business-growth-consultation');
      return (
        <ConsultationPage
          navigate={navigate}
          onBookingConfirmed={(bk) => setLastConfirmedBooking(bk)}
        />
      );
    }
    if (path === '/business-growth-consultation') {
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
    if (path === '/login' || path === '/signin') {
      return <AuthPage initialMode="login" navigate={navigate} />;
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

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] selection:bg-[#FF6B00] selection:text-white relative flex flex-col justify-between">
      <SEOHead path={normalizedCurrentPath} />
      {!isAdminView && !isPlayerView && (
        <Navbar
          currentPath={currentPath}
          navigate={navigate}
          onOpenSearch={() => setIsSearchOpen(true)}
        />
      )}

      <main className="flex-1">
        <ErrorBoundary>
          {renderCurrentPage()}
        </ErrorBoundary>
      </main>

      {!isAdminView && !isPlayerView && <Footer navigate={navigate} />}

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
