import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@storyos/database';
import {
  AssessmentResult,
  BudgetVersionStatus,
  EvaluationSource,
} from '@storyos/types';
import type { AssistanceContext, EligibilityContext, RequirementConfig, EligibilityTier } from '@storyos/types';
import { PROGRAM_SPECS } from '../grants/estimators';

import { CalculatorContext } from '../calculators/calculator.context';
import type { CalculatorInput, CalculatorOutput } from '../calculators/calculator.interface';
import { CalculatorRegistry } from '../calculators/calculator.registry';
import { GrantEstimatorService } from '../grants/grant-estimator.service';
import { SUPPORTED_PROVINCES } from '../grants/dto/estimate-grant.dto';
import type { SupportedProvinceCode } from '../grants/dto/estimate-grant.dto';
import { PrismaService } from '../prisma/prisma.service';
import { TenantAwareService } from '../tenant/tenant-aware.service';
import { TenantContext } from '../tenant/tenant.context';
import {
  getProgramTier,
  getNonProductionCodes,
  getAllGrindRules,
  isExcludedPair,
} from '../grants/program-config';
import { evaluateWithGrinding } from '../grants/grind-engine';

export type StrategySource = EvaluationSource.BUDGET | EvaluationSource.ACTUAL;

export interface StrategyProgramResult {
  programVersionId: string;
  programCode: string;
  programName: string;
  versionCode: string;
  estimatedAmount: number;
  grossEstimatedAmount?: number;
  priorAssistanceApplied?: {
    total: number;
    labour: number;
    nonLabour: number;
    sources: Array<{ programCode: string; amount: number; reason: string }>;
  };
  estimateAvailable: boolean;
  isEligible: boolean;
  status: 'PASS' | 'RISK' | 'FAIL';
  breakdown?: Record<string, unknown>;
  eligibilityContext?: EligibilityContext;
  failedRequirements: Array<{
    requirementId: string;
    code: string;
    name: string;
    result: AssessmentResult;
    computedValue: Record<string, unknown>;
    trace?: {
      detailedBreakdown: Record<string, unknown>;
    };
  }>;
  results: Array<{
    requirementId: string;
    requirementCode: string;
    requirementName: string;
    result: AssessmentResult;
    computedValue: Record<string, unknown>;
    trace?: {
      detailedBreakdown: Record<string, unknown>;
    };
    calculatorCode: string;
    calculatorVersion: string;
  }>;
}

export interface IncentiveStrategyResponse {
  projectId: string;
  source: StrategySource;
  projectProvince: SupportedProvinceCode | null;
  budgetVersionId: string | null;
  generatedAt: string;
  recommendedScenarioId: string | null;
  caveat: string;
  scenarios: Array<{
    id: string;
    type: 'SINGLE_PROGRAM' | 'COMBINATION';
    title: string;
    totalEstimatedAmount: number;
    estimateAvailable: boolean;
    isEligible: boolean;
    status: 'PASS' | 'RISK' | 'FAIL';
    eligibilityLabel: string;
    isRecommended: boolean;
    explanation: string;
    sensitivity?: Array<{
      description: string;
      deltaAmount: number;
    }>;
    rulesApplied?: string[];
    programs: StrategyProgramResult[];
  }>;
  allPrograms: StrategyProgramResult[];
}

@Injectable()
export class IncentiveStrategyService extends TenantAwareService {
  constructor(
    prisma: PrismaService,
    tenant: TenantContext,
    private readonly registry: CalculatorRegistry,
    private readonly grantEstimator: GrantEstimatorService,
  ) {
    super(prisma, tenant);
  }

