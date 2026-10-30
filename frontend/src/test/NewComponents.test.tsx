import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { CopyButton } from '../components/CopyButton';
import { Accordion } from '../components/Accordion';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { PasswordInput } from '../components/PasswordInput';
import { LastUpdated } from '../components/LastUpdated';
import { ThemeToggle } from '../components/ThemeToggle';
import { useUtmParams } from '../hooks/useUtmParams';
import { useTheme } from '../hooks/useTheme';
import { jobSessionStore, type SessionJob } from '../lib/jobSessionStore';

describe('New Frontend Components & Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('ThemeToggle & useTheme', () => {
    it('renders with accessible title and toggles theme on click', () => {
      render(<ThemeToggle />);
      const btn = screen.getByRole('button');
      expect(btn).toBeInTheDocument();
      expect(btn).toHaveAttribute('aria-label');

      fireEvent.click(btn);
      expect(localStorage.getItem('proofpatch_theme')).toBeTruthy();
    });

    it('manages theme states and toggling in useTheme hook', () => {
      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.setTheme('dark');
      });
      expect(result.current.theme).toBe('dark');
      expect(result.current.isDark).toBe(true);

      act(() => {
        result.current.toggleTheme();
      });
      expect(result.current.theme).toBe('light');
      expect(result.current.isDark).toBe(false);

      act(() => {
        result.current.setTheme('system');
      });
      expect(result.current.theme).toBe('system');
    });
  });

  describe('CopyButton', () => {
    it('renders copy button and updates state upon clicking', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      render(<CopyButton text="sample-text" label="Copy Snippet" copiedLabel="Done" />);
      const btn = screen.getByRole('button', { name: /Copy Snippet/i });
      expect(btn).toBeInTheDocument();

      fireEvent.click(btn);
      expect(writeTextMock).toHaveBeenCalledWith('sample-text');
      expect(await screen.findByText('Done')).toBeInTheDocument();
    });

    it('renders icon-only variant and handles clipboard write failure gracefully', async () => {
      const writeTextMock = vi.fn().mockRejectedValue(new Error('Permission denied'));
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      render(<CopyButton text="sample" iconOnly={true} title="Copy icon" />);
      const btn = screen.getByRole('button', { name: /Copy/i });
      expect(btn).toBeInTheDocument();

      fireEvent.click(btn);
      expect(writeTextMock).toHaveBeenCalled();
    });
  });

  describe('Accordion', () => {
    it('renders accessible accordion items and toggles expansion on click', () => {
      const items = [
        { id: '1', question: 'What is ProofPatch?', answer: 'An automated repair tool.' },
        { id: '2', question: 'How is it verified?', answer: 'Via sandbox pytest.' },
      ];

      render(<Accordion items={items} />);
      const firstBtn = screen.getByRole('button', { name: /What is ProofPatch\?/i });
      expect(firstBtn).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(firstBtn);
      expect(firstBtn).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText('An automated repair tool.')).toBeInTheDocument();

      fireEvent.click(firstBtn);
      expect(firstBtn).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('ConfirmationModal', () => {
    it('renders modal dialog with accessible attributes and handles confirm/cancel', () => {
      const onConfirm = vi.fn();
      const onClose = vi.fn();

      const { rerender } = render(
        <ConfirmationModal
          isOpen={true}
          title="Delete workspace?"
          description="This cannot be undone."
          onConfirm={onConfirm}
          onClose={onClose}
          confirmLabel="Delete"
          cancelLabel="Keep"
        />
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(screen.getByText('Delete workspace?')).toBeInTheDocument();
      expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Delete/i }));
      expect(onConfirm).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();

      rerender(
        <ConfirmationModal
          isOpen={false}
          title="Delete workspace?"
          description="This cannot be undone."
          onConfirm={onConfirm}
          onClose={onClose}
        />
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('handles Escape key, backdrop click, and non-destructive styling', () => {
      const onClose = vi.fn();

      render(
        <ConfirmationModal
          isOpen={true}
          title="Archive project?"
          description="Will be archived."
          onConfirm={vi.fn()}
          onClose={onClose}
          destructive={false}
        />
      );

      // Press Escape
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);

      // Close button
      const closeBtn = screen.getByLabelText('Close dialog');
      fireEvent.click(closeBtn);
      expect(onClose).toHaveBeenCalledTimes(2);
    });

    it('manages focus trap inside open modal', () => {
      const onClose = vi.fn();

      render(
        <ConfirmationModal
          isOpen={true}
          title="Modal focus test"
          description="Testing tab trap."
          onConfirm={vi.fn()}
          onClose={onClose}
        />
      );

      const buttons = screen.getAllByRole('button');
      const firstBtn = buttons[0];
      const lastBtn = buttons[buttons.length - 1];

      // Shift+Tab on first button wraps to last
      firstBtn.focus();
      fireEvent.keyDown(firstBtn, { key: 'Tab', shiftKey: true });

      // Tab on last button wraps to first
      lastBtn.focus();
      fireEvent.keyDown(lastBtn, { key: 'Tab', shiftKey: false });
    });
  });

  describe('PasswordInput', () => {
    it('toggles password visibility with eye button and aria-pressed', () => {
      render(<PasswordInput label="Token Key" id="token-key" placeholder="Enter key" />);
      const input = screen.getByPlaceholderText('Enter key');
      expect(input).toHaveAttribute('type', 'password');

      const toggleBtn = screen.getByRole('button', { name: /Show password/i });
      expect(toggleBtn).toHaveAttribute('aria-pressed', 'false');

      fireEvent.click(toggleBtn);
      expect(input).toHaveAttribute('type', 'text');
      expect(toggleBtn).toHaveAttribute('aria-pressed', 'true');
      expect(toggleBtn).toHaveAttribute('aria-label', 'Hide password');
    });
  });

  describe('LastUpdated', () => {
    it('renders formatted date in a semantic time element and handles invalid date fallback', () => {
      const { rerender } = render(<LastUpdated date="2026-10-30" />);
      expect(screen.getByText(/Last updated:/i)).toBeInTheDocument();
      const time = screen.getByText(/Oct 30, 2026/i);
      expect(time.tagName.toLowerCase()).toBe('time');

      rerender(<LastUpdated date="invalid-date" />);
      expect(screen.getByText(/invalid-date/i)).toBeInTheDocument();
    });
  });

  describe('useUtmParams hook', () => {
    it('reads and stores utm parameters in sessionStorage without tracking scripts', () => {
      const originalLocation = window.location;
      delete (window as any).location;
      window.location = {
        ...originalLocation,
        search: '?utm_source=twitter&utm_medium=social&utm_campaign=hackathon',
      } as any;

      const { result } = renderHook(() => useUtmParams());
      expect(result.current.utm_source).toBe('twitter');
      expect(result.current.utm_medium).toBe('social');
      expect(result.current.utm_campaign).toBe('hackathon');

      const stored = sessionStorage.getItem('proofpatch_utm');
      expect(stored).toContain('twitter');

      window.location = originalLocation as any;
    });
  });

  describe('jobSessionStore', () => {
    it('adds, updates, retrieves, and subscribes to session jobs', () => {
      const sampleJob: SessionJob = {
        jobId: 'session-job-1',
        projectName: 'demo-repo',
        bugReport: 'Fix off by one',
        createdAt: '2026-10-30T10:00:00Z',
        status: 'QUEUED',
        verdict: null,
        attemptCount: 0,
        durationSeconds: null,
        modelId: null,
      };

      const listener = vi.fn();
      const unsubscribe = jobSessionStore.subscribe(listener);

      expect(listener).toHaveBeenCalledWith([]);

      jobSessionStore.addJob(sampleJob);
      expect(jobSessionStore.getJobs().length).toBe(1);
      expect(jobSessionStore.getJob('session-job-1')).toEqual(sampleJob);
      expect(jobSessionStore.getLastJobId()).toBe('session-job-1');

      // Update existing job
      jobSessionStore.updateJob('session-job-1', {
        status: 'COMPLETED',
        verdict: 'VERIFIED',
      });
      expect(jobSessionStore.getJob('session-job-1')?.status).toBe('COMPLETED');
      expect(jobSessionStore.getJob('session-job-1')?.verdict).toBe('VERIFIED');

      // Update non-existing job
      jobSessionStore.updateJob('non-existent', { status: 'FAILED' });

      // Add duplicate jobId updates existing
      jobSessionStore.addJob({
        ...sampleJob,
        status: 'FAILED',
      });
      expect(jobSessionStore.getJobs().length).toBe(1);

      unsubscribe();
    });
  });
});
