import { ProductMetadataCards } from '@/components/admin/product-metadata-cards';
import { SectionHeader } from '@/components/ui/section-header';
import { getProductMetadataCoverageRows } from '@/lib/data/products/product-metadata';

export const dynamic = 'force-dynamic';

export default async function ProductsPage() {
  const rows = await getProductMetadataCoverageRows(300);
  const completedCount = rows.filter(
    (row) => row.completedRequiredFields >= row.requiredFieldsTotal,
  ).length;
  const pendingCount = rows.length - completedCount;

  const options = {
    brandNames: [...new Set(rows.map((row) => row.brandName).filter(Boolean) as string[])].sort(),
    subbrandOrDevices: [
      ...new Set(rows.map((row) => row.subbrandOrDevice).filter(Boolean) as string[]),
    ].sort(),
    productGroups: [...new Set(rows.map((row) => row.productGroup).filter(Boolean) as string[])].sort(),
    businessUnitCodes: [
      ...new Set(rows.map((row) => row.businessUnitCode).filter(Boolean) as string[]),
    ].sort(),
    businessUnitNames: [
      ...new Set(rows.map((row) => row.businessUnitName).filter(Boolean) as string[]),
    ].sort(),
    portfolioNames: [...new Set(rows.map((row) => row.portfolioName).filter(Boolean) as string[])].sort(),
  };

  return (
    <section className="space-y-4">
      <SectionHeader
        eyebrow="Admin"
        title="Products Metadata"
        description="Complete metadata by product_id using dim_product as baseline to enrich executive Sales Internal insights."
        actions={
          <>
            <div className="rounded-[18px] border border-emerald-200/80 bg-emerald-50 px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-emerald-700">
              Completed: {completedCount}
            </div>
            <div className="rounded-[18px] border border-amber-200/80 bg-amber-50 px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-amber-700">
              Pending: {pendingCount}
            </div>
            <div className="rounded-[18px] border border-slate-200/80 bg-slate-50 px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-slate-700">
              Total: {rows.length}
            </div>
          </>
        }
      />

      <ProductMetadataCards rows={rows} options={options} />
    </section>
  );
}
