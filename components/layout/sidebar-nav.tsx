'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ComponentType } from 'react';
import {
  BarChart3,
  Calendar,
  Database,
  Plane,
  FolderUp,
  Gauge,
  Home,
  Layers,
  ClipboardList,
  LoaderCircle,
  Settings,
  Tag,
  Target,
} from 'lucide-react';
import { appNavigation } from '@/lib/navigation/app-navigation';
import { ModuleIcon } from '@/components/executive/module-icon';

function isItemActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

type SidebarNavProps = {
  collapsed?: boolean;
  onNavigate?: (href?: string) => void;
  pendingHref?: string | null;
};

export function SidebarNav({ collapsed = false, onNavigate, pendingHref }: SidebarNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const iconByHref: Record<string, ComponentType<{ className?: string }>> = {
    '/': Gauge,
    '/forms': FolderUp,
    '/closing-inputs': FolderUp,
    '/prepare': ClipboardList,
    '/air': Plane,
    '/admin': Settings,
    '/admin/planning': Calendar,
    '/admin/settings': Settings,
    '/admin/periods': Calendar,
    '/admin/versions': Layers,
    '/admin/modules': Database,
    '/admin/uploads': FolderUp,
    '/admin/uploads/logs': FolderUp,
    '/admin/tables': Database,
    '/admin/products': Tag,
    '/admin/targets': Target,
    '/executive': Home,
    '/executive/sales-internal': BarChart3,
    '/executive/business-excellence': Layers,
  };
  const currentSection = pathname.startsWith('/admin')
    ? 'admin'
    : pathname.startsWith('/executive')
      ? 'executive'
      : pathname.startsWith('/air')
        ? 'air'
      : pathname.startsWith('/closing-inputs')
        ? 'closing-inputs'
        : pathname.startsWith('/prepare')
          ? 'prepare'
      : 'home';
  const executiveInitialsByHref: Record<string, string> = {
    '/executive/sales-internal': 'SI',
    '/executive/commercial-operations': 'CO',
    '/executive/business-excellence': 'BE',
    '/executive/medical': 'MD',
    '/executive/opex': 'OP',
    '/executive/human-resources': 'HR',
    '/executive/ra-quality-fv': 'RA',
    '/executive/legal-compliance': 'LC',
  };
  const sectionItems = appNavigation.filter((item) => {
    if (currentSection === 'admin') return item.href.startsWith('/admin/') && item.href !== '/admin';
    if (currentSection === 'executive') return item.href.startsWith('/executive');
    if (currentSection === 'air') return item.href === '/air' || item.href.startsWith('/air/');
    if (currentSection === 'closing-inputs') return item.href === '/closing-inputs';
    if (currentSection === 'prepare') return item.href === '/prepare';
    return item.href === '/' || item.href === '/forms';
  });

  function handleSectionChange(nextSection: string) {
    const navigate = (href: string) => {
      onNavigate?.(href);
      router.push(href);
    };

    if (nextSection === 'home') {
      navigate('/forms');
      return;
    }
    if (nextSection === 'admin') {
      navigate('/admin');
      return;
    }
    if (nextSection === 'executive') {
      navigate('/executive');
      return;
    }
    if (nextSection === 'air') {
      navigate('/air');
      return;
    }
    if (nextSection === 'closing-inputs') {
      navigate('/closing-inputs');
      return;
    }
    if (nextSection === 'prepare') {
      navigate('/prepare');
    }
  }

  return (
    <nav className={`flex h-full flex-col ${collapsed ? 'p-2' : 'p-4'}`}>
      <div className="mb-2">
        {!collapsed ? (
          <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {currentSection === 'admin'
              ? 'Admin Section'
                  : currentSection === 'executive'
                  ? 'Executive Section'
                  : currentSection === 'air'
                    ? 'AirRevolution Section'
                  : currentSection === 'closing-inputs'
                    ? 'Closing Inputs Section'
                    : currentSection === 'prepare'
                      ? 'Prepare Section'
                  : 'Forms Section'}
          </p>
        ) : null}
      </div>

      <div className="flex-1 space-y-2">
        {sectionItems.length === 0 ? (
          !collapsed ? (
            <p className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs text-slate-400">
              Choose `Admin` or `Executive` from the switcher below.
            </p>
          ) : null
        ) : (
          sectionItems.map((item) => {
            const active = isItemActive(pathname, item.href);
            const pending = pendingHref === item.href && !active;
            const itemLabel = item.label;
            const Icon = iconByHref[item.href] ?? Gauge;

            return (
              <Link
                key={item.href}
                href={item.href}
                title={itemLabel}
                onClick={() => onNavigate?.(item.href)}
                aria-busy={pending}
                className={[
                  'relative w-full rounded-xl transition',
                  collapsed
                    ? 'flex items-center justify-center px-2 py-2.5 text-xs font-semibold'
                    : 'flex items-center border-l border-slate-800 pl-4 pr-3 py-4 text-sm min-h-[52px]',
                  active
                    ? 'bg-slate-900/80 text-white'
                    : 'text-slate-400 hover:bg-slate-900/70 hover:text-slate-100',
                ].join(' ')}
              >
                {collapsed ? (
                  <span className="inline-flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-md border border-slate-700 bg-slate-900/70 text-[10px] font-semibold">
                    {pending ? (
                      <LoaderCircle className="h-4 w-4 animate-spin text-sky-300" />
                    ) : item.href.startsWith('/executive') && item.href !== '/executive' ? (
                      <>
                        <ModuleIcon module={item.label} className="h-3.5 w-3.5" />
                        <span className="tracking-[0.08em] text-slate-200">
                          {executiveInitialsByHref[item.href] ?? item.label.slice(0, 2).toUpperCase()}
                        </span>
                      </>
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </span>
                ) : (
                  <span className="inline-flex min-w-0 items-center gap-3.5">
                    {pending ? (
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-sky-600/60 bg-sky-950/50 text-sky-300">
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      </span>
                    ) : item.href.startsWith('/executive') && item.href !== '/executive' ? (
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-700/80 bg-slate-900/70 text-slate-300">
                        <ModuleIcon module={item.label} className="h-4.5 w-4.5" />
                      </span>
                    ) : null}
                    <span className="truncate">{pending ? `Loading ${itemLabel}` : itemLabel}</span>
                  </span>
                )}
              </Link>
            );
          })
        )}
      </div>

      <div className="mt-3 border-t border-slate-800 pt-3">
        {!collapsed ? (
          <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Section
          </p>
        ) : null}
        <div className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2">
          <div className="mb-1 flex items-center gap-1.5 text-slate-300">
            <Settings className="h-3.5 w-3.5" />
            {!collapsed ? <span className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Navigation</span> : null}
          </div>
          <select
            value={
              currentSection === 'home' ||
              currentSection === 'admin' ||
              currentSection === 'executive' ||
              currentSection === 'air' ||
              currentSection === 'closing-inputs' ||
              currentSection === 'prepare'
                ? currentSection
                : ''
            }
            onChange={(e) => handleSectionChange(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs font-semibold text-slate-100 outline-none focus:border-slate-500"
            aria-label="Select section"
          >
            <option value="" disabled>
              {collapsed ? 'Go' : 'Select...'}
            </option>
            <option value="home">Forms</option>
            <option value="closing-inputs">Closing Inputs</option>
            <option value="prepare">Prepare</option>
            <option value="air">AirRevolution</option>
            <option value="admin">Admin</option>
            <option value="executive">Executive</option>
          </select>
        </div>
      </div>
    </nav>
  );
}
