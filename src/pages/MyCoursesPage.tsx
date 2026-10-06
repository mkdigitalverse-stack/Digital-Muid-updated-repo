import React, { useEffect, useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  GraduationCap,
  BookOpen,
  CheckCircle2,
  Clock,
  ArrowRight,
  PlayCircle,
  Sparkles,
  AlertCircle,
  Compass,
  ArrowLeft,
  Calendar,
  Layers,
  Award,
  Download,
  ExternalLink,
  ShieldCheck,
  Hash,
  Heart
} from 'lucide-react';
import { StudentEnrollmentWithCourse, Certificate } from '../types';
import { CourseCertificateCelebrationModal } from '../components/CourseCertificateCelebrationModal';
import { downloadCertificatePdf } from '../utils/pdfGenerator';

interface MyCoursesPageProps {
  navigate: (path: string) => void;
}

export const MyCoursesPage: React.FC<MyCoursesPageProps> = ({ navigate }) => {
  const {
    currentUser,
    isAuthLoading,
    studentEnrollments,
    isEnrollmentsLoading,
    enrollmentsError,
    refreshStudentEnrollments,
    studentCertificates,
    getCertificateForCourse,
    issueCourseCertificate,
    userProfile,
    courseWishlist
  } = useApp();

  const [filter, setFilter] = useState<'all' | 'in-progress' | 'completed' | 'certificates'>('all');
  const [selectedCertForModal, setSelectedCertForModal] = useState<Certificate | null>(null);

  // Read URL query parameter for tab
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === 'certificates') {
      setFilter('certificates');
    }
  }, []);

  // Redirect unauthenticated visitors to login
  useEffect(() => {
    if (!isAuthLoading && !currentUser) {
      navigate('/login');
    }
  }, [isAuthLoading, currentUser, navigate]);

  // Ensure fresh enrollments data on mount
  useEffect(() => {
    if (currentUser) {
      refreshStudentEnrollments().catch(() => {});
    }
  }, [currentUser, refreshStudentEnrollments]);

  // Filtered course enrollments
  const filteredEnrollments = useMemo(() => {
    return studentEnrollments.filter((item) => {
      const pct = item.progressPercent || 0;
      if (filter === 'in-progress') return pct < 100;
      if (filter === 'completed') return pct >= 100;
      return true;
    });
  }, [studentEnrollments, filter]);

  // Counts for tabs
  const counts = useMemo(() => {
    let inProgress = 0;
    let completed = 0;
    studentEnrollments.forEach((item) => {
      if ((item.progressPercent || 0) >= 100) {
        completed += 1;
      } else {
        inProgress += 1;
      }
    });
    return {
      all: studentEnrollments.length,
      inProgress,
      completed
    };
  }, [studentEnrollments]);

  // Loading skeleton state
  if (isAuthLoading || (isEnrollmentsLoading && studentEnrollments.length === 0)) {
    return (
      <div id="my-courses-loading" className="pt-28 sm:pt-32 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-32 bg-slate-200 rounded-md" />
          <div className="h-10 w-72 bg-slate-200 rounded-xl" />
          <div className="h-5 w-96 bg-slate-200 rounded-md" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-80 bg-white border border-slate-200 rounded-3xl animate-pulse p-6" />
          ))}
        </div>
      </div>
    );
  }

  // Unauthenticated guard
  if (!currentUser) {
    return null;
  }

  return (
    <div id="my-courses-root" className="pt-28 sm:pt-32 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
      {/* Header & Breadcrumb */}
      <div className="space-y-4 pb-6 border-b border-slate-200">
        <div className="flex items-center gap-3 text-xs font-semibold text-slate-500 font-interface">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="hover:text-[#FF6B00] transition-colors flex items-center gap-1 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </button>
          <span>/</span>
          <span className="text-slate-900 font-bold">My Courses</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-slate-900 tracking-tight">
              My Enrolled Masterclasses
            </h1>
            <p className="text-slate-600 text-sm sm:text-base font-interface max-w-2xl">
              Access your enrolled masterclasses, monitor module milestones, and continue your hands-on digital training.
            </p>
          </div>

          <div className="shrink-0 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/wishlist')}
              className="px-4 py-2.5 bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <Heart className="w-4 h-4 text-rose-500" />
              <span>Wishlist ({courseWishlist.length})</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/learn')}
              className="px-4 py-2.5 bg-[#0F172A] hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <Compass className="w-4 h-4 text-[#FF6B00]" />
              <span>Browse All Courses</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error notice if query failed */}
      {enrollmentsError && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <div className="font-bold uppercase tracking-wider">Notice loading enrollment records</div>
            <p className="text-amber-800">{enrollmentsError}</p>
          </div>
        </div>
      )}

      {/* Filter Tabs (when courses exist) */}
      {studentEnrollments.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                filter === 'all'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Courses ({counts.all})
            </button>
            <button
              type="button"
              onClick={() => setFilter('in-progress')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                filter === 'in-progress'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              In Progress ({counts.inProgress})
            </button>
            <button
              type="button"
              onClick={() => setFilter('completed')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                filter === 'completed'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Completed ({counts.completed})
            </button>
            <button
              type="button"
              onClick={() => setFilter('certificates')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                filter === 'certificates'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Certificates ({studentCertificates.length})</span>
            </button>
          </div>

          <div className="text-xs text-slate-500 font-interface">
            {filter === 'certificates' ? (
              <span>
                Showing <span className="font-bold text-slate-800">{studentCertificates.length}</span> earned certificates
              </span>
            ) : (
              <span>
                Showing <span className="font-bold text-slate-800">{filteredEnrollments.length}</span> of{' '}
                <span className="font-bold text-slate-800">{studentEnrollments.length}</span> enrolled courses
              </span>
            )}
          </div>
        </div>
      )}

      {/* Enrolled Courses Grid */}
      {studentEnrollments.length === 0 ? (
        /* Empty State */
        <div className="p-8 sm:p-14 rounded-3xl bg-white border border-slate-200 text-center space-y-6 shadow-sm max-w-2xl mx-auto my-6">
          <div className="w-16 h-16 rounded-2xl bg-orange-50 border border-orange-100 text-[#FF6B00] flex items-center justify-center mx-auto">
            <BookOpen className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-display font-bold text-slate-900">
              No Course Enrollments Found
            </h3>
            <p className="text-slate-600 text-sm font-interface leading-relaxed max-w-lg mx-auto">
              You haven't enrolled in any masterclasses yet. When you enroll in a course, it will appear here with your personalized module checklist and progress tracker.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/learn')}
              className="px-6 py-3 bg-[#FF6B00] hover:bg-[#e66000] text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all inline-flex items-center gap-2 cursor-pointer shadow-lg shadow-[#FF6B00]/20 active:scale-[0.98]"
            >
              <Compass className="w-4 h-4" />
              <span>Browse Course Catalog</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            {courseWishlist.length > 0 && (
              <button
                type="button"
                onClick={() => navigate('/wishlist')}
                className="px-6 py-3 bg-white hover:bg-rose-50 text-slate-800 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-xl text-xs font-bold uppercase tracking-widest transition-all inline-flex items-center gap-2 cursor-pointer shadow-sm active:scale-[0.98]"
              >
                <Heart className="w-4 h-4 text-rose-500" />
                <span>View Wishlist ({courseWishlist.length})</span>
              </button>
            )}
          </div>
        </div>
      ) : filteredEnrollments.length === 0 ? (
        /* Filtered Empty State */
        <div className="p-10 rounded-3xl bg-white border border-slate-200 text-center space-y-4">
          <p className="text-slate-600 text-sm">
            No courses found matching the "<span className="font-semibold">{filter}</span>" filter.
          </p>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer"
          >
            Show All Courses
          </button>
        </div>
      ) : (
        /* Grid of enrolled cards */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredEnrollments.map((item) => {
            const course = item.course;
            const thumbnail = course?.thumbnail || course?.thumbnailUrl || course?.coverImage;
            const pct = Math.min(100, Math.max(0, item.progressPercent || 0));
            const isCompleted = pct >= 100;
            const slug = course?.slug || item.courseId;
            const totalLessons = item.totalLessonsCount || 0;
            const completedLessons = item.completedLessonsCount || 0;

            return (
              <div
                key={item.id}
                className="p-6 sm:p-7 rounded-3xl bg-white border border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-6"
              >
                <div className="space-y-4">
                  {/* Thumbnail & Badges */}
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
                        <GraduationCap className="w-12 h-12" />
                      </div>
                    )}
                    <div className="absolute top-3 left-3 flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded bg-white/95 backdrop-blur-md text-slate-900 text-xs font-bold uppercase tracking-wider border border-slate-200 shadow-sm">
                        {course?.level || 'Masterclass'}
                      </span>
                      {course?.aiIntegrated && (
                        <span className="px-2 py-0.5 rounded bg-blue-600 text-white text-[10px] font-bold flex items-center gap-1 shadow-sm">
                          <Sparkles className="w-3 h-3" /> AI
                        </span>
                      )}
                    </div>
                    {isCompleted && (
                      <div className="absolute top-3 right-3">
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 shadow-md">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Finished</span>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Title & Description */}
                  <div className="space-y-2">
                    <h3
                      onClick={() => navigate(`/learn/${slug}/player`)}
                      className="text-xl font-display font-bold text-slate-900 hover:text-[#FF6B00] transition-colors leading-snug cursor-pointer line-clamp-2"
                    >
                      {course?.title || 'Masterclass'}
                    </h3>
                    <p className="text-xs text-slate-600 line-clamp-2 font-interface leading-relaxed">
                      {course?.shortOutcome || course?.tagline || course?.description || 'Practical digital masterclass'}
                    </p>
                  </div>

                  {/* Enrollment Status & Timestamps */}
                  <div className="pt-1 flex items-center justify-between text-[11px] text-slate-500 font-interface border-t border-slate-100">
                    <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{item.status === 'active' ? 'Active Access' : item.status}</span>
                    </span>
                    <span className="font-mono text-slate-500">
                      Enrolled {new Date(item.enrolledAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Progress Bar and Lesson Count */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="text-slate-700 font-semibold font-interface">
                        Progress ({completedLessons}/{totalLessons} lessons)
                      </span>
                      <span className="font-mono font-bold text-slate-900">{pct}%</span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isCompleted ? 'bg-emerald-500' : 'bg-gradient-to-r from-[#FF6B00] to-amber-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Card CTA Actions */}
                <div className="pt-2 border-t border-slate-100 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => navigate(`/learn/${slug}/player`)}
                    className="flex-1 py-3 bg-[#0F172A] hover:bg-[#FF6B00] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    <PlayCircle className="w-4 h-4" />
                    <span>{isCompleted ? 'Review Lessons' : pct > 0 ? 'Continue' : 'Start Learning'}</span>
                  </button>

                  {isCompleted && (
                    <button
                      type="button"
                      onClick={() => {
                        const cert = getCertificateForCourse(item.courseId);
                        if (cert) {
                          setSelectedCertForModal(cert);
                        } else {
                          issueCourseCertificate(item.courseId, course?.title || 'Masterclass').then((res) => {
                            if (res.certificate) setSelectedCertForModal(res.certificate);
                          });
                        }
                      }}
                      className="p-3 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                      title="View Official Certificate of Completion"
                    >
                      <Award className="w-4 h-4 text-amber-600" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => navigate(`/learn/${slug}`)}
                    className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                    title="Course Overview & Syllabus"
                  >
                    <Layers className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Certificates View when filter === 'certificates' */}
      {filter === 'certificates' && (
        <div className="space-y-6">
          {studentCertificates.length === 0 ? (
            <div className="p-8 sm:p-14 rounded-3xl bg-white border border-slate-200 text-center space-y-6 shadow-sm max-w-2xl mx-auto my-6">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
                <Award className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-display font-bold text-slate-900">
                  No Certificates Earned Yet
                </h3>
                <p className="text-slate-600 text-sm font-interface leading-relaxed max-w-lg mx-auto">
                  Complete 100% of the lessons in any enrolled masterclass to earn your verified Digital Muid Certificate of Completion.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFilter('in-progress')}
                className="px-6 py-3 bg-[#0F172A] hover:bg-[#FF6B00] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm"
              >
                Continue Coursework
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {studentCertificates.map((cert) => (
                <div
                  key={cert.id}
                  className="bg-white border-2 border-amber-500/30 rounded-3xl p-6 sm:p-7 shadow-md space-y-6 relative overflow-hidden flex flex-col justify-between"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />

                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                        <Award className="w-6 h-6 text-[#FF6B00]" />
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Verified</span>
                      </span>
                    </div>

                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-amber-600 font-mono">
                        Certificate of Completion
                      </div>
                      <h3 className="text-xl font-display font-bold text-slate-900 mt-1">
                        {cert.courseTitle}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Awarded to <span className="font-semibold text-slate-800">{cert.recipientName}</span>
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs">
                      <div className="p-2.5 bg-slate-50 rounded-xl">
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                          <Hash className="w-3 h-3 text-slate-500" />
                          <span>Credential ID</span>
                        </div>
                        <div className="font-mono font-semibold text-slate-800 text-[11px] truncate mt-0.5">
                          {cert.certificateNumber}
                        </div>
                      </div>

                      <div className="p-2.5 bg-slate-50 rounded-xl">
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          <span>Issued On</span>
                        </div>
                        <div className="font-semibold text-slate-800 text-[11px] truncate mt-0.5">
                          {new Date(cert.issuedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        downloadCertificatePdf({
                          certificateNumber: cert.certificateNumber,
                          recipientName: cert.recipientName,
                          courseTitle: cert.courseTitle,
                          issuedAt: cert.issuedAt,
                          verificationHash: cert.verificationHash
                        })
                      }
                      className="flex-1 py-2.5 px-3 bg-[#0F172A] hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5 text-[#FF6B00]" />
                      <span>Download PDF</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => navigate(`/verify-certificate/${cert.verificationHash}`)}
                      className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      title="Public Verification Page"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Verify</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedCertForModal(cert)}
                      className="py-2.5 px-3 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                      title="View Details"
                    >
                      <Award className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Certificate Modal */}
      {selectedCertForModal && (
        <CourseCertificateCelebrationModal
          isOpen={Boolean(selectedCertForModal)}
          onClose={() => setSelectedCertForModal(null)}
          certificate={selectedCertForModal}
          courseTitle={selectedCertForModal.courseTitle}
          recipientName={selectedCertForModal.recipientName}
          navigate={navigate}
        />
      )}
    </div>
  );
};
