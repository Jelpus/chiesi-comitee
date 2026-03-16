import { FormThankYou } from '@/components/forms/form-thank-you';

type ThankYouPageProps = {
  searchParams: Promise<{
    period?: string;
    saved?: string;
  }>;
};

export default async function RegulatoryAffairsThankYouPage({ searchParams }: ThankYouPageProps) {
  const params = await searchParams;
  const period = (params.period ?? '').trim();
  const saved = Number(params.saved ?? 0);
  const editHref = `/forms/regulatory-affairs${period ? `?period=${encodeURIComponent(period)}` : ''}`;
  return (
    <FormThankYou
      moduleTitle="Regulatory Affairs"
      rowLabel="topic rows"
      period={period}
      saved={saved}
      editHref={editHref}
    />
  );
}
