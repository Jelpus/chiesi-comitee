import { getGob360TableRefs } from '@/lib/bigquery/gob360-client';

export const previewTables = {
  business_excellence: {
    close_up: 'chiesi-committee.chiesi_committee_stg.vw_business_excellence_closeup_enriched',
    ddd: 'chiesi-committee.chiesi_committee_stg.vw_business_excellence_pmm_enriched',
    budget_sell_out: 'chiesi-committee.chiesi_committee_stg.vw_business_excellence_budget_sell_out_enriched',
    weekly: 'chiesi-committee.chiesi_committee_stg.vw_business_excellence_weekly_enriched',
    private_sellout: 'chiesi-committee.chiesi_committee_mart.vw_private_sellout',
  },
  human_resources: {
    training: 'chiesi-committee.chiesi_committee_stg.vw_human_resources_training_enriched',
    turnover: 'chiesi-committee.chiesi_committee_stg.vw_human_resources_turnover_enriched'
  },
  commercial_operations: {
    dso: 'chiesi-committee.chiesi_committee_stg.vw_commercial_operations_dso_enriched',
    stocks: 'chiesi-committee.chiesi_committee_stg.vw_commercial_operations_stocks_enriched',
  },
  sales_internal: {
    sales: 'chiesi-committee.chiesi_committee_mart.vw_sales_internal_product_month_active',
    budget: 'chiesi-committee.chiesi_committee_mart.vw_sales_internal_product_month_vs_budget',
  },
  catalog: {
    product_metadata: 'chiesi-committee.chiesi_committee_admin.product_metadata',
    dim_product: 'chiesi-committee.chiesi_committee_core.dim_product',
    ddd: 'chiesi-committee.chiesi_committee_admin.pmm_product_mapping',
    close_up: 'chiesi-committee.chiesi_committee_admin.closeup_product_mapping',
    gob360: 'chiesi-committee.chiesi_committee_admin.gob360_product_mapping',
    budget_sell_out: 'chiesi-committee.chiesi_committee_admin.sell_out_product_mapping',
    targets: 'chiesi-committee.chiesi_committee_admin.kpi_targets',
  },
  public_market: {
    gob360_pc_sales: '',
    gob360_sc_sales: '',
    gob360_pc_structure: '',
    gob360_sc_structure: '',
  },
} as const;

export type PreviewCategory = keyof typeof previewTables;

export type PreviewOption = {
  key: string;
  label: string;
  tableId: string;
};

export function getPreviewOptions(): PreviewOption[] {
  const gob = getGob360TableRefs();
  const tableMap = {
    ...previewTables,
    public_market: {
      gob360_pc_sales: gob.pcSalesTableId,
      gob360_sc_sales: gob.scSalesTableId,
      gob360_pc_structure: gob.pcStructureTableId,
      gob360_sc_structure: gob.scStructureTableId,
    },
  } as const;
  const options: PreviewOption[] = [];
  for (const [category, tables] of Object.entries(tableMap)) {
    for (const [name, tableId] of Object.entries(tables)) {
      options.push({
        key: `${category}.${name}`,
        label: `${category}.${name}`,
        tableId,
      });
    }
  }
  return options.sort((a, b) => a.label.localeCompare(b.label));
}

export function resolvePreviewTableId(optionKey: string): string | null {
  const [category, tableName] = optionKey.split('.');
  if (!category || !tableName) return null;
  if (category === 'public_market') {
    const gob = getGob360TableRefs();
    const publicMap: Record<string, string> = {
      gob360_pc_sales: gob.pcSalesTableId,
      gob360_sc_sales: gob.scSalesTableId,
      gob360_pc_structure: gob.pcStructureTableId,
      gob360_sc_structure: gob.scStructureTableId,
    };
    return publicMap[tableName] ?? null;
  }
  const byCategory = previewTables[category as PreviewCategory];
  if (!byCategory) return null;
  const tableId = (byCategory as Record<string, string>)[tableName];
  return tableId ?? null;
}

export function isPublicMarketOptionKey(optionKey: string) {
  return optionKey.startsWith('public_market.');
}
