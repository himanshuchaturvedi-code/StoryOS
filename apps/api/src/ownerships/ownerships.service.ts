import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@storyos/database';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.context';
import { TenantAwareService } from '../tenant/tenant-aware.service';
import { currentlyEffective } from '@storyos/database';
import { CreateCorporateOwnershipDto } from './dto/create-corporate-ownership.dto';
import { UpdateCorporateOwnershipDto } from './dto/update-corporate-ownership.dto';
import { CreateProjectOwnershipDto } from './dto/create-project-ownership.dto';
import { UpdateProjectOwnershipDto } from './dto/update-project-ownership.dto';
import { CreateRightsControlFactDto } from './dto/create-rights-control-fact.dto';
import { UpdateRightsControlFactDto } from './dto/update-rights-control-fact.dto';

// ── Corporate Ownership ────────────────────────────────────────────────────────

@Injectable()
export class CorporateOwnershipsService extends TenantAwareService {
  constructor(prisma: PrismaService, tenant: TenantContext) {
    super(prisma, tenant);
  }

  async list(filters?: { childEntityName?: string; parentEntityName?: string }) {
    return this.prisma.corporateOwnership.findMany({
      where: this.tenantFilter({
        ...(filters?.childEntityName ? { childEntityName: { contains: filters.childEntityName, mode: Prisma.QueryMode.insensitive } } : {}),
        ...(filters?.parentEntityName ? { parentEntityName: { contains: filters.parentEntityName, mode: Prisma.QueryMode.insensitive } } : {}),
      }),
      orderBy: [{ parentEntityName: 'asc' }, { effectiveFrom: 'desc' }],
    });
  }

  async currentOwnersOf(childEntityName: string) {
    return this.prisma.corporateOwnership.findMany({
      where: {
        ...this.tenantFilter({ childEntityName }),
        ...currentlyEffective(),
      },
    });
  }

  async create(dto: CreateCorporateOwnershipDto) {
    const from = new Date(dto.effectiveFrom);
    const to = dto.effectiveTo ? new Date(dto.effectiveTo) : null;

    await this.assertNoOverlap(dto.parentEntityName, dto.childEntityName, from, to, undefined);

    return this.prisma.corporateOwnership.create({
      data: this.tenantData({
        parentEntityName: dto.parentEntityName,
        parentEntityCountry: dto.parentEntityCountry,
        childEntityName: dto.childEntityName,
        childEntityCountry: dto.childEntityCountry,
        ownershipPercentage: dto.ownershipPercentage,
        effectiveFrom: from,
        effectiveTo: to,
        notes: dto.notes ?? null,
        createdById: this.tenant.userId,
      }),
    });
  }

  async update(id: string, dto: UpdateCorporateOwnershipDto) {
    const existing = await this.assertExists(id);

    const from = dto.effectiveFrom ? new Date(dto.effectiveFrom) : existing.effectiveFrom;
    const to = dto.effectiveTo !== undefined
      ? (dto.effectiveTo ? new Date(dto.effectiveTo) : null)
      : existing.effectiveTo;

    if (dto.effectiveFrom || dto.effectiveTo !== undefined) {
      const parent = dto.parentEntityName ?? existing.parentEntityName;
      const child = dto.childEntityName ?? existing.childEntityName;
      await this.assertNoOverlap(parent, child, from, to, id);
    }

    const { effectiveFrom, effectiveTo, ...rest } = dto;
    return this.prisma.corporateOwnership.update({
      where: { id },
      data: {
        ...rest,
        ...(effectiveFrom !== undefined && { effectiveFrom: from }),
        ...(effectiveTo !== undefined && { effectiveTo: to }),
      },
    });
  }

  async remove(id: string) {
    await this.assertExists(id);
    await this.prisma.corporateOwnership.delete({ where: { id } });
  }

  private async assertNoOverlap(
    parentEntityName: string,
    childEntityName: string,
    from: Date,
    to: Date | null,
    excludeId: string | undefined,
  ) {
    const overlaps = await this.prisma.corporateOwnership.findMany({
      where: {
        ...this.tenantFilter({ parentEntityName, childEntityName }),
        ...(excludeId ? { id: { not: excludeId } } : {}),
        AND: [
          to ? { effectiveFrom: { lt: to } } : {},
          { OR: [{ effectiveTo: null }, { effectiveTo: { gt: from } }] },
        ],
      },
      select: { id: true },
    });
    if (overlaps.length > 0) {
      throw new ConflictException(
        `An ownership record for '${parentEntityName}' → '${childEntityName}' already exists in this date range. ` +
          'Close the existing record first by setting its effectiveTo.',
      );
    }
  }

  private async assertExists(id: string) {
    const record = await this.prisma.corporateOwnership.findFirst({
      where: this.tenantFilter({ id }),
    });
    if (!record) throw new NotFoundException('Corporate ownership record not found');
    return record;
  }
}

