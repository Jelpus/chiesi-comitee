'use client';

import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import {
  closeReportingVersion,
  createReportingVersion,
  deleteReportingVersion,
  markReportingVersionReady,
  notifyReportingVersionReadyValidation,
  requestReportingVersionInfo,
  sendReadyValidationTestEmail,
} from '@/app/admin/versions/actions';
import { AdminStatusBadge } from '@/components/ui/admin-status-badge';
import type { VersionRow } from '@/lib/data/versions/get-versions-page-data';

type VersionsTableProps = {
  rows: VersionRow[];
};

function formatPeriod(periodMonth: string) {
  const date = new Date(`${periodMonth}T00:00:00`);
  if (Number.isNaN(date.getTime())) return periodMonth;
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatCreatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || '-';
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function VersionsTable({ rows }: VersionsTableProps) {
  const [isPending, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [readyCandidate, setReadyCandidate] = useState<VersionRow | null>(null);
  const [readyNotifyStep, setReadyNotifyStep] = useState(false);
  const [committeeMeetingDate, setCommitteeMeetingDate] = useState('');
  const [periodMonth, setPeriodMonth] = useState('');
  const [versionName, setVersionName] = useState('');
  const [createdBy, setCreatedBy] = useState('admin_panel');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');

  const sortedRows = [...rows].sort((a, b) => {
    const byPeriod = b.periodMonth.localeCompare(a.periodMonth);
    if (byPeriod !== 0) return byPeriod;
    if (b.versionNumber !== a.versionNumber) return b.versionNumber - a.versionNumber;
    return b.createdAt.localeCompare(a.createdAt);
  });

  const closeReadyModal = () => {
    setReadyCandidate(null);
    setReadyNotifyStep(false);
    setCommitteeMeetingDate('');
  };

  const confirmReady = (notify: boolean) => {
    if (!readyCandidate) return;
    const row = readyCandidate;
    const meetingDate = committeeMeetingDate;
    if (notify && !meetingDate) {
      setMessage('Indica la fecha prevista de la proxima reunion de Committee.');
      return;
    }
    setMessage('');
    closeReadyModal();
    setBusyKey(row.reportingVersionId);
    startTransition(async () => {
      try {
        if (row.status !== 'ready_to_show') {
          await markReportingVersionReady({ reportingVersionId: row.reportingVersionId });
        }
        if (notify) {
          const result = await notifyReportingVersionReadyValidation({
            reportingVersionId: row.reportingVersionId,
            periodMonth: row.periodMonth,
            committeeMeetingDate: meetingDate,
          });
          setMessage(`Version ${row.versionName} marked ready to show. Validation emails sent to ${result.sent} owner(s).`);
        } else {
          setMessage(`Version ${row.versionName} marked ready to show.`);
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Failed to update version status.');
      } finally {
        setBusyKey(null);
      }
    });
  };

  const sendReadyTest = () => {
    if (!readyCandidate || !committeeMeetingDate) return;
    const row = readyCandidate;
    const meetingDate = committeeMeetingDate;
    setMessage('');
    setBusyKey(`${row.reportingVersionId}:test`);
    startTransition(async () => {
      try {
        await sendReadyValidationTestEmail({
          reportingVersionId: row.reportingVersionId,
          periodMonth: row.periodMonth,
          committeeMeetingDate: meetingDate,
        });
        setMessage('Test email sent to guillermo@jelpus.com.');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Failed to send test email.');
      } finally {
        setBusyKey(null);
      }
    });
  };

  return (
    <div className="space-y-4">
      <article className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_40px_rgba(15,23,42,0.05)]">
        <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Create Period / Version</p>
        <form
          className="mt-3 grid gap-3 md:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            setMessage('');
            if (!periodMonth.trim()) {
              setMessage('Period is required (YYYY-MM).');
              return;
            }
            setBusyKey('create');
            startTransition(async () => {
              try {
                await createReportingVersion({
                  periodMonth: periodMonth.trim(),
                  versionName: versionName.trim(),
                  createdBy: createdBy.trim() || 'admin_panel',
                  notes: notes.trim(),
                });
                setVersionName('');
                setNotes('');
                setMessage('Version created.');
              } catch (error) {
                setMessage(error instanceof Error ? error.message : 'Failed to create version.');
              } finally {
                setBusyKey(null);
              }
            });
          }}
        >
          <input
            type="month"
            value={periodMonth}
            onChange={(event) => setPeriodMonth(event.target.value)}
            className="rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950"
            required
          />
          <input
            type="text"
            value={versionName}
            onChange={(event) => setVersionName(event.target.value)}
            placeholder="Version name (optional)"
            className="rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950"
          />
          <input
            type="text"
            value={createdBy}
            onChange={(event) => setCreatedBy(event.target.value)}
            placeholder="Created by"
            className="rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950"
          />
          <input
            type="text"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Notes (optional)"
            className="rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950"
          />
          <div className="md:col-span-4">
            <button
              type="submit"
              disabled={isPending && busyKey === 'create'}
              className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              {isPending && busyKey === 'create' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Create version
            </button>
          </div>
        </form>
        {message ? <p className="mt-3 text-sm text-slate-700">{message}</p> : null}
      </article>

      <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_10px_40px_rgba(15,23,42,0.05)]">
        {sortedRows.length === 0 ? (
          <div className="p-8">
            <p className="text-sm text-slate-600">No versions registered yet.</p>
          </div>
        ) : null}
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70">
                <th className="px-6 py-4 text-left text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                  Period
                </th>
                <th className="px-6 py-4 text-left text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                  Version
                </th>
                <th className="px-6 py-4 text-left text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                  Created by
                </th>
                <th className="px-6 py-4 text-left text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                  Created at
                </th>
                <th className="px-6 py-4 text-left text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                  Notes
                </th>
                <th className="px-6 py-4 text-left text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {sortedRows.map((row) => {
                const rowBusy = isPending && busyKey === row.reportingVersionId;
                const status = row.status.toLowerCase();
                const isDraft = status === 'draft';
                const isReady = status === 'ready_to_show';

                return (
                  <tr key={row.reportingVersionId} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-6 py-4 text-sm text-slate-800">{formatPeriod(row.periodMonth)}</td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">{row.versionName}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          ID: {row.reportingVersionId} | v{row.versionNumber}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <AdminStatusBadge status={row.status} />
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-800">{row.createdBy}</td>
                    <td className="px-6 py-4 text-sm text-slate-800">{formatCreatedAt(row.createdAt)}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {row.notes ?? <span className="text-slate-400">-</span>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={rowBusy || (!isDraft && !isReady)}
                          className="rounded-full border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700 transition hover:border-emerald-400 disabled:opacity-50"
                          onClick={() => {
                            if (!isDraft && !isReady) return;
                            setReadyCandidate(row);
                            setReadyNotifyStep(false);
                            setCommitteeMeetingDate('');
                          }}
                        >
                          {rowBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ready'}
                        </button>
                        <button
                          type="button"
                          disabled={rowBusy}
                          className="rounded-full border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-blue-700 transition hover:border-blue-400 disabled:opacity-50"
                          onClick={() => {
                            const confirmed = window.confirm(
                              `Send Request Info emails for ${formatPeriod(row.periodMonth)}?`,
                            );
                            if (!confirmed) return;
                            setMessage('');
                            setBusyKey(row.reportingVersionId);
                            startTransition(async () => {
                              try {
                                const result = await requestReportingVersionInfo({
                                  reportingVersionId: row.reportingVersionId,
                                  periodMonth: row.periodMonth,
                                });
                                setMessage(`Request Info sent to ${result.sent} owner(s).`);
                              } catch (error) {
                                setMessage(error instanceof Error ? error.message : 'Failed to send Request Info emails.');
                              } finally {
                                setBusyKey(null);
                              }
                            });
                          }}
                        >
                          {rowBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Request Info'}
                        </button>
                        <button
                          type="button"
                          disabled={rowBusy || !isReady}
                          className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 transition hover:border-slate-400 disabled:opacity-50"
                          onClick={() => {
                            if (!isReady) return;
                            const confirmed = window.confirm(`Close version ${row.versionName}?`);
                            if (!confirmed) return;
                            setMessage('');
                            setBusyKey(row.reportingVersionId);
                            startTransition(async () => {
                              try {
                                await closeReportingVersion({ reportingVersionId: row.reportingVersionId });
                                setMessage(`Version ${row.versionName} closed.`);
                              } catch (error) {
                                setMessage(error instanceof Error ? error.message : 'Failed to close version.');
                              } finally {
                                setBusyKey(null);
                              }
                            });
                          }}
                        >
                          {rowBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Close'}
                        </button>
                        <button
                          type="button"
                          disabled={rowBusy}
                          className="rounded-full border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-rose-700 transition hover:border-rose-400 disabled:opacity-50"
                          onClick={() => {
                            const confirmed = window.confirm(
                              `Delete version ${row.versionName}? This cannot be undone.`,
                            );
                            if (!confirmed) return;
                            setMessage('');
                            setBusyKey(row.reportingVersionId);
                            startTransition(async () => {
                              try {
                                await deleteReportingVersion(row.reportingVersionId);
                                setMessage(`Version ${row.versionName} deleted.`);
                              } catch (error) {
                                setMessage(error instanceof Error ? error.message : 'Failed to delete version.');
                              } finally {
                                setBusyKey(null);
                              }
                            });
                          }}
                        >
                          {rowBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {readyCandidate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4">
          <div className="w-full max-w-[520px] rounded-[22px] border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
              {readyNotifyStep ? 'Ready + validacion' : 'Confirm Ready'}
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
              {readyNotifyStep
                ? 'Cuando esta prevista la proxima reunion de Committee?'
                : readyCandidate.status === 'ready_to_show'
                  ? 'Esta version ya esta Ready. Deseas notificar a los responsables?'
                  : 'Estas seguro que deseas pasar a Ready esta version?'}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {readyNotifyStep
                ? 'Usaremos esta fecha en el correo para pedir validacion de la informacion procesada.'
                : `${readyCandidate.versionName} quedara disponible como ready_to_show para Executive.`}
            </p>
            {readyNotifyStep ? (
              <div className="mt-5">
                <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Fecha de reunion
                </label>
                <input
                  type="date"
                  value={committeeMeetingDate}
                  onChange={(event) => setCommitteeMeetingDate(event.target.value)}
                  className="mt-2 w-full rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950"
                />
              </div>
            ) : null}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (readyNotifyStep) {
                    setReadyNotifyStep(false);
                    return;
                  }
                  closeReadyModal();
                }}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {readyNotifyStep ? 'Volver' : 'Cancelar'}
              </button>
              {!readyNotifyStep ? (
                <>
                  {readyCandidate.status !== 'ready_to_show' ? (
                    <button
                      type="button"
                      onClick={() => confirmReady(false)}
                      className="rounded-full border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 hover:border-emerald-400"
                    >
                      Confirmar
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setReadyNotifyStep(true)}
                    className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    Confirmar y Notificar
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={!committeeMeetingDate || (isPending && busyKey === `${readyCandidate.reportingVersionId}:test`)}
                    onClick={sendReadyTest}
                    className="inline-flex items-center gap-2 rounded-full border border-blue-300 bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:border-blue-400 disabled:opacity-50"
                  >
                    {isPending && busyKey === `${readyCandidate.reportingVersionId}:test` ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Enviar prueba
                  </button>
                  <button
                    type="button"
                    disabled={!committeeMeetingDate}
                    onClick={() => confirmReady(true)}
                    className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    Continuar y Enviar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
