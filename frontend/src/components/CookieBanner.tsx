import { useState, useEffect } from 'react';
import { ShieldCheck, X } from 'lucide-react';

const STORAGE_KEY = 'proofpatch_cookie_consent';

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem(STORAGE_KEY);
      if (!consent) {
        // Small delay so it doesn't abruptly pop up on immediate paint
        const timer = setTimeout(() => setVisible(true), 800);
        return () => clearTimeout(timer);
      }
    } catch {
      // Storage access blocked
    }
  }, []);

  const handleDismiss = (decision: 'accepted' | 'dismissed') => {
    try {
      localStorage.setItem(STORAGE_KEY, decision);
    } catch {
      // Storage access blocked
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Privacy and cookies"
      className="fixed bottom-6 left-6 z-30 max-w-sm rounded-2xl border border-warm-border dark:border-dark-border bg-white dark:bg-dark-surface p-4 shadow-elevated animate-in slide-in-from-bottom-3 duration-200"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-ink-primary dark:text-dark-ink-primary font-semibold text-xs">
          <ShieldCheck className="h-4 w-4 text-[#1E6B3C] dark:text-emerald-400 shrink-0" strokeWidth={1.5} />
          <span>Local Privacy & Session Storage</span>
        </div>
        <button
          type="button"
          onClick={() => handleDismiss('dismissed')}
          aria-label="Dismiss cookie notice"
          className="p-1 rounded-md text-ink-muted dark:text-dark-ink-muted hover:text-ink-primary dark:hover:text-dark-ink-primary transition-colors focus-visible:outline-2"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <p className="text-[11px] text-ink-secondary dark:text-dark-ink-secondary leading-relaxed mt-2">
        ProofPatch stores minimal local session state (job cache, theme choice, and repair preferences). No third-party ad pixels or tracking cookies are ever loaded.
      </p>

      <div className="flex items-center gap-2 mt-3 pt-2 border-t border-warm-border-subtle dark:border-dark-border-subtle">
        <button
          type="button"
          onClick={() => handleDismiss('accepted')}
          className="px-3 py-1.5 rounded-xl bg-ink-primary dark:bg-dark-ink-primary text-warm-bg dark:text-dark-bg text-xs font-semibold hover:opacity-90 shadow-soft transition-colors focus-visible:outline-2"
        >
          Accept
        </button>
        <button
          type="button"
          onClick={() => handleDismiss('dismissed')}
          className="px-3 py-1.5 rounded-xl border border-warm-border dark:border-dark-border bg-white dark:bg-dark-surface text-ink-secondary dark:text-dark-ink-secondary text-xs font-medium hover:bg-warm-pill dark:hover:bg-dark-pill transition-colors focus-visible:outline-2"
        >
          Close
        </button>
      </div>
    </div>
  );
}

