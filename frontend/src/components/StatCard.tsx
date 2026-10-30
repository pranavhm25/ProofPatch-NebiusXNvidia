import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  hint?: string;
}

export function StatCard({ label, value, icon, hint }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-warm-border p-5 shadow-soft relative flex flex-col justify-between">
      {icon && (
        <div className="absolute top-5 right-5 text-ink-muted">
          {icon}
        </div>
      )}
      <div>
        <p className="text-3xl font-semibold text-ink-primary tracking-tight font-sans">
          {value}
        </p>
        <p className="text-xs text-ink-secondary font-medium mt-1">
          {label}
        </p>
      </div>
      {hint && (
        <p className="text-[11px] text-ink-muted mt-2 pt-2 border-t border-warm-border-subtle">
          {hint}
        </p>
      )}
    </div>
  );
}

