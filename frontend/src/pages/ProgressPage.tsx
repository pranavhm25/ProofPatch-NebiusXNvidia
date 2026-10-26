import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { StageTimeline } from '../components/StageTimeline';
import { Alert } from '../components/Alert';
import { useJobPoller } from '../hooks/useJobPoller';
import type { JobStatus } from '../types/api';

const TERMINAL_STATES = new Set<JobStatus>(['COMPLETED', 'FAILED', 'BLOCKED', 'CANCELLED']);

export function ProgressPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { status, error } = useJobPoller(jobId ?? null);
  const [start] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [start]);

  useEffect(() => {
    if (status && TERMINAL_STATES.has(status.status)) {
      navigate(`/jobs/${jobId}/result`, { replace: true });
    }
  }, [status, jobId, navigate]);

  return (
    <main className="mx-auto max-w-xl px-4 py-16 space-y-8">
      <header className="space-y-1">
        <h1 className="text-xl font-bold text-neutral-100">Repair Pipeline Active</h1>
        {jobId && (
          <p className="text-xs text-neutral-500 font-mono">
            Job ID:{' '}
            <button
              onClick={() => navigator.clipboard.writeText(jobId)}
              className="text-neutral-400 hover:text-neutral-200 underline transition-colors"
              title="Copy Job ID"
            >
              {jobId}
            </button>
          </p>
        )}
      </header>

      {error && <Alert kind="warning">{error}</Alert>}

      <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6">
        {status ? (
          <StageTimeline
            currentStatus={status.status}
            stageMessage={status.stage}
            elapsedSeconds={elapsed}
          />
        ) : (
          <div className="flex items-center gap-2 text-sm text-neutral-400">
            <span className="h-2 w-2 rounded-full bg-blue-500 animate-ping"></span>
            Connecting to repair orchestrator…
          </div>
        )}
      </div>
    </main>
  );
}
