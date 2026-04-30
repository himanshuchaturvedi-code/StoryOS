import { Prisma } from '@storyos/database';
import { AssessmentResult } from '@storyos/types';
import type { VendorEligibilityConfig } from '@storyos/types';
import type { Calculator, CalculatorInput, CalculatorOutput } from '../calculator.interface';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CalculatorContext } from '../calculator.context';

const Decimal = Prisma.Decimal;

export class VendorEligibilityCalculator implements Calculator {
  readonly code = 'vendor_eligibility';
  readonly version = '1.0.0';

  async evaluate(input: CalculatorInput, prisma: PrismaService, context: CalculatorContext): Promise<CalculatorOutput> {
    const config = input.configuration as VendorEligibilityConfig;

    const expenseFacts = (await context.getExpenseFacts()).filter((f) => f.vendorId != null);

    let totalAmount = new Decimal(0);
    let eligibleAmount = new Decimal(0);

    for (const fact of expenseFacts) {
      if (!fact.vendorId) continue;
      const amount = new Decimal(fact.actualLine.amount.toString()).mul(
        new Decimal(fact.eligiblePortion.toString()),
      );
      totalAmount = totalAmount.add(amount);

      const eligibility = await context.getVendorEligibilityAsOf(fact.vendorId!, config.programCode);

      if (eligibility?.status === config.requiredStatus) {
        eligibleAmount = eligibleAmount.add(amount);
      }
    }

    const ratio = totalAmount.isZero()
      ? new Decimal(1)
      : eligibleAmount.div(totalAmount);
    const passes = ratio.gte(1);
    const result = passes ? AssessmentResult.PASS : AssessmentResult.FAIL;

    return {
      result,
      computedValue: {
        totalAmount: totalAmount.toFixed(2),
        eligibleAmount: eligibleAmount.toFixed(2),
        ratio: ratio.toFixed(4),
        programCode: config.programCode,
        requiredStatus: config.requiredStatus,
        vendorFactCount: expenseFacts.length,
      },
      calculatorCode: this.code,
      calculatorVersion: this.version,
    };
  }
}
