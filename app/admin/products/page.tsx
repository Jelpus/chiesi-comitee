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
  getStocksProductMappings,
  getStocksUnmappedProducts,
  getProductMetadataCoverageRows,
} from '@/lib/data/products/product-metadata';
import { unstable_noStore as noStore } from 'next/cache';

export const dynamic = 'force-dynamic';

function normalizeMappingKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

type ProductsPageProps = {
  searchParams?: Promise<{
    pmmUploadIds?: string;
    weeklyUploadIds?: string;
  }>;
};

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  noStore();
  const resolvedSearchParams = (await searchParams) ?? {};
  const pmmUploadIds = (resolvedSearchParams.pmmUploadIds ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const weeklyUploadIds = (resolvedSearchParams.weeklyUploadIds ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const sourceUploadIds = [...new Set([...pmmUploadIds, ...weeklyUploadIds])];

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
    stocksUnmappedRows,
    stocksMappings,
    gob360UnmappedClaves,
    gob360Mappings,
  ] = await Promise.all([
    getProductMetadataCoverageRows(300),
    getCloseupUnmappedProducts(200),
    getCloseupProductMappings(500),
    getDimProductOptions(2500),
    getSharedMarketGroups(500),
    getPmmUnmappedProducts(1000, sourceUploadIds),
    getPmmProductMappings(500),
    getSellOutUnmappedProducts(300),
    getSellOutProductMappings(700),
    getStocksUnmappedProducts(300),
    getStocksProductMappings(700),
    getGob360UnmappedClaves(300),
    getGob360ProductMappings(700),
  ]);
  const completedCount = rows.filter(
    (row) => row.completedRequiredFields >= row.requiredFieldsTotal,
  ).length;
  const pendingCount = rows.length - completedCount;
  const closeupMappedKeys = new Set(
    closeupMappings.map((row) => normalizeMappingKey(row.sourceProductName)),
  );
  const pmmMappedKeys = new Set(
    pmmMappings.map((row) => normalizeMappingKey(row.sourceProductName)),
  );
  const sellOutMappedKeys = new Set(
    sellOutMappings.map((row) => normalizeMappingKey(row.sourceProductName)),
  );
  const stocksMappedKeys = new Set(
    stocksMappings.map((row) => normalizeMappingKey(row.sourceProductName)),
  );
  const gob360MappedKeys = new Set(gob360Mappings.map((row) => row.sourceClaveNormalized));

  const filteredCloseupUnmappedRows = unmappedCloseupRows.filter(
    (row) => !closeupMappedKeys.has(normalizeMappingKey(row.sourceProductName)),
  );
  const filteredPmmUnmappedRows = unmappedPmmRows.filter(
    (row) => !pmmMappedKeys.has(normalizeMappingKey(row.sourceProductName)),
  );
  const filteredSellOutUnmappedRows = sellOutUnmappedRows.filter(
    (row) => !sellOutMappedKeys.has(normalizeMappingKey(row.sourceProductName)),
  );
  const filteredStocksUnmappedRows = stocksUnmappedRows.filter(
    (row) => !stocksMappedKeys.has(normalizeMappingKey(row.sourceProductName)),
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

      {sourceUploadIds.length > 0 ? (
        <div className="rounded-[20px] border border-blue-200/80 bg-blue-50/70 px-4 py-3 text-sm text-blue-950">
          DDD + Weekly unmapped list filtered to upload_ids: {sourceUploadIds.join(', ')}
        </div>
      ) : null}

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
        stocks={{
          unmappedRows: filteredStocksUnmappedRows,
          mappedRows: stocksMappings,
        }}
      />
      <Gob360ConnectionTest />
    </section>
  );
}
