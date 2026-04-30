import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BudgetVersionStatus } from '@storyos/types';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.context';
import { TenantAwareService } from '../tenant/tenant-aware.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';

@Injectable()
export class BudgetsService extends TenantAwareService {
  constructor(
    prisma: PrismaService,
    tenant: TenantContext,
  ) {
    super(prisma, tenant);
  }

  async list(projectId: string) {
    await this.assertProjectExists(projectId);
    return this.prisma.budget.findMany({
      where: this.tenantFilter({ projectId }),
      include: {
        versions: {
          where: this.softDeleteFilter,
          select: { id: true, versionNumber: true, name: true, status: true },
          orderBy: { versionNumber: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(budgetId: string) {
    const budget = await this.prisma.budget.findFirst({
      where: this.tenantFilter({ id: budgetId }),
      include: {
        accounts: {
          where: this.softDeleteFilter,
          orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
        },
        versions: {
          where: this.softDeleteFilter,
          select: {
            id: true,
            versionNumber: true,
            name: true,
            status: true,
            lockedAt: true,
            createdAt: true,
          },
          orderBy: { versionNumber: 'desc' },
        },
      },
    });
    if (!budget) throw new NotFoundException('Budget not found');
    return budget;
  }

  async create(projectId: string, dto: CreateBudgetDto) {
    await this.assertProjectExists(projectId);

    const budget = await this.prisma.budget.create({
      data: this.tenantData({
        projectId,
        name: dto.name,
        description: dto.description ?? null,
        baseCurrency: dto.baseCurrency ?? 'CAD',
        createdById: this.tenant.userId,
      }),
    });

    return this.findById(budget.id);
  }

  async update(budgetId: string, dto: UpdateBudgetDto) {
    await this.assertBudgetExists(budgetId);
    return this.prisma.budget.update({
      where: { id: budgetId },
      data: dto,
    });
  }

  async remove(budgetId: string) {
    await this.assertBudgetExists(budgetId);

    const lockedVersionCount = await this.prisma.budgetVersion.count({
      where: this.tenantFilter({ budgetId, status: BudgetVersionStatus.LOCKED }),
    });
    if (lockedVersionCount > 0) {
      throw new ForbiddenException('Unlock budget before deleting');
    }

    await this.prisma.$transaction(async (tx) => {
      // Delete in dependency order to satisfy FK constraints
      const versions = await tx.budgetVersion.findMany({
        where: this.tenantFilter({ budgetId }),
        select: { id: true },
      });
      const versionIds = versions.map((v) => v.id);

      const actualLines = await tx.actualLine.findMany({
        where: { budgetId, organizationId: this.organizationId },
        select: { id: true },
      });
      const actualLineIds = actualLines.map((line) => line.id);

      if (actualLineIds.length > 0) {
        await tx.expenseFact.deleteMany({
          where: { actualLineId: { in: actualLineIds }, organizationId: this.organizationId },
        });
      }
      await tx.actualLine.deleteMany({ where: { budgetId } });

      if (versionIds.length > 0) {
        await tx.budgetLine.deleteMany({ where: { budgetVersionId: { in: versionIds } } });
      }
      await tx.budgetVersion.deleteMany({ where: { budgetId } });

      // Null parent refs so we can delete accounts (self-referential FK)
      await tx.budgetAccount.updateMany({
        where: { budgetId, organizationId: this.organizationId },
        data: { parentId: null },
      });
      await tx.budgetAccount.deleteMany({
        where: { budgetId, organizationId: this.organizationId },
      });

      await tx.budget.delete({ where: { id: budgetId } });
    });
  }

  async assertBudgetExists(budgetId: string) {
    const budget = await this.prisma.budget.findFirst({
      where: this.tenantFilter({ id: budgetId }),
      select: { id: true },
    });
    if (!budget) throw new NotFoundException('Budget not found');
  }

  private async assertProjectExists(projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: this.tenantFilter({ id: projectId }),
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');
  }
}
