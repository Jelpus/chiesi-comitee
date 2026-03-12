import type { SalesInternalProductRow } from '@/types/sales-internal';

type SalesInternalProductTableProps = {
  rows: SalesInternalProductRow[];
};

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function SalesInternalProductTable({ rows }: SalesInternalProductTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-[24px] border border-slate-200/80 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
        <p className="text-sm text-slate-600">No product detail data for the selected filters.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-700">
          Product Detail (Top 200)
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70">
              <th className="px-5 py-3 text-left text-[11px] uppercase tracking-[0.14em] text-slate-500">
                period_month
              </th>
              <th className="px-5 py-3 text-left text-[11px] uppercase tracking-[0.14em] text-slate-500">bu</th>
              <th className="px-5 py-3 text-left text-[11px] uppercase tracking-[0.14em] text-slate-500">
                channel
              </th>
              <th className="px-5 py-3 text-left text-[11px] uppercase tracking-[0.14em] text-slate-500">
                distribution_channel_name
              </th>
              <th className="px-5 py-3 text-left text-[11px] uppercase tracking-[0.14em] text-slate-500">
                product_id
              </th>
              <th className="px-5 py-3 text-left text-[11px] uppercase tracking-[0.14em] text-slate-500">
                canonical_product_code
              </th>
              <th className="px-5 py-3 text-left text-[11px] uppercase tracking-[0.14em] text-slate-500">
                canonical_product_name
              </th>
              <th className="px-5 py-3 text-right text-[11px] uppercase tracking-[0.14em] text-slate-500">
                actual_value
              </th>
              <th className="px-5 py-3 text-right text-[11px] uppercase tracking-[0.14em] text-slate-500">
                row_count
              </th>
              <th className="px-5 py-3 text-right text-[11px] uppercase tracking-[0.14em] text-slate-500">
                customer_count
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, index) => (
              <tr
                key={`${row.periodMonth}-${row.productId}-${row.channel}-${index}`}
                className="border-b border-slate-100 last:border-b-0"
              >
                <td className="px-5 py-3 text-sm text-slate-800">{row.periodMonth}</td>
                <td className="px-5 py-3 text-sm text-slate-800">{row.bu}</td>
                <td className="px-5 py-3 text-sm text-slate-800">{row.channel}</td>
                <td className="px-5 py-3 text-sm text-slate-800">{row.distributionChannelName}</td>
                <td className="px-5 py-3 text-sm text-slate-800">{row.productId}</td>
                <td className="px-5 py-3 text-sm text-slate-800">{row.canonicalProductCode}</td>
                <td className="px-5 py-3 text-sm text-slate-800">{row.canonicalProductName}</td>
                <td className="px-5 py-3 text-right text-sm font-medium text-slate-900">
                  {formatCurrency(row.actualValue)}
                </td>
                <td className="px-5 py-3 text-right text-sm text-slate-800">{formatNumber(row.rowCount)}</td>
                <td className="px-5 py-3 text-right text-sm text-slate-800">
                  {formatNumber(row.customerCount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
