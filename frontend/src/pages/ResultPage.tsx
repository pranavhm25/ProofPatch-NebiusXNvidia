import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useJobPoller } from '../hooks/useJobPoller';
import { VerdictBadge } from '../components/VerdictBadge';
import { MetricCard } from '../components/MetricCard';
import { DiffViewer } from '../components/DiffViewer';
import { TestEvidencePanel } from '../components/TestEvidencePanel';
import { AttemptCard } from '../components/AttemptCard';
import { Alert } from '../components/Alert';

export function ResultPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const { result, error } = useJobPoller(jobId ?? null);

  if (error && !result) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <Alert kind="error">{error}</Alert>
      </main>
    );
  }

  if (!result) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-neutral-500">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-neutral-600 border-t-blue-500"></div>
        <p className="mt-3">Loading repair results and test evidence…</p>
      </main>
    );
  }

  const lastAttempt = result.attempts[result.attempts.length - 1];
  const tr = lastAttempt?.test_result;

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 space-y-8">
      <div className="flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-200 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Start another repair
        </Link>
        <span className="text-xs text-neutral-500 font-mono">Job: {jobId?.substring(0, 8)}</span>
      </div>

      <header className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
        <div className="flex items-center gap-3">
          {result.verdict && <VerdictBadge verdict={result.verdict} />}
          <span className="text-xs text-neutral-500 font-mono">Attempts: {result.attempts.length}</span>
        </div>
        <p className="text-neutral-200 text-base font-medium">{result.summary}</p>
        <p className="text-xs text-neutral-400">
          Model: <span className="text-neutral-300 font-mono">{result.model.model_id}</span> via {result.model.provider} · Prompt: <span className="font-mono">{result.model.prompt_version}</span>
        </p>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Tests Passed" value={tr?.tests_passed ?? '—'} />
        <MetricCard label="Tests Failed" value={tr?.tests_failed ?? '—'} />
        <MetricCard label="Duration" value={tr?.duration_ms != null ? `${(tr.duration_ms / 1000).toFixed(2)}s` : '—'} />
        <MetricCard label="Files Changed" value={result.diff.changed_files.length} />
      </div>

      {result.limitations.length > 0 && (
        <Alert kind="warning" title="Limitations & Scope">
          <ul className="list-disc pl-4 space-y-1 text-xs">
            {result.limitations.map((lim, i) => (
              <li key={i}>{lim}</li>
            ))}
          </ul>
        </Alert>
      )}

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Executed Test Evidence</h2>
        {lastAttempt ? (
          <TestEvidencePanel attempt={lastAttempt} />
        ) : (
          <p className="text-sm text-neutral-500">No test runner output available.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Code Diff</h2>
        {jobId && <DiffViewer diff={result.diff} jobId={jobId} />}
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Attempt History ({result.attempts.length})</h2>
        <div className="space-y-3">
          {result.attempts.map((a) => (
            <AttemptCard key={a.attempt_number} attempt={a} />
          ))}
        </div>
      </section>
    </main>
  );
}
