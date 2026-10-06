import React from 'react';
import { CheckCircle2, Calendar, Clock, Video, Download, ArrowRight, ShieldCheck, Mail } from 'lucide-react';
import { Booking } from '../types';
import { useApp } from '../context/AppContext';

interface ConsultationConfirmationPageProps {
  booking: Booking | null;
  navigate: (path: string) => void;
}

export const ConsultationConfirmationPage: React.FC<ConsultationConfirmationPageProps> = ({
  booking,
  navigate
}) => {
  const { bookings } = useApp();
  const currentBooking = booking || bookings[0];

  if (!currentBooking) {
    return (
      <div className="pt-32 pb-24 text-center space-y-4">
        <h1 className="text-2xl font-bold text-white">No active booking found</h1>
        <button onClick={() => navigate('/consultation')} className="text-[#FF6B00] underline">
          Book a consultation
        </button>
      </div>
    );
  }

  const meetingUrl = currentBooking.meetUrl || (currentBooking as any).meetingLink || '';
  const baseFee = currentBooking.baseAmount ?? (currentBooking as any).basePrice ?? 0;

  const handleDownloadCalendar = () => {
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Digital Muid//Consultation Session//EN
BEGIN:VEVENT
SUMMARY:Strategic Consultation with Digital Muid
DESCRIPTION:Focus on ${currentBooking.primaryChallenge}\\nGoogle Meet: ${meetingUrl}
DTSTART:${currentBooking.date.replace(/-/g, '')}T${currentBooking.time.replace(':', '')}00Z
DURATION:PT30M
LOCATION:Google Meet (${meetingUrl})
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Digital-Muid-Consultation-${currentBooking.bookingCode}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="consultation-confirmation-root" className="pt-28 sm:pt-32 pb-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
      {/* Success Badge & Headline */}
      <div className="text-center space-y-4">
        <div className="w-20 h-20 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-sm border border-emerald-200">
          <CheckCircle2 className="w-12 h-12" />
        </div>
        <div className="space-y-1">
          <span className="text-xs font-mono font-bold text-emerald-700 uppercase tracking-widest">
            Payment Verified · Booking Confirmed
          </span>
          <h1 className="text-3xl sm:text-5xl font-display font-bold text-slate-900 tracking-tight">
            You're On Muid's Calendar!
          </h1>
          <p className="text-slate-600 text-sm sm:text-base font-interface max-w-lg mx-auto">
            A confirmation receipt and Google Calendar invitation have been dispatched to <strong>{currentBooking.customerEmail}</strong>.
          </p>
        </div>
      </div>

      {/* Booking Details Card */}
      <div className="p-8 rounded-3xl bg-white border border-slate-200 space-y-6 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Booking Reference</div>
            <div className="text-2xl font-mono font-bold text-[#FF6B00]">{currentBooking.bookingCode}</div>
          </div>
          <div className="text-left sm:text-right">
            <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Payment Transaction ID</div>
            <div className="text-sm font-mono text-slate-700 font-medium">{currentBooking.paymentId}</div>
          </div>
        </div>

        {/* Schedule & Meeting Link */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="text-xs text-slate-500 flex items-center gap-1.5 font-semibold">
              <Calendar className="w-4 h-4 text-[#1877F2]" /> Date
            </div>
            <div className="text-base font-bold text-slate-900 font-display">{currentBooking.date}</div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="text-xs text-slate-500 flex items-center gap-1.5 font-semibold">
              <Clock className="w-4 h-4 text-[#FF6B00]" /> Time Slot
            </div>
            <div className="text-base font-bold text-slate-900 font-mono">{currentBooking.time} IST</div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="text-xs text-slate-500 flex items-center gap-1.5 font-semibold">
              <Video className="w-4 h-4 text-emerald-600" /> Platform
            </div>
            <div className="text-base font-bold text-slate-900 font-display">Google Meet HD</div>
          </div>
        </div>

        {/* Meeting Link Callout */}
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <div className="text-xs font-bold uppercase tracking-wider text-[#1877F2]">Private Video Room Link</div>
            <div className="font-mono text-sm text-slate-900 font-semibold break-all">
              {meetingUrl || 'Google Meet link will be provided prior to session'}
            </div>
          </div>
          {meetingUrl ? (
            <a
              href={meetingUrl}
              target="_blank"
              rel="noreferrer"
              className="px-5 py-2.5 rounded-xl bg-[#1877F2] hover:bg-blue-600 text-white font-bold text-xs transition-all flex items-center gap-2 shadow-sm shrink-0"
            >
              <Video className="w-4 h-4" />
              <span>Join Room Preview</span>
            </a>
          ) : null}
        </div>

        {/* Tax Invoice Summary */}
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
          <div className="font-bold text-slate-900 uppercase tracking-wider text-xs pb-1 border-b border-slate-200">
            Official Tax Invoice
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Billed Client:</span>
            <span className="text-slate-900 font-medium">{currentBooking.customerName} ({currentBooking.businessName})</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Base Fee:</span>
            <span className="font-mono text-slate-900">₹{baseFee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>GST (18%):</span>
            <span className="font-mono text-slate-900">₹{currentBooking.gstAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-200">
            <span className="text-emerald-700">Total Paid (Razorpay):</span>
            <span className="font-mono text-emerald-700 font-bold">₹{currentBooking.totalAmount.toFixed(2)} {currentBooking.currency}</span>
          </div>
        </div>

        {/* Download Calendar Invite Button */}
        <div className="flex flex-col sm:flex-row gap-4 pt-2">
          <button
            onClick={handleDownloadCalendar}
            className="flex-1 py-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border border-slate-300 shadow-xs"
          >
            <Download className="w-4 h-4" />
            <span>Download .ICS Calendar File</span>
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex-1 py-3.5 rounded-xl bg-[#1877F2] hover:bg-blue-600 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
          >
            <span>Return to Homepage</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Session Preparation Checklist */}
      <div className="p-7 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-lg font-display font-bold text-slate-900">How to Get the Most Out of Your 30 Minutes</h3>
        <ul className="space-y-2.5 text-xs sm:text-sm text-slate-700 font-interface">
          <li className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#FF6B00] shrink-0 mt-0.5" />
            <span>Have key metrics ready (current traffic, CAC, conversion rates, and revenue target).</span>
          </li>
          <li className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#FF6B00] shrink-0 mt-0.5" />
            <span>Be ready to share screen if you want Muid to audit your live funnel or ad accounts.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#FF6B00] shrink-0 mt-0.5" />
            <span>Ensure you are in a quiet environment with a working microphone and camera.</span>
          </li>
        </ul>
      </div>
    </div>
  );
};
