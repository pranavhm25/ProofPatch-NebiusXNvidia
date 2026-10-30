import { Calendar } from 'lucide-react';

interface LastUpdatedProps {
  date?: string | Date;
  prefix?: string;
  className?: string;
}

export function LastUpdated({
  date = '2026-10-30',
  prefix = 'Last updated',
  className = '',
}: LastUpdatedProps) {
  const parsedDate = typeof date === 'string' ? new Date(date) : date;
  const isValid = !isNaN(parsedDate.getTime());

  const formattedDate = isValid
    ? parsedDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : String(date);

  const isoString = isValid ? parsedDate.toISOString() : undefined;

  return (
    <div
      className={`inline-flex items-center gap-1.5 text-[11px] text-ink-muted dark:text-dark-ink-muted font-mono ${className}`}
    >
      <Calendar className="h-3 w-3 shrink-0" strokeWidth={1.5} />
      <span>{prefix}:</span>
      {isoString ? (
        <time dateTime={isoString} className="font-semibold text-ink-secondary dark:text-dark-ink-secondary">
          {formattedDate}
        </time>
      ) : (
        <span className="font-semibold text-ink-secondary dark:text-dark-ink-secondary">
          {formattedDate}
        </span>
      )}
    </div>
  );
}

