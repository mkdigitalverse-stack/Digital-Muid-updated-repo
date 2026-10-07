import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Lock,
  Mail,
  KeyRound,
  LogOut,
  Calendar,
  DollarSign,
  FileText,
  Video as VideoIcon,
  Layers,
  GraduationCap,
  Download,
  Users,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Loader2,
  Trash2,
  Edit,
  Plus,
  Settings as SettingsIcon,
  Search,
  Sparkles,
  TrendingUp,
  ShieldCheck,
  Clock,
  X,
  MessageSquare,
  UserCheck,
  RefreshCw,
  Phone,
  MapPin,
  Globe,
  CalendarDays,
  Ban,
  Filter,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  Star,
  BookOpen,
  Image as ImageIcon,
  Play,
  CreditCard,
  Receipt
} from 'lucide-react';
import { Article, Video, Framework, Course, Resource, Lead, Booking, ContactMessage, NewsletterSubscriber, AvailabilityRules, LeadStatus, LeadSource, BookingStatus } from '../types';
import { ArticleEditorModal } from '../components/ArticleEditorModal';
import { VideoEditorModal } from '../components/VideoEditorModal';
import { ResourceEditorModal } from '../components/ResourceEditorModal';
import { FrameworkEditorModal } from '../components/FrameworkEditorModal';
import { FrameworkCategoriesModal } from '../components/FrameworkCategoriesModal';
import { CourseEditorModal } from '../components/CourseEditorModal';

interface AdminPageProps {
  navigate: (path: string) => void;
}

