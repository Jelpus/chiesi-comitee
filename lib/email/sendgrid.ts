import 'server-only';

const SENDGRID_URL = 'https://api.sendgrid.com/v3/mail/send';

export type SendGridMessage = {
  to: string;
  cc?: string[];
  subject: string;
  html: string;
};

function getApiKey() {
  return process.env.SENGRID_API_KEY?.trim() || process.env.SENDGRID_API_KEY?.trim() || '';
}

function getSenderEmail() {
  return process.env.SENGIRD_SENDER_EMAIL?.trim() || process.env.SENDGRID_SENDER_EMAIL?.trim() || '';
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function uniqueCcRecipients(to: string, cc: string[] | undefined) {
  const seen = new Set([normalizeEmail(to)]);
  return (cc ?? []).reduce<string[]>((recipients, email) => {
    const trimmedEmail = email.trim();
    const normalizedEmail = normalizeEmail(trimmedEmail);

    if (!trimmedEmail || seen.has(normalizedEmail)) return recipients;

    seen.add(normalizedEmail);
    recipients.push(trimmedEmail);
    return recipients;
  }, []);
}

export async function sendSendGridEmail(message: SendGridMessage) {
  const apiKey = getApiKey();
  const senderEmail = getSenderEmail();
  const ccRecipients = uniqueCcRecipients(message.to, message.cc);

  if (!apiKey) {
    throw new Error('Missing SendGrid API key. Set SENGRID_API_KEY or SENDGRID_API_KEY.');
  }

  if (!senderEmail) {
    throw new Error('Missing SendGrid sender email. Set SENGIRD_SENDER_EMAIL or SENDGRID_SENDER_EMAIL.');
  }

  const response = await fetch(SENDGRID_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: [{ email: message.to }],
          ...(ccRecipients.length > 0 ? { cc: ccRecipients.map((email) => ({ email })) } : {}),
          subject: message.subject,
        },
      ],
      from: {
        email: senderEmail,
        name: 'Chiesi Operational Commite',
      },
      content: [
        {
          type: 'text/html',
          value: message.html,
        },
      ],
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`SendGrid failed (${response.status}): ${responseText || response.statusText}`);
  }
}
