import { Loader2 } from 'lucide-react';

interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

const sizeClasses = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
};

export function Spinner({ size = 'md', className = '', label = 'Loading...' }: SpinnerProps) {
  return (
    <div role="status" className="inline-flex items-center justify-center" aria-label={label}>
      <Loader2
        className={`animate-spin text-ink-muted dark:text-dark-ink-muted ${sizeClasses[size]} ${className}`}
        strokeWidth={2}
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}

