import { Prisma } from '@storyos/database';
import { AssessmentResult, VALID_REGION_CODES } from '@storyos/types';
import type { RegionalSpendConfig } from '@storyos/types';
import type { Calculator, CalculatorInput, CalculatorOutput } from '../calculator.interface';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CalculatorContext } from '../calculator.context';

const Decimal = Prisma.Decimal;

export class RegionalSpendCalculator implements Calculator {
  readonly code = 'regional_spend';
  readonly version = '1.1.0';

  async evaluate(input: CalculatorInput, prisma: PrismaService, context: CalculatorContext): Promise<CalculatorOutput> {
    const config = input.configuration as RegionalSpendConfig;

    const invalidCodes = (config.regionCodes ?? []).filter(
      (c) => !VALID_REGION_CODES.has(c),
    );
    if (invalidCodes.length > 0) {
      return {
        result: AssessmentResult.NOT_EVALUATED,
        computedValue: {
          missingData: true,
          missingFields: [`Unknown regionCodes: ${invalidCodes.join(', ')}`],
        },
        calculatorCode: this.code,
        calculatorVersion: this.version,
      };
    }

    const regionSet = new Set(config.regionCodes ?? []);
    const regionSummaries = await context.getActivityRegionSummary();

    let totalDays = 0;
    let regionalDays = 0;
    let unclassifiedDays = 0;
    const invalidDataCodes: string[] = [];
    for (const s of regionSummaries) {
      totalDays += s.totalDays;
      if (!s.regionCode) {
        unclassifiedDays += s.totalDays;
      } else if (!VALID_REGION_CODES.has(s.regionCode)) {
        invalidDataCodes.push(s.regionCode);
        unclassifiedDays += s.totalDays;
      } else if (regionSet.has(s.regionCode as any)) {
        regionalDays += s.totalDays;
      }
    }

    if (totalDays === 0) {
      return {
        result: AssessmentResult.FAIL,
        computedValue: {
          missingData: true,
          missingFields: ['activityDays'],
          totalDays: 0,
          regionalDays: 0,
          dayPercentage: '0',
          regionCodes: config.regionCodes,
        },
        calculatorCode: this.code,
        calculatorVersion: this.version,
      };
    }

    const dayPercentage = new Decimal(regionalDays).div(totalDays);

    let result = AssessmentResult.PASS;

    if (config.minDays !== undefined && regionalDays < config.minDays) {
      result = AssessmentResult.FAIL;
    }
    if (
      config.minDayPercentage !== undefined &&
      dayPercentage.lt(new Decimal(config.minDayPercentage))
    ) {
      result = AssessmentResult.FAIL;
    }

    const dataWarnings: string[] = [];
    if (invalidDataCodes.length > 0) {
      dataWarnings.push(`Unknown incentiveRegionCode on activity locations: ${[...new Set(invalidDataCodes)].join(', ')}`);
    }
    if (unclassifiedDays > 0) {
      dataWarnings.push(`${unclassifiedDays} activity day(s) have no or unrecognized incentiveRegionCode`);
    }

    return {
      result,
      computedValue: {
        totalDays,
        regionalDays,
        unclassifiedDays,
        dayPercentage: dayPercentage.toFixed(4),
        regionCodes: config.regionCodes,
        minDays: config.minDays ?? null,
        minDayPercentage: config.minDayPercentage ?? null,
        bonusRate: config.bonusRate ?? null,
        ...(dataWarnings.length > 0 ? { dataWarnings } : {}),
      },
      calculatorCode: this.code,
      calculatorVersion: this.version,
    };
  }
}
