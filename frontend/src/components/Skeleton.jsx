export function Skeleton({ className = '' }) {
  return <span aria-hidden="true" className={`block animate-pulse rounded-lg bg-slate-200/80 ${className}`} />;
}

export function PageSkeleton() {
  return <main className="min-h-screen bg-slate-50">
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white p-5 lg:block">
        <div className="mb-8 flex items-center gap-3"><Skeleton className="h-10 w-10 rounded-xl" /><div className="space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-2.5 w-16" /></div></div>
        <div className="space-y-3">{Array.from({ length: 7 }, (_, index) => <Skeleton key={index} className={`h-10 w-full ${index === 0 ? 'bg-emerald-100' : ''}`} />)}</div>
        <div className="mt-auto space-y-3 pt-12"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
          <div className="flex items-center gap-3"><Skeleton className="h-9 w-9 lg:hidden" /><Skeleton className="h-5 w-40" /></div>
          <div className="flex items-center gap-3"><Skeleton className="h-9 w-9 rounded-full" /><Skeleton className="hidden h-4 w-24 sm:block" /></div>
        </header>
        <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
          <div className="space-y-2"><Skeleton className="h-8 w-64" /><Skeleton className="h-4 w-96 max-w-full" /></div>
          <div className="grid gap-5 lg:grid-cols-3"><Skeleton className="h-36" /><Skeleton className="h-36" /><Skeleton className="h-36" /></div>
          <Skeleton className="h-72 w-full" />
        </div>
      </div>
    </div>
  </main>;
}

export function ListSkeleton({ rows = 5 }) {
  return <div className="space-y-3" aria-label="Chargement en cours">
    {Array.from({ length: rows }, (_, index) => <div key={index} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-3/4" /></div>
      <Skeleton className="h-9 w-24 shrink-0" />
    </div>)}
  </div>;
}
