import { AssessmentResult } from '@storyos/types';
import type { DocumentationConfig } from '@storyos/types';
import type { Calculator, CalculatorInput, CalculatorOutput } from '../calculator.interface';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CalculatorContext } from '../calculator.context';

export class DocumentationCalculator implements Calculator {
  readonly code = 'documentation';
  readonly version = '1.0.0';

  async evaluate(input: CalculatorInput, prisma: PrismaService, context: CalculatorContext): Promise<CalculatorOutput> {
    const config = input.configuration as DocumentationConfig;

    const presence = await Promise.all(
      config.requiredCategories.map(async (cat) => ({
        category: cat,
        present: (await context.getDocumentsByCategory(cat)).length > 0,
      })),
    );
    const presentCategories = new Set(
      presence.filter((p) => p.present).map((p) => p.category),
    );
    const missing = config.requiredCategories.filter((c) => !presentCategories.has(c as any));
    const passes = missing.length === 0;
    const result = passes ? AssessmentResult.PASS : AssessmentResult.FAIL;

    return {
      result,
      computedValue: {
        requiredCategories: config.requiredCategories,
        optionalCategories: config.optionalCategories ?? null,
        presentCategories: Array.from(presentCategories),
        missingCategories: missing,
        categoriesWithDocs: presence.filter((p) => p.present).length,
      },
      calculatorCode: this.code,
      calculatorVersion: this.version,
    };
  }
}
