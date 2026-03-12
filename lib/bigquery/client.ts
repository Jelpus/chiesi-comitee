import 'server-only';
import { BigQuery } from '@google-cloud/bigquery';

let bigQueryClient: BigQuery | null = null;

function getPrivateKey() {
  const key = process.env.GCP_PRIVATE_KEY;
  if (!key) return undefined;

  return key.replace(/\\n/g, '\n');
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

  return bigQueryClient;
}