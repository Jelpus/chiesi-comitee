import { AirDashboard } from '@/components/air/air-dashboard';
import { getAirPageData } from '@/lib/air/get-air-data';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export default async function AirPage({
  searchParams,
}: {
  searchParams?: Promise<{ marketGroup?: string }>;
}) {
  const params = await searchParams;
  const data = await getAirPageData({ marketGroup: params?.marketGroup });
  return <AirDashboard data={data} />;
}
