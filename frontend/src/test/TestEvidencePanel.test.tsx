import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TestEvidencePanel } from '../components/TestEvidencePanel';
import { LogPanel } from '../components/LogPanel';
import type { Attempt } from '../types/api';

describe('TestEvidencePanel & LogPanel', () => {
  const passingAttempt: Attempt = {
    attempt_number: 1,
    stage: 'TESTING',
    model_called: 'nvidia/Nemotron-3-Ultra-550b-a55b',
    hunks_applied: 1,
    hunks_failed: 0,
    test_result: {
      status: 'PASSED',
      exit_code: 0,
      duration_ms: 3200,
      tests_passed: 12,
      tests_failed: 0,
      stdout: '12 passed in 3.20s',
      stderr: '',
      output_truncated: false,
      command_id: 'pytest',
    },
  };

  const failingAttempt: Attempt = {
    attempt_number: 2,
    stage: 'RETRYING',
    model_called: 'nvidia/Nemotron-3-Ultra-550b-a55b',
    hunks_applied: 1,
    hunks_failed: 0,
    test_result: {
      status: 'FAILED',
      exit_code: 1,
      duration_ms: 1800,
      tests_passed: 10,
      tests_failed: 2,
      stdout: '10 passed, 2 failed',
      stderr: 'AssertionError: assert 1 == 2',
      output_truncated: true,
      command_id: 'pytest -q',
    },
  };

  it('renders passing test evidence with exit code 0 (Success) and test counts', () => {
    render(<TestEvidencePanel attempt={passingAttempt} />);

    expect(screen.getByText('Runner Command')).toBeInTheDocument();
    expect(screen.getByText('pytest')).toBeInTheDocument();
    expect(screen.getByText('(Success)')).toBeInTheDocument();
    expect(screen.getByText('3.20s')).toBeInTheDocument();
    expect(screen.getByText('12 passed')).toBeInTheDocument();
    expect(screen.getByText('0 failed')).toBeInTheDocument();

    expect(screen.getByText('12 passed in 3.20s')).toBeInTheDocument();
  });

  it('renders failing test evidence with exit code 1 (Tests Failed) and stderr', () => {
    render(<TestEvidencePanel attempt={failingAttempt} />);

    expect(screen.getByText('pytest -q')).toBeInTheDocument();
    expect(screen.getByText('(Tests Failed)')).toBeInTheDocument();
    expect(screen.getByText('1.80s')).toBeInTheDocument();
    expect(screen.getByText('10 passed')).toBeInTheDocument();
    expect(screen.getByText('2 failed')).toBeInTheDocument();

    expect(screen.getByText('10 passed, 2 failed')).toBeInTheDocument();
    expect(screen.getByText('AssertionError: assert 1 == 2')).toBeInTheDocument();
    expect(screen.getAllByText('Output truncated').length).toBeGreaterThanOrEqual(1);
  });

  it('displays empty state when test_result is not available', () => {
    const noResultAttempt: Attempt = {
      attempt_number: 1,
      stage: 'PATCHING',
      model_called: null,
      hunks_applied: 0,
      hunks_failed: 0,
    };

    render(<TestEvidencePanel attempt={noResultAttempt} />);
    expect(screen.getByText(/No test runner output available for this attempt/i)).toBeInTheDocument();
  });

  it('supports collapsible toggles and keyboard Enter in LogPanel', () => {
    render(
      <LogPanel
        label="Diagnostic Log"
        content="line 1\nline 2"
        defaultOpen={false}
        badge="2 lines"
      />
    );

    expect(screen.queryByText(/line 1/)).not.toBeInTheDocument();

    // Click to open
    const header = screen.getByRole('button', { name: /Diagnostic Log/i });
    fireEvent.click(header);
    expect(screen.getByText(/line 1/)).toBeInTheDocument();

    // Press Enter to close
    fireEvent.keyDown(header, { key: 'Enter' });
    expect(screen.queryByText(/line 1/)).not.toBeInTheDocument();
  });

  it('renders empty stream placeholder when LogPanel content is empty', () => {
    render(
      <LogPanel
        label="Empty Log"
        content=""
        defaultOpen={true}
      />
    );

    expect(screen.getByText('Empty stream output.')).toBeInTheDocument();
  });

  it('copies log content using CopyButton', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    render(
      <LogPanel
        label="Copyable Log"
        content="Unique log text to copy"
        defaultOpen={true}
      />
    );

    const copyBtn = screen.getByTitle('Copy log content');
    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(writeText).toHaveBeenCalledWith('Unique log text to copy');
  });
});
