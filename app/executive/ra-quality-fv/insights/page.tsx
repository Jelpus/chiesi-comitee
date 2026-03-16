import { RaQualityFvView } from '../_ra-quality-fv-view';

export const dynamic = 'force-dynamic';

type RaQualityFvInsightsPageProps = {
  searchParams: Promise<{
    version?: string;
  }>;
};

export default async function RaQualityFvInsightsPage({ searchParams }: RaQualityFvInsightsPageProps) {
  return <RaQualityFvView viewMode="insights" searchParams={await searchParams} />;
}

