'use client';

import { useMemo, useState, useTransition } from 'react';
import { CalendarPlus, Edit3, Loader2, Play, ToggleLeft, ToggleRight, X } from 'lucide-react';
import {
  runPlanningAutomationAction,
  saveCommitteePlanAction,
  setCommitteePlanActiveAction,
} from '@/app/admin/planning/actions';
import type { AppSettings } from '@/lib/data/app-settings';
import type { CommitteePlan, PlanningEventType } from '@/lib/data/committee-planning';
import { getMexicoCityDate } from '@/lib/time/mexico-city';

type PlanForm = {
  planningId: string;
  periodMonth: string;
  committeeDate: string;
  requestInfoDate: string;
  reminder1Date: string;
  reminder2Date: string;
  validationDate: string;
  isActive: boolean;
  notes: string;
};

const events: Array<{ type: PlanningEventType; label: string; dateKey: keyof PlanForm }> = [
  { type: 'open_request_info', label: 'Open v1 + Request Info', dateKey: 'requestInfoDate' },
  { type: 'reminder_1', label: 'Reminder 1', dateKey: 'reminder1Date' },
  { type: 'reminder_2', label: 'Reminder 2', dateKey: 'reminder2Date' },
  { type: 'validation', label: 'Validation window starts', dateKey: 'validationDate' },
];

function subtractDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

function emptyForm(): PlanForm {
  return {
    planningId: '', periodMonth: '', committeeDate: '', requestInfoDate: '', reminder1Date: '', reminder2Date: '',
    validationDate: '', isActive: true, notes: '',
  };
}

function planToForm(plan: CommitteePlan): PlanForm {
  return {
    planningId: plan.planningId,
    periodMonth: plan.periodMonth,
    committeeDate: plan.committeeDate,
    requestInfoDate: plan.requestInfoDate,
    reminder1Date: plan.reminder1Date,
    reminder2Date: plan.reminder2Date,
    validationDate: plan.validationDate,
    isActive: plan.isActive,
    notes: plan.notes ?? '',
  };
}

function eventStatus(plan: CommitteePlan, eventType: PlanningEventType, scheduledDate: string) {
  const log = plan.events[eventType];
  if (log?.scheduledDate === scheduledDate && log.status === 'succeeded') return { label: 'Done', className: 'bg-emerald-50 text-emerald-700' };
  if (log?.scheduledDate === scheduledDate && log.status === 'failed') return { label: 'Failed', className: 'bg-rose-50 text-rose-700' };
  if (!plan.isActive) return { label: 'Paused', className: 'bg-slate-100 text-slate-500' };
  if (scheduledDate < getMexicoCityDate()) return { label: 'Due', className: 'bg-amber-50 text-amber-700' };
  return { label: 'Scheduled', className: 'bg-blue-50 text-blue-700' };
}

