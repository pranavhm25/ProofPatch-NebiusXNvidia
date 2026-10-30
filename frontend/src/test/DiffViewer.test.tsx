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
    download_patch_url: '/api/jobs/job-123/download?format=patch',
    download_zip_url: '/api/jobs/job-123/download?format=zip',
  };

  const multiFileDiff: DiffInfo = {
    available: true,
    changed_files: ['calc.py', 'utils.py'],
    unified_diff: `--- a/calc.py\n+++ b/calc.py\n@@ -1,3 +1,3 @@\n def add(a, b):\n-    return a - b\n+    return a + b\n--- a/utils.py\n+++ b/utils.py\n@@ -10,2 +10,2 @@\n-def old_util(): pass\n+def new_util(): pass\n`,
    download_patch_url: '/api/jobs/job-123/download?format=patch',
    download_zip_url: '/api/jobs/job-123/download?format=zip',
  };

  it('renders diff viewer with changed file, hunk header, and line numbers', () => {
    render(<DiffViewer diff={sampleDiff} jobId="job-123" />);
    const fileLabels = screen.getAllByText('calc.py');
    expect(fileLabels.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('return a - b')).toBeInTheDocument();
    expect(screen.getByText('return a + b')).toBeInTheDocument();
    expect(screen.getByText('@@ -1,3 +1,3 @@')).toBeInTheDocument();
    expect(screen.getAllByText('+1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('-1').length).toBeGreaterThanOrEqual(1);
  });

  it('switches files in multi-file diff view', () => {
    render(<DiffViewer diff={multiFileDiff} jobId="job-123" />);
    expect(screen.getAllByText('calc.py').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('utils.py')).toBeInTheDocument();

    // Initially calc.py is visible
    expect(screen.getByText('return a - b')).toBeInTheDocument();

    // Click utils.py tab
    fireEvent.click(screen.getByRole('button', { name: /utils\.py/i }));
    expect(screen.getByText('def old_util(): pass')).toBeInTheDocument();
    expect(screen.getByText('def new_util(): pass')).toBeInTheDocument();
  });

  it('renders download buttons for .patch and .zip with correct links', () => {
    render(<DiffViewer diff={sampleDiff} jobId="job-123" />);
    const patchLink = screen.getByText('Download .patch').closest('a');
    const zipLink = screen.getByText('Download patched .zip').closest('a');

    expect(patchLink).toHaveAttribute('href', '/api/jobs/job-123/download?format=patch');
    expect(zipLink).toHaveAttribute('href', '/api/jobs/job-123/download?format=zip');
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
it('safely escapes HTML tags and script injections without executing DOM scripts', () => {
    const maliciousDiff: DiffInfo = {
      available: true,
      changed_files: ['hack.py'],
      unified_diff: '--- a/hack.py\n+++ b/hack.py\n@@ -1,2 +1,2 @@\n-<script>alert("pwned")</script>\n+<img src="x" onerror="evil()" />\n',
      download_patch_url: '/api/jobs/job-123/download?format=patch',
      download_zip_url: '/api/jobs/job-123/download?format=zip',
    };
    const { container } = render(<DiffViewer diff={maliciousDiff} jobId="job-123" />);
    expect(container.querySelectorAll('script').length).toBe(0);
    expect(container.querySelectorAll('img[onerror]').length).toBe(0);
    expect(screen.getByText('<script>alert("pwned")</script>')).toBeInTheDocument();
    expect(screen.getByText('<img src="x" onerror="evil()" />')).toBeInTheDocument();
  });
});
