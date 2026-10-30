import { useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = true,
}: ConfirmationModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement;

      // Lock body scroll
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      // Focus first action button
      const timer = setTimeout(() => {
        const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>('button');
        if (buttons && buttons.length > 0) {
          // Focus cancel button by default for safety on destructive actions
          buttons[buttons.length - 1]?.focus();
        }
      }, 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
          return;
        }

        // Focus trap
        if (e.key === 'Tab' && dialogRef.current) {
          const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusable.length === 0) return;

          const first = focusable[0];
          const last = focusable[focusable.length - 1];

          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => {
        clearTimeout(timer);
        document.body.style.overflow = originalOverflow;
        window.removeEventListener('keydown', handleKeyDown);
        triggerRef.current?.focus();
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-modal-title"
        aria-describedby="confirmation-modal-description"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl border border-warm-border dark:border-dark-border bg-white dark:bg-dark-surface p-6 shadow-elevated space-y-4 animate-in zoom-in-95 duration-150"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 ${
                destructive
                  ? 'bg-[#FDF2F2] dark:bg-red-950/40 text-[#9C2A2A] dark:text-red-400 border border-[#F6C8C8] dark:border-red-900/50'
                  : 'bg-warm-pill dark:bg-dark-pill text-ink-primary dark:text-dark-ink-primary'
              }`}
            >
              <AlertTriangle className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <div>
              <h2
                id="confirmation-modal-title"
                className="text-sm font-semibold text-ink-primary dark:text-dark-ink-primary"
              >
                {title}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1 rounded-lg text-ink-muted dark:text-dark-ink-muted hover:text-ink-primary dark:hover:text-dark-ink-primary hover:bg-warm-pill dark:hover:bg-dark-pill transition-colors focus-visible:outline-2"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        <p
          id="confirmation-modal-description"
          className="text-xs text-ink-secondary dark:text-dark-ink-secondary leading-relaxed pl-1"
        >
          {description}
        </p>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-warm-border-subtle dark:border-dark-border-subtle">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-warm-border dark:border-dark-border bg-white dark:bg-dark-surface text-xs font-medium text-ink-primary dark:text-dark-ink-primary hover:bg-[#FAF8F5] dark:hover:bg-dark-pill transition-colors focus-visible:outline-2 shadow-soft"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-4 py-2 rounded-xl text-xs font-semibold shadow-soft transition-colors focus-visible:outline-2 ${
              destructive
                ? 'bg-[#9C2A2A] hover:bg-[#852222] text-white'
                : 'bg-ink-primary dark:bg-dark-ink-primary text-warm-bg dark:text-dark-bg hover:opacity-90'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

