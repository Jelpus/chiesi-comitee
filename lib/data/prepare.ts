import 'server-only';
import { getBigQueryClient } from '@/lib/bigquery/client';
import type { ModuleAreaCode, ModuleRow } from '@/lib/data/modules';
import { normalizeSourcePeriodOffset } from '@/lib/uploads/source-period-policy';

const REPORTING_VERSIONS_TABLE = 'chiesi-committee.chiesi_committee_admin.reporting_versions';
const DIM_MODULE_TABLE = 'chiesi-committee.chiesi_committee_core.dim_module';
const UPLOADS_TABLE = 'chiesi-committee.chiesi_committee_raw.uploads';
const REUSE_TABLE = 'chiesi-committee.chiesi_committee_admin.prepare_reuse_confirmations';

export type PrepareReportingVersionStatus = 'draft' | 'ready_to_show' | 'closed';

export type PrepareReportingVersion = {
  reportingVersionId: string;
  periodMonth: string;
  versionName: string;
  versionNumber: number;
  status: PrepareReportingVersionStatus;
  createdAt: string;
};

export type PrepareUploadRow = {
  uploadId: string;
  moduleCode: string;
  dddSource: string;
  reportingVersionId: string;
  periodMonth: string;
  sourceAsOfMonth: string;
  uploadedBy: string;
  uploadedAt: string;
  sourceFileName: string;
  status: string;
  rowsTotal: number;
  rowsValid: number;
  rowsError: number;
  selectedSheetName: string;
  selectedHeaderRow: number;
  lastErrorMessage: string | null;
  opexJanPreviousCol: number | null;
  opexJanBudgetCol: number | null;
  opexJanCurrentCol: number | null;
};

export type PrepareRequirement = {
  key: string;
  module: ModuleRow;
  dddSource: string;
  variantLabel: string | null;
  latestUpload: PrepareUploadRow | null;
  currentUpload: PrepareUploadRow | null;
  reuseConfirmation: PrepareReuseConfirmation | null;
  inferredDefaults: PrepareUploadDefaults;
  status: PrepareModuleStatus;
  reusable: boolean;
};

export type PrepareModuleStatus =
  | 'pending'
  | 'uploaded'
  | 'validated'
  | 'published'
  | 'error'
  | 'reused'
  | 'requires_confirmation';

export type PrepareUploadDefaults = {
  selectedSheetName: string;
  selectedHeaderRow: number;
  sourceAsOfMonth: string;
  dddSource: string;
  opexJanPreviousCol: number | null;
  opexJanBudgetCol: number | null;
  opexJanCurrentCol: number | null;
};

export type PrepareReuseConfirmation = {
  confirmationId: string;
  reportingVersionId: string;
  periodMonth: string;
  areaCode: string;
  moduleCode: string;
  dddSource: string;
  originalUploadId: string;
  confirmedBy: string;
  confirmedAt: string;
};

export type PrepareAreaSummary = {
  areaCode: string;
  areaLabel: string;
  totalModules: number;
  uploadedModules: number;
  pendingModules: number;
  errorModules: number;
  reusedModules: number;
  progressPct: number;
};

export type PrepareAreaData = {
  areaCode: string;
  areaLabel: string;
  versions: PrepareReportingVersion[];
  selectedVersion: PrepareReportingVersion | null;
  defaultDraftVersion: PrepareReportingVersion | null;
  requirements: PrepareRequirement[];
  summary: PrepareAreaSummary;
};

export type PrepareHomeData = {
  versions: PrepareReportingVersion[];
  selectedVersion: PrepareReportingVersion | null;
  defaultDraftVersion: PrepareReportingVersion | null;
  areas: PrepareAreaSummary[];
};

const reusableModuleCodes = new Set([
  'business_excellence_brick_assignment',
  'business_excellence_budget_sell_out',
]);

const explicitDddSourceRequirements: Record<string, string[]> = {
  business_excellence_budget_sell_out: ['gobierno', 'privado'],
};

const CLIENT_TEXT_LIMIT = 1200;

