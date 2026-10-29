-- Run in EU after the existing dim_module schema migrations.
-- Optional snapshots do not enter Prepare's monthly completion denominator.
ALTER TABLE `chiesi-committee.chiesi_committee_core.dim_module`
ADD COLUMN IF NOT EXISTS is_optional BOOL;

MERGE `chiesi-committee.chiesi_committee_core.dim_module` AS target
USING (
  SELECT 'business_excellence_gob360_air' AS module_code,
    'Business Excellence - GOB360 Air' AS module_name, 205 AS display_order
  UNION ALL
  SELECT 'business_excellence_gob360_care',
    'Business Excellence - GOB360 Care', 206
) AS source
ON target.module_code = source.module_code
WHEN MATCHED THEN UPDATE SET
  module_name = source.module_name,
  area_code = 'business_excellence',
  module_type = 'gob360_snapshot',
  is_optional = TRUE,
  is_active = TRUE,
  display_order = source.display_order,
  updated_at = CURRENT_TIMESTAMP(),
  updated_by = 'migration_011_gob360_snapshots'
WHEN NOT MATCHED THEN INSERT (
  module_code, module_name, area_code, module_type, is_optional,
  is_active, display_order, created_at, created_by, updated_at, updated_by
)
VALUES (
  source.module_code, source.module_name, 'business_excellence',
  'gob360_snapshot', TRUE, TRUE, source.display_order,
  CURRENT_TIMESTAMP(), 'migration_011_gob360_snapshots',
  CURRENT_TIMESTAMP(), 'migration_011_gob360_snapshots'
);
