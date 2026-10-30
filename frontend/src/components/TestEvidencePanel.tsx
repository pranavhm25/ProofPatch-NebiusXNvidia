import type { Attempt } from '../types/api';
import { LogPanel } from './LogPanel';
import { Terminal, CheckCircle2, XCircle, Clock } from 'lucide-react';

interface TestEvidencePanelProps {
  attempt: Attempt;
}

export function TestEvidencePanel({ attempt }: TestEvidencePanelProps) {
  const tr = attempt.test_result;

  if (!tr) {
    return (
      <div className="p-6 rounded-2xl border border-warm-border bg-[#FAF7F2] text-center text-xs text-ink-secondary">
        No test runner output available for this attempt.
      </div>
    );
  }

  const isSuccess = tr.status === 'PASSED';
  const durationSec = tr.duration_ms != null ? (tr.duration_ms / 1000).toFixed(2) : null;

  return (
    <div className="space-y-4">
      {/* Test Execution Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#FAF8F5] rounded-xl border border-warm-border p-3">
          <div className="flex items-center gap-1.5 text-ink-muted text-[11px]">
            <Terminal className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span>Runner Command</span>
          </div>
          <p className="font-mono text-xs font-semibold text-ink-primary mt-1 truncate">
            {tr.command_id || 'pytest'}
          </p>
        </div>

        <div className="bg-[#FAF8F5] rounded-xl border border-warm-border p-3">
          <div className="flex items-center gap-1.5 text-ink-muted text-[11px]">
            {isSuccess ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-[#1E6B3C]" strokeWidth={1.5} />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-[#9C2A2A]" strokeWidth={1.5} />
            )}
            <span>Exit Code</span>
          </div>
          <p className="font-mono text-xs font-semibold text-ink-primary mt-1">
            {tr.exit_code ?? 'None'}
            {tr.exit_code === 0 && <span className="ml-1 text-[10px] text-[#1E6B3C] font-sans font-medium">(Success)</span>}
            {tr.exit_code === 1 && <span className="ml-1 text-[10px] text-[#9C2A2A] font-sans font-medium">(Tests Failed)</span>}
          </p>
        </div>

        <div className="bg-[#FAF8F5] rounded-xl border border-warm-border p-3">
          <div className="flex items-center gap-1.5 text-ink-muted text-[11px]">
            <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span>Duration</span>
          </div>
          <p className="font-mono text-xs font-semibold text-ink-primary mt-1">
            {durationSec ? `${durationSec}s` : 'N/A'}
          </p>
        </div>

        <div className="bg-[#FAF8F5] rounded-xl border border-warm-border p-3">
          <div className="flex items-center gap-1.5 text-ink-muted text-[11px]">
            <span>Passed / Failed</span>
          </div>
          <p className="text-xs font-semibold mt-1">
            <span className="text-[#1E6B3C] font-mono">{tr.tests_passed ?? 0} passed</span>
            <span className="text-ink-muted mx-1">/</span>
            <span className="text-[#9C2A2A] font-mono">{tr.tests_failed ?? 0} failed</span>
          </p>
        </div>
      </div>

      {/* Stream Logs */}
      <div className="space-y-3">
        <LogPanel
          label="pytest stdout"
          content={tr.stdout}
          truncated={tr.output_truncated}
          defaultOpen={true}
          badge={`${tr.stdout.split('\n').length} lines`}
        />

        {tr.stderr && tr.stderr.trim() && (
          <LogPanel
            label="pytest stderr"
            content={tr.stderr}
            truncated={tr.output_truncated}
            defaultOpen={!isSuccess}
            badge={`${tr.stderr.split('\n').length} lines`}
          />
        )}
      </div>
    </div>
  );
}
