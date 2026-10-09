export interface ArticleAuthor {
  name: string;
  role?: string;
  avatar?: string;
}

export interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  author: string | ArticleAuthor;
  featuredImage?: string;
  readingTimeMinutes?: number;
  readTime?: string;
  tags?: string[];
  status: 'draft' | 'published' | 'archived';
  isFeatured?: boolean;
  featured?: boolean;
  publishedAt?: string;
  seoTitle?: string;
  seoDescription?: string;
  ogImage?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Video {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  youtubeUrl?: string;
  youtubeVideoId?: string;
  thumbnailUrl?: string;
  thumbnail?: string; // alias for UI compatibility
  videoUrl?: string; // alias for UI compatibility
  embedUrl?: string; // computed or stored embed URL
  duration?: string;
  creator?: string;
  tags: string[];
  status: 'draft' | 'published' | 'archived';
  isFeatured?: boolean;
  featured?: boolean; // alias for UI compatibility
  publishedAt?: string;
  viewsCount?: string;
  seoTitle?: string;
  seoDescription?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface FrameworkStage {
  step: number;
  title: string;
  shortDescription?: string;
  content?: string;
  keyActions?: string[];
  outcome?: string;
  // UI aliases
  number?: string;
  subtitle?: string;
  description?: string;
  impact?: string;
  iconName?: string;
}

export type FrameworkStep = FrameworkStage;

export interface Framework {
  id: string;
  title: string;
  name?: string; // UI alias
  slug: string;
  subtitle: string;
  description: string;
  category: string;
  author: string;
  coverImage?: string;
  cover_image?: string;
  problemStatement?: string;
  problem_statement?: string;
  solutionStatement?: string;
  solution_statement?: string;
  frameworkContent: FrameworkStage[];
  framework_content?: FrameworkStage[];
  whoIsItFor?: string;
  who_is_it_for?: string;
  whenToUse?: string;
  when_to_use?: string;
  relatedArticles?: string[];
  related_articles?: string[];
  relatedVideos?: string[];
  related_videos?: string[];
  relatedResources?: string[];
  related_resources?: string[];
  tags: string[];
  status: 'draft' | 'published' | 'archived';
  isFeatured?: boolean;
  is_featured?: boolean;
  featured?: boolean; // UI alias
  seoTitle?: string;
  seo_title?: string;
  seoDescription?: string;
  seo_description?: string;
  publishedAt?: string;
  published_at?: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;

  // Legacy/UI aliases for backward compatibility
  introduction?: string;
  problem?: string;
  steps?: FrameworkStage[];
  principles?: string[];
  diagramType?: 'stack' | 'cycle' | 'matrix' | 'flow';
  examples?: string[];
  relatedCourses?: string[];
  ctaText?: string;
}

export interface FrameworkCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  sortOrder: number;
  sort_order?: number; // DB alias
  isActive: boolean;
  is_active?: boolean; // DB alias
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
}

export type ResourceType =
  | 'Guide'
  | 'Checklist'
  | 'Template'
  | 'Framework'
  | 'E-book'
  | 'Report'
  | 'Toolkit'
  | 'Worksheet'
  | 'Prompt Pack'
  | 'Blueprint'
  | 'Other';

export interface Resource {
  id: string;
  title: string;
  name?: string; // alias for UI compatibility
  slug: string;
  description: string;
  resourceType: string;
  type?: ResourceType; // alias for UI compatibility
  category: string;
  fileUrl?: string;
  externalUrl?: string;
  thumbnailUrl?: string;
  coverImage?: string; // alias for UI compatibility
  author?: string;
  fileType?: string;
  fileSize?: string;
  format?: string; // alias for UI compatibility
  readingTimeMinutes?: number;
  tags?: string[];
  status: 'draft' | 'published' | 'archived';
  isFeatured?: boolean;
  featured?: boolean; // alias for UI compatibility
  publishedAt?: string;
  downloadCount?: number;
  previewPoints?: string[];
  whatIsIncluded?: string[];
  leadCaptureRequired?: boolean;
  seoTitle?: string;
  seoDescription?: string;
  createdAt?: string;
  updatedAt?: string;
  downloadUrl?: string; // alias for UI compatibility
}

