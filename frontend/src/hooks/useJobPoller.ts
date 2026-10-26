import { useEffect, useRef, useState } from 'react';
import { getJobStatus, getJobResult } from '../api/client';
import type { JobStatusResponse, JobResult } from '../types/api';

const TERMINAL_STATES = new Set(['COMPLETED', 'FAILED', 'BLOCKED', 'CANCELLED']);
const POLL_INTERVAL_MS = 1500;

interface PollState {
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
    if (!jobId) return;

    let mounted = true;

    const poll = async () => {
      try {
        const statusData = await getJobStatus(jobId);
        if (!mounted) return;
        setState((prev) => ({ ...prev, status: statusData, loading: false }));

        if (TERMINAL_STATES.has(statusData.status)) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          try {
            const resultData = await getJobResult(jobId);
            if (mounted) {
              setState((prev) => ({ ...prev, result: resultData }));
            }
          } catch {
            // Result may still be writing
          }
        }
      } catch {
        if (mounted) {
          setState((prev) => ({ ...prev, error: 'Connection error; retrying...', loading: false }));
        }
      }
    };

    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      mounted = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [jobId]);

  return state;
}
