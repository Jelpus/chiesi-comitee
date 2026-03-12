import { SectionHeader } from '@/components/ui/section-header';
import { PeriodsTable } from '@/components/admin/periods-table';
import { getPeriodsPageData } from '@/lib/data/periods/get-periods-page-data';

export default async function PeriodsPage() {
  const rows = await getPeriodsPageData();

  return (
    <section className="space-y-4">
      <SectionHeader
        eyebrow="Admin"
        title="Periods"
        description="Operational control of open/close status for each committee period."
      />

      <PeriodsTable rows={rows} />
    </section>
  );
}
