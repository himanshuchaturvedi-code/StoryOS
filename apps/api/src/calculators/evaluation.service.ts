import { createHash } from 'node:crypto';
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@storyos/database';
import type { PrismaClient } from '@storyos/database';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.context';
import { TenantAwareService } from '../tenant/tenant-aware.service';
import { AssessmentResult, EvaluationSource, SubmissionStatus } from '@storyos/types';
import type { RequirementConfig } from '@storyos/types';
import { CalculatorRegistry } from './calculator.registry';
import { CalculatorContext } from './calculator.context';
import type { CalculatorInput, CalculatorOutput } from './calculator.interface';
import { GrantEstimatorService } from '../grants/grant-estimator.service';
import { SUPPORTED_PROVINCES } from '../grants/dto/estimate-grant.dto';
import type { SupportedProvinceCode } from '../grants/dto/estimate-grant.dto';

/**
 * Fallback when `Program.provinceState` is unset (legacy rows). Prefer DB metadata.
 * Keys are canonical `Program.code` values from seed / admin data.
 */
const PROGRAM_CODE_TO_ESTIMATOR_PROVINCE: Partial<
  Record<string, SupportedProvinceCode>
> = {
  FTTC: 'AB',
  AMPG: 'AB',
  OFTTC: 'ON',
  OPSTC: 'ON',
  OCASE: 'ON',
  'BC-PSTC': 'BC',
  FIBC: 'BC',
};

