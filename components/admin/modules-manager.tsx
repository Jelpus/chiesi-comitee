'use client';

import type { FormEvent, ReactNode } from 'react';
import { useEffect, useMemo, useState, useTransition } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Edit3,
  Layers3,
  Loader2,
  Mail,
  Plus,
  RefreshCcw,
  Search,
  ToggleLeft,
  ToggleRight,
  X,
} from 'lucide-react';
import { disableModule, enableModule, saveModule, syncDefaultModules } from '@/app/admin/modules/actions';
import type { ModuleRow } from '@/lib/data/modules';
import { SOURCE_PERIOD_OFFSETS, sourcePeriodPolicyLabel } from '@/lib/uploads/source-period-policy';

type ModulesManagerProps = {
  rows: ModuleRow[];
};

type ModalMode = 'create' | 'edit';

type Feedback = {
  type: 'success' | 'error';
  text: string;
};

type ModuleFormState = {
  moduleCode: string;
  moduleName: string;
  areaCode: string;
  moduleType: string;
  sourcePeriodOffsetMonths: string;
  ownerName: string;
  emailOwner: string;
  displayOrder: string;
  notes: string;
  isActive: boolean;
};

const areaOptions = [
  { value: 'sales_internal', label: 'Sales Internal' },
  { value: 'business_excellence', label: 'Business Excellence' },
  { value: 'commercial_operations', label: 'Commercial Operations' },
  { value: 'human_resources', label: 'Human Resources' },
  { value: 'medical', label: 'Medical' },
  { value: 'opex', label: 'OPEX' },
  { value: 'ra_quality_fv', label: 'RA - Quality - FV' },
  { value: 'legal_compliance', label: 'Legal & Compliance' },
  { value: 'other', label: 'Other' },
];

const emptyForm: ModuleFormState = {
  moduleCode: '',
  moduleName: '',
  areaCode: 'other',
  moduleType: '',
  sourcePeriodOffsetMonths: '0',
  ownerName: '',
  emailOwner: '',
  displayOrder: '',
  notes: '',
  isActive: true,
};

function getAreaLabel(areaCode: string) {
  return areaOptions.find((area) => area.value === areaCode)?.label ?? areaCode;
}

function rowToForm(row: ModuleRow): ModuleFormState {
  return {
    moduleCode: row.moduleCode,
    moduleName: row.moduleName,
    areaCode: row.areaCode ?? 'other',
    moduleType: row.moduleType ?? '',
    sourcePeriodOffsetMonths: String(row.sourcePeriodOffsetMonths),
    ownerName: row.ownerName ?? '',
    emailOwner: row.emailOwner ?? '',
    displayOrder: row.displayOrder === null || row.displayOrder === undefined ? '' : String(row.displayOrder),
    notes: row.notes ?? '',
    isActive: row.isActive,
  };
}

function buildFormData(form: ModuleFormState) {
  const formData = new FormData();

  formData.set('moduleCode', form.moduleCode.trim());
  formData.set('moduleName', form.moduleName.trim());
  formData.set('areaCode', form.areaCode);
  formData.set('moduleType', form.moduleType.trim());
  formData.set('sourcePeriodOffsetMonths', form.sourcePeriodOffsetMonths);
  formData.set('ownerName', form.ownerName.trim());
  formData.set('emailOwner', form.emailOwner.trim());
  formData.set('displayOrder', form.displayOrder.trim());
  formData.set('notes', form.notes.trim());
  formData.set('isActive', String(form.isActive));
  formData.set('updatedBy', 'admin_panel');

  return formData;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function FieldLabel({ children, required = false }: { children: ReactNode; required?: boolean }) {
  return (
    <label className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
      {children}
      {required ? <span className="ml-1 text-rose-500">*</span> : null}
    </label>
  );
}

function EmptyState({ onCreate, onSync }: { onCreate: () => void; onSync: () => void }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-slate-50/80 p-8 text-center">
      <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <Layers3 className="h-8 w-8 text-slate-700" />
      </div>
      <h3 className="text-lg font-bold text-slate-950">No modules found</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
        Start by creating a module manually or sync the default catalog to populate the admin panel.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/15 transition hover:-translate-y-0.5 hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" />
          New module
        </button>
        <button
          type="button"
          onClick={onSync}
          className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-400 hover:bg-slate-50"
        >
          <RefreshCcw className="h-4 w-4" />
          Sync defaults
        </button>
      </div>
    </div>
  );
}

