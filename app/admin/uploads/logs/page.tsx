import { UploadsTable } from '@/components/admin/uploads-table';
import { SectionHeader } from '@/components/ui/section-header';
import { getUploadsPageData } from '@/lib/data/uploads/get-uploads-page-data';

export const dynamic = 'force-dynamic';

type UploadLogsPageProps = {
  searchParams: Promise<{
    readyUploadId?: string;
  }>;
};

export default async function UploadLogsPage({ searchParams }: UploadLogsPageProps) {
  const params = await searchParams;
  const rows = await getUploadsPageData();

  return (
    <section className="space-y-4">
      <SectionHeader
        eyebrow="Admin"
        title="Upload Logs"
        description="Historical registry of uploads, processing, publishing, and troubleshooting."
      />

      {params.readyUploadId ? (
        <div className="rounded-[18px] border border-indigo-200/80 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          Upload <span className="font-semibold">{params.readyUploadId}</span> was registered.
          Next step: click <span className="font-semibold">Process</span> for this row.
        </div>
      ) : null}

      <UploadsTable rows={rows} />
    </section>
  );
}
