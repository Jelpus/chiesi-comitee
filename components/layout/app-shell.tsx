'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight, Menu, X } from 'lucide-react';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import type { ReactNode } from 'react';

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const hideSidebar = pathname === '/access';
  const sectionLabel = useMemo(() => {
    if (pathname.startsWith('/executive')) return 'Executive';
    if (pathname.startsWith('/admin')) return 'Admin';
    return 'Forms';
  }, [pathname]);

  if (hideSidebar) {
    return <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">{children}</main>;
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Image src="/icon_chiesi.png" alt="Chiesi" width={32} height={32} className="rounded-md" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Navigation</p>
              <p className="text-sm font-semibold text-slate-900">{sectionLabel}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
          </button>
        </div>
      </header>

      <div className={`lg:grid ${collapsed ? 'lg:grid-cols-[88px_1fr]' : 'lg:grid-cols-[260px_1fr]'}`}>
        <aside className="hidden border-b border-slate-200 bg-slate-950 text-slate-100 lg:sticky lg:top-0 lg:block lg:h-screen lg:border-b-0 lg:border-r lg:border-slate-800">
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
                      <h1 className="mt-2 text-xxl font-semibold text-[var(--brand-chiesi)]">Operational Committee</h1>
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
          <main className="h-full overflow-y-auto px-4 py-5 sm:px-6 md:px-7 lg:px-8">{children}</main>
        </div>
      </div>

      <div className={`fixed inset-0 z-40 transition lg:hidden ${mobileOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        <button
          type="button"
          aria-label="Close menu overlay"
          onClick={() => setMobileOpen(false)}
          className={`absolute inset-0 bg-slate-950/45 transition-opacity ${mobileOpen ? 'opacity-100' : 'opacity-0'}`}
        />
        <aside
          className={`absolute left-0 top-0 h-full w-[88%] max-w-[320px] border-r border-slate-800 bg-slate-950 text-slate-100 shadow-2xl transition-transform duration-200 ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-4">
              <div className="flex items-center gap-2.5">
                <Image src="/icon_chiesi.png" alt="Chiesi" width={34} height={34} className="rounded-md" />
                <div>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Section</p>
                  <p className="text-sm font-semibold text-slate-100">{sectionLabel}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-200"
                aria-label="Close menu"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <SidebarNav collapsed={false} onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
