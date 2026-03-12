import { VersionsTable } from '@/components/admin/versions-table';
import { SectionHeader } from '@/components/ui/section-header';
import { getVersionsPageData } from '@/lib/data/versions/get-versions-page-data';

export default async function VersionsPage() {
  const rows = await getVersionsPageData();

  return (
    <section className="space-y-4">
      <SectionHeader
        eyebrow="Admin"
        title="Versions"
        description="Draft, approved, and final version control for each monthly close."
      />

      <VersionsTable rows={rows} />
    </section>
  );
}
