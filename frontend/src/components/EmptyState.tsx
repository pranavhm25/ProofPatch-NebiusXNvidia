import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-warm-border dark:border-dark-border bg-[#FAF7F2] dark:bg-dark-card my-4 transition-colors">
      {icon && (
        <div className="text-ink-muted dark:text-dark-ink-muted mb-3.5 p-3 rounded-full bg-white dark:bg-dark-surface border border-warm-border dark:border-dark-border shadow-xs">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-ink-primary dark:text-dark-ink-primary">{title}</h3>
      <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary mt-1 max-w-sm leading-relaxed">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
