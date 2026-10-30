import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { BrowserRouter } from 'react-router-dom';
import { NewRepairPage } from '../pages/NewRepairPage';
import { ToastProvider } from '../components/Toast';
import * as api from '../lib/api';
import type { CreateProjectResponse } from '../types/api';

vi.mock('../lib/api', () => ({
  uploadProject: vi.fn(),
  createJob: vi.fn(),
  downloadUrl: vi.fn(),
}));

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <ToastProvider>{ui}</ToastProvider>
    </BrowserRouter>
  );
};

describe('NewRepairPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders initial state with disabled submit button', () => {
    renderWithProviders(<NewRepairPage />);
    expect(screen.getByText('New Repair')).toBeInTheDocument();
    const submitBtn = screen.getByRole('button', { name: /Analyze and Repair/i });
    expect(submitBtn).toBeDisabled();
  });

  it('toggles optional diagnostic fields', () => {
    renderWithProviders(<NewRepairPage />);
    const toggleBtn = screen.getByRole('button', { name: /Optional behavior diagnostics/i });
    fireEvent.click(toggleBtn);
    expect(screen.getByLabelText(/Expected Behavior/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Observed Behavior/i)).toBeInTheDocument();
  });

  it('enables submit button only when project is validated and bug report has text', async () => {
    const mockProjectResponse: CreateProjectResponse = {
      project_id: 'proj-123',
      project_name: 'test_repo',
      language: 'python',
      file_count: 5,
      total_uncompressed_bytes: 4096,
      validation_status: 'VALID',
      created_at: '2026-10-30T10:00:00Z',
    };

    vi.mocked(api.uploadProject).mockResolvedValue(mockProjectResponse);

    renderWithProviders(<NewRepairPage />);

    // Upload archive
    const file = new File(['dummy zip'], 'repo.zip', { type: 'application/zip' });
    const input = screen.getByTestId('dropzone-file-input');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('test_repo')).toBeInTheDocument();
    });

    const submitBtn = screen.getByRole('button', { name: /Analyze and Repair/i });
    expect(submitBtn).toBeDisabled();

    // Type bug description
    const textarea = screen.getByPlaceholderText(/Describe the bug, expected vs observed behavior/i);
    fireEvent.change(textarea, { target: { value: 'Fix TypeError in calculate()' } });

    expect(submitBtn).not.toBeDisabled();
  });
});
