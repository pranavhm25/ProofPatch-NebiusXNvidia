import React from 'react';
import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

type AlertKind = 'info' | 'success' | 'warning' | 'error';

interface AlertProps {
  kind: AlertKind;
  title?: string;
  children: React.ReactNode;
}

const config: Record<AlertKind, { icon: React.ElementType; classes: string }> = {
  info:    { icon: Info,          classes: 'bg-blue-950/80 border-blue-700 text-blue-200' },
  success: { icon: CheckCircle,   classes: 'bg-emerald-950/80 border-emerald-700 text-emerald-200' },
  warning: { icon: AlertTriangle, classes: 'bg-amber-950/80 border-amber-700 text-amber-200' },
  error:   { icon: AlertCircle,   classes: 'bg-red-950/80 border-red-700 text-red-200' },
};

export function Alert({ kind, title, children }: AlertProps) {
  const { icon: Icon, classes } = config[kind];
  return (
    <div className={`flex gap-3 rounded-lg border p-4 text-sm ${classes}`} role="alert">
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="flex-1">
        {title && <p className="mb-1 font-semibold">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}
