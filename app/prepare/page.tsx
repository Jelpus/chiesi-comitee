import { PrepareHome } from '@/components/prepare/prepare-home';
import { getPrepareHomeData } from '@/lib/data/prepare';

export const dynamic = 'force-dynamic';

type PreparePageProps = {
  searchParams?: Promise<{
    version?: string;
  }>;
};

export default async function PreparePage({ searchParams }: PreparePageProps) {
  const params = (await searchParams) ?? {};
  const data = await getPrepareHomeData(params.version);
  return <PrepareHome data={data} />;
}
