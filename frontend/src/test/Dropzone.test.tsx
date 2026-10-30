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

  it('accepts valid .zip file via file input', () => {
    const onFileSelected = vi.fn();
    render(<Dropzone onFileSelected={onFileSelected} />);

    const file = new File(['dummy zip content'], 'repo.zip', { type: 'application/zip' });
    const input = screen.getByTestId('dropzone-file-input');

    fireEvent.change(input, { target: { files: [file] } });

    expect(onFileSelected).toHaveBeenCalledWith(file);
    expect(screen.getByText('repo.zip')).toBeInTheDocument();
    expect(screen.getByText(/Ready for inspection/i)).toBeInTheDocument();
  });

  it('accepts valid .zip file via drag and drop', () => {
    const onFileSelected = vi.fn();
    render(<Dropzone onFileSelected={onFileSelected} />);

    const dropzone = screen.getByRole('button', { name: /Upload a Python repository ZIP archive/i });
    const file = new File(['dummy zip content'], 'dragged.zip', { type: 'application/zip' });

    fireEvent.dragOver(dropzone);
    expect(dropzone.className).toContain('border-[#2A2420]');

    fireEvent.drop(dropzone, {
      dataTransfer: { files: [file] },
    });

    expect(onFileSelected).toHaveBeenCalledWith(file);
    expect(screen.getByText('dragged.zip')).toBeInTheDocument();
  });

  it('handles dragLeave properly', () => {
    render(<Dropzone onFileSelected={vi.fn()} />);
    const dropzone = screen.getByRole('button', { name: /Upload a Python repository ZIP archive/i });

    fireEvent.dragOver(dropzone);
    expect(dropzone.className).toContain('border-[#2A2420]');

    fireEvent.dragLeave(dropzone);
    expect(dropzone.className).not.toContain('border-[#2A2420]');
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

  it('supports keyboard activation with Enter and Space', () => {
    render(<Dropzone onFileSelected={vi.fn()} />);
    const dropzone = screen.getByRole('button', { name: /Upload a Python repository ZIP archive/i });
    const input = screen.getByTestId('dropzone-file-input');
    const clickSpy = vi.spyOn(input, 'click');

    fireEvent.keyDown(dropzone, { key: 'Enter' });
    expect(clickSpy).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(dropzone, { key: ' ' });
    expect(clickSpy).toHaveBeenCalledTimes(2);

    fireEvent.click(dropzone);
    expect(clickSpy).toHaveBeenCalledTimes(3);
  });

  it('respects disabled prop', () => {
    const onFileSelected = vi.fn();
    render(<Dropzone onFileSelected={onFileSelected} disabled={true} />);

    const dropzone = screen.getByRole('button', { name: /Upload a Python repository ZIP archive/i });
    const input = screen.getByTestId('dropzone-file-input') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click');

    expect(dropzone).toHaveAttribute('tabIndex', '-1');
    expect(input.disabled).toBe(true);

    fireEvent.click(dropzone);
    expect(clickSpy).not.toHaveBeenCalled();

    const file = new File(['dummy'], 'repo.zip', { type: 'application/zip' });
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });
    expect(onFileSelected).not.toHaveBeenCalled();
  });

  it('supports replacing file with a new archive', () => {
    const onFileSelected = vi.fn();
    render(<Dropzone onFileSelected={onFileSelected} />);
    const input = screen.getByTestId('dropzone-file-input');

    const file1 = new File(['content 1'], 'repo1.zip', { type: 'application/zip' });
    fireEvent.change(input, { target: { files: [file1] } });
    expect(screen.getByText('repo1.zip')).toBeInTheDocument();

    const file2 = new File(['content 2'], 'repo2.zip', { type: 'application/zip' });
    fireEvent.change(input, { target: { files: [file2] } });
    expect(screen.getByText('repo2.zip')).toBeInTheDocument();
    expect(screen.queryByText('repo1.zip')).not.toBeInTheDocument();
  });

  it('supports removing file with ConfirmationModal confirmation', () => {
    const onFileCleared = vi.fn();
    render(<Dropzone onFileSelected={vi.fn()} onFileCleared={onFileCleared} />);
    const input = screen.getByTestId('dropzone-file-input');

    const file = new File(['content'], 'my_project.zip', { type: 'application/zip' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByText('my_project.zip')).toBeInTheDocument();

    const removeBtn = screen.getByRole('button', { name: /Remove archive/i });
    fireEvent.click(removeBtn);

    // Modal should be open
    expect(screen.getByText('Remove Uploaded Archive?')).toBeInTheDocument();

    // Click confirm in modal
    const confirmBtn = screen.getByRole('button', { name: 'Remove Archive' });
    fireEvent.click(confirmBtn);

    expect(onFileCleared).toHaveBeenCalled();
    expect(screen.queryByText('my_project.zip')).not.toBeInTheDocument();
    expect(screen.getByText(/Drop your Python repository/i)).toBeInTheDocument();
  });

  it('cancels removal when modal cancel button is clicked', () => {
    const onFileCleared = vi.fn();
    render(<Dropzone onFileSelected={vi.fn()} onFileCleared={onFileCleared} />);
    const input = screen.getByTestId('dropzone-file-input');

    const file = new File(['content'], 'stay.zip', { type: 'application/zip' });
    fireEvent.change(input, { target: { files: [file] } });

    const removeBtn = screen.getByRole('button', { name: /Remove archive/i });
    fireEvent.click(removeBtn);

    const cancelBtn = screen.getByRole('button', { name: 'Keep Archive' });
    fireEvent.click(cancelBtn);

    expect(onFileCleared).not.toHaveBeenCalled();
    expect(screen.getByText('stay.zip')).toBeInTheDocument();
  });
});
