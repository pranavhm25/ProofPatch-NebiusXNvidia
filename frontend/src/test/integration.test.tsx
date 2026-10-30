import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from '../components/Toast';
import { NewRepairPage } from '../pages/NewRepairPage';
import { ProgressPage } from '../pages/ProgressPage';
import { ResultPage } from '../pages/ResultPage';
import { server } from './mocks/server';
import { http, HttpResponse } from 'msw';
import {
  mockJobStatusByStage,
  mockResultVerified,
  mockResultFailed,
  mockResultNotVerified,
  mockResultBlocked,
  mockResultWithRetry,
  mockErrors,
} from './mocks/fixtures';

const renderAppWithRoute = (initialPath = '/') => {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<NewRepairPage />} />
          <Route path="/jobs/:jobId" element={<ProgressPage />} />
          <Route path="/jobs/:jobId/result" element={<ResultPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>
  );
};

describe('End-to-End Integration Tests (MSW + RTL)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Full Happy Path (Upload -> Create -> Progress -> Result)', () => {
    it('executes complete pipeline lifecycle from new repair to verified results', async () => {
      renderAppWithRoute('/');

      // 1. On NewRepairPage
      expect(screen.getByText('New Repair')).toBeInTheDocument();
      const submitBtn = screen.getByRole('button', { name: /Analyze and Repair/i });
      expect(submitBtn).toBeDisabled();

      // 2. Select archive
      const file = new File(['dummy python code'], 'calculator_repo.zip', {
        type: 'application/zip',
      });
      const input = screen.getByTestId('dropzone-file-input');
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('sample-service')).toBeInTheDocument();
        expect(screen.getByText('Valid Project')).toBeInTheDocument();
      });

      // 3. Type bug report
      const textarea = screen.getByPlaceholderText(/Describe the bug/i);
      fireEvent.change(textarea, {
        target: { value: 'Fix TypeError in calculate_magnitude() when input is negative' },
      });

      expect(submitBtn).not.toBeDisabled();

      // 4. Click Submit
      fireEvent.click(submitBtn);

      // 5. Assert: router transitions to ProgressPage
      await waitFor(
        () => {
          expect(screen.getByText('Repair Pipeline Active')).toBeInTheDocument();
        },
        { timeout: 3500 }
      );

      // 6. Assert: Timeline shows stages
      await waitFor(() => {
        expect(screen.getByText(/1\. Validating Repository/i)).toBeInTheDocument();
      });
      expect(screen.getByText(/4\. Generating Patch/i)).toBeInTheDocument();
      expect(screen.getByText(/5\. Running Tests/i)).toBeInTheDocument();

      // 7. Auto-navigate to ResultPage on COMPLETED status
      await waitFor(
        () => {
          expect(screen.getByText('Repair Verification Result')).toBeInTheDocument();
        },
        { timeout: 3500 }
      );

      // 8. ResultPage assertions
      expect(screen.getByText('Verified')).toBeInTheDocument();
      expect(
        screen.getByText(/Evidence Invariant: Verdict is derived only from executed test results/i)
      ).toBeInTheDocument();
      expect(screen.getByText('Download .patch')).toBeInTheDocument();
      expect(screen.getByText('Download patched .zip')).toBeInTheDocument();
    });
  });

  describe('2. Failure Paths & Truthfulness Invariant', () => {
    it('renders FAILED verdict without ever showing "Verified" as a success state', async () => {
      server.use(
        http.get('*/api/jobs/:id', () => {
          return HttpResponse.json(mockJobStatusByStage.FAILED, { status: 200 });
        }),
        http.get('*/api/jobs/:id/result', () => {
          return HttpResponse.json(mockResultFailed, { status: 200 });
        })
      );

      renderAppWithRoute('/jobs/job-fail-123/result');

      await waitFor(() => {
        expect(screen.getByText('Repair Verification Result')).toBeInTheDocument();
      });

      expect(screen.getByText('Failed')).toBeInTheDocument();
      expect(screen.getByText(/Tests failed to pass inside the sandbox/i)).toBeInTheDocument();

      // Crucial truthfulness check: "Verified" badge or status MUST NOT exist
      const verifiedBadges = screen.queryAllByText('Verified');
      expect(verifiedBadges.length).toBe(0);
    });

    it('renders NOT_VERIFIED verdict when 0 test cases are collected', async () => {
      server.use(
        http.get('*/api/jobs/:id', () => {
          return HttpResponse.json(mockJobStatusByStage.COMPLETED, { status: 200 });
        }),
        http.get('*/api/jobs/:id/result', () => {
          return HttpResponse.json(mockResultNotVerified, { status: 200 });
        })
      );

      renderAppWithRoute('/jobs/job-notverified-123/result');

      await waitFor(() => {
        expect(screen.getByText('Repair Verification Result')).toBeInTheDocument();
      });

      expect(screen.getByText('Not Verified')).toBeInTheDocument();
      expect(
        screen.getByText(/no automated test cases were discovered in the repository/i)
      ).toBeInTheDocument();

      // Ensure no green Verified badge is rendered
      expect(screen.queryByText('Verified')).not.toBeInTheDocument();
    });

    it('renders BLOCKED verdict when security violation or execution halt occurs', async () => {
      server.use(
        http.get('*/api/jobs/:id', () => {
          return HttpResponse.json(mockJobStatusByStage.BLOCKED, { status: 200 });
        }),
        http.get('*/api/jobs/:id/result', () => {
          return HttpResponse.json(mockResultBlocked, { status: 200 });
        })
      );

      renderAppWithRoute('/jobs/job-blocked-123/result');

      await waitFor(() => {
        expect(screen.getByText('Repair Verification Result')).toBeInTheDocument();
      });

      expect(screen.getByText('Blocked')).toBeInTheDocument();
      expect(
        screen.getByText(/Sandbox or infrastructure execution could not complete successfully/i)
      ).toBeInTheDocument();

      // Crucial truthfulness check: "Verified" MUST NOT exist
      expect(screen.queryByText('Verified')).not.toBeInTheDocument();
    });
  });

  describe('3. Bounded Retry Path', () => {
    it('renders 2 attempts in history when Attempt 1 fails and Attempt 2 succeeds', async () => {
      server.use(
        http.get('*/api/jobs/:id/result', () => {
          return HttpResponse.json(mockResultWithRetry, { status: 200 });
        })
      );

      renderAppWithRoute('/jobs/job-retry-123/result');

      await waitFor(() => {
        expect(screen.getByText('Repair Verification Result')).toBeInTheDocument();
      });

      expect(screen.getByText('Verified')).toBeInTheDocument();
      expect(screen.getByText('2 attempts executed')).toBeInTheDocument();

      // Check Attempt Cards
      expect(screen.getByText('Attempt 1')).toBeInTheDocument();
      expect(screen.getByText('Attempt 2')).toBeInTheDocument();
      expect(screen.getByText('1 passed, 1 failed')).toBeInTheDocument();
      expect(screen.getByText('2 passed, 0 failed')).toBeInTheDocument();
    });
  });

  describe('4. Error and Boundary Paths', () => {
    it('handles 413 file too large error from backend gracefully', async () => {
      server.use(
        http.post('*/api/projects', () => {
          return HttpResponse.json(mockErrors.UPLOAD_TOO_LARGE.body, { status: 413 });
        })
      );

      renderAppWithRoute('/');

      const file = new File(['huge file'], 'big_repo.zip', { type: 'application/zip' });
      fireEvent.change(screen.getByTestId('dropzone-file-input'), { target: { files: [file] } });

      await waitFor(() => {
        expect(
          screen.getAllByText(/The uploaded file exceeds the 20 MB size limit/i).length
        ).toBeGreaterThanOrEqual(1);
      });
    });

    it('handles 429 quota or rate-limit error without infinite retry loop', async () => {
      server.use(
        http.post('*/api/jobs', () => {
          return HttpResponse.json(mockErrors.RATE_LIMITED.body, { status: 429 });
        })
      );

      renderAppWithRoute('/');

      const file = new File(['dummy code'], 'repo.zip', { type: 'application/zip' });
      fireEvent.change(screen.getByTestId('dropzone-file-input'), { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('sample-service')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText(/Describe the bug/i), {
        target: { value: 'Fix bug' },
      });

      const submitBtn = screen.getByRole('button', { name: /Analyze and Repair/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(
          screen.getByText(/The model provider rate limit has been reached/i)
        ).toBeInTheDocument();
      });

      // User is returned to form without being stuck
      expect(submitBtn).not.toBeDisabled();
    });

    it('handles 404/410 expired job on ResultPage with helpful action', async () => {
      server.use(
        http.get('*/api/jobs/:id', () => {
          return HttpResponse.json(mockErrors.NOT_FOUND.body, { status: 404 });
        }),
        http.get('*/api/jobs/:id/result', () => {
          return HttpResponse.json(mockErrors.NOT_FOUND.body, { status: 404 });
        })
      );

      renderAppWithRoute('/jobs/job-expired-123/result');

      await waitFor(() => {
        expect(screen.getByText('Workspace Expired')).toBeInTheDocument();
      });

      expect(
        screen.getByText(/This temporary repair workspace reached its 60-minute retention limit/i)
      ).toBeInTheDocument();

      const newRepairLink = screen.getByRole('link', { name: /Start New Repair/i });
      expect(newRepairLink).toBeInTheDocument();
      expect(newRepairLink).toHaveAttribute('href', '/');
    });
  });

  describe('5. Direct Deep Linking & Unknown Routes', () => {
    it('deep links directly to /jobs/:id/result and renders', async () => {
      server.use(
        http.get('*/api/jobs/:id/result', () => {
          return HttpResponse.json(mockResultVerified, { status: 200 });
        })
      );

      renderAppWithRoute('/jobs/6f3f98ab-945e-4f53-bd6a-95c5e7b48f32/result');

      await waitFor(() => {
        expect(screen.getByText('Repair Verification Result')).toBeInTheDocument();
        expect(screen.getByText('Verified')).toBeInTheDocument();
      });
    });

    it('redirects unknown route to home page', async () => {
      renderAppWithRoute('/unknown/route/path');

      await waitFor(() => {
        expect(screen.getByText('New Repair')).toBeInTheDocument();
      });
    });
  });
});
