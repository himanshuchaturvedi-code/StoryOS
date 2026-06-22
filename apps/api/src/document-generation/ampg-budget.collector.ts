import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@storyos/database';
import { BudgetVersionStatus } from '@storyos/types';
import { PrismaService } from '../prisma/prisma.service';
import { TenantAwareService } from '../tenant/tenant-aware.service';
import { TenantContext } from '../tenant/tenant.context';
import type { BudgetLineWithRelations } from './cptc-part-a.collector';
import { resolveEffectivePersonId } from './ampg-labour-utils';

export type { BudgetLineWithRelations };

export interface ParticipantResidencySnapshot {
  residencyType: string;
  country: string;
  provinceState: string | null;
}

export interface AmpgBudgetData {
  project: {
    id: string;
    title: string;
  };
  budgetVersionId: string;
  budgetVersionName: string;
  lines: BudgetLineWithRelations[];
  residencies: Map<string, ParticipantResidencySnapshot>;
}

const LOCKED_BUDGET_REQUIRED_MESSAGE =
  'AMPG document generation requires a LOCKED budget version. Lock a budget version before generating.';

@Injectable()
export class AmpgBudgetCollector extends TenantAwareService {
  constructor(prisma: PrismaService, tenant: TenantContext) {
    super(prisma, tenant);
  }

  async collect(projectId: string, budgetVersionId?: string): Promise<AmpgBudgetData> {
    const project = await this.prisma.project.findFirst({
      where: this.tenantFilter({ id: projectId }),
      select: { id: true, title: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    const resolvedVersionId =
      budgetVersionId ?? (await this.resolveLockedBudgetVersionId(projectId));
    if (!resolvedVersionId) {
      throw new BadRequestException(LOCKED_BUDGET_REQUIRED_MESSAGE);
    }

    const version = await this.prisma.budgetVersion.findFirst({
      where: this.tenantFilter({ id: resolvedVersionId }),
      select: { id: true, name: true, status: true },
    });
    if (!version) throw new NotFoundException('Budget version not found');

    if (version.status !== BudgetVersionStatus.LOCKED) {
      throw new BadRequestException(
        'AMPG document generation requires a LOCKED budget version. The selected budget version is not locked.',
      );
    }

    const lines = await this.prisma.budgetLine.findMany({
      where: this.tenantFilter({
        budgetVersionId: resolvedVersionId,
      }),
      include: {
        account: { include: { roleMappings: true } },
        person: true,
        vendor: { include: { principalPerson: true } },
        location: true,
        productionPhase: true,
      },
      orderBy: [{ account: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
    });

    const residencies = await this.loadResidencies(lines);

    return {
      project: { id: project.id, title: project.title },
      budgetVersionId: resolvedVersionId,
      budgetVersionName: version.name,
      lines,
      residencies,
    };
  }

  private async loadResidencies(
    lines: BudgetLineWithRelations[],
  ): Promise<Map<string, ParticipantResidencySnapshot>> {
    const personIds = new Set<string>();
    for (const line of lines) {
      const effectivePersonId = resolveEffectivePersonId(line);
      if (effectivePersonId) personIds.add(effectivePersonId);
    }

    const residencies = new Map<string, ParticipantResidencySnapshot>();
    if (personIds.size === 0) {
      return residencies;
    }

    const rows = await this.prisma.participantResidencyStatus.findMany({
      where: {
        organizationId: this.organizationId,
        personId: { in: [...personIds] },
        deletedAt: null,
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    for (const row of rows) {
      if (!residencies.has(row.personId)) {
        residencies.set(row.personId, {
          residencyType: row.residencyType,
          country: row.country,
          provinceState: row.provinceState,
        });
      }
    }

    return residencies;
  }

  private async resolveLockedBudgetVersionId(
    projectId: string,
  ): Promise<string | null> {
    const budget = await this.prisma.budget.findFirst({
      where: this.tenantFilter({ projectId } as Prisma.BudgetWhereInput),
      select: { id: true },
    });
    if (!budget) return null;

    const locked = await this.prisma.budgetVersion.findFirst({
      where: this.tenantFilter({
        budgetId: budget.id,
        status: BudgetVersionStatus.LOCKED,
      }),
      orderBy: { versionNumber: 'desc' },
      select: { id: true },
    });

    return locked?.id ?? null;
  }
}
