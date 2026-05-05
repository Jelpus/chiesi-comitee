import { CheckCircle2, Map, Network, Stethoscope, Target, Users } from 'lucide-react';
import { formatNumber } from '@/components/air/air-format';
import type { AirCallPlanMetrics, AirDoctorMatch } from '@/lib/air/types';

type Props = {
  callPlan: AirCallPlanMetrics;
  matches: AirDoctorMatch[];
};

const iconByLabel = {
  physicians: Stethoscope,
  ims: Users,
  territories: Map,
  districts: Network,
  objective: Target,
  shared: Users,
  matched: CheckCircle2,
  high: CheckCircle2,
};

export function AirOverviewCards({ callPlan, matches }: Props) {
  const matched = matches.filter((match) => match.matchConfidence !== 'unmatched').length;
  const high = matches.filter((match) => match.matchConfidence === 'high').length;
  const cards = [
    { key: 'physicians', label: 'AIR physicians', value: callPlan.global.uniquePhysiciansByName },
    { key: 'ims', label: 'Unique IMS IDs', value: callPlan.global.uniqueImsIds },
    { key: 'territories', label: 'Territories', value: callPlan.global.uniqueTerritories },
    { key: 'districts', label: 'Districts', value: callPlan.global.uniqueDistricts },
    { key: 'objective', label: 'Total visit objective', value: callPlan.global.totalVisitObjective },
    { key: 'shared', label: 'Shared physicians', value: callPlan.global.sharedPhysiciansCount },
    { key: 'matched', label: 'Matched with CloseUp', value: matched },
    { key: 'high', label: 'High-confidence matches', value: high },
  ] as const;

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = iconByLabel[card.key];
        return (
          <div key={card.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{card.label}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{formatNumber(card.value, 1)}</p>
              </div>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-sky-50 text-sky-700">
                <Icon className="h-4.5 w-4.5" />
              </span>
            </div>
          </div>
        );
      })}
    </section>
  );
}
