import 'server-only';

import { readFile } from 'fs/promises';
import path from 'path';
import { sendSendGridEmail } from '@/lib/email/sendgrid';

export type RequestInfoRecipient = {
  ownerName: string;
  emailOwner: string;
  areaCodes: string[];
};

export type RequestInfoEmailInput = {
  recipient: RequestInfoRecipient;
  periodLabel: string;
  windowStart: string;
  windowEnd: string;
};

const ALWAYS_CC = 'j.arevalo@chiesi.com';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function cleanBaseUrl(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return 'http://localhost:3000';
  return trimmed.replace(/\/+$/, '');
}

function getBaseUrl() {
  return cleanBaseUrl(
    process.env.PUBLIC_URL ||
      process.env.NEXT_PUBLIC_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL,
  );
}

async function readTemplate() {
  return readFile(path.join(process.cwd(), 'lib/email/templates/request-info-template.html'), 'utf8');
}

function renderLinks(areaCodes: string[]) {
  const baseUrl = getBaseUrl();
  const links = [...new Set(areaCodes)]
    .filter(Boolean)
    .sort()
    .map((areaCode) => {
      const href = `${baseUrl}/prepare/${encodeURIComponent(areaCode)}`;
      return `
        <p style="margin:0 0 10px;">
          <a href="${escapeHtml(href)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:999px;padding:10px 16px;font-size:14px;font-weight:700;">
            ${escapeHtml(areaCode)}
          </a>
        </p>
      `;
    })
    .join('');

  return links || '<p style="margin:0;font-size:14px;color:#475569;">No hay areas asignadas.</p>';
}

export async function sendRequestInfoEmail(input: RequestInfoEmailInput) {
  const template = await readTemplate();
  const ownerName = input.recipient.ownerName || 'Equipo';
  const html = template
    .replaceAll('{{owner_name}}', escapeHtml(ownerName))
    .replaceAll('{{period_label}}', escapeHtml(input.periodLabel))
    .replaceAll('{{window_start}}', escapeHtml(input.windowStart))
    .replaceAll('{{window_end}}', escapeHtml(input.windowEnd))
    .replaceAll('{{prepare_links}}', renderLinks(input.recipient.areaCodes));

  await sendSendGridEmail({
    to: input.recipient.emailOwner,
    cc: [ALWAYS_CC],
    subject: `Solicitud de informacion - ${input.periodLabel}`,
    html,
  });
}
