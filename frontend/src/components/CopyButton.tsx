import { useState, useEffect, useRef } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyButtonProps {
  text: string;
  label?: string;
  copiedLabel?: string;
  iconOnly?: boolean;
  className?: string;
  title?: string;
}

export function CopyButton({
  text,
  label = 'Copy',
  copiedLabel = 'Copied',
  iconOnly = false,
  className = '',
  title = 'Copy to clipboard',
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    let success = false;
    if (navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        success = true;
      } catch {
        success = false;
      }
    }

    // Fallback using textarea execCommand
    if (!success) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '-9999px';
        textarea.setAttribute('readonly', '');
        document.body.appendChild(textarea);
        textarea.select();
        success = document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch {
        success = false;
      }
    }

    if (success) {
      setCopied(true);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    }
  };

  const defaultClasses = iconOnly
    ? 'p-1.5 rounded-lg border border-warm-border dark:border-dark-border bg-white dark:bg-dark-surface text-ink-muted dark:text-dark-ink-muted hover:text-ink-primary dark:hover:text-dark-ink-primary hover:bg-warm-pill dark:hover:bg-dark-pill transition-colors shadow-soft focus-visible:outline-2'
    : 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-warm-border dark:border-dark-border bg-white dark:bg-dark-surface text-xs font-medium text-ink-primary dark:text-dark-ink-primary hover:border-[#D8D2CA] dark:hover:border-dark-border hover:bg-[#FAF8F5] dark:hover:bg-dark-pill shadow-soft transition-colors focus-visible:outline-2';

  const accessibleName = copied ? copiedLabel : iconOnly ? title : label;

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={accessibleName}
      title={copied ? copiedLabel : title}
      className={`${defaultClasses} ${className}`}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-[#1E6B3C] dark:text-emerald-400 shrink-0" strokeWidth={1.5} />
          {!iconOnly && <span className="text-[#1E6B3C] dark:text-emerald-400">{copiedLabel}</span>}
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5 text-ink-muted dark:text-dark-ink-muted shrink-0" strokeWidth={1.5} />
          {!iconOnly && <span>{label}</span>}
        </>
      )}
    </button>
  );
}
