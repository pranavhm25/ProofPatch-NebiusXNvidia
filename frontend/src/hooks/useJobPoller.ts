import { useEffect, useRef, useState } from 'react';
import { getJobStatus, getJobResult } from '../lib/api';
import { jobSessionStore } from '../lib/jobSessionStore';
import type { JobStatusResponse, JobResult } from '../types/api';

const TERMINAL_STATES = new Set(['COMPLETED', 'FAILED', 'BLOCKED', 'CANCELLED']);
const POLL_INTERVAL_MS = 1500;

export interface PollState {
  status: JobStatusResponse | null;
  result: JobResult | null;
  error: string | null;
  loading: boolean;
}

export function useJobPoller(jobId: string | null): PollState {
  const [state, setState] = useState<PollState>({
    status: null,
    result: null,
    error: null,
    loading: !!jobId,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!jobId) {
      setState({ status: null, result: null, error: null, loading: false });
      return;
    }

    let mounted = true;

    const poll = async () => {
      try {
        const statusData = await getJobStatus(jobId);
        if (!mounted) return;
        setState((prev) => ({ ...prev, status: statusData, loading: false, error: null }));

        // Sync with session store
        jobSessionStore.updateJob(jobId, {
          status: statusData.status,
          stage: statusData.stage,
        });

        if (TERMINAL_STATES.has(statusData.status)) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          try {
            const resultData = await getJobResult(jobId);
            if (mounted) {
              setState((prev) => ({ ...prev, result: resultData }));

              const lastAttempt = resultData.attempts[resultData.attempts.length - 1];
              const durationSec = lastAttempt?.test_result?.duration_ms
                ? lastAttempt.test_result.duration_ms / 1000
                : null;

              jobSessionStore.updateJob(jobId, {
                status: resultData.status,
                verdict: resultData.verdict,
                attemptCount: resultData.attempts.length,
                durationSeconds: durationSec,
                modelId: resultData.model?.model_id ?? null,
              });
            }
          } catch {
            // Result record may still be writing
          }
        }
      } catch (err) {
        if (!mounted) return;
        const msg = err instanceof Error ? err.message : 'Connection error while checking job status.';
        setState((prev) => ({ ...prev, error: msg, loading: false }));
      }
    };

    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      mounted = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [jobId]);

  return state;
}
