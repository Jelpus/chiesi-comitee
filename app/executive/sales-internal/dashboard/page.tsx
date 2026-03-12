import { SalesInternalView } from '../_sales-internal-view';

export const dynamic = 'force-dynamic';

type DashboardPageProps = {
  searchParams: Promise<{
    periodMonth?: string;
    bu?: string;
    channel?: string;
    distributionChannel?: string;
    salesGroup?: string;
    productId?: string;
  }>;
};

export default async function SalesInternalDashboardPage({ searchParams }: DashboardPageProps) {
  return <SalesInternalView searchParams={await searchParams} viewMode="dashboard" />;
}

