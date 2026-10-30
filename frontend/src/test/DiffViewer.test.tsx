import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DiffViewer } from '../components/DiffViewer';
import type { DiffInfo } from '../types/api';

describe('DiffViewer', () => {
  const sampleDiff: DiffInfo = {
    available: true,
    changed_files: ['calc.py'],
    unified_diff: `--- a/calc.py\n+++ b/calc.py\n@@ -1,3 +1,3 @@\n def add(a, b):\n-    return a - b\n+    return a + b\n`,
    download_patch_url: '/api/jobs/job-123/download/patch',
    download_zip_url: '/api/jobs/job-123/download/patched-zip',
  };

  it('renders diff viewer with changed file and hunk lines', () => {
    render(<DiffViewer diff={sampleDiff} jobId="job-123" />);
    const fileLabels = screen.getAllByText('calc.py');
    expect(fileLabels.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('return a - b')).toBeInTheDocument();
    expect(screen.getByText('return a + b')).toBeInTheDocument();
    expect(screen.getAllByText('+1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('-1').length).toBeGreaterThanOrEqual(1);
  });

  it('renders download buttons for .patch and .zip', () => {
    render(<DiffViewer diff={sampleDiff} jobId="job-123" />);
    expect(screen.getByText('Download .patch')).toBeInTheDocument();
    expect(screen.getByText('Download patched .zip')).toBeInTheDocument();
  });

  it('shows empty message when diff is not available', () => {
    const emptyDiff: DiffInfo = {
      available: false,
      changed_files: [],
      unified_diff: null,
      download_patch_url: null,
      download_zip_url: null,
    };
    render(<DiffViewer diff={emptyDiff} jobId="job-123" />);
    expect(screen.getByText(/No unified diff patch available/i)).toBeInTheDocument();
  });

  it('copies diff content on copy button click', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    render(<DiffViewer diff={sampleDiff} jobId="job-123" />);
    const copyBtn = screen.getByTitle('Copy full unified diff to clipboard');
    await act(async () => {
      fireEvent.click(copyBtn);
    });
    expect(writeText).toHaveBeenCalledWith(sampleDiff.unified_diff);
  });
});
