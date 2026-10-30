import React, { useCallback, useState, useRef } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, FileArchive, X } from 'lucide-react';

type DropzoneState = 'idle' | 'dragging' | 'accepted' | 'rejected';

interface DropzoneProps {
  onFileSelected: (file: File) => void;
  maxBytes?: number;
  disabled?: boolean;
}

const MAX_DEFAULT = 20 * 1024 * 1024; // 20 MB

export function Dropzone({ onFileSelected, maxBytes = MAX_DEFAULT, disabled = false }: DropzoneProps) {
  const [state, setState] = useState<DropzoneState>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = useCallback((file: File) => {
    setErrorMsg(null);
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setState('rejected');
      setErrorMsg('Invalid file format. Only Python project .zip archives are supported.');
      return;
    }
    if (file.size > maxBytes) {
      setState('rejected');
      setErrorMsg(`Archive exceeds maximum upload size of ${Math.round(maxBytes / 1024 / 1024)} MB (${(file.size / 1024 / 1024).toFixed(1)} MB uploaded).`);
      return;
    }
    setState('accepted');
    setSelectedFile(file);
    onFileSelected(file);
  }, [maxBytes, onFileSelected]);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) accept(file);
    else setState(selectedFile ? 'accepted' : 'idle');
  }, [disabled, accept, selectedFile]);

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) accept(file);
  }, [accept]);

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(null);
    setState('idle');
    setErrorMsg(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const borderStyles = {
    idle: 'border-warm-border hover:border-[#C8C0B4] bg-[#FAF8F5]',
    dragging: 'border-[#2A2420] bg-warm-muted/40 shadow-soft',
    accepted: 'border-[#BDE3CA] bg-[#F4FAF6]',
    rejected: 'border-[#F6C8C8] bg-[#FDF5F5]',
  }[state];

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setState('dragging');
        }}
        onDragLeave={() => setState(selectedFile ? 'accepted' : 'idle')}
        onDrop={onDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-all ${borderStyles} ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Upload a Python repository ZIP archive"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip"
          className="sr-only"
          onChange={onInputChange}
          aria-label="Upload repository archive"
          data-testid="dropzone-file-input"
          tabIndex={-1}
          disabled={disabled}
        />

        {state === 'accepted' && selectedFile ? (
          <div className="flex flex-col items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-[#EAF5ED] text-[#1E6B3C] flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <div>
              <p className="flex items-center justify-center gap-2 text-sm font-semibold text-ink-primary">
                <FileArchive className="h-4 w-4 text-[#1E6B3C]" strokeWidth={1.5} />
                {selectedFile.name}
              </p>
              <p className="mt-0.5 text-xs text-ink-secondary">
                {(selectedFile.size / 1024).toFixed(1)} KB · Ready for inspection
              </p>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[11px] text-ink-muted">Click or drag another archive to replace</span>
              <button
                type="button"
                onClick={handleClear}
                className="p-1 rounded-md text-ink-muted hover:text-ink-primary hover:bg-warm-pill transition-colors"
                title="Remove archive"
                aria-label="Remove archive"
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        ) : state === 'rejected' ? (
          <div className="flex flex-col items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-[#FDF2F2] text-[#9C2A2A] flex items-center justify-center">
              <AlertCircle className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink-primary">Upload Rejected</p>
              <p className="mt-1 text-xs text-[#9C2A2A]">{errorMsg}</p>
            </div>
            <span className="mt-1 text-[11px] text-ink-muted underline">Click to choose a valid .zip file</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-white border border-warm-border text-ink-secondary flex items-center justify-center shadow-soft">
              <UploadCloud className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink-primary">
                Drop your Python repository <span className="font-mono text-xs">.zip</span> here
              </p>
              <p className="mt-1 text-xs text-ink-secondary">
                or click to browse from your computer · maximum {Math.round(maxBytes / 1024 / 1024)} MB
              </p>
            </div>
            <p className="text-[11px] text-ink-muted mt-1">
              Supports projects with <code className="font-mono text-[10px] bg-warm-pill px-1.5 py-0.5 rounded">pytest</code> or standard test suites
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
