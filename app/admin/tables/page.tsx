import { unstable_noStore as noStore } from 'next/cache';
import { TablesConsole } from '@/components/admin/tables-console';
import { SectionHeader } from '@/components/ui/section-header';
import { getPreviewOptions } from '@/lib/bigquery/table_preview';

export const dynamic = 'force-dynamic';

export default async function AdminTablesPage() {
  noStore();
  const options = getPreviewOptions();

  return (
    <section className="space-y-4">
      <SectionHeader
        eyebrow="Admin"
        title="Tables Console"
        description="Inspect BigQuery table schema, preview sample rows, and run simple SELECT preview queries."
      />

      <TablesConsole options={options} />
    </section>
  );
}

