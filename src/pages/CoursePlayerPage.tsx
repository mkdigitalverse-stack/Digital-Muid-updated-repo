import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { courseService, normalizeCourseCurriculum } from '../services/courseService';
import { progressService, extractAllLessons, FlattenedLesson } from '../services/progressService';
import { enrollmentService } from '../services/enrollmentService';
import { resourceService } from '../services/resourceService';
import { Course, CourseModule, CourseLesson, PlaybackAuthorization, Resource, Framework } from '../types';
import {
  Play,
  CheckCircle2,
  Circle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  Lock,
  ArrowLeft,
  BookOpen,
  GraduationCap,
  RotateCcw,
  Sparkles,
  Menu,
  X,
  Clock,
  ShieldCheck,
  Check,
  Download,
  Layers,
  ExternalLink,
  FileText,
  Award
} from 'lucide-react';
import { CourseCertificateCelebrationModal } from '../components/CourseCertificateCelebrationModal';
import { Certificate } from '../types';

interface CoursePlayerPageProps {
  slug: string;
  navigate: (path: string) => void;
}

export const CoursePlayerPage: React.FC<CoursePlayerPageProps> = ({ slug, navigate }) => {
  const {
    currentUser,
    isAdminAuthenticated,
    isAuthLoading,
    studentEnrollments,
    courseProgressMap,
    fetchCourseProgress,
    updateLessonPlaybackPosition,
    toggleLessonProgressCompletion,
    getCourseProgressStats,
    issueCourseCertificate,
    getCertificateForCourse,
    userProfile,
    resources,
    frameworks,
    notify
  } = useApp();

  // Certificate State (Phase 2I)
  const [isCelebrationModalOpen, setIsCelebrationModalOpen] = useState(false);
  const [issuedCertificate, setIssuedCertificate] = useState<Certificate | null>(null);

  // Course and Curriculum Data
  const [course, setCourse] = useState<Course | null>(null);
  const [isCourseLoading, setIsCourseLoading] = useState<boolean>(true);
  const [courseError, setCourseError] = useState<string | null>(null);

  // Enrollment Status
  const [isEnrollmentChecking, setIsEnrollmentChecking] = useState<boolean>(true);
  const [isEnrolled, setIsEnrolled] = useState<boolean>(false);

  // Lesson State
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  // Playback Authorization State
  const [isAuthorizingPlayback, setIsAuthorizingPlayback] = useState<boolean>(false);
  const [playbackAuth, setPlaybackAuth] = useState<PlaybackAuthorization | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  // Mobile Syllabus Drawer State
  const [isMobileSyllabusOpen, setIsMobileSyllabusOpen] = useState<boolean>(false);

  // Tab State: Overview vs Course Materials & Downloads
  const [activeTab, setActiveTab] = useState<'overview' | 'materials'>('overview');
  const [downloadingResourceId, setDownloadingResourceId] = useState<string | null>(null);

  // Materials linked to this course
  const courseResources = useMemo(() => {
    if (!course) return [];
    const resIds = new Set<string>([
      ...(course.relatedResources || []),
      ...((course as any).related_resources || [])
    ]);
    return (resources || []).filter((r) => resIds.has(r.id) && (r.status === 'published' || !r.status));
  }, [course, resources]);

  const courseFrameworks = useMemo(() => {
    if (!course) return [];
    const fwIds = new Set<string>([
      ...(course.relatedFrameworks || []),
      ...((course as any).related_frameworks || [])
    ]);
    return (frameworks || []).filter((f) => fwIds.has(f.id) && (f.status === 'published' || !f.status));
  }, [course, frameworks]);

  const totalMaterialsCount = courseResources.length + courseFrameworks.length;

  const handleDeliverCourseResource = async (res: Resource) => {
    setDownloadingResourceId(res.id);
    try {
      const deliveryRes = await resourceService.deliverResource(res);
      if (!deliveryRes.success) {
        notify(deliveryRes.error || 'Failed to open resource.', 'error');
      } else {
        notify(`Student Access: Delivering ${res.title || res.name || 'resource'}...`, 'success');
      }
    } catch (err: any) {
      console.error('[CoursePlayerPage] Error delivering course resource:', err);
      notify('Failed to deliver resource.', 'error');
    } finally {
      setDownloadingResourceId(null);
    }
  };

  // Video Element Ref and Throttle State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastSavedPositionRef = useRef<number>(0);
  const lastSavedTimestampRef = useRef<number>(0);

  // 1. Initial Load: Fetch Course by Slug
  useEffect(() => {
    let isMounted = true;

    async function loadCourse() {
      setIsCourseLoading(true);
      setCourseError(null);
      try {
        const res = await courseService.fetchCourseBySlug(slug);
        if (!isMounted) return;

        if (res.data) {
          setCourse(res.data);
        } else {
          setCourseError('Course not found or has been archived.');
        }
      } catch (err: any) {
        if (!isMounted) return;
        setCourseError(err?.message || 'Failed to load course.');
      } finally {
        if (isMounted) setIsCourseLoading(false);
      }
    }

    loadCourse();

    return () => {
      isMounted = false;
    };
  }, [slug]);

  // 2. Access Control: Verify student enrollment or admin privileges
  useEffect(() => {
    let isMounted = true;

    async function verifyAccess() {
      if (isAuthLoading || !course) return;

      // Admins always have access
      if (isAdminAuthenticated) {
        if (isMounted) {
          setIsEnrolled(true);
          setIsEnrollmentChecking(false);
        }
        return;
      }

      // If user is not logged in, route to /login
      if (!currentUser) {
        if (isMounted) {
          setIsEnrolled(false);
          setIsEnrollmentChecking(false);
          navigate('/login');
        }
        return;
      }

      // Check context enrollments first
      const hasContextEnrollment = studentEnrollments.some(
        (e) => (e.courseId === course.id || e.course?.slug === course.slug) && e.status === 'active'
      );

      if (hasContextEnrollment) {
        if (isMounted) {
          setIsEnrolled(true);
          setIsEnrollmentChecking(false);
        }
        return;
      }

      // Verify directly against backend as fallback
      setIsEnrollmentChecking(true);
      try {
        const verified = await enrollmentService.checkIsCourseEnrolled(course.id);
        if (isMounted) {
          setIsEnrolled(verified);
        }
      } catch (err) {
        console.error('[CoursePlayer] Error checking enrollment:', err);
        if (isMounted) setIsEnrolled(false);
      } finally {
        if (isMounted) setIsEnrollmentChecking(false);
      }
    }

    verifyAccess();

    return () => {
      isMounted = false;
    };
  }, [currentUser, isAdminAuthenticated, isAuthLoading, course, studentEnrollments, navigate]);

  // 3. Normalized Modules and Flattened Lessons
  const modules: CourseModule[] = useMemo(() => {
    if (!course) return [];
    return normalizeCourseCurriculum(course.curriculum || (course as any).modules);
  }, [course]);

  const allLessons: FlattenedLesson[] = useMemo(() => {
    if (!course) return [];
    return extractAllLessons(course);
  }, [course]);

  // 4. Load Course Progress when course & enrollment confirmed
  useEffect(() => {
    if (course?.id && isEnrolled) {
      fetchCourseProgress(course.id);
    }
  }, [course?.id, isEnrolled, fetchCourseProgress]);

  // 5. Select Initial Lesson based on URL query, last accessed, or first incomplete
  useEffect(() => {
    if (!course || allLessons.length === 0 || activeLessonId) return;

    // Check URL query parameter '?lesson=...'
    const params = new URLSearchParams(window.location.search);
    const requestedLessonId = params.get('lesson');

    if (requestedLessonId && allLessons.some((l) => l.id === requestedLessonId)) {
      setActiveLessonId(requestedLessonId);
      return;
    }

    // Check last accessed lesson from enrollment
    const enrollment = studentEnrollments.find(
      (e) => e.courseId === course.id || e.course?.slug === course.slug
    );
    if (enrollment?.lastLessonId && allLessons.some((l) => l.id === enrollment.lastLessonId)) {
      setActiveLessonId(enrollment.lastLessonId);
      return;
    }

    // Check first incomplete lesson
    const progressList = courseProgressMap[course.id] || [];
    const completedSet = new Set(progressList.filter((p) => p.completed).map((p) => p.lessonId));
    const firstIncomplete = allLessons.find((l) => !completedSet.has(l.id));

    if (firstIncomplete) {
      setActiveLessonId(firstIncomplete.id);
    } else {
      setActiveLessonId(allLessons[0].id);
    }
  }, [course, allLessons, activeLessonId, studentEnrollments, courseProgressMap]);

  // 6. Automatically expand the module containing the active lesson
  useEffect(() => {
    if (!activeLessonId || modules.length === 0) return;

    const currentMod = modules.find((mod) => {
      const lessons = Array.isArray(mod.lessons) ? mod.lessons : [];
      return lessons.some((l) => (typeof l === 'string' ? false : l.id === activeLessonId));
    });

    if (currentMod?.id) {
      setExpandedModules((prev) => ({
        ...prev,
        [currentMod.id]: true
      }));
    }
  }, [activeLessonId, modules]);

  // Find Active Lesson and Module Information
  const activeLesson = useMemo(() => {
    if (!activeLessonId || allLessons.length === 0) return null;
    return allLessons.find((l) => l.id === activeLessonId) || allLessons[0];
  }, [activeLessonId, allLessons]);

  const activeModule = useMemo(() => {
    if (!activeLesson || modules.length === 0) return null;
    return modules.find((m) => m.id === activeLesson.moduleId) || null;
  }, [activeLesson, modules]);

  // Current Lesson Progress Record (Completion & Saved Position)
  const currentLessonProgress = useMemo(() => {
    if (!course?.id || !activeLesson?.id) return null;
    const list = courseProgressMap[course.id] || [];
    return list.find((p) => p.lessonId === activeLesson.id) || null;
  }, [course?.id, activeLesson?.id, courseProgressMap]);

  const isCurrentLessonCompleted = Boolean(currentLessonProgress?.completed);
  const savedPositionSeconds = currentLessonProgress?.lastPositionSeconds || 0;

  // 7. Request Secure Playback Authorization when active lesson changes
  useEffect(() => {
    let isMounted = true;

    async function authorizeLessonPlayback() {
      if (!course?.id || !activeLesson?.id || !isEnrolled) {
        return;
      }

      setIsAuthorizingPlayback(true);
      setPlaybackAuth(null);
      setPlaybackError(null);

      const resolveDirectMediaFallback = () => {
        if (!activeLesson.videoUrl) return null;
        const url = activeLesson.videoUrl.trim();
        const isYt = url.includes('youtu.be') || url.includes('youtube.com');
        const isVimeo = url.includes('vimeo.com');
        const isCf = url.includes('videodelivery.net');

        let assetId = url;
        let provider: 'youtube' | 'vimeo' | 'cloudflare_stream' | 'direct' = 'direct';

        if (isYt) {
          provider = 'youtube';
          const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
          assetId = ytMatch ? ytMatch[1] : url;
        } else if (isVimeo) {
          provider = 'vimeo';
          const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
          assetId = vimeoMatch ? vimeoMatch[1] : url;
        } else if (isCf) {
          provider = 'cloudflare_stream';
          const cfMatch = url.match(/videodelivery\.net\/([a-zA-Z0-9]+)/);
          assetId = cfMatch ? cfMatch[1] : url;
        }

        return {
          authorized: true,
          provider,
          assetId,
          playbackType: 'enrolled_student' as const
        };
      };

      try {
        const authResult = await courseService.getLessonPlaybackToken(course.id, activeLesson.id);
        if (!isMounted) return;

        if (authResult.authorized && authResult.assetId) {
          setPlaybackAuth(authResult);
        } else {
          const fallback = resolveDirectMediaFallback();
          if (fallback) {
            setPlaybackAuth(fallback);
          } else if (activeLesson.deliveryType === 'Live Cohort' || activeLesson.meetUrl) {
            setPlaybackAuth(null);
            setPlaybackError(null);
          } else {
            setPlaybackError(authResult.error || 'Video playback is not configured for this lesson yet.');
          }
        }
      } catch (err: any) {
        if (!isMounted) return;
        const fallback = resolveDirectMediaFallback();
        if (fallback) {
          setPlaybackAuth(fallback);
        } else {
          setPlaybackError(err?.message || 'Failed to authenticate secure playback stream.');
        }
      } finally {
        if (isMounted) {
          setIsAuthorizingPlayback(false);
        }
      }
    }

    authorizeLessonPlayback();

    return () => {
      isMounted = false;
    };
  }, [course?.id, activeLesson?.id, activeLesson?.videoUrl, activeLesson?.deliveryType, activeLesson?.meetUrl, isEnrolled]);

  // 8. Handle Lesson Switching with URL sync and resume
  const handleSelectLesson = useCallback(
    (lessonId: string) => {
      if (lessonId === activeLessonId) return;

      // Save current video position before switching
      if (videoRef.current && course?.id && activeLesson?.id) {
        const currentPos = Math.floor(videoRef.current.currentTime);
        if (currentPos > 0 && currentPos !== lastSavedPositionRef.current) {
          updateLessonPlaybackPosition(course.id, activeLesson.id, currentPos);
        }
      }

      setActiveLessonId(lessonId);
      setIsMobileSyllabusOpen(false);

      // Update URL search query without full reload
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('lesson', lessonId);
        window.history.replaceState(null, '', url.toString());
      } catch {
        // Fallback if URL API throws
      }
    },
    [activeLessonId, course?.id, activeLesson?.id, updateLessonPlaybackPosition]
  );

  // 9. Previous and Next Navigation
  const currentLessonIndex = useMemo(() => {
    if (!activeLesson || allLessons.length === 0) return -1;
    return allLessons.findIndex((l) => l.id === activeLesson.id);
  }, [activeLesson, allLessons]);

  const previousLesson = useMemo(() => {
    if (currentLessonIndex > 0) {
      return allLessons[currentLessonIndex - 1];
    }
    return null;
  }, [currentLessonIndex, allLessons]);

  const nextLesson = useMemo(() => {
    if (currentLessonIndex >= 0 && currentLessonIndex < allLessons.length - 1) {
      return allLessons[currentLessonIndex + 1];
    }
    return null;
  }, [currentLessonIndex, allLessons]);

  const handlePreviousLesson = () => {
    if (previousLesson) {
      handleSelectLesson(previousLesson.id);
    }
  };

  const handleNextLesson = () => {
    if (nextLesson) {
      handleSelectLesson(nextLesson.id);
    }
  };

  // 10. Toggle Lesson Completion
  const handleToggleCompletion = async () => {
    if (!course?.id || !activeLesson?.id) return;
    const newStatus = !isCurrentLessonCompleted;

    const success = await toggleLessonProgressCompletion(course.id, activeLesson.id, newStatus);
    if (success) {
      notify(
        newStatus ? 'Lesson marked as completed!' : 'Lesson marked as incomplete.',
        newStatus ? 'success' : 'info'
      );

      // Check if course is now 100% complete
      if (newStatus && allLessons.length > 0) {
        const completedList = (courseProgressMap[course.id] || []).filter((p) => p.completed && p.lessonId !== activeLesson.id);
        const willBeTotal = completedList.length + 1;
        if (willBeTotal >= allLessons.length) {
          issueCourseCertificate(course.id, course.title).then((res) => {
            if (res.certificate) {
              setIssuedCertificate(res.certificate);
              setIsCelebrationModalOpen(true);
            }
          });
        }
      }
    }
  };

  // 11. Throttled Video Playback Tracking
  const handleTimeUpdate = () => {
    if (!videoRef.current || !course?.id || !activeLesson?.id) return;
    const currentTime = Math.floor(videoRef.current.currentTime);
    const now = Date.now();

    // Save every 10 seconds or if jumped by at least 10 seconds
    if (
      Math.abs(currentTime - lastSavedPositionRef.current) >= 10 &&
      now - lastSavedTimestampRef.current >= 8000
    ) {
      lastSavedPositionRef.current = currentTime;
      lastSavedTimestampRef.current = now;
      updateLessonPlaybackPosition(course.id, activeLesson.id, currentTime);
    }
  };

  const handlePause = () => {
    if (!videoRef.current || !course?.id || !activeLesson?.id) return;
    const currentTime = Math.floor(videoRef.current.currentTime);
    if (currentTime > 0 && currentTime !== lastSavedPositionRef.current) {
      lastSavedPositionRef.current = currentTime;
      lastSavedTimestampRef.current = Date.now();
      updateLessonPlaybackPosition(course.id, activeLesson.id, currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current && savedPositionSeconds > 2) {
      try {
        videoRef.current.currentTime = savedPositionSeconds;
      } catch (err) {
        console.warn('[CoursePlayer] Could not seek video to saved position:', err);
      }
    }
  };

  // Calculate Overall Course Progress Stats
  const courseStats = useMemo(() => {
    if (!course) {
      return { totalLessons: 0, completedLessons: 0, progressPercent: 0, isCourseCompleted: false };
    }
    return getCourseProgressStats(course);
  }, [course, getCourseProgressStats]);

  // Existing certificate for this course
  const existingCertificate = useMemo(() => {
    if (!course?.id) return undefined;
    return getCertificateForCourse(course.id) || issuedCertificate;
  }, [course?.id, getCertificateForCourse, issuedCertificate]);

  // Automatically issue certificate if student achieved 100% completion
  useEffect(() => {
    if (
      course?.id &&
      courseStats.isCourseCompleted &&
      !existingCertificate &&
      !issuedCertificate
    ) {
      issueCourseCertificate(course.id, course.title).then((res) => {
        if (res.certificate) {
          setIssuedCertificate(res.certificate);
          setIsCelebrationModalOpen(true);
        }
      });
    }
  }, [
    course?.id,
    course?.title,
    courseStats.isCourseCompleted,
    existingCertificate,
    issuedCertificate,
    issueCourseCertificate
  ]);

  // Set of completed lesson IDs for syllabus indicators
  const completedLessonIdSet = useMemo(() => {
    if (!course?.id) return new Set<string>();
    const list = courseProgressMap[course.id] || [];
    return new Set(list.filter((p) => p.completed).map((p) => p.lessonId));
  }, [course?.id, courseProgressMap]);

  // --------------------------------------------------------------------------
  // RENDER: Loading and Error States
  // --------------------------------------------------------------------------

  // Authentication or Course Initializing
  if (isAuthLoading || isCourseLoading || isEnrollmentChecking) {
    return (
      <div className="min-h-screen bg-[#070D18] flex flex-col items-center justify-center p-4 text-center">
        <div className="space-y-4 max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-[#FF6B00] flex items-center justify-center mx-auto shadow-lg shadow-orange-500/5">
            <Loader2 className="w-7 h-7 animate-spin" />
          </div>
          <h2 className="text-lg font-bold text-white font-display">
            Opening Learning Portal...
          </h2>
          <p className="text-xs text-slate-400 font-interface leading-relaxed">
            Verifying student enrollment and preparing secure masterclass streams.
          </p>
        </div>
      </div>
    );
  }

  // Course Not Found State
  if (courseError || !course) {
    return (
      <div className="min-h-screen bg-[#070D18] flex flex-col items-center justify-center p-4 text-center">
        <div className="space-y-5 max-w-md bg-[#0B1526] border border-slate-800 rounded-3xl p-8 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <GraduationCap className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white font-display">Course Not Found</h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              {courseError || 'The requested masterclass could not be located or has been archived.'}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/learn')}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#e66000] text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
            >
              Browse Course Catalog
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Non-Enrolled Student Access Required Screen (No Protected Media Exposed)
  if (!isEnrolled) {
    const thumbnail = course.thumbnail || course.thumbnailUrl || course.coverImage;
    return (
      <div className="min-h-screen bg-[#070D18] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-lg bg-[#0B1526] border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <button
              type="button"
              onClick={() => navigate('/learn')}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Catalog</span>
            </button>
            <span className="px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-bold uppercase tracking-wider">
              Access Restricted
            </span>
          </div>

          <div className="space-y-4 text-center">
            {thumbnail && (
              <div className="w-full aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-slate-800/80 mx-auto">
                <img
                  src={thumbnail}
                  alt={course.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover opacity-60"
                />
              </div>
            )}
            <div className="space-y-2">
              <div className="text-[11px] font-bold font-mono text-[#FF6B00] uppercase tracking-wider">
                Enrollment Required
              </div>
              <h2 className="text-xl sm:text-2xl font-bold font-display text-white">
                {course.title}
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed max-w-md mx-auto">
                You do not have an active enrollment for this masterclass. To access the video curriculum,
                framework blueprints, and lesson materials, please enroll in this course.
              </p>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={() => navigate(`/learn/${course.slug}`)}
              className="w-full py-3.5 px-4 rounded-xl bg-[#FF6B00] hover:bg-[#e66000] text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <GraduationCap className="w-4 h-4" />
              <span>View Course Overview & Enroll</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/my-courses')}
              className="w-full py-3 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-[#FF6B00]" />
              <span>Go to My Enrolled Courses</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // RENDER: Full Course Player Experience
  // --------------------------------------------------------------------------
  return (
    <div id="course-player-container" className="min-h-screen bg-[#070D18] text-slate-100 flex flex-col">
      {/* 1. TOP PLAYER HEADER */}
      <header className="h-16 bg-[#0B1526] border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between shrink-0 sticky top-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/my-courses')}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
            title="Return to My Courses"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold text-[#FF6B00] uppercase tracking-wider shrink-0">
                Masterclass
              </span>
              {isAdminAuthenticated && (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-bold uppercase">
                  Admin Preview
                </span>
              )}
            </div>
            <h1 className="text-sm sm:text-base font-bold text-white truncate max-w-xs sm:max-w-md md:max-w-lg">
              {course.title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          {/* Overall Course Progress Bar (Desktop) */}
          <div className="hidden md:flex items-center gap-3">
            <div className="text-right">
              <div className="text-[11px] font-mono font-bold text-slate-300">
                {courseStats.progressPercent}% Completed
              </div>
              <div className="text-[10px] text-slate-400 font-interface">
                {courseStats.completedLessons} of {courseStats.totalLessons} Lessons
              </div>
            </div>
            <div className="w-24 h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-500 rounded-full"
                style={{ width: `${courseStats.progressPercent}%` }}
              />
            </div>
          </div>

          {/* Certificate Earned Badge Button */}
          {(courseStats.isCourseCompleted || existingCertificate) && (
            <button
              type="button"
              onClick={() => {
                if (existingCertificate) {
                  setIsCelebrationModalOpen(true);
                } else if (course?.id) {
                  issueCourseCertificate(course.id, course.title).then((res) => {
                    if (res.certificate) {
                      setIssuedCertificate(res.certificate);
                      setIsCelebrationModalOpen(true);
                    }
                  });
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 hover:border-amber-400 text-amber-300 hover:text-white flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95"
              title="View Official Certificate of Completion"
            >
              <Award className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Certificate Earned</span>
            </button>
          )}

          {/* Mobile Syllabus Toggle Button */}
          <button
            type="button"
            onClick={() => setIsMobileSyllabusOpen(true)}
            className="lg:hidden p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider cursor-pointer"
          >
            <Menu className="w-4 h-4 text-[#FF6B00]" />
            <span className="hidden sm:inline">Syllabus</span>
          </button>

          {/* Quick Exit Link */}
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="hidden sm:inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <span>Dashboard</span>
          </button>
        </div>
      </header>

      {/* 2. MAIN LEARNING CANVAS & SYLLABUS SIDEBAR */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left / Main Player Viewport */}
        <main className="flex-1 flex flex-col overflow-y-auto bg-[#070D18]">
          <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full space-y-6">
            {/* Video / Media Screen */}
            <div className="w-full aspect-video rounded-2xl bg-black border border-slate-800/80 overflow-hidden shadow-2xl flex items-center justify-center relative">
              {isAuthorizingPlayback ? (
                <div className="flex flex-col items-center gap-3 p-6 text-center">
                  <Loader2 className="w-8 h-8 text-[#FF6B00] animate-spin" />
                  <p className="text-xs text-slate-300 font-interface">
                    Validating lesson playback authorization...
                  </p>
                </div>
              ) : playbackError ? (
                <div className="flex flex-col items-center gap-3 p-6 text-center max-w-md">
                  <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-white font-display">
                    Media Stream Unavailable
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {playbackError}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    If this lesson was recently added, video processing might still be in progress.
                  </p>
                </div>
              ) : playbackAuth?.authorized && playbackAuth.assetId ? (
                playbackAuth.provider === 'youtube' ? (
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${playbackAuth.assetId}?autoplay=1&rel=0&modestbranding=1${
                      savedPositionSeconds > 5 ? `&start=${savedPositionSeconds}` : ''
                    }`}
                    title={activeLesson?.title || 'Lesson Video'}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : playbackAuth.provider === 'vimeo' ? (
                  <iframe
                    src={`https://player.vimeo.com/video/${playbackAuth.assetId}?autoplay=1&dnt=1${
                      savedPositionSeconds > 5 ? `#t=${savedPositionSeconds}s` : ''
                    }`}
                    title={activeLesson?.title || 'Lesson Video'}
                    className="w-full h-full border-0"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                  />
                ) : playbackAuth.provider === 'cloudflare_stream' ? (
                  <iframe
                    src={`https://iframe.videodelivery.net/${playbackAuth.assetId}${
                      savedPositionSeconds > 5 ? `?startTime=${savedPositionSeconds}s` : ''
                    }`}
                    title={activeLesson?.title || 'Lesson Video'}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video
                    ref={videoRef}
                    src={playbackAuth.assetId}
                    controls
                    autoPlay
                    controlsList="nodownload"
                    onTimeUpdate={handleTimeUpdate}
                    onPause={handlePause}
                    onLoadedMetadata={handleLoadedMetadata}
                    onEnded={() => {
                      if (!isCurrentLessonCompleted) {
                        handleToggleCompletion();
                      }
                    }}
                    className="w-full h-full"
                  />
                )
              ) : (
                <div className="flex flex-col items-center gap-3 p-6 text-center max-w-sm text-slate-400">
                  {activeLesson?.meetUrl ? (
                    <div className="space-y-4">
                      <div className="w-12 h-12 rounded-full bg-[#FF6B00]/10 text-[#FF6B00] border border-[#FF6B00]/20 flex items-center justify-center mx-auto">
                        <Sparkles className="w-6 h-6 text-[#FF6B00]" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-white font-display">Live Cohort Session</h4>
                        <p className="text-xs text-slate-400">This lesson is delivered live. Access the virtual room below.</p>
                      </div>
                      <a
                        href={activeLesson.meetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#e66000] text-white text-xs font-semibold shadow-lg shadow-[#FF6B00]/20 transition-all cursor-pointer"
                      >
                        <span>Join Live Session</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  ) : (
                    <>
                      <Play className="w-10 h-10 text-slate-600" />
                      <p className="text-xs">No media configured for this lesson yet.</p>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Lesson Info and Action Bar */}
            {activeLesson && (
              <div className="bg-[#0B1526] border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono font-bold text-[#FF6B00] uppercase tracking-wider">
                        {activeLesson.moduleTitle}
                      </span>
                      <span className="text-slate-600">·</span>
                      <span className="text-[11px] font-mono text-slate-400">
                        Lesson {currentLessonIndex + 1} of {allLessons.length}
                      </span>
                      {activeLesson.duration && (
                        <>
                          <span className="text-slate-600">·</span>
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {activeLesson.duration}
                          </span>
                        </>
                      )}
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold font-display text-white">
                      {activeLesson.title}
                    </h2>
                  </div>

                  {/* Completion Toggle Button */}
                  <div className="shrink-0 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleToggleCompletion}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-sm ${
                        isCurrentLessonCompleted
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
                          : 'bg-[#FF6B00] hover:bg-[#e66000] text-white'
                      }`}
                    >
                      {isCurrentLessonCompleted ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Completed</span>
                        </>
                      ) : (
                        <>
                          <Circle className="w-4 h-4 text-white/70" />
                          <span>Mark Complete</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Tabs Switcher: Lesson Overview vs Course Materials & Downloads */}
                <div id="course-tabs-section" className="flex items-center gap-2 border-b border-slate-800 pb-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setActiveTab('overview')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-2 ${
                      activeTab === 'overview'
                        ? 'bg-slate-800 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5 text-[#FF6B00]" />
                    <span>Lesson Overview</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('materials')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-2 ${
                      activeTab === 'materials'
                        ? 'bg-slate-800 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5 text-[#FF6B00]" />
                    <span>Course Materials & Downloads</span>
                    {totalMaterialsCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#FF6B00] text-white">
                        {totalMaterialsCount}
                      </span>
                    )}
                  </button>
                </div>

                {/* Tab 1: Lesson Overview */}
                {activeTab === 'overview' && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold font-interface uppercase tracking-wider text-slate-400">
                      Lesson Overview
                    </h4>
                    <p className="text-sm text-slate-300 leading-relaxed font-interface">
                      {(activeLesson as any).description ||
                        'Master this module framework and apply the principles directly to your marketing engine and AI operational workflows.'}
                    </p>
                  </div>
                )}

                {/* Tab 2: Course Materials & Downloads */}
                {activeTab === 'materials' && (
                  <div className="space-y-6 pt-1">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider">
                          Enrolled Student Access
                        </span>
                      </div>
                      <h3 className="text-lg font-display font-bold text-white">
                        Course Materials & Framework Blueprints
                      </h3>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Download verified worksheets, toolkits, and interactive frameworks attached to this course.
                      </p>
                    </div>

                    {/* Resources List */}
                    {courseResources.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-400 flex items-center gap-2">
                          <Download className="w-3.5 h-3.5 text-[#FF6B00]" />
                          <span>Downloadable Toolkits & Assets ({courseResources.length})</span>
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {courseResources.map((res) => (
                            <div
                              key={res.id}
                              className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between gap-3"
                            >
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                    {res.category || 'Toolkit'}
                                  </span>
                                  {(res.fileType || res.format || res.fileSize) && (
                                    <span className="text-[10px] font-mono text-slate-400">
                                      {[res.fileType || res.format, res.fileSize].filter(Boolean).join(' · ')}
                                    </span>
                                  )}
                                </div>
                                <h5 className="text-sm font-display font-bold text-white leading-snug">
                                  {res.title || res.name}
                                </h5>
                                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                                  {res.description}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleDeliverCourseResource(res)}
                                disabled={downloadingResourceId === res.id}
                                className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-[#FF6B00] text-white text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-60"
                              >
                                {downloadingResourceId === res.id ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Opening...</span>
                                  </>
                                ) : res.externalUrl ? (
                                  <>
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    <span>Open Resource</span>
                                  </>
                                ) : (
                                  <>
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Download File</span>
                                  </>
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Frameworks List */}
                    {courseFrameworks.length > 0 && (
                      <div className="space-y-3 pt-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-400 flex items-center gap-2">
                          <Layers className="w-3.5 h-3.5 text-[#FF6B00]" />
                          <span>Strategic Frameworks ({courseFrameworks.length})</span>
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {courseFrameworks.map((fw) => (
                            <div
                              key={fw.id}
                              className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between gap-3"
                            >
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                    {fw.category || 'Framework'}
                                  </span>
                                  {fw.frameworkContent && (
                                    <span className="text-[10px] font-mono text-slate-400">
                                      {fw.frameworkContent.length} Stages
                                    </span>
                                  )}
                                </div>
                                <h5 className="text-sm font-display font-bold text-white leading-snug">
                                  {fw.title}
                                </h5>
                                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                                  {fw.description}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  navigate(`/frameworks/${fw.slug}`);
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-[#1877F2] text-white text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                              >
                                <Layers className="w-3.5 h-3.5" />
                                <span>Explore Interactive Blueprint</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Fallback state when no specific linked materials */}
                    {totalMaterialsCount === 0 && (
                      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-3">
                        <div className="w-10 h-10 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                          <BookOpen className="w-5 h-5 text-[#FF6B00]" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-sm font-display font-bold text-white">
                            Core Masterclass Experience
                          </h4>
                          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                            This masterclass focuses on end-to-end video curriculum and execution workflows. You can also explore all strategic toolkits and frameworks in the Student Resources catalog.
                          </p>
                        </div>
                        <div className="pt-1 flex items-center justify-center gap-3">
                          <button
                            type="button"
                            onClick={() => navigate('/resources')}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5 text-[#FF6B00]" />
                            <span>Browse Toolkits</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate('/frameworks')}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <Layers className="w-3.5 h-3.5 text-[#1877F2]" />
                            <span>Browse Frameworks</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Previous & Next Lesson Controls */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={handlePreviousLesson}
                    disabled={!previousLesson}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all ${
                      previousLesson
                        ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer'
                        : 'bg-slate-900 text-slate-600 cursor-not-allowed'
                    }`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">Previous Lesson</span>
                    <span className="sm:hidden">Prev</span>
                  </button>

                  <div className="text-center text-[11px] text-slate-500 font-mono">
                    {currentLessonIndex + 1} / {allLessons.length}
                  </div>

                  <button
                    type="button"
                    onClick={handleNextLesson}
                    disabled={!nextLesson}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all ${
                      nextLesson
                        ? 'bg-[#FF6B00] text-white hover:bg-[#e66000] cursor-pointer shadow-sm'
                        : 'bg-slate-900 text-slate-600 cursor-not-allowed'
                    }`}
                  >
                    <span className="hidden sm:inline">Next Lesson</span>
                    <span className="sm:hidden">Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Right / Syllabus Sidebar (Desktop Visible) */}
        <aside className="hidden lg:flex w-84 xl:w-96 bg-[#0B1526] border-l border-slate-800 flex-col shrink-0 h-[calc(100vh-4rem)] sticky top-16">
          {/* Syllabus Header */}
          <div className="p-5 border-b border-slate-800 space-y-3 shrink-0">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-wider font-mono text-slate-300">
                Course Syllabus
              </div>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono font-bold">
                {allLessons.length} Lessons
              </span>
            </div>
            {/* Progress Fraction */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Syllabus Progress</span>
                <span className="font-mono font-bold text-[#FF6B00]">{courseStats.progressPercent}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-300"
                  style={{ width: `${courseStats.progressPercent}%` }}
                />
              </div>
            </div>

            {/* Quick Access to Course Materials */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('materials');
                const el = document.getElementById('course-tabs-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className={`w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer border ${
                activeTab === 'materials'
                  ? 'bg-[#FF6B00]/15 border-[#FF6B00]/40 text-[#FF6B00]'
                  : 'bg-slate-900/80 hover:bg-slate-800 border-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2">
                <Download className="w-3.5 h-3.5 text-[#FF6B00]" />
                <span>Materials & Downloads</span>
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#FF6B00]/20 text-[#FF6B00]">
                {totalMaterialsCount}
              </span>
            </button>
          </div>

          {/* Modules and Lessons List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {modules.map((mod, modIdx) => {
              const isExpanded = Boolean(expandedModules[mod.id]);
              const modLessons = Array.isArray(mod.lessons) ? (mod.lessons as CourseLesson[]) : [];
              const completedInMod = modLessons.filter((l) => completedLessonIdSet.has(l.id)).length;

              return (
                <div
                  key={mod.id || modIdx}
                  className="rounded-2xl border border-slate-800/80 bg-slate-900/50 overflow-hidden"
                >
                  {/* Module Accordion Header */}
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedModules((prev) => ({
                        ...prev,
                        [mod.id]: !prev[mod.id]
                      }))
                    }
                    className="w-full p-3.5 flex items-center justify-between gap-3 text-left hover:bg-slate-800/50 transition-colors cursor-pointer"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="text-[10px] font-mono font-bold uppercase text-slate-400">
                        Module {modIdx + 1}
                      </div>
                      <div className="text-xs font-bold text-white truncate">
                        {mod.title || mod.module}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {completedInMod}/{modLessons.length} Completed
                      </div>
                    </div>
                    <div className="shrink-0 text-slate-400">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </button>

                  {/* Lessons List inside Module */}
                  {isExpanded && (
                    <div className="border-t border-slate-800 divide-y divide-slate-800/40">
                      {modLessons.map((l, lIdx) => {
                        const isCurrent = l.id === activeLessonId;
                        const isCompleted = completedLessonIdSet.has(l.id);

                        return (
                          <button
                            key={l.id || lIdx}
                            type="button"
                            onClick={() => handleSelectLesson(l.id)}
                            className={`w-full p-3 flex items-start gap-3 text-left transition-all cursor-pointer ${
                              isCurrent
                                ? 'bg-orange-500/10 border-l-2 border-[#FF6B00]'
                                : 'hover:bg-slate-800/30'
                            }`}
                          >
                            <div className="pt-0.5 shrink-0">
                              {isCompleted ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              ) : isCurrent ? (
                                <Play className="w-4 h-4 text-[#FF6B00] fill-[#FF6B00]" />
                              ) : (
                                <Circle className="w-4 h-4 text-slate-600" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div
                                className={`text-xs font-medium leading-snug line-clamp-2 ${
                                  isCurrent ? 'text-white font-bold' : isCompleted ? 'text-slate-400' : 'text-slate-300'
                                }`}
                              >
                                {l.title}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                                {l.duration && <span>{l.duration}</span>}
                                {l.isPreview && (
                                  <span className="text-[9px] font-bold text-blue-400 uppercase">Preview</span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>
      </div>

      {/* 3. MOBILE SYLLABUS DRAWER */}
      {isMobileSyllabusOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setIsMobileSyllabusOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative ml-auto w-full max-w-xs sm:max-w-sm bg-[#0B1526] h-full flex flex-col z-10 shadow-2xl border-l border-slate-800">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white font-display">Course Syllabus</h3>
                <p className="text-[11px] text-slate-400 font-mono">
                  {courseStats.completedLessons}/{courseStats.totalLessons} Completed ({courseStats.progressPercent}%)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileSyllabusOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile Materials Quick Link */}
            <div className="px-4 py-2 border-b border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('materials');
                  setIsMobileSyllabusOpen(false);
                  const el = document.getElementById('course-tabs-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className={`w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer border ${
                  activeTab === 'materials'
                    ? 'bg-[#FF6B00]/15 border-[#FF6B00]/40 text-[#FF6B00]'
                    : 'bg-slate-900/80 hover:bg-slate-800 border-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Download className="w-3.5 h-3.5 text-[#FF6B00]" />
                  <span>Materials & Downloads</span>
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#FF6B00]/20 text-[#FF6B00]">
                  {totalMaterialsCount}
                </span>
              </button>
            </div>

            {/* Mobile Modules List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {modules.map((mod, modIdx) => {
                const isExpanded = Boolean(expandedModules[mod.id]);
                const modLessons = Array.isArray(mod.lessons) ? (mod.lessons as CourseLesson[]) : [];
                const completedInMod = modLessons.filter((l) => completedLessonIdSet.has(l.id)).length;

                return (
                  <div
                    key={mod.id || modIdx}
                    className="rounded-xl border border-slate-800/80 bg-slate-900/50 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedModules((prev) => ({
                          ...prev,
                          [mod.id]: !prev[mod.id]
                        }))
                      }
                      className="w-full p-3 flex items-center justify-between gap-2 text-left hover:bg-slate-800/50 transition-colors cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="text-[9px] font-mono font-bold uppercase text-slate-400">
                          Module {modIdx + 1}
                        </div>
                        <div className="text-xs font-bold text-white truncate">
                          {mod.title || mod.module}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {completedInMod}/{modLessons.length}
                        </div>
                      </div>
                      <div className="text-slate-400">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-slate-800 divide-y divide-slate-800/40">
                        {modLessons.map((l, lIdx) => {
                          const isCurrent = l.id === activeLessonId;
                          const isCompleted = completedLessonIdSet.has(l.id);

                          return (
                            <button
                              key={l.id || lIdx}
                              type="button"
                              onClick={() => handleSelectLesson(l.id)}
                              className={`w-full p-2.5 flex items-start gap-2.5 text-left transition-all cursor-pointer ${
                                isCurrent
                                  ? 'bg-orange-500/15 border-l-2 border-[#FF6B00]'
                                  : 'hover:bg-slate-800/30'
                              }`}
                            >
                              <div className="pt-0.5 shrink-0">
                                {isCompleted ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                ) : isCurrent ? (
                                  <Play className="w-3.5 h-3.5 text-[#FF6B00] fill-[#FF6B00]" />
                                ) : (
                                  <Circle className="w-3.5 h-3.5 text-slate-600" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div
                                  className={`text-xs leading-snug line-clamp-2 ${
                                    isCurrent ? 'text-white font-bold' : isCompleted ? 'text-slate-400' : 'text-slate-300'
                                  }`}
                                >
                                  {l.title}
                                </div>
                                {l.duration && (
                                  <span className="text-[9px] text-slate-500 font-mono">{l.duration}</span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Course Certificate Celebration Modal */}
      {(existingCertificate || issuedCertificate) && course && (
        <CourseCertificateCelebrationModal
          isOpen={isCelebrationModalOpen}
          onClose={() => setIsCelebrationModalOpen(false)}
          certificate={(existingCertificate || issuedCertificate)!}
          courseTitle={course.title}
          recipientName={
            userProfile?.fullName ||
            currentUser?.user_metadata?.full_name ||
            currentUser?.email?.split('@')[0] ||
            'Valued Student'
          }
          navigate={navigate}
        />
      )}
    </div>
  );
};
