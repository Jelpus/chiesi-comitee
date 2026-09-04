import { CommitteePlanningManager } from '@/components/admin/committee-planning-manager';
import { SectionHeader } from '@/components/ui/section-header';
import { getAppSettings } from '@/lib/data/app-settings';
import { getCommitteePlans } from '@/lib/data/committee-planning';

export const dynamic = 'force-dynamic';

export default async function PlanningPage() {
  const [plans, settings] = await Promise.all([getCommitteePlans(), getAppSettings()]);
  return (
    <section className="space-y-4">
      <SectionHeader
        eyebrow="Admin"
        title="Planning"
        description="Mexico City schedule for reminders, validation windows, and automatic period opening on day 1."
      />
      <CommitteePlanningManager plans={plans} settings={settings} />
    </section>
  );
}
