import { AppSettingsForm } from '@/components/admin/app-settings-form';
import { SectionHeader } from '@/components/ui/section-header';
import { getAppSettings } from '@/lib/data/app-settings';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const settings = await getAppSettings();
  return (
    <section className="space-y-4">
      <SectionHeader
        eyebrow="Admin"
        title="Settings"
        description="Committee ownership and default automation rules."
      />
      <AppSettingsForm settings={settings} />
    </section>
  );
}
