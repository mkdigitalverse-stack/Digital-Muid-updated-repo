import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, getSupabaseConfigStatus } from '../lib/supabase';
import {
  bookingService,
  leadService,
  subscriberService,
  contactService,
  consultationProductService,
  availabilityService,
  settingsService,
  articleService,
  videoService,
  resourceService,
  frameworkService,
  frameworkCategoryService,
  courseService,
  profileService,
  authService,
  enrollmentService,
  progressService,
  notificationService,
  bookmarkService,
  certificateService,
  paymentService,
  courseWishlistService,
  webEnquiryService,
  extractYouTubeVideoId,
  getYouTubeEmbedUrl,
  getYouTubeThumbnail,
  slugify
} from '../services';
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
  ContactMessage,
  NewsletterSubscriber,
  SiteSettings,
  UserProfile,
  AuthRole,
  StudentEnrollmentWithCourse,
  LessonProgress,
  CourseProgressSummary,
  UserNotification,
  BookmarkContentType,
  StudentBookmark,
  Certificate,
  PaymentRecord,
  WebEnquiry,
  WebEnquiryStatus
} from '../types';
import {
  INITIAL_ARTICLES,
  INITIAL_VIDEOS,
  INITIAL_FRAMEWORKS,
  INITIAL_FRAMEWORK_CATEGORIES,
  INITIAL_RESOURCES,
  INITIAL_COURSES,
  INITIAL_TESTIMONIALS,
  INITIAL_SPEAKING_EVENTS,
  INITIAL_CONSULTATION_PRODUCT,
  INITIAL_AVAILABILITY_RULES,
  INITIAL_BOOKINGS,
  INITIAL_LEADS,
  INITIAL_SETTINGS
} from '../data/initialData';

interface AppContextType {
  // Content collections
  articles: Article[];
  refreshArticles: () => Promise<void>;
  addArticle: (article: Partial<Article>) => Promise<{ data: Article | null; error: any }>;
  updateArticle: (id: string, article: Partial<Article>) => Promise<{ data: Article | null; error: any }>;
  deleteArticle: (id: string) => Promise<{ success: boolean; error: any }>;
  publishArticle: (id: string) => Promise<{ data: Article | null; error: any }>;
  unpublishArticle: (id: string) => Promise<{ data: Article | null; error: any }>;

  videos: Video[];
  refreshVideos: () => Promise<void>;
  addVideo: (video: Partial<Video>) => Promise<{ data: Video | null; error: any }>;
  updateVideo: (id: string, video: Partial<Video>) => Promise<{ data: Video | null; error: any }>;
  deleteVideo: (id: string) => Promise<{ success: boolean; error: any }>;
  publishVideo: (id: string) => Promise<{ data: Video | null; error: any }>;
  unpublishVideo: (id: string) => Promise<{ data: Video | null; error: any }>;

  frameworks: Framework[];
  frameworksLoading: boolean;
  refreshFrameworks: () => Promise<void>;
  addFramework: (fw: Partial<Framework>) => Promise<{ data: Framework | null; error: any }>;
  updateFramework: (id: string, fw: Partial<Framework>) => Promise<{ data: Framework | null; error: any }>;
  deleteFramework: (id: string) => Promise<{ success: boolean; error: any }>;
  publishFramework: (id: string) => Promise<{ data: Framework | null; error: any }>;
  unpublishFramework: (id: string) => Promise<{ data: Framework | null; error: any }>;
  toggleFeatureFramework: (id: string, isFeatured: boolean) => Promise<{ data: Framework | null; error: any }>;
  syncInitialFrameworks: () => Promise<{
    totalCount: number;
    importedCount: number;
    alreadyExistingCount: number;
    failedCount: number;
    results: any[];
  }>;

  // Framework Categories
  frameworkCategories: FrameworkCategory[];
  refreshFrameworkCategories: () => Promise<void>;
  addFrameworkCategory: (category: Partial<FrameworkCategory>) => Promise<{ data: FrameworkCategory | null; error: any }>;
  updateFrameworkCategory: (id: string, category: Partial<FrameworkCategory>) => Promise<{ data: FrameworkCategory | null; error: any }>;
  deleteFrameworkCategory: (id: string) => Promise<{ success: boolean; error: any }>;
  toggleFrameworkCategoryStatus: (id: string, isActive: boolean) => Promise<{ data: FrameworkCategory | null; error: any }>;
  reorderFrameworkCategories: (orderedIds: string[]) => Promise<{ success: boolean; error: any }>;

  resources: Resource[];
  refreshResources: () => Promise<void>;
  addResource: (res: Partial<Resource>) => Promise<{ data: Resource | null; error: any }>;
  updateResource: (id: string, res: Partial<Resource>) => Promise<{ data: Resource | null; error: any }>;
  deleteResource: (id: string) => Promise<{ success: boolean; error: any }>;
  publishResource: (id: string) => Promise<{ data: Resource | null; error: any }>;
  unpublishResource: (id: string) => Promise<{ data: Resource | null; error: any }>;
  recordResourceDownload: (
    resourceId: string,
    email: string,
    name?: string,
    mobile?: string,
    profession?: string
  ) => Promise<{ success: boolean; error?: any }>;

  courses: Course[];
  coursesLoading: boolean;
  refreshCourses: () => Promise<void>;
  addCourse: (course: Partial<Course>) => Promise<{ data: Course | null; error: any }>;
  updateCourse: (id: string, course: Partial<Course>) => Promise<{ data: Course | null; error: any }>;
  deleteCourse: (id: string) => Promise<{ success: boolean; error: any }>;
  publishCourse: (id: string) => Promise<{ data: Course | null; error: any }>;
  unpublishCourse: (id: string) => Promise<{ data: Course | null; error: any }>;
  syncInitialCourses: () => Promise<{
    totalCount: number;
    importedCount: number;
    alreadyExistingCount: number;
    failedCount: number;
    results: any[];
  }>;

  testimonials: Testimonial[];
  addTestimonial: (t: Omit<Testimonial, 'id'>) => void;
  deleteTestimonial: (id: string) => void;

  speakingEvents: SpeakingEvent[];
  addSpeakingEvent: (event: Omit<SpeakingEvent, 'id'>) => void;
  deleteSpeakingEvent: (id: string) => void;

  // Consultation & Availability
  consultationProduct: ConsultationProduct;
  updateConsultationProduct: (prod: Partial<ConsultationProduct>) => Promise<{ success: boolean; error?: any }>;
  availabilityRules: AvailabilityRules;
  updateAvailabilityRules: (rules: Partial<AvailabilityRules>) => Promise<{ success: boolean; error?: any }>;
  refreshAvailabilityRules: () => Promise<AvailabilityRules | null>;

  // Bookings
  bookings: Booking[];
  getAvailableSlotsForDate: (dateStr: string) => string[];
  fetchLiveAvailableSlots: (dateStr: string) => Promise<string[]>;
  createBooking: (bookingData: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    businessName: string;
    primaryChallenge: string;
    desiredOutcome: string;
    website?: string;
    linkedin?: string;
    date: string;
    time: string;
    paymentId?: string;
  }) => Promise<{ success: boolean; booking?: Booking; error?: string }>;
  cancelBooking: (id: string, reason?: string) => boolean;
  rescheduleBooking: (id: string, newDate: string, newTime: string) => boolean;
  updateBookingStatus: (id: string, status: Booking['status']) => void;
  deleteBooking: (id: string) => void;

  // Leads & Contact Messages
  leads: Lead[];
  addLead: (lead: Omit<Lead, 'id' | 'createdAt'>) => void;
  submitContactMessage: (msg: {
    name: string;
    email: string;
    phone?: string;
    inquiryType: string;
    message: string;
  }) => void;
  updateLeadStatus: (id: string, status: Lead['status'], notes?: string) => void;
  deleteLead: (id: string) => void;

  contactMessages: ContactMessage[];
  deleteContactMessage: (id: string) => void;

  // Subscribers
  subscribers: NewsletterSubscriber[];
  addSubscriber: (email: string, name?: string, source?: string) => boolean;
  deleteSubscriber: (id: string) => void;

  // Platform Settings & Supabase Admin Auth
  settings: SiteSettings;
  updateSettings: (settings: Partial<SiteSettings>) => void;
  refreshDashboardData: () => Promise<void>;
  adminUser: User | null;
  adminSession: Session | null;
  isAdminAuthenticated: boolean;
  isAuthLoading: boolean;
  adminLogin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  adminLogout: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;

  // Student & User Authentication (Phase 1B)
  currentUser: User | null;
  currentSession: Session | null;
  userProfile: UserProfile | null;
  isStudentAuthenticated: boolean;
  authRole: AuthRole;
  studentLogin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  studentRegister: (email: string, password: string, fullName: string) => Promise<{ success: boolean; error?: string }>;
  studentLogout: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  updateStudentProfile: (updates: Partial<UserProfile>) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;

  // Student Course Enrollments & Learning Progress (Phase 2A)
  studentEnrollments: StudentEnrollmentWithCourse[];
  isEnrollmentsLoading: boolean;
  enrollmentsError: string | null;
  refreshStudentEnrollments: () => Promise<void>;
  courseProgressMap: Record<string, LessonProgress[]>;
  isProgressLoading: boolean;
  fetchCourseProgress: (courseId: string) => Promise<LessonProgress[]>;
  updateLessonPlaybackPosition: (courseId: string, lessonId: string, seconds: number) => Promise<boolean>;
  toggleLessonProgressCompletion: (courseId: string, lessonId: string, completed: boolean) => Promise<boolean>;
  getCourseProgressStats: (course: Course) => CourseProgressSummary;

  // Student Consultation Bookings (Phase 2D)
  studentBookings: Booking[];
  isBookingsLoading: boolean;
  bookingsError: string | null;
  refreshStudentBookings: () => Promise<void>;

  // Student Notifications (Phase 2F)
  studentNotifications: UserNotification[];
  isNotificationsLoading: boolean;
  unreadNotificationsCount: number;
  fetchStudentNotifications: (overrideUserId?: string) => Promise<void>;
  markNotificationAsRead: (id: string) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;

  // Student Bookmarks & Saved Content (Phase 2H)
  studentBookmarks: StudentBookmark[];
  isBookmarksLoading: boolean;
  fetchStudentBookmarks: (overrideUserId?: string) => Promise<void>;
  isBookmarked: (contentType: BookmarkContentType, contentId: string) => boolean;
  toggleBookmark: (contentType: BookmarkContentType, contentId: string) => Promise<boolean>;

  // Student Course Wishlist (Phase 4A)
  courseWishlist: string[];
  isWishlistLoading: boolean;
  refreshCourseWishlist: (overrideUserId?: string) => Promise<void>;
  isCourseWishlisted: (courseId: string) => boolean;
  toggleCourseWishlist: (courseId: string) => Promise<{ added: boolean; success: boolean }>;
  removeFromWishlist: (courseId: string) => Promise<boolean>;

  // Student Course Certificates (Phase 2I)
  studentCertificates: Certificate[];
  isCertificatesLoading: boolean;
  certificatesError: string | null;
  fetchStudentCertificates: (overrideUserId?: string) => Promise<Certificate[]>;
  issueCourseCertificate: (courseId: string, courseTitle: string) => Promise<{ success: boolean; certificate?: Certificate; error?: string }>;
  getCertificateForCourse: (courseId: string) => Certificate | undefined;

  // Student Billing & Payment History (Phase 2J)
  studentPayments: PaymentRecord[];
  isPaymentsLoading: boolean;
  paymentsError: string | null;
  fetchStudentPayments: (overrideUserId?: string) => Promise<PaymentRecord[]>;

  // Admin / CRM Payment Ledger
  adminPayments: PaymentRecord[];
  isAdminPaymentsLoading: boolean;
  adminPaymentsError: string | null;
  fetchAdminPayments: () => Promise<PaymentRecord[]>;

  // Web Enquiries (CRM)
  webEnquiries: WebEnquiry[];
  isWebEnquiriesLoading: boolean;
  webEnquiriesError: string | null;
  fetchAdminWebEnquiries: () => Promise<WebEnquiry[]>;
  updateWebEnquiry: (
    id: string,
    updates: {
      status?: WebEnquiryStatus;
      internalNotes?: string;
      assignedTo?: string;
      followUpDate?: string;
      contactAttempts?: number;
    }
  ) => Promise<{ success: boolean; data?: WebEnquiry; error?: any }>;
  deleteWebEnquiry: (id: string) => Promise<{ success: boolean; error?: any }>;


  // Global search & UI
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Toast / Notifications
  notification: { message: string; type: 'success' | 'error' | 'info' } | null;
  notify: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_PREFIX = 'digital_muid_v1_';

function getStoredItem<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(STORAGE_PREFIX + key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}

function setStoredItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.error('Failed saving to localStorage', e);
  }
}