export interface CourseLesson {
  id?: string; // Stable persistent lesson identifier
  title: string;
  description?: string;
  durationMinutes?: number;
  duration?: string; // string representation e.g. "45 mins" or "1.5 hours"
  deliveryType?: 'live' | 'recorded' | 'hybrid' | 'reading';
  videoUrl?: string; // Kept as optional legacy/in-memory field; stripped from public responses
  meetUrl?: string;
  isPreview?: boolean;
  order?: number;
  hasSecureMedia?: boolean; // Safe flag to indicate configured protected video without exposing credentials
  mediaProvider?: 'cloudflare_stream' | 'mux' | 'supabase_storage' | 'youtube_unlisted' | 'external';
}

export interface CourseLessonMedia {
  id?: string;
  courseId: string;
  lessonId: string;
  provider: 'cloudflare_stream' | 'mux' | 'supabase_storage' | 'youtube_unlisted' | 'external';
  assetId: string;
  isPreview: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CourseEnrollment {
  id: string;
  userId: string;
  courseId: string;
  status: 'active' | 'expired' | 'revoked';
  enrolledAt: string;
  expiresAt?: string | null;
  source: 'purchase' | 'admin_grant' | 'cohort';
  orderId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface StudentEnrollmentWithCourse extends CourseEnrollment {
  course?: Course;
  progressPercent?: number;
  completedLessonsCount?: number;
  totalLessonsCount?: number;
  lastAccessedAt?: string;
  lastLessonId?: string;
}

export interface CourseProgressSummary {
  totalLessons: number;
  completedLessons: number;
  progressPercent: number;
  isCourseCompleted: boolean;
}

export interface PlaybackAuthorization {
  authorized: boolean;
  provider?: string;
  assetId?: string;
  playbackType?: 'preview' | 'admin_preview' | 'enrolled_student';
  expiresAt?: string;
  error?: string;
  isEnrolled?: boolean;
  isAdmin?: boolean;
  isPreview?: boolean;
}

export interface CourseModule {
  id: string;
  module: string; // Title / Name of the module
  title?: string; // alias
  summary?: string;
  duration?: string;
  lessons: string[] | CourseLesson[];
  order?: number;
}

export interface Course {
  id: string;
  slug: string;
  title: string;
  name?: string; // alias
  shortOutcome: string;
  short_outcome?: string; // db alias
  description: string;
  curriculum: CourseModule[] | Array<{
    module: string;
    lessons: string[] | CourseLesson[];
    duration?: string;
    summary?: string;
  }>;
  duration: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced' | 'All Levels';
  deliveryMode?: 'Live Cohort' | 'Self-Paced' | 'Hybrid Masterclass';
  delivery_mode?: string; // db alias
  price: number;
  offerPrice?: number;
  offer_price?: number; // db alias
  offerExpiresAt?: string;
  offer_expires_at?: string; // db alias
  currency?: string;
  thumbnail: string;
  coverImage?: string;
  cover_image?: string; // db alias
  instructor: string;
  instructorTitle?: string;
  instructor_title?: string; // db alias
  instructorAvatar?: string;
  instructor_avatar?: string; // db alias
  aiIntegrated: boolean;
  ai_integrated?: boolean; // db alias
  aiToolsCovered?: string[];
  ai_tools_covered?: string[]; // db alias
  featured: boolean;
  isFeatured?: boolean; // alias
  status: 'published' | 'draft' | 'archived';
  enrolledCount: number;
  enrolled_count?: number; // db alias
  cohortStartDate?: string;
  cohort_start_date?: string; // db alias
  maxSeats?: number;
  max_seats?: number; // db alias
  tags: string[];
  highlights: string[];
  relatedFrameworks?: string[];
  related_frameworks?: string[]; // db alias
  relatedArticles?: string[];
  related_articles?: string[]; // db alias
  relatedVideos?: string[];
  related_videos?: string[]; // db alias
  relatedResources?: string[];
  related_resources?: string[]; // db alias
  seoTitle?: string;
  seo_title?: string; // db alias
  seoDescription?: string;
  seo_description?: string; // db alias
  ogImage?: string;
  og_image?: string; // db alias
  createdAt?: string;
  created_at?: string; // db alias
  updatedAt?: string;
  updated_at?: string; // db alias
}

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  company: string;
  photo: string;
  category: 'Clients' | 'Students' | 'Collaborators';
  quote: string;
  metric?: string;
}

export interface SpeakingEvent {
  id: string;
  title: string;
  eventName: string;
  location: string;
  date: string;
  type: 'Keynote' | 'Panel' | 'Workshop' | 'Interview';
  topic: string;
  photo: string;
  link?: string;
  attendees?: string;
}

export interface ConsultationProduct {
  id: string;
  name: string;
  durationMinutes: number;
  basePrice: number;
  gstRate: number; // e.g., 0.18 for 18%
  currency: string;
  active: boolean;
  description: string;
  features: string[];
}

export interface AvailabilityRules {
  id?: string;
  workingDays: number[]; // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  startTime: string; // e.g. "11:00"
  endTime: string; // e.g. "20:00"
  slotDurationMinutes: number; // e.g. 30
  bufferMinutes: number; // e.g. 15
  breakPeriods: Array<{ start: string; end: string; name: string }>;
  blockedDates: string[]; // YYYY-MM-DD
  blockedSlots: Array<{ date: string; time: string; reason?: string }>;
  minNoticeHours: number;
  maxAdvanceDays: number;
}

export type BookingStatus = 'confirmed' | 'rescheduled' | 'cancelled' | 'completed';

export interface Booking {
  id: string;
  bookingCode: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  businessName: string;
  primaryChallenge: string;
  desiredOutcome: string;
  website?: string;
  linkedin?: string;
  instagram?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM (24h or 12h formatted)
  durationMinutes: number;
  baseAmount: number;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
  currency: string;
  paymentId: string;
  razorpayOrderId: string;
  paymentStatus: 'paid' | 'pending' | 'failed' | 'refunded';
  calendarEventId: string;
  meetUrl: string;
  status: BookingStatus;
  userId?: string;
  createdAt: string;
  notes?: string;
}

export type LeadStatus = 'New' | 'Contacted' | 'Qualified' | 'Converted' | 'Lost';

export type WebEnquiryStatus = 'New' | 'Contacted' | 'Qualified' | 'Proposal Sent' | 'Won' | 'Lost';

export type LeadSource =
  | 'Contact Form'
  | 'Contact'
  | 'Newsletter'
  | 'Resource Download'
  | 'Resource Lead Magnet'
  | 'Consultation Intake Brief'
  | 'Consultation'
  | 'Course Enquiry'
  | 'Speaking Enquiry'
  | 'Web Enquiry';

export interface WebEnquiryDetails {
  projectType: string;
  businessName: string;
  businessStage: string;
  goals: string[];
  features: string[];
  contentReadiness: string;
  existingWebsiteUrl?: string;
  referenceUrls?: string;
  timeline: string;
  readiness: string;
  decisionMaker: string;
  additionalRequirements?: string;
  internalNotes?: string;
  assignedTo?: string;
  followUpDate?: string;
  contactAttempts?: number;
  webStatus?: WebEnquiryStatus;
  consentAgreed?: boolean;
}

export interface WebEnquiry {
  id: string;
  referenceId: string;
  name: string;
  email: string;
  phone: string;
  businessName: string;
  projectType: string;
  timeline: string;
  source: 'Web Enquiry';
  details: WebEnquiryDetails;
  status: WebEnquiryStatus;
  createdAt: string;
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  source: LeadSource;
  interest: string;
  notes: string;
  status: LeadStatus;
  createdAt: string;
  amount?: number;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone?: string;
  inquiryType: string;
  message: string;
  createdAt: string;
}

export interface NewsletterSubscriber {
  id: string;
  name: string;
  email: string;
  source: string;
  subscribedAt: string;
}

export interface SiteSettings {
  adminEmail: string;
  razorpayKeyId: string;
  razorpayTestMode: boolean;
  googleCalendarConnected: boolean;
  googleMeetEnabled: boolean;
  notificationEmail: string;
  phoneContact: string;
  locationCity: string;
  socialLinkedin?: string;
  socialInstagram?: string;
  socialFacebook?: string;
  socialYoutube?: string;
}

// ==========================================
// Student / User Dashboard Models (Phase 1)
// ==========================================

export interface UserProfile {
  id: string; // matches auth.users.id
  fullName?: string | null;
  avatarUrl?: string | null;
  phone?: string | null;
  headline?: string | null;
  bio?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LessonProgress {
  id: string;
  userId: string;
  courseId: string;
  lessonId: string;
  completed: boolean;
  lastPositionSeconds: number;
  completedAt?: string | null;
  updatedAt: string;
}

export interface PaymentRecord {
  id: string;
  userId: string;
  itemType: 'course' | 'consultation' | 'subscription';
  itemId?: string | null;
  itemTitle?: string | null;
  amount: number;
  currency: string;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  status: 'pending' | 'captured' | 'failed' | 'refunded';
  invoiceUrl?: string | null;
  createdAt: string;
}

export interface UserNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'alert' | 'system';
  isRead: boolean;
  link?: string | null;
  linkUrl?: string | null;
  createdAt: string;
}

export type AuthRole = 'guest' | 'student' | 'admin';

export type BookmarkContentType = 'resource' | 'framework' | 'article' | 'video';

export interface StudentBookmark {
  id: string;
  userId: string;
  contentType: BookmarkContentType;
  contentId: string;
  createdAt: string;
}

export interface SavedContentItem {
  bookmarkId: string;
  contentType: BookmarkContentType;
  contentId: string;
  createdAt: string;
  // Resolved content details
  title: string;
  description?: string;
  slug?: string;
  category?: string;
  thumbnailUrl?: string;
  author?: string;
  publishedAt?: string;
  // Specific entity references
  resource?: Resource;
  framework?: Framework;
  article?: Article;
  video?: Video;
}

export interface StudentCourseWishlistItem {
  id: string;
  userId: string;
  courseId: string;
  createdAt: string;
}

export interface CertificateMetadata {
  instructorName?: string;
  courseDuration?: string;
  totalLessons?: number;
  gradeOrScore?: string;
  completionDate?: string;
  [key: string]: any;
}

export interface Certificate {
  id: string;
  userId: string;
  courseId: string;
  certificateNumber: string;
  recipientName: string;
  courseTitle: string;
  issuedAt: string;
  verificationHash: string;
  metadata?: CertificateMetadata;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateCourseOrderResult {
  success: boolean;
  orderId?: string;
  amount?: number;
  currency?: string;
  keyId?: string;
  courseId?: string;
  courseTitle?: string;
  alreadyEnrolled?: boolean;
  message?: string;
  error?: string;
}

export interface RazorpayCheckoutSuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface VerifyCoursePaymentResult {
  success: boolean;
  verified?: boolean;
  fulfilled?: boolean;
  status?: string;
  courseId?: string;
  courseSlug?: string;
  courseTitle?: string;
  orderId?: string;
  paymentId?: string;
  enrollmentId?: string;
  paymentDbId?: string;
  alreadyFulfilled?: boolean;
  warning?: string;
  message?: string;
  error?: string;
}

export interface CreateConsultationOrderResult {
  success: boolean;
  orderId?: string;
  amount?: number;
  currency?: string;
  keyId?: string;
  productTitle?: string;
  durationMinutes?: number;
  totalAmount?: number;
  basePrice?: number;
  gstAmount?: number;
  error?: string;
}

export interface VerifyConsultationPaymentResult {
  success: boolean;
  verified?: boolean;
  fulfilled?: boolean;
  booking?: Booking;
  payment?: PaymentRecord;
  alreadyFulfilled?: boolean;
  orderId?: string;
  paymentId?: string;
  warning?: string;
  error?: string;
}



