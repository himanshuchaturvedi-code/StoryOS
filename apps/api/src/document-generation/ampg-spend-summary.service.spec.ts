import {
  AMPG_SPEND_SUMMARY_DOCUMENT_CODE,
  AMPG_SPEND_SUMMARY_PROGRAM_CODE,
  DocumentGenerationService,
} from './document-generation.service';
import { AmpgBudgetCollector } from './ampg-budget.collector';
import { CptcPartACollector } from './cptc-part-a.collector';
import { StorageService } from '../documents/storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.context';

jest.mock('../documents/program-document-tag.validation', () => ({
  assertValidProgramDocumentTag: jest.fn((programCode, programDocumentCode) => ({
    programCode,
    programDocumentCode,
  })),
}));

jest.mock('./ampg-spend-summary.mapper', () => ({
  mapAmpgSpendSummary: jest.fn(() => ({
    documentType: 'AMPG_AB_SPEND_SUMMARY',
    projectTitle: 'Alberta Pilot Production',
    budgetVersionId: 'version-1',
    budgetVersionName: 'Locked v1',
    rows: [],
    summary: {
      albertaLabourTotal: 50000,
      albertaNonLabourTotal: 15000,
      totalAlbertaEligibleSpend: 65000,
      totalProductionBudget: 80000,
      albertaSpendRatio: 0.8125,
      estimatedAmpgGrantBase: 65000,
      estimatedAmpgGrantAmount: 16250,
    },
    warnings: [],
    generatedAt: new Date('2026-06-21T00:00:00.000Z'),
  })),
}));

jest.mock('./ampg-spend-summary.renderer', () => ({
  renderAmpgSpendSummaryPdf: jest.fn(async () => Buffer.from('ampg-pdf-bytes')),
}));

describe('DocumentGenerationService AMPG spend summary', () => {
  const organizationId = 'org-1';
  const projectId = 'project-1';
  const userId = 'user-1';

  let service: DocumentGenerationService;
  let prisma: {
    document: { create: jest.Mock };
  };
  let storage: {
    buildKey: jest.Mock;
    putObject: jest.Mock;
  };
  let cptcCollector: { collect: jest.Mock };
  let ampgCollector: { collect: jest.Mock };

  beforeEach(() => {
    prisma = {
      document: {
        create: jest.fn(async ({ data }) => ({ id: data.id, ...data })),
      },
    };

    storage = {
      buildKey: jest.fn(
        ({ organizationId, projectId, documentId, fileName }) =>
          `documents/${organizationId}/${projectId}/${documentId}/${fileName}`,
      ),
      putObject: jest.fn(async () => undefined),
    };

    cptcCollector = { collect: jest.fn() };
    ampgCollector = {
      collect: jest.fn(async () => ({
        project: { id: projectId, title: 'Alberta Pilot Production' },
        budgetVersionId: 'version-1',
        budgetVersionName: 'Locked v1',
        lines: [],
      })),
    };

    const tenant = { organizationId, userId } as TenantContext;

    service = new DocumentGenerationService(
      prisma as unknown as PrismaService,
      tenant,
      cptcCollector as unknown as CptcPartACollector,
      ampgCollector as unknown as AmpgBudgetCollector,
      storage as unknown as StorageService,
    );
  });

  it('persists canonical storage key and AMPG program document tags', async () => {
    const result = await service.generateAmpgAbSpendSummary(projectId);

    expect(storage.buildKey).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        projectId,
        fileName: expect.stringMatching(/^AMPG_AB_SPEND_/),
      }),
    );

    expect(storage.putObject).toHaveBeenCalledWith(
      expect.stringMatching(
        /^documents\/org-1\/project-1\/[0-9a-f-]+\/AMPG_AB_SPEND_/,
      ),
      expect.any(Buffer),
      'application/pdf',
    );

    expect(prisma.document.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: expect.any(String),
        organizationId,
        projectId,
        uploadedById: userId,
        title: 'AMPG Alberta Spend Summary — Alberta Pilot Production',
        category: 'OTHER',
        programCode: AMPG_SPEND_SUMMARY_PROGRAM_CODE,
        programDocumentCode: AMPG_SPEND_SUMMARY_DOCUMENT_CODE,
        storageKey: expect.stringMatching(
          /^documents\/org-1\/project-1\/[0-9a-f-]+\/AMPG_AB_SPEND_/,
        ),
        fileType: 'application/pdf',
      }),
    });

    expect(result.documentId).toBe(
      prisma.document.create.mock.calls[0][0].data.id,
    );
    expect(result.pdfBuffer).toEqual(Buffer.from('ampg-pdf-bytes'));
  });
});
