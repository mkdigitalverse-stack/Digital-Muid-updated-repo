import React, { useEffect, useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { resourceService } from '../services/resourceService';
import { analytics } from '../utils/analytics';
import { Resource } from '../types';
import {
  CheckCircle2,
  Download,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Lock,
  AlertCircle,
  Loader2,
  LayoutDashboard,
  GraduationCap,
  Layers
} from 'lucide-react';

interface PaidResourceThankYouPageProps {
  navigate: (path: string) => void;
}

export const PaidResourceThankYouPage: React.FC<PaidResourceThankYouPageProps> = ({ navigate }) => {
  const { resources, hasPurchasedResource, notify, currentUser } = useApp();

  const [queryParams, setQueryParams] = useState<{
    resourceId: string | null;
    orderId: string | null;
    paymentId: string | null;
    amount: string | null;
  }>(() => {
    if (typeof window === 'undefined') {
      return { resourceId: null, orderId: null, paymentId: null, amount: null };
    }
    const searchParams = new URLSearchParams(window.location.search);
    return {
      resourceId: searchParams.get('resourceId') || searchParams.get('id') || searchParams.get('slug'),
      orderId: searchParams.get('orderId') || searchParams.get('order_id'),
      paymentId: searchParams.get('paymentId') || searchParams.get('payment_id'),
      amount: searchParams.get('amount')
    };
  });

  const [matchedResource, setMatchedResource] = useState<Resource | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isVerifying, setIsVerifying] = useState<boolean>(true);
  const [isServerVerified, setIsServerVerified] = useState<boolean | null>(null);
  const [verifiedDetails, setVerifiedDetails] = useState<{
    amount?: number;
    currency?: string;
    orderId?: string;
    paymentId?: string;
  } | null>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);
  const conversionTrackedRef = useRef<boolean>(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const resId = searchParams.get('resourceId') || searchParams.get('id') || searchParams.get('slug');
    const ordId = searchParams.get('orderId') || searchParams.get('order_id');
    const payId = searchParams.get('paymentId') || searchParams.get('payment_id');
    const amt = searchParams.get('amount');

    setQueryParams({
      resourceId: resId,
      orderId: ordId,
      paymentId: payId,
      amount: amt
    });

    if (!resId) {
      setIsLoading(false);
      setIsVerifying(false);
      return;
    }

    const found = resources.find(r => r.id === resId || r.slug === resId);
    if (found) {
      setMatchedResource(found);
      setIsLoading(false);
    } else {
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

  // Server-authoritative purchase status verification (Never trust raw query parameters)
  useEffect(() => {
    if (!matchedResource) return;

    let isMounted = true;
    setIsVerifying(true);

    const checkVerification = async () => {
      // 1. If user already owns this resource in student ledger, pass immediately
      if (hasPurchasedResource(matchedResource.id)) {
        if (isMounted) {
          setIsServerVerified(true);
          setIsVerifying(false);
        }
        return;
      }

      // 2. If no paymentId provided and user doesn't own it, reject
      if (!queryParams.paymentId && !queryParams.orderId) {
        if (isMounted) {
          setIsServerVerified(false);
          setIsVerifying(false);
        }
        return;
      }

      // 3. Query server endpoint for cryptographic & database verification
      try {
        const query = new URLSearchParams({
          resourceId: matchedResource.id,
          ...(queryParams.orderId ? { orderId: queryParams.orderId } : {}),
          ...(queryParams.paymentId ? { paymentId: queryParams.paymentId } : {})
        });

        const resp = await fetch(`/api/payments/verify-purchase-status?${query.toString()}`);
        const data = await resp.json();

        if (isMounted) {
          if (resp.ok && data.success && data.verified === true) {
            setIsServerVerified(true);
            setVerifiedDetails({
              amount: data.amount,
              currency: data.currency,
              orderId: data.orderId,
              paymentId: data.paymentId
            });
          } else {
            console.warn('[Paid Thank You] Server rejected payment verification:', data.message || data.error);
            setIsServerVerified(false);
          }
          setIsVerifying(false);
        }
      } catch (err) {
        console.error('[Paid Thank You] Failed to verify purchase status with server:', err);
        if (isMounted) {
          setIsServerVerified(false);
          setIsVerifying(false);
        }
      }
    };

    checkVerification();

    return () => {
      isMounted = false;
    };
  }, [matchedResource, queryParams.orderId, queryParams.paymentId, hasPurchasedResource]);

  // Determine if purchase is authoritatively verified
  const isVerifiedPurchase = Boolean(
    matchedResource && (
      isServerVerified === true ||
      hasPurchasedResource(matchedResource.id)
    )
  );

  // Track paid_resource_purchase_conversion ONLY after server verification
  useEffect(() => {
    if (!matchedResource || !isVerifiedPurchase || isVerifying || conversionTrackedRef.current) return;

    const effectiveOrderId = verifiedDetails?.orderId || queryParams.orderId || `order_${matchedResource.id}`;
    const effectivePaymentId = verifiedDetails?.paymentId || queryParams.paymentId || `pay_${Date.now()}`;
    const effectiveAmount = verifiedDetails?.amount ?? (queryParams.amount ? Number(queryParams.amount) : (matchedResource.price || 0));

    const dedupKey = `tracked_paid_conv_${effectiveOrderId}_${effectivePaymentId}`;
    const alreadyTracked = typeof window !== 'undefined' && window.sessionStorage.getItem(dedupKey);

    if (!alreadyTracked) {
      analytics.trackPaidResourcePurchase({
        resourceId: matchedResource.id,
        resourceTitle: matchedResource.title || matchedResource.name || 'Digital Resource Toolkit',
        orderId: effectiveOrderId,
        paymentId: effectivePaymentId,
        amount: effectiveAmount,
        currency: verifiedDetails?.currency || matchedResource.currency || 'INR'
      });

      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(dedupKey, 'true');
      }
      conversionTrackedRef.current = true;
    }
  }, [matchedResource, isVerifiedPurchase, isVerifying, queryParams, verifiedDetails]);

  const handleDownload = async () => {
    if (!matchedResource || !isVerifiedPurchase) return;
    setIsDownloading(true);
    setDownloadError(null);

    try {
      const isBundle = matchedResource.id === '2d50e5e3-711d-4461-a70d-0ed54dd29f17' || matchedResource.slug === 'meta-ads-campaign-planner-bundle';
      if (isBundle) {
        navigate(`/resources/bundle/meta-ads-campaign-planner-bundle?orderId=${encodeURIComponent(verifiedDetails?.orderId || queryParams.orderId || '')}&paymentId=${encodeURIComponent(verifiedDetails?.paymentId || queryParams.paymentId || '')}`);
        return;
      }

      analytics.trackPaidResourceDownload({
        resourceId: matchedResource.id,
        resourceTitle: matchedResource.title || matchedResource.name || 'Digital Resource Toolkit',
        orderId: verifiedDetails?.orderId || queryParams.orderId || undefined
      });

      const delivery = await resourceService.deliverResource(matchedResource, {
        isAuthorized: true,
        orderId: verifiedDetails?.orderId || queryParams.orderId || undefined,
        paymentId: verifiedDetails?.paymentId || queryParams.paymentId || undefined
      });

      if ((delivery as any).isBundle) {
        navigate((delivery as any).bundleUrl || '/resources/bundle/meta-ads-campaign-planner-bundle');
        return;
      }

      if (delivery.success) {
        setDownloadSuccess(true);
        notify(`Downloading ${matchedResource.title || 'resource'}...`, 'success');
      } else {
        setDownloadError(delivery.error || "Unable to initiate download. Please try again.");
        notify(delivery.error || "Download delivery error", 'error');
      }
    } catch (err: any) {
      console.error('[PaidResourceThankYou] Download error:', err);
      setDownloadError("An unexpected error occurred while preparing your download.");
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading || isVerifying) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#FF6B00] mx-auto" />
          <p className="text-sm text-slate-600 font-medium">Verifying your payment record...</p>
        </div>
      </div>
    );
  }

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
              We couldn't locate the resource for this transaction. If you recently completed a payment, please access your downloads in your student dashboard.
            </p>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full py-3.5 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <span>Go to Student Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // If transaction is not verified, do not allow download or count conversion
  if (!isVerifiedPurchase) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-16 bg-slate-50">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-rose-200 shadow-sm text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto text-rose-600">
            <Lock className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-display font-bold text-slate-900">Unverified Payment</h1>
            <p className="text-xs text-slate-600 leading-relaxed">
              We couldn't verify an active payment transaction for <strong className="text-slate-800">{matchedResource.title || matchedResource.name}</strong>. Paid resources require verified server confirmation before access is granted.
            </p>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={() => navigate('/resources')}
              className="w-full py-3 px-6 rounded-xl bg-[#FF6B00] hover:bg-[#FF7A1A] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <span>Return to Resources</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full py-3 px-6 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <span>Check Student Purchases</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const displayAmount = verifiedDetails?.amount ?? (queryParams.amount ? Number(queryParams.amount) : (matchedResource.price || 0));
  const displayCurrency = verifiedDetails?.currency || matchedResource.currency || 'INR';
  const displayOrderId = verifiedDetails?.orderId || queryParams.orderId || 'VERIFIED-ORDER';
  const displayPaymentId = verifiedDetails?.paymentId || queryParams.paymentId || 'Verified Gateway';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-12 sm:py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Verified Order Receipt Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/90 shadow-sm space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold tracking-wide uppercase">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Payment Verified · Lifetime Access Activated</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500">
              <CreditCard className="w-3.5 h-3.5 text-slate-400" />
              <span>Ref: {displayOrderId}</span>
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="text-3xl sm:text-4xl font-display font-bold text-slate-950 tracking-tight">
              Thank you for your purchase.
            </h1>
            <p className="text-sm sm:text-base text-slate-600 max-w-2xl leading-relaxed">
              Your payment of <strong className="text-slate-900 font-semibold">₹{displayAmount} {displayCurrency}</strong> has been confirmed by Razorpay. Your asset is unlocked and permanently saved to your account.
            </p>
          </div>

          {/* Payment Summary Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Amount Paid</span>
              <span className="font-bold text-slate-900 text-base">₹{displayAmount} {displayCurrency}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Payment Status</span>
              <span className="font-bold text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Captured
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Payment ID</span>
              <span className="font-mono text-slate-700 truncate block max-w-[140px]">
                {displayPaymentId}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">License Type</span>
              <span className="font-bold text-slate-900">Lifetime Access</span>
            </div>
          </div>

          {/* Resource Action Box */}
          <div className="p-6 rounded-2xl bg-slate-50/80 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <div className="flex items-center gap-2 text-xs font-mono text-[#FF6B00] font-semibold uppercase">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{matchedResource.resourceType || matchedResource.type || 'Premium Asset'}</span>
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
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-[#FF6B00] hover:bg-[#FF7A1A] text-white font-bold text-sm tracking-wide shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Preparing Asset...</span>
                  </>
                ) : (matchedResource.id === '2d50e5e3-711d-4461-a70d-0ed54dd29f17' || matchedResource.slug === 'meta-ads-campaign-planner-bundle') ? (
                  <>
                    <Layers className="w-4 h-4" />
                    <span>Access 4 Bundle Deliverables</span>
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
                <span>Authorized secure delivery</span>
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
              <span>Your file has been delivered! You can also redownload this asset anytime from your student dashboard.</span>
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2">
            <span>This purchase is permanently linked to your student account ledger.</span>
            <button
              onClick={() => navigate('/dashboard')}
              className="text-[#FF6B00] hover:text-orange-700 font-semibold cursor-pointer text-left"
            >
              Open Student LMS Dashboard →
            </button>
          </div>
        </div>

        {/* Action Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs space-y-4">
            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-display font-bold text-slate-900">Student Dashboard</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                View your complete purchase history, access enrolled courses, and download past toolkit files at any time.
              </p>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="pt-2 inline-flex items-center gap-1.5 text-xs font-bold text-slate-900 hover:text-slate-700 cursor-pointer"
            >
              <span>Go to My Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs space-y-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-display font-bold text-slate-900">Explore Academy Curriculums</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Combine your toolkits with deep-dive courses in performance marketing, AI systems, and digital strategy.
              </p>
            </div>
            <button
              onClick={() => navigate('/academy')}
              className="pt-2 inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
            >
              <span>Explore Programs</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
