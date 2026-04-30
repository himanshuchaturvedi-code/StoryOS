import { Injectable, NotFoundException } from '@nestjs/common';
import type { CptcPartADocument, DocumentWarning } from '@storyos/types';
import { PrismaService } from '../prisma/prisma.service';
import { TenantAwareService } from '../tenant/tenant-aware.service';
import { TenantContext } from '../tenant/tenant.context';
import { CptcPartACollector } from './cptc-part-a.collector';
import { mapCptcPartA } from './cptc-part-a.mapper';
import { renderCptcPartAPdf } from './pdf.renderer';

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
  ) {
    super(prisma, tenant);
  }

  async generateCptcPartA(
    projectId: string,
    budgetVersionId?: string,
  ): Promise<GenerateDocumentResult> {
    const data = await this.collector.collect(projectId, budgetVersionId);

    const mapped = mapCptcPartA(data);

    const pdfBuffer = await renderCptcPartAPdf(mapped);

    const fileName = `CPTC_Part_A_BOC_${sanitize(data.project.title)}_${dateStamp()}.pdf`;

    const doc = await this.prisma.document.create({
      data: {
        organizationId: this.organizationId,
        projectId,
        uploadedById: this.tenant.userId!,
        title: `CPTC Part A — ${data.project.title}`,
        fileName,
        fileType: 'application/pdf',
        fileSize: pdfBuffer.length,
        storageKey: `generated/${this.organizationId}/${projectId}/${fileName}`,
        category: 'CAVCO_PART_A',
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

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}
