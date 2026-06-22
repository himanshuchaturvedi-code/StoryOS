import { Injectable } from '@nestjs/common';
import type {
  AmpgLabourSummaryDocument,
  AmpgSpendSummaryDocument,
  CptcPartADocument,
  DocumentWarning,
} from '@storyos/types';
import { PrismaService } from '../prisma/prisma.service';
import { TenantAwareService } from '../tenant/tenant-aware.service';
import { TenantContext } from '../tenant/tenant.context';
import { StorageService } from '../documents/storage.service';
import { assertValidProgramDocumentTag } from '../documents/program-document-tag.validation';
import { loadCptcBocRegistryForForm } from '@storyos/program-registry';
import { AmpgBudgetCollector } from './ampg-budget.collector';
import { CptcPartACollector } from './cptc-part-a.collector';
import { resolveCptcBocFormSelection } from './cptc-boc-form-selection';
import {
  buildCptcBocDocumentTitle,
  buildCptcBocFileName,
} from './cptc-boc-document-metadata';
import {
  buildAmpgSpendSummaryDocumentTitle,
  buildAmpgSpendSummaryFileName,
} from './ampg-spend-summary-document-metadata';
import {
  buildAmpgLabourSummaryDocumentTitle,
  buildAmpgLabourSummaryFileName,
} from './ampg-labour-summary-document-metadata';
import { mapAmpgLabourSummary } from './ampg-labour-summary.mapper';
import { renderAmpgLabourSummaryPdf } from './ampg-labour-summary.renderer';
import { mapCptcPartAWithRegistry } from './cptc-part-a.mapper-v2';
import { mapAmpgSpendSummary } from './ampg-spend-summary.mapper';
import { renderAmpgSpendSummaryPdf } from './ampg-spend-summary.renderer';
import { renderCptcPartAPdf } from './pdf.renderer';

export const CPTC_BOC_PROGRAM_CODE = 'CPTC';
export const CPTC_BOC_DOCUMENT_CODE = 'CAVCO_PART_A';
export const AMPG_SPEND_SUMMARY_PROGRAM_CODE = 'AMPG';
export const AMPG_SPEND_SUMMARY_DOCUMENT_CODE = 'AB_SPEND_SUMMARY';
export const AMPG_LABOUR_SUMMARY_PROGRAM_CODE = 'AMPG';
export const AMPG_LABOUR_SUMMARY_DOCUMENT_CODE = 'AB_LABOUR_SUMMARY';

export interface GenerateDocumentResult {
  documentId: string;
  fileName: string;
  pdfBuffer: Buffer;
  warnings: DocumentWarning[];
  document: CptcPartADocument | AmpgSpendSummaryDocument | AmpgLabourSummaryDocument;
}

@Injectable()
export class DocumentGenerationService extends TenantAwareService {
  constructor(
    prisma: PrismaService,
    tenant: TenantContext,
    private readonly cptcCollector: CptcPartACollector,
    private readonly ampgCollector: AmpgBudgetCollector,
    private readonly storage: StorageService,
  ) {
    super(prisma, tenant);
  }

  async generateCptcPartA(
    projectId: string,
    budgetVersionId?: string,
  ): Promise<GenerateDocumentResult> {
    const data = await this.cptcCollector.collect(projectId, budgetVersionId);

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

  async generateAmpgAbSpendSummary(
    projectId: string,
    budgetVersionId?: string,
  ): Promise<GenerateDocumentResult> {
    const data = await this.ampgCollector.collect(projectId, budgetVersionId);
    const mapped = mapAmpgSpendSummary(data);
    const pdfBuffer = await renderAmpgSpendSummaryPdf(mapped);

    const fileName = buildAmpgSpendSummaryFileName({
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
      AMPG_SPEND_SUMMARY_PROGRAM_CODE,
      AMPG_SPEND_SUMMARY_DOCUMENT_CODE,
    );

    await this.storage.putObject(storageKey, pdfBuffer, 'application/pdf');

    const doc = await this.prisma.document.create({
      data: {
        id: documentId,
        organizationId: this.organizationId,
        projectId,
        uploadedById: this.tenant.userId!,
        title: buildAmpgSpendSummaryDocumentTitle({
          projectTitle: data.project.title,
        }),
        fileName,
        fileType: 'application/pdf',
        fileSize: pdfBuffer.length,
        storageKey,
        category: 'OTHER',
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

  async generateAmpgAbLabourSummary(
    projectId: string,
    budgetVersionId?: string,
  ): Promise<GenerateDocumentResult> {
    const data = await this.ampgCollector.collect(projectId, budgetVersionId);
    const mapped = mapAmpgLabourSummary(data);
    const pdfBuffer = await renderAmpgLabourSummaryPdf(mapped);

    const fileName = buildAmpgLabourSummaryFileName({
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
      AMPG_LABOUR_SUMMARY_PROGRAM_CODE,
      AMPG_LABOUR_SUMMARY_DOCUMENT_CODE,
    );

    await this.storage.putObject(storageKey, pdfBuffer, 'application/pdf');

    const doc = await this.prisma.document.create({
      data: {
        id: documentId,
        organizationId: this.organizationId,
        projectId,
        uploadedById: this.tenant.userId!,
        title: buildAmpgLabourSummaryDocumentTitle({
          projectTitle: data.project.title,
        }),
        fileName,
        fileType: 'application/pdf',
        fileSize: pdfBuffer.length,
        storageKey,
        category: 'OTHER',
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
export {
  buildAmpgSpendSummaryDocumentTitle,
  buildAmpgSpendSummaryFileName,
} from './ampg-spend-summary-document-metadata';
export {
  buildAmpgLabourSummaryDocumentTitle,
  buildAmpgLabourSummaryFileName,
} from './ampg-labour-summary-document-metadata';
