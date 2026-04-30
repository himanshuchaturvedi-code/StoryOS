import { AssessmentResult } from '@storyos/types';
import type { Calculator, CalculatorInput, CalculatorOutput } from '../calculator.interface';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CalculatorContext } from '../calculator.context';

/**
 * Evaluates whether a project has an explicit province-based producer credit.
 *
 * PASS if at least one ProjectOwnership row has:
 *   - isProducer = true
 *   - entityProvinceState matches the configured province
 *
 * This is intentionally separate from CanadianControlCalculator, which
 * evaluates aggregate ownership percentages and chain resolution. Producer
 * credit is a binary presence check on a specific province — not a
 * threshold or graph walk.
 *
 * Assumptions documented for future tightening:
 *   - "Producer credit" is currently proxied through ProjectOwnership.isProducer.
 *     A future schema may introduce a dedicated ProducerCredit entity with
 *     guild/union affiliation and credit type (e.g. "produced by" vs
 *     "executive producer").
 *   - Province matching uses entityProvinceState, which is user-entered.
 *     No inference from city, postal code, or country.
 */
export class ProducerCreditCalculator implements Calculator {
  readonly code = 'producer_credit';
  readonly version = '1.0.0';

  async evaluate(
    input: CalculatorInput,
    _prisma: PrismaService,
    context: CalculatorContext,
  ): Promise<CalculatorOutput> {
    const config = input.configuration as { producerProvinceMatch?: string };
    const requiredProvince = config.producerProvinceMatch;

    if (!requiredProvince) {
      return {
        result: AssessmentResult.NOT_EVALUATED,
        computedValue: {
          reason: 'producerProvinceMatch not configured — cannot evaluate producer credit.',
        },
        calculatorCode: this.code,
        calculatorVersion: this.version,
      };
    }

    const projectOwnerships = await context.getProjectOwnerships();
    const producerRows = projectOwnerships.filter((po) => po.isProducer);
    let missingProvinceData = false;

    const matchedEntities: Array<{
      entityName: string;
      entityCountry: string;
      entityProvinceState: string | null;
      qualifies: boolean;
      reason: string;
    }> = producerRows.map((po) => {
      const rawProvince = (po as any).entityProvinceState as string | null | undefined;
      const normalizedProvince = rawProvince?.replace(/^CA-/, '') ?? null;
      const qualifies = normalizedProvince === requiredProvince;

      if (!rawProvince) missingProvinceData = true;

      return {
        entityName: po.entityName,
        entityCountry: po.entityCountry,
        entityProvinceState: normalizedProvince,
        qualifies,
        reason: qualifies
          ? `Producer entity is based in ${requiredProvince}.`
          : rawProvince
            ? `Producer entity province ${normalizedProvince} does not match required ${requiredProvince}.`
            : 'entityProvinceState is null — cannot confirm province-based producer credit.',
      };
    });

    const matchingProducerCount = matchedEntities.filter((p) => p.qualifies).length;
    const passes = matchingProducerCount > 0;

    return {
      result: passes
        ? AssessmentResult.PASS
        : missingProvinceData
          ? AssessmentResult.PARTIAL
          : AssessmentResult.FAIL,
      computedValue: {
        requiredProvince,
        producerCount: producerRows.length,
        matchingProducerCount,
        matchedEntities,
        producerCreditPass: passes,
        ...(missingProvinceData
          ? {
              missingData: true,
              missingDataReason:
                'entityProvinceState is null on one or more producer ownership rows',
            }
          : {}),
        assumptions: [
          'Producer credit proxied via ProjectOwnership.isProducer + entityProvinceState.',
          'No guild/union affiliation or credit-type distinction is applied.',
          'Province is user-entered; no inference from city or country.',
        ],
      },
      trace: {
        detailedBreakdown: {
          type: 'producerProvinceCredit',
          requiredProvince,
          producerCount: producerRows.length,
          matchingProducerCount,
          matchedEntities,
          status: passes ? 'PASS' : missingProvinceData ? 'PARTIAL' : 'FAIL',
          reason: passes
            ? `At least one producer entity is based in ${requiredProvince}.`
            : missingProvinceData
              ? 'Producer province data is missing — cannot confirm credit.'
              : `No producer entity is based in ${requiredProvince}.`,
        },
      },
      calculatorCode: this.code,
      calculatorVersion: this.version,
    };
  }
}
