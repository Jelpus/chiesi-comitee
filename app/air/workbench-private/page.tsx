import { AirScenarioWorkbench } from '@/components/air/air-scenario-workbench';
import { getAirPageData } from '@/lib/air/get-air-data';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export default async function AirPrivateWorkbenchPage({
  searchParams,
}: {
  searchParams?: Promise<{ marketGroup?: string }>;
}) {
  const params = await searchParams;
  const data = await getAirPageData({ marketGroup: params?.marketGroup, includeRawRows: true });
  return <AirScenarioWorkbench data={data} />;
}
