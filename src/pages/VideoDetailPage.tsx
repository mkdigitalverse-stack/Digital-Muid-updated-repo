import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ArrowLeft, Clock, Eye, Share2, Play, Calendar, ArrowRight, Loader2, Sparkles, Layers, Bookmark } from 'lucide-react';
import { videoService, getYouTubeEmbedUrl, getYouTubeThumbnail } from '../services/videoService';
import { isSupabaseConfigured } from '../lib/supabase';
import { Video } from '../types';
import { findFrameworksForVideo, findContextualVideosForVideo } from '../utils/frameworkRelationships';

interface VideoDetailPageProps {
  slug: string;
  navigate: (path: string) => void;
}

export const VideoDetailPage: React.FC<VideoDetailPageProps> = ({ slug, navigate }) => {
  const {
    videos,
    frameworks,
    notify,
    consultationProduct,
    isAdminAuthenticated,
    currentUser,
    isBookmarked,
    toggleBookmark
  } = useApp();
  const [fetchedVideo, setFetchedVideo] = useState<Video | null>(null);
  const [isFetchingRemote, setIsFetchingRemote] = useState<boolean>(isSupabaseConfigured());
  const [remoteResolved, setRemoteResolved] = useState<boolean>(!isSupabaseConfigured());

  // Authoritatively query Supabase for requested video slug
  useEffect(() => {
    let isMounted = true;

    if (!isSupabaseConfigured()) {
      setIsFetchingRemote(false);
      setRemoteResolved(true);
      return;
    }

    setIsFetchingRemote(true);
    videoService.fetchVideoBySlug(slug).then((res) => {
      if (!isMounted) return;
      if (res.data) {
        setFetchedVideo(res.data);
      } else {
        setFetchedVideo(null);
      }
      setIsFetchingRemote(false);
      setRemoteResolved(true);
    }).catch((err) => {
      if (!isMounted) return;
      console.warn('[Video Detail] Remote query fallback notice:', err);
      setIsFetchingRemote(false);
      setRemoteResolved(true);
    });

    return () => {
      isMounted = false;
    };
  }, [slug]);

  const localVideo = !isSupabaseConfigured() ? videos.find((v) => v.slug === slug) : null;
  const video = isSupabaseConfigured() ? fetchedVideo : (fetchedVideo || localVideo);

  const isAccessible = Boolean(video && (video.status === 'published' || isAdminAuthenticated || (!isSupabaseConfigured() && !video.status)));
  const totalCalculated = (consultationProduct.basePrice * (1 + consultationProduct.gstRate)).toFixed(0);

  if (isFetchingRemote || !remoteResolved) {
    return (
      <div id="video-detail-loading" className="pt-32 pb-24 text-center space-y-4 max-w-xl mx-auto px-4">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin mx-auto" />
        <p className="text-slate-600 text-sm font-interface">Loading video breakdown...</p>
      </div>
    );
  }

  if (!isAccessible || !video) {
    return (
      <div id="video-not-found" className="pt-32 pb-24 text-center space-y-6 max-w-xl mx-auto px-4 sm:px-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold font-interface">
          <Sparkles className="w-3.5 h-3.5 text-purple-600" /> Digital Muid Video Hub
        </div>
        <h1 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 tracking-tight">
          Video Not Found
        </h1>
        <p className="text-slate-600 text-sm sm:text-base font-interface leading-relaxed">
          The video breakdown you are looking for does not exist, has been unpublished, or is currently stored as a draft.
        </p>
        <div className="pt-2">
          <button
            onClick={() => navigate('/watch')}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Watch Hub</span>
          </button>
        </div>
      </div>
    );
  }

  const embedUrl = video.embedUrl || (video.youtubeVideoId ? getYouTubeEmbedUrl(video.youtubeVideoId) : '') || '';
  const thumbnail = video.thumbnailUrl || video.thumbnail || (video.youtubeVideoId ? getYouTubeThumbnail(video.youtubeVideoId) : '') || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80';
  
  // Discover published Frameworks that authoritatively reference this Video
  const connectedFrameworks = findFrameworksForVideo(video, frameworks, isAdminAuthenticated);

  // Discover contextual related videos (prioritizing videos in the same framework)
  const relatedVideos = findContextualVideosForVideo(video, frameworks, videos, 3, isAdminAuthenticated);

  const isVideoBookmarked = isBookmarked('video', video.id);

  const handleToggleBookmark = async () => {
    if (!currentUser) {
      notify('Please sign in to save video breakdowns to your personal library.', 'info');
      navigate('/login');
      return;
    }
    await toggleBookmark('video', video.id);
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      notify('Video breakdown link copied!', 'success');
    }
  };

  // Schema.org VideoObject JSON-LD
  const schemaJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: video.seoTitle || video.title,
    description: video.seoDescription || video.description,
    thumbnailUrl: [thumbnail],
    uploadDate: video.publishedAt || video.createdAt || new Date().toISOString(),
    duration: video.duration ? `PT${video.duration.replace(':', 'M')}S` : 'PT12M00S',
    embedUrl: embedUrl,
    publisher: {
      '@type': 'Organization',
      name: 'Digital Muid',
      logo: {
        '@type': 'ImageObject',
        url: 'https://digitalmuid.com/logo.png'
      }
    }
  };

  return (
    <div id="video-detail-root" className="pt-28 sm:pt-32 pb-24 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
      {/* VideoObject Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaJsonLd) }}
      />

      {/* Back Button */}
      <button
        onClick={() => navigate('/watch')}
        className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Watch Hub</span>
      </button>

      {/* Admin Draft Banner (visible to admin if draft) */}
      {video.status === 'draft' && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold flex items-center justify-between">
          <span>⚠️ This video is currently saved as an unpublished <strong>Draft</strong>. Only authenticated administrators can preview this page.</span>
          <button
            onClick={() => navigate('/admin')}
            className="px-3 py-1 bg-amber-200 text-amber-900 rounded-lg font-bold hover:bg-amber-300 transition-colors cursor-pointer"
          >
            Open in CMS
          </button>
        </div>
      )}

      {/* Video Player Embed / Responsive Container */}
      <div className="space-y-6">
        <div className="aspect-[16/9] w-full rounded-3xl overflow-hidden bg-black border border-slate-800 shadow-2xl relative">
          {embedUrl ? (
            <iframe
              src={embedUrl}
              title={video.title}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center space-y-2">
              <Play className="w-12 h-12 text-slate-600" />
              <p className="text-sm">Video stream embed URL not configured.</p>
            </div>
          )}
        </div>

        {/* Video Title & Meta Bar */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-full bg-purple-50 text-purple-700 font-bold text-xs uppercase tracking-wider border border-purple-200">
                {video.category}
              </span>
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> {video.duration || '12:00'}
              </span>
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" /> {video.viewsCount || '1.2k views'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                id={`bookmark-video-${video.id}`}
                type="button"
                onClick={handleToggleBookmark}
                className={`p-2 px-3 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm ${
                  isVideoBookmarked
                    ? 'bg-orange-50 border-orange-200 text-[#FF6B00] hover:bg-orange-100'
                    : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700 hover:text-slate-900'
                }`}
                title={isVideoBookmarked ? 'Saved to bookmarks' : 'Save video'}
              >
                <Bookmark className={`w-4 h-4 ${isVideoBookmarked ? 'fill-[#FF6B00]' : ''}`} />
                <span>{isVideoBookmarked ? 'Saved' : 'Save'}</span>
              </button>

              <button
                id={`share-video-${video.id}`}
                type="button"
                onClick={handleShare}
                className="p-2 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 hover:text-slate-900 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <Share2 className="w-4 h-4" />
                <span>Share Video</span>
              </button>
            </div>
          </div>

          <h1 className="text-2xl sm:text-4xl font-display font-bold text-slate-900 tracking-tight">
            {video.title}
          </h1>

          <p className="text-slate-600 text-base font-interface leading-relaxed">
            {video.description}
          </p>
        </div>
      </div>

      {/* Tags */}
      {video.tags && video.tags.length > 0 && (
        <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-600 font-bold mr-2">Key Focus Areas:</span>
          {video.tags.map((t) => (
            <span key={t} className="text-xs px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold shadow-xs">
              #{t}
            </span>
          ))}
        </div>
      )}

      {/* Contextual Strategic Framework Presentation */}
      {connectedFrameworks.length > 0 && (
        <div className="space-y-4 pt-4">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-purple-100 text-purple-700">
              <Layers className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-purple-700 font-mono">
              Explore the Strategic Framework
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {connectedFrameworks.map((fw) => {
              const stageCount = fw.frameworkContent?.length || 0;
              return (
                <div
                  key={fw.id || fw.slug}
                  onClick={() => {
                    navigate(`/frameworks/${fw.slug}`);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-[#1A122E] to-slate-900 border border-purple-500/30 text-white hover:border-purple-400 transition-all cursor-pointer group shadow-xl relative overflow-hidden"
                >
                  <div className="relative z-10 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-md bg-purple-500/20 text-purple-300 text-[11px] font-mono font-bold uppercase tracking-wider border border-purple-500/30">
                          {fw.category || 'Strategic Framework'}
                        </span>
                        {stageCount > 0 && (
                          <span className="text-xs text-slate-300 font-mono">
                            · {stageCount} Execution Stages
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-bold text-purple-300 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                        View Framework <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <h3 className="text-xl sm:text-2xl font-display font-bold text-white group-hover:text-purple-200 transition-colors">
                        {fw.title}
                      </h3>
                      {(fw.subtitle || fw.description) && (
                        <p className="text-sm text-slate-300 font-interface leading-relaxed line-clamp-2">
                          {fw.subtitle || fw.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Consultation Banner */}
      <div className="p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-[#1A122E] to-slate-900 border border-purple-500/30 text-center space-y-6 shadow-xl">
        <h3 className="text-2xl font-display font-bold text-white">
          Need Custom Guidance on This Framework?
        </h3>
        <p className="text-slate-300 text-sm max-w-lg mx-auto">
          Book a 1-on-1 strategic consultation with Digital Muid to unpack your specific operational roadmap.
        </p>
        <button
          onClick={() => navigate('/consultation')}
          className="px-6 py-3 rounded-xl bg-[#FF6B00] hover:bg-[#FF7A1A] text-white font-bold text-sm inline-flex items-center gap-2 shadow-lg shadow-[#FF6B00]/30 transition-all cursor-pointer"
        >
          <Calendar className="w-4 h-4" />
          <span>Book Consultation (₹{totalCalculated})</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Related Videos */}
      {relatedVideos.length > 0 && (
        <div className="space-y-6 pt-6">
          <h3 className="text-xl font-display font-bold text-slate-900">More Video Breakdowns</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {relatedVideos.map((rel) => {
              const relThumb = rel.thumbnailUrl || rel.thumbnail || (rel.youtubeVideoId ? getYouTubeThumbnail(rel.youtubeVideoId) : '') || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80';
              return (
                <div
                  key={rel.id}
                  onClick={() => {
                    navigate(`/watch/${rel.slug}`);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-purple-300 cursor-pointer space-y-3 group shadow-sm hover:shadow-md transition-all"
                >
                  <div className="aspect-[16/9] w-full rounded-xl bg-slate-100 overflow-hidden relative">
                    <img
                      src={relThumb}
                      alt={rel.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-white text-[10px] font-mono font-bold">
                      {rel.duration || '12:00'}
                    </div>
                  </div>
                  <h4 className="text-sm font-display font-bold text-slate-900 group-hover:text-purple-600 transition-colors line-clamp-2">
                    {rel.title}
                  </h4>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

