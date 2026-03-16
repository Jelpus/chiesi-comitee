import { RaQualityFvView } from './_ra-quality-fv-view';

export const dynamic = 'force-dynamic';

type RaQualityFvPageProps = {
  searchParams: Promise<{
    version?: string;
  }>;
};

export default async function RaQualityFvPage({ searchParams }: RaQualityFvPageProps) {
  return <RaQualityFvView viewMode="insights" searchParams={await searchParams} />;
}
