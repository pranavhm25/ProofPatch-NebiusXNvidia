import { useState } from 'react';
import { Download, FileCode } from 'lucide-react';
import type { DiffInfo } from '../types/api';
import { downloadUrl } from '../api/client';

interface DiffViewerProps {
  diff: DiffInfo;
  jobId: string;
}

export function DiffViewer({ diff, jobId }: DiffViewerProps) {
  const [selectedFile, setSelectedFile] = useState<string>(diff.changed_files[0] ?? '');

  if (!diff.available || !diff.unified_diff) {
    return <p className="text-sm text-neutral-500">No diff available for inspection.</p>;
  }

  const sections = parseDiffSections(diff.unified_diff);
  const currentSection = sections.find((s) => s.file === selectedFile) ?? sections[0];

  return (
    <div className="space-y-3">
      {diff.changed_files.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {diff.changed_files.map((f) => (
            <button
              key={f}
              onClick={() => setSelectedFile(f)}
              className={`flex items-center gap-1.5 rounded px-3 py-1 text-xs font-mono transition-colors ${
                f === (currentSection?.file ?? selectedFile)
                  ? 'bg-blue-600 text-white'
                  : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
              }`}
            >
              <FileCode className="h-3 w-3" />
              {f}
            </button>
          ))}
        </div>
      )}
      {currentSection && (
        <div className="overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-950 font-mono text-xs">
          <div className="border-b border-neutral-800 px-4 py-2 text-neutral-400 font-semibold bg-neutral-900/50">
            {currentSection.file}
          </div>
          <div className="py-2">
            {currentSection.lines.map((line, i) => (
              <div
                key={i}
                className={`px-4 py-0.5 whitespace-pre ${
                  line.startsWith('+') && !line.startsWith('+++')
                    ? 'bg-emerald-950/60 text-emerald-300'
                    : line.startsWith('-') && !line.startsWith('---')
                    ? 'bg-red-950/60 text-red-300'
                    : line.startsWith('@@')
                    ? 'bg-blue-950/60 text-blue-400 font-bold'
                    : 'text-neutral-400'
                }`}
              >
                {line}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-3 pt-1">
        <a
          href={downloadUrl(jobId, 'patch')}
          className="flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800 transition-colors"
          download
        >
          <Download className="h-3.5 w-3.5" />
          Download .patch
        </a>
        <a
          href={downloadUrl(jobId, 'zip')}
          className="flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800 transition-colors"
          download
        >
          <Download className="h-3.5 w-3.5" />
          Download patched .zip
        </a>
      </div>
    </div>
  );
}

interface DiffSection { file: string; lines: string[] }

function parseDiffSections(diff: string): DiffSection[] {
  const sections: DiffSection[] = [];
  let current: DiffSection | null = null;
  for (const line of diff.split('\n')) {
    if (line.startsWith('--- ') || line.startsWith('+++ ')) {
      if (line.startsWith('+++ ')) {
        const file = line.replace(/^\+\+\+ (b\/)?/, '').split('\t')[0].trim();
        current = { file, lines: [] };
        sections.push(current);
      }
    } else if (current) {
      current.lines.push(line);
    }
  }
  return sections;
}