  async getProjectStrategy(
    projectId: string,
    sourceParam?: string,
  ): Promise<IncentiveStrategyResponse> {
    const source = this.resolveSource(sourceParam);
    const evaluationDate = new Date();
    const projectProvince = await this.resolveProjectProvince(projectId);
    const budgetVersionId =
      source === EvaluationSource.BUDGET
        ? await this.resolveBudgetVersionId(projectId)
        : null;
    const assistanceContext = await this.grantEstimator.buildAssistanceContext({
      projectId,
      source,
      budgetVersionId,
    });

    const programVersions = await this.findApplicableProgramVersions(
      projectProvince,
      evaluationDate,
    );

    const programs = await Promise.all(
      programVersions.map((programVersion) =>
        this.evaluateProgramVersion({
          projectId,
          source,
          budgetVersionId,
          evaluationDate,
          programVersion,
          assistanceContext,
        }),
      ),
    );

    const singleProgramScenarios = programs.map((program) => ({
      id: `program:${program.programVersionId}`,
      type: 'SINGLE_PROGRAM' as const,
      title: `${program.programName}`,
      totalEstimatedAmount: program.estimatedAmount,
      estimateAvailable: program.estimateAvailable,
      isEligible: program.isEligible,
      status: program.status,
      explanation: program.isEligible
        ? 'Single-program strategy based on current production data.'
        : 'Requirements need attention before this program is claim-ready.',
      programs: [program],
    }));

    const combinationScenarios = await this.generateCombinationScenarios({
      projectId,
      source,
      budgetVersionId,
      programs,
      assistanceContext,
    });

    const scenarios = [
      ...combinationScenarios,
      ...singleProgramScenarios,
    ].sort((a, b) => b.totalEstimatedAmount - a.totalEstimatedAmount);

    const recommendedScenarioId =
      scenarios.find((scenario) => scenario.estimateAvailable)?.id ??
      scenarios[0]?.id ??
      null;

    const finalScenarios = await Promise.all(
      scenarios.map(async (scenario, index) => {
        const isRecommended = scenario.id === recommendedScenarioId;
        const eligibilityLabel = scenario.isEligible ? 'Eligible' : 'Not eligible';

        let explanation = scenario.explanation;
        if (!scenario.isEligible) {
          const fails = scenario.programs.flatMap((p) =>
            p.failedRequirements.map((f) => f.name),
          );
          if (fails.length > 0) {
            const uniqueFails = [...new Set(fails)];
            explanation = `Blocked by: ${uniqueFails.slice(0, 2).join(', ')}`;
          } else {
            explanation = 'Not eligible due to unmet requirements.';
          }
        } else if (scenario.type === 'COMBINATION') {
          const codes = scenario.programs.map((p) => p.programCode);
          explanation = `Stacked approach combining ${codes.join(' + ')} for maximized outcome.`;
        } else {
          explanation = `Strong baseline strategy leveraging ${scenario.programs[0]?.programCode ?? 'this program'}.`;
        }

        let sensitivity;
        if (index < 3 && scenario.estimateAvailable && scenario.totalEstimatedAmount > 0) {
          const { totalEstimatedAmount: newAmount } = await this.evaluateScenarioAmount({
            projectId,
            source,
            budgetVersionId,
            programs: scenario.programs,
            labourMultiplier: 1.1,
            assistanceContext,
          });

          sensitivity = [
            {
              description: 'If eligible labour increases by 10%',
              deltaAmount: Math.round(newAmount - scenario.totalEstimatedAmount),
            },
          ];
        }

        return {
          ...scenario,
          isRecommended,
          eligibilityLabel,
          explanation,
          sensitivity,
        };
      }),
    );

    return {
      projectId,
      source,
      projectProvince,
      budgetVersionId,
      generatedAt: new Date().toISOString(),
      recommendedScenarioId,
      caveat:
        'Stacking exclusions and grinding rules are derived from the program configuration registry. Recommendation heuristics are basic.',
      scenarios: finalScenarios,
      allPrograms: programs,
    };
  }

