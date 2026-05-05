import type {
  AirCloseupDoctor,
  AirDoctorMatch,
  AirDoctorProfile,
  AirSegmentedDoctor,
  AirSegmentationMatrixCell,
} from '@/lib/air/types';

const MARKET_SEGMENTS = [
  'Very High Market Prescriber',
  'High Market Prescriber',
  'Medium Market Prescriber',
  'Low Market Prescriber',
  'Very Low Market Prescriber',
];

const AFFINITY_SEGMENTS = [
  'Chiesi Lover',
  'Chiesi Friendly',
  'Neutral',
  'Low Chiesi Affinity',
  'No / Minimal Chiesi Affinity',
];

function percentileThreshold(values: number[], percentile: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1));
  return sorted[index];
}

function marketSegment(value: number, thresholds: { p20: number; p40: number; p60: number; p80: number }) {
  if (value >= thresholds.p80) return MARKET_SEGMENTS[0];
  if (value >= thresholds.p60) return MARKET_SEGMENTS[1];
  if (value >= thresholds.p40) return MARKET_SEGMENTS[2];
  if (value >= thresholds.p20) return MARKET_SEGMENTS[3];
  return MARKET_SEGMENTS[4];
}

function affinitySegment(share: number) {
  if (share >= 0.6) return AFFINITY_SEGMENTS[0];
  if (share >= 0.35) return AFFINITY_SEGMENTS[1];
  if (share >= 0.15) return AFFINITY_SEGMENTS[2];
  if (share > 0.02) return AFFINITY_SEGMENTS[3];
  return AFFINITY_SEGMENTS[4];
}

function relevanceSegment(market: string, affinity: string, matchConfidence: string) {
  if (matchConfidence === 'unmatched' || matchConfidence === 'low') return 'E. Review / Unmatched';
  if (
    ['Very High Market Prescriber', 'High Market Prescriber'].includes(market) &&
    ['Chiesi Lover', 'Chiesi Friendly'].includes(affinity)
  ) {
    return 'A. Strategic Chiesi Lovers';
  }
  if (
    ['Very High Market Prescriber', 'High Market Prescriber'].includes(market) &&
    ['Low Chiesi Affinity', 'No / Minimal Chiesi Affinity'].includes(affinity)
  ) {
    return 'B. High Potential Market Prescribers';
  }
  if (
    ['Medium Market Prescriber', 'Low Market Prescriber'].includes(market) &&
    ['Chiesi Lover', 'Chiesi Friendly', 'Neutral'].includes(affinity)
  ) {
    return 'C. Maintain / Defend';
  }
  return 'D. Low Priority';
}

function aggregateCloseupByName(closeupDoctors: AirCloseupDoctor[]) {
  const byName = new Map<string, AirCloseupDoctor>();

  for (const doctor of closeupDoctors) {
    const existing = byName.get(doctor.hcpName);
    if (!existing) {
      byName.set(doctor.hcpName, { ...doctor });
      continue;
    }

    const marketRxMat = existing.marketRxMat + doctor.marketRxMat;
    const chiesiRxMat = existing.chiesiRxMat + doctor.chiesiRxMat;
    byName.set(doctor.hcpName, {
      hcpName: doctor.hcpName,
      marketGroup: existing.marketGroup === doctor.marketGroup ? existing.marketGroup : 'All markets',
      visited: Boolean(existing.visited || doctor.visited),
      marketRxMat,
      chiesiRxMat,
      chiesiShareMat: marketRxMat > 0 ? chiesiRxMat / marketRxMat : 0,
    });
  }

  return byName;
}

export function segmentDoctors(
  doctors: AirDoctorProfile[],
  matches: AirDoctorMatch[],
  closeupDoctors: AirCloseupDoctor[],
) {
  const matchByIms = new Map(matches.map((match) => [match.medicalFileImsId, match]));
  const closeupByName = aggregateCloseupByName(closeupDoctors);
  const matchedCloseup = matches
    .map((match) => (match.closeupHcpName ? closeupByName.get(match.closeupHcpName) : null))
    .filter((doctor): doctor is AirCloseupDoctor => Boolean(doctor));
  const marketValues = matchedCloseup.map((doctor) => doctor.marketRxMat).filter((value) => value > 0);
  const thresholds = {
    p20: percentileThreshold(marketValues, 20),
    p40: percentileThreshold(marketValues, 40),
    p60: percentileThreshold(marketValues, 60),
    p80: percentileThreshold(marketValues, 80),
  };

  const segmentedDoctors: AirSegmentedDoctor[] = doctors.map((doctor) => {
    const match = matchByIms.get(doctor.imsId);
    const closeup = match?.closeupHcpName ? closeupByName.get(match.closeupHcpName) : null;
    const marketRxMat = closeup?.marketRxMat ?? 0;
    const chiesiRxMat = closeup?.chiesiRxMat ?? 0;
    const chiesiShareMat = closeup?.chiesiShareMat ?? 0;
    const closeupVisited = closeup?.visited ?? null;
    const marketVolumeSegment = closeup ? marketSegment(marketRxMat, thresholds) : 'Unmatched';
    const chiesiAffinitySegment = closeup ? affinitySegment(chiesiShareMat) : 'Unmatched';

    return {
      ...doctor,
      closeupHcpName: match?.closeupHcpName ?? null,
      matchScore: match?.matchScore ?? 0,
      matchConfidence: match?.matchConfidence ?? 'unmatched',
      matchedTokens: match?.matchedTokens ?? [],
      unmatchedTokens: match?.unmatchedTokens ?? [],
      marketRxMat,
      chiesiRxMat,
      chiesiShareMat,
      closeupVisited,
      marketVolumeSegment,
      chiesiAffinitySegment,
      airRelevanceSegment: relevanceSegment(marketVolumeSegment, chiesiAffinitySegment, match?.matchConfidence ?? 'unmatched'),
    };
  });

  const matrix: AirSegmentationMatrixCell[] = [];
  for (const market of MARKET_SEGMENTS) {
    for (const affinity of AFFINITY_SEGMENTS) {
      matrix.push({
        marketVolumeSegment: market,
        chiesiAffinitySegment: affinity,
        doctorCount: segmentedDoctors.filter(
          (doctor) => doctor.marketVolumeSegment === market && doctor.chiesiAffinitySegment === affinity,
        ).length,
      });
    }
  }

  return { segmentedDoctors, matrix };
}

export const airMarketSegments = MARKET_SEGMENTS;
export const airAffinitySegments = AFFINITY_SEGMENTS;
