import { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, AlertTriangle, FileCode } from 'lucide-react';
import type { Attempt } from '../types/api';
import { TestEvidencePanel } from './TestEvidencePanel';

interface AttemptCardProps {
  attempt: Attempt;
  defaultOpen?: boolean;
}

export function AttemptCard({ attempt, defaultOpen = false }: AttemptCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const tr = attempt.test_result;

  const isSuccess = tr?.status === 'PASSED';

  const statusIcons = {
    TESTED: isSuccess ? (
      <CheckCircle2 className="h-3.5 w-3.5 text-[#1E6B3C] dark:text-emerald-400" strokeWidth={1.5} />
    ) : (
      <XCircle className="h-3.5 w-3.5 text-[#9C2A2A] dark:text-red-400" strokeWidth={1.5} />
    ),
    PATCH_APPLIED: <CheckCircle2 className="h-3.5 w-3.5 text-[#1E6B3C] dark:text-emerald-400" strokeWidth={1.5} />,
    PATCH_REJECTED: <XCircle className="h-3.5 w-3.5 text-[#9C2A2A] dark:text-red-400" strokeWidth={1.5} />,
    PATCH_APPLY_FAILED: <AlertTriangle className="h-3.5 w-3.5 text-[#9A6218] dark:text-amber-400" strokeWidth={1.5} />,
    FAILED: <XCircle className="h-3.5 w-3.5 text-[#9C2A2A] dark:text-red-400" strokeWidth={1.5} />,
    PLANNED: <AlertTriangle className="h-3.5 w-3.5 text-[#27618D] dark:text-sky-400" strokeWidth={1.5} />,
    TIMED_OUT: <AlertTriangle className="h-3.5 w-3.5 text-[#9C2A2A] dark:text-red-400" strokeWidth={1.5} />,
    BLOCKED: <AlertTriangle className="h-3.5 w-3.5 text-[#5A534D] dark:text-stone-400" strokeWidth={1.5} />,
  };

  const statusBadges = {
    TESTED: isSuccess
      ? 'bg-[#EAF5ED] text-[#1E6B3C] border-[#BDE3CA] dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
      : 'bg-[#FDF2F2] text-[#9C2A2A] border-[#F6C8C8] dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
    PATCH_APPLIED: 'bg-[#EAF5ED] text-[#1E6B3C] border-[#BDE3CA] dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    PATCH_REJECTED: 'bg-[#FDF2F2] text-[#9C2A2A] border-[#F6C8C8] dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
    PATCH_APPLY_FAILED: 'bg-[#FEF7EC] text-[#9A6218] border-[#F7DFC0] dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    FAILED: 'bg-[#FDF2F2] text-[#9C2A2A] border-[#F6C8C8] dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
    PLANNED: 'bg-[#EEF5FA] text-[#27618D] border-[#C8E1F3] dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
    TIMED_OUT: 'bg-[#FDF2F2] text-[#9C2A2A] border-[#F6C8C8] dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
    BLOCKED: 'bg-[#F4F1ED] text-[#5A534D] border-[#DDD7CF] dark:bg-stone-900 dark:text-stone-300 dark:border-stone-800',
  };

  return (
    <div className="rounded-2xl border border-warm-border dark:border-dark-border bg-white dark:bg-dark-surface overflow-hidden shadow-soft transition-all">
      <div
        onClick={() => setOpen(!open)}
        className="flex cursor-pointer items-center justify-between px-5 py-3.5 hover:bg-[#FAF8F5] dark:hover:bg-dark-card transition-colors select-none"
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
        <div className="flex items-center gap-3">
          {open ? <ChevronDown className="h-4 w-4 text-ink-muted dark:text-dark-ink-muted" /> : <ChevronRight className="h-4 w-4 text-ink-muted dark:text-dark-ink-muted" />}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-ink-primary dark:text-dark-ink-primary">
                Attempt {attempt.attempt_number}
              </span>
              <span
                className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full border font-medium ${
                  statusBadges[attempt.status] ?? 'bg-warm-pill dark:bg-dark-pill text-ink-secondary dark:text-dark-ink-secondary border-warm-border dark:border-dark-border'
                }`}
              >
                {statusIcons[attempt.status]}
                <span>{attempt.status.replace(/_/g, ' ')}</span>
              </span>
            </div>
            {attempt.changed_files.length > 0 && (
              <p className="flex items-center gap-1.5 text-[11px] text-ink-secondary dark:text-dark-ink-secondary mt-0.5">
                <FileCode className="h-3 w-3 text-ink-muted dark:text-dark-ink-muted" />
                <span>{attempt.changed_files.join(', ')}</span>
              </p>
            )}
          </div>
        </div>

        <div className="text-right text-xs">
          {tr ? (
            <div>
              <span className={`font-semibold ${isSuccess ? 'text-[#1E6B3C] dark:text-emerald-400' : 'text-[#9C2A2A] dark:text-red-400'}`}>
                {tr.tests_passed ?? 0} passed, {tr.tests_failed ?? 0} failed
              </span>
              {tr.duration_ms != null && (
                <p className="text-[10px] text-ink-muted dark:text-dark-ink-muted mt-0.5 font-mono">
                  {(tr.duration_ms / 1000).toFixed(2)}s
                </p>
              )}
            </div>
          ) : (
            <span className="text-[11px] text-ink-muted dark:text-dark-ink-muted italic">No tests executed</span>
          )}
        </div>
      </div>

      {open && (
        <div className="p-5 border-t border-warm-border-subtle dark:border-dark-border-subtle bg-[#FCFBF9] dark:bg-dark-card space-y-3">
          {attempt.status === 'PATCH_APPLY_FAILED' && (
            <div className="p-3 rounded-xl bg-[#FEF7EC] dark:bg-amber-950/40 border border-[#F7DFC0] dark:border-amber-900/50 text-xs text-[#9A6218] dark:text-amber-300">
              <p className="font-semibold">Context Verification Mismatch on Attempt 1</p>
              <p className="mt-0.5 leading-relaxed">
                The patch could not be applied cleanly because file context lines differed. The orchestrator escalated with line-numbered source code to request a corrected patch.
              </p>
            </div>
          )}
          {tr ? (
            <TestEvidencePanel attempt={attempt} />
          ) : (
            <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary italic">No sandbox test run recorded for this attempt.</p>
          )}
        </div>
      )}
    </div>
  );
}
