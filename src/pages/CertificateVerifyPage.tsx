import React, { useEffect, useState } from 'react';
import {
  Award,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Download,
  Calendar,
  Hash,
  Search,
  ExternalLink,
  ArrowLeft,
  BookOpen,
  Share2,
  Check,
  Loader2
} from 'lucide-react';
import { certificateService } from '../services';
import { Certificate } from '../types';
import { downloadCertificatePdf } from '../utils/pdfGenerator';

interface CertificateVerifyPageProps {
  code?: string;
  navigate: (path: string) => void;
}

export const CertificateVerifyPage: React.FC<CertificateVerifyPageProps> = ({ code = '', navigate }) => {
  const [searchCode, setSearchCode] = useState(code);
  const [activeCode, setActiveCode] = useState(code);
  const [isLoading, setIsLoading] = useState(false);
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasCopiedShare, setHasCopiedShare] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // When initial code or URL changes, trigger verification lookup
  useEffect(() => {
    if (code) {
      setSearchCode(code);
      setActiveCode(code);
    }
  }, [code]);

  useEffect(() => {
    if (!activeCode || !activeCode.trim()) {
      setCertificate(null);
      setErrorMessage(null);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setErrorMessage(null);

    certificateService.fetchCertificateByCode(activeCode.trim())
      .then((res) => {
        if (!isMounted) return;
        if (res.data) {
          setCertificate(res.data);
          setErrorMessage(null);
        } else {
          setCertificate(null);
          setErrorMessage(res.error || 'No verified certificate found matching this credential identifier.');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setCertificate(null);
        setErrorMessage(err?.message || 'Unable to connect to credential registry.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeCode]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchCode.trim()) {
      setActiveCode(searchCode.trim());
      // Update browser URL without reloading
      window.history.pushState({}, '', `/verify-certificate/${encodeURIComponent(searchCode.trim())}`);
    }
  };

  const handleCopyShareLink = async () => {
    try {
      const shareUrl = window.location.href;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const input = document.createElement('input');
        input.value = shareUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setHasCopiedShare(true);
      setTimeout(() => setHasCopiedShare(false), 3000);
    } catch (err) {
      console.warn('Could not copy share link:', err);
    }
  };

  const handleDownloadPdf = () => {
    if (!certificate) return;
    setIsDownloading(true);
    try {
      downloadCertificatePdf({
        certificateNumber: certificate.certificateNumber,
        recipientName: certificate.recipientName,
        courseTitle: certificate.courseTitle,
        issuedAt: certificate.issuedAt,
        verificationHash: certificate.verificationHash,
        instructorName: certificate.metadata?.instructorName || 'Digital Muid',
        courseDuration: certificate.metadata?.courseDuration || 'Comprehensive'
      });
    } catch (err) {
      console.error('Error downloading certificate PDF:', err);
    } finally {
      setTimeout(() => setIsDownloading(false), 600);
    }
  };

  const formattedDate = (() => {
    if (!certificate?.issuedAt) return '';
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
    return certificate.issuedAt;
  })();

  return (
    <div id="certificate-verify-root" className="min-h-screen bg-slate-50 pt-28 sm:pt-32 pb-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Back Link */}
        <div>
          <button
            type="button"
            onClick={() => navigate('/learn')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#FF6B00] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Explore Digital Muid Academy</span>
          </button>
        </div>

        {/* Header Hero */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100/80 border border-orange-200 text-[#FF6B00] text-xs font-bold uppercase tracking-widest">
            <ShieldCheck className="w-3.5 h-3.5 text-[#FF6B00]" />
            <span>Digital Muid Credential Registry</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 tracking-tight">
            Verify Course Certificate
          </h1>

          <p className="text-slate-600 text-sm font-interface leading-relaxed">
            Authoritative public verification portal for official Digital Muid executive masterclass certificates of completion.
          </p>
        </div>

        {/* Verification Lookup Input Bar */}
        <form onSubmit={handleSearchSubmit} className="max-w-2xl mx-auto">
          <div className="relative flex items-center shadow-sm rounded-2xl overflow-hidden bg-white border border-slate-300 focus-within:border-[#FF6B00] focus-within:ring-2 focus-within:ring-orange-500/20 transition-all">
            <div className="pl-4 text-slate-400">
              <Search className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              placeholder="Enter Certificate ID or Verification Code (e.g. DM-2026-12345 or DMV-XXXXX)"
              className="w-full px-3 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none font-interface"
              aria-label="Certificate Code or ID"
            />
            <button
              type="submit"
              disabled={isLoading || !searchCode.trim()}
              className="m-1.5 px-5 py-2.5 bg-[#0F172A] hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed shrink-0"
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <span>Verify</span>
              )}
            </button>
          </div>
        </form>

        {/* State: Loading */}
        {isLoading && (
          <div className="max-w-2xl mx-auto p-12 bg-white rounded-3xl border border-slate-200 text-center space-y-4 shadow-sm">
            <Loader2 className="w-8 h-8 text-[#FF6B00] animate-spin mx-auto" />
            <div className="space-y-1">
              <div className="text-sm font-bold text-slate-900 font-display">
                Querying Official Registry...
              </div>
              <p className="text-xs text-slate-500">
                Verifying cryptographic checksum and certificate issuance status.
              </p>
            </div>
          </div>
        )}

        {/* State: Verified Certificate Found */}
        {!isLoading && certificate && (
          <div className="max-w-3xl mx-auto bg-white rounded-3xl border-2 border-emerald-500/40 shadow-xl overflow-hidden animate-fadeIn">
            {/* Top Verification Status Bar */}
            <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-6 h-6 text-white shrink-0" />
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-emerald-100">
                    Authentic Verified Credential
                  </div>
                  <div className="text-sm font-semibold">
                    Registered in Digital Muid Academy
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCopyShareLink}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {hasCopiedShare ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-200" />
                    <span>Link Copied</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share Credential</span>
                  </>
                )}
              </button>
            </div>

            {/* Certificate Presentation Document Preview */}
            <div className="p-6 sm:p-10 space-y-8">
              <div className="border-4 border-double border-amber-500/30 rounded-2xl p-6 sm:p-8 bg-gradient-to-b from-amber-50/20 to-white text-center space-y-6 relative">
                {/* Seal Icon */}
                <div className="w-16 h-16 rounded-full bg-amber-500/10 border-2 border-amber-500/30 text-amber-600 flex items-center justify-center mx-auto shadow-inner">
                  <Award className="w-8 h-8 text-[#FF6B00]" />
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-bold tracking-widest text-amber-700 uppercase">
                    Digital Muid Academy • Executive Masterclass Series
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 tracking-tight">
                    Certificate of Completion
                  </h2>
                </div>

                <div className="space-y-1 max-w-lg mx-auto">
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                    This certifies that
                  </p>
                  <p className="text-2xl sm:text-3xl font-display font-bold text-slate-900 text-[#0F172A]">
                    {certificate.recipientName}
                  </p>
                  <p className="text-xs text-slate-600 pt-2 leading-relaxed">
                    has successfully satisfied all rigorous curriculum modules, hands-on frameworks, and project requirements for:
                  </p>
                  <p className="text-lg sm:text-xl font-display font-bold text-[#FF6B00] pt-1">
                    {certificate.courseTitle}
                  </p>
                </div>

                {/* Document Metadata Badges */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6 border-t border-slate-200 text-left text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                    <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-0.5">
                      <Hash className="w-3 h-3 text-[#FF6B00]" />
                      <span>Credential ID</span>
                    </div>
                    <div className="font-mono font-bold text-slate-800 truncate">
                      {certificate.certificateNumber}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                    <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-0.5">
                      <Calendar className="w-3 h-3 text-[#FF6B00]" />
                      <span>Issued On</span>
                    </div>
                    <div className="font-semibold text-slate-800 truncate">
                      {formattedDate}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                    <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-0.5">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      <span>Verification Code</span>
                    </div>
                    <div className="font-mono font-bold text-emerald-700 truncate">
                      {certificate.verificationHash}
                    </div>
                  </div>
                </div>

                {/* Signatory Footnote */}
                <div className="pt-4 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100">
                  <div className="text-left">
                    <span className="font-bold text-slate-800">Digital Muid</span>
                    <p className="text-[11px] text-slate-400">Founder & Lead Strategic Advisor</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1 justify-end">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Cryptographically Verified
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={isDownloading}
                  className="w-full sm:w-auto px-6 py-3 bg-[#0F172A] hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95"
                >
                  <Download className="w-4 h-4 text-[#FF6B00]" />
                  <span>{isDownloading ? 'Downloading...' : 'Download Official PDF'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/learn')}
                  className="w-full sm:w-auto px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <BookOpen className="w-4 h-4 text-slate-500" />
                  <span>Explore Course Curriculum</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* State: Not Found / Error */}
        {!isLoading && errorMessage && activeCode && (
          <div className="max-w-2xl mx-auto p-8 sm:p-10 bg-white rounded-3xl border border-red-200 text-center space-y-5 shadow-sm animate-fadeIn">
            <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-900 font-display">
                Certificate Record Not Found
              </h3>
              <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                {errorMessage}
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 text-left space-y-2">
              <div className="font-bold text-slate-800">Verification Guidelines:</div>
              <ul className="list-disc pl-4 space-y-1 text-slate-500 text-[11px]">
                <li>Confirm the certificate ID or verification code matches the document exactly.</li>
                <li>Check for any missing prefix characters like <code className="bg-slate-200 px-1 py-0.5 rounded">DM-</code> or <code className="bg-slate-200 px-1 py-0.5 rounded">DMV-</code>.</li>
                <li>If you recently completed a course, please ensure 100% of all lesson modules have been finalized.</li>
              </ul>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => navigate('/contact')}
                className="text-xs font-bold text-[#FF6B00] hover:text-orange-700 transition-colors cursor-pointer"
              >
                Contact Digital Muid Support for Credential Verification Assistance &rarr;
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
