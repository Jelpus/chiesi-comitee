'use server';

import { revalidatePath } from 'next/cache';
import { saveAdminHomeStatusSnapshot } from '@/lib/data/admin-home-status';
import { syncExecutiveHomeQuerySnapshot } from '@/lib/data/excecutive/sync-executive-home-query-snapshot';
import { syncExecutiveInsightsPreReadSnapshot } from '@/lib/data/excecutive/sync-executive-insights-preread-snapshot';
import { getActiveFormResponsibles, setFormResponsibleActive, upsertFormResponsible } from '@/lib/data/form-responsibles';
import { sendFormRequestInfoEmail, sendRequestInfoSummaryEmail, type FormRequestInfoRecipient } from '@/lib/email/request-info';

export type AdminActionState = {
  ok: boolean;
  message: string;
  completedAt: string | null;
};

export async function saveHomeStatusAction(formData: FormData) {
  const reportingVersionId = String(formData.get('reportingVersionId') ?? '').trim();
  const periodMonth = String(formData.get('periodMonth') ?? '').trim();
  if (!reportingVersionId || !periodMonth) {
    throw new Error('Missing reportingVersionId or periodMonth.');
  }

  await saveAdminHomeStatusSnapshot({
    reportingVersionId,
    periodMonth,
    createdBy: 'admin_panel',
  });
  await syncExecutiveHomeQuerySnapshot(reportingVersionId);

  revalidatePath('/admin');
}

export async function saveExecutivePreReadAction(formData: FormData) {
  const reportingVersionId = String(formData.get('reportingVersionId') ?? '').trim();
  const periodMonth = String(formData.get('periodMonth') ?? '').trim();
  if (!reportingVersionId || !periodMonth) {
    throw new Error('Missing reportingVersionId or periodMonth.');
  }

  await syncExecutiveInsightsPreReadSnapshot({
    reportingVersionId,
    periodMonth,
  });

  revalidatePath('/admin');
}

export async function saveHomeStatusActionState(
  _prevState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await saveHomeStatusAction(formData);
  return {
    ok: true,
    message: 'Ready',
    completedAt: new Date().toISOString(),
  };
}

export async function saveExecutivePreReadActionState(
  _prevState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await saveExecutivePreReadAction(formData);
  return {
    ok: true,
    message: 'Ready',
    completedAt: new Date().toISOString(),
  };
}

export async function saveFormResponsibleAction(formData: FormData) {
  await upsertFormResponsible({
    formCode: String(formData.get('formCode') ?? ''),
    ownerName: String(formData.get('ownerName') ?? ''),
    emailOwner: String(formData.get('emailOwner') ?? ''),
    isActive: String(formData.get('isActive') ?? 'true') === 'true',
    notes: String(formData.get('notes') ?? ''),
    updatedBy: 'admin_panel',
  });

  revalidatePath('/admin');
}

export async function setFormResponsibleActiveAction(formData: FormData) {
  await setFormResponsibleActive(
    String(formData.get('formCode') ?? ''),
    String(formData.get('emailOwner') ?? ''),
    String(formData.get('isActive') ?? 'true') === 'true',
    'admin_panel',
  );

  revalidatePath('/admin');
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

export async function requestFormsInfoAction(formData: FormData) {
  const periodMonth = String(formData.get('periodMonth') ?? '').trim();
  if (!periodMonth) throw new Error('Missing periodMonth.');

  const formResponsibles = await getActiveFormResponsibles();
  const today = asDateOnly(new Date());
  const windowEnd = addBusinessDays(today, 5);
  const periodLabel = formatPeriodLabel(periodMonth);
  const windowStartLabel = formatSpanishDate(today);
  const windowEndLabel = formatSpanishDate(windowEnd);

  const byEmail = new Map<string, FormRequestInfoRecipient>();
  for (const responsible of formResponsibles) {
    const emailOwner = normalizeEmail(responsible.emailOwner);
    if (!emailOwner) continue;
    const form = {
      formLabel: responsible.formLabel,
      formPath: responsible.formPath,
    };
    const current = byEmail.get(emailOwner);
    if (current) {
      current.forms.push(form);
      if (!current.ownerName && responsible.ownerName) current.ownerName = responsible.ownerName;
      continue;
    }
    byEmail.set(emailOwner, {
      ownerName: responsible.ownerName ?? '',
      emailOwner,
      periodMonth,
      forms: [form],
    });
  }

  const recipients = [...byEmail.values()];
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const recipient of recipients) {
    try {
      await sendFormRequestInfoEmail({
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

  if (failed > 0) {
    throw new Error(`Sent ${sent} form emails, but ${failed} failed. ${errors.slice(0, 3).join(' | ')}`);
  }

  await sendRequestInfoSummaryEmail({
    recipients: [],
    formRecipients: recipients,
    periodLabel,
    windowStart: windowStartLabel,
    windowEnd: windowEndLabel,
    sentCount: 0,
    formSentCount: sent,
  });

  revalidatePath('/admin');
  return { ok: true as const, sent, failed };
}
