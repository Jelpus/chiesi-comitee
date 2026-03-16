'use client';

import { useMemo, useState } from 'react';
import { DsoTrendChart } from '@/components/executive/commercial-operations/dso-trend-chart';
import { DsoComparisonBarChart } from '@/components/executive/commercial-operations/dso-comparison-bar-chart';
import type {
  CommercialOperationsDeliveryOrderRow,
  CommercialOperationsDsoOverviewRow,
  CommercialOperationsDsoTrendRow,
  CommercialOperationsGovernmentContractProgressRow,
  CommercialOperationsStockRow,
} from '@/lib/data/commercial-operations';

type DsoTableRow = {
  groupName: string;
  currentValue: number | null;
  previousMonthValue: number | null;
  momDelta: number | null;
  ytdAvg: number | null;
  ytdAvgPy: number | null;
  ytdAvgDelta: number | null;
  target: number | null;
  variance: number | null;
};

type DsoDashboardPanelProps = {
  overviewRows: CommercialOperationsDsoOverviewRow[];
  trendRows: CommercialOperationsDsoTrendRow[];
  tableRows: DsoTableRow[];
  initialGroup: string;
  stockRows: CommercialOperationsStockRow[];
  governmentContractRows: CommercialOperationsGovernmentContractProgressRow[];
  deliveryOrderRows: CommercialOperationsDeliveryOrderRow[];
  stockTargets: {
    totalDays: number | null;
    privateDays: number | null;
    publicDays: number | null;
  };
  deliveryTargets: {
    fillRateGovernment: number | null;
    fillRatePrivate: number | null;
    leadTimeGovernment: number | null;
    leadTimePrivate: number | null;
  };
  contractsSourceAsOfMonth?: string | null;
};

type StockScope = 'total' | 'private' | 'public';

const GROUP_ORDER = ['Anual / General', 'B2B Privado', 'B2C Privado', 'B2C Gobierno', 'B2B Gobierno'];

function normalizeLabel(value: string) {
  return value.toLowerCase().trim().replace(/\s+/g, ' ');
}

function formatDsoValue(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return value.toFixed(1);
}

function formatQuantity(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return `${value.toFixed(1)}%`;
}

