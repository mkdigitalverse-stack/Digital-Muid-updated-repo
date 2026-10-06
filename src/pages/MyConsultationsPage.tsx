import React, { useEffect, useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Calendar,
  Clock,
  Video,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ExternalLink,
  CalendarClock,
  ShieldCheck,
  Sparkles,
  Building2,
  Target,
  HelpCircle,
  RefreshCw,
  MessageSquare
} from 'lucide-react';
import { Booking, BookingStatus } from '../types';

interface MyConsultationsPageProps {
  navigate: (path: string) => void;
}

export const MyConsultationsPage: React.FC<MyConsultationsPageProps> = ({ navigate }) => {
  const {
    currentUser,
    isAuthLoading,
    studentBookings,
    isBookingsLoading,
    bookingsError,
    refreshStudentBookings
  } = useApp();

  const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'all'>('upcoming');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Redirect unauthenticated visitors to login
  useEffect(() => {
    if (!isAuthLoading && !currentUser) {
      navigate('/login');
    }
  }, [isAuthLoading, currentUser, navigate]);

  // Load fresh bookings on mount
  useEffect(() => {
    if (currentUser) {
      refreshStudentBookings().catch(() => {});
    }
  }, [currentUser, refreshStudentBookings]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshStudentBookings();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Helper: check if a booking is in the future/today and not finished/cancelled
  const isBookingUpcoming = (b: Booking): boolean => {
    if (b.status === 'cancelled' || b.status === 'completed') {
      return false;
    }
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    return (b.date || '') >= todayStr;
  };

  // Categorize bookings
  const upcomingBookings = useMemo(() => {
    return studentBookings
      .filter(isBookingUpcoming)
      .sort((a, b) => {
        const dateDiff = a.date.localeCompare(b.date);
        if (dateDiff !== 0) return dateDiff;
        return a.time.localeCompare(b.time);
      });
  }, [studentBookings]);

  const pastBookings = useMemo(() => {
    return studentBookings
      .filter((b) => !isBookingUpcoming(b))
      .sort((a, b) => {
        const dateDiff = b.date.localeCompare(a.date);
        if (dateDiff !== 0) return dateDiff;
        return b.time.localeCompare(a.time);
      });
  }, [studentBookings]);

  const displayedBookings = useMemo(() => {
    if (activeTab === 'upcoming') return upcomingBookings;
    if (activeTab === 'past') return pastBookings;
    return studentBookings;
  }, [activeTab, upcomingBookings, pastBookings, studentBookings]);

  const getStatusBadge = (status: BookingStatus) => {
    switch (status) {
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Confirmed
          </span>
        );
      case 'rescheduled':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Rescheduled
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
            <CheckCircle2 className="w-3 h-3 text-blue-600" />
            Completed
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  // Format date readable
  const formatReadableDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        return d.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      }
    } catch {
      // fallback
    }
    return dateStr;
  };

  // Loading skeleton state
  if (isAuthLoading || (isBookingsLoading && studentBookings.length === 0)) {
    return (
      <div className="pt-32 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="h-10 w-64 bg-slate-100 rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
          <div className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
          <div className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
        </div>
        <div className="space-y-4">
          <div className="h-48 bg-slate-100 rounded-3xl animate-pulse" />
          <div className="h-48 bg-slate-100 rounded-3xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <div id="my-consultations-root" className="pt-28 sm:pt-32 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-200">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#1877F2] text-xs font-bold uppercase tracking-wider font-interface">
            <Video className="w-3.5 h-3.5" />
            <span>Advisory & Growth Sessions</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-slate-900 tracking-tight">
            My Consultations
          </h1>
          <p className="text-slate-600 text-sm sm:text-base font-interface max-w-2xl">
            Access your scheduled 1-on-1 strategic consultations with Muid, join private Google Meet sessions, and review advisory notes.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing || isBookingsLoading}
            className="p-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl transition-all cursor-pointer shadow-xs disabled:opacity-50"
            title="Refresh bookings"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing || isBookingsLoading ? 'animate-spin text-[#FF6B00]' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => navigate('/consultation')}
            className="px-5 py-2.5 bg-[#FF6B00] hover:bg-[#e66000] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-sm shadow-[#FF6B00]/20"
          >
            <CalendarClock className="w-4 h-4" />
            <span>Book New Session</span>
          </button>
        </div>
      </div>

      {/* Error Notice */}
      {bookingsError && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <div className="font-bold uppercase tracking-wider">Notice loading consultation data</div>
            <p className="text-amber-800">{bookingsError}</p>
          </div>
        </div>
      )}

      {/* 2. Stat Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-interface">
              Upcoming Sessions
            </span>
            <div className="text-3xl font-display font-bold text-slate-900 font-mono">
              {upcomingBookings.length}
            </div>
            <span className="text-[11px] text-slate-500">Scheduled on calendar</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
            <Calendar className="w-6 h-6" />
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-interface">
              Past / Completed
            </span>
            <div className="text-3xl font-display font-bold text-slate-900 font-mono">
              {pastBookings.length}
            </div>
            <span className="text-[11px] text-slate-500">Completed consultations</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-interface">
              Total Consultations
            </span>
            <div className="text-3xl font-display font-bold text-slate-900 font-mono">
              {studentBookings.length}
            </div>
            <span className="text-[11px] text-slate-500">All-time bookings</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-orange-50 text-[#FF6B00] border border-orange-100 flex items-center justify-center shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 3. Filter Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3 gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('upcoming')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'upcoming'
                ? 'bg-[#0F172A] text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Upcoming ({upcomingBookings.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('past')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'past'
                ? 'bg-[#0F172A] text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Past Sessions ({pastBookings.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-[#0F172A] text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            All ({studentBookings.length})
          </button>
        </div>

        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors hidden sm:block"
        >
          ← Return to Dashboard
        </button>
      </div>

      {/* 4. Bookings List / Empty States */}
      {displayedBookings.length === 0 ? (
        <div className="p-10 sm:p-14 rounded-3xl bg-white border border-slate-200 text-center space-y-5 max-w-xl mx-auto shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-orange-50 border border-orange-100 text-[#FF6B00] flex items-center justify-center mx-auto">
            <CalendarClock className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-display font-bold text-slate-900">
              {studentBookings.length === 0
                ? 'No Consultations Booked Yet'
                : activeTab === 'upcoming'
                ? 'No Upcoming Consultations'
                : 'No Past Consultations Found'}
            </h3>
            <p className="text-slate-600 text-sm font-interface leading-relaxed">
              {studentBookings.length === 0
                ? 'Accelerate your marketing, paid media strategy, and digital systems with a dedicated 1-on-1 strategy consultation directly with Muid.'
                : activeTab === 'upcoming'
                ? 'You do not have any upcoming consultations scheduled on your calendar. You can book a new strategic session anytime.'
                : 'Your consultation history will be tracked here after completing your strategic advisory calls.'}
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => navigate('/consultation')}
              className="px-6 py-3 bg-[#FF6B00] hover:bg-[#e66000] text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all inline-flex items-center gap-2 cursor-pointer shadow-md shadow-[#FF6B00]/20"
            >
              <Video className="w-4 h-4" />
              <span>Book Strategy Session</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {displayedBookings.map((b) => {
            const meetingLink = b.meetUrl;
            const isUpcoming = isBookingUpcoming(b);
            const readableDate = formatReadableDate(b.date);

            return (
              <div
                key={b.id}
                className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-xs hover:shadow-md transition-all space-y-6"
              >
                {/* Top Row: Title, Reference Code, Status */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-slate-100">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-xl sm:text-2xl font-display font-bold text-slate-900">
                        1-on-1 Business Growth Consultation
                      </h3>
                      {getStatusBadge(b.status)}
                    </div>
                    <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
                      <span>Ref:</span>
                      <strong className="text-[#FF6B00]">{b.bookingCode}</strong>
                      <span className="text-slate-300">·</span>
                      <span>Payment:</span>
                      <span className="text-emerald-700 font-semibold uppercase">{b.paymentStatus || 'paid'}</span>
                    </div>
                  </div>

                  {/* Join Room CTA if active */}
                  {isUpcoming && meetingLink && (
                    <a
                      href={meetingLink}
                      target="_blank"
                      rel="noreferrer"
                      className="px-5 py-3 rounded-xl bg-[#1877F2] hover:bg-blue-600 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm shrink-0"
                    >
                      <Video className="w-4 h-4" />
                      <span>Join Google Meet</span>
                      <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                    </a>
                  )}
                </div>

                {/* Session Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <div className="text-xs text-slate-500 flex items-center gap-1.5 font-semibold">
                      <Calendar className="w-4 h-4 text-[#1877F2]" /> Date
                    </div>
                    <div className="text-sm font-bold text-slate-900 font-display">
                      {readableDate}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">{b.date}</div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <div className="text-xs text-slate-500 flex items-center gap-1.5 font-semibold">
                      <Clock className="w-4 h-4 text-[#FF6B00]" /> Time Slot
                    </div>
                    <div className="text-sm font-bold text-slate-900 font-mono">
                      {b.time} IST
                    </div>
                    <div className="text-[11px] text-slate-500">Duration: {b.durationMinutes || 30} mins</div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <div className="text-xs text-slate-500 flex items-center gap-1.5 font-semibold">
                      <Video className="w-4 h-4 text-emerald-600" /> Platform
                    </div>
                    <div className="text-sm font-bold text-slate-900 font-display">
                      Google Meet HD
                    </div>
                    <div className="text-[11px] text-slate-500 truncate max-w-full">
                      {meetingLink ? 'Active Room Link' : 'Provided prior to call'}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <div className="text-xs text-slate-500 flex items-center gap-1.5 font-semibold">
                      <Building2 className="w-4 h-4 text-purple-600" /> Business
                    </div>
                    <div className="text-sm font-bold text-slate-900 truncate">
                      {b.businessName || 'Strategic Advisory'}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {b.customerName}
                    </div>
                  </div>
                </div>

                {/* Challenge & Desired Outcome Brief */}
                {(b.primaryChallenge || b.desiredOutcome) && (
                  <div className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/70 space-y-3 text-xs">
                    {b.primaryChallenge && (
                      <div className="flex items-start gap-2 text-slate-700">
                        <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-slate-900">Primary Focus: </strong>
                          <span>{b.primaryChallenge}</span>
                        </div>
                      </div>
                    )}
                    {b.desiredOutcome && (
                      <div className="flex items-start gap-2 text-slate-700">
                        <Target className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-slate-900">Desired Outcome: </strong>
                          <span>{b.desiredOutcome}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Bottom Row: Meeting Link Display / Action Buttons */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-2 text-slate-500 truncate">
                    <span className="font-semibold text-slate-700 shrink-0">Meeting URL:</span>
                    <span className="font-mono text-slate-600 truncate">
                      {meetingLink || 'Private link configured upon room launch'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {meetingLink && (
                      <a
                        href={meetingLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-bold text-[#1877F2] hover:text-blue-700 flex items-center gap-1.5"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>Open Meet Room</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => navigate('/consultation')}
                      className="text-xs font-bold text-[#FF6B00] hover:text-[#e66000] flex items-center gap-1"
                    >
                      <span>Book Another</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
