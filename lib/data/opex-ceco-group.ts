export const OPEX_CECO_GROUP_SEED: Array<{ cecoName: string; cecoNameGroup: string }> = [
  { cecoName: 'S&A', cecoNameGroup: 'MACO' },
  { cecoName: 'Market Access', cecoNameGroup: 'MACO' },
  { cecoName: 'Market Access PC', cecoNameGroup: 'MACO' },
  { cecoName: 'Market Access SC', cecoNameGroup: 'MACO' },
  { cecoName: 'Market Access RD', cecoNameGroup: 'MACO' },
  { cecoName: 'MACO', cecoNameGroup: 'MACO' },
  { cecoName: 'FF PC', cecoNameGroup: 'Primary Care' },
  { cecoName: 'FF VAC PC', cecoNameGroup: 'Primary Care' },
  { cecoName: 'Mkt PC', cecoNameGroup: 'Primary Care' },
  { cecoName: 'Promo-Nexthaler', cecoNameGroup: 'Primary Care' },
  { cecoName: 'Promo-Innovair', cecoNameGroup: 'Primary Care' },
  { cecoName: 'Promo-Rinoclenil', cecoNameGroup: 'Primary Care' },
  { cecoName: 'Promo-Ribuspir', cecoNameGroup: 'Primary Care' },
  { cecoName: 'Promo-Trimbow', cecoNameGroup: 'Primary Care' },
  { cecoName: 'Primary Care', cecoNameGroup: 'Primary Care' },
  { cecoName: 'FF SC', cecoNameGroup: 'Special Care' },
  { cecoName: 'FF VAC SC', cecoNameGroup: 'Special Care' },
  { cecoName: 'Mkt SC', cecoNameGroup: 'Special Care' },
  { cecoName: 'Mkt CC', cecoNameGroup: 'Special Care' },
  { cecoName: 'Promo-Curosurf', cecoNameGroup: 'Special Care' },
  { cecoName: 'Promo-Lexicomp', cecoNameGroup: 'Special Care' },
  { cecoName: 'Promo-Peyona', cecoNameGroup: 'Special Care' },
  { cecoName: 'Special Care', cecoNameGroup: 'Special Care' },
  { cecoName: 'FF RD', cecoNameGroup: 'Rare' },
  { cecoName: 'Mkt RD', cecoNameGroup: 'Rare' },
  { cecoName: 'Promo-Lamzede', cecoNameGroup: 'Rare' },
  { cecoName: 'Rare', cecoNameGroup: 'Rare' },
  { cecoName: 'Business Knowledge', cecoNameGroup: 'BECX' },
  { cecoName: 'Business KnowledgePC', cecoNameGroup: 'BECX' },
  { cecoName: 'Business KnowledgeSC', cecoNameGroup: 'BECX' },
  { cecoName: 'Business KnowledgeRD', cecoNameGroup: 'BECX' },
  { cecoName: 'BECX', cecoNameGroup: 'BECX' },
  { cecoName: 'Medical Affairs', cecoNameGroup: 'MSL' },
  { cecoName: 'Medical SC', cecoNameGroup: 'MSL' },
  { cecoName: 'Medical PC', cecoNameGroup: 'MSL' },
  { cecoName: 'Medical Affairs RD', cecoNameGroup: 'MSL' },
  { cecoName: 'MSL', cecoNameGroup: 'MSL' },
  { cecoName: 'R&D', cecoNameGroup: 'Regulatory' },
  { cecoName: 'R&D Rare Disease', cecoNameGroup: 'Regulatory' },
  { cecoName: 'R&D IC', cecoNameGroup: 'Regulatory' },
  { cecoName: 'Regulatory', cecoNameGroup: 'Regulatory' },
  { cecoName: 'General Management', cecoNameGroup: 'General Management' },
  { cecoName: 'Fin Mng&Controlling', cecoNameGroup: 'Finance' },
  { cecoName: 'Accounting', cecoNameGroup: 'Finance' },
  { cecoName: 'General Services', cecoNameGroup: 'Finance' },
  { cecoName: 'Procurement', cecoNameGroup: 'Finance' },
  { cecoName: 'Finance', cecoNameGroup: 'Finance' },
  { cecoName: 'Logistic', cecoNameGroup: 'Logistic' },
  { cecoName: 'Human Resoures', cecoNameGroup: 'Human Resoures' },
  { cecoName: 'Legal and Compliance', cecoNameGroup: 'Legal and Compliance' },
  { cecoName: 'IT', cecoNameGroup: 'IT' },
];

function normalize(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

const mapping = new Map<string, string>(
  OPEX_CECO_GROUP_SEED.map((item) => [normalize(item.cecoName), item.cecoNameGroup]),
);

export function resolveOpexCecoNameGroup(cecoName: string | null | undefined) {
  const key = normalize(cecoName);
  if (!key) return 'Ungrouped';
  return mapping.get(key) ?? 'Ungrouped';
}
