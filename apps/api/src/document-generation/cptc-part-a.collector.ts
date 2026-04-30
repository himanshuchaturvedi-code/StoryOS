import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@storyos/database';
import { BudgetVersionStatus } from '@storyos/types';
import { PrismaService } from '../prisma/prisma.service';
import { TenantAwareService } from '../tenant/tenant-aware.service';
import { TenantContext } from '../tenant/tenant.context';

export type BudgetLineWithRelations = Prisma.BudgetLineGetPayload<{
  include: {
    account: { include: { roleMappings: true } };
    person: true;
    vendor: { include: { principalPerson: true } };
    location: true;
    productionPhase: true;
  };
}>;

export interface CptcPartAData {
  project: {
    id: string;
    title: string;
  };
  budgetVersionId: string;
  budgetVersionName: string;
  lines: BudgetLineWithRelations[];
  residencies: Map<string, { residencyType: string; country: string }>;
}

@Injectable()
export class CptcPartACollector extends TenantAwareService {
  constructor(prisma: PrismaService, tenant: TenantContext) {
    super(prisma, tenant);
  }

  async collect(projectId: string, budgetVersionId?: string): Promise<CptcPartAData> {
    const project = await this.prisma.project.findFirst({
      where: this.tenantFilter({ id: projectId }),
      select: { id: true, title: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    const resolvedVersionId = budgetVersionId ?? await this.resolveBudgetVersionId(projectId);
    if (!resolvedVersionId) {
      throw new NotFoundException('No budget version found for this project');
    }

    const version = await this.prisma.budgetVersion.findFirst({
      where: this.tenantFilter({ id: resolvedVersionId }),
      select: { id: true, name: true },
    });
    if (!version) throw new NotFoundException('Budget version not found');

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

    const personIds = new Set<string>();
    for (const line of lines) {
      const effectivePersonId =
        line.personId ?? line.vendor?.principalPersonId ?? null;
      if (effectivePersonId) personIds.add(effectivePersonId);
    }

    const residencies = new Map<string, { residencyType: string; country: string }>();
    if (personIds.size > 0) {
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
          });
        }
      }
    }

    return {
      project: { id: project.id, title: project.title },
      budgetVersionId: resolvedVersionId,
      budgetVersionName: version.name,
      lines,
      residencies,
    };
  }

  private async resolveBudgetVersionId(projectId: string): Promise<string | null> {
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
    if (locked) return locked.id;

    const draft = await this.prisma.budgetVersion.findFirst({
      where: this.tenantFilter({
        budgetId: budget.id,
        status: BudgetVersionStatus.DRAFT,
      }),
      orderBy: { versionNumber: 'desc' },
      select: { id: true },
    });
    return draft?.id ?? null;
  }
}
