import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { getStorageClient, getUploadsBucketName } from '@/lib/storage/client';

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function normalizeContentType(value: unknown) {
  const contentType = String(value ?? '').trim();
  return contentType || 'application/octet-stream';
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      fileName?: unknown;
      contentType?: unknown;
      moduleCode?: unknown;
      periodMonth?: unknown;
    };

    const fileName = String(body.fileName ?? '').trim();
    const moduleCode = String(body.moduleCode ?? '').trim();
    const periodMonth = String(body.periodMonth ?? '').trim();
    const contentType = normalizeContentType(body.contentType);

    if (!fileName || !moduleCode || !periodMonth) {
      return NextResponse.json(
        { ok: false, message: 'fileName, moduleCode y periodMonth son obligatorios.' },
        { status: 400 },
      );
    }

    const uploadId = randomUUID();
    const bucketName = getUploadsBucketName();
    const cleanFileName = sanitizeFileName(fileName);
    const objectPath = `committee_uploads/${periodMonth}/${moduleCode}/${uploadId}_${cleanFileName}`;
    const storagePath = `gs://${bucketName}/${objectPath}`;

    const [signedUrl] = await getStorageClient()
      .bucket(bucketName)
      .file(objectPath)
      .getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + 15 * 60 * 1000,
        contentType,
      });

    return NextResponse.json({
      ok: true,
      uploadId,
      signedUrl,
      storagePath,
      contentType,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : 'No se pudo preparar la subida.',
      },
      { status: 500 },
    );
  }
}
