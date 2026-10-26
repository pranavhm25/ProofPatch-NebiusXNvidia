import type { Attempt } from '../types/api';
import { LogPanel } from './LogPanel';

interface TestEvidencePanelProps {
  attempt: Attempt;
}

export function TestEvidencePanel({ attempt }: TestEvidencePanelProps) {
  const tr = attempt.test_result;
  if (!tr) {
    return <p className="text-sm text-neutral-500">No test evidence available for this attempt.</p>;
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4 text-xs">
        <span className="rounded bg-neutral-900 border border-neutral-800 px-2.5 py-1">
          <span className="text-neutral-500">Runner:</span> <code className="font-mono text-neutral-200">{tr.command_id}</code>
        </span>
        <span className="rounded bg-neutral-900 border border-neutral-800 px-2.5 py-1">
          <span className="text-neutral-500">Exit code:</span> <code className="font-mono text-neutral-200">{tr.exit_code ?? 'None'}</code>
        </span>
        <span className="rounded bg-neutral-900 border border-neutral-800 px-2.5 py-1">
          <span className="text-neutral-500">Duration:</span> <code className="font-mono text-neutral-200">{tr.duration_ms != null ? `${(tr.duration_ms / 1000).toFixed(2)}s` : 'N/A'}</code>
        </span>
      </div>
      <LogPanel label="pytest stdout" content={tr.stdout} truncated={tr.output_truncated} defaultOpen />
      {tr.stderr && <LogPanel label="pytest stderr" content={tr.stderr} truncated={tr.output_truncated} />}
    </div>
  );
}
