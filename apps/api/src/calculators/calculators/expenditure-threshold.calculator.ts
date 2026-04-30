import { Prisma } from '@storyos/database';
import { AssessmentResult } from '@storyos/types';
import type { ExpenditureThresholdConfig } from '@storyos/types';
import type { Calculator, CalculatorInput, CalculatorOutput } from '../calculator.interface';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CalculatorContext } from '../calculator.context';

const Decimal = Prisma.Decimal;

export class ExpenditureThresholdCalculator implements Calculator {
  readonly code = 'expenditure_threshold';
  readonly version = '2.0.0';

  async evaluate(input: CalculatorInput, _prisma: PrismaService, context: CalculatorContext): Promise<CalculatorOutput> {
    const config = input.configuration as ExpenditureThresholdConfig;

    if (config.provinceRatioMode) {
      return this.evaluateProvinceRatio(input, context, config);
    }

    const records = await context.getSpendRecords({
      isLabour: config.labourOnly === true ? true : undefined,
      isService: config.serviceOnly === true ? true : undefined,
      accountTypes: config.accountTypes as string[] | undefined,
    });

    let totalEligible = new Decimal(0);
    for (const record of records) {
      const amount = record.labourAmount && config.labourOnly
        ? new Decimal(record.labourAmount)
        : new Decimal(record.amount);
      const portion = new Decimal(record.eligiblePortion);
      totalEligible = totalEligible.add(amount.mul(portion));
    }

    const minAmount = config.minAmount !== undefined ? new Decimal(config.minAmount) : null;
    const maxAmount = config.maxAmount !== undefined ? new Decimal(config.maxAmount) : null;

    let result: AssessmentResult;
    if (minAmount && totalEligible.lt(minAmount)) {
      result = AssessmentResult.FAIL;
    } else if (maxAmount && totalEligible.gt(maxAmount)) {
      result = AssessmentResult.FAIL;
    } else {
      result = AssessmentResult.PASS;
    }

    const currency = config.currency || 'CAD';

    return {
      result,
      computedValue: {
        evaluationSource: input.evaluationSource,
        totalEligible: totalEligible.toFixed(2),
        recordCount: records.length,
        currency,
        ...(minAmount ? { minAmount: minAmount.toFixed(2) } : {}),
        ...(maxAmount ? { maxAmount: maxAmount.toFixed(2) } : {}),
        labourOnly: config.labourOnly ?? false,
        serviceOnly: config.serviceOnly ?? false,
        accountTypesFilter: config.accountTypes ?? null,
      },
      calculatorCode: this.code,
      calculatorVersion: this.version,
    };
  }

  /**
   * Province-ratio mode: checks that province spend / total spend OR
   * province labour / total labour meets configurable thresholds.
   * Used by FTTC elevated tier (≥60% AB spend OR ≥70% AB labour).
   */
  private async evaluateProvinceRatio(
    input: CalculatorInput,
    context: CalculatorContext,
    config: ExpenditureThresholdConfig,
  ): Promise<CalculatorOutput> {
    const provinceCode = config.provinceMatch;
    if (!provinceCode) {
      return {
        result: AssessmentResult.FAIL,
        computedValue: { error: 'provinceRatioMode requires provinceMatch to be set.' },
        calculatorCode: this.code,
        calculatorVersion: this.version,
      };
    }

    const allRecords = await context.getSpendRecords();
    const provinceFilter = `CA-${provinceCode}`;

    let totalSpend = new Decimal(0);
    let provinceSpend = new Decimal(0);
    let totalLabour = new Decimal(0);
    let provinceLabour = new Decimal(0);
    let missingLocationCount = 0;
    let excludedIneligibleCount = 0;

    for (const r of allRecords) {
      if (r.taxCreditIneligible) {
        excludedIneligibleCount++;
        continue;
      }

      const amt = new Decimal(r.amount).mul(new Decimal(r.eligiblePortion));
      totalSpend = totalSpend.add(amt);

      const isProvince =
        r.location?.provinceState === provinceFilter ||
        r.location?.provinceState === provinceCode;

      if (!r.location?.provinceState) {
        missingLocationCount++;
      }

      if (isProvince) {
        provinceSpend = provinceSpend.add(amt);
      }

      if (r.isLabour) {
        const labAmt = r.labourAmount
          ? new Decimal(r.labourAmount).mul(new Decimal(r.eligiblePortion))
          : amt;
        totalLabour = totalLabour.add(labAmt);
        if (isProvince) {
          provinceLabour = provinceLabour.add(labAmt);
        }
      }
    }

    const spendRatio = totalSpend.isZero()
      ? new Decimal(0)
      : provinceSpend.div(totalSpend);
    const labourRatio = totalLabour.isZero()
      ? new Decimal(0)
      : provinceLabour.div(totalLabour);

    const minSpend = config.minSpendRatio ?? 1;
    const minLabour = config.minLabourRatio ?? 1;
    const mode = config.comparisonMode ?? 'either';

    const spendPass = spendRatio.gte(new Decimal(minSpend));
    const labourPass = labourRatio.gte(new Decimal(minLabour));

    const passes = mode === 'either'
      ? spendPass || labourPass
      : spendPass && labourPass;

    const missingData = missingLocationCount > 0;

    return {
      result: missingData
        ? AssessmentResult.PARTIAL
        : passes
          ? AssessmentResult.PASS
          : AssessmentResult.FAIL,
      computedValue: {
        evaluationSource: input.evaluationSource,
        provinceMatch: provinceCode,
        totalSpend: totalSpend.toFixed(2),
        provinceSpend: provinceSpend.toFixed(2),
        spendRatio: spendRatio.toFixed(4),
        minSpendRatio: minSpend,
        spendPass,
        totalLabour: totalLabour.toFixed(2),
        provinceLabour: provinceLabour.toFixed(2),
        labourRatio: labourRatio.toFixed(4),
        minLabourRatio: minLabour,
        labourPass,
        comparisonMode: mode,
        passes,
        ...(excludedIneligibleCount > 0 ? { excludedIneligibleCount } : {}),
        ...(missingData ? {
          missingData: true,
          missingDataReason: `${missingLocationCount} spend record(s) have no location/province — ratios may be understated.`,
        } : {}),
      },
      calculatorCode: this.code,
      calculatorVersion: this.version,
    };
  }
}
