import React from 'react';
import { useApp } from '../context/AppContext';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

export const ToastNotification: React.FC = () => {
  const { notification } = useApp();

  if (!notification) return null;

  const bgColors = {
    success: 'bg-emerald-950/90 border-emerald-500/50 text-emerald-100',
    error: 'bg-rose-950/90 border-rose-500/50 text-rose-100',
    info: 'bg-slate-900/90 border-blue-500/50 text-blue-100'
  };

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />,
    info: <Info className="w-5 h-5 text-blue-400 shrink-0" />
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md animate-in slide-in-from-bottom-5 duration-200">
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-2xl ${
          bgColors[notification.type]
        }`}
      >
        {icons[notification.type]}
        <p className="text-sm font-medium leading-tight">{notification.message}</p>
      </div>
    </div>
  );
};
