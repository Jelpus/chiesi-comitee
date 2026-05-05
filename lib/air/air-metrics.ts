import { normalizeName } from '@/lib/air/normalize-name';
import type {
  AirCallPlanMetrics,
  AirDistrictSummary,
  AirDoctorProfile,
  AirMedicalFileRow,
  AirTerritorySummary,
} from '@/lib/air/types';

function cleanKey(value: string | null | undefined, fallback: string) {
  const trimmed = (value ?? '').trim();
  return trimmed || fallback;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function avg(total: number, count: number) {
  return count === 0 ? 0 : total / count;
}

function round(value: number) {
  return Number(value.toFixed(1));
}

function getDoctorKey(row: AirMedicalFileRow) {
  const ims = cleanKey(row.imsId, '');
  if (ims) return ims;
  const name = normalizeName(row.fullName).normalized;
  return name ? `name:${name}` : `row:${row.territory}:${row.fullName}`;
}

export function calculateAirCallPlanMetrics(rows: AirMedicalFileRow[]): AirCallPlanMetrics {
  const issues: string[] = [];
  const doctorMap = new Map<string, AirDoctorProfile>();
  const territoryRows = new Map<string, AirMedicalFileRow[]>();
  const districtRows = new Map<string, AirMedicalFileRow[]>();
  const nameSet = new Set<string>();

  for (const row of rows) {
    if (!row.imsId) issues.push('Some AIR medical file rows are missing IMS ID.');
    if (!row.fullName) issues.push('Some AIR medical file rows are missing physician name.');

    const doctorKey = getDoctorKey(row);
    const fullName = cleanKey(row.fullName, 'Unnamed physician');
    const imsId = cleanKey(row.imsId, doctorKey);
    const territory = cleanKey(row.territory, 'Unassigned territory');
    const district = cleanKey(row.district, 'Unassigned district');
    const objetivo = Number.isFinite(row.objetivo) ? row.objetivo : 0;
    const normalizedName = normalizeName(fullName).normalized;
    if (normalizedName) nameSet.add(normalizedName);

    const doctor = doctorMap.get(doctorKey) ?? {
      imsId,
      fullName,
      territories: [],
      districts: [],
      territoriesCount: 0,
      districtsCount: 0,
      totalVisitObjective: 0,
      medicalFileRows: 0,
      isSharedBetweenTerritories: false,
    };

    doctor.medicalFileRows += 1;
    doctor.totalVisitObjective += objetivo;
    if (!doctor.territories.includes(territory)) doctor.territories.push(territory);
    if (!doctor.districts.includes(district)) doctor.districts.push(district);
    doctor.territoriesCount = doctor.territories.length;
    doctor.districtsCount = doctor.districts.length;
    doctor.isSharedBetweenTerritories = doctor.territoriesCount > 1;
    doctorMap.set(doctorKey, doctor);

    const rowsForTerritory = territoryRows.get(territory) ?? [];
    rowsForTerritory.push(row);
    territoryRows.set(territory, rowsForTerritory);

    const rowsForDistrict = districtRows.get(district) ?? [];
    rowsForDistrict.push(row);
    districtRows.set(district, rowsForDistrict);
  }

  const doctors = [...doctorMap.values()].sort((a, b) => b.totalVisitObjective - a.totalVisitObjective);
  const totalVisitObjective = sum(rows.map((row) => row.objetivo));
  const sharedPhysiciansCount = doctors.filter((doctor) => doctor.isSharedBetweenTerritories).length;
  const uniqueTerritories = territoryRows.size;

  const territories: AirTerritorySummary[] = [...territoryRows.entries()]
    .map(([territory, territoryMedicalRows]) => {
      const doctorKeys = new Set(territoryMedicalRows.map(getDoctorKey));
      const territoryDoctors = doctors.filter((doctor) => doctor.territories.includes(territory));
      const district = cleanKey(territoryMedicalRows[0]?.district, 'Unassigned district');
      const objective = sum(territoryMedicalRows.map((row) => row.objetivo));

      return {
        territory,
        district,
        uniqueImsIds: doctorKeys.size,
        medicalFileRows: territoryMedicalRows.length,
        totalVisitObjective: objective,
        avgObjectivePerPhysician: round(avg(objective, doctorKeys.size)),
        sharedPhysiciansCount: territoryDoctors.filter((doctor) => doctor.isSharedBetweenTerritories).length,
      };
    })
    .sort((a, b) => b.totalVisitObjective - a.totalVisitObjective);

  const districts: AirDistrictSummary[] = [...districtRows.entries()]
    .map(([district, districtMedicalRows]) => {
      const districtTerritories = new Set(districtMedicalRows.map((row) => cleanKey(row.territory, 'Unassigned territory')));
      const doctorKeys = new Set(districtMedicalRows.map(getDoctorKey));
      const objective = sum(districtMedicalRows.map((row) => row.objetivo));
      const districtDoctors = doctors.filter((doctor) => doctor.districts.includes(district));

      return {
        district,
        territoryCount: districtTerritories.size,
        uniqueImsIds: doctorKeys.size,
        medicalFileRows: districtMedicalRows.length,
        totalVisitObjective: objective,
        avgObjectivePerPhysician: round(avg(objective, doctorKeys.size)),
        avgPhysiciansPerTerritory: round(avg(doctorKeys.size, districtTerritories.size)),
        sharedPhysiciansCount: districtDoctors.filter((doctor) => doctor.isSharedBetweenTerritories).length,
      };
    })
    .sort((a, b) => b.totalVisitObjective - a.totalVisitObjective);

  return {
    global: {
      totalRows: rows.length,
      uniqueImsIds: doctors.length,
      uniquePhysiciansByName: nameSet.size,
      uniqueTerritories,
      uniqueDistricts: districtRows.size,
      totalVisitObjective,
      avgObjectivePerPhysician: round(avg(totalVisitObjective, doctors.length)),
      avgPhysiciansPerTerritory: round(avg(doctors.length, uniqueTerritories)),
      avgObjectivePerTerritory: round(avg(totalVisitObjective, uniqueTerritories)),
      sharedPhysiciansCount,
      sharedPhysiciansPercentage: doctors.length === 0 ? 0 : Number(((sharedPhysiciansCount / doctors.length) * 100).toFixed(1)),
    },
    districts,
    territories,
    doctors,
    issues: [...new Set(issues)],
  };
}
