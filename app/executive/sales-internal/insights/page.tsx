import { SalesInternalView } from '../_sales-internal-view';

export const dynamic = 'force-dynamic';

type InsightsPageProps = {
  searchParams: Promise<{
    periodMonth?: string;
    bu?: string;
    channel?: string;
    distributionChannel?: string;
    salesGroup?: string;
    productId?: string;
  }>;
};

export default async function SalesInternalInsightsPage({ searchParams }: InsightsPageProps) {
  return <SalesInternalView searchParams={await searchParams} viewMode="insights" />;
}

