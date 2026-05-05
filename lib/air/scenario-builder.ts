import { calculateScenarioTerritoryRows, MAX_MONTHLY_VISIT_CAPACITY } from '@/lib/air/capacity-model';
import { getRecommendationAction, recommendationReason, recommendDoctorObjective } from '@/lib/air/recommend-visit-objective';
import type {
  AirMedicalFileRow,
  AirScenarioDefinition,
  AirScenarioDoctorRow,
  AirScenarioResult,
  AirScenarioSummary,
  AirSegmentedDoctor,
  RecommendationAction,
  ScenarioId,
} from '@/lib/air/types';

export const AIR_SCENARIOS: AirScenarioDefinition[] = [
  {
    scenarioId: 'baseline',
    scenarioName: 'Baseline',
    description: 'Keeps current visit objectives as-is.',
  },
  {
    scenarioId: 'optimize_private_growth',
    scenarioName: 'Optimize Private Growth',
    description: 'Prioritizes high market volume, lower Chiesi affinity and under-covered opportunities.',
  },
  {
    scenarioId: 'defend_chiesi_core',
    scenarioName: 'Defend Chiesi Core',
    description: 'Protects Chiesi Lovers, Chiesi Friendly doctors and current Chiesi prescription base.',
  },
  {
    scenarioId: 'deprioritize_low_roi',
    scenarioName: 'Deprioritize Low ROI',
    description: 'Releases capacity from low market volume, low affinity and uncertain matches.',
  },
  {
    scenarioId: 'balanced_redesign',
    scenarioName: 'Balanced Redesign',
    description: 'Balances defense, conversion opportunity and territory capacity realism.',
  },
];

function clean(value: string | null | undefined, fallback: string) {
  const trimmed = (value ?? '').trim();
  return trimmed || fallback;
}

function getDoctorKey(row: AirMedicalFileRow) {
  return clean(row.imsId, clean(row.fullName, 'unknown'));
}

function actionCounts(rows: AirScenarioDoctorRow[], action: RecommendationAction) {
  return rows.filter((row) => row.recommendationAction === action).length;
}

function buildWarnings(summary: Omit<AirScenarioSummary, 'warnings'>) {
  const warnings: string[] = [];
  if (summary.territoriesOverloaded > 0) {
    warnings.push(`This scenario exceeds monthly capacity in ${summary.territoriesOverloaded} territories.`);
  }
  if (summary.doctorsRemoved > 0) {
    warnings.push(`This scenario removes or deprioritizes ${summary.doctorsRemoved} physician-territory assignments.`);
  }
  if (summary.doctorsReview > 0) {
    warnings.push(`${summary.doctorsReview} physician-territory assignments require manual review before changing objectives.`);
  }
  if (summary.doctorsAdded > 0) {
    warnings.push(`This scenario adds ${summary.doctorsAdded} potential physician-territory priorities.`);
  }
  return warnings;
}

