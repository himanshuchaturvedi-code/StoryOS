import { AssessmentResult } from '@storyos/types';
import type { ActivityDayMinimumConfig } from '@storyos/types';
import type { Calculator, CalculatorInput, CalculatorOutput } from '../calculator.interface';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CalculatorContext } from '../calculator.context';

export class ActivityDayMinimumCalculator implements Calculator {
  readonly code = 'activity_day_minimum';
  readonly version = '1.0.0';

  async evaluate(input: CalculatorInput, prisma: PrismaService, context: CalculatorContext): Promise<CalculatorOutput> {
    const config = input.configuration as ActivityDayMinimumConfig;

    const { distinctCalendarDaysTotal: distinctDays } = await context.getActivityDaySummary({
      locationFilter: config.locationFilter,
      phaseIds: config.phaseFilter,
    });
    const passes = distinctDays >= config.minDays;
    const result = passes ? AssessmentResult.PASS : AssessmentResult.FAIL;

    return {
      result,
      computedValue: {
        distinctDays,
        minDays: config.minDays,
        locationFilter: config.locationFilter ?? null,
        phaseFilter: config.phaseFilter ?? null,
      },
      calculatorCode: this.code,
      calculatorVersion: this.version,
    };
  }
}
