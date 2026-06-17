import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@storyos/database';
import { BudgetVersionStatus, ControlType, FinanceSourceStatus } from '@storyos/types';
import type { AssistanceContext, AssistanceLine, EligibilityContext } from '@storyos/types';

import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.context';
import { TenantAwareService } from '../tenant/tenant-aware.service';

import {
  runEstimate,
  PROGRAM_SPECS,
  type EstimatorLine,
  type EstimatorMeta,
  type EstimatorOpts,
  type EstimatorPriorAssistance,
} from './estimators';
import type {
  EstimateGrantDto,
  GrantEstimateMetaOverridesDto,
  GrantEstimateOptsOverridesDto,
  GrantEstimateSource,
  SupportedProvinceCode,
} from './dto/estimate-grant.dto';
import { SUPPORTED_PROVINCES } from './dto/estimate-grant.dto';

// ──────────────────────────────────────────
// Public response types
// ──────────────────────────────────────────

export interface GrantEstimate {
  programCode: string;
  estimatedAmount: number;
  breakdown?: Record<string, unknown>;
}

export interface GrantEstimateResponse {
  projectId: string;
  province: SupportedProvinceCode;
  source: GrantEstimateSource;
  budgetVersionId: string | null;
  totalEstimatedAmount: number;
  estimates: GrantEstimate[];
  /** Adapter inputs surfaced for transparency / debugging. */
  inputs: {
    lineCount: number;
    totalDays: number;
    daysProvincial: number;
    daysDistant: number;
    provincialOwnershipPercent: number;
    copyright: {
      holderName: string | null;
      country: string | null;
      province: string | null;
    };
  };
}

// ──────────────────────────────────────────
// Region-code heuristics
// Maps Location.incentiveRegionCode strings to estimator day buckets.
// Estimators expect three values: totalDays, daysProvincial, daysDistant.
// `provincial` here means in-province but in a regional/outside-metro zone
// (the calculators interpret it as "outside-GTA" / "regional" / "rural").
// `distant` means a remote / distant / northern designation.
// ──────────────────────────────────────────

const PROVINCIAL_REGION_HINTS = ['REGIONAL', 'OUTSIDE', 'RURAL'] as const;
const DISTANT_REGION_HINTS = ['DISTANT', 'REMOTE', 'NORTHERN'] as const;

/**
 * Locations are stored in ISO 3166-2 (`CA-ON`, `CA-BC`, …) but the pure
 * estimators ported from `incentives-app` operate on the bare two-letter
 * subdivision suffix (`ON`, `BC`, `AB`, `MB`). Without this normalization,
 * every comparison silently fails: dominant-province derivation returns
 * `null`, day filtering returns 0, and `EstimatorLine.province` never matches
 * the estimator's strict equality, yielding a $0 estimate.
 *
 * Accepts canonical `CA-XX`, bare `XX`, or unknown strings, and returns a
 * `SupportedProvinceCode` only when the result is one of the four supported
 * estimators. Returns `null` otherwise (caller decides what to do).
 */
function normalizeToProvinceCode(
  raw: string | null | undefined,
): SupportedProvinceCode | null {
  if (!raw) return null;
  const trimmed = String(raw).trim().toUpperCase();
  if (!trimmed) return null;
  const bare = trimmed.startsWith('CA-') ? trimmed.slice(3) : trimmed;
  return (SUPPORTED_PROVINCES as readonly string[]).includes(bare)
    ? (bare as SupportedProvinceCode)
    : null;
}

function classifyRegion(
  incentiveRegionCode: string | null | undefined,
): 'provincial' | 'distant' | 'metro' {
  const code = String(incentiveRegionCode || '').toUpperCase();
  if (!code) return 'metro';
  if (DISTANT_REGION_HINTS.some((h) => code.includes(h))) return 'distant';
  if (PROVINCIAL_REGION_HINTS.some((h) => code.includes(h))) return 'provincial';
  return 'metro';
}

// ──────────────────────────────────────────
// Type / category mapping helpers (used for budget-line projection only;
// purposely standalone so the eligibility calculator's `spend-record.projection`
// is left untouched per the integration constraint).
// ──────────────────────────────────────────