function formatCurrency(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function toMonthDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function toYyyyMmDd(value: Date | null) {
  if (!value) return 'N/A';
  return value.toISOString().slice(0, 10);
}

function subOneMonth(value: Date | null) {
  if (!value) return null;
  const cloned = new Date(value);
  cloned.setUTCMonth(cloned.getUTCMonth() - 1);
  return cloned;
}

function findGroup<T extends { groupName: string }>(rows: T[], groupName: string) {
  const target = normalizeLabel(groupName);
  return rows.find((row) => normalizeLabel(row.groupName) === target) ?? null;
}

function normalizeScopeFromRow(row: CommercialOperationsStockRow): 'private' | 'public' | 'unknown' {
  const text = `${row.businessType ?? ''} ${row.market ?? ''}`.toLowerCase();
  if (text.includes('gobierno') || text.includes('government') || text.includes('public')) return 'public';
  if (text.includes('privado') || text.includes('private')) return 'private';
  return 'unknown';
}

function normalizeStockType(value: string | null | undefined): 'stock' | 'sell_out' | 'other' {
  const text = (value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!text) return 'other';
  if (text.includes('sell out') || text.includes('sellout')) return 'sell_out';
  if (text.includes('stock')) return 'stock';
  return 'other';
}

function toScopeLabel(scope: StockScope) {
  if (scope === 'private') return 'Private';
  if (scope === 'public') return 'Public';
  return 'Total';
}

type GovernmentStage = 'ordenado' | 'entregado' | 'facturado';

function normalizeGovernmentStage(value: string | null | undefined): GovernmentStage | 'other' {
  const text = (value ?? '').toLowerCase().trim();
  if (!text) return 'other';
  if (text.includes('orden')) return 'ordenado';
  if (text.includes('entreg')) return 'entregado';
  if (text.includes('factur')) return 'facturado';
  return 'other';
}

function getSanitizedGovernmentDenominators(row: CommercialOperationsGovernmentContractProgressRow) {
  const rawPy = row.maxQuantity2025Safe ?? row.maxQuantity2025 ?? null;
  const rawCy = row.maxQuantity2026Safe ?? row.maxQuantity2026 ?? null;
  const rawTotal =
    row.maxContractQuantitySafe ?? row.maxContractQuantity ?? row.contractTotalQuantity ?? null;
  const fallbackPy = row.total2025 ?? null;
  const fallbackCy = row.total2026 ?? null;
  const fallbackTotal =
    (row.total2025 ?? 0) + (row.total2026 ?? 0) > 0
      ? (row.total2025 ?? 0) + (row.total2026 ?? 0)
      : null;

  const isUnrealistic = (value: number | null) =>
    value != null && (!Number.isFinite(value) || value <= 0 || value > 10_000_000_000_000);

  let py = rawPy;
  if (isUnrealistic(py)) {
    py = fallbackPy;
  }

  let cy = rawCy;
  if (isUnrealistic(cy)) {
    cy = fallbackCy;
  }

  let total = rawTotal;
  if (isUnrealistic(total)) {
    total = fallbackTotal;
  }

  return {
    maxQtyPy: py ?? 0,
    maxQtyCy: cy ?? 0,
    maxQtyTotal: total ?? 0,
  };
}

type ExplainerRow = {
  label: string;
  current: number | null;
  momDelta: number | null;
  ytdAvgDelta: number | null;
};

type ChannelSummaryRow = {
  scope: StockScope;
  label: string;
  current: number | null;
  previous: number | null;
  ytdAvg: number | null;
  ytdPyAvg: number | null;
  target: number | null;
  variance: number | null;
  momDelta: number | null;
};

export function DsoDashboardPanel({
  overviewRows,
  trendRows,
  tableRows,
  initialGroup,
  stockRows,
  governmentContractRows,
  deliveryOrderRows,
  stockTargets,
  deliveryTargets,
  contractsSourceAsOfMonth,
}: DsoDashboardPanelProps) {
  const initial = initialGroup || tableRows[0]?.groupName || overviewRows[0]?.groupName || '';
  const [selectedGroup, setSelectedGroup] = useState(initial);
  const [activeView, setActiveView] = useState<
    'dso' | 'stock' | 'government-contract-progress' | 'delivery'
  >('dso');
  const [selectedStockScope, setSelectedStockScope] = useState<StockScope>('total');
  const [selectedDeliveryScope, setSelectedDeliveryScope] = useState<'government' | 'private' | 'total'>(
    'government',
  );
  const [deliveryRankingMode, setDeliveryRankingMode] = useState<'ytd' | 'mth'>('ytd');
  const [selectedGovernmentDimension, setSelectedGovernmentDimension] = useState<
    'product' | 'institution' | 'business_unit'
  >('product');
  const [selectedGovernmentStage, setSelectedGovernmentStage] = useState<GovernmentStage>('entregado');
  const [stockBusinessTypeFilter, setStockBusinessTypeFilter] = useState('');
  const [stockClientInstitutionFilter, setStockClientInstitutionFilter] = useState('');
  const [stockSkuFilter, setStockSkuFilter] = useState('');

  const selectedOverview = findGroup(overviewRows, selectedGroup);
  const selectedTable = findGroup(tableRows, selectedGroup);
  const selectedTarget = selectedTable?.target ?? null;
  const selectedVariance = selectedTable?.variance ?? null;
  const reportPeriodDate = toMonthDate(selectedOverview?.reportPeriodMonth ?? null);
  const previousMonthDate = subOneMonth(reportPeriodDate);
  const pyYearLabel = reportPeriodDate ? String(reportPeriodDate.getUTCFullYear() - 1) : 'PY';

  const selectedTrendRows = trendRows
    .filter((row) => normalizeLabel(row.groupName) === normalizeLabel(selectedGroup))
    .map((row) => ({
      periodMonth: row.periodMonth,
      dsoValue: row.dsoValue,
      targetValue: selectedTarget,
    }));

  const orderedTableRows = useMemo(() => {
    const map = new Map(tableRows.map((row) => [normalizeLabel(row.groupName), row] as const));
    const ordered = GROUP_ORDER.map((name) => map.get(normalizeLabel(name))).filter(
      (row): row is DsoTableRow => Boolean(row),
    );
    const remaining = tableRows
      .filter((row) => !GROUP_ORDER.some((name) => normalizeLabel(name) === normalizeLabel(row.groupName)))
      .sort((a, b) => a.groupName.localeCompare(b.groupName));
    return [...ordered, ...remaining];
  }, [tableRows]);

  const groupTabs = useMemo(() => orderedTableRows.map((row) => row.groupName), [orderedTableRows]);

  const stockMonthlyByScope = useMemo(() => {
    const byKey = new Map<
      string,
      {
        scope: StockScope;
        periodMonth: string;
        stock: number;
        sellOut: number;
        isYtd: boolean;
        isYtdPy: boolean;
        isMth: boolean;
        isMthPy: boolean;
      }
    >();

    for (const row of stockRows) {
      const rowScope = normalizeScopeFromRow(row);
      const scopes: StockScope[] = ['total'];
      if (rowScope === 'private') scopes.push('private');
      if (rowScope === 'public') scopes.push('public');
      const stockType = normalizeStockType(row.stockType);
      if (stockType === 'other') continue;

      for (const scope of scopes) {
        const key = `${scope}|${row.periodMonth}`;
        const current = byKey.get(key) ?? {
          scope,
          periodMonth: row.periodMonth,
          stock: 0,
          sellOut: 0,
          isYtd: false,
          isYtdPy: false,
          isMth: false,
          isMthPy: false,
        };
        if (stockType === 'stock') current.stock += row.stockValue;
        if (stockType === 'sell_out') current.sellOut += row.stockValue;
        current.isYtd = current.isYtd || row.isYtd;
        current.isYtdPy = current.isYtdPy || row.isYtdPy;
        current.isMth = current.isMth || row.isMth;
        current.isMthPy = current.isMthPy || row.isMthPy;
        byKey.set(key, current);
      }
    }

    return [...byKey.values()].map((row) => ({
      ...row,
      doh: row.sellOut > 0 ? (row.stock / row.sellOut) * 30 : null,
    }));
  }, [stockRows]);

  const stockChannelRows = useMemo(() => {
    const toPeriod = (value: string) => new Date(`${value}T00:00:00`);
    const toPeriodKey = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : null);
    const minusOneMonthKey = (value: string | null) => {
      if (!value) return null;
      const date = toPeriod(value);
      if (Number.isNaN(date.getTime())) return null;
      date.setUTCMonth(date.getUTCMonth() - 1);
      return toPeriodKey(date);
    };

    const summarize = (scope: StockScope): ChannelSummaryRow => {
      const scoped = stockMonthlyByScope.filter((row) => row.scope === scope);
      const current = scoped.find((row) => row.isMth)?.doh ?? null;
      const currentPeriod = scoped.find((row) => row.isMth)?.periodMonth ?? scoped.map((row) => row.periodMonth).sort().at(-1) ?? null;
      const previousPeriod = minusOneMonthKey(currentPeriod);
      const previous = previousPeriod ? scoped.find((row) => row.periodMonth === previousPeriod)?.doh ?? null : null;
      const ytdValues = scoped.filter((row) => row.isYtd && row.doh != null).map((row) => row.doh as number);
      const ytdPyValues = scoped.filter((row) => row.isYtdPy && row.doh != null).map((row) => row.doh as number);
      const ytdAvg = ytdValues.length > 0 ? ytdValues.reduce((a, b) => a + b, 0) / ytdValues.length : null;
      const ytdPyAvg = ytdPyValues.length > 0 ? ytdPyValues.reduce((a, b) => a + b, 0) / ytdPyValues.length : null;
      const target =
        scope === 'private'
          ? stockTargets.privateDays
          : scope === 'public'
            ? stockTargets.publicDays
            : stockTargets.totalDays;
      return {
        scope,
        label: toScopeLabel(scope),
        current,
        previous,
        ytdAvg,
        ytdPyAvg,
        target,
        variance: current != null && target != null ? current - target : null,
        momDelta: current != null && previous != null ? current - previous : null,
      };
    };

    return [summarize('total'), summarize('private'), summarize('public')];
  }, [stockMonthlyByScope, stockTargets]);

  const selectedStockRow = useMemo(
    () => stockChannelRows.find((row) => row.scope === selectedStockScope) ?? stockChannelRows[0] ?? null,
    [stockChannelRows, selectedStockScope],
  );

  const selectedStockTrendRows = useMemo(
    () =>
      stockMonthlyByScope
        .filter((row) => row.scope === selectedStockScope)
        .sort((a, b) => a.periodMonth.localeCompare(b.periodMonth))
        .map((row) => ({
          periodMonth: row.periodMonth,
          dsoValue: row.doh ?? 0,
          targetValue: selectedStockRow?.target ?? null,
          stockValue: row.stock,
          sellOutValue: row.sellOut,
        })),
    [stockMonthlyByScope, selectedStockScope, selectedStockRow],
  );

  const stockReportPeriod = (() => {
    const fromMth = stockMonthlyByScope
      .filter((row) => row.scope === selectedStockScope && row.isMth)
      .map((row) => row.periodMonth)
      .sort()
      .at(-1);
    if (fromMth) return toMonthDate(fromMth);
    const fallback = stockMonthlyByScope
      .filter((row) => row.scope === selectedStockScope)
      .map((row) => row.periodMonth)
      .sort()
      .at(-1);
    return toMonthDate(fallback ?? null);
  })();

  const stockPreviousMonth = subOneMonth(stockReportPeriod);

  const dsoSourceAsOf = useMemo(
    () => overviewRows.map((row) => row.sourceAsOfMonth).filter(Boolean).sort().at(-1) ?? null,
    [overviewRows],
  );
  const stockSourceAsOf = useMemo(
    () => stockRows.map((row) => row.sourceAsOfMonth).filter(Boolean).sort().at(-1) ?? null,
    [stockRows],
  );
  const deliverySourceAsOf = useMemo(
    () => deliveryOrderRows.map((row) => row.sourceAsOfMonth).filter(Boolean).sort().at(-1) ?? null,
    [deliveryOrderRows],
  );

  const hasPrivateDelivery = useMemo(
    () => deliveryOrderRows.some((row) => (row.orderScope ?? '').toLowerCase().trim() === 'private'),
    [deliveryOrderRows],
  );
  const effectiveDeliveryScope: 'government' | 'private' | 'total' = hasPrivateDelivery
    ? selectedDeliveryScope
    : 'government';

  const deliveryScopedRows = useMemo(() => {
    const rows = deliveryOrderRows.filter((row) => {
      const scope = (row.orderScope ?? '').toLowerCase().trim();
      if (effectiveDeliveryScope === 'government') return scope === 'government';
      if (effectiveDeliveryScope === 'private') return scope === 'private';
      return scope === 'government' || scope === 'private';
    });
    const cutoff = rows
      .map((row) => row.sourceAsOfMonth)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1);
    if (!cutoff) return rows;
    return rows.filter((row) => row.periodMonth <= cutoff);
  }, [deliveryOrderRows, effectiveDeliveryScope]);

  const deliveryMonthlyRows = useMemo(() => {
    const byPeriod = new Map<
      string,
      {
        periodMonth: string;
        requested: number;
        delivered: number;
        invoiced: number;
        leadTimeTotal: number;
        leadTimeCount: number;
        amountNotDelivered: number;
        unitsNotDelivered: number;
        isMth: boolean;
        isYtd: boolean;
      }
    >();

    for (const row of deliveryScopedRows) {
      const current = byPeriod.get(row.periodMonth) ?? {
        periodMonth: row.periodMonth,
        requested: 0,
        delivered: 0,
        invoiced: 0,
        leadTimeTotal: 0,
        leadTimeCount: 0,
        amountNotDelivered: 0,
        unitsNotDelivered: 0,
        isMth: false,
        isYtd: false,
      };
      current.requested += row.cantidadTotalPedido;
      current.delivered += row.cantidadEntregada;
      current.invoiced += row.cantidadFacturada;
      if (row.leadTimeDays != null && Number.isFinite(row.leadTimeDays)) {
        current.leadTimeTotal += row.leadTimeDays;
        current.leadTimeCount += 1;
      }
      current.amountNotDelivered += row.amountNotDelivered ?? 0;
      current.unitsNotDelivered += row.unitsNotDelivered ?? 0;
      current.isMth = current.isMth || row.isMth;
      current.isYtd = current.isYtd || row.isYtd;
      byPeriod.set(row.periodMonth, current);
    }

    return [...byPeriod.values()]
      .sort((a, b) => a.periodMonth.localeCompare(b.periodMonth))
      .map((row) => ({
        ...row,
        fillRateDeliveredPct: row.requested > 0 ? (row.delivered / row.requested) * 100 : null,
        fillRateInvoicedPct: row.requested > 0 ? (row.invoiced / row.requested) * 100 : null,
        leadTimeAvg: row.leadTimeCount > 0 ? row.leadTimeTotal / row.leadTimeCount : null,
      }));
  }, [deliveryScopedRows]);

  const deliverySummary = useMemo(() => {
    const current = deliveryMonthlyRows.find((row) => row.isMth) ?? deliveryMonthlyRows.at(-1) ?? null;
    const previous = current
      ? deliveryMonthlyRows.find(
          (row) => row.periodMonth === toYyyyMmDd(subOneMonth(toMonthDate(current.periodMonth))),
        ) ?? null
      : null;
    const ytdRows = deliveryMonthlyRows.filter((row) => row.isYtd);
    const ytdRequested = ytdRows.reduce((sum, row) => sum + row.requested, 0);
    const ytdDelivered = ytdRows.reduce((sum, row) => sum + row.delivered, 0);
    const ytdFillRatePct = ytdRequested > 0 ? (ytdDelivered / ytdRequested) * 100 : null;
    const ytdLeadTimeAvg =
      ytdRows.length > 0
        ? (() => {
            const valid = ytdRows.filter((row) => row.leadTimeAvg != null).map((row) => row.leadTimeAvg as number);
            return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
          })()
        : null;
    const ytdAmountNotDelivered = ytdRows.reduce((sum, row) => sum + row.amountNotDelivered, 0);
    const ytdUnitsNotDelivered = ytdRows.reduce((sum, row) => sum + row.unitsNotDelivered, 0);

    const fillRateTarget =
      effectiveDeliveryScope === 'government'
        ? deliveryTargets.fillRateGovernment
        : effectiveDeliveryScope === 'private'
          ? deliveryTargets.fillRatePrivate
          : null;
    const leadTimeTarget =
      effectiveDeliveryScope === 'government'
        ? deliveryTargets.leadTimeGovernment
        : effectiveDeliveryScope === 'private'
          ? deliveryTargets.leadTimePrivate
          : null;

    return {
      currentPeriod: current?.periodMonth ?? null,
      mthRequested: current?.requested ?? null,
      mthDelivered: current?.delivered ?? null,
      mthInvoiced: current?.invoiced ?? null,
      mthFillRateDeliveredPct: current?.fillRateDeliveredPct ?? null,
      mthFillRateInvoicedPct: current?.fillRateInvoicedPct ?? null,
      mthLeadTimeAvg: current?.leadTimeAvg ?? null,
      mthAmountNotDelivered: current?.amountNotDelivered ?? null,
      mthUnitsNotDelivered: current?.unitsNotDelivered ?? null,
      ytdAmountNotDelivered,
      ytdUnitsNotDelivered,
      momFillRateDelta:
        current?.fillRateDeliveredPct != null && previous?.fillRateDeliveredPct != null
          ? current.fillRateDeliveredPct - previous.fillRateDeliveredPct
          : null,
      momLeadTimeDelta:
        current?.leadTimeAvg != null && previous?.leadTimeAvg != null
          ? current.leadTimeAvg - previous.leadTimeAvg
          : null,
      ytdRequested,
      ytdDelivered,
      ytdFillRatePct,
      ytdLeadTimeAvg,
      fillRateTarget,
      leadTimeTarget,
    };
  }, [deliveryMonthlyRows, deliveryTargets, effectiveDeliveryScope]);

  const deliveryTrendRows = useMemo(
    () =>
      deliveryMonthlyRows.map((row) => ({
        periodMonth: row.periodMonth,
        dsoValue: row.fillRateDeliveredPct ?? 0,
        targetValue: deliverySummary.fillRateTarget,
      })).filter((row) => row.periodMonth >= '2025-01-01'),
    [deliveryMonthlyRows, deliverySummary.fillRateTarget],
  );

  const {
    deliveryRankingByBu,
    deliveryRankingByMarketBrand,
    deliveryRankingByClient,
  } = useMemo(() => {
    const buildRanking = (dimension: 'business_unit' | 'market_group_brand' | 'client_requester') => {
      const byKey = new Map<
        string,
        {
          label: string;
          mthRequested: number;
          mthDelivered: number;
          mthLeadTimeTotal: number;
          mthLeadCount: number;
          ytdRequested: number;
          ytdDelivered: number;
          ytdLeadTimeTotal: number;
          ytdLeadCount: number;
        }
      >();

      for (const row of deliveryScopedRows) {
        const labelRaw =
          dimension === 'business_unit'
            ? row.businessUnitResolved
            : dimension === 'market_group_brand'
              ? `${(row.marketGroup ?? '').trim() || 'Unassigned'} - ${(row.brandName ?? '').trim() || 'Unassigned'}`
              : row.clientRequester;
        const label = (labelRaw ?? '').trim() || 'Unassigned';
        const current = byKey.get(label) ?? {
          label,
          mthRequested: 0,
          mthDelivered: 0,
          mthLeadTimeTotal: 0,
          mthLeadCount: 0,
          ytdRequested: 0,
          ytdDelivered: 0,
          ytdLeadTimeTotal: 0,
          ytdLeadCount: 0,
        };
        if (row.isMth) {
          current.mthRequested += row.cantidadTotalPedido;
          current.mthDelivered += row.cantidadEntregada;
          if (row.leadTimeDays != null && Number.isFinite(row.leadTimeDays)) {
            current.mthLeadTimeTotal += row.leadTimeDays;
            current.mthLeadCount += 1;
          }
        }
        if (row.isYtd) {
          current.ytdRequested += row.cantidadTotalPedido;
          current.ytdDelivered += row.cantidadEntregada;
          if (row.leadTimeDays != null && Number.isFinite(row.leadTimeDays)) {
            current.ytdLeadTimeTotal += row.leadTimeDays;
            current.ytdLeadCount += 1;
          }
        }
        byKey.set(label, current);
      }

      return [...byKey.values()]
      .map((row) => ({
        label: row.label,
        mthRequested: row.mthRequested,
        mthDelivered: row.mthDelivered,
        mthFillRatePct: row.mthRequested > 0 ? (row.mthDelivered / row.mthRequested) * 100 : null,
        mthLeadTimeAvg: row.mthLeadCount > 0 ? row.mthLeadTimeTotal / row.mthLeadCount : null,
        ytdRequested: row.ytdRequested,
        ytdDelivered: row.ytdDelivered,
        ytdFillRatePct: row.ytdRequested > 0 ? (row.ytdDelivered / row.ytdRequested) * 100 : null,
        ytdLeadTimeAvg: row.ytdLeadCount > 0 ? row.ytdLeadTimeTotal / row.ytdLeadCount : null,
      }))
        .sort((a, b) => b.mthRequested - a.mthRequested)
        .slice(0, 12);
    };

    return {
      deliveryRankingByBu: buildRanking('business_unit'),
      deliveryRankingByMarketBrand: buildRanking('market_group_brand'),
      deliveryRankingByClient: buildRanking('client_requester'),
    };
  }, [deliveryScopedRows]);

  const activeSourceAsOf =
    activeView === 'dso'
      ? dsoSourceAsOf
      : activeView === 'stock'
        ? stockSourceAsOf
        : activeView === 'delivery'
          ? deliverySourceAsOf
          : contractsSourceAsOfMonth ?? null;

  const formatMonthLabel = (value: string | null | undefined) => {
    if (!value) return 'N/A';
    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
  };

  const stockBusinessTypeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of stockRows) {
      const rowScope = normalizeScopeFromRow(row);
      if (selectedStockScope === 'private' && rowScope !== 'private') continue;
      if (selectedStockScope === 'public' && rowScope !== 'public') continue;
      const value = (row.businessType ?? '').trim();
      if (value) set.add(value);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [stockRows, selectedStockScope]);

  const stockClientInstitutionOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of stockRows) {
      const rowScope = normalizeScopeFromRow(row);
      if (selectedStockScope === 'private' && rowScope !== 'private') continue;
      if (selectedStockScope === 'public' && rowScope !== 'public') continue;
      if (stockBusinessTypeFilter && (row.businessType ?? '').trim() !== stockBusinessTypeFilter) continue;
      const value = (row.clientInstitution ?? '').trim();
      if (value) set.add(value);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [stockRows, selectedStockScope, stockBusinessTypeFilter]);

  const stockSkuOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of stockRows) {
      const rowScope = normalizeScopeFromRow(row);
      if (selectedStockScope === 'private' && rowScope !== 'private') continue;
      if (selectedStockScope === 'public' && rowScope !== 'public') continue;
      if (stockBusinessTypeFilter && (row.businessType ?? '').trim() !== stockBusinessTypeFilter) continue;
      if (stockClientInstitutionFilter && (row.clientInstitution ?? '').trim() !== stockClientInstitutionFilter) continue;
      const value = (row.canonicalProductName ?? '').trim();
      if (value) set.add(value);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [stockRows, selectedStockScope, stockBusinessTypeFilter, stockClientInstitutionFilter]);

  const stockExplainers = useMemo(() => {
    const build = (dimension: 'business_unit' | 'market_group_brand' | 'sku' | 'client_institution'): ExplainerRow[] => {
      const byKeyPeriod = new Map<
        string,
        {
          label: string;
          periodMonth: string;
          stock: number;
          sellOut: number;
          isMth: boolean;
          isMthPy: boolean;
          isYtd: boolean;
          isYtdPy: boolean;
        }
      >();

      for (const row of stockRows) {
        const rowScope = normalizeScopeFromRow(row);
        if (selectedStockScope === 'private' && rowScope !== 'private') continue;
        if (selectedStockScope === 'public' && rowScope !== 'public') continue;
        if (stockBusinessTypeFilter && (row.businessType ?? '').trim() !== stockBusinessTypeFilter) continue;
        if (stockClientInstitutionFilter && (row.clientInstitution ?? '').trim() !== stockClientInstitutionFilter) continue;
        if (stockSkuFilter && (row.canonicalProductName ?? '').trim() !== stockSkuFilter) continue;
        const stockType = normalizeStockType(row.stockType);
        if (stockType === 'other') continue;

        const labelRaw =
          dimension === 'business_unit'
            ? row.businessUnitName
            : dimension === 'market_group_brand'
              ? `${(row.marketGroup ?? '').trim() || 'Unassigned'} - ${(row.brandName ?? '').trim() || 'Unassigned'}`
              : dimension === 'sku'
                ? row.canonicalProductName
                : row.clientInstitution;
        const label = (labelRaw ?? '').trim() || 'Unassigned';
        const key = `${label}|${row.periodMonth}`;
        const current = byKeyPeriod.get(key) ?? {
          label,
          periodMonth: row.periodMonth,
          stock: 0,
          sellOut: 0,
          isMth: false,
          isMthPy: false,
          isYtd: false,
          isYtdPy: false,
        };
        if (stockType === 'stock') current.stock += row.stockValue;
        if (stockType === 'sell_out') current.sellOut += row.stockValue;
        current.isMth = current.isMth || row.isMth;
        current.isMthPy = current.isMthPy || row.isMthPy;
        current.isYtd = current.isYtd || row.isYtd;
        current.isYtdPy = current.isYtdPy || row.isYtdPy;
        byKeyPeriod.set(key, current);
      }

      const rows = [...byKeyPeriod.values()].map((row) => ({
        ...row,
        doh: row.sellOut > 0 ? (row.stock / row.sellOut) * 30 : null,
      }));

      const byLabel = new Map<
        string,
        {
          current: number | null;
          previous: number | null;
          ytd: number[];
          ytdPy: number[];
        }
      >();

      for (const row of rows) {
        const current = byLabel.get(row.label) ?? { current: null, previous: null, ytd: [], ytdPy: [] };
        if (row.isMth) current.current = row.doh;
        if (row.isMthPy) current.previous = row.doh;
        if (row.isYtd && row.doh != null) current.ytd.push(row.doh);
        if (row.isYtdPy && row.doh != null) current.ytdPy.push(row.doh);
        byLabel.set(row.label, current);
      }

      return [...byLabel.entries()]
        .map(([label, value]) => {
          const ytdAvg = value.ytd.length ? value.ytd.reduce((a, b) => a + b, 0) / value.ytd.length : null;
          const ytdPyAvg = value.ytdPy.length ? value.ytdPy.reduce((a, b) => a + b, 0) / value.ytdPy.length : null;
          return {
            label,
            current: value.current,
            momDelta: value.current != null && value.previous != null ? value.current - value.previous : null,
            ytdAvgDelta: ytdAvg != null && ytdPyAvg != null ? ytdAvg - ytdPyAvg : null,
          };
        })
        .sort((a, b) => (b.current ?? -Infinity) - (a.current ?? -Infinity))
        .slice(0, 8);
    };

    return {
      businessUnit: build('business_unit'),
      marketGroupBrand: build('market_group_brand'),
      sku: build('sku'),
      clientInstitution: build('client_institution'),
    };
  }, [stockRows, selectedStockScope, stockBusinessTypeFilter, stockClientInstitutionFilter, stockSkuFilter]);

  const renderExplainerTable = (title: string, rows: ExplainerRow[]) => (
    <article className="rounded-[14px] border border-slate-200 bg-slate-50/60 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">{title}</p>
      <div className="mt-2 overflow-hidden rounded-[10px] border border-slate-200 bg-white">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th className="px-2 py-2 text-left">Segment</th>
              <th className="px-2 py-2 text-right">DOH</th>
              <th className="px-2 py-2 text-center">Status</th>
              <th className="px-2 py-2 text-right">vsMoM</th>
              <th className="px-2 py-2 text-right">vsAvg</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={`${title}-${row.label}`}>
                <td className="px-2 py-2 text-left font-medium text-slate-800">{row.label}</td>
                <td
                  className={`px-2 py-2 text-right font-semibold ${
                    row.current == null || selectedStockRow?.target == null
                      ? 'text-slate-900'
                      : row.current <= selectedStockRow.target
                        ? 'text-emerald-700'
                        : 'text-rose-700'
                  }`}
                >
                  {formatDsoValue(row.current)}
                </td>
                <td className="px-2 py-2 text-center">
                  {row.current != null && selectedStockRow?.target != null ? (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                        row.current <= selectedStockRow.target
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {row.current <= selectedStockRow.target ? 'On target' : 'Above target'}
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">N/A</span>
                  )}
                </td>
                <td
                  className={`px-2 py-2 text-right font-semibold ${
                    row.momDelta == null ? 'text-slate-500' : row.momDelta <= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {row.momDelta == null ? 'N/A' : `${row.momDelta > 0 ? '+' : ''}${row.momDelta.toFixed(1)}`}
                </td>
                <td
                  className={`px-2 py-2 text-right font-semibold ${
                    row.ytdAvgDelta == null
                      ? 'text-slate-500'
                      : row.ytdAvgDelta <= 0
                        ? 'text-emerald-700'
                        : 'text-rose-700'
                  }`}
                >
                  {row.ytdAvgDelta == null ? 'N/A' : `${row.ytdAvgDelta > 0 ? '+' : ''}${row.ytdAvgDelta.toFixed(1)}`}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="px-2 py-2 text-center text-slate-500" colSpan={5}>
                  No data
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </article>
  );

  const governmentMonthlyRows = useMemo(() => {
    const sourceAsOf = governmentContractRows
      .map((row) => row.sourceAsOfMonth)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;

    const byPeriod = new Map<string, { periodMonth: string; delivered: number; isMth: boolean; isYtd: boolean; isYtdPy: boolean }>();
    for (const row of governmentContractRows) {
      if (normalizeGovernmentStage(row.category) !== selectedGovernmentStage) continue;
      if (sourceAsOf && row.periodMonth > sourceAsOf) continue;
      const current = byPeriod.get(row.periodMonth) ?? {
        periodMonth: row.periodMonth,
        delivered: 0,
        isMth: false,
        isYtd: false,
        isYtdPy: false,
      };
      current.delivered += row.deliveredQuantity;
      current.isMth = current.isMth || row.isMth;
      current.isYtd = current.isYtd || row.isYtd;
      current.isYtdPy = current.isYtdPy || row.isYtdPy;
      byPeriod.set(row.periodMonth, current);
    }
    return [...byPeriod.values()].sort((a, b) => a.periodMonth.localeCompare(b.periodMonth));
  }, [governmentContractRows, selectedGovernmentStage]);

  const governmentSummary = useMemo(() => {
    const current = governmentMonthlyRows.find((row) => row.isMth) ?? governmentMonthlyRows.at(-1) ?? null;
    const previous = current ? governmentMonthlyRows.find((row) => row.periodMonth === toYyyyMmDd(subOneMonth(toMonthDate(current.periodMonth)))) ?? null : null;
    const ytdRows = governmentMonthlyRows.filter((row) => row.isYtd);
    const ytdPyRows = governmentMonthlyRows.filter((row) => row.isYtdPy);
    const ytdTotal = ytdRows.reduce((sum, row) => sum + row.delivered, 0);
    const ytdPyTotal = ytdPyRows.reduce((sum, row) => sum + row.delivered, 0);
    const ytdAvg = ytdRows.length ? ytdTotal / ytdRows.length : null;
    const ytdPyAvg = ytdPyRows.length ? ytdPyTotal / ytdPyRows.length : null;
    const scopeRows = governmentContractRows.filter(
      (row) => normalizeGovernmentStage(row.category) === selectedGovernmentStage,
    );
    const baselineRows = governmentContractRows.filter(
      (row) => normalizeGovernmentStage(row.category) === 'ordenado',
    );
    const denominatorBaseRows = baselineRows.length > 0 ? baselineRows : scopeRows;
    const denominatorSnapshotMonth =
      denominatorBaseRows
        .map((row) => row.periodMonth)
        .filter((value) => Boolean(value))
        .sort()
        .at(0) ?? null;
    const denominatorRows = denominatorSnapshotMonth
      ? denominatorBaseRows.filter((row) => row.periodMonth === denominatorSnapshotMonth)
      : [];
    const delivered2025 = scopeRows
      .filter((row) => row.periodMonth >= '2025-01-01' && row.periodMonth < '2026-01-01')
      .reduce((sum, row) => sum + row.deliveredQuantity, 0);
    const delivered2026 = scopeRows
      .filter((row) => row.periodMonth >= '2026-01-01' && row.periodMonth < '2027-01-01')
      .reduce((sum, row) => sum + row.deliveredQuantity, 0);
    const deliveredFrom2025 = delivered2025 + delivered2026;
    const total2526 = denominatorRows.reduce((sum, row) => sum + getSanitizedGovernmentDenominators(row).maxQtyTotal, 0);
    const total2025 = denominatorRows.reduce((sum, row) => sum + getSanitizedGovernmentDenominators(row).maxQtyPy, 0);
    const total2026 = denominatorRows.reduce((sum, row) => sum + getSanitizedGovernmentDenominators(row).maxQtyCy, 0);
    const currentYear = current?.periodMonth ? new Date(`${current.periodMonth}T00:00:00Z`).getUTCFullYear() : null;
    const isCurrentYear2026 = currentYear === 2026;
    const trailing12AvgQty = (() => {
      if (!current?.periodMonth) return null;
      const currentDate = toMonthDate(current.periodMonth);
      if (!currentDate) return null;
      const startDate = new Date(currentDate);
      startDate.setUTCMonth(startDate.getUTCMonth() - 11);
      const trailingRows = governmentMonthlyRows.filter((row) => {
        const rowDate = toMonthDate(row.periodMonth);
        if (!rowDate) return false;
        return rowDate >= startDate && rowDate <= currentDate;
      });
      if (trailingRows.length === 0) return null;
      return trailingRows.reduce((sum, row) => sum + row.delivered, 0) / trailingRows.length;
    })();
    const monthsElapsed2026 = new Set(
      scopeRows
        .filter((row) => row.isYtd && row.periodMonth >= '2026-01-01' && row.periodMonth < '2027-01-01')
        .map((row) => row.periodMonth),
    ).size;
    const monthlyRunRatePct2026 =
      isCurrentYear2026 && trailing12AvgQty != null && total2026 > 0
        ? (trailing12AvgQty / total2026) * 100
        : null;
    const remainingPct2026 =
      isCurrentYear2026 && total2026 > 0
        ? Math.max(0, 100 - (delivered2026 / total2026) * 100)
        : null;
    const monthsTo100Estimate2026 =
      monthlyRunRatePct2026 != null && monthlyRunRatePct2026 > 0 && remainingPct2026 != null
        ? remainingPct2026 / monthlyRunRatePct2026
        : null;
    const projected100Month2026 = (() => {
      if (!isCurrentYear2026 || monthsTo100Estimate2026 == null || !current?.periodMonth) return null;
      const base = new Date(`${current.periodMonth}T00:00:00Z`);
      if (Number.isNaN(base.getTime())) return null;
      base.setUTCMonth(base.getUTCMonth() + Math.ceil(monthsTo100Estimate2026));
      return base.toISOString().slice(0, 10);
    })();
    const monthlyRunRateQty2026 =
      isCurrentYear2026 ? trailing12AvgQty : null;
    const projectedYearEndProgress2026Pct =
      isCurrentYear2026 && monthlyRunRatePct2026 != null
        ? Math.min(100, ((delivered2026 / Math.max(total2026, 1)) * 100) + monthlyRunRatePct2026 * (12 - monthsElapsed2026))
        : null;

    return {
      currentPeriod: current?.periodMonth ?? null,
      currentDelivered: current?.delivered ?? null,
      previousDelivered: previous?.delivered ?? null,
      momDelta:
        current?.delivered != null && previous?.delivered != null
          ? current.delivered - previous.delivered
          : null,
      ytdTotal,
      ytdPyTotal,
      ytdAvg,
      ytdPyAvg,
      ytdAvgDelta: ytdAvg != null && ytdPyAvg != null ? ytdAvg - ytdPyAvg : null,
      deliveredFrom2025,
      delivered2025,
      delivered2026,
      total2526,
      total2025,
      total2026,
      // Progress 2025-2026 = SUM(delivered_quantity from 2025-01-01 onward) / SUM(total_2025_2026)
      progress2526Pct: total2526 > 0 ? (deliveredFrom2025 / total2526) * 100 : null,
      // Progress 2025 = SUM(delivered_quantity where YEAR(period_month)=2025) / SUM(total_2025)
      progress2025Pct: total2025 > 0 ? (delivered2025 / total2025) * 100 : null,
      // Progress 2026 = SUM(delivered_quantity where YEAR(period_month)=2026) / SUM(total_2026)
      progress2026Pct: total2026 > 0 ? (delivered2026 / total2026) * 100 : null,
      monthsElapsed2026,
      monthlyRunRatePct2026,
      monthlyRunRateQty2026,
      monthsTo100Estimate2026,
      projected100Month2026,
      projectedYearEndProgress2026Pct,
    };
  }, [governmentMonthlyRows, governmentContractRows, selectedGovernmentStage]);

  const governmentCurrentYear = useMemo(() => {
    const anchor =
      governmentSummary.currentPeriod ??
      governmentMonthlyRows.map((row) => row.periodMonth).sort().at(-1) ??
      null;
    if (!anchor) return null;
    const parsed = new Date(`${anchor}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.getUTCFullYear();
  }, [governmentMonthlyRows, governmentSummary.currentPeriod]);
  const governmentPreviousYear = governmentCurrentYear != null ? governmentCurrentYear - 1 : null;
  const governmentPyLabel = governmentPreviousYear != null ? String(governmentPreviousYear) : 'PY';
  const governmentCyLabel = governmentCurrentYear != null ? String(governmentCurrentYear) : 'CY';
  const governmentPyCyLabel =
    governmentPreviousYear != null && governmentCurrentYear != null
      ? `${governmentPreviousYear}+${governmentCurrentYear}`
      : 'PY+CY';

  const governmentTrendRows = useMemo(
    () =>
      governmentMonthlyRows.map((row) => ({
        periodMonth: row.periodMonth,
        dsoValue: row.delivered,
        targetValue: null,
      })),
    [governmentMonthlyRows],
  );

  const governmentRankingRows = useMemo(() => {
    const keyFor = (row: CommercialOperationsGovernmentContractProgressRow) => {
      if (selectedGovernmentDimension === 'institution') return (row.institution ?? '').trim() || 'Unassigned';
      if (selectedGovernmentDimension === 'business_unit') return (row.businessUnit ?? '').trim() || 'Unassigned';
      const marketGroup = (row.marketGroup ?? '').trim();
      const brandName = (row.brandName ?? '').trim();
      const fallback = (row.canonicalProductName ?? row.sourceProductRaw ?? '').trim();
      return `${marketGroup || 'Unassigned'} - ${brandName || fallback || 'Unassigned'}`;
    };

    const byKey = new Map<
      string,
      { label: string; mthDelivered: number; ytdDelivered: number; ytdPyDelivered: number }
    >();

    const stageRows = governmentContractRows.filter(
      (row) => normalizeGovernmentStage(row.category) === selectedGovernmentStage,
    );
    const denominatorSnapshotMonth =
      stageRows
        .map((row) => row.periodMonth)
        .filter((value) => Boolean(value))
        .sort()
        .at(0) ?? null;
    const maxQtyByLabel = new Map<string, { maxQtyPy: number; maxQtyCy: number }>();

    for (const row of stageRows) {
      const stage = normalizeGovernmentStage(row.category);
      const key = keyFor(row);
      if (stage === selectedGovernmentStage) {
        const current = byKey.get(key) ?? { label: key, mthDelivered: 0, ytdDelivered: 0, ytdPyDelivered: 0 };
        if (row.isMth) current.mthDelivered += row.deliveredQuantity;
        if (row.isYtd) current.ytdDelivered += row.deliveredQuantity;
        if (row.isYtdPy) current.ytdPyDelivered += row.deliveredQuantity;
        byKey.set(key, current);
        if (denominatorSnapshotMonth && row.periodMonth === denominatorSnapshotMonth) {
          const prev = maxQtyByLabel.get(key) ?? { maxQtyPy: 0, maxQtyCy: 0 };
          const den = getSanitizedGovernmentDenominators(row);
          prev.maxQtyPy += den.maxQtyPy;
          prev.maxQtyCy += den.maxQtyCy;
          maxQtyByLabel.set(key, prev);
        }
      }
    }

    return [...byKey.values()]
      .map((row) => ({
        ...row,
        maxQtyPy: maxQtyByLabel.get(row.label)?.maxQtyPy ?? 0,
        maxQtyCy: maxQtyByLabel.get(row.label)?.maxQtyCy ?? 0,
      }))
      .map((row) => ({
        ...row,
        progressPctPyCy:
          row.maxQtyPy + row.maxQtyCy > 0
            ? ((row.ytdPyDelivered + row.ytdDelivered) / (row.maxQtyPy + row.maxQtyCy)) * 100
            : null,
        progressPctPy: row.maxQtyPy > 0 ? (row.ytdPyDelivered / row.maxQtyPy) * 100 : null,
        progressPctCy: row.maxQtyCy > 0 ? (row.ytdDelivered / row.maxQtyCy) * 100 : null,
      }))
      .sort((a, b) => b.mthDelivered - a.mthDelivered)
      .slice(0, 12);
  }, [governmentContractRows, selectedGovernmentDimension, selectedGovernmentStage]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-full border border-slate-300 bg-white p-1 w-fit">
          <button
            type="button"
            onClick={() => setActiveView('dso')}
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
              activeView === 'dso' ? 'bg-slate-900 text-white' : 'text-slate-600'
            }`}
          >
            DSO View
          </button>
          <button
            type="button"
            onClick={() => setActiveView('stock')}
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
              activeView === 'stock' ? 'bg-slate-900 text-white' : 'text-slate-600'
            }`}
          >
            Stock View
          </button>
          <button
            type="button"
            onClick={() => setActiveView('government-contract-progress')}
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
              activeView === 'government-contract-progress' ? 'bg-slate-900 text-white' : 'text-slate-600'
            }`}
          >
            Government Contract Progress View
          </button>
          <button
            type="button"
            onClick={() => setActiveView('delivery')}
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
              activeView === 'delivery' ? 'bg-slate-900 text-white' : 'text-slate-600'
            }`}
          >
            Delivery View
          </button>
        </div>
        <span className="ml-auto rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700">
          <span className="font-semibold uppercase tracking-[0.12em] text-slate-500">Source As Of</span>{' '}
          {formatMonthLabel(activeSourceAsOf)}
        </span>
      </div>

      {activeView === 'stock' ? (
        <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)] space-y-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-600">STOCK VIEW (DOH)</p>

          <div className="overflow-hidden rounded-[12px] border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Channel</th>
                  <th className="px-3 py-2 text-right">DOH Current</th>
                  <th className="px-3 py-2 text-right">Target</th>
                  <th className="px-3 py-2 text-right">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stockChannelRows.map((row) => {
                  const active = row.scope === selectedStockScope;
                  return (
                    <tr
                      key={row.scope}
                      className={`cursor-pointer transition ${active ? 'bg-sky-50/60' : 'hover:bg-slate-50'}`}
                      onClick={() => setSelectedStockScope(row.scope)}
                    >
                      <td className="px-3 py-2 text-left font-medium text-slate-800">{row.label}</td>
                      <td className="px-3 py-2 text-right text-slate-900">{formatDsoValue(row.current)}</td>
                      <td className="px-3 py-2 text-right text-slate-900">{formatDsoValue(row.target)}</td>
                      <td
                        className={`px-3 py-2 text-right font-semibold ${
                          row.variance == null ? 'text-slate-500' : row.variance <= 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {row.variance == null ? 'N/A' : `${row.variance > 0 ? '+' : ''}${row.variance.toFixed(1)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-1 flex items-center gap-1 rounded-full border border-slate-300 bg-white p-1 w-fit">
            {(['total', 'private', 'public'] as const).map((scope) => {
              const active = scope === selectedStockScope;
              return (
                <button
                  key={scope}
                  type="button"
                  onClick={() => setSelectedStockScope(scope)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
                    active ? 'bg-slate-900 text-white' : 'text-slate-600'
                  }`}
                >
                  {toScopeLabel(scope)}
                </button>
              );
            })}
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-slate-950">DOH Trend vs Target</h2>
              <p className="mt-1 text-sm text-slate-600">
                {selectedStockRow?.label ?? 'N/A'} | Current: {formatDsoValue(selectedStockRow?.current ?? null)} | Target:{' '}
                {formatDsoValue(selectedStockRow?.target ?? null)} | Var:{' '}
                {selectedStockRow?.variance == null
                  ? 'N/A'
                  : `${selectedStockRow.variance > 0 ? '+' : ''}${selectedStockRow.variance.toFixed(1)}`}
              </p>
              <div className="mt-3">
                <DsoTrendChart rows={selectedStockTrendRows} metricLabel="DOH" />
              </div>
            </div>
            <div className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                  <p className="uppercase tracking-[0.12em] text-slate-500">MoM (Current vs Prev Month)</p>
                  <p
                    className={`mt-1 font-semibold ${
                      selectedStockRow?.momDelta == null
                        ? 'text-slate-700'
                        : selectedStockRow.momDelta <= 0
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                    }`}
                  >
                    {selectedStockRow?.momDelta == null
                      ? 'N/A'
                      : `${selectedStockRow.momDelta > 0 ? '+' : ''}${selectedStockRow.momDelta.toFixed(1)} days`}
                  </p>
                </div>
                <div className="rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                  <p className="uppercase tracking-[0.12em] text-slate-500">YTD Avg vs LY Avg</p>
                  <p
                    className={`mt-1 font-semibold ${
                      selectedStockRow?.ytdAvg == null || selectedStockRow?.ytdPyAvg == null
                        ? 'text-slate-700'
                        : selectedStockRow.ytdAvg - selectedStockRow.ytdPyAvg <= 0
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                    }`}
                  >
                    {selectedStockRow?.ytdAvg == null || selectedStockRow?.ytdPyAvg == null
                      ? 'N/A'
                      : `${selectedStockRow.ytdAvg - selectedStockRow.ytdPyAvg > 0 ? '+' : ''}${(
                          selectedStockRow.ytdAvg - selectedStockRow.ytdPyAvg
                        ).toFixed(1)} days`}
                  </p>
                </div>
              </div>
              <div>
                <h3 className="text-base font-semibold tracking-tight text-slate-900">DOH Comparison Snapshot</h3>
                <p className="mt-1 text-sm text-slate-600">Avg PY | Target | M-1 | M</p>
                <div className="mt-3">
                  <DsoComparisonBarChart
                    pyAvg={selectedStockRow?.ytdPyAvg ?? null}
                    target={selectedStockRow?.target ?? null}
                    mMinus1={selectedStockRow?.previous ?? null}
                    current={selectedStockRow?.current ?? null}
                    metricLabel="DOH"
                    pyAvgLabel={`Average ${(stockReportPeriod ? stockReportPeriod.getUTCFullYear() - 1 : 'PY')}`}
                    targetLabel="Current Target"
                    mMinus1Label={`Previous Month (${toYyyyMmDd(stockPreviousMonth)})`}
                    currentLabel={`Current Month (${toYyyyMmDd(stockReportPeriod)})`}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            <select
              value={stockBusinessTypeFilter}
              onChange={(e) => {
                setStockBusinessTypeFilter(e.target.value);
                setStockClientInstitutionFilter('');
                setStockSkuFilter('');
              }}
              className="rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900"
            >
              <option value="">All Business Types</option>
              {stockBusinessTypeOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <select
              value={stockClientInstitutionFilter}
              onChange={(e) => setStockClientInstitutionFilter(e.target.value)}
              className="rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900"
            >
              <option value="">All Clients/Institutions</option>
              {stockClientInstitutionOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <select
              value={stockSkuFilter}
              onChange={(e) => setStockSkuFilter(e.target.value)}
              className="rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900"
            >
              <option value="">All SKU</option>
              {stockSkuOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <p>
              DOH corresponds current month {toYyyyMmDd(stockReportPeriod)}.
            </p>
            <p>
              vsMoM difference vs DOH previous month.
            </p>
            <p>
              vsAvg difference vs YTD Average.
            </p>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            {renderExplainerTable(`${toScopeLabel(selectedStockScope)} Behavior · Business Unit`, stockExplainers.businessUnit)}
            {renderExplainerTable(`${toScopeLabel(selectedStockScope)} Behavior · MarketGroup - Brand`, stockExplainers.marketGroupBrand)}
            {renderExplainerTable(`${toScopeLabel(selectedStockScope)} Behavior · SKU`, stockExplainers.sku)}
            {renderExplainerTable(`${toScopeLabel(selectedStockScope)} Behavior · Client / Institution`, stockExplainers.clientInstitution)}
          </div>
        </article>
      ) : null}

      {activeView === 'dso' ? (
        <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-600">DSO BY GROUP Current vs Target</p>
          </div>

          <div className="mt-4 rounded-[16px] border border-slate-200 bg-slate-50/60 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">DSO by Group (MTH)</p>
            <div className="mt-3 overflow-hidden rounded-[12px] border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">DSO Name</th>
                    <th className="px-3 py-2 text-right">Current</th>
                    <th className="px-3 py-2 text-right">Target</th>
                    <th className="px-3 py-2 text-right">Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orderedTableRows.map((row) => {
                    const active = normalizeLabel(row.groupName) === normalizeLabel(selectedGroup);
                    return (
                      <tr
                        key={row.groupName}
                        className={`cursor-pointer transition ${active ? 'bg-sky-50/60' : 'hover:bg-slate-50'}`}
                        onClick={() => setSelectedGroup(row.groupName)}
                      >
                        <td className="px-3 py-2 text-left font-medium text-slate-800">{row.groupName}</td>
                        <td className="px-3 py-2 text-right text-slate-900">{formatDsoValue(row.currentValue)}</td>
                        <td className="px-3 py-2 text-right text-slate-900">{formatDsoValue(row.target)}</td>
                        <td
                          className={`px-3 py-2 text-right font-semibold ${
                            row.variance == null ? 'text-slate-500' : row.variance <= 0 ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {row.variance == null ? 'N/A' : `${row.variance > 0 ? '+' : ''}${row.variance.toFixed(1)}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-1 rounded-full border border-slate-300 bg-white p-1 w-fit">
            {groupTabs.map((groupName) => {
              const active = normalizeLabel(groupName) === normalizeLabel(selectedGroup);
              return (
                <button
                  key={groupName}
                  type="button"
                  onClick={() => setSelectedGroup(groupName)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
                    active ? 'bg-slate-900 text-white' : 'text-slate-600'
                  }`}
                >
                  {groupName}
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-slate-950">DSO Trend vs Target</h2>
              <p className="mt-1 text-xs text-slate-500">
                DSO shows the increase or decrease in days elapsed from invoice issue date to payment receipt date.
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {selectedGroup} | Current:{' '}
                {formatDsoValue(findGroup(tableRows, selectedGroup)?.currentValue ?? selectedOverview?.dsoReportPeriod ?? null)} |
                Target: {formatDsoValue(selectedTarget)} | Var:{' '}
                {selectedVariance == null ? 'N/A' : `${selectedVariance > 0 ? '+' : ''}${selectedVariance.toFixed(1)}`}
              </p>
              <div className="mt-3">
                <DsoTrendChart rows={selectedTrendRows} />
              </div>
            </div>
            <div className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                  <p className="uppercase tracking-[0.12em] text-slate-500">MoM (Current vs Prev Month)</p>
                  <p
                    className={`mt-1 font-semibold ${
                      selectedTable?.momDelta == null
                        ? 'text-slate-700'
                        : selectedTable.momDelta <= 0
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                    }`}
                  >
                    {selectedTable?.momDelta == null
                      ? 'N/A'
                      : `${selectedTable.momDelta > 0 ? '+' : ''}${selectedTable.momDelta.toFixed(1)} days`}
                  </p>
                </div>
                <div className="rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                  <p className="uppercase tracking-[0.12em] text-slate-500">YTD Avg vs LY Avg</p>
                  <p
                    className={`mt-1 font-semibold ${
                      selectedTable?.ytdAvgDelta == null
                        ? 'text-slate-700'
                        : selectedTable.ytdAvgDelta <= 0
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                    }`}
                  >
                    {selectedTable?.ytdAvgDelta == null
                      ? 'N/A'
                      : `${selectedTable.ytdAvgDelta > 0 ? '+' : ''}${selectedTable.ytdAvgDelta.toFixed(1)} days`}
                  </p>
                </div>
              </div>
              <div>
                <h3 className="text-base font-semibold tracking-tight text-slate-900">DSO Comparison Snapshot</h3>
                <p className="mt-1 text-sm text-slate-600">Avg PY | Target | M-1 | M</p>
                <div className="mt-3">
                  <DsoComparisonBarChart
                    pyAvg={selectedTable?.ytdAvgPy ?? null}
                    target={selectedTarget}
                    mMinus1={selectedTable?.previousMonthValue ?? null}
                    current={selectedTable?.currentValue ?? null}
                    pyAvgLabel={`Average ${pyYearLabel}`}
                    targetLabel="Current Target"
                    mMinus1Label={`Previous Month (${toYyyyMmDd(previousMonthDate)})`}
                    currentLabel={`Current Month (${toYyyyMmDd(reportPeriodDate)})`}
                  />
                </div>
              </div>
            </div>
          </div>
        </article>
      ) : null}

      {activeView === 'delivery' ? (
        <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)] space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-600">Delivery View</p>
              <h2 className="text-lg font-semibold tracking-tight text-slate-950">
                Fill Rate and Lead Time Monitoring
              </h2>
            </div>
            <div className="flex items-center gap-1 rounded-full border border-slate-300 bg-white p-1">
              {(['ytd', 'mth'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDeliveryRankingMode(mode)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
                    deliveryRankingMode === mode ? 'bg-slate-900 text-white' : 'text-slate-600'
                  }`}
                >
                  {mode.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          {!hasPrivateDelivery ? (
            <div className="rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Private orders are not available yet. Showing Government scope only.
            </div>
          ) : null}

          <div className="mt-1 flex items-center gap-1 rounded-full border border-slate-300 bg-white p-1 w-fit">
            {(hasPrivateDelivery
              ? ([
                  ['government', 'Government'],
                  ['private', 'Private'],
                  ['total', 'Total'],
                ] as const)
              : ([['government', 'Government']] as const)
            ).map(([scope, label]) => (
              <button
                key={scope}
                type="button"
                onClick={() => setSelectedDeliveryScope(scope)}
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
                  effectiveDeliveryScope === scope ? 'bg-slate-900 text-white' : 'text-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
              {(() => {
                const selectedFillRate =
                  deliveryRankingMode === 'ytd'
                    ? deliverySummary.ytdFillRatePct
                    : deliverySummary.mthFillRateDeliveredPct;
                const fillRateToneClass =
                  deliverySummary.fillRateTarget == null || selectedFillRate == null
                    ? 'text-slate-600'
                    : selectedFillRate >= deliverySummary.fillRateTarget
                      ? 'text-emerald-700'
                      : 'text-rose-700';

                return (
                  <>
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{deliveryRankingMode.toUpperCase()} Fill Rate</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {formatPercent(
                  deliveryRankingMode === 'ytd'
                    ? deliverySummary.ytdFillRatePct
                    : deliverySummary.mthFillRateDeliveredPct,
                )}
              </p>
              <p className={`text-xs ${fillRateToneClass}`}>
                Target: {formatPercent(deliverySummary.fillRateTarget)}
              </p>
                  </>
                );
              })()}
            </div>
            <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
              {(() => {
                const selectedLeadTime =
                  deliveryRankingMode === 'ytd'
                    ? deliverySummary.ytdLeadTimeAvg
                    : deliverySummary.mthLeadTimeAvg;
                const leadTimeToneClass =
                  deliverySummary.leadTimeTarget == null || selectedLeadTime == null
                    ? 'text-slate-600'
                    : selectedLeadTime <= deliverySummary.leadTimeTarget
                      ? 'text-emerald-700'
                      : 'text-rose-700';

                return (
                  <>
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{deliveryRankingMode.toUpperCase()} Lead Time</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {(deliveryRankingMode === 'ytd'
                  ? deliverySummary.ytdLeadTimeAvg
                  : deliverySummary.mthLeadTimeAvg) == null
                  ? 'N/A'
                  : `${(deliveryRankingMode === 'ytd'
                      ? deliverySummary.ytdLeadTimeAvg
                      : deliverySummary.mthLeadTimeAvg
                    )?.toFixed(1)} days`}
              </p>
              <p className={`text-xs ${leadTimeToneClass}`}>
                Target: {deliverySummary.leadTimeTarget == null ? 'N/A' : `${deliverySummary.leadTimeTarget.toFixed(1)} days`}
              </p>
                  </>
                );
              })()}
            </div>
            <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{deliveryRankingMode.toUpperCase()} Value at Risk</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {formatCurrency(
                  deliveryRankingMode === 'ytd'
                    ? deliverySummary.ytdAmountNotDelivered
                    : deliverySummary.mthAmountNotDelivered,
                )}
              </p>
              <p className="text-xs text-slate-600">Amount not delivered</p>
            </div>
            <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{deliveryRankingMode.toUpperCase()} Missing Units</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {formatQuantity(
                  deliveryRankingMode === 'ytd'
                    ? deliverySummary.ytdUnitsNotDelivered
                    : deliverySummary.mthUnitsNotDelivered,
                )}
              </p>
              <p className="text-xs text-slate-600">Units not delivered vs ordered</p>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div>
              <h3 className="text-base font-semibold tracking-tight text-slate-900">Fill Rate Trend (Delivered)</h3>
              <div className="mt-3">
                <DsoTrendChart rows={deliveryTrendRows} metricLabel="Fill Rate %" />
              </div>
            </div>
            <div>
              <h3 className="text-base font-semibold tracking-tight text-slate-900">Delivery Snapshot</h3>
              <p className="mt-1 text-sm text-slate-600">Avg YTD | Target | M-1 | M</p>
              <div className="mt-3">
                <DsoComparisonBarChart
                  pyAvg={deliverySummary.ytdFillRatePct}
                  target={deliverySummary.fillRateTarget}
                  mMinus1={
                    deliverySummary.mthFillRateDeliveredPct != null && deliverySummary.momFillRateDelta != null
                      ? deliverySummary.mthFillRateDeliveredPct - deliverySummary.momFillRateDelta
                      : null
                  }
                  current={deliverySummary.mthFillRateDeliveredPct}
                  metricLabel="Fill Rate %"
                  pyAvgLabel="YTD Average"
                  targetLabel="Current Target"
                  mMinus1Label="Previous Month"
                  currentLabel="Current Month"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-3">
            {[
              { title: 'Business Unit', rows: deliveryRankingByBu },
              { title: 'MarketGroup - Brand', rows: deliveryRankingByMarketBrand },
              { title: 'Client / Requester', rows: deliveryRankingByClient },
            ].map(({ title, rows }) => (
              <article key={String(title)} className="rounded-[14px] border border-slate-200 bg-slate-50/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">{title}</p>
                <div className="mt-2 overflow-hidden rounded-[10px] border border-slate-200 bg-white">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                      <tr>
                        <th className="px-2 py-2 text-left">Segment</th>
                        <th className="px-2 py-2 text-right">{deliveryRankingMode === 'ytd' ? 'YTD Fill' : 'MTH Fill'}</th>
                        <th className="px-2 py-2 text-right">Lead Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(rows as Array<{
                        label: string;
                        mthFillRatePct: number | null;
                        ytdFillRatePct: number | null;
                        mthLeadTimeAvg: number | null;
                        ytdLeadTimeAvg: number | null;
                      }>)
                        .filter((row) =>
                          deliveryRankingMode === 'ytd'
                            ? row.ytdFillRatePct != null && row.ytdLeadTimeAvg != null
                            : row.mthFillRatePct != null && row.mthLeadTimeAvg != null,
                        )
                        .map((row) => (
                        <tr key={`${String(title)}-${row.label}`}>
                          <td className="px-2 py-2 text-left font-medium text-slate-800">{row.label}</td>
                          <td className="px-2 py-2 text-right text-slate-900">
                            {formatPercent(deliveryRankingMode === 'ytd' ? row.ytdFillRatePct : row.mthFillRatePct)}
                          </td>
                          <td className="px-2 py-2 text-right text-slate-900">
                            {(deliveryRankingMode === 'ytd' ? row.ytdLeadTimeAvg : row.mthLeadTimeAvg) == null
                              ? 'N/A'
                              : `${(deliveryRankingMode === 'ytd' ? row.ytdLeadTimeAvg : row.mthLeadTimeAvg)?.toFixed(1)}d`}
                          </td>
                        </tr>
                      ))}
                      {(rows as Array<{
                        mthFillRatePct: number | null;
                        ytdFillRatePct: number | null;
                        mthLeadTimeAvg: number | null;
                        ytdLeadTimeAvg: number | null;
                      }>).filter((row) =>
                        deliveryRankingMode === 'ytd'
                          ? row.ytdFillRatePct != null && row.ytdLeadTimeAvg != null
                          : row.mthFillRatePct != null && row.mthLeadTimeAvg != null,
                      ).length === 0 ? (
                        <tr>
                          <td className="px-2 py-2 text-center text-slate-500" colSpan={4}>
                            No data
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </article>
            ))}
          </div>
        </article>
      ) : null}

      {activeView === 'government-contract-progress' ? (
        <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-600">Government Contract Progress</p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
            Delivered Quantity Monitoring (Government Contracts)
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Monthly execution and YTD delivery tracking from normalized contract progress rows.
          </p>

          <div className="mt-4 flex items-center gap-1 rounded-full border border-slate-300 bg-white p-1 w-fit">
            {([
              ['ordenado', 'Ordenado'],
              ['entregado', 'Entregado'],
              ['facturado', 'Facturado'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedGovernmentStage(key)}
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
                  selectedGovernmentStage === key ? 'bg-slate-900 text-white' : 'text-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">MTH Delivered</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{formatDsoValue(governmentSummary.currentDelivered)}</p>
              <p className="text-xs text-slate-600">{formatMonthLabel(governmentSummary.currentPeriod)}</p>
            </div>
            <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">MoM Delta</p>
              <p
                className={`mt-1 text-xl font-semibold ${
                  governmentSummary.momDelta == null
                    ? 'text-slate-700'
                    : governmentSummary.momDelta >= 0
                      ? 'text-emerald-700'
                      : 'text-rose-700'
                }`}
              >
                {governmentSummary.momDelta == null
                  ? 'N/A'
                  : `${governmentSummary.momDelta > 0 ? '+' : ''}${governmentSummary.momDelta.toFixed(1)}`}
              </p>
              <p className="text-xs text-slate-600">Current vs previous month</p>
            </div>
            <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">YTD Delivered</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{formatDsoValue(governmentSummary.ytdTotal)}</p>
              <p className="text-xs text-slate-600">
                {governmentPyLabel} YTD: {formatDsoValue(governmentSummary.ytdPyTotal)}
              </p>
            </div>
            <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                YTD Avg vs {governmentPyLabel} Avg
              </p>
              <p
                className={`mt-1 text-xl font-semibold ${
                  governmentSummary.ytdAvgDelta == null
                    ? 'text-slate-700'
                    : governmentSummary.ytdAvgDelta >= 0
                      ? 'text-emerald-700'
                      : 'text-rose-700'
                }`}
              >
                {governmentSummary.ytdAvgDelta == null
                  ? 'N/A'
                  : `${governmentSummary.ytdAvgDelta > 0 ? '+' : ''}${governmentSummary.ytdAvgDelta.toFixed(1)}`}
              </p>
              <p className="text-xs text-slate-600">Monthly average delta</p>
            </div>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Progress {governmentPyLabel}-{governmentCyLabel}</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {governmentSummary.progress2526Pct == null ? 'N/A' : `${governmentSummary.progress2526Pct.toFixed(1)}%`}
              </p>
              <p className="text-xs text-slate-600">
                {formatQuantity(governmentSummary.deliveredFrom2025)} / {formatQuantity(governmentSummary.total2526)}
              </p>
              <p className="text-xs text-slate-600">Executed / Denominator: Max Contract Quantity</p>
            </div>
            <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Progress {governmentPyLabel}</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {governmentSummary.progress2025Pct == null ? 'N/A' : `${governmentSummary.progress2025Pct.toFixed(1)}%`}
              </p>
              <p className="text-xs text-slate-600">
                {formatQuantity(governmentSummary.delivered2025)} / {formatQuantity(governmentSummary.total2025)}
              </p>
              <p className="text-xs text-slate-600">Executed {governmentPyLabel} / Total {governmentPyLabel}</p>
            </div>
            <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Progress {governmentCyLabel}</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {governmentSummary.progress2026Pct == null ? 'N/A' : `${governmentSummary.progress2026Pct.toFixed(1)}%`}
              </p>
              <p className="text-xs text-slate-600">
                {formatQuantity(governmentSummary.delivered2026)} / {formatQuantity(governmentSummary.total2026)}
              </p>
              <p className="text-xs text-slate-600">Executed {governmentCyLabel} / Total {governmentCyLabel}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div>
              <h3 className="text-base font-semibold tracking-tight text-slate-900">Delivered Trend (Monthly)</h3>
              <div className="mt-3">
                <DsoTrendChart rows={governmentTrendRows} metricLabel="Delivered Qty" />
              </div>
            </div>
            <div>
              <h3 className="text-base font-semibold tracking-tight text-slate-900">Execution Snapshot</h3>
              <p className="mt-1 text-sm text-slate-600">Avg {governmentPyLabel} | M-1 | M | Forecast M+1</p>
              <div className="mt-3">
                <DsoComparisonBarChart
                  pyAvg={governmentSummary.ytdPyAvg}
                  target={governmentSummary.monthlyRunRateQty2026}
                  mMinus1={governmentSummary.previousDelivered}
                  current={governmentSummary.currentDelivered}
                  targetPosition="last"
                  metricLabel="Delivered Qty"
                  pyAvgLabel={`Average ${governmentPyLabel}`}
                  targetLabel="Forecast M+1"
                  mMinus1Label="Previous Month"
                  currentLabel="Current Month"
                />
              </div>
              <div className="mt-3 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                <p className="font-semibold uppercase tracking-[0.12em] text-slate-500">Projection to 100%</p>
                <p className="mt-1">
                  {governmentSummary.monthsTo100Estimate2026 == null
                    ? 'N/A'
                    : `${governmentSummary.monthsTo100Estimate2026.toFixed(1)} months at trailing-12M run-rate (${governmentSummary.monthlyRunRatePct2026?.toFixed(2)}%/month).`}
                </p>
                <p className="mt-1 text-slate-600">
                  {governmentSummary.projected100Month2026 == null
                    ? 'Estimated crossing month: N/A'
                    : `Estimated crossing month: ${formatMonthLabel(governmentSummary.projected100Month2026)}`}
                </p>
                <p className="mt-1 text-slate-600">
                  {governmentSummary.projectedYearEndProgress2026Pct == null
                    ? 'Projected YE progress: N/A'
                    : `Projected YE progress: ${governmentSummary.projectedYearEndProgress2026Pct.toFixed(1)}%`}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-1 rounded-full border border-slate-300 bg-white p-1 w-fit">
            {([
              ['product', 'By Product'],
              ['institution', 'By Institution'],
              ['business_unit', 'By BU'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedGovernmentDimension(key)}
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
                  selectedGovernmentDimension === key ? 'bg-slate-900 text-white' : 'text-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-3 overflow-hidden rounded-[12px] border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Segment</th>
                  <th className="px-3 py-2 text-right">MTH</th>
                  <th className="px-3 py-2 text-right">YTD</th>
                  <th className="px-3 py-2 text-right">% Progress [{governmentPyCyLabel}]</th>
                  <th className="px-3 py-2 text-right">% Progress [{governmentPyLabel}]</th>
                  <th className="px-3 py-2 text-right">% Progress [{governmentCyLabel}]</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {governmentRankingRows.map((row) => (
                  <tr key={row.label}>
                    <td className="px-3 py-2 text-left font-medium text-slate-800">{row.label}</td>
                    <td className="px-3 py-2 text-right text-slate-900">{formatQuantity(row.mthDelivered)}</td>
                    <td className="px-3 py-2 text-right text-slate-900">{formatQuantity(row.ytdDelivered)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-900">
                      {row.progressPctPyCy == null ? 'N/A' : `${row.progressPctPyCy.toFixed(1)}%`}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-900">
                      {row.progressPctPy == null ? 'N/A' : `${row.progressPctPy.toFixed(1)}%`}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-900">
                      {row.progressPctCy == null ? 'N/A' : `${row.progressPctCy.toFixed(1)}%`}
                    </td>
                  </tr>
                ))}
                {governmentRankingRows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-2 text-center text-slate-500" colSpan={6}>
                      No government contract progress data available.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>
      ) : null}
    </div>
  );
}
