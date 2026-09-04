import { AccessCard } from '@/components/access/access-card';
import { getAppSettings } from '@/lib/data/app-settings';

export const dynamic = 'force-dynamic';

export default async function AccessPage() {
  const settings = await getAppSettings();
  return <AccessCard committeeResponsibleEmail={settings.committeeResponsibleEmail} />;
}