function isLabour(
  expenseType: string | null | undefined,
  accountType: string | null | undefined,
): boolean {
  if (expenseType === 'LABOUR' || expenseType === 'MIXED') return true;
  if (expenseType === 'NON_LABOUR') return false;
  if (
    accountType === 'ABOVE_THE_LINE' ||
    accountType === 'BELOW_THE_LINE_PRODUCTION' ||
    accountType === 'BELOW_THE_LINE_POST'
  ) {
    return true;
  }
  return false;
}

function deriveCategory(
  accountType: string | null | undefined,
  activityType: string | null | undefined,
): string | undefined {
  if (accountType === 'BELOW_THE_LINE_POST') return 'Post';
  if (activityType === 'POST_PRODUCTION') return 'Post';
  return undefined;
}

function deriveActivity(
  activityType: string | null | undefined,
): string | undefined {
  if (activityType === 'DIGITAL_ANIMATION' || activityType === 'VISUAL_EFFECTS') {
    return 'VFX_Animation';
  }
  return undefined;
}

// ──────────────────────────────────────────
// Province → program-code mapping
// ──────────────────────────────────────────

function getProvinceProgramCodes(
  province: SupportedProvinceCode,
  opts?: EstimatorOpts,
): string[] {
  switch (province) {
    case 'ON':
      return [opts?.onStream === 'OCASE' ? 'OCASE' : 'OPSTC'];
    case 'BC':
      return ['BC-PSTC'];
    case 'AB':
      return ['FTTC', 'AMPG'];
    case 'MB':
      return ['MB-FTTC'];
    default: {
      const _exhaustive: never = province;
      return [];
    }
  }
}

// ──────────────────────────────────────────
// Assistance classification
// ──────────────────────────────────────────

/**
 * Returns true when a FinanceSource of this type is government/non-market
 * assistance that reduces a program's eligible cost base.
 *
 * Tax credits (FEDERAL/PROVINCIAL_TAX_CREDIT) are intentionally excluded —
 * their grinding effect is handled program-to-program by the PriorAssistanceLedger,
 * not by pre-estimation base deduction.
 */
function classifyAssistance(sourceType: string): boolean {
  switch (sourceType) {
    case 'GRANT':
    case 'DEFERRAL':
      return true;
    default:
      return false;
  }
}

/** Only committed/received financing reduces incentive cost bases. */
function countsTowardAssistanceDeduction(status: string): boolean {
  return (
    status === FinanceSourceStatus.COMMITTED ||
    status === FinanceSourceStatus.RECEIVED
  );
}

// ──────────────────────────────────────────
// Service
// ──────────────────────────────────────────

@Injectable()
export class GrantEstimatorService extends TenantAwareService {
  private readonly logger = new Logger(GrantEstimatorService.name);

  constructor(prisma: PrismaService, tenant: TenantContext) {
    super(prisma, tenant);
  }

