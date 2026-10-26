import type { Attempt } from '../types/api';
import { LogPanel } from './LogPanel';

interface AttemptCardProps {
  attempt: Attempt;
}

const testStatusColor: Record<string, string> = {
  PASSED:   'text-emerald-400',
  FAILED:   'text-red-400',
  TIMED_OUT:'text-amber-400',
  ERROR:    'text-red-400',
  NOT_RUN:  'text-neutral-500',
  NO_TESTS: 'text-amber-400',
};

export function AttemptCard({ attempt }: AttemptCardProps) {
  const tr = attempt.test_result;
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-neutral-200">
          Attempt {attempt.attempt_number}
        </span>
        {tr && (
          <span className={`text-xs font-semibold uppercase tracking-wider ${testStatusColor[tr.status] ?? 'text-neutral-400'}`}>
            {tr.status}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-neutral-400">
        {attempt.patch_hash && (
          <span className="col-span-2 sm:col-span-3 font-mono truncate text-neutral-500" title={attempt.patch_hash}>
            Patch: {attempt.patch_hash.substring(0, 24)}…
          </span>
        )}
        {tr && tr.exit_code !== null && <span>Exit code: {tr.exit_code}</span>}
        {tr && tr.duration_ms !== null && <span>Duration: {(tr.duration_ms / 1000).toFixed(2)}s</span>}
        {tr && tr.tests_discovered !== null && <span>Discovered: {tr.tests_discovered}</span>}
        {tr && tr.tests_passed !== null && <span>Passed: {tr.tests_passed}</span>}
        {tr && tr.tests_failed !== null && <span>Failed: {tr.tests_failed}</span>}
      </div>
      {attempt.changed_files.length > 0 && (
        <div className="text-xs text-neutral-400 font-mono">
          Files changed: {attempt.changed_files.join(', ')}
        </div>
      )}
      {tr && tr.stdout && (
        <LogPanel label="stdout" content={tr.stdout} truncated={tr.output_truncated} />
      )}
      {tr && tr.stderr && (
        <LogPanel label="stderr" content={tr.stderr} truncated={tr.output_truncated} />
      )}
    </div>
  );
}
