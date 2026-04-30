/**
 * Unified Grinding Engine (Phase 3)
 *
 * Replaces the ad-hoc linear loop in the strategy service with a
 * DAG-aware evaluation pipeline:
 *
 *   1. Build a grind subgraph for the programs in the scenario.
 *   2. Topologically sort them (Kahn's algorithm, tier-based tiebreak).
 *   3. Evaluate in order, recording each program's credit into a
 *      PriorAssistanceLedger so downstream programs see the correct
 *      accumulated assistance.
 *   4. Produce a structured trace of ledger evolution at every step.
 *
 * The engine is a pure async function — it receives a re-estimation
 * callback instead of depending on any NestJS service directly.
 */

import type { AssistanceContext, GrindCondition } from '@storyos/types';
import { PROGRAM_CONFIGS, getProgramTier } from './program-config';

// ────────────────────────────────────────────────────────────────────
// Public types
// ────────────────────────────────────────────────────────────────────

/** Callback the engine uses to re-estimate a program with grinding applied. */
export type ReEstimateFn = (
  programCode: string,
  priorAssistance: { total: number; labour: number; nonLabour: number },
  labourMultiplier?: number,
  assistanceContext?: AssistanceContext,
) => Promise<{
  amount: number;
  available: boolean;
  breakdown?: Record<string, unknown>;
}>;

export interface GrindInput {
  /** Programs in this scenario with their raw (un-ground) estimates. */
  programs: Array<{
    programCode: string;
    amount: number;
    available: boolean;
    breakdown?: Record<string, unknown>;
  }>;
  /** Callback to re-estimate a program when prior assistance or multiplier is present. */
  reEstimate: ReEstimateFn;
  /** Optional labour multiplier for sensitivity analysis. */
  labourMultiplier?: number;
  /**
   * Classified funding-source context for the project. When present it is
   * forwarded to every re-estimation call so the kernel can apply direct
   * (non-credit) assistance deductions.
   */
  assistanceContext?: AssistanceContext;
  /**
   * Province → eligible base amount ($). Used to evaluate `jurisdictionOverlap`
   * conditions with material-spend thresholds. When absent, conditional edges
   * are treated as not-applicable (safe default).
   */
  spendByProvince?: Map<string, number>;
}

export interface GroundProgramResult {
  programCode: string;
  rawAmount: number;
  groundAmount: number;
  available: boolean;
  breakdown?: Record<string, unknown>;
  priorAssistance: {
    total: number;
    labour: number;
    nonLabour: number;
    sources: Array<{ programCode: string; amount: number; reason: string }>;
  };
}

export interface GrindTraceEntry {
  step: number;
  programCode: string;
  rawAmount: number;
  groundAmount: number;
  priorAssistance: { total: number; labour: number; nonLabour: number };
  /** Snapshot of accumulated assistance queued for each target after this step. */
  ledgerState: Record<string, { total: number; labour: number; nonLabour: number }>;
}

export interface GrindResult {
  /** Programs in topological (evaluation) order. */
  evaluationOrder: string[];
  programs: GroundProgramResult[];
  totalAmount: number;
  trace: GrindTraceEntry[];
}

// ────────────────────────────────────────────────────────────────────
// Prior-assistance ledger
// ────────────────────────────────────────────────────────────────────

interface LedgerEntry {
  total: number;
  labour: number;
  nonLabour: number;
  sources: Array<{ programCode: string; amount: number; reason: string }>;
}

class PriorAssistanceLedger {
  private readonly entries = new Map<string, LedgerEntry>();

  /**
   * Record a grind contribution: `sourceCode`'s credit reduces
   * `targetCode`'s base by `sourceAmount * rate` in the given bucket.
   */
  record(
    sourceCode: string,
    sourceAmount: number,
    target: { targetProgramCode: string; appliesTo: 'total' | 'labour' | 'nonLabour'; rate: number; reason: string },
  ): void {
    const amount = Math.max(0, sourceAmount * target.rate);
    if (amount <= 0) return;

    let entry = this.entries.get(target.targetProgramCode);
    if (!entry) {
      entry = { total: 0, labour: 0, nonLabour: 0, sources: [] };
      this.entries.set(target.targetProgramCode, entry);
    }

    entry[target.appliesTo] += amount;
    entry.sources.push({
      programCode: sourceCode,
      amount,
      reason: target.reason,
    });
  }

  getForTarget(targetCode: string): LedgerEntry {
    return (
      this.entries.get(targetCode) ?? {
        total: 0,
        labour: 0,
        nonLabour: 0,
        sources: [],
      }
    );
  }

  snapshot(): Record<string, { total: number; labour: number; nonLabour: number }> {
    const snap: Record<string, { total: number; labour: number; nonLabour: number }> = {};
    for (const [code, entry] of this.entries) {
      snap[code] = { total: entry.total, labour: entry.labour, nonLabour: entry.nonLabour };
    }
    return snap;
  }
}

// ────────────────────────────────────────────────────────────────────
// Topological sort (Kahn's algorithm with tier tiebreak)
// ────────────────────────────────────────────────────────────────────

/**
 * Return `programCodes` in topological order with respect to the
 * grind DAG restricted to the given set. Among nodes at the same
 * topological level, lower tiers evaluate first; ties within a tier
 * are broken alphabetically for determinism.
 *
 * Throws if a cycle exists (should never happen if the boot-time
 * validator in program-config.ts passed).
 */
/**
 * Topological sort uses ALL declared edges (ignoring conditions) to ensure
 * a stable, deterministic ordering regardless of scenario-specific spend data.
 * Conditions only gate the ledger recording, not the ordering.
 */
