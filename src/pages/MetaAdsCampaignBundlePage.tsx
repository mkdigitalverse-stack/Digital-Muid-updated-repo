import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { paymentService } from '../services/paymentService';
import { loadRazorpayCheckoutScript, getClientRazorpayKeyId } from '../lib/razorpay';
import { analytics } from '../utils/analytics';
import {
  ShieldCheck,
  CheckCircle2,
  Lock,
  ArrowRight,
  ExternalLink,
  Sparkles,
  Zap,
  Clock,
  Layers,
  FileSpreadsheet,
  FileText,
  Sliders,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Gift,
  Download,
  Users,
  Target,
  BarChart3,
  HelpCircle,
  XCircle,
  Loader2
} from 'lucide-react';

interface MetaAdsCampaignBundlePageProps {
  navigate: (path: string) => void;
}

// Launch Offer Configuration (Frontend Allocation Counter)
export const launchOfferConfig = {
  totalCopies: 100,
  soldCount: 37,
  remainingCopies: 63,
  launchPrice: 299,
  regularPrice: 999,
  savingsPercent: 70
};

// 8 Demo Activity Buyers for transparent social proof
const DEMO_BUYERS = [
  { name: 'Aarav S.', location: 'Bengaluru', timeAgo: '4m ago' },
  { name: 'Priya M.', location: 'Mumbai', timeAgo: '12m ago' },
  { name: 'Rohan K.', location: 'Delhi NCR', timeAgo: '19m ago' },
  { name: 'Vikram T.', location: 'Hyderabad', timeAgo: '26m ago' },
  { name: 'Sneha P.', location: 'Pune', timeAgo: '33m ago' },
  { name: 'Karan G.', location: 'Ahmedabad', timeAgo: '41m ago' },
  { name: 'Ananya R.', location: 'Chennai', timeAgo: '48m ago' },
  { name: 'Dev M.', location: 'Jaipur', timeAgo: '55m ago' }
];

