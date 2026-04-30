import { Prisma } from '@storyos/database';
import type {
  DerivedRolesResult,
  DerivedRoleResolution,
  DerivedRoleAssignment,
  DerivedRoleWarning,
  ExcludedLine,
  DiscardedAssignment,
} from '@storyos/types';
import type { PrismaService } from '../prisma/prisma.service';

type BudgetLineForRoleDerivation = Prisma.BudgetLineGetPayload<{
  include: {
    account: {
      include: { roleMappings: true };
    };
    person: true;
    vendor: { include: { principalPerson: true } };
  };
}>;

type ResidencyRow = Prisma.ParticipantResidencyStatusGetPayload<{}>;

function resolveIsLabour(
  expenseType: string | null,
  accountType: string | null,
): boolean {
  if (expenseType === 'LABOUR' || expenseType === 'MIXED') return true;
  if (expenseType === 'NON_LABOUR') return false;
  if (accountType === 'ABOVE_THE_LINE') return true;
  if (accountType === 'BELOW_THE_LINE_PRODUCTION') return true;
  if (accountType === 'BELOW_THE_LINE_POST') return true;
  return false;
}

export interface BudgetRoleDerivationInput {
  budgetVersionId: string;
  organizationId: string;
  evaluationDate: Date;
  programCode: string;
}

/**
 * Derives incentive role assignments from budget data.
 *
 * Stateless — instantiate per call or reuse; no internal state.
 * Results are intended to be cached by CalculatorContext.
 *
 * IMPORTANT FINANCIAL DISTINCTION:
 * - labourAmountForTrace (returned here as `labourAmount`): Used ONLY for role/person
 *   attribution and eligibility thresholds (e.g., "Did the director get paid > $0?").
 *   If a single GL is mapped to multiple roles, this amount WILL appear under multiple
 *   mapped roles.
 * - labourAmountForFinancialBase: The actual financial base calculation is handled
 *   separately by `SpendRecord`s in the core engine. Derived roles MUST NEVER be used
 *   to sum up total eligible labour costs, as that would lead to double-counting.
 *
 * Note on Residency:
 * Residency is sourced strictly from ParticipantResidencyStatus via Person.id.
 * There is zero dependency on ProjectParticipant or ProjectParticipantRole.
 */
