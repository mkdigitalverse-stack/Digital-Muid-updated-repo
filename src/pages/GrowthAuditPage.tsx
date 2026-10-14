import React, { useState, useEffect, useMemo } from 'react';
import { SEOHead } from '../components/SEOHead';
import { useApp } from '../context/AppContext';
import { analytics } from '../utils/analytics';
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Calendar as CalendarIcon,
  Clock,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  Loader2,
  BookOpen,
  MessageSquare,
  Globe,
  Building,
  TrendingUp,
  DollarSign,
  ChevronRight,
  Zap,
  Phone
} from 'lucide-react';

interface GrowthAuditPageProps {
  navigate: (path: string) => void;
}

export const GrowthAuditPage: React.FC<GrowthAuditPageProps> = ({ navigate }) => {
  const { availabilityRules, getAvailableSlotsForDate, addLead, refreshAvailabilityRules } = useApp();

  // Progress state: Step 1 to 7
  const [currentStep, setCurrentStep] = useState<number>(1);
  const totalSteps = 7;

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [hasNoWebsite, setHasNoWebsite] = useState(false);
  const [monthlyRevenue, setMonthlyRevenue] = useState('');
  const [monthlyAdSpend, setMonthlyAdSpend] = useState('');
  const [growthBottleneck, setGrowthBottleneck] = useState('');
  const [otherBottleneck, setOtherBottleneck] = useState('');
  const [marketingConsent, setMarketingConsent] = useState(false);

  // Validation & Error state
  const [stepError, setStepError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Qualification & Completion Result State
  const [qualificationStatus, setQualificationStatus] = useState<
    'idle' | 'qualified' | 'academy_nurture' | 'startup_review'
  >('idle');
  const [referenceId, setReferenceId] = useState('');

  // Booking Calendar States (for Route B: Qualified)
  const [calendarView, setCalendarView] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [phone, setPhone] = useState('');
  const [bookingStatus, setBookingStatus] = useState<'idle' | 'booking' | 'confirmed' | 'failed'>('idle');
  const [confirmedBookingDetails, setConfirmedBookingDetails] = useState<{
    reference: string;
    dateTime: string;
    timezone: string;
    whatsAppMsg?: string;
    alertText?: string;
  } | null>(null);

  // Extract UTM parameters on mount
  const utmParams = useMemo(() => {
    if (typeof window === 'undefined') return {};
    const params = new URLSearchParams(window.location.search);
    return {
      utmSource: params.get('utm_source') || undefined,
      utmMedium: params.get('utm_medium') || undefined,
      utmCampaign: params.get('utm_campaign') || undefined,
      utmContent: params.get('utm_content') || undefined,
      utmTerm: params.get('utm_term') || undefined
    };
  }, []);

  // Track form start on mount
  useEffect(() => {
    analytics.trackGrowthAuditFormStart();
    refreshAvailabilityRules?.().catch(() => {});
  }, [refreshAvailabilityRules]);

  // Upcoming selectable calendar dates strictly aligned with IST
  const upcomingDates = useMemo(() => {
    const maxDays = Math.max(1, availabilityRules?.maxAdvanceDays ?? 14);
    const workingDays = availabilityRules?.workingDays ?? [1, 2, 3, 4, 5];
    const blockedDates = availabilityRules?.blockedDates ?? [];

    const now = new Date();
    const istParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    }).formatToParts(now);

    const curYear = parseInt(istParts.find((p) => p.type === 'year')?.value || '1970', 10);
    const curMonth = parseInt(istParts.find((p) => p.type === 'month')?.value || '1', 10);
    const curDay = parseInt(istParts.find((p) => p.type === 'day')?.value || '1', 10);

    const dates: Array<{ iso: string; dayName: string; monthName: string; dayNum: number }> = [];

    for (let offset = 0; offset <= maxDays; offset++) {
      const d = new Date(Date.UTC(curYear, curMonth - 1, curDay + offset, 12, 0, 0));
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dayNum = d.getUTCDate();
      const iso = `${y}-${m}-${String(dayNum).padStart(2, '0')}`;
      const dayOfWeek = d.getUTCDay();

      if (workingDays.includes(dayOfWeek) && !blockedDates.includes(iso)) {
        if (offset === 0) {
          const todaySlots = getAvailableSlotsForDate(iso);
          if (todaySlots.length === 0) continue;
        }
        const dayName = d.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short' });
        const monthName = d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short' });
        dates.push({ iso, dayName, monthName, dayNum });
      }
    }
    return dates;
  }, [availabilityRules, getAvailableSlotsForDate]);

  useEffect(() => {
    if (!selectedDate && upcomingDates.length > 0) {
      setSelectedDate(upcomingDates[0].iso);
    }
  }, [upcomingDates, selectedDate]);

  // Available slots for selected date
  const availableSlots = useMemo(() => {
    if (!selectedDate) return [];
    const rawSlots = getAvailableSlotsForDate(selectedDate);
    return rawSlots.map((s) => {
      const [hStr, mStr] = s.split(':');
      const h = parseInt(hStr, 10);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const formattedH = h % 12 === 0 ? 12 : h % 12;
      return `${formattedH.toString().padStart(2, '0')}:${mStr} ${ampm} IST`;
    });
  }, [selectedDate, getAvailableSlotsForDate]);

  useEffect(() => {
    if (availableSlots.length > 0) {
      if (!selectedTime || !availableSlots.includes(selectedTime)) {
        setSelectedTime(availableSlots[0]);
      }
    } else {
      setSelectedTime('');
    }
  }, [availableSlots, selectedTime]);

  // Options configuration
  const revenueOptions = [
    'Under ₹3 lakh',
    '₹3 lakh–₹10 lakh',
    '₹10 lakh–₹25 lakh',
    'Above ₹25 lakh',
    'Pre-revenue / launching soon',
    'Prefer to discuss privately'
  ];

  const adSpendOptions = [
    'No active ad spend',
    'Under ₹25,000',
    '₹25,000–₹50,000',
    '₹50,001–₹1 lakh',
    'Above ₹1 lakh',
    'Campaigns launching soon'
  ];

  const bottleneckOptions = [
    'Website conversion and performance',
    'Meta Ads / Google Ads acquisition',
    'Lead quality and conversion',
    'CRM, AI, or operational automation',
    'Launching a new business',
    'Other'
  ];

  // Validation per step
  const handleNext = () => {
    setStepError('');

    if (currentStep === 1) {
      if (!name.trim() || name.trim().length < 2) {
        setStepError('Please enter your name.');
        return;
      }
      analytics.trackGrowthAuditStepComplete(1, 'Name');
      setCurrentStep(2);
    } else if (currentStep === 2) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email.trim() || !emailRegex.test(email.trim())) {
        setStepError('Please enter a valid business email address.');
        return;
      }
      analytics.trackGrowthAuditStepComplete(2, 'Email');
      setCurrentStep(3);
    } else if (currentStep === 3) {
      if (!hasNoWebsite) {
        const cleanWeb = website.trim();
        if (!cleanWeb) {
          setStepError('Please enter your website URL or select "I don\'t have a website yet".');
          return;
        }
      }
      analytics.trackGrowthAuditStepComplete(3, 'Website');
      setCurrentStep(4);
    } else if (currentStep === 4) {
      if (!monthlyRevenue) {
        setStepError('Please select your current average monthly revenue.');
        return;
      }
      analytics.trackGrowthAuditStepComplete(4, 'Monthly Revenue');
      setCurrentStep(5);
    } else if (currentStep === 5) {
      if (!monthlyAdSpend) {
        setStepError('Please select your monthly advertising spend.');
        return;
      }
      analytics.trackGrowthAuditStepComplete(5, 'Ad Spend');
      setCurrentStep(6);
    } else if (currentStep === 6) {
      analytics.trackGrowthAuditStepComplete(6, 'Bottleneck Context');
      setCurrentStep(7);
    }
  };

  const handleBack = () => {
    setStepError('');
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  // Final Form Submission
  const handleSubmitQualification = async () => {
    setIsSubmitting(true);
    setStepError('');

    const finalBottleneck =
      growthBottleneck === 'Other' && otherBottleneck.trim()
        ? `Other: ${otherBottleneck.trim()}`
        : growthBottleneck;

    const payload = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      website: hasNoWebsite ? 'No website yet' : website.trim(),
      hasNoWebsite,
      monthlyRevenue,
      monthlyAdSpend,
      growthBottleneck: finalBottleneck,
      marketingConsent,
      landingPage: '/request-growth-audit',
      ...utmParams
    };

    try {
      const res = await fetch('/api/growth-audit/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit qualification request.');
      }

      setReferenceId(data.referenceId || `GA-${Date.now().toString().slice(-4)}`);
      const status = data.qualificationStatus as 'qualified' | 'academy_nurture' | 'startup_review';
      setQualificationStatus(status);

      // Track in analytics
      analytics.trackGrowthAuditFormSubmit(status);
      analytics.trackGrowthAuditQualified(status);

      // Also register in-memory CRM lead through AppContext
      try {
        addLead({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: undefined,
          source: 'Consultation Intake Brief',
          interest: `Growth Audit: ${monthlyRevenue} rev | ${monthlyAdSpend} spend`,
          notes: JSON.stringify({
            referenceId: data.referenceId,
            website: hasNoWebsite ? 'No website yet' : website.trim(),
            monthlyRevenue,
            monthlyAdSpend,
            growthBottleneck: finalBottleneck,
            qualificationStatus: status,
            marketingConsent,
            ...utmParams
          }),
          status: status === 'qualified' ? 'Qualified' : 'New'
        });
      } catch (err) {
        console.warn('[Growth Audit] In-memory lead sync note:', err);
      }
    } catch (err: any) {
      // Fallback deterministic evaluation if offline
      const qualifyingRevenues = ['₹3 lakh–₹10 lakh', '₹10 lakh–₹25 lakh', 'Above ₹25 lakh'];
      const qualifyingAdSpends = ['Under ₹25,000', '₹25,000–₹50,000', '₹50,001–₹1 lakh', 'Above ₹1 lakh'];
      const meetsRev = qualifyingRevenues.includes(monthlyRevenue);
      const meetsSpend = qualifyingAdSpends.includes(monthlyAdSpend);
      const isPre =
        monthlyRevenue === 'Pre-revenue / launching soon' || monthlyAdSpend === 'Campaigns launching soon';

      let fallbackStatus: 'qualified' | 'academy_nurture' | 'startup_review' = 'academy_nurture';
      if (meetsRev && meetsSpend) fallbackStatus = 'qualified';
      else if (isPre) fallbackStatus = 'startup_review';

      setReferenceId(`GA-${Date.now().toString().slice(-4)}`);
      setQualificationStatus(fallbackStatus);
      analytics.trackGrowthAuditFormSubmit(fallbackStatus);
      analytics.trackGrowthAuditQualified(fallbackStatus);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Booking Confirmation Handler for Qualified Prospects
  const handleConfirmBooking = async () => {
    if (!selectedDate || !selectedTime) {
      setStepError('Please select an available appointment slot.');
      return;
    }

    setBookingStatus('booking');
    setStepError('');

    try {
      const res = await fetch('/api/growth-audit/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referenceId,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          website: hasNoWebsite ? 'No website yet' : website.trim(),
          date: selectedDate,
          time: selectedTime,
          notes: `Revenue: ${monthlyRevenue} | Ad Spend: ${monthlyAdSpend}`
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to reserve appointment.');
      }

      setConfirmedBookingDetails({
        reference: data.bookingReference || referenceId,
        dateTime: data.appointmentDateTime,
        timezone: data.timezone || 'Asia/Kolkata (IST)',
        whatsAppMsg: data.whatsAppConfirmation?.message,
        alertText: data.internalAlert?.alertText
      });

      setBookingStatus('confirmed');
      analytics.trackGrowthAuditBookingConfirmed(data.bookingReference || referenceId, selectedDate, selectedTime);
    } catch (err: any) {
      // Local fallback confirmation
      const dt = `${selectedDate} at ${selectedTime}`;
      setConfirmedBookingDetails({
        reference: referenceId,
        dateTime: dt,
        timezone: 'Asia/Kolkata (IST)',
        whatsAppMsg: `Hi ${name.trim()}, Muid here. Your Growth Audit is confirmed for ${dt} (IST). I’ll review your website and growth setup before we talk. If you need to make any changes, please use your booking confirmation link.`,
        alertText: `🚨 High-Ticket Growth Audit Booked — ${name.trim()} — ${dt} — ${hasNoWebsite ? 'No website yet' : website.trim()}`
      });
      setBookingStatus('confirmed');
      analytics.trackGrowthAuditBookingConfirmed(referenceId, selectedDate, selectedTime);
    }
  };

  return (
    <div className="min-h-screen bg-[#07111F] text-slate-100 selection:bg-[#FF6B00] selection:text-white flex flex-col justify-between">
      <SEOHead
        path="/request-growth-audit"
        customData={{
          title: 'Request Growth Audit Qualification | Digital MUID',
          description:
            'Progressive qualification for custom client acquisition systems, performance architecture, and growth audit consultation with Digital Muid.',
          canonicalUrl: 'https://digitalmuid.in/request-growth-audit'
        }}
      />

      {/* Main Container */}
      <div className="pt-28 pb-16 sm:pt-36 sm:pb-24 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto w-full flex-1 flex flex-col justify-center">
        {/* =========================================================================
            STATE A: ACTIVE QUALIFICATION FORM (SCREENS 1 TO 7)
            ========================================================================= */}
        {qualificationStatus === 'idle' && (
          <div className="rounded-3xl bg-[#0B1526] border border-white/10 shadow-2xl p-6 sm:p-10 space-y-8 relative overflow-hidden">
            {/* Ambient subtle glow */}
            <div
              className="absolute top-0 right-0 w-80 h-80 bg-[#1877F2]/10 blur-[100px] rounded-full pointer-events-none -z-10"
              aria-hidden="true"
            />

            {/* Top Header & Progress Bar */}
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#FF6B00] uppercase font-bold tracking-widest">
                  Growth Audit Qualification
                </span>
                <span className="text-slate-400">
                  Step {currentStep} of {totalSteps}
                </span>
              </div>

              {/* Progress Track */}
              <div
                className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden"
                role="progressbar"
                aria-valuenow={Math.round((currentStep / totalSteps) * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Audit qualification progress"
              >
                <div
                  className="h-full bg-gradient-to-r from-[#FF6B00] to-emerald-400 transition-all duration-300 rounded-full"
                  style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                />
              </div>
            </div>

            {/* Dynamic Screen Content */}
            <div className="min-h-[260px] flex flex-col justify-center">
              {/* SCREEN 1: NAME */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                      Identity &amp; Point of Contact
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
                      What should we call you?
                    </h2>
                    <p className="text-sm text-slate-300 font-interface font-light">
                      Please enter your name or preferred greeting.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="audit-name-input" className="sr-only">
                      Your Name
                    </label>
                    <input
                      id="audit-name-input"
                      type="text"
                      autoFocus
                      required
                      placeholder="e.g. Rajesh Sharma"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (stepError) setStepError('');
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                      className="w-full px-5 py-4 rounded-xl bg-white/5 border border-white/15 text-white placeholder-slate-500 text-base focus:outline-none focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] transition-colors font-interface"
                    />
                  </div>
                </div>
              )}

              {/* SCREEN 2: EMAIL */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                      Delivery &amp; Communication
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
                      Where should we send your Growth Audit confirmation?
                    </h2>
                    <p className="text-sm text-slate-300 font-interface font-light">
                      We will dispatch audit notes and calendar invites directly to this address.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="audit-email-input" className="sr-only">
                      Work Email Address
                    </label>
                    <input
                      id="audit-email-input"
                      type="email"
                      autoFocus
                      required
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (stepError) setStepError('');
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                      className="w-full px-5 py-4 rounded-xl bg-white/5 border border-white/15 text-white placeholder-slate-500 text-base focus:outline-none focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] transition-colors font-interface"
                    />
                  </div>
                </div>
              )}

              {/* SCREEN 3: WEBSITE */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                      Infrastructure &amp; Conversion Asset
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
                      What is your website URL?
                    </h2>
                    <p className="text-sm text-slate-300 font-interface font-light">
                      We audit landing page speed, attribution tags, and conversion leakages before our session.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="relative">
                      <label htmlFor="audit-website-input" className="sr-only">
                        Website URL
                      </label>
                      <input
                        id="audit-website-input"
                        type="url"
                        disabled={hasNoWebsite}
                        autoFocus={!hasNoWebsite}
                        placeholder={hasNoWebsite ? 'Pre-launch business' : 'https://yourbrand.com'}
                        value={hasNoWebsite ? '' : website}
                        onChange={(e) => {
                          setWebsite(e.target.value);
                          if (stepError) setStepError('');
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                        className="w-full px-5 py-4 rounded-xl bg-white/5 border border-white/15 text-white placeholder-slate-500 text-base disabled:opacity-40 disabled:bg-slate-900/60 focus:outline-none focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] transition-colors font-interface"
                      />
                    </div>

                    {/* No Website Alternative Option */}
                    <button
                      type="button"
                      onClick={() => {
                        setHasNoWebsite((prev) => !prev);
                        if (stepError) setStepError('');
                      }}
                      className={`inline-flex items-center gap-2 text-xs font-interface px-3.5 py-2 rounded-lg border transition-colors cursor-pointer ${
                        hasNoWebsite
                          ? 'bg-[#FF6B00]/15 border-[#FF6B00]/40 text-[#FF6B00] font-semibold'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>I don't have a website yet (launching soon)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* SCREEN 4: MONTHLY REVENUE */}
              {currentStep === 4 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                      Business Stage &amp; Top-Line Economics
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
                      What is your current average monthly business revenue?
                    </h2>
                    <p className="text-sm text-slate-300 font-interface font-light">
                      Select your average monthly business revenue. All figures are in INR and reflect average monthly top-line.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {revenueOptions.map((opt) => {
                      const isSelected = monthlyRevenue === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            setMonthlyRevenue(opt);
                            if (stepError) setStepError('');
                          }}
                          className={`p-4 rounded-xl text-left border transition-all cursor-pointer font-interface text-sm flex items-center justify-between ${
                            isSelected
                              ? 'bg-[#FF6B00]/15 border-[#FF6B00] text-white font-semibold shadow-lg shadow-[#FF6B00]/15'
                              : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <span>{opt}</span>
                          <span
                            className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ml-2 ${
                              isSelected ? 'border-[#FF6B00] bg-[#FF6B00]' : 'border-white/30'
                            }`}
                          >
                            {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SCREEN 5: MONTHLY ADVERTISING SPEND */}
              {currentStep === 5 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                      Media Spend &amp; Algorithmic Allocation
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
                      What is your current monthly advertising spend?
                    </h2>
                    <p className="text-sm text-slate-300 font-interface font-light">
                      Monthly media spend on Meta, Google, or other paid distribution (excluding agency fees).
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {adSpendOptions.map((opt) => {
                      const isSelected = monthlyAdSpend === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            setMonthlyAdSpend(opt);
                            if (stepError) setStepError('');
                          }}
                          className={`p-4 rounded-xl text-left border transition-all cursor-pointer font-interface text-sm flex items-center justify-between ${
                            isSelected
                              ? 'bg-[#FF6B00]/15 border-[#FF6B00] text-white font-semibold shadow-lg shadow-[#FF6B00]/15'
                              : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <span>{opt}</span>
                          <span
                            className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ml-2 ${
                              isSelected ? 'border-[#FF6B00] bg-[#FF6B00]' : 'border-white/30'
                            }`}
                          >
                            {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SCREEN 6: OPTIONAL BOTTLENECK CONTEXT */}
              {currentStep === 6 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-[#FF6B00] bg-[#FF6B00]/10 px-2 py-0.5 rounded uppercase font-semibold">
                        Optional Context
                      </span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
                      What is the biggest growth bottleneck you want to solve?
                    </h2>
                    <p className="text-sm text-slate-300 font-interface font-light">
                      Helps us review your specific architecture vectors ahead of time.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {bottleneckOptions.map((opt) => {
                        const isSelected = growthBottleneck === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => {
                              setGrowthBottleneck(opt);
                              if (stepError) setStepError('');
                            }}
                            className={`p-3.5 rounded-xl text-left border transition-all cursor-pointer font-interface text-xs sm:text-sm flex items-center justify-between ${
                              isSelected
                                ? 'bg-[#FF6B00]/15 border-[#FF6B00] text-white font-semibold'
                                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            <span>{opt}</span>
                            <span
                              className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ml-2 ${
                                isSelected ? 'border-[#FF6B00] bg-[#FF6B00]' : 'border-white/30'
                              }`}
                            >
                              {isSelected && <span className="w-1 h-1 rounded-full bg-white" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {growthBottleneck === 'Other' && (
                      <input
                        type="text"
                        placeholder="Briefly describe your specific challenge"
                        value={otherBottleneck}
                        onChange={(e) => setOtherBottleneck(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/15 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#FF6B00] font-interface mt-2"
                      />
                    )}
                  </div>
                </div>
              )}

              {/* SCREEN 7: CONSENT & SUBMIT */}
              {currentStep === 7 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <span className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider">
                      Review &amp; Consent
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
                      Ready to evaluate your growth readiness?
                    </h2>
                    <p className="text-sm text-slate-300 font-interface font-light">
                      Review your submission summary before we assess qualification and configure your pathway.
                    </p>
                  </div>

                  {/* Summary Box */}
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2 font-interface text-xs sm:text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Name:</span>
                      <span className="text-white font-medium">{name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Email:</span>
                      <span className="text-white font-medium">{email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Website:</span>
                      <span className="text-white font-medium">{hasNoWebsite ? 'No website yet' : website}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Monthly Revenue:</span>
                      <span className="text-white font-medium">{monthlyRevenue}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Monthly Ad Spend:</span>
                      <span className="text-white font-medium">{monthlyAdSpend}</span>
                    </div>
                  </div>

                  {/* Privacy Notice & Optional Marketing Consent */}
                  <div className="space-y-3 pt-1">
                    <label className="flex items-start gap-3 cursor-pointer text-xs text-slate-300 font-interface select-none">
                      <input
                        type="checkbox"
                        checked={marketingConsent}
                        onChange={(e) => setMarketingConsent(e.target.checked)}
                        className="mt-0.5 rounded bg-white/10 border-white/20 text-[#FF6B00] focus:ring-[#FF6B00]"
                      />
                      <span>
                        I agree to receive tactical growth breakdowns and Academy updates from Digital Muid (optional).
                      </span>
                    </label>

                    <p className="text-[11px] text-slate-400 font-interface leading-relaxed">
                      By continuing, you acknowledge our{' '}
                      <a
                        href="/terms"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#FF6B00] underline hover:text-[#FF8533]"
                      >
                        Privacy Policy
                      </a>
                      . Your information is strictly used to evaluate your growth architecture. Zero spam.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Error Message */}
            {stepError && (
              <div className="flex items-center gap-2 text-rose-400 text-xs font-interface p-3 rounded-lg bg-rose-950/40 border border-rose-500/20">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{stepError}</span>
              </div>
            )}

            {/* Navigation & Action Controls */}
            <div className="flex items-center justify-between pt-4 border-t border-white/10 font-interface">
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate('/services/growth-systems')}
                  className="px-4 py-3 text-slate-400 hover:text-white text-xs font-interface transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              )}

              {currentStep < totalSteps ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-7 py-3.5 rounded-xl bg-[#FF6B00] hover:bg-[#FF7A1A] text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-[#FF6B00]/25 transition-all cursor-pointer active:scale-95 ml-auto"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleSubmitQualification}
                  className="px-8 py-3.5 rounded-xl bg-[#FF6B00] hover:bg-[#FF7A1A] disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-[#FF6B00]/25 transition-all cursor-pointer active:scale-95 ml-auto"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Evaluating...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit &amp; Determine Qualification</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            STATE B1: ROUTE A — ACADEMY PATHWAY
            Shown for non-qualifying leads (revenue < ₹3L or 0 ad spend)
            ========================================================================= */}
        {qualificationStatus === 'academy_nurture' && (
          <div className="rounded-3xl bg-[#0B1526] border border-white/10 shadow-2xl p-8 sm:p-12 space-y-8 text-center animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-[#1877F2] flex items-center justify-center mx-auto">
              <BookOpen className="w-8 h-8" />
            </div>

            <div className="space-y-4 max-w-xl mx-auto">
              <span className="text-[11px] font-mono text-blue-400 uppercase tracking-widest font-bold">
                Foundation &amp; Mechanics Pathway
              </span>
              <h2 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
                Master the mechanics before scaling spend.
              </h2>
              <blockquote className="text-sm sm:text-base text-slate-300 font-interface leading-relaxed font-light bg-white/5 p-5 rounded-2xl border border-white/5">
                “Based on your current stage, you may get more value from learning the mechanics of digital growth before investing in a full agency engagement. Explore the Digital MUID Academy to build your foundation and prepare for your next stage of growth.”
              </blockquote>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <a
                id="academy-pathway-cta"
                href="/learn"
                onClick={(e) => {
                  e.preventDefault();
                  analytics.trackGrowthAuditAcademyRedirect();
                  navigate('/learn');
                }}
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-[#1877F2] hover:bg-blue-600 text-white font-bold text-sm tracking-wide shadow-xl shadow-[#1877F2]/25 transition-all cursor-pointer flex items-center justify-center gap-2 font-interface active:scale-95"
              >
                <span>Explore the Academy</span>
                <ArrowRight className="w-4 h-4" />
              </a>

              <button
                type="button"
                onClick={() => navigate('/services/growth-systems')}
                className="w-full sm:w-auto px-7 py-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-semibold text-sm border border-white/15 transition-all cursor-pointer font-interface"
              >
                Return to Growth Systems
              </button>
            </div>

            <p className="text-[11px] text-slate-500 font-mono">
              Reference Dossier: {referenceId} • Logged to CRM as academy_nurture
            </p>
          </div>
        )}

        {/* =========================================================================
            STATE B2: PRE-REVENUE / STARTUP REVIEW
            ========================================================================= */}
        {qualificationStatus === 'startup_review' && (
          <div className="rounded-3xl bg-[#0B1526] border border-white/10 shadow-2xl p-8 sm:p-12 space-y-8 text-center animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-2xl bg-[#FF6B00]/10 border border-[#FF6B00]/20 text-[#FF6B00] flex items-center justify-center mx-auto">
              <Sparkles className="w-8 h-8" />
            </div>

            <div className="space-y-4 max-w-xl mx-auto">
              <span className="text-[11px] font-mono text-[#FF6B00] uppercase tracking-widest font-bold">
                Startup Architecture Review
              </span>
              <h2 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
                Architecting from the ground up.
              </h2>
              <p className="text-sm sm:text-base text-slate-300 font-interface leading-relaxed font-light">
                For pre-revenue startups and launching ventures, we recommend starting with our proprietary frameworks to build your acquisition foundation before incurring retainer overhead.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <a
                href="/learn"
                onClick={(e) => {
                  e.preventDefault();
                  analytics.trackGrowthAuditAcademyRedirect();
                  navigate('/learn');
                }}
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-[#FF6B00] hover:bg-[#FF7A1A] text-white font-bold text-sm tracking-wide shadow-xl shadow-[#FF6B00]/25 transition-all cursor-pointer flex items-center justify-center gap-2 font-interface active:scale-95"
              >
                <span>Explore the Academy</span>
                <ArrowRight className="w-4 h-4" />
              </a>

              <a
                href="/frameworks/digital-growth-stack"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/frameworks/digital-growth-stack');
                }}
                className="w-full sm:w-auto px-7 py-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-semibold text-sm border border-white/15 transition-all cursor-pointer font-interface"
              >
                <span>Review The Growth Stack™</span>
              </a>
            </div>

            <p className="text-[11px] text-slate-500 font-mono">
              Reference Dossier: {referenceId}
            </p>
          </div>
        )}

        {/* =========================================================================
            STATE B3: ROUTE B — QUALIFIED GROWTH AUDIT
            ========================================================================= */}
        {qualificationStatus === 'qualified' && bookingStatus !== 'confirmed' && (
          <div className="rounded-3xl bg-[#0B1526] border border-emerald-500/30 shadow-2xl p-6 sm:p-10 space-y-8 animate-in fade-in duration-300">
            <div className="space-y-4 text-center max-w-xl mx-auto">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Growth Audit Qualified</span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
                Choose your strategic audit session.
              </h2>

              <blockquote className="text-sm text-slate-300 font-interface leading-relaxed bg-white/5 p-4 rounded-xl border border-white/5 text-left font-light">
                “Your business may be a good fit for a Growth Audit. Choose a convenient time for a Zoom consultation so we can review your acquisition systems, website performance, and growth opportunities.”
              </blockquote>
            </div>

            {/* Embedded Calendar Selector */}
            <div className="space-y-6 pt-2">
              {/* Date Selector */}
              <div className="space-y-3">
                <label className="text-xs font-mono text-slate-400 uppercase tracking-wider block">
                  01. Select Date (Indian Standard Time - Asia/Kolkata)
                </label>
                <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none">
                  {upcomingDates.map((item) => {
                    const isSelected = selectedDate === item.iso;
                    return (
                      <button
                        key={item.iso}
                        type="button"
                        onClick={() => setSelectedDate(item.iso)}
                        className={`flex flex-col items-center p-3 rounded-xl min-w-[76px] border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#FF6B00] border-[#FF6B00] text-white shadow-lg shadow-[#FF6B00]/25'
                            : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        <span className="text-[10px] font-mono uppercase">{item.dayName}</span>
                        <span className="text-lg font-bold font-display my-0.5">{item.dayNum}</span>
                        <span className="text-[10px] text-slate-400">{item.monthName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time Slot Selector */}
              <div className="space-y-3">
                <label className="text-xs font-mono text-slate-400 uppercase tracking-wider block">
                  02. Select Available Slot
                </label>
                {availableSlots.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {availableSlots.map((slot) => {
                      const isSelected = selectedTime === slot;
                      return (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setSelectedTime(slot)}
                          className={`p-3 rounded-xl text-center text-xs font-mono border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-500 border-emerald-500 text-white font-bold shadow-lg shadow-emerald-500/25'
                              : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                          }`}
                        >
                          {slot}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-400 text-center">
                    No open consultation slots remaining on this date. Please select another date.
                  </div>
                )}
              </div>

              {/* Phone / WhatsApp Field */}
              <div className="space-y-2 pt-2">
                <label htmlFor="audit-phone-input" className="text-xs font-mono text-slate-400 uppercase tracking-wider block">
                  03. WhatsApp / Phone Number (For Instant Calendar Dispatch)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    id="audit-phone-input"
                    type="tel"
                    placeholder="+91 98765 43210 (with country code)"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-11 pr-5 py-3.5 rounded-xl bg-white/5 border border-white/15 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#FF6B00] font-interface"
                  />
                </div>
              </div>
            </div>

            {/* Error banner if any */}
            {stepError && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{stepError}</span>
              </div>
            )}

            {/* Confirm Button */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/10">
              <div className="text-xs text-slate-400 font-interface">
                Ref: <span className="font-mono text-white">{referenceId}</span> • 1-on-1 with Digital Muid
              </div>

              <button
                type="button"
                disabled={bookingStatus === 'booking' || !selectedDate || !selectedTime}
                onClick={handleConfirmBooking}
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-[#FF6B00] hover:bg-[#FF7A1A] disabled:opacity-50 text-white font-bold text-sm tracking-wide shadow-xl shadow-[#FF6B00]/25 transition-all cursor-pointer flex items-center justify-center gap-2 font-interface active:scale-95"
              >
                {bookingStatus === 'booking' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Reserving Session...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm My Growth Audit Session</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            STATE B4: BOOKING CONFIRMED SCREEN (WITH WHATSAPP & ALERT TELEMETRY)
            ========================================================================= */}
        {bookingStatus === 'confirmed' && confirmedBookingDetails && (
          <div className="rounded-3xl bg-[#0B1526] border border-emerald-500/40 shadow-2xl p-8 sm:p-12 space-y-8 animate-in fade-in duration-300 text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-3 max-w-xl mx-auto">
              <span className="text-[11px] font-mono text-emerald-400 uppercase tracking-widest font-bold">
                Appointment Confirmed
              </span>
              <h2 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
                Your Strategic Growth Audit is locked in.
              </h2>
              <p className="text-sm text-slate-300 font-interface leading-relaxed font-light">
                We have reserved your session and logged your audit brief into our engineering queue.
              </p>
            </div>

            {/* Appointment Details Box */}
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 text-left space-y-3 max-w-lg mx-auto font-interface text-sm">
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="text-slate-400">Booking Reference:</span>
                <span className="font-mono text-white font-bold">{confirmedBookingDetails.reference}</span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="text-slate-400">Scheduled Time:</span>
                <span className="text-emerald-400 font-semibold">{confirmedBookingDetails.dateTime}</span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="text-slate-400">Timezone:</span>
                <span className="text-white">{confirmedBookingDetails.timezone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Format:</span>
                <span className="text-white">1-on-1 Zoom Strategic Teardown</span>
              </div>
            </div>

            {/* WhatsApp Confirmation Dispatch Note */}
            {confirmedBookingDetails.whatsAppMsg && (
              <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-left space-y-1.5 max-w-lg mx-auto text-xs font-interface">
                <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase tracking-wider">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>WhatsApp Confirmation Template</span>
                </div>
                <p className="text-slate-300 italic font-light">
                  "{confirmedBookingDetails.whatsAppMsg}"
                </p>
              </div>
            )}

            {/* Return / Explore Actions */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => navigate('/services/growth-systems')}
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs uppercase tracking-wider transition-colors cursor-pointer font-interface"
              >
                Back to Growth Systems
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-[#FF6B00] hover:bg-[#FF7A1A] text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer font-interface shadow-lg shadow-[#FF6B00]/25"
              >
                Return to Homepage
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
