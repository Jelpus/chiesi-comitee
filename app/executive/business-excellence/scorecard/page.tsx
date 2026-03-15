import { BusinessExcellenceView } from '../_business-excellence-view';

export const dynamic = 'force-dynamic';

type BusinessExcellenceScorecardPageProps = {
  searchParams: Promise<{
    version?: string;
    pmmPeriodMonth?: string;
    pmmMarketGroup?: string;
    pmmManager?: string;
    pmmTerritory?: string;
  }>;
};

export default async function BusinessExcellenceScorecardPage({
  searchParams,
}: BusinessExcellenceScorecardPageProps) {
  return <BusinessExcellenceView viewMode="scorecard" searchParams={await searchParams} />;
}
