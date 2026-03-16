import { RaQualityFvView } from '../_ra-quality-fv-view';

export const dynamic = 'force-dynamic';

type RaQualityFvScorecardPageProps = {
  searchParams: Promise<{
    version?: string;
  }>;
};

export default async function RaQualityFvScorecardPage({ searchParams }: RaQualityFvScorecardPageProps) {
  return <RaQualityFvView viewMode="scorecard" searchParams={await searchParams} />;
}

