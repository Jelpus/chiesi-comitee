'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, Loader2, Play, Sparkles, Upload as UploadIcon } from 'lucide-react';
import { normalizeExistingUpload, processUpload, publishUpload } from '@/app/admin/uploads/actions';
import { AdminStatusBadge } from '@/components/ui/admin-status-badge';
import type { UploadListRow } from '@/lib/data/uploads/get-uploads-page-data';

type UploadsTableProps = {
  rows: UploadListRow[];
};

function compactErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  const singleLine = error.message.replace(/\s+/g, ' ').trim();
  return singleLine.length > 260 ? `${singleLine.slice(0, 260)}...` : singleLine;
}

function formatDate(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatMonth(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function isProcessableStatus(status: string) {
  return (
    status === 'uploaded' ||
    status === 'raw_loaded' ||
    status === 'error' ||
    status === 'normalized' ||
    status === 'published'
  );
}

function isNormalizeableStatus(status: string) {
  return status === 'raw_loaded' || status === 'normalized' || status === 'published';
}

function isPublishableStatus(status: string) {
  return status === 'normalized' || status === 'published';
}

function buildNormalizationSummary(result: {
  normalizedRows: number;
  rowsValid: number;
  rowsSkipped: number;
  rowsError: number;
  topValidationIssues: Array<{ reason: string; count: number }>;
}) {
  const counts = `Normalized ${result.normalizedRows}. Valid ${result.rowsValid}, skipped ${result.rowsSkipped}, error ${result.rowsError}.`;
  const issues = result.topValidationIssues
    .slice(0, 2)
    .map((item) => `${item.reason} [${item.count}]`)
    .join(' | ');

  return issues ? `${counts} Top issues: ${issues}` : counts;
}

function nextStepLabel(status: string) {
  if (status === 'uploaded' || status === 'error') return 'Process';
  if (status === 'raw_loaded') return 'Normalize';
  if (status === 'normalized') return 'Publish';
  if (status === 'published') return 'Done';
  return 'Wait';
}

function nextStepAction(status: string): 'process' | 'normalize' | 'publish' | 'none' {
  if (status === 'uploaded' || status === 'error') return 'process';
  if (status === 'raw_loaded') return 'normalize';
  if (status === 'normalized') return 'publish';
  return 'none';
}

function hasNormalizationSummary(
  value: unknown,
): value is {
  normalizedRows: number;
  rowsValid: number;
  rowsSkipped: number;
  rowsError: number;
  topValidationIssues: Array<{ reason: string; count: number }>;
} {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.normalizedRows === 'number' &&
    typeof candidate.rowsValid === 'number' &&
    typeof candidate.rowsSkipped === 'number' &&
    typeof candidate.rowsError === 'number' &&
    Array.isArray(candidate.topValidationIssues)
  );
}

export function UploadsTable({ rows }: UploadsTableProps) {
  const [isPending, startTransition] = useTransition();
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<'process' | 'normalize' | 'publish' | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const router = useRouter();

  if (rows.length === 0) {
    return (
      <div className="rounded-[28px] border border-slate-200/80 bg-white p-8 shadow-[0_10px_40px_rgba(15,23,42,0.05)]">
        <p className="text-sm text-slate-600">No uploads registered.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_10px_40px_rgba(15,23,42,0.05)]">
      {feedbackMessage ? (
        <div className="border-b border-slate-200 bg-slate-50/70 px-6 py-3 text-sm text-slate-700">
          {feedbackMessage}
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70">
              <th className="px-6 py-4 text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Source
              </th>
              <th className="px-6 py-4 text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Upload
              </th>
              <th className="px-6 py-4 text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Timing
              </th>
              <th className="px-6 py-4 text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Progress
              </th>
              <th className="px-6 py-4 text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Status
              </th>
              <th className="px-6 py-4 text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Action
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr key={row.uploadId} className="border-b border-slate-100 last:border-b-0">
                <td className="px-6 py-4">
                  <div className="space-y-1">
                    <p className="text-sm text-slate-800">{row.moduleCode}</p>
                    {row.dddSource ? (
                      <span className="inline-flex rounded-full border border-slate-200 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-slate-600">
                        {row.dddSource}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="space-y-1">
                    <p className="max-w-[360px] truncate text-sm font-medium text-slate-900">{row.sourceFileName}</p>
                    <p className="text-xs text-slate-500">{row.uploadId}</p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="space-y-1 text-sm text-slate-800">
                    <p>
                      <span className="text-slate-500">Period:</span> {formatMonth(row.periodMonth)}
                    </p>
                    <p>
                      <span className="text-slate-500">Data as of:</span> {formatMonth(row.sourceAsOfMonth)}
                    </p>
                    <p>
                      <span className="text-slate-500">Uploaded:</span> {formatDate(row.uploadedAt)}
                    </p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="min-w-[160px] space-y-2 text-sm text-slate-800">
                    <p>
                      {row.rowsValid}/{row.rowsTotal}
                      {row.rowsError > 0 ? (
                        <span className="ml-2 text-rose-600">({row.rowsError} error)</span>
                      ) : null}
                    </p>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-slate-900"
                        style={{
                          width: `${
                            row.rowsTotal > 0 ? Math.min(100, Math.round((row.rowsValid / row.rowsTotal) * 100)) : 0
                          }%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-slate-500">Validated / total</p>
                  </div>
                </td>
                <td className="px-6 py-4 align-top">
                  <div className="space-y-2">
                    <AdminStatusBadge status={row.status} />
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                      Next: {nextStepLabel(row.status)}
                    </p>
                  </div>
                </td>
                <td className="px-6 py-4 align-top">
                  <div className="flex flex-wrap items-center gap-2">
                    {(() => {
                      const isRowBusy = isPending && activeUploadId === row.uploadId;
                      const actionButtonClass =
                        'inline-flex h-9 w-9 items-center justify-center rounded-full border transition disabled:opacity-50';
                      const suggestedAction = nextStepAction(row.status);
                      return (
                        <>
                    <div className="relative">
                    <button
                      type="button"
                      disabled={isRowBusy || !isProcessableStatus(row.status)}
                      onClick={() => {
                        setFeedbackMessage('');
                        setActiveUploadId(row.uploadId);
                        setActiveAction('process');
                        startTransition(async () => {
                          try {
                            const result = await processUpload(row.uploadId);
                            if (result && typeof result === 'object' && 'phase' in result) {
                              if (result.phase === 'raw_loaded') {
                                const sampleInfo =
                                  'sampleRowsChecked' in result &&
                                  typeof result.sampleRowsChecked === 'number' &&
                                  result.sampleRowsChecked > 0
                                    ? ` Sample check passed (${result.sampleRowsChecked} rows).`
                                    : '';
                                const normalizationInfo =
                                  hasNormalizationSummary(result)
                                    ? ` ${buildNormalizationSummary(result)}`
                                    : '';
                                setFeedbackMessage(
                                  `Upload ${row.uploadId}: RAW loaded.${sampleInfo}${normalizationInfo} Next step: Normalize.`,
                                );
                              }
                            }
                            router.refresh();
                          } catch (error) {
                            setFeedbackMessage(`Process failed for ${row.uploadId}: ${compactErrorMessage(error, 'Unknown error.')}`);
                            router.refresh();
                          } finally {
                            setActiveUploadId(null);
                            setActiveAction(null);
                          }
                        });
                      }}
                      className={`${actionButtonClass} border-slate-300 text-slate-700 hover:bg-slate-50 ${
                        suggestedAction === 'process'
                          ? 'ring-2 ring-offset-1 ring-slate-400'
                          : ''
                      }`}
                      title="Process RAW"
                      aria-label="Process RAW"
                    >
                      {isRowBusy && activeAction === 'process' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </button>
                    {suggestedAction === 'process' ? (
                      <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-900 px-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-white">
                        Next
                      </span>
                    ) : null}
                    </div>

                    <div className="relative">
                    <button
                      type="button"
                      disabled={isRowBusy || !isNormalizeableStatus(row.status)}
                      onClick={() => {
                        setFeedbackMessage('');
                        setActiveUploadId(row.uploadId);
                        setActiveAction('normalize');
                        startTransition(async () => {
                          try {
                            const result = await normalizeExistingUpload(row.uploadId);
                            if (result && typeof result === 'object' && 'phase' in result) {
                              if (result.phase === 'raw_loaded') {
                                const normalizationInfo =
                                  hasNormalizationSummary(result)
                                    ? ` ${buildNormalizationSummary(result)}`
                                    : '';
                                setFeedbackMessage(
                                  `Upload ${row.uploadId}: normalization produced no staging rows.${normalizationInfo}`,
                                );
                              }
                              if (result.phase === 'normalized') {
                                const normalizationInfo =
                                  hasNormalizationSummary(result)
                                    ? ` ${buildNormalizationSummary(result)}`
                                    : '';
                                setFeedbackMessage(
                                  `Upload ${row.uploadId}: normalized successfully.${normalizationInfo} Next step: Publish.`,
                                );
                              }
                            }
                            router.refresh();
                          } catch (error) {
                            setFeedbackMessage(`Normalize failed for ${row.uploadId}: ${compactErrorMessage(error, 'Unknown error.')}`);
                            router.refresh();
                          } finally {
                            setActiveUploadId(null);
                            setActiveAction(null);
                          }
                        });
                      }}
                      className={`${actionButtonClass} border-amber-300 text-amber-700 hover:bg-amber-50 ${
                        suggestedAction === 'normalize'
                          ? 'ring-2 ring-offset-1 ring-amber-400'
                          : ''
                      }`}
                      title="Normalize"
                      aria-label="Normalize"
                    >
                      {isRowBusy && activeAction === 'normalize' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                    </button>
                    {suggestedAction === 'normalize' ? (
                      <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-600 px-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-white">
                        Next
                      </span>
                    ) : null}
                    </div>

                    <div className="relative">
                    <button
                      type="button"
                      disabled={isRowBusy || !isPublishableStatus(row.status)}
                      onClick={() => {
                        setFeedbackMessage('');
                        setActiveUploadId(row.uploadId);
                        setActiveAction('publish');
                        startTransition(async () => {
                          try {
                            await publishUpload(row.uploadId);
                            setFeedbackMessage(`Upload ${row.uploadId}: published successfully.`);
                            router.refresh();
                          } catch (error) {
                            setFeedbackMessage(`Publish failed for ${row.uploadId}: ${compactErrorMessage(error, 'Unknown error.')}`);
                            router.refresh();
                          } finally {
                            setActiveUploadId(null);
                            setActiveAction(null);
                          }
                        });
                      }}
                      className={`${actionButtonClass} border-emerald-300 text-emerald-700 hover:bg-emerald-50 ${
                        suggestedAction === 'publish'
                          ? 'ring-2 ring-offset-1 ring-emerald-400'
                          : ''
                      }`}
                      title="Publish"
                      aria-label="Publish"
                    >
                      {isRowBusy && activeAction === 'publish' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UploadIcon className="h-4 w-4" />
                      )}
                    </button>
                    {suggestedAction === 'publish' ? (
                      <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-white">
                        Next
                      </span>
                    ) : null}
                    </div>

                    <Link
                      href={`/admin/uploads/${row.uploadId}`}
                      className={`${actionButtonClass} border-slate-200 text-slate-600 hover:bg-slate-50`}
                      title="View details"
                      aria-label="View details"
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                        </>
                      );
                    })()}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