  /**
   * Estimate the monetary grant for a single province's calculator stack.
   *
   * High-level flow:
   *   1. Validate project + resolve budget version (BUDGET source only).
   *   2. Project StoryOS data → estimator-shaped { lines, opts, meta }.
   *   3. Run the spec-driven kernel for each program in the province.
   *   4. Wrap each output in the canonical GrantEstimate envelope.
   */
  async estimate(dto: EstimateGrantDto): Promise<GrantEstimateResponse> {
    const source: GrantEstimateSource = dto.source ?? 'BUDGET';

    await this.assertProjectExists(dto.projectId);

    const explicitProvince = dto.province
      ? normalizeToProvinceCode(dto.province)
      : null;
    const province =
      explicitProvince ?? (await this.deriveProvince(dto.projectId, source));

    this.logger.debug(
      `[estimate] projectId=${dto.projectId} source=${source} dtoProvince=${
        dto.province ?? 'null'
      } resolvedProvince=${province ?? 'null'}`,
    );

    if (!province) {
      throw new NotFoundException('Could not derive a supported province for this project.');
    }

    const budgetVersionId =
      source === 'BUDGET'
        ? (dto.budgetVersionId ?? (await this.resolveBudgetVersionId(dto.projectId)))
        : null;

    const lines = await this.buildLines({
      projectId: dto.projectId,
      source,
      budgetVersionId,
      accountSourceOverrides: dto.accountSourceOverrides,
    });

    if (dto.labourMultiplier && dto.labourMultiplier !== 1) {
      for (const line of lines) {
        if (line.type === 'Labour') {
          line.amount = (line.amount ?? 0) * dto.labourMultiplier;
        }
      }
    }

    const dayTotals = await this.buildDayTotals({
      projectId: dto.projectId,
      source,
      province,
    });

    const meta = await this.buildMeta({
      projectId: dto.projectId,
      province,
      overrides: dto.meta,
    });

    const opts: EstimatorOpts = {
      ...dayTotals,
      ...this.cleanOptsOverrides(dto.opts),
    };

    const programCodes = getProvinceProgramCodes(province, opts);
    const estimates: GrantEstimate[] = [];

    for (const code of programCodes) {
      const spec = PROGRAM_SPECS.get(code);
      if (!spec) continue;
      const result = runEstimate({
        spec,
        lines,
        opts,
        meta,
        priorAssistance: dto.priorAssistance,
      });
      estimates.push({
        programCode: code,
        estimatedAmount: round2(result.amount),
        breakdown: { detail: result.detail, trace: result.trace },
      });
    }

    const totalEstimatedAmount = estimates.reduce((sum, est) => sum + est.estimatedAmount, 0);

    return {
      projectId: dto.projectId,
      province,
      source,
      budgetVersionId,
      totalEstimatedAmount,
      estimates,
      inputs: {
        lineCount: lines.length,
        totalDays: opts.totalDays ?? 0,
        daysProvincial: opts.daysProvincial ?? 0,
        daysDistant: opts.daysDistant ?? 0,
        provincialOwnershipPercent: Number(meta.provincialOwnershipPercent ?? 0),
        copyright: {
          holderName: meta.copyright?.holderName ?? null,
          country: meta.copyright?.jurisdiction?.country ?? null,
          province: meta.copyright?.jurisdiction?.province ?? null,
        },
      },
    };
  }

  // ──────────────────────────────────────────
  // Spec-driven estimate (Phase 1 kernel)
  // ──────────────────────────────────────────

  /**
   * Estimate a single program using the declarative ProgramEstimateSpec
   * kernel. Returns `{ available: false }` when no spec is registered
   * for the given program code.
   */
  async estimateByProgramCode(args: {
    projectId: string;
    programCode: string;
    source: GrantEstimateSource;
    budgetVersionId?: string;
    priorAssistance?: EstimatorPriorAssistance;
    labourMultiplier?: number;
    assistanceContext?: AssistanceContext;
    eligibilityContext?: EligibilityContext;
  }): Promise<{
    amount: number;
    available: boolean;
    breakdown?: Record<string, unknown>;
  }> {
    const spec = PROGRAM_SPECS.get(args.programCode);
    if (!spec) return { amount: 0, available: false };

    await this.assertProjectExists(args.projectId);

    const source: GrantEstimateSource = args.source ?? 'BUDGET';
    const budgetVersionId =
      source === 'BUDGET'
        ? (args.budgetVersionId ?? (await this.resolveBudgetVersionId(args.projectId)))
        : null;

    const lines = await this.buildLines({
      projectId: args.projectId,
      source,
      budgetVersionId,
    });

    if (args.labourMultiplier && args.labourMultiplier !== 1) {
      for (const line of lines) {
        if (line.type === 'Labour') {
          line.amount = (line.amount ?? 0) * args.labourMultiplier;
        }
      }
    }

    let opts: EstimatorOpts = {};
    let meta: EstimatorMeta = {};

    if (spec.province) {
      const province = normalizeToProvinceCode(spec.province);
      if (province) {
        opts = await this.buildDayTotals({
          projectId: args.projectId,
          source,
          province,
        });
        meta = await this.buildMeta({
          projectId: args.projectId,
          province,
        });
      }
    }

    const result = runEstimate({
      spec,
      lines,
      opts,
      meta,
      priorAssistance: args.priorAssistance,
      assistanceContext: args.assistanceContext,
      eligibilityContext: args.eligibilityContext,
    });

    return {
      amount: round2(result.amount),
      available: true,
      breakdown: { detail: result.detail, trace: result.trace },
    };
  }

