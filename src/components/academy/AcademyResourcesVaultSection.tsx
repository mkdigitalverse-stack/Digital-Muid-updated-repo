import React from 'react';
import { useApp } from '../../context/AppContext';
import { Download, FileText, FileSpreadsheet, Cpu, ArrowRight, ShieldCheck, Lock, Sparkles, FolderDown } from 'lucide-react';
import { Resource } from '../../types';

interface AcademyResourcesVaultSectionProps {
  navigate: (path: string) => void;
}

export const AcademyResourcesVaultSection: React.FC<AcademyResourcesVaultSectionProps> = ({ navigate }) => {
  const { resources, hasPurchasedResource } = useApp();

  // Filter published resources
  const publishedResources = (resources || []).filter(
    (r) => r.status === 'published' || !r.status
  );

  // Featured resources first, then other published resources
  const featuredResources = publishedResources.filter(
    (r) => Boolean(r.featured || r.isFeatured)
  );

  const displayResources = featuredResources.length >= 3
    ? featuredResources.slice(0, 3)
    : publishedResources.slice(0, 3);

  const getResourceIcon = (format?: string, type?: string) => {
    const f = (format || type || '').toLowerCase();
    if (f.includes('sheet') || f.includes('xlsx') || f.includes('notion')) {
      return FileSpreadsheet;
    }
    if (f.includes('prompt') || f.includes('ai') || f.includes('bot')) {
      return Cpu;
    }
    return FileText;
  };

  const handleResourceAction = (res: Resource) => {
    const isPaid = (res.accessType === 'paid' || res.access_type === 'paid') && (res.price || 0) > 0;
    if (isPaid) {
      if (!hasPurchasedResource(res.id)) {
        // Direct to resource purchase workflow
        navigate(`/resources?resourceId=${encodeURIComponent(res.id)}`);
      } else {
        navigate(`/resources/thank-you/paid?resourceId=${encodeURIComponent(res.id)}`);
      }
    } else {
      // Free or lead-capture resource
      navigate(`/resources?download=${encodeURIComponent(res.slug || res.id)}`);
    }
  };

  return (
    <section id="resource-vault" className="py-20 sm:py-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 bg-slate-50 text-slate-900 border-t border-b border-slate-200/80">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200">
            <Download className="w-3.5 h-3.5 text-[#FF6B00]" />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FF6B00] font-interface">
              OPERATIONAL TOOLKITS &amp; ASSETS
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-slate-900 tracking-tight">
            The Resource Vault
          </h2>
          <p className="text-slate-600 text-sm sm:text-base font-interface">
            Battle-tested toolkits, prompt libraries, and diagnostic spreadsheets to accelerate your daily marketing execution.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/resources')}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold border border-slate-200 transition-colors cursor-pointer shrink-0 shadow-2xs"
        >
          <span>Explore All Resources</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {displayResources.length === 0 ? (
        <div className="p-12 rounded-3xl bg-white border border-slate-200 text-center space-y-3">
          <FolderDown className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="font-display font-bold text-slate-800 text-lg">No resources available</h3>
          <p className="text-xs text-slate-500 font-interface max-w-md mx-auto">
            Operational toolkits are currently being updated. Please check back shortly.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {displayResources.map((res) => {
            const Icon = getResourceIcon(res.format, res.resourceType || res.type);
            const isPaid = (res.accessType === 'paid' || res.access_type === 'paid') && (res.price || 0) > 0;
            const isPurchased = hasPurchasedResource(res.id);

            return (
              <div
                key={res.id}
                className="p-7 rounded-3xl bg-white border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between space-y-6"
              >
                <div className="space-y-4">
                  {/* Thumbnail / Header */}
                  {res.thumbnailUrl || res.coverImage ? (
                    <div className="aspect-[16/9] w-full rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 relative">
                      <img
                        src={res.thumbnailUrl || res.coverImage}
                        alt={res.title || res.name || 'Resource toolkit'}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-black/70 backdrop-blur-xs text-white px-2 py-0.5 rounded border border-white/10">
                          {res.fileType || res.format || 'Toolkit'}
                        </span>
                        {res.fileSize && (
                          <span className="text-[10px] font-mono text-slate-300 bg-black/60 px-1.5 py-0.5 rounded">
                            {res.fileSize}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-[#1877F2] flex items-center justify-center">
                      <Icon className="w-6 h-6" />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[#1877F2] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                        {res.category || 'Framework'}
                      </span>
                      {isPaid ? (
                        <span className="text-xs font-mono font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                          {isPurchased ? 'Unlocked' : `₹${res.price}`}
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                          Free Toolkit
                        </span>
                      )}
                    </div>

                    <h3 className="text-xl font-display font-bold text-slate-900 pt-1 leading-snug">
                      {res.title || res.name}
                    </h3>

                    <p className="text-xs text-slate-600 font-interface leading-relaxed line-clamp-3">
                      {res.description}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 space-y-2">
                  <button
                    type="button"
                    onClick={() => handleResourceAction(res)}
                    className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs ${
                      isPaid && !isPurchased
                        ? 'bg-slate-900 hover:bg-slate-800 text-white'
                        : 'bg-[#FF6B00] hover:bg-[#FF7A1A] text-white'
                    }`}
                  >
                    {isPaid && !isPurchased ? (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>Unlock Toolkit (₹{res.price})</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Template ({res.fileSize || 'Free'})</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate(`/resources/${res.slug || res.id}`)}
                    className="w-full py-1.5 text-center text-[11px] text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                  >
                    View Details &amp; Preview Points
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
