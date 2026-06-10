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
const PREPARE_UPLOAD_NOTIFICATION_RECIPIENT = 'guillermo@jelpus.com';

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

async function getPrepareUploadNotificationContext(uploadId: string) {
  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: `
      SELECT
        u.upload_id,
        CAST(u.period_month AS STRING) AS period_month,
        u.module_code,
        COALESCE(m.module_name, u.module_code) AS module_name,
        u.source_file_name,
        u.status
      FROM \`${UPLOADS_TABLE}\` AS u
      LEFT JOIN \`${DIM_MODULE_TABLE}\` AS m
        ON m.module_code = u.module_code
      WHERE u.upload_id = @uploadId
      LIMIT 1
    `,
    params: { uploadId },
  });
  const row = (rows as Array<Record<string, unknown>>)[0];
  if (!row) return null;
  return {
    uploadId: String(row.upload_id ?? uploadId),
    periodMonth: String(row.period_month ?? ''),
    moduleCode: String(row.module_code ?? ''),
    moduleName: String(row.module_name ?? row.module_code ?? ''),
    sourceFileName: String(row.source_file_name ?? ''),
    databaseStatus: String(row.status ?? ''),
  };
}

async function notifyPrepareUploadStatus(uploadId: string, statusLabel: 'Uploaded' | 'Published') {
  try {
    const context = await getPrepareUploadNotificationContext(uploadId);
    if (!context) return;

    const period = context.periodMonth || 'N/A';
    const fileName = context.sourceFileName || 'N/A';
    const moduleName = context.moduleName || context.moduleCode || 'N/A';
    const outcomeLabel = statusLabel === 'Uploaded' ? 'exitoso' : 'publicado';

    await sendSendGridEmail({
      to: PREPARE_UPLOAD_NOTIFICATION_RECIPIENT,
      subject: `Prepare upload ${outcomeLabel}: ${moduleName} - ${period}`,
      html: `
        <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5;">
          <h1 style="margin:0 0 12px;font-size:20px;">Prepare upload ${escapeHtml(outcomeLabel)}</h1>
          <p style="margin:0 0 16px;">
            Para el periodo <strong>${escapeHtml(period)}</strong>, se ha cargado el archivo
            <strong>${escapeHtml(fileName)}</strong> del modulo <strong>${escapeHtml(moduleName)}</strong>.
            Resultado: <strong>${escapeHtml(outcomeLabel)}</strong>.
          </p>
          <table style="border-collapse:collapse;width:100%;font-size:14px;">
            <tr><td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#475569;">Resultado</td><td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(outcomeLabel)}</td></tr>
            <tr><td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#475569;">Upload ID</td><td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(context.uploadId)}</td></tr>
            <tr><td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#475569;">Modulo code</td><td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(context.moduleCode)}</td></tr>
            <tr><td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#475569;">Status BQ</td><td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(context.databaseStatus || 'N/A')}</td></tr>
          </table>
        </div>
      `,
    });
  } catch (error) {
    console.warn('[prepare] upload status email failed', {
      uploadId,
      statusLabel,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function getPrepareSourceFileName(formData: FormData) {
  const directSourceFileName = String(formData.get('sourceFileName') ?? '').trim();
  if (directSourceFileName) return directSourceFileName;

  const file = formData.get('file');
  if (file instanceof File && file.name) return file.name;

  return '';
}

async function notifyPrepareUploadFailure(formData: FormData, message: string) {
  try {
    const moduleCode = formText(formData, 'moduleCode') || 'N/A';
    const areaCode = formText(formData, 'areaCode') || 'N/A';
    const reportingVersionId = formText(formData, 'reportingVersionId') || 'N/A';
    const uploadId = formText(formData, 'uploadId') || 'N/A';
    const storagePath = formText(formData, 'storagePath') || 'N/A';
    const sourceFileName = getPrepareSourceFileName(formData) || 'N/A';
    const sourceAsOfMonth = formText(formData, 'sourceAsOfMonth') || 'N/A';
    const dddSource = formText(formData, 'dddSource') || 'N/A';
    const selectedSheetName = formText(formData, 'selectedSheetName') || 'N/A';
    const selectedHeaderRow =
      formText(formData, 'selectedHeaderRow') ||
      formText(formData, 'headerRow') ||
      'N/A';

    const rows = [
      ['Resultado', 'No exitoso'],
      ['Area', areaCode],
      ['Modulo', moduleCode],
      ['Version', reportingVersionId],
      ['Archivo', sourceFileName],
      ['Upload ID', uploadId],
      ['Storage path', storagePath],
      ['Data as of', sourceAsOfMonth],
      ['Variante/Fuente', dddSource],
      ['Hoja', selectedSheetName],
      ['Fila encabezados', selectedHeaderRow],
      ['Error', message],
    ];

    const contextHtml = rows
      .map(
        ([label, value]) => `
          <tr>
            <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#475569;width:160px;">${escapeHtml(label)}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;color:#0f172a;">${escapeHtml(value)}</td>
          </tr>
        `,
      )
      .join('');

    await sendSendGridEmail({
      to: PREPARE_UPLOAD_NOTIFICATION_RECIPIENT,
      subject: `Prepare upload no exitoso: ${moduleCode} - ${sourceFileName}`,
      html: `
        <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5;">
          <h1 style="margin:0 0 12px;font-size:20px;">Prepare upload no exitoso</h1>
          <p style="margin:0 0 16px;color:#475569;">Un usuario intento cargar un archivo desde Prepare y no se pudo completar el upload.</p>
          <table style="border-collapse:collapse;width:100%;font-size:14px;">${contextHtml}</table>
        </div>
      `,
    });
  } catch (error) {
    console.warn('[prepare] upload failure email failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function validatePrepareUploadRequest(formData: FormData) {
  const moduleCode = String(formData.get('moduleCode') ?? '').trim();
  const areaCode = String(formData.get('areaCode') ?? '').trim();
  const reportingVersionId = String(formData.get('reportingVersionId') ?? '').trim();
  const sourceAsOfMonth = String(formData.get('sourceAsOfMonth') ?? '').trim();
  const dddSource = normalizeDddSource(formData.get('dddSource'));
  const confirmProductionVersion = String(formData.get('confirmProductionVersion') ?? '') === 'true';
  const confirmSourceAsOfMonth = String(formData.get('confirmSourceAsOfMonth') ?? '') === 'true';

  if (!moduleCode || !areaCode || !reportingVersionId) {
    throw new Error('Faltan datos obligatorios para preparar la carga.');
  }
  if (!sourceAsOfMonth) {
    throw new Error('Indica a que cierre de mes corresponde la informacion del archivo.');
  }

  await validateModuleArea(moduleCode, areaCode);
  const version = await getReportingVersion(reportingVersionId);

  if ((version.status === 'ready_to_show' || version.status === 'closed') && !confirmProductionVersion) {
    throw new Error('Confirma explicitamente que quieres actualizar una version que ya esta en productivo.');
  }

  if (isDddLikeModule(moduleCode)) {
    if (!dddSource) throw new Error('Selecciona la fuente o variante del archivo.');
    const expected = expectedPreviousMonth(version.periodMonth);
    if (expected && sourceAsOfMonth !== expected && !confirmSourceAsOfMonth) {
      throw new Error('La fecha del cierre informado no coincide con el mes anterior esperado. Confirma para continuar.');
    }
  }

  return {
    moduleCode,
    areaCode,
    reportingVersionId,
    sourceAsOfMonth,
    dddSource,
    version,
  };
}

function buildUploadFormData(params: {
  source: FormData;
  moduleCode: string;
  reportingVersionId: string;
  periodMonth: string;
  sourceAsOfMonth: string;
  dddSource: string;
}) {
  const uploadFormData = new FormData();
  const file = params.source.get('file');
  const directUploadId = String(params.source.get('uploadId') ?? '').trim();
  const directStoragePath = String(params.source.get('storagePath') ?? '').trim();
  const directSourceFileName = String(params.source.get('sourceFileName') ?? '').trim();
  const directSourceSheetsJson = String(params.source.get('sourceSheetsJson') ?? '').trim();

  if (directUploadId && directStoragePath && directSourceFileName) {
    uploadFormData.set('uploadId', directUploadId);
    uploadFormData.set('storagePath', directStoragePath);
    uploadFormData.set('sourceFileName', directSourceFileName);
    uploadFormData.set('sourceSheetsJson', directSourceSheetsJson);
  } else if (file) {
    uploadFormData.set('file', file);
  }

  uploadFormData.set('moduleCode', params.moduleCode);
  uploadFormData.set('reportingVersionId', params.reportingVersionId);
  uploadFormData.set('periodMonth', params.periodMonth);
  uploadFormData.set('sourceAsOfMonth', params.sourceAsOfMonth);
  uploadFormData.set('dddSource', params.dddSource);
  uploadFormData.set('selectedSheetName', String(params.source.get('selectedSheetName') ?? ''));
  uploadFormData.set('headerRow', String(params.source.get('selectedHeaderRow') ?? '1'));
  uploadFormData.set('opexJanPreviousCol', String(params.source.get('opexJanPreviousCol') ?? ''));
  uploadFormData.set('opexJanBudgetCol', String(params.source.get('opexJanBudgetCol') ?? ''));
  uploadFormData.set('opexJanCurrentCol', String(params.source.get('opexJanCurrentCol') ?? ''));

  return {
    uploadFormData,
    useStorageRecord: Boolean(directUploadId && directStoragePath && directSourceFileName),
  };
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
    await notifyPrepareUploadStatus(uploadId, 'Published');
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

export async function prepareCreateUploadRecord(formData: FormData): Promise<PrepareActionResult> {
  try {
    const request = await validatePrepareUploadRequest(formData);
    const { uploadFormData, useStorageRecord } = buildUploadFormData({
      source: formData,
      moduleCode: request.moduleCode,
      reportingVersionId: request.reportingVersionId,
      periodMonth: request.version.periodMonth,
      sourceAsOfMonth: request.sourceAsOfMonth,
      dddSource: request.dddSource,
    });

    const created =
      useStorageRecord
        ? await createUploadRecordFromStorage(uploadFormData)
        : await createUploadRecord(uploadFormData);
    const uploadId = String(created.uploadId ?? '');
    revalidatePrepare(request.areaCode);
    await notifyPrepareUploadStatus(uploadId, 'Uploaded');

    return {
      ok: true,
      status: 'uploaded',
      uploadId,
      message: `Gracias. El archivo fue recibido correctamente. Upload ${uploadId}.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo registrar la carga.';
    await notifyPrepareUploadFailure(formData, message);
    return {
      ok: false,
      status: 'error',
      message,
      errors: [message],
    };
  }
}

export async function prepareProcessUpload(uploadId: string): Promise<PrepareActionResult> {
  try {
    const processResult = await processUpload(uploadId);
    const result = await getUploadResult(uploadId);
    return {
      ok: true,
      status: result.status,
      uploadId,
      rowsTotal: result.rowsTotal,
      rowsValid: result.rowsValid,
      rowsError: result.rowsError,
      message: `Archivo procesado. Filas revisadas en muestra: ${processResult.sampleRowsChecked}.`,
      errors: result.lastErrorMessage ? [result.lastErrorMessage] : [],
    };
  } catch (error) {
    return {
      ok: false,
      status: 'error',
      uploadId,
      message: error instanceof Error ? error.message : 'No se pudo procesar la carga.',
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

export async function prepareNormalizeUpload(uploadId: string): Promise<PrepareActionResult> {
  try {
    await normalizeExistingUpload(uploadId);
    const result = await getUploadResult(uploadId);
    return {
      ok: true,
      status: result.status,
      uploadId,
      rowsTotal: result.rowsTotal,
      rowsValid: result.rowsValid,
      rowsError: result.rowsError,
      message: 'Archivo normalizado correctamente.',
      errors: result.lastErrorMessage ? [result.lastErrorMessage] : [],
    };
  } catch (error) {
    return {
      ok: false,
      status: 'error',
      uploadId,
      message: error instanceof Error ? error.message : 'No se pudo normalizar la carga.',
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

export async function preparePublishUpload(uploadId: string, areaCode: string): Promise<PrepareActionResult> {
  try {
    await publishUpload(uploadId);
    const result = await getUploadResult(uploadId);
    await notifyPrepareUploadStatus(uploadId, 'Published');
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
      uploadId,
      message: error instanceof Error ? error.message : 'No se pudo publicar la carga.',
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
        notes: `Archivo reutilizado desde /prepare. Nuevo upload registrado pendiente de completar desde Admin: ${uploadId}`,
      },
    });

    const result = await getUploadResult(uploadId);
    await notifyPrepareUploadStatus(uploadId, 'Uploaded');
    revalidatePrepare(areaCode);
    return {
      ok: true,
      status: result.status,
      uploadId,
      rowsTotal: result.rowsTotal,
      rowsValid: result.rowsValid,
      rowsError: result.rowsError,
      message: 'Gracias. El archivo anterior quedo registrado para esta version. Lo continuaremos desde Admin / Uploads.',
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

export async function notifyPrepareUploadReceived(uploadId: string): Promise<PrepareActionResult> {
  try {
    const normalizedUploadId = String(uploadId ?? '').trim();
    if (!normalizedUploadId) {
      throw new Error('uploadId es obligatorio para notificar la carga.');
    }

    const result = await getUploadResult(normalizedUploadId);
    await notifyPrepareUploadStatus(normalizedUploadId, 'Uploaded');
    return {
      ok: true,
      status: result.status,
      uploadId: normalizedUploadId,
      rowsTotal: result.rowsTotal,
      rowsValid: result.rowsValid,
      rowsError: result.rowsError,
      message: 'Notificacion de carga enviada.',
      errors: result.lastErrorMessage ? [result.lastErrorMessage] : [],
    };
  } catch (error) {
    return {
      ok: false,
      status: 'error',
      uploadId,
      message: error instanceof Error ? error.message : 'No se pudo enviar la notificacion de carga.',
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
