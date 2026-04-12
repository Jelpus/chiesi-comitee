import { unstable_noStore as noStore } from 'next/cache';
import { CubeQueriesConsole } from '@/components/admin/cube-queries-console';
import { getPreviewOptions } from '@/lib/bigquery/table_preview';

export const dynamic = 'force-dynamic';

export default async function AdminCubeQueriesPage() {
  noStore();
  const options = getPreviewOptions();

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Cube Queries Console</h1>
      <p className="text-gray-600">
        Run and inspect cube queries against your BigQuery data warehouse.
      </p>
      <CubeQueriesConsole options={options} />
    </section>
  );
}
