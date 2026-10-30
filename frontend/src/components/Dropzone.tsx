import React, { useCallback, useState, useRef } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, FileArchive, X } from 'lucide-react';
import { ConfirmationModal } from './ConfirmationModal';

type DropzoneState = 'idle' | 'dragging' | 'accepted' | 'rejected';

interface DropzoneProps {
  onFileSelected: (file: File) => void;
  onFileCleared?: () => void;
  maxBytes?: number;
  disabled?: boolean;
}

const MAX_DEFAULT = 20 * 1024 * 1024; // 20 MB

export function Dropzone({
  onFileSelected,
  onFileCleared,
  maxBytes = MAX_DEFAULT,
  disabled = false,
}: DropzoneProps) {
  const [state, setState] = useState<DropzoneState>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = useCallback(
    (file: File) => {
      setErrorMsg(null);
      if (!file.name.toLowerCase().endsWith('.zip')) {
        setState('rejected');
        setErrorMsg('Invalid file format. Only Python project .zip archives are supported.');
        return;
      }
      if (file.size > maxBytes) {
        setState('rejected');
        setErrorMsg(
          `Archive exceeds maximum upload size of ${Math.round(maxBytes / 1024 / 1024)} MB (${(
            file.size /
            1024 /
            1024
          ).toFixed(1)} MB uploaded).`
        );
        return;
      }
      setState('accepted');
      setSelectedFile(file);
      onFileSelected(file);
    },
    [maxBytes, onFileSelected]
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (disabled) return;
      const file = e.dataTransfer.files[0];
      if (file) accept(file);
      else setState(selectedFile ? 'accepted' : 'idle');
    },
    [disabled, accept, selectedFile]
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) accept(file);
    },
    [accept]
  );

  const handleClearConfirmed = () => {
    setSelectedFile(null);
    setState('idle');
    setErrorMsg(null);
    if (inputRef.current) inputRef.current.value = '';
    onFileCleared?.();
  };

  const borderStyles = {
    idle: 'border-warm-border dark:border-dark-border hover:border-[#C8C0B4] dark:hover:border-[#524B43] bg-[#FAF8F5] dark:bg-dark-card',
    dragging: 'border-[#2A2420] dark:border-amber-500 bg-warm-muted/40 dark:bg-dark-muted/40 shadow-soft',
    accepted: 'border-[#BDE3CA] dark:border-emerald-800 bg-[#F4FAF6] dark:bg-emerald-950/20',
    rejected: 'border-[#F6C8C8] dark:border-red-900 bg-[#FDF5F5] dark:bg-red-950/20',
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
        className={`relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-all ${borderStyles} ${disabled ? 'opacity-50 cursor-not-allowed' : ''
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
          onClick={(e) => e.stopPropagation()}
          aria-label="Upload repository archive"
          data-testid="dropzone-file-input"
          tabIndex={-1}
          disabled={disabled}
        />

        {state === 'accepted' && selectedFile ? (
          <div className="flex flex-col items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-[#EAF5ED] dark:bg-emerald-950/50 text-[#1E6B3C] dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <div>
              <p className="flex items-center justify-center gap-2 text-sm font-semibold text-ink-primary dark:text-dark-ink-primary">
                <FileArchive className="h-4 w-4 text-[#1E6B3C] dark:text-emerald-400" strokeWidth={1.5} />
                {selectedFile.name}
              </p>
              <p className="mt-0.5 text-xs text-ink-secondary dark:text-dark-ink-secondary">
                {(selectedFile.size / 1024).toFixed(1)} KB · Ready for inspection
              </p>
            </div>
            <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
              <span className="text-[11px] text-ink-muted dark:text-dark-ink-muted">
                Click or drag another archive to replace
              </span>
              <button
                type="button"
                onClick={() => setShowConfirmClear(true)}
                className="p-1 rounded-md text-ink-muted dark:text-dark-ink-muted hover:text-ink-primary dark:hover:text-dark-ink-primary hover:bg-warm-pill dark:hover:bg-dark-pill transition-colors focus-visible:outline-2"
                title="Remove archive"
                aria-label="Remove archive"
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        ) : state === 'rejected' ? (
          <div className="flex flex-col items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-[#FDF2F2] dark:bg-red-950/50 text-[#9C2A2A] dark:text-red-400 flex items-center justify-center">
              <AlertCircle className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink-primary dark:text-dark-ink-primary">
                Upload Rejected
              </p>
              <p className="mt-1 text-xs text-[#9C2A2A] dark:text-red-400">{errorMsg}</p>
            </div>
            <span className="mt-1 text-[11px] text-ink-muted dark:text-dark-ink-muted underline">
              Click to choose a valid .zip file
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-white dark:bg-dark-surface border border-warm-border dark:border-dark-border text-ink-secondary dark:text-dark-ink-secondary flex items-center justify-center shadow-soft">
              <UploadCloud className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink-primary dark:text-dark-ink-primary">
                Drop your Python repository <span className="font-mono text-xs">.zip</span> here
              </p>
              <p className="mt-1 text-xs text-ink-secondary dark:text-dark-ink-secondary">
                or click to browse from your computer · maximum {Math.round(maxBytes / 1024 / 1024)} MB
              </p>
            </div>
            <p className="text-[11px] text-ink-muted dark:text-dark-ink-muted mt-1">
              Supports projects with <code className="font-mono text-[10px] bg-warm-pill dark:bg-dark-pill px-1.5 py-0.5 rounded">pytest</code> or standard test suites
            </p>
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={showConfirmClear}
        onClose={() => setShowConfirmClear(false)}
        onConfirm={handleClearConfirmed}
        title="Remove Uploaded Archive?"
        description={`Are you sure you want to remove "${selectedFile?.name}"? You will need to select an archive again before submitting.`}
        confirmLabel="Remove Archive"
        cancelLabel="Keep Archive"
        destructive={true}
      />
    </div>
  );
}
