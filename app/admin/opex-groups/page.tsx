import { SectionHeader } from '@/components/ui/section-header';
import { OpexCecoGroupManager } from '@/components/admin/opex-ceco-group-manager';
import { getOpexCecoGroupMappings } from '@/lib/data/opex-group-mapping';

export const dynamic = 'force-dynamic';

export default async function OpexGroupsPage() {
  const rows = await getOpexCecoGroupMappings();

  return (
    <section className="space-y-4">
      <SectionHeader
        eyebrow="Admin"
        title="Opex CeCo Groups"
        description="Maintain CeCo Name to CeCo Group mapping used in executive OPEX views."
      />
      <OpexCecoGroupManager rows={rows} />
    </section>
  );
}
