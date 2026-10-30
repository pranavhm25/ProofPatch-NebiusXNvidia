import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  hint?: string;
}

export function StatCard({ label, value, icon, hint }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-dark-surface rounded-2xl border border-warm-border dark:border-dark-border p-5 shadow-soft relative flex flex-col justify-between transition-colors">
      {icon && (
        <div className="absolute top-5 right-5 text-ink-muted dark:text-dark-ink-muted">
          {icon}
        </div>
      )}
      <div>
        <p className="text-3xl font-semibold text-ink-primary dark:text-dark-ink-primary tracking-tight font-sans">
          {value}
        </p>
        <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary font-medium mt-1">
          {label}
        </p>
      </div>
      {hint && (
        <p className="text-[11px] text-ink-muted dark:text-dark-ink-muted mt-2 pt-2 border-t border-warm-border-subtle dark:border-dark-border-subtle">
          {hint}
        </p>
      )}
    </div>
  );
}
