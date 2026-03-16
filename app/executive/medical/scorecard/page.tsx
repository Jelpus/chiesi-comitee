import { MedicalView } from '../_medical-view';

export const dynamic = 'force-dynamic';

type MedicalScorecardPageProps = {
  searchParams: Promise<{
    version?: string;
  }>;
};

export default async function MedicalScorecardPage({ searchParams }: MedicalScorecardPageProps) {
  return <MedicalView viewMode="scorecard" searchParams={await searchParams} />;
}

