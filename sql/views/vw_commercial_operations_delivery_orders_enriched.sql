CREATE OR REPLACE VIEW `chiesi-committee.chiesi_committee_stg.vw_commercial_operations_delivery_orders_enriched` AS
WITH active_sell_out_mapping AS (
  SELECT
    source_product_name,
    source_product_name_normalized,
    product_id,
    market_group
  FROM (
    SELECT
      m.*,
      ROW_NUMBER() OVER (
        PARTITION BY m.source_product_name_normalized
        ORDER BY m.updated_at DESC, m.created_at DESC
      ) AS rn
    FROM `chiesi-committee.chiesi_committee_admin.sell_out_product_mapping` m
    WHERE m.is_active = TRUE
  )
  WHERE rn = 1
),
product_metadata_dedup AS (
  SELECT
    product_id,
    brand_name,
    subbrand_or_device,
    product_group,
    business_unit_code,
    business_unit_name,
    portfolio_name,
    lifecycle_status,
    display_order,
    notes
  FROM (
    SELECT
      pm.*,
      ROW_NUMBER() OVER (
        PARTITION BY pm.product_id
        ORDER BY pm.updated_at DESC, pm.created_at DESC
      ) AS rn
    FROM `chiesi-committee.chiesi_committee_admin.product_metadata` pm
  )
  WHERE rn = 1
),
base AS (
  SELECT
    s.upload_id,
    s.row_number,
    u.reporting_version_id,
    rv.period_month AS report_period_month,
    u.source_as_of_month,
    u.uploaded_at AS source_uploaded_at,
    LOWER(TRIM(COALESCE(s.order_scope, ''))) AS order_scope,
    CASE
      WHEN LOWER(TRIM(COALESCE(s.order_scope, ''))) = 'private' THEN 'Privado'
      WHEN LOWER(TRIM(COALESCE(s.order_scope, ''))) = 'government' THEN 'Gobierno'
      ELSE 'Unknown'
    END AS channel_scope,
    s.business_type,
    s.market,
    s.business_unit,
    s.unidad_negocio_chiesi,
    COALESCE(NULLIF(s.client_institution, ''), NULLIF(s.recipient, '')) AS client_requester,
    s.client_institution,
    s.order_type,
    s.document_number,
    s.contract_number,
    s.customer_order_number,
    s.sales_document,
    s.sales_document_position,
    s.sku,
    s.ccb,
    s.laboratory,
    s.status,
    s.order_status,
    s.rejection_reason,
    s.delivery_id,
    s.delivery_point,
    s.recipient,
    s.clues,
    s.fecha_pedido_sap_month,
    s.fecha_pedido_month,
    s.fecha_creacion_delivery_month,
    s.fecha_salida_mercancia_month,
    s.fecha_maxima_entrega_month,
    s.fecha_confirmacion_entrega_month,
    s.tiempo_entrega_dias_naturales,
    s.entrega_vs_vencimiento_dias_naturales,
    s.precio_unitario,
    s.importe,
    s.cantidad_total_pedido,
    s.confirmadas,
    s.cantidad_suministrada,
    s.cantidad_entregada,
    s.cantidad_facturada,
    s.sancion,
    s.monto_sancion,
    s.facturado_chiesi,
    s.cuenta_dias,
    s.precio_real,
    s.cantidad_facturada_chiesi,
    s.monto_facturado_chiesi,
    s.tipo_entrega,
    s.cpm,
    s.posibles_canjes,
    s.source_product_raw,
    s.source_product_normalized,
    CAST(NULL AS STRING) AS source_product_id,
    map.product_id AS mapped_product_id,
    map.product_id AS resolved_product_id,
    map.market_group,
    d.canonical_product_code,
    COALESCE(NULLIF(d.canonical_product_name, ''), s.source_product_raw) AS canonical_product_name,
    pm.brand_name,
    pm.subbrand_or_device,
    pm.product_group,
    pm.business_unit_code,
    pm.business_unit_name,
    pm.portfolio_name,
    pm.lifecycle_status,
    pm.display_order,
    pm.notes,
    s.period_month,
    s.order_value,
    s.source_payload_json,
    s.normalized_at
  FROM `chiesi-committee.chiesi_committee_stg.stg_commercial_operations_delivery_orders` s
  JOIN `chiesi-committee.chiesi_committee_raw.uploads` u
    ON u.upload_id = s.upload_id
  LEFT JOIN `chiesi-committee.chiesi_committee_admin.reporting_versions` rv
    ON rv.reporting_version_id = u.reporting_version_id
  LEFT JOIN active_sell_out_mapping map
    ON map.source_product_name_normalized = s.source_product_normalized
  LEFT JOIN `chiesi-committee.chiesi_committee_core.dim_product` d
    ON d.product_id = map.product_id
  LEFT JOIN product_metadata_dedup pm
    ON pm.product_id = map.product_id
  WHERE LOWER(TRIM(u.module_code)) IN (
    'commercial_operations_government_orders',
    'government_orders',
    'commercial_operations_private_orders',
    'private_orders'
  )
    AND LOWER(TRIM(u.status)) IN ('normalized', 'published')
),
max_ref AS (
  SELECT
    reporting_version_id,
    MAX(period_month) AS max_period_month,
    MAX(source_as_of_month) AS max_source_as_of_month,
    MAX(report_period_month) AS max_report_period_month,
    COALESCE(
      GREATEST(MAX(source_as_of_month), MAX(report_period_month)),
      MAX(source_as_of_month),
      MAX(report_period_month),
      MAX(period_month)
    ) AS reference_cutoff_month
  FROM base
  GROUP BY reporting_version_id
),
effective_ref AS (
  SELECT
    b.reporting_version_id,
    COALESCE(
      MAX(IF(b.period_month <= m.reference_cutoff_month, b.period_month, NULL)),
      MAX(b.period_month)
    ) AS max_effective_period_month
  FROM base b
  JOIN max_ref m
    ON m.reporting_version_id = b.reporting_version_id
  GROUP BY b.reporting_version_id
)
SELECT
  b.upload_id,
  b.row_number,
  b.reporting_version_id,
  b.report_period_month,
  b.source_as_of_month,
  b.source_uploaded_at,
  b.order_scope,
  b.channel_scope,
  b.business_type,
  b.market,
  b.business_unit,
  b.unidad_negocio_chiesi,
  COALESCE(NULLIF(b.business_unit_name, ''), NULLIF(b.unidad_negocio_chiesi, ''), NULLIF(b.business_unit, '')) AS business_unit_resolved,
  b.client_requester,
  b.client_institution,
  b.order_type,
  b.document_number,
  b.contract_number,
  b.customer_order_number,
  b.sales_document,
  b.sales_document_position,
  b.sku,
  b.ccb,
  b.laboratory,
  b.status,
  b.order_status,
  b.rejection_reason,
  b.delivery_id,
  b.delivery_point,
  b.recipient,
  b.clues,
  b.fecha_pedido_sap_month,
  b.fecha_pedido_month,
  b.fecha_creacion_delivery_month,
  b.fecha_salida_mercancia_month,
  b.fecha_maxima_entrega_month,
  b.fecha_confirmacion_entrega_month,
  b.tiempo_entrega_dias_naturales,
  b.entrega_vs_vencimiento_dias_naturales,
  b.precio_unitario,
  b.importe,
  b.cantidad_total_pedido,
  b.confirmadas,
  b.cantidad_suministrada,
  b.cantidad_entregada,
  b.cantidad_facturada,
  b.sancion,
  b.monto_sancion,
  b.facturado_chiesi,
  b.cuenta_dias,
  b.precio_real,
  b.cantidad_facturada_chiesi,
  b.monto_facturado_chiesi,
  b.tipo_entrega,
  b.cpm,
  b.posibles_canjes,
  b.source_product_raw,
  b.source_product_normalized,
  b.source_product_id,
  b.mapped_product_id,
  b.resolved_product_id,
  b.market_group,
  b.canonical_product_code,
  b.canonical_product_name,
  b.brand_name,
  b.subbrand_or_device,
  b.product_group,
  b.business_unit_code,
  b.business_unit_name,
  b.portfolio_name,
  b.lifecycle_status,
  b.display_order,
  b.notes,
  b.period_month,
  b.order_value,
  SAFE_DIVIDE(COALESCE(b.cantidad_entregada, 0), NULLIF(COALESCE(b.cantidad_total_pedido, 0), 0)) AS fill_rate_delivered,
  SAFE_DIVIDE(COALESCE(b.cantidad_facturada, 0), NULLIF(COALESCE(b.cantidad_total_pedido, 0), 0)) AS fill_rate_invoiced,
  COALESCE(b.cantidad_total_pedido, 0) - COALESCE(b.cantidad_entregada, 0) AS units_not_delivered,
  COALESCE(b.cantidad_entregada, 0) - COALESCE(b.cantidad_facturada, 0) AS units_delivered_not_invoiced,
  (COALESCE(b.cantidad_total_pedido, 0) - COALESCE(b.cantidad_entregada, 0)) * COALESCE(NULLIF(b.precio_real, 0), b.precio_unitario, 0) AS amount_not_delivered,
  COALESCE(
    b.tiempo_entrega_dias_naturales,
    DATE_DIFF(b.fecha_confirmacion_entrega_month, b.fecha_pedido_sap_month, DAY)
  ) AS lead_time_days,
  CASE
    WHEN b.entrega_vs_vencimiento_dias_naturales IS NULL THEN NULL
    WHEN b.entrega_vs_vencimiento_dias_naturales <= 0 THEN TRUE
    ELSE FALSE
  END AS delivered_on_time,
  e.max_effective_period_month AS latest_period_month,
  DATE_SUB(e.max_effective_period_month, INTERVAL 1 YEAR) AS latest_period_month_py,
  CASE
    WHEN EXTRACT(YEAR FROM b.period_month) = EXTRACT(YEAR FROM e.max_effective_period_month)
      AND EXTRACT(MONTH FROM b.period_month) <= EXTRACT(MONTH FROM e.max_effective_period_month)
    THEN TRUE ELSE FALSE
  END AS is_ytd,
  CASE
    WHEN EXTRACT(YEAR FROM b.period_month) = EXTRACT(YEAR FROM DATE_SUB(e.max_effective_period_month, INTERVAL 1 YEAR))
      AND EXTRACT(MONTH FROM b.period_month) <= EXTRACT(MONTH FROM e.max_effective_period_month)
    THEN TRUE ELSE FALSE
  END AS is_ytd_py,
  CASE
    WHEN b.period_month = e.max_effective_period_month
    THEN TRUE ELSE FALSE
  END AS is_mth,
  CASE
    WHEN b.period_month = DATE_SUB(e.max_effective_period_month, INTERVAL 1 YEAR)
    THEN TRUE ELSE FALSE
  END AS is_mth_py,
  CASE
    WHEN b.period_month BETWEEN DATE_SUB(e.max_effective_period_month, INTERVAL 11 MONTH) AND e.max_effective_period_month
    THEN TRUE ELSE FALSE
  END AS is_mat,
  CASE
    WHEN b.period_month BETWEEN DATE_SUB(e.max_effective_period_month, INTERVAL 23 MONTH) AND DATE_SUB(e.max_effective_period_month, INTERVAL 12 MONTH)
    THEN TRUE ELSE FALSE
  END AS is_mat_py,
  b.source_payload_json,
  b.normalized_at
FROM base b
JOIN max_ref m
  ON m.reporting_version_id = b.reporting_version_id
JOIN effective_ref e
  ON e.reporting_version_id = b.reporting_version_id;
