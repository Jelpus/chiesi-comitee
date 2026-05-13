'use client';

import { useMemo, useState, useTransition } from 'react';
import { Edit3, Loader2, Mail, Plus, Send, ToggleLeft, ToggleRight, X } from 'lucide-react';
import { requestFormsInfoAction, saveFormResponsibleAction, setFormResponsibleActiveAction } from '@/app/admin/actions';
import type { FormResponsibleRow } from '@/lib/data/form-responsibles';

type FormState = {
  formCode: string;
  ownerName: string;
  emailOwner: string;
  notes: string;
  isActive: boolean;
};

type Props = {
  rows: FormResponsibleRow[];
  periodMonth: string;
};

const emptyForm: FormState = {
  formCode: 'regulatory_affairs',
  ownerName: '',
  emailOwner: '',
  notes: '',
  isActive: true,
};

const formDefinitions = [
  { formCode: 'regulatory_affairs', formLabel: 'Regulatory Affairs' },
  { formCode: 'legal_compliance', formLabel: 'Legal & Compliance' },
  { formCode: 'medical', formLabel: 'Medical' },
];

function toForm(row: FormResponsibleRow): FormState {
  return {
    formCode: row.formCode,
    ownerName: row.ownerName ?? '',
    emailOwner: row.emailOwner,
    notes: row.notes ?? '',
    isActive: row.isActive,
  };
}

function buildFormData(form: FormState) {
  const formData = new FormData();
  formData.set('formCode', form.formCode);
  formData.set('ownerName', form.ownerName.trim());
  formData.set('emailOwner', form.emailOwner.trim());
  formData.set('notes', form.notes.trim());
  formData.set('isActive', String(form.isActive));
  return formData;
}

export function FormResponsiblesManager({ rows, periodMonth }: Props) {
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [message, setMessage] = useState('');

  const activeCount = useMemo(() => rows.filter((row) => row.isActive).length, [rows]);

  function openCreate() {
    setForm(emptyForm);
    setMessage('');
    setIsOpen(true);
  }

  function openEdit(row: FormResponsibleRow) {
    setForm(toForm(row));
    setMessage('');
    setIsOpen(true);
  }

  function submit() {
    setMessage('');
    startTransition(async () => {
      try {
        await saveFormResponsibleAction(buildFormData(form));
        setMessage('Responsible saved.');
        setIsOpen(false);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Could not save responsible.');
      }
    });
  }

  function toggle(row: FormResponsibleRow) {
    const formData = new FormData();
    formData.set('formCode', row.formCode);
    formData.set('emailOwner', row.emailOwner);
    formData.set('isActive', String(!row.isActive));

    setMessage('');
    startTransition(async () => {
      try {
        await setFormResponsibleActiveAction(formData);
        setMessage(row.isActive ? 'Responsible disabled.' : 'Responsible enabled.');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Could not update responsible.');
      }
    });
  }

  function requestFormsInfo() {
    const confirmed = window.confirm('Send Request Info emails only to active form responsibles?');
    if (!confirmed) return;

    const formData = new FormData();
    formData.set('periodMonth', periodMonth);
    setMessage('');
    startTransition(async () => {
      try {
        const result = await requestFormsInfoAction(formData);
        setMessage(`Forms Request Info sent to ${result.sent} responsible(s).`);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Could not send forms Request Info.');
      }
    });
  }

  return (
    <div className="mt-4 rounded-[14px] border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950">Form responsibles</p>
          <p className="mt-1 text-xs text-slate-600">
            {activeCount}/{rows.length} active recipients for Request Info emails.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white hover:bg-slate-800"
        >
          <Plus className="h-3.5 w-3.5" />
          Add responsible
        </button>
        <button
          type="button"
          onClick={requestFormsInfo}
          disabled={isPending || activeCount === 0}
          className="inline-flex items-center gap-2 rounded-full border border-blue-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-blue-700 hover:border-blue-400 disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Request forms info
        </button>
      </div>

      {message ? <p className="mt-3 text-xs font-medium text-slate-700">{message}</p> : null}

      <div className="mt-3 overflow-hidden rounded-[12px] border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-[11px] uppercase tracking-[0.16em] text-slate-500">
              <th className="px-4 py-3">Form</th>
              <th className="px-4 py-3">Responsible</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Notes</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={`${row.formCode}:${row.emailOwner}`}>
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-900">{row.formLabel}</p>
                  <p className="mt-1 font-mono text-xs text-slate-500">{row.formPath}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-800">{row.ownerName || 'Unassigned'}</p>
                  <a href={`mailto:${row.emailOwner}`} className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate-500">
                    <Mail className="h-3.5 w-3.5" />
                    {row.emailOwner}
                  </a>
                </td>
                <td className="px-4 py-3">
                  <span className={row.isActive ? 'text-xs font-bold uppercase text-emerald-700' : 'text-xs font-bold uppercase text-slate-500'}>
                    {row.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="max-w-[260px] px-4 py-3 text-slate-600">{row.notes || 'N/A'}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(row)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => toggle(row)}
                      disabled={isPending}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {row.isActive ? <ToggleLeft className="h-3.5 w-3.5" /> : <ToggleRight className="h-3.5 w-3.5" />}
                      {row.isActive ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                  No form responsibles configured yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close form responsible modal"
            className="absolute inset-0 cursor-default bg-slate-950/50"
            onClick={() => setIsOpen(false)}
          />
          <section className="relative w-full max-w-xl rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_30px_100px_rgba(15,23,42,0.35)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Forms</p>
                <h2 className="mt-2 text-xl font-bold text-slate-950">Responsible</h2>
              </div>
              <button type="button" onClick={() => setIsOpen(false)} className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid gap-4">
              <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                Form
                <select
                  value={form.formCode}
                  onChange={(event) => setForm((current) => ({ ...current, formCode: event.target.value }))}
                  className="rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950"
                >
                  {formDefinitions.map((definition) => (
                    <option key={definition.formCode} value={definition.formCode}>
                      {definition.formLabel}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                Name
                <input
                  value={form.ownerName}
                  onChange={(event) => setForm((current) => ({ ...current, ownerName: event.target.value }))}
                  className="rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                Email
                <input
                  type="email"
                  value={form.emailOwner}
                  onChange={(event) => setForm((current) => ({ ...current, emailOwner: event.target.value }))}
                  required
                  className="rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                Notes
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  rows={3}
                  className="rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950"
                />
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                />
                Active
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setIsOpen(false)} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