function limitClientText(value: unknown, limit = CLIENT_TEXT_LIMIT) {
  if (value == null) return null;
  const text = String(value);
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}...`;
}

function normalizeStatus(value: unknown): PrepareReportingVersionStatus {
  if (value === 'ready_to_show' || value === 'closed') return value;
  return 'draft';
}

function normalizeDddSource(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function areaLabel(areaCode: string) {
  const labels: Record<string, string> = {
    sales_internal: 'Sales Internal',
    business_excellence: 'Business Excellence',
    commercial_operations: 'Commercial Operations',
    human_resources: 'Human Resources',
    medical: 'Medical',
    opex: 'OPEX',
    ra_quality_fv: 'RA - Quality - FV',
    legal_compliance: 'Legal & Compliance',
    other: 'Otros',
  };
  return labels[areaCode] ?? areaCode;
}

function toModuleRow(row: Record<string, unknown>): ModuleRow {
  return {
    moduleCode: String(row.module_code ?? ''),
    moduleName: String(row.module_name ?? ''),
    areaCode: String(row.area_code ?? 'other') as ModuleAreaCode,
    moduleType: row.module_type == null ? null : String(row.module_type),
    sourcePeriodOffsetMonths: normalizeSourcePeriodOffset(row.source_period_offset_months),
    ownerName: row.owner_name == null ? null : String(row.owner_name),
    emailOwner: row.email_owner == null ? null : String(row.email_owner),
    displayOrder: Number(row.display_order ?? 999),
    isActive: Boolean(row.is_active),
    notes: limitClientText(row.notes, 500),
    createdAt: row.created_at == null ? null : String(row.created_at),
    createdBy: row.created_by == null ? null : String(row.created_by),
    updatedAt: row.updated_at == null ? null : String(row.updated_at),
    updatedBy: row.updated_by == null ? null : String(row.updated_by),
  };
}

function toVersion(row: Record<string, unknown>): PrepareReportingVersion {
  return {
    reportingVersionId: String(row.reporting_version_id ?? ''),
    periodMonth: String(row.period_month ?? ''),
    versionName: String(row.version_name ?? ''),
    versionNumber: Number(row.version_number ?? 0),
    status: normalizeStatus(row.status),
    createdAt: String(row.created_at ?? ''),
  };
}

function toUpload(row: Record<string, unknown> | undefined): PrepareUploadRow | null {
  if (!row?.upload_id) return null;
  return {
    uploadId: String(row.upload_id ?? ''),
    moduleCode: String(row.module_code ?? ''),
    dddSource: normalizeDddSource(row.ddd_source),
    reportingVersionId: String(row.reporting_version_id ?? ''),
    periodMonth: String(row.period_month ?? ''),
    sourceAsOfMonth: String(row.source_as_of_month ?? row.period_month ?? ''),
    uploadedBy: String(row.uploaded_by ?? ''),
    uploadedAt: String(row.uploaded_at ?? ''),
    sourceFileName: String(row.source_file_name ?? ''),
    status: String(row.status ?? ''),
    rowsTotal: Number(row.rows_total ?? 0),
    rowsValid: Number(row.rows_valid ?? 0),
    rowsError: Number(row.rows_error ?? 0),
    selectedSheetName: String(row.selected_sheet_name ?? ''),
    selectedHeaderRow: Number(row.selected_header_row ?? 1),
    lastErrorMessage: limitClientText(row.last_error_message),
    opexJanPreviousCol: row.opex_jan_previous_col == null ? null : Number(row.opex_jan_previous_col),
    opexJanBudgetCol: row.opex_jan_budget_col == null ? null : Number(row.opex_jan_budget_col),
    opexJanCurrentCol: row.opex_jan_current_col == null ? null : Number(row.opex_jan_current_col),
  };
}

function uploadDefaults(upload: PrepareUploadRow | null, selectedVersion: PrepareReportingVersion | null, dddSource: string): PrepareUploadDefaults {
  return {
    selectedSheetName: upload?.selectedSheetName ?? '',
    selectedHeaderRow: upload?.selectedHeaderRow ?? 1,
    sourceAsOfMonth: upload?.sourceAsOfMonth || selectedVersion?.periodMonth || '',
    dddSource: dddSource || upload?.dddSource || '',
    opexJanPreviousCol: upload?.opexJanPreviousCol ?? null,
    opexJanBudgetCol: upload?.opexJanBudgetCol ?? null,
    opexJanCurrentCol: upload?.opexJanCurrentCol ?? null,
  };
}

function resolveRequirementStatus(currentUpload: PrepareUploadRow | null, reuse: PrepareReuseConfirmation | null, reusable: boolean): PrepareModuleStatus {
  if (reuse) return 'reused';
  if (!currentUpload) return reusable ? 'requires_confirmation' : 'pending';
  if (currentUpload.status === 'published') return 'published';
  if (currentUpload.status === 'normalized') return 'validated';
  if (currentUpload.status === 'error' || currentUpload.rowsError > 0) return 'error';
  return 'uploaded';
}

function buildSummary(areaCode: string, requirements: PrepareRequirement[]): PrepareAreaSummary {
  const completed = requirements.filter((item) => (
    item.status === 'uploaded' ||
    item.status === 'validated' ||
    item.status === 'published' ||
    item.status === 'reused'
  )).length;
  const errorModules = requirements.filter((item) => item.status === 'error').length;
  const reusedModules = requirements.filter((item) => item.status === 'reused').length;
  const totalModules = requirements.length;
  return {
    areaCode,
    areaLabel: areaLabel(areaCode),
    totalModules,
    uploadedModules: completed,
    pendingModules: Math.max(totalModules - completed - errorModules, 0),
    errorModules,
    reusedModules,
    progressPct: totalModules > 0 ? Math.round((completed / totalModules) * 100) : 0,
  };
}

export async function getReportingVersionsForPrepare(): Promise<PrepareReportingVersion[]> {
  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: `
      SELECT
        reporting_version_id,
        CAST(period_month AS STRING) AS period_month,
        version_name,
        version_number,
        status,
        CAST(created_at AS STRING) AS created_at
      FROM \`${REPORTING_VERSIONS_TABLE}\`
      ORDER BY period_month DESC, version_number DESC, created_at DESC
    `,
  });
  return (rows as Array<Record<string, unknown>>).map(toVersion);
}

