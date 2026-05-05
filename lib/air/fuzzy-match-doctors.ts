import { getMatchedTokens, getUnmatchedTokens, normalizeName } from '@/lib/air/normalize-name';
import type { AirCloseupDoctor, AirDoctorMatch, AirDoctorProfile, AirMatchConfidence } from '@/lib/air/types';

function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + substitutionCost,
      );
    }
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
  }

  return previous[b.length];
}

function stringSimilarity(a: string, b: string) {
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 0;
  return 1 - levenshtein(a, b) / maxLength;
}

function tokenSetScore(leftTokens: Set<string>, rightTokens: Set<string>) {
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const precision = intersection / rightTokens.size;
  const recall = intersection / leftTokens.size;
  return precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
}

function tokenSortScore(left: string[], right: string[]) {
  return stringSimilarity([...left].sort().join(' '), [...right].sort().join(' '));
}

function scoreNames(leftName: string, rightName: string) {
  const left = normalizeName(leftName);
  const right = normalizeName(rightName);
  const tokenScore = tokenSetScore(left.tokenSet, right.tokenSet);
  const sortedScore = tokenSortScore(left.tokens, right.tokens);
  const directScore = stringSimilarity(left.normalized, right.normalized);
  const score = tokenScore * 0.6 + sortedScore * 0.3 + directScore * 0.1;

  return {
    score,
    matchedTokens: getMatchedTokens(left.tokenSet, right.tokenSet),
    unmatchedTokens: getUnmatchedTokens(left.tokenSet, right.tokenSet),
    leftTokens: left.tokens,
    rightTokens: right.tokens,
  };
}

function confidenceFromScore(score: number): AirMatchConfidence {
  if (score >= 0.92) return 'high';
  if (score >= 0.82) return 'medium';
  if (score >= 0.7) return 'low';
  return 'unmatched';
}

export function fuzzyMatchDoctors(
  doctors: AirDoctorProfile[],
  closeupDoctors: AirCloseupDoctor[],
): AirDoctorMatch[] {
  const closeupIndex = closeupDoctors.map((doctor, index) => ({
    index,
    doctor,
    normalized: normalizeName(doctor.hcpName),
  }));
  const indexByToken = new Map<string, Set<number>>();

  for (const item of closeupIndex) {
    for (const token of item.normalized.tokenSet) {
      const existing = indexByToken.get(token) ?? new Set<number>();
      existing.add(item.index);
      indexByToken.set(token, existing);
    }
  }

  return doctors.map((doctor) => {
    const normalizedDoctor = normalizeName(doctor.fullName);
    const candidateIndexes = new Set<number>();

    for (const token of normalizedDoctor.tokenSet) {
      const tokenMatches = indexByToken.get(token);
      if (!tokenMatches) continue;
      for (const index of tokenMatches) candidateIndexes.add(index);
    }

    let best:
      | {
          hcpName: string;
          score: number;
          matchedTokens: string[];
          unmatchedTokens: string[];
        }
      | null = null;

    for (const index of candidateIndexes) {
      const candidate = closeupIndex[index];
      const result = scoreNames(doctor.fullName, candidate.doctor.hcpName);
      if (!best || result.score > best.score) {
        best = {
          hcpName: candidate.doctor.hcpName,
          score: result.score,
          matchedTokens: result.matchedTokens,
          unmatchedTokens: result.unmatchedTokens,
        };
      }
    }

    const score = best?.score ?? 0;
    const confidence = confidenceFromScore(score);

    return {
      medicalFileImsId: doctor.imsId,
      medicalFileFullName: doctor.fullName,
      closeupHcpName: confidence === 'unmatched' ? null : best?.hcpName ?? null,
      matchScore: Number(score.toFixed(3)),
      matchMethod: 'hybrid_token_set_token_sort_levenshtein',
      matchConfidence: confidence,
      matchedTokens: best?.matchedTokens ?? [],
      unmatchedTokens: best?.unmatchedTokens ?? normalizedDoctor.tokens,
    };
  });
}
