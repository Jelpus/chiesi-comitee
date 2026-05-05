const PARTICLES = new Set([
  'de',
  'del',
  'la',
  'las',
  'los',
  'el',
  'y',
  'da',
  'das',
  'do',
  'dos',
]);

const ABBREVIATIONS: Record<string, string> = {
  ma: 'maria',
  m: 'maria',
  j: 'jose',
  jn: 'juan',
};

export type NormalizedName = {
  raw: string;
  normalized: string;
  tokens: string[];
  tokenSet: Set<string>;
};

export function normalizeName(value: string | null | undefined): NormalizedName {
  const raw = (value ?? '').trim();
  const normalized = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = normalized
    .split(' ')
    .map((token) => ABBREVIATIONS[token] ?? token)
    .filter((token) => token.length > 1 && !PARTICLES.has(token));

  return {
    raw,
    normalized: tokens.join(' '),
    tokens,
    tokenSet: new Set(tokens),
  };
}

export function getMatchedTokens(left: Set<string>, right: Set<string>) {
  return [...left].filter((token) => right.has(token)).sort();
}

export function getUnmatchedTokens(left: Set<string>, right: Set<string>) {
  return [...left].filter((token) => !right.has(token)).sort();
}
