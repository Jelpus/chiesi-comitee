import { MedicalView } from '../_medical-view';

export const dynamic = 'force-dynamic';

type MedicalDashboardPageProps = {
  searchParams: Promise<{
    version?: string;
  }>;
};

export default async function MedicalDashboardPage({ searchParams }: MedicalDashboardPageProps) {
  return <MedicalView viewMode="dashboard" searchParams={await searchParams} />;
}

