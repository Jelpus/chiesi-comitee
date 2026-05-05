import { scoreDoctorOpportunity } from '@/lib/air/opportunity-engine';
import type {
  AirDoctorRecommendation,
  AirSegmentedDoctor,
  RecommendationAction,
  ScenarioId,
} from '@/lib/air/types';

function baseRecommendedObjective(opportunityScore: number) {
  if (opportunityScore >= 85) return 3;
  if (opportunityScore >= 70) return 2;
  if (opportunityScore >= 50) return 1;
  return 0;
}

function applyBusinessOverrides(doctor: AirSegmentedDoctor, objective: number) {
  if (doctor.matchConfidence === 'unmatched' || doctor.matchConfidence === 'low') {
    return Math.max(0, Math.min(doctor.totalVisitObjective, 2));
  }
  if (doctor.airRelevanceSegment === 'A. Strategic Chiesi Lovers') return Math.max(objective, 1);
  if (doctor.airRelevanceSegment === 'B. High Potential Market Prescribers') return Math.max(objective, 2);
  if (doctor.airRelevanceSegment === 'D. Low Priority') return Math.min(objective, 1);
  return objective;
}

function scenarioObjectiveAdjustment(
  scenarioId: ScenarioId,
  doctor: AirSegmentedDoctor,
  recommendedObjective: number,
) {
  if (scenarioId === 'baseline') return doctor.totalVisitObjective;
  if (scenarioId === 'optimize_private_growth') {
    if (doctor.airRelevanceSegment === 'B. High Potential Market Prescribers') return Math.max(recommendedObjective, 3);
    if (doctor.closeupVisited === false && doctor.marketVolumeSegment.includes('High')) return Math.max(recommendedObjective, 2);
    if (doctor.airRelevanceSegment === 'D. Low Priority') return Math.min(recommendedObjective, 1);
  }
  if (scenarioId === 'defend_chiesi_core') {
    if (doctor.chiesiAffinitySegment === 'Chiesi Lover') return Math.max(recommendedObjective, 2);
    if (doctor.chiesiAffinitySegment === 'Chiesi Friendly') return Math.max(recommendedObjective, 1);
    if (doctor.airRelevanceSegment === 'D. Low Priority') return Math.min(recommendedObjective, 1);
  }
  if (scenarioId === 'deprioritize_low_roi') {
    if (doctor.airRelevanceSegment === 'D. Low Priority') return 0;
    if (doctor.marketVolumeSegment === 'Very Low Market Prescriber') return 0;
    if (doctor.matchConfidence === 'low' || doctor.matchConfidence === 'unmatched') return Math.min(doctor.totalVisitObjective, 1);
  }
  if (scenarioId === 'balanced_redesign') {
    if (doctor.airRelevanceSegment === 'B. High Potential Market Prescribers') return Math.max(recommendedObjective, 2);
    if (doctor.airRelevanceSegment === 'A. Strategic Chiesi Lovers') return Math.max(recommendedObjective, 1);
    if (doctor.airRelevanceSegment === 'D. Low Priority') return Math.min(recommendedObjective, 1);
  }
  return recommendedObjective;
}

export function getRecommendationAction(
  currentObjective: number,
  recommendedObjective: number,
  matchConfidence: string,
): RecommendationAction {
  if (matchConfidence === 'unmatched' || matchConfidence === 'low') return 'review_manually';
  if (currentObjective === 0 && recommendedObjective > 0) return 'add_to_call_plan';
  if (recommendedObjective > currentObjective) return 'increase_frequency';
  if (recommendedObjective === currentObjective) return 'maintain_frequency';
  if (recommendedObjective < currentObjective && recommendedObjective > 0) return 'decrease_frequency';
  return 'remove_or_deprioritize';
}

export function recommendationReason(
  doctor: AirSegmentedDoctor,
  action: RecommendationAction,
) {
  if (action === 'review_manually') return 'Low confidence match. Review manually before changing the visit objective.';
  if (doctor.airRelevanceSegment === 'B. High Potential Market Prescribers') {
    return 'High market prescriber with lower Chiesi affinity. Suggested frequency protects conversion opportunity.';
  }
  if (doctor.closeupVisited === false && doctor.marketVolumeSegment.includes('High')) {
    return 'High market prescriber not identified as visited in CloseUp. Consider prioritizing coverage.';
  }
  if (doctor.airRelevanceSegment === 'A. Strategic Chiesi Lovers') {
    return 'Strong Chiesi affinity with relevant market volume. Maintain or defend current base.';
  }
  if (doctor.airRelevanceSegment === 'D. Low Priority') {
    return 'Lower market volume and lower Chiesi affinity. Potential visits can be reallocated.';
  }
  if (action === 'increase_frequency') return 'Opportunity score is above current visit intensity.';
  if (action === 'decrease_frequency') return 'Recommended objective is below current visit intensity.';
  return 'Suggested objective is aligned with current opportunity and coverage profile.';
}

export function recommendDoctorObjective(
  doctor: AirSegmentedDoctor,
  scenarioId: ScenarioId = 'balanced_redesign',
): AirDoctorRecommendation {
  const opportunity = scoreDoctorOpportunity(doctor);
  const baseObjective = applyBusinessOverrides(doctor, baseRecommendedObjective(opportunity.opportunityScore));
  const recommendedObjective = Math.max(0, Math.min(3, Math.round(scenarioObjectiveAdjustment(scenarioId, doctor, baseObjective))));
  const action = getRecommendationAction(doctor.totalVisitObjective, recommendedObjective, doctor.matchConfidence);

  return {
    ...opportunity,
    recommendedObjective,
    recommendationAction: action,
    recommendationReason: recommendationReason(doctor, action),
  };
}
