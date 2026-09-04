import 'server-only';

import { randomUUID } from 'crypto';
import { getBigQueryClient } from '@/lib/bigquery/client';
import { getMexicoCityDate } from '@/lib/time/mexico-city';

const DISPATCH_TABLE = 'chiesi-committee.chiesi_committee_admin.committee_notification_dispatches';

export type CommitteeNotificationType = 'request_info' | 'reminder' | 'validation';
export type CommitteeNotificationSource = 'manual' | 'automation';

let ensureTablePromise: Promise<void> | null = null;

async function ensureDispatchTable() {
  if (ensureTablePromise) return ensureTablePromise;
  const client = getBigQueryClient();
  ensureTablePromise = client.query({
    query: `
      CREATE TABLE IF NOT EXISTS \`${DISPATCH_TABLE}\` (
        dispatch_id STRING NOT NULL,
        reporting_version_id STRING NOT NULL,
        period_month DATE NOT NULL,
        notification_type STRING NOT NULL,
        dispatch_date DATE NOT NULL,
        source STRING NOT NULL,
        status STRING NOT NULL,
        started_at TIMESTAMP NOT NULL,
        completed_at TIMESTAMP,
        sent_count INT64,
        message STRING
      )
    `,
  }).then(() => undefined);
  return ensureTablePromise;
}

export async function beginNotificationDispatch(input: {
  reportingVersionId: string;
  periodMonth: string;
  notificationType: CommitteeNotificationType;
  source: CommitteeNotificationSource;
}) {
  await ensureDispatchTable();
  const client = getBigQueryClient();
  const dispatchId = `dispatch_${randomUUID()}`;
  const dispatchDate = getMexicoCityDate();
  const periodMonth = input.periodMonth.trim().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(periodMonth)) throw new Error('Period must use YYYY-MM.');

  await client.query({
    query: `
      MERGE \`${DISPATCH_TABLE}\` AS target
      USING (
        SELECT
          @dispatchId AS dispatch_id,
          @reportingVersionId AS reporting_version_id,
          DATE(@periodMonth) AS period_month,
          @notificationType AS notification_type,
          DATE(@dispatchDate) AS dispatch_date,
          @source AS source
      ) AS incoming
      ON target.period_month = incoming.period_month
        AND target.notification_type = incoming.notification_type
        AND target.dispatch_date = incoming.dispatch_date
        AND target.status IN ('started', 'succeeded')
      WHEN NOT MATCHED THEN INSERT (
        dispatch_id, reporting_version_id, period_month, notification_type, dispatch_date, source, status, started_at
      ) VALUES (
        incoming.dispatch_id, incoming.reporting_version_id, incoming.period_month, incoming.notification_type,
        incoming.dispatch_date, incoming.source, 'started', CURRENT_TIMESTAMP()
      )
    `,
    params: {
      dispatchId,
      reportingVersionId: input.reportingVersionId,
      periodMonth: `${periodMonth}-01`,
      notificationType: input.notificationType,
      dispatchDate,
      source: input.source,
    },
  });

  const [rows] = await client.query({
    query: `
      SELECT dispatch_id
      FROM \`${DISPATCH_TABLE}\`
      WHERE dispatch_id = @dispatchId AND status = 'started'
      LIMIT 1
    `,
    params: { dispatchId },
  });

  return rows.length > 0 ? { dispatchId, dispatchDate } : null;
}

export async function finishNotificationDispatch(input: {
  dispatchId: string;
  status: 'succeeded' | 'failed';
  sentCount: number;
  message?: string;
}) {
  await ensureDispatchTable();
  const client = getBigQueryClient();
  await client.query({
    query: `
      UPDATE \`${DISPATCH_TABLE}\`
      SET
        status = @status,
        completed_at = CURRENT_TIMESTAMP(),
        sent_count = @sentCount,
        message = NULLIF(@message, '')
      WHERE dispatch_id = @dispatchId
    `,
    params: {
      dispatchId: input.dispatchId,
      status: input.status,
      sentCount: input.sentCount,
      message: input.message?.trim() ?? '',
    },
  });
}
