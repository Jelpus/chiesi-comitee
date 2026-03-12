import 'server-only';
import { Storage } from '@google-cloud/storage';

let storageClient: Storage | null = null;

function getPrivateKey() {
  const key = process.env.GCP_PRIVATE_KEY;
  if (!key) return undefined;

  return key.replace(/\\n/g, '\n');
}

export function getStorageClient() {
  if (storageClient) return storageClient;

  const projectId = process.env.GCP_PROJECT_ID;
  const clientEmail = process.env.GCP_CLIENT_EMAIL;
  const privateKey = getPrivateKey();

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Faltan variables de entorno para GCS: GCP_PROJECT_ID, GCP_CLIENT_EMAIL o GCP_PRIVATE_KEY.',
    );
  }

  storageClient = new Storage({
    projectId,
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
  });

  return storageClient;
}

export function getUploadsBucketName() {
  const bucket = process.env.GCS_UPLOAD_BUCKET;
  if (!bucket) {
    throw new Error('Falta la variable de entorno GCS_UPLOAD_BUCKET.');
  }

  return bucket;
}
