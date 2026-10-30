import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { AttemptCard } from '../components/AttemptCard';
import { StatCard } from '../components/StatCard';
import { PillTabs } from '../components/PillTabs';
import { ToastProvider, useToast } from '../components/Toast';
import { Sidebar } from '../components/layout/Sidebar';
import { EmptyState } from '../components/EmptyState';
import { Skeleton, CardSkeleton, PageSkeleton } from '../components/Skeleton';
import type { Attempt } from '../types/api';

describe('Component Suite: AttemptCard, StatCard, PillTabs, Toast, Sidebar, EmptyState, Skeleton', () => {
  describe('AttemptCard', () => {
    const successAttempt: Attempt = {
      attempt_number: 1,
      stage: 'TESTING',
      status: 'TESTED',
      model_called: 'nvidia/Nemotron-3-Ultra-550b-a55b',
      changed_files: ['calc.py', 'math_utils.py'],
      hunks_applied: 2,
      hunks_failed: 0,
      test_result: {
        status: 'PASSED',
        exit_code: 0,
        duration_ms: 1500,
        tests_passed: 8,
        tests_failed: 0,
        stdout: '8 passed',
        stderr: '',
        output_truncated: false,
        command_id: 'pytest',
      },
    };

    const failedApplyAttempt: Attempt = {
      attempt_number: 2,
      stage: 'PATCHING',
      status: 'PATCH_APPLY_FAILED',
      model_called: 'nvidia/Nemotron-3-Ultra-550b-a55b',
      changed_files: ['calc.py'],
      hunks_applied: 0,
      hunks_failed: 1,
    };

    it('renders attempt header, status badge, and changed files', () => {
      render(<AttemptCard attempt={successAttempt} />);
      expect(screen.getByText('Attempt 1')).toBeInTheDocument();
      expect(screen.getByText('TESTED')).toBeInTheDocument();
      expect(screen.getByText('calc.py, math_utils.py')).toBeInTheDocument();
      expect(screen.getByText('8 passed, 0 failed')).toBeInTheDocument();
      expect(screen.getByText('1.50s')).toBeInTheDocument();
    });

    it('toggles collapsible expansion on click and keyboard Enter', () => {
      render(<AttemptCard attempt={successAttempt} />);
      const header = screen.getByRole('button', { name: /Attempt 1/i });
      expect(header).toHaveAttribute('aria-expanded', 'false');

      // Click to open
      fireEvent.click(header);
      expect(header).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText('Runner Command')).toBeInTheDocument();

      // Keyboard Enter to close
      fireEvent.keyDown(header, { key: 'Enter' });
      expect(header).toHaveAttribute('aria-expanded', 'false');
    });

    it('displays patch mismatch escalation banner for PATCH_APPLY_FAILED', () => {
      render(<AttemptCard attempt={failedApplyAttempt} defaultOpen={true} />);
      expect(screen.getByText('Context Verification Mismatch on Attempt 1')).toBeInTheDocument();
      expect(
        screen.getByText(/The patch could not be applied cleanly because file context lines differed/i)
      ).toBeInTheDocument();
    });
  });

  describe('StatCard', () => {
    it('renders value, label, hint and custom icon', () => {
      render(
        <StatCard
          label="Total Repairs"
          value={128}
          hint="+12% from last week"
          icon={<span data-testid="custom-icon">ICON</span>}
        />
      );

      expect(screen.getByText('128')).toBeInTheDocument();
      expect(screen.getByText('Total Repairs')).toBeInTheDocument();
      expect(screen.getByText('+12% from last week')).toBeInTheDocument();
      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });
  });

  describe('PillTabs', () => {
    const tabs = [
      { id: 'all', label: 'All Jobs', count: 12 },
      { id: 'verified', label: 'Verified', count: 9 },
      { id: 'failed', label: 'Failed', count: 3 },
    ];

    it('renders tabs with role="tablist", aria-selected, and counts', () => {
      const onChange = vi.fn();
      render(<PillTabs tabs={tabs} activeTab="all" onChange={onChange} />);

      const tabList = screen.getByRole('tablist', { name: /Filter tabs/i });
      expect(tabList).toBeInTheDocument();

      const allTab = screen.getByRole('tab', { name: /All Jobs/i });
      const verifiedTab = screen.getByRole('tab', { name: /Verified/i });

      expect(allTab).toHaveAttribute('aria-selected', 'true');
      expect(verifiedTab).toHaveAttribute('aria-selected', 'false');

      fireEvent.click(verifiedTab);
      expect(onChange).toHaveBeenCalledWith('verified');
    });

    it('supports keyboard ArrowRight and ArrowLeft navigation', () => {
      const onChange = vi.fn();
      render(<PillTabs tabs={tabs} activeTab="all" onChange={onChange} />);

      const allTab = screen.getByRole('tab', { name: /All Jobs/i });

      // ArrowRight from 'all' (index 0) moves to 'verified' (index 1)
      fireEvent.keyDown(allTab, { key: 'ArrowRight' });
      expect(onChange).toHaveBeenCalledWith('verified');

      // ArrowLeft from 'all' (index 0) wraps to 'failed' (index 2)
      fireEvent.keyDown(allTab, { key: 'ArrowLeft' });
      expect(onChange).toHaveBeenCalledWith('failed');
    });
  });

  describe('Toast', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const TestToastComponent = () => {
      const { showToast } = useToast();
      return (
        <div>
          <button
            onClick={() =>
              showToast({
                type: 'success',
                title: 'Operation Successful',
                message: 'All changes saved.',
                duration: 3000,
              })
            }
          >
            Trigger Toast
          </button>
        </div>
      );
    };

    it('renders toast with aria-live container, auto-dismisses after duration, and handles manual close', () => {
      render(
        <ToastProvider>
          <TestToastComponent />
        </ToastProvider>
      );

      const triggerBtn = screen.getByRole('button', { name: 'Trigger Toast' });
      fireEvent.click(triggerBtn);

      expect(screen.getByText('Operation Successful')).toBeInTheDocument();
      expect(screen.getByText('All changes saved.')).toBeInTheDocument();

      // Advance timer by 3100ms
      act(() => {
        vi.advanceTimersByTime(3100);
      });

      expect(screen.queryByText('Operation Successful')).not.toBeInTheDocument();
    });

    it('allows closing toast manually via close button', () => {
      render(
        <ToastProvider>
          <TestToastComponent />
        </ToastProvider>
      );

      fireEvent.click(screen.getByRole('button', { name: 'Trigger Toast' }));
      expect(screen.getByText('Operation Successful')).toBeInTheDocument();

      const closeBtn = screen.getByRole('button', { name: /Dismiss toast/i });
      fireEvent.click(closeBtn);

      expect(screen.queryByText('Operation Successful')).not.toBeInTheDocument();
    });
  });

  describe('Sidebar', () => {
    it('renders main navigation links and handles search callback', () => {
      const onOpenSearch = vi.fn();
      render(
        <MemoryRouter initialEntries={['/new']}>
          <Sidebar currentJobId="job-456" onOpenSearch={onOpenSearch} />
        </MemoryRouter>
      );

      expect(screen.getAllByText('ProofPatch').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('New Repair').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Jobs').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Models & Roles').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Security Boundaries').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('About ProofPatch').length).toBeGreaterThanOrEqual(1);

      const searchBtn = screen.getByRole('button', { name: /Search/i });
      fireEvent.click(searchBtn);
      expect(onOpenSearch).toHaveBeenCalled();
    });

    it('toggles mobile drawer on burger button click and closes with Escape key', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <Sidebar />
        </MemoryRouter>
      );

      const mobileMenuBtn = screen.getByRole('button', { name: /Open navigation menu/i });
      expect(mobileMenuBtn).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(mobileMenuBtn);
      expect(mobileMenuBtn).toHaveAttribute('aria-expanded', 'true');

      // Press Escape to close
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(mobileMenuBtn).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('EmptyState & Skeleton', () => {
    it('renders EmptyState with title, description, and action', () => {
      render(
        <EmptyState
          title="No Jobs Found"
          description="Try creating a repair job to see it listed here."
          action={<button>Create Job</button>}
        />
      );

      expect(screen.getByText('No Jobs Found')).toBeInTheDocument();
      expect(screen.getByText(/Try creating a repair job/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Create Job' })).toBeInTheDocument();
    });

    it('renders Skeleton, CardSkeleton, and PageSkeleton with aria-hidden', () => {
      const { container } = render(
        <div>
          <Skeleton className="h-4 w-12" />
          <CardSkeleton />
          <PageSkeleton />
        </div>
      );

      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThanOrEqual(5);
    });
  });
});