export function CommitteePlanningManager({ plans, settings }: { plans: CommitteePlan[]; settings: AppSettings }) {
  const [form, setForm] = useState<PlanForm>(() => emptyForm());
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const sortedPlans = useMemo(() => [...plans].sort((a, b) => b.committeeDate.localeCompare(a.committeeDate)), [plans]);

  function updateCommitteeDate(committeeDate: string) {
    setForm((current) => ({
      ...current,
      committeeDate,
      reminder1Date: committeeDate ? subtractDays(committeeDate, settings.reminder1DaysBefore) : '',
      reminder2Date: committeeDate ? subtractDays(committeeDate, settings.reminder2DaysBefore) : '',
      validationDate: committeeDate ? subtractDays(committeeDate, settings.validationDaysBefore) : '',
    }));
  }

  function submit() {
    const data = new FormData();
    for (const [key, value] of Object.entries(form)) data.set(key, String(value));
    setBusyKey('save');
    setMessage('');
    startTransition(async () => {
      try {
        await saveCommitteePlanAction(data);
        setIsOpen(false);
        setMessage('Committee planning saved.');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Could not save planning.');
      } finally {
        setBusyKey(null);
      }
    });
  }

  function toggle(plan: CommitteePlan) {
    const data = new FormData();
    data.set('planningId', plan.planningId);
    data.set('isActive', String(!plan.isActive));
    setBusyKey(plan.planningId);
    startTransition(async () => {
      try {
        await setCommitteePlanActiveAction(data);
        setMessage(plan.isActive ? 'Automation paused.' : 'Automation enabled.');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Could not update planning.');
      } finally {
        setBusyKey(null);
      }
    });
  }

  function runNow() {
    if (!window.confirm('Process all due and uncompleted planning events now? This may send emails.')) return;
    setBusyKey('run');
    setMessage('');
    startTransition(async () => {
      try {
        const result = await runPlanningAutomationAction();
        setMessage(`Automation finished: ${result.processed} processed, ${result.skipped} skipped, ${result.failed} failed.`);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Automation failed.');
      } finally {
        setBusyKey(null);
      }
    });
  }

  return (
    <div className="space-y-4">
      <article className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-950">Committee calendar</p>
            <p className="mt-1 text-xs text-slate-600">Daily automation runs in Mexico City time and catches up uncompleted past events.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={runNow} disabled={isPending} className="inline-flex items-center gap-2 rounded-full border border-blue-300 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-blue-700 disabled:opacity-50">
              {busyKey === 'run' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Run due now
            </button>
            <button type="button" onClick={() => { setForm(emptyForm()); setMessage(''); setIsOpen(true); }} className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-white">
              <CalendarPlus className="h-4 w-4" /> Add Committee
            </button>
          </div>
        </div>
        {message ? <p className="mt-3 text-sm text-slate-700">{message}</p> : null}
      </article>

      <div className="grid gap-4 xl:grid-cols-2">
        {sortedPlans.map((plan) => (
          <article key={plan.planningId} className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Period {plan.periodMonth}</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-950">Committee · {plan.committeeDate}</h2>
                <p className="mt-1 font-mono text-xs text-slate-500">{plan.reportingVersionId || 'v1 will be created automatically'}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${plan.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {plan.isActive ? 'Active' : 'Paused'}
              </span>
            </div>
            <div className="mt-4 space-y-2">
              {events.map((event) => {
                const scheduledDate = String(plan[event.dateKey as keyof CommitteePlan] ?? '');
                const status = eventStatus(plan, event.type, scheduledDate);
                return (
                  <div key={event.type} className="flex items-center justify-between gap-3 rounded-[12px] border border-slate-100 bg-slate-50 px-3 py-2.5">
                    <div><p className="text-sm font-semibold text-slate-800">{event.label}</p><p className="text-xs text-slate-500">{scheduledDate}</p></div>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${status.className}`}>{status.label}</span>
                  </div>
                );
              })}
            </div>
            {plan.notes ? <p className="mt-3 text-xs text-slate-500">{plan.notes}</p> : null}
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => { setForm(planToForm(plan)); setMessage(''); setIsOpen(true); }} className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"><Edit3 className="h-3.5 w-3.5" /> Edit</button>
              <button type="button" onClick={() => toggle(plan)} disabled={isPending && busyKey === plan.planningId} className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50">
                {plan.isActive ? <ToggleLeft className="h-3.5 w-3.5" /> : <ToggleRight className="h-3.5 w-3.5" />} {plan.isActive ? 'Pause' : 'Enable'}
              </button>
            </div>
          </article>
        ))}
        {plans.length === 0 ? <p className="rounded-[20px] border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">No Committee dates scheduled yet.</p> : null}
      </div>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Close planning editor" className="absolute inset-0 bg-slate-950/50" onClick={() => setIsOpen(false)} />
          <section className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[24px] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Planning</p><h2 className="mt-1 text-xl font-bold text-slate-950">{form.planningId ? 'Edit Committee' : 'Schedule Committee'}</h2></div><button type="button" onClick={() => setIsOpen(false)} className="rounded-full p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Reporting period<input type="month" value={form.periodMonth} onChange={(event) => setForm((current) => ({ ...current, periodMonth: event.target.value }))} className="rounded-[12px] border border-slate-200 px-3 py-2 font-normal" required /></label>
              <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Committee date<input type="date" value={form.committeeDate} onChange={(event) => updateCommitteeDate(event.target.value)} className="rounded-[12px] border border-slate-200 px-3 py-2 font-normal" required /></label>
              <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                Open v1 + Request Info
                <input type="date" value={form.periodMonth ? `${form.periodMonth}-01` : ''} className="rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2 font-normal text-slate-500" readOnly />
                <span className="text-xs font-normal text-slate-500">Always the first day of the reporting period.</span>
              </label>
              {events.filter((event) => event.type !== 'open_request_info').map((event) => (
                <label key={event.type} className="grid gap-1.5 text-sm font-semibold text-slate-700">{event.label}<input type="date" value={String(form[event.dateKey])} onChange={(e) => setForm((current) => ({ ...current, [event.dateKey]: e.target.value }))} className="rounded-[12px] border border-slate-200 px-3 py-2 font-normal" required /></label>
              ))}
              <label className="grid gap-1.5 text-sm font-semibold text-slate-700 sm:col-span-2">Notes<textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className="min-h-20 rounded-[12px] border border-slate-200 px-3 py-2 font-normal" /></label>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} /> Automation active</label>
            </div>
            <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setIsOpen(false)} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button><button type="button" onClick={submit} disabled={isPending && busyKey === 'save'} className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busyKey === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save planning</button></div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
