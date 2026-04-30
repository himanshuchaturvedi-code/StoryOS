import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.context';
import { TenantAwareService } from '../tenant/tenant-aware.service';
import { FinancePlansService } from './finance-plans.service';
import { CreateFinanceSourceDto } from './dto/create-finance-source.dto';
import { UpdateFinanceSourceDto } from './dto/update-finance-source.dto';

@Injectable()
export class FinanceSourcesService extends TenantAwareService {
  constructor(
    prisma: PrismaService,
    tenant: TenantContext,
    private readonly plansService: FinancePlansService,
  ) {
    super(prisma, tenant);
  }

  async list(planId: string) {
    await this.plansService.assertPlanExists(planId);
    return this.prisma.financeSource.findMany({
      where: this.tenantFilter({ financePlanId: planId }),
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(planId: string, dto: CreateFinanceSourceDto) {
    await this.plansService.assertPlanExists(planId);
    return this.prisma.financeSource.create({
      data: this.tenantData({
        financePlanId: planId,
        sourceType: dto.sourceType,
        name: dto.name,
        amount: dto.amount,
        currency: dto.currency ?? 'CAD',
        status: dto.status ?? 'ESTIMATED',
        conditions: dto.conditions ?? null,
        notes: dto.notes ?? null,
      }),
    });
  }

  async update(planId: string, sourceId: string, dto: UpdateFinanceSourceDto) {
    await this.plansService.assertPlanExists(planId);
    await this.assertSourceExists(planId, sourceId);
    return this.prisma.financeSource.update({
      where: { id: sourceId },
      data: dto,
    });
  }

  async remove(planId: string, sourceId: string) {
    await this.plansService.assertPlanExists(planId);
    await this.assertSourceExists(planId, sourceId);
    await this.prisma.financeSource.delete({ where: { id: sourceId } });
  }

  private async assertSourceExists(planId: string, sourceId: string) {
    const source = await this.prisma.financeSource.findFirst({
      where: this.tenantFilter({ id: sourceId, financePlanId: planId }),
      select: { id: true },
    });
    if (!source) throw new NotFoundException('Finance source not found');
  }
}
