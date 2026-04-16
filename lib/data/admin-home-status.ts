import 'server-only';

import { getBigQueryClient } from '@/lib/bigquery/client';
import { getAdminTargets } from '@/lib/data/targets';
import { RA_TOPICS } from '@/lib/data/ra-forms-schema';
import { LEGAL_COMPLIANCE_KPIS } from '@/lib/data/legal-compliance-forms-schema';
import { CLOSING_INPUT_AREAS } from '@/lib/data/closing-inputs-schema';

export type AdminHomeModuleStatusRow = {
  moduleCode: string;
  moduleLabel: string;
  area: string;
  status: string;
  sourceFileName: string | null;
  uploadedAt: string | null;
  isMissing: boolean;
  isPublished: boolean;
};

export type AdminHomeStatusData = {
  periodMonth: string;
  reportingVersionId: string;
  totalExpected: number;
  publishedCount: number;
  missingCount: number;
  pendingCount: number;
  readinessPct: number;
  isReady: boolean;
  rows: AdminHomeModuleStatusRow[];
  forms: {
    formCode: string;
    label: string;
    expected: number;
    completed: number;
    status: 'complete' | 'incomplete' | 'missing';
  }[];
  closingInputs: {
    areaSlug: string;
    label: string;
    expected: number;
    completed: number;
    status: 'complete' | 'incomplete' | 'missing';
  }[];
};

const CLOSING_INPUT_STATUS_AREAS = CLOSING_INPUT_AREAS.filter((area) =>
  [
    'business-excellence',
    'commercial-operations',
    'human-resources',
    'opex',
    'sales-internal',
  ].includes(area.slug),
);

const EXPECTED_MODULES: Array<{ moduleCode: string; moduleLabel: string; area: string }> = [
  { moduleCode: 'sales_internal', moduleLabel: 'Internal Sales', area: 'internal_sales' },
  { moduleCode: 'business_excellence_ddd', moduleLabel: 'Business Excellence - DDD', area: 'business_excellence' },
  { moduleCode: 'business_excellence_budget_sell_out', moduleLabel: 'Business Excellence - Budget Sell Out', area: 'business_excellence' },
  { moduleCode: 'business_excellence_brick_assignment', moduleLabel: 'Business Excellence - Brick Assignment', area: 'business_excellence' },
  { moduleCode: 'business_excellence_iqvia_weekly', moduleLabel: 'Business Excellence - Weekly Tracking', area: 'business_excellence' },
  { moduleCode: 'business_excellence_closeup', moduleLabel: 'Business Excellence - Closeup', area: 'business_excellence' },
  { moduleCode: 'business_excellence_cuotas', moduleLabel: 'Business Excellence - Cuotas', area: 'business_excellence' },
  {
    moduleCode: 'business_excellence_salesforce_fichero_medico',
    moduleLabel: 'Business Excellence - Efectividad Fuerza de Ventas - Fichero Medico',
    area: 'business_excellence',
  },
  {
    moduleCode: 'business_excellence_salesforce_tft',
    moduleLabel: 'Business Excellence - Efectividad Fuerza de Ventas - TFT',
    area: 'business_excellence',
  },
  {
    moduleCode: 'business_excellence_salesforce_interacciones',
    moduleLabel: 'Business Excellence - Efectividad Fuerza de Ventas - Interacciones',
    area: 'business_excellence',
  },
  { moduleCode: 'human_resources_turnover', moduleLabel: 'Human Resources - Turnover', area: 'human_resources' },
  { moduleCode: 'human_resources_training', moduleLabel: 'Human Resources - Training', area: 'human_resources' },
  { moduleCode: 'commercial_operations_dso', moduleLabel: 'Commercial Operations - DSO', area: 'commercial_operations' },
  { moduleCode: 'commercial_operations_government_orders', moduleLabel: 'Commercial Operations - Government Orders', area: 'commercial_operations' },
  { moduleCode: 'commercial_operations_private_orders', moduleLabel: 'Commercial Operations - Private Orders', area: 'commercial_operations' },
  {
    moduleCode: 'commercial_operations_government_contract_progress',
    moduleLabel: 'Commercial Operations - Government Contract Progress',
    area: 'commercial_operations',
  },
  { moduleCode: 'commercial_operations_stocks', moduleLabel: 'Commercial Operations - Stocks', area: 'commercial_operations' },
  { moduleCode: 'commercial_operations_sanctions', moduleLabel: 'Commercial Operations - Sanctions', area: 'commercial_operations' },
  { moduleCode: 'opex_by_cc', moduleLabel: 'OPEX - Opex by CC', area: 'opex' },
];

function computeReadiness(rows: AdminHomeModuleStatusRow[]) {
  const totalExpected = rows.length;
  const publishedCount = rows.filter((row) => row.isPublished).length;
  const missingCount = rows.filter((row) => row.isMissing).length;
  const pendingCount = totalExpected - publishedCount - missingCount;
  const readinessPct = totalExpected > 0 ? (publishedCount / totalExpected) * 100 : 0;
  const isReady = missingCount === 0 && pendingCount === 0;
  return { totalExpected, publishedCount, missingCount, pendingCount, readinessPct, isReady };
}