function ModuleModal({
  isOpen,
  mode,
  form,
  isPending,
  onClose,
  onSubmit,
  onChange,
}: {
  isOpen: boolean;
  mode: ModalMode;
  form: ModuleFormState;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: (patch: Partial<ModuleFormState>) => void;
}) {
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const title = mode === 'create' ? 'Create module' : 'Edit module';
  const description =
    mode === 'create'
      ? 'Add a new module to the catalog with ownership, area and visibility information.'
      : 'Update the module details without editing directly inside the table.';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close modal"
        className="absolute inset-0 cursor-default bg-slate-950/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="module-modal-title"
        className="relative max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-[32px] border border-white/20 bg-white shadow-[0_30px_100px_rgba(15,23,42,0.35)]"
      >
        <div className="border-b border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-5 text-white sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">Modules catalog</p>
              <h2 id="module-modal-title" className="mt-2 text-2xl font-bold tracking-tight">
                {title}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{description}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/70"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <form onSubmit={onSubmit} className="max-h-[calc(92vh-140px)] overflow-y-auto p-6 sm:p-8">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <FieldLabel required>Module code</FieldLabel>
              <input
                value={form.moduleCode}
                onChange={(event) => onChange({ moduleCode: event.target.value })}
                disabled={mode === 'edit'}
                placeholder="module_code"
                required
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
              />
              {mode === 'edit' ? (
                <p className="text-xs text-slate-500">The module code is used as the unique identifier.</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <FieldLabel required>Module name</FieldLabel>
              <input
                value={form.moduleName}
                onChange={(event) => onChange({ moduleName: event.target.value })}
                placeholder="Module name"
                required
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              />
            </div>

            <div className="space-y-2">
              <FieldLabel>Area</FieldLabel>
              <select
                value={form.areaCode}
                onChange={(event) => onChange({ areaCode: event.target.value })}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-950 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              >
                {areaOptions.map((area) => (
                  <option key={area.value} value={area.value}>
                    {area.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <FieldLabel>Display order</FieldLabel>
              <input
                value={form.displayOrder}
                onChange={(event) => onChange({ displayOrder: event.target.value })}
                type="number"
                placeholder="0"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              />
            </div>

            <div className="space-y-2">
              <FieldLabel>Module type</FieldLabel>
              <input
                value={form.moduleType}
                onChange={(event) => onChange({ moduleType: event.target.value })}
                placeholder="source / catalog / reusable"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              />
            </div>

            <div className="space-y-2">
              <FieldLabel>Periodo esperado del archivo</FieldLabel>
              <select
                value={form.sourcePeriodOffsetMonths}
                onChange={(event) => onChange({ sourcePeriodOffsetMonths: event.target.value })}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-950 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              >
                {SOURCE_PERIOD_OFFSETS.map((offset) => (
                  <option key={offset} value={offset}>
                    {sourcePeriodPolicyLabel(offset)} · {offset === 0 ? 'mismo mes de la versión' : `${offset} mes${offset === 1 ? '' : 'es'} antes`}
                  </option>
                ))}
              </select>
              <p className="text-xs leading-5 text-slate-500">
                Prepare calculará y bloqueará el último mes esperado según esta regla.
              </p>
            </div>

            <div className="space-y-2">
              <FieldLabel>Owner name</FieldLabel>
              <input
                value={form.ownerName}
                onChange={(event) => onChange({ ownerName: event.target.value })}
                placeholder="Owner name"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              />
            </div>

            <div className="space-y-2">
              <FieldLabel>Owner email</FieldLabel>
              <input
                value={form.emailOwner}
                onChange={(event) => onChange({ emailOwner: event.target.value })}
                type="email"
                placeholder="owner@company.com"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <FieldLabel>Notes</FieldLabel>
              <textarea
                value={form.notes}
                onChange={(event) => onChange({ notes: event.target.value })}
                placeholder="Internal notes, context or ownership details..."
                rows={4}
                className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              />
            </div>

            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:col-span-2">
              <div>
                <p className="text-sm font-bold text-slate-950">Module status</p>
                <p className="mt-1 text-xs text-slate-500">Inactive modules remain saved but hidden from active workflows.</p>
              </div>
              <button
                type="button"
                onClick={() => onChange({ isActive: !form.isActive })}
                className={cn(
                  'inline-flex min-w-[104px] items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] transition',
                  form.isActive ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700',
                )}
              >
                {form.isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                {form.isActive ? 'Active' : 'Inactive'}
              </button>
            </label>
          </div>

          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-slate-900/15 transition hover:bg-slate-800 disabled:opacity-50"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === 'create' ? <Plus className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
              {isPending ? 'Saving...' : mode === 'create' ? 'Create module' : 'Save changes'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function ModulesManager({ rows }: ModulesManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [query, setQuery] = useState('');
  const [areaFilter, setAreaFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<ModuleFormState>(emptyForm);

  const stats = useMemo(() => {
    const active = rows.filter((row) => row.isActive).length;
    const inactive = rows.length - active;
    const areas = new Set(rows.map((row) => row.areaCode).filter(Boolean)).size;

    return { total: rows.length, active, inactive, areas };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesQuery = normalizedQuery
        ? [row.moduleCode, row.moduleName, row.moduleType, row.ownerName, row.emailOwner, row.notes]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(normalizedQuery))
        : true;

      const matchesArea = areaFilter === 'all' ? true : row.areaCode === areaFilter;
      const matchesStatus =
        statusFilter === 'all' ? true : statusFilter === 'active' ? row.isActive : !row.isActive;

      return matchesQuery && matchesArea && matchesStatus;
    });
  }, [areaFilter, query, rows, statusFilter]);

  function runAction(task: () => Promise<unknown>, success: string, options?: { closeModal?: boolean; resetForm?: boolean }) {
    setFeedback(null);

    startTransition(async () => {
      try {
        await task();
        setFeedback({ type: 'success', text: success });

        if (options?.resetForm) setForm(emptyForm);
        if (options?.closeModal) setIsModalOpen(false);
      } catch (error) {
        setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Action failed.' });
      }
    });
  }

  function openCreateModal() {
    setModalMode('create');
    setForm(emptyForm);
    setFeedback(null);
    setIsModalOpen(true);
  }

  function openEditModal(row: ModuleRow) {
    setModalMode('edit');
    setForm(rowToForm(row));
    setFeedback(null);
    setIsModalOpen(true);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    runAction(() => saveModule(buildFormData(form)), modalMode === 'create' ? 'Module created.' : 'Module updated.', {
      closeModal: true,
      resetForm: modalMode === 'create',
    });
  }

  function handleToggleStatus(row: ModuleRow) {
    const formData = new FormData();
    formData.set('moduleCode', row.moduleCode);

    runAction(
      () => (row.isActive ? disableModule(formData) : enableModule(formData)),
      row.isActive ? 'Module disabled.' : 'Module enabled.',
    );
  }

  function handleSyncDefaults() {
    runAction(() => syncDefaultModules(), 'Default modules synced.');
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_20px_70px_rgba(15,23,42,0.08)]">
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">Admin configuration</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Modules Manager</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Manage the module catalog with a cleaner workflow, quick filters, clear status indicators and modal-based editing.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSyncDefaults}
                disabled={isPending}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/10 px-5 py-2.5 text-sm font-bold text-white backdrop-blur transition hover:bg-white/15 disabled:opacity-50"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                Sync defaults
              </button>
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-slate-950 shadow-xl shadow-black/20 transition hover:-translate-y-0.5 hover:bg-slate-100"
              >
                <Plus className="h-4 w-4" />
                New module
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 border-b border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-2 lg:grid-cols-4 lg:p-6">
          {[
            { label: 'Total modules', value: stats.total },
            { label: 'Active', value: stats.active },
            { label: 'Inactive', value: stats.inactive },
            { label: 'Areas', value: stats.areas },
          ].map((item) => (
            <div key={item.label} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{item.label}</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:p-6">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by module, owner, email or notes..."
              className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:w-[420px]">
            <select
              value={areaFilter}
              onChange={(event) => setAreaFilter(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-950 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
            >
              <option value="all">All areas</option>
              {areaOptions.map((area) => (
                <option key={area.value} value={area.value}>
                  {area.label}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'inactive')}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-950 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
            >
              <option value="all">All statuses</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </select>
          </div>
        </div>

        {feedback ? (
          <div
            className={cn(
              'mx-4 mt-4 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold lg:mx-6',
              feedback.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-rose-200 bg-rose-50 text-rose-800',
            )}
          >
            {feedback.type === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4" /> : <AlertCircle className="mt-0.5 h-4 w-4" />}
            <span>{feedback.text}</span>
          </div>
        ) : null}

        <div className="p-4 lg:p-6">
          {rows.length === 0 ? (
            <EmptyState onCreate={openCreateModal} onSync={handleSyncDefaults} />
          ) : (
            <div className="overflow-hidden rounded-[24px] border border-slate-200">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                      <th className="px-5 py-4">Module</th>
                      <th className="px-5 py-4">Area</th>
                      <th className="px-5 py-4">Periodo</th>
                      <th className="px-5 py-4">Owner</th>
                      <th className="px-5 py-4">Notes</th>
                      <th className="px-5 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredRows.map((row) => (
                      <tr key={row.moduleCode} className="transition hover:bg-slate-50/80">
                        <td className="px-5 py-4 align-top">
                          <p className="font-bold text-slate-950">{row.moduleName}</p>
                          <p className="mt-1 font-mono text-xs text-slate-500">{row.moduleCode}</p>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                            {getAreaLabel(row.areaCode)}
                          </span>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black text-blue-800">
                            {sourcePeriodPolicyLabel(row.sourcePeriodOffsetMonths)}
                          </span>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <p className="font-semibold text-slate-800">{row.ownerName || 'Unassigned'}</p>
                          {row.emailOwner ? (
                            <a
                              href={`mailto:${row.emailOwner}`}
                              className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-950"
                            >
                              <Mail className="h-3.5 w-3.5" />
                              {row.emailOwner}
                            </a>
                          ) : (
                            <p className="mt-1 text-xs text-slate-400">No email</p>
                          )}
                        </td>
                        <td className="max-w-[260px] px-5 py-4 align-top text-sm leading-6 text-slate-500">
                          {row.notes || <span className="text-slate-400">No notes</span>}
                        </td>
                        <td className="px-5 py-4 align-top">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(row)}
                              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(row)}
                              disabled={isPending}
                              className={cn(
                                'inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold transition disabled:opacity-50',
                                row.isActive
                                  ? 'border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                                  : 'border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
                              )}
                            >
                              {row.isActive ? <ToggleLeft className="h-3.5 w-3.5" /> : <ToggleRight className="h-3.5 w-3.5" />}
                              {row.isActive ? 'Disable' : 'Enable'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {filteredRows.length === 0 ? (
                      <tr>
                        <td className="px-5 py-12 text-center" colSpan={6}>
                          <p className="font-bold text-slate-950">No results match your filters</p>
                          <p className="mt-1 text-sm text-slate-500">Try changing the search term, area or status filter.</p>
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>

      <ModuleModal
        isOpen={isModalOpen}
        mode={modalMode}
        form={form}
        isPending={isPending}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
      />
    </div>
  );
}
