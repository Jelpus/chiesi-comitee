'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

type SelectOption = {
  value: string;
  label: string;
};

type SelectFilterProps = {
  paramName: string;
  value: string;
  options: SelectOption[];
  label: string;
};

export function SelectFilter({
  paramName,
  value,
  options,
  label,
}: SelectFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(nextValue: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (nextValue) {
      params.set(paramName, nextValue);
    } else {
      params.delete(paramName);
    }

    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <label className="flex min-w-[220px] flex-col gap-2">
      <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
        {label}
      </span>

      <select
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-slate-300 focus:bg-white"
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