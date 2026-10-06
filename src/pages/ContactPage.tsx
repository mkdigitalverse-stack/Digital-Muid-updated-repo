import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Mail, MessageSquare, Send, CheckCircle2, Calendar, MapPin, Globe, ArrowRight, Linkedin, Instagram, Facebook, Youtube } from 'lucide-react';

interface ContactPageProps {
  navigate: (path: string) => void;
}

export const ContactPage: React.FC<ContactPageProps> = ({ navigate }) => {
  const { submitContactMessage, addLead, notify, consultationProduct, settings } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [inquiryType, setInquiryType] = useState('Enterprise Growth Advisory');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const totalCalculated = (consultationProduct.basePrice * (1 + consultationProduct.gstRate)).toFixed(0);

  const socialLinks = [
    {
      name: 'LinkedIn',
      url: settings.socialLinkedin || 'https://www.linkedin.com/in/digitalmuid',
      icon: Linkedin,
      ariaLabel: 'Follow Digital Muid on LinkedIn'
    },
    {
      name: 'Instagram',
      url: settings.socialInstagram || 'https://www.instagram.com/digitalmuid',
      icon: Instagram,
      ariaLabel: 'Follow Digital Muid on Instagram'
    },
    {
      name: 'Facebook',
      url: settings.socialFacebook || 'https://www.facebook.com/digitalmuid',
      icon: Facebook,
      ariaLabel: 'Follow Digital Muid on Facebook'
    },
    {
      name: 'YouTube',
      url: settings.socialYoutube || 'https://www.youtube.com/@digitalmuid',
      icon: Youtube,
      ariaLabel: 'Subscribe to Digital Muid on YouTube'
    }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name && email && message) {
      if (submitContactMessage) {
        submitContactMessage({
          name,
          email,
          phone,
          inquiryType,
          message
        });
      } else {
        addLead({
          name,
          email,
          phone,
          source: 'Contact Form',
          interest: inquiryType,
          notes: message,
          status: 'New'
        });
        notify('Message dispatched successfully!', 'success');
      }
      setSubmitted(true);
    }
  };

  return (
    <div id="contact-page-root" className="pt-28 sm:pt-32 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
      {/* Header */}
      <div className="max-w-3xl space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#1877F2] text-xs font-bold uppercase tracking-wider font-interface">
          <Mail className="w-3.5 h-3.5" /> Direct Inquiries & Partnerships
        </div>
        <h1 className="text-4xl sm:text-5xl font-display font-bold text-slate-900 tracking-tight">
          Connect with Digital Muid
        </h1>
        <p className="text-slate-600 text-base sm:text-lg font-interface leading-relaxed">
          For enterprise consulting, keynotes, media interviews, podcast appearances, and institutional partnerships.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        {/* Left Side: Contact Form */}
        <div className="lg:col-span-7 p-8 rounded-3xl bg-white border border-slate-200 space-y-6 shadow-md">
          <div className="space-y-1">
            <h2 className="text-2xl font-display font-bold text-slate-900">Send a Direct Message</h2>
            <p className="text-xs text-slate-500">All messages go directly to Muid's executive team.</p>
          </div>

          {submitted ? (
            <div className="text-center py-10 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-display font-bold text-slate-900">Message Received</h3>
              <p className="text-slate-600 text-sm">
                Thank you for reaching out, <strong>{name}</strong>. We will review your note and reply to <strong>{email}</strong> within 24 hours.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-700 font-semibold">Your Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Priya Nair"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm focus:outline-none focus:border-[#1877F2]"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-700 font-semibold">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. priya@enterprise.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm focus:outline-none focus:border-[#1877F2]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-700 font-semibold">Phone / WhatsApp</label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm focus:outline-none focus:border-[#1877F2]"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-700 font-semibold">Inquiry Type</label>
                  <select
                    value={inquiryType}
                    onChange={(e) => setInquiryType(e.target.value)}
                    className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm focus:outline-none focus:border-[#1877F2]"
                  >
                    <option>Enterprise Growth Advisory</option>
                    <option>Speaking & Keynote Invitation</option>
                    <option>Corporate AI Masterclass</option>
                    <option>Media, Podcast & Press</option>
                    <option>General Strategic Partnership</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-700 font-semibold">Message / Project Scope *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Share details regarding your requirements, timelines, and objectives..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm focus:outline-none focus:border-[#1877F2]"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-[#1877F2] hover:bg-blue-600 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <Send className="w-4 h-4" />
                  <span>Send Direct Message</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Right Side: Fast-Track Consultation & Info */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-8 rounded-3xl bg-slate-900 text-white border border-slate-800 space-y-5 shadow-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/20 text-[#FF6B00] text-xs font-bold uppercase tracking-wider">
              <Calendar className="w-3.5 h-3.5" /> Need Immediate 1-on-1 Advice?
            </div>
            <h3 className="text-2xl font-display font-bold text-white">
              Skip the Queue: Book a Live Consultation
            </h3>
            <p className="text-slate-300 text-xs sm:text-sm font-interface leading-relaxed">
              If you have an active growth bottleneck and want immediate answers, reserve a 30-minute private strategy session with Digital Muid directly.
            </p>
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs flex items-center justify-between text-white">
              <span>Standard Session Fee:</span>
              <span className="font-mono font-bold text-[#FF6B00]">₹{totalCalculated} (incl. GST)</span>
            </div>
            <button
              onClick={() => navigate('/business-growth-consultation')}
              className="w-full py-3.5 rounded-xl bg-[#FF6B00] hover:bg-[#FF7A1A] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <span>View Available Schedule</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4 text-xs text-slate-700 font-interface">
            <div className="space-y-2.5">
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-[#1877F2]" />
                <span>Executive Office: contact@digitalmuid.com</span>
              </div>
              <div className="flex items-center gap-3">
                <Globe className="w-4 h-4 text-emerald-600" />
                <span>HQ: Bengaluru / Mumbai, India (Global Remote Advisory)</span>
              </div>
            </div>

            {/* Social Links on Contact page (Sequential Order) */}
            <div className="pt-3 border-t border-slate-100 flex items-center gap-2.5" aria-label="Official Social Profiles">
              {socialLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.name}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-[#0A1A2F] text-slate-600 hover:text-white flex items-center justify-center transition-colors"
                    aria-label={item.ariaLabel}
                    title={item.name}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
