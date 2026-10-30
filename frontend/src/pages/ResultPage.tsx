import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Clock, FileCode, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useJobPoller } from '../hooks/useJobPoller';
import { PageHeader } from '../components/PageHeader';
import { VerdictBadge } from '../components/VerdictBadge';
import { StatCard } from '../components/StatCard';
import { DiffViewer } from '../components/DiffViewer';
import { TestEvidencePanel } from '../components/TestEvidencePanel';
import { AttemptCard } from '../components/AttemptCard';
import { Alert } from '../components/Alert';
import { CardSkeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { LastUpdated } from '../components/LastUpdated';

export function ResultPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const { result, error, loading } = useJobPoller(jobId ?? null);

  if (loading && !result) {
    return (
      <div className="max-w-4xl mx-auto w-full space-y-6">
        <PageHeader title="Loading Repair Evidence" badge="Please wait…" />
        <CardSkeleton />
      </div>
    );
  }

  if (error && !result) {
    const isExpired = error.toLowerCase().includes('404') || error.toLowerCase().includes('not found');
    return (
      <div className="max-w-4xl mx-auto w-full space-y-6">
        <PageHeader title="Repair Job Unavailable" badge="Error" />
        {isExpired ? (
          <EmptyState
            icon={<Clock className="h-6 w-6 text-ink-muted dark:text-dark-ink-muted" strokeWidth={1.5} />}
            title="Workspace Expired"
            description="This temporary repair workspace reached its 60-minute retention limit and was automatically purged from the sandbox."
            action={
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-ink-primary dark:bg-dark-ink-primary text-warm-bg dark:text-dark-bg text-xs font-semibold hover:opacity-90 shadow-soft focus-visible:outline-2"
              >
                <span>Start New Repair</span>
              </Link>
            }
          />
        ) : (
          <Alert kind="error" title="Failed to Retrieve Results">
            {error}
          </Alert>
        )}
      </div>
    );
  }

  if (!result) {
    return (
      <div className="max-w-4xl mx-auto w-full space-y-6">
        <PageHeader title="No Result Found" badge="Not Found" />
        <EmptyState
          title="No Repair Records"
          description="Could not locate test execution records or patch artifacts for this job identifier."
          action={
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-ink-primary dark:bg-dark-ink-primary text-warm-bg dark:text-dark-bg text-xs font-semibold focus-visible:outline-2"
            >
              <span>Back to New Repair</span>
            </Link>
          }
        />
      </div>
    );
  }

  const lastAttempt = result.attempts[result.attempts.length - 1];
  const tr = lastAttempt?.test_result;

  // Build the one-line evidence-backed explanation
  let evidenceExplanation = '';
  if (result.verdict === 'VERIFIED') {
    evidenceExplanation = `All tests passed cleanly inside the sandbox (exit code ${tr?.exit_code ?? 0}, ${tr?.tests_passed ?? 0} tests verified in ${tr?.duration_ms ? (tr.duration_ms / 1000).toFixed(2) : '0.00'}s).`;
  } else if (result.verdict === 'NOT_VERIFIED') {
    evidenceExplanation = 'Test command completed with exit code 0, but no automated test cases were discovered in the repository.';
  } else if (result.verdict === 'FAILED') {
    evidenceExplanation = `Tests failed to pass inside the sandbox (exit code ${tr?.exit_code ?? 'non-zero'}, ${tr?.tests_failed ?? 0} failure(s) recorded).`;
  } else {
    evidenceExplanation = 'Sandbox or infrastructure execution could not complete successfully.';
  }

  return (
    <div className="max-w-4xl mx-auto w-full space-y-8">
      {/* Back Link & Header */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <Link
            to="/jobs"
            className="inline-flex items-center gap-1.5 text-xs text-ink-secondary dark:text-dark-ink-secondary hover:text-ink-primary dark:hover:text-dark-ink-primary transition-colors font-medium focus-visible:outline-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span>All Repair Jobs</span>
          </Link>
          <span className="text-xs font-mono text-ink-muted dark:text-dark-ink-muted">Job ID: {jobId?.slice(0, 8)}</span>
        </div>

        <PageHeader
          title="Repair Verification Result"
          badge={jobId?.slice(0, 8)}
          description="Examine the executed verification results, test output streams, generated unified diff patch, and attempt history."
          actions={
            <div className="flex items-center gap-2">
              <LastUpdated date="2026-10-30" />
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-warm-border dark:border-dark-border bg-white dark:bg-dark-surface text-xs font-medium text-ink-primary dark:text-dark-ink-primary hover:border-[#D8D2CA] dark:hover:border-dark-border shadow-soft transition-colors focus-visible:outline-2"
              >
                <span>New Repair</span>
              </Link>
            </div>
          }
        />
      </div>

      {/* Primary Verdict Hero Card */}
      <div className="rounded-2xl border border-warm-border dark:border-dark-border bg-[#FCFBF9] dark:bg-dark-surface p-6 sm:p-7 shadow-soft space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {result.verdict && <VerdictBadge verdict={result.verdict} size="lg" />}
            <span className="text-xs font-mono text-ink-secondary dark:text-dark-ink-secondary">
              {result.attempts.length} attempt{result.attempts.length > 1 ? 's' : ''} executed
            </span>
          </div>

          <div className="text-xs text-ink-secondary dark:text-dark-ink-secondary font-mono">
            Model: <span className="font-semibold text-ink-primary dark:text-dark-ink-primary">{result.model.model_id}</span>
          </div>
        </div>

        <div>
          <h2 className="text-base font-semibold text-ink-primary dark:text-dark-ink-primary">
            {result.summary || 'Automated code repair attempt completed.'}
          </h2>
          <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary mt-1 leading-relaxed">
            {evidenceExplanation}
          </p>
        </div>

        {/* Visible Honesty Line */}
        <div className="flex items-center gap-2 pt-3 border-t border-warm-border/60 dark:border-dark-border/60 text-[11px] text-[#1E6B3C] dark:text-emerald-400">
          <ShieldCheck className="h-4 w-4 shrink-0" strokeWidth={1.5} />
          <span className="font-medium">
            Evidence Invariant: Verdict is derived only from executed test results, not from model claims.
          </span>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Tests Passed"
          value={tr?.tests_passed ?? (result.verdict === 'VERIFIED' ? '1+' : '0')}
          icon={<CheckCircle2 className="h-4 w-4 text-[#1E6B3C] dark:text-emerald-400" strokeWidth={1.5} />}
        />
        <StatCard
          label="Tests Failed"
          value={tr?.tests_failed ?? (result.verdict === 'FAILED' ? '1+' : '0')}
          icon={<Clock className="h-4 w-4 text-ink-muted dark:text-dark-ink-muted" strokeWidth={1.5} />}
        />
        <StatCard
          label="Execution Duration"
          value={tr?.duration_ms != null ? `${(tr.duration_ms / 1000).toFixed(2)}s` : '—'}
          icon={<Clock className="h-4 w-4 text-ink-muted dark:text-dark-ink-muted" strokeWidth={1.5} />}
        />
        <StatCard
          label="Files Changed"
          value={result.diff.changed_files.length}
          icon={<FileCode className="h-4 w-4 text-ink-muted dark:text-dark-ink-muted" strokeWidth={1.5} />}
        />
      </div>

      {/* Limitations Notice */}
      {result.limitations.length > 0 && (
        <Alert kind="warning" title="Verification Scope & Boundaries">
          <ul className="list-disc pl-4 space-y-1 text-xs">
            {result.limitations.map((lim, i) => (
              <li key={i}>{lim}</li>
            ))}
          </ul>
        </Alert>
      )}

      {/* Code Diff Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-secondary dark:text-dark-ink-secondary">
            Generated Code Diff
          </h2>
          <span className="text-[11px] text-ink-muted dark:text-dark-ink-muted">
            {result.diff.changed_files.length} file{result.diff.changed_files.length !== 1 ? 's' : ''} modified
          </span>
        </div>
        {jobId && <DiffViewer diff={result.diff} jobId={jobId} />}
      </section>

      {/* Executed Test Evidence Section */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-secondary dark:text-dark-ink-secondary">
          Sandbox Test Execution Evidence
        </h2>
        {lastAttempt ? (
          <TestEvidencePanel attempt={lastAttempt} />
        ) : (
          <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary">No test runner output available.</p>
        )}
      </section>

      {/* Attempt History Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-secondary dark:text-dark-ink-secondary">
            Repair Attempts History ({result.attempts.length})
          </h2>
          <span className="text-[11px] text-ink-muted dark:text-dark-ink-muted">Max 2 attempts bounded</span>
        </div>
        <div className="space-y-3">
          {result.attempts.map((att) => (
            <AttemptCard key={att.attempt_number} attempt={att} defaultOpen={att.attempt_number === result.attempts.length} />
          ))}
        </div>
      </section>
    </div>
  );
}
