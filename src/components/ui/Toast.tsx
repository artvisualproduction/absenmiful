import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from '../../lib/cn';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  title: string;
  message?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (toast: Omit<ToastItem, 'id'>) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: 'border-[#BBF7D0] bg-white text-[#10264D]',
  error: 'border-[#FECACA] bg-white text-[#10264D]',
  warning: 'border-[#FDE68A] bg-white text-[#10264D]',
  info: 'border-[#BFDBFE] bg-white text-[#10264D]',
};

function ToastIcon({ variant }: { variant: ToastVariant }) {
  switch (variant) {
    case 'success':
      return <CheckCircle2 className="h-5 w-5 text-[#15803D] shrink-0" aria-hidden="true" />;
    case 'error':
      return <XCircle className="h-5 w-5 text-[#B91C1C] shrink-0" aria-hidden="true" />;
    case 'warning':
      return <AlertTriangle className="h-5 w-5 text-[#B45309] shrink-0" aria-hidden="true" />;
    case 'info':
      return <Info className="h-5 w-5 text-[#1D4ED8] shrink-0" aria-hidden="true" />;
  }
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: Omit<ToastItem, 'id'>) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { ...toast, id }]);
      window.setTimeout(() => {
        dismissToast(id);
      }, 4500);
    },
    [dismissToast],
  );

  const toastContainer = (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed bottom-4 right-4 z-[1300] flex w-full max-w-sm flex-col gap-2.5 px-4 sm:px-0"
    >
      {toasts.map((item) => (
        <div
          key={item.id}
          role="status"
          className={cn(
            'pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-xl',
            VARIANT_STYLES[item.variant],
          )}
        >
          <ToastIcon variant={item.variant} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#10264D]">{item.title}</p>
            {item.message && (
              <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">{item.message}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => dismissToast(item.id)}
            aria-label="Tutup notifikasi"
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      {typeof document !== 'undefined' ? createPortal(toastContainer, document.body) : toastContainer}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast harus dipanggil di dalam ToastProvider.');
  }
  return ctx;
}