  // ──────────────────────────────────────────
  // Assistance context (Phase 3.5)
  // ──────────────────────────────────────────

  /**
   * Build an AssistanceContext for the project by classifying FinanceSource
   * records from the project's FinancePlan.
   *
   * `totalCost` is derived by summing all eligible EstimatorLines for the
   * given source/budgetVersion so the proportional deduction denominators
   * are consistent with the actual estimation inputs.
   *
   * Reads `attributionType` and `originProvince` from FinanceSource to
   * correctly split labour vs general assistance and build the
   * assistanceByProvince map for province-filtered grinds.
   */
  async buildAssistanceContext(args: {
    projectId: string;
    source: GrantEstimateSource;
    budgetVersionId: string | null;
  }): Promise<AssistanceContext> {
    const estimatorLines = await this.buildLines({
      projectId: args.projectId,
      source: args.source,
      budgetVersionId: args.budgetVersionId,
    });
    const totalCost = estimatorLines.reduce((sum, l) => sum + (l.amount ?? 0), 0);

    const plan = await this.prisma.financePlan.findFirst({
      where: this.tenantFilter({ projectId: args.projectId }),
      include: { sources: { where: this.softDeleteFilter } },
    });

    const assistanceLines: AssistanceLine[] = (plan?.sources ?? []).map((s) => {
      const isAssistance = classifyAssistance(s.sourceType);
      const attributionMissing = isAssistance && s.attributionType == null;
      const attr: 'labour' | 'general' =
        s.attributionType === 'labour' ? 'labour' : 'general';

      const rawScope = (s as any).originScope as string | null | undefined;
      const originScope: AssistanceLine['originScope'] =
        rawScope === 'federal' ? 'federal'
        : rawScope === 'provincial' ? 'provincial'
        : s.originProvince ? 'provincial'
        : 'unknown';

      return {
        sourceType: s.sourceType,
        name: s.name,
        amount: Number(s.amount),
        isAssistance,
        attribution: attr,
        attributionMissing,
        originScope,
        originProvince: s.originProvince ?? undefined,
        status: s.status,
      };
    });

    let labourAssistance = 0;
    let generalAssistance = 0;
    let totalAssistance = 0;
    let federalAssistance = 0;
    let unknownOriginAssistance = 0;
    const assistanceByProvince: Record<string, number> = {};
    const dataGaps: string[] = [];

    let missingAttributionCount = 0;
    let unknownScopeCount = 0;

    for (const line of assistanceLines) {
      if (!line.isAssistance) continue;
      if (!countsTowardAssistanceDeduction(line.status)) continue;
      totalAssistance += line.amount;
      if (line.attributionMissing) missingAttributionCount++;

      if (line.attribution === 'labour') {
        labourAssistance += line.amount;
      } else {
        generalAssistance += line.amount;
      }

      switch (line.originScope) {
        case 'federal':
          federalAssistance += line.amount;
          assistanceByProvince['FED'] = (assistanceByProvince['FED'] ?? 0) + line.amount;
          break;
        case 'provincial': {
          const bucket = line.originProvince ?? 'UNKNOWN';
          assistanceByProvince[bucket] = (assistanceByProvince[bucket] ?? 0) + line.amount;
          break;
        }
        case 'unknown':
          unknownOriginAssistance += line.amount;
          unknownScopeCount++;
          assistanceByProvince['UNKNOWN'] = (assistanceByProvince['UNKNOWN'] ?? 0) + line.amount;
          break;
      }
    }

    if (missingAttributionCount > 0) {
      dataGaps.push(
        `attributionType missing on ${missingAttributionCount} assistance source(s) — defaulting to 'general'. Labour vs general split may be inaccurate.`,
      );
    }
    if (unknownScopeCount > 0) {
      dataGaps.push(
        `originScope unknown on ${unknownScopeCount} assistance source(s) — province-filtered grinds cannot classify these. Data entry required.`,
      );
    }

    const ineligibleCostDeduction = await this.computeIneligibleCostDeduction({
      projectId: args.projectId,
      source: args.source,
      budgetVersionId: args.budgetVersionId,
    });

    return {
      totalCost,
      lines: assistanceLines,
      totalAssistance,
      labourAssistance,
      generalAssistance,
      assistanceByProvince,
      federalAssistance,
      unknownOriginAssistance,
      ineligibleCostDeduction,
      dataGaps,
    };
  }

