import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ResultPage } from '../pages/ResultPage';
import * as useJobPollerModule from '../hooks/useJobPoller';
import type { JobResult } from '../types/api';

vi.mock('../hooks/useJobPoller', () => ({
  useJobPoller: vi.fn(),
}));

const renderResultPage = (jobId = 'job-123') => {
  return render(
    <MemoryRouter initialEntries={[`/jobs/${jobId}/result`]}>
      <Routes>
        <Route path="/jobs/:jobId/result" element={<ResultPage />} />
        <Route path="/" element={<div>New Repair Page</div>} />
        <Route path="/jobs" element={<div>Jobs List Page</div>} />
      </Routes>
    </MemoryRouter>
  );
};

describe('ResultPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseResult: JobResult = {
    job_id: 'job-123',
    status: 'COMPLETED',
    verdict: 'VERIFIED',
    summary: 'Fix applied and verified with pytest suite.',
    limitations: ['Only python 3.11 tests verified'],
    model: {
      provider: 'nebius',
      model_id: 'nvidia/Nemotron-3-Ultra-550b-a55b',
      prompt_version: 'v1.0',
    },
    attempts: [
      {
        attempt_number: 1,
        stage: 'TESTING',
        status: 'TESTED',
        model_called: 'nvidia/Nemotron-3-Ultra-550b-a55b',
        changed_files: ['calculator.py'],
        hunks_applied: 1,
        hunks_failed: 0,
        test_result: {
          status: 'PASSED',
          exit_code: 0,
          duration_ms: 2400,
          tests_passed: 15,
          tests_failed: 0,
          stdout: '15 passed in 2.40s',
          stderr: '',
          output_truncated: false,
          command_id: 'pytest',
        },
      },
    ],
    diff: {
      available: true,
      changed_files: ['calculator.py'],
      unified_diff: '--- a/calculator.py\n+++ b/calculator.py\n@@ -1,2 +1,2 @@\n-def abs(n): return n\n+def abs(n): return abs(n)\n',
      download_patch_url: '/api/jobs/job-123/download?format=patch',
      download_zip_url: '/api/jobs/job-123/download?format=zip',
    },
    completed_at: '2026-10-30T10:05:00Z',
  };

  it('renders loading skeleton when fetching result', () => {
    vi.mocked(useJobPollerModule.useJobPoller).mockReturnValue({
      status: null,
      result: null,
      error: null,
      loading: true,
    });

    renderResultPage();
    expect(screen.getByText('Loading Repair Evidence')).toBeInTheDocument();
  });

  it('renders expired workspace empty state when job error is 404', () => {
    vi.mocked(useJobPollerModule.useJobPoller).mockReturnValue({
      status: null,
      result: null,
      error: 'Job not found (404)',
      loading: false,
    });

    renderResultPage();
    expect(screen.getByText('Workspace Expired')).toBeInTheDocument();
    expect(
      screen.getByText(/This temporary repair workspace reached its 60-minute retention limit/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Start New Repair/i })).toBeInTheDocument();
  });

  it('renders generic error alert when fetch fails with non-404 error', () => {
    vi.mocked(useJobPollerModule.useJobPoller).mockReturnValue({
      status: null,
      result: null,
      error: 'Internal server error 500',
      loading: false,
    });

    renderResultPage();
    expect(screen.getByText('Failed to Retrieve Results')).toBeInTheDocument();
    expect(screen.getByText('Internal server error 500')).toBeInTheDocument();
  });

  it('renders VERIFIED result with honesty invariant, metrics, diff, and evidence', () => {
    vi.mocked(useJobPollerModule.useJobPoller).mockReturnValue({
      status: null,
      result: baseResult,
      error: null,
      loading: false,
    });

    renderResultPage();

    expect(screen.getByText('Repair Verification Result')).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.getByText('Fix applied and verified with pytest suite.')).toBeInTheDocument();
    expect(
      screen.getByText(/Evidence Invariant: Verdict is derived only from executed test results, not from model claims/i)
    ).toBeInTheDocument();

    expect(screen.getAllByText('15 passed').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Only python 3.11 tests verified')).toBeInTheDocument();
    expect(screen.getByText('Download .patch')).toBeInTheDocument();
  });

  it('renders NOT_VERIFIED result with 0 tests discovered explanation', () => {
    const notVerifiedResult: JobResult = {
      ...baseResult,
      verdict: 'NOT_VERIFIED',
      summary: 'No test suite was found in the project.',
      attempts: [
        {
          attempt_number: 1,
          stage: 'TESTING',
          status: 'TESTED',
          model_called: 'nvidia/Nemotron-3-Ultra-550b-a55b',
          changed_files: ['calculator.py'],
          hunks_applied: 1,
          hunks_failed: 0,
          test_result: {
            status: 'NO_TESTS_COLLECTED',
            exit_code: 5,
            duration_ms: 100,
            tests_passed: 0,
            tests_failed: 0,
            stdout: 'collected 0 items',
            stderr: '',
            output_truncated: false,
          },
        },
      ],
    };

    vi.mocked(useJobPollerModule.useJobPoller).mockReturnValue({
      status: null,
      result: notVerifiedResult,
      error: null,
      loading: false,
    });

    renderResultPage();

    expect(screen.getByText('Not Verified')).toBeInTheDocument();
    expect(
      screen.getByText(/no automated test cases were discovered in the repository/i)
    ).toBeInTheDocument();
  });

  it('renders FAILED result with test failure counts and explanation', () => {
    const failedResult: JobResult = {
      ...baseResult,
      verdict: 'FAILED',
      summary: 'Pytest suite failed after 2 attempts.',
      attempts: [
        {
          attempt_number: 1,
          stage: 'TESTING',
          status: 'TESTED',
          model_called: 'nvidia/Nemotron-3-Ultra-550b-a55b',
          changed_files: ['calculator.py'],
          hunks_applied: 1,
          hunks_failed: 0,
          test_result: {
            status: 'FAILED',
            exit_code: 1,
            duration_ms: 1500,
            tests_passed: 12,
            tests_failed: 3,
            stdout: '12 passed, 3 failed',
            stderr: 'AssertionError: assert False',
            output_truncated: false,
          },
        },
      ],
    };

    vi.mocked(useJobPollerModule.useJobPoller).mockReturnValue({
      status: null,
      result: failedResult,
      error: null,
      loading: false,
    });

    renderResultPage();

    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(
      screen.getByText(/Tests failed to pass inside the sandbox \(exit code 1, 3 failure\(s\) recorded\)/i)
    ).toBeInTheDocument();
  });
});
