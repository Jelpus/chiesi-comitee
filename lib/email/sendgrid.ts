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

export async function sendSendGridEmail(message: SendGridMessage) {
  const apiKey = getApiKey();
  const senderEmail = getSenderEmail();

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
          cc: (message.cc ?? []).map((email) => ({ email })),
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