function normalizeProgramProvinceForEstimator(
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

export interface EvaluationResultItem {
  requirementId: string;
  result: AssessmentResult;
  computedValue: Record<string, unknown>;
  trace?: {
    detailedBreakdown: Record<string, unknown>;
  };
  calculatorCode: string;
  calculatorVersion: string;
}

@Injectable()
export class EvaluationService extends TenantAwareService {
  private readonly logger = new Logger(EvaluationService.name);

  constructor(
    prisma: PrismaService,
    tenant: TenantContext,
    private readonly registry: CalculatorRegistry,
    private readonly grantEstimator: GrantEstimatorService,
  ) {
    super(prisma, tenant);
  }

  async evaluateSubmission(
    projectId: string,
    projectProgramId: string,
    submissionId: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.acquireEvaluationLock(tx, submissionId);
        return this.runEvaluation(tx, projectId, projectProgramId, submissionId);
      },
      { timeout: 60_000 },
    );
  }

  private async acquireEvaluationLock(tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>, submissionId: string): Promise<void> {
    const hash = createHash('md5').update('eval:' + submissionId).digest();
    // Single-arg pg_advisory_xact_lock(bigint) exists; the two-arg form is (int4, int4) only — Prisma
    // bound two JS numbers as bigint and Postgres had no matching overload (42883).
    const key = hash.readBigInt64BE(0);
    await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock($1)', key);
  }

  private async runEvaluation(
    tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
    projectId: string,
    projectProgramId: string,
    submissionId: string,
  ) {
    const submission = await this.loadSubmission(tx, projectProgramId, submissionId);

      const allowedStatuses = [
        SubmissionStatus.DRAFT,
        SubmissionStatus.IN_REVIEW,
      ];
      if (!allowedStatuses.includes(submission.status as SubmissionStatus)) {
        throw new BadRequestException(
          `Cannot evaluate a submission with status ${submission.status}. Only DRAFT and IN_REVIEW submissions can be evaluated.`,
        );
      }

      if (submission.projectProgram.projectId !== projectId) {
        throw new BadRequestException(
          'Submission does not belong to the specified project',
        );
      }

    const evaluationDate = submission.evaluationDate;
    const budgetVersionId = submission.budgetVersionId;
    const programVersionId = submission.projectProgram.programVersionId;

    if (submission.evaluationSource === 'BLENDED' && !budgetVersionId) {
      throw new BadRequestException(
        'BLENDED evaluation requires a budgetVersionId on the submission',
      );
    }

    const requirements = await tx.programRequirement.findMany({
      where: { programVersionId },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });

    if (requirements.length === 0) {
      throw new BadRequestException(
        'No requirements found for this program version',
      );
    }

    await this.ensureAssessmentRows(tx, submissionId, requirements);

    const evaluationSource = this.resolveEvaluationSource(
      submission.evaluationSource,
      budgetVersionId,
    );

    let accountSourceOverrides: Map<string, EvaluationSource> | undefined;
    if (evaluationSource === EvaluationSource.BLENDED) {
      const overrides = await tx.submissionAccountSource.findMany({
        where: { submissionId, organizationId: this.organizationId },
      });
      if (overrides.length > 0) {
        accountSourceOverrides = new Map(
          overrides.map((o) => [o.budgetAccountId, o.source as EvaluationSource]),
        );
      }
    }

    const contextInput: CalculatorInput = {
      submissionId,
      projectId: submission.projectProgram.projectId,
      organizationId: this.organizationId,
      evaluationDate,
      budgetVersionId,
      evaluationSource,
      accountSourceOverrides,
      requirementId: '',
      requirementCode: '',
      requirementCategory: requirements[0]!.requirementCategory as any,
      configuration: requirements[0]!.configuration as RequirementConfig,
    };
    const context = new CalculatorContext(tx as any, contextInput);

    const results: EvaluationResultItem[] = [];

    for (const req of requirements) {
      const calculator = this.registry.getCalculator(req.requirementCategory as any);

      if (!calculator) {
        results.push({
          requirementId: req.id,
          result: AssessmentResult.NOT_EVALUATED,
          computedValue: { reason: `No calculator registered for ${req.requirementCategory}` },
          calculatorCode: 'none',
          calculatorVersion: '0.0.0',
        });
        continue;
      }

      const input: CalculatorInput = {
        ...contextInput,
        requirementId: req.id,
        requirementCode: req.code,
        requirementCategory: req.requirementCategory as any,
        configuration: req.configuration as RequirementConfig,
      };

      let output: CalculatorOutput;
      try {
        output = await calculator.evaluate(input, tx as any, context);
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

      await tx.requirementAssessment.update({
        where: {
          submissionId_requirementId: {
            submissionId,
            requirementId: req.id,
          },
        },
        data: {
          result: output.result,
          computedValue: output.computedValue as Prisma.InputJsonValue,
          calculatorCode: output.calculatorCode,
          calculatorVersion: output.calculatorVersion,
          assessedAt: new Date(),
          isAutoAssessed: true,
        },
      });

      results.push({
        requirementId: req.id,
        ...output,
      });
    }

    const program = submission.projectProgram.programVersion.program;
    const programCode = program.code;
    const programName = program.name;
    const provinceFromMeta = normalizeProgramProvinceForEstimator(
      program.provinceState,
    );
    const provinceFromCodeFallback =
      PROGRAM_CODE_TO_ESTIMATOR_PROVINCE[programCode] ?? null;
    const estimatorProvince = provinceFromMeta ?? provinceFromCodeFallback;
    const isSupportedProvince = Boolean(estimatorProvince);

    let estimatedAmount = 0;
    let estimates: any[] = [];
    const hasFails = results.some((r) => r.result === AssessmentResult.FAIL);

    if (isSupportedProvince) {
      try {
        const estimateDto = {
          projectId,
          province: estimatorProvince,
          source: evaluationSource as any,
          budgetVersionId: budgetVersionId || undefined,
          accountSourceOverrides: accountSourceOverrides
            ? Object.fromEntries(accountSourceOverrides)
            : undefined,
        };
        this.logger.log(
          `[grant estimate] before estimator: programCode=${programCode} programName=${JSON.stringify(
            programName,
          )} provinceState(raw)=${program.provinceState ?? 'null'} derivedProvince=${estimatorProvince} source=${evaluationSource}`,
        );
        const estRes = await this.grantEstimator.estimate(estimateDto as any);

        estimates = estRes.estimates;
        estimatedAmount = estRes.totalEstimatedAmount;
        this.logger.log(
          `[grant estimate] estimator output: totalEstimatedAmount=${estRes.totalEstimatedAmount} programs=${JSON.stringify(
            estRes.estimates.map((e) => ({
              programCode: e.programCode,
              estimatedAmount: e.estimatedAmount,
            })),
          )}`,
        );
      } catch (err) {
        estimates = [];
        estimatedAmount = 0;
        this.logger.warn(
          `[grant estimate] estimator failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    } else {
      this.logger.log(
        `[grant estimate] skipped: no supported province for programCode=${programCode} programName=${JSON.stringify(
          programName,
        )} provinceState(raw)=${program.provinceState ?? 'null'}`,
      );
    }

    return {
      submissionId,
      evaluationDate,
      results,
      estimatedAmount,
      estimates,
      isEligible: !hasFails,
    };
  }

  private async loadSubmission(
    tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
    projectProgramId: string,
    submissionId: string,
  ) {
    const submission = await tx.programSubmission.findFirst({
      where: this.tenantFilter({ id: submissionId, projectProgramId }),
      include: {
        projectProgram: {
          select: {
            id: true,
            projectId: true,
            programVersionId: true,
            programVersion: {
              select: {
                program: {
                  select: { code: true, name: true, provinceState: true },
                },
              },
            },
          },
        },
      },
    });
    if (!submission) {
      throw new NotFoundException('Submission not found');
    }
    return submission;
  }

  private resolveEvaluationSource(
    explicitSource: string | null | undefined,
    budgetVersionId: string | null,
  ): EvaluationSource {
    if (explicitSource && Object.values(EvaluationSource).includes(explicitSource as EvaluationSource)) {
      return explicitSource as EvaluationSource;
    }
    return budgetVersionId ? EvaluationSource.BUDGET : EvaluationSource.ACTUAL;
  }

  private async ensureAssessmentRows(
    tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
    submissionId: string,
    requirements: { id: string }[],
  ) {
    const existing = await tx.requirementAssessment.findMany({
      where: this.tenantFilter({ submissionId }),
      select: { requirementId: true },
    });
    const existingIds = new Set(existing.map((a) => a.requirementId));
    const toCreate = requirements.filter((r) => !existingIds.has(r.id));

    if (toCreate.length > 0) {
      await tx.requirementAssessment.createMany({
        data: toCreate.map((r) => ({
          submissionId,
          organizationId: this.organizationId,
          requirementId: r.id,
          result: AssessmentResult.NOT_EVALUATED,
        })),
        skipDuplicates: true,
      });
    }
  }
}
