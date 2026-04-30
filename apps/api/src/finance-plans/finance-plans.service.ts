import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.context';
import { TenantAwareService } from '../tenant/tenant-aware.service';
import { CreateFinancePlanDto } from './dto/create-finance-plan.dto';
import { UpdateFinancePlanDto } from './dto/update-finance-plan.dto';

@Injectable()
export class FinancePlansService extends TenantAwareService {
  constructor(prisma: PrismaService, tenant: TenantContext) {
    super(prisma, tenant);
  }

  async list(projectId: string) {
    await this.assertProjectExists(projectId);
    return this.prisma.financePlan.findMany({
      where: this.tenantFilter({ projectId }),
      include: {
        sources: {
          where: this.softDeleteFilter,
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findById(planId: string) {
    const plan = await this.prisma.financePlan.findFirst({
      where: this.tenantFilter({ id: planId }),
      include: {
        sources: {
          where: this.softDeleteFilter,
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!plan) throw new NotFoundException('Finance plan not found');
    return plan;
  }

  async create(projectId: string, dto: CreateFinancePlanDto) {
    await this.assertProjectExists(projectId);
    return this.prisma.financePlan.create({
      data: this.tenantData({
        projectId,
        name: dto.name,
        baseCurrency: dto.baseCurrency ?? 'CAD',
        notes: dto.notes ?? null,
        createdById: this.tenant.userId,
      }),
      include: {
        sources: true,
      },
    });
  }

  async update(planId: string, dto: UpdateFinancePlanDto) {
    await this.assertPlanExists(planId);
    return this.prisma.financePlan.update({
      where: { id: planId },
      data: dto,
    });
  }

  async remove(planId: string) {
    await this.assertPlanExists(planId);
    await this.prisma.financePlan.delete({ where: { id: planId } });
  }

  /**
   * Returns a summary for a plan: total committed, total estimated,
   * total received, grand total, and per-type breakdown.
   */
  async summary(planId: string) {
    await this.assertPlanExists(planId);

    const sources = await this.prisma.financeSource.findMany({
      where: this.tenantFilter({ financePlanId: planId }),
    });

    const totals = { ESTIMATED: 0, COMMITTED: 0, RECEIVED: 0 };
    const byType: Record<string, number> = {};

    for (const s of sources) {
      const amt = Number(s.amount);
      totals[s.status as keyof typeof totals] =
        (totals[s.status as keyof typeof totals] ?? 0) + amt;
      byType[s.sourceType] = (byType[s.sourceType] ?? 0) + amt;
    }

    return {
      planId,
      grandTotal: sources.reduce((sum, s) => sum + Number(s.amount), 0),
      byStatus: totals,
      byType,
    };
  }

  async assertPlanExists(planId: string) {
    const plan = await this.prisma.financePlan.findFirst({
      where: this.tenantFilter({ id: planId }),
      select: { id: true },
    });
    if (!plan) throw new NotFoundException('Finance plan not found');
  }

  private async assertProjectExists(projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: this.tenantFilter({ id: projectId }),
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');
  }
}
