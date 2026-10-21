import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { analytics } from '../utils/analytics';
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
  Globe,
  Briefcase
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
  type NavDropdown = 'services' | 'learn' | 'frameworks' | 'user' | 'notifications' | null;
  type MobileAccordion = 'services' | 'learn' | 'frameworks' | 'student' | null;

  const [activeDropdown, setActiveDropdown] = useState<NavDropdown>(null);
  const dropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Accordion state for Mobile Menu
  const [mobileExpandedSection, setMobileExpandedSection] = useState<MobileAccordion>(null);

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

  const handleMouseEnter = (menu: NavDropdown) => {
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current);
    }
    setActiveDropdown(menu);
  };

  const handleMouseLeave = () => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setActiveDropdown(null);
    }, 180);
  };

  const toggleDropdown = (menu: NavDropdown) => {
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current);
    }
    setActiveDropdown((prev) => (prev === menu ? null : menu));
  };

  const toggleMobileAccordion = (menu: MobileAccordion) => {
    setMobileExpandedSection((prev) => (prev === menu ? null : menu));
  };

  const servicesSubmenu = [
    {
      label: 'Agency',
      path: '/agency-services',
      icon: Briefcase,
      desc: 'Enterprise performance, custom web & growth engineering'
    },
    {
      label: 'Growth Systems',
      path: '/services/growth-systems',
      icon: TrendingUp,
      desc: 'Full-funnel demand generation & operating architectures'
    },
    {
      label: 'Consultation Business Growth',
      path: '/business-growth-consultation',
      icon: Calendar,
      desc: 'Paid 1-on-1 strategic growth advisory with Digital Muid'
    }
  ];

  const learnSubmenu = [
    {
      label: 'Academy',
      path: '/academy',
      icon: GraduationCap,
      desc: 'Brand introduction, educational philosophy & curricula',
      badge: 'Hub'
    },
    {
      label: 'Course Catalog',
      path: '/learn',
      icon: BookOpen,
      desc: 'Complete course catalog, masterclasses & certifications',
      badge: 'Catalog'
    }
  ];

  const frameworksSubmenu = [
    {
      label: 'Growth Strategies',
      path: '/frameworks/growth-strategies',
      icon: TrendingUp,
      desc: 'Scalable acquisition, retention & expansion frameworks'
    },
    {
      label: 'AI Automation',
      path: '/frameworks/ai-automation',
      icon: Bot,
      desc: 'Architectures for implementing AI & autonomous workflows'
    },
    {
      label: 'Modern Marketing',
      path: '/frameworks/modern-marketing',
      icon: Megaphone,
      desc: 'Next-generation demand generation, attribution & funnels'
    },
    {
      label: 'Personal Branding',
      path: '/frameworks/personal-branding',
      icon: Award,
      desc: 'Codifying expertise, executive presence & market authority'
    },
    {
      label: 'Digital Transformation',
      path: '/frameworks/digital-transformation',
      icon: Cpu,
      desc: 'Enterprise reinvention, digital pivot & modernization models'
    },
    {
      label: 'Education',
      path: '/frameworks/education',
      icon: GraduationCap,
      desc: 'Systematic skill mastery, learning models & frameworks'
    }
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

  const isAboutActive = currentPath === '/about';
  const isServicesActive =
    currentPath === '/agency-services' ||
    currentPath === '/services/growth-systems' ||
    currentPath === '/services' ||
    currentPath.startsWith('/services/') ||
    currentPath === '/growth-systems' ||
    currentPath === '/business-growth-consultation';
  const isLearnActive =
    currentPath === '/academy' ||
    currentPath === '/learn' ||
    currentPath.startsWith('/learn/') ||
    currentPath.startsWith('/courses/');
  const isFrameworksActive =
    currentPath === '/frameworks' ||
    currentPath.startsWith('/frameworks/');
  const isBlogActive =
    currentPath === '/blog' ||
    currentPath.startsWith('/blog/') ||
    currentPath === '/insights';
  const isContactActive = currentPath === '/contact';

  return (
    <header
      id="main-navbar"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-[#FFFFFF]/95 backdrop-blur-md border-b border-[#E5EAF2] shadow-sm py-3 sm:py-3.5'
          : 'bg-[#FFFFFF]/90 backdrop-blur-md border-b border-[#E5EAF2] py-3.5 sm:py-4.5'
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
            <div className="w-8 h-8 rounded-lg bg-[#2457D6] flex items-center justify-center text-white font-display font-bold text-sm shadow-md shadow-[#2457D6]/20 group-hover:scale-105 transition-transform">
              M
            </div>
            <div>
              <div className="font-display font-bold text-base sm:text-lg tracking-tight text-[#172033] flex items-center gap-2">
                <span>DIGITAL MUID</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#2457D6]"></span>
              </div>
              <p className="text-[9px] text-[#596579] font-interface tracking-[0.2em] uppercase hidden sm:block">
                Growth · AI · Transformation
              </p>
            </div>
          </button>

          {isAdminAuthenticated && (
            <button
              type="button"
              onClick={() => handleNav('/admin')}
              className="hidden xl:flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#E8EFFF] border border-[#2457D6]/30 text-[#2457D6] text-[10px] uppercase font-bold tracking-wider hover:bg-[#2457D6]/15 transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-3 h-3 text-[#2457D6]" />
              <span>Admin</span>
            </button>
          )}
        </div>

        {/* Desktop Navigation Links (>= 1024px) */}
        <nav className="hidden lg:flex items-center gap-5 xl:gap-7 font-interface" aria-label="Main Navigation">
          {/* 1. About */}
          <a
            id="nav-link-about"
            href="/about"
            onClick={(e) => {
              e.preventDefault();
              handleNav('/about');
            }}
            className={`text-xs font-semibold tracking-wide transition-colors py-1.5 whitespace-nowrap cursor-pointer rounded-md px-1.5 ${
              isAboutActive
                ? 'text-[#2457D6] border-b-2 border-[#2457D6] font-bold'
                : 'text-[#465166] hover:text-[#172033]'
            }`}
          >
            About
          </a>

          {/* 2. Services Dropdown */}
          <div
            className="relative"
            onMouseEnter={() => handleMouseEnter('services')}
            onMouseLeave={handleMouseLeave}
          >
            <button
              id="nav-services-btn"
              type="button"
              onClick={() => toggleDropdown('services')}
              aria-expanded={activeDropdown === 'services'}
              aria-haspopup="true"
              aria-controls="nav-services-dropdown"
              className={`inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide transition-colors py-1.5 whitespace-nowrap cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#2457D6] rounded-md px-1.5 ${
                isServicesActive
                  ? 'text-[#2457D6] border-b-2 border-[#2457D6] font-bold'
                  : 'text-[#465166] hover:text-[#172033]'
              }`}
            >
              <span>Services</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  activeDropdown === 'services' ? 'rotate-180 text-[#2457D6]' : 'text-[#596579]'
                }`}
              />
            </button>

            {activeDropdown === 'services' && (
              <div
                id="nav-services-dropdown"
                role="menu"
                aria-labelledby="nav-services-btn"
                className="absolute left-0 top-full mt-2 w-80 rounded-2xl bg-[#FFFFFF] border border-[#E5EAF2] shadow-xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
              >
                <div className="px-3 py-1.5 border-b border-[#E5EAF2] text-[10px] font-bold uppercase tracking-wider text-[#596579] font-interface">
                  Services
                </div>
                <div className="py-1 space-y-1">
                  {servicesSubmenu.map((item) => {
                    const ItemIcon = item.icon;
                    const isActive = currentPath === item.path;
                    return (
                      <a
                        key={item.path}
                        href={item.path}
                        role="menuitem"
                        onClick={(e) => {
                          e.preventDefault();
                          handleNav(item.path);
                        }}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-xs transition-colors flex items-start gap-3 cursor-pointer group ${
                          isActive
                            ? 'bg-[#E8EFFF] text-[#2457D6] border border-[#2457D6]/30'
                            : 'text-[#172033] hover:bg-[#EEF3FA]'
                        }`}
                      >
                        <div
                          className={`p-2 rounded-lg mt-0.5 shrink-0 ${
                            isActive ? 'bg-[#2457D6] text-white' : 'bg-[#EEF3FA] text-[#2457D6] group-hover:bg-[#E8EFFF]'
                          }`}
                        >
                          <ItemIcon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-[#172033] flex items-center justify-between">
                            <span>{item.label}</span>
                            <ArrowRight className="w-3 h-3 text-[#2457D6] opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                          </div>
                          <p className="text-[11px] text-[#596579] leading-snug mt-0.5">
                            {item.desc}
                          </p>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 3. Learn Dropdown */}
          <div
            className="relative"
            onMouseEnter={() => handleMouseEnter('learn')}
            onMouseLeave={handleMouseLeave}
          >
            <button
              id="nav-learn-btn"
              type="button"
              onClick={() => toggleDropdown('learn')}
              aria-expanded={activeDropdown === 'learn'}
              aria-haspopup="true"
              aria-controls="nav-learn-dropdown"
              className={`inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide transition-colors py-1.5 whitespace-nowrap cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#2457D6] rounded-md px-1.5 ${
                isLearnActive
                  ? 'text-[#2457D6] border-b-2 border-[#2457D6] font-bold'
                  : 'text-[#465166] hover:text-[#172033]'
              }`}
            >
              <span>Learn</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  activeDropdown === 'learn' ? 'rotate-180 text-[#2457D6]' : 'text-[#596579]'
                }`}
              />
            </button>

            {activeDropdown === 'learn' && (
              <div
                id="nav-learn-dropdown"
                role="menu"
                aria-labelledby="nav-learn-btn"
                className="absolute left-0 top-full mt-2 w-80 rounded-2xl bg-[#FFFFFF] border border-[#E5EAF2] shadow-xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
              >
                <div className="px-3 py-1.5 border-b border-[#E5EAF2] text-[10px] font-bold uppercase tracking-wider text-[#596579] font-interface">
                  Education & Learning
                </div>
                <div className="py-1 space-y-1">
                  {learnSubmenu.map((item) => {
                    const ItemIcon = item.icon;
                    const isActive = currentPath === item.path || (item.path === '/learn' && currentPath.startsWith('/learn/'));
                    return (
                      <a
                        key={item.path}
                        href={item.path}
                        role="menuitem"
                        onClick={(e) => {
                          e.preventDefault();
                          if (item.path === '/academy') {
                            analytics.trackAcademyCta('navbar', '/academy');
                          }
                          handleNav(item.path);
                        }}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-xs transition-colors flex items-start gap-3 cursor-pointer group ${
                          isActive
                            ? 'bg-[#E8EFFF] text-[#2457D6] border border-[#2457D6]/30'
                            : 'text-[#172033] hover:bg-[#EEF3FA]'
                        }`}
                      >
                        <div
                          className={`p-2 rounded-lg mt-0.5 shrink-0 ${
                            isActive ? 'bg-[#2457D6] text-white' : 'bg-[#EEF3FA] text-[#2457D6] group-hover:bg-[#E8EFFF]'
                          }`}
                        >
                          <ItemIcon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-[#172033] flex items-center justify-between">
                            <span>{item.label}</span>
                            <ArrowRight className="w-3 h-3 text-[#2457D6] opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                          </div>
                          <p className="text-[11px] text-[#596579] leading-snug mt-0.5">
                            {item.desc}
                          </p>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 4. Frameworks Dropdown */}
          <div
            className="relative"
            onMouseEnter={() => handleMouseEnter('frameworks')}
            onMouseLeave={handleMouseLeave}
          >
            <button
              id="nav-frameworks-btn"
              type="button"
              onClick={() => toggleDropdown('frameworks')}
              aria-expanded={activeDropdown === 'frameworks'}
              aria-haspopup="true"
              aria-controls="nav-frameworks-dropdown"
              className={`inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide transition-colors py-1.5 whitespace-nowrap cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#2457D6] rounded-md px-1.5 ${
                isFrameworksActive
                  ? 'text-[#2457D6] border-b-2 border-[#2457D6] font-bold'
                  : 'text-[#465166] hover:text-[#172033]'
              }`}
            >
              <span>Frameworks</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  activeDropdown === 'frameworks' ? 'rotate-180 text-[#2457D6]' : 'text-[#596579]'
                }`}
              />
            </button>

            {activeDropdown === 'frameworks' && (
              <div
                id="nav-frameworks-dropdown"
                role="menu"
                aria-labelledby="nav-frameworks-btn"
                className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-[540px] rounded-2xl bg-[#FFFFFF] border border-[#E5EAF2] shadow-xl p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
              >
                <div className="px-3 py-1.5 border-b border-[#E5EAF2] flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#596579] font-interface">
                  <span>Proprietary Frameworks</span>
                  <a
                    href="/frameworks"
                    onClick={(e) => {
                      e.preventDefault();
                      handleNav('/frameworks');
                    }}
                    className="text-[#2457D6] hover:underline cursor-pointer lowercase first-letter:uppercase"
                  >
                    All frameworks →
                  </a>
                </div>
                <div className="py-2 grid grid-cols-2 gap-1.5">
                  {frameworksSubmenu.map((item) => {
                    const ItemIcon = item.icon;
                    const isActive = currentPath === item.path;
                    return (
                      <a
                        key={item.path}
                        href={item.path}
                        role="menuitem"
                        onClick={(e) => {
                          e.preventDefault();
                          analytics.trackFrameworkClick(item.path.replace('/frameworks/', ''), item.label);
                          handleNav(item.path);
                        }}
                        className={`text-left p-2.5 rounded-xl text-xs transition-colors flex items-start gap-2.5 cursor-pointer group ${
                          isActive
                            ? 'bg-[#E8EFFF] text-[#2457D6] border border-[#2457D6]/30'
                            : 'text-[#172033] hover:bg-[#EEF3FA]'
                        }`}
                      >
                        <div
                          className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                            isActive ? 'bg-[#2457D6] text-white' : 'bg-[#EEF3FA] text-[#2457D6] group-hover:bg-[#E8EFFF]'
                          }`}
                        >
                          <ItemIcon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-[#172033] text-[12px] group-hover:text-[#2457D6] transition-colors leading-tight">
                            {item.label}
                          </div>
                          <p className="text-[10px] text-[#596579] leading-snug mt-0.5 line-clamp-1">
                            {item.desc}
                          </p>
                        </div>
                      </a>
                    );
                  })}
                </div>
                <div className="p-2 border-t border-[#E5EAF2] bg-[#F7F9FC] text-center rounded-b-xl">
                  <a
                    href="/frameworks"
                    onClick={(e) => {
                      e.preventDefault();
                      handleNav('/frameworks');
                    }}
                    className="text-[11px] font-semibold text-[#465166] hover:text-[#2457D6] transition-colors cursor-pointer"
                  >
                    Explore all proprietary models and architectures →
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* 5. Blog */}
          <a
            id="nav-link-blog"
            href="/blog"
            onClick={(e) => {
              e.preventDefault();
              handleNav('/blog');
            }}
            className={`text-xs font-semibold tracking-wide transition-colors py-1.5 whitespace-nowrap cursor-pointer rounded-md px-1.5 ${
              isBlogActive
                ? 'text-[#2457D6] border-b-2 border-[#2457D6] font-bold'
                : 'text-[#465166] hover:text-[#172033]'
            }`}
          >
            Blog
          </a>

          {/* 6. Contact */}
          <a
            id="nav-link-contact"
            href="/contact"
            onClick={(e) => {
              e.preventDefault();
              handleNav('/contact');
            }}
            className={`text-xs font-semibold tracking-wide transition-colors py-1.5 whitespace-nowrap cursor-pointer rounded-md px-1.5 ${
              isContactActive
                ? 'text-[#2457D6] border-b-2 border-[#2457D6] font-bold'
                : 'text-[#465166] hover:text-[#172033]'
            }`}
          >
            Contact
          </a>
        </nav>

        {/* Right Action Area */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Global Search Button */}
          <button
            id="nav-search-btn"
            type="button"
            onClick={() => (onOpenSearch ? onOpenSearch() : setIsSearchOpen(true))}
            className="p-2 sm:p-2.5 text-[#465166] hover:text-[#172033] hover:bg-[#EEF3FA] rounded-xl transition-colors flex items-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#2457D6] min-h-[44px] min-w-[44px] justify-center border border-[#E5EAF2] bg-[#FFFFFF]"
            title="Search knowledge base (Cmd+K)"
            aria-label="Search knowledge base"
          >
            <Search className="w-4 h-4 text-[#465166]" />
            <span className="hidden xl:inline text-[10px] text-[#596579] font-interface bg-[#EEF3FA] px-1.5 py-0.5 rounded border border-[#E5EAF2] uppercase tracking-wider font-semibold">
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
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-[#465166] hover:text-[#172033] hover:bg-[#EEF3FA] rounded-xl text-[11px] font-semibold uppercase tracking-wider transition-colors cursor-pointer border border-[#E5EAF2] min-h-[44px]"
              title={currentUser ? (isAdminAuthenticated ? 'Admin Panel' : 'My Account') : 'Student Login'}
            >
              {isAdminAuthenticated ? (
                <ShieldCheck className="w-3.5 h-3.5 text-[#2457D6]" />
              ) : (
                <User className="w-3.5 h-3.5 text-[#2457D6]" />
              )}
              <span className="hidden md:inline">
                {currentUser ? (isAdminAuthenticated ? 'Admin' : (userProfile?.fullName?.split(' ')[0] || 'Account')) : 'Student Login'}
              </span>
            </button>
          )}

          {/* Primary Book Consultation CTA Button (Tablet & Desktop: >= 640px) */}
          <a
            id="nav-book-consultation-btn"
            href="/business-growth-consultation"
            onClick={(e) => {
              e.preventDefault();
              analytics.trackGrowthAuditCta('navbar');
              handleNav('/business-growth-consultation');
            }}
            className="hidden sm:inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 bg-[#2457D6] hover:bg-[#1D46B3] text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-[#2457D6]/25 active:scale-[0.98] rounded-xl font-interface min-h-[44px] whitespace-nowrap"
          >
            <span>Book Consultation</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>

          {/* Mobile & Tablet Hamburger Toggle (< 1024px) */}
          <button
            id="mobile-menu-toggle-btn"
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsMobileMenuOpen((prev) => !prev);
            }}
            className="lg:hidden p-2.5 text-[#172033] hover:text-[#2457D6] hover:bg-[#EEF3FA] rounded-xl transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#2457D6] min-h-[44px] min-w-[44px] flex items-center justify-center bg-[#F7F9FC] border border-[#E5EAF2] active:scale-95"
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-navigation-drawer"
          >
            {isMobileMenuOpen ? (
              <X className="w-6 h-6 text-[#2457D6]" />
            ) : (
              <Menu className="w-6 h-6 text-[#172033]" />
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
          className="lg:hidden fixed inset-x-0 top-[58px] sm:top-[68px] bottom-0 h-[calc(100dvh-58px)] sm:h-[calc(100dvh-68px)] bg-[#FFFFFF]/98 backdrop-blur-2xl z-50 overflow-y-auto overscroll-contain flex flex-col justify-between p-5 sm:p-6 border-t border-[#E5EAF2] shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="space-y-3 pt-1">
            <div className="pb-3 border-b border-[#E5EAF2] flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#596579] font-interface">Navigation</span>
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  document.body.style.overflow = '';
                  document.body.style.touchAction = '';
                  if (onOpenSearch) onOpenSearch();
                  else setIsSearchOpen(true);
                }}
                className="text-xs text-[#2457D6] hover:text-[#1D46B3] flex items-center gap-1.5 font-semibold cursor-pointer py-1.5 px-3 rounded-lg bg-[#E8EFFF] border border-[#2457D6]/20 transition-colors"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Search Knowledge</span>
              </button>
            </div>

            {/* Mobile Navigation List */}
            <div className="space-y-2 pb-3">
              {/* 1. About */}
              <a
                id="mobile-nav-link-about"
                href="/about"
                onClick={(e) => {
                  e.preventDefault();
                  handleNav('/about');
                }}
                className={`w-full min-h-[44px] text-left px-4 py-3 rounded-xl text-sm font-semibold tracking-wide transition-all flex items-center justify-between cursor-pointer font-interface ${
                  isAboutActive
                    ? 'text-[#2457D6] bg-[#E8EFFF] border border-[#2457D6]/30 font-bold'
                    : 'text-[#172033] hover:bg-[#EEF3FA] bg-[#F7F9FC] border border-[#E5EAF2]'
                }`}
              >
                <span>About</span>
                <ArrowRight className="w-4 h-4 text-[#596579]" />
              </a>

              {/* 2. Services Accordion */}
              <div className="rounded-xl border border-[#E5EAF2] overflow-hidden bg-[#F7F9FC]">
                <button
                  type="button"
                  onClick={() => toggleMobileAccordion('services')}
                  aria-expanded={mobileExpandedSection === 'services'}
                  className="w-full min-h-[44px] px-4 py-3.5 text-left text-sm font-semibold tracking-wide text-[#172033] hover:text-[#2457D6] flex items-center justify-between cursor-pointer focus:outline-none focus:bg-[#EEF3FA] font-interface transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span>Services</span>
                    {isServicesActive && <span className="w-1.5 h-1.5 rounded-full bg-[#2457D6]"></span>}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-[#596579] transition-transform duration-200 ${
                      mobileExpandedSection === 'services' ? 'rotate-180 text-[#2457D6]' : ''
                    }`}
                  />
                </button>
                {mobileExpandedSection === 'services' && (
                  <div className="px-3 pb-3 space-y-1 bg-[#FFFFFF] border-t border-[#E5EAF2] pt-2 animate-in fade-in duration-150">
                    {servicesSubmenu.map((sub) => {
                      const SubIcon = sub.icon;
                      const isActive = currentPath === sub.path;
                      return (
                        <a
                          key={sub.path}
                          href={sub.path}
                          onClick={(e) => {
                            e.preventDefault();
                            handleNav(sub.path);
                          }}
                          className={`w-full min-h-[44px] text-left px-3 py-2.5 rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer ${
                            isActive
                              ? 'bg-[#E8EFFF] text-[#2457D6] font-semibold border border-[#2457D6]/30'
                              : 'text-[#465166] hover:text-[#172033] hover:bg-[#EEF3FA]'
                          }`}
                        >
                          <span className="flex items-center gap-2.5">
                            <SubIcon className="w-3.5 h-3.5 text-[#2457D6]" />
                            <span>{sub.label}</span>
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-[#596579]" />
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 3. Learn Accordion */}
              <div className="rounded-xl border border-[#E5EAF2] overflow-hidden bg-[#F7F9FC]">
                <button
                  type="button"
                  onClick={() => toggleMobileAccordion('learn')}
                  aria-expanded={mobileExpandedSection === 'learn'}
                  className="w-full min-h-[44px] px-4 py-3.5 text-left text-sm font-semibold tracking-wide text-[#172033] hover:text-[#2457D6] flex items-center justify-between cursor-pointer focus:outline-none focus:bg-[#EEF3FA] font-interface transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span>Learn</span>
                    {isLearnActive && <span className="w-1.5 h-1.5 rounded-full bg-[#2457D6]"></span>}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-[#596579] transition-transform duration-200 ${
                      mobileExpandedSection === 'learn' ? 'rotate-180 text-[#2457D6]' : ''
                    }`}
                  />
                </button>
                {mobileExpandedSection === 'learn' && (
                  <div className="px-3 pb-3 space-y-1 bg-[#FFFFFF] border-t border-[#E5EAF2] pt-2 animate-in fade-in duration-150">
                    {learnSubmenu.map((sub) => {
                      const SubIcon = sub.icon;
                      const isActive = currentPath === sub.path || (sub.path === '/learn' && currentPath.startsWith('/learn/'));
                      return (
                        <a
                          key={sub.path}
                          href={sub.path}
                          onClick={(e) => {
                            e.preventDefault();
                            if (sub.path === '/academy') {
                              analytics.trackAcademyCta('mobile_navbar', '/academy');
                            }
                            handleNav(sub.path);
                          }}
                          className={`w-full min-h-[44px] text-left px-3 py-2.5 rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer ${
                            isActive
                              ? 'bg-[#E8EFFF] text-[#2457D6] font-semibold border border-[#2457D6]/30'
                              : 'text-[#465166] hover:text-[#172033] hover:bg-[#EEF3FA]'
                          }`}
                        >
                          <span className="flex items-center gap-2.5">
                            <SubIcon className="w-3.5 h-3.5 text-[#2457D6]" />
                            <span>{sub.label}</span>
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#E8EFFF] text-[#2457D6]">
                            {sub.badge}
                          </span>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 4. Frameworks Accordion */}
              <div className="rounded-xl border border-[#E5EAF2] overflow-hidden bg-[#F7F9FC]">
                <button
                  type="button"
                  onClick={() => toggleMobileAccordion('frameworks')}
                  aria-expanded={mobileExpandedSection === 'frameworks'}
                  className="w-full min-h-[44px] px-4 py-3.5 text-left text-sm font-semibold tracking-wide text-[#172033] hover:text-[#2457D6] flex items-center justify-between cursor-pointer focus:outline-none focus:bg-[#EEF3FA] font-interface transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span>Frameworks</span>
                    {isFrameworksActive && <span className="w-1.5 h-1.5 rounded-full bg-[#2457D6]"></span>}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-[#596579] transition-transform duration-200 ${
                      mobileExpandedSection === 'frameworks' ? 'rotate-180 text-[#2457D6]' : ''
                    }`}
                  />
                </button>
                {mobileExpandedSection === 'frameworks' && (
                  <div className="px-3 pb-3 space-y-1 bg-[#FFFFFF] border-t border-[#E5EAF2] pt-2 animate-in fade-in duration-150">
                    {frameworksSubmenu.map((sub) => {
                      const SubIcon = sub.icon;
                      const isActive = currentPath === sub.path;
                      return (
                        <a
                          key={sub.path}
                          href={sub.path}
                          onClick={(e) => {
                            e.preventDefault();
                            analytics.trackFrameworkClick(sub.path.replace('/frameworks/', ''), sub.label);
                            handleNav(sub.path);
                          }}
                          className={`w-full min-h-[44px] text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer ${
                            isActive
                              ? 'bg-[#E8EFFF] text-[#2457D6] font-semibold border border-[#2457D6]/30'
                              : 'text-[#465166] hover:text-[#172033] hover:bg-[#EEF3FA]'
                          }`}
                        >
                          <span className="flex items-center gap-2.5">
                            <SubIcon className="w-3.5 h-3.5 text-[#2457D6]" />
                            <span>{sub.label}</span>
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-[#596579]" />
                        </a>
                      );
                    })}
                    <a
                      href="/frameworks"
                      onClick={(e) => {
                        e.preventDefault();
                        handleNav('/frameworks');
                      }}
                      className="w-full min-h-[40px] text-center px-3 py-2 rounded-lg text-xs font-semibold text-[#2457D6] hover:bg-[#E8EFFF] flex items-center justify-center gap-1.5 cursor-pointer pt-2 border-t border-[#E5EAF2]"
                    >
                      <span>Explore all proprietary frameworks</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>

              {/* 5. Blog */}
              <a
                id="mobile-nav-link-blog"
                href="/blog"
                onClick={(e) => {
                  e.preventDefault();
                  handleNav('/blog');
                }}
                className={`w-full min-h-[44px] text-left px-4 py-3 rounded-xl text-sm font-semibold tracking-wide transition-all flex items-center justify-between cursor-pointer font-interface ${
                  isBlogActive
                    ? 'text-[#2457D6] bg-[#E8EFFF] border border-[#2457D6]/30 font-bold'
                    : 'text-[#172033] hover:bg-[#EEF3FA] bg-[#F7F9FC] border border-[#E5EAF2]'
                }`}
              >
                <span>Blog</span>
                <ArrowRight className="w-4 h-4 text-[#596579]" />
              </a>

              {/* 6. Contact */}
              <a
                id="mobile-nav-link-contact"
                href="/contact"
                onClick={(e) => {
                  e.preventDefault();
                  handleNav('/contact');
                }}
                className={`w-full min-h-[44px] text-left px-4 py-3 rounded-xl text-sm font-semibold tracking-wide transition-all flex items-center justify-between cursor-pointer font-interface ${
                  isContactActive
                    ? 'text-[#2457D6] bg-[#E8EFFF] border border-[#2457D6]/30 font-bold'
                    : 'text-[#172033] hover:bg-[#EEF3FA] bg-[#F7F9FC] border border-[#E5EAF2]'
                }`}
              >
                <span>Contact</span>
                <ArrowRight className="w-4 h-4 text-[#596579]" />
              </a>
            </div>

            {/* Member / Student Navigation Section */}
            {currentUser && !isAdminAuthenticated ? (
              <div className="space-y-1.5 p-2 rounded-2xl bg-[#F7F9FC] border border-[#E5EAF2]">
                <div className="px-3 py-1.5 flex items-center justify-between border-b border-[#E5EAF2]">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-[#2457D6]" />
                    <span className="text-xs font-bold text-[#172033]">
                      {userProfile?.fullName || 'Student'}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#2457D6] font-bold uppercase tracking-wider bg-[#E8EFFF] px-2 py-0.5 rounded-full">
                    Student
                  </span>
                </div>

                <div className="space-y-0.5">
                  <button
                    type="button"
                    onClick={() => handleNav('/dashboard')}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                      currentPath === '/dashboard'
                        ? 'text-[#2457D6] bg-[#E8EFFF]'
                        : 'text-[#465166] hover:bg-[#EEF3FA] hover:text-[#172033]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <LayoutDashboard className="w-4 h-4 text-[#2457D6]" />
                      <span>Student Dashboard</span>
                    </span>
                    {unreadNotificationsCount > 0 ? (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#2457D6] text-white">
                        {unreadNotificationsCount}
                      </span>
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5 text-[#596579]" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNav('/my-courses')}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                      currentPath === '/my-courses'
                        ? 'text-[#2457D6] bg-[#E8EFFF]'
                        : 'text-[#465166] hover:bg-[#EEF3FA] hover:text-[#172033]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-[#2457D6]" />
                      <span>My Courses</span>
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#596579]" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNav('/my-consultations')}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                      currentPath === '/my-consultations'
                        ? 'text-[#2457D6] bg-[#E8EFFF]'
                        : 'text-[#465166] hover:bg-[#EEF3FA] hover:text-[#172033]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#2457D6]" />
                      <span>My Consultations</span>
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#596579]" />
                  </button>

                  <button
                    id="mobile-drawer-student-saved-btn"
                    type="button"
                    onClick={() => handleNav('/saved')}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                      currentPath === '/saved'
                        ? 'text-[#2457D6] bg-[#E8EFFF]'
                        : 'text-[#465166] hover:bg-[#EEF3FA] hover:text-[#172033]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Bookmark className="w-4 h-4 text-[#2457D6]" />
                      <span>Saved Content</span>
                    </span>
                    {studentBookmarks && studentBookmarks.length > 0 ? (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#2457D6] text-white">
                        {studentBookmarks.length}
                      </span>
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5 text-[#596579]" />
                    )}
                  </button>

                  <button
                    id="mobile-drawer-student-wishlist-btn"
                    type="button"
                    onClick={() => handleNav('/wishlist')}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                      currentPath === '/wishlist'
                        ? 'text-[#2457D6] bg-[#E8EFFF]'
                        : 'text-[#465166] hover:bg-[#EEF3FA] hover:text-[#172033]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Heart className="w-4 h-4 text-[#2457D6]" />
                      <span>Course Wishlist</span>
                    </span>
                    {courseWishlist && courseWishlist.length > 0 ? (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white">
                        {courseWishlist.length}
                      </span>
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5 text-[#596579]" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNav('/resources')}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                      currentPath === '/resources'
                        ? 'text-[#2457D6] bg-[#E8EFFF]'
                        : 'text-[#465166] hover:bg-[#EEF3FA] hover:text-[#172033]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Download className="w-4 h-4 text-[#2457D6]" />
                      <span>Toolkits & Resources</span>
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#596579]" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNav('/account?tab=billing')}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                      currentPath === '/account' && window.location.search.includes('tab=billing')
                        ? 'text-[#2457D6] bg-[#E8EFFF]'
                        : 'text-[#465166] hover:bg-[#EEF3FA] hover:text-[#172033]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-[#2457D6]" />
                      <span>Billing & Invoices</span>
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#596579]" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNav('/account')}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                      currentPath === '/account' && !window.location.search.includes('tab=billing')
                        ? 'text-[#2457D6] bg-[#E8EFFF]'
                        : 'text-[#465166] hover:bg-[#EEF3FA] hover:text-[#172033]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <User className="w-4 h-4 text-[#596579]" />
                      <span>Account Profile</span>
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#596579]" />
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      await studentLogout();
                      handleNav('/');
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <LogOut className="w-4 h-4 text-red-600" />
                      <span>Sign Out</span>
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => handleNav(currentUser ? (isAdminAuthenticated ? '/admin' : '/account') : '/login')}
                className="w-full min-h-[44px] text-left px-4 py-3 rounded-xl text-xs font-semibold text-[#172033] bg-[#F7F9FC] border border-[#E5EAF2] flex items-center justify-between cursor-pointer hover:bg-[#EEF3FA] transition-colors"
              >
                <span className="flex items-center gap-2">
                  {isAdminAuthenticated ? (
                    <ShieldCheck className="w-4 h-4 text-[#2457D6]" />
                  ) : (
                    <User className="w-4 h-4 text-[#2457D6]" />
                  )}
                  <span>
                    {currentUser
                      ? (isAdminAuthenticated ? 'Admin Command Center' : `My Account (${userProfile?.fullName?.split(' ')[0] || 'Member'})`)
                      : 'Student Login'}
                  </span>
                </span>
                <ArrowRight className="w-4 h-4 text-[#596579]" />
              </button>
            )}
          </div>

          {/* Bottom Mobile Action CTAs & Social Links */}
          <div className="pt-4 pb-6 border-t border-[#E5EAF2] space-y-3 mt-4">
            {/* Primary Mobile CTA: Book Consultation */}
            <a
              id="mobile-book-consultation-btn"
              href="/business-growth-consultation"
              onClick={(e) => {
                e.preventDefault();
                analytics.trackGrowthAuditCta('mobile_navbar');
                handleNav('/business-growth-consultation');
              }}
              className="w-full min-h-[48px] py-3.5 px-4 bg-[#2457D6] hover:bg-[#1D46B3] text-white font-bold text-xs uppercase tracking-wider text-center flex items-center justify-center gap-2 shadow-lg shadow-[#2457D6]/20 cursor-pointer active:scale-98 transition-all font-interface rounded-xl"
            >
              <span>Book Consultation</span>
              <ArrowRight className="w-4 h-4" />
            </a>
            <p className="text-center text-[11px] text-[#596579] font-interface">
              Strategic 1-on-1 business growth consultation with Digital Muid
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
                    className="w-10 h-10 rounded-lg bg-[#F7F9FC] border border-[#E5EAF2] hover:border-[#2457D6]/40 flex items-center justify-center text-[#465166] hover:text-[#2457D6] hover:bg-[#E8EFFF] transition-colors focus:outline-none focus:ring-2 focus:ring-[#2457D6]"
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

