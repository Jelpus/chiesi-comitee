import { MedicalView } from '../_medical-view';

export const dynamic = 'force-dynamic';

type MedicalInsightsPageProps = {
  searchParams: Promise<{
    version?: string;
  }>;
};

export default async function MedicalInsightsPage({ searchParams }: MedicalInsightsPageProps) {
  return <MedicalView viewMode="insights" searchParams={await searchParams} />;
}

