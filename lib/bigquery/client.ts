import 'server-only';
import { BigQuery } from '@google-cloud/bigquery';

let bigQueryClient: BigQuery | null = null;

const BIGQUERY_TRANSIENT_NETWORK_CODES = new Set([
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT',
]);

function getPrivateKey() {
  const key = process.env.GCP_PRIVATE_KEY;
  if (!key) return undefined;

  return key.replace(/\\n/g, '\n');
}

function getErrorCode(error: unknown) {
  if (!error || typeof error !== 'object') return null;
  const maybeCode = (error as { code?: unknown }).code;
  if (typeof maybeCode === 'string') return maybeCode;
  const maybeCauseCode = (error as { cause?: { code?: unknown } }).cause?.code;
  return typeof maybeCauseCode === 'string' ? maybeCauseCode : null;
}

function isTransientNetworkError(error: unknown) {
  const code = getErrorCode(error);
  return code != null && BIGQUERY_TRANSIENT_NETWORK_CODES.has(code);
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function installBigQueryNetworkRetry(client: BigQuery) {
  const rawQuery = client.query.bind(client);
  const rawCreateQueryJob = client.createQueryJob.bind(client);

  client.query = (async (...args: Parameters<BigQuery['query']>) => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await rawQuery(...args);
      } catch (error) {
        if (!isTransientNetworkError(error) || attempt >= 2) throw error;
        await wait(300 * 2 ** attempt);
      }
    }
    return rawQuery(...args);
  }) as unknown as BigQuery['query'];

  client.createQueryJob = (async (...args: Parameters<BigQuery['createQueryJob']>) => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await rawCreateQueryJob(...args);
      } catch (error) {
        if (!isTransientNetworkError(error) || attempt >= 2) throw error;
        await wait(300 * 2 ** attempt);
      }
    }
    return rawCreateQueryJob(...args);
  }) as unknown as BigQuery['createQueryJob'];
}

export function getBigQueryClient() {
  if (bigQueryClient) return bigQueryClient;

  const projectId = process.env.GCP_PROJECT_ID;
  const clientEmail = process.env.GCP_CLIENT_EMAIL;
  const privateKey = getPrivateKey();

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Faltan variables de entorno de BigQuery: GCP_PROJECT_ID, GCP_CLIENT_EMAIL o GCP_PRIVATE_KEY.',
    );
  }

  bigQueryClient = new BigQuery({
    projectId,
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
  });
  installBigQueryNetworkRetry(bigQueryClient);

  return bigQueryClient;
}
