'use client';

import { useState } from 'react';
import { CloseupProductMapping } from '@/components/admin/closeup-product-mapping';
import { Gob360ProductMapping } from '@/components/admin/gob360-product-mapping';
import { PmmProductMapping } from '@/components/admin/pmm-product-mapping';
import { SellOutProductMapping } from '@/components/admin/sellout-product-mapping';
import type {
  CloseupProductMappingRow,
  CloseupUnmappedProductRow,
  DimProductOption,
  Gob360ProductMappingRow,
  Gob360UnmappedClaveRow,
  PmmProductMappingRow,
  PmmUnmappedProductRow,
  SellOutProductMappingRow,
  SellOutUnmappedProductRow,
} from '@/lib/data/products/product-metadata';

type MappingTabsProps = {
  productOptions: DimProductOption[];
  marketGroupOptions: string[];
  pmm: {
    unmappedRows: PmmUnmappedProductRow[];
    mappedRows: PmmProductMappingRow[];
  };
  closeup: {
    unmappedRows: CloseupUnmappedProductRow[];
    mappedRows: CloseupProductMappingRow[];
  };
  gob360: {
    unmappedRows: Gob360UnmappedClaveRow[];
    mappedRows: Gob360ProductMappingRow[];
  };
  sellOut: {
    unmappedRows: SellOutUnmappedProductRow[];
    mappedRows: SellOutProductMappingRow[];
  };
  stocks: {
    unmappedRows: SellOutUnmappedProductRow[];
    mappedRows: SellOutProductMappingRow[];
  };
  contracts: {
    unmappedRows: SellOutUnmappedProductRow[];
    mappedRows: SellOutProductMappingRow[];
  };
};

type TabKey = 'ddd' | 'closeup' | 'gob360' | 'sellout' | 'stocks' | 'contracts';

export function MappingTabs({
  productOptions,
  marketGroupOptions,
  pmm,
  closeup,
  gob360,
  sellOut,
  stocks,
  contracts,
}: MappingTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('ddd');

  return (
    <section className="space-y-4">
      <div className="rounded-[24px] border border-slate-200/80 bg-white p-3 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('ddd')}
            className={`rounded-full px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] transition ${
              activeTab === 'ddd'
                ? 'bg-slate-900 text-white'
                : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            DDD
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('closeup')}
            className={`rounded-full px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] transition ${
              activeTab === 'closeup'
                ? 'bg-slate-900 text-white'
                : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            Closeup
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('gob360')}
            className={`rounded-full px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] transition ${
              activeTab === 'gob360'
                ? 'bg-slate-900 text-white'
                : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            GOB360
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sellout')}
            className={`rounded-full px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] transition ${
              activeTab === 'sellout'
                ? 'bg-slate-900 text-white'
                : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            Sell Out
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('stocks')}
            className={`rounded-full px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] transition ${
              activeTab === 'stocks'
                ? 'bg-slate-900 text-white'
                : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            Stocks
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('contracts')}
            className={`rounded-full px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] transition ${
              activeTab === 'contracts'
                ? 'bg-slate-900 text-white'
                : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            Contratos
          </button>
        </div>
      </div>

      {activeTab === 'ddd' ? (
        <PmmProductMapping
          unmappedRows={pmm.unmappedRows}
          mappedRows={pmm.mappedRows}
          productOptions={productOptions}
          marketGroupOptions={marketGroupOptions}
        />
      ) : null}

      {activeTab === 'closeup' ? (
        <CloseupProductMapping
          unmappedRows={closeup.unmappedRows}
          mappedRows={closeup.mappedRows}
          productOptions={productOptions}
          marketGroupOptions={marketGroupOptions}
        />
      ) : null}

      {activeTab === 'gob360' ? (
        <Gob360ProductMapping
          unmappedRows={gob360.unmappedRows}
          mappedRows={gob360.mappedRows}
          productOptions={productOptions}
          marketGroupOptions={marketGroupOptions}
        />
      ) : null}

      {activeTab === 'sellout' ? (
        <SellOutProductMapping
          unmappedRows={sellOut.unmappedRows}
          mappedRows={sellOut.mappedRows}
          productOptions={productOptions}
          marketGroupOptions={marketGroupOptions}
          label="Sell Out"
        />
      ) : null}

      {activeTab === 'stocks' ? (
        <SellOutProductMapping
          unmappedRows={stocks.unmappedRows}
          mappedRows={stocks.mappedRows}
          productOptions={productOptions}
          marketGroupOptions={marketGroupOptions}
          label="Stocks"
        />
      ) : null}

      {activeTab === 'contracts' ? (
        <SellOutProductMapping
          unmappedRows={contracts.unmappedRows}
          mappedRows={contracts.mappedRows}
          productOptions={productOptions}
          marketGroupOptions={marketGroupOptions}
          label="Contratos"
        />
      ) : null}
    </section>
  );
}
