import { AssessmentResult } from '@storyos/types';
import type { RightsControlConfig } from '@storyos/types';
import type { Calculator, CalculatorInput, CalculatorOutput } from '../calculator.interface';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CalculatorContext } from '../calculator.context';

export class RightsControlCalculator implements Calculator {
  readonly code = 'rights_control';
  readonly version = '1.0.0';

  async evaluate(input: CalculatorInput, prisma: PrismaService, context: CalculatorContext): Promise<CalculatorOutput> {
    const config = input.configuration as RightsControlConfig;
    const requiredTypes = new Set(config.requiredControlTypes);
    const qualifyingCountries = new Set(config.qualifyingCountries);
    const requireProvince = config.requireProvinceMatch ?? null;
    const minRetention = config.minRetentionYears ?? null;

    const facts = await context.getRightsControlFacts();

    let missingData = false;
    const missingDataReasons: string[] = [];
    const factDetails: Array<{
      controlType: string;
      holderName: string;
      holderCountry: string;
      holderProvince: string | null;
      retentionYears: number | null;
      qualifying: boolean;
      reason: string;
    }> = [];

    const byType = new Map<string, boolean>();
    for (const type of requiredTypes) {
      const typeFacts = facts.filter((f) => f.controlType === (type as any));

      let hasQualifying = false;
      for (const f of typeFacts) {
        const countryOk = qualifyingCountries.has(f.holderCountry);
        const holderProvince = (f as any).holderProvinceState as string | null | undefined;
        const retentionYears = (f as any).retentionYears as number | null | undefined;

        let provinceOk = true;
        if (requireProvince) {
          if (!holderProvince) {
            missingData = true;
            missingDataReasons.push(`holderProvinceState is null on ${f.holderName} — cannot confirm ${requireProvince} rights.`);
            provinceOk = false;
          } else {
            const norm = holderProvince.replace(/^CA-/, '');
            provinceOk = norm === requireProvince;
          }
        }

        let retentionOk = true;
        if (minRetention !== null && type === 'COPYRIGHT_OWNERSHIP') {
          if (retentionYears == null) {
            missingData = true;
            missingDataReasons.push(`retentionYears is null on ${f.holderName} — cannot confirm ≥${minRetention} year retention.`);
            retentionOk = false;
          } else {
            retentionOk = retentionYears >= minRetention;
          }
        }

        const qualifying = countryOk && provinceOk && retentionOk;
        if (qualifying) hasQualifying = true;

        factDetails.push({
          controlType: f.controlType,
          holderName: f.holderName,
          holderCountry: f.holderCountry,
          holderProvince: holderProvince ?? null,
          retentionYears: retentionYears ?? null,
          qualifying,
          reason: !countryOk
            ? `Country ${f.holderCountry} is not in qualifying list.`
            : !provinceOk
              ? holderProvince
                ? `Province ${holderProvince} does not match required ${requireProvince}.`
                : `Province data missing — cannot confirm ${requireProvince}.`
              : !retentionOk
                ? retentionYears != null
                  ? `Retention ${retentionYears} years < required ${minRetention}.`
                  : `Retention years missing — cannot confirm ≥${minRetention}.`
                : 'Qualifying.',
        });
      }

      byType.set(type, hasQualifying);
    }

    const allPass = Array.from(byType.values()).every(Boolean);
    const result = missingData
      ? AssessmentResult.PARTIAL
      : allPass
        ? AssessmentResult.PASS
        : AssessmentResult.FAIL;

    return {
      result,
      computedValue: {
        requiredControlTypes: config.requiredControlTypes,
        qualifyingCountries: config.qualifyingCountries,
        ...(requireProvince ? { requireProvinceMatch: requireProvince } : {}),
        ...(minRetention !== null ? { minRetentionYears: minRetention } : {}),
        byType: Object.fromEntries(byType),
        factCount: facts.length,
        factDetails,
        ...(missingData ? { missingData: true, missingDataReasons } : {}),
      },
      calculatorCode: this.code,
      calculatorVersion: this.version,
    };
  }
}
