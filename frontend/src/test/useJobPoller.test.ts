import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
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
  });

  it('returns initial empty state when jobId is null', () => {
    const { result } = renderHook(() => useJobPoller(null));
    expect(result.current.status).toBeNull();
    expect(result.current.result).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('polls job status and halts when reaching terminal state COMPLETED', async () => {
    const mockStatus: JobStatusResponse = {
      job_id: 'job-123',
      status: 'COMPLETED',
      stage: 'COMPLETED',
      progress_percent: 100,
      created_at: '2026-10-30T10:00:00Z',
      updated_at: '2026-10-30T10:01:00Z',
      terminal: true,
      events: [],
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
      attempts: [],
      diff: {
        available: true,
        changed_files: ['calc.py'],
        unified_diff: '--- a/calc.py\n+++ b/calc.py\n',
        download_patch_url: '/api/jobs/job-123/download/patch',
        download_zip_url: '/api/jobs/job-123/download/patched-zip',
      },
      completed_at: '2026-10-30T10:01:00Z',
    };

    vi.mocked(api.getJobStatus).mockResolvedValue(mockStatus);
    vi.mocked(api.getJobResult).mockResolvedValue(mockResult);

    const { result } = renderHook(() => useJobPoller('job-123'));

    await waitFor(() => {
      expect(result.current.status).toEqual(mockStatus);
      expect(result.current.result).toEqual(mockResult);
      expect(result.current.loading).toBe(false);
    });

    expect(api.getJobStatus).toHaveBeenCalledWith('job-123');
    expect(api.getJobResult).toHaveBeenCalledWith('job-123');
  });

  it('captures network and API errors cleanly in state', async () => {
    vi.mocked(api.getJobStatus).mockRejectedValue(new Error('Network error 500'));

    const { result } = renderHook(() => useJobPoller('job-123'));

    await waitFor(() => {
      expect(result.current.error).toBe('Network error 500');
      expect(result.current.loading).toBe(false);
    });
  });
});
