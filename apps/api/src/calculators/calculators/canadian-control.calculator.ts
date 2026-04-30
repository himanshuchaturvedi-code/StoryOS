import { Prisma } from '@storyos/database';
import { AssessmentResult } from '@storyos/types';
import type { CanadianControlConfig } from '@storyos/types';
import type { Calculator, CalculatorInput, CalculatorOutput } from '../calculator.interface';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CalculatorContext } from '../calculator.context';

const Decimal = Prisma.Decimal;
const MAX_DEPTH = 10;

export class CanadianControlCalculator implements Calculator {
  readonly code = 'canadian_control';
  readonly version = '1.1.0';

  async evaluate(input: CalculatorInput, prisma: PrismaService, context: CalculatorContext): Promise<CalculatorOutput> {
    const config = input.configuration as CanadianControlConfig;
    const qualifyingCountries = new Set(config.qualifyingCountries);

    const requireProvince = config.requireProvinceMatch ?? null;

    const [projectOwnerships, corporateOwnerships, rightsControlFacts] = await Promise.all([
      context.getProjectOwnerships(),
      context.getCorporateOwnerships(),
      config.requireCreativeControl || config.requireFinancialControl
        ? context.getRightsControlFacts()
        : Promise.resolve([]),
    ]);

    const ownershipMap = new Map<string, Array<{ parent: string; parentCountry: string; pct: Prisma.Decimal }>>();
    for (const co of corporateOwnerships) {
      const key = `${co.childEntityName}|${co.childEntityCountry}`;
      if (!ownershipMap.has(key)) ownershipMap.set(key, []);
      ownershipMap.get(key)!.push({
        parent: co.parentEntityName,
        parentCountry: co.parentEntityCountry,
        pct: co.ownershipPercentage,
      });
    }

    let totalQualifying = new Decimal(0);
    let totalOwnership = new Decimal(0);
    let graphInvalid = false;
    let graphInvalidReason = '';
    let missingProvinceData = false;
    const ownershipRows: Array<{
      productionCompany: string;
      country: string;
      province?: string | null;
      ownershipPercentage: string;
      qualifying: boolean;
      status: string;
      reason: string;
      chain: Array<{ entityName: string; country: string }>;
    }> = [];

    for (const po of projectOwnerships) {
      if (!po.isProducer) continue;

      const pct = new Decimal(po.ownershipPercentage.toString());
      totalOwnership = totalOwnership.add(pct);

      if (requireProvince) {
        const entityProvince = (po as any).entityProvinceState as string | null | undefined;
        if (!entityProvince) {
          missingProvinceData = true;
          ownershipRows.push({
            productionCompany: po.entityName,
            country: po.entityCountry,
            province: null,
            ownershipPercentage: pct.toFixed(2),
            qualifying: false,
            status: 'Excluded',
            reason: `entityProvinceState is null — cannot confirm ${requireProvince} ownership. Data entry required.`,
            chain: [{ entityName: po.entityName, country: po.entityCountry }],
          });
          continue;
        }
        const normProvince = entityProvince.replace(/^CA-/, '');
        if (normProvince !== requireProvince) {
          ownershipRows.push({
            productionCompany: po.entityName,
            country: po.entityCountry,
            province: normProvince,
            ownershipPercentage: pct.toFixed(2),
            qualifying: false,
            status: 'Excluded',
            reason: `Entity province ${normProvince} does not match required ${requireProvince}.`,
            chain: [{ entityName: po.entityName, country: po.entityCountry }],
          });
          continue;
        }
      }

      const walkResult = this.walkOwnershipChain(
        po.entityName,
        po.entityCountry,
        ownershipMap,
        qualifyingCountries,
        new Set<string>(),
        0,
      );
      if (walkResult === 'invalid_cycle') {
        graphInvalid = true;
        graphInvalidReason = 'Ownership chain contains a cycle';
        ownershipRows.push({
          productionCompany: po.entityName,
          country: po.entityCountry,
          ownershipPercentage: pct.toFixed(2),
          qualifying: false,
          status: 'Invalid',
          reason: graphInvalidReason,
          chain: [{ entityName: po.entityName, country: po.entityCountry }],
        });
        break;
      }
      if (walkResult === 'invalid_depth') {
        graphInvalid = true;
        graphInvalidReason = `Ownership chain exceeds maximum depth (${MAX_DEPTH})`;
        ownershipRows.push({
          productionCompany: po.entityName,
          country: po.entityCountry,
          ownershipPercentage: pct.toFixed(2),
          qualifying: false,
          status: 'Invalid',
          reason: graphInvalidReason,
          chain: [{ entityName: po.entityName, country: po.entityCountry }],
        });
        break;
      }
      if (walkResult === 'qualified') {
        totalQualifying = totalQualifying.add(pct);
      }

      const detailedWalk = this.walkOwnershipChainDetailed(
        po.entityName,
        po.entityCountry,
        ownershipMap,
        qualifyingCountries,
        new Set<string>(),
        0,
      );
      ownershipRows.push({
        productionCompany: po.entityName,
        country: po.entityCountry,
        ownershipPercentage: pct.toFixed(2),
        qualifying: detailedWalk.result === 'qualified',
        status: detailedWalk.result === 'qualified' ? 'Included' : 'Excluded',
        reason: detailedWalk.reason,
        chain: detailedWalk.chain,
      });
    }

    const minPct = new Decimal(config.minOwnershipPercentage);
    const qualifyingRatio = totalOwnership.isZero()
      ? new Decimal(0)
      : totalQualifying.div(totalOwnership);
    const ownershipPass = qualifyingRatio.gte(minPct.div(100));

    let creativePass = true;
    let financialPass = true;
    if (config.requireCreativeControl) {
      creativePass = rightsControlFacts.some(
        (r) => r.controlType === 'CREATIVE_CONTROL' && qualifyingCountries.has(r.holderCountry),
      );
    }
    if (config.requireFinancialControl) {
      financialPass = rightsControlFacts.some(
        (r) => r.controlType === 'FINANCIAL_CONTROL' && qualifyingCountries.has(r.holderCountry),
      );
    }

    const passes = ownershipPass && creativePass && financialPass;
    let result: AssessmentResult;
    if (graphInvalid || missingProvinceData) {
      result = AssessmentResult.PARTIAL;
    } else {
      result = passes ? AssessmentResult.PASS : AssessmentResult.FAIL;
    }

    return {
      result,
      computedValue: {
        totalQualifying: totalQualifying.toFixed(2),
        totalOwnership: totalOwnership.toFixed(2),
        qualifyingRatio: qualifyingRatio.toFixed(4),
        minOwnershipPercentage: config.minOwnershipPercentage,
        ownershipPass,
        creativePass,
        financialPass,
        qualifyingCountries: config.qualifyingCountries,
        producerCount: projectOwnerships.filter((p) => p.isProducer).length,
        ...(requireProvince ? { requireProvinceMatch: requireProvince } : {}),
        ...(missingProvinceData ? { missingData: true, missingDataReason: 'entityProvinceState is null on one or more producer ownership rows' } : {}),
        ...(graphInvalid ? { graphInvalid: true, graphInvalidReason } : {}),
      },
      trace: {
        detailedBreakdown: {
          type: 'canadianOwnershipControl',
          ownership: {
            productionCompanies: ownershipRows,
            canadianOwnershipPercentage: totalQualifying.toFixed(2),
            nonCanadianOwnershipPercentage: totalOwnership.sub(totalQualifying).toFixed(2),
            totalOwnershipPercentage: totalOwnership.toFixed(2),
            requiredCanadianOwnershipPercentage: config.minOwnershipPercentage,
            status: ownershipPass ? 'PASS' : 'FAIL',
            reason: ownershipPass
              ? `Canadian ownership is ${totalQualifying.toFixed(2)}%, meeting the ${config.minOwnershipPercentage}% threshold.`
              : `Canadian ownership is ${totalQualifying.toFixed(2)}%, below the ${config.minOwnershipPercentage}% threshold.`,
          },
          control: {
            creative: this.buildControlTrace(
              'CREATIVE_CONTROL',
              config.requireCreativeControl,
              creativePass,
              rightsControlFacts,
              qualifyingCountries,
            ),
            financial: this.buildControlTrace(
              'FINANCIAL_CONTROL',
              config.requireFinancialControl,
              financialPass,
              rightsControlFacts,
              qualifyingCountries,
            ),
          },
          failureReasons: [
            ...(!ownershipPass
              ? [
                  `Ownership: Canadian ownership is ${totalQualifying.toFixed(2)}%, below the ${config.minOwnershipPercentage}% threshold.`,
                ]
              : []),
            ...(!creativePass ? ['Creative control: no qualifying Canadian control holder recorded.'] : []),
            ...(!financialPass ? ['Financial control: no qualifying Canadian control holder recorded.'] : []),
            ...(graphInvalid ? [graphInvalidReason] : []),
          ],
        },
      },
      calculatorCode: this.code,
      calculatorVersion: this.version,
    };
  }

