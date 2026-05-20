export default function ExecutiveLoading() {
  return (
    <section className="space-y-4 pb-8">
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
          <div className="mt-3 h-7 w-64 max-w-full animate-pulse rounded bg-slate-200" />
          <div className="mt-3 h-4 w-[32rem] max-w-full animate-pulse rounded bg-slate-100" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-28 animate-pulse rounded-md bg-slate-100" />
          <div className="h-9 w-28 animate-pulse rounded-md bg-slate-100" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="h-3 w-28 animate-pulse rounded bg-slate-100" />
            <div className="mt-4 h-8 w-20 animate-pulse rounded bg-slate-200" />
            <div className="mt-5 h-3 w-full animate-pulse rounded bg-slate-100" />
            <div className="mt-2 h-3 w-4/5 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="h-5 w-48 animate-pulse rounded bg-slate-200" />
        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          <div className="h-48 animate-pulse rounded-md bg-slate-100" />
          <div className="h-48 animate-pulse rounded-md bg-slate-100" />
          <div className="h-48 animate-pulse rounded-md bg-slate-100" />
        </div>
      </div>
    </section>
  );
}
