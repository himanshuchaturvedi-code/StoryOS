import { AssessmentResult } from '@storyos/types';
import type { Calculator, CalculatorInput, CalculatorOutput } from '../calculator.interface';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CalculatorContext } from '../calculator.context';

export class CustomCalculator implements Calculator {
  readonly code = 'custom';
  readonly version = '1.0.0';

  async evaluate(_input: CalculatorInput, _prisma: PrismaService, _context: CalculatorContext): Promise<CalculatorOutput> {
    return {
      result: AssessmentResult.NOT_EVALUATED,
      computedValue: {
        message: 'CUSTOM requirements require manual assessment. No automated calculator is available.',
      },
      calculatorCode: this.code,
      calculatorVersion: this.version,
    };
  }
}
