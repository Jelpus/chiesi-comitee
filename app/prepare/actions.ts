'use server';

import 'server-only';
import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import {
  createUploadRecord,
  normalizeExistingUpload,
  processUpload,
  publishUpload,
} from '@/app/admin/uploads/actions';
import { getBigQueryClient } from '@/lib/bigquery/client';
import { expectedPreviousMonth } from '@/lib/data/prepare';

const REPORTING_VERSIONS_TABLE = 'chiesi-committee.chiesi_committee_admin.reporting_versions';
const DIM_MODULE_TABLE = 'chiesi-committee.chiesi_committee_core.dim_module';
const UPLOADS_TABLE = 'chiesi-committee.chiesi_committee_raw.uploads';
const REUSE_TABLE = 'chiesi-committee.chiesi_committee_admin.prepare_reuse_confirmations';

type PrepareActionResult = {
  ok: boolean;
  status: string;
  uploadId?: string;
  rowsTotal?: number;
  rowsValid?: number;
  rowsError?: number;
  message: string;
  errors?: string[];
};

function normalizeDddSource(value: FormDataEntryValue | string | null | undefined) {
  return String(value ?? '').trim().toLowerCase();
}

function isDddLikeModule(moduleCode: string) {
  return (
    moduleCode === 'business_excellence_ddd' ||
    moduleCode === 'business_excellence_pmm' ||
    moduleCode === 'pmm' ||
    moduleCode === 'ddd' ||
    moduleCode === 'business_excellence_budget_sell_out' ||
    moduleCode === 'business_excellence_sell_out' ||
    moduleCode === 'sell_out'
  );
}

async function getReportingVersion(reportingVersionId: string) {
  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: `
      SELECT
        reporting_version_id,
        CAST(period_month AS STRING) AS period_month,
        version_name,
        status
      FROM \`${REPORTING_VERSIONS_TABLE}\`
      WHERE reporting_version_id = @reportingVersionId
      LIMIT 1
    `,
    params: { reportingVersionId },
  });
  const row = (rows as Array<Record<string, unknown>>)[0];
  if (!row) throw new Error('No se encontró la versión seleccionada.');
  return {
    reportingVersionId: String(row.reporting_version_id ?? ''),
    periodMonth: String(row.period_month ?? ''),
    versionName: String(row.version_name ?? ''),
    status: String(row.status ?? 'draft'),
  };
}

async function validateModuleArea(moduleCode: string, areaCode: string) {
  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: `
      SELECT module_code
      FROM \`${DIM_MODULE_TABLE}\`
      WHERE module_code = @moduleCode
        AND area_code = @areaCode
        AND COALESCE(is_active, TRUE) = TRUE
      LIMIT 1
    `,
    params: { moduleCode, areaCode },
  });
  if ((rows as Array<Record<string, unknown>>).length === 0) {
    throw new Error('El módulo no pertenece al área seleccionada o no está activo.');
  }
}

async function getUploadResult(uploadId: string) {
  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: `
      SELECT
        upload_id,
        status,
        rows_total,
        rows_valid,
        rows_error,
        last_error_message
      FROM \`${UPLOADS_TABLE}\`
      WHERE upload_id = @uploadId
      LIMIT 1
    `,
    params: { uploadId },
  });
  const row = (rows as Array<Record<string, unknown>>)[0];
  return {
    status: String(row?.status ?? 'unknown'),
    rowsTotal: Number(row?.rows_total ?? 0),
    rowsValid: Number(row?.rows_valid ?? 0),
    rowsError: Number(row?.rows_error ?? 0),
    lastErrorMessage: row?.last_error_message == null ? null : String(row.last_error_message),
  };
}

function revalidatePrepare(areaCode: string) {
  revalidatePath('/prepare');
  revalidatePath(`/prepare/${areaCode}`);
  revalidatePath('/admin/uploads');
  revalidatePath('/admin/uploads/logs');
  revalidatePath('/executive');
}

