import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.context';
import { TenantAwareService } from '../tenant/tenant-aware.service';
import { BudgetTemplatesService } from '../budget-templates/budget-templates.service';
import { BudgetsService } from './budgets.service';
import { CreateBudgetVersionDto } from './dto/create-budget-version.dto';
import { resolveWriteLabourAmount, collectLabourAmountRepairs } from './labour-amount-sync';

@Injectable()
export class BudgetVersionsService extends TenantAwareService {
  constructor(
    prisma: PrismaService,
    tenant: TenantContext,
    private readonly budgetsService: BudgetsService,
    private readonly budgetTemplatesService: BudgetTemplatesService,
  ) {
    super(prisma, tenant);
  }

  async list(budgetId: string) {
    await this.budgetsService.assertBudgetExists(budgetId);
    return this.prisma.budgetVersion.findMany({
      where: this.tenantFilter({ budgetId }),
      orderBy: { versionNumber: 'desc' },
    });
  }

  async findById(budgetId: string, versionId: string) {
    const version = await this.prisma.budgetVersion.findFirst({
      where: this.tenantFilter({ id: versionId, budgetId }),
      include: {
        lines: {
          where: this.softDeleteFilter,
          include: {
            account: {
              select: {
                id: true,
                code: true,
                name: true,
                accountType: true,
                defaultPhase: true,
                defaultLabourClassification: true,
                isHeader: true,
              },
            },
          },
          orderBy: [{ account: { sortOrder: 'asc' } }, { account: { code: 'asc' } }],
        },
        budget: {
          select: {
            accounts: {
              where: this.softDeleteFilter,
              orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
              select: {
                id: true,
                code: true,
                name: true,
                accountType: true,
                defaultPhase: true,
                defaultLabourClassification: true,
                isHeader: true,
                sortOrder: true,
                parentId: true,
              },
            },
          },
        },
      },
    });
    if (!version) throw new NotFoundException('Budget version not found');

    const repairs = collectLabourAmountRepairs(
      version.lines.map((line) => ({
        lineKey: line.id,
        expenseType: line.expenseType,
        accountType: line.account.accountType,
        amount: Number(line.amount),
        currentLabourAmount:
          line.labourAmount != null ? Number(line.labourAmount) : null,
      })),
    );

    if (repairs.length > 0) {
      await this.prisma.$transaction(
        repairs.map((repair) =>
          this.prisma.budgetLine.update({
            where: { id: repair.lineKey },
            data: { labourAmount: repair.targetLabourAmount },
          }),
        ),
      );

      const repairById = new Map(
        repairs.map((repair) => [repair.lineKey, repair.targetLabourAmount]),
      );
      for (const line of version.lines) {
        const repaired = repairById.get(line.id);
        if (repaired !== undefined) {
          line.labourAmount = repaired as typeof line.labourAmount;
        }
      }
    }

    const { budget, ...rest } = version;
    return { ...rest, accounts: budget.accounts };
  }

