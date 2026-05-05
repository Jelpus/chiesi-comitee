import {
  DEFAULT_MONTHLY_VISIT_CAPACITY,
  MAX_MONTHLY_VISIT_CAPACITY,
  getCapacityStatus,
} from '@/lib/air/capacity-model';
import { AIR_SCENARIOS } from '@/lib/air/scenario-builder';
import type {
  AirPublicClueSegment,
  AirPublicRecommendationAction,
  AirPublicScenarioClueRow,
  AirPublicScenarioResult,
  AirPublicScenarioSummary,
  AirPublicScenarioTerritoryRow,
  ScenarioId,
} from '@/lib/air/types';

function clean(value: string | null | undefined, fallback: string) {
  const trimmed = (value ?? '').trim();
  return trimmed || fallback;
}

function marketScore(segment: string) {
  if (segment === 'Very High Public Demand') return 100;
  if (segment === 'High Public Demand') return 80;
  if (segment === 'Medium Public Demand') return 60;
  if (segment === 'Low Public Demand') return 35;
  return 15;
}

function affinityScore(segment: string) {
  if (segment === 'Chiesi Lover') return 100;
  if (segment === 'Chiesi Friendly') return 80;
  if (segment === 'Neutral') return 55;
  if (segment === 'Low Chiesi Affinity') return 30;
  return 10;
}

function conversionScore(clue: AirPublicClueSegment) {
  const highDemand = clue.demandSegment === 'Very High Public Demand' || clue.demandSegment === 'High Public Demand';
  const mediumDemand = clue.demandSegment === 'Medium Public Demand';
  if (highDemand && clue.chiesiAffinitySegment === 'Low Chiesi Affinity') return 100;
  if (highDemand && clue.chiesiAffinitySegment === 'No / Minimal Chiesi Affinity') return 95;
  if (highDemand && clue.chiesiAffinitySegment === 'Neutral') return 80;
  if (mediumDemand && clue.chiesiAffinitySegment === 'Low Chiesi Affinity') return 60;
  if (mediumDemand && clue.chiesiAffinitySegment === 'Neutral') return 55;
  if (clue.chiesiAffinitySegment === 'Chiesi Lover') return 30;
  if (clue.chiesiAffinitySegment === 'Chiesi Friendly') return 45;
  return 20;
}

function coverageGapScore(clue: AirPublicClueSegment) {
  const highDemand = clue.demandSegment === 'Very High Public Demand' || clue.demandSegment === 'High Public Demand';
  const mediumDemand = clue.demandSegment === 'Medium Public Demand';
  if (highDemand && !clue.visited) return 100;
  if (highDemand && clue.visited) return 60;
  if (mediumDemand && !clue.visited) return 70;
  if (mediumDemand && clue.visited) return 45;
  return clue.visited ? 20 : 35;
}

function opportunityScore(clue: AirPublicClueSegment) {
  const score =
    marketScore(clue.demandSegment) * 0.35 +
    conversionScore(clue) * 0.25 +
    affinityScore(clue.chiesiAffinitySegment) * 0.2 +
    coverageGapScore(clue) * 0.15 +
    50 * 0.05;
  return Number(score.toFixed(1));
}

function baseRecommendedVisits(score: number) {
  if (score >= 85) return 3;
  if (score >= 70) return 2;
  if (score >= 50) return 1;
  return 0;
}

