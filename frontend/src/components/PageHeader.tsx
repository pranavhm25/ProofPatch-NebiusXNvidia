import React from 'react';

interface PageHeaderProps {
  title: string;
  badge?: string | number;
  description?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, badge, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-6 border-b border-warm-border-subtle mb-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-semibold text-ink-primary tracking-tight">{title}</h1>
          {badge !== undefined && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-warm-pill text-ink-secondary text-xs font-medium">
              {badge}
            </span>
          )}
        </div>
        {description && <p className="text-xs text-ink-secondary max-w-2xl leading-relaxed">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