export class BudgetRoleDerivationService {
  async derive(
    prisma: PrismaService,
    input: BudgetRoleDerivationInput,
  ): Promise<DerivedRolesResult> {
    const { budgetVersionId, organizationId, programCode, evaluationDate } = input;
    const warnings: DerivedRoleWarning[] = [];

    const budgetVersion = await prisma.budgetVersion.findFirst({
      where: { id: budgetVersionId, organizationId, deletedAt: null },
      select: { budgetId: true },
    });

    if (!budgetVersion) {
      return {
        budgetVersionId,
        programCode,
        roles: [],
        warnings: [
          {
            code: 'MISSING_PERSON', // Re-using code, but message is clear
            severity: 'error',
            roleCode: null,
            programCode,
            message: `Budget version ${budgetVersionId} not found`,
          },
        ],
      };
    }

    const roleMappings = await prisma.budgetAccountRoleMapping.findMany({
      where: {
        programCode,
        account: {
          budgetId: budgetVersion.budgetId,
          organizationId,
          deletedAt: null,
        },
      },
      include: { account: true },
    });

    if (roleMappings.length === 0) {
      return {
        budgetVersionId,
        programCode,
        roles: [],
        warnings: [
          {
            code: 'PROGRAM_ROLE_MAPPING_MISSING',
            severity: 'warning',
            roleCode: null,
            programCode,
            message: `No budget role mappings configured for this program`,
          },
        ],
      };
    }

    const accountIdsWithMappings = new Set(roleMappings.map((rm) => rm.budgetAccountId));

    const budgetLines = await prisma.budgetLine.findMany({
      where: {
        budgetVersionId,
        organizationId,
        deletedAt: null,
        budgetAccountId: { in: [...accountIdsWithMappings] },
      },
      include: {
        account: { include: { roleMappings: true } },
        person: true,
        vendor: { include: { principalPerson: true } },
      },
    });

    const allPersonIds = new Set<string>();
    for (const line of budgetLines) {
      const pid = line.personId ?? line.vendor?.principalPerson?.id;
      if (pid) allPersonIds.add(pid);
    }

    const residencyMap = new Map<string, ResidencyRow>();
    if (allPersonIds.size > 0) {
      const rows = await prisma.participantResidencyStatus.findMany({
        where: {
          personId: { in: [...allPersonIds] },
          organizationId,
          deletedAt: null,
          effectiveFrom: { lte: evaluationDate },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: evaluationDate } },
          ],
        },
        orderBy: { effectiveFrom: 'desc' },
      });
      for (const row of rows) {
        if (!residencyMap.has(row.personId)) {
          residencyMap.set(row.personId, row);
        }
      }
    }

    // Group role mappings by roleCode
    const mappingsByRole = new Map<string, typeof roleMappings>();
    for (const rm of roleMappings) {
      const arr = mappingsByRole.get(rm.roleCode) ?? [];
      arr.push(rm);
      mappingsByRole.set(rm.roleCode, arr);
    }

    const roles: DerivedRoleResolution[] = [];

    for (const [roleCode, mappingsForRole] of mappingsByRole) {
      const accountIdsForRole = new Set(mappingsForRole.map((m) => m.budgetAccountId));
      const pointsOverride = mappingsForRole[0]?.pointsOverride ?? null;
      const candidates: DerivedRoleAssignment[] = [];
      const excludedLines: ExcludedLine[] = [];

      for (const line of budgetLines) {
        if (!accountIdsForRole.has(line.budgetAccountId)) continue;

        const isLabour = resolveIsLabour(
          line.expenseType,
          line.account?.accountType ?? null,
        );

        if (!isLabour) {
          warnings.push({
            code: 'NON_LABOUR_LINE',
            severity: 'info',
            roleCode,
            programCode,
            message: `Budget line ${line.id} on account ${line.account?.code ?? line.budgetAccountId} is non-labour; ignored for role assignment`,
            affectedBudgetLineIds: [line.id],
          });
          excludedLines.push({
            budgetLineId: line.id,
            budgetAccountCode: line.account?.code ?? '',
            amount: line.amount.toString(),
            reason: 'NON_LABOUR_LINE',
          });
          continue;
        }

        const person = line.person ?? line.vendor?.principalPerson ?? null;

        if (!person) {
          if (line.vendorId && !line.vendor?.principalPerson) {
            warnings.push({
              code: 'NON_PERSON_PARTY',
              severity: 'warning',
              roleCode,
              programCode,
              message: `Budget line ${line.id} has vendor without principal person; invalid for key creative role`,
              affectedBudgetLineIds: [line.id],
            });
            excludedLines.push({
              budgetLineId: line.id,
              budgetAccountCode: line.account?.code ?? '',
              amount: line.amount.toString(),
              reason: 'NON_PERSON_PARTY',
              vendorId: line.vendorId,
            });
          } else {
            warnings.push({
              code: 'MISSING_PERSON',
              severity: 'warning',
              roleCode,
              programCode,
              message: `Budget line ${line.id} on account ${line.account?.code ?? line.budgetAccountId} has no person assigned`,
              affectedBudgetLineIds: [line.id],
            });
            excludedLines.push({
              budgetLineId: line.id,
              budgetAccountCode: line.account?.code ?? '',
              amount: line.amount.toString(),
              reason: 'MISSING_PERSON',
            });
          }
          continue;
        }

        const residency = residencyMap.get(person.id);
        if (!residency) {
          warnings.push({
            code: 'MISSING_RESIDENCY',
            severity: 'warning',
            roleCode,
            programCode,
            message: `Person ${person.firstName} ${person.lastName} (${person.id}) has no residency status as of evaluation date`,
            affectedPersonIds: [person.id],
            affectedBudgetLineIds: [line.id],
          });
          // Note: we don't exclude lines just for missing residency, they are still candidates,
          // but calculators might fail them later.
        }

        candidates.push({
          personId: person.id,
          personName: `${person.firstName} ${person.lastName}`.trim(),
          budgetLineId: line.id,
          budgetAccountId: line.budgetAccountId,
          budgetAccountCode: line.account?.code ?? '',
          roleCode,
          programCode,
          labourAmountForTrace: (line.labourAmount ?? line.amount).toString(),
          residency: residency
            ? {
                residencyType: residency.residencyType,
                country: residency.country,
                provinceState: residency.provinceState ?? null,
              }
            : null,
          pointsOverride,
        });
      }

      // Aggregate by personId: sum labour amounts per person for this role
      const byPerson = new Map<string, { total: number; assignments: DerivedRoleAssignment[] }>();
      for (const c of candidates) {
        const existing = byPerson.get(c.personId) ?? { total: 0, assignments: [] };
        existing.total += parseFloat(c.labourAmountForTrace);
        existing.assignments.push(c);
        byPerson.set(c.personId, existing);
      }

      // Deterministic resolution: pick person with highest total labour $
      // Tie-breaker: 1. total labour amount DESC, 2. personName ASC, 3. personId ASC
      const sorted = [...byPerson.entries()].sort((a, b) => {
        if (b[1].total !== a[1].total) {
          return b[1].total - a[1].total;
        }
        const nameA = a[1].assignments[0]?.personName ?? '';
        const nameB = b[1].assignments[0]?.personName ?? '';
        if (nameA !== nameB) {
          return nameA.localeCompare(nameB);
        }
        return a[0].localeCompare(b[0]);
      });

      let selectedAssignment: DerivedRoleAssignment | null = null;
      const discardedAssignments: DiscardedAssignment[] = [];

      if (sorted.length > 0) {
        const [winnerId, winnerData] = sorted[0]!;
        // Use the line with the highest amount for the selected assignment metadata
        const bestLine = winnerData.assignments.sort(
          (a, b) => parseFloat(b.labourAmountForTrace) - parseFloat(a.labourAmountForTrace),
        )[0]!;
        selectedAssignment = {
          ...bestLine,
          labourAmountForTrace: winnerData.total.toFixed(2),
        };

        if (sorted.length > 1) {
          for (let i = 1; i < sorted.length; i++) {
            const [discardedId, discardedData] = sorted[i]!;
            const bestDiscarded = discardedData.assignments.sort(
              (a, b) => parseFloat(b.labourAmountForTrace) - parseFloat(a.labourAmountForTrace),
            )[0]!;
            
            // Determine reason for discard
            const reason = discardedData.total < winnerData.total 
              ? 'Lower labour amount' 
              : 'Tie-breaker order';

            discardedAssignments.push({
              assignment: {
                ...bestDiscarded,
                labourAmountForTrace: discardedData.total.toFixed(2),
              },
              reason,
            });
          }
          warnings.push({
            code: 'AMBIGUOUS_ASSIGNMENT',
            severity: 'warning',
            roleCode,
            programCode,
            message: `Multiple people mapped to ${roleCode}: selected ${selectedAssignment.personName} ($${selectedAssignment.labourAmountForTrace}), discarded: ${discardedAssignments.map((d) => `${d.assignment.personName} ($${d.assignment.labourAmountForTrace})`).join(', ')}`,
            affectedPersonIds: sorted.map(([pid]) => pid),
          });
        }
      }

      if (!selectedAssignment) {
        warnings.push({
          code: 'MISSING_ROLE',
          severity: 'warning',
          roleCode,
          programCode,
          message: `No eligible budget line/person candidate exists for mapped role ${roleCode}`,
        });
      }

      roles.push({ roleCode, programCode, selectedAssignment, discardedAssignments, excludedLines });
    }

    return { budgetVersionId, programCode, roles, warnings };
  }
}