function scenarioVisits(clue: AirPublicClueSegment, scenarioId: ScenarioId, score: number) {
  if (scenarioId === 'baseline') return clue.visited ? 1 : 0;

  let visits = baseRecommendedVisits(score);
  if (scenarioId === 'optimize_private_growth') {
    if (clue.airRelevanceSegment === 'B. High Potential Unvisited CLUEs') visits = Math.max(visits, 2);
    if (clue.demandSegment === 'Very High Public Demand' && !clue.visited) visits = Math.max(visits, 3);
    if (clue.airRelevanceSegment === 'D. Low Priority') visits = Math.min(visits, 1);
  }
  if (scenarioId === 'defend_chiesi_core') {
    if (clue.chiesiAffinitySegment === 'Chiesi Lover') visits = Math.max(visits, 2);
    if (clue.chiesiAffinitySegment === 'Chiesi Friendly') visits = Math.max(visits, 1);
    if (clue.chiesiAffinitySegment === 'No / Minimal Chiesi Affinity') visits = Math.min(visits, 1);
  }
  if (scenarioId === 'deprioritize_low_roi') {
    if (clue.airRelevanceSegment === 'D. Low Priority') visits = 0;
    if (clue.demandSegment === 'Very Low Public Demand') visits = 0;
  }
  if (scenarioId === 'balanced_redesign') {
    if (clue.airRelevanceSegment === 'A. Strategic Public Demand Centers') visits = Math.max(visits, 1);
    if (clue.airRelevanceSegment === 'B. High Potential Unvisited CLUEs') visits = Math.max(visits, 2);
    if (clue.airRelevanceSegment === 'D. Low Priority') visits = Math.min(visits, 1);
  }
  return Math.max(0, Math.min(3, visits));
}

function buildRouteStateAccess(clues: AirPublicClueSegment[]) {
  const access = new Map<string, Set<string>>();
  const territoryDistrict = new Map<string, string>();
  for (const clue of clues) {
    if (!clue.visited || !clue.territory || !clue.state) continue;
    const states = access.get(clue.territory) ?? new Set<string>();
    states.add(clue.state);
    access.set(clue.territory, states);
    territoryDistrict.set(clue.territory, clean(clue.district, 'Unassigned district'));
  }
  return { access, territoryDistrict };
}

function chooseTerritoryForClue(
  clue: AirPublicClueSegment,
  territoryLoads: Map<string, number>,
  access: Map<string, Set<string>>,
) {
  if (clue.visited && clue.territory) return clue.territory;
  if (clue.territory && (territoryLoads.get(clue.territory) ?? 0) < MAX_MONTHLY_VISIT_CAPACITY) return clue.territory;

  const eligible = [...access.entries()]
    .filter(([, states]) => states.has(clue.state))
    .map(([territory]) => ({
      territory,
      load: territoryLoads.get(territory) ?? 0,
    }))
    .filter((row) => row.load < MAX_MONTHLY_VISIT_CAPACITY)
    .sort((a, b) => a.load - b.load);

  return eligible[0]?.territory ?? clean(clue.territory, 'Unassigned route');
}

function actionFor(clue: AirPublicClueSegment, visits: number): AirPublicRecommendationAction {
  if (!clue.state) return 'review_manually';
  if (!clue.visited && visits > 0) return 'add_to_route';
  if (clue.visited && visits === 0) return 'remove_or_deprioritize';
  if (clue.visited && visits >= 2) return 'increase_priority';
  if (clue.visited && visits === 1) return 'maintain_coverage';
  return visits > 0 ? 'maintain_coverage' : 'decrease_priority';
}

function reasonFor(clue: AirPublicClueSegment, action: AirPublicRecommendationAction) {
  if (action === 'review_manually') return 'Missing state or route context. Review manually before assigning coverage.';
  if (action === 'add_to_route') return 'Unvisited CLUE with relevant public demand. Suggested for route inclusion within the same state footprint.';
  if (action === 'remove_or_deprioritize') return 'Visited CLUE with lower public demand or lower strategic fit. Potential visit capacity can be reallocated.';
  if (action === 'increase_priority') return 'Visited CLUE with stronger demand or Chiesi affinity. Suggested higher visit priority.';
  if (clue.airRelevanceSegment === 'A. Strategic Public Demand Centers') return 'Strategic public demand center. Maintain coverage to defend Chiesi demand.';
  return 'Suggested public coverage based on demand, Chiesi affinity and route-state feasibility.';
}

