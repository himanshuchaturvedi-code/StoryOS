import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.context';
import { TenantAwareService } from '../tenant/tenant-aware.service';
import { CreateExpenseFactDto } from './dto/create-expense-fact.dto';
import { UpdateExpenseFactDto } from './dto/update-expense-fact.dto';
import { DeriveExpenseFactsDto } from './dto/derive-expense-facts.dto';

const INCLUDE_RELATIONS = {
  actualLine: {
    select: {
      id: true,
      amount: true,
      currency: true,
      description: true,
      vendor: true,
      transactionDate: true,
      budgetAccountId: true,
      budgetId: true,
    },
  },
  vendor: { select: { id: true, name: true, vendorType: true, country: true } },
  person: { select: { id: true, firstName: true, lastName: true } },
  location: { select: { id: true, name: true, country: true, provinceState: true, zoneCode: true } },
  productionPhase: { select: { id: true, phaseType: true, name: true } },
} as const;

@Injectable()
export class ExpenseFactsService extends TenantAwareService {
  constructor(prisma: PrismaService, tenant: TenantContext) {
    super(prisma, tenant);
  }

  async list(
    projectId: string,
    filters?: {
      vendorId?: string;
      personId?: string;
      locationId?: string;
      productionPhaseId?: string;
      labourFlag?: string;
      serviceFlag?: string;
    },
  ) {
    await this.assertProjectExists(projectId);
    return this.prisma.expenseFact.findMany({
      where: this.tenantFilter({
        projectId,
        ...(filters?.vendorId ? { vendorId: filters.vendorId } : {}),
        ...(filters?.personId ? { personId: filters.personId } : {}),
        ...(filters?.locationId ? { locationId: filters.locationId } : {}),
        ...(filters?.productionPhaseId ? { productionPhaseId: filters.productionPhaseId } : {}),
        ...(filters?.labourFlag !== undefined ? { labourFlag: filters.labourFlag === 'true' } : {}),
        ...(filters?.serviceFlag !== undefined ? { serviceFlag: filters.serviceFlag === 'true' } : {}),
      }),
      include: INCLUDE_RELATIONS,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(projectId: string, expenseFactId: string) {
    const fact = await this.prisma.expenseFact.findFirst({
      where: this.tenantFilter({ id: expenseFactId, projectId }),
      include: INCLUDE_RELATIONS,
    });
    if (!fact) throw new NotFoundException('Expense fact not found');
    return fact;
  }

  /**
   * Create an ExpenseFact from a specific ActualLine.
   * Validates the ActualLine exists, belongs to the same org AND the same
   * project as the route (prevents cross-project references within one org),
   * and doesn't already have an ExpenseFact attached.
   */
  async create(projectId: string, dto: CreateExpenseFactDto) {
    await this.assertProjectExists(projectId);
    const actualLine = await this.assertActualLineBelongsToProject(dto.actualLineId, projectId);
    await this.assertNoExistingFact(dto.actualLineId);

    if (dto.vendorId) await this.assertVendorBelongsToOrg(dto.vendorId);
    if (dto.personId) await this.assertPersonBelongsToOrg(dto.personId);
    if (dto.locationId) await this.assertLocationBelongsToOrg(dto.locationId);
    if (dto.productionPhaseId) await this.assertPhaseBelongsToProject(projectId, dto.productionPhaseId);

    return this.prisma.expenseFact.create({
      data: this.tenantData({
        projectId,
        actualLineId: dto.actualLineId,
        vendorId: dto.vendorId ?? null,
        personId: dto.personId ?? null,
        locationId: dto.locationId ?? null,
        productionPhaseId: dto.productionPhaseId ?? null,
        budgetAccountId: dto.budgetAccountId ?? actualLine.budgetAccountId,
        eligiblePortion: dto.eligiblePortion ?? 1.0,
        labourFlag: dto.labourFlag ?? false,
        serviceFlag: dto.serviceFlag ?? false,
        notes: dto.notes ?? null,
        createdById: this.tenant.userId,
      }),
      include: INCLUDE_RELATIONS,
    });
  }

  /**
   * Update eligibility annotations. Cannot change actualLineId (the 1:1
   * binding is permanent; delete and recreate if needed).
   */
  async update(projectId: string, expenseFactId: string, dto: UpdateExpenseFactDto) {
    await this.assertFactExists(projectId, expenseFactId);

    if (dto.vendorId) await this.assertVendorBelongsToOrg(dto.vendorId);
    if (dto.personId) await this.assertPersonBelongsToOrg(dto.personId);
    if (dto.locationId) await this.assertLocationBelongsToOrg(dto.locationId);
    if (dto.productionPhaseId) await this.assertPhaseBelongsToProject(projectId, dto.productionPhaseId);

    return this.prisma.expenseFact.update({
      where: { id: expenseFactId },
      data: dto,
      include: INCLUDE_RELATIONS,
    });
  }

  async remove(projectId: string, expenseFactId: string) {
    await this.assertFactExists(projectId, expenseFactId);
    await this.prisma.expenseFact.delete({ where: { id: expenseFactId } });
  }

  /**
   * Bulk-derive ExpenseFacts from all ActualLines on a project's budget(s)
   * that don't already have an associated ExpenseFact.
   *
   * The derivation creates a 1:1 ExpenseFact for each orphaned ActualLine,
   * copying the budgetAccountId and applying the uniform annotation from
   * the DTO (vendor, location, phase, eligiblePortion, flags).
   *
   * Returns the count of newly created records.
   */
  async deriveFromActualLines(projectId: string, dto: DeriveExpenseFactsDto) {
    await this.assertProjectExists(projectId);

    if (dto.vendorId) await this.assertVendorBelongsToOrg(dto.vendorId);
    if (dto.locationId) await this.assertLocationBelongsToOrg(dto.locationId);
    if (dto.productionPhaseId) await this.assertPhaseBelongsToProject(projectId, dto.productionPhaseId);

    const budgets = await this.prisma.budget.findMany({
      where: this.tenantFilter({ projectId }),
      select: { id: true },
    });

    if (budgets.length === 0) return { derived: 0 };

    const budgetIds = budgets.map((b) => b.id);

    const orphanedLines = await this.prisma.actualLine.findMany({
      where: {
        ...this.tenantFilter(),
        budgetId: { in: budgetIds },
        expenseFact: null,
      },
      select: { id: true, budgetAccountId: true },
    });

    if (orphanedLines.length === 0) return { derived: 0 };

    const result = await this.prisma.expenseFact.createMany({
      data: orphanedLines.map((line) => ({
        organizationId: this.organizationId,
        projectId,
        actualLineId: line.id,
        budgetAccountId: line.budgetAccountId,
        vendorId: dto.vendorId ?? null,
        locationId: dto.locationId ?? null,
        productionPhaseId: dto.productionPhaseId ?? null,
        eligiblePortion: dto.eligiblePortion ?? 1.0,
        labourFlag: dto.labourFlag ?? false,
        serviceFlag: dto.serviceFlag ?? false,
        createdById: this.tenant.userId,
      })),
      // skipDuplicates: guards against a concurrent derive request racing on the
      // same ActualLines. The unique constraint on actualLineId means the second
      // request would otherwise throw P2002. With skipDuplicates the winner wins
      // and the loser silently skips — the end result is still exactly one
      // ExpenseFact per ActualLine.
      skipDuplicates: true,
    });

    return { derived: result.count };
  }

  /**
   * Summary for incentive readiness: counts and totals by classification.
   * Computed at query time — never stored.
   */
  async summary(projectId: string) {
    await this.assertProjectExists(projectId);

    const facts = await this.prisma.expenseFact.findMany({
      where: this.tenantFilter({ projectId }),
      select: {
        eligiblePortion: true,
        labourFlag: true,
        serviceFlag: true,
        actualLine: { select: { amount: true } },
      },
    });

    let totalAmount = 0;
    let eligibleAmount = 0;
    let labourCount = 0;
    let labourAmount = 0;
    let serviceCount = 0;
    let serviceAmount = 0;

    for (const fact of facts) {
      const amt = Number(fact.actualLine.amount);
      const eligible = amt * Number(fact.eligiblePortion);
      totalAmount += amt;
      eligibleAmount += eligible;

      if (fact.labourFlag) {
        labourCount++;
        labourAmount += eligible;
      }
      if (fact.serviceFlag) {
        serviceCount++;
        serviceAmount += eligible;
      }
    }

    return {
      projectId,
      totalFacts: facts.length,
      totalAmount: Math.round(totalAmount * 100) / 100,
      eligibleAmount: Math.round(eligibleAmount * 100) / 100,
      labour: { count: labourCount, eligibleAmount: Math.round(labourAmount * 100) / 100 },
      service: { count: serviceCount, eligibleAmount: Math.round(serviceAmount * 100) / 100 },
    };
  }

  // ── Assertion helpers ───────────────────────────────────────────────────────

  private async assertProjectExists(projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: this.tenantFilter({ id: projectId }),
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');
  }

  private async assertFactExists(projectId: string, factId: string) {
    const fact = await this.prisma.expenseFact.findFirst({
      where: this.tenantFilter({ id: factId, projectId }),
      select: { id: true },
    });
    if (!fact) throw new NotFoundException('Expense fact not found');
  }

  private async assertActualLineBelongsToProject(actualLineId: string, projectId: string) {
    // Join through Budget to verify the ActualLine's budget belongs to the
    // route projectId. Checking org membership alone would allow an ActualLine
    // from Project B to be attached to an ExpenseFact on Project A — both in
    // the same org. The budgetId → project join closes that gap.
    const line = await this.prisma.actualLine.findFirst({
      where: {
        ...this.tenantFilter({ id: actualLineId }),
        budget: { projectId },
      },
      select: { id: true, budgetAccountId: true, budgetId: true },
    });
    if (!line) {
      throw new BadRequestException(
        'Actual line not found, does not belong to this organization, ' +
          'or belongs to a different project.',
      );
    }
    return line;
  }

  private async assertNoExistingFact(actualLineId: string) {
    const existing = await this.prisma.expenseFact.findUnique({
      where: { actualLineId },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'This actual line already has an expense fact attached. ' +
          'Delete the existing fact first, or update it instead.',
      );
    }
  }

  private async assertVendorBelongsToOrg(vendorId: string) {
    const vendor = await this.prisma.vendor.findFirst({
      where: this.tenantFilter({ id: vendorId }),
      select: { id: true },
    });
    if (!vendor) throw new BadRequestException('Vendor not found in this organization');
  }

  private async assertPersonBelongsToOrg(personId: string) {
    const person = await this.prisma.person.findFirst({
      where: this.tenantFilter({ id: personId }),
      select: { id: true },
    });
    if (!person) throw new BadRequestException('Person not found in this organization');
  }

  private async assertLocationBelongsToOrg(locationId: string) {
    const loc = await this.prisma.location.findFirst({
      where: this.tenantFilter({ id: locationId }),
      select: { id: true },
    });
    if (!loc) throw new BadRequestException('Location not found in this organization');
  }

  private async assertPhaseBelongsToProject(projectId: string, phaseId: string) {
    const phase = await this.prisma.productionPhase.findFirst({
      where: this.tenantFilter({ id: phaseId, projectId }),
      select: { id: true },
    });
    if (!phase) throw new BadRequestException('Production phase not found on this project');
  }
}
