import { FormThankYou } from '@/components/forms/form-thank-you';

type PageProps = {
  searchParams: Promise<{
    period?: string;
    saved?: string;
  }>;
};

export default async function MedicalThankYouPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const period = (params.period ?? '').trim();
  const saved = Number(params.saved ?? 0);
  const editHref = `/forms/medical${period ? `?period=${encodeURIComponent(period)}` : ''}`;
  return (
    <FormThankYou
      moduleTitle="Medical"
      rowLabel="KPI rows"
      period={period}
      saved={saved}
      editHref={editHref}
    />
  );
}
