import { HumanResourcesView } from '../_human-resources-view';

export const dynamic = 'force-dynamic';

type HumanResourcesInsightsPageProps = {
  searchParams: Promise<{
    version?: string;
  }>;
};

export default async function HumanResourcesInsightsPage({
  searchParams,
}: HumanResourcesInsightsPageProps) {
  return <HumanResourcesView viewMode="insights" searchParams={await searchParams} />;
}