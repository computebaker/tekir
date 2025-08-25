export default function AdminLoading() {
  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
        {/* Sidebar skeleton */}
        <aside className="hidden md:block">
          <div className="sticky top-6 space-y-3">
            <div className="h-6 w-24 bg-muted rounded animate-pulse" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded border border-border bg-card">
                <div className="h-5 w-5 bg-muted rounded animate-pulse" />
                <div className="h-4 w-28 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        </aside>

        {/* Content skeleton */}
        <main className="space-y-6">
          <div className="space-y-2">
            <div className="h-8 w-40 bg-muted rounded animate-pulse" />
            <div className="h-4 w-64 bg-muted rounded animate-pulse" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="h-24 rounded-lg border border-border bg-card animate-pulse" />
            <div className="h-24 rounded-lg border border-border bg-card animate-pulse" />
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="h-5 w-40 bg-muted rounded animate-pulse mb-3" />
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="h-3 w-48 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-10 bg-muted rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="bg-muted/50 border-b border-border p-3">
              <div className="h-4 w-24 bg-muted rounded animate-pulse" />
            </div>
            <div className="divide-y divide-border">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="grid grid-cols-6 gap-2 p-3">
                  <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-56 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-28 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-32 bg-muted rounded animate-pulse" />
                  <div className="h-6 w-16 bg-muted rounded animate-pulse justify-self-end" />
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
