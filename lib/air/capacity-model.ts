import type {
  AirDistrictCapacity,
  AirMedicalFileRow,
  AirScenarioDoctorRow,
  AirScenarioTerritoryRow,
  AirTerritoryCapacity,
  CapacityStatus,
  ScenarioId,
} from '@/lib/air/types';

export const DEFAULT_VISITS_PER_DAY = 8;
export const DEFAULT_WORKING_DAYS_PER_MONTH = 20;
export const DEFAULT_MONTHLY_VISIT_CAPACITY = DEFAULT_VISITS_PER_DAY * DEFAULT_WORKING_DAYS_PER_MONTH;
export const MAX_VISITS_PER_DAY = 10;
export const MAX_MONTHLY_VISIT_CAPACITY = MAX_VISITS_PER_DAY * DEFAULT_WORKING_DAYS_PER_MONTH;

function clean(value: string | null | undefined, fallback: string) {
  const trimmed = (value ?? '').trim();
  return trimmed || fallback;
}

export function getCapacityStatus(utilization: number): CapacityStatus {
  if (utilization < 0.8) return 'underutilized';
  if (utilization <= 1) return 'balanced';
  if (utilization <= 1.15) return 'moderately_overloaded';
  return 'critically_overloaded';
}

export function calculateTerritoryCapacity(rows: AirMedicalFileRow[]): AirTerritoryCapacity[] {
  const byTerritory = new Map<string, { territory: string; district: string; visits: number }>();

  for (const row of rows) {
    const territory = clean(row.territory, 'Unassigned territory');
    const district = clean(row.district, 'Unassigned district');
    const existing = byTerritory.get(territory) ?? { territory, district, visits: 0 };
    existing.visits += Number.isFinite(row.objetivo) ? row.objetivo : 0;
    byTerritory.set(territory, existing);
  }

  return [...byTerritory.values()]
    .map((row) => {
      const capacityGap = DEFAULT_MONTHLY_VISIT_CAPACITY - row.visits;
      const capacityUtilization = row.visits / DEFAULT_MONTHLY_VISIT_CAPACITY;
      return {
        territory: row.territory,
        district: row.district,
        currentAssignedVisits: row.visits,
        availableCapacity: DEFAULT_MONTHLY_VISIT_CAPACITY,
        capacityGap,
        capacityUtilization,
        capacityStatus: getCapacityStatus(capacityUtilization),
      };
    })
    .sort((a, b) => b.capacityUtilization - a.capacityUtilization);
}

export function calculateDistrictCapacity(territories: AirTerritoryCapacity[]): AirDistrictCapacity[] {
  const byDistrict = new Map<string, AirTerritoryCapacity[]>();

  for (const territory of territories) {
    const existing = byDistrict.get(territory.district) ?? [];
    existing.push(territory);
    byDistrict.set(territory.district, existing);
  }

  return [...byDistrict.entries()]
    .map(([district, districtTerritories]) => {
      const districtCapacity = districtTerritories.reduce((total, row) => total + row.availableCapacity, 0);
      const districtCurrentAssignedVisits = districtTerritories.reduce((total, row) => total + row.currentAssignedVisits, 0);
      const districtCapacityUtilization = districtCapacity === 0 ? 0 : districtCurrentAssignedVisits / districtCapacity;

      return {
        district,
        territoryCount: districtTerritories.length,
        districtCapacity,
        districtCurrentAssignedVisits,
        districtCapacityGap: districtCapacity - districtCurrentAssignedVisits,
        districtCapacityUtilization,
        overloadedTerritoriesCount: districtTerritories.filter(
          (row) => row.capacityStatus === 'moderately_overloaded' || row.capacityStatus === 'critically_overloaded',
        ).length,
        underutilizedTerritoriesCount: districtTerritories.filter((row) => row.capacityStatus === 'underutilized').length,
      };
    })
    .sort((a, b) => b.districtCapacityUtilization - a.districtCapacityUtilization);
}

export function calculateScenarioTerritoryRows(
  scenarioId: ScenarioId,
  doctorRows: AirScenarioDoctorRow[],
): AirScenarioTerritoryRow[] {
  const byTerritory = new Map<string, AirScenarioDoctorRow[]>();

  for (const row of doctorRows) {
    const existing = byTerritory.get(row.territory) ?? [];
    existing.push(row);
    byTerritory.set(row.territory, existing);
  }

  return [...byTerritory.entries()]
    .map(([territory, rows]) => {
      const currentObjectiveTotal = rows.reduce((total, row) => total + row.currentObjective, 0);
      const scenarioObjectiveTotal = rows.reduce((total, row) => total + row.scenarioObjective, 0);
      const capacityGap = DEFAULT_MONTHLY_VISIT_CAPACITY - scenarioObjectiveTotal;
      const capacityUtilization = scenarioObjectiveTotal / DEFAULT_MONTHLY_VISIT_CAPACITY;

      return {
        scenarioId,
        territory,
        district: rows[0]?.district ?? 'Unassigned district',
        currentObjectiveTotal,
        scenarioObjectiveTotal,
        availableCapacity: DEFAULT_MONTHLY_VISIT_CAPACITY,
        capacityGap,
        capacityUtilization,
        capacityStatus: getCapacityStatus(capacityUtilization),
        doctorsAdded: rows.filter((row) => row.recommendationAction === 'add_to_call_plan').length,
        doctorsIncreased: rows.filter((row) => row.recommendationAction === 'increase_frequency').length,
        doctorsDecreased: rows.filter((row) => row.recommendationAction === 'decrease_frequency').length,
        doctorsRemoved: rows.filter((row) => row.recommendationAction === 'remove_or_deprioritize').length,
      };
    })
    .sort((a, b) => b.capacityUtilization - a.capacityUtilization);
}
