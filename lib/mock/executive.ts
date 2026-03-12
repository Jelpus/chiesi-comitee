import type { ExecutiveCardItem } from '@/types/executive';

export const executiveCardsMock: ExecutiveCardItem[] = [
  {
    module: 'Venta Interna',
    kpi: 'Sell In',
    actual: '1.25M',
    target: '1.30M',
    variance: '-50K',
    status: 'yellow',
    owner: 'Commercial',
    detailHref: '/executive/sales-internal',
  },
  {
    module: 'Venta Interna',
    kpi: 'Sell Out',
    actual: '1.19M',
    target: '1.22M',
    variance: '-30K',
    status: 'yellow',
    owner: 'Commercial',
    detailHref: '/executive/sales-internal',
  },
  {
    module: 'MACO / Commercial Operations',
    kpi: 'Coverage',
    actual: '92%',
    target: '95%',
    variance: '-3 pts',
    status: 'green',
    owner: 'Commercial Operations',
    detailHref: null,
  },
  {
    module: 'OPEX by CC',
    kpi: 'OPEX Actual',
    actual: '540K',
    target: '520K',
    variance: '+20K',
    status: 'red',
    owner: 'Finance',
    detailHref: null,
  },
  {
    module: 'Medical',
    kpi: 'Medical Activities',
    actual: '148',
    target: '150',
    variance: '-2',
    status: 'green',
    owner: 'Medical',
    detailHref: null,
  },
];

export const executiveSummaryMock = [
  {
    label: 'Módulos en verde',
    value: '2 / 4',
    helper: 'Medical y MACO están dentro de rango.',
  },
  {
    label: 'Alertas activas',
    value: '2',
    helper: 'Venta Interna y OPEX requieren revisión.',
  },
  {
    label: 'Periodo analizado',
    value: 'Feb 2026',
    helper: 'Versión operativa actual: v1 draft.',
  },
  {
    label: 'Última actualización',
    value: '11 Mar · 11:01',
    helper: 'Datos mock del mart ejecutivo.',
  },
];
