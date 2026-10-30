import React from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';

export type AlertKind = 'info' | 'success' | 'warning' | 'error';

interface AlertProps {
  kind: AlertKind;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

const config: Record<AlertKind, { icon: React.ElementType; classes: string; iconColor: string }> = {
  info: {
    icon: Info,
    classes: 'bg-[#EEF5FA] border-[#C8E1F3] text-ink-primary',
    iconColor: 'text-[#27618D]',
  },
  success: {
    icon: CheckCircle2,
    classes: 'bg-[#EAF5ED] border-[#BDE3CA] text-ink-primary',
    iconColor: 'text-[#1E6B3C]',
  },
  warning: {
    icon: AlertTriangle,
    classes: 'bg-[#FEF7EC] border-[#F7DFC0] text-ink-primary',
    iconColor: 'text-[#9A6218]',
  },
  error: {
    icon: AlertCircle,
    classes: 'bg-[#FDF2F2] border-[#F6C8C8] text-ink-primary',
    iconColor: 'text-[#9C2A2A]',
  },
};

export function Alert({ kind, title, children, className = '' }: AlertProps) {
  const { icon: Icon, classes, iconColor } = config[kind];
  return (
    <div className={`flex gap-3 rounded-2xl border p-4 text-xs leading-relaxed ${classes} ${className}`} role="alert">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconColor}`} strokeWidth={1.5} aria-hidden />
      <div className="flex-1">
        {title && <p className="mb-0.5 font-semibold text-ink-primary">{title}</p>}
        <div className="text-ink-secondary">{children}</div>
      </div>
    </div>
  );
}
