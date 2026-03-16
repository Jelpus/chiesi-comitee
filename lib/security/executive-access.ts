const EXECUTIVE_ACCESS_COOKIE = 'executive_access';
const ACCESS_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 8;

function getCookieSecret() {
  const secret = process.env.ACCESS_COOKIE_SECRET;
  if (!secret) {
    throw new Error('ACCESS_COOKIE_SECRET is not set');
  }
  return secret;
}

function getCookieExpirationTimestamp() {
  return Math.floor(Date.now() / 1000) + ACCESS_COOKIE_MAX_AGE_SECONDS;
}

function toBase64Url(bytes: Uint8Array) {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sign(exp: number, secret: string) {
  const keyData = new TextEncoder().encode(secret);
  const message = new TextEncoder().encode(String(exp));
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, message);
  return toBase64Url(new Uint8Array(signature));
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function createExecutiveAccessCookieValue() {
  const exp = getCookieExpirationTimestamp();
  const signature = await sign(exp, getCookieSecret());
  return `${exp}.${signature}`;
}

export async function verifyExecutiveAccessCookieValue(rawCookieValue: string | undefined | null) {
  if (!rawCookieValue) return false;

  const [expRaw, signature] = rawCookieValue.split('.');
  if (!expRaw || !signature) return false;

  const exp = Number(expRaw);
  if (!Number.isFinite(exp)) return false;
  if (Math.floor(Date.now() / 1000) >= exp) return false;

  const expected = await sign(exp, getCookieSecret());
  return constantTimeEqual(signature, expected);
}

export const EXECUTIVE_COOKIE = EXECUTIVE_ACCESS_COOKIE;
export const EXECUTIVE_COOKIE_MAX_AGE_SECONDS = ACCESS_COOKIE_MAX_AGE_SECONDS;
