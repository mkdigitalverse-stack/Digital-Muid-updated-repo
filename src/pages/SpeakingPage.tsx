import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Mic, Calendar, Users, MapPin, CheckCircle2, ArrowRight, Sparkles, Send } from 'lucide-react';

interface SpeakingPageProps {
  navigate: (path: string) => void;
}

export const SpeakingPage: React.FC<SpeakingPageProps> = ({ navigate }) => {
  const { speakingEvents, addLead, notify } = useApp();
  const [eventName, setEventName] = useState('');
  const [organizerName, setOrganizerName] = useState('');
  const [organizerEmail, setOrganizerEmail] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [location, setLocation] = useState('');
  const [attendeeCount, setAttendeeCount] = useState('');
  const [topicInterest, setTopicInterest] = useState('AI & Business Transformation');
  const [submitted, setSubmitted] = useState(false);

  const keynoteTopics = [
    {
      title: 'The AI-Integrated Enterprise: From Hype to Operational Reality',
      desc: 'How leading organizations are restructuring their workforce, software stack, and customer intelligence around generative AI and autonomous agents.'
    },
    {
      title: 'The Digital Growth Stack™: Unifying Marketing, Tech & CX',
      desc: 'Why marketing silos fail and how high-performing companies orchestrate predictable growth by connecting media, product architecture, and customer experience.'
    },
    {
      title: 'Personal Authority in the Algorithmic Age',
      desc: 'Codifying expertise into defensible intellectual property, signature frameworks, and founder-led brand equity that commands premium pricing.'
    },
    {
      title: 'Digital Transformation in Regulated & High-Trust Sectors',
      desc: 'Tactical lessons from deploying digital ecosystems across healthcare, financial services, and enterprise education.'
    }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (organizerName && organizerEmail && eventName) {
      addLead({
        name: organizerName,
        email: organizerEmail,
        source: 'Speaking Enquiry',
        interest: topicInterest,
        notes: `Event: ${eventName}, Date: ${eventDate}, Location: ${location}, Estimated Attendees: ${attendeeCount}`,
        status: 'New'
      });
      setSubmitted(true);
      notify('Speaking invitation received! We will respond within 24 hours.', 'success');
    }
  };

  return (
    <div id="speaking-page-root" className="pt-28 sm:pt-32 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
      {/* Header */}
      <div className="max-w-3xl space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-[#FF6B00] text-xs font-bold uppercase tracking-wider font-interface">
          <Mic className="w-3.5 h-3.5" /> Keynotes & Executive Workshops
        </div>
        <h1 className="text-4xl sm:text-5xl font-display font-bold text-slate-900 tracking-tight">
          Ideas Worth Sharing
        </h1>
        <p className="text-slate-600 text-base sm:text-lg font-interface leading-relaxed">
          Digital Muid delivers high-voltage, fluff-free keynotes, panel moderation, and executive briefings for industry summits, corporate offsites, and university forums.
        </p>
      </div>

      {/* Keynote Topics */}
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-widest text-[#1877F2]">Signature Presentations</div>
          <h2 className="text-3xl font-display font-bold text-slate-900">Keynote Themes & Modules</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {keynoteTopics.map((topic, idx) => (
            <div
              key={idx}
              className="p-8 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4 hover:border-slate-300 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#FF6B00] border border-orange-100 font-mono font-bold flex items-center justify-center text-sm">
                0{idx + 1}
              </div>
              <h3 className="text-xl font-display font-bold text-slate-900 leading-snug">{topic.title}</h3>
              <p className="text-slate-600 text-sm font-interface leading-relaxed">{topic.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Past Speaking Engagements */}
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-widest text-purple-700">Track Record</div>
          <h2 className="text-3xl font-display font-bold text-slate-900">Recent Keynotes & Summits</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {speakingEvents.map((evt) => (
            <div
              key={evt.id}
              className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="aspect-[16/9] w-full rounded-xl bg-slate-100 overflow-hidden border border-slate-200">
                  <img
                    src={evt.photo}
                    alt={evt.eventName}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="px-2.5 py-0.5 rounded bg-slate-100 text-slate-800 font-semibold border border-slate-200">{evt.type}</span>
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-slate-400" /> {evt.date}</span>
                </div>
                <h4 className="font-display font-bold text-slate-900 text-base">{evt.title}</h4>
                <p className="text-xs text-[#1877F2] font-bold">{evt.eventName} · {evt.location}</p>
              </div>

              <div className="text-xs font-mono text-slate-500 pt-2 border-t border-slate-100 flex items-center justify-between">
                <span>Audience: {evt.attendees}</span>
                <span className="text-emerald-700 font-semibold">Verified</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Speaking Inquiry Form */}
      <div className="p-8 sm:p-12 rounded-3xl bg-slate-900 text-white border border-slate-800 shadow-xl">
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <h3 className="text-3xl font-display font-bold text-white">
              Invite Muid to Speak at Your Event
            </h3>
            <p className="text-slate-300 text-sm">
              Please share the event context below. Our team reviews all speaking requests within 24 hours.
            </p>
          </div>

          {submitted ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h4 className="text-2xl font-display font-bold text-white">Invitation Received</h4>
              <p className="text-slate-300 text-sm">
                Thank you for inviting Digital Muid to speak at <strong>{eventName}</strong>. We will check availability for {eventDate} and follow up directly with your team.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-300 font-medium">Event Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Asia Digital Leadership Summit"
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-[#1877F2]"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300 font-medium">Organizer / Company *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Tech Media"
                    value={organizerName}
                    onChange={(e) => setOrganizerName(e.target.value)}
                    className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-[#1877F2]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-300 font-medium">Contact Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. director@apexevents.com"
                    value={organizerEmail}
                    onChange={(e) => setOrganizerEmail(e.target.value)}
                    className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-[#1877F2]"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300 font-medium">Event Date (Proposed)</label>
                  <input
                    type="text"
                    placeholder="e.g. October 15, 2026"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-[#1877F2]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-300 font-medium">Location / Format</label>
                  <input
                    type="text"
                    placeholder="e.g. Mumbai / In-Person or Virtual"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-[#1877F2]"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300 font-medium">Expected Attendees</label>
                  <input
                    type="text"
                    placeholder="e.g. 500+ Founders & CXOs"
                    value={attendeeCount}
                    onChange={(e) => setAttendeeCount(e.target.value)}
                    className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-[#1877F2]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium">Primary Topic of Interest</label>
                <select
                  value={topicInterest}
                  onChange={(e) => setTopicInterest(e.target.value)}
                  className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-[#1877F2]"
                >
                  <option>AI & Business Transformation</option>
                  <option>The Digital Growth Stack™</option>
                  <option>Personal Authority in the Algorithmic Age</option>
                  <option>Digital Transformation in Healthcare & High-Trust Markets</option>
                  <option>Custom Keynote / Executive Briefing</option>
                </select>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  className="w-full py-4 rounded-xl bg-[#FF6B00] hover:bg-[#FF7A1A] text-white font-bold text-sm shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Submit Speaking Invitation</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
