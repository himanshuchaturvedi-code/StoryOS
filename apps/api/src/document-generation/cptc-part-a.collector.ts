import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@storyos/database';
import { BudgetVersionStatus } from '@storyos/types';
import type { FormatType } from '@storyos/types';
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

import type { ProjectFormatSnapshot } from './cptc-boc-form-selection';

export interface CptcPartAData {
  project: {
    id: string;
    title: string;
  };
  projectFormat: ProjectFormatSnapshot | null;
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

    const projectFormatRow = await this.prisma.projectFormat.findFirst({
      where: {
        organizationId: this.organizationId,
        projectId,
        deletedAt: null,
      },
      select: {
        formatType: true,
        isLiveAction: true,
        hasAnimation: true,
        animationPercentage: true,
      },
    });

    const projectFormat: ProjectFormatSnapshot | null = projectFormatRow
      ? {
          formatType: projectFormatRow.formatType as FormatType,
          isLiveAction: projectFormatRow.isLiveAction,
          hasAnimation: projectFormatRow.hasAnimation,
          animationPercentage: projectFormatRow.animationPercentage,
        }
      : null;

    const resolvedVersionId =
      budgetVersionId ?? (await this.resolveLockedBudgetVersionId(projectId));
    if (!resolvedVersionId) {
      throw new BadRequestException(
        'CPTC Breakdown of Costs requires a LOCKED budget version. Lock a budget version before generating.',
      );
    }

    const version = await this.prisma.budgetVersion.findFirst({
      where: this.tenantFilter({ id: resolvedVersionId }),
      select: { id: true, name: true, status: true },
    });
    if (!version) throw new NotFoundException('Budget version not found');

    if (version.status !== BudgetVersionStatus.LOCKED) {
      throw new BadRequestException(
        'CPTC Breakdown of Costs requires a LOCKED budget version. The selected budget version is not locked.',
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
      projectFormat,
      budgetVersionId: resolvedVersionId,
      budgetVersionName: version.name,
      lines,
      residencies,
    };
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
