# Sales Internal Serving Layer

## Goal
Move heavy aggregations from Next.js runtime into BigQuery serving views.

## SQL artifact
Run:

- `sql/serving/001_sales_internal_serving_views.sql`

This creates:

- `chiesi_committee_serving.vw_sales_internal_summary`
- `chiesi_committee_serving.vw_sales_internal_product_month_active`
- `chiesi_committee_serving.vw_sales_internal_product_month_vs_budget`
- `chiesi_committee_serving.vw_sales_internal_month_enriched`
- `chiesi_committee_serving.vw_sales_internal_month_trend_ytd`
- `chiesi_committee_serving.vw_sales_internal_driver_ytd`
- `chiesi_committee_serving.vw_sales_internal_filter_options`

## App switch (no code changes needed after this)
`lib/data/sales-internal.ts` now reads dataset/project from env:

- `SALES_INTERNAL_VIEW_PROJECT` (default: `chiesi-committee`)
- `SALES_INTERNAL_DATASET` (default: `chiesi_committee_mart`)

To consume serving views in Next.js, add to `.env.local`:

```env
SALES_INTERNAL_VIEW_PROJECT=chiesi-committee
SALES_INTERNAL_DATASET=chiesi_committee_serving
```

Restart dev server after env changes.

## Automatic refresh on publish
When `publishUpload` runs for `sales_internal`, the app now rebuilds serving artifacts from `stg/core`:

- `sales_internal_month_enriched` (table)
- `sales_internal_trend_ytd` (table)
- `sales_internal_driver_ytd` (table)
- compatibility views:
  - `vw_sales_internal_summary`
  - `vw_sales_internal_product_month_active`
  - `vw_sales_internal_product_month_vs_budget`

Implementation:

- `lib/serving/refresh-sales-internal-serving.ts`
- invoked from `lib/uploads/publish-upload.ts`
