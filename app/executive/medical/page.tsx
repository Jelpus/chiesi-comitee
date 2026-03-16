import { MedicalView } from './_medical-view';

export const dynamic = 'force-dynamic';

type MedicalPageProps = {
  searchParams: Promise<{
    version?: string;
  }>;
};

export default async function MedicalPage({ searchParams }: MedicalPageProps) {
  return <MedicalView viewMode="insights" searchParams={await searchParams} />;
}