export async function getDefaultDraftReportingVersion() {
  const versions = await getReportingVersionsForPrepare();
  return versions.find((version) => version.status === 'draft') ?? null;
}

export async function getPrepareModules(areaCode?: string): Promise<ModuleRow[]> {
  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: `
      SELECT
        module_code,
        module_name,
        COALESCE(area_code, 'other') AS area_code,
        module_type,
        COALESCE(source_period_offset_months, 0) AS source_period_offset_months,
        owner_name,
        email_owner,
        COALESCE(display_order, 999) AS display_order,
        COALESCE(is_active, TRUE) AS is_active,
        notes,
        CAST(created_at AS STRING) AS created_at,
        created_by,
        CAST(updated_at AS STRING) AS updated_at,
        updated_by
      FROM \`${DIM_MODULE_TABLE}\`
      WHERE COALESCE(is_active, TRUE) = TRUE
        ${areaCode ? 'AND area_code = @areaCode' : ''}
      ORDER BY area_code, display_order, module_code
    `,
    params: areaCode ? { areaCode } : undefined,
  });
  return (rows as Array<Record<string, unknown>>).map(toModuleRow);
}

async function getUploadsForVersion(reportingVersionId: string, moduleCodes?: string[]): Promise<PrepareUploadRow[]> {
  if (!reportingVersionId) return [];
  if (moduleCodes && moduleCodes.length === 0) return [];
  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: `
      SELECT
        upload_id,
        module_code,
        COALESCE(ddd_source, '') AS ddd_source,
        reporting_version_id,
        CAST(period_month AS STRING) AS period_month,
        CAST(source_as_of_month AS STRING) AS source_as_of_month,
        uploaded_by,
        CAST(uploaded_at AS STRING) AS uploaded_at,
        source_file_name,
        status,
        rows_total,
        rows_valid,
        rows_error,
        selected_sheet_name,
        selected_header_row,
        last_error_message,
        opex_jan_previous_col,
        opex_jan_budget_col,
        opex_jan_current_col
      FROM \`${UPLOADS_TABLE}\`
      WHERE reporting_version_id = @reportingVersionId
        ${moduleCodes ? 'AND module_code IN UNNEST(@moduleCodes)' : ''}
      QUALIFY ROW_NUMBER() OVER (
        PARTITION BY module_code, COALESCE(ddd_source, '')
        ORDER BY uploaded_at DESC
      ) = 1
    `,
    params: moduleCodes ? { reportingVersionId, moduleCodes } : { reportingVersionId },
  });
  return (rows as Array<Record<string, unknown>>).map((row) => toUpload(row)).filter((row): row is PrepareUploadRow => Boolean(row));
}

