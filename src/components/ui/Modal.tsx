import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: ReactNode;
  footer?: ReactNode;
  closeOnBackdrop?: boolean;
  zIndexClass?: string;
}

const SIZE_MAP = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
};

export function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  children,
  footer,
  closeOnBackdrop = true,
  zIndexClass = 'z-[1100]',
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const modalNode = (
    <div
      className={cn(
        'fixed inset-0 flex items-end sm:items-center justify-center bg-[#09162E]/55 p-0 sm:p-4 backdrop-blur-[2px] overscroll-none animate-fade-in',
        zIndexClass,
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={cn(
          'w-full overflow-hidden rounded-t-2xl sm:rounded-2xl border border-[#E2E8F0] bg-white shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[88dvh]',
          'animate-slide-up-sheet sm:animate-scale-in',
          SIZE_MAP[size],
        )}
      >
        {/* Subtle mobile bottom-sheet handle */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0" aria-hidden="true">
          <span className="h-1 w-10 rounded-full bg-slate-200" />
        </div>

        <div className="flex items-start justify-between gap-3 border-b border-[#E2E8F0] px-5 sm:px-6 py-3.5 sm:py-4 shrink-0">
          <div className="min-w-0 flex-1">
            <h2 id="modal-title" className="text-base font-semibold text-[#10264D] leading-snug break-words">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-xs text-slate-500 leading-relaxed break-words">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-[#10264D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10264D] cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div
          className={cn(
            'flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-6 py-4 sm:py-5 text-sm text-slate-700',
            !footer && 'pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]',
          )}
        >
          {children}
        </div>

        {footer && (
          <div className="flex flex-col-reverse sm:flex-row sm:flex-wrap sm:items-center sm:justify-end gap-2.5 border-t border-[#E2E8F0] bg-[#F8FAFC] px-5 sm:px-6 py-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))] sm:rounded-b-2xl shrink-0 [&>button]:w-full sm:[&>button]:w-auto">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalNode, document.body);
  }
  return modalNode;
}
