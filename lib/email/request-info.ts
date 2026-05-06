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

export type RequestInfoSummaryEmailInput = {
  recipients: RequestInfoRecipient[];
  periodLabel: string;
  windowStart: string;
  windowEnd: string;
  sentCount: number;
};

const ALWAYS_CC = 'j.arevalo@chiesi.com';
const SUMMARY_TO = 'j.arevalo@chiesi.com';
const SUMMARY_CC = 'guillermo@jelpus.com';

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

function renderRecipientRows(recipients: RequestInfoRecipient[]) {
  const rows = recipients
    .map((recipient) => {
      const ownerName = recipient.ownerName || 'Equipo';
      const areaCodes = recipient.areaCodes.length > 0 ? recipient.areaCodes.join(', ') : 'Sin areas asignadas';
      return `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;">${escapeHtml(ownerName)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;">${escapeHtml(recipient.emailOwner)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#475569;">${escapeHtml(areaCodes)}</td>
        </tr>
      `;
    })
    .join('');

  return rows || `
    <tr>
      <td colspan="3" style="padding:12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;text-align:center;">No se registraron destinatarios.</td>
    </tr>
  `;
}

export async function sendRequestInfoSummaryEmail(input: RequestInfoSummaryEmailInput) {
  const html = `
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Resumen de solicitud de informacion</title>
      </head>
      <body style="margin:0;background:#f6f8fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f8fb;padding:28px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:720px;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;">
                <tr>
                  <td style="background:#0f172a;color:#ffffff;padding:24px 28px;">
                    <p style="margin:0;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#cbd5e1;">Chiesi Operational Commite</p>
                    <h1 style="margin:10px 0 0;font-size:22px;line-height:1.25;">Resumen de ventana de actualizacion</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px;">
                    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
                      Jose Arevalo y Guillermo Rojas, el dia de hoy se comunico a <strong>${input.sentCount}</strong> lista(s) de correo que ha iniciado la ventana de actualizacion para el periodo <strong>${escapeHtml(input.periodLabel)}</strong>.
                    </p>
                    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">
                      La ventana para enviar informacion queda abierta entre <strong>${escapeHtml(input.windowStart)}</strong> y <strong>${escapeHtml(input.windowEnd)}</strong>.
                    </p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;border-collapse:separate;border-spacing:0;">
                      <thead>
                        <tr>
                          <th align="left" style="padding:10px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Owner</th>
                          <th align="left" style="padding:10px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Email</th>
                          <th align="left" style="padding:10px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Areas</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${renderRecipientRows(input.recipients)}
                      </tbody>
                    </table>
                    <p style="margin:24px 0 0;font-size:15px;line-height:1.6;">
                      Atentamente,<br />
                      <strong>Chiesi Operational Commite</strong>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  await sendSendGridEmail({
    to: SUMMARY_TO,
    cc: [SUMMARY_CC],
    subject: `Resumen solicitud de informacion - ${input.periodLabel}`,
    html,
  });
}
