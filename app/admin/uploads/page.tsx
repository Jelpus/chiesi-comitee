import { UploadForm } from '@/components/admin/upload-form';
import { CurrentUploadCard } from '@/components/admin/current-upload-card';
import { SectionHeader } from '@/components/ui/section-header';
import { getUploadFormOptions } from '@/lib/data/uploads/get-upload-form-options';
import { getLatestUploadRow } from '@/lib/data/uploads/get-uploads-page-data';

export const dynamic = 'force-dynamic';

export default async function UploadsPage() {
  const [options, latestUpload] = await Promise.all([
    getUploadFormOptions(),
    getLatestUploadRow(),
  ]);

  return (
    <section className="space-y-4">
      <SectionHeader
        eyebrow="Admin"
        title="Uploads"
        description="Manual file registration for monthly close loading and traceability."
      />

      <UploadForm options={options} />
      <CurrentUploadCard row={latestUpload} />
    </section>
  );
}
