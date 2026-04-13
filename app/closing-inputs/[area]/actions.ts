'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { saveClosingInput } from '@/lib/data/closing-inputs';
import { getClosingInputAreaMeta } from '@/lib/data/closing-inputs-schema';

function normalizeMonthToDate(value: string) {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}$/.test(trimmed)) return `${trimmed}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return trimmed;
}

function normalizeText(value: FormDataEntryValue | null) {
  return String(value ?? '').trim();
}

export async function submitClosingInputForm(formData: FormData) {
  const areaSlug = String(formData.get('areaSlug') ?? '').trim();
  const areaMeta = getClosingInputAreaMeta(areaSlug);
  if (!areaMeta) throw new Error('Invalid area.');

  const reportingVersionId = normalizeText(formData.get('reportingVersionId'));
  const periodMonth = normalizeMonthToDate(normalizeText(formData.get('periodMonth')));
  const sourceAsOfMonth =
    normalizeMonthToDate(normalizeText(formData.get('sourceAsOfMonth'))) || periodMonth;
  const reportedBy = normalizeText(formData.get('reportedBy'));
  const messages = [1, 2, 3, 4, 5].map((index) =>
    normalizeText(formData.get(`message${index}`)),
  );
  const additionalComment = normalizeText(formData.get('additionalComment'));

  if (!reportingVersionId) throw new Error('Reporting version is required.');
  if (!periodMonth) throw new Error('Period month is required.');
  if (!sourceAsOfMonth) throw new Error('Source as of is required.');
  if (!reportedBy) throw new Error('Reported by is required.');
  if (messages.some((item) => item.length === 0)) {
    throw new Error('All five key messages are required.');
  }

  await saveClosingInput({
    areaSlug,
    reportingVersionId,
    periodMonth,
    sourceAsOfMonth,
    reportedBy,
    messages,
    additionalComment,
  });

  revalidatePath('/closing-inputs');
  revalidatePath(`/closing-inputs/${areaSlug}`);
  revalidatePath(`/executive/${areaSlug}/insights`);

  const params = new URLSearchParams();
  params.set('period', periodMonth);
  params.set('saved', '1');
  redirect(`/closing-inputs/${areaSlug}/thank-you?${params.toString()}`);
}

