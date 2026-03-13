import { Gob360ConnectionTest } from '@/components/admin/gob360-connection-test';
import { MappingTabs } from '@/components/admin/mapping-tabs';
import { ProductMetadataCards } from '@/components/admin/product-metadata-cards';
import { SectionHeader } from '@/components/ui/section-header';
import {
  getCloseupProductMappings,
  getCloseupUnmappedProducts,
  getDimProductOptions,
  getSharedMarketGroups,
  getGob360ProductMappings,
  getGob360UnmappedClaves,
  getPmmProductMappings,
  getPmmUnmappedProducts,
  getSellOutProductMappings,
  getSellOutUnmappedProducts,
  getProductMetadataCoverageRows,
} from '@/lib/data/products/product-metadata';
import { unstable_noStore as noStore } from 'next/cache';

export const dynamic = 'force-dynamic';

export default async function ProductsPage() {
  noStore();

  const [
    rows,
    unmappedCloseupRows,
    closeupMappings,
    productOptions,
    sharedMarketGroups,
    unmappedPmmRows,
    pmmMappings,
    sellOutUnmappedRows,
    sellOutMappings,
    gob360UnmappedClaves,
    gob360Mappings,
  ] = await Promise.all([
    getProductMetadataCoverageRows(300),
    getCloseupUnmappedProducts(200),
    getCloseupProductMappings(500),
    getDimProductOptions(2500),
    getSharedMarketGroups(500),
    getPmmUnmappedProducts(200),
    getPmmProductMappings(500),
    getSellOutUnmappedProducts(300),
    getSellOutProductMappings(700),
    getGob360UnmappedClaves(300),
    getGob360ProductMappings(700),
  ]);
  const completedCount = rows.filter(
    (row) => row.completedRequiredFields >= row.requiredFieldsTotal,
  ).length;
  const pendingCount = rows.length - completedCount;
  const closeupMappedKeys = new Set(closeupMappings.map((row) => row.sourceProductNameNormalized));
  const pmmMappedKeys = new Set(pmmMappings.map((row) => row.sourceProductNameNormalized));
  const sellOutMappedKeys = new Set(sellOutMappings.map((row) => row.sourceProductNameNormalized));
  const gob360MappedKeys = new Set(gob360Mappings.map((row) => row.sourceClaveNormalized));

  const filteredCloseupUnmappedRows = unmappedCloseupRows.filter(
    (row) => !closeupMappedKeys.has(row.sourceProductNameNormalized),
  );
  const filteredPmmUnmappedRows = unmappedPmmRows.filter(
    (row) => !pmmMappedKeys.has(row.sourceProductNameNormalized),
  );
  const filteredSellOutUnmappedRows = sellOutUnmappedRows.filter(
    (row) => !sellOutMappedKeys.has(row.sourceProductNameNormalized),
  );
  const filteredGob360UnmappedRows = gob360UnmappedClaves.filter(
    (row) => !gob360MappedKeys.has(row.sourceClaveNormalized),
  );

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
      <MappingTabs
        productOptions={productOptions}
        marketGroupOptions={sharedMarketGroups}
        pmm={{
          unmappedRows: filteredPmmUnmappedRows,
          mappedRows: pmmMappings,
        }}
        closeup={{
          unmappedRows: filteredCloseupUnmappedRows,
          mappedRows: closeupMappings,
        }}
        gob360={{
          unmappedRows: filteredGob360UnmappedRows,
          mappedRows: gob360Mappings,
        }}
        sellOut={{
          unmappedRows: filteredSellOutUnmappedRows,
          mappedRows: sellOutMappings,
        }}
      />
      <Gob360ConnectionTest />
    </section>
  );
}
