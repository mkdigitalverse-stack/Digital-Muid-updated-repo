import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Heart,
  BookOpen,
  GraduationCap,
  Clock,
  ArrowRight,
  ArrowLeft,
  Trash2,
  Sparkles,
  Compass,
  CheckCircle2,
  Bookmark,
  Users,
  Search,
  Filter
} from 'lucide-react';
import { Course } from '../types';

interface CourseWishlistPageProps {
  navigate: (path: string) => void;
}

export const CourseWishlistPage: React.FC<CourseWishlistPageProps> = ({ navigate }) => {
  const {
    currentUser,
    isAuthLoading,
    courses,
    courseWishlist,
    isWishlistLoading,
    removeFromWishlist,
    studentEnrollments
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Set of enrolled course IDs to detect if student already enrolled in any wishlisted course
  const enrolledCourseIds = useMemo(() => {
    return new Set(studentEnrollments.map((e) => e.courseId));
  }, [studentEnrollments]);

  // Resolve full Course objects for wishlisted IDs
  const wishlistedCourses = useMemo(() => {
    if (!courses || courses.length === 0 || !courseWishlist || courseWishlist.length === 0) {
      return [];
    }
    const courseMap = new Map<string, Course>();
    courses.forEach((c) => courseMap.set(c.id, c));

    // Return courses in the order they were wishlisted
    const resolved: Course[] = [];
    courseWishlist.forEach((id) => {
      const c = courseMap.get(id);
      if (c && c.status === 'published') {
        resolved.push(c);
      }
    });
    return resolved;
  }, [courses, courseWishlist]);

  // Extract unique categories for filter tabs
  const categories = useMemo(() => {
    const set = new Set<string>();
    wishlistedCourses.forEach((c) => {
      const cat = (c as any).category || (c.tags && c.tags[0]);
      if (cat) set.add(cat);
    });
    return Array.from(set);
  }, [wishlistedCourses]);

  // Filtered courses based on search & category
  const filteredCourses = useMemo(() => {
    return wishlistedCourses.filter((course) => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (course.tags && course.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())));

      const courseCategory = (course as any).category || (course.tags && course.tags[0]) || 'General';
      const matchesCategory = selectedCategory === 'all' || courseCategory === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [wishlistedCourses, searchQuery, selectedCategory]);

  const handleRemove = async (courseId: string) => {
    setRemovingId(courseId);
    try {
      await removeFromWishlist(courseId);
    } finally {
      setRemovingId(null);
    }
  };

  // Unauthenticated prompt
  if (!isAuthLoading && !currentUser) {
    return (
      <div id="course-wishlist-unauth" className="pt-28 sm:pt-32 pb-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
        <div className="w-16 h-16 rounded-3xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-sm">
          <Heart className="w-8 h-8" />
        </div>
        <div className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 tracking-tight">
            Sign In to Access Your Course Wishlist
          </h1>
          <p className="text-slate-600 text-sm sm:text-base font-interface max-w-lg mx-auto leading-relaxed">
            Keep track of executive masterclasses, pricing, and curriculum updates you are planning to join.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="px-6 py-3 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md"
          >
            Sign In / Register
          </button>
          <button
            type="button"
            onClick={() => navigate('/learn')}
            className="px-6 py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-sm"
          >
            Explore Masterclasses
          </button>
        </div>
      </div>
    );
  }

  return (
    <div id="course-wishlist-root" className="pt-28 sm:pt-32 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
      {/* 1. Header & Navigation */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-200">
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => navigate('/learn')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Course Catalog</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <Heart className="w-5 h-5 fill-rose-500" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 tracking-tight">
                Course Wishlist
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-interface">
                Programs you are evaluating for future enrollment and career advancement.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/my-courses')}
            className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-sm hover:shadow"
          >
            <BookOpen className="w-4 h-4 text-[#FF6B00]" />
            <span>My Enrolled Courses</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/saved')}
            className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-sm hover:shadow"
          >
            <Bookmark className="w-4 h-4 text-[#FF6B00]" />
            <span>Saved Content</span>
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

      {/* 2. Loading State */}
      {isWishlistLoading && wishlistedCourses.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-80 rounded-3xl bg-slate-100 border border-slate-200 p-6 space-y-4">
              <div className="aspect-[16/9] w-full rounded-2xl bg-slate-200" />
              <div className="h-6 w-3/4 bg-slate-200 rounded" />
              <div className="h-4 w-1/2 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      ) : wishlistedCourses.length === 0 ? (
        /* 3. Empty State */
        <div
          id="course-wishlist-empty"
          className="p-10 sm:p-16 rounded-3xl bg-slate-50/80 border border-slate-200/80 text-center space-y-6 max-w-2xl mx-auto"
        >
          <div className="w-16 h-16 rounded-3xl bg-white border border-slate-200 text-slate-400 flex items-center justify-center mx-auto shadow-sm">
            <Heart className="w-8 h-8 text-rose-400" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900">
              Your Course Wishlist is Empty
            </h2>
            <p className="text-slate-600 text-sm font-interface max-w-md mx-auto leading-relaxed">
              Explore our masterclasses in digital marketing, AI automation, and performance scaling. Save the programs you want to consider later.
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => navigate('/learn')}
              className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-md mx-auto"
            >
              <Compass className="w-4 h-4" />
              <span>Explore Course Catalog</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* 4. Active Wishlist Content */
        <div className="space-y-6">
          {/* Controls: Search and Category Filter */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search wishlisted courses..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 shadow-sm"
              />
            </div>

            {/* Category Filter Tabs */}
            {categories.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    selectedCategory === 'all'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200 font-bold'
                      : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                  }`}
                >
                  All ({wishlistedCourses.length})
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-rose-50 text-rose-700 border border-rose-200 font-bold'
                        : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Wishlisted Courses Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map((course) => {
              const thumbnail = course.thumbnail || course.thumbnailUrl || course.coverImage;
              const isEnrolled = enrolledCourseIds.has(course.id);
              const category = (course as any).category || (course.tags && course.tags[0]) || 'Masterclass';
              const isBeingRemoved = removingId === course.id;

              return (
                <div
                  key={course.id}
                  className="p-6 rounded-3xl bg-white border border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-5 group relative"
                >
                  <div className="space-y-4">
                    {/* Thumbnail & Badges */}
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

                      {/* Top Badges */}
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
                        {course.aiIntegrated && (
                          <span className="px-2 py-0.5 rounded bg-blue-600 text-white text-[10px] font-bold flex items-center gap-1 shadow-sm">
                            <Sparkles className="w-2.5 h-2.5" /> AI
                          </span>
                        )}
                      </div>

                      {/* Remove Wishlist Button on Card */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemove(course.id);
                        }}
                        disabled={isBeingRemoved}
                        className="absolute top-2.5 right-2.5 p-2 rounded-xl bg-white/95 hover:bg-rose-50 text-rose-600 transition-colors shadow-sm cursor-pointer border border-slate-200"
                        title="Remove from Wishlist"
                        aria-label="Remove from Wishlist"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Title & Description */}
                    <div className="space-y-1.5">
                      <h3
                        onClick={() => navigate(`/learn/${course.slug}`)}
                        className="text-lg font-display font-bold text-slate-900 group-hover:text-rose-600 transition-colors leading-snug cursor-pointer line-clamp-2"
                      >
                        {course.title}
                      </h3>
                      {(course.shortOutcome || course.description) && (
                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed font-interface">
                          {course.shortOutcome || course.description}
                        </p>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 font-interface pt-1">
                      {course.duration && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{course.duration}</span>
                        </div>
                      )}
                      {course.enrolledCount !== undefined && course.enrolledCount > 0 && (
                        <div className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span>{course.enrolledCount}+ Students</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Pricing & CTA */}
                  <div className="pt-4 border-t border-slate-100 space-y-3">
                    <div className="flex items-baseline justify-between">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-bold text-slate-900 font-mono">
                          {course.priceFormatted || (course.price ? `₹${course.offerPrice || course.price}` : 'Enquire')}
                        </span>
                        {course.offerPrice && course.price && (
                          <span className="text-xs text-slate-400 line-through font-mono">
                            ₹{course.price}
                          </span>
                        )}
                      </div>

                      {isEnrolled && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Already Enrolled
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isEnrolled ? (
                        <button
                          type="button"
                          onClick={() => navigate(`/learn/${course.slug}/player`)}
                          className="flex-1 py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#e66000] text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Open Course</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => navigate(`/learn/${course.slug}`)}
                          className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <GraduationCap className="w-3.5 h-3.5" />
                          <span>View Masterclass</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleRemove(course.id)}
                        disabled={isBeingRemoved}
                        className="p-2.5 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 transition-colors cursor-pointer"
                        title="Remove from Wishlist"
                        aria-label="Remove from Wishlist"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
