import React, { useEffect, useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { resourceService } from '../services/resourceService';
import { analytics } from '../utils/analytics';
import { Resource } from '../types';
import {
  CheckCircle2,
  Download,
  ArrowRight,
  BookOpen,
  Sparkles,
  ShieldCheck,
  FileText,
  AlertCircle,
  Loader2,
  ExternalLink,
  GraduationCap
} from 'lucide-react';

interface FreeResourceThankYouPageProps {
  navigate: (path: string) => void;
}

export const FreeResourceThankYouPage: React.FC<FreeResourceThankYouPageProps> = ({ navigate }) => {
  const { resources, hasUnlockedFreeResource, notify } = useApp();

  // Parse URL query params
  const [params, setParams] = useState<{ resourceId: string | null; submissionId: string | null }>(() => {
    if (typeof window === 'undefined') return { resourceId: null, submissionId: null };
    const searchParams = new URLSearchParams(window.location.search);
    return {
      resourceId: searchParams.get('resourceId') || searchParams.get('id') || searchParams.get('slug'),
      submissionId: searchParams.get('submissionId') || searchParams.get('leadId')
    };
  });

  const [matchedResource, setMatchedResource] = useState<Resource | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);
  const conversionTrackedRef = useRef<boolean>(false);

  // Identify resource and verify lead authorization
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const resId = searchParams.get('resourceId') || searchParams.get('id') || searchParams.get('slug');
    const subId = searchParams.get('submissionId') || searchParams.get('leadId');

    setParams({ resourceId: resId, submissionId: subId });

    if (!resId) {
      setIsLoading(false);
      return;
    }

    const found = resources.find(r => r.id === resId || r.slug === resId);
    if (found) {
      setMatchedResource(found);
      setIsLoading(false);
    } else {
      // Attempt async fetch by slug or ID
      resourceService.fetchResourceBySlug(resId).then(res => {
        if (res.data) {
          setMatchedResource(res.data);
        }
        setIsLoading(false);
      }).catch(() => {
        setIsLoading(false);
      });
    }
  }, [resources]);

  // Track free_resource_lead_conversion on mount once verified
  useEffect(() => {
    if (!matchedResource || conversionTrackedRef.current) return;

    // Verify lead status
    const unlockStatus = hasUnlockedFreeResource(matchedResource.id);
    const effectiveSubmissionId = params.submissionId || unlockStatus.submissionId;

    if (effectiveSubmissionId) {
      const dedupKey = `tracked_lead_conv_${effectiveSubmissionId}_${matchedResource.id}`;
      const alreadyTracked = typeof window !== 'undefined' && window.sessionStorage.getItem(dedupKey);

      if (!alreadyTracked) {
        analytics.trackFreeResourceLeadConversion({
          resourceId: matchedResource.id,
          resourceTitle: matchedResource.title || matchedResource.name || 'Digital Resource',
          submissionId: effectiveSubmissionId,
          resourceType: matchedResource.resourceType || matchedResource.type || 'guide',
          sourcePage: '/resources'
        });

        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(dedupKey, 'true');
        }
        conversionTrackedRef.current = true;
      }
    }
  }, [matchedResource, params.submissionId, hasUnlockedFreeResource]);

  const handleDownload = async () => {
    if (!matchedResource) return;
    setIsDownloading(true);
    setDownloadError(null);

    try {
      // Fire free_resource_download analytics event
      analytics.trackFreeResourceDownload({
        resourceId: matchedResource.id,
        resourceTitle: matchedResource.title || matchedResource.name || 'Digital Resource',
        fileType: matchedResource.fileType || matchedResource.format || 'pdf'
      });

      const delivery = await resourceService.deliverResource(matchedResource, { isAuthorized: true });
      if (delivery.success) {
        setDownloadSuccess(true);
        notify(`Downloading ${matchedResource.title || 'resource'}...`, 'success');
      } else {
        setDownloadError(delivery.error || "Unable to initiate download. Please try again.");
        notify(delivery.error || "Download delivery error", 'error');
      }
    } catch (err: any) {
      console.error('[FreeResourceThankYou] Download error:', err);
      setDownloadError("An unexpected error occurred while preparing your download.");
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500 mx-auto" />
          <p className="text-sm text-slate-600 font-medium">Verifying your free access pass...</p>
        </div>
      </div>
    );
  }

  // Fallback if no valid resource found
  if (!matchedResource) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-16 bg-slate-50">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-sm text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-600">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-display font-bold text-slate-900">Resource Not Found</h1>
            <p className="text-xs text-slate-600 leading-relaxed">
              We couldn't locate the specific resource associated with this link. Please choose a toolkit or framework from our library.
            </p>
          </div>
          <button
            onClick={() => navigate('/resources')}
            className="w-full py-3.5 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <span>Browse Resource Library</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  const unlockInfo = hasUnlockedFreeResource(matchedResource.id);
  const hasAccessPass = Boolean(params.submissionId || unlockInfo.isUnlocked);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-12 sm:py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Success Header Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/90 shadow-sm space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold tracking-wide uppercase">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Enquiry Confirmed · Free Access Unlocked</span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              ID: {params.submissionId ? params.submissionId.slice(0, 18) : unlockInfo.submissionId?.slice(0, 18) || 'VERIFIED-LEAD'}
            </span>
          </div>

          <div className="space-y-4">
            <h1 className="text-3xl sm:text-4xl font-display font-bold text-slate-950 tracking-tight">
              Your free download is ready.
            </h1>
            <p className="text-sm sm:text-base text-slate-600 max-w-2xl leading-relaxed">
              Thank you for requesting this resource. Your details have been registered in our system, and your instant access pass is verified below.
            </p>
          </div>

          {/* Resource Details Box */}
          <div className="p-6 rounded-2xl bg-slate-50/80 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <div className="flex items-center gap-2 text-xs font-mono text-amber-700 font-semibold uppercase">
                <FileText className="w-3.5 h-3.5" />
                <span>{matchedResource.resourceType || matchedResource.type || 'Free Toolkit'}</span>
                {matchedResource.fileType && <span>• {matchedResource.fileType}</span>}
                {matchedResource.fileSize && <span>• {matchedResource.fileSize}</span>}
              </div>
              <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900">
                {matchedResource.title || matchedResource.name}
              </h2>
              {matchedResource.description && (
                <p className="text-xs sm:text-sm text-slate-600 line-clamp-2 leading-relaxed">
                  {matchedResource.description}
                </p>
              )}
            </div>

            <div className="shrink-0 flex flex-col items-stretch sm:items-end gap-2">
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="w-full sm:w-auto px-7 py-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm tracking-wide shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Preparing Download...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>{downloadSuccess ? 'Download Again' : 'Download Resource Now'}</span>
                  </>
                )}
              </button>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 justify-center sm:justify-end">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Instant verified access • Lifetime free</span>
              </div>
            </div>
          </div>

          {downloadError && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{downloadError}</span>
            </div>
          )}

          {downloadSuccess && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Your file has been delivered! If your download didn't start automatically, click the button above again.</span>
            </div>
          )}

          {/* Returning visitor reminder */}
          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2">
            <span>Bookmark this link to re-download anytime without re-submitting your enquiry.</span>
            <button
              onClick={() => navigate('/resources')}
              className="text-amber-700 hover:text-amber-800 font-semibold cursor-pointer text-left"
            >
              Browse all free &amp; premium resources →
            </button>
          </div>
        </div>

        {/* Next Steps & Academy Upsell */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs space-y-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-display font-bold text-slate-900">Digital MUID Academy</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Take your skills further with structured curriculums, live case studies, and execution playbooks taught by practitioners.
              </p>
            </div>
            <button
              onClick={() => navigate('/academy')}
              className="pt-2 inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
            >
              <span>Explore Academy Programs</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs space-y-4">
            <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-[#FF6B00]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-display font-bold text-slate-900">Strategic Consultation</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Need bespoke guidance on your unit economics, acquisition funnels, or marketing systems? Book a direct session.
              </p>
            </div>
            <button
              onClick={() => navigate('/business-growth-consultation')}
              className="pt-2 inline-flex items-center gap-1.5 text-xs font-bold text-[#FF6B00] hover:text-orange-700 cursor-pointer"
            >
              <span>Book Growth Consultation</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