  private async evaluateProgramVersion(args: {
    projectId: string;
    source: StrategySource;
    budgetVersionId: string | null;
    evaluationDate: Date;
    assistanceContext: AssistanceContext;
    programVersion: Prisma.ProgramVersionGetPayload<{
      include: {
        program: true;
        requirements: true;
      };
    }>;
  }): Promise<StrategyProgramResult> {
    const {
      projectId,
      source,
      budgetVersionId,
      evaluationDate,
      assistanceContext,
      programVersion,
    } = args;
    const requirements = [...programVersion.requirements].sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.code.localeCompare(b.code);
    });

    const contextInput: CalculatorInput = {
      submissionId: `strategy:${programVersion.id}`,
      projectId,
      organizationId: this.organizationId,
      evaluationDate,
      budgetVersionId,
      evaluationSource: source,
      requirementId: '',
      requirementCode: '',
      requirementCategory: requirements[0]?.requirementCategory as any,
      configuration: (requirements[0]?.configuration ?? {}) as RequirementConfig,
    };
    const context = new CalculatorContext(this.prisma, contextInput);

    const results = await Promise.all(
      requirements.map(async (requirement) => {
        const calculator = this.registry.getCalculator(
          requirement.requirementCategory as any,
        );

        let output: CalculatorOutput;
        if (!calculator) {
          output = {
            result: AssessmentResult.NOT_EVALUATED,
            computedValue: {
              reason: `No calculator registered for ${requirement.requirementCategory}`,
            },
            calculatorCode: 'none',
            calculatorVersion: '0.0.0',
          };
        } else {
          const input: CalculatorInput = {
            ...contextInput,
            requirementId: requirement.id,
            requirementCode: requirement.code,
            requirementCategory: requirement.requirementCategory as any,
            configuration: requirement.configuration as RequirementConfig,
          };
          try {
            output = await calculator.evaluate(input, this.prisma, context);
          } catch (err) {
            output = {
              result: AssessmentResult.NOT_EVALUATED,
              computedValue: {
                error: err instanceof Error ? err.message : 'Unknown calculator error',
              },
              calculatorCode: calculator.code,
              calculatorVersion: calculator.version,
            };
          }
        }

        return {
          requirementId: requirement.id,
          requirementCode: requirement.code,
          requirementName: requirement.name,
          sortOrder: requirement.sortOrder,
          ...output,
        };
      }),
    );

    const gatingResults = results.filter(
      (r) => !isNonGatingRequirement(r.requirementCode, r.sortOrder),
    );
    const hasFail = gatingResults.some(
      (result) => result.result === AssessmentResult.FAIL,
    );
    const hasRisk = results.some(
      (result) => result.result !== AssessmentResult.PASS,
    );

    const eligibilityContext = buildEligibilityContext(
      programVersion.program.code,
      results.map((r) => ({
        requirementCode: r.requirementCode,
        requirementName: r.requirementName,
        result: r.result,
        computedValue: (r.computedValue ?? {}) as Record<string, unknown>,
        sortOrder: r.sortOrder,
      })),
      programVersion.requirements,
    );

    let estimate: { amount: number; available: boolean; breakdown?: Record<string, unknown> };
    if (hasFail) {
      estimate = {
        amount: 0,
        available: true,
        breakdown: {
          gatedByEligibility: true,
          reason: `Base eligibility failed for ${gatingResults
            .filter((r) => r.result === AssessmentResult.FAIL)
            .map((r) => r.requirementCode)
            .join(', ')}. Estimate is $0.`,
        },
      };
    } else {
      estimate = await this.estimateProgram({
        projectId,
        source,
        budgetVersionId,
        programCode: programVersion.program.code,
        assistanceContext,
        eligibilityContext,
      });
    }

    return {
      programVersionId: programVersion.id,
      programCode: programVersion.program.code,
      programName: programVersion.program.name,
      versionCode: programVersion.versionCode,
      estimatedAmount: estimate.amount,
      estimateAvailable: estimate.available,
      breakdown: estimate.breakdown,
      isEligible: !hasFail,
      status: hasFail ? 'FAIL' : hasRisk ? 'RISK' : 'PASS',
      eligibilityContext,
      failedRequirements: results
        .filter((result) => result.result === AssessmentResult.FAIL)
        .map((result) => ({
          requirementId: result.requirementId,
          code: result.requirementCode,
          name: result.requirementName,
          result: result.result,
          computedValue: result.computedValue,
          trace: result.trace,
        })),
      results: results.map((result) => ({
        requirementId: result.requirementId,
        requirementCode: result.requirementCode,
        requirementName: result.requirementName,
        result: result.result,
        computedValue: result.computedValue,
        trace: result.trace,
        calculatorCode: result.calculatorCode,
        calculatorVersion: result.calculatorVersion,
      })),
    };
  }

  private async evaluateScenarioAmount(args: {
    projectId: string;
    source: StrategySource;
    budgetVersionId: string | null;
    programs: StrategyProgramResult[];
    labourMultiplier?: number;
    assistanceContext?: AssistanceContext;
  }): Promise<{ totalEstimatedAmount: number; evaluatedPrograms: StrategyProgramResult[] }> {
    const assistanceContext =
      args.assistanceContext ??
      await this.grantEstimator.buildAssistanceContext({
        projectId: args.projectId,
        source: args.source,
        budgetVersionId: args.budgetVersionId,
      });

    const eligibilityByProgram = new Map(
      args.programs
        .filter((p) => p.eligibilityContext)
        .map((p) => [p.programCode, p.eligibilityContext!]),
    );

    const spendByProvince = await this.grantEstimator.buildSpendByProvince({
      projectId: args.projectId,
      source: args.source,
      budgetVersionId: args.budgetVersionId,
    });

    const grindResult = await evaluateWithGrinding({
      programs: args.programs.map((p) => ({
        programCode: p.programCode,
        amount: p.estimatedAmount,
        available: p.estimateAvailable,
        breakdown: p.breakdown,
      })),
      reEstimate: async (programCode, priorAssistance, labourMultiplier, ctx) =>
        this.estimateProgram({
          projectId: args.projectId,
          source: args.source,
          budgetVersionId: args.budgetVersionId,
          programCode,
          priorAssistance,
          labourMultiplier,
          assistanceContext: ctx,
          eligibilityContext: eligibilityByProgram.get(programCode),
        }),
      labourMultiplier: args.labourMultiplier,
      assistanceContext,
      spendByProvince,
    });

    const programByCode = new Map(
      args.programs.map((p) => [p.programCode, p]),
    );

    const evaluatedPrograms = grindResult.programs.map((ground) => {
      const original = programByCode.get(ground.programCode)!;
      return {
        ...original,
        grossEstimatedAmount: ground.rawAmount,
        estimatedAmount: ground.groundAmount,
        estimateAvailable: ground.available,
        breakdown: ground.breakdown,
        priorAssistanceApplied: ground.priorAssistance,
      };
    });

    return {
      totalEstimatedAmount: grindResult.totalAmount,
      evaluatedPrograms,
    };
  }

  private async generateCombinationScenarios(args: {
    projectId: string;
    source: StrategySource;
    budgetVersionId: string | null;
    programs: StrategyProgramResult[];
    assistanceContext: AssistanceContext;
  }) {
    const candidates = sortProgramsForScenario(
      args.programs.filter((program) => program.isEligible),
    );
    const combinations = generateValidCombinations(candidates);

    return Promise.all(
      combinations.map(async (combo) => {
        const { evaluatedPrograms, totalEstimatedAmount } = await this.evaluateScenarioAmount({
          projectId: args.projectId,
          source: args.source,
          budgetVersionId: args.budgetVersionId,
          programs: combo,
          assistanceContext: args.assistanceContext,
        });

        const rulesApplied = describeRulesForCombination(combo);

        return {
          id: `combo:${combo.map((program) => program.programCode).join('+')}`,
          type: 'COMBINATION' as const,
          title: combo.map((program) => program.programCode).join(' + '),
          totalEstimatedAmount,
          estimateAvailable: evaluatedPrograms.some((program) => program.estimateAvailable),
          isEligible: evaluatedPrograms.every((program) => program.isEligible),
          status: rulesApplied.length > 0 ? ('RISK' as const) : ('PASS' as const),
          explanation:
            rulesApplied.length > 0
              ? 'Valid combination after applying known exclusions and simple grinding rules.'
              : 'Valid combination with no known exclusions or grinding rules.',
          rulesApplied,
          programs: evaluatedPrograms,
        };
      }),
    );
  }

  private async estimateProgram(args: {
    projectId: string;
    source: StrategySource;
    budgetVersionId: string | null;
    programCode: string;
    priorAssistance?: {
      total: number;
      labour: number;
      nonLabour: number;
    };
    labourMultiplier?: number;
    assistanceContext?: AssistanceContext;
    eligibilityContext?: EligibilityContext;
  }): Promise<{ amount: number; available: boolean; breakdown?: Record<string, unknown> }> {
    try {
      return await this.grantEstimator.estimateByProgramCode({
        projectId: args.projectId,
        programCode: args.programCode,
        source: args.source,
        budgetVersionId: args.budgetVersionId ?? undefined,
        priorAssistance: args.priorAssistance,
        labourMultiplier: args.labourMultiplier,
        assistanceContext: args.assistanceContext,
        eligibilityContext: args.eligibilityContext,
      });
    } catch {
      return { amount: 0, available: false };
    }
  }

  private async findApplicableProgramVersions(
    projectProvince: SupportedProvinceCode | null,
    evaluationDate: Date,
  ) {
    const programFilter = {
      isActive: true,
      code: { notIn: Array.from(getNonProductionCodes()) },
      OR: [
        { scope: 'FEDERAL' },
        ...(projectProvince
          ? [
              { provinceState: projectProvince },
              { provinceState: `CA-${projectProvince}` },
            ]
          : []),
      ],
    } satisfies Prisma.ProgramWhereInput;

    const current = await this.prisma.programVersion.findMany({
      where: {
        effectiveFrom: { lte: evaluationDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: evaluationDate } }],
        program: programFilter,
      },
      include: {
        program: true,
        requirements: true,
      },
      orderBy: [
        { program: { scope: 'asc' } },
        { program: { sortOrder: 'asc' } },
        { program: { name: 'asc' } },
      ],
    });

    if (current.length > 0) return current;

    // Local seed data may lag the calendar year. If no version is current,
    // still detect applicable programs by using each program's latest version.
    const latest = await this.prisma.programVersion.findMany({
      where: { program: programFilter },
      include: {
        program: true,
        requirements: true,
      },
      orderBy: [
        { programId: 'asc' },
        { effectiveFrom: 'desc' },
        { versionCode: 'desc' },
      ],
    });
    const seen = new Set<string>();
    return latest.filter((version) => {
      if (seen.has(version.programId)) return false;
      seen.add(version.programId);
      return true;
    });
  }

  private async resolveProjectProvince(
    projectId: string,
  ): Promise<SupportedProvinceCode | null> {
    const project = await this.prisma.project.findFirst({
      where: this.tenantFilter({ id: projectId }),
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    const primary = await this.prisma.projectLocation.findFirst({
      where: this.tenantFilter({ projectId, isPrimary: true }),
      include: { location: true },
    });
    const fromPrimary = normalizeProvince(primary?.location.provinceState);
    if (fromPrimary) return fromPrimary;

    const anyLocation = await this.prisma.projectLocation.findFirst({
      where: this.tenantFilter({ projectId }),
      include: { location: true },
      orderBy: { createdAt: 'asc' },
    });
    return normalizeProvince(anyLocation?.location.provinceState);
  }

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

  private resolveSource(source?: string): StrategySource {
    return source === EvaluationSource.ACTUAL
      ? EvaluationSource.ACTUAL
      : EvaluationSource.BUDGET;
  }
}

/**
 * Build an EligibilityContext from calculator assessment results and the
 * program's ProgramEstimateSpec. This bridges the eligibility layer's
 * structured output into the estimation kernel's tier/modifier input.
 *
 * Tier qualification is derived from the calculator results:
 * - 'base' tier always qualifies if the program is eligible.
 * - 'elevated' tier (for FTTC) qualifies when Canadian-control AND
 *   rights-control requirements pass, OR when regional-spend signals
 *   rural/remote qualification.
 *
 * Modifier qualification maps requirement assessment results to
 * bonus modifier codes used by the estimation spec.
 */
function buildEligibilityContext(
  programCode: string,
  calculatorResults: Array<{
    requirementCode: string;
    requirementName: string;
    result: string;
    computedValue: Record<string, unknown>;
    sortOrder: number;
  }>,
  programRequirements: Array<{ code: string; sortOrder: number; name: string }>,
): EligibilityContext {
  const spec = PROGRAM_SPECS.get(programCode);

  // Only core requirements gate program eligibility.
  // Non-gating requirements (elevated tier conditions, bonus modifiers)
  // are evaluated but never block the base program.
  const coreResults = calculatorResults.filter((r) => !isNonGatingRequirement(r.requirementCode, r.sortOrder));

  // PARTIAL is treated as NOT eligible — only explicit PASS qualifies.
  // This prevents missing-data scenarios from silently granting eligibility.
  const isEligible = coreResults.every((r) => r.result === 'PASS' || r.result === 'NOT_EVALUATED');

  const failedConditions = coreResults
    .filter((r) => r.result !== 'PASS' && r.result !== 'NOT_EVALUATED')
    .map((r) => ({
      requirementCode: r.requirementCode,
      requirementName: r.requirementName,
      reason: r.result === 'PARTIAL'
        ? `${summarizeFailure(r.computedValue)} (missing data — cannot confirm eligibility)`
        : summarizeFailure(r.computedValue),
    }));

  const tiers = (spec?.tiers ?? []).map((tier) => {
    if (tier.tierCode === 'base') {
      return {
        tierCode: tier.tierCode,
        rate: tier.rate,
        qualifies: isEligible,
        reasoning: isEligible ? 'Base tier — program eligibility met.' : 'Program not eligible.',
      };
    }

    if (programCode === 'FTTC' && tier.tierCode === 'elevated') {
      return buildFttcElevatedTier(tier, isEligible, calculatorResults, programRequirements);
    }

    return {
      tierCode: tier.tierCode,
      rate: tier.rate,
      qualifies: false,
      reasoning: 'No eligibility rule mapped to this tier yet.',
    };
  });

  const modifiers = buildModifiers(isEligible, calculatorResults);

  return { isEligible, tiers, failedConditions, modifiers };
}

/**
 * Explicit mapping from requirement codes to bonus modifier codes.
 * Each entry maps a seed requirement to the modifier label used in
 * ProgramEstimateSpec bonuses, so the eligibility layer drives bonus
 * application deterministically.
 */
const MODIFIER_MAP: Array<{
  requirementCode: string;
  modifierCode: string;
  descriptionTemplate: (dayPct: number) => string;
  failureMessage: string;
}> = [
  // OFTTC
  {
    requirementCode: 'OFTTC_REGIONAL',
    modifierCode: 'outside GTA',
    descriptionTemplate: (pct) => `${(pct * 100).toFixed(0)}% of days outside GTA.`,
    failureMessage: 'Insufficient filming days outside GTA.',
  },
  {
    requirementCode: 'OFTTC_DISTANT',
    modifierCode: 'outside entire GTA',
    descriptionTemplate: (pct) => `${(pct * 100).toFixed(0)}% of days in Northern ON (outside entire GTA).`,
    failureMessage: 'Insufficient filming days outside entire GTA.',
  },
  // FIBC
  {
    requirementCode: 'FIBC_REGIONAL',
    modifierCode: 'regional',
    descriptionTemplate: (pct) => `${(pct * 100).toFixed(0)}% of days in regional BC.`,
    failureMessage: 'Insufficient filming days in regional BC.',
  },
  {
    requirementCode: 'FIBC_DISTANT',
    modifierCode: 'distant',
    descriptionTemplate: (pct) => `${(pct * 100).toFixed(0)}% of days in distant BC.`,
    failureMessage: 'Insufficient filming days in distant BC.',
  },
  // BC-PSTC
  {
    requirementCode: 'BC_PSTC_REGIONAL',
    modifierCode: 'regional',
    descriptionTemplate: (pct) => `${(pct * 100).toFixed(0)}% of days in regional BC.`,
    failureMessage: 'Insufficient filming days in regional BC.',
  },
  {
    requirementCode: 'BC_PSTC_DISTANT',
    modifierCode: 'distant',
    descriptionTemplate: (pct) => `${(pct * 100).toFixed(0)}% of days in distant BC.`,
    failureMessage: 'Insufficient filming days in distant BC.',
  },
  // MB-FTTC
  {
    requirementCode: 'MB_FTTC_RURAL',
    modifierCode: 'rural',
    descriptionTemplate: (pct) => `${(pct * 100).toFixed(0)}% of days in rural Manitoba.`,
    failureMessage: 'Insufficient filming days in rural Manitoba.',
  },
  {
    requirementCode: 'MB_FTTC_NORTHERN',
    modifierCode: 'northern',
    descriptionTemplate: (pct) => `${(pct * 100).toFixed(0)}% of days in northern Manitoba.`,
    failureMessage: 'Insufficient filming days in northern Manitoba.',
  },
  {
    requirementCode: 'MB_FTTC_OWNERSHIP',
    modifierCode: 'MB ownership',
    descriptionTemplate: () => '≥50% producer ownership by MB-incorporated entities confirmed via entityProvinceState.',
    failureMessage: 'MB corporation ownership not confirmed — requires entityProvinceState = MB on producer ownership rows.',
  },
  // FTTC rural bonus (separate from elevated tier)
  {
    requirementCode: 'FTTC_RURAL',
    modifierCode: 'rural',
    descriptionTemplate: (pct) => `${(pct * 100).toFixed(0)}% of days in AB rural zones.`,
    failureMessage: 'Insufficient filming days in Alberta rural zones.',
  },
];

/**
 * Requirement codes that exist for tier selection or bonus evaluation
 * and should NOT block base-level program eligibility.
 *
 * Derived dynamically:
 * - Any requirement mapped as a modifier is non-gating.
 * - Any requirement with sortOrder >= 10 is an elevated tier condition (non-gating).
 */
function isNonGatingRequirement(code: string, sortOrder: number): boolean {
  if (MODIFIER_MAP.some((m) => m.requirementCode === code)) return true;
  if (sortOrder >= 10) return true;
  return false;
}

/**
 * FTTC elevated tier (30%) requires ALL of:
 *   1. ≥50% Alberta ownership (FTTC_AB_OWNERSHIP)
 *   2. Alberta copyright retention ≥10 years (FTTC_AB_COPYRIGHT)
 *   3. ≥60% total spend in AB OR ≥70% labour in AB (FTTC_AB_SPEND_RATIO)
 *   4. Alberta-based producer credit (FTTC_AB_PRODUCER)
 *
 * Rural filming (FTTC_RURAL) is a separate bonus modifier (+8%),
 * NOT an alternative path to the elevated tier.
 *
 * PARTIAL results (missingData) are treated as NOT qualifying —
 * they never promote to PASS.
 */
function buildFttcElevatedTier(
  tier: { tierCode: string; rate: number; label: string },
  isEligible: boolean,
  calculatorResults: Array<{
    requirementCode: string;
    requirementName: string;
    result: string;
    computedValue: Record<string, unknown>;
    sortOrder: number;
  }>,
  programRequirements: Array<{ code: string; sortOrder: number; name: string }>,
): EligibilityTier {
  if (!isEligible) {
    return {
      tierCode: tier.tierCode,
      rate: tier.rate,
      qualifies: false,
      reasoning: 'Base eligibility not met — elevated tier not evaluated.',
    };
  }

  const elevatedTierRequirements = programRequirements.filter(
    (r) => r.sortOrder >= 10 && !MODIFIER_MAP.some((m) => m.requirementCode === r.code)
  );

  const REQUIRED = elevatedTierRequirements.map((r) => r.code);

  const resultsMap = new Map(calculatorResults.map((r) => [r.requirementCode, r]));

  const missingCodes = REQUIRED.filter((code) => !resultsMap.has(code));
  if (missingCodes.length > 0) {
    return {
      tierCode: tier.tierCode,
      rate: tier.rate,
      qualifies: false,
      reasoning: `${missingCodes.join(', ')} missing from evaluation`,
      elevatedTierDecision: {
        qualifies: false,
        requirements: Object.fromEntries(
          REQUIRED.map((code) => [
            code,
            {
              name: elevatedTierRequirements.find((r) => r.code === code)?.name ?? code,
              result: (resultsMap.get(code)?.result as any) ?? 'NOT_EVALUATED',
            },
          ])
        ),
      },
    };
  }

  const evaluatedElevatedTierRequirements = elevatedTierRequirements.map((req) => resultsMap.get(req.code)!);

  const hasMissingData = evaluatedElevatedTierRequirements.some(
    (r) => r.computedValue?.missingData === true || r.result === 'PARTIAL' || r.result === 'NOT_EVALUATED',
  );

  const qualifies = evaluatedElevatedTierRequirements.every((r) => r.result === 'PASS');

  return {
    tierCode: tier.tierCode,
    rate: tier.rate,
    qualifies,
    reasoning: qualifies
      ? 'Elevated tier qualifies: all requirements met.'
      : hasMissingData
        ? 'Elevated tier not met: missing data (PARTIAL) treated as not qualifying.'
        : 'Elevated tier not met: one or more requirements failed.',
    elevatedTierDecision: {
      qualifies,
      requirements: Object.fromEntries(
        evaluatedElevatedTierRequirements.map((r) => [
          r.requirementCode,
          { name: r.requirementName, result: r.result as any },
        ])
      ),
    },
  };
}

function buildModifiers(
  isEligible: boolean,
  calculatorResults: Array<{
    requirementCode: string;
    requirementName: string;
    result: string;
    computedValue: Record<string, unknown>;
  }>,
): EligibilityContext['modifiers'] {
  const modifiers: EligibilityContext['modifiers'] = [];
  const resultByCode = new Map(
    calculatorResults.map((r) => [r.requirementCode, r]),
  );

  for (const mapping of MODIFIER_MAP) {
    const result = resultByCode.get(mapping.requirementCode);
    if (!result) continue;

    const dayPct = Number(result.computedValue.dayPercentage ?? 0);

    // Modifiers only apply when the base program is eligible.
    // PARTIAL (missingData) is not qualifying.
    const passes = isEligible && result.result === 'PASS';
    const hasMissingData = result.computedValue.missingData === true;

    modifiers.push({
      modifierCode: mapping.modifierCode,
      qualifies: passes,
      reasoning: !isEligible
        ? 'Base program not eligible — modifier not applicable.'
        : hasMissingData
          ? `${mapping.failureMessage} (missing data — treated as not qualifying)`
          : passes
            ? mapping.descriptionTemplate(dayPct)
            : mapping.failureMessage,
    });
  }

  return modifiers;
}

function summarizeFailure(computedValue: Record<string, unknown>): string {
  if (typeof computedValue.error === 'string') return computedValue.error;
  if (typeof computedValue.reason === 'string') return computedValue.reason;
  if (typeof computedValue.ratio === 'string' && typeof computedValue.threshold === 'string') {
    return `Ratio ${computedValue.ratio} below threshold ${computedValue.threshold}`;
  }
  return 'Requirement not met';
}

function normalizeProvince(raw: string | null | undefined): SupportedProvinceCode | null {
  if (!raw) return null;
  const trimmed = raw.trim().toUpperCase();
  const bare = trimmed.startsWith('CA-') ? trimmed.slice(3) : trimmed;
  return (SUPPORTED_PROVINCES as readonly string[]).includes(bare)
    ? (bare as SupportedProvinceCode)
    : null;
}

function generateValidCombinations(
  programs: StrategyProgramResult[],
): StrategyProgramResult[][] {
  const combinations: StrategyProgramResult[][] = [];
  const maxPrograms = Math.min(programs.length, 10);
  const totalMasks = 1 << maxPrograms;

  for (let mask = 1; mask < totalMasks; mask += 1) {
    const combo = sortProgramsForScenario(
      programs.filter((_, index) => (mask & (1 << index)) !== 0),
    );
    if (combo.length < 2) continue;
    if (hasExcludedPair(combo)) continue;
    combinations.push(combo);
  }

  return combinations;
}

function sortProgramsForScenario(
  programs: StrategyProgramResult[],
): StrategyProgramResult[] {
  return [...programs].sort((a, b) => {
    const orderA = getProgramTier(a.programCode);
    const orderB = getProgramTier(b.programCode);
    if (orderA !== orderB) return orderA - orderB;
    return a.programCode.localeCompare(b.programCode);
  });
}

function hasExcludedPair(programs: StrategyProgramResult[]): boolean {
  return isExcludedPair(programs.map((p) => p.programCode));
}

function describeRulesForCombination(programs: StrategyProgramResult[]): string[] {
  const codes = new Set(programs.map((program) => program.programCode));
  const descriptions: string[] = [];

  for (const rule of getAllGrindRules()) {
    if (codes.has(rule.sourceProgramCode) && codes.has(rule.targetProgramCode)) {
      descriptions.push(
        `${rule.sourceProgramCode} grinds ${rule.targetProgramCode}: ${rule.reason}`,
      );
    }
  }

  return descriptions;
}
