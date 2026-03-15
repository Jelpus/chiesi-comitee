import { HumanResourcesView } from '../_human-resources-view';

export const dynamic = 'force-dynamic';

type HumanResourcesScorecardPageProps = {
  searchParams: Promise<{
    version?: string;
  }>;
};

export default async function HumanResourcesScorecardPage({
  searchParams,
}: HumanResourcesScorecardPageProps) {
  return <HumanResourcesView viewMode="scorecard" searchParams={await searchParams} />;
}
