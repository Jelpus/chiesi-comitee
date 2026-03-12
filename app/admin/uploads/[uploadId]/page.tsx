import Link from 'next/link';
import { AdminStatusBadge } from '@/components/ui/admin-status-badge';
import { SectionHeader } from '@/components/ui/section-header';
import { getUploadDetailData } from '@/lib/data/uploads/get-upload-detail-data';

type UploadDetailPageProps = {
  params: Promise<{ uploadId: string }>;
};

function formatDate(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export default async function UploadDetailPage({ params }: UploadDetailPageProps) {
  const { uploadId } = await params;
  const data = await getUploadDetailData(uploadId);

  return (
    <section className="space-y-4">
      <SectionHeader
        eyebrow="Admin"
        title={`Upload ${data.header.uploadId}`}
        description="Upload configuration details and RAW validation errors."
        actions={
          <Link
            href="/admin/uploads"
            className="rounded-full border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Back to uploads
          </Link>
        }
      />

      <div className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_40px_rgba(15,23,42,0.05)]">
        <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
          <p><span className="font-semibold">Module:</span> {data.header.moduleCode}</p>
          <p><span className="font-semibold">Period:</span> {data.header.periodMonth}</p>
          <p><span className="font-semibold">File:</span> {data.header.sourceFileName}</p>
          <p><span className="font-semibold">Uploaded:</span> {formatDate(data.header.uploadedAt)}</p>
          <p><span className="font-semibold">Sheet:</span> {data.header.selectedSheetName || 'N/A'}</p>
          <p><span className="font-semibold">Header row:</span> {data.header.selectedHeaderRow}</p>
          <p>
            <span className="font-semibold">Status:</span>{' '}
            <AdminStatusBadge status={data.header.status} />
          </p>
          <p>
            <span className="font-semibold">Rows:</span>{' '}
            {data.header.rowsValid}/{data.header.rowsTotal} valid, {data.header.rowsError} with errors
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_10px_40px_rgba(15,23,42,0.05)]">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-700">
            RAW Errors (max 200)
          </h2>
        </div>

        {data.errors.length === 0 ? (
          <p className="px-6 py-6 text-sm text-slate-600">No validation errors for this upload.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70">
                  <th className="px-6 py-4 text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    Row
                  </th>
                  <th className="px-6 py-4 text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    Errors
                  </th>
                  <th className="px-6 py-4 text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    Payload
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.errors.map((error) => (
                  <tr key={error.rowNumber} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-6 py-4 text-sm text-slate-800">{error.rowNumber}</td>
                    <td className="px-6 py-4 text-sm text-rose-700">{error.errors.join(' | ')}</td>
                    <td className="px-6 py-4">
                      <pre className="max-w-[640px] overflow-x-auto whitespace-pre-wrap break-words rounded bg-slate-50 p-3 text-xs text-slate-700">
                        {error.payloadJson}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
