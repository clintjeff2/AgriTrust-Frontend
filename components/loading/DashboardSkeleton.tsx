export function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading dashboard" className="space-y-6 p-6">
      <div className="h-8 w-1/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-700" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-700" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-48 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-700" />
        ))}
      </div>
    </div>
  );
}
