import { BusinessExcellenceView } from '../_business-excellence-view';

export const dynamic = 'force-dynamic';

type BusinessExcellenceInsightsPageProps = {
  searchParams: Promise<{
    version?: string;
    pmmPeriodMonth?: string;
    pmmMarketGroup?: string;
    pmmManager?: string;
    pmmTerritory?: string;
  }>;
};

export default async function BusinessExcellenceInsightsPage({
  searchParams,
}: BusinessExcellenceInsightsPageProps) {
  return <BusinessExcellenceView viewMode="insights" searchParams={await searchParams} />;
}
