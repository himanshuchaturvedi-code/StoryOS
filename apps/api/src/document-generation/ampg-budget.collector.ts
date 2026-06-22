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

export type { BudgetLineWithRelations };

export interface AmpgBudgetData {
  project: {
    id: string;
    title: string;
  };
  budgetVersionId: string;
  budgetVersionName: string;
  lines: BudgetLineWithRelations[];
}

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
      throw new BadRequestException(
        'AMPG Alberta Spend Summary requires a LOCKED budget version. Lock a budget version before generating.',
      );
    }

    const version = await this.prisma.budgetVersion.findFirst({
      where: this.tenantFilter({ id: resolvedVersionId }),
      select: { id: true, name: true, status: true },
    });
    if (!version) throw new NotFoundException('Budget version not found');

    if (version.status !== BudgetVersionStatus.LOCKED) {
      throw new BadRequestException(
        'AMPG Alberta Spend Summary requires a LOCKED budget version. The selected budget version is not locked.',
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

    return {
      project: { id: project.id, title: project.title },
      budgetVersionId: resolvedVersionId,
      budgetVersionName: version.name,
      lines,
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
