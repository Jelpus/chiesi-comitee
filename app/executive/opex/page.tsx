import { OpexView } from './_opex-view';

export const dynamic = 'force-dynamic';

type OpexPageProps = {
  searchParams: Promise<{
    version?: string;
  }>;
};

export default async function OpexPage({ searchParams }: OpexPageProps) {
  return <OpexView viewMode="insights" searchParams={await searchParams} />;
}
