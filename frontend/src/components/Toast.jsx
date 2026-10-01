import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export default function Toast({ message, type = 'info', onClose }) {
  if (!message) return null;

  const styles = {
    success: 'bg-stone-900 text-white border-stone-800',
    error: 'bg-rose-900 text-white border-rose-800',
    info: 'bg-stone-900 text-white border-stone-800',
  };

  const icons = {
    success: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />,
    error: <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />,
    info: <Info className="w-4 h-4 text-amber-400 shrink-0" />,
  };

  return (
    <div className="fixed bottom-5 right-5 z-50">
      <div className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-lg border text-xs ${styles[type] || styles.info}`}>
        {icons[type]}
        <span className="font-medium pr-2">{message}</span>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-white/10 transition-colors ml-auto text-white/70 hover:text-white"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
