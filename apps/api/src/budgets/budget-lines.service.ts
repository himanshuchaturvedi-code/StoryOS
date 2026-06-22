import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.context';
import { TenantAwareService } from '../tenant/tenant-aware.service';
import { BudgetVersionsService } from './budget-versions.service';
import { BudgetAccountsService } from './budget-accounts.service';
import { CreateBudgetLineDto } from './dto/create-budget-line.dto';
import { UpdateBudgetLineDto } from './dto/update-budget-line.dto';
import { AnnotateBudgetLineDto } from './dto/annotate-budget-line.dto';
import { labourAmountsEqual, resolveWriteLabourAmount } from './labour-amount-sync';

const ANNOTATION_FIELDS = [
  'personId', 'vendorId', 'locationId', 'productionPhaseId',
  'labourAmount', 'expenseType', 'activityType', 'isServiceContract', 'notes',
] as const;

@Injectable()
export class BudgetLinesService extends TenantAwareService {
  constructor(
    prisma: PrismaService,
    tenant: TenantContext,
    private readonly versionsService: BudgetVersionsService,
    private readonly accountsService: BudgetAccountsService,
  ) {
    super(prisma, tenant);
  }

  async list(budgetId: string, versionId: string) {
    await this.versionsService.assertVersionDraft(budgetId, versionId).catch(() => {
      // Allow listing even on locked versions — just no writes
    });
    return this.prisma.budgetLine.findMany({
      where: this.tenantFilter({ budgetVersionId: versionId }),
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
      orderBy: [{ account: { sortOrder: 'asc' } }, { account: { code: 'asc' } }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async create(budgetId: string, versionId: string, dto: CreateBudgetLineDto) {
    await this.versionsService.assertVersionDraft(budgetId, versionId);
    await this.accountsService.assertAccountExists(budgetId, dto.budgetAccountId);
    this.validatePartyExclusivity(dto.personId, dto.vendorId);

    const account = await this.prisma.budgetAccount.findFirst({
      where: this.tenantFilter({ id: dto.budgetAccountId, budgetId }),
      select: { accountType: true },
    });
    if (!account) throw new NotFoundException('Budget account not found');

    const syncedLabourAmount = resolveWriteLabourAmount({
      operation: 'create',
      expenseType: dto.expenseType ?? null,
      accountType: account.accountType,
      amount: dto.amount,
      currentLabourAmount: dto.labourAmount ?? null,
      requestedLabourAmount: dto.labourAmount ?? null,
    });

    return this.prisma.budgetLine.create({
      data: this.tenantData({
        budgetVersionId: versionId,
        budgetAccountId: dto.budgetAccountId,
        description: dto.description ?? null,
        quantity: dto.quantity ?? null,
        unitCost: dto.unitCost ?? null,
        amount: dto.amount,
        currency: dto.currency ?? 'CAD',
        fringeRate: dto.fringeRate ?? null,
        notes: dto.notes ?? null,
        personId: dto.personId ?? null,
        vendorId: dto.vendorId ?? null,
        locationId: dto.locationId ?? null,
        productionPhaseId: dto.productionPhaseId ?? null,
        labourAmount: syncedLabourAmount ?? null,
        expenseType: dto.expenseType ?? null,
        activityType: dto.activityType ?? null,
        isServiceContract: dto.isServiceContract ?? null,
      }),
      include: {
        account: {
          select: {
            id: true,
            code: true,
            name: true,
            accountType: true,
            defaultPhase: true,
            defaultLabourClassification: true,
          },
        },
      },
    });
  }

  async update(budgetId: string, versionId: string, lineId: string, dto: UpdateBudgetLineDto) {
    await this.versionsService.assertVersionDraft(budgetId, versionId);
    const existing = await this.loadLineWithAccount(versionId, lineId);

    const updateData: Record<string, unknown> = { ...dto };
    if (dto.amount !== undefined) {
      const syncedLabourAmount = resolveWriteLabourAmount({
        operation: 'amount_change',
        expenseType: existing.expenseType,
        accountType: existing.account.accountType,
        amount: dto.amount,
        currentLabourAmount:
          existing.labourAmount != null ? Number(existing.labourAmount) : null,
      });
      updateData.labourAmount = syncedLabourAmount ?? null;
    }

    return this.prisma.budgetLine.update({
      where: { id: lineId },
      data: updateData,
      include: {
        account: {
          select: {
            id: true,
            code: true,
            name: true,
            accountType: true,
            defaultPhase: true,
            defaultLabourClassification: true,
          },
        },
      },
    });
  }

  async annotate(budgetId: string, versionId: string, lineId: string, dto: AnnotateBudgetLineDto) {
    await this.assertVersionBelongsToBudget(budgetId, versionId);
    const existing = await this.loadLineWithAccount(versionId, lineId);
    this.validatePartyExclusivity(
      dto.personId !== undefined ? dto.personId : (existing as any).personId,
      dto.vendorId !== undefined ? dto.vendorId : (existing as any).vendorId,
    );

    const lineAmount = Number(existing.amount);
    const currentLabourAmount =
      existing.labourAmount != null ? Number(existing.labourAmount) : null;

    const syncedLabourAmount = resolveWriteLabourAmount({
      operation: 'annotate',
      expenseType: existing.expenseType,
      accountType: existing.account.accountType,
      amount: lineAmount,
      currentLabourAmount,
      annotateDto: {
        ...(dto.expenseType !== undefined ? { expenseType: dto.expenseType } : {}),
        ...(dto.labourAmount !== undefined ? { labourAmount: dto.labourAmount } : {}),
      },
    });

    const effectiveLabourAmount =
      syncedLabourAmount !== undefined ? syncedLabourAmount : currentLabourAmount;

    if (effectiveLabourAmount !== null && effectiveLabourAmount > lineAmount) {
      throw new BadRequestException('labourAmount cannot exceed line amount');
    }

    if (dto.isServiceContract === true) {
      const effectiveVendorId = dto.vendorId !== undefined ? dto.vendorId : (existing as any).vendorId;
      if (!effectiveVendorId) {
        throw new BadRequestException('isServiceContract requires a vendorId');
      }
    }

    const data: Record<string, unknown> = {};
    for (const field of ANNOTATION_FIELDS) {
      if (field in dto) {
        data[field] = (dto as any)[field] ?? null;
      }
    }
    if (syncedLabourAmount !== undefined) {
      data.labourAmount = syncedLabourAmount;
    }

    const changes = this.diffAnnotationFields(existing, data);

    const [updated] = await this.prisma.$transaction([
      this.prisma.budgetLine.update({
        where: { id: lineId },
        data,
        include: {
          account: {
            select: {
              id: true,
              code: true,
              name: true,
              accountType: true,
              defaultPhase: true,
              defaultLabourClassification: true,
            },
          },
        },
      }),
      ...(changes.length > 0
        ? [
            this.prisma.budgetLineAnnotationLog.createMany({
              data: changes.map((c) => ({
                budgetLineId: lineId,
                organizationId: this.organizationId,
                changedById: this.tenant.userId,
                fieldName: c.fieldName,
                oldValue: c.oldValue as any,
                newValue: c.newValue as any,
              })),
            }),
          ]
        : []),
    ]);

    return updated;
  }

  async getAnnotationCompleteness(budgetId: string, versionId: string) {
    await this.assertVersionBelongsToBudget(budgetId, versionId);

    const lines = await this.prisma.budgetLine.findMany({
      where: this.tenantFilter({ budgetVersionId: versionId }),
      select: {
        id: true,
        amount: true,
        personId: true,
        vendorId: true,
        locationId: true,
        productionPhaseId: true,
        expenseType: true,
        activityType: true,
        isServiceContract: true,
        account: {
          select: {
            defaultLabourClassification: true,
          },
        },
      },
    });

    const total = lines.length;
    if (total === 0) return { total: 0, annotated: 0, percentage: 0 };

    const annotated = lines.filter(
      (l) =>
        (l.personId || l.vendorId) &&
        l.locationId &&
        (l.expenseType || l.account.defaultLabourClassification),
    ).length;

    return {
      total,
      annotated,
      percentage: Math.round((annotated / total) * 100),
    };
  }

  async remove(budgetId: string, versionId: string, lineId: string) {
    await this.versionsService.assertVersionDraft(budgetId, versionId);
    await this.assertLineExists(versionId, lineId);
    await this.prisma.budgetLine.delete({ where: { id: lineId } });
  }

  private async assertLineExists(versionId: string, lineId: string) {
    const line = await this.prisma.budgetLine.findFirst({
      where: this.tenantFilter({ id: lineId, budgetVersionId: versionId }),
    });
    if (!line) throw new NotFoundException('Budget line not found');
    return line;
  }

  private async loadLineWithAccount(versionId: string, lineId: string) {
    const line = await this.prisma.budgetLine.findFirst({
      where: this.tenantFilter({ id: lineId, budgetVersionId: versionId }),
      include: { account: { select: { accountType: true } } },
    });
    if (!line) throw new NotFoundException('Budget line not found');
    return line;
  }

  private async assertVersionBelongsToBudget(budgetId: string, versionId: string) {
    const version = await this.prisma.budgetVersion.findFirst({
      where: this.tenantFilter({ id: versionId, budgetId }),
      select: { id: true },
    });
    if (!version) throw new NotFoundException('Budget version not found');
  }

  private validatePartyExclusivity(personId?: string | null, vendorId?: string | null) {
    if (personId && vendorId) {
      throw new BadRequestException('A budget line cannot reference both a person and a vendor');
    }
  }

  private diffAnnotationFields(
    existing: Record<string, unknown>,
    finalData: Record<string, unknown>,
  ): Array<{ fieldName: string; oldValue: unknown; newValue: unknown }> {
    const changes: Array<{ fieldName: string; oldValue: unknown; newValue: unknown }> = [];
    for (const field of ANNOTATION_FIELDS) {
      if (!(field in finalData)) continue;
      const oldVal = (existing as any)[field] ?? null;
      const newVal = (finalData as any)[field] ?? null;
      const oldStr = oldVal?.toString() ?? null;
      const newStr = newVal?.toString() ?? null;
      const numericEqual =
        field === 'labourAmount' &&
        labourAmountsEqual(
          oldVal != null ? Number(oldVal) : null,
          newVal != null ? Number(newVal) : null,
        );
      if (oldStr === newStr || numericEqual) continue;
      changes.push({ fieldName: field, oldValue: oldVal, newValue: newVal });
    }
    return changes;
  }
}
