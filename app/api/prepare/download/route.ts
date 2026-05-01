import { NextResponse } from 'next/server';
import { getBigQueryClient } from '@/lib/bigquery/client';
import { getStorageClient } from '@/lib/storage/client';

function parseGcsPath(storagePath: string) {
  const withoutPrefix = storagePath.replace(/^gs:\/\//, '');
  const slashIndex = withoutPrefix.indexOf('/');
  if (slashIndex < 0) throw new Error('Ruta de archivo inválida.');
  return {
    bucketName: withoutPrefix.slice(0, slashIndex),
    objectPath: withoutPrefix.slice(slashIndex + 1),
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const uploadId = url.searchParams.get('uploadId')?.trim() ?? '';
  if (!uploadId) {
    return NextResponse.json({ ok: false, message: 'uploadId es obligatorio.' }, { status: 400 });
  }

  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: `
      SELECT storage_path
      FROM \`chiesi-committee.chiesi_committee_raw.uploads\`
      WHERE upload_id = @uploadId
      LIMIT 1
    `,
    params: { uploadId },
  });
  const row = (rows as Array<Record<string, unknown>>)[0];
  const storagePath = row?.storage_path ? String(row.storage_path) : '';
  if (!storagePath) {
    return NextResponse.json({ ok: false, message: 'No se encontró el archivo.' }, { status: 404 });
  }

  const { bucketName, objectPath } = parseGcsPath(storagePath);
  const [signedUrl] = await getStorageClient()
    .bucket(bucketName)
    .file(objectPath)
    .getSignedUrl({
      action: 'read',
      expires: Date.now() + 10 * 60 * 1000,
    });

  return NextResponse.redirect(signedUrl);
}
