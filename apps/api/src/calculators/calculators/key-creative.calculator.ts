import { AssessmentResult } from '@storyos/types';
import type { KeyCreativeConfig } from '@storyos/types';
import type { Calculator, CalculatorInput, CalculatorOutput } from '../calculator.interface';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CalculatorContext } from '../calculator.context';
import { FeatureFlags } from '../feature-flags';

// ─────────────────────────────────────────────────────────────────────────────
// Shared trace row shape
// ─────────────────────────────────────────────────────────────────────────────

interface RoleTraceRow {
  roleCode: string;
  role: string;
  assignedPerson: string;
  canadian: 'YES' | 'NO' | 'UNKNOWN';
  points: number;
  status: string;
  residencyType?: string;
  reason?: string;
  glCodes?: string[];
  glNames?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Diff types — emitted when legacy and derived paths disagree
// ─────────────────────────────────────────────────────────────────────────────

interface RoleDiff {
  roleCode: string;
  legacyPerson: string;
  derivedPerson: string;
  legacyCanadian: string;
  derivedCanadian: string;
  legacyPoints: number;
  derivedPoints: number;
  mismatchReason: string;
}

interface PathComparisonResult {
  status: 'MATCH' | 'MISMATCH' | 'SKIPPED_NO_MAPPINGS' | 'SCOPE_DIFFERENCE';
  reason?: string;
  legacyQualifyingPoints: number;
  derivedQualifyingPoints: number;
  pointsDelta: number;
  roleDiffs: RoleDiff[];
  missingInLegacy: string[];
  missingInDerived: string[];
  fullyConsistent: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Calculator
// ─────────────────────────────────────────────────────────────────────────────

export class KeyCreativeCalculator implements Calculator {
  readonly code = 'key_creative';
  readonly version = '2.0.0';

