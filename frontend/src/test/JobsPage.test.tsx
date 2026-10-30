import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { JobsPage } from '../pages/JobsPage';
import * as api from '../lib/api';
import { jobSessionStore } from '../lib/jobSessionStore';
import type { JobListResponse } from '../types/api';

vi.mock('../lib/api', () => ({
  getJobs: vi.fn(),
  downloadUrl: vi.fn(),
}));

const renderWithRouter = (initialPath = '/jobs') => {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <JobsPage />
    </MemoryRouter>
  );
};

describe('JobsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockJobsList: JobListResponse = {
    total: 3,
    jobs: [
      {
        job_id: 'job-1',
        project_id: 'proj-1',
        project_name: 'verified_repo',
        bug_report: 'Fixed division error',
        status: 'COMPLETED',
        stage: 'Repair verified successfully',
        verdict: 'VERIFIED',
        attempt_count: 1,
        model_id: 'nvidia/Nemotron-3-Ultra-550b-a55b',
        duration_seconds: 14.2,
        created_at: '2026-10-30T10:00:00Z',
        completed_at: '2026-10-30T10:00:14Z',
      },
      {
        job_id: 'job-2',
        project_id: 'proj-2',
        project_name: 'running_repo',
        bug_report: 'Running tests now',
        status: 'TESTING',
        stage: 'Running pytest in sandbox',
        verdict: null,
        attempt_count: 1,
        model_id: null,
        duration_seconds: null,
        created_at: '2026-10-30T10:05:00Z',
        completed_at: null,
      },
      {
        job_id: 'job-3',
        project_id: 'proj-3',
        project_name: 'failed_repo',
        bug_report: 'Assertion failure in test',
        status: 'FAILED',
        stage: 'Tests failed after 2 attempts',
        verdict: 'FAILED',
        attempt_count: 2,
        model_id: 'nvidia/Nemotron-3-Ultra-550b-a55b',
        duration_seconds: 22.1,
        created_at: '2026-10-30T10:10:00Z',
        completed_at: '2026-10-30T10:10:22Z',
      },
    ],
  };

  it('fetches jobs from backend and displays them with stats', async () => {
    vi.mocked(api.getJobs).mockResolvedValueOnce(mockJobsList);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('verified_repo')).toBeInTheDocument();
      expect(screen.getByText('running_repo')).toBeInTheDocument();
      expect(screen.getByText('failed_repo')).toBeInTheDocument();
      expect(screen.getByText('3 records')).toBeInTheDocument();
    });
  });

  it('filters jobs using pill tabs', async () => {
    vi.mocked(api.getJobs).mockResolvedValue(mockJobsList);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('verified_repo')).toBeInTheDocument();
    });

    // Filter to Verified
    fireEvent.click(screen.getByRole('tab', { name: /Verified/i }));
    expect(screen.getByText('verified_repo')).toBeInTheDocument();
    expect(screen.queryByText('running_repo')).not.toBeInTheDocument();
    expect(screen.queryByText('failed_repo')).not.toBeInTheDocument();

    // Filter to In Progress
    fireEvent.click(screen.getByRole('tab', { name: /In Progress/i }));
    expect(screen.getByText('running_repo')).toBeInTheDocument();
    expect(screen.queryByText('verified_repo')).not.toBeInTheDocument();
    expect(screen.queryByText('failed_repo')).not.toBeInTheDocument();

    // Filter to Failed
    fireEvent.click(screen.getByRole('tab', { name: /Failed/i }));
    expect(screen.getByText('failed_repo')).toBeInTheDocument();
    expect(screen.queryByText('verified_repo')).not.toBeInTheDocument();
    expect(screen.queryByText('running_repo')).not.toBeInTheDocument();
  });

  it('handles select all and individual row checkboxes', async () => {
    vi.mocked(api.getJobs).mockResolvedValueOnce(mockJobsList);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('verified_repo')).toBeInTheDocument();
    });

    // Select All
    const selectAllBox = screen.getByLabelText('Select all jobs') as HTMLInputElement;
    expect(selectAllBox.checked).toBe(false);

    fireEvent.click(selectAllBox);
    expect(selectAllBox.checked).toBe(true);

    // Unselect All
    fireEvent.click(selectAllBox);
    expect(selectAllBox.checked).toBe(false);

    // Select single row
    const singleRowCheckbox = screen.getByLabelText('Select job job-1') as HTMLInputElement;
    fireEvent.click(singleRowCheckbox);
    expect(singleRowCheckbox.checked).toBe(true);
    fireEvent.click(singleRowCheckbox);
    expect(singleRowCheckbox.checked).toBe(false);
  });

  it('renders EmptyState when no jobs exist', async () => {
    vi.mocked(api.getJobs).mockResolvedValueOnce({ total: 0, jobs: [] });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('No Repair Jobs Yet')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Start First Repair' })).toBeInTheDocument();
    });
  });

  it('triggers manual refresh on refresh button click', async () => {
    vi.mocked(api.getJobs).mockResolvedValue(mockJobsList);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('verified_repo')).toBeInTheDocument();
    });

    const refreshBtn = screen.getByTitle('Refresh jobs from backend');
    fireEvent.click(refreshBtn);

    expect(api.getJobs).toHaveBeenCalledTimes(2);
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

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('fallback_repo')).toBeInTheDocument();
      expect(screen.getByText('Fallback bug report')).toBeInTheDocument();
      expect(screen.getByText(/Offline Cache/i)).toBeInTheDocument();
    });
  });
});
