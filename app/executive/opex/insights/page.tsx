import { OpexView } from '../_opex-view';

export const dynamic = 'force-dynamic';

type OpexInsightsPageProps = {
  searchParams: Promise<{
    version?: string;
  }>;
};

export default async function OpexInsightsPage({ searchParams }: OpexInsightsPageProps) {
  return <OpexView viewMode="insights" searchParams={await searchParams} />;
}