async function getLatestPublishedUploads(moduleCodes: string[]): Promise<PrepareUploadRow[]> {
  if (moduleCodes.length === 0) return [];
  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: `
      SELECT
        upload_id,
        module_code,
        COALESCE(ddd_source, '') AS ddd_source,
        reporting_version_id,
        CAST(period_month AS STRING) AS period_month,
        CAST(source_as_of_month AS STRING) AS source_as_of_month,
        uploaded_by,
        CAST(uploaded_at AS STRING) AS uploaded_at,
        source_file_name,
        status,
        rows_total,
        rows_valid,
        rows_error,
        selected_sheet_name,
        selected_header_row,
        last_error_message,
        opex_jan_previous_col,
        opex_jan_budget_col,
        opex_jan_current_col
      FROM \`${UPLOADS_TABLE}\`
      WHERE module_code IN UNNEST(@moduleCodes)
        AND status = 'published'
      QUALIFY ROW_NUMBER() OVER (
        PARTITION BY module_code, COALESCE(ddd_source, '')
        ORDER BY uploaded_at DESC
      ) = 1
    `,
    params: { moduleCodes },
  });
  return (rows as Array<Record<string, unknown>>).map((row) => toUpload(row)).filter((row): row is PrepareUploadRow => Boolean(row));
}

async function getReuseConfirmations(reportingVersionId: string): Promise<PrepareReuseConfirmation[]> {
  if (!reportingVersionId) return [];
  const client = getBigQueryClient();
  try {
    const [rows] = await client.query({
      query: `
        SELECT
          confirmation_id,
          reporting_version_id,
          CAST(period_month AS STRING) AS period_month,
          area_code,
          module_code,
          COALESCE(ddd_source, '') AS ddd_source,
          original_upload_id,
          confirmed_by,
          CAST(confirmed_at AS STRING) AS confirmed_at
        FROM \`${REUSE_TABLE}\`
        WHERE reporting_version_id = @reportingVersionId
      `,
      params: { reportingVersionId },
    });
    return (rows as Array<Record<string, unknown>>).map((row) => ({
      confirmationId: String(row.confirmation_id ?? ''),
      reportingVersionId: String(row.reporting_version_id ?? ''),
      periodMonth: String(row.period_month ?? ''),
      areaCode: String(row.area_code ?? ''),
      moduleCode: String(row.module_code ?? ''),
      dddSource: normalizeDddSource(row.ddd_source),
      originalUploadId: String(row.original_upload_id ?? ''),
      confirmedBy: String(row.confirmed_by ?? ''),
      confirmedAt: String(row.confirmed_at ?? ''),
    }));
  } catch (error) {
    if (error instanceof Error && error.message.includes('prepare_reuse_confirmations')) return [];
    throw error;
  }
}

function requirementDddSources(moduleCode: string, latestUploads: PrepareUploadRow[]) {
  const explicit = explicitDddSourceRequirements[moduleCode];
  if (explicit) return explicit;
  const historical = latestUploads
    .filter((upload) => upload.moduleCode === moduleCode)
    .map((upload) => upload.dddSource)
    .filter(Boolean);
  return historical.length > 0 ? [...new Set(historical)] : [''];
}

function buildRequirements(params: {
  modules: ModuleRow[];
  currentUploads: PrepareUploadRow[];
  latestUploads: PrepareUploadRow[];
  reuseConfirmations: PrepareReuseConfirmation[];
  selectedVersion: PrepareReportingVersion | null;
}) {
  const currentByKey = new Map(params.currentUploads.map((upload) => [`${upload.moduleCode}::${upload.dddSource}`, upload]));
  const latestByKey = new Map(params.latestUploads.map((upload) => [`${upload.moduleCode}::${upload.dddSource}`, upload]));
  const reuseByKey = new Map(params.reuseConfirmations.map((reuse) => [`${reuse.moduleCode}::${reuse.dddSource}`, reuse]));

  return params.modules.flatMap((module) => {
    const sources = requirementDddSources(module.moduleCode, params.latestUploads);
    return sources.map((dddSource) => {
      const key = `${module.moduleCode}::${dddSource}`;
      const latestUpload = latestByKey.get(key) ?? latestByKey.get(`${module.moduleCode}::`) ?? null;
      const currentUpload = currentByKey.get(key) ?? null;
      const reuseConfirmation = reuseByKey.get(key) ?? null;
      const reusable = reusableModuleCodes.has(module.moduleCode);
      const status = resolveRequirementStatus(currentUpload, reuseConfirmation, reusable);
      return {
        key,
        module,
        dddSource,
        variantLabel: dddSource ? dddSource.charAt(0).toUpperCase() + dddSource.slice(1) : null,
        latestUpload,
        currentUpload,
        reuseConfirmation,
        inferredDefaults: uploadDefaults(latestUpload, params.selectedVersion, dddSource),
        status,
        reusable,
      };
    });
  });
}

