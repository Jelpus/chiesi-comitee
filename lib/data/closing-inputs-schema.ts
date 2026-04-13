import 'server-only';

export type ClosingInputAreaMeta = {
  slug: string;
  areaCode: string;
  label: string;
  executivePath: string;
};

export const CLOSING_INPUT_AREAS: ClosingInputAreaMeta[] = [
  {
    slug: 'business-excellence',
    areaCode: 'business_excellence',
    label: 'Business Excellence',
    executivePath: '/executive/business-excellence',
  },
  {
    slug: 'commercial-operations',
    areaCode: 'commercial_operations',
    label: 'Commercial Operations',
    executivePath: '/executive/commercial-operations',
  },
  {
    slug: 'human-resources',
    areaCode: 'human_resources',
    label: 'Human Resources',
    executivePath: '/executive/human-resources',
  },
  {
    slug: 'opex',
    areaCode: 'opex',
    label: 'Opex',
    executivePath: '/executive/opex',
  },
  {
    slug: 'sales-internal',
    areaCode: 'sales_internal',
    label: 'Sales Internal',
    executivePath: '/executive/sales-internal',
  },
  {
    slug: 'legal-compliance',
    areaCode: 'legal_compliance',
    label: 'Legal & Compliance',
    executivePath: '/executive/legal-compliance',
  },
  {
    slug: 'medical',
    areaCode: 'medical',
    label: 'Medical',
    executivePath: '/executive/medical',
  },
  {
    slug: 'ra-quality-fv',
    areaCode: 'ra_quality_fv',
    label: 'RA - Quality - FV',
    executivePath: '/executive/ra-quality-fv',
  },
];

export function getClosingInputAreaMeta(areaSlug: string) {
  return CLOSING_INPUT_AREAS.find((item) => item.slug === areaSlug) ?? null;
}

