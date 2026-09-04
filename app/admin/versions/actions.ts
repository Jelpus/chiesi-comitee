'use server';

import 'server-only';
import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { getBigQueryClient } from '@/lib/bigquery/client';
import {
  sendFormRequestInfoEmail,
  sendReadyValidationEmail,
  sendReminderEmail,
  sendReminderSummaryEmail,
  sendRequestInfoEmail,
  sendRequestInfoSummaryEmail,
  type FormRequestInfoRecipient,
  type ReadyValidationRecipient,
  type ReminderRecipient,
  type RequestInfoRecipient,
} from '@/lib/email/request-info';
import { getActiveFormResponsibles } from '@/lib/data/form-responsibles';
import { getAdminHomeStatusData } from '@/lib/data/admin-home-status';
import { getAppSettings } from '@/lib/data/app-settings';
import {
  beginNotificationDispatch,
  finishNotificationDispatch,
  type CommitteeNotificationSource,
} from '@/lib/data/notification-dispatches';
import { getMexicoCityDate } from '@/lib/time/mexico-city';
import { getCommitteeValidationDate } from '@/lib/data/committee-planning';

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

function normalizeFormStatusCode(value: string) {
  const normalized = value.trim().toLowerCase().replace(/-/g, '_');
  if (normalized === 'regulatory_affairs') return 'ra_quality_fv';
  return normalized;
}

