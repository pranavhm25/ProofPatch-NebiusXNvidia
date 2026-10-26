import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface LogPanelProps {
  label: string;
  content: string;
  truncated?: boolean;
  defaultOpen?: boolean;
}

export function LogPanel({ label, content, truncated = false, defaultOpen = false }: LogPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left text-xs font-medium text-neutral-300 hover:bg-neutral-900 transition-colors"
        aria-expanded={open}
      >
        <span className="font-mono">{label}</span>
        {open ? <ChevronUp className="h-4 w-4 text-neutral-500" /> : <ChevronDown className="h-4 w-4 text-neutral-500" />}
      </button>
      {open && (
        <div className="border-t border-neutral-800 p-4">
          {truncated && (
            <p className="mb-2 text-xs text-amber-400">Notice: Output was truncated to the maximum display limit.</p>
          )}
          <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs text-neutral-300 max-h-96 overflow-y-auto">
            {content || '(no output)'}
          </pre>
        </div>
      )}
    </div>
  );
}
