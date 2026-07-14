import 'server-only';
import { getBigQueryClient } from '@/lib/bigquery/client';
import { normalizeSourcePeriodOffset, type SourcePeriodOffsetMonths } from '@/lib/uploads/source-period-policy';

const DIM_MODULE_TABLE = 'chiesi-committee.chiesi_committee_core.dim_module';

export type ModuleAreaCode =
  | 'sales_internal'
  | 'business_excellence'
  | 'commercial_operations'
  | 'human_resources'
  | 'medical'
  | 'opex'
  | 'ra_quality_fv'
  | 'legal_compliance'
  | 'other';

export type ModuleRow = {
  moduleCode: string;
  moduleName: string;
  areaCode: ModuleAreaCode;
  moduleType: string | null;
  sourcePeriodOffsetMonths: SourcePeriodOffsetMonths;
  ownerName: string | null;
  emailOwner: string | null;
  displayOrder: number;
  isActive: boolean;
  notes: string | null;
  createdAt: string | null;
  createdBy: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type UpsertModuleInput = {
  moduleCode: string;
  moduleName: string;
  areaCode: string;
  moduleType?: string;
  sourcePeriodOffsetMonths?: number;
  ownerName?: string;
  emailOwner?: string;
  displayOrder?: number;
  isActive?: boolean;
  notes?: string;
  updatedBy?: string;
};

export const defaultModules: Array<{
  moduleCode: string;
  moduleName: string;
  areaCode: ModuleAreaCode;
  displayOrder: number;
  sourcePeriodOffsetMonths?: SourcePeriodOffsetMonths;
}> = [
  { moduleCode: 'sales_internal', moduleName: 'Sales Internal', areaCode: 'sales_internal', displayOrder: 10 },
  { moduleCode: 'business_excellence_ddd', moduleName: 'Business Excellence - DDD', areaCode: 'business_excellence', displayOrder: 110, sourcePeriodOffsetMonths: 1 },
  {
    moduleCode: 'business_excellence_budget_sell_out',
    moduleName: 'Business Excellence - Budget Sell Out',
    areaCode: 'business_excellence',
    displayOrder: 120,
    sourcePeriodOffsetMonths: 1,
  },
  {
    moduleCode: 'business_excellence_brick_assignment',
    moduleName: 'Business Excellence - Brick Assignment',
    areaCode: 'business_excellence',
    displayOrder: 130,
  },
  {
    moduleCode: 'business_excellence_iqvia_weekly',
    moduleName: 'Business Excellence - Weekly Tracking',
    areaCode: 'business_excellence',
    displayOrder: 140,
  },
  { moduleCode: 'business_excellence_closeup', moduleName: 'Business Excellence - Closeup', areaCode: 'business_excellence', displayOrder: 150 },
  { moduleCode: 'business_excellence_cuotas', moduleName: 'Business Excellence - Cuotas', areaCode: 'business_excellence', displayOrder: 160 },
  {
    moduleCode: 'business_excellence_salesforce_fichero_medico',
    moduleName: 'Business Excellence - Efectividad Fuerza de Ventas - Fichero Medico',
    areaCode: 'business_excellence',
    displayOrder: 170,
  },
  {
    moduleCode: 'business_excellence_salesforce_tft',
    moduleName: 'Business Excellence - Efectividad Fuerza de Ventas - TFT',
    areaCode: 'business_excellence',
    displayOrder: 180,
  },
  {
    moduleCode: 'business_excellence_salesforce_interacciones',
    moduleName: 'Business Excellence - Efectividad Fuerza de Ventas - Interacciones',
    areaCode: 'business_excellence',
    displayOrder: 190,
  },
  {
    moduleCode: 'business_excellence_standard_days',
    moduleName: 'Business Excellence - Standard Days',
    areaCode: 'business_excellence',
    displayOrder: 195,
  },
  {
    moduleCode: 'business_excellence_recompra_lexicomp',
    moduleName: 'Business Excellence - Recompra Lexicomp',
    areaCode: 'business_excellence',
    displayOrder: 200,
  },
  { moduleCode: 'human_resources_turnover', moduleName: 'Human Resources - Turnover', areaCode: 'human_resources', displayOrder: 210 },
  { moduleCode: 'human_resources_training', moduleName: 'Human Resources - Training', areaCode: 'human_resources', displayOrder: 220 },
  { moduleCode: 'human_resources_open_vacancy', moduleName: 'Human Resources - Open Vacancy', areaCode: 'human_resources', displayOrder: 230 },
  { moduleCode: 'commercial_operations_dso', moduleName: 'Commercial Operations - DSO', areaCode: 'commercial_operations', displayOrder: 310 },
  { moduleCode: 'commercial_operations_aging', moduleName: 'Commercial Operations - Aging', areaCode: 'commercial_operations', displayOrder: 315 },
  {
    moduleCode: 'commercial_operations_government_orders',
    moduleName: 'Commercial Operations - Government Orders',
    areaCode: 'commercial_operations',
    displayOrder: 320,
  },
  {
    moduleCode: 'commercial_operations_private_orders',
    moduleName: 'Commercial Operations - Private Orders',
    areaCode: 'commercial_operations',
    displayOrder: 330,
  },
  {
    moduleCode: 'commercial_operations_government_contract_progress',
    moduleName: 'Commercial Operations - Government Contract Progress',
    areaCode: 'commercial_operations',
    displayOrder: 340,
  },
  { moduleCode: 'commercial_operations_stocks', moduleName: 'Commercial Operations - Stocks', areaCode: 'commercial_operations', displayOrder: 350 },
  { moduleCode: 'commercial_operations_incidencias', moduleName: 'Commercial Operations - Incidencias', areaCode: 'commercial_operations', displayOrder: 355 },
  { moduleCode: 'commercial_operations_sanctions', moduleName: 'Commercial Operations - Sanctions', areaCode: 'commercial_operations', displayOrder: 360 },
  { moduleCode: 'opex_by_cc', moduleName: 'OPEX by CC', areaCode: 'opex', displayOrder: 410 },
];

function normalizeModuleCode(value: string) {
  return value.trim().toLowerCase();
}

function normalizeAreaCode(value: string): ModuleAreaCode {
  const normalized = value.trim().toLowerCase();
  const allowed = new Set<ModuleAreaCode>([
    'sales_internal',
    'business_excellence',
    'commercial_operations',
    'human_resources',
    'medical',
    'opex',
    'ra_quality_fv',
    'legal_compliance',
    'other',
  ]);
  return allowed.has(normalized as ModuleAreaCode) ? (normalized as ModuleAreaCode) : 'other';
}

function rowToModule(row: Record<string, unknown>): ModuleRow {
  return {
    moduleCode: String(row.module_code ?? ''),
    moduleName: String(row.module_name ?? ''),
    areaCode: normalizeAreaCode(String(row.area_code ?? 'other')),
    ownerName: row.owner_name == null ? null : String(row.owner_name),
    moduleType: row.module_type == null ? null : String(row.module_type),
    sourcePeriodOffsetMonths: normalizeSourcePeriodOffset(row.source_period_offset_months),
    emailOwner: row.email_owner == null ? null : String(row.email_owner),
    displayOrder: Number(row.display_order ?? 999),
    isActive: Boolean(row.is_active),
    notes: row.notes == null ? null : String(row.notes),
    createdAt: row.created_at == null ? null : String(row.created_at),
    createdBy: row.created_by == null ? null : String(row.created_by),
    updatedAt: row.updated_at == null ? null : String(row.updated_at),
    updatedBy: row.updated_by == null ? null : String(row.updated_by),
  };
}

export async function getModules(): Promise<ModuleRow[]> {
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
      ORDER BY area_code, display_order, module_name
    `,
  });

  return (rows as Array<Record<string, unknown>>).map(rowToModule);
}

export async function getActiveModuleOptions() {
  const modules = await getModules();
  return modules
    .filter((module) => module.isActive)
    .map((module) => ({
      value: module.moduleCode,
      label: module.moduleName,
      areaCode: module.areaCode,
      sourcePeriodOffsetMonths: module.sourcePeriodOffsetMonths,
    }));
}

export async function upsertModule(input: UpsertModuleInput) {
  const moduleCode = normalizeModuleCode(input.moduleCode);
  const moduleName = input.moduleName.trim();
  const areaCode = normalizeAreaCode(input.areaCode);
  const updatedBy = (input.updatedBy ?? '').trim() || 'admin_panel';
  const displayOrder = Number.isFinite(input.displayOrder) ? Number(input.displayOrder) : 999;
  const sourcePeriodOffsetMonths = normalizeSourcePeriodOffset(input.sourcePeriodOffsetMonths);

  if (!moduleCode) throw new Error('module_code is required.');
  if (!moduleName) throw new Error('module_name is required.');

  const client = getBigQueryClient();
  await client.query({
    query: `
      MERGE \`${DIM_MODULE_TABLE}\` AS target
      USING (
        SELECT
          @moduleCode AS module_code,
          @moduleName AS module_name,
          @areaCode AS area_code,
          NULLIF(@moduleType, '') AS module_type,
          @sourcePeriodOffsetMonths AS source_period_offset_months,
          NULLIF(@ownerName, '') AS owner_name,
          NULLIF(@emailOwner, '') AS email_owner,
          @displayOrder AS display_order,
          @isActive AS is_active,
          NULLIF(@notes, '') AS notes,
          @updatedBy AS updated_by
      ) AS source
      ON target.module_code = source.module_code
      WHEN MATCHED THEN UPDATE SET
        module_name = source.module_name,
        area_code = source.area_code,
        module_type = source.module_type,
        source_period_offset_months = source.source_period_offset_months,
        owner_name = source.owner_name,
        email_owner = source.email_owner,
        display_order = source.display_order,
        is_active = source.is_active,
        notes = source.notes,
        updated_at = CURRENT_TIMESTAMP(),
        updated_by = source.updated_by
      WHEN NOT MATCHED THEN INSERT (
        module_code,
        module_name,
        area_code,
        module_type,
        source_period_offset_months,
        owner_name,
        email_owner,
        display_order,
        is_active,
        notes,
        created_at,
        created_by,
        updated_at,
        updated_by
      )
      VALUES (
        source.module_code,
        source.module_name,
        source.area_code,
        source.module_type,
        source.source_period_offset_months,
        source.owner_name,
        source.email_owner,
        source.display_order,
        source.is_active,
        source.notes,
        CURRENT_TIMESTAMP(),
        source.updated_by,
        CURRENT_TIMESTAMP(),
        source.updated_by
      )
    `,
    params: {
      moduleCode,
      moduleName,
      areaCode,
      moduleType: input.moduleType?.trim() ?? '',
      sourcePeriodOffsetMonths,
      ownerName: input.ownerName?.trim() ?? '',
      emailOwner: input.emailOwner?.trim() ?? '',
      displayOrder,
      isActive: input.isActive ?? true,
      notes: input.notes?.trim() ?? '',
      updatedBy,
    },
  });

  return { ok: true as const };
}

export async function setModuleActive(moduleCode: string, isActive: boolean, updatedBy = 'admin_panel') {
  const safeModuleCode = normalizeModuleCode(moduleCode);
  if (!safeModuleCode) throw new Error('module_code is required.');

  const client = getBigQueryClient();
  await client.query({
    query: `
      UPDATE \`${DIM_MODULE_TABLE}\`
      SET
        is_active = @isActive,
        updated_at = CURRENT_TIMESTAMP(),
        updated_by = @updatedBy
      WHERE module_code = @moduleCode
    `,
    params: { moduleCode: safeModuleCode, isActive, updatedBy },
  });

  return { ok: true as const };
}

export async function seedDefaultModules(updatedBy = 'admin_panel') {
  for (const moduleItem of defaultModules) {
    await upsertModule({
      ...moduleItem,
      isActive: true,
      updatedBy,
    });
  }

  return { ok: true as const, count: defaultModules.length };
}