function selectVersion(versions: PrepareReportingVersion[], reportingVersionId?: string) {
  const defaultDraft = versions.find((version) => version.status === 'draft') ?? null;
  const selected = reportingVersionId
    ? versions.find((version) => version.reportingVersionId === reportingVersionId) ?? null
    : defaultDraft;
  return { selectedVersion: selected, defaultDraftVersion: defaultDraft };
}

export async function getPrepareAreaData(areaCode: string, reportingVersionId?: string): Promise<PrepareAreaData> {
  const versions = await getReportingVersionsForPrepare();
  const { selectedVersion, defaultDraftVersion } = selectVersion(versions, reportingVersionId);
  const modules = await getPrepareModules(areaCode);
  const moduleCodes = modules.map((moduleItem) => moduleItem.moduleCode);
  const [currentUploads, latestUploads, reuseConfirmations] = await Promise.all([
    selectedVersion ? getUploadsForVersion(selectedVersion.reportingVersionId, moduleCodes) : Promise.resolve([]),
    getLatestPublishedUploads(moduleCodes),
    selectedVersion ? getReuseConfirmations(selectedVersion.reportingVersionId) : Promise.resolve([]),
  ]);
  const requirements = buildRequirements({ modules, currentUploads, latestUploads, reuseConfirmations, selectedVersion });
  return {
    areaCode,
    areaLabel: areaLabel(areaCode),
    versions,
    selectedVersion,
    defaultDraftVersion,
    requirements,
    summary: buildSummary(areaCode, requirements),
  };
}

export async function getPrepareHomeData(reportingVersionId?: string): Promise<PrepareHomeData> {
  const versions = await getReportingVersionsForPrepare();
  const { selectedVersion, defaultDraftVersion } = selectVersion(versions, reportingVersionId);
  const modules = await getPrepareModules();
  const moduleCodes = modules.map((module) => module.moduleCode);
  const [currentUploads, latestUploads, reuseConfirmations] = await Promise.all([
    selectedVersion ? getUploadsForVersion(selectedVersion.reportingVersionId) : Promise.resolve([]),
    getLatestPublishedUploads(moduleCodes),
    selectedVersion ? getReuseConfirmations(selectedVersion.reportingVersionId) : Promise.resolve([]),
  ]);
  const byArea = new Map<string, ModuleRow[]>();
  for (const moduleItem of modules) {
    const list = byArea.get(moduleItem.areaCode) ?? [];
    list.push(moduleItem);
    byArea.set(moduleItem.areaCode, list);
  }

  const areas = [...byArea.entries()].map(([areaCode, areaModules]) => {
    const requirements = buildRequirements({
      modules: areaModules,
      currentUploads,
      latestUploads,
      reuseConfirmations,
      selectedVersion,
    });
    return buildSummary(areaCode, requirements);
  });

  return {
    versions,
    selectedVersion,
    defaultDraftVersion,
    areas: areas.sort((a, b) => a.areaLabel.localeCompare(b.areaLabel)),
  };
}

export async function inferUploadDefaultsFromPreviousUpload(moduleCode: string, dddSource = '') {
  const uploads = await getLatestPublishedUploads([moduleCode]);
  const normalizedSource = normalizeDddSource(dddSource);
  const match = uploads.find((upload) => upload.dddSource === normalizedSource) ?? uploads[0] ?? null;
  return uploadDefaults(match, null, normalizedSource);
}

export async function getModuleUploadStatus(reportingVersionId: string, moduleCode: string, dddSource = '') {
  const uploads = await getUploadsForVersion(reportingVersionId);
  const normalizedSource = normalizeDddSource(dddSource);
  return uploads.find((upload) => upload.moduleCode === moduleCode && upload.dddSource === normalizedSource) ?? null;
}

export function prepareAreaLabel(areaCode: string) {
  return areaLabel(areaCode);
}

export function isReusablePrepareModule(moduleCode: string) {
  return reusableModuleCodes.has(moduleCode);
}

export function expectedPreviousMonth(periodMonth: string) {
  const date = new Date(`${periodMonth}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  date.setUTCMonth(date.getUTCMonth() - 1);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}
