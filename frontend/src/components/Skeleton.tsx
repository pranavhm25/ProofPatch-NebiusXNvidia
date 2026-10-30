interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-[#EFEBE4] dark:bg-dark-muted rounded-xl ${className}`}
      aria-hidden="true"
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white dark:bg-dark-surface rounded-2xl border border-warm-border dark:border-dark-border p-6 shadow-soft space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="max-w-4xl mx-auto w-full space-y-6 animate-in fade-in duration-200">
      <div className="space-y-2 pb-6 border-b border-warm-border-subtle dark:border-dark-border-subtle">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-48 rounded-xl" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );
}