  /**
   * Sum budget lines flagged as tax-credit-ineligible.
   * For partial ineligibility (e.g. CRAFT_SERVICES_50PCT), the amount
   * is halved. All other ineligible lines use their full amount.
   */
  private async computeIneligibleCostDeduction(args: {
    projectId: string;
    source: GrantEstimateSource;
    budgetVersionId: string | null;
  }): Promise<number> {
    if (args.source !== 'BUDGET' || !args.budgetVersionId) return 0;

    const ineligibleLines = await this.prisma.budgetLine.findMany({
      where: {
        ...this.softDeleteFilter,
        budgetVersionId: args.budgetVersionId,
        taxCreditIneligible: true,
      },
      select: { amount: true, taxCreditIneligibleReason: true },
    });

    let total = 0;
    for (const line of ineligibleLines) {
      const amt = Number(line.amount);
      if (line.taxCreditIneligibleReason === 'CRAFT_SERVICES_50PCT') {
        total += amt * 0.5;
      } else {
        total += amt;
      }
    }
    return total;
  }

  /**
   * Returns province → total eligible spend amount ($). Used by the grind
   * engine to evaluate `jurisdictionOverlap` conditions with material-spend
   * thresholds — a province with $1K spend won't trigger cross-province grinds
   * when the condition requires a minimum base amount.
   */
  async buildSpendByProvince(args: {
    projectId: string;
    source: GrantEstimateSource;
    budgetVersionId: string | null;
  }): Promise<Map<string, number>> {
    const lines = await this.buildLines({
      projectId: args.projectId,
      source: args.source,
      budgetVersionId: args.budgetVersionId,
    });
    const byProvince = new Map<string, number>();
    for (const line of lines) {
      const p = line.province?.toUpperCase();
      const amt = line.amount ?? 0;
      if (p && amt > 0) {
        byProvince.set(p, (byProvince.get(p) ?? 0) + amt);
      }
    }
    return byProvince;
  }

  // ──────────────────────────────────────────
  // Adapter: BudgetLine / ExpenseFact → EstimatorLine[]
  // ──────────────────────────────────────────

