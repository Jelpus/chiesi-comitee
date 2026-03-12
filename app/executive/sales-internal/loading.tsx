export default function SalesInternalLoading() {
  return (
    <section className="space-y-4 animate-pulse">
      <div className="h-16 rounded-2xl border border-slate-200 bg-slate-100" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-40 rounded-2xl border border-slate-200 bg-slate-100" />
        <div className="h-40 rounded-2xl border border-slate-200 bg-slate-100" />
      </div>
      <div className="h-20 rounded-2xl border border-slate-200 bg-slate-100" />
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="h-72 rounded-2xl border border-slate-200 bg-slate-100" />
        <div className="h-72 rounded-2xl border border-slate-200 bg-slate-100" />
        <div className="h-72 rounded-2xl border border-slate-200 bg-slate-100" />
      </div>
    </section>
  );
}
