import { useState } from 'react';
import { Download, FileCode, Copy, Check } from 'lucide-react';
import type { DiffInfo } from '../types/api';
import { downloadUrl } from '../lib/api';

interface DiffViewerProps {
  diff: DiffInfo;
  jobId: string;
}

interface DiffHunkLine {
  type: 'context' | 'add' | 'del' | 'header';
  text: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

interface DiffSection {
  file: string;
  lines: DiffHunkLine[];
  additions: number;
  deletions: number;
}

function parseDiff(diffText: string): DiffSection[] {
  const sections: DiffSection[] = [];
  let currentSection: DiffSection | null = null;
  let oldLine = 0;
  let newLine = 0;

  for (const rawLine of diffText.split('\n')) {
    if (rawLine.startsWith('--- ') || rawLine.startsWith('+++ ')) {
      if (rawLine.startsWith('+++ ')) {
        const file = rawLine.replace(/^\+\+\+ (b\/)?/, '').split('\t')[0].trim();
        currentSection = { file, lines: [], additions: 0, deletions: 0 };
        sections.push(currentSection);
      }
      continue;
    }

    if (!currentSection) continue;

    if (rawLine.startsWith('@@')) {
      // Parse hunk header: @@ -oldStart,oldCount +newStart,newCount @@
      const match = rawLine.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLine = parseInt(match[1], 10);
        newLine = parseInt(match[2], 10);
      }
      currentSection.lines.push({
        type: 'header',
        text: rawLine,
      });
    } else if (rawLine.startsWith('+')) {
      currentSection.additions++;
      currentSection.lines.push({
        type: 'add',
        text: rawLine.slice(1),
        newLineNumber: newLine++,
      });
    } else if (rawLine.startsWith('-')) {
      currentSection.deletions++;
      currentSection.lines.push({
        type: 'del',
        text: rawLine.slice(1),
        oldLineNumber: oldLine++,
      });
    } else {
      // Context or newline marker
      const isContext = rawLine.startsWith(' ');
      const text = isContext ? rawLine.slice(1) : rawLine;
      currentSection.lines.push({
        type: 'context',
        text,
        oldLineNumber: isContext ? oldLine++ : undefined,
        newLineNumber: isContext ? newLine++ : undefined,
      });
    }
  }

  return sections;
}

