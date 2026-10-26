import type { FinalVerdict } from '../types/api';

interface VerdictBadgeProps {
  verdict: FinalVerdict;
}

const config: Record<FinalVerdict, { label: string; classes: string }> = {
  VERIFIED:     { label: 'Verified',           classes: 'bg-emerald-900/80 text-emerald-200 border-emerald-600' },
  NOT_VERIFIED: { label: 'Not Verified',       classes: 'bg-amber-900/80 text-amber-200 border-amber-600' },
  FAILED:       { label: 'Failed',             classes: 'bg-red-900/80 text-red-200 border-red-600' },
  BLOCKED:      { label: 'Blocked',            classes: 'bg-neutral-800 text-neutral-300 border-neutral-600' },
};

export function VerdictBadge({ verdict }: VerdictBadgeProps) {
  const { label, classes } = config[verdict] ?? { label: verdict, classes: 'bg-neutral-800 text-neutral-300 border-neutral-600' };
  return (
    <span className={`inline-flex items-center rounded-md border px-3 py-1 text-sm font-semibold tracking-wide uppercase ${classes}`}>
      {label}
    </span>
  );
}
