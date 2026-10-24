import React, { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';

export const AcademyWhatsAppButton: React.FC = () => {
  const [showTooltip, setShowTooltip] = useState(false);
  const phoneNumber = '919335817155';
  const prefilledMessage = encodeURIComponent(
    'Hello DigitalMUID, I would like to know more about your digital marketing training.'
  );
  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${prefilledMessage}`;

  return (
    <aside
      aria-label="Direct WhatsApp Enquiry"
      className="fixed bottom-6 right-6 z-40 flex items-center gap-2"
    >
      {/* Desktop Tooltip */}
      {showTooltip && (
        <div
          role="status"
          className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-interface shadow-xl border border-slate-800 animate-in fade-in slide-in-from-right-2 duration-150"
        >
          <span>Chat with Admissions Team</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowTooltip(false);
            }}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Dismiss admissions chat tooltip"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Floating Action Button */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={() => setShowTooltip(true)}
        aria-label="Contact DigitalMUID Academy on WhatsApp at +91 93358 17155"
        className="w-14 h-14 rounded-full bg-[#25D366] hover:bg-[#20BD5A] text-white flex items-center justify-center shadow-2xl shadow-emerald-900/40 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer border-2 border-white/20 group relative focus:outline-none focus:ring-4 focus:ring-emerald-400/50"
        title="Chat on WhatsApp (+91 93358 17155)"
      >
        {/* Pulsing ambient indicator */}
        <span
          className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-white rounded-full border-2 border-[#25D366] animate-pulse"
          aria-hidden="true"
        />

        {/* WhatsApp Icon */}
        <svg
          className="w-7 h-7 fill-current"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path d="M12.031 2C6.505 2 2 6.502 2 12.027c0 1.954.564 3.78 1.542 5.325L2 22l4.808-1.504A9.97 9.97 0 0 0 12.031 22C17.557 22 22 17.502 22 12.027 22 6.502 17.557 2 12.031 2zm5.787 14.281c-.244.685-1.218 1.298-1.706 1.341-.454.04-1.04.062-3.088-.772-2.464-1.003-4.04-3.51-4.162-3.673-.122-.163-.997-1.328-.997-2.533 0-1.205.63-1.796.853-2.04.224-.244.489-.306.652-.306.163 0 .326.002.468.009.15.008.351-.057.549.418.204.489.693 1.691.754 1.813.061.122.102.265.02.428-.081.163-.122.265-.244.408-.122.143-.257.319-.367.428-.122.122-.25.255-.108.499.143.244.636 1.049 1.365 1.699.938.836 1.729 1.094 1.973 1.217.244.122.387.102.53-.061.143-.163.611-.713.774-.958.163-.244.326-.204.55-.122.224.081 1.426.672 1.67 1.01.244.338.244.632.122 1.317z" />
        </svg>
      </a>
    </aside>
  );
};
