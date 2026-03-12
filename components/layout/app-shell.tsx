'use client';

import Image from 'next/image';
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import type { ReactNode } from 'react';

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div className={`min-h-screen lg:grid ${collapsed ? 'lg:grid-cols-[88px_1fr]' : 'lg:grid-cols-[260px_1fr]'}`}>
      <aside className="border-b border-slate-200 bg-slate-950 text-slate-100 lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r lg:border-slate-800">
        <div className="flex h-full flex-col">
          <div className={`border-b border-slate-800 ${collapsed ? 'px-3 py-4' : 'px-6 py-6'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className={`min-w-0 ${collapsed ? 'flex justify-center' : ''}`}>
                <Image
                  src={collapsed ? '/icon_chiesi.png' : '/logo.svg'}
                  alt="Chiesi"
                  width={collapsed ? 42 : 100}
                  height={collapsed ? 42 : 40}
                  className={`object-contain ${collapsed ? 'rounded-md bg-white/95 p-1 shadow-[0_6px_18px_rgba(15,23,42,0.28)] ring-1 ring-white/30' : ''}`}
                />
                {!collapsed ? (
                  <>
                    <h1 className="mt-2 text-xxl font-semibold text-[var(--brand-chiesi)]">Executive Committee</h1>
                    <p className="mt-1 text-sm text-slate-400">Cierre mensual y visor ejecutivo</p>
                  </>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => setCollapsed((prev) => !prev)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-200 transition hover:border-slate-500 hover:text-white"
                aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
                title={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
              >
                {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <SidebarNav collapsed={collapsed} onNavigate={() => setCollapsed(true)} />
          </div>
        </div>
      </aside>

      <div className="min-w-0 lg:h-screen">
        <main className="h-full overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
