import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, renderHook } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { CopyButton } from '../components/CopyButton';
import { Accordion } from '../components/Accordion';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { PasswordInput } from '../components/PasswordInput';
import { LastUpdated } from '../components/LastUpdated';
import { ThemeToggle } from '../components/ThemeToggle';
import { useUtmParams } from '../hooks/useUtmParams';

describe('New Frontend Components & Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('ThemeToggle', () => {
    it('renders with accessible title and toggles theme on click', () => {
      render(<ThemeToggle />);
      const btn = screen.getByRole('button');
      expect(btn).toBeInTheDocument();
      expect(btn).toHaveAttribute('aria-label');

      fireEvent.click(btn);
      expect(localStorage.getItem('proofpatch_theme')).toBeTruthy();
    });
  });

  describe('CopyButton', () => {
    it('renders copy button and updates state upon clicking', async () => {
      // Mock clipboard API
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

      // Click again to collapse
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
    it('renders formatted date in a semantic time element', () => {
      render(<LastUpdated date="2026-10-30" />);
      expect(screen.getByText(/Last updated:/i)).toBeInTheDocument();
      const time = screen.getByText(/Oct 30, 2026/i);
      expect(time.tagName.toLowerCase()).toBe('time');
    });
  });

  describe('useUtmParams hook', () => {
    it('reads and stores utm parameters in sessionStorage without tracking scripts', () => {
      // Mock window.location.search
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
});
