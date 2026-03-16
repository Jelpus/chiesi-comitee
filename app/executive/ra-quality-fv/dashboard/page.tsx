import { RaQualityFvView } from '../_ra-quality-fv-view';

export const dynamic = 'force-dynamic';

type RaQualityFvDashboardPageProps = {
  searchParams: Promise<{
    version?: string;
  }>;
};

export default async function RaQualityFvDashboardPage({ searchParams }: RaQualityFvDashboardPageProps) {
  return <RaQualityFvView viewMode="dashboard" searchParams={await searchParams} />;
}

