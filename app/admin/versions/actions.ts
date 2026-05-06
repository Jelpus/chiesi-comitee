'use server';

import 'server-only';
import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { getBigQueryClient } from '@/lib/bigquery/client';
import {
  sendRequestInfoEmail,
  sendRequestInfoSummaryEmail,
  type RequestInfoRecipient,
} from '@/lib/email/request-info';

const REPORTING_VERSIONS_TABLE = 'chiesi-committee.chiesi_committee_admin.reporting_versions';
const DIM_MODULE_TABLE = 'chiesi-committee.chiesi_committee_core.dim_module';

function normalizePeriodMonth(value: string) {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}$/.test(trimmed)) {
    throw new Error('Period must use YYYY-MM format.');
  }
  return `${trimmed}-01`;
}

function buildVersionId(periodMonth: string) {
  const normalized = periodMonth.replace('-', '');
  return `rv_${normalized}_${randomUUID().slice(0, 8)}`;
}

function revalidateVersionPaths() {
  revalidatePath('/admin/versions');
  revalidatePath('/admin/uploads');
  revalidatePath('/executive');
}

function asDateOnly(date: Date) {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

function addBusinessDays(date: Date, businessDays: number) {
  const result = asDateOnly(date);
  let added = 0;

  while (added < businessDays) {
    result.setUTCDate(result.getUTCDate() + 1);
    const day = result.getUTCDay();
    if (day !== 0 && day !== 6) added += 1;
  }

  return result;
}

function formatSpanishDate(date: Date) {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function formatPeriodLabel(periodMonth: string) {
  const date = new Date(`${periodMonth}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return periodMonth;
  return new Intl.DateTimeFormat('es-ES', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function normalizeEmail(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

async function getRequestInfoRecipients(): Promise<RequestInfoRecipient[]> {
  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: `
      SELECT
        NULLIF(TRIM(owner_name), '') AS owner_name,
        LOWER(TRIM(email_owner)) AS email_owner,
        ARRAY_AGG(DISTINCT area_code IGNORE NULLS ORDER BY area_code) AS area_codes
      FROM \`${DIM_MODULE_TABLE}\`
      WHERE COALESCE(is_active, TRUE) = TRUE
        AND email_owner IS NOT NULL
        AND TRIM(email_owner) != ''
      GROUP BY LOWER(TRIM(email_owner)), owner_name
      ORDER BY email_owner
    `,
  });

  const byEmail = new Map<string, RequestInfoRecipient>();
  for (const row of rows as Array<Record<string, unknown>>) {
    const emailOwner = normalizeEmail(row.email_owner);
    if (!emailOwner) continue;
    const areaCodes = Array.isArray(row.area_codes)
      ? row.area_codes.map((value) => String(value ?? '').trim()).filter(Boolean)
      : [];
    const current = byEmail.get(emailOwner);
    if (current) {
      current.areaCodes = [...new Set([...current.areaCodes, ...areaCodes])];
      if (!current.ownerName && row.owner_name) current.ownerName = String(row.owner_name);
      continue;
    }

    byEmail.set(emailOwner, {
      ownerName: row.owner_name == null ? '' : String(row.owner_name),
      emailOwner,
      areaCodes,
    });
  }

  return [...byEmail.values()];
}

export async function createReportingVersion(input: {
  periodMonth: string;
  versionName?: string;
  createdBy?: string;
  notes?: string;
}) {
  const client = getBigQueryClient();
  const periodMonth = normalizePeriodMonth(input.periodMonth);
  const createdBy = (input.createdBy ?? '').trim() || 'admin_panel';
  const notes = (input.notes ?? '').trim();

  const [nextRows] = await client.query({
    query: `
      SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version_number
      FROM \`${REPORTING_VERSIONS_TABLE}\`
      WHERE period_month = DATE(@periodMonth)
    `,
    params: { periodMonth },
  });

  const nextVersionNumber = Number((nextRows as Array<{ next_version_number?: unknown }>)[0]?.next_version_number ?? 1);
  const safeVersionNumber = Number.isFinite(nextVersionNumber) && nextVersionNumber > 0 ? nextVersionNumber : 1;
  const versionName = (input.versionName ?? '').trim() || `Version ${safeVersionNumber}`;
  const reportingVersionId = buildVersionId(input.periodMonth.trim());

  await client.query({
    query: `
      INSERT INTO \`${REPORTING_VERSIONS_TABLE}\` (
        reporting_version_id,
        period_month,
        version_name,
        version_number,
        status,
        created_at,
        created_by,
        notes
      )
      VALUES (
        @reportingVersionId,
        DATE(@periodMonth),
        @versionName,
        @versionNumber,
        'draft',
        CURRENT_TIMESTAMP(),
        @createdBy,
        NULLIF(@notes, '')
      )
    `,
    params: {
      reportingVersionId,
      periodMonth,
      versionName,
      versionNumber: safeVersionNumber,
      createdBy,
      notes,
    },
  });

  revalidateVersionPaths();

  return { ok: true as const, reportingVersionId };
}

export async function closeReportingVersion(input: {
  reportingVersionId: string;
  closedBy?: string;
  notes?: string;
}) {
  const reportingVersionId = (input.reportingVersionId ?? '').trim();
  if (!reportingVersionId) {
    throw new Error('reportingVersionId is required.');
  }

  const client = getBigQueryClient();
  const closedBy = (input.closedBy ?? '').trim() || 'admin_panel';
  const notes = (input.notes ?? '').trim();

  await client.query({
    query: `
      UPDATE \`${REPORTING_VERSIONS_TABLE}\`
      SET
        status = 'closed',
        closed_at = CURRENT_TIMESTAMP(),
        closed_by = @closedBy,
        notes = IFNULL(NULLIF(@notes, ''), notes)
      WHERE reporting_version_id = @reportingVersionId
    `,
    params: { reportingVersionId, closedBy, notes },
  });

  revalidateVersionPaths();
  return { ok: true as const };
}

export async function markReportingVersionReady(input: {
  reportingVersionId: string;
  notes?: string;
}) {
  const reportingVersionId = (input.reportingVersionId ?? '').trim();
  if (!reportingVersionId) {
    throw new Error('reportingVersionId is required.');
  }

  const client = getBigQueryClient();
  const notes = (input.notes ?? '').trim();

  await client.query({
    query: `
      UPDATE \`${REPORTING_VERSIONS_TABLE}\`
      SET
        status = 'ready_to_show',
        notes = IFNULL(NULLIF(@notes, ''), notes)
      WHERE reporting_version_id = @reportingVersionId
    `,
    params: { reportingVersionId, notes },
  });

  revalidateVersionPaths();
  return { ok: true as const };
}

export async function requestReportingVersionInfo(input: {
  reportingVersionId: string;
  periodMonth: string;
}) {
  const reportingVersionId = (input.reportingVersionId ?? '').trim();
  const periodMonth = (input.periodMonth ?? '').trim();
  if (!reportingVersionId) {
    throw new Error('reportingVersionId is required.');
  }
  if (!periodMonth) {
    throw new Error('periodMonth is required.');
  }

  const client = getBigQueryClient();
  const [versionRows] = await client.query({
    query: `
      SELECT CAST(period_month AS STRING) AS period_month
      FROM \`${REPORTING_VERSIONS_TABLE}\`
      WHERE reporting_version_id = @reportingVersionId
      LIMIT 1
    `,
    params: { reportingVersionId },
  });
  const versionRow = (versionRows as Array<Record<string, unknown>>)[0];
  if (!versionRow) {
    throw new Error('Reporting version not found.');
  }

  const today = asDateOnly(new Date());
  const windowEnd = addBusinessDays(today, 3);
  const recipients = await getRequestInfoRecipients();

  if (recipients.length === 0) {
    return { ok: true as const, sent: 0, failed: 0 };
  }

  const periodLabel = formatPeriodLabel(String(versionRow.period_month ?? periodMonth));
  const windowStartLabel = formatSpanishDate(today);
  const windowEndLabel = formatSpanishDate(windowEnd);
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const recipient of recipients) {
    try {
      await sendRequestInfoEmail({
        recipient,
        periodLabel,
        windowStart: windowStartLabel,
        windowEnd: windowEndLabel,
      });
      sent += 1;
    } catch (error) {
      failed += 1;
      errors.push(`${recipient.emailOwner}: ${error instanceof Error ? error.message : 'Unknown email error'}`);
    }
  }

  revalidatePath('/admin/versions');

  if (failed > 0) {
    throw new Error(`Sent ${sent} emails, but ${failed} failed. ${errors.slice(0, 3).join(' | ')}`);
  }

  await sendRequestInfoSummaryEmail({
    recipients,
    periodLabel,
    windowStart: windowStartLabel,
    windowEnd: windowEndLabel,
    sentCount: sent,
  });

  return { ok: true as const, sent, failed };
}

export async function deleteReportingVersion(reportingVersionId: string) {
  const safeId = (reportingVersionId ?? '').trim();
  if (!safeId) {
    throw new Error('reportingVersionId is required.');
  }

  const client = getBigQueryClient();
  await client.query({
    query: `
      DELETE FROM \`${REPORTING_VERSIONS_TABLE}\`
      WHERE reporting_version_id = @reportingVersionId
    `,
    params: { reportingVersionId: safeId },
  });

  revalidateVersionPaths();
  return { ok: true as const };
}
