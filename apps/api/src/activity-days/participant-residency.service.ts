import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { normalizeProvinceStateForCountry } from '@storyos/types';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.context';
import { TenantAwareService } from '../tenant/tenant-aware.service';
import { currentlyEffective, asOf } from '@storyos/database';
import { CreateResidencyStatusDto } from './dto/create-residency-status.dto';
import { UpdateResidencyStatusDto } from './dto/update-residency-status.dto';

@Injectable()
export class ParticipantResidencyService extends TenantAwareService {
  constructor(prisma: PrismaService, tenant: TenantContext) {
    super(prisma, tenant);
  }

  async listForProject(projectId: string) {
    const participants = await this.prisma.projectParticipant.findMany({
      where: this.tenantFilter({ projectId }),
      select: { personId: true },
    });
    const personIds = participants.map((p) => p.personId);
    if (personIds.length === 0) return [];

    return this.prisma.participantResidencyStatus.findMany({
      where: {
        personId: { in: personIds },
        organizationId: this.organizationId,
        deletedAt: null,
      },
      include: {
        person: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ personId: 'asc' }, { effectiveFrom: 'desc' }],
    });
  }

  async listForPerson(_projectId: string, personId: string) {
    return this.prisma.participantResidencyStatus.findMany({
      where: { personId, organizationId: this.organizationId, deletedAt: null },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  async currentForPerson(_projectId: string, personId: string) {
    return this.prisma.participantResidencyStatus.findFirst({
      where: {
        personId,
        organizationId: this.organizationId,
        deletedAt: null,
        ...currentlyEffective(),
      },
    });
  }

  async atDateForPerson(_projectId: string, personId: string, date: Date) {
    return this.prisma.participantResidencyStatus.findFirst({
      where: {
        personId,
        organizationId: this.organizationId,
        deletedAt: null,
        ...asOf(date),
      },
    });
  }

  async create(projectId: string, dto: CreateResidencyStatusDto) {
    await this.assertProjectExists(projectId);
    await this.assertPersonBelongsToOrg(dto.personId);

    const from = new Date(dto.effectiveFrom);
    const to = dto.effectiveTo ? new Date(dto.effectiveTo) : null;

    await this.assertNoOverlap(dto.personId, from, to, undefined);

    const np = normalizeProvinceStateForCountry(dto.country, dto.provinceState);
    if (!np.ok) throw new BadRequestException(np.message);

    return this.prisma.participantResidencyStatus.create({
      data: {
        ...this.tenantData({
          residencyType: dto.residencyType,
          country: dto.country,
          provinceState: np.value,
          effectiveFrom: from,
          effectiveTo: to,
          notes: dto.notes ?? null,
          createdById: this.tenant.userId,
        }),
        person: { connect: { id: dto.personId } },
      },
      include: {
        person: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async update(projectId: string, residencyId: string, dto: UpdateResidencyStatusDto) {
    await this.assertProjectExists(projectId);
    const existing = await this.assertResidencyExists(residencyId);

    const from = dto.effectiveFrom ? new Date(dto.effectiveFrom) : existing.effectiveFrom;
    const to = dto.effectiveTo !== undefined
      ? (dto.effectiveTo ? new Date(dto.effectiveTo) : null)
      : existing.effectiveTo;

    if (dto.effectiveFrom || dto.effectiveTo !== undefined) {
      await this.assertNoOverlap(existing.personId, from, to, residencyId);
    }

    const mergedCountry = dto.country ?? existing.country;
    const mergedProvince =
      dto.provinceState !== undefined ? dto.provinceState : existing.provinceState;
    const mergedNorm = normalizeProvinceStateForCountry(mergedCountry, mergedProvince ?? undefined);
    if (!mergedNorm.ok) throw new BadRequestException(mergedNorm.message);

    const { effectiveFrom, effectiveTo, provinceState: _ps, ...rest } = dto;
    return this.prisma.participantResidencyStatus.update({
      where: { id: residencyId },
      data: {
        ...rest,
        ...(dto.provinceState !== undefined && { provinceState: mergedNorm.value }),
        ...(effectiveFrom !== undefined && { effectiveFrom: from }),
        ...(effectiveTo !== undefined && { effectiveTo: to }),
      },
    });
  }

  async remove(_projectId: string, residencyId: string) {
    await this.assertResidencyExists(residencyId);
    await this.prisma.participantResidencyStatus.delete({ where: { id: residencyId } });
  }

  private async assertNoOverlap(
    personId: string,
    from: Date,
    to: Date | null,
    excludeId: string | undefined,
  ) {
    const overlaps = await this.prisma.participantResidencyStatus.findMany({
      where: {
        personId,
        organizationId: this.organizationId,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        AND: [
          to ? { effectiveFrom: { lt: to } } : {},
          { OR: [{ effectiveTo: null }, { effectiveTo: { gt: from } }] },
        ],
      },
      select: { id: true, effectiveFrom: true, effectiveTo: true },
    });

    if (overlaps.length > 0) {
      throw new ConflictException(
        'This residency record overlaps with an existing record for the same person. ' +
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

  private async assertResidencyExists(residencyId: string) {
    const record = await this.prisma.participantResidencyStatus.findFirst({
      where: { id: residencyId, organizationId: this.organizationId, deletedAt: null },
    });
    if (!record) throw new NotFoundException('Residency status record not found');
    return record;
  }

  private async assertPersonBelongsToOrg(personId: string) {
    const person = await this.prisma.person.findFirst({
      where: this.tenantFilter({ id: personId }),
      select: { id: true },
    });
    if (!person) throw new NotFoundException('Person not found in this organization');
  }
}