  private async buildLines(args: {
    projectId: string;
    source: GrantEstimateSource;
    budgetVersionId: string | null;
    accountSourceOverrides?: Record<string, GrantEstimateSource>;
  }): Promise<EstimatorLine[]> {
    let budgetRows: any[] = [];
    if (args.source === 'BUDGET' || args.source === 'BLENDED') {
      if (args.budgetVersionId) {
        budgetRows = await this.prisma.budgetLine.findMany({
          where: this.tenantFilter({ budgetVersionId: args.budgetVersionId }),
          include: { account: true, location: true },
        });
      }
    }

    let actualFacts: any[] = [];
    if (args.source === 'ACTUAL' || args.source === 'BLENDED') {
      actualFacts = await this.prisma.expenseFact.findMany({
        where: this.tenantFilter({ projectId: args.projectId }),
        include: { actualLine: true, location: true },
      });
    }

    const mapBudget = (line: any): EstimatorLine => {
      const taxCreditIneligible: boolean = line.taxCreditIneligible ?? false;
      const reason: string | null = line.taxCreditIneligibleReason ?? null;
      const ineligiblePortion =
        taxCreditIneligible && reason === 'CRAFT_SERVICES_50PCT' ? 0.5
        : taxCreditIneligible ? 1.0
        : undefined;

      return {
        type: isLabour(line.expenseType, line.account?.accountType ?? null) ? 'Labour' as const : 'NonLabour' as const,
        province: normalizeToProvinceCode(line.location?.provinceState) ?? '',
        category: deriveCategory(line.account?.accountType ?? null, line.activityType ?? null),
        activity: deriveActivity(line.activityType ?? null),
        amount: Number(line.amount),
        description: line.description || line.account?.name || 'Budget Line',
        glCode: line.account?.code ?? undefined,
        budgetTemplateCategory: line.account?.accountType ?? 'OTHER',
        taxCreditIneligible,
        ineligiblePortion,
      };
    };

    if (args.source === 'BUDGET') {
      return budgetRows.map(mapBudget);
    }

    // Resolve account types in a second pass so we can detect post lines for
    // ExpenseFacts (which don't carry `expenseType` / `activityType` directly).
    const accountIds = Array.from(
      new Set(
        actualFacts
          .map((f) => f.budgetAccountId)
          .filter((id): id is string => typeof id === 'string'),
      ),
    );
    const accounts = accountIds.length
      ? await this.prisma.budgetAccount.findMany({
          where: this.tenantFilter({ id: { in: accountIds } }),
          select: { id: true, accountType: true, name: true, code: true },
        })
      : [];
    const accountTypeById = new Map<string, string | null>(
      accounts.map((a) => [a.id, a.accountType ?? null]),
    );
    const accountNameById = new Map<string, string | null>(
      accounts.map((a) => [a.id, a.name ?? null]),
    );
    const accountCodeById = new Map<string, string | null>(
      accounts.map((a) => [a.id, a.code ?? null]),
    );

    const mapActual = (fact: any) => {
      const accountType = fact.budgetAccountId ? (accountTypeById.get(fact.budgetAccountId) ?? null) : null;
      const accountName = fact.budgetAccountId ? (accountNameById.get(fact.budgetAccountId) ?? null) : null;
      const accountCode = fact.budgetAccountId ? (accountCodeById.get(fact.budgetAccountId) ?? null) : null;
      const eligible = Number(fact.eligiblePortion);
      const amount = Number(fact.actualLine.amount) * (Number.isFinite(eligible) ? eligible : 1);
      return {
        type: fact.labourFlag ? 'Labour' as const : 'NonLabour' as const,
        province: normalizeToProvinceCode(fact.location?.provinceState) ?? '',
        category: deriveCategory(accountType, null),
        activity: undefined,
        amount,
        description: fact.actualLine?.description || accountName || 'Actual Expense',
        glCode: accountCode ?? undefined,
        budgetTemplateCategory: accountType ?? 'OTHER',
      };
    };

    if (args.source === 'ACTUAL') {
      return actualFacts.map(mapActual);
    }

    // BLENDED
    const out: EstimatorLine[] = [];
    const overrides = args.accountSourceOverrides ?? {};
    
    const actualByAccount = new Map<string, any[]>();
    for (const f of actualFacts) {
      if (f.budgetAccountId) {
        const arr = actualByAccount.get(f.budgetAccountId) ?? [];
        arr.push(f);
        actualByAccount.set(f.budgetAccountId, arr);
      }
    }
    const budgetByAccount = new Map<string, any[]>();
    for (const r of budgetRows) {
      if (r.budgetAccountId) {
        const arr = budgetByAccount.get(r.budgetAccountId) ?? [];
        arr.push(r);
        budgetByAccount.set(r.budgetAccountId, arr);
      }
    }

    const allAccountIds = new Set([...budgetByAccount.keys(), ...actualByAccount.keys()]);
    for (const accId of allAccountIds) {
      const source = overrides[accId] ?? (budgetByAccount.has(accId) ? 'BUDGET' : 'ACTUAL');
      if (source === 'ACTUAL') {
        const facts = actualByAccount.get(accId) ?? [];
        out.push(...facts.map(mapActual));
      } else {
        const lines = budgetByAccount.get(accId) ?? [];
        out.push(...lines.map(mapBudget));
      }
    }
    return out;
  }

  // ──────────────────────────────────────────
  // Adapter: ActivityPlan / ActivityDay → opts.{totalDays, daysProvincial, daysDistant}
  // ──────────────────────────────────────────

