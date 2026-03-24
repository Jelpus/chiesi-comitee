import { unstable_noStore as noStore } from 'next/cache';
import { TablesConsole } from '@/components/admin/tables-console';
import { SectionHeader } from '@/components/ui/section-header';
import { getPreviewOptions } from '@/lib/bigquery/table_preview';
import Link from 'next/link';

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
      <Link
        href="/admin/cube-queries"
        className="inline-flex items-center justify-center rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition-all hover:border-blue-300 hover:bg-blue-100"
      >
        Consultas Cubo
      </Link>

      <TablesConsole options={options} />
    </section>
  );
}

