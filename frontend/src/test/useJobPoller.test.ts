import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { useJobPoller } from '../hooks/useJobPoller';
import * as api from '../lib/api';
import type { JobStatusResponse, JobResult } from '../types/api';

vi.mock('../lib/api', () => ({
  getJobStatus: vi.fn(),
  getJobResult: vi.fn(),
}));

describe('useJobPoller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('returns initial empty state when jobId is null', () => {
    const { result } = renderHook(() => useJobPoller(null));
    expect(result.current.status).toBeNull();
    expect(result.current.result).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('polls on interval with fake timers and stops on COMPLETED terminal status', async () => {
    vi.useFakeTimers();

    const runningStatus: JobStatusResponse = {
      job_id: 'job-123',
      status: 'RUNNING',
      stage: 'RUNNING_TESTS',
      progress_percent: 50,
      created_at: '2026-10-30T10:00:00Z',
      updated_at: '2026-10-30T10:00:30Z',
      terminal: false,
      events: [],
    };

    const completedStatus: JobStatusResponse = {
      ...runningStatus,
      status: 'COMPLETED',
      stage: 'COMPLETED',
      progress_percent: 100,
      terminal: true,
    };

    const mockResult: JobResult = {
      job_id: 'job-123',
      status: 'COMPLETED',
      verdict: 'VERIFIED',
      summary: 'All pytests passed successfully.',
      limitations: [],
      model: {
        provider: 'nebius',
        model_id: 'nvidia/Nemotron-3-Ultra-550b-a55b',
        prompt_version: 'v1.0',
      },
      attempts: [
        {
          attempt_number: 1,
          stage: 'RUNNING_TESTS',
          model_called: 'nvidia/Nemotron-3-Ultra-550b-a55b',
          hunks_applied: 1,
          hunks_failed: 0,
          test_result: {
            tests_passed: 5,
            tests_failed: 0,
            duration_ms: 2500,
            stdout: '5 passed',
            stderr: '',
            exit_code: 0,
          },
        },
      ],
      diff: {
        available: true,
        changed_files: ['calc.py'],
        unified_diff: '--- a/calc.py\n+++ b/calc.py\n',
        download_patch_url: '/api/jobs/job-123/download/patch',
        download_zip_url: '/api/jobs/job-123/download/patched-zip',
      },
      completed_at: '2026-10-30T10:01:00Z',
    };

    vi.mocked(api.getJobStatus)
      .mockResolvedValueOnce(runningStatus)
      .mockResolvedValueOnce(completedStatus);
    vi.mocked(api.getJobResult).mockResolvedValue(mockResult);

    const { result } = renderHook(() => useJobPoller('job-123'));

    // First call (immediate)
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.status?.status).toBe('RUNNING');
    expect(result.current.loading).toBe(false);
    expect(api.getJobStatus).toHaveBeenCalledTimes(1);

    // Advance 1500ms for next poll
    await act(async () => {
      vi.advanceTimersByTime(1500);
      await Promise.resolve();
    });

    expect(result.current.status?.status).toBe('COMPLETED');
    expect(result.current.result).toEqual(mockResult);
    expect(api.getJobStatus).toHaveBeenCalledTimes(2);
    expect(api.getJobResult).toHaveBeenCalledWith('job-123');

    // Advance another 3000ms - polling must NOT fire again because terminal status stopped it
    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    expect(api.getJobStatus).toHaveBeenCalledTimes(2);
  });

  it('stops polling on terminal status FAILED and BLOCKED', async () => {
    vi.useFakeTimers();

    const blockedStatus: JobStatusResponse = {
      job_id: 'job-blocked',
      status: 'BLOCKED',
      stage: 'SECURITY_LIMIT',
      progress_percent: 100,
      created_at: '2026-10-30T10:00:00Z',
      updated_at: '2026-10-30T10:00:10Z',
      terminal: true,
      events: [],
    };

    const blockedResult: JobResult = {
      job_id: 'job-blocked',
      status: 'BLOCKED',
      verdict: 'BLOCKED',
      summary: 'Security policy violation.',
      limitations: ['Network access denied'],
      model: null,
      attempts: [],
      diff: {
        available: false,
        changed_files: [],
        unified_diff: '',
      },
      completed_at: '2026-10-30T10:00:10Z',
    };

    vi.mocked(api.getJobStatus).mockResolvedValue(blockedStatus);
    vi.mocked(api.getJobResult).mockResolvedValue(blockedResult);

    const { result } = renderHook(() => useJobPoller('job-blocked'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.status?.status).toBe('BLOCKED');
    expect(result.current.result?.verdict).toBe('BLOCKED');

    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    expect(api.getJobStatus).toHaveBeenCalledTimes(1);
  });

  it('cleans up polling interval and guards state update on unmount', async () => {
    vi.useFakeTimers();

    const runningStatus: JobStatusResponse = {
      job_id: 'job-unmount',
      status: 'RUNNING',
      stage: 'RUNNING_TESTS',
      progress_percent: 40,
      created_at: '2026-10-30T10:00:00Z',
      updated_at: '2026-10-30T10:00:10Z',
      terminal: false,
      events: [],
    };

    vi.mocked(api.getJobStatus).mockResolvedValue(runningStatus);

    const { result, unmount } = renderHook(() => useJobPoller('job-unmount'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.status?.status).toBe('RUNNING');
    expect(api.getJobStatus).toHaveBeenCalledTimes(1);

    // Unmount hook
    unmount();

    // Advance timer
    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    // Should not have polled again
    expect(api.getJobStatus).toHaveBeenCalledTimes(1);
  });

  it('handles 404/410 expired job errors gracefully', async () => {
    vi.mocked(api.getJobStatus).mockRejectedValue(new Error('Job not found or expired (404)'));

    const { result } = renderHook(() => useJobPoller('job-expired'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.error).toBe('Job not found or expired (404)');
    expect(result.current.loading).toBe(false);
  });
});
