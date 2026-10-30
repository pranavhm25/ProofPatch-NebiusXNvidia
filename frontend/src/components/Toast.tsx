import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: Toast = { ...toast, id };
    setToasts((prev) => [...prev, newToast]);

    const duration = toast.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const icons = {
    success: <CheckCircle2 className="h-4 w-4 text-[#1E6B3C] shrink-0" strokeWidth={1.5} />,
    error: <XCircle className="h-4 w-4 text-[#9C2A2A] shrink-0" strokeWidth={1.5} />,
    warning: <AlertTriangle className="h-4 w-4 text-[#9A6218] shrink-0" strokeWidth={1.5} />,
    info: <Info className="h-4 w-4 text-[#27618D] shrink-0" strokeWidth={1.5} />,
  };

  const bgColors = {
    success: 'bg-[#EAF5ED] border-[#BDE3CA] text-[#1E6B3C]',
    error: 'bg-[#FDF2F2] border-[#F6C8C8] text-[#9C2A2A]',
    warning: 'bg-[#FEF7EC] border-[#F7DFC0] text-[#9A6218]',
    info: 'bg-[#EEF5FA] border-[#C8E1F3] text-[#27618D]',
  };

  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start gap-3 rounded-2xl border p-4 shadow-card bg-white transition-all animate-in fade-in slide-in-from-bottom-2 ${bgColors[toast.type]}`}
    >
      {icons[toast.type]}
      <div className="flex-1 text-xs">
        <p className="font-semibold text-[#2A2420]">{toast.title}</p>
        {toast.message && <p className="mt-0.5 text-[#7A726B] leading-relaxed">{toast.message}</p>}
      </div>
      <button
        onClick={onClose}
        className="p-1 rounded-lg text-[#9E968F] hover:text-[#2A2420] hover:bg-[#F3EFEA] transition-colors"
        aria-label="Dismiss toast"
      >
        <X className="h-3.5 w-3.5" strokeWidth={1.5} />
      </button>
    </div>
  );
}
