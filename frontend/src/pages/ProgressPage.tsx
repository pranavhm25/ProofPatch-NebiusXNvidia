import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { StageTimeline } from '../components/StageTimeline';
import { LogPanel } from '../components/LogPanel';
import { Alert } from '../components/Alert';
import { CopyButton } from '../components/CopyButton';
import { Spinner } from '../components/Spinner';
import { useJobPoller } from '../hooks/useJobPoller';
import type { JobStatus } from '../types/api';
import { Check, ArrowRight, Clock, Terminal } from 'lucide-react';

const TERMINAL_STATES = new Set<JobStatus>(['COMPLETED', 'FAILED', 'BLOCKED', 'CANCELLED']);

export function ProgressPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { status, result, error, loading } = useJobPoller(jobId ?? null);

  const [startTime] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);

  // Timer
  useEffect(() => {
    if (status && TERMINAL_STATES.has(status.status)) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, status]);

  // Auto-navigate to result on completion
  useEffect(() => {
    if (status && TERMINAL_STATES.has(status.status)) {
      const timer = setTimeout(() => {
        navigate(`/jobs/${jobId}/result`, { replace: true });
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [status, jobId, navigate]);

  const isTerminal = status ? TERMINAL_STATES.has(status.status) : false;

  // Format events log
  const eventLogText = status?.events
    ? status.events
        .map(
          (e) =>
            `[${new Date(e.timestamp).toLocaleTimeString()}] ${e.stage.padEnd(12)} — ${e.message}`
        )
        .join('\n')
    : '';

  return (
    <div className="max-w-3xl mx-auto w-full space-y-6">
      <PageHeader
        title="Repair Pipeline Active"
        badge={status?.status ?? 'INITIALIZING'}
        description="The automated repair orchestrator is inspecting the workspace, invoking NVIDIA models on Nebius Token Factory, and testing candidate patches."
        actions={
          jobId ? (
            <CopyButton
              text={jobId}
              label={jobId.slice(0, 8)}
              copiedLabel="Copied ID"
              title="Copy full Job ID"
            />
          ) : undefined
        }
      />

      {error && (
        <Alert kind="warning" title="Connection Interrupted">
          {error}
        </Alert>
      )}

      {/* Live Stage Progress Card */}
      <div className="rounded-2xl border border-warm-border dark:border-dark-border bg-white dark:bg-dark-surface p-6 shadow-soft space-y-6">
        <div
          className="flex items-center justify-between pb-4 border-b border-warm-border-subtle dark:border-dark-border-subtle"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="flex items-center gap-2">
            {!isTerminal ? (
              <Spinner size="sm" className="text-[#27618D] dark:text-sky-400" />
            ) : (
              <Check className="h-4 w-4 text-[#1E6B3C] dark:text-emerald-400" strokeWidth={1.5} />
            )}
            <span className="text-xs font-semibold text-ink-primary dark:text-dark-ink-primary">
              {status?.stage || 'Connecting to orchestrator…'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-ink-secondary dark:text-dark-ink-secondary font-mono">
            <Clock className="h-3.5 w-3.5 text-ink-muted dark:text-dark-ink-muted" />
            <span>{elapsed}s elapsed</span>
          </div>
        </div>

        {status ? (
          <StageTimeline
            currentStatus={status.status}
            stageMessage={status.stage}
            elapsedSeconds={elapsed}
            modelId={result?.model?.model_id}
            attemptNumber={result?.attempts?.length || 1}
          />
        ) : loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
            <Spinner size="md" />
            <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary">
              Connecting to repair worker process…
            </p>
          </div>
        ) : null}

        {isTerminal && (
          <div className="pt-2 border-t border-warm-border-subtle dark:border-dark-border-subtle flex items-center justify-between">
            <span className="text-xs text-ink-secondary dark:text-dark-ink-secondary">
              Job complete. Ready to view test evidence.
            </span>
            <Link
              to={`/jobs/${jobId}/result`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-ink-primary dark:bg-dark-ink-primary text-warm-bg dark:text-dark-bg text-xs font-semibold hover:opacity-90 shadow-soft transition-colors"
            >
              <span>View Results</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </div>

      {/* Live Event Stream Panel */}
      {status?.events && status.events.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-secondary dark:text-dark-ink-secondary px-1">
            <Terminal className="h-3.5 w-3.5 text-ink-muted dark:text-dark-ink-muted" />
            <span>Orchestrator Stage Event Stream</span>
          </div>
          <LogPanel
            label="Live Job Events"
            content={eventLogText}
            defaultOpen={true}
            badge={`${status.events.length} events`}
          />
        </div>
      )}
    </div>
  );
}
