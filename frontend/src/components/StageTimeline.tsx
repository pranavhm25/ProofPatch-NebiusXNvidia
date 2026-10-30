import { CheckCircle2, Circle, Loader2, XCircle, ShieldAlert } from 'lucide-react';
import type { JobStatus } from '../types/api';

interface StageConfig {
  key: JobStatus | string;
  label: string;
  description: string;
}

const STAGES: StageConfig[] = [
  { key: 'VALIDATING', label: 'Validating Repository', description: 'Checking archive integrity, path safety, and Python markers' },
  { key: 'ANALYZING', label: 'Inspecting Source', description: 'Locating defect context, test cases, and candidate modules' },
  { key: 'PLANNING', label: 'Planning Repair', description: 'Formulating root cause hypothesis and file targets' },
  { key: 'PATCHING', label: 'Generating Patch', description: 'Generating unified diff with NVIDIA Nemotron' },
  { key: 'TESTING', label: 'Running Tests', description: 'Executing pytest inside isolated sandbox with resource scrub' },
  { key: 'RETRYING', label: 'Bounded Retry', description: 'Executing bounded retry with real test stderr if tests fail' },
  { key: 'COMPLETED', label: 'Preparing Report', description: 'Formulating evidence-based verdict and export artifacts' },
];

const STAGE_ORDER: Record<string, number> = Object.fromEntries(
  STAGES.map((s, i) => [s.key, i])
);

type StageState = 'pending' | 'active' | 'completed' | 'failed' | 'blocked';

function getStageState(stageKey: string, currentStatus: JobStatus): StageState {
  const stageIdx = STAGE_ORDER[stageKey] ?? -1;
  const currentIdx = STAGE_ORDER[currentStatus] ?? -1;

  if (currentStatus === 'FAILED' && stageIdx === currentIdx) return 'failed';
  if (currentStatus === 'BLOCKED' && stageIdx === currentIdx) return 'blocked';
  if (currentStatus === 'COMPLETED') return 'completed';
  if (stageIdx < currentIdx) return 'completed';
  if (stageIdx === currentIdx) return 'active';
  return 'pending';
}

interface StageTimelineProps {
  currentStatus: JobStatus;
  stageMessage?: string;
  elapsedSeconds?: number;
  modelId?: string;
  attemptNumber?: number;
}

export function StageTimeline({
  currentStatus,
  stageMessage,
  elapsedSeconds,
  modelId,
  attemptNumber = 1,
}: StageTimelineProps) {
  return (
    <div className="space-y-4">
      <div className="divide-y divide-warm-border-subtle">
        {STAGES.map((stage, idx) => {
          const state = getStageState(stage.key, currentStatus);

          const icons = {
            pending: <Circle className="h-4 w-4 text-ink-muted/50" strokeWidth={1.5} />,
            active: <Loader2 className="h-4 w-4 text-[#27618D] animate-spin" strokeWidth={1.5} />,
            completed: <CheckCircle2 className="h-4 w-4 text-[#1E6B3C]" strokeWidth={1.5} />,
            failed: <XCircle className="h-4 w-4 text-[#9C2A2A]" strokeWidth={1.5} />,
            blocked: <ShieldAlert className="h-4 w-4 text-[#5A534D]" strokeWidth={1.5} />,
          };

          const isCurrent = state === 'active';

          return (
            <div
              key={stage.key}
              className={`flex items-start gap-3.5 py-3.5 transition-colors ${
                isCurrent ? 'bg-[#FAF8F5] -mx-4 px-4 rounded-xl' : ''
              }`}
            >
              <div className="mt-0.5 shrink-0">{icons[state]}</div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={`text-xs font-semibold ${
                      state === 'active'
                        ? 'text-ink-primary font-bold'
                        : state === 'completed'
                        ? 'text-ink-primary'
                        : 'text-ink-muted'
                    }`}
                  >
                    {idx + 1}. {stage.label}
                  </p>

                  {isCurrent && stageMessage && (
                    <span className="text-[11px] text-[#27618D] bg-[#EEF5FA] px-2 py-0.5 rounded-full truncate max-w-xs border border-[#C8E1F3]">
                      {stageMessage}
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-ink-secondary mt-0.5">
                  {stage.description}
                </p>

                {isCurrent && (
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-ink-secondary pt-1 border-t border-warm-border/50">
                    {modelId && (
                      <span>
                        Model: <span className="font-mono text-ink-primary">{modelId}</span>
                      </span>
                    )}
                    <span>
                      Attempt: <span className="font-semibold text-ink-primary">{attemptNumber} of 2</span>
                    </span>
                    {elapsedSeconds !== undefined && (
                      <span>
                        Elapsed: <span className="font-mono text-ink-primary">{elapsedSeconds}s</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
