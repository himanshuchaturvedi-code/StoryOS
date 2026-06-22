import { Injectable } from '@nestjs/common';
import type { CptcPartADocument, DocumentWarning } from '@storyos/types';
import { PrismaService } from '../prisma/prisma.service';
import { TenantAwareService } from '../tenant/tenant-aware.service';
import { TenantContext } from '../tenant/tenant.context';
import { StorageService } from '../documents/storage.service';
import { assertValidProgramDocumentTag } from '../documents/program-document-tag.validation';
import { loadCptcBocRegistryForForm } from '@storyos/program-registry';
import { CptcPartACollector } from './cptc-part-a.collector';
import { resolveCptcBocFormSelection } from './cptc-boc-form-selection';
import {
  buildCptcBocDocumentTitle,
  buildCptcBocFileName,
} from './cptc-boc-document-metadata';
import { mapCptcPartAWithRegistry } from './cptc-part-a.mapper-v2';
import { renderCptcPartAPdf } from './pdf.renderer';

export const CPTC_BOC_PROGRAM_CODE = 'CPTC';
export const CPTC_BOC_DOCUMENT_CODE = 'CAVCO_PART_A';

export interface GenerateDocumentResult {
  documentId: string;
  fileName: string;
  pdfBuffer: Buffer;
  warnings: DocumentWarning[];
  document: CptcPartADocument;
}

@Injectable()
export class DocumentGenerationService extends TenantAwareService {
  constructor(
    prisma: PrismaService,
    tenant: TenantContext,
    private readonly collector: CptcPartACollector,
    private readonly storage: StorageService,
  ) {
    super(prisma, tenant);
  }

  async generateCptcPartA(
    projectId: string,
    budgetVersionId?: string,
  ): Promise<GenerateDocumentResult> {
    const data = await this.collector.collect(projectId, budgetVersionId);

    const formSelection = resolveCptcBocFormSelection(data.projectFormat, data.lines);
    const registry = loadCptcBocRegistryForForm(formSelection.formCode);
    const mapped = mapCptcPartAWithRegistry(data, registry);
    mapped.warnings.unshift(...formSelection.warnings);

    const pdfBuffer = await renderCptcPartAPdf(mapped);

    const fileName = buildCptcBocFileName({
      formCode: mapped.formCode,
      projectTitle: data.project.title,
      generatedAt: mapped.generatedAt,
    });
    const documentId = crypto.randomUUID();
    const storageKey = this.storage.buildKey({
      organizationId: this.organizationId,
      projectId,
      documentId,
      fileName,
    });

    const tags = assertValidProgramDocumentTag(
      CPTC_BOC_PROGRAM_CODE,
      CPTC_BOC_DOCUMENT_CODE,
    );

    await this.storage.putObject(storageKey, pdfBuffer, 'application/pdf');

    const doc = await this.prisma.document.create({
      data: {
        id: documentId,
        organizationId: this.organizationId,
        projectId,
        uploadedById: this.tenant.userId!,
        title: buildCptcBocDocumentTitle({
          formCode: mapped.formCode,
          formLabel: mapped.formLabel,
          projectTitle: data.project.title,
        }),
        fileName,
        fileType: 'application/pdf',
        fileSize: pdfBuffer.length,
        storageKey,
        category: 'CAVCO_PART_A',
        programCode: tags.programCode,
        programDocumentCode: tags.programDocumentCode,
      },
    });

    return {
      documentId: doc.id,
      fileName,
      pdfBuffer,
      warnings: mapped.warnings,
      document: mapped,
    };
  }
}

export { buildCptcBocDocumentTitle, buildCptcBocFileName } from './cptc-boc-document-metadata';
