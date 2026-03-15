import { HumanResourcesView } from '../_human-resources-view';

export const dynamic = 'force-dynamic';

type HumanResourcesDashboardPageProps = {
  searchParams: Promise<{
    version?: string;
    hrTab?: string;
  }>;
};

export default async function HumanResourcesDashboardPage({
  searchParams,
}: HumanResourcesDashboardPageProps) {
  return <HumanResourcesView viewMode="dashboard" searchParams={await searchParams} />;
}
