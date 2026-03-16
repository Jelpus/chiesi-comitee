import { OpexView } from '../_opex-view';

export const dynamic = 'force-dynamic';

type OpexScorecardPageProps = {
  searchParams: Promise<{
    version?: string;
  }>;
};

export default async function OpexScorecardPage({ searchParams }: OpexScorecardPageProps) {
  return <OpexView viewMode="scorecard" searchParams={await searchParams} />;
}
