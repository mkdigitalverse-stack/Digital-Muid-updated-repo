import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  Menu,
  X,
  Search,
  ArrowRight,
  ShieldCheck,
  Calendar,
  User,
  ChevronDown,
  Bell,
  CheckCheck,
  Info,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Sparkles,
  Layers,
  TrendingUp,
  Bot,
  Megaphone,
  Award,
  Cpu,
  GraduationCap,
  BookOpen,
  Video,
  FileText,
  Download,
  Mic,
  Lightbulb,
  LayoutDashboard,
  LogOut,
  Bookmark,
  Heart,
  CreditCard,
  Linkedin,
  Instagram,
  Facebook,
  Youtube,
  Globe
} from 'lucide-react';

interface NavbarProps {
  currentPath: string;
  navigate: (path: string) => void;
  onOpenSearch?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPath, navigate, onOpenSearch }) => {
  const {
    setIsSearchOpen,
    isAdminAuthenticated,
    currentUser,
    userProfile,
    settings,
    studentLogout,
    studentNotifications,
    isNotificationsLoading,
    unreadNotificationsCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    studentBookmarks,
    courseWishlist
  } = useApp();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Dropdown states for Desktop
  const [activeDropdown, setActiveDropdown] = useState<'about' | 'services' | 'user' | 'notifications' | null>(null);
  const dropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Accordion state for Mobile Menu
  const [mobileExpandedSection, setMobileExpandedSection] = useState<'about' | 'services' | 'student' | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [isMobileMenuOpen]);

  // Close mobile menu and dropdowns on route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setActiveDropdown(null);
    document.body.style.overflow = '';
    document.body.style.touchAction = '';
  }, [currentPath]);

  // Handle window resize (auto-close mobile menu on desktop breakpoint)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileMenuOpen(false);
        document.body.style.overflow = '';
        document.body.style.touchAction = '';
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close desktop dropdown on outside click or escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#main-navbar')) {
        setActiveDropdown(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveDropdown(null);
        setIsMobileMenuOpen(false);
        document.body.style.overflow = '';
        document.body.style.touchAction = '';
      }
    };
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleNav = (path: string) => {
    setActiveDropdown(null);
    setIsMobileMenuOpen(false);
    document.body.style.overflow = '';
    document.body.style.touchAction = '';
    navigate(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleMouseEnter = (menu: 'about' | 'services' | 'user' | 'notifications') => {
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current);
    }
    setActiveDropdown(menu);
  };

  const handleMouseLeave = () => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setActiveDropdown(null);
    }, 150);
  };

  const toggleDropdown = (menu: 'about' | 'services' | 'user' | 'notifications') => {
    setActiveDropdown((prev) => (prev === menu ? null : menu));
  };

  const toggleMobileAccordion = (menu: 'about' | 'services' | 'student') => {
    setMobileExpandedSection((prev) => (prev === menu ? null : menu));
  };

  const aboutSubmenu = [
    { label: 'Insights', path: '/insights', icon: Lightbulb, desc: 'Essays on AI, strategy & economics' },
    { label: 'Watch', path: '/watch', icon: Video, desc: 'Keynotes, breakdowns & talks' },
    { label: 'Frameworks', path: '/frameworks', icon: Layers, desc: 'Proprietary models & mental architecture' },
    { label: 'Resources', path: '/resources', icon: FileText, desc: 'Guides, toolkits & operational SOPs' },
    { label: 'Speaking', path: '/speaking', icon: Mic, desc: 'Keynotes, panels & fireside sessions' }
  ];

  const servicesSubmenu = [
    { label: 'Growth Strategy', path: '/services/growth-strategy', icon: TrendingUp, desc: 'Acquisition loops & CAC/LTV scaling' },
    { label: 'AI & Automation', path: '/services/ai-automation', icon: Bot, desc: 'Operational LLM & agent workflows' },
    { label: 'Modern Marketing', path: '/services/modern-marketing', icon: Megaphone, desc: 'High-signal distribution & funnels' },
    { label: 'Personal Branding', path: '/services/personal-branding', icon: Award, desc: 'Founder authority & IP codification' },
    { label: 'Digital Transformation', path: '/services/digital-transformation', icon: Cpu, desc: 'Modernizing legacy digital stacks' },
    { label: 'Education', path: '/services/education', icon: GraduationCap, desc: 'Workshops, masterclasses & cohorts' },
    { label: 'Web', path: '/web', icon: Globe, desc: 'Website design & custom web development' }
  ];

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

  const isAboutActive = ['/about', '/insights', '/watch', '/frameworks', '/resources', '/speaking'].some(
    (p) => currentPath === p || currentPath.startsWith(p + '/')
  );

  const isServicesActive = currentPath === '/services' || currentPath.startsWith('/services/');
  const isLearnActive = currentPath === '/learn' || currentPath.startsWith('/learn/');
  const isBlogActive = currentPath === '/blog' || currentPath.startsWith('/blog/');
  const isContactActive = currentPath === '/contact';

  return (
    <header
      id="main-navbar"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-[#07111F]/95 backdrop-blur-md border-b border-white/10 shadow-xl shadow-black/40 py-3 sm:py-3.5'
          : 'bg-[#07111F]/90 backdrop-blur-md border-b border-white/5 py-3.5 sm:py-4.5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <button
            id="brand-logo-btn"
            type="button"
            onClick={() => handleNav('/')}
            className="flex items-center gap-2.5 group text-left focus:outline-none cursor-pointer"
            aria-label="Digital Muid Home"
          >
            <div className="w-8 h-8 rounded bg-[#1877F2] flex items-center justify-center text-white font-display font-bold text-sm shadow-md shadow-[#1877F2]/20 group-hover:scale-105 transition-transform">
              M
            </div>
            <div>
              <div className="font-display font-bold text-base sm:text-lg tracking-tight text-white flex items-center gap-2">
                <span>DIGITAL MUID</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B00]"></span>
              </div>
              <p className="text-[9px] text-white/50 font-interface tracking-[0.2em] uppercase hidden sm:block">
                Growth · AI · Transformation
              </p>
            </div>
          </button>

          {isAdminAuthenticated && (
            <button
              type="button"
              onClick={() => handleNav('/admin')}
              className="hidden xl:flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#1877F2]/15 border border-[#1877F2]/30 text-[#60A5FA] text-[10px] uppercase font-bold tracking-wider hover:bg-[#1877F2]/25 transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-3 h-3" />
              <span>Admin</span>
            </button>
          )}
        </div>

        {/* Desktop Navigation Links (>= 1024px) */}
        <nav className="hidden lg:flex items-center gap-6 xl:gap-8 font-interface" aria-label="Main Navigation">
          {/* 1. ABOUT ▾ Dropdown */}
          <div
            className="relative"
            onMouseEnter={() => handleMouseEnter('about')}
            onMouseLeave={handleMouseLeave}
          >
            <button
              id="nav-dropdown-about-btn"
              type="button"
              onClick={() => toggleDropdown('about')}
              aria-expanded={activeDropdown === 'about'}
              className={`text-[11px] font-semibold uppercase tracking-[0.18em] transition-all flex items-center gap-1.5 py-1.5 cursor-pointer ${
                isAboutActive || activeDropdown === 'about'
                  ? 'text-white border-b-2 border-[#FF6B00] font-bold'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              <span>ABOUT</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  activeDropdown === 'about' ? 'rotate-180 text-[#FF6B00]' : 'text-white/50'
                }`}
              />
            </button>

            {/* Desktop ABOUT Dropdown Menu */}
            {activeDropdown === 'about' && (
              <div
                id="nav-about-dropdown-menu"
                className="absolute top-full left-0 mt-2 w-80 rounded-2xl bg-[#07111F]/98 backdrop-blur-2xl border border-slate-700/80 shadow-2xl p-4 space-y-3 z-50 animate-in fade-in zoom-in-95 duration-150 before:absolute before:-top-3 before:left-0 before:right-0 before:h-3 before:content-['']"
              >
                {/* Descriptor Header */}
                <div className="pb-2.5 border-b border-slate-800 px-2 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-white">
                      Explore Digital Muid
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Ideas, frameworks, resources & conversations.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      handleNav('/about');
                    }}
                    className="text-[10px] font-bold text-[#FF6B00] hover:underline cursor-pointer"
                  >
                    Overview →
                  </button>
                </div>

                <div className="space-y-1">
                  {aboutSubmenu.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentPath === item.path || currentPath.startsWith(item.path + '/');
                    return (
                      <button
                        key={item.path}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          handleNav(item.path);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl transition-all flex items-center gap-3 cursor-pointer group ${
                          isActive
                            ? 'bg-[#1877F2]/20 border border-[#1877F2]/40 text-white'
                            : 'hover:bg-slate-800/60 text-slate-300 hover:text-white'
                        }`}
                      >
                        <div className="w-7 h-7 rounded-lg bg-slate-800/80 text-slate-300 group-hover:text-white group-hover:bg-[#1877F2]/30 flex items-center justify-center shrink-0 border border-slate-700/50">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-white tracking-wide">{item.label}</div>
                          <div className="text-[10px] text-slate-400 truncate">{item.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 2. SERVICES ▾ Dropdown */}
          <div
            className="relative"
            onMouseEnter={() => handleMouseEnter('services')}
            onMouseLeave={handleMouseLeave}
          >
            <button
              id="nav-dropdown-services-btn"
              type="button"
              onClick={() => toggleDropdown('services')}
              aria-expanded={activeDropdown === 'services'}
              className={`text-[11px] font-semibold uppercase tracking-[0.18em] transition-all flex items-center gap-1.5 py-1.5 cursor-pointer ${
                isServicesActive || activeDropdown === 'services'
                  ? 'text-white border-b-2 border-[#FF6B00] font-bold'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              <span>SERVICES</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  activeDropdown === 'services' ? 'rotate-180 text-[#FF6B00]' : 'text-white/50'
                }`}
              />
            </button>

            {/* Desktop SERVICES Dropdown Menu */}
            {activeDropdown === 'services' && (
              <div
                id="nav-services-dropdown-menu"
                className="absolute top-full left-0 mt-2 w-84 rounded-2xl bg-[#07111F]/98 backdrop-blur-2xl border border-slate-700/80 shadow-2xl p-4 space-y-3 z-50 animate-in fade-in zoom-in-95 duration-150 before:absolute before:-top-3 before:left-0 before:right-0 before:h-3 before:content-['']"
              >
                {/* Descriptor Header */}
                <div className="pb-2.5 border-b border-slate-800 px-2 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-white">
                      How I Help
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Strategies and systems for modern growth.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleNav('/services')}
                    className="text-[10px] font-bold text-[#1877F2] hover:underline cursor-pointer"
                  >
                    Our Growth System →
                  </button>
                </div>

                <div className="space-y-1">
                  {servicesSubmenu.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentPath === item.path;
                    return (
                      <button
                        key={item.path}
                        type="button"
                        onClick={() => handleNav(item.path)}
                        className={`w-full text-left px-3 py-2 rounded-xl transition-all flex items-center gap-3 cursor-pointer group ${
                          isActive
                            ? 'bg-[#FF6B00]/20 border border-[#FF6B00]/40 text-white'
                            : 'hover:bg-slate-800/60 text-slate-300 hover:text-white'
                        }`}
                      >
                        <div className="w-7 h-7 rounded-lg bg-slate-800/80 text-slate-300 group-hover:text-white group-hover:bg-[#FF6B00]/30 flex items-center justify-center shrink-0 border border-slate-700/50">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-white tracking-wide">{item.label}</div>
                          <div className="text-[10px] text-slate-400 truncate">{item.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 3. LEARN */}
          <button
            id="nav-link-learn"
            type="button"
            onClick={() => handleNav('/learn')}
            className={`text-[11px] font-semibold uppercase tracking-[0.18em] transition-all cursor-pointer py-1.5 ${
              isLearnActive
                ? 'text-white border-b-2 border-[#FF6B00] font-bold'
                : 'text-white/70 hover:text-white'
            }`}
          >
            LEARN
          </button>

          {/* 4. BLOG */}
          <button
            id="nav-link-blog"
            type="button"
            onClick={() => handleNav('/blog')}
            className={`text-[11px] font-semibold uppercase tracking-[0.18em] transition-all cursor-pointer py-1.5 ${
              isBlogActive
                ? 'text-white border-b-2 border-[#FF6B00] font-bold'
                : 'text-white/70 hover:text-white'
            }`}
          >
            BLOG
          </button>

          {/* 5. CONTACT */}
          <button
            id="nav-link-contact"
            type="button"
            onClick={() => handleNav('/contact')}
            className={`text-[11px] font-semibold uppercase tracking-[0.18em] transition-all cursor-pointer py-1.5 ${
              isContactActive
                ? 'text-white border-b-2 border-[#FF6B00] font-bold'
                : 'text-white/70 hover:text-white'
            }`}
          >
            CONTACT
          </button>
        </nav>

        {/* Right Action Area */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Global Search Button */}
          <button
            id="nav-search-btn"
            type="button"
            onClick={() => (onOpenSearch ? onOpenSearch() : setIsSearchOpen(true))}
            className="p-2 sm:p-2.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors flex items-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#FF6B00] min-h-[44px] min-w-[44px] justify-center"
            title="Search knowledge base (Cmd+K)"
            aria-label="Search knowledge base"
          >
            <Search className="w-4 h-4" />
            <span className="hidden xl:inline text-[10px] text-white/50 font-interface bg-white/5 px-1.5 py-0.5 rounded border border-white/10 uppercase tracking-wider">
              ⌘K
            </span>
          </button>

          {/* Student Notifications Bell (Authenticated Students) */}
          {currentUser && !isAdminAuthenticated && (
            <div
              className="relative"
              onMouseEnter={() => handleMouseEnter('notifications')}
              onMouseLeave={handleMouseLeave}
            >
              <button
                id="nav-notifications-btn"
                type="button"
                onClick={() => toggleDropdown('notifications')}
                className="p-2 sm:p-2.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors flex items-center justify-center cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#FF6B00] min-h-[44px] min-w-[44px] relative"
                title="Student Notifications"
                aria-label={`Notifications, ${unreadNotificationsCount} unread`}
              >
                <Bell className="w-4 h-4" />
                {unreadNotificationsCount > 0 && (
                  <span
                    id="nav-notifications-badge"
                    className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 bg-[#FF6B00] text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg border border-[#07111F]"
                  >
                    {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown Flyout */}
              {activeDropdown === 'notifications' && (
                <div
                  id="nav-notifications-dropdown"
                  className="absolute right-0 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 top-full mt-2 w-[calc(100vw-2rem)] max-w-sm sm:w-96 rounded-2xl bg-[#0F172A] border border-slate-700/80 shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                >
                  {/* Dropdown Header */}
                  <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white tracking-wide">Notifications</span>
                      {unreadNotificationsCount > 0 ? (
                        <span className="px-1.5 py-0.5 bg-[#FF6B00]/20 text-[#FF6B00] text-[10px] font-bold rounded-full border border-[#FF6B00]/30">
                          {unreadNotificationsCount} unread
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 bg-slate-800 text-slate-400 text-[10px] font-medium rounded-full">
                          All caught up
                        </span>
                      )}
                    </div>
                    {unreadNotificationsCount > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          markAllNotificationsAsRead();
                        }}
                        className="text-[11px] font-semibold text-[#FF6B00] hover:text-[#FF8533] transition-colors flex items-center gap-1 cursor-pointer focus:outline-none"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Mark all read</span>
                      </button>
                    )}
                  </div>

                  {/* Notification Items List */}
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60">
                    {isNotificationsLoading && studentNotifications.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 text-xs">
                        <div className="w-4 h-4 border-2 border-[#FF6B00] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        Loading notifications...
                      </div>
                    ) : studentNotifications.length === 0 ? (
                      <div className="py-8 px-4 text-center space-y-2">
                        <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-slate-400">
                          <Bell className="w-5 h-5 text-slate-500" />
                        </div>
                        <p className="text-xs font-semibold text-slate-200">No notifications yet</p>
                        <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                          Course updates, system announcements, and consultation alerts will appear here.
                        </p>
                      </div>
                    ) : (
                      studentNotifications.slice(0, 15).map((item) => {
                        const isUnread = !item.isRead;
                        return (
                          <div
                            key={item.id}
                            onClick={() => {
                              if (isUnread) {
                                markNotificationAsRead(item.id);
                              }
                              const targetLink = item.link || item.linkUrl;
                              if (targetLink) {
                                setActiveDropdown(null);
                                handleNav(targetLink);
                              }
                            }}
                            className={`p-3 transition-colors cursor-pointer text-left flex gap-3 items-start ${
                              isUnread
                                ? 'bg-[#FF6B00]/5 hover:bg-[#FF6B00]/10 border-l-2 border-l-[#FF6B00]'
                                : 'hover:bg-white/5 border-l-2 border-l-transparent opacity-90'
                            }`}
                          >
                            <div className="mt-0.5 shrink-0">
                              {item.type === 'success' ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              ) : item.type === 'warning' ? (
                                <AlertTriangle className="w-4 h-4 text-amber-400" />
                              ) : item.type === 'alert' ? (
                                <AlertCircle className="w-4 h-4 text-rose-400" />
                              ) : (
                                <Info className="w-4 h-4 text-[#FF6B00]" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className={`text-xs truncate ${isUnread ? 'font-bold text-white' : 'font-medium text-slate-300'}`}>
                                  {item.title}
                                </p>
                                <span className="text-[10px] text-slate-400 shrink-0">
                                  {(() => {
                                    try {
                                      const date = new Date(item.createdAt);
                                      const now = new Date();
                                      const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000);
                                      if (diffMins < 1) return 'Just now';
                                      if (diffMins < 60) return `${diffMins}m ago`;
                                      const diffHours = Math.floor(diffMins / 60);
                                      if (diffHours < 24) return `${diffHours}h ago`;
                                      const diffDays = Math.floor(diffHours / 24);
                                      if (diffDays < 7) return `${diffDays}d ago`;
                                      return new Intl.DateTimeFormat('en-IN', { month: 'short', day: 'numeric' }).format(date);
                                    } catch {
                                      return '';
                                    }
                                  })()}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-300 mt-0.5 line-clamp-2 leading-relaxed">
                                {item.message}
                              </p>
                              {(item.link || item.linkUrl) && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#FF6B00] mt-1 hover:underline">
                                  <span>View link</span>
                                  <ArrowRight className="w-2.5 h-2.5" />
                                </span>
                              )}
                            </div>
                            {isUnread && (
                              <span className="w-2 h-2 rounded-full bg-[#FF6B00] shrink-0 mt-1.5" title="Unread" />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Dropdown Footer */}
                  <div className="p-2 border-t border-slate-800 bg-slate-900/40 text-center">
                    <button
                      type="button"
                      onClick={() => handleNav('/dashboard')}
                      className="text-[11px] font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer py-1"
                    >
                      View All in Student Dashboard →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Member / Student Account Button (Tablet & Desktop: >= 640px) */}
          {currentUser && !isAdminAuthenticated ? (
            <div
              className="relative hidden sm:block"
              onMouseEnter={() => handleMouseEnter('user')}
              onMouseLeave={handleMouseLeave}
            >
              <button
                id="nav-account-btn"
                type="button"
                onClick={() => toggleDropdown('user')}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl text-[11px] font-semibold uppercase tracking-wider transition-colors cursor-pointer border border-white/10 min-h-[44px]"
                title="Student Dashboard & Learning"
              >
                <User className="w-3.5 h-3.5 text-[#FF6B00]" />
                <span className="hidden md:inline">
                  {userProfile?.fullName?.split(' ')[0] || 'Student'}
                </span>
                <ChevronDown
                  className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${
                    activeDropdown === 'user' ? 'rotate-180 text-white' : ''
                  }`}
                />
              </button>

              {/* Student Desktop Dropdown Menu */}
              {activeDropdown === 'user' && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-[#0F172A] border border-slate-700/80 shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3 py-2 border-b border-slate-800">
                    <div className="text-xs font-bold text-white truncate">
                      {userProfile?.fullName || 'Student'}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {currentUser?.email || ''}
                    </div>
                  </div>

                  <div className="py-1 space-y-0.5">
                    <button
                      type="button"
                      onClick={() => handleNav('/dashboard')}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2.5 transition-colors cursor-pointer ${
                        currentPath === '/dashboard'
                          ? 'bg-[#FF6B00]/20 text-[#FF6B00]'
                          : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <LayoutDashboard className="w-4 h-4 text-[#FF6B00]" />
                      <span>Student Dashboard</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleNav('/my-courses')}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2.5 transition-colors cursor-pointer ${
                        currentPath === '/my-courses'
                          ? 'bg-[#FF6B00]/20 text-[#FF6B00]'
                          : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <BookOpen className="w-4 h-4 text-[#FF6B00]" />
                      <span>My Courses</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleNav('/my-consultations')}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2.5 transition-colors cursor-pointer ${
                        currentPath === '/my-consultations'
                          ? 'bg-[#FF6B00]/20 text-[#FF6B00]'
                          : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Calendar className="w-4 h-4 text-[#FF6B00]" />
                      <span>My Consultations</span>
                    </button>

                    <button
                      id="navbar-student-saved-btn"
                      type="button"
                      onClick={() => handleNav('/saved')}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                        currentPath === '/saved'
                          ? 'bg-[#FF6B00]/20 text-[#FF6B00]'
                          : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <Bookmark className="w-4 h-4 text-[#FF6B00]" />
                        <span>Saved Content</span>
                      </span>
                      {studentBookmarks && studentBookmarks.length > 0 && (
                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-[#FF6B00]/20 text-[#FF6B00]">
                          {studentBookmarks.length}
                        </span>
                      )}
                    </button>

                    <button
                      id="navbar-student-wishlist-btn"
                      type="button"
                      onClick={() => handleNav('/wishlist')}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                        currentPath === '/wishlist'
                          ? 'bg-[#FF6B00]/20 text-[#FF6B00]'
                          : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <Heart className="w-4 h-4 text-[#FF6B00]" />
                        <span>Course Wishlist</span>
                      </span>
                      {courseWishlist && courseWishlist.length > 0 && (
                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/20 text-rose-400">
                          {courseWishlist.length}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleNav('/resources')}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2.5 transition-colors cursor-pointer ${
                        currentPath === '/resources'
                          ? 'bg-[#FF6B00]/20 text-[#FF6B00]'
                          : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Download className="w-4 h-4 text-[#FF6B00]" />
                      <span>Toolkits & Resources</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleNav('/account?tab=billing')}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2.5 transition-colors cursor-pointer ${
                        currentPath === '/account' && window.location.search.includes('tab=billing')
                          ? 'bg-[#FF6B00]/20 text-[#FF6B00]'
                          : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <CreditCard className="w-4 h-4 text-[#FF6B00]" />
                      <span>Billing & Invoices</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleNav('/account')}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2.5 transition-colors cursor-pointer ${
                        currentPath === '/account' && !window.location.search.includes('tab=billing')
                          ? 'bg-[#FF6B00]/20 text-[#FF6B00]'
                          : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <User className="w-4 h-4 text-slate-400" />
                      <span>Account Settings</span>
                    </button>
                  </div>

                  <div className="pt-1 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={async () => {
                        setActiveDropdown(null);
                        await studentLogout();
                        handleNav('/');
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-red-400 hover:bg-red-950/40 hover:text-red-300 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-red-400" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              id="nav-account-btn"
              type="button"
              onClick={() => handleNav(currentUser ? (isAdminAuthenticated ? '/admin' : '/account') : '/login')}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl text-[11px] font-semibold uppercase tracking-wider transition-colors cursor-pointer border border-white/10 min-h-[44px]"
              title={currentUser ? (isAdminAuthenticated ? 'Admin Panel' : 'My Account') : 'Sign In'}
            >
              {isAdminAuthenticated ? (
                <ShieldCheck className="w-3.5 h-3.5 text-red-500" />
              ) : (
                <User className="w-3.5 h-3.5 text-[#FF6B00]" />
              )}
              <span className="hidden md:inline">
                {currentUser ? (isAdminAuthenticated ? 'Admin' : (userProfile?.fullName?.split(' ')[0] || 'Account')) : 'Sign In'}
              </span>
            </button>
          )}

          {/* Primary Consultation CTA Button (Tablet & Desktop: >= 640px) */}
          <button
            id="nav-book-consultation-btn"
            type="button"
            onClick={() => handleNav('/business-growth-consultation')}
            className="hidden sm:inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 bg-[#FF6B00] hover:bg-[#e66000] text-white text-xs font-bold uppercase tracking-widest transition-all cursor-pointer shadow-lg shadow-[#FF6B00]/20 active:scale-[0.98] rounded-none font-interface min-h-[44px]"
          >
            <Calendar className="w-3.5 h-3.5 text-white" />
            <span>BOOK A CONSULTATION</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          {/* Mobile & Tablet Hamburger Toggle (< 1024px) */}
          <button
            id="mobile-menu-toggle-btn"
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsMobileMenuOpen((prev) => !prev);
            }}
            className="lg:hidden p-2.5 text-slate-200 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#FF6B00] min-h-[44px] min-w-[44px] flex items-center justify-center bg-white/5 border border-white/10 active:scale-95"
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-navigation-drawer"
          >
            {isMobileMenuOpen ? (
              <X className="w-6 h-6 text-[#FF6B00]" />
            ) : (
              <Menu className="w-6 h-6 text-white" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile / Tablet Drawer (Accordion Style) */}
      {isMobileMenuOpen && (
        <div
          id="mobile-navigation-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation"
          className="lg:hidden fixed inset-x-0 top-[58px] sm:top-[68px] bottom-0 h-[calc(100dvh-58px)] sm:h-[calc(100dvh-68px)] bg-[#07111F]/98 backdrop-blur-2xl z-50 overflow-y-auto overscroll-contain flex flex-col justify-between p-5 sm:p-6 border-t border-slate-800 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="space-y-3 pt-1">
            <div className="pb-3 border-b border-slate-800/80 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-interface">Navigation</span>
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  document.body.style.overflow = '';
                  document.body.style.touchAction = '';
                  if (onOpenSearch) onOpenSearch();
                  else setIsSearchOpen(true);
                }}
                className="text-xs text-[#1877F2] hover:text-blue-400 flex items-center gap-1.5 font-semibold cursor-pointer py-1 px-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Search Knowledge</span>
              </button>
            </div>

            {/* Mobile Accordion 1: ABOUT */}
            <div className="rounded-xl border border-slate-800/80 overflow-hidden bg-slate-900/40">
              <button
                type="button"
                onClick={() => toggleMobileAccordion('about')}
                aria-expanded={mobileExpandedSection === 'about'}
                className="w-full min-h-[44px] px-4 py-3.5 text-left text-sm font-bold uppercase tracking-wider text-slate-200 hover:text-white flex items-center justify-between cursor-pointer focus:outline-none focus:bg-slate-800/80"
              >
                <span className="flex items-center gap-2 font-interface">
                  <span>ABOUT</span>
                  {isAboutActive && <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B00]"></span>}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                    mobileExpandedSection === 'about' ? 'rotate-180 text-[#FF6B00]' : ''
                  }`}
                />
              </button>
              {mobileExpandedSection === 'about' && (
                <div className="px-3 pb-3 space-y-1 bg-slate-950/50 border-t border-slate-800/60 pt-2 animate-in fade-in duration-150">
                  <button
                    type="button"
                    onClick={() => handleNav('/about')}
                    className="w-full min-h-[44px] text-left px-3 py-2.5 rounded-lg text-xs font-bold text-[#FF6B00] hover:bg-slate-800/40 flex items-center justify-between cursor-pointer"
                  >
                    <span>About Overview</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  {aboutSubmenu.map((sub) => {
                    const SubIcon = sub.icon;
                    const isActive = currentPath === sub.path || currentPath.startsWith(sub.path + '/');
                    return (
                      <button
                        key={sub.path}
                        type="button"
                        onClick={() => handleNav(sub.path)}
                        className={`w-full min-h-[44px] text-left px-3 py-2.5 rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer ${
                          isActive
                            ? 'bg-[#1877F2]/20 text-white font-semibold border border-[#1877F2]/30'
                            : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <SubIcon className="w-3.5 h-3.5 text-slate-400" />
                          <span>{sub.label}</span>
                        </span>
                        <span className="text-[10px] text-slate-500">{sub.desc.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Mobile Accordion 2: OUR GROWTH SYSTEM */}
            <div className="rounded-xl border border-slate-800/80 overflow-hidden bg-slate-900/40">
              <button
                type="button"
                onClick={() => toggleMobileAccordion('services')}
                aria-expanded={mobileExpandedSection === 'services'}
                className="w-full min-h-[44px] px-4 py-3.5 text-left text-sm font-bold uppercase tracking-wider text-slate-200 hover:text-white flex items-center justify-between cursor-pointer focus:outline-none focus:bg-slate-800/80"
              >
                <span className="flex items-center gap-2 font-interface">
                  <span>SERVICES</span>
                  {isServicesActive && <span className="w-1.5 h-1.5 rounded-full bg-[#1877F2]"></span>}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                    mobileExpandedSection === 'services' ? 'rotate-180 text-[#1877F2]' : ''
                  }`}
                />
              </button>
              {mobileExpandedSection === 'services' && (
                <div className="px-3 pb-3 space-y-1 bg-slate-950/50 border-t border-slate-800/60 pt-2 animate-in fade-in duration-150">
                  <button
                    type="button"
                    onClick={() => handleNav('/services')}
                    className="w-full min-h-[44px] text-left px-3 py-2.5 rounded-lg text-xs font-bold text-[#1877F2] hover:bg-slate-800/40 flex items-center justify-between cursor-pointer"
                  >
                    <span>Our Growth System Overview</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  {servicesSubmenu.map((sub) => {
                    const SubIcon = sub.icon;
                    const isActive = currentPath === sub.path;
                    return (
                      <button
                        key={sub.path}
                        type="button"
                        onClick={() => handleNav(sub.path)}
                        className={`w-full min-h-[44px] text-left px-3 py-2.5 rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer ${
                          isActive
                            ? 'bg-[#FF6B00]/20 text-white font-semibold border border-[#FF6B00]/30'
                            : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <SubIcon className="w-3.5 h-3.5 text-slate-400" />
                          <span>{sub.label}</span>
                        </span>
                        <span className="text-[10px] text-slate-500">{sub.desc.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Mobile Direct Links */}
            <button
              type="button"
              onClick={() => handleNav('/learn')}
              className={`w-full min-h-[44px] text-left px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all flex items-center justify-between cursor-pointer font-interface ${
                isLearnActive
                  ? 'text-white bg-[#1877F2]/20 border border-[#1877F2]/40'
                  : 'text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span>LEARN WITH DIGITAL MUID</span>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </button>

            <button
              type="button"
              onClick={() => handleNav('/blog')}
              className={`w-full min-h-[44px] text-left px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all flex items-center justify-between cursor-pointer font-interface ${
                isBlogActive
                  ? 'text-white bg-[#1877F2]/20 border border-[#1877F2]/40'
                  : 'text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span>BLOG</span>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </button>

            <button
              type="button"
              onClick={() => handleNav('/contact')}
              className={`w-full min-h-[44px] text-left px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all flex items-center justify-between cursor-pointer font-interface ${
                isContactActive
                  ? 'text-white bg-[#1877F2]/20 border border-[#1877F2]/40'
                  : 'text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span>GET IN TOUCH</span>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </button>

            {/* Member / Student Navigation Section */}
            {currentUser && !isAdminAuthenticated ? (
              <div className="space-y-1.5 p-2 rounded-2xl bg-white/5 border border-white/10">
                <div className="px-3 py-1.5 flex items-center justify-between border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-[#FF6B00]" />
                    <span className="text-xs font-bold text-white">
                      {userProfile?.fullName || 'Student'}
                    </span>
                  </div>
                  <span className="text-[10px] text-orange-400 font-bold uppercase tracking-wider">
                    Student
                  </span>
                </div>

                <div className="space-y-0.5">
                  <button
                    type="button"
                    onClick={() => handleNav('/dashboard')}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                      currentPath === '/dashboard'
                        ? 'text-[#FF6B00] bg-white/10'
                        : 'text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <LayoutDashboard className="w-4 h-4 text-[#FF6B00]" />
                      <span>Student Dashboard</span>
                    </span>
                    {unreadNotificationsCount > 0 ? (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FF6B00] text-white">
                        {unreadNotificationsCount}
                      </span>
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNav('/my-courses')}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                      currentPath === '/my-courses'
                        ? 'text-[#FF6B00] bg-white/10'
                        : 'text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-[#FF6B00]" />
                      <span>My Courses</span>
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNav('/my-consultations')}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                      currentPath === '/my-consultations'
                        ? 'text-[#FF6B00] bg-white/10'
                        : 'text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#FF6B00]" />
                      <span>My Consultations</span>
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  </button>

                  <button
                    id="mobile-drawer-student-saved-btn"
                    type="button"
                    onClick={() => handleNav('/saved')}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                      currentPath === '/saved'
                        ? 'text-[#FF6B00] bg-white/10'
                        : 'text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Bookmark className="w-4 h-4 text-[#FF6B00]" />
                      <span>Saved Content</span>
                    </span>
                    {studentBookmarks && studentBookmarks.length > 0 ? (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FF6B00] text-white">
                        {studentBookmarks.length}
                      </span>
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </button>

                  <button
                    id="mobile-drawer-student-wishlist-btn"
                    type="button"
                    onClick={() => handleNav('/wishlist')}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                      currentPath === '/wishlist'
                        ? 'text-[#FF6B00] bg-white/10'
                        : 'text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Heart className="w-4 h-4 text-[#FF6B00]" />
                      <span>Course Wishlist</span>
                    </span>
                    {courseWishlist && courseWishlist.length > 0 ? (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white">
                        {courseWishlist.length}
                      </span>
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNav('/resources')}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                      currentPath === '/resources'
                        ? 'text-[#FF6B00] bg-white/10'
                        : 'text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Download className="w-4 h-4 text-[#FF6B00]" />
                      <span>Toolkits & Resources</span>
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNav('/account?tab=billing')}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                      currentPath === '/account' && window.location.search.includes('tab=billing')
                        ? 'text-[#FF6B00] bg-white/10'
                        : 'text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-[#FF6B00]" />
                      <span>Billing & Invoices</span>
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNav('/account')}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                      currentPath === '/account' && !window.location.search.includes('tab=billing')
                        ? 'text-[#FF6B00] bg-white/10'
                        : 'text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400" />
                      <span>Account Profile</span>
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      await studentLogout();
                      handleNav('/');
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-950/40 hover:text-red-300 flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <LogOut className="w-4 h-4 text-red-400" />
                      <span>Sign Out</span>
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => handleNav(currentUser ? (isAdminAuthenticated ? '/admin' : '/account') : '/login')}
                className="w-full min-h-[44px] text-left px-4 py-3 rounded-xl text-xs font-semibold text-slate-200 bg-white/5 border border-white/10 flex items-center justify-between cursor-pointer hover:bg-white/10"
              >
                <span className="flex items-center gap-2">
                  {isAdminAuthenticated ? (
                    <ShieldCheck className="w-4 h-4 text-red-500" />
                  ) : (
                    <User className="w-4 h-4 text-[#FF6B00]" />
                  )}
                  <span>
                    {currentUser
                      ? (isAdminAuthenticated ? 'Admin Command Center' : `My Account (${userProfile?.fullName?.split(' ')[0] || 'Member'})`)
                      : 'Student / Member Sign In'}
                  </span>
                </span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>
            )}
          </div>

          {/* Bottom Mobile Action CTAs & Social Links */}
          <div className="pt-4 pb-6 border-t border-slate-800/80 space-y-3 mt-4">
            {/* Primary Mobile CTA: Book a Consultation */}
            <button
              id="mobile-book-consultation-btn"
              type="button"
              onClick={() => handleNav('/business-growth-consultation')}
              className="w-full min-h-[48px] py-3.5 px-4 bg-[#FF6B00] hover:bg-[#e66000] text-white font-bold text-xs uppercase tracking-widest text-center flex items-center justify-center gap-2 shadow-lg shadow-[#FF6B00]/30 cursor-pointer active:scale-98 transition-all font-interface"
            >
              <Calendar className="w-4 h-4" />
              <span>BOOK A CONSULTATION</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-center text-[11px] text-slate-400 font-interface">
              30-min strategic 1-on-1 session with Digital Muid
            </p>

            {/* Mobile Social Links (Strict Sequence: LinkedIn | Instagram | Facebook | YouTube) */}
            <div className="pt-2 flex items-center justify-center gap-3">
              {socialLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.name}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-600 flex items-center justify-center text-slate-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#FF6B00]"
                    aria-label={item.ariaLabel}
                    title={item.name}
                  >
                    <Icon className="w-4 h-4" />
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