  private async buildDayTotals(args: {
    projectId: string;
    source: GrantEstimateSource;
    province: SupportedProvinceCode;
  }): Promise<{ totalDays: number; daysProvincial: number; daysDistant: number }> {
    if (args.source === 'BUDGET') {
      const plans = await this.prisma.activityPlan.findMany({
        where: this.tenantFilter({ projectId: args.projectId }),
        include: { location: true },
      });
      const inProvince = plans.filter(
        (p) => normalizeToProvinceCode(p.location.provinceState) === args.province,
      );
      let totalDays = 0;
      let daysProvincial = 0;
      let daysDistant = 0;
      for (const p of inProvince) {
        totalDays += p.plannedDays;
        const bucket = classifyRegion(p.location.incentiveRegionCode);
        if (bucket === 'provincial') daysProvincial += p.plannedDays;
        else if (bucket === 'distant') daysDistant += p.plannedDays;
      }
      return { totalDays, daysProvincial, daysDistant };
    }

    // ACTUAL / BLENDED: count distinct calendar days per location, then bucket by region.
    const days = await this.prisma.activityDay.findMany({
      where: this.tenantFilter({ projectId: args.projectId }),
      include: { location: true },
    });
    const inProvince = days.filter(
      (d) => normalizeToProvinceCode(d.location.provinceState) === args.province,
    );

    // Group by locationId so we count distinct calendar days per location
    // (matches CalculatorContext's distinct-date semantics for ACTUAL/BLENDED).
    const byLocation = new Map<
      string,
      {
        regionCode: string | null;
        dates: Set<string>;
      }
    >();
    for (const d of inProvince) {
      const key = d.locationId;
      const entry = byLocation.get(key) ?? {
        regionCode: d.location.incentiveRegionCode ?? null,
        dates: new Set<string>(),
      };
      entry.dates.add(d.activityDate.toISOString().slice(0, 10));
      byLocation.set(key, entry);
    }

    let totalDays = 0;
    let daysProvincial = 0;
    let daysDistant = 0;
    for (const entry of byLocation.values()) {
      const count = entry.dates.size;
      totalDays += count;
      const bucket = classifyRegion(entry.regionCode);
      if (bucket === 'provincial') daysProvincial += count;
      else if (bucket === 'distant') daysDistant += count;
    }
    return { totalDays, daysProvincial, daysDistant };
  }

  // ──────────────────────────────────────────
  // Adapter: ProjectOwnership / RightsControlFact → meta
  // ──────────────────────────────────────────

  private async buildMeta(args: {
    projectId: string;
    province: SupportedProvinceCode;
    overrides?: GrantEstimateMetaOverridesDto;
  }): Promise<EstimatorMeta> {
    const now = new Date();

    // Provincial ownership %: sum of currently-effective ProjectOwnership
    // rows whose entity is registered in Canada. StoryOS does not currently
    // store the entity's province, so this is a best-effort proxy for AB
    // (the only province estimator that consumes this signal). The caller can
    // override via dto.meta.provincialOwnershipPercent.
    const ownerships = await this.prisma.projectOwnership.findMany({
      where: this.tenantFilter({
        projectId: args.projectId,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
      }),
    });
    const canadianOwnership = ownerships
      .filter((o) => normalizeCountry(o.entityCountry) === 'CANADA')
      .reduce((sum, o) => sum + Number(o.ownershipPercentage), 0);

    // Copyright holder (for AB jurisdiction signal).
    const copyrightFact = await this.prisma.rightsControlFact.findFirst({
      where: this.tenantFilter({
        projectId: args.projectId,
        controlType: ControlType.COPYRIGHT_OWNERSHIP,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
      }),
      orderBy: { effectiveFrom: 'desc' },
    });

    const holderName =
      args.overrides?.copyrightHolderName ?? copyrightFact?.holderName ?? '';
    const holderCountry =
      args.overrides?.copyrightJurisdictionCountry ??
      copyrightFact?.holderCountry ??
      '';
    // StoryOS RightsControlFact does not carry a province field. If the
    // holder is Canadian we fall back to the requested province (best-effort
    // for AB-controlled detection); callers should override when better data
    // is available.
    const holderProvince =
      args.overrides?.copyrightJurisdictionProvince ??
      (normalizeCountry(holderCountry) === 'CANADA' ? args.province : '');

    return {
      provincialOwnershipPercent:
        args.overrides?.provincialOwnershipPercent ?? canadianOwnership,
      copyright: {
        holderName,
        jurisdiction: {
          country: holderCountry || undefined,
          province: holderProvince || undefined,
        },
      },
    };
  }

