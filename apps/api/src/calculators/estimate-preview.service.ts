import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AssessmentResult,
  BudgetVersionStatus,
  EvaluationSource,
  ProjectProgramStatus,
} from '@storyos/types';
import type { RequirementConfig } from '@storyos/types';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.context';
import { TenantAwareService } from '../tenant/tenant-aware.service';
import { CalculatorRegistry } from './calculator.registry';
import { CalculatorContext } from './calculator.context';
import type { CalculatorInput, CalculatorOutput } from './calculator.interface';

interface PreviewRequirementResult {
  requirementId: string;
  requirementCode: string;
  category: string;
  result: AssessmentResult;
  computedValue: Record<string, unknown>;
  trace?: {
    detailedBreakdown: Record<string, unknown>;
  };
  calculatorCode: string;
}

interface PreviewProgramResult {
  projectProgramId: string;
  programName: string;
  results: PreviewRequirementResult[];
}

export interface EstimatePreviewResponse {
  programs: PreviewProgramResult[];
}

@Injectable()
export class EstimatePreviewService extends TenantAwareService {
  constructor(
    prisma: PrismaService,
    tenant: TenantContext,
    private readonly registry: CalculatorRegistry,
  ) {
    super(prisma, tenant);
  }

  async preview(
    projectId: string,
    programIds?: string[],
    budgetVersionId?: string,
  ): Promise<EstimatePreviewResponse> {
    await this.assertProjectExists(projectId);

    const enrollments = await this.loadEnrollments(projectId, programIds);
    if (enrollments.length === 0) {
      return { programs: [] };
    }

    const resolvedBudgetVersionId =
      budgetVersionId ?? (await this.resolveBudgetVersionId(projectId));

    const programs: PreviewProgramResult[] = [];

    for (const enrollment of enrollments) {
      const requirements = await this.prisma.programRequirement.findMany({
        where: { programVersionId: enrollment.programVersionId },
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      });

      if (requirements.length === 0) {
        programs.push({
          projectProgramId: enrollment.id,
          programName: enrollment.programVersion.name,
          results: [],
        });
        continue;
      }

      const contextInput: CalculatorInput = {
        submissionId: '',
        projectId,
        organizationId: this.organizationId,
        evaluationDate: new Date(),
        budgetVersionId: resolvedBudgetVersionId,
        evaluationSource: EvaluationSource.BUDGET,
        requirementId: '',
        requirementCode: '',
        requirementCategory: requirements[0]!.requirementCategory as any,
        configuration: requirements[0]!.configuration as RequirementConfig,
      };
      const context = new CalculatorContext(this.prisma, contextInput);

      const results: PreviewRequirementResult[] = [];

      for (const req of requirements) {
        const calculator = this.registry.getCalculator(req.requirementCategory as any);

        if (!calculator) {
          results.push({
            requirementId: req.id,
            requirementCode: req.code,
            category: req.requirementCategory,
            result: AssessmentResult.NOT_EVALUATED,
            computedValue: {
              reason: `No calculator registered for ${req.requirementCategory}`,
            },
            calculatorCode: 'none',
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

        results.push({
          requirementId: req.id,
          requirementCode: req.code,
          category: req.requirementCategory,
          result: output.result,
          computedValue: output.computedValue,
          trace: output.trace,
          calculatorCode: output.calculatorCode,
        });
      }

      programs.push({
        projectProgramId: enrollment.id,
        programName: enrollment.programVersion.name,
        results,
      });
    }

    return { programs };
  }

  private async assertProjectExists(projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: this.tenantFilter({ id: projectId }),
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');
  }

  private async loadEnrollments(projectId: string, programIds?: string[]) {
    return this.prisma.projectProgram.findMany({
      where: this.tenantFilter({
        projectId,
        status: ProjectProgramStatus.ACTIVE,
        ...(programIds?.length ? { id: { in: programIds } } : {}),
      }),
      include: {
        programVersion: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Picks the latest LOCKED version for this project's budget.
   * Falls back to the latest DRAFT if nothing is locked.
   * Returns null if the project has no budget versions at all.
   */
  private async resolveBudgetVersionId(
    projectId: string,
  ): Promise<string | null> {
    const budget = await this.prisma.budget.findFirst({
      where: this.tenantFilter({ projectId }),
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
}
