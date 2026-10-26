import React, { useCallback, useState, useRef } from 'react';
import { UploadCloud, CheckCircle, XCircle, FileArchive } from 'lucide-react';

type DropzoneState = 'idle' | 'dragging' | 'accepted' | 'rejected';

interface DropzoneProps {
  onFileSelected: (file: File) => void;
  maxBytes?: number;
  disabled?: boolean;
}

const MAX_DEFAULT = 20 * 1024 * 1024; // 20 MB

export function Dropzone({ onFileSelected, maxBytes = MAX_DEFAULT, disabled = false }: DropzoneProps) {
  const [state, setState] = useState<DropzoneState>('idle');
  const [fileName, setFileName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = useCallback((file: File) => {
    setErrorMsg(null);
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setState('rejected');
      setErrorMsg('Only .zip archives are supported for the Python MVP.');
      return;
    }
    if (file.size > maxBytes) {
      setState('rejected');
      setErrorMsg(`File exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB upload limit.`);
      return;
    }
    setState('accepted');
    setFileName(file.name);
    onFileSelected(file);
  }, [maxBytes, onFileSelected]);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) accept(file);
    else setState('idle');
  }, [disabled, accept]);

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) accept(file);
  }, [accept]);

  const borderColor = {
    idle:     'border-neutral-700 hover:border-neutral-500 bg-neutral-900/40',
    dragging: 'border-blue-500 bg-blue-950/20',
    accepted: 'border-emerald-600 bg-emerald-950/20',
    rejected: 'border-red-600 bg-red-950/20',
  }[state];

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setState('dragging'); }}
      onDragLeave={() => setState(fileName ? 'accepted' : 'idle')}
      onDrop={onDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${borderColor} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="Upload a ZIP archive"
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
    >
      <input ref={inputRef} type="file" accept=".zip" className="sr-only" onChange={onInputChange} aria-hidden tabIndex={-1} />
      {state === 'accepted' ? (
        <CheckCircle className="h-8 w-8 text-emerald-500" aria-hidden />
      ) : state === 'rejected' ? (
        <XCircle className="h-8 w-8 text-red-500" aria-hidden />
      ) : (
        <UploadCloud className="h-8 w-8 text-neutral-400" aria-hidden />
      )}
      {state === 'accepted' ? (
        <div>
          <p className="flex items-center justify-center gap-2 text-sm font-medium text-emerald-400">
            <FileArchive className="h-4 w-4" />{fileName}
          </p>
          <p className="mt-1 text-xs text-neutral-500">Click or drag to replace archive</p>
        </div>
      ) : (
        <div>
          <p className="text-sm font-medium text-neutral-200">Drop a Python project .zip archive here</p>
          <p className="mt-1 text-xs text-neutral-500">or click to browse · maximum {Math.round(maxBytes / 1024 / 1024)} MB</p>
        </div>
      )}
      {errorMsg && <p className="text-xs text-red-400" role="alert">{errorMsg}</p>}
    </div>
  );
}
