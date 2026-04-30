import { AssessmentResult, RoleCategory } from '@storyos/types';
import type { ResidencyTestConfig } from '@storyos/types';
import type { Calculator, CalculatorInput, CalculatorOutput } from '../calculator.interface';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CalculatorContext } from '../calculator.context';
import { FeatureFlags } from '../feature-flags';

interface ResidencyTraceRow {
  personId: string;
  personName: string;
  residencyType?: string;
  isQualifying: boolean;
  reason?: string;
}

interface PathComparisonResult {
  status: 'MATCH' | 'MISMATCH' | 'SKIPPED_NO_MAPPINGS' | 'SCOPE_DIFFERENCE';
  reason?: string;
  legacyQualifyingCount: number;
  derivedQualifyingCount: number;
  countDelta: number;
  legacyTotalParticipants: number;
  derivedTotalParticipants: number;
  missingInLegacy: string[]; // personIds
  missingInDerived: string[]; // personIds
  residencyMismatches: {
    personId: string;
    legacyQualifying: boolean;
    derivedQualifying: boolean;
  }[];
  fullyConsistent: boolean;
}

export class ResidencyTestCalculator implements Calculator {
  readonly code = 'residency_test';
  readonly version = '2.0.0';

  async evaluate(
    input: CalculatorInput,
    prisma: PrismaService,
    context: CalculatorContext,
  ): Promise<CalculatorOutput> {
    const config = input.configuration as ResidencyTestConfig;

    // Run both paths in parallel
    const [legacyResult, derivedResult] = await Promise.all([
      this.evaluateLegacyParticipantPath(input, prisma, context, config),
      this.evaluateDerivedBudgetPath(input, prisma, context, config),
    ]);

    const comparison = this.comparePaths(legacyResult, derivedResult, config);

    if (comparison.status === 'MISMATCH') {
      console.warn('[ResidencyTestCalculator] DUAL-PATH MISMATCH', JSON.stringify({
        calculatorCode: this.code,
        requirementCode: input.requirementCode,
        projectId: input.projectId,
        programCode: input.requirementCode.split('_')[0]!,
        comparison,
      }));
    }

    // Use derived path only when flag is on AND mappings exist for this program (or scope doesn't need them).
    const useDerived = FeatureFlags.USE_DERIVED_ROLES && comparison.status !== 'SKIPPED_NO_MAPPINGS';
    const authoritative = useDerived ? derivedResult : legacyResult;
    const shadow = useDerived ? legacyResult : derivedResult;

    return {
      result: authoritative.result,
      computedValue: {
        ...authoritative.computedValue,
        dualPath: {
          authoritativeSource: useDerived ? 'derived' : 'legacy',
          comparison,
        },
      },
      trace: {
        detailedBreakdown: {
          ...authoritative.trace!.detailedBreakdown,
          shadowPath: shadow.trace!.detailedBreakdown,
          dualPathComparison: comparison,
        },
      },
      calculatorCode: this.code,
      calculatorVersion: this.version,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Legacy path: ProjectParticipant + ProjectParticipantRole
  // ───────────────────────────────────────────────────────────────────────────

  private async evaluateLegacyParticipantPath(
    input: CalculatorInput,
    prisma: PrismaService,
    context: CalculatorContext,
    config: ResidencyTestConfig,
  ): Promise<CalculatorOutput> {
    const qualifyingResidency = new Set(config.qualifyingResidency);
    const allParticipants = await context.getParticipantsWithRoles();
    
    let participantsToCheck: typeof allParticipants = [];

    if (config.scope === 'all_participants') {
      participantsToCheck = allParticipants;
    } else if (config.scope === 'key_creative') {
      participantsToCheck = allParticipants.filter((p) =>
        p.roles.some((r) => r.roleType.category === RoleCategory.KEY_CREATIVE),
      );
    } else if (config.scope === 'specific_roles' && config.roleCodes?.length) {
      const roleCodeSet = new Set(config.roleCodes);
      participantsToCheck = allParticipants.filter((p) =>
        p.roles.some((r) => roleCodeSet.has(r.roleType.code)),
      );
    }

    // Deduplicate by personId
    const uniqueParticipants = new Map<string, typeof allParticipants[0]>();
    for (const p of participantsToCheck) {
      if (!uniqueParticipants.has(p.personId)) {
        uniqueParticipants.set(p.personId, p);
      }
    }

    const personIds = Array.from(uniqueParticipants.keys());
    const residencyBatch = await context.getResidencyBatch(personIds);

    let qualifyingCount = 0;
    const traceRows: ResidencyTraceRow[] = [];

    for (const p of uniqueParticipants.values()) {
      const residency = residencyBatch.get(p.personId);
      const isQualifying = Boolean(residency && qualifyingResidency.has(residency.residencyType as any));

      if (isQualifying) qualifyingCount++;

      traceRows.push({
        personId: p.personId,
        personName: `${p.person.firstName} ${p.person.lastName}`.trim(),
        residencyType: residency?.residencyType,
        isQualifying,
        reason: isQualifying
          ? undefined
          : residency
            ? 'Non-qualifying residency status'
            : 'No residency status recorded',
      });
    }

    const total = uniqueParticipants.size;
    const threshold = config.threshold ?? (config.comparison === 'lte' ? 0 : total);
    const passes = config.comparison === 'gte' ? qualifyingCount >= threshold : qualifyingCount <= threshold;

    return {
      result: passes ? AssessmentResult.PASS : AssessmentResult.FAIL,
      computedValue: {
        totalParticipants: total,
        qualifyingCount,
        threshold,
        comparison: config.comparison ?? 'gte',
        scope: config.scope,
        roleCodes: config.roleCodes ?? null,
        qualifyingResidency: config.qualifyingResidency,
        source: 'projectParticipantRole',
      },
      trace: {
        detailedBreakdown: {
          type: 'residencyTest',
          source: 'projectParticipantRole',
          participants: traceRows,
          totalParticipants: total,
          qualifyingCount,
          requiredThreshold: threshold,
          passing: passes,
        },
      },
      calculatorCode: this.code,
      calculatorVersion: this.version,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Derived path: Budget lines + BudgetRoleDerivationService
  // ───────────────────────────────────────────────────────────────────────────

  private async evaluateDerivedBudgetPath(
    input: CalculatorInput,
    prisma: PrismaService,
    context: CalculatorContext,
    config: ResidencyTestConfig,
  ): Promise<CalculatorOutput> {
    if (!input.budgetVersionId) {
      return this.failOutput('No budgetVersionId; derived path requires an explicit budget version', config);
    }

    const qualifyingResidency = new Set(config.qualifyingResidency);
    const programCode = input.requirementCode.split('_')[0]!;

    let personIdsToCheck = new Set<string>();
    const personNames = new Map<string, string>();

    let derivedWarnings: any[] = [];
    let derivedRolesEmpty = false;

    if (config.scope === 'all_participants') {
      // All persons on budget lines
      const budgetLines = await context.getBudgetLines();
      for (const line of budgetLines) {
        const person = line.person ?? line.vendor?.principalPerson;
        if (person) {
          personIdsToCheck.add(person.id);
          personNames.set(person.id, `${person.firstName} ${person.lastName}`.trim());
        }
      }
    } else {
      // Scope is key_creative or specific_roles
      const derivedRoles = await context.getDerivedRoles(programCode);
      derivedWarnings = derivedRoles.warnings;
      derivedRolesEmpty = derivedRoles.roles.length === 0;
      
      let validRoleCodes = new Set<string>();
      if (config.scope === 'specific_roles' && config.roleCodes?.length) {
        validRoleCodes = new Set(config.roleCodes);
      } else if (config.scope === 'key_creative') {
        const roleTypes = await prisma.participantRoleType.findMany({
          where: { category: RoleCategory.KEY_CREATIVE },
          select: { code: true },
        });
        validRoleCodes = new Set(roleTypes.map(rt => rt.code));
        // Also include CPTC hardcoded key creatives if applicable
        if (programCode === 'CPTC') {
          ['DIRECTOR', 'SCREENWRITER', 'LEAD_PERFORMER_1', 'LEAD_PERFORMER_2', 'DIRECTOR_OF_PHOTOGRAPHY', 'ART_DIRECTOR', 'MUSIC_COMPOSER', 'PICTURE_EDITOR'].forEach(r => validRoleCodes.add(r));
        }
      }

      for (const role of derivedRoles.roles) {
        if (validRoleCodes.has(role.roleCode) && role.selectedAssignment) {
          personIdsToCheck.add(role.selectedAssignment.personId);
          personNames.set(role.selectedAssignment.personId, role.selectedAssignment.personName);
        }
      }
    }

    const personIds = Array.from(personIdsToCheck);
    const residencyBatch = await context.getResidencyBatch(personIds);

    let qualifyingCount = 0;
    const traceRows: ResidencyTraceRow[] = [];

    for (const personId of personIds) {
      const residency = residencyBatch.get(personId);
      const isQualifying = Boolean(residency && qualifyingResidency.has(residency.residencyType as any));

      if (isQualifying) qualifyingCount++;

      traceRows.push({
        personId,
        personName: personNames.get(personId) ?? 'Unknown',
        residencyType: residency?.residencyType,
        isQualifying,
        reason: isQualifying
          ? undefined
          : residency
            ? 'Non-qualifying residency status'
            : 'No residency status recorded',
      });
    }

    const total = personIds.length;
    const threshold = config.threshold ?? (config.comparison === 'lte' ? 0 : total);
    const passes = config.comparison === 'gte' ? qualifyingCount >= threshold : qualifyingCount <= threshold;

    return {
      result: passes ? AssessmentResult.PASS : AssessmentResult.FAIL,
      computedValue: {
        totalParticipants: total,
        qualifyingCount,
        threshold,
        comparison: config.comparison ?? 'gte',
        scope: config.scope,
        roleCodes: config.roleCodes ?? null,
        qualifyingResidency: config.qualifyingResidency,
        source: 'budgetDerivedRoles',
        derivedWarnings,
        derivedRolesEmpty,
      },
      trace: {
        detailedBreakdown: {
          type: 'residencyTest',
          source: 'budgetDerivedRoles',
          participants: traceRows,
          totalParticipants: total,
          qualifyingCount,
          requiredThreshold: threshold,
          passing: passes,
        },
      },
      calculatorCode: this.code,
      calculatorVersion: this.version,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Diff: compare legacy and derived paths
  // ───────────────────────────────────────────────────────────────────────────

  private comparePaths(
    legacy: CalculatorOutput,
    derived: CalculatorOutput,
    config: ResidencyTestConfig,
  ): PathComparisonResult {
    const derivedWarnings = (derived.computedValue.derivedWarnings as any[]) ?? [];
    const isMissingMappings = 
      derivedWarnings.some((w) => w.code === 'PROGRAM_ROLE_MAPPING_MISSING') ||
      derived.computedValue.derivedRolesEmpty === true;

    const legacyQualifyingCount = (legacy.computedValue.qualifyingCount as number) ?? 0;
    const derivedQualifyingCount = (derived.computedValue.qualifyingCount as number) ?? 0;
    const legacyTotalParticipants = (legacy.computedValue.totalParticipants as number) ?? 0;
    const derivedTotalParticipants = (derived.computedValue.totalParticipants as number) ?? 0;

    if (isMissingMappings && config.scope !== 'all_participants') {
      return {
        status: 'SKIPPED_NO_MAPPINGS',
        reason: 'No role mappings configured for program — comparison skipped',
        fullyConsistent: true,
        legacyQualifyingCount,
        derivedQualifyingCount,
        countDelta: derivedQualifyingCount - legacyQualifyingCount,
        legacyTotalParticipants,
        derivedTotalParticipants,
        missingInLegacy: [],
        missingInDerived: [],
        residencyMismatches: [],
      };
    }

    const legacyRows: ResidencyTraceRow[] = (legacy.trace?.detailedBreakdown?.participants as ResidencyTraceRow[] | undefined) ?? [];
    const derivedRows: ResidencyTraceRow[] = (derived.trace?.detailedBreakdown?.participants as ResidencyTraceRow[] | undefined) ?? [];

    const legacyByPerson = new Map(legacyRows.map(r => [r.personId, r]));
    const derivedByPerson = new Map(derivedRows.map(r => [r.personId, r]));

    const allPersonIds = new Set([...legacyByPerson.keys(), ...derivedByPerson.keys()]);
    const missingInLegacy: string[] = [];
    const missingInDerived: string[] = [];
    const residencyMismatches: { personId: string; legacyQualifying: boolean; derivedQualifying: boolean }[] = [];

    for (const personId of allPersonIds) {
      const leg = legacyByPerson.get(personId);
      const der = derivedByPerson.get(personId);

      if (!leg) { missingInLegacy.push(personId); continue; }
      if (!der) { missingInDerived.push(personId); continue; }

      if (leg.isQualifying !== der.isQualifying) {
        residencyMismatches.push({
          personId,
          legacyQualifying: leg.isQualifying,
          derivedQualifying: der.isQualifying,
        });
      }
    }

    const isConsistent =
      missingInLegacy.length === 0 &&
      missingInDerived.length === 0 &&
      residencyMismatches.length === 0 &&
      legacyQualifyingCount === derivedQualifyingCount;

    let status: 'MATCH' | 'MISMATCH' | 'SCOPE_DIFFERENCE' = isConsistent ? 'MATCH' : 'MISMATCH';
    let reason: string | undefined;
    let fullyConsistent = isConsistent;

    if (!isConsistent && legacyTotalParticipants !== derivedTotalParticipants) {
      status = 'SCOPE_DIFFERENCE';
      reason = 'legacy uses participant list, derived uses budget-linked persons';
      fullyConsistent = true;
    }

    return {
      status,
      reason,
      legacyQualifyingCount,
      derivedQualifyingCount,
      countDelta: derivedQualifyingCount - legacyQualifyingCount,
      legacyTotalParticipants,
      derivedTotalParticipants,
      missingInLegacy,
      missingInDerived,
      residencyMismatches,
      fullyConsistent,
    };
  }

  private failOutput(reason: string, config: ResidencyTestConfig): CalculatorOutput {
    return {
      result: AssessmentResult.FAIL,
      computedValue: { qualifyingCount: 0, totalParticipants: 0, source: 'derived (error)' },
      trace: {
        detailedBreakdown: {
          type: 'residencyTest',
          source: 'derived (error)',
          participants: [],
          totalParticipants: 0,
          qualifyingCount: 0,
          requiredThreshold: config.threshold ?? 0,
          passing: false,
          failureReasons: [reason],
        },
      },
      calculatorCode: this.code,
      calculatorVersion: this.version,
    };
  }
}
