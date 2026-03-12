export default function AdminPage() {
  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
          Admin
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
          Admin Panel
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Operational management of periods, versions, uploads, validations, and committee traceability.
        </p>
      </div>
    </section>
  );
}
