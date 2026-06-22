import {
  AMPG_LABOUR_SUMMARY_DOCUMENT_CODE,
  AMPG_LABOUR_SUMMARY_PROGRAM_CODE,
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

jest.mock('./ampg-labour-summary.mapper', () => ({
  mapAmpgLabourSummary: jest.fn(() => ({
    documentType: 'AMPG_AB_LABOUR_SUMMARY',
    projectTitle: 'Alberta Pilot Production',
    budgetVersionId: 'version-1',
    budgetVersionName: 'Locked v1',
    rows: [],
    personIndex: [],
    summary: {
      totalLabour: 50000,
      albertaResidentLabour: 50000,
      nonAlbertaOrUnknownLabour: 0,
      distinctAlbertaResidentPersonCount: 1,
    },
    warnings: [],
    generatedAt: new Date('2026-06-22T00:00:00.000Z'),
  })),
}));

jest.mock('./ampg-labour-summary.renderer', () => ({
  renderAmpgLabourSummaryPdf: jest.fn(async () => Buffer.from('ampg-labour-pdf')),
}));

describe('DocumentGenerationService AMPG labour summary', () => {
  const organizationId = 'org-1';
  const projectId = 'project-1';
  const userId = 'user-1';

  let service: DocumentGenerationService;
  let prisma: { document: { create: jest.Mock } };
  let storage: { buildKey: jest.Mock; putObject: jest.Mock };
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
        residencies: new Map(),
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

  it('persists canonical storage key and AMPG labour summary program document tags', async () => {
    const result = await service.generateAmpgAbLabourSummary(projectId);

    expect(storage.buildKey).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        projectId,
        fileName: expect.stringMatching(/^AMPG_AB_LABOUR_/),
      }),
    );

    expect(prisma.document.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: 'AMPG Alberta Labour Summary — Alberta Pilot Production',
        category: 'OTHER',
        programCode: AMPG_LABOUR_SUMMARY_PROGRAM_CODE,
        programDocumentCode: AMPG_LABOUR_SUMMARY_DOCUMENT_CODE,
        storageKey: expect.stringMatching(
          /^documents\/org-1\/project-1\/[0-9a-f-]+\/AMPG_AB_LABOUR_/,
        ),
      }),
    });

    expect(result.pdfBuffer).toEqual(Buffer.from('ampg-labour-pdf'));
  });
});
