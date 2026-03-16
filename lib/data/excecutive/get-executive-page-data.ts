import { getReportingVersions } from '@/lib/data/versions/get-reporting-versions';
import { getExecutiveCardsFromBigQuery } from './get-executive-from-bigquery';
import type { ExecutivePageData } from '@/types/executive';

type GetExecutivePageDataParams = {
  reportingVersionId?: string;
};

function formatPeriodLabel(periodMonth: string) {
  const date = new Date(`${periodMonth}T00:00:00`);
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export async function getExecutivePageData(
  params: GetExecutivePageDataParams = {},
): Promise<
  ExecutivePageData & {
    availableVersions: {
      reportingVersionId: string;
      periodMonth: string;
      versionName: string;
    }[];
    selectedReportingVersionId: string;
  }
> {
  const availableVersions = await getReportingVersions();

  if (availableVersions.length === 0) {
    return {
      context: {
        periodLabel: '-',
        versionLabel: '-',
      },
      cards: [],
      availableVersions: [],
      selectedReportingVersionId: '',
    };
  }

  const selectedVersion =
    availableVersions.find(
      (item) => item.reportingVersionId === params.reportingVersionId,
    ) ?? availableVersions[0];

  const cards = await getExecutiveCardsFromBigQuery(
    selectedVersion.reportingVersionId,
    selectedVersion.periodMonth,
  );

  return {
    context: {
      periodLabel: formatPeriodLabel(selectedVersion.periodMonth),
      versionLabel: selectedVersion.versionName,
    },
    cards,
    availableVersions,
    selectedReportingVersionId: selectedVersion.reportingVersionId,
  };
}
