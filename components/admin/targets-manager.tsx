'use client';

import { useMemo, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import type { AdminTargetRow } from '@/lib/data/targets';
import type { RaCountMetric } from '@/lib/data/ra-forms-schema';
import { parseRaCountFields } from '@/lib/data/ra-forms-schema';
import type { LegalComplianceAnswerField } from '@/lib/data/legal-compliance-forms-schema';
import { parseLegalComplianceFields } from '@/lib/data/legal-compliance-forms-schema';
import { cloneAdminTargetsFromVersion, removeAdminTarget, saveAdminTarget } from '@/app/admin/targets/actions';

type TargetsManagerProps = {
  rows: AdminTargetRow[];
  areaOptions: string[];
  selectedArea: string;
  selectedReportingVersionId: string;
  selectedPeriodMonth: string;
  previousReportingVersionId: string;
  previousPeriodMonth: string;
  previousVersionName: string;
};

const DEFAULT_AREAS = [
  'commercial_operations',
  'medical',
  'business_excellence',
  'sales_internal',
  'human_resources',
  'opex',
  'legal_compliance',
  'ra_quality_fv',
];

const RA_FORM_FIELD_OPTIONS: Array<{ key: RaCountMetric; label: string }> = [
  { key: 'on_time', label: 'on_time_count' },
  { key: 'late', label: 'late_count' },
  { key: 'pending', label: 'pending_count' },
  { key: 'active', label: 'active_count' },
  { key: 'overdue', label: 'overdue_count' },
  { key: 'ytd', label: 'ytd_count' },
];

const LEGAL_FORM_FIELD_OPTIONS: Array<{ key: LegalComplianceAnswerField; label: string }> = [
  { key: 'current_count', label: 'current_count' },
  { key: 'active_count', label: 'active_count' },
  { key: 'additional_amount_mxn', label: 'additional_amount_mxn' },
];

function formatUpdatedAt(value: string | null) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function TargetsManager({
  rows,
  areaOptions,
  selectedArea,
  selectedReportingVersionId,
  selectedPeriodMonth,
  previousReportingVersionId,
  previousPeriodMonth,
  previousVersionName,
}: TargetsManagerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);

  const mergedAreaOptions = useMemo(
    () => [...new Set([...DEFAULT_AREAS, ...areaOptions])].sort(),
    [areaOptions],
  );

  function setAreaFilter(nextArea: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!nextArea) {
      params.delete('area');
    } else {
      params.set('area', nextArea);
    }
    if (selectedReportingVersionId) {
      params.set('version', selectedReportingVersionId);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function submitCreate(formData: FormData) {
    setMessage('');
    startTransition(async () => {
      try {
        await saveAdminTarget(formData);
        setMessage('Target saved.');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Failed to save target.');
      } finally {
        router.refresh();
      }
    });
  }

  function submitEdit(formData: FormData) {
    setMessage('');
    startTransition(async () => {
      try {
        const sourceReportingVersionId = String(formData.get('sourceReportingVersionId') ?? '').trim();
        const sourcePeriodMonth = String(formData.get('sourcePeriodMonth') ?? '').trim();
        const selectedReportingVersionIdLocal = String(formData.get('selectedReportingVersionId') ?? '').trim();
        const selectedPeriodMonthLocal = String(formData.get('selectedPeriodMonth') ?? '').trim();

        const applyFromSelected = window.confirm(
          [
            'Apply this target from the current selected cut onward?',
            `Selected: ${selectedReportingVersionIdLocal || 'N/A'} | ${selectedPeriodMonthLocal || 'N/A'}`,
            `Original: ${sourceReportingVersionId || 'N/A'} | ${sourcePeriodMonth || 'N/A'}`,
            '',
            'OK = Apply from selected cut onward',
            'Cancel = Keep only original cut',
          ].join('\n'),
        );

        if (applyFromSelected) {
          formData.set('reportingVersionId', selectedReportingVersionIdLocal);
          formData.set('periodMonth', selectedPeriodMonthLocal);
        } else {
          formData.set('reportingVersionId', sourceReportingVersionId);
          formData.set('periodMonth', sourcePeriodMonth);
        }

        await saveAdminTarget(formData);
        setMessage(applyFromSelected ? 'Target updated from selected cut onward.' : 'Target updated on original cut.');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Failed to update target.');
      } finally {
        router.refresh();
      }
    });
  }

  function submitDelete(formData: FormData) {
    setMessage('');
    startTransition(async () => {
      try {
        await removeAdminTarget(formData);
        setMessage('Target deleted.');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Failed to delete target.');
      } finally {
        router.refresh();
      }
    });
  }

  function submitCloneFromPrevious(formData: FormData) {
    setMessage('');
    startTransition(async () => {
      try {
        const sourceVersion = String(formData.get('sourceReportingVersionId') ?? '').trim();
        const sourcePeriod = String(formData.get('sourcePeriodMonth') ?? '').trim();
        const targetVersion = String(formData.get('targetReportingVersionId') ?? '').trim();
        const targetPeriod = String(formData.get('targetPeriodMonth') ?? '').trim();

        const confirmed = window.confirm(
          [
            'Copy all targets from previous version?',
            `From: ${sourceVersion} | ${sourcePeriod}`,
            `To: ${targetVersion} | ${targetPeriod}`,
          ].join('\n'),
        );

        if (!confirmed) return;

        const result = await cloneAdminTargetsFromVersion(formData);
        setMessage(`Copied ${result.copied} targets from previous version.`);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Failed to copy targets from previous version.');
      } finally {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <label className="flex max-w-[360px] flex-col gap-2">
            <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Area Filter</span>
            <select
              value={selectedArea}
              onChange={(e) => setAreaFilter(e.target.value)}
              className="rounded-[16px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950"
            >
              <option value="">All areas</option>
              {mergedAreaOptions.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setIsAddOpen((prev) => !prev)}
            className="self-start rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 transition hover:border-slate-400"
          >
            {isAddOpen ? 'Hide add form' : 'Add custom target'}
          </button>
          <form action={submitCloneFromPrevious} className="self-start">
            <input type="hidden" name="sourceReportingVersionId" value={previousReportingVersionId} />
            <input type="hidden" name="sourcePeriodMonth" value={previousPeriodMonth} />
            <input type="hidden" name="targetReportingVersionId" value={selectedReportingVersionId} />
            <input type="hidden" name="targetPeriodMonth" value={selectedPeriodMonth} />
            <button
              type="submit"
              disabled={
                isPending ||
                !previousReportingVersionId ||
                !previousPeriodMonth ||
                !selectedReportingVersionId ||
                !selectedPeriodMonth
              }
              className="rounded-full border border-blue-300 bg-blue-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
              title={
                previousReportingVersionId && previousPeriodMonth
                  ? `Copy from ${previousPeriodMonth} - ${previousVersionName || previousReportingVersionId}`
                  : 'No previous version available'
              }
            >
              Copy From Previous Version
            </button>
          </form>
        </div>

        {isAddOpen ? (
          <form action={submitCreate} className="mt-5 grid gap-3 border-t border-slate-200 pt-4 lg:grid-cols-6">
            <input type="hidden" name="reportingVersionId" value={selectedReportingVersionId} />
            <input type="hidden" name="periodMonth" value={selectedPeriodMonth} />
            <select
              name="area"
              defaultValue={selectedArea || mergedAreaOptions[0] || 'commercial_operations'}
              className="rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950"
            >
              {mergedAreaOptions.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
            <input
              name="kpiName"
              placeholder="KPI code/name (stable)"
              className="rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950"
              required
            />
            <input
              name="kpiLabel"
              placeholder="KPI label (display)"
              className="rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 lg:col-span-2"
              required
            />
            <input
              name="qtyUnit"
              placeholder="Unit (Days, %, Count...)"
              className="rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950"
            />
            <input
              name="targetValue"
              placeholder="Target value (e.g. 85%)"
              className="rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950"
              required
            />
            <input type="hidden" name="isActive" value="true" />
            <button
              type="submit"
              disabled={isPending}
              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50 lg:col-span-6 lg:justify-self-start"
            >
              {isPending ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </span>
              ) : (
                'Add target'
              )}
            </button>
          </form>
        ) : null}
      </article>

      <article className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.08)]">
        <div className="overflow-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-[11px] uppercase tracking-[0.16em] text-slate-500">
                <th className="px-4 py-3">Area</th>
                <th className="px-4 py-3">KPI Name</th>
                <th className="px-4 py-3">KPI Label</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.targetId}>
                  <td className="px-4 py-3 align-top">
                    <select
                      name="area"
                      form={`target-edit-${row.targetId}`}
                      defaultValue={row.area}
                      className="w-[180px] rounded-[10px] border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900"
                    >
                      {mergedAreaOptions.map((area) => (
                        <option key={area} value={area}>
                          {area}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <input
                      name="kpiName"
                      form={`target-edit-${row.targetId}`}
                      defaultValue={row.kpiName}
                      className="w-[280px] rounded-[10px] border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900"
                      required
                    />
                    {row.area === 'ra_quality_fv' ? (
                      <AnswerFieldChips
                        formId={`target-edit-${row.targetId}`}
                        defaultFields={row.formFields}
                      />
                    ) : null}
                    {row.area === 'legal_compliance' ? (
                      <LegalAnswerFieldChips
                        formId={`target-edit-${row.targetId}`}
                        defaultFields={row.formFields}
                      />
                    ) : null}
                    {row.area !== 'ra_quality_fv' && row.area !== 'legal_compliance' ? (
                      <input type="hidden" name="formFields" form={`target-edit-${row.targetId}`} value="" />
                    ) : null}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <input
                      name="kpiLabel"
                      form={`target-edit-${row.targetId}`}
                      defaultValue={row.kpiLabel ?? row.kpiName}
                      className="w-[320px] rounded-[10px] border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900"
                      required
                    />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <input
                      name="qtyUnit"
                      form={`target-edit-${row.targetId}`}
                      defaultValue={row.qtyUnit}
                      className="w-[110px] rounded-[10px] border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900"
                    />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <input
                      name="targetValue"
                      form={`target-edit-${row.targetId}`}
                      defaultValue={row.targetValueText || (row.targetValueNumeric == null ? '' : String(row.targetValueNumeric))}
                      className="w-[120px] rounded-[10px] border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900"
                      required
                    />
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-slate-600">
                    <p className="font-semibold">Rev {row.revisionNumber}</p>
                    <p>{formatUpdatedAt(row.updatedAt)}</p>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center gap-2">
                      <form id={`target-edit-${row.targetId}`} action={submitEdit}>
                        <input type="hidden" name="targetId" value={row.targetId} />
                        <input type="hidden" name="isActive" value={row.isActive ? 'true' : 'false'} />
                        <input type="hidden" name="reportingVersionId" value={row.reportingVersionId ?? selectedReportingVersionId} />
                        <input type="hidden" name="periodMonth" value={row.periodMonth ?? selectedPeriodMonth} />
                        <input
                          type="hidden"
                          name="sourceReportingVersionId"
                          value={row.reportingVersionId ?? selectedReportingVersionId}
                        />
                        <input type="hidden" name="sourcePeriodMonth" value={row.periodMonth ?? selectedPeriodMonth} />
                        <input type="hidden" name="selectedReportingVersionId" value={selectedReportingVersionId} />
                        <input type="hidden" name="selectedPeriodMonth" value={selectedPeriodMonth} />
                        <button
                          type="submit"
                          disabled={isPending}
                          className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-400"
                        >
                          Save
                        </button>
                      </form>
                      <form action={submitDelete}>
                        <input type="hidden" name="targetId" value={row.targetId} />
                        <button
                          type="submit"
                          disabled={isPending}
                          className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100"
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      {message ? (
        <p className="text-sm text-slate-700">{message}</p>
      ) : null}
    </div>
  );
}

function AnswerFieldChips({
  formId,
  defaultFields,
}: {
  formId: string;
  defaultFields: string | null;
}) {
  const [selectedFields, setSelectedFields] = useState<RaCountMetric[]>(
    parseRaCountFields(defaultFields),
  );

  function toggleField(field: RaCountMetric) {
    setSelectedFields((prev) =>
      prev.includes(field) ? prev.filter((item) => item !== field) : [...prev, field],
    );
  }

  return (
    <div className="mt-2 space-y-1.5">
      <input type="hidden" name="formFields" form={formId} value={selectedFields.join(',')} />
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Answer fields</p>
      <div className="flex flex-wrap gap-1.5">
        {RA_FORM_FIELD_OPTIONS.map((option) => {
          const selected = selectedFields.includes(option.key);
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => toggleField(option.key)}
              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.04em] ${
                selected
                  ? 'border-slate-950 bg-slate-950 text-white'
                  : 'border-slate-950 bg-white text-slate-950'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LegalAnswerFieldChips({
  formId,
  defaultFields,
}: {
  formId: string;
  defaultFields: string | null;
}) {
  const [selectedFields, setSelectedFields] = useState<LegalComplianceAnswerField[]>(
    parseLegalComplianceFields(defaultFields),
  );

  function toggleField(field: LegalComplianceAnswerField) {
    setSelectedFields((prev) =>
      prev.includes(field) ? prev.filter((item) => item !== field) : [...prev, field],
    );
  }

  return (
    <div className="mt-2 space-y-1.5">
      <input type="hidden" name="formFields" form={formId} value={selectedFields.join(',')} />
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Answer fields</p>
      <div className="flex flex-wrap gap-1.5">
        {LEGAL_FORM_FIELD_OPTIONS.map((option) => {
          const selected = selectedFields.includes(option.key);
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => toggleField(option.key)}
              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.04em] ${
                selected
                  ? 'border-slate-950 bg-slate-950 text-white'
                  : 'border-slate-950 bg-white text-slate-950'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