// RFC4122 v4 UUID generator compatible with PostgreSQL UUID and TEXT primary keys
export const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Helper to normalize time slots across 12-hour (e.g. "04:00 PM IST", "4:00 PM") and 24-hour (e.g. "16:00") formats
export const normalizeTimeSlot = (t: string): string => {
  if (!t) return '';
  const cleaned = t.replace(/\s*IST\s*$/i, '').trim();
  const match12 = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let h = parseInt(match12[1], 10);
    const m = match12[2];
    const ampm = match12[3].toUpperCase();
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return `${h.toString().padStart(2, '0')}:${m}`;
  }
  const match24 = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const h = parseInt(match24[1], 10);
    const m = match24[2];
    return `${h.toString().padStart(2, '0')}:${m}`;
  }
  return cleaned;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [articles, setArticles] = useState<Article[]>(() => {
    const stored = getStoredItem<Article[]>('articles', INITIAL_ARTICLES);
    return Array.isArray(stored) && stored.length > 0 ? stored : INITIAL_ARTICLES;
  });
  const [videos, setVideos] = useState<Video[]>(() => {
    const stored = getStoredItem<Video[]>('videos', INITIAL_VIDEOS);
    return Array.isArray(stored) && stored.length > 0 ? stored : INITIAL_VIDEOS;
  });
  const [frameworks, setFrameworks] = useState<Framework[]>(() => {
    const stored = getStoredItem<Framework[]>('frameworks', INITIAL_FRAMEWORKS);
    return Array.isArray(stored) && stored.length > 0 ? stored : INITIAL_FRAMEWORKS;
  });
  const [frameworksLoading, setFrameworksLoading] = useState<boolean>(false);
  const [frameworkCategories, setFrameworkCategories] = useState<FrameworkCategory[]>(() => {
    const stored = getStoredItem<FrameworkCategory[]>('framework_categories', INITIAL_FRAMEWORK_CATEGORIES);
    return Array.isArray(stored) && stored.length > 0 ? stored : INITIAL_FRAMEWORK_CATEGORIES;
  });
  const [resources, setResources] = useState<Resource[]>(() => {
    const stored = getStoredItem<Resource[]>('resources', INITIAL_RESOURCES);
    return Array.isArray(stored) && stored.length > 0 ? stored : INITIAL_RESOURCES;
  });
  const [courses, setCourses] = useState<Course[]>(() => getStoredItem('courses', INITIAL_COURSES));
  const [coursesLoading, setCoursesLoading] = useState<boolean>(false);
  const [testimonials, setTestimonials] = useState<Testimonial[]>(() => getStoredItem('testimonials', INITIAL_TESTIMONIALS));
  const [speakingEvents, setSpeakingEvents] = useState<SpeakingEvent[]>(() => getStoredItem('speaking', INITIAL_SPEAKING_EVENTS));
  const [consultationProduct, setConsultationProduct] = useState<ConsultationProduct>(() => getStoredItem('consultation_prod', INITIAL_CONSULTATION_PRODUCT));
  const [availabilityRules, setAvailabilityRules] = useState<AvailabilityRules>(() => getStoredItem('availability', INITIAL_AVAILABILITY_RULES));
  const [bookings, setBookings] = useState<Booking[]>(() => getStoredItem('bookings', INITIAL_BOOKINGS));
  const [leads, setLeads] = useState<Lead[]>(() => getStoredItem('leads', INITIAL_LEADS));
  const [contactMessages, setContactMessages] = useState<ContactMessage[]>(() => getStoredItem('contact_messages', []));
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>(() => getStoredItem('subscribers', []));
  const [settings, setSettings] = useState<SiteSettings>(() => getStoredItem('settings', INITIAL_SETTINGS));

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isStudentAuthenticated, setIsStudentAuthenticated] = useState<boolean>(false);
  const [authRole, setAuthRole] = useState<AuthRole>('guest');

  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [adminSession, setAdminSession] = useState<Session | null>(null);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  // Student Course Enrollments & Learning Progress (Phase 2A)
  const [studentEnrollments, setStudentEnrollments] = useState<StudentEnrollmentWithCourse[]>([]);
  const [isEnrollmentsLoading, setIsEnrollmentsLoading] = useState<boolean>(false);
  const [enrollmentsError, setEnrollmentsError] = useState<string | null>(null);
  const [courseProgressMap, setCourseProgressMap] = useState<Record<string, LessonProgress[]>>({});
  const [isProgressLoading, setIsProgressLoading] = useState<boolean>(false);

  // Student Consultation Bookings (Phase 2D)
  const [studentBookings, setStudentBookings] = useState<Booking[]>([]);
  const [isBookingsLoading, setIsBookingsLoading] = useState<boolean>(false);
  const [bookingsError, setBookingsError] = useState<string | null>(null);

  // Student Notifications (Phase 2F)
  const [studentNotifications, setStudentNotifications] = useState<UserNotification[]>([]);
  const [isNotificationsLoading, setIsNotificationsLoading] = useState<boolean>(false);

  const unreadNotificationsCount = useMemo(() => {
    return studentNotifications.filter((n) => !n.isRead).length;
  }, [studentNotifications]);

  const fetchStudentNotifications = useCallback(async (overrideUserId?: string): Promise<void> => {
    const targetUserId = overrideUserId || currentUser?.id;
    if (!targetUserId || !isSupabaseConfigured()) {
      setStudentNotifications([]);
      setIsNotificationsLoading(false);
      return;
    }

    setIsNotificationsLoading(true);
    try {
      const notifs = await notificationService.getStudentNotifications(targetUserId);
      setStudentNotifications(notifs || []);
    } catch (err) {
      console.error('[AppContext] Error fetching student notifications:', err);
      setStudentNotifications([]);
    } finally {
      setIsNotificationsLoading(false);
    }
  }, [currentUser?.id]);

  const markNotificationAsRead = useCallback(async (id: string): Promise<void> => {
    if (!id || !currentUser?.id) return;

    // Optimistic local update
    setStudentNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );

    try {
      await notificationService.markAsRead(id, currentUser.id);
    } catch (err) {
      console.error('[AppContext] Failed to mark notification as read:', err);
      if (currentUser?.id) {
        fetchStudentNotifications(currentUser.id);
      }
    }
  }, [currentUser?.id, fetchStudentNotifications]);

  const markAllNotificationsAsRead = useCallback(async (): Promise<void> => {
    if (!currentUser?.id) return;

    // Optimistic local update
    setStudentNotifications((prev) =>
      prev.map((n) => ({ ...n, isRead: true }))
    );

    try {
      await notificationService.markAllAsRead(currentUser.id);
    } catch (err) {
      console.error('[AppContext] Failed to mark all notifications as read:', err);
      if (currentUser?.id) {
        fetchStudentNotifications(currentUser.id);
      }
    }
  }, [currentUser?.id, fetchStudentNotifications]);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const notify = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // Student Bookmarks & Saved Content (Phase 2H)
  const [studentBookmarks, setStudentBookmarks] = useState<StudentBookmark[]>([]);
  const [isBookmarksLoading, setIsBookmarksLoading] = useState<boolean>(false);

  const fetchStudentBookmarks = useCallback(async (overrideUserId?: string): Promise<void> => {
    const targetUserId = overrideUserId || currentUser?.id;
    if (!targetUserId) {
      setStudentBookmarks([]);
      setIsBookmarksLoading(false);
      return;
    }

    setIsBookmarksLoading(true);
    try {
      const res = await bookmarkService.fetchUserBookmarks(targetUserId);
      if (res.data) {
        setStudentBookmarks(res.data);
      }
    } catch (err) {
      console.error('[AppContext] Error fetching student bookmarks:', err);
      setStudentBookmarks([]);
    } finally {
      setIsBookmarksLoading(false);
    }
  }, [currentUser?.id]);

  const isBookmarked = useCallback(
    (contentType: BookmarkContentType, contentId: string): boolean => {
      const cleanId = String(contentId).trim();
      return studentBookmarks.some(
        (b) => b.contentType === contentType && b.contentId === cleanId
      );
    },
    [studentBookmarks]
  );

  const toggleBookmark = useCallback(
    async (contentType: BookmarkContentType, contentId: string): Promise<boolean> => {
      if (!currentUser?.id) {
        notify('Please sign in to save items to your student portal.', 'info');
        return false;
      }

      const cleanId = String(contentId).trim();
      if (!cleanId) return false;

      const wasBookmarked = studentBookmarks.some(
        (b) => b.contentType === contentType && b.contentId === cleanId
      );

      // Optimistic local state update
      if (wasBookmarked) {
        setStudentBookmarks((prev) =>
          prev.filter((b) => !(b.contentType === contentType && b.contentId === cleanId))
        );
      } else {
        const optimisticBookmark: StudentBookmark = {
          id: `temp-${Date.now()}`,
          userId: currentUser.id,
          contentType,
          contentId: cleanId,
          createdAt: new Date().toISOString()
        };
        setStudentBookmarks((prev) => [optimisticBookmark, ...prev]);
      }

      try {
        // Pass wasBookmarked explicitly so bookmarkService does not rely on device-specific localStorage
        const res = await bookmarkService.toggleBookmark(
          contentType,
          cleanId,
          currentUser.id,
          wasBookmarked
        );

        if (res.error) {
          console.warn('[AppContext] Failed to persist bookmark toggle:', res.error);
          if (currentUser?.id) {
            await fetchStudentBookmarks(currentUser.id);
          }
          notify('Could not update saved items. Please try again.', 'error');
          return wasBookmarked;
        }

        // On successful insert, replace the temporary bookmark with authoritative record
        if (res.bookmarked && res.data) {
          const persistedBookmark = res.data;
          setStudentBookmarks((prev) =>
            prev.map((b) =>
              b.contentType === contentType && b.contentId === cleanId ? persistedBookmark : b
            )
          );
        }

        notify(
          res.bookmarked ? 'Saved to your student portal.' : 'Removed from saved items.',
          'success'
        );
        return res.bookmarked;
      } catch (err) {
        console.error('[AppContext] Failed to toggle bookmark:', err);
        if (currentUser?.id) {
          await fetchStudentBookmarks(currentUser.id);
        }
        notify('Could not update saved items. Please try again.', 'error');
        return wasBookmarked;
      }
    },
    [currentUser?.id, studentBookmarks, fetchStudentBookmarks, notify]
  );

  // Student Course Wishlist (Phase 4A)
  const [courseWishlist, setCourseWishlist] = useState<string[]>([]);
  const [isWishlistLoading, setIsWishlistLoading] = useState<boolean>(false);

  const refreshCourseWishlist = useCallback(async (overrideUserId?: string): Promise<void> => {
    const targetUserId = overrideUserId || currentUser?.id;
    if (!targetUserId) {
      setCourseWishlist([]);
      setIsWishlistLoading(false);
      return;
    }

    setIsWishlistLoading(true);
    try {
      const res = await courseWishlistService.fetchCourseWishlist(targetUserId);
      if (res.data) {
        setCourseWishlist(res.data.map((item) => item.courseId));
      }
    } catch (err) {
      console.error('[AppContext] Error fetching course wishlist:', err);
      setCourseWishlist([]);
    } finally {
      setIsWishlistLoading(false);
    }
  }, [currentUser?.id]);

  const isCourseWishlisted = useCallback(
    (courseId: string): boolean => {
      const cleanId = String(courseId || '').trim();
      if (!cleanId) return false;
      if (courseWishlist.includes(cleanId)) return true;

      const matched =
        courses.find((c) => c.id === cleanId || c.slug === cleanId) ||
        INITIAL_COURSES.find((c) => c.id === cleanId || c.slug === cleanId);

      if (matched) {
        if (matched.id && courseWishlist.includes(matched.id)) return true;
        if (matched.slug && courseWishlist.includes(matched.slug)) return true;
      }
      return false;
    },
    [courseWishlist, courses]
  );

  const toggleCourseWishlist = useCallback(
    async (courseId: string): Promise<{ added: boolean; success: boolean }> => {
      if (!currentUser?.id) {
        notify('Please sign in to save courses to your wishlist.', 'info');
        return { added: false, success: false };
      }

      const cleanId = String(courseId || '').trim();
      if (!cleanId) return { added: false, success: false };

      const matchedCourse =
        courses.find((c) => c.id === cleanId || c.slug === cleanId) ||
        INITIAL_COURSES.find((c) => c.id === cleanId || c.slug === cleanId);

      const alreadyWishlisted = isCourseWishlisted(cleanId);
      const idsToRemove = Array.from(
        new Set([cleanId, matchedCourse?.id, matchedCourse?.slug].filter(Boolean) as string[])
      );

      // Optimistic local state update
      if (alreadyWishlisted) {
        setCourseWishlist((prev) => prev.filter((id) => !idsToRemove.includes(id)));
      } else {
        setCourseWishlist((prev) => [cleanId, ...prev]);
      }

      try {
        if (alreadyWishlisted) {
          const res = await courseWishlistService.removeCourseFromWishlist(currentUser.id, cleanId);
          if (!res.success) {
            console.warn('[AppContext] Failed to remove course from wishlist:', res.error);
            // Rollback optimistic update
            setCourseWishlist((prev) => [...prev, cleanId]);
            notify('Could not remove from wishlist. Please try again.', 'error');
            return { added: true, success: false };
          }
          notify('Course removed from wishlist.', 'success');
          return { added: false, success: true };
        } else {
          const res = await courseWishlistService.addCourseToWishlist(currentUser.id, cleanId);
          if (res.error) {
            console.warn('[AppContext] Failed to add course to wishlist:', res.error);
            // Rollback optimistic update
            setCourseWishlist((prev) => prev.filter((id) => !idsToRemove.includes(id)));
            notify(res.error.message || 'Could not add to wishlist. Please try again.', 'error');
            return { added: false, success: false };
          }

          if (res.data?.courseId && !courseWishlist.includes(res.data.courseId)) {
            setCourseWishlist((prev) => Array.from(new Set([...prev, res.data!.courseId])));
          }

          notify('Course saved to your wishlist.', 'success');
          return { added: true, success: true };
        }
      } catch (err) {
        console.error('[AppContext] Error toggling course wishlist:', err);
        // Resync authoritative state
        await refreshCourseWishlist(currentUser.id);
        notify('Could not update wishlist. Please try again.', 'error');
        return { added: alreadyWishlisted, success: false };
      }
    },
    [currentUser?.id, courses, isCourseWishlisted, notify, refreshCourseWishlist, courseWishlist]
  );

  const removeFromWishlist = useCallback(
    async (courseId: string): Promise<boolean> => {
      const res = await toggleCourseWishlist(courseId);
      return res.success && !res.added;
    },
    [toggleCourseWishlist]
  );

  // Student Course Certificates (Phase 2I)
  const [studentCertificates, setStudentCertificates] = useState<Certificate[]>([]);
  const [isCertificatesLoading, setIsCertificatesLoading] = useState<boolean>(false);
  const [certificatesError, setCertificatesError] = useState<string | null>(null);

  const fetchStudentCertificates = useCallback(async (overrideUserId?: string): Promise<Certificate[]> => {
    setIsCertificatesLoading(true);
    setCertificatesError(null);
    try {
      const res = await certificateService.fetchMyCertificates();
      if (res.error && (!res.data || res.data.length === 0)) {
        setCertificatesError(typeof res.error === 'string' ? res.error : res.error?.message || 'Error loading certificates');
      }
      setStudentCertificates(res.data || []);
      return res.data || [];
    } catch (err: any) {
      console.error('[AppContext] Error fetching student certificates:', err);
      setCertificatesError(err?.message || 'Error loading certificates');
      return [];
    } finally {
      setIsCertificatesLoading(false);
    }
  }, []);

  const issueCourseCertificate = useCallback(async (
    courseId: string,
    courseTitle: string
  ): Promise<{ success: boolean; certificate?: Certificate; error?: string }> => {
    try {
      const studentName = userProfile?.fullName || currentUser?.user_metadata?.full_name || currentUser?.email?.split('@')[0] || 'Student';
      const res = await certificateService.issueCertificate({
        courseId,
        courseTitle,
        recipientName: studentName
      });

      if (res.error || !res.data) {
        return { success: false, error: res.error || 'Failed to generate certificate.' };
      }

      setStudentCertificates((prev) => {
        const exists = prev.some((c) => c.id === res.data!.id || (c.courseId === courseId && c.userId === res.data!.userId));
        if (exists) {
          return prev.map((c) => (c.courseId === courseId ? res.data! : c));
        }
        return [res.data!, ...prev];
      });

      if (res.isNew) {
        notify('Congratulations! Official Certificate of Completion Issued!', 'success');
        // Refresh notifications to include the new certificate notification
        if (currentUser?.id) {
          fetchStudentNotifications(currentUser.id);
        }
      }

      return { success: true, certificate: res.data };
    } catch (err: any) {
      console.error('[AppContext] Error issuing course certificate:', err);
      return { success: false, error: err?.message || 'Failed to issue certificate.' };
    }
  }, [userProfile?.fullName, currentUser, notify, fetchStudentNotifications]);

  const getCertificateForCourse = useCallback((courseId: string): Certificate | undefined => {
    return studentCertificates.find((c) => c.courseId === courseId);
  }, [studentCertificates]);

  // Student Billing & Payment History (Phase 2J)
  const [studentPayments, setStudentPayments] = useState<PaymentRecord[]>([]);
  const [isPaymentsLoading, setIsPaymentsLoading] = useState<boolean>(false);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);

  const fetchStudentPayments = useCallback(async (_overrideUserId?: string): Promise<PaymentRecord[]> => {
    setIsPaymentsLoading(true);
    setPaymentsError(null);
    try {
      const res = await paymentService.fetchMyPayments();
      if (res.error && (!res.data || res.data.length === 0)) {
        setPaymentsError(typeof res.error === 'string' ? res.error : res.error?.message || 'Error loading billing history');
      }
      setStudentPayments(res.data || []);
      return res.data || [];
    } catch (err: any) {
      console.error('[AppContext] Error fetching student payments:', err);
      setPaymentsError(err?.message || 'Error loading billing history');
      return [];
    } finally {
      setIsPaymentsLoading(false);
    }
  }, []);

  const [adminPayments, setAdminPayments] = useState<PaymentRecord[]>([]);
  const [isAdminPaymentsLoading, setIsAdminPaymentsLoading] = useState<boolean>(false);
  const [adminPaymentsError, setAdminPaymentsError] = useState<string | null>(null);

  const fetchAdminPayments = useCallback(async (): Promise<PaymentRecord[]> => {
    setIsAdminPaymentsLoading(true);
    setAdminPaymentsError(null);
    try {
      const res = await paymentService.fetchAllPaymentsForAdmin();
      if (res.error && (!res.data || res.data.length === 0)) {
        setAdminPaymentsError(typeof res.error === 'string' ? res.error : res.error?.message || 'Error loading payment ledger');
      }
      setAdminPayments(res.data || []);
      return res.data || [];
    } catch (err: any) {
      console.error('[AppContext] Error fetching admin payments:', err);
      setAdminPaymentsError(err?.message || 'Error loading payment ledger');
      return [];
    } finally {
      setIsAdminPaymentsLoading(false);
    }
  }, []);

  // Web Enquiries State & Operations
  const [webEnquiries, setWebEnquiries] = useState<WebEnquiry[]>([]);
  const [isWebEnquiriesLoading, setIsWebEnquiriesLoading] = useState<boolean>(false);
  const [webEnquiriesError, setWebEnquiriesError] = useState<string | null>(null);

  const fetchAdminWebEnquiries = useCallback(async (): Promise<WebEnquiry[]> => {
    setIsWebEnquiriesLoading(true);
    setWebEnquiriesError(null);
    try {
      const res = await webEnquiryService.fetchAdminWebEnquiries();
      if (res.error && (!res.data || res.data.length === 0)) {
        setWebEnquiriesError(typeof res.error === 'string' ? res.error : res.error?.message || 'Error loading web enquiries');
      }
      setWebEnquiries(res.data || []);
      return res.data || [];
    } catch (err: any) {
      console.error('[AppContext] Error fetching admin web enquiries:', err);
      setWebEnquiriesError(err?.message || 'Error loading web enquiries');
      return [];
    } finally {
      setIsWebEnquiriesLoading(false);
    }
  }, []);

  const updateWebEnquiry = useCallback(
    async (
      id: string,
      updates: {
        status?: WebEnquiryStatus;
        internalNotes?: string;
        assignedTo?: string;
        followUpDate?: string;
        contactAttempts?: number;
      }
    ): Promise<{ success: boolean; data?: WebEnquiry; error?: any }> => {
      try {
        const res = await webEnquiryService.updateWebEnquiry(id, updates);
        if (res.success && res.data) {
          setWebEnquiries((prev) =>
            prev.map((item) => (item.id === id ? res.data! : item))
          );
        }
        return res;
      } catch (err: any) {
        console.error('[AppContext] Error updating web enquiry:', err);
        return { success: false, error: err };
      }
    },
    []
  );

  const deleteWebEnquiry = useCallback(
    async (id: string): Promise<{ success: boolean; error?: any }> => {
      try {
        const res = await webEnquiryService.deleteWebEnquiry(id);
        if (res.success) {
          setWebEnquiries((prev) => prev.filter((item) => item.id !== id));
        }
        return res;
      } catch (err: any) {
        console.error('[AppContext] Error deleting web enquiry:', err);
        return { success: false, error: err };
      }
    },
    []
  );


  const refreshStudentEnrollments = useCallback(async (): Promise<void> => {
    if (!isSupabaseConfigured()) {
      setStudentEnrollments([]);
      setIsEnrollmentsLoading(false);
      return;
    }

    setIsEnrollmentsLoading(true);
    setEnrollmentsError(null);
    try {
      const res = await enrollmentService.fetchMyEnrollments();
      if (res.error) {
        setEnrollmentsError(typeof res.error === 'string' ? res.error : res.error?.message || 'Failed to load enrollments');
      } else {
        setStudentEnrollments(res.data || []);
      }
    } catch (err: any) {
      console.error('[AppContext] Failed to refresh student enrollments:', err);
      setEnrollmentsError(err?.message || 'Error loading enrollments');
    } finally {
      setIsEnrollmentsLoading(false);
    }
  }, []);

  const refreshStudentBookings = useCallback(async (): Promise<void> => {
    if (!isSupabaseConfigured()) {
      setStudentBookings([]);
      setIsBookingsLoading(false);
      return;
    }

    setIsBookingsLoading(true);
    setBookingsError(null);
    try {
      const res = await bookingService.fetchMyBookings();
      if (res.error) {
        setBookingsError(typeof res.error === 'string' ? res.error : res.error?.message || 'Failed to load consultation bookings');
      } else {
        setStudentBookings(res.data || []);
      }
    } catch (err: any) {
      console.error('[AppContext] Failed to refresh student bookings:', err);
      setBookingsError(err?.message || 'Error loading consultation bookings');
    } finally {
      setIsBookingsLoading(false);
    }
  }, []);

  // Unified Session Resolution: Differentiates verified Administrators from normal Students
  const handleSessionResolution = useCallback(async (session: Session | null) => {
    if (!session || !session.user) {
      setCurrentSession(null);
      setCurrentUser(null);
      setUserProfile(null);
      setAdminSession(null);
      setAdminUser(null);
      setIsAdminAuthenticated(false);
      setIsStudentAuthenticated(false);
      setAuthRole('guest');
      setStudentEnrollments([]);
      setCourseProgressMap({});
      setEnrollmentsError(null);
      setStudentBookings([]);
      setBookingsError(null);
      setStudentNotifications([]);
      setIsNotificationsLoading(false);
      setStudentBookmarks([]);
      setIsBookmarksLoading(false);
      setStudentCertificates([]);
      setIsCertificatesLoading(false);
      setCertificatesError(null);
      setStudentPayments([]);
      setIsPaymentsLoading(false);
      setPaymentsError(null);
      setCourseWishlist([]);
      setIsWishlistLoading(false);
      return;
    }

    setCurrentSession(session);
    setCurrentUser(session.user);

    // Strictly verify administrative status against Supabase RPC / authorized claims
    const isAdmin = await authService.checkIsAdmin(session.user);

    if (isAdmin) {
      setAdminSession(session);
      setAdminUser(session.user);
      setIsAdminAuthenticated(true);
      setIsStudentAuthenticated(true);
      setAuthRole('admin');
      profileService.fetchProfile(session.user.id).then((res) => {
        if (res.data) setUserProfile(res.data);
      }).catch(() => {});
    } else {
      setAdminSession(null);
      setAdminUser(null);
      setIsAdminAuthenticated(false);
      setIsStudentAuthenticated(true);
      setAuthRole('student');
      profileService.ensureProfile(session.user.id, {
        fullName: session.user.user_metadata?.full_name || session.user.user_metadata?.name
      }).then((res) => {
        if (res.data) setUserProfile(res.data);
      }).catch(() => {});
    }

    // Refresh student enrollments, bookings, notifications, bookmarks, wishlist, certificates, and billing for all authenticated sessions
    await Promise.all([
      refreshStudentEnrollments(),
      refreshStudentBookings(),
      fetchStudentNotifications(session.user.id),
      fetchStudentBookmarks(session.user.id),
      refreshCourseWishlist(session.user.id),
      fetchStudentCertificates(session.user.id),
      fetchStudentPayments(session.user.id)
    ]);
  }, [refreshStudentEnrollments, refreshStudentBookings, fetchStudentNotifications, fetchStudentBookmarks, refreshCourseWishlist, fetchStudentCertificates, fetchStudentPayments]);

  // Supabase Auth Session Initialization and Real-time State Listener
  useEffect(() => {
    // Purge any old client-side storage authentication bypass flags
    try {
      sessionStorage.removeItem('digital_muid_admin_auth');
      localStorage.removeItem('digital_muid_admin_auth');
    } catch {}

    let isMounted = true;

    // 1. If Supabase is not configured, complete auth loading safely without making network calls
    if (!isSupabaseConfigured()) {
      setIsAuthLoading(false);
      return;
    }

    // 2. Check existing active Supabase session
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (!isMounted) return;
      if (error) {
        console.warn('[Supabase Auth] Session fetch error:', error.message);
      }
      await handleSessionResolution(session);
      if (isMounted) setIsAuthLoading(false);
    }).catch(() => {
      if (isMounted) setIsAuthLoading(false);
    });

    // 3. Listen for auth state changes across tabs/sessions
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;
      await handleSessionResolution(session);
      if (isMounted) setIsAuthLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [handleSessionResolution]);

  // Sync to local storage
  useEffect(() => { setStoredItem('articles', articles); }, [articles]);
  useEffect(() => { setStoredItem('videos', videos); }, [videos]);
  useEffect(() => { setStoredItem('frameworks', frameworks); }, [frameworks]);
  useEffect(() => { setStoredItem('framework_categories', frameworkCategories); }, [frameworkCategories]);
  useEffect(() => { setStoredItem('resources', resources); }, [resources]);
  useEffect(() => { setStoredItem('courses', courses); }, [courses]);
  useEffect(() => { setStoredItem('testimonials', testimonials); }, [testimonials]);
  useEffect(() => { setStoredItem('speaking', speakingEvents); }, [speakingEvents]);
  useEffect(() => { setStoredItem('consultation_prod', consultationProduct); }, [consultationProduct]);
  useEffect(() => { setStoredItem('bookings', bookings); }, [bookings]);
  useEffect(() => { setStoredItem('leads', leads); }, [leads]);
  useEffect(() => { setStoredItem('contact_messages', contactMessages); }, [contactMessages]);
  useEffect(() => { setStoredItem('subscribers', subscribers); }, [subscribers]);
  useEffect(() => { setStoredItem('settings', settings); }, [settings]);

  // Synchronize and refresh availability rules on-demand directly from Supabase
  const refreshAvailabilityRules = useCallback(async (): Promise<AvailabilityRules | null> => {
    if (!isSupabaseConfigured()) return null;
    try {
      const { data, error } = await availabilityService.fetchAvailabilityRules();
      if (!error && data) {
        setAvailabilityRules(data);
        setStoredItem('availability', data);
        return data;
      }
      return null;
    } catch (err) {
      console.error('[Supabase Availability] Refresh error:', err);
      return null;
    }
  }, []);

  // Master Supabase Data Hydration (Supabase-first with LocalStorage Fallback)
  const refreshDashboardData = useCallback(async () => {
    if (!isSupabaseConfigured()) return;

    try {
      // 1. Fetch public platform configurations (accessible publicly without authentication)
      const [prodRes, availRes, setRes] = await Promise.allSettled([
        consultationProductService.fetchConsultationProduct(),
        availabilityService.fetchAvailabilityRules(),
        settingsService.fetchSiteSettings()
      ]);

      if (prodRes.status === 'fulfilled' && prodRes.value.data) {
        setConsultationProduct(prodRes.value.data);
      }
      if (availRes.status === 'fulfilled' && availRes.value.data) {
        setAvailabilityRules(availRes.value.data);
        setStoredItem('availability', availRes.value.data);
      }
      if (setRes.status === 'fulfilled' && setRes.value.data) {
        setSettings(setRes.value.data);
      }

      // 2. Check active Supabase authenticated session and admin privileges before querying RLS-restricted tables
      const { data: { session } } = await supabase.auth.getSession();
      const isUserAdmin = session?.user ? await authService.checkIsAdmin(session.user) : false;

      if (isUserAdmin) {
        setFrameworksLoading(true);
        setCoursesLoading(true);
        // Explicitly prioritize fresh live Supabase availability rules on initial admin data load
        refreshAvailabilityRules().catch(err => {
          console.error('[Admin Sync] Availability refresh failed:', err);
        });
        // Authenticated Admin Branch: Fetch complete admin collections in parallel with isolated error barriers
        const [bookingsRes, leadsRes, subsRes, contactRes, allArticlesRes, allVideosRes, allResourcesRes, allFrameworksRes, allCategoriesRes, allCoursesRes] = await Promise.allSettled([
          bookingService.fetchBookings(),
          leadService.fetchLeads(),
          subscriberService.fetchSubscribers(),
          contactService.fetchContactMessages(),
          articleService.fetchAllArticles(),
          videoService.fetchAllVideos(),
          resourceService.fetchAllResources(),
          frameworkService.fetchAllFrameworksAdmin(),
          frameworkCategoryService.fetchAllFrameworkCategoriesAdmin(),
          courseService.fetchAllCourses()
        ]);

        // Hydrate Bookings from public.bookings
        if (bookingsRes.status === 'fulfilled') {
          if (bookingsRes.value.data !== null && !bookingsRes.value.error) {
            setBookings(bookingsRes.value.data);
            console.info(`[Admin Sync] Bookings hydrated successfully: ${bookingsRes.value.data.length} records`);
          } else if (bookingsRes.value.error) {
            console.error('[Admin Sync] Failed to fetch bookings:', bookingsRes.value.error);
          }
        }

        // Hydrate CRM Leads
        if (leadsRes.status === 'fulfilled') {
          if (leadsRes.value.data !== null && !leadsRes.value.error) {
            setLeads(leadsRes.value.data);
          } else if (leadsRes.value.error) {
            console.error('[Admin Sync] Failed to fetch leads:', leadsRes.value.error);
          }
        }

        // Hydrate Newsletter Subscribers
        if (subsRes.status === 'fulfilled') {
          if (subsRes.value.data !== null && !subsRes.value.error) {
            setSubscribers(subsRes.value.data);
          } else if (subsRes.value.error) {
            console.error('[Admin Sync] Failed to fetch subscribers:', subsRes.value.error);
          }
        }

        // Hydrate Contact Messages
        if (contactRes.status === 'fulfilled') {
          if (contactRes.value.data !== null && !contactRes.value.error) {
            setContactMessages(contactRes.value.data);
          } else if (contactRes.value.error) {
            console.error('[Admin Sync] Failed to fetch contact messages:', contactRes.value.error);
          }
        }

        // Hydrate All Articles (Drafts + Published) for Admin CMS
        if (allArticlesRes.status === 'fulfilled') {
          if (allArticlesRes.value.data !== null && !allArticlesRes.value.error) {
            setArticles(allArticlesRes.value.data);
            console.info(`[Admin Sync] All articles hydrated from public.articles: ${allArticlesRes.value.data.length} records`);
          } else if (allArticlesRes.value.error) {
            console.error('[Admin Sync] Failed to fetch all articles:', allArticlesRes.value.error);
          }
        }

        // Hydrate All Videos (Drafts + Published) for Admin CMS
        if (allVideosRes.status === 'fulfilled') {
          if (allVideosRes.value.data !== null && !allVideosRes.value.error) {
            setVideos(allVideosRes.value.data);
            console.info(`[Admin Sync] All videos hydrated from public.videos: ${allVideosRes.value.data.length} records`);
          } else if (allVideosRes.value.error) {
            console.error('[Admin Sync] Failed to fetch all videos:', allVideosRes.value.error);
          }
        }

        // Hydrate All Resources (Drafts + Published) for Admin CMS
        if (allResourcesRes.status === 'fulfilled') {
          if (allResourcesRes.value.data !== null && !allResourcesRes.value.error) {
            setResources(allResourcesRes.value.data);
            console.info(`[Admin Sync] All resources hydrated from public.resources: ${allResourcesRes.value.data.length} records`);
          } else if (allResourcesRes.value.error) {
            if (allResourcesRes.value.error.code !== 'PGRST205') {
              console.error('[Admin Sync] Failed to fetch all resources:', allResourcesRes.value.error);
            }
          }
        }

        // Hydrate All Frameworks (Drafts + Published) for Admin CMS
        if (allFrameworksRes.status === 'fulfilled') {
          if (allFrameworksRes.value.data !== null && !allFrameworksRes.value.error) {
            if (allFrameworksRes.value.data.length > 0) {
              setFrameworks(allFrameworksRes.value.data);
              console.info(`[Admin Sync] All frameworks hydrated from public.frameworks: ${allFrameworksRes.value.data.length} records`);
            } else {
              console.info('[Admin Sync] Supabase frameworks returned 0 records; preserving local/fallback repository.');
            }
          } else if (allFrameworksRes.value.error) {
            if (allFrameworksRes.value.error.code !== 'PGRST205') {
              console.error('[Admin Sync] Failed to fetch all frameworks:', allFrameworksRes.value.error);
            }
          }
        }

        // Hydrate All Framework Categories (Active & Inactive) for Admin CMS
        if (allCategoriesRes.status === 'fulfilled') {
          if (allCategoriesRes.value.data !== null && !allCategoriesRes.value.error) {
            if (allCategoriesRes.value.data.length > 0) {
              setFrameworkCategories(allCategoriesRes.value.data);
              console.info(`[Admin Sync] All framework categories hydrated from public.framework_categories: ${allCategoriesRes.value.data.length} records`);
            }
          } else if (allCategoriesRes.value.error) {
            if (allCategoriesRes.value.error.code !== 'PGRST205') {
              console.error('[Admin Sync] Failed to fetch all framework categories:', allCategoriesRes.value.error);
            }
          }
        }

        // Hydrate All Courses (Drafts + Published) for Admin CMS
        if (allCoursesRes.status === 'fulfilled') {
          if (allCoursesRes.value.data !== null && !allCoursesRes.value.error) {
            if (allCoursesRes.value.data.length > 0) {
              setCourses(allCoursesRes.value.data);
              console.info(`[Admin Sync] All courses hydrated from public.courses: ${allCoursesRes.value.data.length} records`);
            } else {
              console.info('[Admin Sync] Supabase courses returned 0 records; preserving local/fallback repository.');
            }
          } else if (allCoursesRes.value.error) {
            if (allCoursesRes.value.error.code !== 'PGRST205') {
              console.error('[Admin Sync] Failed to fetch all courses:', allCoursesRes.value.error);
            }
          }
        }

        setFrameworksLoading(false);
        setCoursesLoading(false);
      } else {
        setFrameworksLoading(true);
        setCoursesLoading(true);
        // Public Visitor Branch: Fetch published content collections only
        const [pubArticlesRes, pubVideosRes, pubResourcesRes, pubFrameworksRes, pubCategoriesRes, pubCoursesRes] = await Promise.allSettled([
          articleService.fetchPublishedArticles(),
          videoService.fetchPublishedVideos(),
          resourceService.fetchPublishedResources(),
          frameworkService.fetchPublishedFrameworks(),
          frameworkCategoryService.fetchActiveFrameworkCategories(),
          courseService.fetchPublishedCourses()
        ]);

        if (pubArticlesRes.status === 'fulfilled') {
          if (pubArticlesRes.value.data !== null && !pubArticlesRes.value.error) {
            setArticles(pubArticlesRes.value.data);
            console.info(`[Public Sync] Published articles hydrated from Supabase: ${pubArticlesRes.value.data.length} records`);
          } else if (pubArticlesRes.value.error) {
            console.warn('[Public Sync] Notice: Error fetching published articles from Supabase, preserving local cache:', pubArticlesRes.value.error);
          }
        }

        if (pubVideosRes.status === 'fulfilled') {
          if (pubVideosRes.value.data !== null && !pubVideosRes.value.error) {
            setVideos(pubVideosRes.value.data);
            console.info(`[Public Sync] Published videos hydrated from Supabase: ${pubVideosRes.value.data.length} records`);
          } else if (pubVideosRes.value.error) {
            console.warn('[Public Sync] Notice: Error fetching published videos from Supabase, preserving local cache:', pubVideosRes.value.error);
          }
        }

        if (pubResourcesRes.status === 'fulfilled') {
          if (pubResourcesRes.value.data !== null && !pubResourcesRes.value.error) {
            setResources(pubResourcesRes.value.data);
            console.info(`[Public Sync] Published resources hydrated from Supabase: ${pubResourcesRes.value.data.length} records`);
          } else if (pubResourcesRes.value.error) {
            if (pubResourcesRes.value.error.code !== 'PGRST205') {
              console.warn('[Public Sync] Notice: Error fetching published resources from Supabase, preserving local cache:', pubResourcesRes.value.error);
            }
          }
        }

        if (pubFrameworksRes.status === 'fulfilled') {
          if (pubFrameworksRes.value.data !== null && !pubFrameworksRes.value.error) {
            if (pubFrameworksRes.value.data.length > 0) {
              setFrameworks(pubFrameworksRes.value.data);
              console.info(`[Public Sync] Published frameworks hydrated from Supabase: ${pubFrameworksRes.value.data.length} records`);
            } else {
              console.info('[Public Sync] Supabase frameworks returned 0 records; preserving local/fallback repository.');
            }
          } else if (pubFrameworksRes.value.error) {
            if (pubFrameworksRes.value.error.code !== 'PGRST205') {
              console.warn('[Public Sync] Notice: Error fetching published frameworks from Supabase, preserving local cache:', pubFrameworksRes.value.error);
            }
          }
        }

        if (pubCategoriesRes.status === 'fulfilled') {
          if (pubCategoriesRes.value.data !== null && !pubCategoriesRes.value.error) {
            if (pubCategoriesRes.value.data.length > 0) {
              setFrameworkCategories(pubCategoriesRes.value.data);
              console.info(`[Public Sync] Active framework categories hydrated from Supabase: ${pubCategoriesRes.value.data.length} records`);
            }
          } else if (pubCategoriesRes.value.error) {
            if (pubCategoriesRes.value.error.code !== 'PGRST205') {
              console.warn('[Public Sync] Notice: Error fetching active framework categories from Supabase, preserving local cache:', pubCategoriesRes.value.error);
            }
          }
        }

        if (pubCoursesRes.status === 'fulfilled') {
          if (pubCoursesRes.value.data !== null && !pubCoursesRes.value.error) {
            if (pubCoursesRes.value.data.length > 0) {
              setCourses(pubCoursesRes.value.data);
              console.info(`[Public Sync] Published courses hydrated from Supabase: ${pubCoursesRes.value.data.length} records`);
            } else {
              console.info('[Public Sync] Supabase courses returned 0 records; preserving local/fallback repository.');
            }
          } else if (pubCoursesRes.value.error) {
            if (pubCoursesRes.value.error.code !== 'PGRST205') {
              console.warn('[Public Sync] Notice: Error fetching published courses from Supabase, preserving local cache:', pubCoursesRes.value.error);
            }
          }
        }

        setFrameworksLoading(false);
        setCoursesLoading(false);
      }
    } catch (err) {
      console.warn('[Supabase Sync] Hydration notice:', err);
      setFrameworksLoading(false);
      setCoursesLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshDashboardData();
  }, [isAdminAuthenticated, refreshDashboardData]);

  // Supabase Auth functions
  const adminLogin = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const configStatus = getSupabaseConfigStatus();
      if (!configStatus.isConfigured) {
        const errorMsg = configStatus.error || 'Supabase configuration is missing or invalid in environment variables.';
        notify(errorMsg, 'error');
        return { success: false, error: errorMsg };
      }

      if (!email.trim() || !password) {
        const errorMsg = 'Please enter both administrator email and password.';
        notify(errorMsg, 'error');
        return { success: false, error: errorMsg };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (error) {
        let friendlyMessage = error.message;
        if (error.message.toLowerCase().includes('invalid login credentials')) {
          friendlyMessage = 'Invalid email or password. Please verify your administrator credentials.';
        } else if (error.message.toLowerCase().includes('email not confirmed')) {
          friendlyMessage = 'Your administrator email address has not been confirmed yet.';
        }
        notify(friendlyMessage, 'error');
        return { success: false, error: friendlyMessage };
      }

      if (data.session && data.user) {
        const isAdmin = await authService.checkIsAdmin(data.user);
        if (!isAdmin) {
          await supabase.auth.signOut();
          await handleSessionResolution(null);
          const errorMsg = 'Access denied. This account does not possess administrator privileges.';
          notify(errorMsg, 'error');
          return { success: false, error: errorMsg };
        }

        await handleSessionResolution(data.session);
        // Immediately synchronize all live Supabase collections with the authenticated session
        try {
          await refreshDashboardData();
        } catch (syncErr) {
          console.warn('[Admin Login] Post-auth sync notice:', syncErr);
        }
        notify(`Welcome, ${data.user.email || 'Admin'}`, 'success');
        return { success: true };
      }

      return { success: false, error: 'Authentication failed. Please try again.' };
    } catch (err: any) {
      const errMsg = err?.message || 'An unexpected error occurred during login.';
      notify(errMsg, 'error');
      return { success: false, error: errMsg };
    }
  };

  const adminLogout = async (): Promise<void> => {
    try {
      if (isSupabaseConfigured()) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.error('[Supabase Auth] Sign out error:', err);
    } finally {
      await handleSessionResolution(null);
      notify('Logged out successfully', 'info');
    }
  };

  // Student Authentication Handlers (Phase 1B)
  const studentLogin = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await authService.login(email, password);
      if (!res.success) {
        notify(res.error || 'Authentication failed.', 'error');
        return { success: false, error: res.error };
      }
      if (res.session && res.user) {
        await handleSessionResolution(res.session);
        const displayName = res.profile?.fullName || res.user.email || 'Student';
        notify(`Welcome back, ${displayName}!`, 'success');
        return { success: true };
      }
      return { success: false, error: 'Login failed. Please try again.' };
    } catch (err: any) {
      const msg = err?.message || 'Login failed';
      notify(msg, 'error');
      return { success: false, error: msg };
    }
  };

  const studentRegister = async (email: string, password: string, fullName: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await authService.registerStudent(email, password, fullName);
      if (!res.success) {
        notify(res.error || 'Registration failed.', 'error');
        return { success: false, error: res.error };
      }
      if (res.session && res.user) {
        await handleSessionResolution(res.session);
        notify(`Account created successfully! Welcome, ${fullName}!`, 'success');
        return { success: true };
      } else if (res.user) {
        notify('Account created! Please check your email to confirm your registration.', 'info');
        return { success: true };
      }
      return { success: false, error: 'Registration could not be completed.' };
    } catch (err: any) {
      const msg = err?.message || 'Registration failed';
      notify(msg, 'error');
      return { success: false, error: msg };
    }
  };

  const studentLogout = async (): Promise<void> => {
    try {
      await authService.logout();
    } catch (err) {
      console.error('[Student Logout] Error:', err);
    } finally {
      await handleSessionResolution(null);
      notify('Signed out successfully.', 'info');
    }
  };

  const refreshUserProfile = async (): Promise<void> => {
    if (!currentUser) return;
    const res = await profileService.fetchProfile(currentUser.id);
    if (res.data) {
      setUserProfile(res.data);
    }
  };

  const updateStudentProfile = async (
    updates: Partial<UserProfile>
  ): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser) {
      return { success: false, error: 'You must be logged in to update your profile.' };
    }

    const allowedUpdates: {
      fullName?: string;
      avatarUrl?: string;
      phone?: string;
      headline?: string;
      bio?: string;
    } = {};

    if (updates.fullName !== undefined) allowedUpdates.fullName = updates.fullName;
    if (updates.avatarUrl !== undefined) allowedUpdates.avatarUrl = updates.avatarUrl;
    if (updates.phone !== undefined) allowedUpdates.phone = updates.phone;
    if (updates.headline !== undefined) allowedUpdates.headline = updates.headline;
    if (updates.bio !== undefined) allowedUpdates.bio = updates.bio;

    try {
      const res = await profileService.updateProfile(currentUser.id, allowedUpdates);
      if (res.error) {
        const errorMsg = typeof res.error === 'string' ? res.error : (res.error.message || 'Failed to update profile.');
        notify(errorMsg, 'error');
        return { success: false, error: errorMsg };
      }

      if (res.data) {
        setUserProfile(res.data);
        notify('Profile updated successfully.', 'success');
        return { success: true };
      }

      return { success: false, error: 'Could not update profile.' };
    } catch (err: any) {
      const errorMsg = err?.message || 'An unexpected error occurred while updating profile.';
      notify(errorMsg, 'error');
      return { success: false, error: errorMsg };
    }
  };

  const updatePassword = async (
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser) {
      return { success: false, error: 'You must be logged in to update your password.' };
    }

    try {
      const res = await authService.updatePassword(newPassword);
      if (res.success) {
        notify('Password updated successfully.', 'success');
        return { success: true };
      }
      notify(res.error || 'Failed to update password.', 'error');
      return { success: false, error: res.error };
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to update password.';
      notify(errorMsg, 'error');
      return { success: false, error: errorMsg };
    }
  };

  // Student Learning Progress Helpers (Phase 2A)
  const fetchCourseProgress = useCallback(async (courseId: string): Promise<LessonProgress[]> => {
    if (!courseId || !isSupabaseConfigured()) return [];
    setIsProgressLoading(true);
    try {
      const res = await progressService.fetchCourseProgress(courseId);
      if (res.data) {
        setCourseProgressMap((prev) => ({ ...prev, [courseId]: res.data }));
        return res.data;
      }
      return [];
    } catch (err) {
      console.error('[AppContext] Error fetching course progress:', err);
      return [];
    } finally {
      setIsProgressLoading(false);
    }
  }, []);

  const updateLessonPlaybackPosition = useCallback(
    async (courseId: string, lessonId: string, seconds: number): Promise<boolean> => {
      if (!courseId || !lessonId) return false;
      try {
        const res = await progressService.saveLessonPlaybackPosition(courseId, lessonId, seconds);
        if (res.data) {
          const updatedRecord = res.data;
          setCourseProgressMap((prev) => {
            const currentList = prev[courseId] || [];
            const idx = currentList.findIndex((p) => p.lessonId === lessonId);
            if (idx >= 0) {
              const updated = [...currentList];
              updated[idx] = updatedRecord;
              return { ...prev, [courseId]: updated };
            }
            return { ...prev, [courseId]: [...currentList, updatedRecord] };
          });
          return true;
        }
        return false;
      } catch (err) {
        console.error('[AppContext] Error updating lesson position:', err);
        return false;
      }
    },
    []
  );

  const toggleLessonProgressCompletion = useCallback(
    async (courseId: string, lessonId: string, completed: boolean): Promise<boolean> => {
      if (!courseId || !lessonId) return false;
      try {
        const res = await progressService.toggleLessonCompletion(courseId, lessonId, completed);
        if (res.data) {
          const updatedRecord = res.data;
          setCourseProgressMap((prev) => {
            const currentList = prev[courseId] || [];
            const idx = currentList.findIndex((p) => p.lessonId === lessonId);
            let updatedList: LessonProgress[];
            if (idx >= 0) {
              updatedList = [...currentList];
              updatedList[idx] = updatedRecord;
            } else {
              updatedList = [...currentList, updatedRecord];
            }

            // Synchronously update the progress metrics in studentEnrollments list
            setStudentEnrollments((prevEnrollments) =>
              prevEnrollments.map((item) => {
                if (item.courseId === courseId && item.course) {
                  const stats = progressService.calculateCourseProgress(item.course, updatedList);
                  return {
                    ...item,
                    progressPercent: stats.progressPercent,
                    completedLessonsCount: stats.completedLessons,
                    totalLessonsCount: stats.totalLessons
                  };
                }
                return item;
              })
            );

            return { ...prev, [courseId]: updatedList };
          });

          return true;
        }
        return false;
      } catch (err) {
        console.error('[AppContext] Error toggling lesson completion:', err);
        return false;
      }
    },
    []
  );

  const getCourseProgressStats = useCallback(
    (course: Course): CourseProgressSummary => {
      if (!course) {
        return { totalLessons: 0, completedLessons: 0, progressPercent: 0, isCourseCompleted: false };
      }
      const progressList = courseProgressMap[course.id] || [];
      return progressService.calculateCourseProgress(course, progressList);
    },
    [courseProgressMap]
  );

  const requestPasswordReset = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const configStatus = getSupabaseConfigStatus();
      if (!configStatus.isConfigured) {
        const errorMsg = configStatus.error || 'Supabase configuration is missing or invalid in environment variables.';
        notify(errorMsg, 'error');
        return { success: false, error: errorMsg };
      }

      if (!email.trim()) {
        const errorMsg = 'Please provide an administrator email address.';
        notify(errorMsg, 'error');
        return { success: false, error: errorMsg };
      }

      const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}/admin` : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: redirectUrl
      });

      if (error) {
        notify(error.message, 'error');
        return { success: false, error: error.message };
      }

      notify('Password reset link sent! Check your email inbox.', 'success');
      return { success: true };
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to send password reset email.';
      notify(errMsg, 'error');
      return { success: false, error: errMsg };
    }
  };

  // Availability calculation
  const getAvailableSlotsForDate = (dateStr: string): string[] => {
    if (!dateStr) return [];
    // Parse dateStr (YYYY-MM-DD) deterministically in UTC midday to prevent local timezone weekday shifts
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return [];
    const dateUtc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const dayOfWeek = dateUtc.getUTCDay();

    // Check if day is within workingDays
    if (!availabilityRules.workingDays.includes(dayOfWeek)) {
      return [];
    }

    // Check if whole date is blocked
    if (availabilityRules.blockedDates.includes(dateStr)) {
      return [];
    }

    // Generate slots
    const slots: string[] = [];
    const [startH, startM] = availabilityRules.startTime.split(':').map(Number);
    const [endH, endM] = availabilityRules.endTime.split(':').map(Number);

    let currentMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const step = availabilityRules.slotDurationMinutes + availabilityRules.bufferMinutes;

    while (currentMinutes + availabilityRules.slotDurationMinutes <= endMinutes) {
      const h = Math.floor(currentMinutes / 60);
      const m = currentMinutes % 60;
      const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

      // Check if slot falls in a break
      let inBreak = false;
      for (const bp of availabilityRules.breakPeriods) {
        const [bStartH, bStartM] = bp.start.split(':').map(Number);
        const [bEndH, bEndM] = bp.end.split(':').map(Number);
        const bStartMin = bStartH * 60 + bStartM;
        const bEndMin = bEndH * 60 + bEndM;

        if (currentMinutes >= bStartMin && currentMinutes < bEndMin) {
          inBreak = true;
          break;
        }
      }

      // Check if manually blocked
      const isSlotBlocked = availabilityRules.blockedSlots.some(
        bs => bs.date === dateStr && normalizeTimeSlot(bs.time) === timeStr
      );

      // Check if already booked (active bookings: confirmed or rescheduled)
      const isAlreadyBooked = bookings.some(
        b => b.date === dateStr && normalizeTimeSlot(b.time) === timeStr && (b.status === 'confirmed' || b.status === 'rescheduled')
      );

      // Enforce minimum notice cutoff: slots occurring before now + minNoticeHours must not be offered
      // All booking time slots are standardized in Indian Standard Time (IST: UTC+05:30)
      const minNoticeHours = Number(availabilityRules.minNoticeHours ?? 4);
      const minNoticeMs = minNoticeHours * 60 * 60 * 1000;
      const slotIsoString = `${dateStr}T${timeStr}:00+05:30`;
      const slotTimestamp = new Date(slotIsoString).getTime();
      const isBeforeNoticeCutoff = !isNaN(slotTimestamp) && (slotTimestamp - Date.now() < minNoticeMs);

      if (!inBreak && !isSlotBlocked && !isAlreadyBooked && !isBeforeNoticeCutoff) {
        slots.push(timeStr);
      }

      currentMinutes += step;
    }

    return slots;
  };

  // Async Live Availability check using Supabase database query
  const fetchLiveAvailableSlots = async (dateStr: string): Promise<string[]> => {
    // Start with rule-based base slots (hours, breaks, manual blocked slots)
    const baseSlots = getAvailableSlotsForDate(dateStr);
    if (!isSupabaseConfigured()) {
      return baseSlots;
    }

    try {
      const { data: dbBookings, error } = await bookingService.fetchBookingsByDate(dateStr);
      if (error || !dbBookings) {
        return baseSlots;
      }

      const dbActiveTimes = new Set(
        dbBookings
          .filter(b => b.status === 'confirmed' || b.status === 'rescheduled')
          .map(b => normalizeTimeSlot(b.time))
      );

      return baseSlots.filter(slot => !dbActiveTimes.has(normalizeTimeSlot(slot)));
    } catch (err) {
      console.warn('[Supabase Availability] Live fetch fallback to local:', err);
      return baseSlots;
    }
  };

  // Consultation booking creator with double-booking prevention and price snapshot
  const createBooking = async (bookingData: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    businessName: string;
    primaryChallenge: string;
    desiredOutcome: string;
    website?: string;
    linkedin?: string;
    date: string;
    time: string;
    paymentId?: string;
  }): Promise<{ success: boolean; booking?: Booking; error?: string }> => {
    const normalizedTime = normalizeTimeSlot(bookingData.time);

    // 1. Double check slot availability locally (double-booking prevention)
    const isAlreadyBooked = bookings.some(
      b => b.date === bookingData.date && normalizeTimeSlot(b.time) === normalizedTime && (b.status === 'confirmed' || b.status === 'rescheduled')
    );

    if (isAlreadyBooked) {
      return {
        success: false,
        error: 'This time slot has just been booked. Please select another time.'
      };
    }

    const availableSlots = getAvailableSlotsForDate(bookingData.date);
    if (availableSlots.length > 0 && !availableSlots.some(s => normalizeTimeSlot(s) === normalizedTime)) {
      console.info(`[Booking] Slot ${bookingData.time} normalized as ${normalizedTime}`);
    }

    // 2. Snapshot current pricing
    const baseAmount = consultationProduct.basePrice;
    const gstRate = consultationProduct.gstRate;
    const gstAmount = Number((baseAmount * gstRate).toFixed(2));
    const totalAmount = Number((baseAmount + gstAmount).toFixed(2));

    const hasVerifiedPayment = Boolean(bookingData.paymentId && !bookingData.paymentId.startsWith('pay_rzp_mock_'));
    if (!hasVerifiedPayment) {
      console.warn('[Security Notice] createBooking rejected unverified paid confirmation attempt.');
      return {
        success: false,
        error: 'Paid consultations require completed Razorpay payment and cryptographic server verification.'
      };
    }

    const bookingId = generateUUID();
    const bookingCode = `DM-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const randomMeetHash = Math.random().toString(36).substring(2, 6) + '-' + Math.random().toString(36).substring(2, 6) + '-' + Math.random().toString(36).substring(2, 6);
    const meetUrl = `https://meet.google.com/${randomMeetHash}`;
    const paymentId = bookingData.paymentId!;
    const razorpayOrderId = '';

    const newBooking: Booking = {
      id: bookingId,
      bookingCode,
      customerName: bookingData.customerName,
      customerEmail: bookingData.customerEmail,
      customerPhone: bookingData.customerPhone,
      businessName: bookingData.businessName,
      primaryChallenge: bookingData.primaryChallenge,
      desiredOutcome: bookingData.desiredOutcome,
      website: bookingData.website,
      linkedin: bookingData.linkedin,
      date: bookingData.date,
      time: normalizedTime || bookingData.time,
      durationMinutes: consultationProduct.durationMinutes,
      baseAmount,
      gstRate,
      gstAmount,
      totalAmount,
      currency: consultationProduct.currency,
      paymentId,
      razorpayOrderId,
      paymentStatus: 'paid',
      calendarEventId: `cal_evt_${Date.now()}`,
      meetUrl,
      status: 'confirmed',
      userId: currentUser?.id,
      createdAt: new Date().toISOString(),
      notes: 'Booked online with verified payment.'
    };

    // Automatically create CRM Lead
    const newLead: Lead = {
      id: generateUUID(),
      name: bookingData.customerName,
      email: bookingData.customerEmail,
      phone: bookingData.customerPhone,
      source: 'Consultation Intake Brief',
      interest: '1-on-1 Business Growth Consultation',
      notes: `Booking Code: ${bookingCode}, Date: ${bookingData.date} at ${bookingData.time}. Company: ${bookingData.businessName || 'N/A'}, Phone: ${bookingData.customerPhone || 'N/A'}, Web: ${bookingData.website || 'N/A'}. Challenge: ${bookingData.primaryChallenge || 'N/A'}. Outcome: ${bookingData.desiredOutcome || 'N/A'}`,
      status: 'New',
      createdAt: new Date().toISOString(),
      amount: totalAmount
    };

    // If Supabase is configured, enforce persistence validation
    if (isSupabaseConfigured()) {
      try {
        const insertResult = await bookingService.insertBooking(newBooking);
        if (insertResult.error) {
          console.error('[Supabase Booking] Persistence validation failed:', insertResult.error);
          const errorMsg = insertResult.error.isConflict || insertResult.error.code === '23505'
            ? 'This time slot is no longer available. Please select another slot.'
            : (insertResult.error.message || 'Unable to confirm booking. Please try again.');
          return { success: false, error: errorMsg };
        }

        // Insert CRM Lead in background
        leadService.insertLead(newLead).catch(err => {
          console.warn('[Supabase Lead] Lead sync notice:', err);
        });

        // Update local state upon verified Supabase persistence
        setBookings(prev => [newBooking, ...prev.filter(b => b.id !== newBooking.id)]);
        if (currentUser && (newBooking.userId === currentUser.id || newBooking.customerEmail.toLowerCase() === (currentUser.email || '').toLowerCase())) {
          setStudentBookings(prev => [newBooking, ...prev.filter(b => b.id !== newBooking.id)]);
        }
        setLeads(prev => [newLead, ...prev.filter(l => l.id !== newLead.id)]);
        notify(`Consultation confirmed for ${bookingData.date} at ${bookingData.time}!`, 'success');
        return { success: true, booking: newBooking };
      } catch (err: any) {
        console.error('[Supabase Booking] Unexpected insertion error:', err);
        return {
          success: false,
          error: err?.message || 'Database error: unable to save booking.'
        };
      }
    } else {
      // Genuine offline/unconfigured fallback: preserve local storage architecture
      setBookings(prev => [newBooking, ...prev]);
      if (currentUser && (newBooking.userId === currentUser.id || newBooking.customerEmail.toLowerCase() === (currentUser.email || '').toLowerCase())) {
        setStudentBookings(prev => [newBooking, ...prev.filter(b => b.id !== newBooking.id)]);
      }
      setLeads(prev => [newLead, ...prev]);
      notify(`Consultation confirmed for ${bookingData.date} at ${bookingData.time}!`, 'success');
      return { success: true, booking: newBooking };
    }
  };

  const cancelBooking = (id: string, reason?: string) => {
    const updatedNotes = `Cancelled: ${reason || 'Customer request'}`;
    setBookings(prev =>
      prev.map(b => (b.id === id ? { ...b, status: 'cancelled', notes: (b.notes ? b.notes + ' | ' : '') + updatedNotes } : b))
    );
    bookingService.updateBooking(id, { status: 'cancelled', notes: updatedNotes }).catch(err => {
      console.warn('[Supabase Booking] Cancel write-through fallback to local:', err);
    });
    notify('Consultation cancelled successfully', 'info');
    return true;
  };

  const rescheduleBooking = (id: string, newDate: string, newTime: string) => {
    const slots = getAvailableSlotsForDate(newDate);
    if (!slots.includes(newTime)) {
      notify('Selected slot is no longer available', 'error');
      return false;
    }
    setBookings(prev =>
      prev.map(b => (b.id === id ? { ...b, date: newDate, time: newTime, status: 'rescheduled' } : b))
    );
    bookingService.updateBooking(id, { date: newDate, time: newTime, status: 'rescheduled' }).catch(err => {
      console.warn('[Supabase Booking] Reschedule write-through fallback to local:', err);
    });
    notify(`Appointment rescheduled to ${newDate} at ${newTime}`, 'success');
    return true;
  };

  const updateBookingStatus = (id: string, status: Booking['status']) => {
    setBookings(prev =>
      prev.map(b => (b.id === id ? { ...b, status } : b))
    );
    bookingService.updateBooking(id, { status }).catch(err => {
      console.warn('[Supabase Booking] Status update write-through fallback to local:', err);
    });
    notify(`Booking status updated to ${status}`, 'success');
  };

  const deleteBooking = (id: string) => {
    setBookings(prev => prev.filter(b => b.id !== id));
    bookingService.deleteBooking(id).catch(err => {
      console.warn('[Supabase Booking] Delete write-through fallback to local:', err);
    });
    notify('Booking record removed', 'info');
  };

  // Content Handlers: Articles CMS
  const refreshArticles = useCallback(async () => {
    try {
      const { data: { session } } = isSupabaseConfigured() ? await supabase.auth.getSession() : { data: { session: null } };
      const isAdmin = Boolean(session && session.user);

      if (isAdmin) {
        const res = await articleService.fetchAllArticles();
        if (res.data !== null && !res.error) {
          setArticles(res.data);
          console.info(`[Admin Articles] Hydrated ${res.data.length} articles from Supabase`);
        }
      } else {
        const res = await articleService.fetchPublishedArticles();
        if (res.data !== null && !res.error) {
          setArticles(res.data);
        }
      }
    } catch (err) {
      console.warn('[Articles Sync] Hydration fallback notice:', err);
    }
  }, []);

  const addArticle = async (article: Partial<Article>): Promise<{ data: Article | null; error: any }> => {
    try {
      if (isSupabaseConfigured()) {
        const res = await articleService.insertArticle(article);
        if (res.data) {
          setArticles(prev => [res.data!, ...prev.filter(a => a.id !== res.data!.id && a.slug !== res.data!.slug)]);
          notify(res.data.status === 'published' ? 'Article published successfully' : 'Draft saved to CMS', 'success');
          return { data: res.data, error: null };
        } else {
          const errMsg = res.error?.message || 'Unable to save article to the database. Please try again.';
          console.error('[AppContext] Supabase article save error:', res.error);
          notify(`Unable to save article: ${errMsg}`, 'error');
          return { data: null, error: res.error };
        }
      }

      // Local persistent fallback
      const readingTime = Math.max(1, Number(article.readingTimeMinutes) || 5);
      const isFeatured = Boolean(article.isFeatured ?? article.featured ?? false);
      const localArt: Article = {
        id: `art-${Date.now()}`,
        title: (article.title || 'Untitled Article').trim(),
        slug: article.slug ? slugify(article.slug) : slugify(article.title || 'untitled'),
        excerpt: article.excerpt || '',
        content: article.content || '',
        category: article.category || 'Digital Growth',
        author: article.author || {
          name: 'Digital Muid',
          role: 'Founder & Strategic Architect',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'
        },
        featuredImage: article.featuredImage || 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
        readingTimeMinutes: readingTime,
        readTime: `${readingTime} min read`,
        status: article.status || 'draft',
        isFeatured,
        featured: isFeatured,
        publishedAt: article.status === 'published' ? (article.publishedAt || new Date().toISOString().split('T')[0]) : undefined,
        seoTitle: article.seoTitle,
        seoDescription: article.seoDescription,
        tags: article.tags || [article.category || 'Strategy', 'Growth'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setArticles(prev => [localArt, ...prev.filter(a => a.id !== localArt.id && a.slug !== localArt.slug)]);
      notify(localArt.status === 'published' ? 'Article published successfully' : 'Draft saved to CMS', 'success');
      return { data: localArt, error: null };
    } catch (err: any) {
      console.error('[AppContext] Error adding article:', err);
      notify(`Error creating article: ${err.message || 'Unknown error'}`, 'error');
      return { data: null, error: err };
    }
  };

  const updateArticle = async (id: string, updated: Partial<Article>): Promise<{ data: Article | null; error: any }> => {
    try {
      if (isSupabaseConfigured()) {
        const res = await articleService.updateArticle(id, updated);
        if (res.data) {
          setArticles(prev => prev.map(a => (a.id === id ? res.data! : a)));
          notify(res.data.status === 'published' ? 'Article published successfully' : 'Article updated in CMS', 'success');
          return { data: res.data, error: null };
        } else {
          const errMsg = res.error?.message || 'Unable to update article in the database. Please try again.';
          console.error('[AppContext] Supabase article update error:', res.error);
          notify(`Unable to update article: ${errMsg}`, 'error');
          return { data: null, error: res.error };
        }
      }

      // Local persistent fallback
      let updatedArt: Article | null = null;
      setArticles(prev =>
        prev.map(a => {
          if (a.id !== id && a.slug !== updated.slug) return a;
          const readingTime = updated.readingTimeMinutes !== undefined
            ? Math.max(1, Number(updated.readingTimeMinutes) || 5)
            : a.readingTimeMinutes;
          const isFeatured = updated.isFeatured !== undefined
            ? Boolean(updated.isFeatured)
            : (updated.featured !== undefined ? Boolean(updated.featured) : a.isFeatured);

          const resArt: Article = {
            ...a,
            ...updated,
            readingTimeMinutes: readingTime,
            readTime: `${readingTime} min read`,
            isFeatured,
            featured: isFeatured,
            updatedAt: new Date().toISOString()
          };
          updatedArt = resArt;
          return resArt;
        })
      );
      notify(updated.status === 'published' ? 'Article published successfully' : 'Article updated in CMS', 'success');
      return { data: updatedArt, error: null };
    } catch (err: any) {
      console.error('[AppContext] Error updating article:', err);
      notify(`Error updating article: ${err.message || 'Unknown error'}`, 'error');
      return { data: null, error: err };
    }
  };

  const deleteArticle = async (id: string): Promise<{ success: boolean; error: any }> => {
    try {
      if (isSupabaseConfigured()) {
        const res = await articleService.deleteArticle(id);
        if (res.success) {
          setArticles(prev => prev.filter(a => a.id !== id));
          notify('Article deleted from database', 'info');
          return { success: true, error: null };
        } else {
          const errMsg = res.error?.message || 'Unable to delete article from database.';
          console.error('[AppContext] Supabase article deletion error:', res.error);
          notify(`Unable to delete article: ${errMsg}`, 'error');
          return { success: false, error: res.error };
        }
      }

      setArticles(prev => prev.filter(a => a.id !== id));
      notify('Article deleted', 'info');
      return { success: true, error: null };
    } catch (err: any) {
      notify(`Error deleting article: ${err.message || 'Unknown error'}`, 'error');
      return { success: false, error: err };
    }
  };

  const publishArticle = async (id: string): Promise<{ data: Article | null; error: any }> => {
    return updateArticle(id, {
      status: 'published',
      publishedAt: new Date().toISOString().split('T')[0]
    });
  };

  const unpublishArticle = async (id: string): Promise<{ data: Article | null; error: any }> => {
    return updateArticle(id, {
      status: 'draft'
    });
  };

  const refreshVideos = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const isAdmin = Boolean(session && session.user);

      if (isAdmin) {
        const res = await videoService.fetchAllVideos();
        if (res.data !== null && !res.error) {
          setVideos(res.data);
          console.info(`[Admin Videos] Hydrated ${res.data.length} videos from Supabase`);
        }
      } else {
        const res = await videoService.fetchPublishedVideos();
        if (res.data !== null && !res.error) {
          setVideos(res.data);
        }
      }
    } catch (err) {
      console.warn('[Videos Sync] Hydration fallback notice:', err);
    }
  }, []);

  const addVideo = async (video: Partial<Video>): Promise<{ data: Video | null; error: any }> => {
    try {
      const ytUrl = (video.youtubeUrl || video.videoUrl || '').trim();
      const vidId = video.youtubeVideoId || (ytUrl ? extractYouTubeVideoId(ytUrl) : undefined) || undefined;
      const autoThumb = vidId ? getYouTubeThumbnail(vidId) : undefined;
      const thumb = (video.thumbnailUrl || video.thumbnail || autoThumb || '').trim();
      const embed = vidId ? getYouTubeEmbedUrl(vidId) : (video.embedUrl || '');
      const isFeatured = Boolean(video.isFeatured ?? video.featured ?? false);

      if (isSupabaseConfigured()) {
        const res = await videoService.insertVideo({
          ...video,
          youtubeUrl: ytUrl || (vidId ? `https://www.youtube.com/watch?v=${vidId}` : ''),
          youtubeVideoId: vidId,
          thumbnailUrl: thumb,
          embedUrl: embed,
          isFeatured
        });

        if (res.data) {
          setVideos(prev => [res.data!, ...prev.filter(v => v.id !== res.data!.id && v.slug !== res.data!.slug)]);
          notify(res.data.status === 'published' ? 'Video published to library' : 'Draft video saved to CMS', 'success');
          return { data: res.data, error: null };
        } else {
          const errMsg = res.error?.message || 'Unable to save video to the database. Please try again.';
          console.error('[AppContext] Supabase video save error:', res.error);
          notify(`Unable to save video: ${errMsg}`, 'error');
          return { data: null, error: res.error };
        }
      }

      // Local persistent fallback
      const localVid: Video = {
        id: `vid-${Date.now()}`,
        title: (video.title || 'Untitled Video').trim(),
        slug: video.slug ? slugify(video.slug) : slugify(video.title || 'untitled-video'),
        description: video.description || '',
        category: video.category || 'Digital Growth',
        youtubeUrl: ytUrl || (vidId ? `https://www.youtube.com/watch?v=${vidId}` : ''),
        youtubeVideoId: vidId,
        thumbnailUrl: thumb,
        thumbnail: thumb,
        videoUrl: ytUrl,
        embedUrl: embed,
        duration: video.duration || '12:00',
        creator: video.creator || 'Digital Muid',
        tags: Array.isArray(video.tags) ? video.tags : [video.category || 'Digital Growth'],
        status: (video.status || 'draft') as 'draft' | 'published' | 'archived',
        isFeatured,
        featured: isFeatured,
        publishedAt: video.status === 'published' ? (video.publishedAt || new Date().toISOString().split('T')[0]) : undefined,
        viewsCount: video.viewsCount || '1.2k views',
        seoTitle: video.seoTitle,
        seoDescription: video.seoDescription,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setVideos(prev => [localVid, ...prev.filter(v => v.id !== localVid.id && v.slug !== localVid.slug)]);
      notify(localVid.status === 'published' ? 'Video published to library' : 'Draft video saved to CMS', 'success');
      return { data: localVid, error: null };
    } catch (err: any) {
      console.error('[AppContext] Error adding video:', err);
      notify(`Unable to save video: ${err.message || 'Database error'}`, 'error');
      return { data: null, error: err };
    }
  };

  const updateVideo = async (id: string, updated: Partial<Video>): Promise<{ data: Video | null; error: any }> => {
    try {
      const ytUrl = (updated.youtubeUrl || updated.videoUrl || '').trim();
      let vidId = updated.youtubeVideoId;
      if (ytUrl) {
        vidId = vidId || extractYouTubeVideoId(ytUrl) || undefined;
      }

      if (isSupabaseConfigured()) {
        const res = await videoService.updateVideo(id, {
          ...updated,
          ...(ytUrl ? { youtubeUrl: ytUrl } : {}),
          ...(vidId ? { youtubeVideoId: vidId } : {})
        });
        if (res.data) {
          setVideos(prev => prev.map(v => (v.id === id ? res.data! : v)));
          notify(res.data.status === 'published' ? 'Video published to library' : 'Video updated in CMS', 'success');
          return { data: res.data, error: null };
        } else {
          const errMsg = res.error?.message || 'Unable to update video in the database. Please try again.';
          console.error('[AppContext] Supabase video update error:', res.error);
          notify(`Unable to update video: ${errMsg}`, 'error');
          return { data: null, error: res.error };
        }
      }

      // Local persistent fallback
      let updatedVid: Video | null = null;
      setVideos(prev =>
        prev.map(v => {
          if (v.id !== id && v.slug !== updated.slug) return v;
          const currentYtUrl = (updated.youtubeUrl || updated.videoUrl || v.youtubeUrl || v.videoUrl || '').trim();
          const currentVidId = updated.youtubeVideoId || (currentYtUrl ? extractYouTubeVideoId(currentYtUrl) : undefined) || v.youtubeVideoId;
          const autoThumb = currentVidId ? getYouTubeThumbnail(currentVidId) : undefined;
          const thumb = (updated.thumbnailUrl || updated.thumbnail || v.thumbnailUrl || v.thumbnail || autoThumb || '').trim();
          const embed = currentVidId ? getYouTubeEmbedUrl(currentVidId) : (updated.embedUrl || v.embedUrl || '');
          const isFeatured = updated.isFeatured !== undefined
            ? Boolean(updated.isFeatured)
            : (updated.featured !== undefined ? Boolean(updated.featured) : (v.isFeatured ?? v.featured ?? false));

          const resVid: Video = {
            ...v,
            ...updated,
            youtubeUrl: currentYtUrl,
            youtubeVideoId: currentVidId,
            thumbnailUrl: thumb,
            thumbnail: thumb,
            videoUrl: currentYtUrl,
            embedUrl: embed,
            isFeatured,
            featured: isFeatured,
            updatedAt: new Date().toISOString()
          };
          updatedVid = resVid;
          return resVid;
        })
      );
      notify(updated.status === 'published' ? 'Video published to library' : 'Video updated in CMS', 'success');
      return { data: updatedVid, error: null };
    } catch (err: any) {
      console.error('[AppContext] Error updating video:', err);
      notify(`Unable to update video: ${err.message || 'Database error'}`, 'error');
      return { data: null, error: err };
    }
  };

  const deleteVideo = async (id: string): Promise<{ success: boolean; error: any }> => {
    try {
      if (isSupabaseConfigured()) {
        const res = await videoService.deleteVideo(id);
        if (res.success) {
          setVideos(prev => prev.filter(v => v.id !== id));
          notify('Video deleted from database', 'info');
          return { success: true, error: null };
        } else {
          const errMsg = res.error?.message || 'Unable to delete video from database.';
          console.error('[AppContext] Supabase video deletion failed:', res.error);
          notify(`Unable to delete video: ${errMsg}`, 'error');
          return { success: false, error: res.error };
        }
      }

      setVideos(prev => prev.filter(v => v.id !== id));
      notify('Video deleted', 'info');
      return { success: true, error: null };
    } catch (err: any) {
      console.error('[AppContext] Error deleting video:', err);
      notify(`Unable to delete video: ${err.message || 'Database error'}`, 'error');
      return { success: false, error: err };
    }
  };

  const publishVideo = async (id: string): Promise<{ data: Video | null; error: any }> => {
    return updateVideo(id, {
      status: 'published',
      publishedAt: new Date().toISOString().split('T')[0]
    });
  };

  const unpublishVideo = async (id: string): Promise<{ data: Video | null; error: any }> => {
    return updateVideo(id, {
      status: 'draft'
    });
  };

  // Content Handlers: Frameworks CMS
  const refreshFrameworks = useCallback(async () => {
    setFrameworksLoading(true);
    try {
      const { data: { session } } = isSupabaseConfigured() ? await supabase.auth.getSession() : { data: { session: null } };
      const isAdmin = Boolean(session && session.user);

      if (isAdmin) {
        const res = await frameworkService.fetchAllFrameworksAdmin();
        if (res.data !== null && !res.error) {
          if (res.data.length > 0) {
            setFrameworks(res.data);
          }
          console.info(`[Admin Frameworks] Hydrated ${res.data.length} frameworks from Supabase`);
        }
      } else {
        const res = await frameworkService.fetchPublishedFrameworks();
        if (res.data !== null && !res.error) {
          if (res.data.length > 0) {
            setFrameworks(res.data);
          }
        }
      }
      console.info('[Framework Hydration]', {
        authenticated: isAdmin,
        isAdmin,
        'frameworks.length': frameworks.length,
        'framework IDs': frameworks.map(f => f.id),
        'framework titles': frameworks.map(f => f.title || f.name)
      });
    } catch (err) {
      console.warn('[Frameworks Sync] Hydration fallback notice:', err);
    } finally {
      setFrameworksLoading(false);
    }
  }, []);

  const addFramework = async (framework: Partial<Framework>): Promise<{ data: Framework | null; error: any }> => {
    try {
      if (isSupabaseConfigured()) {
        const res = await frameworkService.createFramework(framework);
        if (res.data) {
          setFrameworks(prev => [res.data!, ...prev.filter(f => f.id !== res.data!.id && f.slug !== res.data!.slug)]);
          notify(res.data.status === 'published' ? 'Framework published successfully' : 'Draft saved to CMS', 'success');
          return { data: res.data, error: null };
        } else {
          const isTableMissing = res.error?.code === 'PGRST205';
          const errMsg = isTableMissing
            ? 'The "frameworks" database table has not been created in Supabase yet. Please run the SQL migration.'
            : (res.error?.message || 'Unable to save framework to the database. Please try again.');
          console.error('[AppContext] Supabase framework save error:', res.error);
          notify(`Failed to save framework: ${errMsg}`, 'error');
          return { data: null, error: res.error };
        }
      }

      // Offline / unconfigured fallback
      const title = (framework.title || framework.name || 'New Framework').trim();
      const baseSlug = slugify(framework.slug || title || 'framework');
      const isFeatured = Boolean(framework.isFeatured ?? framework.is_featured ?? framework.featured);
      const rawStages = framework.frameworkContent ?? framework.framework_content ?? framework.steps ?? [];

      const newFw: Framework = {
        id: `fw-${Date.now()}`,
        title,
        name: title,
        slug: baseSlug,
        subtitle: framework.subtitle || '',
        description: framework.description || framework.introduction || '',
        introduction: framework.description || framework.introduction || '',
        category: framework.category || 'Digital Growth',
        author: framework.author || 'Digital Muid',
        coverImage: framework.coverImage || framework.cover_image,
        cover_image: framework.coverImage || framework.cover_image,
        problemStatement: framework.problemStatement || framework.problem_statement || framework.problem || '',
        problem: framework.problemStatement || framework.problem_statement || framework.problem || '',
        solutionStatement: framework.solutionStatement || framework.solution_statement || '',
        frameworkContent: rawStages,
        framework_content: rawStages,
        steps: rawStages,
        whoIsItFor: framework.whoIsItFor || framework.who_is_it_for || '',
        who_is_it_for: framework.whoIsItFor || framework.who_is_it_for || '',
        whenToUse: framework.whenToUse || framework.when_to_use || '',
        when_to_use: framework.whenToUse || framework.when_to_use || '',
        relatedArticles: framework.relatedArticles || framework.related_articles || [],
        related_articles: framework.relatedArticles || framework.related_articles || [],
        relatedVideos: framework.relatedVideos || framework.related_videos || [],
        related_videos: framework.relatedVideos || framework.related_videos || [],
        relatedResources: framework.relatedResources || framework.related_resources || [],
        related_resources: framework.relatedResources || framework.related_resources || [],
        tags: framework.tags || [framework.category || 'Digital Growth'],
        status: framework.status || 'draft',
        isFeatured,
        is_featured: isFeatured,
        featured: isFeatured,
        seoTitle: framework.seoTitle || framework.seo_title,
        seo_title: framework.seoTitle || framework.seo_title,
        seoDescription: framework.seoDescription || framework.seo_description,
        seo_description: framework.seoDescription || framework.seo_description,
        publishedAt: framework.publishedAt || framework.published_at || (framework.status === 'published' ? new Date().toISOString().split('T')[0] : undefined),
        published_at: framework.publishedAt || framework.published_at || (framework.status === 'published' ? new Date().toISOString().split('T')[0] : undefined),
        createdAt: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        principles: framework.principles || [],
        diagramType: framework.diagramType || 'stack',
        examples: framework.examples || [],
        relatedCourses: framework.relatedCourses || [],
        ctaText: framework.ctaText || 'Deploy this framework in your organization'
      };

      setFrameworks(prev => [newFw, ...prev.filter(f => f.slug !== newFw.slug)]);
      notify(newFw.status === 'published' ? 'Framework published successfully' : 'Draft saved locally', 'success');
      return { data: newFw, error: null };
    } catch (err: any) {
      console.error('[AppContext] Error adding framework:', err);
      notify(`Unable to save framework: ${err.message || 'Unknown error'}`, 'error');
      return { data: null, error: err };
    }
  };

  const updateFramework = async (id: string, updated: Partial<Framework>): Promise<{ data: Framework | null; error: any }> => {
    try {
      if (isSupabaseConfigured()) {
        const res = await frameworkService.updateFramework(id, updated);
        if (res.data) {
          setFrameworks(prev => prev.map(f => (f.id === id ? res.data! : f)));
          notify(res.data.status === 'published' ? 'Framework published to live site' : 'Framework updated in CMS', 'success');
          return { data: res.data, error: null };
        } else {
          const isTableMissing = res.error?.code === 'PGRST205';
          const errMsg = isTableMissing
            ? 'The "frameworks" database table has not been created in Supabase yet. Please run the SQL migration.'
            : (res.error?.message || 'Unable to update framework in database.');
          console.error('[AppContext] Supabase framework update failed:', res.error);
          notify(`Failed to update framework: ${errMsg}`, 'error');
          return { data: null, error: res.error };
        }
      }

      // Offline fallback
      let updatedFw: Framework | null = null;
      setFrameworks(prev =>
        prev.map(f => {
          if (f.id !== id) return f;
          const title = (updated.title || updated.name || f.title || f.name || '').trim();
          const isFeatured = updated.isFeatured !== undefined
            ? Boolean(updated.isFeatured)
            : (updated.featured !== undefined ? Boolean(updated.featured) : f.isFeatured);
          const rawStages = updated.frameworkContent ?? updated.framework_content ?? updated.steps ?? f.frameworkContent;

          const fwObj: Framework = {
            ...f,
            ...updated,
            title,
            name: title,
            frameworkContent: rawStages,
            framework_content: rawStages,
            steps: rawStages,
            isFeatured,
            is_featured: isFeatured,
            featured: isFeatured,
            updatedAt: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          updatedFw = fwObj;
          return fwObj;
        })
      );
      notify(updated.status === 'published' ? 'Framework published to library' : 'Framework updated in CMS', 'success');
      return { data: updatedFw, error: null };
    } catch (err: any) {
      console.error('[AppContext] Error updating framework:', err);
      notify(`Unable to update framework: ${err.message || 'Database error'}`, 'error');
      return { data: null, error: err };
    }
  };

  const deleteFramework = async (id: string): Promise<{ success: boolean; error: any }> => {
    try {
      if (isSupabaseConfigured()) {
        const res = await frameworkService.deleteFramework(id);
        if (res.success) {
          setFrameworks(prev => prev.filter(f => f.id !== id));
          notify('Framework deleted from database', 'info');
          return { success: true, error: null };
        } else {
          const isTableMissing = res.error?.code === 'PGRST205';
          const errMsg = isTableMissing
            ? 'The "frameworks" database table has not been created in Supabase yet. Please run the SQL migration.'
            : (res.error?.message || 'Unable to delete framework from database.');
          console.error('[AppContext] Supabase framework deletion failed:', res.error);
          notify(`Failed to delete framework: ${errMsg}`, 'error');
          return { success: false, error: res.error };
        }
      }

      setFrameworks(prev => prev.filter(f => f.id !== id));
      notify('Framework removed', 'info');
      return { success: true, error: null };
    } catch (err: any) {
      console.error('[AppContext] Error deleting framework:', err);
      notify(`Unable to delete framework: ${err.message || 'Database error'}`, 'error');
      return { success: false, error: err };
    }
  };

  const publishFramework = async (id: string): Promise<{ data: Framework | null; error: any }> => {
    return updateFramework(id, {
      status: 'published',
      publishedAt: new Date().toISOString().split('T')[0]
    });
  };

  const unpublishFramework = async (id: string): Promise<{ data: Framework | null; error: any }> => {
    return updateFramework(id, {
      status: 'draft'
    });
  };

  const toggleFeatureFramework = async (id: string, isFeatured: boolean): Promise<{ data: Framework | null; error: any }> => {
    return updateFramework(id, {
      isFeatured,
      is_featured: isFeatured,
      featured: isFeatured
    });
  };

  const syncInitialFrameworks = async (): Promise<{
    totalCount: number;
    importedCount: number;
    alreadyExistingCount: number;
    failedCount: number;
    results: any[];
  }> => {
    try {
      const res = await frameworkService.syncInitialFrameworks(INITIAL_FRAMEWORKS);
      if (res.importedCount > 0) {
        notify(`${res.importedCount} baseline framework${res.importedCount === 1 ? '' : 's'} synchronized to database`, 'success');
      } else if (res.alreadyExistingCount > 0 && res.failedCount === 0) {
        notify('All baseline frameworks are already synchronized.', 'info');
      } else if (res.failedCount > 0) {
        notify(`Failed to synchronize ${res.failedCount} framework${res.failedCount === 1 ? '' : 's'}.`, 'error');
      }
      await refreshFrameworks();
      return res;
    } catch (err: any) {
      console.error('[AppContext] syncInitialFrameworks error:', err);
      notify(`Sync failed: ${err?.message || 'Database error'}`, 'error');
      return {
        totalCount: INITIAL_FRAMEWORKS.length,
        importedCount: 0,
        alreadyExistingCount: 0,
        failedCount: INITIAL_FRAMEWORKS.length,
        results: []
      };
    }
  };

  // Content Handlers: Framework Categories CMS
  const refreshFrameworkCategories = useCallback(async () => {
    try {
      const { data: { session } } = isSupabaseConfigured() ? await supabase.auth.getSession() : { data: { session: null } };
      const isAdmin = Boolean(session && session.user);

      if (isAdmin) {
        const res = await frameworkCategoryService.fetchAllFrameworkCategoriesAdmin();
        if (res.data !== null && !res.error) {
          setFrameworkCategories(res.data);
          console.info(`[Admin Framework Categories] Hydrated ${res.data.length} categories from Supabase`);
        }
      } else {
        const res = await frameworkCategoryService.fetchActiveFrameworkCategories();
        if (res.data !== null && !res.error) {
          setFrameworkCategories(res.data);
        }
      }
    } catch (err) {
      console.warn('[Framework Categories Sync] Hydration fallback notice:', err);
    }
  }, []);

  const addFrameworkCategory = async (category: Partial<FrameworkCategory>): Promise<{ data: FrameworkCategory | null; error: any }> => {
    try {
      const name = String(category.name || '').trim();
      if (!name) {
        notify('Category name is required', 'error');
        return { data: null, error: new Error('Category name is required') };
      }

      // Check client-side duplicate name
      const isDuplicate = frameworkCategories.some(c => c.name.toLowerCase() === name.toLowerCase());
      if (isDuplicate) {
        notify(`A category named "${name}" already exists.`, 'error');
        return { data: null, error: new Error('Duplicate category name') };
      }

      const nextSortOrder = category.sortOrder ?? (
        frameworkCategories.length > 0
          ? Math.max(...frameworkCategories.map(c => c.sortOrder || 0)) + 1
          : 1
      );

      if (isSupabaseConfigured()) {
        const res = await frameworkCategoryService.createFrameworkCategory({
          ...category,
          name,
          sortOrder: nextSortOrder
        });

        if (res.data) {
          setFrameworkCategories(prev => [...prev, res.data!].sort((a, b) => a.sortOrder - b.sortOrder));
          notify(`Category "${res.data.name}" created successfully`, 'success');
          return { data: res.data, error: null };
        } else {
          const isTableMissing = res.error?.code === 'PGRST205';
          const errMsg = isTableMissing
            ? 'The "framework_categories" database table has not been created in Supabase yet. Please run the SQL migration.'
            : (res.error?.message || 'Unable to create framework category in database.');
          console.error('[AppContext] Supabase category save error:', res.error);
          notify(`Failed to create category: ${errMsg}`, 'error');
          return { data: null, error: res.error };
        }
      }

      // Offline / unconfigured fallback
      const baseSlug = slugify(category.slug || name);
      const newCat: FrameworkCategory = {
        id: `fc-${Date.now()}`,
        name,
        slug: baseSlug,
        description: String(category.description || '').trim(),
        sortOrder: nextSortOrder,
        sort_order: nextSortOrder,
        isActive: category.isActive ?? true,
        is_active: category.isActive ?? true
      };

      setFrameworkCategories(prev => [...prev, newCat].sort((a, b) => a.sortOrder - b.sortOrder));
      notify(`Category "${name}" created (local state)`, 'success');
      return { data: newCat, error: null };
    } catch (err: any) {
      console.error('[AppContext] Error adding framework category:', err);
      notify(`Failed to create category: ${err.message || 'Unknown error'}`, 'error');
      return { data: null, error: err };
    }
  };

  const updateFrameworkCategory = async (id: string, category: Partial<FrameworkCategory>): Promise<{ data: FrameworkCategory | null; error: any }> => {
    try {
      if (category.name) {
        const trimmedName = String(category.name).trim();
        const isDuplicate = frameworkCategories.some(c => c.id !== id && c.name.toLowerCase() === trimmedName.toLowerCase());
        if (isDuplicate) {
          notify(`Another category named "${trimmedName}" already exists.`, 'error');
          return { data: null, error: new Error('Duplicate category name') };
        }
      }

      if (isSupabaseConfigured()) {
        const res = await frameworkCategoryService.updateFrameworkCategory(id, category);
        if (res.data) {
          setFrameworkCategories(prev =>
            prev.map(c => (c.id === id ? res.data! : c)).sort((a, b) => a.sortOrder - b.sortOrder)
          );
          notify(`Category "${res.data.name}" updated`, 'success');
          return { data: res.data, error: null };
        } else {
          const errMsg = res.error?.message || 'Unable to update category in database.';
          console.error('[AppContext] Supabase category update error:', res.error);
          notify(`Failed to update category: ${errMsg}`, 'error');
          return { data: null, error: res.error };
        }
      }

      // Offline fallback
      let updatedCat: FrameworkCategory | null = null;
      setFrameworkCategories(prev =>
        prev.map(c => {
          if (c.id === id) {
            updatedCat = {
              ...c,
              ...category,
              name: category.name ? String(category.name).trim() : c.name,
              slug: category.slug ? slugify(category.slug) : (category.name ? slugify(category.name) : c.slug),
              description: category.description !== undefined ? String(category.description).trim() : c.description,
              sortOrder: category.sortOrder !== undefined ? category.sortOrder : c.sortOrder,
              isActive: category.isActive !== undefined ? category.isActive : c.isActive
            };
            return updatedCat;
          }
          return c;
        }).sort((a, b) => a.sortOrder - b.sortOrder)
      );

      notify('Category updated (local state)', 'success');
      return { data: updatedCat, error: null };
    } catch (err: any) {
      console.error('[AppContext] Error updating framework category:', err);
      notify(`Unable to update category: ${err.message || 'Unknown error'}`, 'error');
      return { data: null, error: err };
    }
  };

  const deleteFrameworkCategory = async (id: string): Promise<{ success: boolean; error: any }> => {
    try {
      const targetCategory = frameworkCategories.find(c => c.id === id);
      if (!targetCategory) {
        return { success: false, error: new Error('Category not found') };
      }

      // Safety check: block if frameworks are using this category
      const assignedCount = frameworks.filter(f => f.category === targetCategory.name).length;
      if (assignedCount > 0) {
        const errorMsg = `Cannot delete "${targetCategory.name}": It is currently assigned to ${assignedCount} framework${assignedCount > 1 ? 's' : ''}. Reassign those frameworks or deactivate this category instead.`;
        notify(errorMsg, 'error');
        return { success: false, error: new Error(errorMsg) };
      }

      if (isSupabaseConfigured()) {
        const res = await frameworkCategoryService.deleteFrameworkCategory(id);
        if (res.success) {
          setFrameworkCategories(prev => prev.filter(c => c.id !== id));
          notify(`Category "${targetCategory.name}" deleted successfully`, 'info');
          return { success: true, error: null };
        } else {
          const errMsg = res.error?.message || 'Unable to delete category from database.';
          console.error('[AppContext] Supabase category deletion failed:', res.error);
          notify(`Failed to delete category: ${errMsg}`, 'error');
          return { success: false, error: res.error };
        }
      }

      setFrameworkCategories(prev => prev.filter(c => c.id !== id));
      notify(`Category "${targetCategory.name}" removed`, 'info');
      return { success: true, error: null };
    } catch (err: any) {
      console.error('[AppContext] Error deleting category:', err);
      notify(`Unable to delete category: ${err.message || 'Unknown error'}`, 'error');
      return { success: false, error: err };
    }
  };

  const toggleFrameworkCategoryStatus = async (id: string, isActive: boolean): Promise<{ data: FrameworkCategory | null; error: any }> => {
    return updateFrameworkCategory(id, { isActive });
  };

  const reorderFrameworkCategories = async (orderedIds: string[]): Promise<{ success: boolean; error: any }> => {
    try {
      // Optimistic update
      setFrameworkCategories(prev => {
        const idMap = new Map<string, FrameworkCategory>(prev.map(c => [c.id, c]));
        const reordered: FrameworkCategory[] = [];
        orderedIds.forEach((id, index) => {
          const item = idMap.get(id);
          if (item) {
            reordered.push({ ...item, sortOrder: index + 1, sort_order: index + 1 });
            idMap.delete(id);
          }
        });
        // Append any remaining categories
        idMap.forEach(item => {
          reordered.push(item);
        });
        return reordered;
      });

      if (isSupabaseConfigured()) {
        const res = await frameworkCategoryService.reorderFrameworkCategories(orderedIds);
        if (!res.success) {
          console.error('[AppContext] Supabase category reordering failed:', res.error);
          notify('Failed to save category order to database', 'error');
          return res;
        }
      }

      notify('Category order updated', 'success');
      return { success: true, error: null };
    } catch (err: any) {
      console.error('[AppContext] Error reordering categories:', err);
      return { success: false, error: err };
    }
  };

  // Content Handlers: Resources CMS
  const refreshResources = useCallback(async () => {
    try {
      const { data: { session } } = isSupabaseConfigured() ? await supabase.auth.getSession() : { data: { session: null } };
      const isAdmin = Boolean(session && session.user);

      if (isAdmin) {
        const res = await resourceService.fetchAllResources();
        if (res.data !== null && !res.error) {
          setResources(res.data);
          console.info(`[Admin Resources] Hydrated ${res.data.length} resources from Supabase`);
        }
      } else {
        const res = await resourceService.fetchPublishedResources();
        if (res.data !== null && !res.error) {
          setResources(res.data);
        }
      }
    } catch (err) {
      console.warn('[Resources Sync] Hydration fallback notice:', err);
    }
  }, []);

  const addResource = async (resource: Partial<Resource>): Promise<{ data: Resource | null; error: any }> => {
    try {
      if (isSupabaseConfigured()) {
        const res = await resourceService.insertResource(resource);
        if (res.data) {
          setResources(prev => [res.data!, ...prev.filter(r => r.id !== res.data!.id && r.slug !== res.data!.slug)]);
          notify(res.data.status === 'published' ? 'Resource published successfully' : 'Draft saved to CMS', 'success');
          return { data: res.data, error: null };
        } else {
          const isTableMissing = res.error?.code === 'PGRST205';
          const errMsg = isTableMissing
            ? 'The "resources" database table has not been created in Supabase yet. Please run the SQL migration.'
            : (res.error?.message || 'Unable to save resource to the database. Please try again.');
          console.error('[AppContext] Supabase resource save error:', res.error);
          notify(`Failed to save resource: ${errMsg}`, 'error');
          return { data: null, error: res.error };
        }
      }

      // Offline / Unconfigured fallback
      const baseSlug = slugify(resource.slug || resource.title || resource.name || 'resource');
      const isFeatured = Boolean(resource.isFeatured ?? resource.featured);
      const title = (resource.title || resource.name || 'New Resource').trim();
      const resourceType = resource.resourceType || resource.type || 'Guide';
      const fileUrl = resource.fileUrl || resource.downloadUrl;
      const thumb = resource.thumbnailUrl || resource.coverImage;

      const newRes: Resource = {
        id: `res-${Date.now()}`,
        title,
        name: title,
        slug: baseSlug,
        resourceType,
        type: resourceType as any,
        category: resource.category || 'Digital Growth',
        description: resource.description || '',
        fileUrl,
        downloadUrl: fileUrl,
        externalUrl: resource.externalUrl,
        thumbnailUrl: thumb,
        coverImage: thumb,
        author: resource.author || 'Digital Muid',
        fileType: resource.fileType || resource.format || 'PDF',
        fileSize: resource.fileSize,
        format: resource.fileType || resource.format || 'Digital Asset',
        readingTimeMinutes: resource.readingTimeMinutes,
        tags: resource.tags || [],
        status: resource.status || 'draft',
        isFeatured,
        featured: isFeatured,
        publishedAt: resource.publishedAt || (resource.status === 'published' ? new Date().toISOString().split('T')[0] : undefined),
        downloadCount: 0,
        previewPoints: resource.previewPoints || [],
        whatIsIncluded: resource.whatIsIncluded || [],
        leadCaptureRequired: true,
        seoTitle: resource.seoTitle,
        seoDescription: resource.seoDescription,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      setResources(prev => [newRes, ...prev]);
      notify(newRes.status === 'published' ? 'Resource published to library' : 'Draft saved to CMS', 'success');
      return { data: newRes, error: null };
    } catch (err: any) {
      console.error('[AppContext] Error creating resource:', err);
      notify(`Unable to save resource: ${err.message || 'Database error'}`, 'error');
      return { data: null, error: err };
    }
  };

  const updateResource = async (id: string, updated: Partial<Resource>): Promise<{ data: Resource | null; error: any }> => {
    try {
      if (isSupabaseConfigured()) {
        const res = await resourceService.updateResource(id, updated);
        if (res.data) {
          setResources(prev =>
            prev.map(r => (r.id === id ? res.data! : r))
          );
          notify(res.data.status === 'published' ? 'Resource updated & published' : 'Draft updated in CMS', 'success');
          return { data: res.data, error: null };
        } else {
          const isTableMissing = res.error?.code === 'PGRST205';
          const errMsg = isTableMissing
            ? 'The "resources" database table has not been created in Supabase yet. Please run the SQL migration.'
            : (res.error?.message || 'Unable to update resource in database.');
          console.error('[AppContext] Supabase resource update failed:', res.error);
          notify(`Failed to update resource: ${errMsg}`, 'error');
          return { data: null, error: res.error };
        }
      }

      let updatedRes: Resource | null = null;
      setResources(prev =>
        prev.map(r => {
          if (r.id !== id) return r;
          const isFeatured = updated.isFeatured !== undefined
            ? Boolean(updated.isFeatured)
            : (updated.featured !== undefined ? Boolean(updated.featured) : (r.isFeatured ?? r.featured ?? false));
          const title = (updated.title || updated.name || r.title || r.name).trim();
          const fileUrl = updated.fileUrl || updated.downloadUrl || r.fileUrl || r.downloadUrl;
          const thumb = updated.thumbnailUrl || updated.coverImage || r.thumbnailUrl || r.coverImage;

          const resObj: Resource = {
            ...r,
            ...updated,
            title,
            name: title,
            fileUrl,
            downloadUrl: fileUrl,
            thumbnailUrl: thumb,
            coverImage: thumb,
            isFeatured,
            featured: isFeatured,
            updatedAt: new Date().toISOString()
          };
          updatedRes = resObj;
          return resObj;
        })
      );
      notify(updated.status === 'published' ? 'Resource published to library' : 'Resource updated in CMS', 'success');
      return { data: updatedRes, error: null };
    } catch (err: any) {
      console.error('[AppContext] Error updating resource:', err);
      notify(`Unable to update resource: ${err.message || 'Database error'}`, 'error');
      return { data: null, error: err };
    }
  };

  const deleteResource = async (id: string): Promise<{ success: boolean; error: any }> => {
    try {
      if (isSupabaseConfigured()) {
        const res = await resourceService.deleteResource(id);
        if (res.success) {
          setResources(prev => prev.filter(r => r.id !== id));
          notify('Resource deleted from database', 'info');
          return { success: true, error: null };
        } else {
          const isTableMissing = res.error?.code === 'PGRST205';
          const errMsg = isTableMissing
            ? 'The "resources" database table has not been created in Supabase yet. Please run the SQL migration.'
            : (res.error?.message || 'Unable to delete resource from database.');
          console.error('[AppContext] Supabase resource deletion failed:', res.error);
          notify(`Failed to delete resource: ${errMsg}`, 'error');
          return { success: false, error: res.error };
        }
      }

      setResources(prev => prev.filter(r => r.id !== id));
      notify('Resource deleted', 'info');
      return { success: true, error: null };
    } catch (err: any) {
      console.error('[AppContext] Error deleting resource:', err);
      notify(`Unable to delete resource: ${err.message || 'Database error'}`, 'error');
      return { success: false, error: err };
    }
  };

  const publishResource = async (id: string): Promise<{ data: Resource | null; error: any }> => {
    return updateResource(id, {
      status: 'published',
      publishedAt: new Date().toISOString().split('T')[0]
    });
  };

  const unpublishResource = async (id: string): Promise<{ data: Resource | null; error: any }> => {
    return updateResource(id, {
      status: 'draft'
    });
  };

  const recordResourceDownload = async (
    resourceId: string,
    email: string,
    name?: string,
    mobile?: string,
    profession?: string
  ): Promise<{ success: boolean; error?: any }> => {
    try {
      // 1. Optimistic / local state increment
      setResources(prev =>
        prev.map(r => (r.id === resourceId ? { ...r, downloadCount: (r.downloadCount || 0) + 1 } : r))
      );
      const targetResource = resources.find(r => r.id === resourceId);

      // 2. Format notes and interest for CRM
      const resourceTitle = targetResource?.title || targetResource?.name || 'Digital Resource';
      const cleanName = name?.trim() || email.split('@')[0];
      const cleanEmail = email.trim();
      const cleanMobile = mobile?.trim() || undefined;
      const cleanProfession = profession?.trim();
      
      const leadNotes = cleanProfession
        ? `Profession: ${cleanProfession} | Downloaded Resource: "${resourceTitle}"`
        : `Downloaded Resource: "${resourceTitle}"`;

      // 3. Register CRM Lead
      const newLead: Lead = {
        id: generateUUID(),
        name: cleanName,
        email: cleanEmail,
        phone: cleanMobile,
        source: 'Resource Lead Magnet',
        interest: resourceTitle,
        notes: leadNotes,
        status: 'New',
        createdAt: new Date().toISOString()
      };

      setLeads(prev => [newLead, ...prev]);

      // 4. Supabase DB persistence for CRM lead
      leadService.insertLead(newLead).catch(err => {
        console.warn('[Supabase Lead Magnet] CRM lead insertion notice:', err);
      });

      // 5. Increment resource download count in Supabase
      resourceService.incrementDownloadCount(resourceId).catch(err => {
        console.warn('[Supabase Resources] Download count increment notice:', err);
      });

      notify('Access unlocked! Your download is ready.', 'success');
      return { success: true };
    } catch (err: any) {
      console.error('[AppContext] Error in recordResourceDownload:', err);
      notify('Unable to register download. Please try again.', 'error');
      return { success: false, error: err };
    }
  };

  // Content Handlers: Courses CMS
  const refreshCourses = useCallback(async () => {
    setCoursesLoading(true);
    try {
      const { data: { session } } = isSupabaseConfigured() ? await supabase.auth.getSession() : { data: { session: null } };
      const isAdmin = Boolean(session && session.user);

      if (isAdmin) {
        const res = await courseService.fetchAllCourses();
        if (res.data !== null && !res.error) {
          if (res.data.length > 0) {
            setCourses(res.data);
          }
          console.info(`[Admin Courses] Hydrated ${res.data.length} courses from Supabase`);
        }
      } else {
        const res = await courseService.fetchPublishedCourses();
        if (res.data !== null && !res.error) {
          if (res.data.length > 0) {
            setCourses(res.data);
          }
        }
      }
    } catch (err) {
      console.warn('[Courses Sync] Hydration fallback notice:', err);
    } finally {
      setCoursesLoading(false);
    }
  }, []);

  const addCourse = async (course: Partial<Course>): Promise<{ data: Course | null; error: any }> => {
    try {
      if (isSupabaseConfigured()) {
        const res = await courseService.insertCourse(course);
        if (res.data) {
          setCourses(prev => [res.data!, ...prev.filter(c => c.id !== res.data!.id && c.slug !== res.data!.slug)]);
          notify(res.data.status === 'published' ? 'Course published successfully' : 'Draft course saved to CMS', 'success');
          return { data: res.data, error: null };
        } else {
          const isTableMissing = res.error?.code === 'PGRST205';
          const errMsg = isTableMissing
            ? 'The "courses" database table has not been created in Supabase yet. Please run the SQL migration.'
            : (res.error?.message || 'Unable to save course to database.');
          console.error('[AppContext] Supabase course save error:', res.error);
          notify(`Failed to save course: ${errMsg}`, 'error');
          return { data: null, error: res.error };
        }
      }

      // Offline / Unconfigured fallback
      const baseSlug = slugify(course.slug || course.title || course.name || 'course');
      const isFeatured = Boolean(course.isFeatured ?? course.featured);
      const title = (course.title || course.name || 'New Course').trim();

      const newCourse: Course = {
        id: `crs-${Date.now()}`,
        slug: baseSlug,
        title,
        name: title,
        shortOutcome: course.shortOutcome || course.short_outcome || '',
        short_outcome: course.shortOutcome || course.short_outcome || '',
        description: course.description || '',
        level: course.level || 'All Levels',
        deliveryMode: (course.deliveryMode || course.delivery_mode || 'Live Cohort') as any,
        delivery_mode: (course.deliveryMode || course.delivery_mode || 'Live Cohort') as any,
        duration: course.duration || '10 Hours · 24 Lessons',
        price: Number(course.price) || 0,
        offerPrice: course.offerPrice !== undefined ? Number(course.offerPrice) : undefined,
        offer_price: course.offerPrice !== undefined ? Number(course.offerPrice) : undefined,
        offerExpiresAt: course.offerExpiresAt,
        offer_expires_at: course.offerExpiresAt,
        currency: course.currency || 'INR',
        cohortStartDate: course.cohortStartDate,
        cohort_start_date: course.cohortStartDate,
        maxSeats: course.maxSeats,
        max_seats: course.maxSeats,
        enrolledCount: course.enrolledCount || 0,
        enrolled_count: course.enrolledCount || 0,
        instructor: course.instructor || 'Digital Muid',
        instructorTitle: course.instructorTitle,
        instructor_title: course.instructorTitle,
        instructorAvatar: course.instructorAvatar,
        instructor_avatar: course.instructorAvatar,
        thumbnail: course.thumbnail || 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80',
        coverImage: course.coverImage,
        cover_image: course.coverImage,
        aiIntegrated: Boolean(course.aiIntegrated),
        ai_integrated: Boolean(course.aiIntegrated),
        aiToolsCovered: course.aiToolsCovered || [],
        ai_tools_covered: course.aiToolsCovered || [],
        featured: isFeatured,
        isFeatured,
        status: (course.status as any) || 'draft',
        curriculum: course.curriculum || [],
        highlights: course.highlights || [],
        tags: course.tags || ['Digital Growth'],
        relatedFrameworks: course.relatedFrameworks || [],
        related_frameworks: course.relatedFrameworks || [],
        relatedArticles: course.relatedArticles || [],
        related_articles: course.relatedArticles || [],
        relatedVideos: course.relatedVideos || [],
        related_videos: course.relatedVideos || [],
        relatedResources: course.relatedResources || [],
        related_resources: course.relatedResources || [],
        seoTitle: course.seoTitle,
        seoDescription: course.seoDescription,
        ogImage: course.ogImage,
        createdAt: new Date().toISOString()
      };

      setCourses(prev => [newCourse, ...prev]);
      notify(newCourse.status === 'published' ? 'Course published to catalog' : 'Draft course saved to CMS', 'success');
      return { data: newCourse, error: null };
    } catch (err: any) {
      console.error('[AppContext] Error adding course:', err);
      notify(`Unable to save course: ${err.message || 'Database error'}`, 'error');
      return { data: null, error: err };
    }
  };

  const updateCourse = async (id: string, updated: Partial<Course>): Promise<{ data: Course | null; error: any }> => {
    try {
      if (isSupabaseConfigured()) {
        const res = await courseService.updateCourse(id, updated);
        if (res.data) {
          setCourses(prev => prev.map(c => (c.id === id ? res.data! : c)));
          notify(res.data.status === 'published' ? 'Course updated & published' : 'Draft updated in CMS', 'success');
          return { data: res.data, error: null };
        } else {
          const isTableMissing = res.error?.code === 'PGRST205';
          const errMsg = isTableMissing
            ? 'The "courses" database table has not been created in Supabase yet. Please run the SQL migration.'
            : (res.error?.message || 'Unable to update course in database.');
          console.error('[AppContext] Supabase course update failed:', res.error);
          notify(`Failed to update course: ${errMsg}`, 'error');
          return { data: null, error: res.error };
        }
      }

      let updatedCourse: Course | null = null;
      setCourses(prev =>
        prev.map(c => {
          if (c.id !== id) return c;
          const isFeatured = updated.isFeatured !== undefined
            ? Boolean(updated.isFeatured)
            : (updated.featured !== undefined ? Boolean(updated.featured) : (c.isFeatured ?? c.featured ?? false));
          const title = (updated.title || updated.name || c.title || c.name).trim();

          const resCourse: Course = {
            ...c,
            ...updated,
            title,
            name: title,
            isFeatured,
            featured: isFeatured,
            updatedAt: new Date().toISOString()
          };
          updatedCourse = resCourse;
          return resCourse;
        })
      );

      notify(updated.status === 'published' ? 'Course updated & published' : 'Course updated in CMS', 'success');
      return { data: updatedCourse, error: null };
    } catch (err: any) {
      console.error('[AppContext] Error updating course:', err);
      notify(`Unable to update course: ${err.message || 'Database error'}`, 'error');
      return { data: null, error: err };
    }
  };

  const deleteCourse = async (id: string): Promise<{ success: boolean; error: any }> => {
    try {
      if (isSupabaseConfigured()) {
        const res = await courseService.deleteCourse(id);
        if (res.success) {
          setCourses(prev => prev.filter(c => c.id !== id));
          notify('Course removed from database', 'info');
          return { success: true, error: null };
        } else {
          const errMsg = res.error?.message || 'Unable to delete course from database.';
          console.error('[AppContext] Supabase course deletion failed:', res.error);
          notify(`Unable to delete course: ${errMsg}`, 'error');
          return { success: false, error: res.error };
        }
      }

      setCourses(prev => prev.filter(c => c.id !== id));
      notify('Course removed', 'info');
      return { success: true, error: null };
    } catch (err: any) {
      console.error('[AppContext] Error deleting course:', err);
      notify(`Unable to delete course: ${err.message || 'Database error'}`, 'error');
      return { success: false, error: err };
    }
  };

  const publishCourse = async (id: string): Promise<{ data: Course | null; error: any }> => {
    return updateCourse(id, {
      status: 'published'
    });
  };

  const unpublishCourse = async (id: string): Promise<{ data: Course | null; error: any }> => {
    return updateCourse(id, {
      status: 'draft'
    });
  };

  const syncInitialCourses = async (): Promise<{
    totalCount: number;
    importedCount: number;
    alreadyExistingCount: number;
    failedCount: number;
    results: any[];
  }> => {
    try {
      const res = await courseService.syncInitialCourses(INITIAL_COURSES);
      if (res.importedCount > 0) {
        notify(`${res.importedCount} baseline course${res.importedCount === 1 ? '' : 's'} synchronized to database`, 'success');
      } else if (res.alreadyExistingCount > 0 && res.failedCount === 0) {
        notify('All baseline courses are already synchronized.', 'info');
      } else if (res.failedCount > 0) {
        notify(`Failed to synchronize ${res.failedCount} course${res.failedCount === 1 ? '' : 's'}.`, 'error');
      }
      await refreshCourses();
      return res;
    } catch (err: any) {
      console.error('[AppContext] syncInitialCourses error:', err);
      notify(`Sync failed: ${err?.message || 'Database error'}`, 'error');
      return {
        totalCount: INITIAL_COURSES.length,
        importedCount: 0,
        alreadyExistingCount: 0,
        failedCount: INITIAL_COURSES.length,
        results: []
      };
    }
  };

  const addTestimonial = (t: Omit<Testimonial, 'id'>) => {
    const newT: Testimonial = { ...t, id: `t-${Date.now()}` };
    setTestimonials(prev => [newT, ...prev]);
    notify('Testimonial added', 'success');
  };

  const deleteTestimonial = (id: string) => {
    setTestimonials(prev => prev.filter(t => t.id !== id));
    notify('Testimonial removed', 'info');
  };

  const addSpeakingEvent = (event: Omit<SpeakingEvent, 'id'>) => {
    const newEvent: SpeakingEvent = { ...event, id: `spk-${Date.now()}` };
    setSpeakingEvents(prev => [newEvent, ...prev]);
    notify('Speaking engagement recorded', 'success');
  };

  const deleteSpeakingEvent = (id: string) => {
    setSpeakingEvents(prev => prev.filter(s => s.id !== id));
    notify('Speaking engagement removed', 'info');
  };

  const updateConsultationProduct = async (
    prod: Partial<ConsultationProduct>
  ): Promise<{ success: boolean; error?: any }> => {
    const updatedProd = { ...consultationProduct, ...prod };
    const { data, error } = await consultationProductService.updateConsultationProduct(updatedProd);

    if (error) {
      console.error('[Supabase Product] Failed to update consultation product in database:', error);
      notify(error.message || 'Failed to update consultation pricing in database', 'error');
      return { success: false, error };
    }

    const finalProduct = data || updatedProd;
    setConsultationProduct(finalProduct);
    notify('Consultation pricing and configuration updated successfully', 'success');
    return { success: true };
  };

  const updateAvailabilityRules = async (
    rules: Partial<AvailabilityRules>
  ): Promise<{ success: boolean; error?: any }> => {
    const updatedRules = { ...availabilityRules, ...rules };
    const { data, error } = await availabilityService.updateAvailabilityRules(updatedRules);

    if (error) {
      console.error('[Supabase Availability] Failed to update availability rules in database:', error);
      notify(error.message || 'Failed to update availability rules in database', 'error');
      return { success: false, error };
    }

    const finalRules = data || updatedRules;
    setAvailabilityRules(finalRules);
    setStoredItem('availability', finalRules);
    notify('Availability calendar rules updated successfully', 'success');
    return { success: true };
  };

  const addLead = (lead: Omit<Lead, 'id' | 'createdAt'>) => {
    const timestamp = new Date().toISOString();
    const newLead: Lead = {
      ...lead,
      id: generateUUID(),
      createdAt: timestamp
    };
    setLeads(prev => [newLead, ...prev]);
    leadService.insertLead(newLead).catch(err => {
      console.warn('[Supabase Lead] Insert write-through fallback to local:', err);
    });

    if (lead.source === 'Contact Form' || lead.source === 'Contact') {
      const newMsg: ContactMessage = {
        id: generateUUID(),
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        inquiryType: lead.interest || 'General Inquiry',
        message: lead.notes || '',
        createdAt: timestamp
      };
      contactService.insertContactMessage(newMsg).catch(err => {
        console.warn('[Supabase Contact] Message write-through fallback to local:', err);
      });
    }

    notify('Inquiry submitted successfully', 'success');
  };

  const submitContactMessage = (msg: {
    name: string;
    email: string;
    phone?: string;
    inquiryType: string;
    message: string;
  }) => {
    const timestamp = new Date().toISOString();
    const messageId = generateUUID();
    const newMsg: ContactMessage = {
      id: messageId,
      name: msg.name,
      email: msg.email,
      phone: msg.phone,
      inquiryType: msg.inquiryType,
      message: msg.message,
      createdAt: timestamp
    };

    const newLead: Lead = {
      id: generateUUID(),
      name: msg.name,
      email: msg.email,
      phone: msg.phone,
      source: 'Contact Form',
      interest: msg.inquiryType,
      notes: msg.message,
      status: 'New',
      createdAt: timestamp
    };

    setContactMessages(prev => [newMsg, ...prev]);
    setLeads(prev => [newLead, ...prev]);

    contactService.insertContactMessage(newMsg).catch(err => {
      console.warn('[Supabase Contact] Message write-through fallback to local:', err);
    });
    leadService.insertLead(newLead).catch(err => {
      console.warn('[Supabase Lead] Contact lead write-through fallback to local:', err);
    });

    notify('Message dispatched successfully!', 'success');
  };

  const updateLeadStatus = (id: string, status: Lead['status'], notes?: string) => {
    setLeads(prev =>
      prev.map(l => (l.id === id ? { ...l, status, notes: notes !== undefined ? notes : l.notes } : l))
    );
    leadService.updateLead(id, { status, notes }).catch(err => {
      console.warn('[Supabase Lead] Status update write-through fallback to local:', err);
    });
    notify(`Lead marked as ${status}`, 'success');
  };

  const deleteLead = (id: string) => {
    setLeads(prev => prev.filter(l => l.id !== id));
    leadService.deleteLead(id).catch(err => {
      console.warn('[Supabase Lead] Delete write-through fallback to local:', err);
    });
    notify('Lead removed', 'info');
  };

  const deleteContactMessage = (id: string) => {
    setContactMessages(prev => prev.filter(m => m.id !== id));
    contactService.deleteContactMessage(id).catch(err => {
      console.warn('[Supabase Contact] Delete write-through fallback to local:', err);
    });
    notify('Inquiry message removed', 'info');
  };

  const addSubscriber = (email: string, name: string = '', source: string = 'Homepage Brief') => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      notify('Please provide a valid email address', 'error');
      return false;
    }
    const exists = subscribers.some(s => s.email.toLowerCase() === cleanEmail);
    if (exists) {
      notify('You are already subscribed to The Digital Muid Brief!', 'info');
      return true;
    }
    const newSub: NewsletterSubscriber = {
      id: generateUUID(),
      name: name || cleanEmail.split('@')[0],
      email: cleanEmail,
      source,
      subscribedAt: new Date().toISOString()
    };
    setSubscribers(prev => [newSub, ...prev]);

    // Also add as CRM lead
    const newLead: Lead = {
      id: generateUUID(),
      name: name || cleanEmail.split('@')[0],
      email: cleanEmail,
      source: 'Newsletter',
      interest: 'The Digital Muid Brief',
      notes: `Subscribed via ${source}`,
      status: 'New',
      createdAt: new Date().toISOString()
    };
    setLeads(prev => [newLead, ...prev]);

    // Asynchronous Supabase write-through
    subscriberService.insertSubscriber(newSub).catch(err => {
      console.warn('[Supabase Subscriber] Insert write-through fallback to local:', err);
    });
    leadService.insertLead(newLead).catch(err => {
      console.warn('[Supabase Lead] Subscriber lead write-through fallback to local:', err);
    });

    notify('Welcome to The Digital Muid Brief! Check your inbox.', 'success');
    return true;
  };

  const deleteSubscriber = (id: string) => {
    setSubscribers(prev => prev.filter(s => s.id !== id));
    subscriberService.deleteSubscriber(id).catch(err => {
      console.warn('[Supabase Subscriber] Delete write-through fallback to local:', err);
    });
    notify('Subscriber removed', 'info');
  };

  const updateSettings = (updated: Partial<SiteSettings>) => {
    const updatedSettings = { ...settings, ...updated };
    setSettings(updatedSettings);
    settingsService.updateSiteSettings(updatedSettings).catch(err => {
      console.warn('[Supabase Settings] Update write-through fallback to local:', err);
    });
    notify('Settings saved', 'success');
  };

  return (
    <AppContext.Provider
      value={{
        articles,
        refreshArticles,
        addArticle,
        updateArticle,
        deleteArticle,
        publishArticle,
        unpublishArticle,
        videos,
        refreshVideos,
        addVideo,
        updateVideo,
        deleteVideo,
        publishVideo,
        unpublishVideo,
        frameworks,
        frameworksLoading,
        refreshFrameworks,
        addFramework,
        updateFramework,
        deleteFramework,
        publishFramework,
        unpublishFramework,
        toggleFeatureFramework,
        syncInitialFrameworks,
        frameworkCategories,
        refreshFrameworkCategories,
        addFrameworkCategory,
        updateFrameworkCategory,
        deleteFrameworkCategory,
        toggleFrameworkCategoryStatus,
        reorderFrameworkCategories,
        resources,
        refreshResources,
        addResource,
        updateResource,
        deleteResource,
        publishResource,
        unpublishResource,
        recordResourceDownload,
        courses,
        coursesLoading,
        refreshCourses,
        addCourse,
        updateCourse,
        deleteCourse,
        publishCourse,
        unpublishCourse,
        syncInitialCourses,
        testimonials,
        addTestimonial,
        deleteTestimonial,
        speakingEvents,
        addSpeakingEvent,
        deleteSpeakingEvent,
        consultationProduct,
        updateConsultationProduct,
        availabilityRules,
        updateAvailabilityRules,
        refreshAvailabilityRules,
        bookings,
        getAvailableSlotsForDate,
        fetchLiveAvailableSlots,
        createBooking,
        cancelBooking,
        rescheduleBooking,
        updateBookingStatus,
        deleteBooking,
        leads,
        addLead,
        submitContactMessage,
        updateLeadStatus,
        deleteLead,
        contactMessages,
        deleteContactMessage,
        subscribers,
        addSubscriber,
        deleteSubscriber,
        settings,
        updateSettings,
        refreshDashboardData,
        adminUser,
        adminSession,
        isAdminAuthenticated,
        isAuthLoading,
        adminLogin,
        adminLogout,
        requestPasswordReset,
        currentUser,
        currentSession,
        userProfile,
        isStudentAuthenticated,
        authRole,
        studentLogin,
        studentRegister,
        studentLogout,
        refreshUserProfile,
        updateStudentProfile,
        updatePassword,
        studentEnrollments,
        isEnrollmentsLoading,
        enrollmentsError,
        refreshStudentEnrollments,
        studentBookings,
        isBookingsLoading,
        bookingsError,
        refreshStudentBookings,
        studentNotifications,
        isNotificationsLoading,
        unreadNotificationsCount,
        fetchStudentNotifications,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        studentBookmarks,
        isBookmarksLoading,
        fetchStudentBookmarks,
        isBookmarked,
        toggleBookmark,
        courseWishlist,
        isWishlistLoading,
        refreshCourseWishlist,
        isCourseWishlisted,
        toggleCourseWishlist,
        removeFromWishlist,
        studentCertificates,
        isCertificatesLoading,
        certificatesError,
        fetchStudentCertificates,
        issueCourseCertificate,
        getCertificateForCourse,
        studentPayments,
        isPaymentsLoading,
        paymentsError,
        fetchStudentPayments,
        adminPayments,
        isAdminPaymentsLoading,
        adminPaymentsError,
        fetchAdminPayments,
        webEnquiries,
        isWebEnquiriesLoading,
        webEnquiriesError,
        fetchAdminWebEnquiries,
        updateWebEnquiry,
        deleteWebEnquiry,
        courseProgressMap,
        isProgressLoading,
        fetchCourseProgress,
        updateLessonPlaybackPosition,
        toggleLessonProgressCompletion,
        getCourseProgressStats,
        isSearchOpen,
        setIsSearchOpen,
        searchQuery,
        setSearchQuery,
        notification,
        notify
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
