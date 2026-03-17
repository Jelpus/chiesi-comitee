'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  saveExecutivePreReadActionState,
  saveHomeStatusActionState,
  type AdminActionState,
} from '@/app/admin/actions';

const INITIAL_STATE: AdminActionState = {
  ok: false,
  message: '',
  completedAt: null,
};

function SubmitButton({
  idleLabel,
  pendingLabel,
  className,
}: {
  idleLabel: string;
  pendingLabel: string;
  className: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}

function ActionStatus({ state }: { state: AdminActionState }) {
  const { pending } = useFormStatus();
  if (pending) {
    return (
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        Generating...
      </span>
    );
  }
  if (!state.ok) return null;
  return (
    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
      {state.message}
    </span>
  );
}

export function AdminSyncActions({
  reportingVersionId,
  periodMonth,
}: {
  reportingVersionId: string;
  periodMonth: string;
}) {
  const [homeState, homeFormAction] = useActionState(saveHomeStatusActionState, INITIAL_STATE);
  const [preReadState, preReadFormAction] = useActionState(saveExecutivePreReadActionState, INITIAL_STATE);

  return (
    <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
      <form action={homeFormAction} className="flex items-center gap-2">
        <input type="hidden" name="reportingVersionId" value={reportingVersionId} />
        <input type="hidden" name="periodMonth" value={periodMonth} />
        <SubmitButton
          idleLabel="Save Home Status"
          pendingLabel="Generating..."
          className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
        />
        <ActionStatus state={homeState} />
      </form>

      <form action={preReadFormAction} className="flex items-center gap-2">
        <input type="hidden" name="reportingVersionId" value={reportingVersionId} />
        <input type="hidden" name="periodMonth" value={periodMonth} />
        <SubmitButton
          idleLabel="Save Pre-Read Paper"
          pendingLabel="Generating..."
          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700 hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-70"
        />
        <ActionStatus state={preReadState} />
      </form>
    </div>
  );
}