  async create(budgetId: string, dto: CreateBudgetVersionDto) {
    await this.budgetsService.assertBudgetExists(budgetId);

    // Determine next version number
    const latest = await this.prisma.budgetVersion.findFirst({
      where: this.tenantFilter({ budgetId }),
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });
    const nextVersion = (latest?.versionNumber ?? 0) + 1;

    const version = await this.prisma.budgetVersion.create({
      data: this.tenantData({
        budgetId,
        versionNumber: nextVersion,
        name: dto.name,
        notes: dto.notes ?? null,
        createdById: this.tenant.userId,
      }),
    });

    if (dto.templateId) {
      const accountCount = await this.prisma.budgetAccount.count({
        where: this.tenantFilter({ budgetId }),
      });

      if (accountCount === 0) {
        await this.budgetTemplatesService.cloneAccountsToBudget(
          dto.templateId,
          budgetId,
          this.organizationId,
        );
      }
    }

    // Clone lines from a source version if requested
    if (dto.cloneFromVersionId) {
      const source = await this.prisma.budgetVersion.findFirst({
        where: this.tenantFilter({ id: dto.cloneFromVersionId, budgetId }),
        select: { id: true },
      });
      if (!source) throw new BadRequestException('Source version not found');

      const sourceLines = await this.prisma.budgetLine.findMany({
        where: { budgetVersionId: dto.cloneFromVersionId, ...this.softDeleteFilter },
        include: {
          account: {
            select: { accountType: true },
          },
        },
      });

      if (sourceLines.length > 0) {
        await this.prisma.$transaction(
          sourceLines.map((line) => {
            const amount = Number(line.amount);
            const currentLabourAmount =
              line.labourAmount != null ? Number(line.labourAmount) : null;
            const syncedLabourAmount = resolveWriteLabourAmount({
              operation: 'clone',
              expenseType: line.expenseType,
              accountType: line.account.accountType,
              amount,
              currentLabourAmount,
            });

            return this.prisma.budgetLine.create({
              data: {
                budgetVersionId: version.id,
                budgetAccountId: line.budgetAccountId,
                organizationId: this.organizationId,
                description: line.description,
                quantity: line.quantity,
                unitCost: line.unitCost,
                amount: line.amount,
                currency: line.currency,
                fringeRate: line.fringeRate,
                notes: line.notes,
                personId: line.personId,
                vendorId: line.vendorId,
                locationId: line.locationId,
                productionPhaseId: line.productionPhaseId,
                labourAmount: syncedLabourAmount ?? null,
                expenseType: line.expenseType,
                activityType: line.activityType,
                isServiceContract: line.isServiceContract,
                sortOrder: line.sortOrder,
              },
            });
          }),
        );
      }
    }

    return this.findById(budgetId, version.id);
  }

  async lock(budgetId: string, versionId: string) {
    await this.budgetsService.assertBudgetExists(budgetId);
    const version = await this.prisma.budgetVersion.findFirst({
      where: this.tenantFilter({ id: versionId, budgetId }),
    });
    if (!version) throw new NotFoundException('Budget version not found');

    if (version.status === 'LOCKED') {
      throw new BadRequestException('Version is already locked');
    }

    return this.prisma.budgetVersion.update({
      where: { id: versionId },
      data: {
        status: 'LOCKED',
        lockedAt: new Date(),
        lockedById: this.tenant.userId,
      },
    });
  }

  async unlock(budgetId: string, versionId: string) {
    await this.budgetsService.assertBudgetExists(budgetId);
    const version = await this.prisma.budgetVersion.findFirst({
      where: this.tenantFilter({ id: versionId, budgetId }),
    });
    if (!version) throw new NotFoundException('Budget version not found');

    if (version.status !== 'LOCKED') {
      throw new BadRequestException('Version is not locked');
    }

    return this.prisma.budgetVersion.update({
      where: { id: versionId },
      data: {
        status: 'DRAFT',
        lockedAt: null,
        lockedById: null,
      },
    });
  }

  async remove(budgetId: string, versionId: string) {
    await this.budgetsService.assertBudgetExists(budgetId);
    const version = await this.prisma.budgetVersion.findFirst({
      where: this.tenantFilter({ id: versionId, budgetId }),
    });
    if (!version) throw new NotFoundException('Budget version not found');

    if (version.status === 'LOCKED') {
      throw new ForbiddenException('Cannot delete a locked budget version');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.budgetLine.deleteMany({
        where: { budgetVersionId: versionId, organizationId: this.organizationId },
      });
      await tx.budgetVersion.delete({ where: { id: versionId } });
    });
  }

  /**
   * Asserts the version exists AND is still DRAFT.
   * Used by BudgetLinesService before any write operation.
   */
  async assertVersionDraft(budgetId: string, versionId: string) {
    const version = await this.prisma.budgetVersion.findFirst({
      where: this.tenantFilter({ id: versionId, budgetId }),
      select: { id: true, status: true },
    });
    if (!version) throw new NotFoundException('Budget version not found');
    if (version.status === 'LOCKED') {
      throw new ForbiddenException('Cannot modify lines on a locked budget version');
    }
  }
}