async function getPendingModuleReminderRecipients(params: {
  reportingVersionId: string;
  periodMonth: string;
}) {
  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: `
      WITH active_modules AS (
        SELECT
          module_code,
          module_name,
          area_code,
          NULLIF(TRIM(owner_name), '') AS owner_name,
          LOWER(TRIM(email_owner)) AS email_owner
        FROM \`${DIM_MODULE_TABLE}\`
        WHERE COALESCE(is_active, TRUE) = TRUE
          AND email_owner IS NOT NULL
          AND TRIM(email_owner) != ''
      ),
      latest_upload AS (
        SELECT
          module_code,
          LOWER(TRIM(status)) AS status,
          ROW_NUMBER() OVER (
            PARTITION BY module_code
            ORDER BY uploaded_at DESC
          ) AS rn
        FROM \`chiesi-committee.chiesi_committee_raw.uploads\`
        WHERE reporting_version_id = @reportingVersionId
          AND period_month = DATE(@periodMonth)
      )
      SELECT
        m.module_code,
        m.module_name,
        m.area_code,
        m.owner_name,
        m.email_owner,
        COALESCE(u.status, 'missing') AS status
      FROM active_modules m
      LEFT JOIN latest_upload u
        ON u.module_code = m.module_code
       AND u.rn = 1
      WHERE COALESCE(u.status, 'missing') != 'published'
      ORDER BY m.email_owner, m.area_code, m.module_name
    `,
    params: params,
  });

  const recipientsByEmail = new Map<string, ReminderRecipient>();
  for (const row of rows as Array<Record<string, unknown>>) {
    const emailOwner = normalizeEmail(row.email_owner);
    if (!emailOwner) continue;
    const current = recipientsByEmail.get(emailOwner);
    const moduleItem = {
      moduleCode: String(row.module_code ?? ''),
      moduleName: String(row.module_name ?? ''),
      areaCode: String(row.area_code ?? ''),
      status: String(row.status ?? 'missing'),
    };

    if (current) {
      current.modules.push(moduleItem);
      if (!current.ownerName && row.owner_name) current.ownerName = String(row.owner_name);
      continue;
    }

    recipientsByEmail.set(emailOwner, {
      ownerName: row.owner_name == null ? '' : String(row.owner_name),
      emailOwner,
      modules: [moduleItem],
      forms: [],
    });
  }

  return recipientsByEmail;
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
  windowEndDate?: string;
  source?: CommitteeNotificationSource;
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

  const dispatch = await beginNotificationDispatch({
    reportingVersionId,
    periodMonth,
    notificationType: 'request_info',
    source: input.source ?? 'manual',
  });
  if (!dispatch) {
    return { ok: true as const, sent: 0, failed: 0, skipped: true as const, reason: 'already_sent_today' as const };
  }

  let dispatchSentCount = 0;
  try {

  const today = new Date(`${getMexicoCityDate()}T00:00:00Z`);
  const configuredWindowEnd = input.windowEndDate?.trim() || await getCommitteeValidationDate(periodMonth);
  if (configuredWindowEnd && !/^\d{4}-\d{2}-\d{2}$/.test(configuredWindowEnd)) {
    throw new Error('windowEndDate must use YYYY-MM-DD.');
  }
  const windowEnd = configuredWindowEnd ? new Date(`${configuredWindowEnd}T00:00:00Z`) : addBusinessDays(today, 3);
  const [recipients, formResponsibles, settings] = await Promise.all([
    getRequestInfoRecipients(),
    getActiveFormResponsibles(),
    getAppSettings(),
  ]);

  if (recipients.length === 0 && formResponsibles.length === 0) {
    await finishNotificationDispatch({ dispatchId: dispatch.dispatchId, status: 'succeeded', sentCount: 0, message: 'No Request Info recipients.' });
    return { ok: true as const, sent: 0, failed: 0, skipped: false as const };
  }

  const periodMonthValue = String(versionRow.period_month ?? periodMonth);
  const periodLabel = formatPeriodLabel(periodMonthValue);
  const windowStartLabel = formatSpanishDate(today);
  const windowEndLabel = formatSpanishDate(windowEnd);
  let sent = 0;
  let formsSent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const recipient of recipients) {
    try {
      await sendRequestInfoEmail({
        recipient,
        periodLabel,
        windowStart: windowStartLabel,
        windowEnd: windowEndLabel,
        committeeResponsibleEmail: settings.committeeResponsibleEmail,
      });
      sent += 1;
      dispatchSentCount = sent + formsSent;
    } catch (error) {
      failed += 1;
      errors.push(`${recipient.emailOwner}: ${error instanceof Error ? error.message : 'Unknown email error'}`);
    }
  }

  const formRecipientsByEmail = new Map<string, FormRequestInfoRecipient>();
  for (const responsible of formResponsibles) {
    const emailOwner = normalizeEmail(responsible.emailOwner);
    if (!emailOwner) continue;
    const current = formRecipientsByEmail.get(emailOwner);
    const form = {
      formLabel: responsible.formLabel,
      formPath: responsible.formPath,
    };
    if (current) {
      current.forms.push(form);
      if (!current.ownerName && responsible.ownerName) current.ownerName = responsible.ownerName;
      continue;
    }
    formRecipientsByEmail.set(emailOwner, {
      ownerName: responsible.ownerName ?? '',
      emailOwner,
      periodMonth: periodMonthValue,
      forms: [form],
    });
  }

  const formRecipients = [...formRecipientsByEmail.values()];
  for (const recipient of formRecipients) {
    try {
      await sendFormRequestInfoEmail({
        recipient,
        periodLabel,
        windowStart: windowStartLabel,
        windowEnd: windowEndLabel,
        committeeResponsibleEmail: settings.committeeResponsibleEmail,
      });
      formsSent += 1;
      dispatchSentCount = sent + formsSent;
    } catch (error) {
      failed += 1;
      errors.push(`${recipient.emailOwner}: ${error instanceof Error ? error.message : 'Unknown email error'}`);
    }
  }

  revalidatePath('/admin/versions');

  if (failed > 0) {
    throw new Error(`Sent ${sent + formsSent} emails, but ${failed} failed. ${errors.slice(0, 3).join(' | ')}`);
  }

  await sendRequestInfoSummaryEmail({
    recipients,
    formRecipients,
    periodLabel,
    windowStart: windowStartLabel,
    windowEnd: windowEndLabel,
    sentCount: sent,
    formSentCount: formsSent,
    committeeResponsibleEmail: settings.committeeResponsibleEmail,
  });

  await finishNotificationDispatch({
    dispatchId: dispatch.dispatchId,
    status: 'succeeded',
    sentCount: sent + formsSent,
    message: `${sent + formsSent} Request Info email(s) sent.`,
  });
  return { ok: true as const, sent: sent + formsSent, failed, skipped: false as const };
  } catch (error) {
    await finishNotificationDispatch({
      dispatchId: dispatch.dispatchId,
      status: 'failed',
      sentCount: dispatchSentCount,
      message: error instanceof Error ? error.message : 'Unknown Request Info error',
    });
    throw error;
  }
}

