import React, { useState } from 'react';
import {
  Award,
  Download,
  ExternalLink,
  Check,
  Copy,
  X,
  Sparkles,
  ShieldCheck,
  Calendar,
  Hash,
  BookOpen
} from 'lucide-react';
import { Certificate } from '../types';
import { downloadCertificatePdf } from '../utils/pdfGenerator';

interface CourseCertificateCelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  certificate: Certificate;
  courseTitle: string;
  recipientName: string;
  navigate?: (path: string) => void;
}

export const CourseCertificateCelebrationModal: React.FC<CourseCertificateCelebrationModalProps> = ({
  isOpen,
  onClose,
  certificate,
  courseTitle,
  recipientName,
  navigate
}) => {
  const [hasCopiedLink, setHasCopiedLink] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  if (!isOpen || !certificate) return null;

  const verificationUrl = `${window.location.origin}/verify-certificate/${certificate.verificationHash}`;

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(verificationUrl);
      } else {
        const input = document.createElement('input');
        input.value = verificationUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setHasCopiedLink(true);
      setTimeout(() => setHasCopiedLink(false), 3000);
    } catch (err) {
      console.warn('Failed to copy verification link:', err);
    }
  };

  const handleDownloadPdf = () => {
    setIsDownloading(true);
    try {
      downloadCertificatePdf({
        certificateNumber: certificate.certificateNumber,
        recipientName: certificate.recipientName || recipientName,
        courseTitle: certificate.courseTitle || courseTitle,
        issuedAt: certificate.issuedAt,
        verificationHash: certificate.verificationHash,
        instructorName: certificate.metadata?.instructorName || 'Digital Muid',
        courseDuration: certificate.metadata?.courseDuration || 'Comprehensive',
        verificationUrl
      });
    } catch (err) {
      console.error('Error downloading certificate PDF:', err);
    } finally {
      setTimeout(() => setIsDownloading(false), 600);
    }
  };

  const formattedDate = (() => {
    try {
      const d = new Date(certificate.issuedAt);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        });
      }
    } catch {}
    return 'Recently Issued';
  })();

  return (
    <div
      id="certificate-celebration-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-[#0B132B] border border-amber-500/30 rounded-3xl shadow-2xl overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative Top Amber/Gold Gradient Glow */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-400 via-[#FF6B00] to-yellow-500" />
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer z-10"
          aria-label="Close celebration modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 sm:p-10 space-y-8">
          {/* Header Badge & Title */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-400 text-xs font-bold uppercase tracking-widest shadow-inner">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>Milestone Achieved • 100% Completed</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
              Congratulations, {recipientName}!
            </h2>

            <p className="text-slate-300 text-sm font-interface max-w-lg mx-auto leading-relaxed">
              You have successfully completed all modules and lesson requirements for{' '}
              <span className="font-semibold text-white underline decoration-amber-500/50 underline-offset-2">
                {courseTitle}
              </span>
              . Your official Certificate of Completion has been issued.
            </p>
          </div>

          {/* Certificate Credential Preview Card */}
          <div className="relative rounded-2xl bg-gradient-to-b from-[#0F1D38] to-[#091024] border border-amber-500/30 p-6 sm:p-7 shadow-lg space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                    Digital Muid Academy
                  </div>
                  <div className="text-sm font-bold text-white">
                    Verified Credential of Completion
                  </div>
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Authentic Record</span>
              </div>
            </div>

            <div className="space-y-1.5 text-center sm:text-left">
              <div className="text-xs text-slate-400 uppercase tracking-wider font-interface">
                Awarded To
              </div>
              <div className="text-xl sm:text-2xl font-bold font-display text-white">
                {recipientName}
              </div>
              <div className="text-xs text-amber-300/90 font-medium">
                For completion of {courseTitle}
              </div>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-white/10 text-xs">
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase tracking-wider font-bold mb-1">
                  <Hash className="w-3 h-3 text-amber-400" />
                  <span>Credential ID</span>
                </div>
                <div className="font-mono font-semibold text-white truncate">
                  {certificate.certificateNumber}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase tracking-wider font-bold mb-1">
                  <Calendar className="w-3 h-3 text-amber-400" />
                  <span>Issued On</span>
                </div>
                <div className="font-medium text-white truncate">
                  {formattedDate}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase tracking-wider font-bold mb-1">
                  <ShieldCheck className="w-3 h-3 text-amber-400" />
                  <span>Verification Hash</span>
                </div>
                <div className="font-mono font-semibold text-amber-300 truncate">
                  {certificate.verificationHash}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            {/* Primary Action: Download PDF */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-[#FF6B00] to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-orange-500/20 active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>{isDownloading ? 'Preparing Document...' : 'Download Certificate (PDF)'}</span>
            </button>

            {/* Secondary Action: Copy Verification Link */}
            <button
              type="button"
              onClick={handleCopyLink}
              className="w-full sm:w-auto px-5 py-3.5 bg-white/10 hover:bg-white/15 text-white border border-white/10 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              {hasCopiedLink ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">Link Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-300" />
                  <span>Copy Verification Link</span>
                </>
              )}
            </button>

            {/* Public Verify Link */}
            {navigate && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate(`/verify-certificate/${certificate.verificationHash}`);
                }}
                className="w-full sm:w-auto px-4 py-3.5 text-slate-400 hover:text-white rounded-xl text-xs font-semibold tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Verify Online</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Return & Footer Info */}
          <div className="flex items-center justify-between pt-4 border-t border-white/10 text-xs text-slate-400">
            <span>This credential is permanently saved to your account.</span>
            {navigate && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate('/my-courses?tab=certificates');
                }}
                className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>View All In My Courses</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
