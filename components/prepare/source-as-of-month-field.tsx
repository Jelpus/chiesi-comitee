'use client';

import { useState } from 'react';

type SourceAsOfMonthFieldProps = {
  name?: string;
  defaultValue: string;
  periodMonth: string;
  dddLike?: boolean;
};

function previousMonth(periodMonth: string) {
  const date = new Date(`${periodMonth}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  date.setUTCMonth(date.getUTCMonth() - 1);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

function toMonthInputValue(value: string) {
  return value ? value.slice(0, 7) : '';
}

export function SourceAsOfMonthField({ name = 'sourceAsOfMonth', defaultValue, periodMonth, dddLike }: SourceAsOfMonthFieldProps) {
  const expected = dddLike ? previousMonth(periodMonth) : '';
  const initialValue = (defaultValue || expected || periodMonth).slice(0, 10);
  const [monthValue, setMonthValue] = useState(toMonthInputValue(initialValue));

  return (
    <div className="space-y-2">
      <label className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
        Data al cierre de
      </label>
      <input
        type="month"
        value={monthValue}
        onChange={(event) => {
          setMonthValue(event.currentTarget.value);
        }}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
        required
      />
      <input type="hidden" name={name} value={monthValue ? `${monthValue}-01` : ''} />
      <p className="text-xs leading-5 text-red">
        Asegura que seleccionas el mes correcto.
      </p> 
    </div>
  );
}