// ── Project Ownership ──────────────────────────────────────────────────────────

@Injectable()
export class ProjectOwnershipsService extends TenantAwareService {
  constructor(prisma: PrismaService, tenant: TenantContext) {
    super(prisma, tenant);
  }

  async list(projectId: string) {
    await this.assertProjectExists(projectId);
    return this.prisma.projectOwnership.findMany({
      where: this.tenantFilter({ projectId }),
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  async currentOwners(projectId: string) {
    await this.assertProjectExists(projectId);
    return this.prisma.projectOwnership.findMany({
      where: {
        ...this.tenantFilter({ projectId }),
        ...currentlyEffective(),
      },
    });
  }

  async create(projectId: string, dto: CreateProjectOwnershipDto) {
    await this.assertProjectExists(projectId);
    const from = new Date(dto.effectiveFrom);
    const to = dto.effectiveTo ? new Date(dto.effectiveTo) : null;

    await this.assertNoOverlap(projectId, dto.entityName, from, to, undefined);

    return this.prisma.projectOwnership.create({
      data: this.tenantData({
        projectId,
        entityName: dto.entityName,
        entityCountry: dto.entityCountry,
        entityProvinceState: dto.entityProvinceState ?? null,
        ownershipPercentage: dto.ownershipPercentage,
        isProducer: dto.isProducer ?? false,
        effectiveFrom: from,
        effectiveTo: to,
        notes: dto.notes ?? null,
        createdById: this.tenant.userId,
      }),
    });
  }

  async update(projectId: string, id: string, dto: UpdateProjectOwnershipDto) {
    await this.assertProjectExists(projectId);
    const existing = await this.assertOwnershipExists(projectId, id);

    const effectiveIsProducer = dto.isProducer ?? existing.isProducer;
    const effectiveProvince = dto.entityProvinceState !== undefined
      ? dto.entityProvinceState
      : existing.entityProvinceState;
    if (effectiveIsProducer && !effectiveProvince) {
      throw new BadRequestException(
        'entityProvinceState is required when isProducer is true',
      );
    }

    const from = dto.effectiveFrom ? new Date(dto.effectiveFrom) : existing.effectiveFrom;
    const to = dto.effectiveTo !== undefined
      ? (dto.effectiveTo ? new Date(dto.effectiveTo) : null)
      : existing.effectiveTo;

    if (dto.effectiveFrom || dto.effectiveTo !== undefined) {
      const entityName = dto.entityName ?? existing.entityName;
      await this.assertNoOverlap(projectId, entityName, from, to, id);
    }

    const { effectiveFrom, effectiveTo, ...rest } = dto;
    return this.prisma.projectOwnership.update({
      where: { id },
      data: {
        ...rest,
        ...(effectiveFrom !== undefined && { effectiveFrom: from }),
        ...(effectiveTo !== undefined && { effectiveTo: to }),
      },
    });
  }

  async remove(projectId: string, id: string) {
    await this.assertOwnershipExists(projectId, id);
    await this.prisma.projectOwnership.delete({ where: { id } });
  }

  private async assertNoOverlap(
    projectId: string,
    entityName: string,
    from: Date,
    to: Date | null,
    excludeId: string | undefined,
  ) {
    const overlaps = await this.prisma.projectOwnership.findMany({
      where: {
        ...this.tenantFilter({ projectId, entityName }),
        ...(excludeId ? { id: { not: excludeId } } : {}),
        AND: [
          to ? { effectiveFrom: { lt: to } } : {},
          { OR: [{ effectiveTo: null }, { effectiveTo: { gt: from } }] },
        ],
      },
      select: { id: true },
    });
    if (overlaps.length > 0) {
      throw new ConflictException(
        `An ownership record for '${entityName}' on this project already exists in this date range. ` +
          'Close the existing record first by setting its effectiveTo.',
      );
    }
  }

  private async assertProjectExists(projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: this.tenantFilter({ id: projectId }),
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');
  }

  private async assertOwnershipExists(projectId: string, id: string) {
    const record = await this.prisma.projectOwnership.findFirst({
      where: this.tenantFilter({ id, projectId }),
    });
    if (!record) throw new NotFoundException('Project ownership record not found');
    return record;
  }
}

// ── Rights Control Facts ───────────────────────────────────────────────────────

@Injectable()
export class RightsControlFactsService extends TenantAwareService {
  constructor(prisma: PrismaService, tenant: TenantContext) {
    super(prisma, tenant);
  }

  async list(projectId: string, controlType?: string) {
    await this.assertProjectExists(projectId);
    return this.prisma.rightsControlFact.findMany({
      where: this.tenantFilter({
        projectId,
        ...(controlType ? { controlType: controlType as never } : {}),
      }),
      include: {
        document: { select: { id: true, title: true, storageKey: true } },
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  async create(projectId: string, dto: CreateRightsControlFactDto) {
    await this.assertProjectExists(projectId);
    const from = new Date(dto.effectiveFrom);
    const to = dto.effectiveTo ? new Date(dto.effectiveTo) : null;

    await this.assertNoOverlap(projectId, dto.controlType as never, from, to, undefined);

    if (dto.documentId) await this.assertDocumentBelongsToOrg(dto.documentId);

    return this.prisma.rightsControlFact.create({
      data: this.tenantData({
        projectId,
        controlType: dto.controlType,
        holderName: dto.holderName,
        holderCountry: dto.holderCountry,
        holderProvinceState: dto.holderProvinceState ?? null,
        retentionYears: dto.retentionYears ?? null,
        assertion: dto.assertion,
        evidenceNotes: dto.evidenceNotes ?? null,
        documentId: dto.documentId ?? null,
        effectiveFrom: from,
        effectiveTo: to,
        createdById: this.tenant.userId,
      }),
      include: {
        document: { select: { id: true, title: true, storageKey: true } },
      },
    });
  }

  async update(projectId: string, id: string, dto: UpdateRightsControlFactDto) {
    await this.assertProjectExists(projectId);
    const existing = await this.assertFactExists(projectId, id);

    const effectiveControlType = dto.controlType ?? existing.controlType;
    if (String(effectiveControlType) === 'COPYRIGHT_OWNERSHIP') {
      const effectiveProvince = dto.holderProvinceState !== undefined
        ? dto.holderProvinceState
        : existing.holderProvinceState;
      const effectiveRetention = dto.retentionYears !== undefined
        ? dto.retentionYears
        : existing.retentionYears;
      if (!effectiveProvince) {
        throw new BadRequestException(
          'holderProvinceState is required for COPYRIGHT_OWNERSHIP assertions',
        );
      }
      if (effectiveRetention == null || effectiveRetention < 10) {
        throw new BadRequestException(
          'retentionYears must be at least 10 for COPYRIGHT_OWNERSHIP (FTTC elevated tier)',
        );
      }
    }

    const from = dto.effectiveFrom ? new Date(dto.effectiveFrom) : existing.effectiveFrom;
    const to = dto.effectiveTo !== undefined
      ? (dto.effectiveTo ? new Date(dto.effectiveTo) : null)
      : existing.effectiveTo;

    const controlType = (dto.controlType ?? existing.controlType) as never;

    if (dto.effectiveFrom || dto.effectiveTo !== undefined || dto.controlType) {
      await this.assertNoOverlap(projectId, controlType, from, to, id);
    }

    if (dto.documentId) await this.assertDocumentBelongsToOrg(dto.documentId);

    const { effectiveFrom, effectiveTo, ...rest } = dto;
    return this.prisma.rightsControlFact.update({
      where: { id },
      data: {
        ...rest,
        ...(effectiveFrom !== undefined && { effectiveFrom: from }),
        ...(effectiveTo !== undefined && { effectiveTo: to }),
      },
      include: {
        document: { select: { id: true, title: true, storageKey: true } },
      },
    });
  }

  async remove(projectId: string, id: string) {
    await this.assertFactExists(projectId, id);
    await this.prisma.rightsControlFact.delete({ where: { id } });
  }

  private async assertNoOverlap(
    projectId: string,
    controlType: string,
    from: Date,
    to: Date | null,
    excludeId: string | undefined,
  ) {
    const overlaps = await this.prisma.rightsControlFact.findMany({
      where: {
        ...this.tenantFilter({ projectId, controlType: controlType as never }),
        ...(excludeId ? { id: { not: excludeId } } : {}),
        AND: [
          to ? { effectiveFrom: { lt: to } } : {},
          { OR: [{ effectiveTo: null }, { effectiveTo: { gt: from } }] },
        ],
      },
      select: { id: true },
    });
    if (overlaps.length > 0) {
      throw new ConflictException(
        `A rights control fact for type '${controlType}' on this project already exists in this date range. ` +
          'Close the existing record first by setting its effectiveTo.',
      );
    }
  }

  private async assertProjectExists(projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: this.tenantFilter({ id: projectId }),
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');
  }

  private async assertFactExists(projectId: string, id: string) {
    const record = await this.prisma.rightsControlFact.findFirst({
      where: this.tenantFilter({ id, projectId }),
    });
    if (!record) throw new NotFoundException('Rights control fact not found');
    return record;
  }

  private async assertDocumentBelongsToOrg(documentId: string) {
    const doc = await this.prisma.document.findFirst({
      where: this.tenantFilter({ id: documentId }),
      select: { id: true },
    });
    if (!doc) throw new NotFoundException('Document not found in this organization');
  }
}
