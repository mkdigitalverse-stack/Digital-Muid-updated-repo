import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  ArrowLeft,
  GraduationCap,
  Sparkles,
  Clock,
  Users,
  CheckCircle2,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Calendar,
  X,
  Play,
  Lock,
  AlertCircle,
  Loader2,
  Shield,
  CreditCard,
  AlertTriangle,
  User as UserIcon,
  RefreshCw,
  Heart
} from 'lucide-react';
import { Course, CourseLesson, PlaybackAuthorization, CreateCourseOrderResult, RazorpayCheckoutSuccessResponse } from '../types';
import { courseService, normalizeCourseCurriculum } from '../services/courseService';
import { paymentService } from '../services/paymentService';
import { loadRazorpayCheckoutScript, getClientRazorpayKeyId } from '../lib/razorpay';
import { isSupabaseConfigured } from '../lib/supabase';

interface CourseDetailPageProps {
  slug: string;
  navigate: (path: string) => void;
}

export const CourseDetailPage: React.FC<CourseDetailPageProps> = ({ slug, navigate }) => {
  const {
    courses,
    addLead,
    notify,
    studentEnrollments,
    currentUser,
    userProfile,
    refreshStudentEnrollments,
    fetchStudentNotifications,
    fetchStudentPayments,
    refreshCourseWishlist,
    isCourseWishlisted,
    toggleCourseWishlist
  } = useApp();
  const [fetchedCourse, setFetchedCourse] = useState<Course | null>(null);
  const [isFetchingRemote, setIsFetchingRemote] = useState<boolean>(isSupabaseConfigured());
  const [remoteResolved, setRemoteResolved] = useState<boolean>(!isSupabaseConfigured());

  // Authoritatively query Supabase for requested course slug
  useEffect(() => {
    let isMounted = true;

    if (!isSupabaseConfigured()) {
      setIsFetchingRemote(false);
      setRemoteResolved(true);
      return;
    }

    setIsFetchingRemote(true);
    courseService.fetchCourseBySlug(slug).then((res) => {
      if (!isMounted) return;
      if (res.data) {
        setFetchedCourse(res.data);
      } else {
        setFetchedCourse(null);
      }
      setIsFetchingRemote(false);
      setRemoteResolved(true);
    }).catch((err) => {
      if (!isMounted) return;
      console.warn('[Course Detail] Remote query fallback notice:', err);
      setIsFetchingRemote(false);
      setRemoteResolved(true);
    });

    return () => {
      isMounted = false;
    };
  }, [slug]);

  const localCourse = courses.find((c) => c.slug === slug);
  const course = isSupabaseConfigured()
    ? (fetchedCourse || localCourse || null)
    : (fetchedCourse || localCourse);

  // Course Enrollment & Payment Modal State
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [enrollTab, setEnrollTab] = useState<'checkout' | 'enquiry'>('checkout');
  const [checkoutStatus, setCheckoutStatus] = useState<
    | 'idle'
    | 'creating_order'
    | 'opening_checkout'
    | 'checkout_cancelled'
    | 'checkout_failed'
    | 'already_enrolled'
    | 'verifying_signature'
    | 'verification_pending'
    | 'fulfilled'
  >('idle');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<CreateCourseOrderResult | null>(null);
  const [checkoutSuccessData, setCheckoutSuccessData] = useState<RazorpayCheckoutSuccessResponse | null>(null);
  const [fulfillmentData, setFulfillmentData] = useState<any | null>(null);
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);

  // Corporate & Team Enquiry Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Secure Video Playback Modal State
  const [activePlaybackLesson, setActivePlaybackLesson] = useState<{ moduleTitle: string; lesson: CourseLesson } | null>(null);
  const [isAuthorizingPlayback, setIsAuthorizingPlayback] = useState(false);
  const [playbackAuth, setPlaybackAuth] = useState<PlaybackAuthorization | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const handleOpenLessonPlayback = async (modTitle: string, lesson: CourseLesson) => {
    if (!course?.id || !lesson.id) return;
    setActivePlaybackLesson({ moduleTitle: modTitle, lesson });
    setIsAuthorizingPlayback(true);
    setPlaybackAuth(null);
    setPlaybackError(null);

    try {
      const authResult = await courseService.getLessonPlaybackToken(course.id, lesson.id);
      if (authResult.authorized && (authResult.assetId || (authResult as any).asset_id)) {
        setPlaybackAuth(authResult);
      } else if (lesson.isPreview && lesson.videoUrl) {
        // Safe preview fallback strictly when lesson.isPreview is verified true
        const url = lesson.videoUrl.trim();
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
        setPlaybackAuth({
          authorized: true,
          provider,
          assetId,
          playbackType: 'public_preview'
        });
      } else {
        setPlaybackError(authResult.error || 'You do not have authorization to view this lesson.');
      }
    } catch (err: any) {
      if (lesson.isPreview && lesson.videoUrl) {
        const url = lesson.videoUrl.trim();
        const isYt = url.includes('youtu.be') || url.includes('youtube.com');
        let assetId = url;
        let provider: 'youtube' | 'vimeo' | 'cloudflare_stream' | 'direct' = 'direct';
        if (isYt) {
          provider = 'youtube';
          const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
          assetId = ytMatch ? ytMatch[1] : url;
        }
        setPlaybackAuth({
          authorized: true,
          provider,
          assetId,
          playbackType: 'public_preview'
        });
      } else {
        setPlaybackError(err.message || 'Failed to authenticate secure playback stream.');
      }
    } finally {
      setIsAuthorizingPlayback(false);
    }
  };

  const handleClosePlaybackModal = () => {
    setActivePlaybackLesson(null);
    setPlaybackAuth(null);
    setPlaybackError(null);
    setIsAuthorizingPlayback(false);
  };

  if (isFetchingRemote && !course) {
    return (
      <div id="course-detail-loading" className="pt-32 pb-24 text-center space-y-4 max-w-xl mx-auto px-4">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
        <p className="text-slate-600 text-sm font-interface">Loading course details...</p>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="pt-32 pb-24 text-center space-y-4 max-w-md mx-auto px-4">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
          <GraduationCap className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Course Not Found</h1>
        <p className="text-sm text-slate-600">The requested course could not be found or has been archived.</p>
        <button onClick={() => navigate('/learn')} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold">
          Back to Courses
        </button>
      </div>
    );
  }

  const thumbnail = course.thumbnail || course.thumbnailUrl || course.coverImage;
  const highlights = Array.isArray(course.highlights) ? course.highlights : [];
  const curriculum = normalizeCourseCurriculum(course.curriculum || (course as any).modules);

  const isEnrolled = Boolean(
    currentUser &&
    studentEnrollments.some(
      (e) => (e.courseId === course.id || e.course?.slug === course.slug) && e.status === 'active'
    )
  );

  const handleInitiateRazorpayCheckout = async () => {
    if (!course?.id) return;

    // Duplicate click protection: avoid duplicate API requests or multiple checkout modal instances
    if (isProcessingCheckout || checkoutStatus === 'creating_order' || checkoutStatus === 'opening_checkout') {
      return;
    }

    // 1. Require student authentication
    if (!currentUser) {
      sessionStorage.setItem('auth_redirect', `/learn/${course.slug}`);
      navigate('/login');
      return;
    }

    setIsProcessingCheckout(true);
    setCheckoutStatus('creating_order');
    setCheckoutError(null);

    try {
      // 2. Call backend order creation API - sends ONLY courseId!
      const orderResult = await paymentService.createCourseOrder(course.id);

      if (orderResult.alreadyEnrolled) {
        setCheckoutStatus('already_enrolled');
        setIsProcessingCheckout(false);
        return;
      }

      if (!orderResult.success || !orderResult.orderId) {
        setCheckoutStatus('checkout_failed');
        setCheckoutError(orderResult.error || 'Failed to initialize payment order with server.');
        setIsProcessingCheckout(false);
        return;
      }

      setCreatedOrder(orderResult);
      setCheckoutStatus('opening_checkout');

      // 3. Load official Razorpay Checkout SDK script
      const scriptLoaded = await loadRazorpayCheckoutScript();
      if (!scriptLoaded || typeof window.Razorpay !== 'function') {
        setCheckoutStatus('checkout_failed');
        setCheckoutError('Payment gateway interface failed to load. Please check your network connection and retry.');
        setIsProcessingCheckout(false);
        return;
      }

      // 4. Resolve public browser-safe key
      const publicKey = orderResult.keyId || getClientRazorpayKeyId();
      if (!publicKey) {
        setCheckoutStatus('checkout_failed');
        setCheckoutError('Payment gateway public key (VITE_RAZORPAY_KEY_ID) is not configured in this environment.');
        setIsProcessingCheckout(false);
        return;
      }

      // 5. Open Razorpay Checkout modal with server authoritative parameters
      const studentName = userProfile?.fullName || currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || '';
      const studentEmail = currentUser.email || '';
      const studentPhone = userProfile?.mobileNumber || userProfile?.phone || '';

      const options = {
        key: publicKey,
        order_id: orderResult.orderId,
        amount: orderResult.amount, // Server authoritative amount in paise
        currency: orderResult.currency || 'INR',
        name: 'Digital Muid',
        description: orderResult.courseTitle || course.title,
        prefill: {
          name: studentName,
          email: studentEmail,
          contact: studentPhone
        },
        theme: {
          color: '#059669' // emerald-600
        },
        handler: async function (response: RazorpayCheckoutSuccessResponse) {
          // Phase 2K-E: Client calls server to cryptographically verify signature
          // and execute atomic server-side fulfillment.
          setCheckoutSuccessData(response);
          setCheckoutStatus('verifying_signature');
          setIsProcessingCheckout(true);

          try {
            const verifyResult = await paymentService.verifyCoursePayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              courseId: course.id
            });

            if (verifyResult.success && verifyResult.verified) {
              setFulfillmentData(verifyResult);

              if (verifyResult.fulfilled) {
                // Server confirmed atomic fulfillment in database
                setCheckoutStatus('fulfilled');
                notify({
                  type: 'success',
                  message: 'Payment verified and masterclass access unlocked!'
                });

                // Refresh student context authoritatively from database
                try {
                  await Promise.allSettled([
                    refreshStudentEnrollments?.(),
                    currentUser?.id ? fetchStudentNotifications?.(currentUser.id) : Promise.resolve(),
                    currentUser?.id ? fetchStudentPayments?.(currentUser.id) : Promise.resolve(),
                    currentUser?.id ? refreshCourseWishlist?.(currentUser.id) : Promise.resolve()
                  ]);
                } catch (rErr) {
                  console.warn('[Course Detail] Background refresh notice:', rErr);
                }
              } else {
                // Payment verified, but database fulfillment is pending background completion or migration
                setCheckoutStatus('verification_pending');
              }
            } else {
              setCheckoutStatus('checkout_failed');
              setCheckoutError(
                verifyResult.error || 'Payment verification or fulfillment was rejected by the server.'
              );
            }
          } catch (vErr: any) {
            console.error('[Payment Verification] Request failed:', vErr);
            setCheckoutStatus('checkout_failed');
            setCheckoutError(
              vErr?.message || 'Failed to verify payment with server. Please retry or contact admissions.'
            );
          } finally {
            setIsProcessingCheckout(false);
          }
        },
        modal: {
          ondismiss: function () {
            // Student dismissed or cancelled checkout modal
            setCheckoutStatus('checkout_cancelled');
            setIsProcessingCheckout(false);
          }
        }
      };

      const rzp = new window.Razorpay(options);

      rzp.on('payment.failed', function (failedResp: any) {
        console.warn('[Razorpay Checkout] Gateway payment failed:', failedResp?.error);
        const reason = failedResp?.error?.description || failedResp?.error?.reason || 'Payment could not be completed. You can retry with another method.';
        setCheckoutStatus('checkout_failed');
        setCheckoutError(reason);
        setIsProcessingCheckout(false);
      });

      rzp.open();
    } catch (err: any) {
      console.error('[Razorpay Checkout] Unexpected checkout error:', err);
      setCheckoutStatus('checkout_failed');
      setCheckoutError(err?.message || 'An unexpected error occurred while launching payment checkout.');
      setIsProcessingCheckout(false);
    }
  };

  const handleOpenEnrollModal = (initialTab: 'checkout' | 'enquiry' = 'checkout') => {
    setIsEnrollModalOpen(true);
    setEnrollTab(initialTab);
    if (checkoutStatus !== 'verification_pending') {
      setCheckoutStatus('idle');
      setCheckoutError(null);
    }
  };

  const handleCloseEnrollModal = () => {
    // Prevent closing during active order creation, checkout launching, or signature verification
    if (
      isProcessingCheckout ||
      checkoutStatus === 'creating_order' ||
      checkoutStatus === 'opening_checkout' ||
      checkoutStatus === 'verifying_signature'
    ) {
      return;
    }
    setIsEnrollModalOpen(false);
    if (checkoutStatus !== 'verification_pending') {
      setCheckoutStatus('idle');
      setCheckoutError(null);
    }
  };

  const handleEnrollSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name && email) {
      addLead({
        name,
        email,
        phone,
        source: 'Course Enquiry',
        interest: course.title,
        notes: `Role: ${role}. Enrolling in ${course.title} (₹${course.offerPrice || course.price})`,
        status: 'New',
        amount: course.offerPrice || course.price
      });
      setSubmitted(true);
      notify(`Application received for ${course.title}!`, 'success');
    }
  };

  return (
    <div id="course-detail-root" className="pt-28 sm:pt-32 pb-24 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
      {/* Back Button */}
      <button
        onClick={() => navigate('/learn')}
        className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Course Catalogue</span>
      </button>

      {/* Hero Header */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        <div className="lg:col-span-7 space-y-6">
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold uppercase tracking-wider border border-emerald-200">
              {course.level}
            </span>
            {course.aiIntegrated && (
              <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 font-bold flex items-center gap-1 border border-blue-200">
                <Sparkles className="w-3 h-3 text-blue-600" /> AI-Integrated Curriculum
              </span>
            )}
            <span className="text-slate-500 flex items-center gap-1 font-medium">
              <Clock className="w-3.5 h-3.5" /> {course.duration}
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-display font-bold text-slate-900 tracking-tight leading-tight">
            {course.title}
          </h1>

          <p className="text-slate-600 text-base sm:text-lg font-interface leading-relaxed">
            {course.description}
          </p>

          {/* Quick Highlights */}
          {highlights.length > 0 && (
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2.5">
              <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider font-mono">What You Will Master</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700">
                {highlights.map((h: any, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{typeof h === 'string' ? h : (h?.title || h?.text || String(h))}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Sticky Enrollment Card */}
        <div className="lg:col-span-5 p-7 rounded-3xl bg-white border border-slate-200 shadow-lg space-y-6">
          <div className="aspect-[16/9] w-full rounded-2xl overflow-hidden bg-slate-100">
            {thumbnail ? (
              <img
                src={thumbnail}
                alt={course.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400">
                <GraduationCap className="w-12 h-12" />
              </div>
            )}
          </div>

          <div className="space-y-1">
            <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Full Masterclass Access</div>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-display font-black text-slate-900 font-mono">
                ₹{course.offerPrice || course.price}
              </span>
              {course.offerPrice && (
                <span className="text-base text-slate-400 line-through font-mono">
                  ₹{course.price}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Lifetime access + Quarterly updates</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Production templates & framework blueprints</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Official Certificate of Completion</span>
            </div>
          </div>

          {isEnrolled ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-orange-50/80 border border-orange-200/80 rounded-2xl">
                <span className="text-xs font-bold text-[#FF6B00] uppercase tracking-wider font-mono">
                  Enrolled Masterclass
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">
                  Active Access
                </span>
              </div>
              <button
                type="button"
                onClick={() => navigate(`/learn/${course.slug}/player`)}
                className="w-full py-4 rounded-xl bg-[#FF6B00] hover:bg-[#e66000] text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Continue Learning / Open Course</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => handleOpenEnrollModal('checkout')}
                className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <GraduationCap className="w-4 h-4" />
                <span>Apply / Enroll in Masterclass</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                id="course-wishlist-toggle-btn"
                onClick={() => toggleCourseWishlist(course.id)}
                className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer border ${
                  isCourseWishlisted(course.id)
                    ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 shadow-sm'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-sm'
                }`}
                title={isCourseWishlisted(course.id) ? 'Remove course from wishlist' : 'Save course to wishlist'}
                aria-label={isCourseWishlisted(course.id) ? 'Remove course from wishlist' : 'Save course to wishlist'}
              >
                <Heart
                  className={`w-4 h-4 transition-transform ${
                    isCourseWishlisted(course.id) ? 'fill-rose-500 text-rose-500 scale-110' : 'text-slate-400'
                  }`}
                />
                <span>{isCourseWishlisted(course.id) ? 'Saved in Wishlist' : 'Add to Wishlist'}</span>
              </button>
            </div>
          )}

          <p className="text-center text-[11px] text-slate-500">
            100% Satisfaction Guarantee · Immediate Onboarding
          </p>
        </div>
      </div>

      {/* Curriculum Breakdown */}
      {curriculum.length > 0 && (
        <div className="space-y-8 pt-6">
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-widest text-emerald-700 font-mono">Step-by-Step Syllabus</div>
            <h2 className="text-3xl font-display font-bold text-slate-900">Course Curriculum</h2>
          </div>

          <div className="space-y-4">
            {curriculum.map((mod: any, idx: number) => {
              const modTitle = typeof mod === 'string' ? mod : (mod?.module || mod?.title || `Module ${idx + 1}`);
              const modDuration = typeof mod === 'object' ? (mod?.duration || '') : '';
              const lessons: any[] = Array.isArray(mod?.lessons)
                ? mod.lessons
                : Array.isArray(mod?.topics)
                ? mod.topics
                : [];

              return (
                <div
                  key={mod.id || idx}
                  className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 font-bold font-mono flex items-center justify-center text-xs border border-emerald-200">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <h3 className="text-lg font-display font-bold text-slate-900">{modTitle}</h3>
                    </div>
                    {modDuration && (
                      <span className="text-xs text-slate-500 font-mono font-medium">{modDuration}</span>
                    )}
                  </div>

                  {lessons.length > 0 && (
                    <div className="pl-0 sm:pl-11 space-y-2">
                      {lessons.map((lesson: any, lIdx: number) => {
                        const lessonTitle =
                          typeof lesson === 'string'
                            ? lesson
                            : lesson?.title || lesson?.name || `Lesson ${lIdx + 1}`;
                        const lessonDescription =
                          typeof lesson === 'object' && lesson?.description
                            ? lesson.description
                            : null;
                        const lessonDuration =
                          typeof lesson === 'object'
                            ? lesson?.duration || (lesson?.durationMinutes ? `${lesson.durationMinutes} min` : '')
                            : '';
                        const deliveryType =
                          typeof lesson === 'object' && lesson?.deliveryType
                            ? lesson.deliveryType
                            : 'Video & Worksheet';
                        const isPreview =
                          typeof lesson === 'object' && Boolean(lesson?.isPreview);

                        return (
                          <div
                            key={lesson?.id || lIdx}
                            className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-700 py-2 border-b border-slate-100 last:border-0 gap-2"
                          >
                            <div className="flex items-start sm:items-center gap-2">
                              <BookOpen className="w-3.5 h-3.5 text-slate-400 mt-0.5 sm:mt-0 shrink-0" />
                              <div className="space-y-0.5">
                                <span className="font-medium text-slate-800">{lessonTitle}</span>
                                {lessonDescription && (
                                  <p className="text-[11px] text-slate-500">{lessonDescription}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 pl-5 sm:pl-0 shrink-0">
                              {lessonDuration && (
                                <span className="text-[11px] text-slate-400 font-mono">
                                  {lessonDuration}
                                </span>
                              )}
                              {isPreview ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenLessonPlayback(modTitle, lesson)}
                                  className="inline-flex items-center gap-1 text-[10px] text-blue-700 hover:text-blue-800 font-semibold font-mono bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded border border-blue-200 transition-colors cursor-pointer"
                                  title="Play Free Preview"
                                >
                                  <Play className="w-2.5 h-2.5 fill-current" />
                                  <span>Free Preview</span>
                                </button>
                              ) : Boolean(typeof lesson === 'object' && lesson?.hasSecureMedia) ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenLessonPlayback(modTitle, lesson)}
                                  className="inline-flex items-center gap-1 text-[10px] text-emerald-700 hover:text-emerald-800 font-semibold font-mono bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 transition-colors cursor-pointer"
                                  title="Open Lesson Stream"
                                >
                                  <Shield className="w-2.5 h-2.5 text-emerald-600" />
                                  <span>Watch Lesson</span>
                                </button>
                              ) : isEnrolled ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    navigate(
                                      `/learn/${course.slug}/player?lesson=${
                                        typeof lesson === 'object' ? lesson.id : ''
                                      }`
                                    )
                                  }
                                  className="inline-flex items-center gap-1 text-[10px] text-[#FF6B00] hover:text-[#e66000] font-bold font-mono bg-orange-50 hover:bg-orange-100 px-2 py-0.5 rounded border border-orange-200 transition-colors cursor-pointer"
                                  title="Play in Course Player"
                                >
                                  <Play className="w-2.5 h-2.5 fill-[#FF6B00]" />
                                  <span>Play Lesson</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setIsEnrollModalOpen(true)}
                                  className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-medium font-mono bg-slate-50 hover:bg-slate-100 px-2 py-0.5 rounded border border-slate-200 transition-colors cursor-pointer"
                                  title="Enrolled students only"
                                >
                                  <Lock className="w-2.5 h-2.5 text-slate-400" />
                                  <span>Enrolled Only</span>
                                </button>
                              )}
                              <span className="text-[10px] text-emerald-700 font-semibold font-mono bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 capitalize">
                                {deliveryType}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Enrollment & Razorpay Checkout Modal */}
      {isEnrollModalOpen && (
        <div
          id="course-enrollment-modal-backdrop"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
          onClick={handleCloseEnrollModal}
        >
          <div
            id="course-enrollment-modal"
            className="w-full max-w-lg bg-[#0B1526] border border-slate-700/90 rounded-3xl p-6 sm:p-8 space-y-6 relative shadow-2xl animate-in fade-in zoom-in-95 duration-150 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleCloseEnrollModal}
              disabled={
                isProcessingCheckout ||
                checkoutStatus === 'creating_order' ||
                checkoutStatus === 'opening_checkout' ||
                checkoutStatus === 'verifying_signature'
              }
              className="absolute top-5 right-5 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Tab Navigation (Hidden during verification or inquiry submitted) */}
            {checkoutStatus !== 'verification_pending' &&
              checkoutStatus !== 'verifying_signature' &&
              !submitted && (
              <div className="flex border-b border-slate-800 pb-3 gap-6">
                <button
                  type="button"
                  onClick={() => {
                    setEnrollTab('checkout');
                    setCheckoutError(null);
                  }}
                  className={`text-xs font-bold pb-1.5 transition-colors border-b-2 cursor-pointer flex items-center gap-1.5 ${
                    enrollTab === 'checkout'
                      ? 'text-emerald-400 border-emerald-400'
                      : 'text-slate-400 border-transparent hover:text-slate-200'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Individual Student (Razorpay)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEnrollTab('enquiry');
                    setCheckoutError(null);
                  }}
                  className={`text-xs font-bold pb-1.5 transition-colors border-b-2 cursor-pointer flex items-center gap-1.5 ${
                    enrollTab === 'enquiry'
                      ? 'text-emerald-400 border-emerald-400'
                      : 'text-slate-400 border-transparent hover:text-slate-200'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Corporate / Team Enquiry</span>
                </button>
              </div>
            )}

            {/* TAB 1: INDIVIDUAL STUDENT CHECKOUT FLOW */}
            {enrollTab === 'checkout' && (
              <div className="space-y-5">
                {checkoutStatus === 'verifying_signature' ? (
                  <div className="text-center py-8 space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto animate-pulse">
                      <Loader2 className="w-9 h-9 animate-spin text-emerald-400" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[11px] font-mono font-semibold uppercase tracking-wider">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Verifying Cryptographic Signature</span>
                      </div>
                      <h3 className="text-xl font-display font-bold text-white">
                        Validating Gateway Payment
                      </h3>
                      <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
                        Our server is cryptographically validating the Razorpay payment signature via HMAC SHA256. Please hold on...
                      </p>
                    </div>
                  </div>
                ) : checkoutStatus === 'fulfilled' ? (
                  <div className="text-center py-4 space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-9 h-9 text-emerald-400" />
                    </div>

                    <div className="space-y-1.5">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[11px] font-mono font-semibold uppercase tracking-wider">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Payment & Enrollment Fulfilled</span>
                      </div>
                      <h3 className="text-2xl font-display font-bold text-white">
                        Access Unlocked!
                      </h3>
                      <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
                        Your payment was cryptographically verified and your masterclass enrollment is active in your student dashboard.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-left space-y-2.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">Masterclass</span>
                        <span className="text-white font-medium truncate max-w-[220px]">
                          {fulfillmentData?.courseTitle || createdOrder?.courseTitle || course.title}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">Enrollment Status</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase">
                          Active Student
                        </span>
                      </div>
                      {(fulfillmentData?.paymentId || checkoutSuccessData?.razorpay_payment_id) && (
                        <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-800/80">
                          <span className="text-slate-500 font-mono text-[11px]">Payment ID</span>
                          <span className="text-slate-300 font-mono text-[11px]">
                            {fulfillmentData?.paymentId || checkoutSuccessData?.razorpay_payment_id}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setIsEnrollModalOpen(false);
                          navigate(`/learn/${fulfillmentData?.courseSlug || course.slug}/player`);
                        }}
                        className="flex-1 py-3.5 rounded-xl bg-[#FF6B00] hover:bg-[#e66000] text-white text-xs font-bold shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Play className="w-4 h-4 fill-white" />
                        <span>Start Learning / Open Player</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEnrollModalOpen(false);
                          navigate('/my-courses');
                        }}
                        className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all cursor-pointer"
                      >
                        My Courses
                      </button>
                    </div>
                  </div>
                ) : checkoutStatus === 'verification_pending' ? (
                  <div className="text-center py-4 space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
                      <ShieldCheck className="w-9 h-9 text-emerald-400" />
                    </div>

                    <div className="space-y-1.5">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[11px] font-mono font-semibold uppercase tracking-wider">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Cryptographically Verified</span>
                      </div>
                      <h3 className="text-xl font-display font-bold text-white">
                        Payment Signature Verified by Server
                      </h3>
                      <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
                        Your payment has been cryptographically confirmed. Automated course enrollment activation is currently synchronizing in the background.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-left space-y-2.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">Masterclass</span>
                        <span className="text-white font-medium truncate max-w-[220px]">{createdOrder?.courseTitle || course.title}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">Authoritative Amount</span>
                        <span className="text-emerald-400 font-bold font-mono">
                          {createdOrder?.currency || 'INR'} {((createdOrder?.amount || 0) / 100).toLocaleString('en-IN')}
                        </span>
                      </div>
                      {checkoutSuccessData?.razorpay_payment_id && (
                        <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-800/80">
                          <span className="text-slate-500 font-mono text-[11px]">Razorpay Payment ID</span>
                          <span className="text-slate-300 font-mono text-[11px]">{checkoutSuccessData.razorpay_payment_id}</span>
                        </div>
                      )}
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 text-left leading-relaxed space-y-1">
                      <p className="text-slate-300 font-semibold">Activation Note:</p>
                      <p>
                        Cryptographic signature verified. Course access will automatically unlock once asynchronous fulfillment completes.
                      </p>
                    </div>

                    <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                      <button
                        type="button"
                        onClick={async () => {
                          await refreshStudentEnrollments();
                        }}
                        className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Check Access Status</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEnrollModalOpen(false);
                          navigate('/my-courses');
                        }}
                        className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all cursor-pointer"
                      >
                        My Courses
                      </button>
                    </div>
                  </div>
                ) : checkoutStatus === 'already_enrolled' ? (
                  <div className="text-center py-4 space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xl font-display font-bold text-white">Active Enrollment Found</h3>
                      <p className="text-xs text-slate-300">
                        You already have full active access to <strong>{course.title}</strong>.
                      </p>
                    </div>
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsEnrollModalOpen(false);
                          navigate(`/learn/${course.slug}/player`);
                        }}
                        className="w-full py-3.5 rounded-xl bg-[#FF6B00] hover:bg-[#e66000] text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Play className="w-4 h-4 fill-white" />
                        <span>Continue Learning / Open Course</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : !currentUser ? (
                  /* Unauthenticated Visitor State */
                  <div className="space-y-5 py-2">
                    <div className="space-y-1">
                      <h3 className="text-xl font-display font-bold text-white">Enroll in {course.title}</h3>
                      <p className="text-xs text-slate-400">Sign in to your student account to enroll directly via Razorpay.</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                          <Lock className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white">Student Account Required</h4>
                          <p className="text-xs text-slate-400">Enables lifetime tracking and verifiable certificates</p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        To activate direct payment and link your cohort enrollment, video progress, and certificates, please sign in or create an account.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        sessionStorage.setItem('auth_redirect', `/learn/${course.slug}`);
                        navigate('/login');
                      }}
                      className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <UserIcon className="w-4 h-4" />
                      <span>Sign In / Register to Enroll</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>

                    <div className="text-center pt-1">
                      <button
                        type="button"
                        onClick={() => setEnrollTab('enquiry')}
                        className="text-xs text-slate-400 hover:text-white transition-colors underline cursor-pointer"
                      >
                        Have a corporate or custom billing requirement? Submit an inquiry
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Authenticated Student Checkout State */
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <h3 className="text-xl font-display font-bold text-white">Complete Masterclass Enrollment</h3>
                      <p className="text-xs text-slate-400">Direct online payment processed securely by Razorpay.</p>
                    </div>

                    {/* Authenticated Identity Pill */}
                    <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                          {(userProfile?.fullName || currentUser.email || 'S')[0].toUpperCase()}
                        </div>
                        <div className="truncate max-w-[210px]">
                          <div className="text-white font-medium truncate">{userProfile?.fullName || 'Student'}</div>
                          <div className="text-slate-500 text-[10px] font-mono truncate">{currentUser.email}</div>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Authenticated
                      </span>
                    </div>

                    {/* Pricing & Course Box */}
                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="space-y-0.5 max-w-[65%]">
                          <div className="text-[11px] text-slate-400 uppercase font-mono tracking-wider">Course Selection</div>
                          <div className="text-sm font-bold text-white leading-snug">{course.title}</div>
                        </div>
                        <div className="text-right shrink-0 pl-3">
                          <div className="text-lg font-bold font-mono text-emerald-400">
                            ₹{course.offerPrice || course.price}
                          </div>
                          {course.offerPrice && (
                            <div className="text-xs font-mono text-slate-500 line-through">
                              ₹{course.price}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Official Razorpay Checkout</span>
                        </span>
                        <span>Server Authoritative Pricing</span>
                      </div>
                    </div>

                    {/* Cancellation Notice */}
                    {checkoutStatus === 'checkout_cancelled' && (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                        <span>Checkout was dismissed or cancelled. You can retry whenever you are ready.</span>
                      </div>
                    )}

                    {/* Failure / Error Notice */}
                    {checkoutStatus === 'checkout_failed' && checkoutError && (
                      <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                        <span className="leading-relaxed">{checkoutError}</span>
                      </div>
                    )}

                    {/* CTA Button with Duplicate Click Protection */}
                    <button
                      type="button"
                      onClick={handleInitiateRazorpayCheckout}
                      disabled={isProcessingCheckout || checkoutStatus === 'creating_order' || checkoutStatus === 'opening_checkout'}
                      className={`w-full py-4 rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        isProcessingCheckout || checkoutStatus === 'creating_order' || checkoutStatus === 'opening_checkout'
                          ? 'bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700'
                          : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                      }`}
                    >
                      {checkoutStatus === 'creating_order' ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                          <span>Initializing Gateway Order...</span>
                        </>
                      ) : checkoutStatus === 'opening_checkout' ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                          <span>Launching Razorpay Checkout...</span>
                        </>
                      ) : checkoutStatus === 'checkout_failed' || checkoutStatus === 'checkout_cancelled' ? (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          <span>Retry Razorpay Payment</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4" />
                          <span>Pay with Razorpay (₹{course.offerPrice || course.price})</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>

                    <p className="text-center text-[10px] text-slate-500 font-medium">
                      Encrypted 256-bit checkout · UPI, Cards, Netbanking & Wallets supported
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: CORPORATE / CUSTOM ENQUIRY FLOW (Preserving CRM / Corporate Form) */}
            {enrollTab === 'enquiry' && (
              submitted ? (
                <div className="text-center py-6 space-y-4">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-display font-bold text-white">Application Received!</h3>
                  <p className="text-slate-300 text-sm">
                    We have received your corporate enrollment inquiry for <strong>{course.title}</strong>. Our student admissions team will reach out with cohort access and custom invoicing details.
                  </p>
                  <button
                    type="button"
                    onClick={handleCloseEnrollModal}
                    className="px-6 py-2.5 rounded-xl bg-slate-800 text-white text-xs font-semibold cursor-pointer"
                  >
                    Close Window
                  </button>
                </div>
              ) : (
                <form onSubmit={handleEnrollSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-xl font-display font-bold text-white">Corporate & Custom Inquiry</h3>
                    <p className="text-xs text-slate-400">Inquire for team cohorts, GST invoicing, or tailored training.</p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-slate-300 font-medium">Your Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Rahul Verma"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-300 font-medium">Email Address *</label>
                      <input
                        type="email"
                        required
                        placeholder="e.g. rahul@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-300 font-medium">Phone / WhatsApp Number</label>
                      <input
                        type="tel"
                        placeholder="+91 98765 43210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-300 font-medium">Company / Current Role</label>
                      <input
                        type="text"
                        placeholder="e.g. Acme Corp / Marketing VP"
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all cursor-pointer"
                    >
                      Submit Team / Corporate Inquiry
                    </button>
                  </div>
                </form>
              )
            )}
          </div>
        </div>
      )}
      {/* Secure Video Playback Modal */}
      {activePlaybackLesson && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#0B1526] border border-slate-700 rounded-3xl p-6 sm:p-8 space-y-5 relative shadow-2xl">
            <button
              onClick={handleClosePlaybackModal}
              className="absolute top-5 right-5 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1 pr-8">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                  {activePlaybackLesson.moduleTitle}
                </span>
                {activePlaybackLesson.lesson.isPreview && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase">
                    Free Preview
                  </span>
                )}
              </div>
              <h3 className="text-xl font-display font-bold text-white">
                {activePlaybackLesson.lesson.title}
              </h3>
            </div>

            {/* Video Player State Container */}
            <div className="w-full aspect-video rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center relative">
              {isAuthorizingPlayback && (
                <div className="flex flex-col items-center gap-3 p-6 text-center">
                  <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                  <p className="text-xs text-slate-300 font-medium">Validating lesson playback authorization...</p>
                </div>
              )}

              {!isAuthorizingPlayback && playbackError && (
                <div className="flex flex-col items-center gap-3 p-6 text-center max-w-md">
                  <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-bold text-white">Lesson Access Restricted</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">{playbackError}</p>
                  <button
                    onClick={() => {
                      handleClosePlaybackModal();
                      handleOpenEnrollModal('checkout');
                    }}
                    className="mt-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    Enroll to Unlock Full Access
                  </button>
                </div>
              )}

              {!isAuthorizingPlayback && playbackAuth?.authorized && (playbackAuth.assetId || (playbackAuth as any).asset_id) && (
                (() => {
                  const activeAssetId = (playbackAuth.assetId || (playbackAuth as any).asset_id)!;
                  return playbackAuth.provider === 'youtube' ? (
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${activeAssetId}?autoplay=1&rel=0&modestbranding=1`}
                      title={activePlaybackLesson.lesson.title}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : playbackAuth.provider === 'vimeo' ? (
                    <iframe
                      src={`https://player.vimeo.com/video/${activeAssetId}?autoplay=1&dnt=1`}
                      title={activePlaybackLesson.lesson.title}
                      className="w-full h-full border-0"
                      allow="autoplay; fullscreen; picture-in-picture"
                      allowFullScreen
                    />
                  ) : playbackAuth.provider === 'cloudflare_stream' ? (
                    <iframe
                      src={`https://iframe.videodelivery.net/${activeAssetId}`}
                      title={activePlaybackLesson.lesson.title}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <video
                      src={activeAssetId}
                      controls
                      autoPlay
                      controlsList="nodownload"
                      className="w-full h-full"
                    />
                  );
                })()
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
              <span className="flex items-center gap-1.5 text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Protected Digital Muid Curriculum</span>
              </span>
              <button
                onClick={handleClosePlaybackModal}
                className="text-slate-300 hover:text-white text-xs font-medium cursor-pointer"
              >
                Close Stream
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
