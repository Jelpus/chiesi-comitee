import 'server-only';
import { getBigQueryClient } from '@/lib/bigquery/client';

const FORM_RESPONSIBLES_TABLE = 'chiesi-committee.chiesi_committee_admin.form_responsibles';
let ensureFormResponsiblesTablePromise: Promise<void> | null = null;

export const formDefinitions = [
  {
    formCode: 'regulatory_affairs',
    formLabel: 'Regulatory Affairs',
    formPath: '/forms/regulatory-affairs',
  },
  {
    formCode: 'legal_compliance',
    formLabel: 'Legal & Compliance',
    formPath: '/forms/legal-compliance',
  },
  {
    formCode: 'medical',
    formLabel: 'Medical',
    formPath: '/forms/medical',
  },
] as const;

export type FormCode = (typeof formDefinitions)[number]['formCode'];

export type FormResponsibleRow = {
  formCode: string;
  formLabel: string;
  formPath: string;
  ownerName: string | null;
  emailOwner: string;
  isActive: boolean;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type UpsertFormResponsibleInput = {
  formCode: string;
  ownerName?: string;
  emailOwner?: string;
  isActive?: boolean;
  notes?: string;
  updatedBy?: string;
};

function normalizeFormCode(value: string) {
  return value.trim().toLowerCase().replace(/-/g, '_');
}

function normalizeEmail(value: string | undefined) {
  return (value ?? '').trim().toLowerCase();
}

function getDefinition(formCode: string) {
  const normalized = normalizeFormCode(formCode);
  return formDefinitions.find((item) => item.formCode === normalized);
}

async function ensureFormResponsiblesTable() {
  if (ensureFormResponsiblesTablePromise) return ensureFormResponsiblesTablePromise;

  const client = getBigQueryClient();
  ensureFormResponsiblesTablePromise = client.query({
    query: `
      CREATE TABLE IF NOT EXISTS \`${FORM_RESPONSIBLES_TABLE}\` (
        form_code STRING NOT NULL,
        form_label STRING NOT NULL,
        form_path STRING NOT NULL,
        owner_name STRING,
        email_owner STRING NOT NULL,
        is_active BOOL NOT NULL,
        notes STRING,
        created_at TIMESTAMP,
        created_by STRING,
        updated_at TIMESTAMP,
        updated_by STRING
      )
    `,
  }).then(() => undefined);

  return ensureFormResponsiblesTablePromise;
}

function rowToFormResponsible(row: Record<string, unknown>): FormResponsibleRow {
  return {
    formCode: String(row.form_code ?? ''),
    formLabel: String(row.form_label ?? ''),
    formPath: String(row.form_path ?? ''),
    ownerName: row.owner_name == null ? null : String(row.owner_name),
    emailOwner: String(row.email_owner ?? ''),
    isActive: Boolean(row.is_active),
    notes: row.notes == null ? null : String(row.notes),
    createdAt: row.created_at == null ? null : String(row.created_at),
    updatedAt: row.updated_at == null ? null : String(row.updated_at),
  };
}

export async function getFormResponsibles(): Promise<FormResponsibleRow[]> {
  await ensureFormResponsiblesTable();
  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: `
      SELECT
        form_code,
        form_label,
        form_path,
        owner_name,
        email_owner,
        COALESCE(is_active, TRUE) AS is_active,
        notes,
        CAST(created_at AS STRING) AS created_at,
        CAST(updated_at AS STRING) AS updated_at
      FROM \`${FORM_RESPONSIBLES_TABLE}\`
      ORDER BY form_label, email_owner
    `,
  });

  return (rows as Array<Record<string, unknown>>).map(rowToFormResponsible);
}

export async function getActiveFormResponsibles(): Promise<FormResponsibleRow[]> {
  const rows = await getFormResponsibles();
  return rows.filter((row) => row.isActive && row.emailOwner.trim());
}

export async function upsertFormResponsible(input: UpsertFormResponsibleInput) {
  const definition = getDefinition(input.formCode);
  if (!definition) throw new Error('Invalid form.');

  const emailOwner = normalizeEmail(input.emailOwner);
  if (!emailOwner) throw new Error('Owner email is required.');

  const updatedBy = (input.updatedBy ?? '').trim() || 'admin_panel';
  const ownerName = (input.ownerName ?? '').trim();
  const notes = (input.notes ?? '').trim();

  await ensureFormResponsiblesTable();
  const client = getBigQueryClient();
  await client.query({
    query: `
      MERGE \`${FORM_RESPONSIBLES_TABLE}\` AS target
      USING (
        SELECT
          @formCode AS form_code,
          @formLabel AS form_label,
          @formPath AS form_path,
          NULLIF(@ownerName, '') AS owner_name,
          @emailOwner AS email_owner,
          @isActive AS is_active,
          NULLIF(@notes, '') AS notes,
          @updatedBy AS updated_by
      ) AS source
      ON target.form_code = source.form_code
        AND LOWER(TRIM(target.email_owner)) = source.email_owner
      WHEN MATCHED THEN UPDATE SET
        form_label = source.form_label,
        form_path = source.form_path,
        owner_name = source.owner_name,
        is_active = source.is_active,
        notes = source.notes,
        updated_at = CURRENT_TIMESTAMP(),
        updated_by = source.updated_by
      WHEN NOT MATCHED THEN INSERT (
        form_code,
        form_label,
        form_path,
        owner_name,
        email_owner,
        is_active,
        notes,
        created_at,
        created_by,
        updated_at,
        updated_by
      )
      VALUES (
        source.form_code,
        source.form_label,
        source.form_path,
        source.owner_name,
        source.email_owner,
        source.is_active,
        source.notes,
        CURRENT_TIMESTAMP(),
        source.updated_by,
        CURRENT_TIMESTAMP(),
        source.updated_by
      )
    `,
    params: {
      formCode: definition.formCode,
      formLabel: definition.formLabel,
      formPath: definition.formPath,
      ownerName,
      emailOwner,
      isActive: input.isActive ?? true,
      notes,
      updatedBy,
    },
  });

  return { ok: true as const };
}

export async function setFormResponsibleActive(formCode: string, emailOwner: string, isActive: boolean, updatedBy = 'admin_panel') {
  const safeFormCode = normalizeFormCode(formCode);
  const safeEmail = normalizeEmail(emailOwner);
  if (!getDefinition(safeFormCode)) throw new Error('Invalid form.');
  if (!safeEmail) throw new Error('Owner email is required.');

  await ensureFormResponsiblesTable();
  const client = getBigQueryClient();
  await client.query({
    query: `
      UPDATE \`${FORM_RESPONSIBLES_TABLE}\`
      SET
        is_active = @isActive,
        updated_at = CURRENT_TIMESTAMP(),
        updated_by = @updatedBy
      WHERE form_code = @formCode
        AND LOWER(TRIM(email_owner)) = @emailOwner
    `,
    params: { formCode: safeFormCode, emailOwner: safeEmail, isActive, updatedBy },
  });

  return { ok: true as const };
}