export async function requestReportingVersionReminder(input: {
  reportingVersionId: string;
  periodMonth: string;
  source?: CommitteeNotificationSource;
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

  const dispatch = await beginNotificationDispatch({
    reportingVersionId,
    periodMonth,
    notificationType: 'reminder',
    source: input.source ?? 'manual',
  });
  if (!dispatch) {
    return { ok: true as const, sent: 0, failed: 0, skipped: true as const, reason: 'already_sent_today' as const };
  }

  let dispatchSentCount = 0;
  try {

  const settings = await getAppSettings();
  const periodMonthValue = String(versionRow.period_month ?? periodMonth);
  const periodLabel = formatPeriodLabel(periodMonthValue);
  const recipientsByEmail = await getPendingModuleReminderRecipients({
    reportingVersionId,
    periodMonth: periodMonthValue,
  });

  const statusData = await getAdminHomeStatusData({
    reportingVersionId,
    periodMonth: periodMonthValue,
  });
  const pendingFormsByCode = new Map(
    statusData.forms
      .filter((form) => form.status !== 'complete')
      .map((form) => [normalizeFormStatusCode(form.formCode), form]),
  );

  for (const responsible of await getActiveFormResponsibles()) {
    const emailOwner = normalizeEmail(responsible.emailOwner);
    if (!emailOwner) continue;
    const formStatus = pendingFormsByCode.get(normalizeFormStatusCode(responsible.formCode));
    if (!formStatus) continue;

    const formItem = {
      formCode: responsible.formCode,
      formLabel: responsible.formLabel,
      formPath: responsible.formPath,
      status: formStatus.status,
    };
    const current = recipientsByEmail.get(emailOwner);
    if (current) {
      current.forms.push(formItem);
      if (!current.ownerName && responsible.ownerName) current.ownerName = responsible.ownerName;
      continue;
    }

    recipientsByEmail.set(emailOwner, {
      ownerName: responsible.ownerName ?? '',
      emailOwner,
      modules: [],
      forms: [formItem],
    });
  }

  const recipients = [...recipientsByEmail.values()].filter(
    (recipient) => recipient.modules.length > 0 || recipient.forms.length > 0,
  );
  if (recipients.length === 0) {
    await finishNotificationDispatch({ dispatchId: dispatch.dispatchId, status: 'succeeded', sentCount: 0, message: 'No pending recipients.' });
    return { ok: true as const, sent: 0, failed: 0, skipped: false as const };
  }

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const recipient of recipients) {
    try {
      await sendReminderEmail({
        recipient,
        periodLabel,
        periodMonth: periodMonthValue,
        reportingVersionId,
        committeeResponsibleEmail: settings.committeeResponsibleEmail,
      });
      sent += 1;
      dispatchSentCount = sent;
    } catch (error) {
      failed += 1;
      errors.push(`${recipient.emailOwner}: ${error instanceof Error ? error.message : 'Unknown email error'}`);
    }
  }

  revalidatePath('/admin/versions');

  if (failed > 0) {
    throw new Error(`Sent ${sent} reminder emails, but ${failed} failed. ${errors.slice(0, 3).join(' | ')}`);
  }

  await sendReminderSummaryEmail({
    recipients,
    periodLabel,
    sentCount: sent,
    committeeResponsibleEmail: settings.committeeResponsibleEmail,
  });

  await finishNotificationDispatch({
    dispatchId: dispatch.dispatchId,
    status: 'succeeded',
    sentCount: sent,
    message: `${sent} reminder email(s) sent.`,
  });
  return { ok: true as const, sent, failed, skipped: false as const };
  } catch (error) {
    await finishNotificationDispatch({
      dispatchId: dispatch.dispatchId,
      status: 'failed',
      sentCount: dispatchSentCount,
      message: error instanceof Error ? error.message : 'Unknown reminder error',
    });
    throw error;
  }
}

