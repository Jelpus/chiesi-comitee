import fs from 'node:fs';
import path from 'node:path';
import { BigQuery } from '@google-cloud/bigquery';

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIndex = line.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function parsePrivateKey(value) {
  if (!value) return undefined;
  return value.replace(/\\n/g, '\n');
}

function parseYearMonth(dateText) {
  if (!dateText) return { year: null, month: null };
  const parts = String(dateText).split('-');
  if (parts.length < 2) return { year: null, month: null };
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return { year: null, month: null };
  return { year, month };
}

function getLocalClient() {
  const projectId = process.env.GCP_PROJECT_ID;
  const clientEmail = process.env.GCP_CLIENT_EMAIL;
  const privateKey = parsePrivateKey(process.env.GCP_PRIVATE_KEY);
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing GCP_* credentials.');
  }
  return new BigQuery({
    projectId,
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
  });
}

function getGobClient() {
  const projectId = process.env.GOB360_PROJECT_ID || process.env.GCP_PROJECT_ID || 'chiesi-committee';
  const clientEmail = process.env.GOB360_CLIENT_EMAIL;
  const privateKey = parsePrivateKey(process.env.GOB360_PRIVATE_KEY);
  if (!clientEmail || !privateKey) {
    throw new Error('Missing GOB360_* credentials.');
  }
  return new BigQuery({
    projectId,
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
  });
}

function getGobRefs() {
  const projectId = process.env.GOB360_PROJECT_ID || process.env.GCP_PROJECT_ID || 'chiesi-committee';
  const datasetId = process.env.GOB360_DATASET_ID || 'CHIESI_EXTERNAL';
  const pcTable = process.env.GOB360_PC_TABLE || 'CHIESI_PC_VENTAS_EXTERNAL';
  const scTable = process.env.GOB360_SC_TABLE || 'CHIESI_SC_VENTAS_EXTERNAL';
  return {
    pcTableId: `${projectId}.${datasetId}.${pcTable}`,
    scTableId: `${projectId}.${datasetId}.${scTable}`,
  };
}

