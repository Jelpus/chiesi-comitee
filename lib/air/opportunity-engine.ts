import type { AirDoctorOpportunity, AirMatchConfidence, AirSegmentedDoctor } from '@/lib/air/types';

export const OPPORTUNITY_SCORE_WEIGHTS = {
  marketVolume: 0.35,
  conversionPotential: 0.25,
  chiesiAffinity: 0.15,
  visitedGap: 0.1,
  strategicPriority: 0.1,
  matchConfidence: 0.05,
};

const marketVolumeScoreBySegment: Record<string, number> = {
  'Very High Market Prescriber': 100,
  'High Market Prescriber': 80,
  'Medium Market Prescriber': 60,
  'Low Market Prescriber': 35,
  'Very Low Market Prescriber': 15,
  Unmatched: 0,
};

const chiesiAffinityScoreBySegment: Record<string, number> = {
  'Chiesi Lover': 100,
  'Chiesi Friendly': 80,
  Neutral: 55,
  'Low Chiesi Affinity': 30,
  'No / Minimal Chiesi Affinity': 10,
  Unmatched: 0,
};

const matchConfidenceScoreByConfidence: Record<AirMatchConfidence, number> = {
  high: 100,
  medium: 70,
  low: 35,
  unmatched: 0,
};

function isHighMarket(segment: string) {
  return segment === 'Very High Market Prescriber' || segment === 'High Market Prescriber';
}

function isMediumMarket(segment: string) {
  return segment === 'Medium Market Prescriber';
}

function conversionPotentialScore(marketSegment: string, affinitySegment: string) {
  if (isHighMarket(marketSegment) && affinitySegment === 'Low Chiesi Affinity') return 100;
  if (isHighMarket(marketSegment) && affinitySegment === 'No / Minimal Chiesi Affinity') return 95;
  if (isHighMarket(marketSegment) && affinitySegment === 'Neutral') return 80;
  if (isMediumMarket(marketSegment) && affinitySegment === 'Low Chiesi Affinity') return 60;
  if (isMediumMarket(marketSegment) && affinitySegment === 'Neutral') return 55;
  if (affinitySegment === 'Chiesi Lover') return 30;
  if (affinitySegment === 'Chiesi Friendly') return 45;
  if (marketSegment === 'Low Market Prescriber') return 20;
  if (marketSegment === 'Very Low Market Prescriber') return 10;
  return 0;
}

function visitedGapScore(marketSegment: string, visited: boolean | null) {
  if (visited == null || marketSegment === 'Unmatched') return 0;
  if (isHighMarket(marketSegment) && visited === false) return 100;
  if (isHighMarket(marketSegment) && visited === true) return 60;
  if (isMediumMarket(marketSegment) && visited === false) return 70;
  if (isMediumMarket(marketSegment) && visited === true) return 45;
  if ((marketSegment === 'Low Market Prescriber' || marketSegment === 'Very Low Market Prescriber') && visited === true) return 20;
  return visited === false ? 35 : 25;
}

function strategicPriorityScore(_doctor: AirSegmentedDoctor) {
  return 50;
}

export function scoreDoctorOpportunity(doctor: AirSegmentedDoctor): AirDoctorOpportunity {
  const marketVolumeScore = marketVolumeScoreBySegment[doctor.marketVolumeSegment] ?? 0;
  const chiesiAffinityScore = chiesiAffinityScoreBySegment[doctor.chiesiAffinitySegment] ?? 0;
  const conversionScore = conversionPotentialScore(doctor.marketVolumeSegment, doctor.chiesiAffinitySegment);
  const gapScore = visitedGapScore(doctor.marketVolumeSegment, doctor.closeupVisited);
  const priorityScore = strategicPriorityScore(doctor);
  const confidenceScore = matchConfidenceScoreByConfidence[doctor.matchConfidence] ?? 0;

  const opportunityScore =
    marketVolumeScore * OPPORTUNITY_SCORE_WEIGHTS.marketVolume +
    conversionScore * OPPORTUNITY_SCORE_WEIGHTS.conversionPotential +
    chiesiAffinityScore * OPPORTUNITY_SCORE_WEIGHTS.chiesiAffinity +
    gapScore * OPPORTUNITY_SCORE_WEIGHTS.visitedGap +
    priorityScore * OPPORTUNITY_SCORE_WEIGHTS.strategicPriority +
    confidenceScore * OPPORTUNITY_SCORE_WEIGHTS.matchConfidence;

  return {
    imsId: doctor.imsId,
    opportunityScore: Number(opportunityScore.toFixed(1)),
    marketVolumeScore,
    conversionPotentialScore: conversionScore,
    chiesiAffinityScore,
    visitedGapScore: gapScore,
    strategicPriorityScore: priorityScore,
    matchConfidenceScore: confidenceScore,
  };
}

export function scoreDoctorOpportunities(doctors: AirSegmentedDoctor[]) {
  return doctors.map(scoreDoctorOpportunity);
}
