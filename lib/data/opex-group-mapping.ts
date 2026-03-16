import 'server-only';
import { randomUUID } from 'crypto';
import { getBigQueryClient } from '@/lib/bigquery/client';
import { OPEX_CECO_GROUP_SEED } from '@/lib/data/opex-ceco-group';

const OPEX_GROUP_TABLE = 'chiesi-committee.chiesi_committee_admin.opex_ceco_group_mapping';

export type OpexCecoGroupMappingRow = {
  mappingId: string;
  cecoName: string;
  cecoNameGroup: string;
  isActive: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
};

let ensureTablePromise: Promise<void> | null = null;

async function ensureOpexGroupTable() {
  if (!ensureTablePromise) {
    ensureTablePromise = (async () => {
      const client = getBigQueryClient();
      await client.query({
        query: `
          CREATE TABLE IF NOT EXISTS \`${OPEX_GROUP_TABLE}\` (
            mapping_id STRING,
            ceco_name STRING,
            ceco_name_group STRING,
            is_active BOOL,
            created_at TIMESTAMP,
            created_by STRING,
            updated_at TIMESTAMP,
            updated_by STRING
          )
        `,
      });
    })();
  }
  await ensureTablePromise;
}

export async function getOpexCecoGroupMappings(): Promise<OpexCecoGroupMappingRow[]> {
  await ensureOpexGroupTable();
  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: `
      WITH master_ceco AS (
        SELECT DISTINCT TRIM(ceco_name) AS ceco_name
        FROM \`chiesi-committee.chiesi_committee_stg.stg_opex_master_catalog\`
        WHERE ceco_name IS NOT NULL
          AND TRIM(ceco_name) != ''
      ),
      dedup AS (
        SELECT
          mapping_id,
          ceco_name,
          ceco_name_group,
          is_active,
          CAST(updated_at AS STRING) AS updated_at,
          updated_by,
          ROW_NUMBER() OVER (
            PARTITION BY LOWER(TRIM(ceco_name))
            ORDER BY updated_at DESC, created_at DESC
          ) AS rn
        FROM \`${OPEX_GROUP_TABLE}\`
      ),
      latest_mapping AS (
        SELECT
          mapping_id,
          ceco_name,
          ceco_name_group,
          is_active,
          updated_at,
          updated_by
        FROM dedup
        WHERE rn = 1
          AND is_active = TRUE
      ),
      master_plus_mapping AS (
        SELECT
          lm.mapping_id,
          m.ceco_name,
          lm.ceco_name_group,
          TRUE AS is_active,
          lm.updated_at,
          lm.updated_by
        FROM master_ceco m
        LEFT JOIN latest_mapping lm
          ON LOWER(TRIM(m.ceco_name)) = LOWER(TRIM(lm.ceco_name))
      ),
      mapping_only AS (
        SELECT
          lm.mapping_id,
          lm.ceco_name,
          lm.ceco_name_group,
          lm.is_active,
          lm.updated_at,
          lm.updated_by
        FROM latest_mapping lm
        WHERE NOT EXISTS (
          SELECT 1
          FROM master_ceco m
          WHERE LOWER(TRIM(m.ceco_name)) = LOWER(TRIM(lm.ceco_name))
        )
      )
      SELECT
        mapping_id,
        ceco_name,
        COALESCE(ceco_name_group, 'Ungrouped') AS ceco_name_group,
        is_active,
        updated_at,
        updated_by
      FROM (
        SELECT * FROM master_plus_mapping
        UNION ALL
        SELECT * FROM mapping_only
      )
      ORDER BY ceco_name
    `,
  });

  const mappedRows = (rows as Array<Record<string, unknown>>).map((row) => ({
    mappingId: String(row.mapping_id ?? ''),
    cecoName: String(row.ceco_name ?? ''),
    cecoNameGroup: String(row.ceco_name_group ?? ''),
    isActive: Boolean(row.is_active ?? true),
    updatedAt: row.updated_at == null ? null : String(row.updated_at),
    updatedBy: row.updated_by == null ? null : String(row.updated_by),
  }));

  if (mappedRows.length > 0) {
    return mappedRows;
  }

  // Fallback so admin UI never appears empty before first seed sync.
  return OPEX_CECO_GROUP_SEED.map((item, index) => ({
    mappingId: `seed-${index + 1}`,
    cecoName: item.cecoName,
    cecoNameGroup: item.cecoNameGroup,
    isActive: true,
    updatedAt: null,
    updatedBy: 'seed-default',
  }));
}

export async function upsertOpexCecoGroupMapping(input: {
  cecoName: string;
  cecoNameGroup: string;
  updatedBy?: string;
}) {
  await ensureOpexGroupTable();
  const cecoName = input.cecoName.trim();
  const cecoNameGroup = input.cecoNameGroup.trim();
  if (!cecoName) throw new Error('CeCo Name is required.');
  if (!cecoNameGroup) throw new Error('CeCo Name Group is required.');

  const updatedBy = (input.updatedBy ?? 'system').trim() || 'system';
  const client = getBigQueryClient();
  await client.query({
    query: `
      MERGE \`${OPEX_GROUP_TABLE}\` AS target
      USING (
        SELECT
          @cecoName AS ceco_name,
          @cecoNameGroup AS ceco_name_group
      ) AS source
      ON LOWER(TRIM(target.ceco_name)) = LOWER(TRIM(source.ceco_name))
      WHEN MATCHED THEN
        UPDATE SET
          ceco_name_group = source.ceco_name_group,
          is_active = TRUE,
          updated_at = CURRENT_TIMESTAMP(),
          updated_by = @updatedBy
      WHEN NOT MATCHED THEN
        INSERT (
          mapping_id,
          ceco_name,
          ceco_name_group,
          is_active,
          created_at,
          created_by,
          updated_at,
          updated_by
        )
        VALUES (
          @mappingId,
          source.ceco_name,
          source.ceco_name_group,
          TRUE,
          CURRENT_TIMESTAMP(),
          @updatedBy,
          CURRENT_TIMESTAMP(),
          @updatedBy
        )
    `,
    params: {
      mappingId: randomUUID(),
      cecoName,
      cecoNameGroup,
      updatedBy,
    },
  });

  return { ok: true as const };
}

export async function disableOpexCecoGroupMapping(input: { cecoName: string; updatedBy?: string }) {
  await ensureOpexGroupTable();
  const cecoName = input.cecoName.trim();
  if (!cecoName) throw new Error('CeCo Name is required.');
  const updatedBy = (input.updatedBy ?? 'system').trim() || 'system';
  const client = getBigQueryClient();
  await client.query({
    query: `
      UPDATE \`${OPEX_GROUP_TABLE}\`
      SET
        is_active = FALSE,
        updated_at = CURRENT_TIMESTAMP(),
        updated_by = @updatedBy
      WHERE LOWER(TRIM(ceco_name)) = LOWER(TRIM(@cecoName))
        AND is_active = TRUE
    `,
    params: { cecoName, updatedBy },
  });
  return { ok: true as const };
}

export async function seedDefaultOpexCecoGroupMappings() {
  await ensureOpexGroupTable();
  for (const item of OPEX_CECO_GROUP_SEED) {
    await upsertOpexCecoGroupMapping({
      cecoName: item.cecoName,
      cecoNameGroup: item.cecoNameGroup,
      updatedBy: 'seed',
    });
  }
  return { ok: true as const, seeded: OPEX_CECO_GROUP_SEED.length };
}
