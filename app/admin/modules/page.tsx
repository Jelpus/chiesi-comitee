import { ModulesManager } from '@/components/admin/modules-manager';
import { SectionHeader } from '@/components/ui/section-header';
import { getModules } from '@/lib/data/modules';

export const dynamic = 'force-dynamic';

export default async function ModulesPage() {
  const rows = await getModules();
  const activeCount = rows.filter((row) => row.isActive).length;

  return (
    <section className="space-y-4">
      <SectionHeader
        eyebrow="Admin"
        title="Modules"
        description="Manage upload modules, ownership, visibility, and upload selector order."
        actions={
          <>
            <div className="rounded-[18px] border border-emerald-200/80 bg-emerald-50 px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-emerald-700">
              Active: {activeCount}
            </div>
            <div className="rounded-[18px] border border-slate-200/80 bg-slate-50 px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-slate-700">
              Total: {rows.length}
            </div>
          </>
        }
      />

      <ModulesManager rows={rows} />
    </section>
  );
}