export const AdminPage: React.FC<AdminPageProps> = ({ navigate }) => {
  const {
    adminUser,
    isAdminAuthenticated,
    isAuthLoading,
    adminLogin,
    adminLogout,
    requestPasswordReset,
    articles,
    videos,
    frameworks,
    frameworksLoading,
    frameworkCategories,
    resources,
    courses,
    coursesLoading,
    refreshCourses,
    addCourse,
    updateCourse,
    deleteCourse,
    publishCourse,
    unpublishCourse,
    syncInitialCourses,
    bookings,
    leads,
    contactMessages,
    subscribers,
    consultationProduct,
    availabilityRules,
    refreshAvailabilityRules,
    settings,
    refreshArticles,
    addArticle,
    updateArticle,
    deleteArticle,
    publishArticle,
    unpublishArticle,
    refreshVideos,
    addVideo,
    updateVideo,
    deleteVideo,
    publishVideo,
    unpublishVideo,
    refreshFrameworks,
    addFramework,
    updateFramework,
    deleteFramework,
    publishFramework,
    unpublishFramework,
    toggleFeatureFramework,
    syncInitialFrameworks,
    refreshResources,
    addResource,
    updateResource,
    deleteResource,
    publishResource,
    unpublishResource,
    updateBookingStatus,
    cancelBooking,
    rescheduleBooking,
    deleteBooking,
    updateLeadStatus,
    deleteLead,
    deleteContactMessage,
    deleteSubscriber,
    updateConsultationProduct,
    updateAvailabilityRules,
    updateSettings,
    refreshDashboardData,
    adminPayments,
    isAdminPaymentsLoading,
    adminPaymentsError,
    fetchAdminPayments,
    notify
  } = useApp();

  // Auth Form State
  const [authMode, setAuthMode] = useState<'login' | 'forgot_password'>('login');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState<
    'overview' | 'payments' | 'bookings' | 'leads' | 'messages' | 'subscribers' | 'pricing' | 'availability' | 'settings' | 'articles' | 'videos' | 'frameworks' | 'courses' | 'resources'
  >(() => {
    try {
      const validTabs = ['overview', 'payments', 'bookings', 'leads', 'messages', 'subscribers', 'pricing', 'availability', 'settings', 'articles', 'videos', 'frameworks', 'courses', 'resources'];
      const params = new URLSearchParams(window.location.search);
      const urlTab = params.get('tab');
      if (urlTab && validTabs.includes(urlTab)) {
        return urlTab as any;
      }
      const hashTab = window.location.hash.replace('#', '');
      if (hashTab && validTabs.includes(hashTab)) {
        return hashTab as any;
      }
      const savedTab = localStorage.getItem('digital_muid_admin_tab');
      if (savedTab && validTabs.includes(savedTab)) {
        return savedTab as any;
      }
    } catch {
      // safe fallback
    }
    return 'overview';
  });

  const handleSelectTab = (tabId: typeof activeTab) => {
    setActiveTab(tabId);
    try {
      localStorage.setItem('digital_muid_admin_tab', tabId);
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tabId);
      window.history.replaceState(null, '', url.pathname + url.search);
    } catch {
      // safe fallback
    }
  };

  // Diagnostic Telemetry for Admin CMS
  useEffect(() => {
    console.info('[Admin Diagnostic] Session & CMS Telemetry:', {
      isAdminAuthenticated,
      isAuthLoading,
      userEmail: adminUser?.email || null,
      frameworksCount: frameworks.length,
      frameworkCategoriesCount: frameworkCategories.length,
      articlesCount: articles.length,
      videosCount: videos.length,
      resourcesCount: resources.length,
      activeTab
    });
  }, [isAdminAuthenticated, isAuthLoading, adminUser, frameworks.length, frameworkCategories.length, articles.length, videos.length, resources.length, activeTab]);

  // Sync frameworks when navigating to or loading on Frameworks tab
  useEffect(() => {
    if (activeTab === 'frameworks' && isAdminAuthenticated) {
      refreshFrameworks();
    }
  }, [activeTab, isAdminAuthenticated, refreshFrameworks]);

  // Sync payments ledger when navigating to Payments tab
  useEffect(() => {
    if (activeTab === 'payments' && isAdminAuthenticated) {
      fetchAdminPayments();
    }
  }, [activeTab, isAdminAuthenticated, fetchAdminPayments]);

  // Payment Ledger Filter & Search State
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<'all' | 'course' | 'consultation'>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | string>('all');

  // Bookings Filter & Search State
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingStatusFilter, setBookingStatusFilter] = useState<'all' | BookingStatus>('all');
  const [reschedulingBooking, setReschedulingBooking] = useState<Booking | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [cancellingBooking, setCancellingBooking] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Leads Filter & Search State
  const [leadSearch, setLeadSearch] = useState('');
  const [leadStatusFilter, setLeadStatusFilter] = useState<'all' | LeadStatus>('all');
  const [leadSourceFilter, setLeadSourceFilter] = useState<'all' | string>('all');

  // Contact Messages Filter State
  const [messageSearch, setMessageSearch] = useState('');

  // Subscribers Filter State
  const [subscriberSearch, setSubscriberSearch] = useState('');

  // Consultation Pricing Form State
  const [basePrice, setBasePrice] = useState(consultationProduct.basePrice.toString());
  const [gstRate, setGstRate] = useState((consultationProduct.gstRate * 100).toString());
  const [durationMinutes, setDurationMinutes] = useState(consultationProduct.durationMinutes.toString());
  const [isSavingPricing, setIsSavingPricing] = useState(false);

  // Synchronize consultation pricing form state with live Supabase product data
  useEffect(() => {
    setBasePrice(consultationProduct.basePrice.toString());
    setGstRate((consultationProduct.gstRate * 100).toString());
    setDurationMinutes(consultationProduct.durationMinutes.toString());
  }, [consultationProduct.basePrice, consultationProduct.gstRate, consultationProduct.durationMinutes]);

  // Availability Rules Form State
  const [workingDays, setWorkingDays] = useState<number[]>(availabilityRules.workingDays || [1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = useState(availabilityRules.startTime || '11:00');
  const [endTime, setEndTime] = useState(availabilityRules.endTime || '20:00');
  const [slotDurationMinutes, setSlotDurationMinutes] = useState(availabilityRules.slotDurationMinutes.toString());
  const [bufferMinutes, setBufferMinutes] = useState(availabilityRules.bufferMinutes.toString());
  const [minNoticeHours, setMinNoticeHours] = useState(availabilityRules.minNoticeHours.toString());
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(availabilityRules.maxAdvanceDays.toString());
  const [newBlockedDate, setNewBlockedDate] = useState('');
  const [blockedDates, setBlockedDates] = useState<string[]>(availabilityRules.blockedDates || []);
  const [isSavingRules, setIsSavingRules] = useState(false);
  const [isAvailabilityLoading, setIsAvailabilityLoading] = useState<boolean>(true);

  // Synchronize availability rules form state with live Supabase rules data
  useEffect(() => {
    setWorkingDays(availabilityRules.workingDays || [1, 2, 3, 4, 5]);
    setStartTime(availabilityRules.startTime || '11:00');
    setEndTime(availabilityRules.endTime || '20:00');
    setSlotDurationMinutes((availabilityRules.slotDurationMinutes || 30).toString());
    setBufferMinutes((availabilityRules.bufferMinutes || 15).toString());
    setMinNoticeHours((availabilityRules.minNoticeHours || 4).toString());
    setMaxAdvanceDays((availabilityRules.maxAdvanceDays || 30).toString());
    setBlockedDates(availabilityRules.blockedDates || []);
  }, [availabilityRules]);

  // Site Settings Form State
  const [adminEmail, setAdminEmail] = useState(settings.adminEmail || 'mkdigitalverse@gmail.com');
  const [notificationEmail, setNotificationEmail] = useState(settings.notificationEmail || 'mkdigitalverse@gmail.com');
  const [phoneContact, setPhoneContact] = useState(settings.phoneContact || '+91 99066 84898');
  const [locationCity, setLocationCity] = useState(settings.locationCity || 'Bengaluru & Srinagar, India');
  const [razorpayTestMode, setRazorpayTestMode] = useState(settings.razorpayTestMode);
  const [googleCalendarConnected, setGoogleCalendarConnected] = useState(settings.googleCalendarConnected);
  const [googleMeetEnabled, setGoogleMeetEnabled] = useState(settings.googleMeetEnabled);
  const [socialLinkedin, setSocialLinkedin] = useState(settings.socialLinkedin || '');
  const [socialInstagram, setSocialInstagram] = useState(settings.socialInstagram || '');
  const [socialYoutube, setSocialYoutube] = useState(settings.socialYoutube || '');
  const [socialFacebook, setSocialFacebook] = useState(settings.socialFacebook || '');

  // Articles CMS State
  const [articleSearch, setArticleSearch] = useState('');
  const [articleStatusFilter, setArticleStatusFilter] = useState<'all' | 'published' | 'draft' | 'archived'>('all');
  const [articleCategoryFilter, setArticleCategoryFilter] = useState<string>('all');
  const [articleViewMode, setArticleViewMode] = useState<'table' | 'grid'>('table');
  const [isArticleModalOpen, setIsArticleModalOpen] = useState(false);
  const [selectedArticleForEdit, setSelectedArticleForEdit] = useState<Article | null>(null);
  const [deletingArticleId, setDeletingArticleId] = useState<string | null>(null);
  const [isSavingArticle, setIsSavingArticle] = useState(false);

  const openNewArticleModal = () => {
    setSelectedArticleForEdit(null);
    setIsArticleModalOpen(true);
  };

  const openEditArticleModal = (art: Article) => {
    setSelectedArticleForEdit(art);
    setIsArticleModalOpen(true);
  };

  const handleSaveArticleModal = async (payload: Partial<Article>, targetStatus: 'draft' | 'published') => {
    setIsSavingArticle(true);
    try {
      let res: { data: Article | null; error: any };
      if (selectedArticleForEdit?.id) {
        res = await updateArticle(selectedArticleForEdit.id, { ...payload, status: targetStatus });
      } else {
        res = await addArticle({ ...payload, status: targetStatus });
      }
      if (res.data) {
        setIsArticleModalOpen(false);
        setSelectedArticleForEdit(null);
      }
    } catch (err: any) {
      notify(`Failed to save article: ${err.message || 'Unknown error'}`, 'error');
    } finally {
      setIsSavingArticle(false);
    }
  };

  const handleUnpublishArticleModal = async (id: string) => {
    setIsSavingArticle(true);
    try {
      await unpublishArticle(id);
    } catch (err: any) {
      notify(`Failed to unpublish article: ${err.message || 'Unknown error'}`, 'error');
    } finally {
      setIsSavingArticle(false);
    }
  };

  const handleTogglePublish = async (art: Article) => {
    if (art.status === 'published') {
      await unpublishArticle(art.id);
    } else {
      await publishArticle(art.id);
    }
  };

  const handleToggleFeatured = async (art: Article) => {
    const current = Boolean(art.isFeatured ?? art.featured);
    await updateArticle(art.id, {
      isFeatured: !current,
      featured: !current
    });
  };

  // Videos CMS State
  const [videoSearch, setVideoSearch] = useState('');
  const [videoStatusFilter, setVideoStatusFilter] = useState<'all' | 'published' | 'draft' | 'archived'>('all');
  const [videoCategoryFilter, setVideoCategoryFilter] = useState<string>('all');
  const [videoViewMode, setVideoViewMode] = useState<'table' | 'grid'>('table');
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [selectedVideoForEdit, setSelectedVideoForEdit] = useState<Video | null>(null);
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);
  const [isSavingVideo, setIsSavingVideo] = useState(false);

  const openNewVideoModal = () => {
    setSelectedVideoForEdit(null);
    setIsVideoModalOpen(true);
  };

  const openEditVideoModal = (vid: Video) => {
    setSelectedVideoForEdit(vid);
    setIsVideoModalOpen(true);
  };

  const handleSaveVideoModal = async (payload: Partial<Video>, targetStatus: 'draft' | 'published') => {
    setIsSavingVideo(true);
    try {
      let res: { data: Video | null; error: any };
      if (selectedVideoForEdit?.id) {
        res = await updateVideo(selectedVideoForEdit.id, { ...payload, status: targetStatus });
      } else {
        res = await addVideo({ ...payload, status: targetStatus });
      }
      if (res.data) {
        setIsVideoModalOpen(false);
        setSelectedVideoForEdit(null);
      }
    } catch (err: any) {
      notify(`Failed to save video: ${err.message || 'Unknown error'}`, 'error');
    } finally {
      setIsSavingVideo(false);
    }
  };

  const handleUnpublishVideoModal = async (id: string) => {
    setIsSavingVideo(true);
    try {
      await unpublishVideo(id);
    } catch (err: any) {
      notify(`Failed to unpublish video: ${err.message || 'Unknown error'}`, 'error');
    } finally {
      setIsSavingVideo(false);
    }
  };

  const handleToggleVideoPublish = async (vid: Video) => {
    if (vid.status === 'published') {
      await unpublishVideo(vid.id);
    } else {
      await publishVideo(vid.id);
    }
  };

  const handleToggleVideoFeatured = async (vid: Video) => {
    const current = Boolean(vid.isFeatured ?? vid.featured);
    await updateVideo(vid.id, {
      isFeatured: !current,
      featured: !current
    });
  };

  // Resources CMS State
  const [resourceSearch, setResourceSearch] = useState('');
  const [resourceStatusFilter, setResourceStatusFilter] = useState<'all' | 'published' | 'draft' | 'archived'>('all');
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string>('all');
  const [resourceCategoryFilter, setResourceCategoryFilter] = useState<string>('all');
  const [resourceViewMode, setResourceViewMode] = useState<'table' | 'grid'>('table');
  const [isResourceModalOpen, setIsResourceModalOpen] = useState(false);
  const [selectedResourceForEdit, setSelectedResourceForEdit] = useState<Resource | null>(null);
  const [deletingResourceId, setDeletingResourceId] = useState<string | null>(null);
  const [isSavingResource, setIsSavingResource] = useState(false);

  const openNewResourceModal = () => {
    setSelectedResourceForEdit(null);
    setIsResourceModalOpen(true);
  };

  const openEditResourceModal = (res: Resource) => {
    setSelectedResourceForEdit(res);
    setIsResourceModalOpen(true);
  };

  const handleSaveResourceModal = async (payload: Partial<Resource>, targetStatus: 'draft' | 'published') => {
    setIsSavingResource(true);
    try {
      let res: { data: Resource | null; error: any };
      if (selectedResourceForEdit?.id) {
        res = await updateResource(selectedResourceForEdit.id, { ...payload, status: targetStatus });
      } else {
        res = await addResource({ ...payload, status: targetStatus });
      }
      if (res.data) {
        setIsResourceModalOpen(false);
        setSelectedResourceForEdit(null);
      }
    } catch (err: any) {
      notify(`Failed to save resource: ${err.message || 'Unknown error'}`, 'error');
    } finally {
      setIsSavingResource(false);
    }
  };

  const handleUnpublishResourceModal = async (id: string) => {
    setIsSavingResource(true);
    try {
      await unpublishResource(id);
    } catch (err: any) {
      notify(`Failed to unpublish resource: ${err.message || 'Unknown error'}`, 'error');
    } finally {
      setIsSavingResource(false);
    }
  };

  const handleToggleResourcePublish = async (res: Resource) => {
    if (res.status === 'published') {
      await unpublishResource(res.id);
    } else {
      await publishResource(res.id);
    }
  };

  const handleToggleResourceFeatured = async (res: Resource) => {
    const current = Boolean(res.isFeatured ?? res.featured);
    await updateResource(res.id, {
      isFeatured: !current,
      featured: !current
    });
  };

  // Frameworks CMS State
  const [frameworkSearch, setFrameworkSearch] = useState('');
  const [frameworkStatusFilter, setFrameworkStatusFilter] = useState<'all' | 'published' | 'draft' | 'archived'>('all');
  const [frameworkCategoryFilter, setFrameworkCategoryFilter] = useState<string>('all');
  const [frameworkViewMode, setFrameworkViewMode] = useState<'table' | 'grid'>('table');
  const [isFrameworkModalOpen, setIsFrameworkModalOpen] = useState(false);
  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false);
  const [selectedFrameworkForEdit, setSelectedFrameworkForEdit] = useState<Framework | null>(null);
  const [deletingFrameworkId, setDeletingFrameworkId] = useState<string | null>(null);
  const [isSavingFramework, setIsSavingFramework] = useState(false);
  const [isSyncingFrameworks, setIsSyncingFrameworks] = useState(false);

  const openNewFrameworkModal = () => {
    setSelectedFrameworkForEdit(null);
    setIsFrameworkModalOpen(true);
  };

  const openEditFrameworkModal = (fw: Framework) => {
    setSelectedFrameworkForEdit(fw);
    setIsFrameworkModalOpen(true);
  };

  const handleSaveFrameworkModal = async (payload: Partial<Framework>, targetStatus: 'draft' | 'published') => {
    setIsSavingFramework(true);
    try {
      let res: { data: Framework | null; error: any };
      if (selectedFrameworkForEdit?.id) {
        res = await updateFramework(selectedFrameworkForEdit.id, { ...payload, status: targetStatus });
      } else {
        res = await addFramework({ ...payload, status: targetStatus });
      }
      if (res.data) {
        setIsFrameworkModalOpen(false);
        setSelectedFrameworkForEdit(null);
      }
    } catch (err: any) {
      notify(`Failed to save framework: ${err.message || 'Unknown error'}`, 'error');
    } finally {
      setIsSavingFramework(false);
    }
  };

  const handleUnpublishFrameworkModal = async (id: string) => {
    setIsSavingFramework(true);
    try {
      await unpublishFramework(id);
    } catch (err: any) {
      notify(`Failed to unpublish framework: ${err.message || 'Unknown error'}`, 'error');
    } finally {
      setIsSavingFramework(false);
    }
  };

  const handleToggleFrameworkPublish = async (fw: Framework) => {
    if (fw.status === 'published') {
      await unpublishFramework(fw.id);
    } else {
      await publishFramework(fw.id);
    }
  };

  const handleToggleFrameworkFeatured = async (fw: Framework) => {
    const current = Boolean(fw.isFeatured ?? fw.is_featured ?? fw.featured);
    await toggleFeatureFramework(fw.id, !current);
  };

  // Courses CMS State
  const [courseSearch, setCourseSearch] = useState('');
  const [courseStatusFilter, setCourseStatusFilter] = useState<'all' | 'published' | 'draft' | 'archived'>('all');
  const [courseLevelFilter, setCourseLevelFilter] = useState<string>('all');
  const [courseViewMode, setCourseViewMode] = useState<'table' | 'grid'>('table');
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [selectedCourseForEdit, setSelectedCourseForEdit] = useState<Course | null>(null);
  const [deletingCourseId, setDeletingCourseId] = useState<string | null>(null);
  const [isSavingCourse, setIsSavingCourse] = useState(false);
  const [isSyncingCourses, setIsSyncingCourses] = useState(false);

  const openNewCourseModal = () => {
    setSelectedCourseForEdit(null);
    setIsCourseModalOpen(true);
  };

  const openEditCourseModal = (crs: Course) => {
    setSelectedCourseForEdit(crs);
    setIsCourseModalOpen(true);
  };

  const handleSaveCourseModal = async (payload: Partial<Course>, targetStatus: 'draft' | 'published') => {
    setIsSavingCourse(true);
    try {
      let res: { data: Course | null; error: any };
      if (selectedCourseForEdit?.id) {
        res = await updateCourse(selectedCourseForEdit.id, { ...payload, status: targetStatus });
      } else {
        res = await addCourse({ ...payload, status: targetStatus });
      }
      if (res.data) {
        setIsCourseModalOpen(false);
        setSelectedCourseForEdit(null);
      }
    } catch (err: any) {
      notify(`Failed to save course: ${err.message || 'Unknown error'}`, 'error');
    } finally {
      setIsSavingCourse(false);
    }
  };

  const handleUnpublishCourseModal = async (id: string) => {
    setIsSavingCourse(true);
    try {
      await unpublishCourse(id);
    } catch (err: any) {
      notify(`Failed to unpublish course: ${err.message || 'Unknown error'}`, 'error');
    } finally {
      setIsSavingCourse(false);
    }
  };

  const handleToggleCoursePublish = async (crs: Course) => {
    if (crs.status === 'published') {
      await unpublishCourse(crs.id);
    } else {
      await publishCourse(crs.id);
    }
  };

  const handleToggleCourseFeatured = async (crs: Course) => {
    const current = Boolean(crs.isFeatured ?? crs.featured);
    await updateCourse(crs.id, {
      isFeatured: !current,
      featured: !current
    });
  };

  // Sync courses when navigating to Courses tab
  useEffect(() => {
    if (activeTab === 'courses' && isAdminAuthenticated) {
      refreshCourses();
    }
  }, [activeTab, isAdminAuthenticated, refreshCourses]);

  // Sync availability rules when navigating to Availability tab
  useEffect(() => {
    if (activeTab === 'availability' && isAdminAuthenticated) {
      setIsAvailabilityLoading(true);
      refreshAvailabilityRules()
        .then((freshRules) => {
          if (freshRules) {
            setWorkingDays(freshRules.workingDays || [1, 2, 3, 4, 5]);
            setStartTime(freshRules.startTime || '11:00');
            setEndTime(freshRules.endTime || '20:00');
            setSlotDurationMinutes((freshRules.slotDurationMinutes || 30).toString());
            setBufferMinutes((freshRules.bufferMinutes || 15).toString());
            setMinNoticeHours((freshRules.minNoticeHours || 4).toString());
            setMaxAdvanceDays((freshRules.maxAdvanceDays || 30).toString());
            setBlockedDates(freshRules.blockedDates || []);
          }
        })
        .catch((err) => {
          console.error('[AdminPage] Failed to refresh availability rules:', err);
        })
        .finally(() => {
          setIsAvailabilityLoading(false);
        });
    }
  }, [activeTab, isAdminAuthenticated, refreshAvailabilityRules]);

  // Auto-sync dashboard data with Supabase upon authentication
  useEffect(() => {
    if (isAdminAuthenticated) {
      refreshDashboardData().catch(err => {
        console.warn('[Admin Dashboard] Initial sync note:', err);
      });
    }
  }, [isAdminAuthenticated, refreshDashboardData]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshDashboardData();
      notify('Dashboard synchronized with Supabase live database', 'success');
    } catch {
      notify('Sync completed with local state', 'info');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const res = await adminLogin(emailInput, passwordInput);
      if (!res.success) {
        setErrorMessage(res.error || 'Authentication failed. Please check your credentials.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to connect to authentication service.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const res = await requestPasswordReset(emailInput);
      if (res.success) {
        setResetSent(true);
      } else {
        setErrorMessage(res.error || 'Failed to send password reset email.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to send password reset request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveConsultationPricing = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPricing(true);
    try {
      const parsedBasePrice = Number(basePrice) || 499;
      const parsedGstPercent = Number(gstRate) || 18;
      const parsedDuration = Number(durationMinutes) || 30;

      await updateConsultationProduct({
        basePrice: parsedBasePrice,
        gstRate: parsedGstPercent / 100,
        durationMinutes: parsedDuration
      });
    } finally {
      setIsSavingPricing(false);
    }
  };

  const handleSaveAvailabilityRules = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingRules(true);
    try {
      await updateAvailabilityRules({
        workingDays,
        startTime,
        endTime,
        slotDurationMinutes: Number(slotDurationMinutes) || 30,
        bufferMinutes: Number(bufferMinutes) || 15,
        minNoticeHours: Number(minNoticeHours) || 4,
        maxAdvanceDays: Number(maxAdvanceDays) || 30,
        blockedDates
      });
    } finally {
      setIsSavingRules(false);
    }
  };

  const handleSaveSiteSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      adminEmail,
      notificationEmail,
      phoneContact,
      locationCity,
      razorpayTestMode,
      googleCalendarConnected,
      googleMeetEnabled,
      socialLinkedin,
      socialInstagram,
      socialYoutube,
      socialFacebook
    });
  };

  const toggleWorkingDay = (dayIndex: number) => {
    if (workingDays.includes(dayIndex)) {
      if (workingDays.length === 1) {
        notify('At least one working day must remain enabled', 'error');
        return;
      }
      setWorkingDays(workingDays.filter(d => d !== dayIndex));
    } else {
      setWorkingDays([...workingDays, dayIndex].sort((a, b) => a - b));
    }
  };

  const handleAddBlockedDate = () => {
    if (!newBlockedDate) return;
    if (blockedDates.includes(newBlockedDate)) {
      notify('Date is already marked as blocked', 'info');
      return;
    }
    setBlockedDates([...blockedDates, newBlockedDate].sort());
    setNewBlockedDate('');
  };

  const handleRemoveBlockedDate = (dateToRemove: string) => {
    setBlockedDates(blockedDates.filter(d => d !== dateToRemove));
  };

  const handleConfirmReschedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reschedulingBooking || !rescheduleDate || !rescheduleTime) {
      notify('Please select both a new date and time', 'error');
      return;
    }
    const success = rescheduleBooking(reschedulingBooking.id, rescheduleDate, rescheduleTime);
    if (success) {
      setReschedulingBooking(null);
      setRescheduleDate('');
      setRescheduleTime('');
    }
  };

  const handleConfirmCancel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingBooking) return;
    cancelBooking(cancellingBooking.id, cancelReason);
    setCancellingBooking(null);
    setCancelReason('');
  };

  const totalRevenue = bookings.reduce((sum, b) => (b.status !== 'cancelled' ? sum + b.totalAmount : sum), 0);

  // Filtered Bookings
  const filteredBookings = bookings.filter(b => {
    const q = (bookingSearch || '').toLowerCase().trim();
    const matchesSearch =
      q === '' ||
      (b.bookingCode || '').toLowerCase().includes(q) ||
      (b.customerName || '').toLowerCase().includes(q) ||
      (b.customerEmail || '').toLowerCase().includes(q) ||
      (b.customerPhone || '').toLowerCase().includes(q) ||
      (b.businessName || '').toLowerCase().includes(q) ||
      (b.date || '').toLowerCase().includes(q);

    const matchesStatus = bookingStatusFilter === 'all' || b.status === bookingStatusFilter;
    return matchesSearch && matchesStatus;
  });

  // Filtered Leads
  const filteredLeads = leads.filter(l => {
    const q = (leadSearch || '').toLowerCase().trim();
    const matchesSearch =
      q === '' ||
      (l.name || '').toLowerCase().includes(q) ||
      (l.email || '').toLowerCase().includes(q) ||
      ((l.phone || '').toLowerCase().includes(q)) ||
      ((l.interest || '').toLowerCase().includes(q)) ||
      ((l.notes || '').toLowerCase().includes(q));

    const matchesStatus = leadStatusFilter === 'all' || l.status === leadStatusFilter;
    const matchesSource = leadSourceFilter === 'all' || l.source === leadSourceFilter;
    return matchesSearch && matchesStatus && matchesSource;
  });

  // Filtered Contact Messages
  const filteredMessages = contactMessages.filter(m => {
    const q = (messageSearch || '').toLowerCase().trim();
    return (
      q === '' ||
      (m.name || '').toLowerCase().includes(q) ||
      (m.email || '').toLowerCase().includes(q) ||
      ((m.phone || '').toLowerCase().includes(q)) ||
      ((m.inquiryType || '').toLowerCase().includes(q)) ||
      ((m.message || '').toLowerCase().includes(q))
    );
  });

  // Filtered Subscribers
  const filteredSubscribers = subscribers.filter(s => {
    const q = (subscriberSearch || '').toLowerCase().trim();
    return (
      q === '' ||
      (s.email || '').toLowerCase().includes(q) ||
      ((s.name || '').toLowerCase().includes(q)) ||
      ((s.source || '').toLowerCase().includes(q))
    );
  });

  // Filtered Payments Ledger
  const filteredPayments = adminPayments.filter(p => {
    const q = (paymentSearch || '').toLowerCase().trim();
    const matchesSearch =
      q === '' ||
      (p.itemTitle || '').toLowerCase().includes(q) ||
      (p.razorpayOrderId || '').toLowerCase().includes(q) ||
      (p.razorpayPaymentId || '').toLowerCase().includes(q) ||
      (p.id || '').toLowerCase().includes(q) ||
      (p.userId || '').toLowerCase().includes(q);

    const matchesType = paymentTypeFilter === 'all' || p.itemType === paymentTypeFilter;
    const matchesStatus = paymentStatusFilter === 'all' || p.status === paymentStatusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  // Session verification loading state
  if (isAuthLoading) {
    return (
      <div id="admin-auth-loading" className="min-h-screen flex items-center justify-center px-4 py-24">
        <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col items-center gap-4 text-center">
          <Loader2 className="w-8 h-8 text-[#FF6B00] animate-spin" />
          <div className="space-y-1">
            <h3 className="text-base font-display font-semibold text-white">Validating Administrator Session</h3>
            <p className="text-xs text-slate-400">Connecting securely to Supabase Auth...</p>
          </div>
        </div>
      </div>
    );
  }

  // Unauthenticated Admin Login & Password Reset Screen
  if (!isAdminAuthenticated) {
    return (
      <div id="admin-login-root" className="min-h-screen flex items-center justify-center px-4 py-24">
        <div className="w-full max-w-md p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-[#FF6B00]/20 text-[#FF6B00] flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-display font-bold text-white">Digital Muid Admin</h1>
            <p className="text-xs text-slate-400">
              {authMode === 'login'
                ? 'Sign in with your administrator account to access CMS & Bookings.'
                : 'Enter your administrator email to receive password recovery instructions.'}
            </p>
          </div>

          {/* Feedback messages */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {resetSent && authMode === 'forgot_password' && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>Password reset link sent! Please check your email inbox to proceed.</span>
            </div>
          )}

          {/* Form switch */}
          {authMode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>Admin Email</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="admin@digitalmuid.in"
                  value={emailInput}
                  onChange={(e) => {
                    setEmailInput(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-[#FF6B00] transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                    <span>Password</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('forgot_password');
                      setErrorMessage(null);
                      setResetSent(false);
                    }}
                    className="text-[11px] text-[#1877F2] hover:text-[#60A5FA] transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-[#FF6B00] transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-xl bg-[#FF6B00] hover:bg-[#FF7A1A] disabled:opacity-60 text-white font-semibold text-sm transition-all shadow-lg shadow-[#FF6B00]/30 cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Authenticating with Supabase...</span>
                  </>
                ) : (
                  <span>Sign In to Console</span>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>Admin Email Address</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="admin@digitalmuid.in"
                  value={emailInput}
                  onChange={(e) => {
                    setEmailInput(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-[#FF6B00] transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-xl bg-[#1877F2] hover:bg-[#2563EB] disabled:opacity-60 text-white font-semibold text-sm transition-all shadow-lg shadow-[#1877F2]/30 cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending Instructions...</span>
                  </>
                ) : (
                  <span>Send Password Reset Link</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setErrorMessage(null);
                }}
                className="w-full py-2.5 text-xs text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Admin Login</span>
              </button>
            </form>
          )}

          {/* Security footnote */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-center gap-1.5 text-[11px] text-slate-500 font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Secured with Supabase Email Authentication</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="admin-dashboard-root" className="pt-24 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-slate-900 border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <h1 className="text-xl font-display font-bold text-white">Digital Muid Control Console</h1>
            {adminUser?.email && (
              <span className="ml-2 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono">
                {adminUser.email}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 font-interface">
            Manage Bookings, Revenue, Content Pipeline, Pricing, Availability, Inbound CRM, and Messages.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-semibold text-slate-200 cursor-pointer transition-colors flex items-center gap-1.5"
            title="Sync with Supabase live database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#FF6B00]' : ''}`} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync Live'}</span>
          </button>
          <button
            onClick={() => navigate('/')}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 cursor-pointer transition-colors"
          >
            View Live Site
          </button>
          <button
            onClick={adminLogout}
            className="px-3.5 py-1.5 rounded-xl bg-rose-950 hover:bg-rose-900 border border-rose-800 text-xs font-semibold text-rose-200 flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Admin Nav Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-slate-800">
        {[
          { id: 'overview', label: 'Overview', icon: TrendingUp },
          { id: 'payments', label: `Purchase History (${adminPayments.length})`, icon: CreditCard },
          { id: 'bookings', label: `Consultations (${bookings.length})`, icon: Calendar },
          { id: 'leads', label: `Leads & CRM (${leads.length})`, icon: Users },
          { id: 'messages', label: `Inquiries (${contactMessages.length})`, icon: MessageSquare },
          { id: 'subscribers', label: `Subscribers (${subscribers.length})`, icon: UserCheck },
          { id: 'pricing', label: 'Consultation Pricing', icon: DollarSign },
          { id: 'availability', label: 'Availability Rules', icon: CalendarDays },
          { id: 'settings', label: 'Site Settings', icon: SettingsIcon },
          { id: 'articles', label: `Articles (${articles.length})`, icon: FileText },
          { id: 'videos', label: `Videos (${videos.length})`, icon: VideoIcon },
          { id: 'frameworks', label: `Frameworks (${frameworks.length})`, icon: Layers },
          { id: 'courses', label: `Courses (${courses.length})`, icon: GraduationCap },
          { id: 'resources', label: `Resources (${resources.length})`, icon: Download }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleSelectTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#1877F2] text-white shadow-md shadow-[#1877F2]/30'
                  : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB: OVERVIEW */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Total Revenue</div>
              <div className="text-3xl font-display font-black text-white font-mono">₹{totalRevenue.toFixed(2)}</div>
              <div className="text-[11px] text-emerald-400 flex items-center gap-1 font-mono">
                <CheckCircle2 className="w-3.5 h-3.5" /> Live Supabase Bookings
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Booked Sessions</div>
              <div className="text-3xl font-display font-black text-white font-mono">{bookings.length}</div>
              <div className="text-[11px] text-[#FF6B00]">
                {bookings.filter((b) => b.status === 'confirmed').length} Active / Confirmed
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">CRM Leads</div>
              <div className="text-3xl font-display font-black text-white font-mono">{leads.length}</div>
              <div className="text-[11px] text-[#1877F2]">
                {leads.filter(l => l.status === 'New').length} New Uncontacted
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Newsletter & Messages</div>
              <div className="text-3xl font-display font-black text-white font-mono">{subscribers.length + contactMessages.length}</div>
              <div className="text-[11px] text-slate-400">
                {subscribers.length} Subs · {contactMessages.length} Messages
              </div>
            </div>
          </div>

          {/* Quick Summary Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Recent Bookings */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-white text-base">Recent Consultations</h3>
                <button
                  onClick={() => handleSelectTab('bookings')}
                  className="text-xs text-[#1877F2] hover:underline"
                >
                  View All ({bookings.length})
                </button>
              </div>

              {bookings.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">No consultation bookings recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {bookings.slice(0, 3).map((b) => (
                    <div
                      key={b.id}
                      className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-white">{b.customerName} ({b.businessName})</div>
                        <div className="text-slate-400 text-[11px]">{b.date} at {b.time} IST · Code: <span className="font-mono text-slate-300">{b.bookingCode}</span></div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-[#FF6B00]">₹{b.totalAmount}</div>
                        <span className={`text-[10px] px-2 py-0.5 rounded capitalize ${
                          b.status === 'confirmed'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : b.status === 'completed'
                            ? 'bg-blue-500/20 text-blue-300'
                            : b.status === 'rescheduled'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}>
                          {b.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Inbound Leads */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-white text-base">Inbound CRM Pipeline</h3>
                <button
                  onClick={() => handleSelectTab('leads')}
                  className="text-xs text-[#1877F2] hover:underline"
                >
                  View All ({leads.length})
                </button>
              </div>

              {leads.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">No CRM leads recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {leads.slice(0, 3).map((ld) => (
                    <div
                      key={ld.id}
                      className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-white">{ld.name}</div>
                        <div className="text-slate-400 text-[11px]">{ld.email} · <span className="text-[#1877F2]">{ld.source}</span></div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 capitalize">
                        {ld.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: PAYMENTS & PURCHASE HISTORY (CRM) */}
      {/* ========================================================================= */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#FF6B00]" />
                <h2 className="text-xl font-display font-bold text-white">Purchase History & Payment Ledger</h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Authoritative transaction ledger populated from <span className="font-mono text-slate-300">public.payments</span> across courses and consultations.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fetchAdminPayments()}
                disabled={isAdminPaymentsLoading}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isAdminPaymentsLoading ? 'animate-spin text-[#FF6B00]' : ''}`} />
                <span>Refresh Ledger</span>
              </button>
              <span className="text-xs text-slate-400 font-mono">
                {filteredPayments.length} of {adminPayments.length} records
              </span>
            </div>
          </div>

          {/* Metrics summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(() => {
              const totalRevenue = adminPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
              const courseRevenue = adminPayments
                .filter((p) => p.itemType === 'course')
                .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
              const consultationRevenue = adminPayments
                .filter((p) => p.itemType === 'consultation')
                .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
              return (
                <>
                  <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Captured Volume</div>
                    <div className="text-2xl font-mono font-bold text-[#FF6B00]">₹{totalRevenue.toLocaleString('en-IN')}</div>
                    <div className="text-[11px] text-slate-500 font-interface">{adminPayments.length} verified transactions</div>
                  </div>
                  <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <GraduationCap className="w-3.5 h-3.5 text-blue-400" />
                      <span>Course Purchases</span>
                    </div>
                    <div className="text-2xl font-mono font-bold text-white">₹{courseRevenue.toLocaleString('en-IN')}</div>
                    <div className="text-[11px] text-slate-500 font-interface">
                      {adminPayments.filter((p) => p.itemType === 'course').length} enrollments
                    </div>
                  </div>
                  <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-amber-400" />
                      <span>Consultation Purchases</span>
                    </div>
                    <div className="text-2xl font-mono font-bold text-white">₹{consultationRevenue.toLocaleString('en-IN')}</div>
                    <div className="text-[11px] text-slate-500 font-interface">
                      {adminPayments.filter((p) => p.itemType === 'consultation').length} advisory sessions
                    </div>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Filter Bar */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by title, Razorpay ID, order ID..."
                value={paymentSearch}
                onChange={(e) => setPaymentSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#FF6B00]"
              />
            </div>

            {/* Type Filter Buttons */}
            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
              <span className="text-xs text-slate-400 font-medium whitespace-nowrap">Category:</span>
              {[
                { id: 'all', label: `All (${adminPayments.length})` },
                { id: 'course', label: `Courses (${adminPayments.filter((p) => p.itemType === 'course').length})` },
                { id: 'consultation', label: `Consultations (${adminPayments.filter((p) => p.itemType === 'consultation').length})` }
              ].map((filterTab) => (
                <button
                  key={filterTab.id}
                  type="button"
                  onClick={() => setPaymentTypeFilter(filterTab.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    paymentTypeFilter === filterTab.id
                      ? 'bg-[#FF6B00] text-white shadow-sm'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {filterTab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Payments Table */}
          {isAdminPaymentsLoading && adminPayments.length === 0 ? (
            <div className="p-16 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-[#FF6B00] animate-spin" />
              <p className="text-sm text-slate-400">Loading purchase history from database...</p>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="p-16 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-3">
              <Receipt className="w-10 h-10 text-slate-600 mx-auto" />
              <h3 className="text-base font-display font-bold text-white">No Payment Records Found</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {paymentSearch || paymentTypeFilter !== 'all'
                  ? 'No transaction records match the current filters. Try resetting the search or filter.'
                  : 'Verified transactions from Razorpay checkout will automatically populate in this ledger.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4 font-semibold">Date & Time</th>
                    <th className="py-3.5 px-4 font-semibold">Type</th>
                    <th className="py-3.5 px-4 font-semibold">Item / Service Title</th>
                    <th className="py-3.5 px-4 font-semibold">Amount</th>
                    <th className="py-3.5 px-4 font-semibold">Razorpay Payment ID</th>
                    <th className="py-3.5 px-4 font-semibold">Razorpay Order ID</th>
                    <th className="py-3.5 px-4 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {filteredPayments.map((p) => {
                    const isConsultation = p.itemType === 'consultation';
                    const formattedDate = p.createdAt
                      ? new Date(p.createdAt).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : '—';

                    return (
                      <tr key={p.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="py-3.5 px-4 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                          {formattedDate}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {isConsultation ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-bold uppercase tracking-wider">
                              <Calendar className="w-3 h-3" />
                              <span>Consultation</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[10px] font-bold uppercase tracking-wider">
                              <GraduationCap className="w-3 h-3" />
                              <span>Course</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-white max-w-xs truncate" title={p.itemTitle}>
                          {p.itemTitle}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap font-mono font-bold text-[#FF6B00]">
                          ₹{Number(p.amount).toLocaleString('en-IN')} {p.currency}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap font-mono text-slate-300 text-[11px]">
                          {p.razorpayPaymentId || '—'}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap font-mono text-slate-400 text-[11px]">
                          {p.razorpayOrderId || '—'}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium capitalize ${
                            p.status === 'captured' || p.status === 'paid'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          }`}>
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{p.status}</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: BOOKINGS & CONSULTATIONS */}
      {/* ========================================================================= */}
      {activeTab === 'bookings' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-display font-bold text-white">Consultation Bookings & Schedules</h2>
              <p className="text-xs text-slate-400">Manage client strategy sessions, live status, rescheduling, and cancellations.</p>
            </div>
            <span className="text-xs text-slate-400 font-mono">{filteredBookings.length} / {bookings.length} Records</span>
          </div>

          {/* Search & Filters */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by client, email, code, business..."
                value={bookingSearch}
                onChange={(e) => setBookingSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#FF6B00]"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
              <span className="text-xs text-slate-400 font-medium whitespace-nowrap">Status:</span>
              {(['all', 'confirmed', 'completed', 'rescheduled', 'cancelled'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setBookingStatusFilter(status)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition-colors ${
                    bookingStatusFilter === status
                      ? 'bg-[#1877F2] text-white'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Bookings Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-4">Ref Code</th>
                  <th className="p-4">Client</th>
                  <th className="p-4">Schedule</th>
                  <th className="p-4">Challenge / Notes</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {filteredBookings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      No bookings match your search and filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredBookings.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-850 transition-colors">
                      <td className="p-4 font-mono font-bold text-[#FF6B00]">{b.bookingCode}</td>
                      <td className="p-4">
                        <div className="font-bold text-white">{b.customerName}</div>
                        <div className="text-slate-400 text-[11px]">{b.businessName}</div>
                        <div className="text-slate-400 text-[10px]">{b.customerEmail} · {b.customerPhone}</div>
                      </td>
                      <td className="p-4">
                        <div className="text-white font-medium">{b.date}</div>
                        <div className="text-slate-400 font-mono text-[11px]">{b.time} IST</div>
                      </td>
                      <td className="p-4 max-w-xs">
                        <p className="line-clamp-2 text-slate-300">{b.primaryChallenge || b.notes || 'Strategic consultation'}</p>
                      </td>
                      <td className="p-4 font-mono">
                        <div className="font-bold text-white">₹{b.totalAmount}</div>
                        <div className="text-[10px] text-slate-400">Base ₹{b.baseAmount ?? 499} + GST</div>
                      </td>
                      <td className="p-4">
                        <select
                          value={b.status}
                          onChange={(e) => updateBookingStatus(b.id, e.target.value as any)}
                          className="px-2 py-1 rounded bg-slate-950 border border-slate-700 text-[11px] text-white focus:outline-none"
                        >
                          <option value="confirmed">Confirmed</option>
                          <option value="completed">Completed</option>
                          <option value="rescheduled">Rescheduled</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setReschedulingBooking(b);
                              setRescheduleDate(b.date);
                              setRescheduleTime(b.time);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 transition-colors"
                          >
                            Reschedule
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCancellingBooking(b);
                              setCancelReason('');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800 text-[11px] font-semibold text-rose-300 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Delete booking record ${b.bookingCode} for ${b.customerName}?`)) {
                                deleteBooking(b.id);
                              }
                            }}
                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
                            title="Delete booking"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reschedule Booking Modal */}
      {reschedulingBooking && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-display font-bold text-white">Reschedule Consultation</h3>
              <button
                onClick={() => setReschedulingBooking(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
              <div className="font-bold text-white">{reschedulingBooking.customerName} ({reschedulingBooking.bookingCode})</div>
              <div className="text-slate-400">Currently scheduled: {reschedulingBooking.date} at {reschedulingBooking.time} IST</div>
            </div>

            <form onSubmit={handleConfirmReschedule} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-300 mb-1 block">New Booking Date</label>
                <input
                  type="date"
                  required
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-300 mb-1 block">New Slot Time (IST)</label>
                <input
                  type="time"
                  required
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setReschedulingBooking(null)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#1877F2] hover:bg-[#2563EB] text-white font-semibold shadow-lg"
                >
                  Confirm Reschedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Booking Modal */}
      {cancellingBooking && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-display font-bold text-white">Cancel Consultation Session</h3>
              <button
                onClick={() => setCancellingBooking(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              Are you sure you want to mark booking <strong>{cancellingBooking.bookingCode}</strong> for <strong>{cancellingBooking.customerName}</strong> as cancelled?
            </div>

            <form onSubmit={handleConfirmCancel} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-300 mb-1 block">Cancellation Reason (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g., Client requested postponement, duplicate booking"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCancellingBooking(null)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-lg"
                >
                  Confirm Cancellation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: LEADS & CRM */}
      {/* ========================================================================= */}
      {activeTab === 'leads' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-display font-bold text-white">Inbound Lead Pipeline (CRM)</h2>
              <p className="text-xs text-slate-400">Track and qualify inquiries across contact forms, downloads, courses, and consult briefs.</p>
            </div>
            <span className="text-xs text-slate-400 font-mono">{filteredLeads.length} / {leads.length} Active Leads</span>
          </div>

          {/* Search & Filters */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by name, email, interest, notes..."
                value={leadSearch}
                onChange={(e) => setLeadSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#FF6B00]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">Status:</span>
                <select
                  value={leadStatusFilter}
                  onChange={(e) => setLeadStatusFilter(e.target.value as any)}
                  className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="New">New</option>
                  <option value="Contacted">Contacted</option>
                  <option value="Qualified">Qualified</option>
                  <option value="Converted">Converted</option>
                  <option value="Lost">Lost</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">Source:</span>
                <select
                  value={leadSourceFilter}
                  onChange={(e) => setLeadSourceFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none"
                >
                  <option value="all">All Sources</option>
                  <option value="Contact Form">Contact Form</option>
                  <option value="Newsletter">Newsletter</option>
                  <option value="Resource Download">Resource Download</option>
                  <option value="Consultation Intake Brief">Consultation Intake Brief</option>
                  <option value="Course Enquiry">Course Enquiry</option>
                  <option value="Speaking Enquiry">Speaking Enquiry</option>
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-4">Lead Name</th>
                  <th className="p-4">Email / Phone</th>
                  <th className="p-4">Source</th>
                  <th className="p-4">Interest / Context</th>
                  <th className="p-4">Date Added</th>
                  <th className="p-4">Status & Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      No leads match your filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((ld) => (
                    <tr key={ld.id} className="hover:bg-slate-850 transition-colors">
                      <td className="p-4 font-bold text-white">{ld.name}</td>
                      <td className="p-4">
                        <div>{ld.email}</div>
                        {ld.phone && <div className="text-slate-400 text-[10px]">{ld.phone}</div>}
                      </td>
                      <td className="p-4 font-semibold text-[#1877F2]">{ld.source}</td>
                      <td className="p-4 max-w-xs text-slate-300">
                        <div className="font-medium text-white">{ld.interest}</div>
                        {ld.notes && <div className="text-[11px] text-slate-400 line-clamp-2">{ld.notes}</div>}
                      </td>
                      <td className="p-4 text-slate-400">{ld.createdAt}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <select
                            value={ld.status}
                            onChange={(e) => updateLeadStatus(ld.id, e.target.value as any)}
                            className="px-2 py-1 rounded bg-slate-950 border border-slate-700 text-[11px] text-white focus:outline-none"
                          >
                            <option value="New">New</option>
                            <option value="Contacted">Contacted</option>
                            <option value="Qualified">Qualified</option>
                            <option value="Converted">Converted</option>
                            <option value="Lost">Lost</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Delete lead record for ${ld.name}?`)) {
                                deleteLead(ld.id);
                              }
                            }}
                            className="p-1 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
                            title="Delete Lead"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: CONTACT MESSAGES */}
      {/* ========================================================================= */}
      {activeTab === 'messages' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-display font-bold text-white">Contact Form Inquiries</h2>
              <p className="text-xs text-slate-400">Direct inbound messages submitted via the /contact page.</p>
            </div>
            <span className="text-xs text-slate-400 font-mono">{filteredMessages.length} / {contactMessages.length} Messages</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search messages by sender, email, inquiry..."
                value={messageSearch}
                onChange={(e) => setMessageSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#FF6B00]"
              />
            </div>
          </div>

          <div className="space-y-4">
            {filteredMessages.length === 0 ? (
              <div className="p-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl">
                No contact inquiries match your search.
              </div>
            ) : (
              filteredMessages.map((msg) => (
                <div
                  key={msg.id}
                  className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 hover:border-slate-700 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <div>
                      <div className="text-sm font-bold text-white flex items-center gap-2">
                        <span>{msg.name}</span>
                        <span className="px-2.5 py-0.5 rounded-full bg-[#1877F2]/20 border border-[#1877F2]/30 text-[#60A5FA] text-[10px] font-mono">
                          {msg.inquiryType}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 font-mono">
                        {msg.email} {msg.phone && `· ${msg.phone}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-slate-500 font-mono">{msg.createdAt}</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Delete inquiry message from ${msg.name}?`)) {
                            deleteContactMessage(msg.id);
                          }
                        }}
                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
                        title="Delete Message"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: NEWSLETTER SUBSCRIBERS */}
      {/* ========================================================================= */}
      {activeTab === 'subscribers' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-display font-bold text-white">The Digital Muid Brief Subscribers</h2>
              <p className="text-xs text-slate-400">Weekly strategic newsletter readership captured from website touchpoints.</p>
            </div>
            <span className="text-xs text-slate-400 font-mono">{filteredSubscribers.length} / {subscribers.length} Subscribers</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search subscribers by email or name..."
                value={subscriberSearch}
                onChange={(e) => setSubscriberSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#FF6B00]"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-4">Email Address</th>
                  <th className="p-4">Subscriber Name</th>
                  <th className="p-4">Acquisition Source</th>
                  <th className="p-4">Date Subscribed</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {filteredSubscribers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      No newsletter subscribers match your search.
                    </td>
                  </tr>
                ) : (
                  filteredSubscribers.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-850 transition-colors">
                      <td className="p-4 font-mono font-bold text-white">{sub.email}</td>
                      <td className="p-4 text-slate-300">{sub.name || '—'}</td>
                      <td className="p-4 text-[#1877F2] font-semibold">{sub.source}</td>
                      <td className="p-4 text-slate-400">{sub.subscribedAt}</td>
                      <td className="p-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Unsubscribe and remove ${sub.email}?`)) {
                              deleteSubscriber(sub.id);
                            }
                          }}
                          className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
                          title="Remove subscriber"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: CONSULTATION PRICING */}
      {/* ========================================================================= */}
      {activeTab === 'pricing' && (
        <div className="max-w-3xl space-y-8">
          <div className="space-y-1">
            <h2 className="text-xl font-display font-bold text-white">Consultation Product & Pricing Configuration</h2>
            <p className="text-xs text-slate-400">
              Control the live base consultation rate, GST compliance, and session duration in Supabase.
            </p>
          </div>

          <form onSubmit={handleSaveConsultationPricing} className="p-8 rounded-3xl bg-slate-900 border border-slate-800 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-semibold text-slate-300">Base Price (INR) *</label>
                <input
                  type="number"
                  required
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                  className="w-full mt-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-[#FF6B00]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">GST Rate (%) *</label>
                <input
                  type="number"
                  required
                  value={gstRate}
                  onChange={(e) => setGstRate(e.target.value)}
                  className="w-full mt-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-[#FF6B00]"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300">Session Duration (Minutes) *</label>
              <input
                type="number"
                required
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className="w-full mt-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-[#FF6B00]"
              />
            </div>

            {/* Calculated Breakdown Preview */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
              <div className="font-semibold text-slate-300">Live Client Price Breakdown:</div>
              <div className="text-slate-400 flex flex-wrap items-center gap-2">
                <span>Base Rate: ₹{Number(basePrice) || 0}</span>
                <span>+</span>
                <span>GST ({gstRate}%): ₹{((Number(basePrice) || 0) * (Number(gstRate) || 18) / 100).toFixed(2)}</span>
                <span>=</span>
                <span className="font-bold text-[#FF6B00] font-mono text-sm">
                  ₹{((Number(basePrice) || 0) * (1 + (Number(gstRate) || 18) / 100)).toFixed(2)} INR Total
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSavingPricing}
              className="w-full py-3.5 rounded-xl bg-[#FF6B00] hover:bg-[#FF7A1A] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all shadow-lg shadow-[#FF6B00]/30 cursor-pointer flex items-center justify-center gap-2"
            >
              {isSavingPricing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving Consultation Pricing to Supabase...</span>
                </>
              ) : (
                'Save Consultation Pricing to Supabase'
              )}
            </button>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: AVAILABILITY RULES */}
      {/* ========================================================================= */}
      {activeTab === 'availability' && (
        <div className="max-w-3xl space-y-8">
          <div className="space-y-1">
            <h2 className="text-xl font-display font-bold text-white">Consultation Availability & Booking Rules</h2>
            <p className="text-xs text-slate-400">
              Configure working days, operational hours, session buffers, advance booking notice, and holiday blockouts.
            </p>
          </div>

          {isAvailabilityLoading ? (
            <div className="p-12 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center space-y-4">
              <Loader2 className="w-8 h-8 text-[#1877F2] animate-spin" />
              <p className="text-sm text-slate-400 font-medium">Loading live Supabase availability rules...</p>
            </div>
          ) : (
            <form onSubmit={handleSaveAvailabilityRules} className="p-8 rounded-3xl bg-slate-900 border border-slate-800 space-y-6">
            {/* Working Days Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">Active Working Days</label>
              <div className="grid grid-cols-7 gap-2">
                {[
                  { index: 0, label: 'Sun' },
                  { index: 1, label: 'Mon' },
                  { index: 2, label: 'Tue' },
                  { index: 3, label: 'Wed' },
                  { index: 4, label: 'Thu' },
                  { index: 5, label: 'Fri' },
                  { index: 6, label: 'Sat' }
                ].map((d) => {
                  const isSelected = workingDays.includes(d.index);
                  return (
                    <button
                      key={d.index}
                      type="button"
                      onClick={() => toggleWorkingDay(d.index)}
                      className={`py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#1877F2] text-white shadow-md shadow-[#1877F2]/30'
                          : 'bg-slate-950 text-slate-500 border border-slate-800 hover:text-slate-300'
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Operating Hours */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-semibold text-slate-300">Start Time (IST)</label>
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full mt-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-[#FF6B00]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">End Time (IST)</label>
                <input
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full mt-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-[#FF6B00]"
                />
              </div>
            </div>

            {/* Durations & Buffers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-semibold text-slate-300">Slot Duration (Minutes)</label>
                <input
                  type="number"
                  required
                  value={slotDurationMinutes}
                  onChange={(e) => setSlotDurationMinutes(e.target.value)}
                  className="w-full mt-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-[#FF6B00]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Buffer Between Sessions (Minutes)</label>
                <input
                  type="number"
                  required
                  value={bufferMinutes}
                  onChange={(e) => setBufferMinutes(e.target.value)}
                  className="w-full mt-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-[#FF6B00]"
                />
              </div>
            </div>

            {/* Notice & Advance Booking */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-semibold text-slate-300">Minimum Notice (Hours)</label>
                <input
                  type="number"
                  required
                  value={minNoticeHours}
                  onChange={(e) => setMinNoticeHours(e.target.value)}
                  className="w-full mt-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-[#FF6B00]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Maximum Advance Booking (Days)</label>
                <input
                  type="number"
                  required
                  value={maxAdvanceDays}
                  onChange={(e) => setMaxAdvanceDays(e.target.value)}
                  className="w-full mt-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-[#FF6B00]"
                />
              </div>
            </div>

            {/* Blocked Dates Manager */}
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <label className="text-xs font-semibold text-slate-300">Blocked Holiday & Out-of-Office Dates</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={newBlockedDate}
                  onChange={(e) => setNewBlockedDate(e.target.value)}
                  className="flex-1 px-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddBlockedDate}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
                >
                  Block Date
                </button>
              </div>

              {blockedDates.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {blockedDates.map((d) => (
                    <span
                      key={d}
                      className="px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 font-mono text-xs flex items-center gap-2"
                    >
                      <span>{d}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveBlockedDate(d)}
                        className="text-slate-500 hover:text-rose-400"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSavingRules}
              className="w-full py-3.5 rounded-xl bg-[#1877F2] hover:bg-[#2563EB] disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold text-sm transition-all shadow-lg shadow-[#1877F2]/30 cursor-pointer flex items-center justify-center gap-2"
            >
              {isSavingRules ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Availability Rules...</span>
                </>
              ) : (
                'Save Availability Rules to Supabase'
              )}
            </button>
          </form>
        )}
      </div>
    )}

      {/* ========================================================================= */}
      {/* TAB: SITE SETTINGS */}
      {/* ========================================================================= */}
      {activeTab === 'settings' && (
        <div className="max-w-3xl space-y-8">
          <div className="space-y-1">
            <h2 className="text-xl font-display font-bold text-white">Platform & Site Settings</h2>
            <p className="text-xs text-slate-400">
              Manage live administrator email, phone contacts, location info, and payment gateway environments.
            </p>
          </div>

          <form onSubmit={handleSaveSiteSettings} className="p-8 rounded-3xl bg-slate-900 border border-slate-800 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-semibold text-slate-300">Admin Email</label>
                <input
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full mt-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-[#FF6B00]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Notification Routing Email</label>
                <input
                  type="email"
                  required
                  value={notificationEmail}
                  onChange={(e) => setNotificationEmail(e.target.value)}
                  className="w-full mt-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-[#FF6B00]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-semibold text-slate-300">Contact Phone</label>
                <input
                  type="text"
                  required
                  value={phoneContact}
                  onChange={(e) => setPhoneContact(e.target.value)}
                  className="w-full mt-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-[#FF6B00]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Office / City Location</label>
                <input
                  type="text"
                  required
                  value={locationCity}
                  onChange={(e) => setLocationCity(e.target.value)}
                  className="w-full mt-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-[#FF6B00]"
                />
              </div>
            </div>

            {/* Gateway & Integrations Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between space-y-2">
                <span className="text-xs font-semibold text-slate-300">Payment Mode</span>
                <button
                  type="button"
                  onClick={() => setRazorpayTestMode(!razorpayTestMode)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    razorpayTestMode
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {razorpayTestMode ? 'Test Mode' : 'Production'}
                </button>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between space-y-2">
                <span className="text-xs font-semibold text-slate-300">Google Calendar</span>
                <button
                  type="button"
                  onClick={() => setGoogleCalendarConnected(!googleCalendarConnected)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    googleCalendarConnected
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {googleCalendarConnected ? 'Connected' : 'Disconnected'}
                </button>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between space-y-2">
                <span className="text-xs font-semibold text-slate-300">Google Meet</span>
                <button
                  type="button"
                  onClick={() => setGoogleMeetEnabled(!googleMeetEnabled)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    googleMeetEnabled
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {googleMeetEnabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            </div>

            {/* Social Links */}
            <div className="space-y-3 pt-2">
              <label className="text-xs font-semibold text-slate-300">Social Media & Public Profiles</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  type="url"
                  placeholder="LinkedIn URL"
                  value={socialLinkedin}
                  onChange={(e) => setSocialLinkedin(e.target.value)}
                  className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
                />
                <input
                  type="url"
                  placeholder="Instagram URL"
                  value={socialInstagram}
                  onChange={(e) => setSocialInstagram(e.target.value)}
                  className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
                />
                <input
                  type="url"
                  placeholder="YouTube URL"
                  value={socialYoutube}
                  onChange={(e) => setSocialYoutube(e.target.value)}
                  className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
                />
                <input
                  type="url"
                  placeholder="Facebook URL"
                  value={socialFacebook}
                  onChange={(e) => setSocialFacebook(e.target.value)}
                  className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-[#1877F2] hover:bg-[#2563EB] text-white font-semibold text-sm transition-all shadow-lg cursor-pointer"
            >
              Save Site Settings to Supabase
            </button>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: ARTICLES CMS */}
      {/* ========================================================================= */}
      {activeTab === 'articles' && (
        <div className="space-y-6">
          {/* Top Header & Quick Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#1877F2]" />
                <span>Articles & Insights CMS</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Author, schedule, and manage long-form strategic essays synchronized with Supabase database.
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                onClick={async () => {
                  setIsRefreshing(true);
                  try {
                    await refreshArticles();
                    notify('Articles synchronized with Supabase live database', 'success');
                  } catch {
                    notify('Sync completed with local state', 'info');
                  } finally {
                    setIsRefreshing(false);
                  }
                }}
                disabled={isRefreshing}
                className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                title="Sync articles from database"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#1877F2]' : ''}`} />
                <span>Sync</span>
              </button>
              <button
                onClick={openNewArticleModal}
                className="px-4 py-2 rounded-xl bg-[#1877F2] hover:bg-[#2563EB] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-[#1877F2]/20 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Add New Article</span>
              </button>
            </div>
          </div>

          {/* Statistical Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Total Articles</p>
                <p className="text-xl font-bold text-white mt-0.5">{articles.length}</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-slate-800/80 flex items-center justify-center text-slate-400">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Published</p>
                <p className="text-xl font-bold text-emerald-400 mt-0.5">
                  {articles.filter(a => a.status === 'published').length}
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <Eye className="w-4 h-4" />
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Drafts</p>
                <p className="text-xl font-bold text-amber-400 mt-0.5">
                  {articles.filter(a => a.status === 'draft').length}
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                <EyeOff className="w-4 h-4" />
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Featured</p>
                <p className="text-xl font-bold text-[#1877F2] mt-0.5">
                  {articles.filter(a => Boolean(a.isFeatured ?? a.featured)).length}
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-[#1877F2]/10 flex items-center justify-center text-[#1877F2]">
                <Star className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Search, Category, & Status Filters */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search articles by title, excerpt, slug, category, or content..."
                value={articleSearch}
                onChange={(e) => setArticleSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-[#1877F2]"
              />
              {articleSearch && (
                <button
                  onClick={() => setArticleSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Category Filter */}
              <select
                value={articleCategoryFilter}
                onChange={(e) => setArticleCategoryFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-300 text-xs focus:outline-none focus:border-[#1877F2]"
              >
                <option value="all">All Categories</option>
                {Array.from(new Set(articles.map(a => a.category).filter(Boolean))).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              {/* Status Filter */}
              <div className="flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                {(['all', 'published', 'draft', 'archived'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setArticleStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-lg capitalize text-xs font-medium transition-colors ${
                      articleStatusFilter === st
                        ? 'bg-[#1877F2] text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                <button
                  onClick={() => setArticleViewMode('table')}
                  className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                    articleViewMode === 'table' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Table view"
                >
                  Table
                </button>
                <button
                  onClick={() => setArticleViewMode('grid')}
                  className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                    articleViewMode === 'grid' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Grid view"
                >
                  Cards
                </button>
              </div>
            </div>
          </div>

          {/* Filtered Articles List */}
          {(() => {
            const filteredArticles = articles.filter(art => {
              const query = articleSearch.toLowerCase().trim();
              const matchesSearch = !query || (
                (art.title && art.title.toLowerCase().includes(query)) ||
                (art.slug && art.slug.toLowerCase().includes(query)) ||
                (art.excerpt && art.excerpt.toLowerCase().includes(query)) ||
                (art.content && art.content.toLowerCase().includes(query)) ||
                (art.category && art.category.toLowerCase().includes(query))
              );

              const matchesStatus = articleStatusFilter === 'all' || art.status === articleStatusFilter;
              const matchesCategory = articleCategoryFilter === 'all' || art.category === articleCategoryFilter;

              return matchesSearch && matchesStatus && matchesCategory;
            });

            if (filteredArticles.length === 0) {
              return (
                <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800/80 text-slate-400 mx-auto flex items-center justify-center">
                    <FileText className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-white">No articles found</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    {articleSearch || articleStatusFilter !== 'all' || articleCategoryFilter !== 'all'
                      ? 'No articles match your active filter criteria. Try adjusting the search term or filters.'
                      : 'No articles exist in the CMS yet. Click "Create New Article" to author your first piece.'}
                  </p>
                  <button
                    onClick={openNewArticleModal}
                    className="px-4 py-2 rounded-xl bg-[#1877F2] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add New Article</span>
                  </button>
                </div>
              );
            }

            if (articleViewMode === 'table') {
              return (
                <div className="rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold">
                          <th className="py-3.5 px-4">Article</th>
                          <th className="py-3.5 px-4">Category</th>
                          <th className="py-3.5 px-4">Status</th>
                          <th className="py-3.5 px-4">Reading Time</th>
                          <th className="py-3.5 px-4">Published Date</th>
                          <th className="py-3.5 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {filteredArticles.map((art) => {
                          const isFeatured = Boolean(art.isFeatured ?? art.featured);
                          const authorName = typeof art.author === 'string' ? art.author : art.author?.name || 'Digital Muid';
                          const authorAvatar = typeof art.author === 'object' && art.author?.avatar ? art.author.avatar : null;
                          const readingMin = art.readingTimeMinutes || parseInt(art.readTime || '5', 10) || 5;

                          return (
                            <tr key={art.id} className="hover:bg-slate-800/40 transition-colors group">
                              <td className="py-4 px-4">
                                <div className="flex items-start gap-3">
                                  {art.featuredImage ? (
                                    <img
                                      src={art.featuredImage}
                                      alt={art.title}
                                      className="w-12 h-12 rounded-lg object-cover flex-shrink-0 bg-slate-800 border border-slate-700/60"
                                      referrerPolicy="no-referrer"
                                    />
                                  ) : (
                                    <div className="w-12 h-12 rounded-lg bg-slate-800 flex-shrink-0 flex items-center justify-center text-slate-500 border border-slate-700/60">
                                      <ImageIcon className="w-5 h-5" />
                                    </div>
                                  )}
                                  <div className="space-y-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-sm font-semibold text-white group-hover:text-[#1877F2] transition-colors line-clamp-1">
                                        {art.title}
                                      </span>
                                      {isFeatured && (
                                        <span className="px-2 py-0.5 rounded-md bg-[#1877F2]/15 text-[#1877F2] text-[10px] font-bold uppercase tracking-wider border border-[#1877F2]/30 flex items-center gap-1">
                                          <Star className="w-2.5 h-2.5 fill-current" />
                                          Featured
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-slate-400 font-mono line-clamp-1">
                                      /insights/{art.slug}
                                    </p>
                                    <p className="text-xs text-slate-400 line-clamp-1">
                                      {art.excerpt}
                                    </p>
                                  </div>
                                </div>
                              </td>

                              <td className="py-4 px-4 whitespace-nowrap">
                                <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 text-[11px] font-medium border border-slate-700">
                                  {art.category || 'Digital Growth'}
                                </span>
                              </td>

                              <td className="py-4 px-4 whitespace-nowrap">
                                {art.status === 'published' ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                    Published
                                  </span>
                                ) : art.status === 'draft' ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[11px] font-semibold">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                                    Draft
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[11px] font-semibold">
                                    Archived
                                  </span>
                                )}
                              </td>

                              <td className="py-4 px-4 whitespace-nowrap text-slate-300">
                                <div className="flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                                  <span>{readingMin} min read</span>
                                </div>
                              </td>

                              <td className="py-4 px-4 whitespace-nowrap text-slate-400">
                                {art.publishedAt || '—'}
                              </td>

                              <td className="py-4 px-4 whitespace-nowrap text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {/* Toggle Publish / Draft */}
                                  <button
                                    onClick={() => handleTogglePublish(art)}
                                    className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                      art.status === 'published'
                                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                                    }`}
                                    title={art.status === 'published' ? 'Switch to Draft' : 'Publish Article'}
                                  >
                                    {art.status === 'published' ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                  </button>

                                  {/* Toggle Featured */}
                                  <button
                                    onClick={() => handleToggleFeatured(art)}
                                    className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                      isFeatured
                                        ? 'bg-[#1877F2]/20 border-[#1877F2]/40 text-[#1877F2]'
                                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                                    }`}
                                    title={isFeatured ? 'Remove from Featured' : 'Mark as Featured'}
                                  >
                                    <Star className={`w-3.5 h-3.5 ${isFeatured ? 'fill-current' : ''}`} />
                                  </button>

                                  {/* Preview live */}
                                  <button
                                    onClick={() => navigate(`/insights/${art.slug}`)}
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                                    title="View public preview"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Edit Article */}
                                  <button
                                    onClick={() => openEditArticleModal(art)}
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                                    title="Edit Article"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Delete Article */}
                                  <button
                                    onClick={() => setDeletingArticleId(art.id)}
                                    className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors cursor-pointer"
                                    title="Delete Article"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            }

            // Grid View
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredArticles.map((art) => {
                  const isFeatured = Boolean(art.isFeatured ?? art.featured);
                  const readingMin = art.readingTimeMinutes || parseInt(art.readTime || '5', 10) || 5;

                  return (
                    <div
                      key={art.id}
                      className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-4 hover:border-slate-700 transition-all shadow-md group"
                    >
                      <div className="space-y-3">
                        {art.featuredImage && (
                          <div className="relative rounded-xl overflow-hidden aspect-video bg-slate-800 border border-slate-800">
                            <img
                              src={art.featuredImage}
                              alt={art.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              referrerPolicy="no-referrer"
                            />
                            {isFeatured && (
                              <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-[#1877F2] text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-md">
                                <Star className="w-2.5 h-2.5 fill-current" />
                                Featured
                              </span>
                            )}
                          </div>
                        )}

                        <div className="flex items-center justify-between text-xs">
                          <span className="px-2.5 py-0.5 rounded-md bg-[#1877F2]/10 text-[#1877F2] font-semibold border border-[#1877F2]/20">
                            {art.category}
                          </span>
                          {art.status === 'published' ? (
                            <span className="text-emerald-400 font-medium flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                              Published
                            </span>
                          ) : (
                            <span className="text-amber-400 font-medium flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                              Draft
                            </span>
                          )}
                        </div>

                        <h3 className="text-base font-display font-bold text-white group-hover:text-[#1877F2] transition-colors line-clamp-2">
                          {art.title}
                        </h3>

                        <p className="text-xs text-slate-400 line-clamp-2">
                          {art.excerpt}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span>{readingMin} min</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => navigate(`/insights/${art.slug}`)}
                            className="text-slate-300 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs transition-colors"
                          >
                            Preview
                          </button>
                          <button
                            onClick={() => openEditArticleModal(art)}
                            className="text-[#1877F2] hover:text-[#2563EB] p-1"
                            title="Edit Article"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeletingArticleId(art.id)}
                            className="text-rose-400 hover:text-rose-300 p-1"
                            title="Delete Article"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ARTICLE EDITOR MODAL (SUPABASE WRITE-THROUGH CMS) */}
      {/* ========================================================================= */}
      <ArticleEditorModal
        isOpen={isArticleModalOpen}
        initialArticle={selectedArticleForEdit}
        onClose={() => {
          setIsArticleModalOpen(false);
          setSelectedArticleForEdit(null);
        }}
        onSave={handleSaveArticleModal}
        onUnpublish={handleUnpublishArticleModal}
        isSaving={isSavingArticle}
      />

      {/* ========================================================================= */}
      {/* DELETE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {deletingArticleId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-5 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-white">Delete this article?</h3>
              <p className="text-xs text-slate-400">
                This will remove the article from the live database and archive its public slug. This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setDeletingArticleId(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const id = deletingArticleId;
                  setDeletingArticleId(null);
                  if (id) {
                    await deleteArticle(id);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-rose-500/20"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: VIDEOS CMS */}
      {/* ========================================================================= */}
      {activeTab === 'videos' && (
        <div className="space-y-6">
          {/* Top Header & Quick Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
                <VideoIcon className="w-5 h-5 text-purple-400" />
                <span>Video Breakdowns & Watch CMS</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Manage YouTube video stream embeds, custom metadata, and public watch sessions synced with Supabase.
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                onClick={async () => {
                  setIsRefreshing(true);
                  try {
                    await refreshVideos();
                    notify('Videos synchronized with Supabase live database', 'success');
                  } catch {
                    notify('Sync completed with local state', 'info');
                  } finally {
                    setIsRefreshing(false);
                  }
                }}
                disabled={isRefreshing}
                className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                title="Sync videos from database"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-purple-400' : ''}`} />
                <span>Sync</span>
              </button>
              <button
                onClick={openNewVideoModal}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-purple-600/20 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Add New Video</span>
              </button>
            </div>
          </div>

          {/* Statistical Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Total Videos</p>
                <p className="text-xl font-bold text-white mt-0.5">{videos.length}</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-slate-800/80 flex items-center justify-center text-slate-400">
                <VideoIcon className="w-4 h-4" />
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Published</p>
                <p className="text-xl font-bold text-emerald-400 mt-0.5">
                  {videos.filter(v => v.status === 'published').length}
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <Eye className="w-4 h-4" />
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Drafts</p>
                <p className="text-xl font-bold text-amber-400 mt-0.5">
                  {videos.filter(v => v.status === 'draft').length}
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                <EyeOff className="w-4 h-4" />
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Featured</p>
                <p className="text-xl font-bold text-purple-400 mt-0.5">
                  {videos.filter(v => Boolean(v.isFeatured ?? v.featured)).length}
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                <Star className="w-4 h-4 fill-current" />
              </div>
            </div>
          </div>

          {/* Search, Filter Bar & View Toggle */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex flex-1 items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search videos by title, tag, or topic..."
                  value={videoSearch}
                  onChange={(e) => setVideoSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                {(['all', 'published', 'draft'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setVideoStatusFilter(st)}
                    className={`px-3 py-1 rounded-lg font-medium capitalize transition-colors cursor-pointer ${
                      videoStatusFilter === st
                        ? 'bg-purple-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              {/* Category Filter */}
              <select
                value={videoCategoryFilter}
                onChange={(e) => setVideoCategoryFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-purple-500 cursor-pointer hidden md:block"
              >
                <option value="all">All Categories</option>
                {Array.from(new Set(videos.map(v => v.category).filter(Boolean))).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 self-end sm:self-center">
              <button
                onClick={() => setVideoViewMode('table')}
                className={`p-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  videoViewMode === 'table'
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
                title="Table view"
              >
                <Layers className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setVideoViewMode('grid')}
                className={`p-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  videoViewMode === 'grid'
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
                title="Grid view"
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Videos Listing (Table or Grid) */}
          {(() => {
            const filteredVideos = videos.filter((vid) => {
              const q = videoSearch.toLowerCase().trim();
              const matchesSearch =
                q === '' ||
                vid.title.toLowerCase().includes(q) ||
                vid.description.toLowerCase().includes(q) ||
                (vid.tags && vid.tags.some(t => t.toLowerCase().includes(q)));

              const matchesStatus =
                videoStatusFilter === 'all' ||
                vid.status === videoStatusFilter ||
                (videoStatusFilter === 'draft' && !vid.status);

              const matchesCategory =
                videoCategoryFilter === 'all' || vid.category === videoCategoryFilter;

              return matchesSearch && matchesStatus && matchesCategory;
            });

            if (filteredVideos.length === 0) {
              return (
                <div className="p-12 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-500 flex items-center justify-center mx-auto">
                    <VideoIcon className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-semibold text-white">No video breakdowns found</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    No videos match your current search query or filter criteria. Create a new video to get started.
                  </p>
                  <button
                    onClick={openNewVideoModal}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold cursor-pointer shadow-lg shadow-purple-600/20"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add First Video</span>
                  </button>
                </div>
              );
            }

            if (videoViewMode === 'table') {
              return (
                <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-lg">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-mono text-[11px] border-b border-slate-800">
                        <tr>
                          <th className="py-3.5 px-4">Video Breakdown</th>
                          <th className="py-3.5 px-4">Category</th>
                          <th className="py-3.5 px-4">Status</th>
                          <th className="py-3.5 px-4">Duration & Stats</th>
                          <th className="py-3.5 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {filteredVideos.map((vid) => {
                          const isFeatured = Boolean(vid.isFeatured ?? vid.featured);
                          const thumb = vid.thumbnailUrl || vid.thumbnail;

                          return (
                            <tr key={vid.id} className="hover:bg-slate-800/40 transition-colors group">
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-14 h-9 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden shrink-0 relative">
                                    {thumb ? (
                                      <img
                                        src={thumb}
                                        alt={vid.title}
                                        className="w-full h-full object-cover"
                                        referrerPolicy="no-referrer"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-slate-600">
                                        <Play className="w-3.5 h-3.5" />
                                      </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Play className="w-3 h-3 text-white fill-current" />
                                    </div>
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-white truncate max-w-xs group-hover:text-purple-400 transition-colors">
                                        {vid.title}
                                      </span>
                                      {isFeatured && (
                                        <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[9px] font-bold uppercase tracking-wider border border-purple-500/30 flex items-center gap-0.5">
                                          <Star className="w-2.5 h-2.5 fill-current" />
                                          Featured
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[11px] text-slate-500 font-mono">
                                      /watch/{vid.slug}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <span className="px-2.5 py-1 rounded-md bg-purple-500/10 text-purple-300 font-medium text-[11px] border border-purple-500/20">
                                  {vid.category}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <button
                                  onClick={() => handleToggleVideoPublish(vid)}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                                    vid.status === 'published'
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
                                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
                                  }`}
                                  title="Click to toggle published status"
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${vid.status === 'published' ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                                  <span>{vid.status === 'published' ? 'Published' : 'Draft'}</span>
                                </button>
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap text-slate-400 text-[11px]">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-slate-500" />
                                    <span>{vid.duration || '12:00'}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Eye className="w-3 h-3 text-slate-500" />
                                    <span>{vid.viewsCount || '1.2k views'}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {/* Toggle Featured */}
                                  <button
                                    onClick={() => handleToggleVideoFeatured(vid)}
                                    className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                      isFeatured
                                        ? 'bg-purple-500/20 border-purple-500/40 text-purple-400'
                                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                                    }`}
                                    title={isFeatured ? 'Remove from Featured' : 'Mark as Featured'}
                                  >
                                    <Star className={`w-3.5 h-3.5 ${isFeatured ? 'fill-current' : ''}`} />
                                  </button>

                                  {/* Preview live */}
                                  <button
                                    onClick={() => navigate(`/watch/${vid.slug}`)}
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                                    title="View public preview"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Edit Video */}
                                  <button
                                    onClick={() => openEditVideoModal(vid)}
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                                    title="Edit Video"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Delete Video */}
                                  <button
                                    onClick={() => setDeletingVideoId(vid.id)}
                                    className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors cursor-pointer"
                                    title="Delete Video"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            }

            // Grid View
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredVideos.map((vid) => {
                  const isFeatured = Boolean(vid.isFeatured ?? vid.featured);
                  const thumb = vid.thumbnailUrl || vid.thumbnail;

                  return (
                    <div
                      key={vid.id}
                      className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-4 hover:border-slate-700 transition-all shadow-md group"
                    >
                      <div className="space-y-3">
                        <div className="relative rounded-xl overflow-hidden aspect-video bg-slate-800 border border-slate-800">
                          {thumb ? (
                            <img
                              src={thumb}
                              alt={vid.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-600">
                              <Play className="w-8 h-8" />
                            </div>
                          )}
                          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 text-white text-[10px] font-mono font-bold">
                            {vid.duration || '12:00'}
                          </div>
                          {isFeatured && (
                            <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-purple-600 text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-md">
                              <Star className="w-2.5 h-2.5 fill-current" />
                              Featured
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <span className="px-2.5 py-0.5 rounded-md bg-purple-500/10 text-purple-300 font-semibold border border-purple-500/20">
                            {vid.category}
                          </span>
                          {vid.status === 'published' ? (
                            <span className="text-emerald-400 font-medium flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                              Published
                            </span>
                          ) : (
                            <span className="text-amber-400 font-medium flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                              Draft
                            </span>
                          )}
                        </div>

                        <h3 className="text-base font-display font-bold text-white group-hover:text-purple-400 transition-colors line-clamp-2">
                          {vid.title}
                        </h3>

                        <p className="text-xs text-slate-400 line-clamp-2">
                          {vid.description}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                          <span>{vid.viewsCount || '1.2k views'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => navigate(`/watch/${vid.slug}`)}
                            className="text-slate-300 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs transition-colors"
                          >
                            Preview
                          </button>
                          <button
                            onClick={() => openEditVideoModal(vid)}
                            className="text-purple-400 hover:text-purple-300 p-1"
                            title="Edit Video"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeletingVideoId(vid.id)}
                            className="text-rose-400 hover:text-rose-300 p-1"
                            title="Delete Video"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIDEO EDITOR MODAL (SUPABASE WRITE-THROUGH CMS) */}
      {/* ========================================================================= */}
      <VideoEditorModal
        isOpen={isVideoModalOpen}
        initialVideo={selectedVideoForEdit}
        onClose={() => {
          setIsVideoModalOpen(false);
          setSelectedVideoForEdit(null);
        }}
        onSave={handleSaveVideoModal}
        onUnpublish={handleUnpublishVideoModal}
        isSaving={isSavingVideo}
      />

      {/* ========================================================================= */}
      {/* DELETE VIDEO CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {deletingVideoId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-5 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-white">Delete this video breakdown?</h3>
              <p className="text-xs text-slate-400">
                This will remove the video breakdown from the live database and archive its public stream. This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setDeletingVideoId(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const id = deletingVideoId;
                  setDeletingVideoId(null);
                  if (id) {
                    await deleteVideo(id);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-rose-500/20"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: RESOURCES CMS (SUPABASE WRITE-THROUGH) */}
      {/* ========================================================================= */}
      {activeTab === 'resources' && (
        <div className="space-y-6">
          {/* Top CMS Header & Stats */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Download className="w-4 h-4" />
                </div>
                <h2 className="text-lg font-display font-bold text-white">Resources CMS</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-mono font-semibold">
                  public.resources
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Manage downloadable blueprints, cheat sheets, frameworks, and tools in the production Supabase database.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={async () => {
                  try {
                    await refreshResources();
                    notify('Resources refreshed from Supabase', 'success');
                  } catch {
                    notify('Failed to refresh resources', 'error');
                  }
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700 cursor-pointer"
                title="Sync resources with Supabase database"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sync Resources</span>
              </button>

              <button
                onClick={openNewResourceModal}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Resource</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Total Resources</span>
              <div className="text-xl font-bold font-mono text-white mt-1">{resources.length}</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Published Live</span>
              <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
                {resources.filter(r => r.status === 'published').length}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Drafts In Progress</span>
              <div className="text-xl font-bold font-mono text-amber-400 mt-1">
                {resources.filter(r => r.status === 'draft' || !r.status).length}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Total Downloads</span>
              <div className="text-xl font-bold font-mono text-blue-400 mt-1">
                {resources.reduce((acc, r) => acc + (r.downloadCount || 0), 0)}
              </div>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search resources by title, tag, format..."
                value={resourceSearch}
                onChange={(e) => setResourceSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-between md:justify-end">
              {/* Status Filter */}
              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                {(['all', 'published', 'draft'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setResourceStatusFilter(st)}
                    className={`px-3 py-1 rounded-lg capitalize text-xs transition-colors ${
                      resourceStatusFilter === st
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              {/* Resource Type Filter */}
              <select
                value={resourceTypeFilter}
                onChange={(e) => setResourceTypeFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
              >
                <option value="all">All Types</option>
                {Array.from(new Set(resources.map((r) => r.resourceType || r.type).filter(Boolean))).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              {/* Category Filter */}
              <select
                value={resourceCategoryFilter}
                onChange={(e) => setResourceCategoryFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
              >
                <option value="all">All Categories</option>
                {Array.from(new Set(resources.map((r) => r.category).filter(Boolean))).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              {/* View Switcher */}
              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setResourceViewMode('table')}
                  className={`p-1.5 rounded-lg transition-colors ${
                    resourceViewMode === 'table' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'
                  }`}
                  title="Table View"
                >
                  <FileText className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setResourceViewMode('grid')}
                  className={`p-1.5 rounded-lg transition-colors ${
                    resourceViewMode === 'grid' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'
                  }`}
                  title="Grid View"
                >
                  <Layers className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Resources Content List */}
          {(() => {
            const filteredResources = resources.filter((res) => {
              const matchesSearch =
                resourceSearch === '' ||
                (res.title || res.name || '').toLowerCase().includes(resourceSearch.toLowerCase()) ||
                (res.description || '').toLowerCase().includes(resourceSearch.toLowerCase()) ||
                (res.category || '').toLowerCase().includes(resourceSearch.toLowerCase()) ||
                (res.tags && res.tags.some((t) => t.toLowerCase().includes(resourceSearch.toLowerCase())));

              const matchesStatus =
                resourceStatusFilter === 'all' ||
                res.status === resourceStatusFilter ||
                (resourceStatusFilter === 'draft' && !res.status);

              const matchesType =
                resourceTypeFilter === 'all' || (res.resourceType || res.type) === resourceTypeFilter;

              const matchesCategory =
                resourceCategoryFilter === 'all' || res.category === resourceCategoryFilter;

              return matchesSearch && matchesStatus && matchesType && matchesCategory;
            });

            if (filteredResources.length === 0) {
              return (
                <div className="p-12 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-500 flex items-center justify-center mx-auto">
                    <Download className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-semibold text-white">No resources found</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    No resources match your search query or filter criteria. Create a new resource to get started.
                  </p>
                  <button
                    onClick={openNewResourceModal}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer shadow-lg shadow-amber-500/20"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create First Resource</span>
                  </button>
                </div>
              );
            }

            if (resourceViewMode === 'table') {
              return (
                <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-lg">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-mono text-[11px] border-b border-slate-800">
                        <tr>
                          <th className="py-3.5 px-4">Resource</th>
                          <th className="py-3.5 px-4">Type & Category</th>
                          <th className="py-3.5 px-4">Status</th>
                          <th className="py-3.5 px-4">Format & Downloads</th>
                          <th className="py-3.5 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {filteredResources.map((res) => {
                          const isFeatured = Boolean(res.isFeatured ?? res.featured);
                          const thumb = res.thumbnailUrl || res.coverImage;
                          const resTitle = res.title || res.name;
                          const resType = res.resourceType || res.type || 'Guide';

                          return (
                            <tr key={res.id} className="hover:bg-slate-800/40 transition-colors group">
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden shrink-0 relative">
                                    {thumb ? (
                                      <img
                                        src={thumb}
                                        alt={resTitle}
                                        className="w-full h-full object-cover"
                                        referrerPolicy="no-referrer"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-slate-600">
                                        <Download className="w-4 h-4" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-white truncate max-w-xs group-hover:text-amber-400 transition-colors">
                                        {resTitle}
                                      </span>
                                      {isFeatured && (
                                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold uppercase tracking-wider border border-amber-500/30 flex items-center gap-0.5">
                                          <Star className="w-2.5 h-2.5 fill-current" />
                                          Featured
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[11px] text-slate-500 font-mono">
                                      /resources/{res.slug}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <div className="space-y-1">
                                  <span className="inline-block px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 font-medium text-[11px] border border-amber-500/20">
                                    {resType}
                                  </span>
                                  <div className="text-[11px] text-slate-400">{res.category}</div>
                                </div>
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <button
                                  onClick={() => handleToggleResourcePublish(res)}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                                    res.status === 'published'
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
                                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
                                  }`}
                                  title="Click to toggle published status"
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${res.status === 'published' ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                                  <span>{res.status === 'published' ? 'Published' : 'Draft'}</span>
                                </button>
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap text-slate-400 text-[11px]">
                                <div className="space-y-0.5">
                                  <div className="font-mono text-slate-300">
                                    {res.fileType || res.format || 'PDF'} {res.fileSize ? `(${res.fileSize})` : ''}
                                  </div>
                                  <div className="text-slate-500 text-[10px]">
                                    {res.downloadCount || 0} downloads
                                  </div>
                                </div>
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {/* Toggle Featured */}
                                  <button
                                    onClick={() => handleToggleResourceFeatured(res)}
                                    className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                      isFeatured
                                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                                    }`}
                                    title={isFeatured ? 'Remove from Featured' : 'Mark as Featured'}
                                  >
                                    <Star className={`w-3.5 h-3.5 ${isFeatured ? 'fill-current' : ''}`} />
                                  </button>

                                  {/* Preview live */}
                                  <button
                                    onClick={() => navigate(`/resources/${res.slug}`)}
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                                    title="View public preview"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Edit Resource */}
                                  <button
                                    onClick={() => openEditResourceModal(res)}
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                                    title="Edit Resource"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Delete Resource */}
                                  <button
                                    onClick={() => setDeletingResourceId(res.id)}
                                    className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors cursor-pointer"
                                    title="Delete Resource"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            }

            // Grid View
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredResources.map((res) => {
                  const isFeatured = Boolean(res.isFeatured ?? res.featured);
                  const thumb = res.thumbnailUrl || res.coverImage;
                  const resTitle = res.title || res.name;
                  const resType = res.resourceType || res.type || 'Guide';

                  return (
                    <div
                      key={res.id}
                      className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-4 hover:border-slate-700 transition-all shadow-md group"
                    >
                      <div className="space-y-3">
                        <div className="relative rounded-xl overflow-hidden aspect-video bg-slate-800 border border-slate-800">
                          {thumb ? (
                            <img
                              src={thumb}
                              alt={resTitle}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-600">
                              <Download className="w-8 h-8" />
                            </div>
                          )}
                          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 text-[10px] font-bold uppercase tracking-wider shadow-md">
                              {resType}
                            </span>
                            {isFeatured && (
                              <span className="px-2 py-0.5 rounded-md bg-black/80 text-amber-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-md border border-amber-500/30">
                                <Star className="w-2.5 h-2.5 fill-current" />
                                Featured
                              </span>
                            )}
                          </div>
                          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 text-white text-[10px] font-mono">
                            {res.fileType || res.format || 'PDF'}
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <span className="px-2.5 py-0.5 rounded-md bg-amber-500/10 text-amber-300 font-semibold border border-amber-500/20">
                            {res.category}
                          </span>
                          {res.status === 'published' ? (
                            <span className="text-emerald-400 font-medium flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                              Published
                            </span>
                          ) : (
                            <span className="text-amber-400 font-medium flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                              Draft
                            </span>
                          )}
                        </div>

                        <h3 className="text-base font-display font-bold text-white group-hover:text-amber-400 transition-colors line-clamp-2">
                          {resTitle}
                        </h3>

                        <p className="text-xs text-slate-400 line-clamp-2">
                          {res.description}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                          <Download className="w-3 h-3 text-slate-500" />
                          <span>{res.downloadCount || 0} downloads</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => navigate(`/resources/${res.slug}`)}
                            className="text-slate-300 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs transition-colors"
                          >
                            Preview
                          </button>
                          <button
                            onClick={() => openEditResourceModal(res)}
                            className="text-amber-400 hover:text-amber-300 p-1"
                            title="Edit Resource"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeletingResourceId(res.id)}
                            className="text-rose-400 hover:text-rose-300 p-1"
                            title="Delete Resource"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* ========================================================================= */}
      {/* RESOURCE EDITOR MODAL (SUPABASE WRITE-THROUGH CMS) */}
      {/* ========================================================================= */}
      <ResourceEditorModal
        isOpen={isResourceModalOpen}
        initialResource={selectedResourceForEdit}
        onClose={() => {
          setIsResourceModalOpen(false);
          setSelectedResourceForEdit(null);
        }}
        onSave={handleSaveResourceModal}
        onUnpublish={handleUnpublishResourceModal}
        isSaving={isSavingResource}
      />

      {/* ========================================================================= */}
      {/* DELETE RESOURCE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {deletingResourceId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-5 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-white">Delete this resource?</h3>
              <p className="text-xs text-slate-400">
                This will remove the resource record from the live database and archive its public download asset. This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setDeletingResourceId(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const id = deletingResourceId;
                  setDeletingResourceId(null);
                  if (id) {
                    await deleteResource(id);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-rose-500/20"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* FRAMEWORKS CMS TAB */}
      {/* ========================================================================= */}
      {activeTab === 'frameworks' && (
        <div id="admin-frameworks-cms" className="space-y-6 animate-in fade-in duration-200">
          {/* Top Bar with Metrics */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    <Layers className="w-5 h-5" />
                  </span>
                  <h2 className="text-lg font-display font-bold text-white">
                    Frameworks CMS Management
                  </h2>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Manage Digital Muid’s proprietary methodologies, multi-stage frameworks, and strategic architecture.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  id="admin-sync-frameworks-btn"
                  disabled={isSyncingFrameworks}
                  onClick={async () => {
                    setIsSyncingFrameworks(true);
                    try {
                      await syncInitialFrameworks();
                    } finally {
                      setIsSyncingFrameworks(false);
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  title="Safely sync baseline production frameworks into database"
                >
                  <RefreshCw className={`w-4 h-4 text-emerald-400 ${isSyncingFrameworks ? 'animate-spin' : ''}`} />
                  <span>{isSyncingFrameworks ? 'Syncing...' : 'Sync Baseline Frameworks'}</span>
                </button>

                <button
                  id="admin-manage-framework-categories-btn"
                  onClick={() => setIsCategoriesModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Layers className="w-4 h-4 text-indigo-400" />
                  <span>Manage Categories</span>
                </button>

                <button
                  id="admin-new-framework-btn"
                  onClick={openNewFrameworkModal}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Framework</span>
                </button>
              </div>
            </div>

            {/* Metrics Ribbon */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-800">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Frameworks</span>
                <p className="text-lg font-bold text-white font-mono mt-0.5">{frameworks.length}</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Published Live</span>
                <p className="text-lg font-bold text-emerald-300 font-mono mt-0.5">
                  {frameworks.filter(f => f.status === 'published').length}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Drafts</span>
                <p className="text-lg font-bold text-amber-300 font-mono mt-0.5">
                  {frameworks.filter(f => f.status !== 'published').length}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20">
                <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">Featured Models</span>
                <p className="text-lg font-bold text-indigo-300 font-mono mt-0.5">
                  {frameworks.filter(f => Boolean(f.isFeatured ?? f.is_featured ?? f.featured)).length}
                </p>
              </div>
            </div>

            {/* Filter / Search Controls */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-2">
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={frameworkSearch}
                    onChange={(e) => setFrameworkSearch(e.target.value)}
                    placeholder="Search frameworks..."
                    className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  {frameworkSearch && (
                    <button
                      onClick={() => setFrameworkSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Category Filter */}
                <select
                  value={frameworkCategoryFilter}
                  onChange={(e) => setFrameworkCategoryFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="all">All Categories</option>
                  {Array.from(
                    new Set([
                      ...frameworkCategories.map(c => c.name),
                      ...frameworks.map(f => f.category).filter(Boolean)
                    ])
                  ).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>

                {/* Status Filter */}
                <select
                  value={frameworkStatusFilter}
                  onChange={(e) => setFrameworkStatusFilter(e.target.value as any)}
                  className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="published">Published</option>
                  <option value="draft">Drafts</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              {/* View Toggle */}
              <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl">
                <button
                  onClick={() => setFrameworkViewMode('table')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    frameworkViewMode === 'table' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Table
                </button>
                <button
                  onClick={() => setFrameworkViewMode('grid')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    frameworkViewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Grid
                </button>
              </div>
            </div>
          </div>

          {/* Frameworks List / Table */}
          {(() => {
            const searchLower = (frameworkSearch || '').trim().toLowerCase();
            const filtered = frameworks.filter(fw => {
              const matchesSearch =
                !searchLower ||
                (fw.title && fw.title.toLowerCase().includes(searchLower)) ||
                (fw.name && fw.name.toLowerCase().includes(searchLower)) ||
                (fw.subtitle && fw.subtitle.toLowerCase().includes(searchLower)) ||
                (fw.description && fw.description.toLowerCase().includes(searchLower)) ||
                (fw.slug && fw.slug.toLowerCase().includes(searchLower)) ||
                (fw.category && fw.category.toLowerCase().includes(searchLower));

              const matchesCat =
                frameworkCategoryFilter === 'all' ||
                (fw.category || '').trim().toLowerCase() === frameworkCategoryFilter.trim().toLowerCase();

              const matchesStatus =
                frameworkStatusFilter === 'all' ||
                (fw.status || 'draft').toLowerCase() === frameworkStatusFilter.toLowerCase();

              return matchesSearch && matchesCat && matchesStatus;
            });

            console.info('[Framework Table Diagnostic]', {
              'frameworks.length': frameworks.length,
              'framework titles': frameworks.map(f => f.title || f.name),
              'framework statuses': frameworks.map(f => f.status),
              'framework categories': frameworks.map(f => f.category),
              'active search': frameworkSearch,
              'active category filter': frameworkCategoryFilter,
              'active status filter': frameworkStatusFilter,
              'filteredFrameworks.length': filtered.length,
              'tableFrameworks.length': filtered.length
            });

            if (frameworksLoading) {
              return (
                <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                  <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
                  <h3 className="text-base font-bold text-white">Loading Strategic Frameworks...</h3>
                  <p className="text-xs text-slate-400">Syncing repository from Supabase database...</p>
                </div>
              );
            }

            if (filtered.length === 0) {
              return (
                <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
                    <Layers className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-white">No frameworks found</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    {frameworkSearch || frameworkCategoryFilter !== 'all' || frameworkStatusFilter !== 'all'
                      ? 'Try adjusting your filters or search keywords.'
                      : 'Create your first strategic methodology framework to display on the platform.'}
                  </p>
                  <button
                    onClick={openNewFrameworkModal}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Framework</span>
                  </button>
                </div>
              );
            }

            if (frameworkViewMode === 'table') {
              return (
                <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-lg">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-mono text-[11px] border-b border-slate-800">
                        <tr>
                          <th className="py-3.5 px-4">Framework / Architecture</th>
                          <th className="py-3.5 px-4">Category</th>
                          <th className="py-3.5 px-4">Stages</th>
                          <th className="py-3.5 px-4">Status</th>
                          <th className="py-3.5 px-4">Published</th>
                          <th className="py-3.5 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {filtered.map((fw) => {
                          const isFeatured = Boolean(fw.isFeatured ?? fw.is_featured ?? fw.featured);
                          const stagesCount = (fw.frameworkContent ?? fw.framework_content ?? fw.steps ?? []).length;
                          const thumb = fw.coverImage || fw.cover_image;
                          const fwTitle = fw.title || fw.name || 'Untitled Framework';

                          return (
                            <tr key={fw.id} className="hover:bg-slate-800/40 transition-colors group">
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden shrink-0 relative flex items-center justify-center">
                                    {thumb ? (
                                      <img
                                        src={thumb}
                                        alt={fwTitle}
                                        className="w-full h-full object-cover"
                                        referrerPolicy="no-referrer"
                                      />
                                    ) : (
                                      <Layers className="w-5 h-5 text-indigo-400" />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-white truncate max-w-xs group-hover:text-indigo-400 transition-colors">
                                        {fwTitle}
                                      </span>
                                      {isFeatured && (
                                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold uppercase tracking-wider border border-amber-500/30 flex items-center gap-0.5">
                                          <Star className="w-2.5 h-2.5 fill-current" />
                                          Featured
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[11px] text-slate-500 font-mono">
                                      /frameworks/{fw.slug}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <span className="px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-300 font-medium text-[11px] border border-indigo-500/20">
                                  {fw.category || 'Digital Growth'}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap text-slate-300 font-mono text-xs">
                                <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">
                                  {stagesCount} {stagesCount === 1 ? 'Stage' : 'Stages'}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <button
                                  onClick={() => handleToggleFrameworkPublish(fw)}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                                    fw.status === 'published'
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
                                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
                                  }`}
                                  title="Click to toggle published status"
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${fw.status === 'published' ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                                  <span>{fw.status === 'published' ? 'Published' : 'Draft'}</span>
                                </button>
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap text-slate-400 text-[11px]">
                                {fw.publishedAt || fw.published_at || (fw.status === 'published' ? 'Live' : '—')}
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {/* Toggle Featured */}
                                  <button
                                    onClick={() => handleToggleFrameworkFeatured(fw)}
                                    className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                      isFeatured
                                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                                    }`}
                                    title={isFeatured ? 'Remove from Featured' : 'Mark as Featured'}
                                  >
                                    <Star className={`w-3.5 h-3.5 ${isFeatured ? 'fill-amber-300' : ''}`} />
                                  </button>

                                  {/* View Page */}
                                  <button
                                    onClick={() => navigate(`/frameworks/${fw.slug}`)}
                                    className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 transition-colors cursor-pointer"
                                    title="View Framework Page"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Edit Modal */}
                                  <button
                                    onClick={() => openEditFrameworkModal(fw)}
                                    className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
                                    title="Edit Framework"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Delete */}
                                  <button
                                    onClick={() => setDeletingFrameworkId(fw.id)}
                                    className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer"
                                    title="Delete Framework"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            }

            // Grid View
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map((fw) => {
                  const isFeatured = Boolean(fw.isFeatured ?? fw.is_featured ?? fw.featured);
                  const stagesCount = (fw.frameworkContent ?? fw.framework_content ?? fw.steps ?? []).length;
                  const thumb = fw.coverImage || fw.cover_image;
                  const fwTitle = fw.title || fw.name || 'Untitled Framework';

                  return (
                    <div
                      key={fw.id}
                      className="group rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/40 p-5 flex flex-col justify-between space-y-4 transition-all shadow-md"
                    >
                      <div className="space-y-3">
                        {thumb && (
                          <div className="relative h-36 rounded-xl overflow-hidden bg-slate-800 border border-slate-700">
                            <img
                              src={thumb}
                              alt={fwTitle}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white">
                              {fw.category || 'Digital Growth'}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-xs">
                          <span className="text-indigo-400 font-mono text-[11px] font-semibold">
                            {stagesCount} Execution Stages
                          </span>
                          {fw.status === 'published' ? (
                            <span className="text-emerald-400 font-medium flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                              Published
                            </span>
                          ) : (
                            <span className="text-amber-400 font-medium flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                              Draft
                            </span>
                          )}
                        </div>

                        <h3 className="text-base font-display font-bold text-white group-hover:text-indigo-400 transition-colors line-clamp-2">
                          {fwTitle}
                        </h3>

                        {fw.subtitle && (
                          <p className="text-xs text-indigo-200 font-medium line-clamp-1">
                            {fw.subtitle}
                          </p>
                        )}

                        <p className="text-xs text-slate-400 line-clamp-2">
                          {fw.description || fw.introduction}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                          /frameworks/{fw.slug}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => navigate(`/frameworks/${fw.slug}`)}
                            className="text-slate-300 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs transition-colors"
                          >
                            Preview
                          </button>
                          <button
                            onClick={() => openEditFrameworkModal(fw)}
                            className="text-indigo-400 hover:text-indigo-300 p-1"
                            title="Edit Framework"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeletingFrameworkId(fw.id)}
                            className="text-rose-400 hover:text-rose-300 p-1"
                            title="Delete Framework"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* ========================================================================= */}
      {/* FRAMEWORK EDITOR MODAL */}
      {/* ========================================================================= */}
      <FrameworkEditorModal
        isOpen={isFrameworkModalOpen}
        initialFramework={selectedFrameworkForEdit}
        onClose={() => {
          setIsFrameworkModalOpen(false);
          setSelectedFrameworkForEdit(null);
        }}
        onSave={handleSaveFrameworkModal}
        onUnpublish={handleUnpublishFrameworkModal}
        isSaving={isSavingFramework}
        availableArticles={articles}
        availableVideos={videos}
        availableResources={resources}
        availableCategories={frameworkCategories}
      />

      {/* ========================================================================= */}
      {/* FRAMEWORK CATEGORIES MODAL */}
      {/* ========================================================================= */}
      <FrameworkCategoriesModal
        isOpen={isCategoriesModalOpen}
        onClose={() => setIsCategoriesModalOpen(false)}
      />

      {/* ========================================================================= */}
      {/* DELETE FRAMEWORK CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {deletingFrameworkId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-5 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-white">Delete this framework?</h3>
              <p className="text-xs text-slate-400">
                This will remove the methodology model and its execution stages from the database. This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setDeletingFrameworkId(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const id = deletingFrameworkId;
                  setDeletingFrameworkId(null);
                  if (id) {
                    await deleteFramework(id);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-rose-500/20 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ========================================================================= */}
      {/* COURSES CMS TAB */}
      {/* ========================================================================= */}
      {activeTab === 'courses' && (
        <div id="admin-courses-cms" className="space-y-6 animate-in fade-in duration-200">
          {/* Top Bar with Metrics */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <GraduationCap className="w-5 h-5" />
                  </span>
                  <h2 className="text-lg font-display font-bold text-white">
                    Courses & Education CMS
                  </h2>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Manage masterclasses, cohort programs, multi-module curricula, and framework integrations synced with Supabase.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  id="admin-sync-courses-btn"
                  disabled={isSyncingCourses}
                  onClick={async () => {
                    setIsSyncingCourses(true);
                    try {
                      await syncInitialCourses();
                    } finally {
                      setIsSyncingCourses(false);
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  title="Safely sync baseline production courses into database"
                >
                  <RefreshCw className={`w-4 h-4 text-emerald-400 ${isSyncingCourses ? 'animate-spin' : ''}`} />
                  <span>{isSyncingCourses ? 'Syncing...' : 'Sync Baseline Courses'}</span>
                </button>

                <button
                  id="admin-new-course-btn"
                  onClick={openNewCourseModal}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Course</span>
                </button>
              </div>
            </div>

            {/* Metrics Ribbon */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-800">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Courses</span>
                <p className="text-lg font-bold text-white font-mono mt-0.5">{courses.length}</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Published Live</span>
                <p className="text-lg font-bold text-emerald-300 font-mono mt-0.5">
                  {courses.filter(c => c.status === 'published').length}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Drafts</span>
                <p className="text-lg font-bold text-amber-300 font-mono mt-0.5">
                  {courses.filter(c => c.status !== 'published').length}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-teal-500/5 border border-teal-500/20">
                <span className="text-[10px] font-semibold text-teal-400 uppercase tracking-wider">Featured Programs</span>
                <p className="text-lg font-bold text-teal-300 font-mono mt-0.5">
                  {courses.filter(c => Boolean(c.isFeatured ?? c.featured)).length}
                </p>
              </div>
            </div>

            {/* Filter / Search Controls */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-2">
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={courseSearch}
                    onChange={(e) => setCourseSearch(e.target.value)}
                    placeholder="Search courses..."
                    className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  {courseSearch && (
                    <button
                      onClick={() => setCourseSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Level Filter */}
                <select
                  value={courseLevelFilter}
                  onChange={(e) => setCourseLevelFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="all">All Levels</option>
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                  <option value="All Levels">All Levels (Comprehensive)</option>
                </select>

                {/* Status Filter */}
                <select
                  value={courseStatusFilter}
                  onChange={(e) => setCourseStatusFilter(e.target.value as any)}
                  className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="published">Published</option>
                  <option value="draft">Drafts</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              {/* View Toggle */}
              <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl">
                <button
                  onClick={() => setCourseViewMode('table')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    courseViewMode === 'table' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Table
                </button>
                <button
                  onClick={() => setCourseViewMode('grid')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    courseViewMode === 'grid' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Grid
                </button>
              </div>
            </div>
          </div>

          {/* Courses List / Table */}
          {(() => {
            const searchLower = (courseSearch || '').trim().toLowerCase();
            const cleanQuery = searchLower.replace(/^\/?(courses\/)?/, '');
            const queryWords = cleanQuery.split(/[\s\-_]+/).filter(Boolean);
            const hyphenatedQuery = cleanQuery.replace(/[\s_]+/g, '-');
            const spacedQuery = cleanQuery.replace(/[-_]+/g, ' ');

            const filtered = courses.filter(crs => {
              if (!searchLower) return true;

              const crsTitle = (crs.title || crs.name || '').toLowerCase();
              const crsSlug = (crs.slug || '').toLowerCase().trim();
              const crsSlugSpaced = crsSlug.replace(/[-_]+/g, ' ');
              const crsTagline = (crs.tagline || '').toLowerCase();
              const crsDesc = (crs.description || '').toLowerCase();
              const crsOutcome = (crs.shortOutcome || crs.short_outcome || '').toLowerCase();
              const crsInstructor = (crs.instructor || '').toLowerCase();

              // Match slug (exact partial, hyphenated, spaced, word-by-word, or raw)
              const matchesSlug = Boolean(
                crsSlug && (
                  crsSlug.includes(cleanQuery) ||
                  crsSlug.includes(searchLower) ||
                  crsSlug.includes(hyphenatedQuery) ||
                  crsSlugSpaced.includes(spacedQuery) ||
                  (queryWords.length > 0 && queryWords.every(w => crsSlug.includes(w) || crsSlugSpaced.includes(w)))
                )
              );

              // Match title
              const matchesTitle = Boolean(
                crsTitle && (
                  crsTitle.includes(searchLower) ||
                  crsTitle.includes(cleanQuery) ||
                  (queryWords.length > 0 && queryWords.every(w => crsTitle.includes(w)))
                )
              );

              // Match instructor
              const matchesInstructor = Boolean(
                crsInstructor && (
                  crsInstructor.includes(searchLower) ||
                  crsInstructor.includes(cleanQuery)
                )
              );

              // Match tags
              const matchesTags = Boolean(
                Array.isArray(crs.tags) && crs.tags.some(tag => {
                  if (typeof tag !== 'string') return false;
                  const tLower = tag.toLowerCase();
                  const tSpaced = tLower.replace(/[-_]+/g, ' ');
                  return (
                    tLower.includes(searchLower) ||
                    tLower.includes(cleanQuery) ||
                    tSpaced.includes(spacedQuery)
                  );
                })
              );

              // Preserved fields for backwards compatibility
              const matchesTagline = Boolean(crsTagline && crsTagline.includes(searchLower));
              const matchesDesc = Boolean(crsDesc && crsDesc.includes(searchLower));
              const matchesOutcome = Boolean(crsOutcome && crsOutcome.includes(searchLower));

              const matchesSearch =
                matchesTitle ||
                matchesSlug ||
                matchesInstructor ||
                matchesTags ||
                matchesTagline ||
                matchesDesc ||
                matchesOutcome;

              const matchesLevel =
                courseLevelFilter === 'all' ||
                (crs.level || '').trim().toLowerCase() === courseLevelFilter.trim().toLowerCase();

              const matchesStatus =
                courseStatusFilter === 'all' ||
                (crs.status || 'draft').toLowerCase() === courseStatusFilter.toLowerCase();

              return matchesSearch && matchesLevel && matchesStatus;
            });

            if (coursesLoading) {
              return (
                <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                  <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
                  <h3 className="text-base font-bold text-white">Loading Courses & Education...</h3>
                  <p className="text-xs text-slate-400">Syncing repository from Supabase database...</p>
                </div>
              );
            }

            if (filtered.length === 0) {
              return (
                <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-white">No courses found</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    {courseSearch || courseLevelFilter !== 'all' || courseStatusFilter !== 'all'
                      ? 'Try adjusting your filters or search keywords.'
                      : 'Create your first course to offer structured education on the platform.'}
                  </p>
                  <button
                    onClick={openNewCourseModal}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Course</span>
                  </button>
                </div>
              );
            }

            if (courseViewMode === 'table') {
              return (
                <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-lg">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-mono text-[11px] border-b border-slate-800">
                        <tr>
                          <th className="py-3.5 px-4">Course & Program</th>
                          <th className="py-3.5 px-4">Level & Mode</th>
                          <th className="py-3.5 px-4">Modules & Duration</th>
                          <th className="py-3.5 px-4">Price</th>
                          <th className="py-3.5 px-4">Status</th>
                          <th className="py-3.5 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {filtered.map((crs) => {
                          const isFeatured = Boolean(crs.isFeatured ?? crs.featured);
                          const modulesCount = (crs.modules || crs.curriculum || []).length;
                          const thumb = crs.thumbnailUrl || crs.coverImage;
                          const crsTitle = crs.title || 'Untitled Course';

                          return (
                            <tr key={crs.id} className="hover:bg-slate-800/40 transition-colors group">
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden shrink-0 relative flex items-center justify-center">
                                    {thumb ? (
                                      <img
                                        src={thumb}
                                        alt={crsTitle}
                                        className="w-full h-full object-cover"
                                        referrerPolicy="no-referrer"
                                      />
                                    ) : (
                                      <GraduationCap className="w-5 h-5 text-slate-500" />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-white truncate max-w-xs group-hover:text-emerald-400 transition-colors">
                                        {crsTitle}
                                      </span>
                                      {isFeatured && (
                                        <span className="px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 text-[9px] font-bold uppercase tracking-wider border border-teal-500/30 flex items-center gap-0.5">
                                          <Star className="w-2.5 h-2.5 fill-current" />
                                          Featured
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[11px] text-slate-500 font-mono">
                                      /courses/{crs.slug}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <div className="space-y-1">
                                  <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 font-medium text-[11px] border border-emerald-500/20">
                                    {crs.level || 'All Levels'}
                                  </span>
                                  <div className="text-[11px] text-slate-400">{crs.deliveryMode || crs.format || 'Cohort-Based'}</div>
                                </div>
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <div className="space-y-0.5">
                                  <div className="font-mono text-slate-300">{modulesCount} Modules</div>
                                  <div className="text-[10px] text-slate-500">{crs.duration || '6 Weeks'}</div>
                                </div>
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap font-mono text-slate-200">
                                {crs.priceFormatted || (crs.price ? `₹${crs.price.toLocaleString('en-IN')}` : 'Enquire')}
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <button
                                  onClick={() => handleToggleCoursePublish(crs)}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                                    crs.status === 'published'
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
                                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
                                  }`}
                                  title="Click to toggle published status"
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${crs.status === 'published' ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                                  <span>{crs.status === 'published' ? 'Published' : 'Draft'}</span>
                                </button>
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {/* Toggle Featured */}
                                  <button
                                    onClick={() => handleToggleCourseFeatured(crs)}
                                    className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                      isFeatured
                                        ? 'bg-teal-500/20 border-teal-500/40 text-teal-300'
                                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                                    }`}
                                    title={isFeatured ? 'Remove from Featured' : 'Mark as Featured'}
                                  >
                                    <Star className={`w-3.5 h-3.5 ${isFeatured ? 'fill-teal-300' : ''}`} />
                                  </button>

                                  {/* View Page */}
                                  <button
                                    onClick={() => navigate(`/courses/${crs.slug}`)}
                                    className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 transition-colors cursor-pointer"
                                    title="View Course Page"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Edit Modal */}
                                  <button
                                    onClick={() => openEditCourseModal(crs)}
                                    className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
                                    title="Edit Course"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Delete */}
                                  <button
                                    onClick={() => setDeletingCourseId(crs.id)}
                                    className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer"
                                    title="Delete Course"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            }

            // Grid View
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map((crs) => {
                  const isFeatured = Boolean(crs.isFeatured ?? crs.featured);
                  const modulesCount = (crs.modules || crs.curriculum || []).length;
                  const thumb = crs.thumbnailUrl || crs.coverImage;
                  const crsTitle = crs.title || 'Untitled Course';

                  return (
                    <div
                      key={crs.id}
                      className="group rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 p-5 flex flex-col justify-between space-y-4 transition-all shadow-md"
                    >
                      <div className="space-y-3">
                        {thumb && (
                          <div className="relative h-36 rounded-xl overflow-hidden bg-slate-800 border border-slate-700">
                            <img
                              src={thumb}
                              alt={crsTitle}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white">
                              {crs.level || 'All Levels'}
                            </span>
                            {isFeatured && (
                              <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500 text-white flex items-center gap-1">
                                <Star className="w-2.5 h-2.5 fill-current" />
                                Featured
                              </span>
                            )}
                          </div>
                        )}

                        <div className="flex items-center justify-between text-xs">
                          <span className="text-emerald-400 font-mono text-[11px] font-semibold">
                            {modulesCount} Curriculum Modules • {crs.duration || 'Self-Paced'}
                          </span>
                          {crs.status === 'published' ? (
                            <span className="text-emerald-400 font-medium flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                              Published
                            </span>
                          ) : (
                            <span className="text-amber-400 font-medium flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                              Draft
                            </span>
                          )}
                        </div>

                        <h3 className="text-base font-display font-bold text-white group-hover:text-emerald-400 transition-colors line-clamp-2">
                          {crsTitle}
                        </h3>

                        {crs.tagline && (
                          <p className="text-xs text-emerald-200 font-medium line-clamp-1">
                            {crs.tagline}
                          </p>
                        )}

                        <p className="text-xs text-slate-400 line-clamp-2">
                          {crs.description}
                        </p>

                        <div className="pt-2 flex items-center justify-between text-xs">
                          <span className="font-mono text-emerald-300 font-bold">
                            {crs.priceFormatted || (crs.price ? `₹${crs.price.toLocaleString('en-IN')}` : 'Enquire')}
                          </span>
                          <span className="text-slate-500 text-[11px]">
                            {crs.deliveryMode || 'Cohort Program'}
                          </span>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                          /courses/{crs.slug}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => navigate(`/courses/${crs.slug}`)}
                            className="text-slate-300 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs transition-colors"
                          >
                            Preview
                          </button>
                          <button
                            onClick={() => openEditCourseModal(crs)}
                            className="text-emerald-400 hover:text-emerald-300 p-1"
                            title="Edit Course"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeletingCourseId(crs.id)}
                            className="text-rose-400 hover:text-rose-300 p-1"
                            title="Delete Course"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* ========================================================================= */}
      {/* COURSE EDITOR MODAL */}
      {/* ========================================================================= */}
      <CourseEditorModal
        isOpen={isCourseModalOpen}
        initialCourse={selectedCourseForEdit}
        onClose={() => {
          setIsCourseModalOpen(false);
          setSelectedCourseForEdit(null);
        }}
        onSave={handleSaveCourseModal}
        onUnpublish={handleUnpublishCourseModal}
        isSaving={isSavingCourse}
        availableFrameworks={frameworks}
        availableArticles={articles}
        availableVideos={videos}
        availableResources={resources}
      />

      {/* ========================================================================= */}
      {/* DELETE COURSE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {deletingCourseId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-5 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-white">Delete this course?</h3>
              <p className="text-xs text-slate-400">
                This will remove the course curriculum, modules, and public details from the database. This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setDeletingCourseId(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const id = deletingCourseId;
                  setDeletingCourseId(null);
                  if (id) {
                    await deleteCourse(id);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-rose-500/20 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