async function getFormsStatus(params: { reportingVersionId: string; periodMonth: string }) {
  const client = getBigQueryClient();
  const [medicalTargets, [medicalRows], [raRows], [legalRows]] = await Promise.all([
    getAdminTargets('medical', params.reportingVersionId, params.periodMonth),
    client.query({
      query: `
        SELECT
          COUNT(DISTINCT kpi_name) AS completed
        FROM \`chiesi-committee.chiesi_committee_stg.stg_medical_inputs\`
        WHERE period_month = DATE(@periodMonth)
          AND (
            result_value_numeric IS NOT NULL
            OR TRIM(COALESCE(result_value_text, '')) != ''
          )
      `,
      params: { periodMonth: params.periodMonth },
    }),
    client.query({
      query: `
        SELECT
          COUNT(DISTINCT topic) AS completed
        FROM \`chiesi-committee.chiesi_committee_stg.stg_ra_quality_fv_inputs\`
        WHERE period_month = DATE(@periodMonth)
          AND TRIM(COALESCE(result_summary, '')) != ''
      `,
      params: { periodMonth: params.periodMonth },
    }),
    client.query({
      query: `
        SELECT
          COUNT(DISTINCT kpi_name) AS completed
        FROM \`chiesi-committee.chiesi_committee_stg.stg_legal_compliance_inputs\`
        WHERE period_month = DATE(@periodMonth)
          AND objective_count IS NOT NULL
          AND current_count IS NOT NULL
          AND active_count IS NOT NULL
          AND (
            (LOWER(TRIM(kpi_name)) != LOWER(TRIM('# de juicios contra Chiesi')))
            OR (COALESCE(current_count, 0) + COALESCE(active_count, 0) = 0)
            OR (additional_amount_mxn IS NOT NULL)
          )
      `,
      params: { periodMonth: params.periodMonth },
    }),
  ]);

  const medicalExpected = medicalTargets.filter((item) => item.isActive).length;
  const medicalCompleted = Number((medicalRows as Array<Record<string, unknown>>)[0]?.completed ?? 0);
  const raExpected = RA_TOPICS.length;
  const raCompleted = Number((raRows as Array<Record<string, unknown>>)[0]?.completed ?? 0);
  const legalExpected = LEGAL_COMPLIANCE_KPIS.length;
  const legalCompleted = Number((legalRows as Array<Record<string, unknown>>)[0]?.completed ?? 0);

  const toStatus = (expected: number, completed: number): 'complete' | 'incomplete' | 'missing' => {
    if (completed <= 0) return 'missing';
    if (completed >= expected) return 'complete';
    return 'incomplete';
  };

  return [
    {
      formCode: 'medical',
      label: 'Medical Form',
      expected: medicalExpected,
      completed: medicalCompleted,
      status: toStatus(medicalExpected, medicalCompleted),
    },
    {
      formCode: 'ra_quality_fv',
      label: 'RA Form',
      expected: raExpected,
      completed: raCompleted,
      status: toStatus(raExpected, raCompleted),
    },
    {
      formCode: 'legal_compliance',
      label: 'Legal Form',
      expected: legalExpected,
      completed: legalCompleted,
      status: toStatus(legalExpected, legalCompleted),
    },
  ];
}

async function getClosingInputsStatus(params: { reportingVersionId: string; periodMonth: string }) {
  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: `
      WITH latest AS (
        SELECT
          area_slug,
          message_1,
          message_2,
          message_3,
          message_4,
          message_5,
          ROW_NUMBER() OVER (
            PARTITION BY area_slug
            ORDER BY COALESCE(updated_at, created_at) DESC
          ) AS rn
        FROM \`chiesi-committee.chiesi_committee_stg.stg_closing_inputs\`
        WHERE reporting_version_id = @reportingVersionId
          AND period_month = DATE(@periodMonth)
      )
      SELECT
        area_slug,
        message_1,
        message_2,
        message_3,
        message_4,
        message_5
      FROM latest
      WHERE rn = 1
    `,
    params: {
      reportingVersionId: params.reportingVersionId,
      periodMonth: params.periodMonth,
    },
  });

  const rowByArea = new Map(
    (rows as Array<Record<string, unknown>>).map((row) => [String(row.area_slug ?? ''), row]),
  );

  return CLOSING_INPUT_STATUS_AREAS.map((area) => {
    const row = rowByArea.get(area.slug);
    const messages = row
      ? [
          String(row.message_1 ?? '').trim(),
          String(row.message_2 ?? '').trim(),
          String(row.message_3 ?? '').trim(),
          String(row.message_4 ?? '').trim(),
          String(row.message_5 ?? '').trim(),
        ]
      : [];
    const completed = messages.filter((value) => value.length > 0).length;
    const expected = 5;
    const status: 'complete' | 'incomplete' | 'missing' =
      completed <= 0 ? 'missing' : completed >= expected ? 'complete' : 'incomplete';

    return {
      areaSlug: area.slug,
      label: area.label,
      expected,
      completed,
      status,
    };
  });
}

