import { CommercialOperationsView } from './_commercial-operations-view';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams: Promise<{
    version?: string;
  }>;
};

export default async function CommercialOperationsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  return <CommercialOperationsView viewMode="insights" searchParams={params} />;
}
