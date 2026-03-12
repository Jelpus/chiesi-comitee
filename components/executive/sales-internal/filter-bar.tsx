'use client';

import { Loader2 } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import type { SalesInternalFilterOptions } from '@/types/sales-internal';

type SalesInternalFilterBarProps = {
  options: SalesInternalFilterOptions;
  selected: {
    periodMonth?: string;
    bu?: string;
    channel?: string;
    distributionChannel?: string;
    salesGroup?: string;
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
        onChange={(e) => onChange(e.target.value)}
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

export function SalesInternalFilterBar({ options, selected }: SalesInternalFilterBarProps) {
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

  const distributionOptions = options.distributionChannels
    .filter((item) => !selected.channel || item.channel === selected.channel)
    .map((item) => ({
      value: item.value,
      label: item.label,
    }));
  const distributionValues = new Set(distributionOptions.map((item) => item.value));
  const distributionValue =
    selected.distributionChannel && distributionValues.has(selected.distributionChannel)
      ? selected.distributionChannel
      : '';

  function handleChannelChange(nextChannel: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (nextChannel) {
      params.set('channel', nextChannel);
    } else {
      params.delete('channel');
    }

    const currentDistribution = params.get('distributionChannel');
    if (currentDistribution) {
      const isCompatible = options.distributionChannels.some(
        (item) =>
          item.value === currentDistribution && (!nextChannel || item.channel === nextChannel),
      );
      if (!isCompatible) {
        params.delete('distributionChannel');
      }
    }

    pushParams(params);
  }

  function handleDistributionChange(nextDistribution: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (nextDistribution) {
      params.set('distributionChannel', nextDistribution);
      const selectedDistribution = options.distributionChannels.find(
        (item) => item.value === nextDistribution,
      );
      if (selectedDistribution?.channel) {
        params.set('channel', selectedDistribution.channel);
      }
    } else {
      params.delete('distributionChannel');
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
          options={[{ value: '', label: 'YTD' }, ...options.periods.map((value) => ({ value, label: value }))]}
          onChange={(value) => setParam('periodMonth', value)}
        />

        <CompactSelect
          label="Business Unit"
          value={selected.bu ?? ''}
          options={[{ value: '', label: 'All' }, ...options.businessUnits]}
          onChange={(value) => setParam('bu', value)}
        />

        <CompactSelect
          label="Channel"
          value={selected.channel ?? ''}
          options={[{ value: '', label: 'All' }, ...options.channels.map((value) => ({ value, label: value }))]}
          onChange={handleChannelChange}
        />

        <CompactSelect
          label="Distribution"
          value={distributionValue}
          options={[{ value: '', label: 'All' }, ...distributionOptions]}
          onChange={handleDistributionChange}
        />

        <CompactSelect
          label="Sales Group"
          value={selected.salesGroup ?? options.salesGroups[0] ?? ''}
          options={options.salesGroups.map((value) => ({ value, label: value }))}
          onChange={(value) => setParam('salesGroup', value)}
        />
      </fieldset>
    </>
  );
}