export async function getAdminHomeStatusData(params: {
  reportingVersionId: string;
  periodMonth: string;
}): Promise<AdminHomeStatusData> {
  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: `
      WITH latest AS (
        SELECT
          module_code,
          status,
          source_file_name,
          CAST(uploaded_at AS STRING) AS uploaded_at,
          ROW_NUMBER() OVER (
            PARTITION BY module_code
            ORDER BY uploaded_at DESC
          ) AS rn
        FROM \`chiesi-committee.chiesi_committee_raw.uploads\`
        WHERE reporting_version_id = @reportingVersionId
          AND period_month = DATE(@periodMonth)
      )
      SELECT
        module_code,
        status,
        source_file_name,
        uploaded_at
      FROM latest
      WHERE rn = 1
    `,
    params: {
      reportingVersionId: params.reportingVersionId,
      periodMonth: params.periodMonth,
    },
  });

  const latestByModule = new Map(
    (rows as Array<Record<string, unknown>>).map((row) => [
      String(row.module_code ?? ''),
      {
        status: String(row.status ?? 'missing').toLowerCase(),
        sourceFileName: row.source_file_name == null ? null : String(row.source_file_name),
        uploadedAt: row.uploaded_at == null ? null : String(row.uploaded_at),
      },
    ]),
  );

  const statusRows: AdminHomeModuleStatusRow[] = EXPECTED_MODULES.map((expected) => {
    const current = latestByModule.get(expected.moduleCode);
    const status = current?.status ?? 'missing';
    return {
      moduleCode: expected.moduleCode,
      moduleLabel: expected.moduleLabel,
      area: expected.area,
      status,
      sourceFileName: current?.sourceFileName ?? null,
      uploadedAt: current?.uploadedAt ?? null,
      isMissing: !current,
      isPublished: status === 'published',
    };
  });

  const [forms, closingInputs] = await Promise.all([getFormsStatus(params), getClosingInputsStatus(params)]);
  const formsTotalExpected = forms.reduce((sum, row) => sum + row.expected, 0);
  const formsTotalCompleted = forms.reduce((sum, row) => sum + Math.min(row.completed, row.expected), 0);

  const filesReadiness = computeReadiness(statusRows);
  const weightedReadinessPct =
    filesReadiness.totalExpected + formsTotalExpected > 0
      ? ((filesReadiness.publishedCount + formsTotalCompleted) / (filesReadiness.totalExpected + formsTotalExpected)) * 100
      : 0;
  const formsReady = forms.every((row) => row.status === 'complete');

  return {
    reportingVersionId: params.reportingVersionId,
    periodMonth: params.periodMonth,
    ...filesReadiness,
    readinessPct: weightedReadinessPct,
    isReady: filesReadiness.isReady && formsReady,
    rows: statusRows,
    forms,
    closingInputs,
  };
}

export async function saveAdminHomeStatusSnapshot(params: {
  reportingVersionId: string;
  periodMonth: string;
  createdBy: string;
}) {
  const data = await getAdminHomeStatusData({
    reportingVersionId: params.reportingVersionId,
    periodMonth: params.periodMonth,
  });

  const client = getBigQueryClient();
  await client.query({
    query: `
      CREATE TABLE IF NOT EXISTS \`chiesi-committee.chiesi_committee_admin.home_status_snapshots\` (
        snapshot_id STRING,
        reporting_version_id STRING,
        period_month DATE,
        status STRING,
        readiness_pct NUMERIC,
        total_expected INT64,
        published_count INT64,
        missing_count INT64,
        pending_count INT64,
        details_json JSON,
        created_at TIMESTAMP,
        created_by STRING
      )
    `,
  });

  await client.query({
    query: `
      INSERT INTO \`chiesi-committee.chiesi_committee_admin.home_status_snapshots\`
      (
        snapshot_id,
        reporting_version_id,
        period_month,
        status,
        readiness_pct,
        total_expected,
        published_count,
        missing_count,
        pending_count,
        details_json,
        created_at,
        created_by
      )
      VALUES
      (
        GENERATE_UUID(),
        @reportingVersionId,
        DATE(@periodMonth),
        @status,
        CAST(@readinessPct AS NUMERIC),
        @totalExpected,
        @publishedCount,
        @missingCount,
        @pendingCount,
        PARSE_JSON(@detailsJson),
        CURRENT_TIMESTAMP(),
        @createdBy
      )
    `,
    params: {
      reportingVersionId: params.reportingVersionId,
      periodMonth: params.periodMonth,
      status: data.isReady ? 'ready' : 'incomplete',
      readinessPct: data.readinessPct.toFixed(6),
      totalExpected: data.totalExpected,
      publishedCount: data.publishedCount,
      missingCount: data.missingCount,
      pendingCount: data.pendingCount,
      detailsJson: JSON.stringify({
        files: data.rows,
        forms: data.forms,
        closingInputs: data.closingInputs,
      }),
      createdBy: params.createdBy,
    },
  });

  return { ok: true as const, status: data.isReady ? 'ready' : 'incomplete' };
}
