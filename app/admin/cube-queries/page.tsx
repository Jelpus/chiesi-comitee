import { unstable_noStore as noStore } from 'next/cache';
import { CubeQueriesConsole } from '@/components/admin/cube-queries-console';
import { SectionHeader } from '@/components/ui/section-header';
import { getPreviewOptions } from '@/lib/bigquery/table_preview';

export const dynamic = 'force-dynamic';

export default async function AdminCubeQueriesPage() {
  noStore();
  const options = getPreviewOptions();

  return (
    <section className="space-y-4">
      <SectionHeader
        eyebrow="Admin"
        title="Cube Queries"
        description="Select base, properties, periods, and export full query results without preview limits."
      />
      <CubeQueriesConsole options={options} />
    </section>
  );
}
