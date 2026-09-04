import 'server-only';

import { getBigQueryClient } from '@/lib/bigquery/client';
import {
  createReportingVersion,
  markReportingVersionReady,
  notifyReportingVersionReadyValidation,
  requestReportingVersionInfo,
  requestReportingVersionReminder,
} from '@/app/admin/versions/actions';
import {
  attachReportingVersion,
  getCommitteePlans,
  hasSuccessfulPlanningEvent,
  logPlanningEvent,
  type CommitteePlan,
  type PlanningEventType,
} from '@/lib/data/committee-planning';
import { getMexicoCityDate } from '@/lib/time/mexico-city';
import { cloneAdminTargetsBetweenVersions } from '@/lib/data/targets';

type DueEvent = { type: PlanningEventType; scheduledDate: string };

async function ensureVersionOne(plan: CommitteePlan) {
  if (plan.reportingVersionId) return plan.reportingVersionId;
  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: `
      SELECT reporting_version_id
      FROM \`chiesi-committee.chiesi_committee_admin.reporting_versions\`
      WHERE period_month = DATE(@periodMonth) AND version_number = 1
      ORDER BY created_at ASC
      LIMIT 1
    `,
    params: { periodMonth: `${plan.periodMonth}-01` },
  });
  let reportingVersionId = String((rows as Array<Record<string, unknown>>)[0]?.reporting_version_id ?? '');
  if (!reportingVersionId) {
    const result = await createReportingVersion({
      periodMonth: plan.periodMonth,
      versionName: 'Version 1',
      createdBy: 'planning_automation',
      notes: `Opened automatically for Committee ${plan.committeeDate}`,
    });
    reportingVersionId = result.reportingVersionId;
  }
  await attachReportingVersion(plan.planningId, reportingVersionId);
  return reportingVersionId;
}

async function copyTargetsFromPreviousPeriod(plan: CommitteePlan, reportingVersionId: string) {
  const client = getBigQueryClient();
  const [rows] = await client.query({
    query: `
      SELECT
        reporting_version_id,
        CAST(period_month AS STRING) AS period_month
      FROM \`chiesi-committee.chiesi_committee_admin.reporting_versions\`
      WHERE period_month = (
        SELECT MAX(period_month)
        FROM \`chiesi-committee.chiesi_committee_admin.reporting_versions\`
        WHERE period_month < DATE(@periodMonth)
      )
      ORDER BY version_number DESC, created_at DESC
    `,
    params: { periodMonth: `${plan.periodMonth}-01` },
  });
  const previousVersions = rows as Array<Record<string, unknown>>;
  const sourcePeriodMonth = String(previousVersions[0]?.period_month ?? '').trim();

  if (!sourcePeriodMonth) {
    throw new Error(`No previous reporting period was found to copy targets into ${plan.periodMonth}.`);
  }

  for (const previousVersion of previousVersions) {
    const sourceReportingVersionId = String(previousVersion.reporting_version_id ?? '').trim();
    if (!sourceReportingVersionId) continue;
    const result = await cloneAdminTargetsBetweenVersions({
      sourceReportingVersionId,
      sourcePeriodMonth,
      targetReportingVersionId: reportingVersionId,
      targetPeriodMonth: `${plan.periodMonth}-01`,
      updatedBy: 'planning_automation',
    });
    if (result.sourceCount > 0) {
      return { ...result, sourcePeriodMonth };
    }
  }

  throw new Error(`The previous reporting period ${sourcePeriodMonth} has no targets to copy.`);
}

function dueEvents(plan: CommitteePlan, today: string): DueEvent[] {
  return [
    { type: 'open_request_info', scheduledDate: plan.requestInfoDate },
    { type: 'reminder_1', scheduledDate: plan.reminder1Date },
    { type: 'reminder_2', scheduledDate: plan.reminder2Date },
    { type: 'validation', scheduledDate: plan.validationDate },
  ].filter((event) => event.scheduledDate <= today) as DueEvent[];
}

async function executeEvent(plan: CommitteePlan, event: DueEvent) {
  const reportingVersionId = await ensureVersionOne(plan);
  if (event.type === 'open_request_info') {
    const targets = await copyTargetsFromPreviousPeriod(plan, reportingVersionId);
    const result = await requestReportingVersionInfo({
      reportingVersionId,
      periodMonth: plan.periodMonth,
      windowEndDate: plan.validationDate,
      source: 'automation',
    });
    if (result.skipped) {
      return {
        reportingVersionId,
        message: `v1 opened; ${targets.copied} target(s) copied and ${targets.skipped} already present from ${targets.sourcePeriodMonth}; Request Info already sent today, so no duplicate email was sent`,
      };
    }
    return {
      reportingVersionId,
      message: `v1 opened; ${targets.copied} target(s) copied and ${targets.skipped} already present from ${targets.sourcePeriodMonth}; ${result.sent} Request Info email(s) sent`,
    };
  }
  if (event.type === 'reminder_1' || event.type === 'reminder_2') {
    const result = await requestReportingVersionReminder({
      reportingVersionId,
      periodMonth: plan.periodMonth,
      source: 'automation',
    });
    if (result.skipped) {
      return { reportingVersionId, message: 'Reminder already sent today; scheduled event satisfied without a duplicate' };
    }
    return { reportingVersionId, message: `${result.sent} pending-information reminder(s) sent` };
  }

  await markReportingVersionReady({ reportingVersionId });
  const result = await notifyReportingVersionReadyValidation({
    reportingVersionId,
    periodMonth: plan.periodMonth,
    committeeMeetingDate: plan.committeeDate,
    source: 'automation',
  });
  if (result.skipped) {
    return { reportingVersionId, message: 'Validation already sent today; scheduled event satisfied without a duplicate' };
  }
  return { reportingVersionId, message: `Validation opened; ${result.sent} validation email(s) sent` };
}

export async function processCommitteePlanning(today = getMexicoCityDate()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error('Automation date must use YYYY-MM-DD.');
  const plans = (await getCommitteePlans()).filter((plan) => plan.isActive);
  let processed = 0;
  let skipped = 0;
  let failed = 0;
  const details: Array<{ planningId: string; eventType: PlanningEventType; status: string; message: string }> = [];

  for (const plan of plans.sort((a, b) => a.committeeDate.localeCompare(b.committeeDate))) {
    for (const event of dueEvents(plan, today)) {
      if (await hasSuccessfulPlanningEvent(plan.planningId, event.type, event.scheduledDate)) {
        skipped += 1;
        continue;
      }
      try {
        const result = await executeEvent(plan, event);
        await logPlanningEvent({
          planningId: plan.planningId,
          eventType: event.type,
          scheduledDate: event.scheduledDate,
          status: 'succeeded',
          message: result.message,
          reportingVersionId: result.reportingVersionId,
        });
        processed += 1;
        details.push({ planningId: plan.planningId, eventType: event.type, status: 'succeeded', message: result.message });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown automation error';
        await logPlanningEvent({
          planningId: plan.planningId,
          eventType: event.type,
          scheduledDate: event.scheduledDate,
          status: 'failed',
          message,
          reportingVersionId: plan.reportingVersionId,
        });
        failed += 1;
        details.push({ planningId: plan.planningId, eventType: event.type, status: 'failed', message });
        // Preserve event order: later emails should not run if an earlier step failed.
        break;
      }
    }
  }

  return { ok: failed === 0, date: today, processed, skipped, failed, details };
}