export const MetaAdsCampaignBundlePage: React.FC<MetaAdsCampaignBundlePageProps> = ({ navigate }) => {
  const { purchaseResource, notify, currentUser, userProfile } = useApp();

  // Scroll tracking for mobile sticky CTA
  const [showMobileSticky, setShowMobileSticky] = useState<boolean>(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const pricingRef = useRef<HTMLDivElement>(null);

  // FAQ accordion state
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Demo Notification state
  const [currentBuyerIndex, setCurrentBuyerIndex] = useState<number>(0);
  const [isNotificationVisible, setIsNotificationVisible] = useState<boolean>(false);

  // Checkout Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Initialize customer form details if logged in
  useEffect(() => {
    if (userProfile?.fullName && !customerName) setCustomerName(userProfile.fullName);
    if (currentUser?.email && !customerEmail) setCustomerEmail(currentUser.email);
    if (userProfile?.phone && !customerPhone) setCustomerPhone(userProfile.phone);
  }, [currentUser, userProfile]);

  // Demo buyer notification loop (every 15s show for 4.5s)
  useEffect(() => {
    const timer = setInterval(() => {
      setIsNotificationVisible(true);
      const hideTimer = setTimeout(() => {
        setIsNotificationVisible(false);
        setCurrentBuyerIndex((prev) => (prev + 1) % DEMO_BUYERS.length);
      }, 4500);
      return () => clearTimeout(hideTimer);
    }, 15000);

    // Initial trigger after 3s
    const initialTimer = setTimeout(() => {
      setIsNotificationVisible(true);
      setTimeout(() => {
        setIsNotificationVisible(false);
        setCurrentBuyerIndex((prev) => (prev + 1) % DEMO_BUYERS.length);
      }, 4500);
    }, 3000);

    return () => {
      clearInterval(timer);
      clearTimeout(initialTimer);
    };
  }, []);

  // Track scroll position for Mobile Sticky CTA
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 420) {
        setShowMobileSticky(true);
      } else {
        setShowMobileSticky(false);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Smooth scroll to pricing section or open checkout modal directly
  const handleOpenCheckout = () => {
    setIsModalOpen(true);
  };

  const scrollToPricing = () => {
    if (pricingRef.current) {
      pricingRef.current.scrollIntoView({ behavior: 'smooth' });
    } else {
      setIsModalOpen(true);
    }
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerEmail.trim() || !customerEmail.includes('@')) {
      setModalError('Please enter a valid email address.');
      return;
    }
    if (!customerName.trim()) {
      setModalError('Please enter your full name.');
      return;
    }

    setIsProcessing(true);
    setModalError(null);

    try {
      const orderResult = await paymentService.createResourceOrder(
        '2d50e5e3-711d-4461-a70d-0ed54dd29f17',
        {
          name: customerName.trim(),
          email: customerEmail.trim(),
          phone: customerPhone.trim()
        },
        {
          accessType: 'paid',
          price: 299
        }
      );

      if (!orderResult.success || !orderResult.orderId) {
        throw new Error(orderResult.error || 'Failed to initialize payment order.');
      }

      const scriptLoaded = await loadRazorpayCheckoutScript();
      const clientKey = orderResult.keyId || getClientRazorpayKeyId();

      if (!scriptLoaded || typeof (window as any).Razorpay !== 'function' || !clientKey) {
        throw new Error('Payment gateway failed to initialize. Please check your internet connection.');
      }

      const options = {
        key: clientKey,
        order_id: orderResult.orderId,
        amount: orderResult.amount,
        currency: orderResult.currency || 'INR',
        name: 'Digital MUID',
        description: 'Meta Ads Campaign Planner Bundle (4 Tools)',
        prefill: {
          name: customerName.trim(),
          email: customerEmail.trim(),
          contact: customerPhone.trim()
        },
        theme: { color: '#FF6B00' },
        handler: async (response: any) => {
          setIsProcessing(true);
          try {
            const verifyResult = await paymentService.verifyResourcePayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              resourceId: '2d50e5e3-711d-4461-a70d-0ed54dd29f17',
              customerDetails: {
                name: customerName.trim(),
                email: customerEmail.trim(),
                phone: customerPhone.trim()
              }
            });

            if (!verifyResult.success || !verifyResult.verified) {
              throw new Error(verifyResult.error || 'Cryptographic payment verification failed.');
            }

            const targetBundle = {
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

            analytics.trackPaidResourcePurchase({
              resourceId: '2d50e5e3-711d-4461-a70d-0ed54dd29f17',
              resourceTitle: 'Meta Ads Campaign Planner Bundle',
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              amount: 299,
              currency: 'INR'
            });

            setIsModalOpen(false);
            notify('Payment verified! Redirecting to your toolkit downloads...', 'success');
            navigate(`/resources/bundle/meta-ads-campaign-planner-bundle?orderId=${encodeURIComponent(response.razorpay_order_id)}&paymentId=${encodeURIComponent(response.razorpay_payment_id)}`);
          } catch (err: any) {
            console.error('[MetaAdsSalesPage] Verification error:', err);
            setModalError(err.message || 'Payment verification encountered an issue. Contact support with your payment ID.');
          } finally {
            setIsProcessing(false);
          }
        },
        modal: {
          ondismiss: () => {
            setIsProcessing(false);
          }
        }
      };

      const rzpInstance = new (window as any).Razorpay(options);
      rzpInstance.open();
    } catch (err: any) {
      console.error('[MetaAdsSalesPage] Checkout error:', err);
      setModalError(err.message || 'Unable to start checkout. Please try again.');
      setIsProcessing(false);
    }
  };

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  const currentBuyer = DEMO_BUYERS[currentBuyerIndex];

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 font-sans selection:bg-[#FF6B00] selection:text-white">

      {/* ========================================================
          SECTION 1: STICKY TOP ANNOUNCEMENT BAR
      ======================================================== */}
      <div className="sticky top-0 z-40 bg-gradient-to-r from-[#0F172A] via-[#1E293B] to-[#0F172A] border-b border-amber-500/30 text-xs md:text-sm shadow-lg backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-center sm:text-left">
            <span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-amber-400 animate-ping mr-1"></span>
            <span className="font-semibold text-amber-300">🔥 LAUNCH SPECIAL:</span>
            <span className="text-slate-200">
              First 100 Downloads Only • Get The Entire Operating System For Just <strong className="text-white font-bold">₹299</strong> (Regular Price ₹999). Instant Google Drive Access.
            </span>
          </div>
          <div className="flex items-center gap-2 bg-[#0A0F1D] px-3 py-1 rounded-full border border-amber-500/30 shrink-0 text-[11px] font-mono">
            <span className="text-amber-400 font-bold">{launchOfferConfig.soldCount} / {launchOfferConfig.totalCopies} SOLD</span>
            <span className="text-slate-500">•</span>
            <span className="text-emerald-400 font-medium">{launchOfferConfig.remainingCopies} COPIES REMAINING</span>
          </div>
        </div>
      </div>

      {/* Minimal Top Brand Bar */}
      <header className="border-b border-slate-800/80 bg-[#0A0F1D]/60 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#2563EB] to-[#FF6B00] flex items-center justify-center font-bold text-white text-base shadow-md">
              DM
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                DIGITAL MUID
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">OPERATING SYSTEMS</span>
              </div>
              <div className="text-[11px] text-slate-400">MK Digitalverse Performance Growth Architecture</div>
            </div>
          </div>
          <button
            onClick={scrollToPricing}
            className="text-xs sm:text-sm font-semibold text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1"
          >
            Claim Offer (₹299)
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* ========================================================
          SECTION 2: HERO SECTION
      ======================================================== */}
      <section ref={heroRef} className="relative pt-12 pb-20 md:pt-20 md:pb-28 overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-blue-600/15 rounded-full blur-[140px] pointer-events-none -z-10" />
        <div className="absolute top-1/3 left-1/3 w-[300px] h-[250px] bg-[#FF6B00]/10 rounded-full blur-[120px] pointer-events-none -z-10" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto space-y-6">
            
            {/* System Category Pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-950/60 border border-blue-500/40 text-blue-300 text-xs font-semibold tracking-wide uppercase shadow-inner">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>PERFORMANCE MARKETING OPERATING SYSTEM</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.15]">
              Stop Wasting Ad Spend On Guesswork. Plan, Calculate, And Launch Meta Ad Campaigns That Actually Convert.
            </h1>

            {/* Sub-headline */}
            <p className="text-base sm:text-lg md:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
              The exact plug-and-play campaign planning system, budget break-even calculator, copy frameworks, and pre-launch audit checklist used to manage high-ROI Meta ad campaigns.
            </p>

            {/* CTA Button Block */}
            <div className="pt-4 flex flex-col items-center justify-center gap-3">
              <button
                onClick={handleOpenCheckout}
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-[#FF6B00] to-[#E05300] hover:from-[#FF7B1A] hover:to-[#EB5F0C] text-white font-bold text-base md:text-lg shadow-xl shadow-orange-950/40 hover:shadow-orange-700/50 transform hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 flex items-center justify-center gap-3 border border-orange-400/40"
              >
                <span>GET INSTANT ACCESS FOR ₹299</span>
                <ArrowRight className="w-5 h-5 text-amber-200" />
              </button>
              
              <div className="text-xs text-slate-400 flex flex-wrap items-center justify-center gap-2 sm:gap-4 pt-1">
                <span className="flex items-center gap-1">⚡ Instant Access</span>
                <span>•</span>
                <span className="flex items-center gap-1">📁 Google Drive & Excel Format</span>
                <span>•</span>
                <span className="flex items-center gap-1">🔒 100% Secure Checkout</span>
              </div>
            </div>

            {/* 3 Key Benefit Bullets */}
            <div className="pt-4 max-w-2xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
              <div className="flex items-start gap-2 bg-slate-900/60 border border-slate-800 p-2.5 rounded-lg text-xs text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Eliminate wasted ad spend before spending a single rupee</span>
              </div>
              <div className="flex items-start gap-2 bg-slate-900/60 border border-slate-800 p-2.5 rounded-lg text-xs text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Built for Indian DTC brands, agencies, and performance marketers</span>
              </div>
              <div className="flex items-start gap-2 bg-slate-900/60 border border-slate-800 p-2.5 rounded-lg text-xs text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Direct download links — no gatekeeping, no upsell traps</span>
              </div>
            </div>

            {/* Hero Visual Mockup */}
            <div className="pt-8 max-w-4xl mx-auto">
              <div className="relative rounded-2xl overflow-hidden border border-slate-700/80 bg-slate-900 shadow-2xl shadow-blue-950/50 group">
                <div className="absolute top-0 inset-x-0 h-10 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between px-4 z-10 backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/80" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                    <div className="w-3 h-3 rounded-full bg-green-500/80" />
                    <span className="ml-2 text-[11px] font-mono text-slate-400">Meta_Ads_Campaign_Planner_Bundle_v4.xlsx</span>
                  </div>
                  <span className="text-[10px] font-mono uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded">
                    READY TO USE
                  </span>
                </div>
                <div className="pt-10">
                  <img
                    src="/src/assets/images/meta_ads_bundle_mockup_1794291719275.jpg"
                    alt="Meta Ads Campaign Planner Bundle - Complete 4-Tool Performance Marketing System"
                    className="w-full h-auto object-cover transform transition-transform duration-700 group-hover:scale-[1.01]"
                    loading="eager"
                  />
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ========================================================
          SECTION 3: AUTHORITY & CREDIBILITY STRIP
      ======================================================== */}
      <section className="border-y border-slate-800 bg-[#0A0F1D]/80 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
            
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80">
              <div className="text-2xl sm:text-3xl font-extrabold text-white flex items-center justify-center gap-1">
                <span>4</span>
                <span className="text-blue-400 text-lg">Assets</span>
              </div>
              <div className="text-xs sm:text-sm font-semibold text-slate-200 mt-1">Battle-Tested Tools</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Calculator, Planner, Copy Vault, Checklist</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80">
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 flex items-center justify-center gap-1">
                <span>100%</span>
              </div>
              <div className="text-xs sm:text-sm font-semibold text-slate-200 mt-1">Formula-Driven</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Automated break-even ROAS & target CPA</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80">
              <div className="text-2xl sm:text-3xl font-extrabold text-amber-400 flex items-center justify-center gap-1">
                <span>60s</span>
              </div>
              <div className="text-xs sm:text-sm font-semibold text-slate-200 mt-1">Instant Deployment</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Google Sheets & Excel compatible</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80">
              <div className="text-2xl sm:text-3xl font-extrabold text-[#FF6B00] flex items-center justify-center gap-1">
                <span>Direct</span>
              </div>
              <div className="text-xs sm:text-sm font-semibold text-slate-200 mt-1">Agency Proven</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Engineered by Digital Muid operators</div>
            </div>

          </div>
        </div>
      </section>

      {/* ========================================================
          SECTION 4: THE PROBLEM
      ======================================================== */}
      <section className="py-20 bg-[#070B14] relative">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          
          <div className="text-center space-y-4">
            <span className="text-xs font-mono uppercase tracking-wider text-red-400 bg-red-950/40 px-3 py-1 rounded-full border border-red-500/30">
              THE HARD REALITY
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Why 90% Of Meta Ad Campaigns Fail Before Launch
            </h2>
            <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto">
              Most advertisers don't fail inside Meta Ads Manager. They fail before they even open it.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div className="p-6 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-red-500/20 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 font-bold text-lg">
                01
              </div>
              <h3 className="text-lg font-bold text-white">Flying Blind On Unit Economics</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Setting daily budgets without knowing your break-even ROAS or allowable Customer Acquisition Cost (CAC). You celebrate a 2.5 ROAS that is actually losing money after shipping and COGS.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-red-500/20 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 font-bold text-lg">
                02
              </div>
              <h3 className="text-lg font-bold text-white">Disorganized Campaign Architecture</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Spreading budget thinly across random ad sets, competing against yourself with audience overlap, and turning off winning ad sets because testing wasn't separated from scaling.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-red-500/20 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 font-bold text-lg">
                03
              </div>
              <h3 className="text-lg font-bold text-white">Unsystematic Ad Copy & Angles</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Writing ads from scratch each time with no psychological hooks, no tested angle matrix, and no scientific record of which headlines actually triggered conversions.
              </p>
            </div>

          </div>

          {/* The Brutal Truth Card */}
          <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-red-950/40 via-slate-900 to-red-950/40 border border-red-500/40 text-center space-y-3 shadow-xl">
            <div className="inline-flex items-center gap-2 text-red-400 font-bold text-sm tracking-wide uppercase">
              <AlertTriangle className="w-4 h-4" />
              <span>THE BRUTAL TRUTH</span>
            </div>
            <p className="text-base sm:text-lg text-slate-200 font-medium leading-relaxed max-w-2xl mx-auto">
              Meta's algorithm is smarter than ever, but it can't fix broken math, unclear messaging, or lack of structured execution. If your numbers don't work on paper, they won't work in Ads Manager.
            </p>
          </div>

        </div>
      </section>

      {/* ========================================================
          SECTION 5: THE SOLUTION / 4 CORE ASSETS
      ======================================================== */}
      <section className="py-20 bg-[#0A0F1D] border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-500/30">
              THE 4-TOOL OPERATING SYSTEM
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Everything You Need To Plan & Execute Like A High-Growth DTC Brand
            </h2>
            <p className="text-base sm:text-lg text-slate-300">
              Not a course. Not a theory lecture. A set of battle-tested, formula-driven execution assets you can download and use in the next 3 minutes.
            </p>
          </div>

          <div className="space-y-12">
            
            {/* Asset 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-8">
              <div className="lg:col-span-7 space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-mono font-semibold border border-emerald-500/20">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>CORE ASSET 01 • SPREADSHEET</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
                  Meta Ad Budget & Break-Even Calculator
                </h3>
                <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                  Never wonder what ROAS you need to stay in profit. Input your product selling price, COGS, shipping, payment processing fees, and profit targets. The calculator instantly computes your exact Break-Even ROAS, Target CPA, and Allowable CAC.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Automated Break-Even ROAS formula</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Allowable CAC & Target CPA matrix</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Daily & monthly spend pacing sheet</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Revenue & margin scenario modeling</span>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-5">
                <div className="rounded-2xl overflow-hidden border border-slate-700 shadow-xl bg-slate-950">
                  <img
                    src="/src/assets/images/ad_calculator_mockup_1794291720674.jpg"
                    alt="Meta Ad Budget and Break-Even Calculator Preview"
                    className="w-full h-auto object-cover"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>

            {/* Asset 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-8">
              <div className="lg:col-span-5 order-2 lg:order-1">
                <div className="rounded-2xl overflow-hidden border border-slate-700 shadow-xl bg-slate-950">
                  <img
                    src="/src/assets/images/campaign_planner_preview_1794291721126.jpg"
                    alt="Meta Ads Campaign Planner and Execution Workbook Preview"
                    className="w-full h-auto object-cover"
                    loading="lazy"
                  />
                </div>
              </div>
              <div className="lg:col-span-7 space-y-4 order-1 lg:order-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-blue-500/10 text-blue-400 text-xs font-mono font-semibold border border-blue-500/20">
                  <Layers className="w-3.5 h-3.5" />
                  <span>CORE ASSET 02 • EXECUTION WORKBOOK</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
                  Meta Ads Campaign Planner & Execution Workbook
                </h3>
                <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                  Map out your entire campaign structure before touching Ads Manager. Clean separation of Top-of-Funnel testing, Retargeting, and Scaling campaigns. Allocate budget scientifically so winners get funded and losers get cut early.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Full-funnel (TOF/MOF/BOF) blueprint</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Audience segmentation & overlap grid</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>70/20/10 Budget allocation system</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Creative fatigue tracking log</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Asset 3 & 4 Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Asset 3 */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-purple-500/10 text-purple-400 text-xs font-mono font-semibold border border-purple-500/20">
                    <FileText className="w-3.5 h-3.5" />
                    <span>CORE ASSET 03 • COPY VAULT</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-extrabold text-white">
                    High-Converting Ad Copy & Hook Frameworks Vault
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Stop staring at a blank screen. Access 15+ battle-tested hook formulas, direct-response headline architectures, and primary text templates categorized by angle: Us vs Them, Problem-Agitation-Solution, Contrarian, and Social Proof.
                  </p>
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>15+ Plug-and-play hook templates</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Headline variations designed for 3+ CTR</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Primary text copywriting cheat sheet</span>
                    </div>
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-800 text-[11px] font-mono text-purple-300">
                  Works for E-commerce, Info Products, Real Estate & Lead Gen
                </div>
              </div>

              {/* Asset 4 */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-amber-500/10 text-amber-400 text-xs font-mono font-semibold border border-amber-500/20">
                    <Sliders className="w-3.5 h-3.5" />
                    <span>CORE ASSET 04 • AUDIT CHECKLIST</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-extrabold text-white">
                    Pre-Launch & Post-Launch Campaign Audit Checklist
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    The 27-point pre-flight checklist that prevents costly mistakes: Meta Pixel and CAPI event diagnostics, UTM parameter consistency, attribution window alignment, and a strict 72-hour post-launch optimization protocol.
                  </p>
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>27-Point pre-flight campaign checklist</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>UTM tracking and attribution verification protocol</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>72-Hour kill/scale decision rules</span>
                    </div>
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-800 text-[11px] font-mono text-amber-300">
                  Standard Operating Procedure for Professional Media Buyers
                </div>
              </div>

            </div>

          </div>

          <div className="text-center pt-4">
            <button
              onClick={handleOpenCheckout}
              className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-[#FF6B00] to-[#E05300] hover:from-[#FF7B1A] text-white font-bold text-base shadow-lg shadow-orange-950/40 inline-flex items-center gap-2 border border-orange-400/30"
            >
              <span>GET ALL 4 ASSETS NOW (₹299)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      </section>

      {/* ========================================================
          SECTION 6: WHO THIS IS FOR VS WHO SHOULD SKIP IT
      ======================================================== */}
      <section className="py-20 bg-[#070B14]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-center space-y-3">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Is This Right For You?
            </h2>
            <p className="text-slate-400 text-sm sm:text-base">
              Be honest with yourself before downloading. This system is designed for practitioners.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Who this is for */}
            <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 space-y-5">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-lg">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                <span>WHO THIS IS FOR</span>
              </div>
              <ul className="space-y-4 text-sm text-slate-200">
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    ✓
                  </div>
                  <span><strong>DTC Founders & E-Commerce Owners:</strong> Running or planning Meta ads who want to protect their cash flow and guarantee unit-level profitability.</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    ✓
                  </div>
                  <span><strong>Performance Marketers & Media Buyers:</strong> Managing budgets who need a clean, repeatable operating system to present to clients.</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    ✓
                  </div>
                  <span><strong>Agencies & Freelancers:</strong> Looking to standardize their media buying SOPs and cut down planning time from days to 30 minutes.</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    ✓
                  </div>
                  <span><strong>Growth Marketers:</strong> Who understand that sustainable ROAS comes from unit economics, not lucky targeting tricks.</span>
                </li>
              </ul>
            </div>

            {/* Who should skip it */}
            <div className="bg-red-950/20 border border-red-500/30 rounded-3xl p-6 sm:p-8 space-y-5">
              <div className="flex items-center gap-2 text-red-400 font-bold text-lg">
                <XCircle className="w-6 h-6 text-red-400 shrink-0" />
                <span>WHO SHOULD SKIP IT</span>
              </div>
              <ul className="space-y-4 text-sm text-slate-300">
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center shrink-0 mt-0.5">
                    ✕
                  </div>
                  <span><strong>"Get Rich Quick" Seekers:</strong> Looking for a secret "hack" or button that magically turns ₹500 into ₹5,00,000 without doing any work.</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center shrink-0 mt-0.5">
                    ✕
                  </div>
                  <span><strong>Non-Practitioners:</strong> People who do not run Meta Ads and have no intention of running performance marketing campaigns.</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center shrink-0 mt-0.5">
                    ✕
                  </div>
                  <span><strong>People Who Refuse To Look At Numbers:</strong> If you don't want to calculate your margins, break-even ROAS, or cost of goods, this toolkit won't help you.</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center shrink-0 mt-0.5">
                    ✕
                  </div>
                  <span><strong>Course Collectors:</strong> If you buy templates just to let them sit in your Google Drive without ever opening them.</span>
                </li>
              </ul>
            </div>

          </div>

        </div>
      </section>

      {/* ========================================================
          SECTION 7: THE MATH / VALUE JUSTIFICATION
      ======================================================== */}
      <section className="py-20 bg-[#0A0F1D] border-y border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 text-center">
          
          <span className="text-xs font-mono uppercase tracking-wider text-amber-400 bg-amber-950/40 px-3 py-1 rounded-full border border-amber-500/30">
            THE SIMPLE MATH
          </span>
          
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Why ₹299 Is The Highest-ROI Investment You'll Make This Quarter
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left pt-4">
            
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="text-xs font-mono uppercase text-red-400 font-bold">OPTION A: GUESSWORK</div>
              <div className="text-xl font-bold text-white">Spend ₹10,000 On Blind Ads</div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                You run ads without knowing your true break-even ROAS. You waste ₹3,000 on overlapping audiences, ₹4,000 on creatives that don't hook, and lose another ₹3,000 because your tracking wasn't verified.
              </p>
              <div className="pt-2 font-mono text-sm text-red-400 font-semibold">
                Net Result: -₹10,000 down the drain.
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-emerald-500/40 space-y-3">
              <div className="text-xs font-mono uppercase text-emerald-400 font-bold">OPTION B: SYSTEMATIC EXECUTION</div>
              <div className="text-xl font-bold text-white">Invest ₹299 In The Operating System</div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                You calculate your allowable CAC before spending a rupee. You structure your campaigns with clean full-funnel separation. You test proven copywriting hooks. Every rupee has an exact job.
              </p>
              <div className="pt-2 font-mono text-sm text-emerald-400 font-semibold">
                Net Result: Protect thousands in budget forever.
              </div>
            </div>

          </div>

          <p className="text-sm text-slate-400 pt-2">
            One single prevented mistake on a test ad set saves more than 10x the price of this bundle.
          </p>

        </div>
      </section>

      {/* ========================================================
          SECTION 8: CREATOR / AGENCY AUTHORITY
      ======================================================== */}
      <section className="py-20 bg-[#070B14]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          
          <div className="p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-[#0E1527] to-slate-900 border border-slate-800 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-[#FF6B00] flex items-center justify-center text-white text-2xl font-black shrink-0 shadow-lg">
                DM
              </div>
              
              <div className="space-y-3">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-blue-500/20 text-blue-400 text-xs font-mono">
                  BUILT BY OPERATORS, NOT THEORISTS
                </div>
                <h3 className="text-2xl font-extrabold text-white">
                  Built On Practical Industry Standards by Digital Muid
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Digital Muid is a performance growth engineering practice operated under MK Digitalverse. We don't sell generic theoretical frameworks or recycled blog advice. These exact 4 tools are the operational spine used to plan real client ad accounts, structure budget pacing, and execute high-margin campaigns.
                </p>
                <div className="pt-2 flex flex-wrap gap-4 text-xs font-mono text-slate-400">
                  <span className="flex items-center gap-1.5 text-slate-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    Real DTC & Agency Systems
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                    Zero Fluff Philosophy
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                    Direct Google Drive Delivery
                  </span>
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ========================================================
          SECTION 9: PRICING AND OFFER BOX
      ======================================================== */}
      <section ref={pricingRef} className="py-20 bg-[#0A0F1D] border-t border-slate-800 relative">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="bg-gradient-to-b from-slate-900 to-[#070B14] rounded-3xl border-2 border-amber-500/50 p-6 sm:p-10 shadow-2xl shadow-orange-950/30 space-y-8 relative">
            
            {/* Top Badge */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-[#FF6B00] text-slate-950 text-xs font-extrabold tracking-wider uppercase px-4 py-1 rounded-full shadow-lg">
              LIMITED LAUNCH WINDOW ALLOCATION
            </div>

            {/* Price Header */}
            <div className="text-center space-y-2 pt-2">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                Meta Ads Campaign Planner Bundle
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                Complete 4-Tool Performance Marketing Operating System
              </p>
              
              <div className="flex items-center justify-center gap-4 pt-3">
                <span className="text-slate-500 line-through text-xl sm:text-2xl font-bold">
                  ₹{launchOfferConfig.regularPrice}
                </span>
                <span className="text-4xl sm:text-5xl font-black text-white">
                  ₹{launchOfferConfig.launchPrice}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold uppercase">
                  SAVE {launchOfferConfig.savingsPercent}%
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                One-time payment • Lifetime access • All future v4 updates included
              </p>
            </div>

            {/* Launch Allocation Progress Bar */}
            <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-amber-300">
                  {launchOfferConfig.soldCount} of {launchOfferConfig.totalCopies} Launch Copies Claimed
                </span>
                <span className="font-mono text-emerald-400 font-bold">
                  {launchOfferConfig.remainingCopies} REMAINING
                </span>
              </div>
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-[#FF6B00] rounded-full transition-all duration-1000"
                  style={{ width: `${(launchOfferConfig.soldCount / launchOfferConfig.totalCopies) * 100}%` }}
                />
              </div>
              <div className="text-[11px] text-slate-400 text-center">
                Price automatically increases to regular ₹999 once the first 100 allocation is reached.
              </div>
            </div>

            {/* Deliverables Checklist */}
            <div className="space-y-3 pt-2">
              <div className="text-xs font-mono uppercase text-slate-400 font-semibold tracking-wider">
                WHAT YOU GET INSTANTLY:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm text-slate-200">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Meta Ad Budget & Break-Even Calculator</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Campaign Planner & Execution Workbook</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Ad Copy & Hook Frameworks Vault (15+ angles)</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>27-Point Pre/Post Launch Audit Checklist</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Google Sheets & Microsoft Excel Formats</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Commercial License (Use for personal & client work)</span>
                </div>
              </div>
            </div>

            {/* Main Action Button */}
            <div className="space-y-3 pt-4">
              <button
                onClick={handleOpenCheckout}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-[#FF6B00] to-[#E05300] hover:from-[#FF7B1A] hover:to-[#EB5F0C] text-white font-extrabold text-lg shadow-xl shadow-orange-950/60 hover:shadow-orange-700/60 transform hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 flex items-center justify-center gap-3 border border-orange-400/50"
              >
                <span>CLAIM YOUR BUNDLE FOR ₹299</span>
                <ArrowRight className="w-5 h-5 text-amber-200" />
              </button>

              <div className="flex items-center justify-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1 text-slate-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  256-Bit Encrypted Razorpay Checkout
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-slate-300">
                  <Zap className="w-4 h-4 text-amber-400" />
                  Instant Google Drive Access
                </span>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ========================================================
          SECTION 10: FAQ ACCORDION
      ======================================================== */}
      <section className="py-20 bg-[#070B14]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          
          <div className="text-center space-y-3">
            <span className="text-xs font-mono uppercase tracking-wider text-blue-400 bg-blue-950/40 px-3 py-1 rounded-full border border-blue-500/30">
              GOT QUESTIONS?
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="text-slate-400 text-sm">
              Everything you need to know about access, formats, and commercial usage.
            </p>
          </div>

          <div className="space-y-3">
            
            {/* FAQ 1 */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
              <button
                onClick={() => toggleFaq(0)}
                className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-white hover:text-amber-300 transition-colors"
              >
                <span className="text-base sm:text-lg">How do I get access after purchasing?</span>
                {openFaqIndex === 0 ? <ChevronUp className="w-5 h-5 text-amber-400 shrink-0" /> : <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />}
              </button>
              {openFaqIndex === 0 && (
                <div className="px-5 pb-5 text-sm text-slate-300 leading-relaxed border-t border-slate-800/60 pt-3">
                  Immediately upon completing the payment through Razorpay, you will be redirected to your verified download dashboard with instant, direct links to all 4 assets in Google Drive and Microsoft Excel formats. You will also receive a confirmation email with persistent access links and your official GST invoice.
                </div>
              )}
            </div>

            {/* FAQ 2 */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
              <button
                onClick={() => toggleFaq(1)}
                className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-white hover:text-amber-300 transition-colors"
              >
                <span className="text-base sm:text-lg">Do I need paid software to use these tools?</span>
                {openFaqIndex === 1 ? <ChevronUp className="w-5 h-5 text-amber-400 shrink-0" /> : <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />}
              </button>
              {openFaqIndex === 1 && (
                <div className="px-5 pb-5 text-sm text-slate-300 leading-relaxed border-t border-slate-800/60 pt-3">
                  No. All spreadsheets work 100% free inside Google Sheets (requires only a standard free Google account) as well as Microsoft Excel. You do not need to buy any additional software, plugins, or subscriptions.
                </div>
              )}
            </div>

            {/* FAQ 3 */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
              <button
                onClick={() => toggleFaq(2)}
                className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-white hover:text-amber-300 transition-colors"
              >
                <span className="text-base sm:text-lg">Can I use this for my clients or agency?</span>
                {openFaqIndex === 2 ? <ChevronUp className="w-5 h-5 text-amber-400 shrink-0" /> : <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />}
              </button>
              {openFaqIndex === 2 && (
                <div className="px-5 pb-5 text-sm text-slate-300 leading-relaxed border-t border-slate-800/60 pt-3">
                  Yes! Your purchase includes a commercial license permitting you to duplicate the templates, rebrand them for client presentations, and use them across unlimited client ad accounts and projects. You may not resell or redistribute the raw templates themselves as digital products.
                </div>
              )}
            </div>

            {/* FAQ 4 */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
              <button
                onClick={() => toggleFaq(3)}
                className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-white hover:text-amber-300 transition-colors"
              >
                <span className="text-base sm:text-lg">Is this suitable for beginners?</span>
                {openFaqIndex === 3 ? <ChevronUp className="w-5 h-5 text-amber-400 shrink-0" /> : <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />}
              </button>
              {openFaqIndex === 3 && (
                <div className="px-5 pb-5 text-sm text-slate-300 leading-relaxed border-t border-slate-800/60 pt-3">
                  Yes. Each template comes with built-in explanatory tooltips, clear instructions, and pre-filled examples showing how the numbers flow. You don't need advanced math skills—all the formulas for break-even ROAS and target CPA calculate automatically.
                </div>
              )}
            </div>

            {/* FAQ 5 */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
              <button
                onClick={() => toggleFaq(4)}
                className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-white hover:text-amber-300 transition-colors"
              >
                <span className="text-base sm:text-lg">What happens when the first 100 copies are sold?</span>
                {openFaqIndex === 4 ? <ChevronUp className="w-5 h-5 text-amber-400 shrink-0" /> : <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />}
              </button>
              {openFaqIndex === 4 && (
                <div className="px-5 pb-5 text-sm text-slate-300 leading-relaxed border-t border-slate-800/60 pt-3">
                  The launch promotional price of ₹299 is strictly restricted to the initial 100 downloads. Once the allocation is exhausted, the price reverts to the regular standard price of ₹999.
                </div>
              )}
            </div>

            {/* FAQ 6 */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
              <button
                onClick={() => toggleFaq(5)}
                className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-white hover:text-amber-300 transition-colors"
              >
                <span className="text-base sm:text-lg">Is payment secure?</span>
                {openFaqIndex === 5 ? <ChevronUp className="w-5 h-5 text-amber-400 shrink-0" /> : <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />}
              </button>
              {openFaqIndex === 5 && (
                <div className="px-5 pb-5 text-sm text-slate-300 leading-relaxed border-t border-slate-800/60 pt-3">
                  Payments are processed directly via Razorpay with 256-bit SSL encryption. We accept UPI (Google Pay, PhonePe, Paytm, BHIM), all major Credit/Debit Cards, and Net Banking. Your payment credentials never touch our servers.
                </div>
              )}
            </div>

          </div>

        </div>
      </section>

      {/* ========================================================
          SECTION 11: FINAL CTA FOOTER
      ======================================================== */}
      <section className="py-20 bg-gradient-to-b from-[#0A0F1D] to-[#04070E] border-t border-slate-800 relative">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          
          <div className="space-y-4">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight">
              Stop Flying Blind In Ads Manager. Get The System Today For ₹299.
            </h2>
            <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto">
              Protect your budget, clarify your unit economics, and launch your next Meta campaign with complete confidence.
            </p>
          </div>

          <div className="pt-2 flex flex-col items-center justify-center gap-3">
            <button
              onClick={handleOpenCheckout}
              className="w-full sm:w-auto px-10 py-4 rounded-xl bg-gradient-to-r from-[#FF6B00] to-[#E05300] hover:from-[#FF7B1A] text-white font-black text-lg shadow-2xl shadow-orange-950/70 transform hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-3 border border-orange-400/40"
            >
              <span>GET INSTANT ACCESS FOR ₹299</span>
              <ArrowRight className="w-5 h-5 text-amber-200" />
            </button>
            <div className="text-xs text-slate-400">
              Instant Google Drive Access • All 4 Assets Included • Lifetime Commercial License
            </div>
          </div>

          {/* Minimal Footer */}
          <footer className="pt-16 border-t border-slate-800/80 text-center text-xs text-slate-500 space-y-2">
            <div>
              © {new Date().getFullYear()} Digital Muid | MK Digitalverse. All Rights Reserved. Secure Payment Gateway by Razorpay.
            </div>
            <div className="text-[11px] text-slate-600">
              Disclaimer: Meta and Facebook are trademarks of Meta Platforms, Inc. This product is an independent educational and operational system engineered by Digital Muid and is not endorsed or sponsored by Meta Platforms, Inc.
            </div>
          </footer>

        </div>
      </section>

      {/* ========================================================
          FRONTEND-ONLY FOMO COMPONENT (DEMO ACTIVITY)
      ======================================================== */}
      {isNotificationVisible && currentBuyer && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 left-4 sm:bottom-6 sm:left-6 z-50 transition-all duration-500 transform animate-in fade-in slide-in-from-bottom-4 pointer-events-none"
        >
          <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl p-3.5 shadow-2xl shadow-black/80 flex items-center gap-3 max-w-sm pointer-events-auto">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-md">
              ✓
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">{currentBuyer.name}</span>
                <span className="text-[10px] text-slate-400">from {currentBuyer.location}</span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase tracking-tighter">
                  DEMO ACTIVITY
                </span>
              </div>
              <div className="text-[11px] text-slate-300">
                Claimed Meta Ads Campaign Bundle • <span className="text-slate-400">{currentBuyer.timeAgo}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MOBILE STICKY CTA BAR (<15% viewport height)
      ======================================================== */}
      {showMobileSticky && (
        <div className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0A0F1D]/95 backdrop-blur-lg border-t border-slate-800 p-3 shadow-2xl flex items-center justify-between gap-3 animate-in slide-in-from-bottom-2">
          <div>
            <div className="text-xs text-slate-400 flex items-center gap-1.5 font-mono">
              <span className="line-through text-slate-500">₹{launchOfferConfig.regularPrice}</span>
              <span className="text-base font-extrabold text-white">₹{launchOfferConfig.launchPrice}</span>
            </div>
            <div className="text-[10px] text-amber-400 font-medium">
              {launchOfferConfig.remainingCopies} launch copies left
            </div>
          </div>
          <button
            onClick={handleOpenCheckout}
            className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#FF6B00] to-[#E05300] text-white font-bold text-xs shadow-lg shadow-orange-950/50 flex items-center gap-1.5 border border-orange-400/40"
          >
            <span>GET ACCESS</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ========================================================
          CHECKOUT MODAL
      ======================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0A0F1D] border border-slate-700 rounded-2xl w-full max-w-md p-6 sm:p-8 space-y-6 shadow-2xl relative text-left">
            
            <button
              onClick={() => {
                if (!isProcessing) setIsModalOpen(false);
              }}
              disabled={isProcessing}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-xs font-mono font-semibold mb-2">
                INSTANT ACCESS CHECKOUT
              </div>
              <h3 className="text-xl font-extrabold text-white">
                Meta Ads Campaign Planner Bundle
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Enter your details to receive your access links and GST invoice.
              </p>
            </div>

            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-400">Total Payable:</span>
                <div className="text-lg font-black text-white">₹299 <span className="text-xs font-normal text-slate-500 line-through">₹999</span></div>
              </div>
              <div className="text-right text-[11px] text-emerald-400 font-mono">
                70% LAUNCH DISCOUNT
              </div>
            </div>

            {modalError && (
              <div className="p-3 rounded-lg bg-red-950/60 border border-red-500/50 text-red-300 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCheckoutSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  disabled={isProcessing}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#FF6B00] transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Email Address (Access link will be sent here) <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="e.g. rahul@example.com"
                  disabled={isProcessing}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#FF6B00] transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Phone Number (For WhatsApp / SMS download updates)
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  disabled={isProcessing}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#FF6B00] transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#FF6B00] to-[#E05300] hover:from-[#FF7B1A] text-white font-bold text-sm shadow-xl shadow-orange-950/60 disabled:opacity-60 transition-all flex items-center justify-center gap-2 border border-orange-400/50"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Opening Secure Gateway...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 text-amber-200" />
                    <span>Pay ₹299 via Razorpay (UPI, Cards)</span>
                  </>
                )}
              </button>

              <div className="text-[11px] text-center text-slate-400 pt-1">
                🔒 Safe & encrypted. Download begins immediately upon verification.
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};
