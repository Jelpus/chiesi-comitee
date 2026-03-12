import type { ProductMetadataRow } from '@/lib/data/products/product-metadata';

type ProductMetadataTableProps = {
  rows: ProductMetadataRow[];
};

function formatDate(value: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function ProductMetadataTable({ rows }: ProductMetadataTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-[28px] border border-slate-200/80 bg-white p-8 shadow-[0_10px_40px_rgba(15,23,42,0.05)]">
        <p className="text-sm text-slate-600">No product metadata registered.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_10px_40px_rgba(15,23,42,0.05)]">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70">
              <th className="px-6 py-4 text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Product ID
              </th>
              <th className="px-6 py-4 text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Brand
              </th>
              <th className="px-6 py-4 text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Portfolio
              </th>
              <th className="px-6 py-4 text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Lifecycle
              </th>
              <th className="px-6 py-4 text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Notes
              </th>
              <th className="px-6 py-4 text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Updated By
              </th>
              <th className="px-6 py-4 text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Updated At
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr key={row.productId} className="border-b border-slate-100 last:border-b-0">
                <td className="px-6 py-4 text-sm font-medium text-slate-900">{row.productId}</td>
                <td className="px-6 py-4 text-sm text-slate-800">{row.brandName ?? '-'}</td>
                <td className="px-6 py-4 text-sm text-slate-800">{row.portfolioName ?? '-'}</td>
                <td className="px-6 py-4 text-sm text-slate-800">{row.lifecycleStatus ?? '-'}</td>
                <td className="px-6 py-4 text-sm text-slate-800">{row.notes ?? '-'}</td>
                <td className="px-6 py-4 text-sm text-slate-800">{row.updatedBy ?? '-'}</td>
                <td className="px-6 py-4 text-sm text-slate-800">{formatDate(row.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

