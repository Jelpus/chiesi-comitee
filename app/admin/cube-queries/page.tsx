import { CubeQueriesConsole } from '@/components/admin/cube-queries-console';
import { getPreviewOptions } from '@/lib/bigquery/table_preview';

export const dynamic = 'force-dynamic';

export async function getStaticProps() {
  const options = getPreviewOptions();
    return {
        props: {
            options,
        },
    };
}

export default function AdminCubeQueriesPage({ options }: { options: ReturnType<typeof getPreviewOptions> }) {
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