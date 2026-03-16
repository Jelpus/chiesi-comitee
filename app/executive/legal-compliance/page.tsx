import { LegalComplianceView } from './_legal-compliance-view';

export const dynamic = 'force-dynamic';

type LegalCompliancePageProps = {
  searchParams: Promise<{
    version?: string;
  }>;
};

export default async function LegalCompliancePage({ searchParams }: LegalCompliancePageProps) {
  return <LegalComplianceView viewMode="insights" searchParams={await searchParams} />;
}