export async function notifyReportingVersionReadyValidation(input: {
  reportingVersionId: string;
  periodMonth: string;
  committeeMeetingDate: string;
  source?: CommitteeNotificationSource;
}) {
  const reportingVersionId = (input.reportingVersionId ?? '').trim();
  const periodMonth = (input.periodMonth ?? '').trim();
  const committeeMeetingDate = (input.committeeMeetingDate ?? '').trim();
  if (!reportingVersionId) throw new Error('reportingVersionId is required.');
  if (!periodMonth) throw new Error('periodMonth is required.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(committeeMeetingDate)) {
    throw new Error('Committee meeting date is required.');
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
  if (!versionRow) throw new Error('Reporting version not found.');

  const dispatch = await beginNotificationDispatch({
    reportingVersionId,
    periodMonth,
    notificationType: 'validation',
    source: input.source ?? 'manual',
  });
  if (!dispatch) {
    return { ok: true as const, sent: 0, failed: 0, skipped: true as const, reason: 'already_sent_today' as const };
  }

  let dispatchSentCount = 0;
  try {

  const settings = await getAppSettings();
  const recipientsByEmail = new Map<string, ReadyValidationRecipient>();
  for (const recipient of await getRequestInfoRecipients()) {
    const emailOwner = normalizeEmail(recipient.emailOwner);
    if (!emailOwner) continue;
    recipientsByEmail.set(emailOwner, {
      ownerName: recipient.ownerName,
      emailOwner,
    });
  }
  for (const responsible of await getActiveFormResponsibles()) {
    const emailOwner = normalizeEmail(responsible.emailOwner);
    if (!emailOwner || recipientsByEmail.has(emailOwner)) continue;
    recipientsByEmail.set(emailOwner, {
      ownerName: responsible.ownerName ?? '',
      emailOwner,
    });
  }

  const recipients = [...recipientsByEmail.values()];
  if (recipients.length === 0) {
    await finishNotificationDispatch({ dispatchId: dispatch.dispatchId, status: 'succeeded', sentCount: 0, message: 'No validation recipients.' });
    return { ok: true as const, sent: 0, failed: 0, skipped: false as const };
  }

  const periodLabel = formatPeriodLabel(String(versionRow.period_month ?? periodMonth));
  const meetingDateLabel = formatSpanishDate(new Date(`${committeeMeetingDate}T00:00:00Z`));
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const recipient of recipients) {
    try {
      await sendReadyValidationEmail({
        recipient,
        periodLabel,
        committeeMeetingDate: meetingDateLabel,
        committeeResponsibleEmail: settings.committeeResponsibleEmail,
      });
      sent += 1;
      dispatchSentCount = sent;
    } catch (error) {
      failed += 1;
      errors.push(`${recipient.emailOwner}: ${error instanceof Error ? error.message : 'Unknown email error'}`);
    }
  }

  revalidatePath('/admin/versions');

  if (failed > 0) {
    throw new Error(`Sent ${sent} validation emails, but ${failed} failed. ${errors.slice(0, 3).join(' | ')}`);
  }

  await finishNotificationDispatch({
    dispatchId: dispatch.dispatchId,
    status: 'succeeded',
    sentCount: sent,
    message: `${sent} validation email(s) sent.`,
  });
  return { ok: true as const, sent, failed, skipped: false as const };
  } catch (error) {
    await finishNotificationDispatch({
      dispatchId: dispatch.dispatchId,
      status: 'failed',
      sentCount: dispatchSentCount,
      message: error instanceof Error ? error.message : 'Unknown validation error',
    });
    throw error;
  }
}

export async function sendReadyValidationTestEmail(input: {
  reportingVersionId: string;
  periodMonth: string;
  committeeMeetingDate: string;
}) {
  const reportingVersionId = (input.reportingVersionId ?? '').trim();
  const periodMonth = (input.periodMonth ?? '').trim();
  const committeeMeetingDate = (input.committeeMeetingDate ?? '').trim();
  if (!reportingVersionId) throw new Error('reportingVersionId is required.');
  if (!periodMonth) throw new Error('periodMonth is required.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(committeeMeetingDate)) {
    throw new Error('Committee meeting date is required.');
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
  if (!versionRow) throw new Error('Reporting version not found.');

  const settings = await getAppSettings();

  await sendReadyValidationEmail({
    recipient: {
      ownerName: 'Guillermo',
      emailOwner: 'guillermo@jelpus.com',
    },
    periodLabel: formatPeriodLabel(String(versionRow.period_month ?? periodMonth)),
    committeeMeetingDate: formatSpanishDate(new Date(`${committeeMeetingDate}T00:00:00Z`)),
    committeeResponsibleEmail: settings.committeeResponsibleEmail,
  });

  return { ok: true as const, sent: 1 };
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
