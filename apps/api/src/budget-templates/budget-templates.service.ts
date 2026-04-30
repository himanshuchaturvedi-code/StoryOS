import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.context';
import { TenantAwareService } from '../tenant/tenant-aware.service';
import { CreateBudgetTemplateDto } from './dto/create-budget-template.dto';
import { UpdateBudgetTemplateDto } from './dto/update-budget-template.dto';
import { CreateTemplateAccountDto } from './dto/create-template-account.dto';
import { UpdateTemplateAccountDto } from './dto/update-template-account.dto';

@Injectable()
export class BudgetTemplatesService extends TenantAwareService {
  constructor(prisma: PrismaService, tenant: TenantContext) {
    super(prisma, tenant);
  }

  // ── Templates ─────────────────────────────────────────────────────────────

  async list() {
    return this.prisma.budgetTemplate.findMany({
      where: this.tenantFilter(),
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    const template = await this.prisma.budgetTemplate.findFirst({
      where: this.tenantFilter({ id }),
      include: {
        accounts: {
          orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
        },
      },
    });
    if (!template) throw new NotFoundException('Budget template not found');
    const usageCounts = await this.getTemplateAccountUsageCounts(
      template.accounts.map((account) => account.id),
    );
    const accounts = template.accounts.map((account) => ({
      ...account,
      usageCount: usageCounts.get(account.id) ?? 0,
      inUse: (usageCounts.get(account.id) ?? 0) > 0,
    }));
    return { ...template, accounts: this.buildAccountTree(accounts) };
  }

  async create(dto: CreateBudgetTemplateDto) {
    return this.prisma.budgetTemplate.create({
      data: this.tenantData({
        name: dto.name,
        description: dto.description ?? null,
        createdById: this.tenant.userId,
      }),
    });
  }

  async update(id: string, dto: UpdateBudgetTemplateDto) {
    await this.assertTemplateExists(id);
    return this.prisma.budgetTemplate.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.assertTemplateExists(id);
    await this.prisma.budgetTemplate.delete({ where: { id } });
  }

  // ── Template accounts ─────────────────────────────────────────────────────

  async addAccount(templateId: string, dto: CreateTemplateAccountDto) {
    await this.assertTemplateExists(templateId);

    // Validate unique code within this template
    const existing = await this.prisma.budgetTemplateAccount.findFirst({
      where: { templateId, code: dto.code },
    });
    if (existing) {
      throw new ConflictException(
        `Account code '${dto.code}' already exists in this template`,
      );
    }

    // Validate parentId belongs to the same template
    if (dto.parentId) {
      await this.assertTemplateAccountExists(templateId, dto.parentId);
    }

    return this.prisma.budgetTemplateAccount.create({
      data: {
        templateId,
        code: dto.code,
        name: dto.name,
        accountType: dto.accountType ?? null,
        cptcRole: dto.cptcRole ?? null,
        isHeader: dto.isHeader ?? false,
        sortOrder: dto.sortOrder ?? 0,
        parentId: dto.parentId ?? null,
      },
    });
  }

  async updateAccount(
    templateId: string,
    accountId: string,
    dto: UpdateTemplateAccountDto,
  ) {
    await this.assertTemplateExists(templateId);
    const existingAccount = await this.getTemplateAccount(templateId, accountId);
    const isInUse = await this.isTemplateAccountInUse(accountId);

    // If code is changing, verify the new code is not already taken
    if (dto.code && dto.code !== existingAccount.code) {
      if (isInUse) {
        throw new BadRequestException('Cannot change code because this GL is used in a project');
      }
      const conflict = await this.prisma.budgetTemplateAccount.findFirst({
        where: { templateId, code: dto.code, id: { not: accountId } },
      });
      if (conflict) {
        throw new ConflictException(
          `Account code '${dto.code}' already exists in this template`,
        );
      }
    }

    // If parentId is changing, validate the new parent
    if (dto.parentId !== undefined) {
      if (dto.parentId !== null) {
        await this.assertTemplateAccountExists(templateId, dto.parentId);
        // Prevent self-reference
        if (dto.parentId === accountId) {
          throw new BadRequestException('An account cannot be its own parent');
        }
      }
    }

    return this.prisma.budgetTemplateAccount.update({
      where: { id: accountId },
      data: dto,
    });
  }

  async removeAccount(templateId: string, accountId: string) {
    await this.assertTemplateExists(templateId);
    await this.assertTemplateAccountExists(templateId, accountId);

    if (await this.isTemplateAccountInUse(accountId)) {
      throw new BadRequestException('Cannot delete GL because it is used in a project');
    }

    // Check whether this account has children — reparent is the caller's job
    const childCount = await this.prisma.budgetTemplateAccount.count({
      where: { templateId, parentId: accountId },
    });
    if (childCount > 0) {
      throw new BadRequestException(
        'Cannot delete an account that has child accounts. Remove or reparent children first.',
      );
    }

    await this.prisma.budgetTemplateAccount.delete({ where: { id: accountId } });
  }

  /**
   * Clones all accounts from this template into BudgetAccount rows for the
   * given budgetId. Called by BudgetsService during budget creation.
   * Returns the cloned accounts in flat form (sorted by sortOrder, code).
   *
   * The clone preserves the parent-child structure by mapping template account
   * IDs to the newly created budget account IDs in a single pass.
   */
  async cloneAccountsToBudget(
    templateId: string,
    budgetId: string,
    organizationId: string,
  ): Promise<void> {
    await this.assertTemplateExists(templateId);

    const templateAccounts = await this.prisma.budgetTemplateAccount.findMany({
      where: { templateId },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      include: { roleMappings: true },
    });

    if (templateAccounts.length === 0) return;

    // Map from template account ID → new budget account ID
    const idMap = new Map<string, string>();

    // Two passes: first create all accounts without parentId, then link parents.
    // This avoids ordering issues for deep trees.

    // Pass 1: create all accounts with a generated id (no parentId yet)
    const creates = templateAccounts.map((ta) => ({
      budgetId,
      organizationId,
      code: ta.code,
      name: ta.name,
      accountType: ta.accountType,
      cptcRole: ta.cptcRole,
      defaultPhase: ta.defaultPhase,
      defaultLabourClassification: ta.defaultLabourClassification,
      isHeader: ta.isHeader,
      sortOrder: ta.sortOrder,
      sourceTemplateAccountId: ta.id,
      parentId: null as string | null,
    }));

    const created = await this.prisma.$transaction(
      creates.map((data) => this.prisma.budgetAccount.create({ data })),
    );

    // Build templateId → new budget account ID mapping
    created.forEach((ba, idx) => {
      const templateAccount = templateAccounts[idx];
      if (templateAccount) {
        idMap.set(templateAccount.id, ba.id);
      }
    });

    // Pass 2: set parentId on accounts that had a parent in the template
    const reparents = templateAccounts
      .filter((ta) => ta.parentId !== null)
      .map((ta) => {
        const newId = idMap.get(ta.id)!;
        const newParentId = idMap.get(ta.parentId!)!;
        return this.prisma.budgetAccount.update({
          where: { id: newId },
          data: { parentId: newParentId },
        });
      });

    if (reparents.length > 0) {
      await this.prisma.$transaction(reparents);
    }

    // Pass 3: clone role mappings from template accounts to budget accounts
    const roleMappingCreates = templateAccounts.flatMap((ta) => {
      const budgetAccountId = idMap.get(ta.id);
      if (!budgetAccountId || !ta.roleMappings?.length) return [];
      return ta.roleMappings.map((rm) => ({
        budgetAccountId,
        programCode: rm.programCode,
        roleCode: rm.roleCode,
        pointsOverride: rm.pointsOverride,
      }));
    });

    if (roleMappingCreates.length > 0) {
      await this.prisma.budgetAccountRoleMapping.createMany({
        data: roleMappingCreates,
      });
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async assertTemplateExists(id: string) {
    const template = await this.prisma.budgetTemplate.findFirst({
      where: this.tenantFilter({ id }),
      select: { id: true },
    });
    if (!template) throw new NotFoundException('Budget template not found');
  }

  private async assertTemplateAccountExists(templateId: string, accountId: string) {
    const account = await this.prisma.budgetTemplateAccount.findFirst({
      where: { id: accountId, templateId },
      select: { id: true },
    });
    if (!account) throw new NotFoundException('Template account not found');
  }

  private async getTemplateAccount(templateId: string, accountId: string) {
    const account = await this.prisma.budgetTemplateAccount.findFirst({
      where: { id: accountId, templateId },
    });
    if (!account) throw new NotFoundException('Template account not found');
    return account;
  }

  private async isTemplateAccountInUse(accountId: string) {
    const count = await this.prisma.budgetAccount.count({
      where: this.tenantFilter({
        sourceTemplateAccountId: accountId,
      }),
    });
    return count > 0;
  }

  private async getTemplateAccountUsageCounts(accountIds: string[]) {
    if (accountIds.length === 0) return new Map<string, number>();

    const grouped = await this.prisma.budgetAccount.groupBy({
      by: ['sourceTemplateAccountId'],
      where: this.tenantFilter({
        sourceTemplateAccountId: { in: accountIds },
      }),
      _count: { _all: true },
    });

    return new Map(
      grouped
        .filter((item) => item.sourceTemplateAccountId)
        .map((item) => [item.sourceTemplateAccountId!, item._count._all]),
    );
  }

  /**
   * Converts a flat account list (already sorted) into a nested tree.
   * Root accounts have parentId = null.
   */
  private buildAccountTree<T extends { id: string; parentId: string | null; children?: T[] }>(
    accounts: T[],
  ): T[] {
    const map = new Map<string, T & { children: T[] }>();
    const roots: (T & { children: T[] })[] = [];

    for (const account of accounts) {
      map.set(account.id, { ...account, children: [] });
    }

    for (const account of accounts) {
      const node = map.get(account.id)!;
      if (account.parentId && map.has(account.parentId)) {
        map.get(account.parentId)!.children.push(node as T);
      } else {
        roots.push(node);
      }
    }

    return roots as T[];
  }
}
