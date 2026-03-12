import { UploadForm } from '@/components/admin/upload-form';
import { UploadsTable } from '@/components/admin/uploads-table';
import { SectionHeader } from '@/components/ui/section-header';
import { getUploadFormOptions } from '@/lib/data/uploads/get-upload-form-options';
import { getUploadsPageData } from '@/lib/data/uploads/get-uploads-page-data';

export const dynamic = 'force-dynamic';

export default async function UploadsPage() {
  const [options, rows] = await Promise.all([getUploadFormOptions(), getUploadsPageData()]);

  return (
    <section className="space-y-4">
      <SectionHeader
        eyebrow="Admin"
        title="Uploads"
        description="Manual file registration for monthly close loading and traceability."
      />

      <UploadForm options={options} />
      <UploadsTable rows={rows} />
    </section>
  );
}
