import { LegalComplianceView } from '../_legal-compliance-view';

export const dynamic = 'force-dynamic';

type LegalComplianceScorecardPageProps = {
  searchParams: Promise<{
    version?: string;
  }>;
};

export default async function LegalComplianceScorecardPage({
  searchParams,
}: LegalComplianceScorecardPageProps) {
  return <LegalComplianceView viewMode="scorecard" searchParams={await searchParams} />;
}
