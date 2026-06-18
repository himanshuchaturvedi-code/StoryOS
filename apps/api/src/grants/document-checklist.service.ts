import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.context';
import { TenantAwareService } from '../tenant/tenant-aware.service';

import type { DocumentChecklistResponse } from './document-checklist.types';
import {
  collectChecklistWarnings,
  matchDocumentRequirements,
  summarizeRequiredDocuments,
  type RequirementApplicabilityContext,
} from './document-checklist-matching';
import { PROGRAM_DOCUMENT_SPECS } from './program-document-specs';

@Injectable()
export class DocumentChecklistService extends TenantAwareService {
  constructor(prisma: PrismaService, tenant: TenantContext) {
    super(prisma, tenant);
  }

  async getChecklist(
    projectId: string,
    programCode: string,
  ): Promise<DocumentChecklistResponse> {
    const spec = PROGRAM_DOCUMENT_SPECS.get(programCode);
    if (!spec) {
      throw new NotFoundException(
        `No document specification registered for program ${programCode}`,
      );
    }

    await this.assertProjectExists(projectId);

    const projectDocuments = await this.loadProjectDocuments(projectId);
    const context = await this.buildApplicabilityContext(projectId, projectDocuments);

    const items = matchDocumentRequirements({
      requirements: spec.documents,
      projectDocuments,
      context,
    });

    const { requiredCount, fulfilledRequiredCount, missingRequiredCount } =
      summarizeRequiredDocuments(items);

    const warnings = collectChecklistWarnings(items);
    if (
      items.some(
        (item) =>
          item.fulfillmentSource === 'CATEGORY' &&
          (item.status === 'AMBIGUOUS' || item.status === 'FULFILLED'),
      )
    ) {
      warnings.push(
        'Category-only matching is in use. Add documentCode=<CODE> to Document.notes for precise fulfillment once uploads are tagged.',
      );
    }

    const sortedStages = [...spec.filingStages].sort((a, b) => a.order - b.order);

    return {
      programCode: spec.programCode,
      agencyName: spec.agencyName,
      filingStages: sortedStages,
      stages: sortedStages.map((stage) => ({
        stageCode: stage.stageCode,
        label: stage.label,
        order: stage.order,
        documents: items.filter((item) => item.stageCode === stage.stageCode),
      })),
      requiredCount,
      fulfilledRequiredCount,
      missingRequiredCount,
      warnings: [...new Set(warnings)],
    };
  }

  private async loadProjectDocuments(projectId: string) {
    return this.prisma.document.findMany({
      where: this.tenantFilter({ projectId }),
      select: {
        id: true,
        category: true,
        notes: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async buildApplicabilityContext(
    projectId: string,
    projectDocuments: Array<{ category: string }>,
  ): Promise<RequirementApplicabilityContext> {
    const format = await this.prisma.projectFormat.findFirst({
      where: this.tenantFilter({ projectId }),
      select: { formatType: true },
    });

    return {
      hasBroadcasterCommitment: projectDocuments.some(
        (doc) => doc.category === 'BROADCASTER_COMMITMENT',
      ),
      formatType: format?.formatType,
    };
  }

  private async assertProjectExists(projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: this.tenantFilter({ id: projectId }),
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
  }
}
