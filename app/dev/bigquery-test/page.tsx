import { testBigQueryConnection } from "@/lib/bigquery/test-connection";


export default async function BigQueryTestPage() {
  let result: unknown = null;
  let errorMessage: string | null = null;

  try {
    result = await testBigQueryConnection();
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Error desconocido al conectar con BigQuery.';
  }

  return (
    <section className="space-y-6">
      <div className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_40px_rgba(15,23,42,0.05)]">
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-500">
          Dev
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          BigQuery test
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Temporary server-side connectivity check with BigQuery.
        </p>
      </div>

      <div className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_40px_rgba(15,23,42,0.05)]">
        {errorMessage ? (
          <>
            <p className="text-sm font-semibold text-rose-700">Connection failed</p>
            <pre className="mt-4 overflow-x-auto rounded-2xl bg-rose-50 p-4 text-sm text-rose-900">
              {errorMessage}
            </pre>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-emerald-700">Connection successful</p>
            <pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-50 p-4 text-sm text-slate-900">
              {JSON.stringify(result, null, 2)}
            </pre>
          </>
        )}
      </div>
    </section>
  );
}
