'use server';

import 'server-only';
import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import {
  createUploadRecord,
  createUploadRecordFromStorage,
  normalizeExistingUpload,
  processUpload,
  publishUpload,
} from '@/app/admin/uploads/actions';
import { getBigQueryClient } from '@/lib/bigquery/client';
import { expectedPreviousMonth } from '@/lib/data/prepare';
import { sendSendGridEmail } from '@/lib/email/sendgrid';

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

type PrepareIncidentResult = {
  ok: boolean;
  message: string;
};

const PREPARE_INCIDENT_RECIPIENT = 'guillermo@jelpus.com';

function normalizeDddSource(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formText(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
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
  revalidatePath('/admin');
  revalidatePath('/admin/uploads');
  revalidatePath('/admin/uploads/logs');
  revalidatePath('/executive');
}

async function createReuseUploadRecord(params: {
  originalUploadId: string;
  moduleCode: string;
  reportingVersionId: string;
  periodMonth: string;
  dddSource: string;
  confirmedBy: string;
}) {
  const client = getBigQueryClient();
  const uploadId = randomUUID();

  const [rows] = await client.query({
    query: `
      SELECT
        upload_id,
        module_code,
        COALESCE(ddd_source, '') AS ddd_source,
        source_file_name,
        storage_path,
        source_sheets_json,
        selected_sheet_name,
        selected_header_row,
        CAST(COALESCE(source_as_of_month, period_month) AS STRING) AS source_as_of_month,
        opex_jan_previous_col,
        opex_jan_budget_col,
        opex_jan_current_col,
        status
      FROM \`${UPLOADS_TABLE}\`
      WHERE upload_id = @originalUploadId
      LIMIT 1
    `,
    params: { originalUploadId: params.originalUploadId },
  });

  const original = (rows as Array<Record<string, unknown>>)[0];
  if (!original) {
    throw new Error('No se encontro el upload original para reutilizar.');
  }

  const originalModuleCode = String(original.module_code ?? '').trim();
  const originalDddSource = normalizeDddSource(original.ddd_source);
  const originalStatus = String(original.status ?? '').trim();
  if (originalModuleCode !== params.moduleCode) {
    throw new Error('El archivo original no corresponde al modulo seleccionado.');
  }
  if (originalDddSource !== params.dddSource) {
    throw new Error('El archivo original no corresponde a la variante seleccionada.');
  }
  if (originalStatus !== 'published') {
    throw new Error('Solo se puede reutilizar un archivo publicado.');
  }

  await client.query({
    query: `
      INSERT INTO \`${UPLOADS_TABLE}\`
      (
        upload_id,
        module_code,
        period_month,
        uploaded_by,
        uploaded_at,
        source_file_name,
        storage_path,
        status,
        rows_total,
        rows_valid,
        rows_error,
        reporting_version_id,
        source_sheets_json,
        selected_sheet_name,
        selected_header_row,
        source_as_of_month,
        ddd_source,
        opex_jan_previous_col,
        opex_jan_budget_col,
        opex_jan_current_col
      )
      SELECT
        @uploadId,
        module_code,
        DATE(@periodMonth),
        @confirmedBy,
        CURRENT_TIMESTAMP(),
        source_file_name,
        storage_path,
        'uploaded',
        0,
        0,
        0,
        @reportingVersionId,
        source_sheets_json,
        selected_sheet_name,
        selected_header_row,
        COALESCE(source_as_of_month, period_month),
        ddd_source,
        opex_jan_previous_col,
        opex_jan_budget_col,
        opex_jan_current_col
      FROM \`${UPLOADS_TABLE}\`
      WHERE upload_id = @originalUploadId
    `,
    params: {
      uploadId,
      originalUploadId: params.originalUploadId,
      periodMonth: params.periodMonth,
      reportingVersionId: params.reportingVersionId,
      confirmedBy: params.confirmedBy,
    },
  });

  return uploadId;
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
    const directUploadId = String(formData.get('uploadId') ?? '').trim();
    const directStoragePath = String(formData.get('storagePath') ?? '').trim();
    const directSourceFileName = String(formData.get('sourceFileName') ?? '').trim();
    const directSourceSheetsJson = String(formData.get('sourceSheetsJson') ?? '').trim();

    if (directUploadId && directStoragePath && directSourceFileName) {
      uploadFormData.set('uploadId', directUploadId);
      uploadFormData.set('storagePath', directStoragePath);
      uploadFormData.set('sourceFileName', directSourceFileName);
      uploadFormData.set('sourceSheetsJson', directSourceSheetsJson);
    } else if (file) {
      uploadFormData.set('file', file);
    }

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

    const created =
      directUploadId && directStoragePath && directSourceFileName
        ? await createUploadRecordFromStorage(uploadFormData)
        : await createUploadRecord(uploadFormData);
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

    const uploadId = await createReuseUploadRecord({
      originalUploadId,
      moduleCode,
      reportingVersionId,
      periodMonth: version.periodMonth,
      dddSource,
      confirmedBy,
    });

    await processUpload(uploadId);
    await normalizeExistingUpload(uploadId);
    await publishUpload(uploadId);

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
          notes = @notes
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
          @notes
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
        notes: `Archivo reutilizado desde /prepare. Nuevo upload publicado: ${uploadId}`,
      },
    });

    const result = await getUploadResult(uploadId);
    revalidatePrepare(areaCode);
    return {
      ok: true,
      status: result.status,
      uploadId,
      rowsTotal: result.rowsTotal,
      rowsValid: result.rowsValid,
      rowsError: result.rowsError,
      message: 'Archivo anterior reutilizado, validado y publicado para esta version.',
      errors: result.lastErrorMessage ? [result.lastErrorMessage] : [],
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

export async function reportPrepareIncident(formData: FormData): Promise<PrepareIncidentResult> {
  const reporterName = formText(formData, 'reporterName');
  const reporterEmail = formText(formData, 'reporterEmail');
  const incidentDetail = formText(formData, 'incidentDetail');
  const areaCode = formText(formData, 'areaCode');
  const areaLabel = formText(formData, 'areaLabel');
  const moduleCode = formText(formData, 'moduleCode');
  const moduleName = formText(formData, 'moduleName');
  const variantLabel = formText(formData, 'variantLabel');
  const periodMonth = formText(formData, 'periodMonth');
  const reportingVersionId = formText(formData, 'reportingVersionId');
  const versionName = formText(formData, 'versionName');
  const currentUploadId = formText(formData, 'currentUploadId');
  const currentUploadStatus = formText(formData, 'currentUploadStatus');
  const currentSourceFileName = formText(formData, 'currentSourceFileName');
  const latestUploadId = formText(formData, 'latestUploadId');
  const latestSourceFileName = formText(formData, 'latestSourceFileName');

  try {
    if (!reporterName) throw new Error('Indica tu nombre.');
    if (!reporterEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reporterEmail)) {
      throw new Error('Indica un email valido.');
    }
    if (incidentDetail.length < 10) {
      throw new Error('Describe la incidencia con un poco mas de detalle.');
    }
    if (!areaCode || !moduleCode || !reportingVersionId) {
      throw new Error('Faltan datos de contexto para reportar la incidencia.');
    }

    const rows = [
      ['Nombre', reporterName],
      ['Email', reporterEmail],
      ['Area', areaLabel ? `${areaLabel} (${areaCode})` : areaCode],
      ['Modulo', moduleName ? `${moduleName} (${moduleCode})` : moduleCode],
      ['Variante', variantLabel || 'N/A'],
      ['Periodo', periodMonth || 'N/A'],
      ['Version', versionName ? `${versionName} (${reportingVersionId})` : reportingVersionId],
      ['Upload actual', currentUploadId || 'N/A'],
      ['Estado actual', currentUploadStatus || 'N/A'],
      ['Archivo actual', currentSourceFileName || 'N/A'],
      ['Upload referencia', latestUploadId || 'N/A'],
      ['Archivo referencia', latestSourceFileName || 'N/A'],
    ];

    const contextHtml = rows
      .map(
        ([label, value]) => `
          <tr>
            <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;color:#475569;font-weight:700;width:180px;">${escapeHtml(label)}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;color:#0f172a;">${escapeHtml(value)}</td>
          </tr>
        `,
      )
      .join('');

    await sendSendGridEmail({
      to: PREPARE_INCIDENT_RECIPIENT,
      subject: `Incidencia Prepare - ${moduleCode} - ${periodMonth || reportingVersionId}`,
      html: `
        <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5;">
          <h1 style="margin:0 0 12px;font-size:22px;">Incidencia reportada desde Prepare</h1>
          <p style="margin:0 0 18px;color:#475569;">Un usuario reporto una incidencia durante la preparacion de archivos.</p>
          <h2 style="margin:22px 0 8px;font-size:16px;">Detalle de la incidencia</h2>
          <div style="white-space:pre-wrap;border:1px solid #e2e8f0;border-radius:12px;padding:14px;background:#f8fafc;">${escapeHtml(incidentDetail)}</div>
          <h2 style="margin:22px 0 8px;font-size:16px;">Contexto automatico</h2>
          <table style="border-collapse:collapse;width:100%;font-size:14px;">${contextHtml}</table>
        </div>
      `,
    });

    return { ok: true, message: 'Incidencia enviada correctamente.' };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'No se pudo enviar la incidencia.',
    };
  }
}
