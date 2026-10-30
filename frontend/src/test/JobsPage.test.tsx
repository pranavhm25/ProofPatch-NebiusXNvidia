import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { BrowserRouter } from 'react-router-dom';
import { JobsPage } from '../pages/JobsPage';
import * as api from '../lib/api';
import { jobSessionStore } from '../lib/jobSessionStore';
import type { JobListResponse } from '../types/api';

vi.mock('../lib/api', () => ({
  getJobs: vi.fn(),
  downloadUrl: vi.fn(),
}));

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('JobsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches jobs from backend and displays them', async () => {
    const mockJobList: JobListResponse = {
      total: 1,
      jobs: [
        {
          job_id: 'job-abc-12345',
          project_id: 'proj-1',
          project_name: 'calculator_repo',
          bug_report: 'Zero division error in calculate()',
          status: 'COMPLETED',
          stage: 'Repair verified successfully',
          verdict: 'VERIFIED',
          attempt_count: 1,
          model_id: 'nvidia/Nemotron-3-Ultra-550b-a55b',
          duration_seconds: 14.2,
          created_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        },
      ],
    };

    vi.mocked(api.getJobs).mockResolvedValueOnce(mockJobList);

    renderWithRouter(<JobsPage />);

    await waitFor(() => {
      expect(screen.getByText('calculator_repo')).toBeInTheDocument();
      expect(screen.getByText('Zero division error in calculate()')).toBeInTheDocument();
      expect(screen.getByText('1 records')).toBeInTheDocument();
    });
  });

  it('falls back to jobSessionStore if backend fetch fails', async () => {
    vi.mocked(api.getJobs).mockRejectedValueOnce(new Error('Network error'));

    jobSessionStore.addJob({
      jobId: 'session-job-999',
      projectName: 'fallback_repo',
      bugReport: 'Fallback bug report',
      createdAt: new Date().toISOString(),
      status: 'FAILED',
      verdict: 'FAILED',
      attemptCount: 1,
      durationSeconds: 5.5,
      modelId: null,
    });

    renderWithRouter(<JobsPage />);

    await waitFor(() => {
      expect(screen.getByText('fallback_repo')).toBeInTheDocument();
      expect(screen.getByText('Fallback bug report')).toBeInTheDocument();
      expect(screen.getByText(/Offline Cache/i)).toBeInTheDocument();
    });
  });
});
