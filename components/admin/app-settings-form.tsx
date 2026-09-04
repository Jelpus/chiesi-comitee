'use client';

import { useState, useTransition } from 'react';
import { Loader2, Save } from 'lucide-react';
import { saveAppSettings } from '@/app/admin/settings/actions';
import type { AppSettings } from '@/lib/data/app-settings';

export function AppSettingsForm({ settings }: { settings: AppSettings }) {
  const [form, setForm] = useState(settings);
  const [message, setMessage] = useState('');
  const [isPending, startTransition] = useTransition();

  function setNumber(key: keyof AppSettings, value: string) {
    setForm((current) => ({ ...current, [key]: Number(value) }));
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData();
        for (const [key, value] of Object.entries(form)) data.set(key, String(value));
        setMessage('');
        startTransition(async () => {
          try {
            await saveAppSettings(data);
            setMessage('Settings saved. New emails will use this responsible immediately.');
          } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Could not save settings.');
          }
        });
      }}
    >
      <article className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Committee responsible</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Name
            <input
              name="committeeResponsibleName"
              value={form.committeeResponsibleName}
              onChange={(event) => setForm((current) => ({ ...current, committeeResponsibleName: event.target.value }))}
              className="rounded-[12px] border border-slate-200 px-3 py-2 font-normal text-slate-950"
              required
            />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Email
            <input
              name="committeeResponsibleEmail"
              type="email"
              value={form.committeeResponsibleEmail}
              onChange={(event) => setForm((current) => ({ ...current, committeeResponsibleEmail: event.target.value }))}
              className="rounded-[12px] border border-slate-200 px-3 py-2 font-normal text-slate-950"
              required
            />
          </label>
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500">
          This address receives mandatory copies and the Request Info / reminder summaries.
        </p>
      </article>

      <article className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Default planning rules</p>
        <p className="mt-2 text-sm text-slate-600">Used to calculate reminder and validation dates when a new Committee is added. Every calculated date remains editable.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {([
            ['reminder1DaysBefore', 'Reminder 1'],
            ['reminder2DaysBefore', 'Reminder 2'],
            ['validationDaysBefore', 'Validation window starts'],
          ] as const).map(([key, label]) => (
            <label key={key} className="grid gap-1.5 text-sm font-semibold text-slate-700">
              {label}
              <span className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={form[key]}
                  onChange={(event) => setNumber(key, event.target.value)}
                  className="min-w-0 flex-1 rounded-[12px] border border-slate-200 px-3 py-2 font-normal text-slate-950"
                  required
                />
                <span className="text-xs font-normal text-slate-500">days before</span>
              </span>
            </label>
          ))}
        </div>
      </article>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save settings
        </button>
        {message ? <p className="text-sm text-slate-700">{message}</p> : null}
      </div>
    </form>
  );
}
