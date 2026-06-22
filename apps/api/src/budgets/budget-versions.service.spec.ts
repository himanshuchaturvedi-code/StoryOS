import { ExpenseType } from '@storyos/types';
import { BudgetVersionsService } from './budget-versions.service';
import { TenantContext } from '../tenant/tenant.context';

describe('BudgetVersionsService labour amount repair', () => {
  const organizationId = 'org-1';
  const budgetId = 'budget-1';
  const versionId = 'version-1';

  const tenant = {
    organizationId,
    userId: 'user-1',
  } as TenantContext;

  it('findById() repairs stale labourAmount rows before returning version', async () => {
    const staleLine = {
      id: 'line-stale',
      amount: 60000,
      labourAmount: 50000,
      expenseType: null,
      account: { accountType: 'ABOVE_THE_LINE' },
    };
    const syncedLine = {
      id: 'line-synced',
      amount: 100000,
      labourAmount: 100000,
      expenseType: ExpenseType.LABOUR,
      account: { accountType: 'ABOVE_THE_LINE' },
    };

    const update = jest.fn().mockResolvedValue({});
    const prisma = {
      budgetVersion: {
        findFirst: jest.fn().mockResolvedValue({
          id: versionId,
          lines: [staleLine, syncedLine],
          budget: { accounts: [] },
        }),
      },
      budgetLine: { update },
      $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
    };

    const budgetsService = { assertBudgetExists: jest.fn() };
    const budgetTemplatesService = { cloneAccountsToBudget: jest.fn() };
    const service = new BudgetVersionsService(
      prisma as any,
      tenant,
      budgetsService as any,
      budgetTemplatesService as any,
    );

    const version = await service.findById(budgetId, versionId);

    expect(update).toHaveBeenCalledWith({
      where: { id: 'line-stale' },
      data: { labourAmount: 60000 },
    });
    expect(staleLine.labourAmount).toBe(60000);
    expect(version.lines[0]?.labourAmount).toBe(60000);
  });
});
