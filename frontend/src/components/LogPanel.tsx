import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { CopyButton } from './CopyButton';

interface LogPanelProps {
  label: string;
  content: string;
  truncated?: boolean;
  defaultOpen?: boolean;
  badge?: string;
}

export function LogPanel({
  label,
  content,
  truncated = false,
  defaultOpen = false,
  badge,
}: LogPanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl border border-warm-border dark:border-dark-border bg-[#FCFBF9] dark:bg-dark-surface overflow-hidden shadow-soft">
      <div
        onClick={() => setOpen(!open)}
        className="flex cursor-pointer items-center justify-between px-4 py-2.5 bg-[#F5F2ED] dark:bg-dark-card hover:bg-[#EFEAE2] dark:hover:bg-dark-pill transition-colors border-b border-warm-border dark:border-dark-border select-none"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(!open);
          }
        }}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 text-xs font-semibold text-ink-primary dark:text-dark-ink-primary">
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 text-ink-muted dark:text-dark-ink-muted" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-ink-muted dark:text-dark-ink-muted" />
          )}
          <span>{label}</span>
          {badge && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-warm-pill dark:bg-dark-pill text-ink-secondary dark:text-dark-ink-secondary border border-warm-border/60 dark:border-dark-border/60">
              {badge}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {truncated && (
            <span className="rounded-full bg-[#FEF7EC] dark:bg-amber-950/40 text-[#9A6218] dark:text-amber-400 border border-[#F7DFC0] dark:border-amber-900/50 px-2 py-0.5 text-[10px] font-medium">
              Output truncated
            </span>
          )}
          <CopyButton
            text={content}
            iconOnly={true}
            title="Copy log content"
            copiedLabel="Copied log"
          />
        </div>
      </div>

      {open && (
        <div className="p-4 overflow-x-auto max-h-72 overflow-y-auto font-mono text-xs text-[#3E3832] dark:text-dark-ink-primary bg-[#FAF8F5] dark:bg-dark-surface leading-relaxed">
          {content ? (
            <pre className="whitespace-pre">{content}</pre>
          ) : (
            <p className="text-ink-muted dark:text-dark-ink-muted italic">Empty stream output.</p>
          )}
        </div>
      )}
    </div>
  );
}
