import { Prisma } from '@storyos/database';
import { AssessmentResult } from '@storyos/types';
import type { LabourExpenditureConfig } from '@storyos/types';
import type { Calculator, CalculatorInput, CalculatorOutput } from '../calculator.interface';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CalculatorContext } from '../calculator.context';
import type { GrantEstimatorService } from '../../grants/grant-estimator.service';

const Decimal = Prisma.Decimal;

export class LabourExpenditureCalculator implements Calculator {
  readonly code = 'labour_expenditure';
  readonly version = '3.0.0';

  constructor(private readonly grantEstimator: GrantEstimatorService) {}

  async evaluate(input: CalculatorInput, _prisma: PrismaService, context: CalculatorContext): Promise<CalculatorOutput> {
    const config = input.configuration as LabourExpenditureConfig;

    if (input.requirementCode === 'CPTC_LABOUR_RATIO') {
      return this.evaluateFromCptcEstimatorTrace(input, config);
    }
    const threshold = new Decimal(config.threshold);
    const denominatorMode = config.denominatorMode ?? 'labour_total';
    const numeratorMode = config.numeratorMode ?? 'residency';

    const labourRecords = await context.getSpendRecords({ isLabour: true });

    let totalLabour = new Decimal(0);
    let qualifyingLabour = new Decimal(0);
    const warnings: string[] = [];
    let unassignedCount = 0;

    if (numeratorMode === 'location') {
      const locFilter = config.numeratorLocationFilter;
      for (const record of labourRecords) {
        const labourAmount = record.labourAmount
          ? new Decimal(record.labourAmount)
          : new Decimal(record.amount);
        const portion = new Decimal(record.eligiblePortion);
        const eligibleAmount = labourAmount.mul(portion);
        totalLabour = totalLabour.add(eligibleAmount);

        if (!record.location) {
          unassignedCount++;
          continue;
        }
        const matchCountry = !locFilter?.country || record.location.country === locFilter.country;
        const matchProvince = !locFilter?.provinceState || record.location.provinceState === locFilter.provinceState;
        
        let matchRegion = true;
        if (locFilter?.regionCodes?.length) {
          matchRegion = record.location.incentiveRegionCode != null && locFilter.regionCodes.includes(record.location.incentiveRegionCode as any);
        }

        if (matchCountry && matchProvince && matchRegion) {
          qualifyingLabour = qualifyingLabour.add(eligibleAmount);
        }
      }

      if (unassignedCount > 0) {
        warnings.push(`${unassignedCount} labour line(s) have no location — excluded from qualifying labour`);
      }
    } else {
      const qualifyingResidency = new Set(config.numeratorResidency ?? []);
      const personIds = labourRecords
        .map((r) => r.effectivePersonId)
        .filter((id): id is string => id !== null);
      const residencyMap = await context.getResidencyBatch([...new Set(personIds)]);

      for (const record of labourRecords) {
        const labourAmount = record.labourAmount
          ? new Decimal(record.labourAmount)
          : new Decimal(record.amount);
        const portion = new Decimal(record.eligiblePortion);
        const eligibleAmount = labourAmount.mul(portion);
        totalLabour = totalLabour.add(eligibleAmount);

        if (!record.effectivePersonId) {
          unassignedCount++;
          continue;
        }

        const residency = residencyMap.get(record.effectivePersonId);
        if (residency && qualifyingResidency.has(residency.residencyType as any)) {
          qualifyingLabour = qualifyingLabour.add(eligibleAmount);
        }
      }

      if (unassignedCount > 0) {
        warnings.push(`${unassignedCount} labour line(s) have no party assigned — excluded from qualifying labour`);
      }
    }

    let denominator = totalLabour;
    if (denominatorMode === 'qpe') {
      const allRecords = await context.getSpendRecords();
      denominator = new Decimal(0);
      for (const record of allRecords) {
        const portion = new Decimal(record.eligiblePortion);
        denominator = denominator.add(new Decimal(record.amount).mul(portion));
      }
    }

    const ratio = denominator.isZero()
      ? new Decimal(0)
      : qualifyingLabour.div(denominator);

    const passes =
      config.comparison === 'gte'
        ? ratio.gte(threshold)
        : ratio.lte(threshold);

    const result = passes ? AssessmentResult.PASS : AssessmentResult.FAIL;

    return {
      result,
      computedValue: {
        evaluationSource: input.evaluationSource,
        totalLabour: totalLabour.toFixed(2),
        qualifyingLabour: qualifyingLabour.toFixed(2),
        ...(denominatorMode === 'qpe'
          ? { totalQpe: denominator.toFixed(2), denominatorMode: 'qpe' as const }
          : { denominatorMode: 'labour_total' as const }),
        numeratorMode,
        ratio: ratio.toFixed(4),
        threshold: threshold.toFixed(4),
        comparison: config.comparison,
        ...(numeratorMode === 'location'
          ? { numeratorLocationFilter: config.numeratorLocationFilter ?? null }
          : { numeratorResidency: config.numeratorResidency ?? [] }),
        recordCount: labourRecords.length,
        unassignedCount,
        ...(warnings.length > 0 ? { warnings } : {}),
      },
      calculatorCode: this.code,
      calculatorVersion: this.version,
    };
  }

  private async evaluateFromCptcEstimatorTrace(
    input: CalculatorInput,
    config: LabourExpenditureConfig,
  ): Promise<CalculatorOutput> {
    const threshold = Number(config.threshold);
    try {
      const response = await this.grantEstimator.estimateByProgramCode({
        projectId: input.projectId,
        programCode: 'CPTC',
        source: input.evaluationSource as any,
        budgetVersionId: input.budgetVersionId ?? undefined,
      });
      const trace = (response.breakdown as { trace?: Record<string, unknown> } | undefined)?.trace;

      const grossBase = trace && typeof trace.grossBase === 'number' ? trace.grossBase : 0;
      const lines = Array.isArray(trace?.lines)
        ? (trace.lines as Array<{ amount?: number }>)
        : [];
      const totalBudget = lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
      const ratio = totalBudget > 0 ? grossBase / totalBudget : 0;

      const passes =
        config.comparison === 'gte' ? ratio >= threshold : ratio <= threshold;
      const result = passes ? AssessmentResult.PASS : AssessmentResult.FAIL;

      return {
        result,
        computedValue: {
          ratioSource: 'cptc_estimator_trace',
          evaluationSource: input.evaluationSource,
          ratio: ratio.toFixed(4),
          threshold: threshold.toFixed(4),
          comparison: config.comparison,
          trace,
        },
        calculatorCode: this.code,
        calculatorVersion: this.version,
      };
    } catch (err) {
      return {
        result: AssessmentResult.NOT_EVALUATED,
        computedValue: {
          ratioSource: 'cptc_estimator_trace',
          error: err instanceof Error ? err.message : 'CPTC estimator failed',
        },
        calculatorCode: this.code,
        calculatorVersion: this.version,
      };
    }
  }
}
