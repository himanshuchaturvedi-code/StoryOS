import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.context';
import { TenantAwareService } from '../tenant/tenant-aware.service';
import { StorageService } from './storage.service';
import { CreateDocumentDto } from './dto/create-document.dto';

@Injectable()
export class DocumentsService extends TenantAwareService {
  constructor(
    prisma: PrismaService,
    tenant: TenantContext,
    private readonly storage: StorageService,
  ) {
    super(prisma, tenant);
  }

  /**
   * Step 1 of a two-step upload:
   * Creates a Document record and returns a presigned upload URL.
   * The client PUTs the file directly to S3 at the returned URL.
   * Step 2 is implicit — the record is already created with the canonical key.
   */
  async initiateUpload(dto: CreateDocumentDto) {
    if (dto.projectId) {
      await this.assertProjectExists(dto.projectId);
    }

    const docId = crypto.randomUUID();
    const storageKey = this.storage.buildKey({
      organizationId: this.organizationId,
      projectId: dto.projectId ?? null,
      documentId: docId,
      fileName: dto.fileName,
    });

    const document = await this.prisma.document.create({
      data: {
        id: docId,
        organizationId: this.organizationId,
        projectId: dto.projectId ?? null,
        uploadedById: this.tenant.userId!,
        title: dto.title,
        fileName: dto.fileName,
        fileType: dto.fileType,
        fileSize: dto.fileSize,
        storageKey,
        category: dto.category ?? 'OTHER',
        notes: dto.notes ?? null,
      },
    });

    const uploadUrl = await this.storage.getUploadUrl(storageKey, dto.fileType);

    return { document, uploadUrl };
  }

  async list(projectId?: string) {
    const where = projectId
      ? this.tenantFilter({ projectId })
      : this.tenantFilter();

    return this.prisma.document.findMany({
      where,
      include: {
        uploadedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const document = await this.prisma.document.findFirst({
      where: this.tenantFilter({ id }),
      include: {
        uploadedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!document) throw new NotFoundException('Document not found');

    const downloadUrl = await this.storage.getDownloadUrl(document.storageKey);
    return { ...document, downloadUrl };
  }

  async remove(id: string) {
    await this.findById(id);
    await this.prisma.document.delete({ where: { id } });
  }

  private async assertProjectExists(projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: this.tenantFilter({ id: projectId }),
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');
  }
}
