'use client';

import { useState, useTransition } from 'react';
import { runGob360ConnectionTest } from '@/app/admin/products/actions';
import type { Gob360ConnectionTestResult } from '@/lib/data/products/product-metadata';

export function Gob360ConnectionTest() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<Gob360ConnectionTestResult | null>(null);

  return (
    <div className="rounded-[20px] border border-slate-200/80 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">GOB360 Connectivity</p>
          <p className="text-sm text-slate-700">Validate identity, location US, and table access before loading mappings.</p>
        </div>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              const res = await runGob360ConnectionTest();
              setResult(res);
            });
          }}
          className="rounded-full border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {isPending ? 'Testing...' : 'Test GOB360'}
        </button>
      </div>

      {result ? (
        <div className="mt-3 rounded-[12px] border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
          <p><span className="font-semibold">Status:</span> {result.ok ? 'OK' : 'FAILED'}</p>
          <p><span className="font-semibold">Project:</span> {result.projectId}</p>
          <p><span className="font-semibold">Dataset:</span> {result.datasetId}</p>
          <p><span className="font-semibold">Client:</span> {result.clientEmail || 'N/A'}</p>
          <p><span className="font-semibold">Session user:</span> {result.sessionUser || 'N/A'}</p>
          <p><span className="font-semibold">PC table:</span> {result.pcTableReachable ? 'reachable' : 'blocked'}</p>
          <p><span className="font-semibold">SC table:</span> {result.scTableReachable ? 'reachable' : 'blocked'}</p>
          {result.pcSampleClave ? <p><span className="font-semibold">PC sample CLAVE:</span> {result.pcSampleClave}</p> : null}
          {result.scSampleClave ? <p><span className="font-semibold">SC sample CLAVE:</span> {result.scSampleClave}</p> : null}
          {result.errorMessage ? (
            <p className="mt-2 rounded bg-rose-50 px-2 py-1 text-rose-700">
              <span className="font-semibold">Error:</span> {result.errorMessage}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
