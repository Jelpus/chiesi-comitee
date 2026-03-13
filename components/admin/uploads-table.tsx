'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { processUpload, publishUpload } from '@/app/admin/uploads/actions';
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
  return status === 'uploaded' || status === 'raw_loaded' || status === 'error';
}

function isPublishableStatus(status: string) {
  return status === 'normalized' || status === 'published';
}

export function UploadsTable({ rows }: UploadsTableProps) {
  const [isPending, startTransition] = useTransition();
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<'process' | 'publish' | null>(null);
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
                Upload
              </th>
              <th className="px-6 py-4 text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Module
              </th>
              <th className="px-6 py-4 text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
                File
              </th>
              <th className="px-6 py-4 text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Data As Of
              </th>
              <th className="px-6 py-4 text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Status
              </th>
              <th className="px-6 py-4 text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Rows
              </th>
              <th className="px-6 py-4 text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Uploaded
              </th>
              <th className="px-6 py-4 text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Action
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr key={row.uploadId} className="border-b border-slate-100 last:border-b-0">
                <td className="px-6 py-4 text-xs text-slate-600">{row.uploadId}</td>
                <td className="px-6 py-4 text-sm text-slate-800">
                  {row.moduleCode}
                  {row.dddSource ? (
                    <span className="ml-2 rounded-full border border-slate-200 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-slate-600">
                      {row.dddSource}
                    </span>
                  ) : null}
                </td>
                <td className="px-6 py-4 text-sm text-slate-800">{row.sourceFileName}</td>
                <td className="px-6 py-4 text-sm text-slate-800">{formatMonth(row.sourceAsOfMonth)}</td>
                <td className="px-6 py-4">
                  <AdminStatusBadge status={row.status} />
                </td>
                <td className="px-6 py-4 text-sm text-slate-800">
                  {row.rowsValid}/{row.rowsTotal}
                  {row.rowsError > 0 ? (
                    <span className="ml-2 text-rose-600">({row.rowsError} error)</span>
                  ) : null}
                </td>
                <td className="px-6 py-4 text-sm text-slate-800">{formatDate(row.uploadedAt)}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const isRowBusy = isPending && activeUploadId === row.uploadId;
                      return (
                        <>
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
                                const isSellOutModule =
                                  row.moduleCode === 'business_excellence_budget_sell_out' ||
                                  row.moduleCode === 'business_excellence_sell_out' ||
                                  row.moduleCode === 'sell_out';
                                setFeedbackMessage(
                                  isSellOutModule
                                    ? `Upload ${row.uploadId}: RAW loaded.${sampleInfo} Sell Out discovery mode active. Next step: map product columns in Admin > Products, then Process again.`
                                    : `Upload ${row.uploadId}: RAW loaded.${sampleInfo} DDD discovery mode active. Next step: map PACK_DES in Admin > Products, then Process again.`,
                                );
                              }
                              if (result.phase === 'raw_loaded_mapping_required') {
                                const sampleInfo =
                                  'sampleRowsChecked' in result &&
                                  typeof result.sampleRowsChecked === 'number' &&
                                  result.sampleRowsChecked > 0
                                    ? ` Sample check passed (${result.sampleRowsChecked} rows).`
                                    : '';
                                const unmappedInfo =
                                  'unmappedProducts' in result &&
                                  typeof result.unmappedProducts === 'number'
                                    ? ` ${result.unmappedProducts} unmapped products detected.`
                                    : '';
                                setFeedbackMessage(
                                  `Upload ${row.uploadId}: RAW loaded.${sampleInfo}${unmappedInfo} Complete mappings in Admin > Products and run Process again.`,
                                );
                              }
                              if (result.phase === 'normalized') {
                                const sampleInfo =
                                  'sampleRowsChecked' in result &&
                                  typeof result.sampleRowsChecked === 'number' &&
                                  result.sampleRowsChecked > 0
                                    ? ` Sample check passed (${result.sampleRowsChecked} rows).`
                                    : '';
                                setFeedbackMessage(
                                  `Upload ${row.uploadId}: processing chain completed (RAW + normalization).${sampleInfo} Next step: Publish.`,
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
                      className="rounded-full border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      {isRowBusy && activeAction === 'process' ? 'Processing...' : 'Process'}
                    </button>

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
                      className="rounded-full border border-emerald-300 px-4 py-2 text-xs font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
                    >
                      {isRowBusy && activeAction === 'publish' ? 'Publishing...' : 'Publish'}
                    </button>

                    <Link
                      href={`/admin/uploads/${row.uploadId}`}
                      className="rounded-full border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                    >
                      View details
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
