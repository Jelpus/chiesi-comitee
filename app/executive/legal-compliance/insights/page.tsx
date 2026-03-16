import { LegalComplianceView } from '../_legal-compliance-view';

export const dynamic = 'force-dynamic';

type LegalComplianceInsightsPageProps = {
  searchParams: Promise<{
    version?: string;
  }>;
};

export default async function LegalComplianceInsightsPage({
  searchParams,
}: LegalComplianceInsightsPageProps) {
  return <LegalComplianceView viewMode="insights" searchParams={await searchParams} />;
}