  private buildControlTrace(
    controlType: 'CREATIVE_CONTROL' | 'FINANCIAL_CONTROL',
    required: boolean,
    passes: boolean,
    rightsControlFacts: Awaited<ReturnType<CalculatorContext['getRightsControlFacts']>>,
    qualifyingCountries: Set<string>,
  ) {
    const facts = rightsControlFacts.filter((fact) => fact.controlType === controlType);
    return {
      required,
      status: !required ? 'NOT_REQUIRED' : passes ? 'PASS' : 'FAIL',
      holders: facts.map((fact) => {
        const qualifying = qualifyingCountries.has(fact.holderCountry);
        return {
          holderName: fact.holderName,
          holderCountry: fact.holderCountry,
          assertion: fact.assertion,
          evidenceNotes: fact.evidenceNotes,
          qualifying,
          status: qualifying ? 'Included' : 'Excluded',
          reason: qualifying ? undefined : 'Control holder is not in a qualifying country',
        };
      }),
      reason: !required
        ? 'Control test is not required for this requirement.'
        : passes
          ? 'At least one qualifying Canadian control holder is recorded.'
          : facts.length > 0
            ? 'Control is recorded, but no holder is in a qualifying country.'
            : 'No control holder is recorded.',
    };
  }

  private walkOwnershipChainDetailed(
    entityName: string,
    entityCountry: string,
    ownershipMap: Map<string, Array<{ parent: string; parentCountry: string; pct: Prisma.Decimal }>>,
    qualifyingCountries: Set<string>,
    visited: Set<string>,
    depth: number,
  ): {
    result: 'qualified' | 'not_qualified' | 'invalid_cycle' | 'invalid_depth';
    reason: string;
    chain: Array<{ entityName: string; country: string }>;
  } {
    const chain = [{ entityName, country: entityCountry }];
    if (depth >= MAX_DEPTH) {
      return {
        result: 'invalid_depth',
        reason: `Ownership chain exceeds maximum depth (${MAX_DEPTH})`,
        chain,
      };
    }

    const key = `${entityName}|${entityCountry}`;
    if (visited.has(key)) {
      return {
        result: 'invalid_cycle',
        reason: 'Ownership chain contains a cycle',
        chain,
      };
    }
    visited.add(key);

    if (qualifyingCountries.has(entityCountry)) {
      return {
        result: 'qualified',
        reason: `${entityName} is in a qualifying country (${entityCountry}).`,
        chain,
      };
    }

    const parents = ownershipMap.get(key);
    if (!parents?.length) {
      return {
        result: 'not_qualified',
        reason: `${entityName} is not in a qualifying country and no qualifying parent ownership chain is recorded.`,
        chain,
      };
    }

    let lastResult: {
      result: 'qualified' | 'not_qualified' | 'invalid_cycle' | 'invalid_depth';
      reason: string;
      chain: Array<{ entityName: string; country: string }>;
    } | null = null;
    for (const { parent, parentCountry } of parents) {
      const parentResult = this.walkOwnershipChainDetailed(
        parent,
        parentCountry,
        ownershipMap,
        qualifyingCountries,
        new Set(visited),
        depth + 1,
      );
      const resultWithChain = {
        ...parentResult,
        chain: [...chain, ...parentResult.chain],
      };
      if (parentResult.result === 'invalid_cycle' || parentResult.result === 'invalid_depth') {
        return resultWithChain;
      }
      if (parentResult.result === 'qualified') return resultWithChain;
      lastResult = resultWithChain;
    }

    return (
      lastResult ?? {
        result: 'not_qualified',
        reason: `${entityName} has parent ownership records, but none resolve to a qualifying country.`,
        chain,
      }
    );
  }

  private walkOwnershipChain(
    entityName: string,
    entityCountry: string,
    ownershipMap: Map<string, Array<{ parent: string; parentCountry: string; pct: Prisma.Decimal }>>,
    qualifyingCountries: Set<string>,
    visited: Set<string>,
    depth: number,
  ): 'qualified' | 'not_qualified' | 'invalid_cycle' | 'invalid_depth' {
    if (depth >= MAX_DEPTH) return 'invalid_depth';
    const key = `${entityName}|${entityCountry}`;
    if (visited.has(key)) return 'invalid_cycle';
    visited.add(key);

    if (qualifyingCountries.has(entityCountry)) return 'qualified';

    const parents = ownershipMap.get(key);
    if (!parents?.length) return 'not_qualified';

    for (const { parent, parentCountry } of parents) {
      const childResult = this.walkOwnershipChain(parent, parentCountry, ownershipMap, qualifyingCountries, visited, depth + 1);
      if (childResult === 'invalid_cycle' || childResult === 'invalid_depth') return childResult;
      if (childResult === 'qualified') return 'qualified';
    }
    return 'not_qualified';
  }
}
