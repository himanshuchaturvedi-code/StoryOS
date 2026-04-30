import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.context';
import { TenantAwareService } from '../tenant/tenant-aware.service';
import { BudgetsService } from './budgets.service';
import { BudgetAccountsService } from './budget-accounts.service';
import { CreateActualLineDto } from './dto/create-actual-line.dto';
import { UpdateActualLineDto } from './dto/update-actual-line.dto';

@Injectable()
export class ActualLinesService extends TenantAwareService {
  constructor(
    prisma: PrismaService,
    tenant: TenantContext,
    private readonly budgetsService: BudgetsService,
    private readonly accountsService: BudgetAccountsService,
  ) {
    super(prisma, tenant);
  }

  async list(budgetId: string, accountId?: string, from?: string, to?: string) {
    await this.budgetsService.assertBudgetExists(budgetId);

    const dateFilter: Record<string, unknown> = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);

    return this.prisma.actualLine.findMany({
      where: this.tenantFilter({
        budgetId,
        ...(accountId ? { budgetAccountId: accountId } : {}),
        ...(Object.keys(dateFilter).length > 0 ? { transactionDate: dateFilter } : {}),
      }),
      include: {
        account: {
          select: { id: true, code: true, name: true, accountType: true },
        },
      },
      orderBy: { transactionDate: 'desc' },
    });
  }

  async create(budgetId: string, dto: CreateActualLineDto) {
    await this.budgetsService.assertBudgetExists(budgetId);
    await this.accountsService.assertAccountExists(budgetId, dto.budgetAccountId);

    return this.prisma.actualLine.create({
      data: this.tenantData({
        budgetId,
        budgetAccountId: dto.budgetAccountId,
        description: dto.description ?? null,
        vendor: dto.vendor ?? null,
        invoiceRef: dto.invoiceRef ?? null,
        amount: dto.amount,
        currency: dto.currency ?? 'CAD',
        baseCurrencyAmount: dto.baseCurrencyAmount ?? null,
        transactionDate: new Date(dto.transactionDate),
        postedDate: dto.postedDate ? new Date(dto.postedDate) : null,
        notes: dto.notes ?? null,
        createdById: this.tenant.userId,
      }),
      include: {
        account: {
          select: { id: true, code: true, name: true, accountType: true },
        },
      },
    });
  }

  async update(budgetId: string, actualId: string, dto: UpdateActualLineDto) {
    await this.budgetsService.assertBudgetExists(budgetId);
    await this.assertActualExists(budgetId, actualId);

    const { transactionDate, postedDate, ...rest } = dto;
    return this.prisma.actualLine.update({
      where: { id: actualId },
      data: {
        ...rest,
        ...(transactionDate !== undefined
          ? { transactionDate: new Date(transactionDate) }
          : {}),
        ...(postedDate !== undefined
          ? { postedDate: postedDate ? new Date(postedDate) : null }
          : {}),
      },
      include: {
        account: {
          select: { id: true, code: true, name: true, accountType: true },
        },
      },
    });
  }

  async remove(budgetId: string, actualId: string) {
    await this.budgetsService.assertBudgetExists(budgetId);
    await this.assertActualExists(budgetId, actualId);
    await this.prisma.actualLine.delete({ where: { id: actualId } });
  }

  /**
   * Budget vs. actuals reconciliation for a specific version.
   * Returns per-account: budget total, actual total, variance.
   * Computed at query time — no stored reconciliation table.
   */
  async reconciliation(budgetId: string, versionId: string) {
    await this.budgetsService.assertBudgetExists(budgetId);

    // Fetch all accounts for structure
    const accounts = await this.prisma.budgetAccount.findMany({
      where: this.tenantFilter({ budgetId }),
      select: { id: true, code: true, name: true, accountType: true, parentId: true, isHeader: true },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });

    // Aggregate budget lines for the given version
    const budgetAgg = await this.prisma.budgetLine.groupBy({
      by: ['budgetAccountId'],
      where: { budgetVersionId: versionId, ...this.softDeleteFilter },
      _sum: { amount: true },
    });

    // Aggregate actual lines for the budget
    const actualAgg = await this.prisma.actualLine.groupBy({
      by: ['budgetAccountId'],
      where: this.tenantFilter({ budgetId }),
      _sum: { amount: true },
    });

    const budgetMap = new Map(
      budgetAgg.map((r) => [r.budgetAccountId, Number(r._sum.amount ?? 0)]),
    );
    const actualMap = new Map(
      actualAgg.map((r) => [r.budgetAccountId, Number(r._sum.amount ?? 0)]),
    );

    const lines = accounts.map((account) => {
      const budgetTotal = budgetMap.get(account.id) ?? 0;
      const actualTotal = actualMap.get(account.id) ?? 0;
      return {
        accountId: account.id,
        code: account.code,
        name: account.name,
        accountType: account.accountType,
        isHeader: account.isHeader,
        parentId: account.parentId,
        budgetTotal,
        actualTotal,
        variance: budgetTotal - actualTotal,
      };
    });

    const totals = lines.reduce(
      (acc, l) => {
        if (!l.isHeader) {
          acc.budgetTotal += l.budgetTotal;
          acc.actualTotal += l.actualTotal;
        }
        return acc;
      },
      { budgetTotal: 0, actualTotal: 0 },
    );

    return {
      budgetId,
      versionId,
      lines,
      totals: { ...totals, variance: totals.budgetTotal - totals.actualTotal },
    };
  }

  private async assertActualExists(budgetId: string, actualId: string) {
    const actual = await this.prisma.actualLine.findFirst({
      where: this.tenantFilter({ id: actualId, budgetId }),
      select: { id: true },
    });
    if (!actual) throw new NotFoundException('Actual line not found');
  }
}
