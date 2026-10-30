import { useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';

interface LogPanelProps {
  label: string;
  content: string;
  truncated?: boolean;
  defaultOpen?: boolean;
  badge?: string;
}

export function LogPanel({ label, content, truncated = false, defaultOpen = false, badge }: LogPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="rounded-2xl border border-warm-border bg-[#FCFBF9] overflow-hidden shadow-soft">
      <div
        onClick={() => setOpen(!open)}
        className="flex cursor-pointer items-center justify-between px-4 py-2.5 bg-[#F5F2ED] hover:bg-[#EFEAE2] transition-colors border-b border-warm-border select-none"
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
        <div className="flex items-center gap-2 text-xs font-semibold text-ink-primary">
          {open ? <ChevronDown className="h-3.5 w-3.5 text-ink-muted" /> : <ChevronRight className="h-3.5 w-3.5 text-ink-muted" />}
          <span>{label}</span>
          {badge && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-warm-pill text-ink-secondary border border-warm-border/60">
              {badge}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {truncated && (
            <span className="rounded-full bg-[#FEF7EC] text-[#9A6218] border border-[#F7DFC0] px-2 py-0.5 text-[10px] font-medium">
              Output truncated
            </span>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 rounded-md text-ink-muted hover:text-ink-primary hover:bg-white transition-colors"
            title="Copy log content"
            aria-label="Copy log content"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-[#1E6B3C]" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="p-4 overflow-x-auto max-h-72 overflow-y-auto font-mono text-xs text-[#3E3832] bg-[#FAF8F5] leading-relaxed">
          {content ? (
            <pre className="whitespace-pre">{content}</pre>
          ) : (
            <p className="text-ink-muted italic">Empty stream output.</p>
          )}
        </div>
      )}
    </div>
  );
}
