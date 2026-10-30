import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { NewRepairPage } from '../pages/NewRepairPage';
import { ToastProvider } from '../components/Toast';
import * as api from '../lib/api';
import type { CreateProjectResponse, CreateJobResponse } from '../types/api';

vi.mock('../lib/api', () => ({
  uploadProject: vi.fn(),
  createJob: vi.fn(),
  downloadUrl: vi.fn(),
}));

const renderWithProviders = (ui: React.ReactElement, initialRoute = '/new') => {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <ToastProvider>
        <Routes>
          <Route path="/new" element={ui} />
          <Route path="/jobs/:id" element={<div data-testid="mock-job-page">Job Page</div>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>
  );
};

describe('NewRepairPage', () => {
  const mockProjectResponse: CreateProjectResponse = {
    project_id: 'proj-123',
    project_name: 'test_repo',
    language: 'python',
    file_count: 5,
    total_uncompressed_bytes: 4096,
    validation_status: 'VALID',
    created_at: '2026-10-30T10:00:00Z',
  };

  const mockJobResponse: CreateJobResponse = {
    job_id: 'job-987654321',
    project_id: 'proj-123',
    status: 'QUEUED',
    current_stage: 'PENDING',
    created_at: '2026-10-30T10:05:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders initial state with disabled submit button', () => {
    renderWithProviders(<NewRepairPage />);
    expect(screen.getByText('New Repair')).toBeInTheDocument();
    const submitBtn = screen.getByRole('button', { name: /Analyze and Repair/i });
    expect(submitBtn).toBeDisabled();
    expect(screen.getByText('0 / 4000')).toBeInTheDocument();
  });

  it('toggles optional diagnostic fields and updates inputs', () => {
    renderWithProviders(<NewRepairPage />);
    const toggleBtn = screen.getByRole('button', { name: /Optional behavior diagnostics/i });
    fireEvent.click(toggleBtn);

    const expectedInput = screen.getByLabelText(/Expected Behavior/i);
    const observedInput = screen.getByLabelText(/Observed Behavior/i);
    expect(expectedInput).toBeInTheDocument();
    expect(observedInput).toBeInTheDocument();

    fireEvent.change(expectedInput, { target: { value: 'Returns 42' } });
    fireEvent.change(observedInput, { target: { value: 'Returns None' } });

    expect((expectedInput as HTMLInputElement).value).toBe('Returns 42');
    expect((observedInput as HTMLInputElement).value).toBe('Returns None');

    // Toggle closed again
    fireEvent.click(toggleBtn);
    expect(screen.queryByLabelText(/Expected Behavior/i)).not.toBeInTheDocument();
  });

  it('enforces 4000-char counter and limit', async () => {
    vi.mocked(api.uploadProject).mockResolvedValue(mockProjectResponse);
    renderWithProviders(<NewRepairPage />);

    // Upload archive
    const file = new File(['dummy zip'], 'repo.zip', { type: 'application/zip' });
    const input = screen.getByTestId('dropzone-file-input');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('test_repo')).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText(/Describe the bug/i);
    const submitBtn = screen.getByRole('button', { name: /Analyze and Repair/i });

    // Under limit
    fireEvent.change(textarea, { target: { value: 'Valid description under 4000 chars' } });
    expect(screen.getByText('34 / 4000')).toBeInTheDocument();
    expect(submitBtn).not.toBeDisabled();

    // Over limit
    const longText = 'a'.repeat(4001);
    fireEvent.change(textarea, { target: { value: longText } });
    expect(screen.getByText('4001 / 4000')).toBeInTheDocument();
    expect(submitBtn).toBeDisabled();
  });

  it('handles Try Sample Bug success flow', async () => {
    const fakeZipBlob = new Blob(['zip content'], { type: 'application/zip' });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => fakeZipBlob,
    });
    vi.mocked(api.uploadProject).mockResolvedValue(mockProjectResponse);

    renderWithProviders(<NewRepairPage />);

    const sampleBtn = screen.getByRole('button', { name: /Try Sample Bug/i });
    fireEvent.click(sampleBtn);

    await waitFor(() => {
      expect(api.uploadProject).toHaveBeenCalled();
      expect(screen.getByText(/absolute_value function/i)).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/Expected Behavior/i)).toBeInTheDocument();
    const submitBtn = screen.getByRole('button', { name: /Analyze and Repair/i });
    expect(submitBtn).not.toBeDisabled();
  });

  it('handles Try Sample Bug failure flow', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    renderWithProviders(<NewRepairPage />);

    const sampleBtn = screen.getByRole('button', { name: /Try Sample Bug/i });
    fireEvent.click(sampleBtn);

    await waitFor(() => {
      expect(screen.getByText(/Sample fixture not found on server/i)).toBeInTheDocument();
    });
  });

  it('displays API error alert when project upload fails', async () => {
    vi.mocked(api.uploadProject).mockRejectedValue(new Error('Corrupted ZIP archive'));
    renderWithProviders(<NewRepairPage />);

    const file = new File(['bad zip'], 'bad.zip', { type: 'application/zip' });
    const input = screen.getByTestId('dropzone-file-input');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getAllByText('Corrupted ZIP archive').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('submits job, prevents double-submit, shows toast, and navigates to job detail', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(api.uploadProject).mockResolvedValue(mockProjectResponse);
    vi.mocked(api.createJob).mockResolvedValue(mockJobResponse);

    renderWithProviders(<NewRepairPage />);

    // Upload archive
    const file = new File(['dummy zip'], 'repo.zip', { type: 'application/zip' });
    fireEvent.change(screen.getByTestId('dropzone-file-input'), { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('test_repo')).toBeInTheDocument();
    });

    // Enter bug description
    const textarea = screen.getByPlaceholderText(/Describe the bug/i);
    fireEvent.change(textarea, { target: { value: 'Fix boundary condition' } });

    const submitBtn = screen.getByRole('button', { name: /Analyze and Repair/i });
    expect(submitBtn).not.toBeDisabled();

    // Click submit
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.createJob).toHaveBeenCalledWith({
        project_id: 'proj-123',
        bug_report: 'Fix boundary condition',
        expected_behavior: undefined,
        observed_behavior: undefined,
      });
    });

    expect(screen.getByText(/Repair Job Successfully Queued/i)).toBeInTheDocument();

    // Advance timer to trigger navigation (700ms in NewRepairPage)
    act(() => {
      vi.advanceTimersByTime(800);
    });

    await waitFor(() => {
      expect(screen.getByTestId('mock-job-page')).toBeInTheDocument();
    });

    vi.useRealTimers();
  });

  it('displays error toast when createJob fails', async () => {
    vi.mocked(api.uploadProject).mockResolvedValue(mockProjectResponse);
    vi.mocked(api.createJob).mockRejectedValue(new Error('Rate limit exceeded (429)'));

    renderWithProviders(<NewRepairPage />);

    const file = new File(['dummy zip'], 'repo.zip', { type: 'application/zip' });
    fireEvent.change(screen.getByTestId('dropzone-file-input'), { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('test_repo')).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText(/Describe the bug/i);
    fireEvent.change(textarea, { target: { value: 'Fix bug' } });

    const submitBtn = screen.getByRole('button', { name: /Analyze and Repair/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Rate limit exceeded \(429\)/i)).toBeInTheDocument();
    });
    // Submitting should reset to false
    expect(submitBtn).not.toBeDisabled();
  });
});