function calculateSummary(
  definition: AirScenarioDefinition,
  doctorRows: AirScenarioDoctorRow[],
  segmentedDoctors: AirSegmentedDoctor[],
): AirScenarioSummary {
  const includedImsIds = new Set(doctorRows.filter((row) => row.scenarioObjective > 0).map((row) => row.imsId));
  const allMarketRx = segmentedDoctors.reduce((total, doctor) => total + doctor.marketRxMat, 0);
  const allChiesiRx = segmentedDoctors.reduce((total, doctor) => total + doctor.chiesiRxMat, 0);
  const coveredDoctors = segmentedDoctors.filter((doctor) => includedImsIds.has(doctor.imsId));
  const marketRxMatCovered = coveredDoctors.reduce((total, doctor) => total + doctor.marketRxMat, 0);
  const chiesiRxMatCovered = coveredDoctors.reduce((total, doctor) => total + doctor.chiesiRxMat, 0);
  const territoryRows = calculateScenarioTerritoryRows(definition.scenarioId, doctorRows);
  const availableCapacity = territoryRows.reduce((total, row) => total + row.availableCapacity, 0);
  const totalCurrentObjective = doctorRows.reduce((total, row) => total + row.currentObjective, 0);
  const totalRecommendedObjective = doctorRows.reduce((total, row) => total + row.scenarioObjective, 0);

  const summaryWithoutWarnings = {
    scenarioId: definition.scenarioId,
    scenarioName: definition.scenarioName,
    totalDoctors: includedImsIds.size,
    totalCurrentObjective,
    totalRecommendedObjective,
    availableCapacity,
    capacityGap: availableCapacity - totalRecommendedObjective,
    capacityUtilization: availableCapacity === 0 ? 0 : totalRecommendedObjective / availableCapacity,
    marketRxMatCovered,
    chiesiRxMatCovered,
    marketCoveragePercentage: allMarketRx === 0 ? 0 : marketRxMatCovered / allMarketRx,
    chiesiCoveragePercentage: allChiesiRx === 0 ? 0 : chiesiRxMatCovered / allChiesiRx,
    highPotentialDoctorsIncluded: coveredDoctors.filter(
      (doctor) => doctor.airRelevanceSegment === 'B. High Potential Market Prescribers',
    ).length,
    lowPriorityDoctorsIncluded: coveredDoctors.filter((doctor) => doctor.airRelevanceSegment === 'D. Low Priority').length,
    doctorsAdded: actionCounts(doctorRows, 'add_to_call_plan'),
    doctorsIncreased: actionCounts(doctorRows, 'increase_frequency'),
    doctorsDecreased: actionCounts(doctorRows, 'decrease_frequency'),
    doctorsRemoved: actionCounts(doctorRows, 'remove_or_deprioritize'),
    doctorsReview: actionCounts(doctorRows, 'review_manually'),
    territoriesOverloaded: territoryRows.filter(
      (row) => row.capacityStatus === 'moderately_overloaded' || row.capacityStatus === 'critically_overloaded',
    ).length,
    territoriesUnderutilized: territoryRows.filter((row) => row.capacityStatus === 'underutilized').length,
  };

  return {
    ...summaryWithoutWarnings,
    warnings: buildWarnings(summaryWithoutWarnings),
  };
}

function relevancePriority(segment: string) {
  if (segment === 'A. Strategic Chiesi Lovers') return 5;
  if (segment === 'B. High Potential Market Prescribers') return 4;
  if (segment === 'C. Maintain / Defend') return 3;
  if (segment === 'E. Review / Unmatched') return 2;
  if (segment === 'D. Low Priority') return 1;
  return 0;
}

function minimumObjectiveForCapacity(row: AirScenarioDoctorRow) {
  if (row.airRelevanceSegment === 'A. Strategic Chiesi Lovers') return 1;
  if (row.airRelevanceSegment === 'B. High Potential Market Prescribers') return 1;
  if (row.matchConfidence === 'low' || row.matchConfidence === 'unmatched') return Math.min(row.currentObjective, 1);
  return 0;
}

function capacityReductionOrder(a: AirScenarioDoctorRow, b: AirScenarioDoctorRow) {
  const relevanceDiff = relevancePriority(a.airRelevanceSegment) - relevancePriority(b.airRelevanceSegment);
  if (relevanceDiff !== 0) return relevanceDiff;
  const opportunityDiff = a.opportunityScore - b.opportunityScore;
  if (opportunityDiff !== 0) return opportunityDiff;
  return a.marketRxMat - b.marketRxMat;
}

function applyTerritoryHardCap(rows: AirScenarioDoctorRow[]) {
  const byTerritory = new Map<string, AirScenarioDoctorRow[]>();
  for (const row of rows) {
    const territoryRows = byTerritory.get(row.territory) ?? [];
    territoryRows.push(row);
    byTerritory.set(row.territory, territoryRows);
  }

  for (const territoryRows of byTerritory.values()) {
    let total = territoryRows.reduce((sum, row) => sum + row.scenarioObjective, 0);
    if (total <= MAX_MONTHLY_VISIT_CAPACITY) continue;

    const candidates = [...territoryRows].sort(capacityReductionOrder);
    let cursor = 0;
    while (total > MAX_MONTHLY_VISIT_CAPACITY && cursor < candidates.length) {
      const row = candidates[cursor];
      const minimumObjective = minimumObjectiveForCapacity(row);
      if (row.scenarioObjective > minimumObjective) {
        row.scenarioObjective -= 1;
        total -= 1;
        row.objectiveDelta = row.scenarioObjective - row.currentObjective;
        row.recommendationAction = getRecommendationAction(row.currentObjective, row.scenarioObjective, row.matchConfidence);
        const capacityReason = `Adjusted to keep the territory within the operational maximum of ${MAX_MONTHLY_VISIT_CAPACITY} visits per month.`;
        if (!row.recommendationReason.includes(capacityReason)) {
          row.recommendationReason = `${row.recommendationReason} ${capacityReason}`;
        }
      } else {
        cursor += 1;
      }
    }
  }

  return rows;
}