export function DiffViewer({ diff, jobId }: DiffViewerProps) {
  const [copied, setCopied] = useState(false);
  const sections = diff.unified_diff ? parseDiff(diff.unified_diff) : [];
  const [selectedFile, setSelectedFile] = useState<string>(
    sections[0]?.file ?? diff.changed_files[0] ?? ''
  );

  if (!diff.available || !diff.unified_diff || sections.length === 0) {
    return (
      <div className="p-6 rounded-2xl border border-warm-border bg-[#FAF7F2] text-center text-xs text-ink-secondary">
        No unified diff patch available for this repair.
      </div>
    );
  }

  const currentSection = sections.find((s) => s.file === selectedFile) ?? sections[0];

  const handleCopy = async () => {
    if (!diff.unified_diff) return;
    try {
      await navigator.clipboard.writeText(diff.unified_diff);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="space-y-4">
      {/* File Tabs for Multi-File Diffs */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-warm-border-subtle">
        <div className="flex flex-wrap items-center gap-1.5">
          {sections.map((section) => {
            const isSelected = section.file === currentSection.file;
            return (
              <button
                key={section.file}
                type="button"
                onClick={() => setSelectedFile(section.file)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono transition-all ${
                  isSelected
                    ? 'bg-ink-primary text-warm-bg font-semibold shadow-soft'
                    : 'bg-warm-pill text-ink-secondary hover:text-ink-primary hover:bg-[#EAE5DE]'
                }`}
              >
                <FileCode className="h-3 w-3 shrink-0" strokeWidth={1.5} />
                <span>{section.file}</span>
                <span className="flex items-center gap-1 text-[10px] ml-1">
                  <span className="text-[#1E6B3C]">+{section.additions}</span>
                  <span className="text-[#9C2A2A]">-{section.deletions}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Copy Button */}
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-warm-border bg-white text-xs font-medium text-ink-primary hover:border-[#D8D2CA] shadow-soft transition-colors"
          title="Copy full unified diff to clipboard"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-[#1E6B3C]" strokeWidth={1.5} />
              <span className="text-[#1E6B3C]">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5 text-ink-muted" strokeWidth={1.5} />
              <span>Copy Diff</span>
            </>
          )}
        </button>
      </div>

      {/* Code Viewer Panel with Line Numbers */}
      <div className="rounded-2xl border border-warm-border bg-[#FCFBF9] overflow-hidden shadow-soft">
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#F5F2ED] border-b border-warm-border text-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono font-medium text-ink-primary">{currentSection.file}</span>
          </div>
          <div className="text-[11px] text-ink-secondary">
            <span className="font-semibold text-[#1E6B3C]">+{currentSection.additions}</span> additions,{' '}
            <span className="font-semibold text-[#9C2A2A]">-{currentSection.deletions}</span> deletions
          </div>
        </div>

        <div className="overflow-x-auto font-mono text-xs max-h-[500px] overflow-y-auto">
          <table className="w-full border-collapse">
            <tbody>
              {currentSection.lines.map((line, idx) => {
                if (line.type === 'header') {
                  return (
                    <tr key={idx} className="bg-[#EEF5FA] border-y border-[#D6E6F4] text-[#27618D] select-none">
                      <td colSpan={3} className="px-4 py-1 font-semibold text-[11px]">
                        {line.text}
                      </td>
                    </tr>
                  );
                }

                const isAdd = line.type === 'add';
                const isDel = line.type === 'del';

                const rowBg = isAdd
                  ? 'bg-[#EAF5ED]/70 text-[#16552F]'
                  : isDel
                  ? 'bg-[#FDF2F2]/70 text-[#8C2323]'
                  : 'text-[#4A433D] hover:bg-black/[0.02]';

                const prefix = isAdd ? '+' : isDel ? '-' : ' ';

                return (
                  <tr key={idx} className={`${rowBg} transition-colors leading-relaxed`}>
                    {/* Old line number */}
                    <td className="w-12 px-2 py-0.5 text-right text-[10px] text-ink-muted select-none border-r border-warm-border/40 font-mono">
                      {line.oldLineNumber ?? ''}
                    </td>
                    {/* New line number */}
                    <td className="w-12 px-2 py-0.5 text-right text-[10px] text-ink-muted select-none border-r border-warm-border/40 font-mono">
                      {line.newLineNumber ?? ''}
                    </td>
                    {/* Code text */}
                    <td className="px-3 py-0.5 whitespace-pre">
                      <span className="select-none text-ink-muted inline-block w-3">{prefix}</span>
                      {line.text}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Artifact Downloads Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <p className="text-xs text-ink-secondary">
          Export changes for local review or application with <code className="font-mono text-[11px] bg-warm-pill px-1.5 py-0.5 rounded">git apply</code>.
        </p>
        <div className="flex items-center gap-2">
          <a
            href={downloadUrl(jobId, 'patch')}
            download={`proofpatch_${jobId.slice(0, 8)}.patch`}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-warm-border bg-white text-xs font-medium text-ink-primary hover:border-[#D8D2CA] shadow-soft transition-colors"
          >
            <Download className="h-3.5 w-3.5 text-ink-muted" strokeWidth={1.5} />
            <span>Download .patch</span>
          </a>
          <a
            href={downloadUrl(jobId, 'zip')}
            download={`proofpatch_${jobId.slice(0, 8)}.zip`}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-warm-border bg-white text-xs font-medium text-ink-primary hover:border-[#D8D2CA] shadow-soft transition-colors"
          >
            <Download className="h-3.5 w-3.5 text-ink-muted" strokeWidth={1.5} />
            <span>Download patched .zip</span>
          </a>
        </div>
      </div>
    </div>
  );
}
