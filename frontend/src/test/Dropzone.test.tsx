import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Dropzone } from '../components/Dropzone';

describe('Dropzone', () => {
  it('renders idle state with upload prompt', () => {
    render(<Dropzone onFileSelected={vi.fn()} />);
    expect(screen.getByText(/Drop your Python repository/i)).toBeInTheDocument();
    expect(screen.getByText(/maximum 20 MB/i)).toBeInTheDocument();
  });

  it('accepts valid .zip file', () => {
    const onFileSelected = vi.fn();
    render(<Dropzone onFileSelected={onFileSelected} />);

    const file = new File(['dummy zip content'], 'repo.zip', { type: 'application/zip' });
    const input = screen.getByTestId('dropzone-file-input');

    fireEvent.change(input, { target: { files: [file] } });

    expect(onFileSelected).toHaveBeenCalledWith(file);
    expect(screen.getByText('repo.zip')).toBeInTheDocument();
    expect(screen.getByText(/Ready for inspection/i)).toBeInTheDocument();
  });

  it('rejects non-.zip files with helpful message', () => {
    const onFileSelected = vi.fn();
    render(<Dropzone onFileSelected={onFileSelected} />);

    const file = new File(['text content'], 'repo.tar.gz', { type: 'application/gzip' });
    const input = screen.getByTestId('dropzone-file-input');

    fireEvent.change(input, { target: { files: [file] } });

    expect(onFileSelected).not.toHaveBeenCalled();
    expect(screen.getByText(/Only Python project .zip archives are supported/i)).toBeInTheDocument();
  });

  it('rejects files exceeding maxBytes', () => {
    const onFileSelected = vi.fn();
    const maxBytes = 1024 * 1024; // 1 MB limit
    render(<Dropzone onFileSelected={onFileSelected} maxBytes={maxBytes} />);

    const bigFile = new File([new Uint8Array(2 * 1024 * 1024)], 'big_repo.zip', {
      type: 'application/zip',
    });
    const input = screen.getByTestId('dropzone-file-input');

    fireEvent.change(input, { target: { files: [bigFile] } });

    expect(onFileSelected).not.toHaveBeenCalled();
    expect(screen.getByText(/Archive exceeds maximum upload size/i)).toBeInTheDocument();
  });
});
