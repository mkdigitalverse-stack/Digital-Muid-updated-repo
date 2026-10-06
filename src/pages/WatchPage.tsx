import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Video as VideoIcon, Play, Clock, Sparkles, Search, ArrowRight, Loader2, Bookmark } from 'lucide-react';
import { videoService, getYouTubeThumbnail } from '../services/videoService';
import { isSupabaseConfigured } from '../lib/supabase';
import { Video } from '../types';

interface WatchPageProps {
  navigate: (path: string) => void;
}

export const WatchPage: React.FC<WatchPageProps> = ({ navigate }) => {
  const {
    videos: contextVideos,
    isBookmarked,
    toggleBookmark,
    currentUser,
    notify
  } = useApp();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [fetchedVideos, setFetchedVideos] = useState<Video[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(isSupabaseConfigured());

  const categories = ['All', 'Latest', 'AI', 'Marketing', 'Business', 'Personal Branding', 'Tutorials', 'Digital Growth'];

  const handleToggleVideoBookmark = async (e: React.MouseEvent, videoId: string) => {
    e.stopPropagation();
    if (!currentUser) {
      notify('Please sign in to save videos to your personal library.', 'info');
      navigate('/login');
      return;
    }
    await toggleBookmark('video', videoId);
  };

  // Authoritative published videos fetch from Supabase on mount
  useEffect(() => {
    let isMounted = true;

    if (!isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }

    videoService.fetchPublishedVideos().then((res) => {
      if (!isMounted) return;

      if (res.data !== null && !res.error) {
        setFetchedVideos(res.data);
        setIsLoading(false);
      } else {
        console.warn('[WatchPage] Supabase query notice, falling back to local state:', res.error);
        setIsLoading(false);
      }
    }).catch((err) => {
      if (!isMounted) return;
      console.error('[WatchPage] Error during public videos sync:', err);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const rawVideos = isSupabaseConfigured()
    ? (fetchedVideos !== null ? fetchedVideos : contextVideos.filter((v) => v.status === 'published'))
    : contextVideos.filter((v) => v.status === 'published' || !v.status);

  const filteredVideos = rawVideos.filter((v) => {
    const matchesCat = selectedCategory === 'All' || selectedCategory === 'Latest' || v.category === selectedCategory;
    const matchesSearch =
      v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.description && v.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (v.tags && v.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())));
    return matchesCat && matchesSearch;
  });

  const featuredVideo = filteredVideos.find((v) => v.isFeatured || v.featured) || rawVideos.find((v) => v.isFeatured || v.featured) || rawVideos[0];

  const getVideoThumbnail = (v: Video) => {
    return v.thumbnailUrl || v.thumbnail || (v.youtubeVideoId ? getYouTubeThumbnail(v.youtubeVideoId) : '') || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80';
  };

  return (
    <div id="watch-page-root" className="pt-28 sm:pt-32 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
      {/* Header */}
      <div className="max-w-3xl space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-xs font-bold uppercase tracking-wider font-interface">
          <VideoIcon className="w-3.5 h-3.5" /> Video Knowledge & Masterclasses
        </div>
        <h1 className="text-4xl sm:text-5xl font-display font-bold text-slate-900 tracking-tight">
          Watch Digital Muid
        </h1>
        <p className="text-slate-600 text-base sm:text-lg font-interface">
          Tactical video breakdowns, framework explanations, and real-time teardowns of modern digital growth engines.
        </p>
      </div>

      {isLoading ? (
        <div id="watch-loading" className="py-20 text-center space-y-4">
          <Loader2 className="w-8 h-8 text-purple-600 animate-spin mx-auto" />
          <p className="text-slate-600 text-sm font-interface">Loading video masterclasses...</p>
        </div>
      ) : (
        <>
          {/* Featured Video Spotlight */}
          {featuredVideo && (
            <div
              id="featured-video-card"
              onClick={() => navigate(`/watch/${featuredVideo.slug}`)}
              className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-[#13112A] to-slate-900 border border-slate-800 shadow-2xl group cursor-pointer grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
            >
              <div className="lg:col-span-7 aspect-[16/9] w-full rounded-2xl bg-slate-950 relative overflow-hidden shadow-xl">
                <img
                  src={getVideoThumbnail(featuredVideo)}
                  alt={featuredVideo.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/10 transition-colors">
                  <div className="w-14 h-14 rounded-full bg-white/95 text-[#07111F] flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                    <Play className="w-6 h-6 fill-current ml-0.5 text-purple-600" />
                  </div>
                </div>
                <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded bg-black/80 text-white text-xs font-mono font-bold">
                  {featuredVideo.duration || '12:00'}
                </div>
                <button
                  type="button"
                  id={`bookmark-card-video-${featuredVideo.id}`}
                  onClick={(e) => handleToggleVideoBookmark(e, featuredVideo.id)}
                  className={`absolute top-3 right-3 p-2 rounded-xl backdrop-blur-md transition-all shadow-md cursor-pointer z-10 ${
                    isBookmarked('video', featuredVideo.id)
                      ? 'bg-white text-[#FF6B00] border border-orange-200'
                      : 'bg-black/60 hover:bg-black/80 text-white/80 hover:text-white border border-white/20'
                  }`}
                  title={isBookmarked('video', featuredVideo.id) ? 'Remove video from saved' : 'Save video'}
                  aria-label={isBookmarked('video', featuredVideo.id) ? 'Remove video from saved' : 'Save video'}
                >
                  <Bookmark className={`w-4 h-4 ${isBookmarked('video', featuredVideo.id) ? 'fill-[#FF6B00]' : ''}`} />
                </button>
              </div>

              <div className="lg:col-span-5 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold uppercase tracking-wider border border-purple-500/30">
                    Featured Breakdown
                  </span>
                  <span className="text-xs text-slate-400">{featuredVideo.viewsCount || '1.2k views'}</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-display font-bold text-white group-hover:text-purple-300 transition-colors leading-tight">
                  {featuredVideo.title}
                </h2>
                <p className="text-slate-300 text-sm font-interface leading-relaxed line-clamp-3">
                  {featuredVideo.description}
                </p>
                <div className="pt-2">
                  <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-all shadow-md">
                    <Play className="w-3.5 h-3.5 fill-current" /> Watch Video Breakdown
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Category Pills & Search */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search videos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Video Grid */}
          {filteredVideos.length === 0 ? (
            <div className="text-center py-16 space-y-3 bg-white rounded-3xl border border-slate-200">
              <p className="text-slate-700 font-semibold text-base font-interface">No video masterclasses found</p>
              <p className="text-slate-500 text-xs font-interface">Try selecting a different category or clearing your search term.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredVideos.map((vid) => (
                <div
                  key={vid.id}
                  id={`video-card-${vid.slug}`}
                  onClick={() => navigate(`/watch/${vid.slug}`)}
                  className="rounded-2xl bg-white border border-slate-200 hover:border-purple-300 transition-all group cursor-pointer overflow-hidden p-5 flex flex-col justify-between space-y-4 shadow-sm hover:shadow-md"
                >
                  <div className="space-y-3">
                    <div className="aspect-[16/9] w-full rounded-xl bg-slate-100 relative overflow-hidden">
                      <img
                        src={getVideoThumbnail(vid)}
                        alt={vid.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center group-hover:bg-black/5 transition-colors">
                        <div className="w-11 h-11 rounded-full bg-white text-[#07111F] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                          <Play className="w-4 h-4 fill-current ml-0.5 text-purple-600" />
                        </div>
                      </div>
                      <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 text-white text-[10px] font-mono font-bold">
                        {vid.duration || '12:00'}
                      </div>
                      <button
                        type="button"
                        id={`bookmark-card-video-${vid.id}`}
                        onClick={(e) => handleToggleVideoBookmark(e, vid.id)}
                        className={`absolute top-2 right-2 p-1.5 rounded-lg backdrop-blur-md transition-all shadow-sm cursor-pointer z-10 ${
                          isBookmarked('video', vid.id)
                            ? 'bg-white text-[#FF6B00] border border-orange-200'
                            : 'bg-black/60 hover:bg-black/80 text-white/80 hover:text-white border border-white/20'
                        }`}
                        title={isBookmarked('video', vid.id) ? 'Remove video from saved' : 'Save video'}
                        aria-label={isBookmarked('video', vid.id) ? 'Remove video from saved' : 'Save video'}
                      >
                        <Bookmark className={`w-3.5 h-3.5 ${isBookmarked('video', vid.id) ? 'fill-[#FF6B00]' : ''}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="text-purple-600 font-bold">{vid.category}</span>
                      <span>{vid.viewsCount || '1.2k views'}</span>
                    </div>

                    <h3 className="font-display font-bold text-slate-900 text-base group-hover:text-purple-600 transition-colors line-clamp-2">
                      {vid.title}
                    </h3>

                    <p className="text-xs text-slate-600 font-interface line-clamp-2">
                      {vid.description}
                    </p>
                  </div>

                  <div className="pt-2 flex items-center gap-1.5 text-xs font-bold text-purple-600 group-hover:text-purple-700 border-t border-slate-100">
                    <span>Watch Breakdown</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Strategic Call to Action */}
      <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-[#07111F] via-[#0B1E3B] to-[#07111F] border border-slate-800 text-center space-y-6 shadow-xl text-white">
        <div className="text-xs font-bold uppercase tracking-widest text-[#FF6B00] font-interface">
          Master Strategic Execution
        </div>
        <h2 className="text-2xl sm:text-4xl font-display font-bold text-white tracking-tight">
          Want Direct Feedback on Your Strategy?
        </h2>
        <p className="text-slate-300 text-sm sm:text-base max-w-xl mx-auto font-interface">
          Explore our in-depth courses or book a focused 30-minute consultation directly with Digital Muid.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <button
            onClick={() => navigate('/learn')}
            className="px-8 py-3.5 rounded-xl bg-white hover:bg-slate-100 text-[#07111F] font-bold text-xs uppercase tracking-widest shadow-xl inline-flex items-center gap-2 cursor-pointer transition-all"
          >
            <span>LEARN WITH DIGITAL MUID</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate('/business-growth-consultation')}
            className="px-8 py-3.5 rounded-xl bg-[#FF6B00] hover:bg-[#e66000] text-white font-bold text-xs uppercase tracking-widest shadow-xl inline-flex items-center gap-2 cursor-pointer transition-all"
          >
            <span>BOOK A CONSULTATION</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
