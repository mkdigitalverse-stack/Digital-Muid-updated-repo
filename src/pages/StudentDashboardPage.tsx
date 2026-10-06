import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  GraduationCap,
  BookOpen,
  Bookmark,
  CheckCircle2,
  Clock,
  ArrowRight,
  PlayCircle,
  Sparkles,
  TrendingUp,
  AlertCircle,
  Compass,
  ArrowUpRight,
  Calendar,
  Video,
  ExternalLink,
  Bell,
  CheckCheck,
  Info,
  AlertTriangle,
  Filter,
  Download,
  ShieldCheck,
  FileText,
  Loader2,
  Award,
  CreditCard,
  Receipt,
  Heart
} from 'lucide-react';
import { StudentEnrollmentWithCourse, LessonProgress, Resource, Framework, Course } from '../types';
import { INITIAL_COURSES } from '../data/initialData';
import { progressService, resourceService } from '../services';

interface StudentDashboardPageProps {
  navigate: (path: string) => void;
}

export const StudentDashboardPage: React.FC<StudentDashboardPageProps> = ({ navigate }) => {
  const {
    currentUser,
    userProfile,
    isAuthLoading,
    studentEnrollments,
    isEnrollmentsLoading,
    enrollmentsError,
    refreshStudentEnrollments,
    studentBookings,
    isBookingsLoading,
    refreshStudentBookings,
    studentNotifications,
    isNotificationsLoading,
    unreadNotificationsCount,
    fetchStudentNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    courses,
    resources,
    frameworks,
    studentBookmarks,
    courseWishlist,
    isCourseWishlisted,
    toggleCourseWishlist,
    studentCertificates,
    studentPayments,
    isPaymentsLoading,
    notify
  } = useApp();

  const [activeFeedFilter, setActiveFeedFilter] = useState<'all' | 'notifications' | 'courses' | 'consultations'>('all');
  const [lessonProgressList, setLessonProgressList] = useState<LessonProgress[]>([]);
  const [isProgressFeedLoading, setIsProgressFeedLoading] = useState<boolean>(false);
  const [feedLimit, setFeedLimit] = useState<number>(8);
  const [deliveringResourceId, setDeliveringResourceId] = useState<string | null>(null);

  // Derive relevant toolkits and frameworks linked to the student's enrolled courses
  const enrolledMaterials = useMemo(() => {
    const resourceIdSet = new Set<string>();
    const frameworkIdSet = new Set<string>();

    studentEnrollments.forEach((e) => {
      const c = e.course;
      if (c) {
        (c.relatedResources || (c as any).related_resources || []).forEach((id: string) => resourceIdSet.add(id));
        (c.relatedFrameworks || (c as any).related_frameworks || []).forEach((id: string) => frameworkIdSet.add(id));
      }
    });

    const matchedResources = (resources || []).filter(
      (r) => resourceIdSet.has(r.id) && (r.status === 'published' || !r.status)
    );
    const matchedFrameworks = (frameworks || []).filter(
      (f) => frameworkIdSet.has(f.id) && (f.status === 'published' || !f.status)
    );

    // If courses don't have explicit linking IDs yet, surface top published toolkits and frameworks
    const displayResources = matchedResources.length > 0
      ? matchedResources
      : (resources || []).filter((r) => r.status === 'published' || !r.status).slice(0, 4);

    const displayFrameworks = matchedFrameworks.length > 0
      ? matchedFrameworks
      : (frameworks || []).filter((f) => f.status === 'published' || !f.status).slice(0, 4);

    return {
      resources: displayResources,
      frameworks: displayFrameworks,
      hasDirectLinks: matchedResources.length > 0 || matchedFrameworks.length > 0,
      totalCount: displayResources.length + displayFrameworks.length
    };
  }, [studentEnrollments, resources, frameworks]);

  const handleDeliverToolkit = async (res: Resource) => {
    setDeliveringResourceId(res.id);
    try {
      const deliveryRes = await resourceService.deliverResource(res);
      if (!deliveryRes.success) {
        notify(deliveryRes.error || 'Unable to open toolkit.', 'error');
      } else {
        notify(`Student Access: Delivering ${res.title || res.name}...`, 'success');
      }
    } catch (err: any) {
      console.error('[StudentDashboardPage] Error opening toolkit:', err);
      notify('Unable to open toolkit.', 'error');
    } finally {
      setDeliveringResourceId(null);
    }
  };

  // Lightweight, deterministic Suggested Courses recommendation model (Phase 2A)
  const suggestedCourses = useMemo<Course[]>(() => {
    // Step 1: Filter published courses
    const allCoursesList: Course[] = (courses && courses.length > 0)
      ? courses
      : INITIAL_COURSES;

    const published = allCoursesList.filter((c) => c.status === 'published' || !c.status);

    // Step 2: Remove courses already enrolled by the current student
    const enrolledIds = new Set<string>();
    const enrolledSlugs = new Set<string>();
    studentEnrollments.forEach((e) => {
      enrolledIds.add(e.courseId);
      if (e.course?.id) enrolledIds.add(e.course.id);
      if (e.course?.slug) enrolledSlugs.add(e.course.slug);
    });

    const unenrolled = published.filter(
      (c) => !enrolledIds.has(c.id) && !enrolledSlugs.has(c.slug)
    );

    if (unenrolled.length === 0) return [];

    // Step 3: New Student Fallback
    // If the student has no enrolled courses: published courses -> enrolledCount DESC -> top 3
    if (studentEnrollments.length === 0) {
      return [...unenrolled]
        .sort((a, b) => {
          const countA = a.enrolledCount ?? (a as any).enrolled_count ?? 0;
          const countB = b.enrolledCount ?? (b as any).enrolled_count ?? 0;
          return countB - countA;
        })
        .slice(0, 3);
    }

    // Step 4: Build affinity and score candidates
    // Category match: +10
    // Each shared tag: +3
    // If multiple enrolled courses match, scores accumulate.
    const scoredCandidates = unenrolled.map((candidate) => {
      let relevanceScore = 0;

      const candidateCategory = ((candidate as any).category || (candidate as any).category_name || '').toLowerCase().trim();
      const candidateTags = (candidate.tags || []).map((t) => t.toLowerCase().trim());

      studentEnrollments.forEach((enrollment) => {
        const enrolledCourse = enrollment.course;
        if (!enrolledCourse) return;

        // Category match: +10
        const enrolledCategory = ((enrolledCourse as any).category || (enrolledCourse as any).category_name || '').toLowerCase().trim();
        if (candidateCategory && enrolledCategory && candidateCategory === enrolledCategory) {
          relevanceScore += 10;
        }

        // Each shared tag: +3
        const enrolledTags = (enrolledCourse.tags || []).map((t) => t.toLowerCase().trim());
        const sharedTagsCount = candidateTags.filter((tag) => enrolledTags.includes(tag)).length;
        relevanceScore += sharedTagsCount * 3;
      });

      const enrolledCount = candidate.enrolledCount ?? (candidate as any).enrolled_count ?? 0;

      return {
        course: candidate,
        relevanceScore,
        enrolledCount
      };
    });

    // Step 5: Ordering: relevance score DESC, enrolledCount DESC
    scoredCandidates.sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      return b.enrolledCount - a.enrolledCount;
    });

    // Step 6: Return at most 3 courses
    return scoredCandidates.slice(0, 3).map((item) => item.course);
  }, [courses, studentEnrollments]);

  // Redirect unauthenticated visitors to login
  useEffect(() => {
    if (!isAuthLoading && !currentUser) {
      navigate('/login');
    }
  }, [isAuthLoading, currentUser, navigate]);

  // Ensure enrollments, bookings, notifications, and progress are freshly hydrated
  useEffect(() => {
    if (currentUser) {
      refreshStudentEnrollments().catch(() => {});
      refreshStudentBookings().catch(() => {});
      fetchStudentNotifications(currentUser.id).catch(() => {});

      setIsProgressFeedLoading(true);
      progressService.fetchMyAllProgress().then((res) => {
        if (res.data) {
          setLessonProgressList(res.data);
        }
      }).catch((err) => {
        console.error('[StudentDashboard] Error loading progress stream:', err);
      }).finally(() => {
        setIsProgressFeedLoading(false);
      });
    }
  }, [currentUser, refreshStudentEnrollments, refreshStudentBookings, fetchStudentNotifications]);

  // Student display name
  const displayName = useMemo(() => {
    if (userProfile?.fullName) return userProfile.fullName;
    if (currentUser?.user_metadata?.full_name) return currentUser.user_metadata.full_name;
    if (currentUser?.user_metadata?.name) return currentUser.user_metadata.name;
    return 'Student';
  }, [userProfile, currentUser]);

  // Next upcoming consultation
  const nextUpcomingConsultation = useMemo(() => {
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    const valid = studentBookings
      .filter((b) => b.status !== 'cancelled' && b.status !== 'completed' && (b.date || '') >= todayStr)
      .sort((a, b) => {
        const dateDiff = a.date.localeCompare(b.date);
        if (dateDiff !== 0) return dateDiff;
        return a.time.localeCompare(b.time);
      });
    return valid[0] || null;
  }, [studentBookings]);

  // Computed summary statistics across active enrollments
  const summary = useMemo(() => {
    const totalEnrolled = studentEnrollments.length;
    let completedCourses = 0;
    let inProgressCourses = 0;
    let notStartedCourses = 0;
    let totalProgressSum = 0;

    studentEnrollments.forEach((item) => {
      const pct = Math.min(100, Math.max(0, item.progressPercent || 0));
      totalProgressSum += pct;
      if (pct >= 100) {
        completedCourses += 1;
      } else if (pct > 0) {
        inProgressCourses += 1;
      } else {
        notStartedCourses += 1;
      }
    });

    const overallProgress = totalEnrolled > 0 ? Math.round(totalProgressSum / totalEnrolled) : 0;

    return {
      totalEnrolled,
      completedCourses,
      inProgressCourses,
      notStartedCourses,
      overallProgress
    };
  }, [studentEnrollments]);

  // Determine Continue Learning list (courses not yet 100% completed)
  // Sorted by most recent activity/access timestamp descending
  const continueLearningList = useMemo(() => {
    const active = studentEnrollments.filter((item) => (item.progressPercent || 0) < 100);

    return [...active].sort((a, b) => {
      const timeA = a.lastAccessedAt ? new Date(a.lastAccessedAt).getTime() : 0;
      const timeB = b.lastAccessedAt ? new Date(b.lastAccessedAt).getTime() : 0;
      return timeB - timeA;
    });
  }, [studentEnrollments]);

  // Most prominent course to resume
  const featuredResumeCourse = continueLearningList[0] || null;

  // Unified Student Activity & Notifications stream (Phase 2F)
  const unifiedActivities = useMemo(() => {
    const list: Array<{
      id: string;
      rawId: string;
      source: 'notification' | 'progress' | 'enrollment' | 'booking';
      type: string;
      title: string;
      description: string;
      timestamp: string;
      isRead: boolean;
      link: string | null;
      badgeText: string;
      timeMs: number;
    }> = [];

    // 1. Student Notifications
    studentNotifications.forEach((n) => {
      const timeMs = new Date(n.createdAt).getTime() || 0;
      list.push({
        id: `notif-${n.id}`,
        rawId: n.id,
        source: 'notification',
        type: n.type,
        title: n.title,
        description: n.message,
        timestamp: n.createdAt,
        isRead: n.isRead,
        link: n.link || n.linkUrl || null,
        badgeText: n.type === 'system' ? 'System' : n.type === 'alert' ? 'Notice' : 'Notification',
        timeMs
      });
    });

    // 2. Course Enrollments
    studentEnrollments.forEach((e) => {
      const ts = e.enrolledAt || e.createdAt;
      const timeMs = new Date(ts).getTime() || 0;
      const course = e.course;
      const slug = course?.slug || e.courseId;
      const pct = Math.min(100, Math.max(0, e.progressPercent || 0));
      list.push({
        id: `enrollment-${e.id}`,
        rawId: e.id,
        source: 'enrollment',
        type: 'course',
        title: `Enrolled in ${course?.title || 'Masterclass'}`,
        description: pct > 0 ? `Current learning progress: ${pct}% complete.` : 'Enrollment active. Ready to start module 1.',
        timestamp: ts,
        isRead: true,
        link: `/learn/${slug}/player`,
        badgeText: 'Enrolled',
        timeMs
      });
    });

    // 3. Lesson Progress & Completion Milestones
    lessonProgressList.forEach((p) => {
      const ts = p.completedAt || p.updatedAt;
      const timeMs = new Date(ts).getTime() || 0;
      const course = studentEnrollments.find((e) => e.courseId === p.courseId)?.course;
      const slug = course?.slug || p.courseId;
      const courseTitle = course?.title || 'Masterclass';

      list.push({
        id: `progress-${p.id || `${p.courseId}-${p.lessonId}`}`,
        rawId: p.id,
        source: 'progress',
        type: p.completed ? 'completed' : 'progress',
        title: p.completed ? `Lesson completed in ${courseTitle}` : `In-progress lesson in ${courseTitle}`,
        description: p.completed
          ? 'Completed lesson and saved progress to profile.'
          : `Playback active at ${Math.floor((p.lastPositionSeconds || 0) / 60)}m`,
        timestamp: ts,
        isRead: true,
        link: `/learn/${slug}/player`,
        badgeText: p.completed ? 'Lesson Completed' : 'Progress Saved',
        timeMs
      });
    });

    // 4. Consultation Bookings
    studentBookings.forEach((b) => {
      const ts = b.createdAt || `${b.date}T${b.time || '10:00'}:00Z`;
      const timeMs = new Date(ts).getTime() || 0;
      const statusLabel =
        b.status === 'confirmed'
          ? 'Confirmed'
          : b.status === 'completed'
          ? 'Completed'
          : b.status === 'cancelled'
          ? 'Cancelled'
          : 'Scheduled';

      list.push({
        id: `booking-${b.id}`,
        rawId: b.id,
        source: 'booking',
        type: b.status,
        title: b.serviceName ? `Consultation: ${b.serviceName}` : '1-on-1 Growth Consultation',
        description: `Scheduled for ${b.date} at ${b.time} (${statusLabel})`,
        timestamp: ts,
        isRead: true,
        link: '/my-consultations',
        badgeText: statusLabel,
        timeMs
      });
    });

    // Sort descending by time
    return list.sort((a, b) => b.timeMs - a.timeMs);
  }, [studentNotifications, studentEnrollments, lessonProgressList, studentBookings]);

  // Filtered Activity Stream
  const filteredActivities = useMemo(() => {
    if (activeFeedFilter === 'notifications') {
      return unifiedActivities.filter((a) => a.source === 'notification');
    }
    if (activeFeedFilter === 'courses') {
      return unifiedActivities.filter((a) => a.source === 'progress' || a.source === 'enrollment');
    }
    if (activeFeedFilter === 'consultations') {
      return unifiedActivities.filter((a) => a.source === 'booking');
    }
    return unifiedActivities;
  }, [unifiedActivities, activeFeedFilter]);

  // Counts for filter pills
  const feedCounts = useMemo(() => {
    return {
      all: unifiedActivities.length,
      notifications: studentNotifications.length,
      courses: studentEnrollments.length + lessonProgressList.length,
      consultations: studentBookings.length
    };
  }, [unifiedActivities.length, studentNotifications.length, studentEnrollments.length, lessonProgressList.length, studentBookings.length]);

  // Render Loading Skeleton
  if (isAuthLoading || (isEnrollmentsLoading && studentEnrollments.length === 0)) {
    return (
      <div id="student-dashboard-loading" className="pt-28 sm:pt-32 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-32 bg-slate-200 rounded-md" />
          <div className="h-10 w-72 bg-slate-200 rounded-xl" />
          <div className="h-5 w-96 bg-slate-200 rounded-md" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white border border-slate-200 rounded-2xl animate-pulse p-5" />
          ))}
        </div>
        <div className="h-64 bg-white border border-slate-200 rounded-3xl animate-pulse" />
      </div>
    );
  }

  // If user is unauthenticated after loading, render blank/redirecting container
  if (!currentUser) {
    return null;
  }

  return (
    <div id="student-dashboard-root" className="pt-28 sm:pt-32 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
      {/* 1. Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-200">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-[#FF6B00] text-xs font-bold uppercase tracking-wider font-interface">
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Student Learning Portal</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-slate-900 tracking-tight">
            Welcome back, {displayName}
          </h1>
          <p className="text-slate-600 text-sm sm:text-base font-interface max-w-2xl">
            Track your course progress, resume active lessons, and master high-leverage frameworks and marketing systems.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            id="dashboard-saved-shortcut-btn"
            type="button"
            onClick={() => navigate('/saved')}
            className="px-4 py-2.5 bg-white hover:bg-orange-50/50 text-slate-800 hover:text-[#FF6B00] border border-slate-200 hover:border-[#FF6B00]/40 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-sm hover:shadow"
          >
            <Bookmark className="w-4 h-4 text-[#FF6B00]" />
            <span>Saved Content ({studentBookmarks.length})</span>
          </button>
          <button
            id="dashboard-wishlist-shortcut-btn"
            type="button"
            onClick={() => navigate('/wishlist')}
            className="px-4 py-2.5 bg-white hover:bg-rose-50/50 text-slate-800 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-sm hover:shadow"
          >
            <Heart className="w-4 h-4 text-rose-500" />
            <span>Wishlist ({courseWishlist.length})</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/my-courses')}
            className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-sm hover:shadow"
          >
            <BookOpen className="w-4 h-4 text-[#FF6B00]" />
            <span>My Courses</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/learn')}
            className="px-4 py-2.5 bg-[#0F172A] hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <Compass className="w-4 h-4 text-[#FF6B00]" />
            <span>Browse Catalog</span>
          </button>
        </div>
      </div>

      {/* Error Banner if Supabase query failed */}
      {enrollmentsError && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <div className="font-bold uppercase tracking-wider">Notice loading enrollment data</div>
            <p className="text-amber-800">{enrollmentsError}</p>
          </div>
        </div>
      )}

      {/* 2. Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Enrolled Courses */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-interface">
              Enrolled Courses
            </span>
            <div className="text-3xl font-display font-bold text-slate-900 font-mono">
              {summary.totalEnrolled}
            </div>
            <span className="text-[11px] text-slate-500">Active enrollments</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-orange-50 text-[#FF6B00] border border-orange-100 flex items-center justify-center shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: In Progress */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-interface">
              In Progress
            </span>
            <div className="text-3xl font-display font-bold text-slate-900 font-mono">
              {summary.inProgressCourses}
            </div>
            <span className="text-[11px] text-slate-500">Courses underway</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Completed Courses */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-interface">
              Completed
            </span>
            <div className="text-3xl font-display font-bold text-slate-900 font-mono">
              {summary.completedCourses}
            </div>
            <span className="text-[11px] text-slate-500">Finished courses</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Overall Progress */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-interface">
              Avg. Progress
            </span>
            <div className="text-3xl font-display font-bold text-slate-900 font-mono">
              {summary.overallProgress}%
            </div>
            <span className="text-[11px] text-slate-500">Across masterclasses</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Card 5: Saved Content */}
        <div
          id="dashboard-saved-metric-card"
          onClick={() => navigate('/saved')}
          className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-between hover:border-[#FF6B00]/50 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-interface group-hover:text-[#FF6B00] transition-colors">
              Saved Items
            </span>
            <div className="text-3xl font-display font-bold text-slate-900 font-mono">
              {studentBookmarks.length}
            </div>
            <span className="text-[11px] text-slate-500 flex items-center gap-1 group-hover:text-[#FF6B00] transition-colors">
              <span>View collection</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Bookmark className="w-6 h-6 text-[#FF6B00]" />
          </div>
        </div>
      </div>

      {/* 2b. Earned Milestone Banner (if student has earned certificates) */}
      {studentCertificates.length > 0 && (
        <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-700 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Award className="w-6 h-6 text-[#FF6B00]" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-amber-700 font-mono">
                Milestone Achieved
              </div>
              <h3 className="text-base font-bold text-slate-900 font-display">
                You have earned {studentCertificates.length} verified {studentCertificates.length === 1 ? 'certificate' : 'certificates'} of completion!
              </h3>
              <p className="text-xs text-slate-600">
                Download your official executive credential PDF or share your public verification link.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/my-courses?tab=certificates')}
            className="px-5 py-2.5 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shrink-0 self-start sm:self-auto"
          >
            <span>View Certificates</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#FF6B00]" />
          </button>
        </div>
      )}

      {/* 3. Continue Learning Section (Prioritized by recent activity) */}
      {featuredResumeCourse ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-widest text-[#FF6B00] font-mono">
                Resume Activity
              </span>
              <h2 className="text-2xl font-display font-bold text-slate-900">
                Continue Learning
              </h2>
            </div>
            {continueLearningList.length > 1 && (
              <button
                type="button"
                onClick={() => navigate('/my-courses')}
                className="text-xs font-bold text-[#FF6B00] hover:text-[#e66000] uppercase tracking-wider flex items-center gap-1 cursor-pointer"
              >
                <span>{continueLearningList.length} Active Courses</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Featured Resume Banner Card */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 hover:border-slate-300 shadow-md transition-all">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Thumbnail */}
              <div className="lg:col-span-4 aspect-[16/9] w-full rounded-2xl overflow-hidden bg-slate-100 relative group shrink-0">
                {featuredResumeCourse.course?.thumbnail ||
                featuredResumeCourse.course?.thumbnailUrl ||
                featuredResumeCourse.course?.coverImage ? (
                  <img
                    src={
                      featuredResumeCourse.course.thumbnail ||
                      featuredResumeCourse.course.thumbnailUrl ||
                      featuredResumeCourse.course.coverImage
                    }
                    alt={featuredResumeCourse.course?.title || 'Course'}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-100">
                    <GraduationCap className="w-12 h-12" />
                  </div>
                )}
                <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-slate-950/10 transition-colors flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-white/95 text-[#FF6B00] shadow-lg flex items-center justify-center">
                    <PlayCircle className="w-7 h-7 fill-[#FF6B00] text-white" />
                  </div>
                </div>
              </div>

              {/* Course & Progress Meta */}
              <div className="lg:col-span-8 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-orange-50 text-[#FF6B00] text-xs font-bold uppercase tracking-wider border border-orange-200/60">
                    {featuredResumeCourse.course?.level || 'Masterclass'}
                  </span>
                  {featuredResumeCourse.course?.aiIntegrated && (
                    <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-bold flex items-center gap-1 border border-blue-200/60">
                      <Sparkles className="w-3 h-3 text-blue-600" />
                      AI-Integrated
                    </span>
                  )}
                  <span className="text-xs text-slate-500 font-mono">
                    Enrolled {new Date(featuredResumeCourse.enrolledAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="text-xl sm:text-2xl font-display font-bold text-slate-900 leading-snug">
                    {featuredResumeCourse.course?.title || 'Masterclass Title'}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 line-clamp-2">
                    {featuredResumeCourse.course?.shortOutcome ||
                      featuredResumeCourse.course?.tagline ||
                      featuredResumeCourse.course?.description}
                  </p>
                </div>

                {/* Progress Bar & Counter */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-slate-700 font-semibold font-interface">
                      Course Completion
                    </span>
                    <span className="font-mono text-[#FF6B00] font-bold">
                      {featuredResumeCourse.progressPercent || 0}% ({featuredResumeCourse.completedLessonsCount || 0}/
                      {featuredResumeCourse.totalLessonsCount || 0} lessons)
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
                    <div
                      className="h-full bg-gradient-to-r from-[#FF6B00] to-amber-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(0, featuredResumeCourse.progressPercent || 0))}%` }}
                    />
                  </div>
                </div>

                {/* Action CTA */}
                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const slug = featuredResumeCourse.course?.slug || featuredResumeCourse.courseId;
                      navigate(`/learn/${slug}/player`);
                    }}
                    className="px-6 py-3 bg-[#FF6B00] hover:bg-[#e66000] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-[#FF6B00]/20 active:scale-[0.98]"
                  >
                    <PlayCircle className="w-4 h-4" />
                    <span>
                      {(featuredResumeCourse.progressPercent || 0) > 0 ? 'Continue Learning' : 'Start Learning'}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const slug = featuredResumeCourse.course?.slug || featuredResumeCourse.courseId;
                      navigate(`/learn/${slug}`);
                    }}
                    className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Course Details
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* 3.5 Active Upcoming Consultation (Rendered ONLY if student has an existing booked session) */}
      {nextUpcomingConsultation && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-widest text-[#1877F2] font-mono">
                Advisory & Strategy
              </span>
              <h2 className="text-2xl font-display font-bold text-slate-900">
                Upcoming 1-on-1 Consultation
              </h2>
            </div>

            <button
              type="button"
              onClick={() => navigate('/my-consultations')}
              className="text-xs font-bold text-[#FF6B00] hover:text-[#e66000] uppercase tracking-wider flex items-center gap-1 cursor-pointer"
            >
              <span>View All Sessions ({studentBookings.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-6 sm:p-7 rounded-3xl bg-white border border-slate-200 shadow-xs hover:shadow-md transition-all space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Upcoming Session
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    Ref: <strong className="text-slate-700">{nextUpcomingConsultation.bookingCode}</strong>
                  </span>
                </div>
                <h3 className="text-xl font-display font-bold text-slate-900">
                  {nextUpcomingConsultation.serviceName ? `Consultation: ${nextUpcomingConsultation.serviceName}` : '1-on-1 Consultation Session'}
                </h3>
                <p className="text-xs text-slate-500">
                  Confirmed appointment with Digital Muid.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {nextUpcomingConsultation.meetUrl && (
                  <a
                    href={nextUpcomingConsultation.meetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-5 py-2.5 bg-[#1877F2] hover:bg-blue-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 shadow-xs cursor-pointer"
                  >
                    <Video className="w-4 h-4" />
                    <span>Join Google Meet</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => navigate('/my-consultations')}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                >
                  Session Details
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1">
                <div className="text-slate-500 font-semibold flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#1877F2]" /> Date
                </div>
                <div className="text-sm font-bold text-slate-900 font-display">
                  {nextUpcomingConsultation.date}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1">
                <div className="text-slate-500 font-semibold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#FF6B00]" /> Time Slot
                </div>
                <div className="text-sm font-bold text-slate-900 font-mono">
                  {nextUpcomingConsultation.time} IST
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1">
                <div className="text-slate-500 font-semibold flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5 text-emerald-600" /> Platform
                </div>
                <div className="text-sm font-bold text-slate-900">
                  Google Meet HD
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3.6 Suggested Courses Section */}
      <div id="suggested-courses" className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500 font-mono">
              Curriculum Recommendations
            </span>
            <h2 className="text-2xl font-display font-bold text-slate-900">
              Suggested Courses
            </h2>
          </div>

          <button
            type="button"
            onClick={() => navigate('/learn')}
            className="text-xs font-bold text-[#FF6B00] hover:text-[#e66000] uppercase tracking-wider flex items-center gap-1 cursor-pointer self-start sm:self-auto"
          >
            <span>Browse Full Course Catalog</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {suggestedCourses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {suggestedCourses.map((course) => {
              const thumbnail = course.thumbnail || course.coverImage;
              const category = (course as any).category || (course.tags && course.tags[0]) || 'Masterclass';

              return (
                <div
                  key={course.id}
                  className="p-6 rounded-3xl bg-white border border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-5 group"
                >
                  <div className="space-y-4">
                    {/* Thumbnail */}
                    <div
                      onClick={() => navigate(`/learn/${course.slug}`)}
                      className="aspect-[16/9] w-full rounded-2xl overflow-hidden bg-slate-100 relative cursor-pointer"
                    >
                      {thumbnail ? (
                        <img
                          src={thumbnail}
                          alt={course.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-100">
                          <GraduationCap className="w-10 h-10" />
                        </div>
                      )}
                      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 flex-wrap">
                        {course.level && (
                          <span className="px-2 py-0.5 rounded bg-white/95 text-slate-800 text-[10px] font-bold uppercase tracking-wider border border-slate-200 shadow-sm">
                            {course.level}
                          </span>
                        )}
                        {category && (
                          <span className="px-2 py-0.5 rounded bg-slate-900/90 text-white text-[10px] font-bold uppercase tracking-wider shadow-sm">
                            {category}
                          </span>
                        )}
                      </div>

                      <div className="absolute top-2.5 right-2.5 z-10">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCourseWishlist(course.id);
                          }}
                          className={`p-1.5 rounded-xl backdrop-blur-md transition-all shadow-sm cursor-pointer border ${
                            isCourseWishlisted(course.id)
                              ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100'
                              : 'bg-white/90 border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-white'
                          }`}
                          title={isCourseWishlisted(course.id) ? 'Remove from Wishlist' : 'Save to Wishlist'}
                          aria-label={isCourseWishlisted(course.id) ? 'Remove from Wishlist' : 'Save to Wishlist'}
                        >
                          <Heart
                            className={`w-3.5 h-3.5 transition-transform ${
                              isCourseWishlisted(course.id) ? 'fill-rose-500 text-rose-500 scale-110' : ''
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Title & Short Outcome */}
                    <div className="space-y-1.5">
                      <h3
                        onClick={() => navigate(`/learn/${course.slug}`)}
                        className="text-lg font-display font-bold text-slate-900 group-hover:text-[#FF6B00] transition-colors leading-snug cursor-pointer line-clamp-2"
                      >
                        {course.title}
                      </h3>
                      {(course.shortOutcome || course.description) && (
                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed font-interface">
                          {course.shortOutcome || course.description}
                        </p>
                      )}
                    </div>

                    {/* Metadata: Instructor & Duration */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 font-interface pt-1">
                      {course.instructor && (
                        <span className="font-semibold text-slate-700">
                          {course.instructor}
                        </span>
                      )}
                      {course.duration && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{course.duration}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Pricing & CTA */}
                  <div className="pt-4 border-t border-slate-100 space-y-3">
                    <div className="flex items-baseline justify-between">
                      <div className="flex items-baseline gap-2">
                        {course.offerPrice && course.offerPrice < course.price ? (
                          <>
                            <span className="text-lg font-bold font-mono text-slate-900">
                              ₹{course.offerPrice.toLocaleString('en-IN')}
                            </span>
                            <span className="text-xs text-slate-400 line-through font-mono">
                              ₹{course.price.toLocaleString('en-IN')}
                            </span>
                          </>
                        ) : (
                          <span className="text-lg font-bold font-mono text-slate-900">
                            ₹{(course.price || 0).toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate(`/learn/${course.slug}`)}
                      className="w-full py-2.5 bg-slate-900 hover:bg-[#FF6B00] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm group-hover:shadow-md"
                    >
                      <span>Explore Course</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 rounded-3xl bg-slate-50 border border-slate-200 text-center space-y-2 max-w-xl mx-auto">
            <h3 className="text-base font-bold text-slate-900 font-display">
              All Available Courses Enrolled
            </h3>
            <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
              You are currently enrolled in all published masterclasses in the catalog.
            </p>
          </div>
        )}
      </div>

      {/* 3.7 Course Toolkits & Study Assets */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-widest text-amber-700 font-mono flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
              <span>Enrolled Course Materials · Instant Student Access</span>
            </span>
            <h2 className="text-2xl font-display font-bold text-slate-900">
              Course Toolkits & Assets
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/resources')}
              className="text-xs font-bold text-[#FF6B00] hover:text-[#e66000] uppercase tracking-wider flex items-center gap-1 cursor-pointer"
            >
              <span>Explore All Toolkits & Resources</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Clean, Full-Width Enrolled Toolkits Card */}
        <div className="p-6 sm:p-7 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200/60 shrink-0">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-display font-bold text-slate-900">
                    Downloadable Toolkits & Worksheets
                  </h3>
                  <p className="text-xs text-slate-500 font-interface">
                    Operating templates, swipe files, checklists, and calculators attached to your active courses
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/resources')}
                className="text-xs font-bold text-amber-600 hover:text-amber-700 uppercase tracking-wider font-mono cursor-pointer hidden sm:block"
              >
                Browse All ({resources.length})
              </button>
            </div>

            {enrolledMaterials.resources.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {enrolledMaterials.resources.map((res) => (
                  <div
                    key={res.id}
                    className="p-3.5 rounded-2xl bg-slate-50/80 hover:bg-slate-50 border border-slate-200/70 hover:border-amber-200 flex items-center justify-between gap-3 group transition-all"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                          {res.category || 'Asset'}
                        </span>
                        {(res.fileType || res.format || res.fileSize) && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            {[res.fileType || res.format, res.fileSize].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-slate-800 truncate group-hover:text-amber-700 transition-colors">
                        {res.title || res.name}
                      </h4>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeliverToolkit(res)}
                      disabled={deliveringResourceId === res.id}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-amber-600 text-white text-[11px] font-bold uppercase tracking-wider transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-60"
                    >
                      {deliveringResourceId === res.id ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Opening...</span>
                        </>
                      ) : res.externalUrl ? (
                        <>
                          <ExternalLink className="w-3 h-3" />
                          <span>Open</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3 h-3" />
                          <span>Download</span>
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 space-y-2">
                <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-500 font-interface">
                  No downloadable toolkits attached to your active enrollments yet.
                </p>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="font-mono text-[11px]">
              {enrolledMaterials.resources.length} Toolkit{enrolledMaterials.resources.length === 1 ? '' : 's'} Ready For Instant Access
            </span>
            <button
              type="button"
              onClick={() => navigate('/resources')}
              className="font-bold text-amber-700 hover:text-amber-800 text-xs inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Browse Resource Hub</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* 3.9 Billing & Receipts Card (Phase 2J) */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-50 text-[#FF6B00] border border-orange-100 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold font-display text-slate-900">
                Billing & Receipts
              </h3>
              <p className="text-xs text-slate-500 font-interface">
                Captured payment records, receipts, and order invoices
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/account?tab=billing')}
            className="px-4 py-2 bg-slate-900 hover:bg-[#FF6B00] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors inline-flex items-center gap-2 cursor-pointer shadow-2xs self-start sm:self-auto"
          >
            <span>Account Billing & Invoices</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Metrics & Status Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
              Total Captured
            </span>
            <div className="text-xl font-bold font-mono text-slate-900 mt-1">
              ₹{studentPayments
                .filter((p) => p.status === 'captured')
                .reduce((acc, p) => acc + (p.amount || 0), 0)
                .toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-slate-500">
              {studentPayments.filter((p) => p.status === 'captured').length} captured payment{studentPayments.filter((p) => p.status === 'captured').length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
              Total Transactions
            </span>
            <div className="text-xl font-bold font-mono text-slate-900 mt-1">
              {studentPayments.length}
            </div>
            <span className="text-[10px] text-slate-500">Recorded ledger entries</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
              Most Recent Transaction
            </span>
            {studentPayments.length > 0 ? (
              <div className="mt-1 space-y-0.5">
                <div className="text-xs font-bold text-slate-900 truncate">
                  {studentPayments[0].itemTitle || 'Educational Service'}
                </div>
                <div className="text-[10px] font-mono text-slate-500 flex items-center gap-1.5">
                  <span>{studentPayments[0].currency || 'INR'} {studentPayments[0].amount.toLocaleString('en-IN')}</span>
                  <span>·</span>
                  <span>
                    {(() => {
                      try {
                        return new Date(studentPayments[0].createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
                      } catch {
                        return 'Recent';
                      }
                    })()}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 mt-1">
                No recorded transactions yet
              </div>
            )}
          </div>
        </div>

        {studentPayments.length === 0 && (
          <div className="pt-2 text-center text-xs text-slate-500 font-interface">
            Official PDF receipts and invoices become available immediately upon completing a course enrollment or consultation booking.
          </div>
        )}
      </div>

      {/* 4. Recent Activity & Notifications (Phase 2F) */}
      <div id="activity" className="space-y-6 scroll-mt-28">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500 font-mono">
              Live Feed
            </span>
            <h2 className="text-2xl font-display font-bold text-slate-900">
              Recent Activity & Notifications
            </h2>
          </div>

          {unreadNotificationsCount > 0 && (
            <button
              type="button"
              onClick={() => markAllNotificationsAsRead()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs self-start sm:self-auto"
            >
              <CheckCheck className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span>Mark All Notifications Read</span>
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => {
              setActiveFeedFilter('all');
              setFeedLimit(8);
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border ${
              activeFeedFilter === 'all'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 hover:text-slate-900 border-slate-200 hover:bg-slate-50'
            }`}
          >
            All Activity ({feedCounts.all})
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveFeedFilter('notifications');
              setFeedLimit(8);
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border flex items-center gap-1.5 ${
              activeFeedFilter === 'notifications'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 hover:text-slate-900 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>Notifications ({feedCounts.notifications})</span>
            {unreadNotificationsCount > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-[#FF6B00] text-white">
                {unreadNotificationsCount} new
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveFeedFilter('courses');
              setFeedLimit(8);
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border ${
              activeFeedFilter === 'courses'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 hover:text-slate-900 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Courses & Lessons ({feedCounts.courses})
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveFeedFilter('consultations');
              setFeedLimit(8);
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border ${
              activeFeedFilter === 'consultations'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 hover:text-slate-900 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Consultations ({feedCounts.consultations})
          </button>
        </div>

        {/* Stream List Card Container */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
          {isNotificationsLoading && unifiedActivities.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">
              <div className="w-5 h-5 border-2 border-[#FF6B00] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Syncing activity feed...
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
                <Bell className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold text-slate-700">No activity matching this filter</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Completed lessons, consultation schedule updates, and system notifications will automatically populate here.
              </p>
            </div>
          ) : (
            filteredActivities.slice(0, feedLimit).map((item) => {
              const isNotification = item.source === 'notification';
              const isUnread = isNotification && !item.isRead;

              // Format relative or date string
              let timeFormatted = '';
              try {
                const date = new Date(item.timestamp);
                const now = new Date();
                const diffMs = now.getTime() - date.getTime();
                const diffMins = Math.floor(diffMs / 60000);
                if (diffMins < 1) timeFormatted = 'Just now';
                else if (diffMins < 60) timeFormatted = `${diffMins}m ago`;
                else if (diffMins < 1440) timeFormatted = `${Math.floor(diffMins / 60)}h ago`;
                else if (diffMins < 10080) timeFormatted = `${Math.floor(diffMins / 1440)}d ago`;
                else {
                  timeFormatted = new Intl.DateTimeFormat('en-IN', {
                    month: 'short',
                    day: 'numeric',
                    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
                  }).format(date);
                }
              } catch {
                timeFormatted = '';
              }

              return (
                <div
                  key={item.id}
                  className={`p-4 sm:p-5 transition-colors flex items-start gap-3.5 sm:gap-4 ${
                    isUnread ? 'bg-orange-50/40 hover:bg-orange-50/70' : 'hover:bg-slate-50/70'
                  }`}
                >
                  {/* Icon Indicator */}
                  <div className="mt-0.5 shrink-0">
                    {item.source === 'notification' ? (
                      item.type === 'success' ? (
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      ) : item.type === 'warning' ? (
                        <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                      ) : item.type === 'alert' ? (
                        <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center">
                          <AlertCircle className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="w-9 h-9 rounded-xl bg-orange-50 text-[#FF6B00] border border-orange-200 flex items-center justify-center">
                          <Bell className="w-4 h-4" />
                        </div>
                      )
                    ) : item.source === 'enrollment' ? (
                      <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
                        <GraduationCap className="w-4 h-4" />
                      </div>
                    ) : item.source === 'progress' ? (
                      item.type === 'completed' ? (
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center">
                          <PlayCircle className="w-4 h-4 text-[#FF6B00]" />
                        </div>
                      )
                    ) : (
                      <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 border border-purple-200 flex items-center justify-center">
                        <Calendar className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  {/* Body Text */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className={`text-sm ${isUnread ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'} leading-snug`}>
                        {item.title}
                      </h4>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200/80">
                        {item.badgeText}
                      </span>
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-[#FF6B00] shrink-0" title="Unread" />
                      )}
                    </div>

                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {item.description}
                    </p>

                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-[11px] text-slate-400 font-medium">
                        {timeFormatted}
                      </span>

                      {item.link && (
                        <button
                          type="button"
                          onClick={() => {
                            if (isUnread) {
                              markNotificationAsRead(item.rawId);
                            }
                            navigate(item.link!);
                          }}
                          className="text-[11px] font-bold text-[#FF6B00] hover:text-[#e66000] inline-flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <span>{item.source === 'progress' || item.source === 'enrollment' ? 'Continue Lesson' : item.source === 'booking' ? 'View Booking' : 'Open Link'}</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}

                      {isUnread && (
                        <button
                          type="button"
                          onClick={() => markNotificationAsRead(item.rawId)}
                          className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                        >
                          Mark as read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* View More Button */}
        {filteredActivities.length > feedLimit && (
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => setFeedLimit((prev) => prev + 10)}
              className="px-5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-2xs"
            >
              Show More Activity ({filteredActivities.length - feedLimit} remaining)
            </button>
          </div>
        )}
      </div>

      {/* 5. My Courses Preview / Grid */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500 font-mono">
              Enrolled Library
            </span>
            <h2 className="text-2xl font-display font-bold text-slate-900">
              My Courses
            </h2>
          </div>

          {studentEnrollments.length > 0 && (
            <button
              type="button"
              onClick={() => navigate('/my-courses')}
              className="text-xs font-bold text-[#FF6B00] hover:text-[#e66000] uppercase tracking-wider flex items-center gap-1 cursor-pointer"
            >
              <span>View All ({studentEnrollments.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 5. Empty State: No Courses Enrolled */}
        {studentEnrollments.length === 0 ? (
          <div className="p-8 sm:p-12 rounded-3xl bg-white border border-slate-200 text-center space-y-5 shadow-sm max-w-2xl mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-orange-50 border border-orange-100 text-[#FF6B00] flex items-center justify-center mx-auto">
              <GraduationCap className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-display font-bold text-slate-900">
                No Courses Enrolled Yet
              </h3>
              <p className="text-slate-600 text-sm font-interface leading-relaxed">
                You do not currently have any active masterclass enrollments. Explore our practical, AI-integrated digital masterclasses to start building high-performance marketing and growth systems.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => navigate('/learn')}
                className="px-6 py-3 bg-[#FF6B00] hover:bg-[#e66000] text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all inline-flex items-center gap-2 cursor-pointer shadow-lg shadow-[#FF6B00]/20 active:scale-[0.98]"
              >
                <Compass className="w-4 h-4" />
                <span>Explore Available Courses</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          /* Enrolled Grid (showing up to 3 on the dashboard preview) */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {studentEnrollments.slice(0, 3).map((item) => {
              const course = item.course;
              const thumbnail = course?.thumbnail || course?.thumbnailUrl || course?.coverImage;
              const pct = Math.min(100, Math.max(0, item.progressPercent || 0));
              const isCompleted = pct >= 100;
              const slug = course?.slug || item.courseId;

              return (
                <div
                  key={item.id}
                  className="p-6 rounded-3xl bg-white border border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-5"
                >
                  <div className="space-y-4">
                    {/* Thumbnail */}
                    <div
                      onClick={() => navigate(`/learn/${slug}/player`)}
                      className="aspect-[16/9] w-full rounded-2xl overflow-hidden bg-slate-100 relative cursor-pointer group"
                    >
                      {thumbnail ? (
                        <img
                          src={thumbnail}
                          alt={course?.title || 'Course'}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-100">
                          <GraduationCap className="w-10 h-10" />
                        </div>
                      )}
                      <div className="absolute top-2.5 left-2.5">
                        <span className="px-2 py-0.5 rounded bg-white/95 text-slate-800 text-[10px] font-bold uppercase tracking-wider border border-slate-200 shadow-sm">
                          {course?.level || 'Masterclass'}
                        </span>
                      </div>
                    </div>

                    {/* Title */}
                    <div className="space-y-1">
                      <h4
                        onClick={() => navigate(`/learn/${slug}/player`)}
                        className="text-lg font-display font-bold text-slate-900 hover:text-[#FF6B00] transition-colors leading-snug cursor-pointer line-clamp-2"
                      >
                        {course?.title || 'Course Title'}
                      </h4>
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {course?.shortOutcome || course?.tagline || course?.description}
                      </p>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-600">
                          {isCompleted ? 'Completed' : 'Progress'}
                        </span>
                        <span className="font-mono text-slate-900">{pct}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isCompleted ? 'bg-emerald-500' : 'bg-[#FF6B00]'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom CTA */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => navigate(`/learn/${slug}/player`)}
                      className="w-full py-2.5 bg-slate-900 hover:bg-[#FF6B00] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                    >
                      <PlayCircle className="w-4 h-4" />
                      <span>{isCompleted ? 'Review Course' : pct > 0 ? 'Continue' : 'Start Learning'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