export function grindTopoSort(programCodes: string[]): string[] {
  const codeSet = new Set(programCodes);

  // Build adjacency list (source → targets) and in-degree map
  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  for (const code of programCodes) {
    adj.set(code, []);
    inDegree.set(code, 0);
  }

  for (const code of programCodes) {
    const config = PROGRAM_CONFIGS.get(code);
    if (!config) continue;
    for (const edge of config.grinds) {
      if (codeSet.has(edge.targetProgramCode)) {
        adj.get(code)!.push(edge.targetProgramCode);
        inDegree.set(
          edge.targetProgramCode,
          (inDegree.get(edge.targetProgramCode) ?? 0) + 1,
        );
      }
    }
  }

  // Seed the queue with zero-in-degree nodes, sorted by tier then name
  const queue: string[] = programCodes
    .filter((c) => (inDegree.get(c) ?? 0) === 0)
    .sort(byTierThenName);

  const result: string[] = [];

  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);

    for (const target of adj.get(node) ?? []) {
      const newDeg = (inDegree.get(target) ?? 1) - 1;
      inDegree.set(target, newDeg);
      if (newDeg === 0) {
        insertSorted(queue, target, byTierThenName);
      }
    }
  }

  if (result.length !== programCodes.length) {
    const stuck = programCodes.filter((c) => !result.includes(c));
    throw new Error(
      `Cycle in grind DAG — cannot evaluate: ${stuck.join(', ')}`,
    );
  }

  return result;
}

function byTierThenName(a: string, b: string): number {
  const tierDiff = getProgramTier(a) - getProgramTier(b);
  return tierDiff !== 0 ? tierDiff : a.localeCompare(b);
}

/** Insert `value` into an already-sorted array, preserving order. */
function insertSorted(
  arr: string[],
  value: string,
  cmp: (a: string, b: string) => number,
): void {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const existing = arr[mid]!; // safe: mid is always within bounds
    if (cmp(existing, value) <= 0) lo = mid + 1;
    else hi = mid;
  }
  arr.splice(lo, 0, value);
}

// ────────────────────────────────────────────────────────────────────
// Grind condition evaluator
// ────────────────────────────────────────────────────────────────────

function evaluateGrindCondition(
  condition: GrindCondition | undefined,
  spendByProvince: Map<string, number> | undefined,
): boolean {
  if (!condition || condition.type === 'always') return true;

  if (condition.type === 'jurisdictionOverlap') {
    if (!spendByProvince || spendByProvince.size === 0) return false;
    const threshold = condition.minBaseAmount ?? 0;
    return condition.requires.every((p) => (spendByProvince.get(p) ?? 0) > threshold);
  }

  return true;
}

// ────────────────────────────────────────────────────────────────────
// Main entry point
// ────────────────────────────────────────────────────────────────────

/**
 * Evaluate a scenario's programs with correct grinding applied.
 *
 * 1. Topologically sorts programs by grind dependencies.
 * 2. Evaluates each program in order; uses the re-estimate callback
 *    when prior assistance or a labour multiplier is present.
 * 3. Records each evaluated program's credit into the ledger so
 *    downstream programs see the correct accumulated assistance.
 * 4. Produces a structured trace of every step.
 */
export async function evaluateWithGrinding(
  input: GrindInput,
): Promise<GrindResult> {
  const programCodes = input.programs.map((p) => p.programCode);
  const rawMap = new Map(
    input.programs.map((p) => [p.programCode, p]),
  );

  const order = grindTopoSort(programCodes);
  const ledger = new PriorAssistanceLedger();

  const results: GroundProgramResult[] = [];
  const trace: GrindTraceEntry[] = [];

  let step = 0;
  for (const code of order) {
    const raw = rawMap.get(code)!;
    const prior = ledger.getForTarget(code);

    let groundAmount = raw.amount;
    let breakdown = raw.breakdown;
    let available = raw.available;

    const needsReEstimate =
      input.assistanceContext !== undefined ||
      input.labourMultiplier !== undefined ||
      prior.total > 0 ||
      prior.labour > 0 ||
      prior.nonLabour > 0;

    if (needsReEstimate) {
      const estimate = await input.reEstimate(
        code,
        { total: prior.total, labour: prior.labour, nonLabour: prior.nonLabour },
        input.labourMultiplier,
        input.assistanceContext,
      );
      if (estimate.available) {
        groundAmount = estimate.amount;
        breakdown = estimate.breakdown;
        available = estimate.available;
      }
    }

    // Record this program's ground credit as grind contributions
    const config = PROGRAM_CONFIGS.get(code);
    if (config && available) {
      for (const edge of config.grinds) {
        if (rawMap.has(edge.targetProgramCode) &&
            evaluateGrindCondition(edge.condition, input.spendByProvince)) {
          ledger.record(code, groundAmount, edge);
        }
      }
    }

    results.push({
      programCode: code,
      rawAmount: raw.amount,
      groundAmount,
      available,
      breakdown,
      priorAssistance: {
        total: prior.total,
        labour: prior.labour,
        nonLabour: prior.nonLabour,
        sources: [...prior.sources],
      },
    });

    trace.push({
      step,
      programCode: code,
      rawAmount: raw.amount,
      groundAmount,
      priorAssistance: {
        total: prior.total,
        labour: prior.labour,
        nonLabour: prior.nonLabour,
      },
      ledgerState: ledger.snapshot(),
    });

    step++;
  }

  const totalAmount = results.reduce((sum, p) => sum + p.groundAmount, 0);

  return { evaluationOrder: order, programs: results, totalAmount, trace };
}
