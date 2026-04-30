import type { EstimatorLine, EstimatorMeta, EstimatorOpts } from './types';

export interface PredicateContext {
  lines: EstimatorLine[];
  opts: EstimatorOpts;
  meta: EstimatorMeta;
}

export type PredicateFn = (ctx: PredicateContext) => number;

const registry = new Map<string, PredicateFn>();

export function registerPredicate(name: string, fn: PredicateFn): void {
  registry.set(name, fn);
}

export function getPredicate(name: string): PredicateFn {
  const fn = registry.get(name);
  if (!fn) throw new Error(`Unknown estimator predicate: ${name}`);
  return fn;
}

// ── Helpers ──

const sumAmount = (
  lines: EstimatorLine[],
  pred: (l: EstimatorLine) => boolean,
): number =>
  lines.reduce((acc, l) => acc + (pred(l) ? Number(l.amount) || 0 : 0), 0);

// ── Built-in predicates ──

/**
 * @deprecated This predicate is superseded by EligibilityContext tier
 * selection. FTTC's ProgramEstimateSpec now declares `tiers` instead of
 * a bonus+predicate, and the estimation kernel selects the rate from
 * qualifying tiers in EligibilityContext. This registration is kept
 * only for backward compatibility when runEstimate is called without
 * an EligibilityContext (e.g. single-program estimate endpoint).
 * Do NOT add new predicates — express rate logic through eligibility
 * calculators and EligibilityContext instead.
 */
registerPredicate('abElevatedRate', (ctx) => {
  const { lines, meta, opts } = ctx;

  const ownership = Number(meta?.provincialOwnershipPercent || 0);
  const hasProducer = Boolean(
    String(meta?.copyright?.holderName || '').trim(),
  );
  const toProvCode = (input?: string): string => {
    const normalized = String(input || '').trim().toUpperCase();
    if (normalized === 'ALBERTA' || normalized === 'AB') return 'AB';
    return normalized;
  };
  const hasCopyrightInAB =
    toProvCode(meta?.copyright?.jurisdiction?.province) === 'AB';

  const totalSpend = sumAmount(lines, () => true);
  const totalLabour = sumAmount(lines, (l) => l.type === 'Labour');
  const spendInAB = sumAmount(lines, (l) => l.province === 'AB');
  const labourInAB = sumAmount(
    lines,
    (l) => l.type === 'Labour' && l.province === 'AB',
  );

  const spendPctAB = totalSpend > 0 ? (spendInAB / totalSpend) * 100 : 0;
  const labourPctAB =
    totalLabour > 0 ? (labourInAB / totalLabour) * 100 : 0;

  const spendShareFromLines =
    totalSpend > 0 && spendInAB > 0 && spendInAB < totalSpend;
  const labourShareFromLines =
    totalLabour > 0 && labourInAB > 0 && labourInAB < totalLabour;

  const controlled =
    ownership >= 50 &&
    hasCopyrightInAB &&
    (hasProducer ||
      (spendShareFromLines && spendPctAB >= 59.5) ||
      (labourShareFromLines && labourPctAB >= 69.5));

  const totalDays = Number(opts?.totalDays || 0);
  const outside = Number(opts?.daysProvincial || 0);
  const distant = Number(opts?.daysDistant || 0);
  const ruralShare =
    totalDays > 0
      ? Math.max(0, Math.min(1, (outside + distant) / totalDays))
      : 0;
  const rural = ruralShare >= 0.75;

  return controlled || rural ? 1 : 0;
});