function reduceTerritoryToCap(rows: AirPublicScenarioClueRow[]) {
  const byTerritory = new Map<string, AirPublicScenarioClueRow[]>();
  for (const row of rows) {
    const territoryRows = byTerritory.get(row.recommendedTerritory) ?? [];
    territoryRows.push(row);
    byTerritory.set(row.recommendedTerritory, territoryRows);
  }

  for (const territoryRows of byTerritory.values()) {
    let total = territoryRows.reduce((sum, row) => sum + row.recommendedVisits, 0);
    if (total <= MAX_MONTHLY_VISIT_CAPACITY) continue;

    const candidates = [...territoryRows].sort((a, b) => {
      if (a.airRelevanceSegment !== b.airRelevanceSegment) {
        if (a.airRelevanceSegment === 'D. Low Priority') return -1;
        if (b.airRelevanceSegment === 'D. Low Priority') return 1;
      }
      return a.opportunityScore - b.opportunityScore;
    });

    let cursor = 0;
    while (total > MAX_MONTHLY_VISIT_CAPACITY && cursor < candidates.length) {
      const row = candidates[cursor];
      const minimum = row.airRelevanceSegment.startsWith('A.') || row.airRelevanceSegment.startsWith('B.') ? 1 : 0;
      if (row.recommendedVisits > minimum) {
        row.recommendedVisits -= 1;
        total -= 1;
        row.recommendationAction = actionFor(
          {
            ...row,
            territory: row.currentTerritory,
            publicDemandMat: row.publicDemandMat,
            chiesiPublicDemandMat: row.chiesiPublicDemandMat,
            visitCoverageSegment: '',
            reference: '',
            marketGroup: '',
          } as AirPublicClueSegment,
          row.recommendedVisits,
        );
        const capReason = `Adjusted to keep the route within the operational maximum of ${MAX_MONTHLY_VISIT_CAPACITY} visits per month.`;
        if (!row.recommendationReason.includes(capReason)) row.recommendationReason = `${row.recommendationReason} ${capReason}`;
      } else {
        cursor += 1;
      }
    }
  }

  return rows;
}

function territoryRows(scenarioId: ScenarioId, rows: AirPublicScenarioClueRow[]): AirPublicScenarioTerritoryRow[] {
  const byTerritory = new Map<string, AirPublicScenarioClueRow[]>();
  for (const row of rows) {
    const territoryRows = byTerritory.get(row.recommendedTerritory) ?? [];
    territoryRows.push(row);
    byTerritory.set(row.recommendedTerritory, territoryRows);
  }

  return [...byTerritory.entries()]
    .map(([territory, territoryClues]) => {
      const recommendedVisits = territoryClues.reduce((sum, row) => sum + row.recommendedVisits, 0);
      return {
        scenarioId,
        territory,
        district: clean(territoryClues[0]?.district, 'Unassigned district'),
        state: clean(territoryClues[0]?.state, 'Unassigned state'),
        visitedCluesBase: territoryClues.filter((row) => row.visited && row.currentTerritory === territory).length,
        recommendedClues: territoryClues.filter((row) => row.recommendedVisits > 0).length,
        recommendedVisits,
        availableCapacity: DEFAULT_MONTHLY_VISIT_CAPACITY,
        maxCapacity: MAX_MONTHLY_VISIT_CAPACITY,
        capacityGap: MAX_MONTHLY_VISIT_CAPACITY - recommendedVisits,
        capacityUtilization: recommendedVisits / DEFAULT_MONTHLY_VISIT_CAPACITY,
        capacityStatus: getCapacityStatus(recommendedVisits / DEFAULT_MONTHLY_VISIT_CAPACITY),
        cluesAdded: territoryClues.filter((row) => row.recommendationAction === 'add_to_route').length,
        cluesRemoved: territoryClues.filter((row) => row.recommendationAction === 'remove_or_deprioritize').length,
      };
    })
    .sort((a, b) => b.recommendedVisits - a.recommendedVisits);
}

