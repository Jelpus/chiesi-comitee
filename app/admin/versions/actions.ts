'use server';

import 'server-only';
import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { getBigQueryClient } from '@/lib/bigquery/client';

const REPORTING_VERSIONS_TABLE = 'chiesi-committee.chiesi_committee_admin.reporting_versions';

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
        status = 'closed',
        notes = IFNULL(NULLIF(@notes, ''), notes)
      WHERE reporting_version_id = @reportingVersionId
    `,
    params: { reportingVersionId, notes },
  });

  revalidateVersionPaths();
  return { ok: true as const };
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
