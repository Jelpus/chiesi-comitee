import { BusinessExcellenceView } from '../_business-excellence-view';

export const dynamic = 'force-dynamic';

type BusinessExcellenceDashboardPageProps = {
  searchParams: Promise<{
    version?: string;
    pmmPeriodMonth?: string;
    pmmMarketGroup?: string;
    pmmManager?: string;
    pmmTerritory?: string;
  }>;
};

export default async function BusinessExcellenceDashboardPage({
  searchParams,
}: BusinessExcellenceDashboardPageProps) {
  return <BusinessExcellenceView viewMode="dashboard" searchParams={await searchParams} />;
}
