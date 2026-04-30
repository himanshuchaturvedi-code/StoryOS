import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.context';
import { TenantAwareService } from '../tenant/tenant-aware.service';
import { BudgetsService } from './budgets.service';
import { CreateBudgetAccountDto } from './dto/create-budget-account.dto';
import { UpdateBudgetAccountDto } from './dto/update-budget-account.dto';

@Injectable()
export class BudgetAccountsService extends TenantAwareService {
  constructor(
    prisma: PrismaService,
    tenant: TenantContext,
    private readonly budgetsService: BudgetsService,
  ) {
    super(prisma, tenant);
  }

  async list(budgetId: string) {
    await this.budgetsService.assertBudgetExists(budgetId);
    return this.prisma.budgetAccount.findMany({
      where: this.tenantFilter({ budgetId }),
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
  }

  async create(budgetId: string, dto: CreateBudgetAccountDto) {
    await this.budgetsService.assertBudgetExists(budgetId);

    const existing = await this.prisma.budgetAccount.findFirst({
      where: { budgetId, code: dto.code, ...this.softDeleteFilter },
    });
    if (existing) {
      throw new ConflictException(`Account code '${dto.code}' already exists in this budget`);
    }

    if (dto.parentId) {
      await this.assertAccountExists(budgetId, dto.parentId);
    }

    return this.prisma.budgetAccount.create({
      data: this.tenantData({
        budgetId,
        code: dto.code,
        name: dto.name,
        accountType: dto.accountType ?? null,
        cptcRole: dto.cptcRole ?? null,
        isHeader: dto.isHeader ?? false,
        sortOrder: dto.sortOrder ?? 0,
        parentId: dto.parentId ?? null,
      }),
    });
  }

  async update(budgetId: string, accountId: string, dto: UpdateBudgetAccountDto) {
    await this.budgetsService.assertBudgetExists(budgetId);
    await this.assertAccountExists(budgetId, accountId);

    if (dto.code) {
      const conflict = await this.prisma.budgetAccount.findFirst({
        where: { budgetId, code: dto.code, id: { not: accountId }, ...this.softDeleteFilter },
      });
      if (conflict) {
        throw new ConflictException(`Account code '${dto.code}' already exists in this budget`);
      }
    }

    if (dto.parentId !== undefined) {
      if (dto.parentId !== null) {
        await this.assertAccountExists(budgetId, dto.parentId);
        if (dto.parentId === accountId) {
          throw new BadRequestException('An account cannot be its own parent');
        }
      }
    }

    return this.prisma.budgetAccount.update({
      where: { id: accountId },
      data: dto,
    });
  }

  async remove(budgetId: string, accountId: string) {
    await this.budgetsService.assertBudgetExists(budgetId);
    await this.assertAccountExists(budgetId, accountId);

    const childCount = await this.prisma.budgetAccount.count({
      where: { budgetId, parentId: accountId, ...this.softDeleteFilter },
    });
    if (childCount > 0) {
      throw new BadRequestException(
        'Cannot delete an account that has child accounts. Remove or reparent children first.',
      );
    }

    await this.prisma.budgetAccount.delete({ where: { id: accountId } });
  }

  async assertAccountExists(budgetId: string, accountId: string) {
    const account = await this.prisma.budgetAccount.findFirst({
      where: this.tenantFilter({ id: accountId, budgetId }),
      select: { id: true },
    });
    if (!account) throw new NotFoundException('Budget account not found');
  }
}