  // ──────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────

  private cleanOptsOverrides(
    overrides?: GrantEstimateOptsOverridesDto,
  ): EstimatorOpts {
    if (!overrides) return {};
    const cleaned: EstimatorOpts = {};
    for (const [key, value] of Object.entries(overrides)) {
      if (value !== undefined && value !== null) {
        (cleaned as Record<string, unknown>)[key] = value;
      }
    }
    return cleaned;
  }

  private async assertProjectExists(projectId: string): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: this.tenantFilter({ id: projectId }),
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');
  }

  /**
   * Mirrors EstimatePreviewService.resolveBudgetVersionId — prefers the latest
   * LOCKED version, then DRAFT. Returns null if the project has no budget at all.
   */
  private async resolveBudgetVersionId(projectId: string): Promise<string | null> {
    const budget = await this.prisma.budget.findFirst({
      where: this.tenantFilter({ projectId } as Prisma.BudgetWhereInput),
      select: { id: true },
    });
    if (!budget) return null;

    const locked = await this.prisma.budgetVersion.findFirst({
      where: this.tenantFilter({
        budgetId: budget.id,
        status: BudgetVersionStatus.LOCKED,
      }),
      orderBy: { versionNumber: 'desc' },
      select: { id: true },
    });
    if (locked) return locked.id;

    const draft = await this.prisma.budgetVersion.findFirst({
      where: this.tenantFilter({
        budgetId: budget.id,
        status: BudgetVersionStatus.DRAFT,
      }),
      orderBy: { versionNumber: 'desc' },
      select: { id: true },
    });
    return draft?.id ?? null;
  }

  /**
   * Attempt to automatically derive the correct province for this project's estimate.
   * 1. Check primary project location.
   * 2. Fallback: Check the province with the most activity days or planned days.
   */
  private async deriveProvince(
    projectId: string,
    source: GrantEstimateSource,
  ): Promise<SupportedProvinceCode | null> {
    const primaryLoc = await this.prisma.projectLocation.findFirst({
      where: this.tenantFilter({ projectId, isPrimary: true }),
      include: { location: true },
    });

    const fromPrimary = normalizeToProvinceCode(
      primaryLoc?.location.provinceState,
    );
    if (fromPrimary) {
      this.logger.debug(
        `[deriveProvince] primary location -> ${primaryLoc?.location.provinceState} → ${fromPrimary}`,
      );
      return fromPrimary;
    }

    const provCounts = new Map<SupportedProvinceCode, number>();

    if (source === 'BUDGET') {
      const plans = await this.prisma.activityPlan.findMany({
        where: this.tenantFilter({ projectId }),
        include: { location: true },
      });
      for (const p of plans) {
        const code = normalizeToProvinceCode(p.location.provinceState);
        if (code) {
          provCounts.set(code, (provCounts.get(code) ?? 0) + p.plannedDays);
        }
      }
    } else {
      const days = await this.prisma.activityDay.findMany({
        where: this.tenantFilter({ projectId }),
        include: { location: true },
      });
      for (const d of days) {
        const code = normalizeToProvinceCode(d.location.provinceState);
        if (code) {
          provCounts.set(code, (provCounts.get(code) ?? 0) + 1);
        }
      }
    }

    let dominantProv: SupportedProvinceCode | null = null;
    let maxDays = 0;
    for (const [code, count] of provCounts.entries()) {
      if (count > maxDays) {
        maxDays = count;
        dominantProv = code;
      }
    }

    this.logger.debug(
      `[deriveProvince] dominant from ${source.toLowerCase()} activity = ${
        dominantProv ?? 'null'
      } (counts: ${JSON.stringify(Object.fromEntries(provCounts))})`,
    );

    return dominantProv;
  }
}

function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function normalizeCountry(value: string | null | undefined): string {
  return String(value ?? '').trim().toUpperCase();
}
