import React from 'react';
import { CheckCircle2, AlertCircle, XCircle, ShieldAlert, Loader2 } from 'lucide-react';
import type { FinalVerdict, JobStatus } from '../types/api';

type BadgeVerdict = FinalVerdict | 'RUNNING';

interface VerdictBadgeProps {
  verdict: BadgeVerdict | JobStatus;
  size?: 'sm' | 'md' | 'lg';
}

interface BadgeConfig {
  label: string;
  classes: string;
  icon: React.ReactNode;
}

export function VerdictBadge({ verdict, size = 'md' }: VerdictBadgeProps) {
  // Normalize status if passed JobStatus
  let normalizedVerdict: BadgeVerdict;
  if (verdict === 'COMPLETED' || verdict === 'VERIFIED') {
    normalizedVerdict = 'VERIFIED';
  } else if (verdict === 'NOT_VERIFIED') {
    normalizedVerdict = 'NOT_VERIFIED';
  } else if (verdict === 'FAILED') {
    normalizedVerdict = 'FAILED';
  } else if (verdict === 'BLOCKED' || verdict === 'CANCELLED') {
    normalizedVerdict = 'BLOCKED';
  } else {
    normalizedVerdict = 'RUNNING';
  }

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
  };

  const textSizes = {
    sm: 'text-[11px] px-2.5 py-0.5',
    md: 'text-xs px-3 py-1',
    lg: 'text-sm px-4 py-1.5 font-semibold',
  };

  const configs: Record<BadgeVerdict, BadgeConfig> = {
    VERIFIED: {
      label: 'Verified',
      classes: 'bg-[#EAF5ED] text-[#1E6B3C] border-[#BDE3CA]',
      icon: <CheckCircle2 className={`${iconSizes[size]} shrink-0`} strokeWidth={1.5} />,
    },
    NOT_VERIFIED: {
      label: 'Not Verified',
      classes: 'bg-[#FEF7EC] text-[#9A6218] border-[#F7DFC0]',
      icon: <AlertCircle className={`${iconSizes[size]} shrink-0`} strokeWidth={1.5} />,
    },
    FAILED: {
      label: 'Failed',
      classes: 'bg-[#FDF2F2] text-[#9C2A2A] border-[#F6C8C8]',
      icon: <XCircle className={`${iconSizes[size]} shrink-0`} strokeWidth={1.5} />,
    },
    BLOCKED: {
      label: 'Blocked',
      classes: 'bg-[#F4F1ED] text-[#5A534D] border-[#DDD7CF]',
      icon: <ShieldAlert className={`${iconSizes[size]} shrink-0`} strokeWidth={1.5} />,
    },
    RUNNING: {
      label: 'Running',
      classes: 'bg-[#EEF5FA] text-[#27618D] border-[#C8E1F3]',
      icon: <Loader2 className={`${iconSizes[size]} shrink-0 animate-spin`} strokeWidth={1.5} />,
    },
  };

  const cfg = configs[normalizedVerdict];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${cfg.classes} ${textSizes[size]}`}
    >
      {cfg.icon}
      <span>{cfg.label}</span>
    </span>
  );
}
