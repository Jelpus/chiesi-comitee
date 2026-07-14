import { expectedSourceAsOfMonth, formatMonthYear, sourcePeriodPolicyLabel } from '@/lib/uploads/source-period-policy';

type SourceAsOfMonthFieldProps = {
  name?: string;
  periodMonth: string;
  sourcePeriodOffsetMonths: number;
};

function toMonthInputValue(value: string) {
  return value ? value.slice(0, 7) : '';
}

export function SourceAsOfMonthField({ name = 'sourceAsOfMonth', periodMonth, sourcePeriodOffsetMonths }: SourceAsOfMonthFieldProps) {
  const expected = expectedSourceAsOfMonth(periodMonth, sourcePeriodOffsetMonths) || periodMonth;
  const monthValue = toMonthInputValue(expected);
  const policyLabel = sourcePeriodPolicyLabel(sourcePeriodOffsetMonths);

  return (
    <div className="space-y-2">
      <label className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
        Último mes incluido en el archivo
      </label>
      <input
        type="month"
        value={monthValue}
        disabled
        className="w-full cursor-not-allowed rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700"
      />
      <input type="hidden" name={name} value={monthValue ? `${monthValue}-01` : ''} />
      <p className="text-xs leading-5 text-slate-600">
        Regla <strong>{policyLabel}</strong>: para la versión de {formatMonthYear(periodMonth)}, Prepare espera datos hasta {formatMonthYear(expected)}.
        Este valor se configura en Admin / Modules.
      </p>
    </div>
  );
}
