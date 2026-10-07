import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Calendar as CalendarIcon,
  Clock,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  HelpCircle,
  Video,
  FileText,
  Target,
  Zap,
  TrendingUp,
  Award,
  Layers,
  Users,
  ChevronDown,
  ChevronUp,
  Send,
  MessageSquare,
  CreditCard,
  Loader2
} from 'lucide-react';
import { paymentService } from '../services/paymentService';
import { loadRazorpayCheckoutScript, getClientRazorpayKeyId } from '../lib/razorpay';
import { Booking, RazorpayCheckoutSuccessResponse } from '../types';

interface ConsultationPageProps {
  navigate: (path: string) => void;
  onBookingConfirmed?: (booking: any) => void;
}

export const ConsultationPage: React.FC<ConsultationPageProps> = ({
  navigate,
  onBookingConfirmed
}) => {
  const {
    consultationProduct,
    bookings,
    availabilityRules,
    getAvailableSlotsForDate,
    refreshAvailabilityRules,
    currentUser,
    refreshStudentBookings,
    fetchStudentPayments,
    notify
  } = useApp();

  // Hydrate fresh availability rules from Supabase when the public Consultation page mounts
  React.useEffect(() => {
    refreshAvailabilityRules().catch((err) => {
      console.warn('[ConsultationPage] Availability rules mount refresh notice:', err);
    });
  }, [refreshAvailabilityRules]);

  // Generate upcoming selectable dates respecting maxAdvanceDays as a calendar-day limit
  // Only includes configured working days and excludes blockedDates, aligned strictly with IST
  const upcomingDates = useMemo(() => {
    const maxDays = Math.max(1, availabilityRules?.maxAdvanceDays ?? 14);
    const workingDays = availabilityRules?.workingDays ?? [1, 2, 3, 4, 5];
    const blockedDates = availabilityRules?.blockedDates ?? [];

    const now = new Date();
    // Resolve current date components strictly in Indian Standard Time (Asia/Kolkata)
    const istParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    }).formatToParts(now);

    const curYear = parseInt(istParts.find(p => p.type === 'year')?.value || '1970', 10);
    const curMonth = parseInt(istParts.find(p => p.type === 'month')?.value || '1', 10);
    const curDay = parseInt(istParts.find(p => p.type === 'day')?.value || '1', 10);

    const dates: Array<{ iso: string; dayName: string; monthName: string; dayNum: number }> = [];

    // Scan calendar days from today (offset = 0) up to maxAdvanceDays into the future
    for (let offset = 0; offset <= maxDays; offset++) {
      const d = new Date(Date.UTC(curYear, curMonth - 1, curDay + offset, 12, 0, 0));
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dayNum = d.getUTCDate();
      const iso = `${y}-${m}-${String(dayNum).padStart(2, '0')}`;
      const dayOfWeek = d.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

      // Only include if day is an active working day and not blocked
      if (workingDays.includes(dayOfWeek) && !blockedDates.includes(iso)) {
        // For today (offset 0), only include if there are valid slots remaining (not in past or within notice cutoff)
        if (offset === 0) {
          const todaySlots = getAvailableSlotsForDate(iso);
          if (todaySlots.length === 0) {
            continue;
          }
        }

        const dayName = d.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short' });
        const monthName = d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short' });
        dates.push({ iso, dayName, monthName, dayNum });
      }
    }

    return dates;
  }, [availabilityRules, getAvailableSlotsForDate]);

  // Select the first valid available working day as the initial date
  const [selectedDate, setSelectedDate] = useState<string>(() => upcomingDates[0]?.iso || '');

  // Keep selectedDate synchronized with valid upcoming dates
  React.useEffect(() => {
    if (upcomingDates.length > 0) {
      if (!selectedDate || !upcomingDates.some(d => d.iso === selectedDate)) {
        setSelectedDate(upcomingDates[0].iso);
      }
    } else {
      setSelectedDate('');
    }
  }, [upcomingDates, selectedDate]);

  // Available slots based on availability rules and booked slots
  const availableSlots = useMemo(() => {
    if (!selectedDate) return [];
    const rawSlots = getAvailableSlotsForDate(selectedDate);
    if (rawSlots && rawSlots.length > 0) {
      return rawSlots.map(s => {
        const [hStr, mStr] = s.split(':');
        const h = parseInt(hStr, 10);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const formattedH = h % 12 === 0 ? 12 : h % 12;
        return `${formattedH.toString().padStart(2, '0')}:${mStr} ${ampm} IST`;
      });
    }
    // Hardcoded fallback removed: return empty array so "No available slots" state is shown
    return [];
  }, [selectedDate, getAvailableSlotsForDate, bookings]);

  const [selectedTime, setSelectedTime] = useState<string>(() => availableSlots[0] || '');

  // Form Fields
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [website, setWebsite] = useState('');
  const [primaryChallenge, setPrimaryChallenge] = useState('');
  const [desiredOutcome, setDesiredOutcome] = useState('');

  // Submission & Checkout State
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutStatus, setCheckoutStatus] = useState<
    'idle' | 'creating_order' | 'opening_checkout' | 'verifying_signature' | 'fulfilled' | 'failed'
  >('idle');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);
  const [confirmedPaymentId, setConfirmedPaymentId] = useState<string | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  // Ensure selectedTime remains valid when date or slots change
  React.useEffect(() => {
    if (availableSlots.length > 0) {
      if (!selectedTime || !availableSlots.includes(selectedTime)) {
        setSelectedTime(availableSlots[0]);
      }
    } else {
      setSelectedTime('');
    }
  }, [availableSlots, selectedTime]);

  // Dynamic Consultation Pricing read strictly from consultationProduct (single source of truth)
  const basePrice = consultationProduct?.basePrice || 499;
  const gstRate = consultationProduct?.gstRate || 0.18;
  const gstAmount = Number((basePrice * gstRate).toFixed(2));
  const totalAmount = Math.round(basePrice + gstAmount);

  const handleIntakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // 1. Validate consultation intake fields
    if (!customerName.trim() || !customerEmail.trim() || !businessName.trim() || !primaryChallenge.trim()) {
      notify('Please fill in all required fields (Name, Email, Business Name, and Primary Challenge).', 'error');
      return;
    }

    if (!selectedDate || !selectedTime) {
      notify('Please select a preferred date and time slot.', 'error');
      return;
    }

    setIsSubmitting(true);
    setCheckoutStatus('creating_order');
    setCheckoutError(null);

    const bookingBrief = {
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim(),
      customerPhone: customerPhone.trim(),
      businessName: businessName.trim(),
      primaryChallenge: primaryChallenge.trim(),
      desiredOutcome: desiredOutcome.trim(),
      website: website.trim(),
      date: selectedDate,
      time: selectedTime
    };

    try {
      // 2. Call backend order creation API - server calculates authoritative price from public.consultation_products
      const orderResult = await paymentService.createConsultationOrder(bookingBrief);

      if (!orderResult.success || !orderResult.orderId) {
        const errMsg = orderResult.error || 'Failed to initialize consultation payment order with server.';
        setCheckoutStatus('failed');
        setCheckoutError(errMsg);
        notify(errMsg, 'error');
        setIsSubmitting(false);
        return;
      }

      setCheckoutStatus('opening_checkout');

      // 3. Load official Razorpay Checkout SDK script
      const scriptLoaded = await loadRazorpayCheckoutScript();
      if (!scriptLoaded || typeof window.Razorpay !== 'function') {
        const errMsg = 'Payment gateway interface failed to load. Please check your network connection and retry.';
        setCheckoutStatus('failed');
        setCheckoutError(errMsg);
        notify(errMsg, 'error');
        setIsSubmitting(false);
        return;
      }

      // 4. Resolve public browser-safe key
      const publicKey = orderResult.keyId || getClientRazorpayKeyId();
      if (!publicKey) {
        const errMsg = 'Payment gateway public key is not configured in this environment.';
        setCheckoutStatus('failed');
        setCheckoutError(errMsg);
        notify(errMsg, 'error');
        setIsSubmitting(false);
        return;
      }

      // 5. Open genuine Razorpay Checkout modal using server-created order details
      const rzpOptions = {
        key: publicKey,
        order_id: orderResult.orderId,
        amount: orderResult.amount, // Server authoritative amount in paise
        currency: orderResult.currency || 'INR',
        name: 'Digital Muid',
        description: orderResult.productTitle || '1-on-1 Strategic Business Consultation',
        prefill: {
          name: customerName.trim(),
          email: customerEmail.trim(),
          contact: customerPhone.trim()
        },
        theme: {
          color: '#1877F2'
        },
        handler: async function (response: RazorpayCheckoutSuccessResponse) {
          // STEP 4 & 5: Server-side cryptographic HMAC-SHA256 signature verification & atomic database fulfillment
          setCheckoutStatus('verifying_signature');

          try {
            const verifyResult = await paymentService.verifyConsultationPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              bookingDetails: bookingBrief
            });

            if (verifyResult.success && verifyResult.verified && verifyResult.fulfilled) {
              setCheckoutStatus('fulfilled');
              setConfirmedBooking(verifyResult.booking || null);
              setConfirmedPaymentId(response.razorpay_payment_id);
              setIsSubmitted(true);

              if (onBookingConfirmed && verifyResult.booking) {
                onBookingConfirmed(verifyResult.booking);
              }

              notify('Payment verified and consultation confirmed!', 'success');

              // Refresh student bookings and payment history in background
              try {
                await Promise.allSettled([
                  refreshStudentBookings?.(),
                  fetchStudentPayments?.()
                ]);
              } catch (bgErr) {
                console.warn('[Consultation] Background sync notice:', bgErr);
              }
            } else {
              const verifyErrMsg = verifyResult.error || 'Payment verification failed on the server.';
              setCheckoutStatus('failed');
              setCheckoutError(verifyErrMsg);
              notify(verifyErrMsg, 'error');
            }
          } catch (vErr: any) {
            console.error('[Consultation Verification] Error:', vErr);
            const vMsg = vErr?.message || 'Network error verifying payment with server. Please retry.';
            setCheckoutStatus('failed');
            setCheckoutError(vMsg);
            notify(vMsg, 'error');
          } finally {
            setIsSubmitting(false);
          }
        },
        modal: {
          ondismiss: function () {
            // Customer dismissed or cancelled checkout modal - NEVER create confirmed booking
            setCheckoutStatus('idle');
            setIsSubmitting(false);
            notify('Payment was cancelled. Your consultation has not been booked.', 'info');
          }
        }
      };

      const rzpInstance = new window.Razorpay(rzpOptions);
      rzpInstance.on('payment.failed', function (resp: any) {
        console.warn('[Razorpay Consultation Payment Failed]:', resp?.error);
        const failMsg = resp?.error?.description || 'Payment failed or was declined by your bank.';
        setCheckoutStatus('failed');
        setCheckoutError(failMsg);
        setIsSubmitting(false);
        notify(failMsg, 'error');
      });

      rzpInstance.open();
    } catch (err: any) {
      console.error('[Consultation Checkout] Initialization error:', err);
      const errText = err?.message || 'Failed to initialize consultation payment order. Please try again.';
      setCheckoutStatus('failed');
      setCheckoutError(errText);
      notify(errText, 'error');
      setIsSubmitting(false);
    }
  };

  const scrollToScheduler = () => {
    const el = document.getElementById('consultation-scheduler');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const whatWeDiscuss = [
    {
      icon: TrendingUp,
      title: 'Digital Growth Strategy & Marketing Architecture',
      desc: 'Diagnosing paid acquisition efficiency, organic distribution loops, conversion drop-offs, and CAC-to-LTV unit economics.'
    },
    {
      icon: Sparkles,
      title: 'AI Adoption & Workflow Transformation',
      desc: 'Implementing practical generative AI pipelines, operational automations, and LLM-augmented execution for modern teams.'
    },
    {
      icon: Award,
      title: 'Founder Authority & Personal Branding',
      desc: 'Codifying deep domain expertise into proprietary intellectual property, signature frameworks, and market-commanding authority.'
    },
    {
      icon: Target,
      title: 'Campaign Diagnosis & Performance Bottlenecks',
      desc: 'Teardowns of existing landing pages, offer propositions, ad account structures, and messaging inconsistencies.'
    },
    {
      icon: Layers,
      title: 'Tech Stack & Growth Operations',
      desc: 'Evaluating marketing automation tools, CRM orchestration, data tracking infrastructure, and conversion tooling.'
    }
  ];

  const whoThisIsFor = [
    {
      title: 'Founders & Business Owners',
      desc: 'Looking for decisive strategic clarity before committing major capital, hiring teams, or launching new digital initiatives.'
    },
    {
      title: 'Marketing Leaders & Growth Teams',
      desc: 'Needing an objective, battle-tested outside perspective to audit stalled funnels and unlock untapped performance vectors.'
    },
    {
      title: 'Professionals & Executives',
      desc: 'Building defensible personal authority, codifying their IP, or transitioning their leadership workflows to modern AI.'
    },
    {
      title: 'Teams & Operating Units',
      desc: 'Looking to safely integrate generative AI and autonomous workflows into daily production cycles.'
    }
  ];

  const whatYouGet = [
    {
      icon: Clock,
      title: 'Up to 30 Minutes of Focused Advisory',
      desc: 'Zero fluff, zero generic pleasantries. We immediately dive into diagnosing your exact commercial bottleneck.'
    },
    {
      icon: Target,
      title: 'Direct Diagnostic Evaluation',
      desc: 'An honest, transparent assessment of your current growth mechanics, positioning, and digital architecture.'
    },
    {
      icon: FileText,
      title: 'Actionable Strategic Blueprint',
      desc: 'Walk away with concrete recommendations, prioritized execution steps, and relevant framework models.'
    },
    {
      icon: Video,
      title: 'Private Session Recording',
      desc: 'Full HD recording of the Google Meet session along with any shared resources and diagram references.'
    }
  ];

  const howItWorks = [
    {
      step: '01',
      title: 'Select Date & Time',
      desc: 'Choose an available 30-minute slot on the calendar that fits your schedule.'
    },
    {
      step: '02',
      title: 'Submit Intake Brief',
      desc: 'Share your business context, website URL, and primary challenges so Muid prepares prior to the call.'
    },
    {
      step: '03',
      title: '30-Min Google Meet Call',
      desc: 'Join the private video session focused 100% on dissecting your strategic bottleneck.'
    },
    {
      step: '04',
      title: 'Execute with Clarity',
      desc: 'Receive session takeaways and implement your custom roadmap with absolute clarity.'
    }
  ];

  const faqs = [
    {
      q: 'How should I prepare for the consultation?',
      a: 'Complete the intake questionnaire with as much specific context as possible (metrics, current bottlenecks, and target goals). Having your current analytics, funnel links, or key questions ready ensures we spend the entire 30 minutes on strategic solutions rather than background discovery.'
    },
    {
      q: 'Who conducts the session?',
      a: 'Every 1-on-1 consultation is conducted personally and directly by Digital Muid. No junior strategists or surrogate team members.'
    },
    {
      q: 'Is this a sales pitch for agency retainers?',
      a: 'No. This is a standalone, paid strategic advisory working session. The objective is to provide objective, high-leverage clarity on your specific bottleneck without any pitch or sales pressure.'
    },
    {
      q: 'Can members of my team join the Google Meet call?',
      a: 'Yes. Up to 3 key stakeholders or team members (e.g., co-founder, marketing lead, tech lead) are welcome to join the video session.'
    },
    {
      q: 'What if I need to reschedule my session?',
      a: 'You can reschedule your session with at least 24 hours notice prior to the scheduled time using the reschedule link in your confirmation email.'
    },
    {
      q: 'Is our discussion kept confidential?',
      a: 'Yes. All proprietary business data, metrics, roadmaps, and discussions shared during the consultation are treated with strict professional confidentiality.'
    }
  ];

  return (
    <div id="consultation-page-root" className="pt-28 sm:pt-32 pb-24 space-y-20">
      {/* ========================================================================= */}
      {/* 1. HERO SECTION */}
      {/* ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 sm:p-14 rounded-3xl bg-gradient-to-br from-[#07111F] via-[#0B1E3B] to-[#07111F] border border-slate-800 text-white shadow-2xl relative overflow-hidden space-y-8">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#1877F2]/15 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#FF6B00]/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10 max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF6B00]/15 border border-[#FF6B00]/30 text-[#FF6B00] text-xs font-bold uppercase tracking-widest font-interface">
              <CalendarIcon className="w-3.5 h-3.5" /> BUSINESS GROWTH CONSULTATION
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-display font-bold text-white tracking-tight leading-[1.15]">
              A focused 30-minute strategic conversation with Digital Muid.
            </h1>

            <p className="text-slate-300 text-base sm:text-lg font-interface leading-relaxed font-light">
              Get focused perspective on your business growth, digital strategy, AI opportunities, marketing systems, or transformation challenges.
            </p>

            {/* Quick Highlights Pills */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/10 border border-white/10 text-xs font-semibold text-white">
                <Clock className="w-3.5 h-3.5 text-[#FF6B00]" />
                <span>UP TO 30 MINUTES</span>
              </div>
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/10 border border-white/10 text-xs font-semibold text-white">
                <Video className="w-3.5 h-3.5 text-[#1877F2]" />
                <span>Google Meet HD Call</span>
              </div>
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/10 border border-white/10 text-xs font-semibold text-white">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>1-on-1 Founder Advisory</span>
              </div>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <button
                id="consultation-hero-book-btn"
                onClick={scrollToScheduler}
                className="px-7 py-4 bg-[#FF6B00] hover:bg-[#e66000] text-white font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-lg shadow-[#FF6B00]/25 active:scale-98"
              >
                <CalendarIcon className="w-4 h-4 text-white" />
                <span>BOOK A CONSULTATION</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigate('/contact')}
                className="px-6 py-4 bg-white/10 hover:bg-white/15 text-white border border-white/20 font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>GET IN TOUCH</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. WHAT WE CAN DISCUSS */}
      {/* ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="space-y-3 max-w-2xl">
          <div className="text-xs font-bold uppercase tracking-widest text-[#1877F2] font-interface">
            Strategic Agenda
          </div>
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 tracking-tight">
            What We Can Discuss
          </h2>
          <p className="text-slate-600 text-sm sm:text-base font-interface">
            Every session is tailored to your highest-priority challenge across our core domains of expertise.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {whatWeDiscuss.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="p-7 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition-all shadow-sm space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#1877F2] flex items-center justify-center border border-blue-100 font-bold">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-display font-bold text-slate-900 leading-snug">
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 font-interface leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. WHO THIS IS FOR */}
      {/* ========================================================================= */}
      <section className="bg-slate-50 border-y border-slate-200 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="space-y-3 max-w-2xl">
            <div className="text-xs font-bold uppercase tracking-widest text-[#FF6B00] font-interface">
              Target Audience
            </div>
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 tracking-tight">
              Who This Consultation Is For
            </h2>
            <p className="text-slate-600 text-sm sm:text-base font-interface">
              Built for decision-makers who value structured diagnostic clarity over superficial advice.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {whoThisIsFor.map((item, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3"
              >
                <div className="w-8 h-8 rounded-lg bg-orange-50 text-[#FF6B00] border border-orange-100 font-mono font-bold text-xs flex items-center justify-center">
                  0{idx + 1}
                </div>
                <h3 className="text-base font-display font-bold text-slate-900 leading-snug">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-600 font-interface leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. WHAT YOU'LL GET */}
      {/* ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="space-y-3 max-w-2xl">
          <div className="text-xs font-bold uppercase tracking-widest text-emerald-600 font-interface">
            Deliverables & Outcomes
          </div>
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 tracking-tight">
            What You'll Get
          </h2>
          <p className="text-slate-600 text-sm sm:text-base font-interface">
            Direct, practical takeaways designed to be immediately put into production.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {whatYouGet.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-display font-bold text-slate-900">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-600 font-interface leading-relaxed">
                  {item.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. HOW IT WORKS */}
      {/* ========================================================================= */}
      <section className="bg-slate-900 text-white py-16 border-y border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <div className="text-xs font-bold uppercase tracking-widest text-[#FF6B00] font-interface">
              Simple 4-Step Process
            </div>
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-white tracking-tight">
              How It Works
            </h2>
            <p className="text-slate-400 text-sm font-interface">
              From slot reservation to strategic execution in four seamless steps.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {howItWorks.map((st) => (
              <div
                key={st.step}
                className="p-6 rounded-2xl bg-slate-800/60 border border-slate-700/80 space-y-3"
              >
                <div className="text-xs font-mono font-bold text-[#FF6B00]">STEP {st.step}</div>
                <h3 className="text-lg font-display font-bold text-white">{st.title}</h3>
                <p className="text-xs text-slate-300 font-interface leading-relaxed">{st.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. FEE & PRICING TRANSPARENCY */}
      {/* ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 sm:p-10 rounded-3xl bg-white border border-slate-200 shadow-md flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="space-y-3 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#1877F2] text-xs font-bold uppercase tracking-wider">
              Consultation Fee
            </div>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-slate-900">
              Fixed Strategic Investment. Zero Upsell Pressure.
            </h2>
            <p className="text-slate-600 text-sm font-interface leading-relaxed">
              We believe in complete pricing transparency. The consultation is a 100% focused strategic session dedicated entirely to solving your challenge.
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-500 pt-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Official GST invoice provided for business expense deduction</span>
            </div>
          </div>

          <div className="w-full lg:w-auto min-w-[300px] p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-center lg:text-left">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Customer-Facing Total</div>
            <div className="flex items-baseline justify-center lg:justify-start gap-2">
              <span className="text-4xl font-display font-bold text-slate-900 font-mono">₹{totalAmount}</span>
              <span className="text-xs text-slate-500 font-medium">INR Total (incl. GST)</span>
            </div>
            <div className="text-xs text-slate-600 font-mono space-y-1 border-t border-slate-200 pt-2.5">
              <div className="flex justify-between">
                <span>Base Consultation Fee:</span>
                <span className="font-semibold">₹{basePrice}</span>
              </div>
              <div className="flex justify-between">
                <span>+ {(gstRate * 100).toFixed(0)}% GST:</span>
                <span className="font-semibold">₹{gstAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-900 font-bold border-t border-slate-200/60 pt-1">
                <span>Total Payable:</span>
                <span>₹{totalAmount}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 7. BOOKING SCHEDULING UI & INTAKE BRIEF */}
      {/* ========================================================================= */}
      <section id="consultation-scheduler" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <div className="text-xs font-bold uppercase tracking-widest text-[#FF6B00] font-interface">
            Booking & Availability
          </div>
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 tracking-tight">
            Reserve Your Consultation
          </h2>
          <p className="text-slate-600 text-sm font-interface">
            Pick your preferred date and slot, then complete the brief below so Muid can prepare prior to the call.
          </p>
        </div>

        {isSubmitted ? (
          <div className="p-8 sm:p-12 rounded-3xl bg-white border border-emerald-200 shadow-xl max-w-2xl mx-auto text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <span className="px-3 py-1 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                Payment Verified · Booking Confirmed
              </span>
              <h3 className="text-2xl font-display font-bold text-slate-900 pt-1">Consultation Confirmed!</h3>
              <p className="text-slate-600 text-sm font-interface leading-relaxed">
                Thank you, <strong className="text-slate-900">{customerName}</strong>. Your 1-on-1 strategic advisory session for <strong className="text-slate-900">{businessName}</strong> has been secured for <strong className="text-slate-900">{selectedDate} at {selectedTime}</strong>.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 text-left space-y-2.5 font-interface">
              <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px] font-mono border-b border-slate-200 pb-2">
                Booking & Transaction Summary:
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Booking Code:</span>
                <span className="font-mono font-bold text-slate-900">{confirmedBooking?.bookingCode || 'Generated on Server'}</span>
              </div>
              {confirmedPaymentId && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Razorpay Payment ID:</span>
                  <span className="font-mono text-slate-800">{confirmedPaymentId}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Scheduled Date & Time:</span>
                <span className="font-semibold text-slate-900">{selectedDate} · {selectedTime}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Registered Email:</span>
                <span className="font-semibold text-slate-900">{customerEmail}</span>
              </div>
              {confirmedBooking?.meetUrl && (
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-500 block mb-1">Google Meet Link:</span>
                  <a
                    href={confirmedBooking.meetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#1877F2] font-mono font-medium hover:underline break-all inline-flex items-center gap-1"
                  >
                    <span>{confirmedBooking.meetUrl}</span>
                  </a>
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl bg-orange-50/60 border border-orange-200 text-xs text-orange-900 text-left space-y-1 font-interface">
              <div className="font-bold">Next Steps:</div>
              <div>• Calendar invite and Google Meet link have been dispatched to <strong>{customerEmail}</strong>.</div>
              <div>• Your receipt is archived in your <strong>Account Billing & Invoices</strong> history.</div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsSubmitted(false);
                  setCheckoutStatus('idle');
                  setConfirmedBooking(null);
                  setConfirmedPaymentId(null);
                }}
                className="px-6 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs transition-all cursor-pointer"
              >
                Book Another Session
              </button>
              <button
                type="button"
                onClick={() => navigate('/account?tab=billing')}
                className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-[#FF6B00] text-white font-semibold text-xs transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>View Receipt in Purchase History</span>
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleIntakeSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Date & Slot Picker */}
            <div className="lg:col-span-5 p-7 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-6">
              <div className="space-y-1">
                <h3 className="text-lg font-display font-bold text-slate-900">1. Select Preferred Date & Slot</h3>
                <p className="text-xs text-slate-500">Available time slots are shown in Indian Standard Time (IST).</p>
              </div>

              {/* Date horizontal selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Select Date</label>
                {upcomingDates.length > 0 ? (
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                    {upcomingDates.map((d) => {
                      const isSelected = selectedDate === d.iso;
                      return (
                        <button
                          key={d.iso}
                          type="button"
                          onClick={() => setSelectedDate(d.iso)}
                          className={`min-w-[65px] p-2.5 rounded-xl border text-center transition-all cursor-pointer shrink-0 ${
                            isSelected
                              ? 'bg-[#1877F2] border-[#1877F2] text-white shadow-sm'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:text-slate-900 hover:border-slate-300'
                          }`}
                        >
                          <div className="text-[10px] uppercase font-bold">{d.dayName}</div>
                          <div className="text-base font-display font-bold my-0.5">{d.dayNum}</div>
                          <div className="text-[10px]">{d.monthName}</div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500 font-interface">
                    No upcoming consultation dates available at this time.
                  </div>
                )}
              </div>

              {/* Time slot picker */}
              {upcomingDates.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Select Time Slot (IST)</label>
                  {availableSlots.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {availableSlots.map((slot) => {
                        const isSelected = selectedTime === slot;
                        return (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setSelectedTime(slot)}
                            className={`p-2.5 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-[#FF6B00] border-[#FF6B00] text-white shadow-sm'
                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300 hover:text-slate-900'
                            }`}
                          >
                            {slot}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500 font-interface">
                      No available slots on this date.
                    </div>
                  )}
                </div>
              )}

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
                <div className="font-semibold text-slate-800">Session Details:</div>
                <div>• Format: Private Google Meet HD video call</div>
                <div>• Duration: Up to {availabilityRules?.slotDurationMinutes || 30} minutes focused advisory</div>
                <div>• Recording: Automatically shared after session</div>
              </div>
            </div>

            {/* Right Column: Intake Brief Form */}
            <div className="lg:col-span-7 p-7 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-6">
              <div className="space-y-1">
                <h3 className="text-lg font-display font-bold text-slate-900">2. Session Intake Brief</h3>
                <p className="text-xs text-slate-500">Provide context in advance so Muid reviews your business beforehand.</p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-700 font-semibold">Your Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Vikram Singhania"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm focus:outline-none focus:border-[#1877F2]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-700 font-semibold">Email Address *</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. vikram@yourbrand.com"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm focus:outline-none focus:border-[#1877F2]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-700 font-semibold">Phone / WhatsApp (Optional)</label>
                    <input
                      type="tel"
                      placeholder="e.g. +91 98765 43210"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm focus:outline-none focus:border-[#1877F2]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-700 font-semibold">Business / Brand Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Acme Ventures"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm focus:outline-none focus:border-[#1877F2]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-700 font-semibold">Website / App URL (Optional)</label>
                  <input
                    type="text"
                    placeholder="https://yourwebsite.com"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm focus:outline-none focus:border-[#1877F2]"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-700 font-semibold">
                    Primary Challenge or Growth Bottleneck *
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Describe what you want to solve (e.g. CAC is rising, organic traffic stalled, or need to architect our AI workflow)..."
                    value={primaryChallenge}
                    onChange={(e) => setPrimaryChallenge(e.target.value)}
                    className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm focus:outline-none focus:border-[#1877F2]"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-700 font-semibold">
                    Desired Outcome from This Session (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="What specific clarity or decision do you want to walk away with?"
                    value={desiredOutcome}
                    onChange={(e) => setDesiredOutcome(e.target.value)}
                    className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm focus:outline-none focus:border-[#1877F2]"
                  />
                </div>

                {checkoutError && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                    <span className="font-bold">Error:</span>
                    <span>{checkoutError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  id="consultation-submit-btn"
                  disabled={isSubmitting || !selectedDate || !selectedTime}
                  className={`w-full py-4 rounded-xl bg-[#FF6B00] hover:bg-[#e66000] active:scale-[0.99] text-white font-bold text-xs uppercase tracking-widest shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    isSubmitting || !selectedDate || !selectedTime ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>
                        {checkoutStatus === 'creating_order'
                          ? 'Generating Secure Order...'
                          : checkoutStatus === 'opening_checkout'
                          ? 'Opening Razorpay Gateway...'
                          : checkoutStatus === 'verifying_signature'
                          ? 'Verifying Payment Cryptographically...'
                          : 'Processing Consultation...'}
                      </span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      <span>
                        {selectedDate && selectedTime
                          ? `Proceed to Payment (₹${totalAmount}) · ${selectedDate}`
                          : 'Select Date & Time to Continue'}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </section>

      {/* ========================================================================= */}
      {/* 8. FAQ SECTION */}
      {/* ========================================================================= */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="text-center space-y-2">
          <div className="text-xs font-bold uppercase tracking-widest text-[#1877F2] font-interface">
            Common Inquiries
          </div>
          <h2 className="text-3xl font-display font-bold text-slate-900 tracking-tight">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isExpanded = expandedFaq === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm transition-all"
              >
                <button
                  type="button"
                  onClick={() => setExpandedFaq(isExpanded ? null : idx)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50"
                >
                  <span className="font-display font-bold text-base text-slate-900">{faq.q}</span>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
                  )}
                </button>
                {isExpanded && (
                  <div className="px-5 pb-5 text-sm text-slate-600 font-interface leading-relaxed border-t border-slate-100 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 9. FINAL CTA */}
      {/* ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-slate-900 via-[#0B1E3B] to-slate-900 border border-slate-800 text-center space-y-6 shadow-xl">
          <h2 className="text-2xl sm:text-4xl font-display font-bold text-white tracking-tight">
            Ready to Get Strategic Clarity?
          </h2>
          <p className="text-slate-300 text-sm sm:text-base max-w-xl mx-auto font-interface">
            Book your 1-on-1 session to unpack your primary growth vector or get in touch for custom enterprise advisory.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <button
              onClick={scrollToScheduler}
              className="px-8 py-3.5 rounded-xl bg-[#FF6B00] hover:bg-[#e66000] text-white font-bold text-xs uppercase tracking-widest shadow-xl inline-flex items-center gap-2 cursor-pointer transition-all"
            >
              <CalendarIcon className="w-4 h-4" />
              <span>Book a Consultation</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate('/contact')}
              className="px-8 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-widest border border-white/20 inline-flex items-center gap-2 cursor-pointer transition-all"
            >
              <span>Get in Touch</span>
              <ArrowRight className="w-4 h-4 text-white/70" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
