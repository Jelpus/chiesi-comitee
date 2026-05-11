import { PrepareAreaView } from '@/components/prepare/prepare-area-view';
import { getPrepareAreaData } from '@/lib/data/prepare';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type PrepareAreaPageProps = {
  params: Promise<{
    area_code: string;
  }>;
  searchParams?: Promise<{
    version?: string;
  }>;
};

export default async function PrepareAreaPage({ params, searchParams }: PrepareAreaPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const data = await getPrepareAreaData(resolvedParams.area_code, resolvedSearchParams.version);
  return <PrepareAreaView data={data} />;
}
