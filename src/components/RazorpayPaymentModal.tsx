import React, { useState } from 'react';
import { ShieldCheck, Lock, CheckCircle2, AlertTriangle, ArrowRight, CreditCard, Sparkles, X } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface RazorpayPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingDetails: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    businessName: string;
    primaryChallenge: string;
    desiredOutcome: string;
    website?: string;
    linkedin?: string;
    date: string;
    time: string;
  };
  onPaymentSuccess: (paymentId: string) => void;
}

export const RazorpayPaymentModal: React.FC<RazorpayPaymentModalProps> = ({
  isOpen,
  onClose,
  bookingDetails,
  onPaymentSuccess
}) => {
  const { consultationProduct, settings } = useApp();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [upiId, setUpiId] = useState('user@okhdfcbank');

  if (!isOpen) return null;

  const basePrice = consultationProduct.basePrice;
  const gstRate = consultationProduct.gstRate;
  const gstAmount = Number((basePrice * gstRate).toFixed(2));
  const totalAmount = Number((basePrice + gstAmount).toFixed(2));

  const handlePayNow = () => {
    setIsProcessing(true);
    // Simulate Razorpay Gateway authorization and cryptographic server-side verification
    setTimeout(() => {
      setIsProcessing(false);
      const generatedPayId = `pay_${Math.random().toString(36).substring(2, 12).toUpperCase()}`;
      onPaymentSuccess(generatedPayId);
    }, 1200);
  };

  return (
    <div
      id="razorpay-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#0B1526] border border-slate-700/90 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Razorpay Branded Header */}
        <div className="bg-gradient-to-r from-[#0C2340] via-[#102A4C] to-[#0C2340] px-6 py-4 border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1877F2] text-white flex items-center justify-center font-bold text-base shadow-sm">
              ₹
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-white text-base">Razorpay Checkout</span>
                <span className="text-[10px] font-semibold uppercase bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">
                  {settings.razorpayTestMode ? 'Secure Live / Test' : 'PCI-DSS Verified'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-interface">Merchant: Digital Muid Strategic Consultation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Order Details & Calculation */}
        <div className="p-6 space-y-5">
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400">Consultation Session:</span>
              <span className="text-white font-medium">{consultationProduct.name} ({consultationProduct.durationMinutes} min)</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400">Selected Schedule:</span>
              <span className="text-[#1877F2] font-semibold">{bookingDetails.date} at {bookingDetails.time} IST</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400">Client:</span>
              <span className="text-slate-200">{bookingDetails.customerName} ({bookingDetails.businessName})</span>
            </div>

            <div className="pt-3 border-t border-slate-800/80 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Base Consultation Fee:</span>
                <span className="font-mono text-slate-200">₹{basePrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>GST ({(gstRate * 100).toFixed(0)}%):</span>
                <span className="font-mono text-slate-200">₹{gstAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-slate-800">
                <span className="text-[#FF6B00]">Total Payable:</span>
                <span className="font-mono text-[#FF6B00]">₹{totalAmount.toFixed(2)} {consultationProduct.currency}</span>
              </div>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Select Payment Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('upi')}
                className={`p-3 rounded-xl border text-center transition-all ${
                  paymentMethod === 'upi'
                    ? 'bg-[#1877F2]/20 border-[#1877F2] text-white font-semibold'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="text-xs">UPI / GPay / PhonePe</div>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`p-3 rounded-xl border text-center transition-all ${
                  paymentMethod === 'card'
                    ? 'bg-[#1877F2]/20 border-[#1877F2] text-white font-semibold'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="text-xs">Cards / Debit / Credit</div>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('netbanking')}
                className={`p-3 rounded-xl border text-center transition-all ${
                  paymentMethod === 'netbanking'
                    ? 'bg-[#1877F2]/20 border-[#1877F2] text-white font-semibold'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="text-xs">Net Banking</div>
              </button>
            </div>

            {paymentMethod === 'upi' && (
              <div className="pt-2">
                <input
                  type="text"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder="Enter UPI ID (e.g. name@okhdfcbank)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-[#1877F2]"
                />
              </div>
            )}
          </div>

          {/* Security Guarantee */}
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900/40 p-3 rounded-lg border border-slate-800/60">
            <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>256-bit encrypted checkout. No card numbers are saved. Immediate invoice & calendar invite.</span>
          </div>

          {/* Pay Button */}
          <button
            id="razorpay-confirm-pay-btn"
            onClick={handlePayNow}
            disabled={isProcessing}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#FF6B00] to-[#E05300] hover:from-[#FF7A1A] hover:to-[#FF6B00] text-white font-semibold text-base shadow-lg shadow-[#FF6B00]/30 hover:shadow-[#FF6B00]/50 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Authorizing with Bank Gateway...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-5 h-5" />
                <span>Pay ₹{totalAmount.toFixed(2)} & Confirm Slot</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
