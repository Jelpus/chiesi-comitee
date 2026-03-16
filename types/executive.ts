import type { SemanticStatus } from '@/lib/status/status-styles';

export type ExecutiveCardItem = {
  module: string;
  kpi: string;
  actual: string;
  target: string;
  variance: string;
  status: SemanticStatus;
  kpiSignals?: Array<{
    label: string;
    coveragePct: number | null;
    tone: 'green' | 'light-green' | 'yellow' | 'red' | 'neutral';
  }>;
  detailHref: string | null;
};

export type ExecutiveHeaderContext = {
  periodLabel: string;
  versionLabel: string;
};

export type ExecutivePageData = {
  context: ExecutiveHeaderContext;
  cards: ExecutiveCardItem[];
};
