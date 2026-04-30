import { Injectable, BadRequestException } from '@nestjs/common';
import type {
  DerivedRoleResolution,
  DerivedRoleWarning,
  KeyCreativeConfig,
  DerivedRolesResponse,
  ProgramDerivedRoles,
  DerivedRoleResolutionWithAccounts,
  DerivedRoleSummary,
} from '@storyos/types';
import { TenantAwareService } from '../tenant/tenant-aware.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.context';
import { BudgetRoleDerivationService } from '../calculators/budget-role-derivation.service';

@Injectable()
export class DerivedRolesService extends TenantAwareService {
  private readonly budgetRoleDerivation = new BudgetRoleDerivationService();

  constructor(prisma: PrismaService, tenant: TenantContext) {
    super(prisma, tenant);
  }

  async getDerivedRoles(
    projectId: string,
    budgetVersionId: string,
  ): Promise<DerivedRolesResponse> {
    const budgetVersion = await this.prisma.budgetVersion.findFirst({
      where: {
        id: budgetVersionId,
        organizationId: this.organizationId,
        deletedAt: null,
        budget: { projectId, organizationId: this.organizationId, deletedAt: null },
      },
    });

    if (!budgetVersion) {
      throw new BadRequestException(
        `Budget version ${budgetVersionId} not found for project ${projectId}`,
      );
    }

    const projectPrograms = await this.prisma.projectProgram.findMany({
      where: {
        projectId,
        organizationId: this.organizationId,
        deletedAt: null,
      },
      include: {
        programVersion: {
          include: {
            program: true,
            requirements: true,
          },
        },
      },
    });

    const programs: ProgramDerivedRoles[] = [];

    for (const pp of projectPrograms) {
      const programCode = pp.programVersion.program.code;
      const programName = pp.programVersion.program.name;

      const derivedResult = await this.budgetRoleDerivation.derive(this.prisma, {
        budgetVersionId,
        organizationId: this.organizationId,
        evaluationDate: new Date(),
        programCode,
      });

      const accountMappings = await this.prisma.budgetAccountRoleMapping.findMany({
        where: {
          programCode,
          account: {
            budgetId: budgetVersion.budgetId,
            organizationId: this.organizationId,
            deletedAt: null,
          },
        },
        select: { budgetAccountId: true, roleCode: true },
      });

      const accountIdsByRole = new Map<string, string[]>();
      for (const mapping of accountMappings) {
        const ids = accountIdsByRole.get(mapping.roleCode) ?? [];
        ids.push(mapping.budgetAccountId);
        accountIdsByRole.set(mapping.roleCode, ids);
      }

      const keyCreativeReq = pp.programVersion.requirements.find(
        (r) => r.requirementCategory === 'KEY_CREATIVE_TEST',
      );

      const config = keyCreativeReq?.configuration as KeyCreativeConfig | undefined;

      const allRoleCodes = new Set<string>();
      if (config?.positions) {
        for (const pos of config.positions) {
          allRoleCodes.add(pos.roleCode);
        }
      }
      for (const resolution of derivedResult.roles) {
        allRoleCodes.add(resolution.roleCode);
      }

      const rolesWithAccounts: DerivedRoleResolutionWithAccounts[] = [];
      let totalPoints: number | null = null;
      let maxPoints: number | null = null;
      const missingRoles: string[] = [];
      const issues: string[] = [];

      if (config?.positions) {
        totalPoints = 0;
        maxPoints = config.positions.reduce((sum, p) => sum + p.points, 0);
      }

      for (const roleCode of allRoleCodes) {
        const resolution = derivedResult.roles.find((r) => r.roleCode === roleCode);
        const mappedAccounts = accountIdsByRole.get(roleCode) ?? [];

        rolesWithAccounts.push({
          roleCode,
          mappedAccountIds: mappedAccounts,
          selectedAssignment: resolution?.selectedAssignment ?? null,
          discardedAssignments: resolution?.discardedAssignments ?? [],
          excludedLines: resolution?.excludedLines ?? [],
        });

        if (config?.positions) {
          const posConfig = config.positions.find((p) => p.roleCode === roleCode);
          if (!posConfig) continue;

          if (!resolution?.selectedAssignment) {
            missingRoles.push(roleCode);
            continue;
          }

          const assignment = resolution.selectedAssignment;
          const residency = assignment.residency;

          if (!residency) {
            issues.push(`${roleCode}: ${assignment.personName} missing residency`);
            continue;
          }

          const qualifies = config.qualifyingResidency.includes(
            residency.residencyType as any,
          );

          if (qualifies) {
            totalPoints! += posConfig.points;
          } else {
            issues.push(
              `${roleCode}: ${assignment.personName} is ${residency.residencyType} (non-qualifying)`,
            );
          }
        }
      }

      programs.push({
        programCode,
        programName,
        roles: rolesWithAccounts,
        warnings: derivedResult.warnings,
        summary: { totalPoints, maxPoints, missingRoles, issues },
      });
    }

    return { budgetVersionId, programs };
  }
}