  async evaluate(
    input: CalculatorInput,
    prisma: PrismaService,
    context: CalculatorContext,
  ): Promise<CalculatorOutput> {
    const config = input.configuration as KeyCreativeConfig;

    const isCptc = input.requirementCode === 'CPTC_KEY_CREATIVE';

    // Run both paths in parallel; neither blocks the other.
    const [legacyResult, derivedResult] = await Promise.all([
      isCptc
        ? this.evaluateLegacyCptcPath(input, prisma, context, config)
        : this.evaluateLegacyParticipantPath(input, prisma, context, config),
      this.evaluateDerivedBudgetPath(input, prisma, context, config),
    ]);

    const comparison = this.comparePaths(legacyResult, derivedResult, config);

    if (comparison.status === 'MISMATCH') {
      console.warn('[KeyCreativeCalculator] DUAL-PATH MISMATCH', JSON.stringify({
        calculatorCode: this.code,
        requirementCode: input.requirementCode,
        projectId: input.projectId,
        programCode: input.requirementCode.split('_')[0]!,
        comparison,
      }));
    }

    // Select authoritative result based on feature flag.
    const authoritative = FeatureFlags.USE_DERIVED_ROLES ? derivedResult : legacyResult;
    const shadow = FeatureFlags.USE_DERIVED_ROLES ? legacyResult : derivedResult;

    return {
      result: authoritative.result,
      computedValue: {
        ...authoritative.computedValue,
        dualPath: {
          authoritativeSource: FeatureFlags.USE_DERIVED_ROLES ? 'derived' : 'legacy',
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
  // Used by non-CPTC programs. Will eventually be replaced.
  // ───────────────────────────────────────────────────────────────────────────

  private async evaluateLegacyParticipantPath(
    input: CalculatorInput,
    prisma: PrismaService,
    context: CalculatorContext,
    config: KeyCreativeConfig,
  ): Promise<CalculatorOutput> {
    const positionMap = new Map(config.positions.map((p) => [p.roleCode, p.points]));
    const qualifyingResidency = new Set(config.qualifyingResidency);

    const participants = await context.getParticipantsWithRoles();
    const residencyByPersonId = await context.getResidencyBatch(participants.map((p) => p.personId));

    let totalPoints = 0;
    let qualifyingPoints = 0;
    const assignedRows: RoleTraceRow[] = [];

    for (const participant of participants) {
      for (const role of participant.roles) {
        const points = positionMap.get(role.roleType.code) ?? 0;
        if (points === 0) continue;

        totalPoints += points;

        const residency = residencyByPersonId.get(participant.personId);
        const isCanadian = Boolean(residency && qualifyingResidency.has(residency.residencyType as any));

        if (isCanadian) qualifyingPoints += points;

        assignedRows.push({
          roleCode: role.roleType.code,
          role: role.roleType.name,
          assignedPerson: `${participant.person.firstName} ${participant.person.lastName}`.trim(),
          canadian: residency ? (isCanadian ? 'YES' : 'NO') : 'UNKNOWN',
          points: isCanadian ? points : 0,
          status: isCanadian ? 'Included' : 'Excluded',
          residencyType: residency?.residencyType,
          reason: isCanadian
            ? undefined
            : residency
              ? 'Non-Canadian residency status'
              : 'No residency status recorded',
        });
      }
    }

    const passes = qualifyingPoints >= config.minPoints;
    const roles = this.buildRoleRows(config, assignedRows);

    return {
      result: passes ? AssessmentResult.PASS : AssessmentResult.FAIL,
      computedValue: {
        totalPoints,
        qualifyingPoints,
        minPoints: config.minPoints,
        positions: config.positions,
        qualifyingResidency: config.qualifyingResidency,
        participantCount: participants.length,
        source: 'projectParticipantRole',
      },
      trace: {
        detailedBreakdown: {
          type: 'keyCreativePoints',
          source: 'projectParticipantRole',
          roles,
          totalPointsEarned: qualifyingPoints,
          totalPossiblePoints: config.positions.reduce((sum, p) => sum + p.points, 0),
          requiredThreshold: config.minPoints,
          thresholdLabel: `${qualifyingPoints}/${config.minPoints}`,
          passing: passes,
          failureReasons: passes
            ? []
            : roles.filter((r) => r.status !== 'Included').map((r) => `${r.role}: ${r.reason ?? r.status}`),
        },
      },
      calculatorCode: this.code,
      calculatorVersion: this.version,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Legacy CPTC path: BudgetAccount.cptcRole (deprecated field)
  // Retained for dual-path comparison; will be removed when derived path is stable.
  // ───────────────────────────────────────────────────────────────────────────

  private async evaluateLegacyCptcPath(
    input: CalculatorInput,
    prisma: PrismaService,
    context: CalculatorContext,
    config: KeyCreativeConfig,
  ): Promise<CalculatorOutput> {
    const qualifyingResidency = new Set(config.qualifyingResidency);
    const requiredRoleCodes = config.positions.map((p) => p.roleCode);

    const budgetVersion = input.budgetVersionId
      ? await prisma.budgetVersion.findFirst({
          where: { id: input.budgetVersionId, organizationId: input.organizationId, deletedAt: null },
          select: { budgetId: true },
        })
      : null;

    const mappedAccounts = budgetVersion
      ? await prisma.budgetAccount.findMany({
          where: {
            budgetId: budgetVersion.budgetId,
            organizationId: input.organizationId,
            deletedAt: null,
            cptcRole: { in: requiredRoleCodes as any },
          },
          select: { id: true, code: true, name: true, cptcRole: true },
        })
      : [];

    const budgetLines = await context.getBudgetLines();
    const personIds = budgetLines
      .flatMap((line) => [line.personId, line.vendor?.principalPerson?.id])
      .filter((id): id is string => Boolean(id));
    const residencyByPersonId = await context.getResidencyBatch(personIds);

    let qualifyingPoints = 0;
    const roles = config.positions.map((position) => {
      const accountsForRole = mappedAccounts.filter((a) => a.cptcRole === position.roleCode);

      if (accountsForRole.length === 0) {
        return this.buildCptcRoleTraceRow(position.roleCode, {
          points: 0, status: 'Missing', assignedPerson: 'Unassigned',
          canadian: 'UNKNOWN', reason: 'No GL mapped to this role',
        });
      }

      const accountIds = new Set(accountsForRole.map((a) => a.id));
      const linesForRole = budgetLines.filter((l) => accountIds.has(l.budgetAccountId));
      const assignedParties = linesForRole.flatMap((line) => {
        const person = line.person ?? line.vendor?.principalPerson ?? null;
        if (!person) return [];
        const residency = residencyByPersonId.get(person.id);
        const isCanadian = Boolean(residency && qualifyingResidency.has(residency.residencyType as any));
        return [{ id: person.id, name: `${person.firstName} ${person.lastName}`.trim(), isCanadian, hasResidency: Boolean(residency), residencyType: residency?.residencyType }];
      });

      const glCodes = accountsForRole.map((a) => a.code);
      const glNames = accountsForRole.map((a) => a.name);

      if (assignedParties.length === 0) {
        return this.buildCptcRoleTraceRow(position.roleCode, {
          points: 0, status: 'Missing', assignedPerson: 'Unassigned',
          canadian: 'UNKNOWN', reason: 'No person assigned to this GL', glCodes, glNames,
        });
      }

      const qualifyingParties = assignedParties.filter((p) => p.isCanadian);
      if (qualifyingParties.length > 0) {
        qualifyingPoints += position.points;
        return this.buildCptcRoleTraceRow(position.roleCode, {
          points: position.points, status: 'Included',
          assignedPerson: this.uniqueNames(qualifyingParties.map((p) => p.name)).join(', '),
          canadian: 'YES', glCodes, glNames,
          residencyType: this.uniqueNames(qualifyingParties.map((p) => p.residencyType)).join(', '),
        });
      }

      const hasKnownResidency = assignedParties.some((p) => p.hasResidency);
      return this.buildCptcRoleTraceRow(position.roleCode, {
        points: 0, status: 'Excluded',
        assignedPerson: this.uniqueNames(assignedParties.map((p) => p.name)).join(', '),
        canadian: hasKnownResidency ? 'NO' : 'UNKNOWN',
        reason: hasKnownResidency ? 'Assigned person is not Canadian' : 'Assigned person has no residency status recorded',
        glCodes, glNames,
      });
    });

    const passes = qualifyingPoints >= config.minPoints;
    const totalPossible = config.positions.reduce((sum, p) => sum + p.points, 0);

    return {
      result: passes ? AssessmentResult.PASS : AssessmentResult.FAIL,
      computedValue: {
        totalPoints: totalPossible,
        qualifyingPoints,
        minPoints: config.minPoints,
        positions: config.positions,
        qualifyingResidency: config.qualifyingResidency,
        source: 'budgetAccount.cptcRole (deprecated)',
      },
      trace: {
        detailedBreakdown: {
          type: 'keyCreativePoints',
          source: 'budgetAccount.cptcRole (deprecated)',
          roles,
          totalPointsEarned: qualifyingPoints,
          totalPossiblePoints: totalPossible,
          requiredThreshold: config.minPoints,
          thresholdLabel: `${qualifyingPoints}/${config.minPoints}`,
          passing: passes,
          failureReasons: passes ? [] : roles.filter((r) => r.status !== 'Included').map((r) => `${r.role}: ${r.reason ?? r.status}`),
        },
      },
      calculatorCode: this.code,
      calculatorVersion: this.version,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Derived path: BudgetAccountRoleMapping + BudgetRoleDerivationService
  // New canonical path. Activated by USE_DERIVED_ROLES=true.
  // ───────────────────────────────────────────────────────────────────────────

  private async evaluateDerivedBudgetPath(
    input: CalculatorInput,
    prisma: PrismaService,
    context: CalculatorContext,
    config: KeyCreativeConfig,
  ): Promise<CalculatorOutput> {
    if (!input.budgetVersionId) {
      return this.failOutput('No budgetVersionId; derived path requires an explicit budget version', config);
    }

    const qualifyingResidency = new Set(config.qualifyingResidency);
    // programCode is derived from requirementCode's prefix (e.g. CPTC_KEY_CREATIVE → CPTC)
    const programCode = input.requirementCode.split('_')[0]!;
    const derivedRoles = await context.getDerivedRoles(programCode);

    let qualifyingPoints = 0;
    const roles = config.positions.map((position) => {
      const resolution = derivedRoles.roles.find((r) => r.roleCode === position.roleCode);

      if (!resolution || !resolution.selectedAssignment) {
        return this.buildCptcRoleTraceRow(position.roleCode, {
          points: 0,
          status: 'Missing',
          assignedPerson: 'Unassigned',
          canadian: 'UNKNOWN',
          reason: resolution
            ? 'No eligible budget line/person for this mapped role'
            : 'Role not mapped in BudgetAccountRoleMapping',
        });
      }

      const { selectedAssignment } = resolution;
      const residency = selectedAssignment.residency;
      const isCanadian = Boolean(residency && qualifyingResidency.has(residency.residencyType as any));

      if (isCanadian) qualifyingPoints += position.points;

      return this.buildCptcRoleTraceRow(position.roleCode, {
        points: isCanadian ? position.points : 0,
        status: isCanadian ? 'Included' : (residency ? 'Excluded' : 'Excluded'),
        assignedPerson: selectedAssignment.personName,
        canadian: residency ? (isCanadian ? 'YES' : 'NO') : 'UNKNOWN',
        reason: isCanadian
          ? undefined
          : residency
            ? 'Assigned person is not Canadian'
            : 'Assigned person has no residency status recorded',
        glCodes: [selectedAssignment.budgetAccountCode],
      });
    });

    const passes = qualifyingPoints >= config.minPoints;
    const totalPossible = config.positions.reduce((sum, p) => sum + p.points, 0);

    return {
      result: passes ? AssessmentResult.PASS : AssessmentResult.FAIL,
      computedValue: {
        totalPoints: totalPossible,
        qualifyingPoints,
        minPoints: config.minPoints,
        positions: config.positions,
        qualifyingResidency: config.qualifyingResidency,
        source: 'budgetAccountRoleMapping',
        derivedWarnings: derivedRoles.warnings,
        derivedRolesEmpty: derivedRoles.roles.length === 0,
      },
      trace: {
        detailedBreakdown: {
          type: 'keyCreativePoints',
          source: 'budgetAccountRoleMapping',
          roles,
          totalPointsEarned: qualifyingPoints,
          totalPossiblePoints: totalPossible,
          requiredThreshold: config.minPoints,
          thresholdLabel: `${qualifyingPoints}/${config.minPoints}`,
          passing: passes,
          failureReasons: passes ? [] : roles.filter((r) => r.status !== 'Included').map((r) => `${r.role}: ${r.reason ?? r.status}`),
          derivedRoleWarnings: derivedRoles.warnings,
        },
      },
      calculatorCode: this.code,
      calculatorVersion: this.version,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Diff: compare legacy and derived paths and produce a structured diff
  // ───────────────────────────────────────────────────────────────────────────

  private comparePaths(
    legacy: CalculatorOutput,
    derived: CalculatorOutput,
    config: KeyCreativeConfig,
  ): PathComparisonResult {
    const derivedWarnings = (derived.computedValue.derivedWarnings as any[]) ?? [];
    const isMissingMappings = 
      derivedWarnings.some((w) => w.code === 'PROGRAM_ROLE_MAPPING_MISSING') ||
      derived.computedValue.derivedRolesEmpty === true;

    const legacyQualifyingPoints = (legacy.computedValue.qualifyingPoints as number) ?? 0;
    const derivedQualifyingPoints = (derived.computedValue.qualifyingPoints as number) ?? 0;

    if (isMissingMappings) {
      return {
        status: 'SKIPPED_NO_MAPPINGS',
        reason: 'No role mappings configured for program — comparison skipped',
        fullyConsistent: true,
        legacyQualifyingPoints,
        derivedQualifyingPoints,
        pointsDelta: derivedQualifyingPoints - legacyQualifyingPoints,
        roleDiffs: [],
        missingInLegacy: [],
        missingInDerived: [],
      };
    }

    const legacyRoles: RoleTraceRow[] =
      (legacy.trace?.detailedBreakdown?.roles as RoleTraceRow[] | undefined) ?? [];
    const derivedRoles: RoleTraceRow[] =
      (derived.trace?.detailedBreakdown?.roles as RoleTraceRow[] | undefined) ?? [];

    const legacyByRole = new Map(legacyRoles.map((r) => [r.roleCode, r]));
    const derivedByRole = new Map(derivedRoles.map((r) => [r.roleCode, r]));

    const allRoleCodes = new Set([...legacyByRole.keys(), ...derivedByRole.keys()]);
    const roleDiffs: RoleDiff[] = [];
    const missingInLegacy: string[] = [];
    const missingInDerived: string[] = [];

    for (const roleCode of allRoleCodes) {
      const leg = legacyByRole.get(roleCode);
      const der = derivedByRole.get(roleCode);

      if (!leg) { missingInLegacy.push(roleCode); continue; }
      if (!der) { missingInDerived.push(roleCode); continue; }

      const personMismatch = leg.assignedPerson !== der.assignedPerson;
      const canadianMismatch = leg.canadian !== der.canadian;
      const pointsMismatch = leg.points !== der.points;

      if (personMismatch || canadianMismatch || pointsMismatch) {
        const reasons: string[] = [];
        if (personMismatch) reasons.push(`person: ${leg.assignedPerson} vs ${der.assignedPerson}`);
        if (canadianMismatch) reasons.push(`canadian: ${leg.canadian} vs ${der.canadian}`);
        if (pointsMismatch) reasons.push(`points: ${leg.points} vs ${der.points}`);

        roleDiffs.push({
          roleCode,
          legacyPerson: leg.assignedPerson,
          derivedPerson: der.assignedPerson,
          legacyCanadian: leg.canadian,
          derivedCanadian: der.canadian,
          legacyPoints: leg.points,
          derivedPoints: der.points,
          mismatchReason: reasons.join('; '),
        });
      }
    }

    const fullyConsistent =
      roleDiffs.length === 0 &&
      missingInLegacy.length === 0 &&
      missingInDerived.length === 0 &&
      legacyQualifyingPoints === derivedQualifyingPoints;

    return {
      status: fullyConsistent ? 'MATCH' : 'MISMATCH',
      legacyQualifyingPoints,
      derivedQualifyingPoints,
      pointsDelta: derivedQualifyingPoints - legacyQualifyingPoints,
      roleDiffs,
      missingInLegacy,
      missingInDerived,
      fullyConsistent,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Helpers
  // ───────────────────────────────────────────────────────────────────────────

  private buildRoleRows(config: KeyCreativeConfig, assignedRows: RoleTraceRow[]): RoleTraceRow[] {
    return config.positions.flatMap((position) => {
      const rows = assignedRows.filter((r) => r.roleCode === position.roleCode);
      if (rows.length > 0) return rows;
      return [
        {
          roleCode: position.roleCode,
          role: this.formatRoleLabel(position.roleCode),
          assignedPerson: 'Unassigned',
          canadian: 'UNKNOWN' as const,
          points: 0,
          status: 'Missing',
          reason: 'No person assigned to this required role',
        },
      ];
    });
  }

  private buildCptcRoleTraceRow(
    roleCode: string,
    values: Omit<RoleTraceRow, 'roleCode' | 'role'>,
  ): RoleTraceRow {
    return { roleCode, role: this.formatRoleLabel(roleCode), ...values };
  }

  private formatRoleLabel(roleCode: string) {
    return roleCode
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private uniqueNames(values: Array<string | null | undefined>) {
    return [...new Set(values.filter((v): v is string => Boolean(v)))];
  }

  private failOutput(reason: string, config: KeyCreativeConfig): CalculatorOutput {
    const positions = config.positions.map((p) => this.buildCptcRoleTraceRow(p.roleCode, {
      points: 0, status: 'Missing', assignedPerson: 'Unassigned', canadian: 'UNKNOWN', reason,
    }));
    return {
      result: AssessmentResult.FAIL,
      computedValue: { qualifyingPoints: 0, minPoints: config.minPoints, source: 'derived (error)' },
      trace: {
        detailedBreakdown: {
          type: 'keyCreativePoints',
          source: 'derived (error)',
          roles: positions,
          totalPointsEarned: 0,
          totalPossiblePoints: config.positions.reduce((sum, p) => sum + p.points, 0),
          requiredThreshold: config.minPoints,
          thresholdLabel: `0/${config.minPoints}`,
          passing: false,
          failureReasons: [reason],
        },
      },
      calculatorCode: this.code,
      calculatorVersion: this.version,
    };
  }
}