export async function prepareUploadAndPublish(formData: FormData): Promise<PrepareActionResult> {
  const moduleCode = String(formData.get('moduleCode') ?? '').trim();
  const areaCode = String(formData.get('areaCode') ?? '').trim();
  const reportingVersionId = String(formData.get('reportingVersionId') ?? '').trim();
  const sourceAsOfMonth = String(formData.get('sourceAsOfMonth') ?? '').trim();
  const dddSource = normalizeDddSource(formData.get('dddSource'));
  const confirmProductionVersion = String(formData.get('confirmProductionVersion') ?? '') === 'true';
  const confirmSourceAsOfMonth = String(formData.get('confirmSourceAsOfMonth') ?? '') === 'true';

  try {
    if (!moduleCode || !areaCode || !reportingVersionId) {
      throw new Error('Faltan datos obligatorios para preparar la carga.');
    }
    if (!sourceAsOfMonth) {
      throw new Error('Indica a qué cierre de mes corresponde la información del archivo.');
    }

    await validateModuleArea(moduleCode, areaCode);
    const version = await getReportingVersion(reportingVersionId);

    if ((version.status === 'ready_to_show' || version.status === 'closed') && !confirmProductionVersion) {
      throw new Error('Confirma explícitamente que quieres actualizar una versión que ya está en productivo.');
    }

    if (isDddLikeModule(moduleCode)) {
      if (!dddSource) throw new Error('Selecciona la fuente o variante del archivo.');
      const expected = expectedPreviousMonth(version.periodMonth);
      if (expected && sourceAsOfMonth !== expected && !confirmSourceAsOfMonth) {
        throw new Error('La fecha del cierre informado no coincide con el mes anterior esperado. Confirma para continuar.');
      }
    }

    const uploadFormData = new FormData();
    const file = formData.get('file');
    if (file) uploadFormData.set('file', file);
    uploadFormData.set('moduleCode', moduleCode);
    uploadFormData.set('reportingVersionId', reportingVersionId);
    uploadFormData.set('periodMonth', version.periodMonth);
    uploadFormData.set('sourceAsOfMonth', sourceAsOfMonth);
    uploadFormData.set('dddSource', dddSource);
    uploadFormData.set('selectedSheetName', String(formData.get('selectedSheetName') ?? ''));
    uploadFormData.set('headerRow', String(formData.get('selectedHeaderRow') ?? '1'));
    uploadFormData.set('opexJanPreviousCol', String(formData.get('opexJanPreviousCol') ?? ''));
    uploadFormData.set('opexJanBudgetCol', String(formData.get('opexJanBudgetCol') ?? ''));
    uploadFormData.set('opexJanCurrentCol', String(formData.get('opexJanCurrentCol') ?? ''));

    const created = await createUploadRecord(uploadFormData);
    const uploadId = String(created.uploadId ?? '');

    await processUpload(uploadId);
    await normalizeExistingUpload(uploadId);
    await publishUpload(uploadId);
    const result = await getUploadResult(uploadId);
    revalidatePrepare(areaCode);

    return {
      ok: true,
      status: result.status,
      uploadId,
      rowsTotal: result.rowsTotal,
      rowsValid: result.rowsValid,
      rowsError: result.rowsError,
      message: 'Archivo cargado, validado y publicado correctamente.',
      errors: result.lastErrorMessage ? [result.lastErrorMessage] : [],
    };
  } catch (error) {
    return {
      ok: false,
      status: 'error',
      message: error instanceof Error ? error.message : 'No se pudo completar la carga.',
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

export async function confirmReusePreviousUpload(formData: FormData): Promise<PrepareActionResult> {
  const moduleCode = String(formData.get('moduleCode') ?? '').trim();
  const areaCode = String(formData.get('areaCode') ?? '').trim();
  const reportingVersionId = String(formData.get('reportingVersionId') ?? '').trim();
  const originalUploadId = String(formData.get('originalUploadId') ?? '').trim();
  const dddSource = normalizeDddSource(formData.get('dddSource'));
  const confirmedBy = String(formData.get('confirmedBy') ?? 'prepare_user').trim() || 'prepare_user';
  const confirmProductionVersion = String(formData.get('confirmProductionVersion') ?? '') === 'true';

  try {
    if (!moduleCode || !areaCode || !reportingVersionId || !originalUploadId) {
      throw new Error('Faltan datos para confirmar la reutilización del archivo.');
    }

    await validateModuleArea(moduleCode, areaCode);
    const version = await getReportingVersion(reportingVersionId);
    if ((version.status === 'ready_to_show' || version.status === 'closed') && !confirmProductionVersion) {
      throw new Error('Confirma explícitamente que quieres actualizar una versión que ya está en productivo.');
    }

    const client = getBigQueryClient();
    await client.query({
      query: `
        MERGE \`${REUSE_TABLE}\` AS target
        USING (
          SELECT
            @reportingVersionId AS reporting_version_id,
            @moduleCode AS module_code,
            @dddSource AS ddd_source
        ) AS source
        ON target.reporting_version_id = source.reporting_version_id
          AND target.module_code = source.module_code
          AND COALESCE(target.ddd_source, '') = COALESCE(source.ddd_source, '')
        WHEN MATCHED THEN UPDATE SET
          original_upload_id = @originalUploadId,
          confirmed_by = @confirmedBy,
          confirmed_at = CURRENT_TIMESTAMP(),
          notes = 'Archivo reutilizado desde /prepare'
        WHEN NOT MATCHED THEN INSERT (
          confirmation_id,
          reporting_version_id,
          period_month,
          area_code,
          module_code,
          ddd_source,
          original_upload_id,
          confirmed_by,
          confirmed_at,
          notes
        )
        VALUES (
          @confirmationId,
          @reportingVersionId,
          DATE(@periodMonth),
          @areaCode,
          @moduleCode,
          NULLIF(@dddSource, ''),
          @originalUploadId,
          @confirmedBy,
          CURRENT_TIMESTAMP(),
          'Archivo reutilizado desde /prepare'
        )
      `,
      params: {
        confirmationId: `reuse_${randomUUID()}`,
        reportingVersionId,
        periodMonth: version.periodMonth,
        areaCode,
        moduleCode,
        dddSource,
        originalUploadId,
        confirmedBy,
      },
    });

    revalidatePrepare(areaCode);
    return {
      ok: true,
      status: 'reused',
      uploadId: originalUploadId,
      message: 'Archivo anterior confirmado para esta versión.',
    };
  } catch (error) {
    return {
      ok: false,
      status: 'error',
      message: error instanceof Error ? error.message : 'No se pudo confirmar la reutilización.',
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}
