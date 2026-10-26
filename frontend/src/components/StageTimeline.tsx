import React from 'react';
import { CheckCircle, Circle, Loader, XCircle, AlertTriangle } from 'lucide-react';
import type { JobStatus } from '../types/api';

interface Stage {
  key: JobStatus | string;
  label: string;
}

const STAGES: Stage[] = [
  { key: 'VALIDATING',  label: 'Validating repository'   },
  { key: 'ANALYZING',   label: 'Inspecting source'        },
  { key: 'PLANNING',    label: 'Planning repair'          },
  { key: 'PATCHING',    label: 'Generating patch'         },
  { key: 'TESTING',     label: 'Running tests'            },
  { key: 'RETRYING',    label: 'Retry attempt'            },
  { key: 'COMPLETED',   label: 'Preparing report'         },
];

const STATUS_ORDER: Record<string, number> = Object.fromEntries(
  STAGES.map((s, i) => [s.key, i])
);

type StageState = 'pending' | 'active' | 'completed' | 'failed' | 'blocked';

function stageState(stageKey: string, currentStatus: JobStatus): StageState {
  const stageIdx  = STATUS_ORDER[stageKey] ?? -1;
  const currentIdx = STATUS_ORDER[currentStatus] ?? -1;

  if (currentStatus === 'FAILED' && stageIdx === currentIdx) return 'failed';
  if (currentStatus === 'BLOCKED' && stageIdx === currentIdx) return 'blocked';
  if (currentStatus === 'COMPLETED') return 'completed';
  if (stageIdx < currentIdx) return 'completed';
  if (stageIdx === currentIdx) return 'active';
  return 'pending';
}

const iconMap: Record<StageState, React.ElementType> = {
  pending:   Circle,
  active:    Loader,
  completed: CheckCircle,
  failed:    XCircle,
  blocked:   AlertTriangle,
};

const colorMap: Record<StageState, string> = {
  pending:   'text-neutral-600',
  active:    'text-blue-400 animate-spin',
  completed: 'text-emerald-500',
  failed:    'text-red-500',
  blocked:   'text-amber-500',
};

interface StageTimelineProps {
  currentStatus: JobStatus;
  stageMessage?: string;
  elapsedSeconds?: number;
}

export function StageTimeline({ currentStatus, stageMessage, elapsedSeconds }: StageTimelineProps) {
  return (
    <div className="space-y-1">
      {STAGES.map((stage) => {
        const state = stageState(stage.key, currentStatus);
        const Icon  = iconMap[state];
        const color = colorMap[state];
        return (
          <div key={stage.key} className="flex items-center gap-3 py-1.5">
            <Icon className={`h-4 w-4 shrink-0 ${color}`} aria-hidden />
            <span className={`text-sm ${state === 'pending' ? 'text-neutral-500' : 'text-neutral-200'}`}>
              {stage.label}
            </span>
            {state === 'active' && stageMessage && (
              <span className="ml-auto text-xs text-neutral-400 truncate max-w-[200px]">{stageMessage}</span>
            )}
          </div>
        );
      })}
      {elapsedSeconds !== undefined && (
        <p className="pt-2 text-xs text-neutral-500">Elapsed: {elapsedSeconds}s (approximate)</p>
      )}
    </div>
  );
}