function summary(
  scenarioId: ScenarioId,
  scenarioName: string,
  clueRows: AirPublicScenarioClueRow[],
  territoryImpact: AirPublicScenarioTerritoryRow[],
): AirPublicScenarioSummary {
  const covered = clueRows.filter((row) => row.recommendedVisits > 0);
  const totalRecommendedVisits = covered.reduce((sum, row) => sum + row.recommendedVisits, 0);
  const maxCapacity = territoryImpact.reduce((sum, row) => sum + row.maxCapacity, 0);
  const availableCapacity = territoryImpact.reduce((sum, row) => sum + row.availableCapacity, 0);
  const territoriesOverMaxCapacity = territoryImpact.filter((row) => row.recommendedVisits > row.maxCapacity).length;
  const warnings: string[] = [];
  if (territoriesOverMaxCapacity > 0) warnings.push(`${territoriesOverMaxCapacity} routes exceed the operational maximum.`);
  const added = clueRows.filter((row) => row.recommendationAction === 'add_to_route').length;
  if (added > 0) warnings.push(`${added} unvisited CLUEs are suggested for route inclusion based on state footprint.`);

  return {
    scenarioId,
    scenarioName,
    totalCluesRecommended: covered.length,
    totalRecommendedVisits,
    availableCapacity,
    maxCapacity,
    capacityGap: maxCapacity - totalRecommendedVisits,
    capacityUtilization: availableCapacity === 0 ? 0 : totalRecommendedVisits / availableCapacity,
    publicDemandMatCovered: covered.reduce((sum, row) => sum + row.publicDemandMat, 0),
    chiesiPublicDemandMatCovered: covered.reduce((sum, row) => sum + row.chiesiPublicDemandMat, 0),
    highPotentialCluesIncluded: covered.filter((row) => row.airRelevanceSegment === 'B. High Potential Unvisited CLUEs').length,
    lowPriorityCluesIncluded: covered.filter((row) => row.airRelevanceSegment === 'D. Low Priority').length,
    cluesAdded: added,
    cluesRemoved: clueRows.filter((row) => row.recommendationAction === 'remove_or_deprioritize').length,
    cluesReview: clueRows.filter((row) => row.recommendationAction === 'review_manually').length,
    territoriesOverMaxCapacity,
    warnings,
  };
}

export function buildAirPublicScenario(
  scenarioId: ScenarioId,
  clues: AirPublicClueSegment[],
): AirPublicScenarioResult {
  const definition = AIR_SCENARIOS.find((scenario) => scenario.scenarioId === scenarioId) ?? AIR_SCENARIOS[0];
  const { access, territoryDistrict } = buildRouteStateAccess(clues);
  const territoryLoads = new Map<string, number>();

  const clueRows = clues
    .map((clue) => {
      const score = opportunityScore(clue);
      const recommendedVisits = scenarioVisits(clue, scenarioId, score);
      const recommendedTerritory = recommendedVisits > 0 ? chooseTerritoryForClue(clue, territoryLoads, access) : clean(clue.territory, 'Unassigned route');
      territoryLoads.set(recommendedTerritory, (territoryLoads.get(recommendedTerritory) ?? 0) + recommendedVisits);
      const action = actionFor(clue, recommendedVisits);
      return {
        scenarioId,
        clue: clue.clue,
        unitName: clue.unitName,
        state: clue.state,
        institution: clue.institution,
        marketGroup: clue.marketGroup,
        currentTerritory: clean(clue.territory, 'No current route'),
        recommendedTerritory,
        district: clean(clue.district, territoryDistrict.get(recommendedTerritory) ?? 'Unassigned district'),
        visited: clue.visited,
        recommendedVisits,
        recommendationAction: action,
        recommendationReason: reasonFor(clue, action),
        opportunityScore: score,
        publicDemandMat: clue.publicDemandMat,
        chiesiPublicDemandMat: clue.chiesiPublicDemandMat,
        chiesiShareMat: clue.chiesiShareMat,
        demandSegment: clue.demandSegment,
        chiesiAffinitySegment: clue.chiesiAffinitySegment,
        airRelevanceSegment: clue.airRelevanceSegment,
      };
    })
    .sort((a, b) => b.opportunityScore - a.opportunityScore);

  const cappedRows = scenarioId === 'baseline' ? clueRows : reduceTerritoryToCap(clueRows);
  const impact = territoryRows(scenarioId, cappedRows);

  return {
    definition,
    summary: summary(scenarioId, definition.scenarioName, cappedRows, impact),
    clueRows: cappedRows,
    territoryRows: impact,
  };
}

export function buildAirPublicScenarios(clues: AirPublicClueSegment[]) {
  return AIR_SCENARIOS.map((scenario) => buildAirPublicScenario(scenario.scenarioId, clues));
}

export function getAirPublicScenarioById(results: AirPublicScenarioResult[], scenarioId: ScenarioId) {
  return results.find((result) => result.definition.scenarioId === scenarioId) ?? results[0];
}
