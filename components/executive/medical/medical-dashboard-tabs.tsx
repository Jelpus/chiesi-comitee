'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';

type MedicalDashboardTabsProps = {
  targetsContent: ReactNode;
  mslContent: ReactNode;
};

export function MedicalDashboardTabs({ targetsContent, mslContent }: MedicalDashboardTabsProps) {
  const [activeTab, setActiveTab] = useState<'targets' | 'msl'>('targets');

  return (
    <div className="space-y-4">
      <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-600">Medical Dashboard</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Targets Achievement & MSL Visit Coverage</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('targets')}
            className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
              activeTab === 'targets'
                ? 'bg-slate-900 text-white shadow-[0_8px_22px_rgba(15,23,42,0.35)]'
                : 'border border-slate-300 bg-white text-slate-700 hover:border-slate-400'
            }`}
          >
            Targets Achievement
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('msl')}
            className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
              activeTab === 'msl'
                ? 'bg-slate-900 text-white shadow-[0_8px_22px_rgba(15,23,42,0.35)]'
                : 'border border-slate-300 bg-white text-slate-700 hover:border-slate-400'
            }`}
          >
            MSL Visit Coverage
          </button>
        </div>
      </article>

      {activeTab === 'targets' ? targetsContent : mslContent}
    </div>
  );
}
