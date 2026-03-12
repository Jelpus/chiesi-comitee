import { SalesInternalView } from '../_sales-internal-view';

export const dynamic = 'force-dynamic';

type ScorecardPageProps = {
  searchParams: Promise<{
    periodMonth?: string;
    bu?: string;
    channel?: string;
    distributionChannel?: string;
    salesGroup?: string;
    productId?: string;
  }>;
};

export default async function SalesInternalScorecardPage({ searchParams }: ScorecardPageProps) {
  return <SalesInternalView searchParams={await searchParams} viewMode="scorecard" />;
}

