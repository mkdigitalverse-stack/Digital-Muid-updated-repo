import React, { useEffect, useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { resourceService } from '../services/resourceService';
import { paymentService } from '../services/paymentService';
import { loadRazorpayCheckoutScript, getClientRazorpayKeyId } from '../lib/razorpay';
import { analytics } from '../utils/analytics';
import {
  ShieldCheck,
  Download,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  ExternalLink,
  Sparkles,
  CreditCard
} from 'lucide-react';

interface BundleFileItem {
  id: string;
  slug: string;
  title: string;
  description?: string;
  format?: string;
  fileSize?: string;
  filename: string;
  downloadUrl: string | null;
}

interface BundleAccessPageProps {
  navigate: (path: string) => void;
  slug?: string;
}

export const BundleAccessPage: React.FC<BundleAccessPageProps> = ({ navigate }) => {
  const { resources, hasPurchasedResource, purchaseResource, notify, currentUser, userProfile } = useApp();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [bundleFiles, setBundleFiles] = useState<BundleFileItem[]>([]);
  const [activeDownloadingId, setActiveDownloadingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Checkout modal state for unauthorized visitors
  const [showCheckoutModal, setShowCheckoutModal] = useState<boolean>(false);
  const [checkoutName, setCheckoutName] = useState<string>('');
  const [checkoutEmail, setCheckoutEmail] = useState<string>('');
  const [checkoutPhone, setCheckoutPhone] = useState<string>('');
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const conversionTrackedRef = useRef<boolean>(false);

  // Parse query params (paymentId / orderId if redirected from checkout)
  const [urlParams] = useState<{ orderId: string | null; paymentId: string | null; checkout: boolean }>(() => {
    if (typeof window === 'undefined') return { orderId: null, paymentId: null, checkout: false };
    const sp = new URLSearchParams(window.location.search);
    return {
      orderId: sp.get('orderId') || sp.get('order_id'),
      paymentId: sp.get('paymentId') || sp.get('payment_id'),
      checkout: sp.get('checkout') === 'true' || sp.get('buy') === 'true'
    };
  });

  const bundleResource = resources.find(
    (r) => r.id === '2d50e5e3-711d-4461-a70d-0ed54dd29f17' || r.slug === 'meta-ads-campaign-planner-bundle'
  );

  const verifyAndLoadBundle = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await resourceService.fetchBundleFiles('2d50e5e3-711d-4461-a70d-0ed54dd29f17', {
        orderId: urlParams.orderId || undefined,
        paymentId: urlParams.paymentId || undefined
      });

      if (res.success && res.authorized && res.files) {
        setIsAuthorized(true);
        setBundleFiles(res.files);

        // Track conversion if arriving from a verified checkout
        if (urlParams.paymentId && !conversionTrackedRef.current) {
          analytics.trackPaidResourcePurchase({
            resourceId: '2d50e5e3-711d-4461-a70d-0ed54dd29f17',
            resourceTitle: 'Meta Ads Campaign Planner Bundle',
            orderId: urlParams.orderId || `order_${Date.now()}`,
            paymentId: urlParams.paymentId,
            amount: 299,
            currency: 'INR'
          });
          conversionTrackedRef.current = true;
        }
      } else {
        setIsAuthorized(false);
        setBundleFiles([]);
      }
    } catch (err: any) {
      console.error('[BundleAccessPage] Error checking access:', err);
      setIsAuthorized(false);
      setErrorMessage(err?.message || 'Failed to verify bundle access permissions.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    verifyAndLoadBundle();
  }, [currentUser, urlParams.orderId, urlParams.paymentId]);

  // If visitor navigated with intent to buy (?checkout=true), open checkout modal
  useEffect(() => {
    if (urlParams.checkout && isAuthorized === false && !isLoading) {
      setCheckoutName(userProfile?.fullName || '');
      setCheckoutEmail(currentUser?.email || '');
      setCheckoutPhone(userProfile?.phone || '');
      setShowCheckoutModal(true);
    }
  }, [urlParams.checkout, isAuthorized, isLoading, userProfile, currentUser]);

  const handleDownloadFile = async (file: BundleFileItem) => {
    if (!file.downloadUrl) {
      notify('Download URL not ready. Refreshing access...', 'error');
      await verifyAndLoadBundle();
      return;
    }

    setActiveDownloadingId(file.id);
    try {
      analytics.trackPaidResourceDownload({
        resourceId: file.id,
        resourceTitle: file.title,
        orderId: urlParams.orderId || undefined
      });

      // Attempt blob download for seamless direct save, fallback to anchor
      try {
        const resp = await fetch(file.downloadUrl, { mode: 'cors' });
        if (resp.ok) {
          const blob = await resp.blob();
          const blobUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = file.filename || `${file.slug}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
          notify(`Downloaded: ${file.title}`, 'success');
          return;
        }
      } catch {
        // Fallback to direct link download
      }

      // Secure browser download using verified short-lived signed URL
      const link = document.createElement('a');
      link.href = file.downloadUrl;
      link.setAttribute('download', file.filename || `${file.slug}.pdf`);
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      notify(`Initiated download: ${file.title}`, 'success');
    } catch (err) {
      console.error('[BundleAccessPage] Download initiation failed:', err);
      notify('Failed to trigger file download. Please try again.', 'error');
    } finally {
      setActiveDownloadingId(null);
    }
  };

  const handleOpenBuyModal = () => {
    setCheckoutName(userProfile?.fullName || '');
    setCheckoutEmail(currentUser?.email || '');
    setCheckoutPhone(userProfile?.phone || '');
    setCheckoutError(null);
    setShowCheckoutModal(true);
  };

  const handleProcessBundlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutEmail.trim() || !checkoutEmail.includes('@')) {
      setCheckoutError('Please enter a valid email address.');
      return;
    }
    if (!checkoutName.trim()) {
      setCheckoutError('Please enter your full name.');
      return;
    }

    setIsProcessingPayment(true);
    setCheckoutError(null);

    try {
      const orderResult = await paymentService.createResourceOrder(
        '2d50e5e3-711d-4461-a70d-0ed54dd29f17',
        {
          name: checkoutName.trim(),
          email: checkoutEmail.trim(),
          phone: checkoutPhone.trim()
        },
        {
          accessType: 'paid',
          price: 299
        }
      );

      if (!orderResult.success || !orderResult.orderId) {
        throw new Error(orderResult.error || 'Failed to create payment order.');
      }

      const scriptLoaded = await loadRazorpayCheckoutScript();
      const clientKey = orderResult.keyId || getClientRazorpayKeyId();

      if (!scriptLoaded || typeof window.Razorpay !== 'function' || !clientKey) {
        throw new Error('Payment gateway failed to initialize. Please check connection.');
      }

      const options = {
        key: clientKey,
        order_id: orderResult.orderId,
        amount: orderResult.amount,
        currency: orderResult.currency || 'INR',
        name: 'Digital MUID',
        description: 'Meta Ads Campaign Planner Bundle (4 Tools)',
        prefill: {
          name: checkoutName.trim(),
          email: checkoutEmail.trim(),
          contact: checkoutPhone.trim()
        },
        theme: { color: '#FF6B00' },
        handler: async (response: any) => {
          setIsProcessingPayment(true);
          try {
            const verifyResult = await paymentService.verifyResourcePayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              resourceId: '2d50e5e3-711d-4461-a70d-0ed54dd29f17',
              customerDetails: {
                name: checkoutName.trim(),
                email: checkoutEmail.trim(),
                phone: checkoutPhone.trim()
              }
            });

            if (!verifyResult.success || !verifyResult.verified) {
              throw new Error(verifyResult.error || 'Cryptographic verification failed.');
            }

            const targetBundle = bundleResource || {
              id: '2d50e5e3-711d-4461-a70d-0ed54dd29f17',
              slug: 'meta-ads-campaign-planner-bundle',
              title: 'Meta Ads Campaign Planner Bundle',
              accessType: 'paid',
              price: 299,
              currency: 'INR'
            } as any;
            await purchaseResource(targetBundle, response.razorpay_payment_id, response.razorpay_order_id);

            try {
              if (typeof window !== 'undefined' && window.sessionStorage) {
                window.sessionStorage.setItem('verified_guest_purchase_2d50e5e3-711d-4461-a70d-0ed54dd29f17', response.razorpay_payment_id);
                window.sessionStorage.setItem('verified_guest_purchase_meta-ads-campaign-planner-bundle', response.razorpay_payment_id);
              }
            } catch {}

            setShowCheckoutModal(false);
            notify('Payment verified! Complete bundle unlocked.', 'success');

            // Reload bundle files with new payment token
            const freshFiles = await resourceService.fetchBundleFiles('2d50e5e3-711d-4461-a70d-0ed54dd29f17', {
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id
            });

            if (freshFiles.success && freshFiles.files) {
              setIsAuthorized(true);
              setBundleFiles(freshFiles.files);
            }
          } catch (vErr: any) {
            console.error('[Bundle Payment Verification Error]:', vErr);
            setCheckoutError(vErr?.message || 'Verification failed on server.');
          } finally {
            setIsProcessingPayment(false);
          }
        },
        modal: {
          ondismiss: () => {
            setIsProcessingPayment(false);
          }
        }
      };

      const rzpInstance = new (window as any).Razorpay(options);
      rzpInstance.on('payment.failed', (resp: any) => {
        setIsProcessingPayment(false);
        const failMsg = resp.error?.description || 'Payment was declined or cancelled.';
        setCheckoutError(failMsg);
        notify(failMsg, 'error');
      });
      rzpInstance.open();
    } catch (pErr: any) {
      console.error('[Bundle Checkout Error]:', pErr);
      setCheckoutError(pErr?.message || 'Failed to start payment checkout.');
      setIsProcessingPayment(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <Loader2 className="w-9 h-9 animate-spin text-[#FF6B00] mx-auto" />
          <p className="text-sm font-medium text-slate-600">Verifying your bundle purchase credentials...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <button
            onClick={() => navigate('/resources')}
            className="hover:text-slate-900 transition-colors cursor-pointer"
          >
            Resources
          </button>
          <span>/</span>
          <span className="text-slate-800 font-medium">Meta Ads Campaign Planner Bundle</span>
        </div>

        {/* Header Hero Banner */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-xs font-semibold text-amber-800">
              <Sparkles className="w-3.5 h-3.5 text-[#FF6B00]" />
              Official Executive Bundle · 4 Digital Assets
            </div>

            {isAuthorized ? (
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-xs font-semibold text-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Access Authorized & Verified
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 border border-slate-200 rounded-full text-xs font-semibold text-slate-700">
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                Purchase Required
              </div>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Meta Ads Campaign Planner Bundle
          </h1>
          <p className="text-slate-600 max-w-3xl leading-relaxed text-sm sm:text-base">
            The complete 4-part operating system to plan, calculate, launch, and track profitable Facebook & Instagram
            ad campaigns. Zero theoretical fluff—strictly execution-ready frameworks, diagnostic checklists, and unit
            economics models.
          </p>
        </div>

        {/* UNAUTHORIZED STATE: Clear Payment-Required Notice & Instant Checkout */}
        {!isAuthorized && (
          <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-amber-50 to-orange-50/50 p-6 sm:p-8 border-b border-amber-100">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-white rounded-xl shadow-xs border border-amber-200 text-[#FF6B00]">
                  <Lock className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-lg font-bold text-slate-900">
                    Payment Required to Access Bundle Deliverables
                  </h2>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    This bundle is a protected executive toolkit. A confirmed one-time purchase of ₹299 unlocks instant,
                    unrestricted access to all four tools with verified website-controlled downloads.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                What You Receive Upon Purchase:
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
                  <div className="flex items-center gap-2 font-semibold text-slate-900 text-sm">
                    <FileText className="w-4 h-4 text-[#FF6B00]" />
                    1. Meta Ads Campaign Planner Workbook
                  </div>
                  <p className="text-xs text-slate-600">
                    Step-by-step operating system, TOF/MOF/BOF architecture & 48-hour decision matrix.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
                  <div className="flex items-center gap-2 font-semibold text-slate-900 text-sm">
                    <FileSpreadsheet className="w-4 h-4 text-[#FF6B00]" />
                    2. Ad Budget & Break-Even Calculator
                  </div>
                  <p className="text-xs text-slate-600">
                    Automated unit economics engine, Break-Even CPA calculation & daily budget pacing rules.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
                  <div className="flex items-center gap-2 font-semibold text-slate-900 text-sm">
                    <Layers className="w-4 h-4 text-[#FF6B00]" />
                    3. 10 High-Converting Copy Frameworks
                  </div>
                  <p className="text-xs text-slate-600">
                    Plug-and-play copywriting swipe files, tested headline formulas & creative hook templates.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
                  <div className="flex items-center gap-2 font-semibold text-slate-900 text-sm">
                    <ShieldCheck className="w-4 h-4 text-[#FF6B00]" />
                    4. Pre-Launch & Tracking Audit Checklist
                  </div>
                  <p className="text-xs text-slate-600">
                    Rapid 1-page pre-flight protocol covering CAPI, pixel events, UTM parameters & checkout audit.
                  </p>
                </div>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100">
                <div className="text-center sm:text-left">
                  <span className="text-xs text-slate-500 font-medium">One-Time Lifetime Access</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-extrabold text-slate-900">₹299</span>
                    <span className="text-sm line-through text-slate-400">₹699</span>
                    <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">Save 57%</span>
                  </div>
                </div>

                <button
                  onClick={handleOpenBuyModal}
                  className="w-full sm:w-auto px-8 py-3.5 bg-[#FF6B00] hover:bg-[#e05e00] text-white font-semibold rounded-xl shadow-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CreditCard className="w-4 h-4" />
                  Unlock Complete Bundle (₹299)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AUTHORIZED STATE: Website-Controlled Secure 4-Deliverable Download Center */}
        {isAuthorized && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Unlock className="w-5 h-5 text-emerald-600" />
                Authorized Deliverables (4 Assets Included)
              </h2>
              <span className="text-xs font-medium text-slate-500">
                Time-limited signed download tokens active
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {bundleFiles.map((file, idx) => (
                <div
                  key={file.id || idx}
                  className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-[#FF6B00] shrink-0 font-bold text-sm">
                      0{idx + 1}
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-slate-900 text-base">
                          {file.title}
                        </h3>
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {file.format || 'PDF Document'}
                        </span>
                        {file.fileSize && (
                          <span className="text-xs text-slate-400 font-medium">
                            · {file.fileSize}
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-slate-600">
                        {file.description || 'Authorized deliverable asset.'}
                      </p>
                    </div>
                  </div>

                  <div className="w-full sm:w-auto shrink-0">
                    <button
                      onClick={() => handleDownloadFile(file)}
                      disabled={activeDownloadingId === file.id || !file.downloadUrl}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {activeDownloadingId === file.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>Preparing...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          <span>Download Asset</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Security Guarantee Notice */}
            <div className="bg-slate-100 rounded-xl p-4 border border-slate-200 flex items-center gap-3 text-xs text-slate-600">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>
                All downloads are authenticated server-side and delivered through encrypted signed URLs.
                Your license grants lifetime personal access to updates.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Embedded Razorpay Checkout Modal for Unauthorized Visitors */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto overscroll-contain">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[calc(100dvh-2rem)] overflow-y-auto my-auto relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-orange-50 rounded-lg text-[#FF6B00]">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Unlock Complete Bundle</h3>
                  <p className="text-xs text-slate-500">₹299 One-Time Payment</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCheckoutModal(false)}
                aria-label="Close checkout"
                className="text-slate-400 hover:text-slate-600 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {checkoutError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{checkoutError}</span>
              </div>
            )}

            <form onSubmit={handleProcessBundlePayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Morgan"
                  value={checkoutName}
                  onChange={(e) => setCheckoutName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:border-[#FF6B00] focus:ring-2 focus:ring-[#FF6B00]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="alex@company.com"
                  value={checkoutEmail}
                  onChange={(e) => setCheckoutEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:border-[#FF6B00] focus:ring-2 focus:ring-[#FF6B00]/20"
                />
                <p className="text-[11px] text-slate-400 mt-1">Receipt & access credentials will be delivered here.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">WhatsApp / Phone Number</label>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={checkoutPhone}
                  onChange={(e) => setCheckoutPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:border-[#FF6B00] focus:ring-2 focus:ring-[#FF6B00]/20"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isProcessingPayment}
                  className="w-full py-3 bg-[#FF6B00] hover:bg-[#e05e00] text-white font-semibold rounded-xl text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isProcessingPayment ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Processing Payment...</span>
                    </>
                  ) : (
                    <>
                      <span>Proceed to Razorpay Checkout (₹299)</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
