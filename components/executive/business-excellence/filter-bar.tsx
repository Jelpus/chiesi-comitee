'use client';

import { Loader2 } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import type { BusinessExcellenceFilterOptions } from '@/types/business-excellence';

type BusinessExcellenceFilterBarProps = {
  options: BusinessExcellenceFilterOptions;
  selected: {
    periodMonth?: string;
    marketGroup?: string;
    salesGroup?: string;
    channel?: string;
    specialty?: string;
  };
};

type CompactSelectProps = {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
};

function CompactSelect({ label, value, options, onChange }: CompactSelectProps) {
  return (
    <label className="flex min-w-[132px] flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-[12px] border border-slate-200/90 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] transition hover:border-slate-300 focus:border-slate-400 focus:outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function BusinessExcellenceFilterBar({
  options,
  selected,
}: BusinessExcellenceFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function pushParams(params: URLSearchParams) {
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function setParam(paramName: string, nextValue: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (nextValue) {
      params.set(paramName, nextValue);
    } else {
      params.delete(paramName);
    }

    pushParams(params);
  }

  return (
    <>
      {isPending ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-white/35 backdrop-blur-[2px]">
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-[0_10px_30px_rgba(15,23,42,0.12)]">
            <Loader2 className="h-4 w-4 animate-spin text-slate-600" />
            Updating dashboard...
          </div>
        </div>
      ) : null}

      <fieldset disabled={isPending} className="flex flex-wrap gap-2 disabled:opacity-80">
        <CompactSelect
          label="Period"
          value={selected.periodMonth ?? ''}
          options={options.periods.map((value) => ({ value, label: value }))}
          onChange={(value) => setParam('periodMonth', value)}
        />

        <CompactSelect
          label="Market"
          value={selected.marketGroup ?? ''}
          options={[{ value: '', label: 'All' }, ...options.marketGroups.map((value) => ({ value, label: value }))]}
          onChange={(value) => setParam('marketGroup', value)}
        />

        <CompactSelect
          label="Sales Group"
          value={selected.salesGroup ?? ''}
          options={[{ value: '', label: 'All' }, ...options.salesGroups.map((value) => ({ value, label: value }))]}
          onChange={(value) => setParam('salesGroup', value)}
        />

        <CompactSelect
          label="Channel"
          value={selected.channel ?? ''}
          options={[{ value: '', label: 'All' }, ...options.channels.map((value) => ({ value, label: value }))]}
          onChange={(value) => setParam('channel', value)}
        />

        <CompactSelect
          label="Specialty"
          value={selected.specialty ?? ''}
          options={[{ value: '', label: 'All' }, ...options.specialties.map((value) => ({ value, label: value }))]}
          onChange={(value) => setParam('specialty', value)}
        />
      </fieldset>
    </>
  );
}
