import { BadRequestException } from '@nestjs/common';
import { ExpenseType } from '@storyos/types';
import { BudgetLinesService } from './budget-lines.service';
import { BudgetVersionsService } from './budget-versions.service';
import { BudgetAccountsService } from './budget-accounts.service';
import { TenantContext } from '../tenant/tenant.context';

describe('BudgetLinesService labour amount sync', () => {
  const organizationId = 'org-1';
  const budgetId = 'budget-1';
  const versionId = 'version-1';
  const lineId = 'line-1';
  const accountId = 'account-1';

  const tenant = {
    organizationId,
    userId: 'user-1',
  } as TenantContext;

  function createService(prisma: Record<string, unknown>) {
    const versionsService = {
      assertVersionDraft: jest.fn().mockResolvedValue(undefined),
    } as unknown as BudgetVersionsService;
    const accountsService = {
      assertAccountExists: jest.fn().mockResolvedValue(undefined),
    } as unknown as BudgetAccountsService;

    return new BudgetLinesService(
      prisma as any,
      tenant,
      versionsService,
      accountsService,
    );
  }

  it('create() syncs labourAmount to amount for implicit LABOUR accounts', async () => {
    const create = jest.fn().mockResolvedValue({ id: lineId, labourAmount: 5000 });
    const prisma = {
      budgetAccount: {
        findFirst: jest.fn().mockResolvedValue({ accountType: 'ABOVE_THE_LINE' }),
      },
      budgetLine: { create },
    };

    const service = createService(prisma);
    await service.create(budgetId, versionId, {
      budgetAccountId: accountId,
      amount: 5000,
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          labourAmount: 5000,
          amount: 5000,
        }),
      }),
    );
  });

  it('update() syncs labourAmount when amount changes on LABOUR lines', async () => {
    const update = jest.fn().mockResolvedValue({ id: lineId, labourAmount: 2200, amount: 2200 });
    const prisma = {
      budgetLine: {
        findFirst: jest.fn().mockResolvedValue({
          id: lineId,
          expenseType: ExpenseType.LABOUR,
          amount: 1000,
          labourAmount: 1000,
          account: { accountType: 'ABOVE_THE_LINE' },
        }),
        update,
      },
    };

    const service = createService(prisma);
    const updated = await service.update(budgetId, versionId, lineId, { amount: 2200 });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 2200,
          labourAmount: 2200,
        }),
      }),
    );
    expect(updated.labourAmount).toBe(2200);
  });

  it('update() syncs implicit LABOUR lines when amount changes (null expenseType)', async () => {
    const update = jest.fn().mockResolvedValue({ id: lineId, labourAmount: 60000, amount: 60000 });
    const prisma = {
      budgetLine: {
        findFirst: jest.fn().mockResolvedValue({
          id: lineId,
          expenseType: null,
          amount: 50000,
          labourAmount: 50000,
          account: { accountType: 'ABOVE_THE_LINE' },
        }),
        update,
      },
    };

    const service = createService(prisma);
    await service.update(budgetId, versionId, lineId, { amount: 60000 });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 60000,
          labourAmount: 60000,
        }),
      }),
    );
  });

  it('update() self-heals stale labourAmount on implicit LABOUR lines without amount change', async () => {
    const update = jest.fn().mockResolvedValue({ id: lineId, labourAmount: 60000, amount: 60000 });
    const prisma = {
      budgetLine: {
        findFirst: jest.fn().mockResolvedValue({
          id: lineId,
          expenseType: null,
          amount: 60000,
          labourAmount: 50000,
          account: { accountType: 'ABOVE_THE_LINE' },
        }),
        update,
      },
    };

    const service = createService(prisma);
    await service.update(budgetId, versionId, lineId, { description: 'Updated role' });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          description: 'Updated role',
          labourAmount: 60000,
        }),
      }),
    );
  });

  it('update() preserves MIXED labourAmount when amount changes', async () => {
    const update = jest.fn().mockResolvedValue({ id: lineId, labourAmount: 600 });
    const prisma = {
      budgetLine: {
        findFirst: jest.fn().mockResolvedValue({
          id: lineId,
          expenseType: ExpenseType.MIXED,
          amount: 1000,
          labourAmount: 600,
          account: { accountType: 'ABOVE_THE_LINE' },
        }),
        update,
      },
    };

    const service = createService(prisma);
    await service.update(budgetId, versionId, lineId, { amount: 1200 });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 1200,
          labourAmount: 600,
        }),
      }),
    );
  });

  it('annotate() clears labourAmount when classification changes to MIXED', async () => {
    const update = jest.fn().mockResolvedValue({ id: lineId, labourAmount: null });
    const prisma = {
      budgetVersion: {
        findFirst: jest.fn().mockResolvedValue({ id: versionId }),
      },
      budgetLine: {
        findFirst: jest.fn().mockResolvedValue({
          id: lineId,
          expenseType: ExpenseType.LABOUR,
          amount: 1000,
          labourAmount: 1000,
          personId: null,
          vendorId: null,
          account: { accountType: 'ABOVE_THE_LINE' },
        }),
        update,
      },
      budgetLineAnnotationLog: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
    };

    const service = createService(prisma);
    await service.annotate(budgetId, versionId, lineId, {
      expenseType: ExpenseType.MIXED,
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          expenseType: ExpenseType.MIXED,
          labourAmount: null,
        }),
      }),
    );
  });

  it('annotate() normalizes labourAmount to amount for LABOUR lines', async () => {
    const update = jest.fn().mockResolvedValue({ id: lineId, labourAmount: 1000 });
    const prisma = {
      budgetVersion: {
        findFirst: jest.fn().mockResolvedValue({ id: versionId }),
      },
      budgetLine: {
        findFirst: jest.fn().mockResolvedValue({
          id: lineId,
          expenseType: ExpenseType.LABOUR,
          amount: 1000,
          labourAmount: null,
          personId: null,
          vendorId: null,
          account: { accountType: 'ABOVE_THE_LINE' },
        }),
        update,
      },
      budgetLineAnnotationLog: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
    };

    const service = createService(prisma);
    await service.annotate(budgetId, versionId, lineId, { labourAmount: 750 });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          labourAmount: 1000,
        }),
      }),
    );
  });

  it('annotate() rejects labourAmount above line amount after sync', async () => {
    const prisma = {
      budgetVersion: {
        findFirst: jest.fn().mockResolvedValue({ id: versionId }),
      },
      budgetLine: {
        findFirst: jest.fn().mockResolvedValue({
          id: lineId,
          expenseType: ExpenseType.MIXED,
          amount: 1000,
          labourAmount: null,
          personId: null,
          vendorId: null,
          account: { accountType: 'ABOVE_THE_LINE' },
        }),
      },
    };

    const service = createService(prisma);
    await expect(
      service.annotate(budgetId, versionId, lineId, { labourAmount: 1500 }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('BudgetVersionsService clone labour amount sync', () => {
  const organizationId = 'org-1';
  const budgetId = 'budget-1';

  const tenant = {
    organizationId,
    userId: 'user-1',
  } as TenantContext;

  it('repairs stale labourAmount when cloning LABOUR lines', async () => {
    const lineCreate = jest.fn().mockResolvedValue({ id: 'cloned-line' });
    const prisma = {
      budgetVersion: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({ versionNumber: 1 })
          .mockResolvedValueOnce({ id: 'source-version' }),
        create: jest.fn().mockResolvedValue({ id: 'new-version' }),
      },
      budgetAccount: { count: jest.fn().mockResolvedValue(1) },
      budgetLine: {
        findMany: jest.fn().mockResolvedValue([
          {
            budgetAccountId: 'account-1',
            amount: 3000,
            labourAmount: null,
            expenseType: ExpenseType.LABOUR,
            account: { accountType: 'ABOVE_THE_LINE' },
            description: null,
            quantity: null,
            unitCost: null,
            currency: 'CAD',
            fringeRate: null,
            notes: null,
            personId: null,
            vendorId: null,
            locationId: null,
            productionPhaseId: null,
            activityType: null,
            isServiceContract: null,
            sortOrder: 0,
          },
        ]),
        create: lineCreate,
      },
      $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
    };

    const budgetsService = { assertBudgetExists: jest.fn().mockResolvedValue(undefined) };
    const budgetTemplatesService = { cloneAccountsToBudget: jest.fn() };
    const service = new BudgetVersionsService(
      prisma as any,
      tenant,
      budgetsService as any,
      budgetTemplatesService as any,
    );

    jest.spyOn(service, 'findById').mockResolvedValue({ id: 'new-version' } as any);

    await service.create(budgetId, {
      name: 'Clone v2',
      cloneFromVersionId: 'source-version',
    });

    expect(lineCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          labourAmount: 3000,
          amount: 3000,
        }),
      }),
    );
  });
});
