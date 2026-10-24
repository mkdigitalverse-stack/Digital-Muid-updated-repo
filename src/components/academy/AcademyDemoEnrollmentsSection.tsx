import React, { useState } from 'react';
import { DEMO_ENROLLMENT_RECORDS, DemoEnrollmentRecord } from '../../data/demoEnrollments';
import { Database, ShieldAlert, ChevronDown, ChevronUp, MapPin, CheckCircle2, User } from 'lucide-react';

export const AcademyDemoEnrollmentsSection: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [filterCourse, setFilterCourse] = useState<string>('all');

  const filteredRecords = filterCourse === 'all'
    ? DEMO_ENROLLMENT_RECORDS
    : DEMO_ENROLLMENT_RECORDS.filter((r) => r.courseName.toLowerCase().includes(filterCourse.toLowerCase()));

  return (
    <section id="demo-enrollment-activity" className="py-12 bg-slate-100 text-slate-800 border-t border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Toggle Bar */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-mono font-bold uppercase tracking-wider">
              <ShieldAlert className="w-3 h-3 text-amber-600" />
              <span>UI TESTING ONLY · 12 DEMONSTRATION RECORDS</span>
            </div>
            <h3 className="text-lg font-display font-bold text-slate-900">
              Enrolment Activity (Layout &amp; Responsive Test Suite)
            </h3>
            <p className="text-xs text-slate-500 font-interface">
              Fictional dataset created to verify multi-device table formatting. Not saved in production databases or used for artificial social-proof popups.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold font-interface transition-colors cursor-pointer shrink-0"
            aria-expanded={isOpen}
            aria-controls="demo-records-table-container"
          >
            <Database className="w-4 h-4 text-amber-400" />
            <span>{isOpen ? 'Hide Test Records' : 'Inspect 12 Demo Records'}</span>
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Collapsible Content */}
        {isOpen && (
          <div
            id="demo-records-table-container"
            className="rounded-2xl bg-white border border-slate-200/90 shadow-md p-6 space-y-6 animate-in fade-in duration-200"
          >
            {/* Filter and Notice */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">Filter Course:</span>
                <select
                  value={filterCourse}
                  onChange={(e) => setFilterCourse(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 bg-slate-50 focus:outline-none focus:border-[#1877F2]"
                >
                  <option value="all">All Courses (12 Records)</option>
                  <option value="Meta">Meta &amp; Google Ads</option>
                  <option value="SEO">SEO with AI</option>
                  <option value="Automation">AI &amp; Automation</option>
                  <option value="Growth">Growth Architecture</option>
                </select>
              </div>

              <span className="text-[11px] font-mono text-slate-500">
                Displaying {filteredRecords.length} of 12 test records
              </span>
            </div>

            {/* Responsive Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-mono uppercase tracking-wider text-slate-500">
                    <th className="p-3 font-semibold">Test ID</th>
                    <th className="p-3 font-semibold">Student Name (Fictional)</th>
                    <th className="p-3 font-semibold">Gender</th>
                    <th className="p-3 font-semibold">City &amp; State</th>
                    <th className="p-3 font-semibold">Course Assigned</th>
                    <th className="p-3 font-semibold">Delivery Mode</th>
                    <th className="p-3 font-semibold">Record Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-interface">
                  {filteredRecords.map((r: DemoEnrollmentRecord) => (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-mono text-[10px] text-slate-400 font-bold">{r.id}</td>
                      <td className="p-3 font-semibold text-slate-900 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[10px] font-mono">
                          <User className="w-3 h-3" />
                        </div>
                        <span>{r.studentName}</span>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px]">
                          {r.gender}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="flex items-center gap-1 text-slate-600">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{r.city}, {r.state}</span>
                        </span>
                      </td>
                      <td className="p-3 font-medium text-slate-800">{r.courseName}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                          r.deliveryMode === 'Online Cohort'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {r.deliveryMode}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-mono font-bold">
                          <ShieldAlert className="w-3 h-3" /> Demo Record
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
