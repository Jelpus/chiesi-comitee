import { LegalComplianceView } from '../_legal-compliance-view';

export const dynamic = 'force-dynamic';

type LegalComplianceDashboardPageProps = {
  searchParams: Promise<{
    version?: string;
  }>;
};

export default async function LegalComplianceDashboardPage({
  searchParams,
}: LegalComplianceDashboardPageProps) {
  return <LegalComplianceView viewMode="dashboard" searchParams={await searchParams} />;
}