export function buildAirScenario(
  scenarioId: ScenarioId,
  medicalRows: AirMedicalFileRow[],
  segmentedDoctors: AirSegmentedDoctor[],
): AirScenarioResult {
  const definition = AIR_SCENARIOS.find((scenario) => scenario.scenarioId === scenarioId) ?? AIR_SCENARIOS[0];
  const doctorsByIms = new Map(segmentedDoctors.map((doctor) => [doctor.imsId, doctor]));

  const doctorRows: AirScenarioDoctorRow[] = medicalRows
    .map((row) => {
      const imsId = getDoctorKey(row);
      const doctor = doctorsByIms.get(imsId);
      if (!doctor) return null;

      const currentObjective = Number.isFinite(row.objetivo) ? row.objetivo : 0;
      const doctorRecommendation = recommendDoctorObjective(doctor, scenarioId);
      const scenarioObjective = scenarioId === 'baseline' ? currentObjective : doctorRecommendation.recommendedObjective;
      const recommendationAction =
        scenarioId === 'baseline'
          ? 'maintain_frequency'
          : getRecommendationAction(currentObjective, scenarioObjective, doctor.matchConfidence);

      return {
        scenarioId: definition.scenarioId,
        imsId: doctor.imsId,
        fullName: doctor.fullName,
        territory: clean(row.territory, 'Unassigned territory'),
        district: clean(row.district, 'Unassigned district'),
        currentObjective,
        scenarioObjective,
        objectiveDelta: scenarioObjective - currentObjective,
        recommendationAction,
        recommendationReason:
          scenarioId === 'baseline' ? 'Baseline keeps the current Call Plan objective.' : recommendationReason(doctor, recommendationAction),
        opportunityScore: doctorRecommendation.opportunityScore,
        marketRxMat: doctor.marketRxMat,
        chiesiRxMat: doctor.chiesiRxMat,
        chiesiShareMat: doctor.chiesiShareMat,
        visited: doctor.closeupVisited,
        matchConfidence: doctor.matchConfidence,
        marketVolumeSegment: doctor.marketVolumeSegment,
        chiesiAffinitySegment: doctor.chiesiAffinitySegment,
        airRelevanceSegment: doctor.airRelevanceSegment,
      };
    })
    .filter((row): row is AirScenarioDoctorRow => Boolean(row))
    .sort((a, b) => b.opportunityScore - a.opportunityScore);
  const capacityConstrainedDoctorRows =
    scenarioId === 'baseline' ? doctorRows : applyTerritoryHardCap(doctorRows).sort((a, b) => b.opportunityScore - a.opportunityScore);

  const territoryRows = calculateScenarioTerritoryRows(definition.scenarioId, capacityConstrainedDoctorRows);

  return {
    definition,
    summary: calculateSummary(definition, capacityConstrainedDoctorRows, segmentedDoctors),
    doctorRows: capacityConstrainedDoctorRows,
    territoryRows,
  };
}

export function buildAirScenarios(medicalRows: AirMedicalFileRow[], segmentedDoctors: AirSegmentedDoctor[]) {
  return AIR_SCENARIOS.map((scenario) => buildAirScenario(scenario.scenarioId, medicalRows, segmentedDoctors));
}

export function getScenarioById(results: AirScenarioResult[], scenarioId: ScenarioId) {
  return results.find((result) => result.definition.scenarioId === scenarioId) ?? results[0];
}
