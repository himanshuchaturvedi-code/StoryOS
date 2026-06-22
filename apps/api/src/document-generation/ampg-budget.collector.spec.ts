import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BudgetVersionStatus } from '@storyos/types';
import { AmpgBudgetCollector } from './ampg-budget.collector';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.context';

describe('AmpgBudgetCollector locked budget enforcement', () => {
  const organizationId = 'org-1';
  const projectId = 'project-1';

  function createCollector(prisma: Record<string, unknown>) {
    const tenant = {
      organizationId,
      userId: 'user-1',
    } as TenantContext;

    return new AmpgBudgetCollector(prisma as unknown as PrismaService, tenant);
  }

  it('throws BadRequestException when no LOCKED budget version exists', async () => {
    const prisma = {
      project: {
        findFirst: jest.fn().mockResolvedValue({ id: projectId, title: 'AMPG Pilot' }),
      },
      budget: {
        findFirst: jest.fn().mockResolvedValue({ id: 'budget-1' }),
      },
      budgetVersion: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    const collector = createCollector(prisma);

    await expect(collector.collect(projectId)).rejects.toThrow(BadRequestException);
    await expect(collector.collect(projectId)).rejects.toThrow(/LOCKED budget version/);
  });

  it('throws BadRequestException when an explicit budgetVersionId is not LOCKED', async () => {
    const prisma = {
      project: {
        findFirst: jest.fn().mockResolvedValue({ id: projectId, title: 'AMPG Pilot' }),
      },
      budgetVersion: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'draft-version',
          name: 'Draft',
          status: BudgetVersionStatus.DRAFT,
        }),
      },
    };

    const collector = createCollector(prisma);

    await expect(collector.collect(projectId, 'draft-version')).rejects.toThrow(
      BadRequestException,
    );
    await expect(collector.collect(projectId, 'draft-version')).rejects.toThrow(
      /not locked/i,
    );
  });

  it('collects when a LOCKED budget version is available', async () => {
    const prisma = {
      project: {
        findFirst: jest.fn().mockResolvedValue({ id: projectId, title: 'AMPG Pilot' }),
      },
      budget: {
        findFirst: jest.fn().mockResolvedValue({ id: 'budget-1' }),
      },
      budgetVersion: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({ id: 'locked-version' })
          .mockResolvedValueOnce({
            id: 'locked-version',
            name: 'Locked v3',
            status: BudgetVersionStatus.LOCKED,
          }),
      },
      budgetLine: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      participantResidencyStatus: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const collector = createCollector(prisma);
    const data = await collector.collect(projectId);

    expect(data.budgetVersionId).toBe('locked-version');
    expect(data.budgetVersionName).toBe('Locked v3');
    expect(data.residencies).toEqual(new Map());
  });

  it('throws NotFoundException when project does not exist', async () => {
    const prisma = {
      project: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    const collector = createCollector(prisma);

    await expect(collector.collect(projectId)).rejects.toThrow(NotFoundException);
  });
});