async function run() {
  const root = process.cwd();
  loadEnvFile(path.join(root, '.env.local'));

  const gobClient = getGobClient();
  const localClient = getLocalClient();
  const { pcTableId, scTableId } = getGobRefs();

  const step1StatsQuery = `
    WITH source_raw AS (
      SELECT DB, CLUE, CLAVE, FECHA, PIEZAS FROM \`${pcTableId}\`
      UNION ALL
      SELECT DB, CLUE, CLAVE, FECHA, PIEZAS FROM \`${scTableId}\`
    ),
    base AS (
      SELECT
        CAST(CLUE AS STRING) AS clue,
        CAST(CLAVE AS STRING) AS source_clave,
        LOWER(REGEXP_REPLACE(TRIM(CAST(CLAVE AS STRING)), r'[^a-zA-Z0-9]+', '')) AS source_clave_normalized,
        COALESCE(
          SAFE_CAST(FECHA AS DATE),
          SAFE_CAST(JSON_VALUE(TO_JSON_STRING(FECHA), '$.value') AS DATE)
        ) AS event_date,
        SAFE_CAST(PIEZAS AS NUMERIC) AS units
      FROM source_raw
      WHERE UPPER(TRIM(CAST(DB AS STRING))) = 'DESPLAZAMIENTOS'
        AND CLAVE IS NOT NULL
        AND TRIM(CAST(CLAVE AS STRING)) != ''
    )
    SELECT
      COUNT(1) AS rows_total,
      COUNTIF(event_date IS NOT NULL) AS rows_with_event_date,
      COUNT(DISTINCT source_clave_normalized) AS distinct_claves,
      CAST(MIN(event_date) AS STRING) AS min_event_date,
      CAST(MAX(event_date) AS STRING) AS max_event_date,
      COALESCE(SUM(units), 0) AS units_total
    FROM base
  `;
  const step1MonthsQuery = `
    WITH source_raw AS (
      SELECT DB, CLAVE, FECHA, PIEZAS FROM \`${pcTableId}\`
      UNION ALL
      SELECT DB, CLAVE, FECHA, PIEZAS FROM \`${scTableId}\`
    ),
    base AS (
      SELECT
        COALESCE(
          SAFE_CAST(FECHA AS DATE),
          SAFE_CAST(JSON_VALUE(TO_JSON_STRING(FECHA), '$.value') AS DATE)
        ) AS event_date,
        SAFE_CAST(PIEZAS AS NUMERIC) AS units
      FROM source_raw
      WHERE UPPER(TRIM(CAST(DB AS STRING))) = 'DESPLAZAMIENTOS'
        AND CLAVE IS NOT NULL
        AND TRIM(CAST(CLAVE AS STRING)) != ''
    )
    SELECT
      CAST(DATE_TRUNC(event_date, MONTH) AS STRING) AS period_month,
      COUNT(1) AS rows_count,
      COALESCE(SUM(units), 0) AS units_total
    FROM base
    WHERE event_date IS NOT NULL
    GROUP BY 1
    ORDER BY period_month DESC
    LIMIT 24
  `;
  const step1SampleQuery = `
    WITH source_raw AS (
      SELECT DB, CLUE, CLAVE, FECHA, PIEZAS FROM \`${pcTableId}\`
      UNION ALL
      SELECT DB, CLUE, CLAVE, FECHA, PIEZAS FROM \`${scTableId}\`
    )
    SELECT
      CAST(CLUE AS STRING) AS clue,
      CAST(CLAVE AS STRING) AS source_clave,
      LOWER(REGEXP_REPLACE(TRIM(CAST(CLAVE AS STRING)), r'[^a-zA-Z0-9]+', '')) AS source_clave_normalized,
      CAST(COALESCE(
        SAFE_CAST(FECHA AS DATE),
        SAFE_CAST(JSON_VALUE(TO_JSON_STRING(FECHA), '$.value') AS DATE)
      ) AS STRING) AS event_date,
      SAFE_CAST(PIEZAS AS NUMERIC) AS units
    FROM source_raw
    WHERE UPPER(TRIM(CAST(DB AS STRING))) = 'DESPLAZAMIENTOS'
      AND CLAVE IS NOT NULL
      AND TRIM(CAST(CLAVE AS STRING)) != ''
    LIMIT 30
  `;

  const step2MappingQuery = `
    SELECT
      source_clave_normalized,
      NULLIF(TRIM(product_id), '') AS product_id,
      NULLIF(TRIM(market_group), '') AS market_group
    FROM (
      SELECT
        m.*,
        ROW_NUMBER() OVER (
          PARTITION BY m.source_clave_normalized
          ORDER BY m.updated_at DESC, m.created_at DESC
        ) AS rn
      FROM \`chiesi-committee.chiesi_committee_admin.gob360_product_mapping\` m
      WHERE m.is_active = TRUE
        AND m.source_clave_normalized IS NOT NULL
        AND TRIM(m.source_clave_normalized) != ''
    )
    WHERE rn = 1
  `;

  const step3ClavesAggQuery = `
    WITH source_raw AS (
      SELECT DB, CLAVE, FECHA, PIEZAS FROM \`${pcTableId}\`
      UNION ALL
      SELECT DB, CLAVE, FECHA, PIEZAS FROM \`${scTableId}\`
    ),
    base AS (
      SELECT
        LOWER(REGEXP_REPLACE(TRIM(CAST(CLAVE AS STRING)), r'[^a-zA-Z0-9]+', '')) AS source_clave_normalized,
        COALESCE(
          SAFE_CAST(FECHA AS DATE),
          SAFE_CAST(JSON_VALUE(TO_JSON_STRING(FECHA), '$.value') AS DATE)
        ) AS event_date,
        SAFE_CAST(PIEZAS AS NUMERIC) AS units
      FROM source_raw
      WHERE UPPER(TRIM(CAST(DB AS STRING))) = 'DESPLAZAMIENTOS'
        AND CLAVE IS NOT NULL
        AND TRIM(CAST(CLAVE AS STRING)) != ''
    )
    SELECT
      source_clave_normalized,
      COUNT(1) AS rows_count,
      COALESCE(SUM(units), 0) AS units_total,
      CAST(MIN(event_date) AS STRING) AS min_event_date,
      CAST(MAX(event_date) AS STRING) AS max_event_date
    FROM base
    WHERE event_date IS NOT NULL
    GROUP BY 1
  `;

  const [step1StatsRows] = await gobClient.query({ query: step1StatsQuery, location: 'US' });
  const [step1MonthsRows] = await gobClient.query({ query: step1MonthsQuery, location: 'US' });
  const [step1SampleRows] = await gobClient.query({ query: step1SampleQuery, location: 'US' });
  const [step2MappingRows] = await localClient.query({ query: step2MappingQuery });
  const [step3ClavesAggRows] = await gobClient.query({ query: step3ClavesAggQuery, location: 'US' });

  const mappingRows = step2MappingRows;
  const mappingByClave = new Map(
    mappingRows.map((row) => [
      String(row.source_clave_normalized ?? ''),
      {
        productId: row.product_id ? String(row.product_id) : null,
        marketGroup: row.market_group ? String(row.market_group) : null,
      },
    ]),
  );

  const step3Enriched = step3ClavesAggRows.map((row) => {
    const clave = String(row.source_clave_normalized ?? '');
    const mapping = mappingByClave.get(clave) ?? { productId: null, marketGroup: null };
    const isChiesi = Boolean(mapping.productId);
    return {
      source_clave_normalized: clave,
      rows_count: Number(row.rows_count ?? 0),
      units_total: Number(row.units_total ?? 0),
      min_event_date: row.min_event_date ? String(row.min_event_date) : null,
      max_event_date: row.max_event_date ? String(row.max_event_date) : null,
      product_id: mapping.productId,
      market_group: mapping.marketGroup,
      is_chiesi: isChiesi,
      is_competitor: !isChiesi,
    };
  });

  const step3Summary = {
    claves_total: step3Enriched.length,
    claves_with_mapping: step3Enriched.filter((row) => row.product_id || row.market_group).length,
    claves_with_product_id: step3Enriched.filter((row) => row.product_id).length,
    claves_competitor: step3Enriched.filter((row) => !row.product_id).length,
    units_chiesi: step3Enriched.filter((row) => row.is_chiesi).reduce((sum, row) => sum + row.units_total, 0),
    units_competitor: step3Enriched
      .filter((row) => row.is_competitor)
      .reduce((sum, row) => sum + row.units_total, 0),
  };

  const topStep3 = [...step3Enriched]
    .sort((a, b) => b.units_total - a.units_total)
    .slice(0, 150);

  const output = {
    generatedAt: new Date().toISOString(),
    step1_base_gob360: {
      stats: step1StatsRows[0] ?? {},
      periods_last_24: step1MonthsRows,
      sample_rows: step1SampleRows,
    },
    step2_enrichment_mapping: {
      mapping_total_rows: mappingRows.length,
      mapped_with_product_id: mappingRows.filter((row) => row.product_id).length,
      mapped_with_market_group: mappingRows.filter((row) => row.market_group).length,
      sample_rows: mappingRows.slice(0, 80),
    },
    step3_classification: {
      summary: step3Summary,
      top_units_rows: topStep3,
    },
  };

  const outputDir = path.join(root, 'tmp');
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, 'public-market-step1-step3.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
  console.log(`Saved: ${outputPath}`);

  const step4MonthlyBaseQuery = `
    WITH source_raw AS (
      SELECT DB, CLAVE, FECHA, PIEZAS FROM \`${pcTableId}\`
      UNION ALL
      SELECT DB, CLAVE, FECHA, PIEZAS FROM \`${scTableId}\`
    ),
    base AS (
      SELECT
        LOWER(REGEXP_REPLACE(TRIM(CAST(CLAVE AS STRING)), r'[^a-zA-Z0-9]+', '')) AS source_clave_normalized,
        DATE_TRUNC(
          COALESCE(
            SAFE_CAST(FECHA AS DATE),
            SAFE_CAST(JSON_VALUE(TO_JSON_STRING(FECHA), '$.value') AS DATE)
          ),
          MONTH
        ) AS period_month,
        SAFE_CAST(PIEZAS AS NUMERIC) AS units
      FROM source_raw
      WHERE UPPER(TRIM(CAST(DB AS STRING))) = 'DESPLAZAMIENTOS'
        AND CLAVE IS NOT NULL
        AND TRIM(CAST(CLAVE AS STRING)) != ''
    )
    SELECT
      source_clave_normalized,
      CAST(period_month AS STRING) AS period_month,
      COALESCE(SUM(units), 0) AS units_total
    FROM base
    WHERE period_month IS NOT NULL
    GROUP BY 1, 2
  `;
  const [step4MonthlyBaseRows] = await gobClient.query({ query: step4MonthlyBaseQuery, location: 'US' });

  const maxDateText = String(step1StatsRows?.[0]?.max_event_date ?? '');
  const maxRef = parseYearMonth(maxDateText);
  if (maxRef.year === null || maxRef.month === null) {
    throw new Error('Cannot resolve max_event_date for step 4.');
  }
  const maxYear = maxRef.year;
  const maxMonth = maxRef.month;
  const pyYear = maxYear - 1;

  const step4FlaggedMonthly = step4MonthlyBaseRows.map((rawRow) => {
    const clave = String(rawRow.source_clave_normalized ?? '');
    const mapping = mappingByClave.get(clave) ?? { productId: null, marketGroup: null };
    const isChiesi = Boolean(mapping.productId);
    const periodMonth = String(rawRow.period_month ?? '');
    const eventRef = parseYearMonth(periodMonth);
    const eventYear = eventRef.year;
    const eventMonth = eventRef.month;
    const isYtd = eventYear === maxYear && eventMonth !== null && eventMonth <= maxMonth;
    const isYtdPy = eventYear === pyYear && eventMonth !== null && eventMonth <= maxMonth;
    const isMth = eventYear === maxYear && eventMonth === maxMonth;
    const isMthPy = eventYear === pyYear && eventMonth === maxMonth;
    return {
      source_clave_normalized: clave,
      period_month: periodMonth || null,
      units_total: Number(rawRow.units_total ?? 0),
      product_id: mapping.productId,
      market_group: mapping.marketGroup,
      is_chiesi: isChiesi,
      is_competitor: !isChiesi,
      max_source_date: maxDateText,
      is_ytd: isYtd,
      is_ytd_py: isYtdPy,
      is_mth: isMth,
      is_mth_py: isMthPy,
    };
  });

  const step4Summary = {
    max_source_date: maxDateText,
    ytd_units: step4FlaggedMonthly
      .filter((row) => row.is_ytd)
      .reduce((sum, row) => sum + row.units_total, 0),
    ytd_units_py: step4FlaggedMonthly
      .filter((row) => row.is_ytd_py)
      .reduce((sum, row) => sum + row.units_total, 0),
    mth_units: step4FlaggedMonthly
      .filter((row) => row.is_mth)
      .reduce((sum, row) => sum + row.units_total, 0),
    mth_units_py: step4FlaggedMonthly
      .filter((row) => row.is_mth_py)
      .reduce((sum, row) => sum + row.units_total, 0),
    ytd_units_chiesi: step4FlaggedMonthly
      .filter((row) => row.is_ytd && row.is_chiesi)
      .reduce((sum, row) => sum + row.units_total, 0),
    ytd_units_competitor: step4FlaggedMonthly
      .filter((row) => row.is_ytd && row.is_competitor)
      .reduce((sum, row) => sum + row.units_total, 0),
    mth_units_chiesi: step4FlaggedMonthly
      .filter((row) => row.is_mth && row.is_chiesi)
      .reduce((sum, row) => sum + row.units_total, 0),
    mth_units_competitor: step4FlaggedMonthly
      .filter((row) => row.is_mth && row.is_competitor)
      .reduce((sum, row) => sum + row.units_total, 0),
  };

  const step4Output = {
    generatedAt: new Date().toISOString(),
    step4_flags: {
      summary: step4Summary,
      sample_rows: step4FlaggedMonthly
        .sort((a, b) => b.units_total - a.units_total)
        .slice(0, 150),
    },
  };

  const step4Path = path.join(outputDir, 'public-market-step4-flags.json');
  fs.writeFileSync(step4Path, JSON.stringify(step4Output, null, 2), 'utf8');
  console.log(`Saved: ${step4Path}`);

  const marketAggMap = new Map();
  for (const row of step4FlaggedMonthly) {
    const key = row.market_group ?? 'No Market';
    const current = marketAggMap.get(key) ?? {
      market_group: row.market_group ?? 'No Market',
      chiesi_units_ytd: 0,
      chiesi_units_ytd_py: 0,
      chiesi_units_mth: 0,
      chiesi_units_mth_py: 0,
      market_units_ytd: 0,
      market_units_ytd_py: 0,
      market_units_mth: 0,
      market_units_mth_py: 0,
    };

    if (row.is_ytd) current.market_units_ytd += row.units_total;
    if (row.is_ytd_py) current.market_units_ytd_py += row.units_total;
    if (row.is_mth) current.market_units_mth += row.units_total;
    if (row.is_mth_py) current.market_units_mth_py += row.units_total;

    if (row.is_chiesi) {
      if (row.is_ytd) current.chiesi_units_ytd += row.units_total;
      if (row.is_ytd_py) current.chiesi_units_ytd_py += row.units_total;
      if (row.is_mth) current.chiesi_units_mth += row.units_total;
      if (row.is_mth_py) current.chiesi_units_mth_py += row.units_total;
    }

    marketAggMap.set(key, current);
  }

  const toPct = (current, previous) => (previous === 0 ? null : ((current - previous) / previous) * 100);
  const toShare = (part, total) => (total === 0 ? null : (part / total) * 100);
  const toEi = (shareCurrent, sharePrevious) =>
    shareCurrent === null || sharePrevious === null || sharePrevious === 0
      ? null
      : (shareCurrent / sharePrevious) * 100;

  const step5Rows = [...marketAggMap.values()]
    .map((row) => {
      const ms_ytd = toShare(row.chiesi_units_ytd, row.market_units_ytd);
      const ms_ytd_py = toShare(row.chiesi_units_ytd_py, row.market_units_ytd_py);
      const ms_mth = toShare(row.chiesi_units_mth, row.market_units_mth);
      const ms_mth_py = toShare(row.chiesi_units_mth_py, row.market_units_mth_py);
      return {
        ...row,
        growth_vs_py_ytd_pct: toPct(row.chiesi_units_ytd, row.chiesi_units_ytd_py),
        growth_vs_py_mth_pct: toPct(row.chiesi_units_mth, row.chiesi_units_mth_py),
        ms_ytd_pct: ms_ytd,
        ms_ytd_pct_py: ms_ytd_py,
        ms_mth_pct: ms_mth,
        ms_mth_pct_py: ms_mth_py,
        ei_ytd: toEi(ms_ytd, ms_ytd_py),
        ei_mth: toEi(ms_mth, ms_mth_py),
      };
    })
    .sort((a, b) => b.chiesi_units_ytd - a.chiesi_units_ytd);

  const step5Totals = step5Rows.reduce(
    (acc, row) => {
      acc.chiesi_units_ytd += row.chiesi_units_ytd;
      acc.chiesi_units_ytd_py += row.chiesi_units_ytd_py;
      acc.chiesi_units_mth += row.chiesi_units_mth;
      acc.chiesi_units_mth_py += row.chiesi_units_mth_py;
      acc.market_units_ytd += row.market_units_ytd;
      acc.market_units_ytd_py += row.market_units_ytd_py;
      acc.market_units_mth += row.market_units_mth;
      acc.market_units_mth_py += row.market_units_mth_py;
      return acc;
    },
    {
      chiesi_units_ytd: 0,
      chiesi_units_ytd_py: 0,
      chiesi_units_mth: 0,
      chiesi_units_mth_py: 0,
      market_units_ytd: 0,
      market_units_ytd_py: 0,
      market_units_mth: 0,
      market_units_mth_py: 0,
    },
  );
  const totalsMsYtd = toShare(step5Totals.chiesi_units_ytd, step5Totals.market_units_ytd);
  const totalsMsYtdPy = toShare(step5Totals.chiesi_units_ytd_py, step5Totals.market_units_ytd_py);
  const totalsMsMth = toShare(step5Totals.chiesi_units_mth, step5Totals.market_units_mth);
  const totalsMsMthPy = toShare(step5Totals.chiesi_units_mth_py, step5Totals.market_units_mth_py);

  const step5Output = {
    generatedAt: new Date().toISOString(),
    max_source_date: maxDateText,
    rows: step5Rows,
    totals: {
      ...step5Totals,
      growth_vs_py_ytd_pct: toPct(step5Totals.chiesi_units_ytd, step5Totals.chiesi_units_ytd_py),
      growth_vs_py_mth_pct: toPct(step5Totals.chiesi_units_mth, step5Totals.chiesi_units_mth_py),
      ms_ytd_pct: totalsMsYtd,
      ms_ytd_pct_py: totalsMsYtdPy,
      ms_mth_pct: totalsMsMth,
      ms_mth_pct_py: totalsMsMthPy,
      ei_ytd: toEi(totalsMsYtd, totalsMsYtdPy),
      ei_mth: toEi(totalsMsMth, totalsMsMthPy),
    },
  };

  const step5Path = path.join(outputDir, 'public-market-step5-market-group-agg.json');
  fs.writeFileSync(step5Path, JSON.stringify(step5Output, null, 2), 'utf8');
  console.log(`Saved: ${step5Path}`);

  const step6BudgetBaseQuery = `
    SELECT
      COALESCE(NULLIF(TRIM(market_group), ''), 'No Market') AS market_group,
      CAST(period_month AS STRING) AS source_date,
      SAFE_CAST(amount_value AS NUMERIC) AS units
    FROM \`chiesi-committee.chiesi_committee_stg.vw_business_excellence_budget_sell_out_enriched\`
    WHERE mapped_product_id IS NOT NULL
      AND TRIM(mapped_product_id) != ''
      AND LOWER(TRIM(sales_group)) = 'units'
      AND LOWER(TRIM(channel)) = 'gobierno'
      AND period_month IS NOT NULL
  `;
  const [step6BudgetBaseRows] = await localClient.query({ query: step6BudgetBaseQuery });

  const budgetAggByMarket = new Map();
  for (const rawRow of step6BudgetBaseRows) {
    const marketGroup = String(rawRow.market_group ?? 'No Market');
    const sourceDate = String(rawRow.source_date ?? '');
    const units = Number(rawRow.units ?? 0);
    const ref = parseYearMonth(sourceDate);
    const year = ref.year;
    const month = ref.month;
    const isYtd = year === maxYear && month !== null && month <= maxMonth;
    const isYtdPy = year === pyYear && month !== null && month <= maxMonth;
    const isMth = year === maxYear && month === maxMonth;
    const isMthPy = year === pyYear && month === maxMonth;

    const current = budgetAggByMarket.get(marketGroup) ?? {
      market_group: marketGroup,
      budget_units_ytd: 0,
      budget_units_ytd_py: 0,
      budget_units_mth: 0,
      budget_units_mth_py: 0,
    };
    if (isYtd) current.budget_units_ytd += units;
    if (isYtdPy) current.budget_units_ytd_py += units;
    if (isMth) current.budget_units_mth += units;
    if (isMthPy) current.budget_units_mth_py += units;
    budgetAggByMarket.set(marketGroup, current);
  }

  const mergedStep6Rows = step5Rows
    .map((row) => {
      const budget = budgetAggByMarket.get(row.market_group) ?? {
        budget_units_ytd: 0,
        budget_units_ytd_py: 0,
        budget_units_mth: 0,
        budget_units_mth_py: 0,
      };
      const coverageYtd = budget.budget_units_ytd === 0 ? null : (row.chiesi_units_ytd / budget.budget_units_ytd) * 100;
      const coverageMth = budget.budget_units_mth === 0 ? null : (row.chiesi_units_mth / budget.budget_units_mth) * 100;
      return {
        ...row,
        ...budget,
        variance_vs_budget_ytd_units: row.chiesi_units_ytd - budget.budget_units_ytd,
        variance_vs_budget_ytd_units_pct:
          budget.budget_units_ytd === 0 ? null : ((row.chiesi_units_ytd - budget.budget_units_ytd) / budget.budget_units_ytd) * 100,
        variance_vs_budget_mth_units: row.chiesi_units_mth - budget.budget_units_mth,
        variance_vs_budget_mth_units_pct:
          budget.budget_units_mth === 0 ? null : ((row.chiesi_units_mth - budget.budget_units_mth) / budget.budget_units_mth) * 100,
        coverage_vs_budget_ytd_pct: coverageYtd,
        coverage_vs_budget_mth_pct: coverageMth,
      };
    })
    .sort((a, b) => b.chiesi_units_ytd - a.chiesi_units_ytd);

  const step6BudgetSummary = [...budgetAggByMarket.values()].reduce(
    (acc, row) => {
      acc.budget_units_ytd += row.budget_units_ytd;
      acc.budget_units_ytd_py += row.budget_units_ytd_py;
      acc.budget_units_mth += row.budget_units_mth;
      acc.budget_units_mth_py += row.budget_units_mth_py;
      return acc;
    },
    {
      budget_units_ytd: 0,
      budget_units_ytd_py: 0,
      budget_units_mth: 0,
      budget_units_mth_py: 0,
    },
  );

  const step6Output = {
    generatedAt: new Date().toISOString(),
    max_source_date: maxDateText,
    budget_reference: {
      filtered_rows: step6BudgetBaseRows.length,
      market_groups: budgetAggByMarket.size,
      ...step6BudgetSummary,
    },
    rows: mergedStep6Rows,
    totals: {
      ...step5Output.totals,
      ...step6BudgetSummary,
      coverage_vs_budget_ytd_pct:
        step6BudgetSummary.budget_units_ytd === 0
          ? null
          : (step5Output.totals.chiesi_units_ytd / step6BudgetSummary.budget_units_ytd) * 100,
      coverage_vs_budget_mth_pct:
        step6BudgetSummary.budget_units_mth === 0
          ? null
          : (step5Output.totals.chiesi_units_mth / step6BudgetSummary.budget_units_mth) * 100,
      variance_vs_budget_ytd_units: step5Output.totals.chiesi_units_ytd - step6BudgetSummary.budget_units_ytd,
      variance_vs_budget_mth_units: step5Output.totals.chiesi_units_mth - step6BudgetSummary.budget_units_mth,
      variance_vs_budget_ytd_units_pct:
        step6BudgetSummary.budget_units_ytd === 0
          ? null
          : ((step5Output.totals.chiesi_units_ytd - step6BudgetSummary.budget_units_ytd) / step6BudgetSummary.budget_units_ytd) * 100,
      variance_vs_budget_mth_units_pct:
        step6BudgetSummary.budget_units_mth === 0
          ? null
          : ((step5Output.totals.chiesi_units_mth - step6BudgetSummary.budget_units_mth) / step6BudgetSummary.budget_units_mth) * 100,
    },
  };

  const step6Path = path.join(outputDir, 'public-market-step6-with-budget.json');
  fs.writeFileSync(step6Path, JSON.stringify(step6Output, null, 2), 'utf8');
  console.log(`Saved: ${step6Path}`);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
