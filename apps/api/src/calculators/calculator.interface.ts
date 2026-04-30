import { RequirementCategory, AssessmentResult, EvaluationSource } from '@storyos/types';
import type { RequirementConfig } from '@storyos/types';
import type { PrismaService } from '../prisma/prisma.service';
import type { CalculatorContext } from './calculator.context';

export interface CalculatorInput {
  submissionId: string;
  projectId: string;
  organizationId: string;
  evaluationDate: Date;
  requirementId: string;
  requirementCode: string;
  requirementCategory: RequirementCategory;
  configuration: RequirementConfig;
  budgetVersionId: string | null;
  evaluationSource: EvaluationSource;
  /** Per-account source overrides for BLENDED evaluation. Key = budgetAccountId. */
  accountSourceOverrides?: Map<string, EvaluationSource>;
}

export interface CalculatorOutput {
  result: AssessmentResult;
  computedValue: Record<string, unknown>;
  trace?: {
    detailedBreakdown: Record<string, unknown>;
  };
  calculatorCode: string;
  calculatorVersion: string;
}

export interface Calculator {
  readonly code: string;
  readonly version: string;
  evaluate(
    input: CalculatorInput,
    prisma: PrismaService,
    context: CalculatorContext,
  ): Promise<CalculatorOutput>;
}
