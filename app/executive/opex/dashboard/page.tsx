import { OpexView } from '../_opex-view';

export const dynamic = 'force-dynamic';

type OpexDashboardPageProps = {
  searchParams: Promise<{
    version?: string;
  }>;
};

export default async function OpexDashboardPage({ searchParams }: OpexDashboardPageProps) {
  return <OpexView viewMode="dashboard" searchParams={await searchParams} />;
}
