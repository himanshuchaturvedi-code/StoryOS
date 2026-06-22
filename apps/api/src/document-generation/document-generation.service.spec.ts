import {
  CPTC_BOC_DOCUMENT_CODE,
  CPTC_BOC_PROGRAM_CODE,
  DocumentGenerationService,
} from './document-generation.service';
import { CptcPartACollector } from './cptc-part-a.collector';
import { StorageService } from '../documents/storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.context';

jest.mock('../documents/program-document-tag.validation', () => ({
  assertValidProgramDocumentTag: jest.fn(() => ({
    programCode: 'CPTC',
    programDocumentCode: 'CAVCO_PART_A',
  })),
}));

jest.mock('./cptc-part-a.mapper', () => ({
  mapCptcPartA: jest.fn(() => ({
    documentType: 'CPTC_PART_A',
    projectTitle: 'Test Production',
    budgetVersionId: 'version-1',
    budgetVersionName: 'Locked v1',
    rows: [],
    summary: {
      totalCostOfProduction: 0,
      totalServicesCanadian: 0,
      totalServicesNonCanadian: 0,
      totalServices: 0,
      servicesCanadianRatio: 0,
      totalPostLabCanadian: 0,
      totalPostLabNonCanadian: 0,
      totalPostLab: 0,
      postLabCanadianRatio: 0,
    },
    warnings: [],
    generatedAt: new Date('2026-06-21T00:00:00.000Z'),
  })),
}));

jest.mock('./pdf.renderer', () => ({
  renderCptcPartAPdf: jest.fn(async () => Buffer.from('pdf-bytes')),
}));

describe('DocumentGenerationService Slice 2', () => {
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
  let collector: { collect: jest.Mock };

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

    collector = {
      collect: jest.fn(async () => ({
        project: { id: projectId, title: 'Test Production' },
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
      collector as unknown as CptcPartACollector,
      storage as unknown as StorageService,
    );
  });

  it('persists canonical storage key and CPTC program document tags', async () => {
    const result = await service.generateCptcPartA(projectId);

    expect(storage.buildKey).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        projectId,
        fileName: expect.stringMatching(/^CPTC_Part_A_BOC_/),
      }),
    );

    expect(storage.putObject).toHaveBeenCalledWith(
      expect.stringMatching(
        /^documents\/org-1\/project-1\/[0-9a-f-]+\/CPTC_Part_A_BOC_/,
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
        category: 'CAVCO_PART_A',
        programCode: CPTC_BOC_PROGRAM_CODE,
        programDocumentCode: CPTC_BOC_DOCUMENT_CODE,
        storageKey: expect.stringMatching(
          /^documents\/org-1\/project-1\/[0-9a-f-]+\/CPTC_Part_A_BOC_/,
        ),
        fileType: 'application/pdf',
      }),
    });

    expect(result.documentId).toBe(
      prisma.document.create.mock.calls[0][0].data.id,
    );
    expect(result.pdfBuffer).toEqual(Buffer.from('pdf-bytes'));
  });
});
