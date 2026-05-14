-- Module catalog administration fields.
-- Run before using /admin/modules.

ALTER TABLE `chiesi-committee.chiesi_committee_core.dim_module`
ADD COLUMN IF NOT EXISTS area_code STRING;

ALTER TABLE `chiesi-committee.chiesi_committee_core.dim_module`
ADD COLUMN IF NOT EXISTS module_type STRING;

ALTER TABLE `chiesi-committee.chiesi_committee_core.dim_module`
ADD COLUMN IF NOT EXISTS owner_name STRING;

ALTER TABLE `chiesi-committee.chiesi_committee_core.dim_module`
ADD COLUMN IF NOT EXISTS email_owner STRING;

ALTER TABLE `chiesi-committee.chiesi_committee_core.dim_module`
ADD COLUMN IF NOT EXISTS display_order INT64;

ALTER TABLE `chiesi-committee.chiesi_committee_core.dim_module`
ADD COLUMN IF NOT EXISTS notes STRING;

ALTER TABLE `chiesi-committee.chiesi_committee_core.dim_module`
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP;

ALTER TABLE `chiesi-committee.chiesi_committee_core.dim_module`
ADD COLUMN IF NOT EXISTS created_by STRING;

ALTER TABLE `chiesi-committee.chiesi_committee_core.dim_module`
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

ALTER TABLE `chiesi-committee.chiesi_committee_core.dim_module`
ADD COLUMN IF NOT EXISTS updated_by STRING;

MERGE `chiesi-committee.chiesi_committee_core.dim_module` AS target
USING (
  SELECT 'sales_internal' AS module_code, 'Sales Internal' AS module_name, 'sales_internal' AS area_code, 10 AS display_order UNION ALL
  SELECT 'business_excellence_ddd', 'Business Excellence - DDD', 'business_excellence', 110 UNION ALL
  SELECT 'business_excellence_budget_sell_out', 'Business Excellence - Budget Sell Out', 'business_excellence', 120 UNION ALL
  SELECT 'business_excellence_brick_assignment', 'Business Excellence - Brick Assignment', 'business_excellence', 130 UNION ALL
  SELECT 'business_excellence_iqvia_weekly', 'Business Excellence - Weekly Tracking', 'business_excellence', 140 UNION ALL
  SELECT 'business_excellence_closeup', 'Business Excellence - Closeup', 'business_excellence', 150 UNION ALL
  SELECT 'business_excellence_cuotas', 'Business Excellence - Cuotas', 'business_excellence', 160 UNION ALL
  SELECT 'business_excellence_salesforce_fichero_medico', 'Business Excellence - Efectividad Fuerza de Ventas - Fichero Medico', 'business_excellence', 170 UNION ALL
  SELECT 'business_excellence_salesforce_tft', 'Business Excellence - Efectividad Fuerza de Ventas - TFT', 'business_excellence', 180 UNION ALL
  SELECT 'business_excellence_salesforce_interacciones', 'Business Excellence - Efectividad Fuerza de Ventas - Interacciones', 'business_excellence', 190 UNION ALL
  SELECT 'human_resources_turnover', 'Human Resources - Turnover', 'human_resources', 210 UNION ALL
  SELECT 'human_resources_training', 'Human Resources - Training', 'human_resources', 220 UNION ALL
  SELECT 'human_resources_open_vacancy', 'Human Resources - Open Vacancy', 'human_resources', 230 UNION ALL
  SELECT 'commercial_operations_dso', 'Commercial Operations - DSO', 'commercial_operations', 310 UNION ALL
  SELECT 'commercial_operations_government_orders', 'Commercial Operations - Government Orders', 'commercial_operations', 320 UNION ALL
  SELECT 'commercial_operations_private_orders', 'Commercial Operations - Private Orders', 'commercial_operations', 330 UNION ALL
  SELECT 'commercial_operations_government_contract_progress', 'Commercial Operations - Government Contract Progress', 'commercial_operations', 340 UNION ALL
  SELECT 'commercial_operations_stocks', 'Commercial Operations - Stocks', 'commercial_operations', 350 UNION ALL
  SELECT 'commercial_operations_sanctions', 'Commercial Operations - Sanctions', 'commercial_operations', 360 UNION ALL
  SELECT 'opex_by_cc', 'OPEX by CC', 'opex', 410
) AS source
ON target.module_code = source.module_code
WHEN MATCHED THEN UPDATE SET
  module_name = source.module_name,
  area_code = source.area_code,
  display_order = source.display_order,
  is_active = TRUE,
  updated_at = CURRENT_TIMESTAMP(),
  updated_by = 'migration_005_dim_module_admin'
WHEN NOT MATCHED THEN INSERT (
  module_code,
  module_name,
  area_code,
  display_order,
  is_active,
  created_at,
  created_by,
  updated_at,
  updated_by
)
VALUES (
  source.module_code,
  source.module_name,
  source.area_code,
  source.display_order,
  TRUE,
  CURRENT_TIMESTAMP(),
  'migration_005_dim_module_admin',
  CURRENT_TIMESTAMP(),
  'migration_005_dim_module_admin'
);

UPDATE `chiesi-committee.chiesi_committee_core.dim_module`
SET is_active = FALSE,
    updated_at = CURRENT_TIMESTAMP(),
    updated_by = 'migration_005_dim_module_admin'
WHERE module_code = 'opex_master_catalog';
